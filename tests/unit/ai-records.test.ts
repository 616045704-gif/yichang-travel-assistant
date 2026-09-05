import { describe, expect, it } from 'vitest';
import type { AiRequest, AiResult } from '../../shared/contracts';
import {
  AiRateLimitError,
  AiRecordConflictError,
  AiRequestInProgressError,
  AiRetryLimitError,
  createAiRecordRepository,
} from '../../cloudfunctions/ai/records';
import { quotaWindows } from '../../cloudfunctions/ai/quota';
import { createAiDatabaseFixture } from '../helpers/ai-database';

function result(requestId: string, answer: string): AiResult {
  return { requestId, status: 'succeeded', answer, mode: 'dify', error: null, localFacts: [], references: [] };
}

async function claimToken(
  repository: ReturnType<typeof createAiRecordRepository>,
  ownerId: string,
  request: AiRequest,
  now: Date,
) {
  const claim = await repository.claim(ownerId, request, now);
  expect(claim.state).toBe('claimed');
  if (claim.state !== 'claimed') throw new Error('expected claimed request');
  return claim.attemptToken;
}

function snapshot(documents: Map<string, Record<string, unknown>>) {
  return [...documents.entries()].map(([key, value]) => [key, structuredClone(value)] as const);
}

describe('private AI records', () => {
  const chatRequest: AiRequest = { requestId: 'chat-request', kind: 'chat', question: '三峡大坝怎么去？' };

  it('allows only one concurrent claimant for the same logical request', async () => {
    const records = createAiRecordRepository(createAiDatabaseFixture());
    const now = new Date('2026-09-06T00:00:00.000Z');
    const claims = await Promise.all(Array.from({ length: 4 }, () => records.claim('owner-a', chatRequest, now)));
    expect(claims.filter(claim => claim.state === 'claimed')).toHaveLength(1);
    expect(claims.filter(claim => claim.state === 'running')).toHaveLength(3);
    expect(claims.find(claim => claim.state === 'claimed')).toMatchObject({ attemptToken: expect.any(String) });
  });

  it('rejects changed input under the same request ID', async () => {
    const records = createAiRecordRepository(createAiDatabaseFixture());
    const now = new Date('2026-09-06T00:00:00.000Z');
    await claimToken(records, 'owner-a', chatRequest, now);
    await expect(records.claim('owner-a', { ...chatRequest, question: '不同问题' }, now)).rejects.toBeInstanceOf(AiRecordConflictError);
  });

  it('allows one cooled-down failed or stale retry without charging quota twice', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const started = new Date('2026-09-06T00:00:00.000Z');
    const ownerAToken = await claimToken(records, 'owner-a', chatRequest, started);
    await records.fail('owner-a', chatRequest, ownerAToken, 'failed', new Date('2026-09-06T00:00:10.000Z'));
    expect(await records.claim('owner-a', chatRequest, new Date('2026-09-06T00:00:20.000Z'))).toMatchObject({ state: 'claimed' });
    await claimToken(records, 'owner-b', chatRequest, started);
    expect(await records.claim('owner-b', chatRequest, new Date('2026-09-06T00:01:30.000Z'))).toMatchObject({ state: 'claimed' });
    const counters = [...fixture.documents.entries()].filter(([key]) => key.startsWith('usage_counters:'));
    expect(counters.filter(([, value]) => value.ownerId === 'owner-a' && value.windowType === 'day')[0][1].count).toBe(1);
    expect(counters.filter(([, value]) => value.ownerId === 'owner-b' && value.windowType === 'day')[0][1].count).toBe(1);
  });

  it('rejects a third logical invocation and an immediate retry', async () => {
    const records = createAiRecordRepository(createAiDatabaseFixture());
    const started = new Date('2026-09-06T00:00:00.000Z');
    const firstToken = await claimToken(records, 'owner-a', chatRequest, started);
    await records.fail('owner-a', chatRequest, firstToken, 'failed', started);
    await expect(records.claim('owner-a', chatRequest, new Date(started.getTime() + 500))).rejects.toBeInstanceOf(AiRequestInProgressError);
    const secondToken = await claimToken(records, 'owner-a', chatRequest, new Date(started.getTime() + 1_000));
    await records.fail('owner-a', chatRequest, secondToken, 'timed_out', new Date(started.getTime() + 1_100));
    await expect(records.claim('owner-a', chatRequest, new Date(started.getTime() + 2_100))).rejects.toBeInstanceOf(AiRetryLimitError);
  });

  it('enforces 3 per fixed minute and 20 per Shanghai day with owner and day isolation', async () => {
    const records = createAiRecordRepository(createAiDatabaseFixture());
    const base = new Date('2026-09-06T00:00:00.000Z');
    for (let index = 0; index < 3; index += 1) {
      await records.claim('owner-a', { ...chatRequest, requestId: `minute-${index}` }, base);
    }
    await expect(records.claim('owner-a', { ...chatRequest, requestId: 'minute-4' }, base)).rejects.toBeInstanceOf(AiRateLimitError);
    await expect(records.claim('owner-b', { ...chatRequest, requestId: 'minute-owner-b' }, base)).resolves.toMatchObject({ state: 'claimed' });
    for (let index = 3; index < 20; index += 1) {
      await records.claim('owner-a', { ...chatRequest, requestId: `day-${index}` }, new Date(base.getTime() + index * 60_000));
    }
    await expect(records.claim('owner-a', { ...chatRequest, requestId: 'day-21' }, new Date(base.getTime() + 21 * 60_000))).rejects.toBeInstanceOf(AiRateLimitError);
    await expect(records.claim('owner-a', { ...chatRequest, requestId: 'next-day' }, new Date('2026-09-06T16:00:00.000Z'))).resolves.toMatchObject({ state: 'claimed' });
  });

  it('stores only a sanitized public result and never returns the private conversation ID', async () => {
    const fixture = createAiDatabaseFixture();
    const repository = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const attemptToken = await claimToken(repository, 'owner-a', chatRequest, now);
    const unsafeResult = {
      ...result(chatRequest.requestId, '聊天回答'),
      privateToken: 'must-not-leak',
      references: [{
        kind: 'local_verified', title: '本地资料', url: null, verifiedAt: '2026-09-06', placeId: 'place-1', hidden: 'must-not-leak',
      }],
    } as unknown as AiResult;
    await repository.complete('owner-a', chatRequest, attemptToken, unsafeResult, 'private-conversation', now);

    const cached = await repository.claim('owner-a', chatRequest, now);
    expect(cached).toEqual({ state: 'cached', result: {
      requestId: chatRequest.requestId, status: 'succeeded', answer: '聊天回答', mode: 'dify', error: null,
      localFacts: [], references: [{ kind: 'local_verified', title: '本地资料', url: null, verifiedAt: '2026-09-06', placeId: 'place-1' }],
    } });
    expect(JSON.stringify(cached)).not.toContain('private-conversation');
    expect(JSON.stringify(cached)).not.toContain('must-not-leak');
  });

  it('fences stale-attempt completion and failure after a reclaim', async () => {
    const fixture = createAiDatabaseFixture();
    const repository = createAiRecordRepository(fixture);
    const started = new Date('2026-09-06T00:00:00.000Z');
    const oldToken = await claimToken(repository, 'owner-a', chatRequest, started);
    const newToken = await claimToken(repository, 'owner-a', chatRequest, new Date(started.getTime() + 90_000));
    expect(newToken).not.toBe(oldToken);
    const before = snapshot(fixture.documents);

    await expect(repository.complete(
      'owner-a', chatRequest, oldToken, result(chatRequest.requestId, '过期回答'), 'old-conversation', new Date(started.getTime() + 91_000),
    )).rejects.toBeInstanceOf(AiRecordConflictError);
    expect(snapshot(fixture.documents)).toEqual(before);
    await expect(repository.fail(
      'owner-a', chatRequest, oldToken, 'failed', new Date(started.getTime() + 91_000),
    )).rejects.toBeInstanceOf(AiRecordConflictError);
    expect(snapshot(fixture.documents)).toEqual(before);

    await repository.complete(
      'owner-a', chatRequest, newToken, result(chatRequest.requestId, '新回答'), 'new-conversation', new Date(started.getTime() + 91_000),
    );
    await expect(repository.claim('owner-a', chatRequest, new Date(started.getTime() + 92_000))).resolves.toMatchObject({
      state: 'cached', result: { answer: '新回答' },
    });
  });

  it('stores only whitelisted trip input fields', async () => {
    const fixture = createAiDatabaseFixture();
    const repository = createAiRecordRepository(fixture);
    const request = {
      requestId: 'trip-safe', kind: 'trip', question: '请安排行程', attacker: 'discard-me',
      trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景'], secret: 'discard-me' },
    } as unknown as AiRequest;
    await claimToken(repository, 'owner-a', request, new Date('2026-09-06T00:00:00.000Z'));
    const stored = [...fixture.documents.entries()].find(([key]) => key.startsWith('trip_requests:'))?.[1];
    expect(stored?.request).toEqual({
      requestId: 'trip-safe', kind: 'trip', question: '请安排行程',
      trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景'] },
    });
  });

  it.each([2, 3])('rolls back every claim write when transaction set %i fails', async setNumber => {
    const fixture = createAiDatabaseFixture();
    fixture.failNextTransactionSetAt(setNumber);
    await expect(createAiRecordRepository(fixture).claim(
      'owner-a', chatRequest, new Date('2026-09-06T00:00:00.000Z'),
    )).rejects.toThrow(`injected set failure ${setNumber}`);
    expect(snapshot(fixture.documents)).toEqual([]);
  });

  it('rolls back failed complete and fail writes', async () => {
    const fixture = createAiDatabaseFixture();
    const repository = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const attemptToken = await claimToken(repository, 'owner-a', chatRequest, now);
    const before = snapshot(fixture.documents);

    fixture.failNextTransactionSetAt(1);
    await expect(repository.complete(
      'owner-a', chatRequest, attemptToken, result(chatRequest.requestId, '回答'), 'conversation', now,
    )).rejects.toThrow('injected set failure 1');
    expect(snapshot(fixture.documents)).toEqual(before);

    fixture.failNextTransactionSetAt(1);
    await expect(repository.fail('owner-a', chatRequest, attemptToken, 'failed', now)).rejects.toThrow('injected set failure 1');
    expect(snapshot(fixture.documents)).toEqual(before);
  });

  it.each([
    ['attemptCount', '1'],
    ['attemptCount', 0],
    ['attemptCount', 1.5],
    ['attemptCount', Number.MAX_SAFE_INTEGER + 1],
    ['quotaChargedAt', 'not-an-iso-date'],
  ])('fails closed when operational field %s is malformed', async (field, value) => {
    const fixture = createAiDatabaseFixture();
    const repository = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    await claimToken(repository, 'owner-a', chatRequest, now);
    const recordEntry = [...fixture.documents.entries()].find(([key]) => key.startsWith('ai_messages:'));
    if (!recordEntry) throw new Error('expected request record');
    fixture.documents.set(recordEntry[0], { ...recordEntry[1], [field]: value });
    const before = snapshot(fixture.documents);

    await expect(repository.claim('owner-a', chatRequest, new Date(now.getTime() + 90_000))).rejects.toThrow(`invalid AI ${field}`);
    expect(snapshot(fixture.documents)).toEqual(before);
  });

  it('fails closed without writes when a stored quota counter is malformed', async () => {
    const fixture = createAiDatabaseFixture();
    const now = new Date('2026-09-06T00:00:00.000Z');
    const minute = quotaWindows('owner-a', now)[0];
    fixture.documents.set(`usage_counters:${minute.id}`, {
      _id: minute.id, ownerId: 'owner-a', windowType: 'minute', windowStart: minute.windowStart, count: '2',
    });
    const before = [...fixture.documents.entries()];
    await expect(createAiRecordRepository(fixture).claim('owner-a', chatRequest, now)).rejects.toThrow('invalid AI quota counter');
    expect([...fixture.documents.entries()]).toEqual(before);
  });

  it('stores chat and trip records separately and lists only the owner records', async () => {
    const fixture = createAiDatabaseFixture();
    const repository = createAiRecordRepository(fixture);
    const chat: AiRequest = { requestId: 'chat-1', kind: 'chat', question: '问题' };
    const trip: AiRequest = { requestId: 'trip-1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: [] } };
    const other = { ...chat, requestId: 'chat-2' };
    for (const [ownerId, request, answer] of [
      ['owner-a', chat, '聊天回答'], ['owner-a', trip, '行程回答'], ['owner-b', other, '其他用户回答'],
    ] as const) {
      const attemptToken = await claimToken(repository, ownerId, request, new Date());
      await repository.complete(ownerId, request, attemptToken, result(request.requestId, answer), 'private-conversation', new Date());
    }

    const records = await repository.list('owner-a');
    expect(records).toHaveLength(2);
    expect(records.map(item => item.kind).sort()).toEqual(['chat', 'trip']);
    expect(JSON.stringify(records)).not.toContain('其他用户回答');
    expect(JSON.stringify(records)).not.toContain('private-conversation');
  });
});

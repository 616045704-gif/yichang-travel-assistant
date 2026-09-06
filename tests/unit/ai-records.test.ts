import { describe, expect, it } from 'vitest';
import type { AiRequest, AiResult } from '../../shared/contracts';
import {
  AiRateLimitError,
  AiRecordConflictError,
  AiRequestInProgressError,
  AiRetryLimitError,
  createAiRecordRepository,
} from '../../cloudfunctions/ai/records';
import { createAiConversationRepository } from '../../cloudfunctions/ai/repository';
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

function withHistoryQueryLog(fixture: ReturnType<typeof createAiDatabaseFixture>) {
  const queries: Array<{
    collection: string;
    query: Record<string, unknown>;
    orders: Array<[string, 'asc' | 'desc']>;
    limit: number | null;
  }> = [];
  const database = {
    ...fixture,
    collection(name: string) {
      const collection = fixture.collection(name);
      return {
        ...collection,
        where(query: Record<string, unknown>) {
          const source = collection.where(query);
          const entry = { collection: name, query, orders: [] as Array<[string, 'asc' | 'desc']>, limit: null as number | null };
          queries.push(entry);
          const wrapped = {
            orderBy(field: string, direction: 'asc' | 'desc') {
              entry.orders.push([field, direction]);
              source.orderBy(field, direction);
              return wrapped;
            },
            limit(count: number) {
              entry.limit = count;
              return source.limit(count);
            },
          };
          return wrapped;
        },
      };
    },
  };
  return { database, queries };
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

  it('enforces 6 per fixed minute and 100 per Shanghai day with owner and day isolation', async () => {
    const records = createAiRecordRepository(createAiDatabaseFixture());
    const base = new Date('2026-09-06T00:00:00.000Z');
    for (let index = 0; index < 6; index += 1) {
      const limitedRequest = { ...chatRequest, requestId: `minute-${index}` };
      const token = await claimToken(records, 'owner-a', limitedRequest, base);
      await records.fail('owner-a', limitedRequest, token, 'failed', base);
    }
    await expect(records.claim('owner-a', { ...chatRequest, requestId: 'minute-7' }, base)).rejects.toBeInstanceOf(AiRateLimitError);
    await expect(records.claim('owner-b', { ...chatRequest, requestId: 'minute-owner-b' }, base)).resolves.toMatchObject({ state: 'claimed' });
    for (let index = 6; index < 100; index += 1) {
      const limitedRequest = { ...chatRequest, requestId: `day-${index}` };
      const now = new Date(base.getTime() + index * 60_000);
      const token = await claimToken(records, 'owner-a', limitedRequest, now);
      await records.fail('owner-a', limitedRequest, token, 'failed', now);
    }
    await expect(records.claim('owner-a', { ...chatRequest, requestId: 'day-101' }, new Date(base.getTime() + 101 * 60_000))).rejects.toBeInstanceOf(AiRateLimitError);
    await expect(records.claim('owner-a', { ...chatRequest, requestId: 'next-day' }, new Date('2026-09-06T16:00:00.000Z'))).resolves.toMatchObject({ state: 'claimed' });
  });

  it('serializes different request IDs for one owner and kind but keeps chat and trip independent', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const first = await records.claim('owner-a', { requestId: 'chat-1', kind: 'chat', question: '第一问' }, now);
    expect(first).toMatchObject({ state: 'claimed', attemptToken: expect.any(String), conversationId: null, sessionGeneration: 0 });
    await expect(records.claim('owner-a', { requestId: 'chat-2', kind: 'chat', question: '第二问' }, now)).resolves.toEqual({ state: 'running' });
    await expect(records.claim('owner-a', {
      requestId: 'trip-1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: [] },
    }, now)).resolves.toMatchObject({ state: 'claimed', attemptToken: expect.any(String), conversationId: null, sessionGeneration: 0 });
    const sessions = [...fixture.documents.entries()].filter(([key]) => key.startsWith('ai_sessions:'));
    expect(sessions).toHaveLength(2);
    expect([...fixture.documents.values()].filter(value => value.activeAttemptToken === (first.state === 'claimed' ? first.attemptToken : ''))).toHaveLength(1);
  });

  it('returns missing_session for a trip follow-up without charging or writing', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    await expect(records.claim('owner-a', {
      requestId: 'trip-followup', kind: 'trip', question: '第二天轻松一点',
    }, new Date('2026-09-06T00:00:00.000Z'))).resolves.toEqual({ state: 'missing_session' });
    expect(snapshot(fixture.documents)).toEqual([]);
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

  it('does not let an in-flight completion restore a reset session', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const conversations = createAiConversationRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const claim = await records.claim('owner-a', chatRequest, now);
    expect(claim).toMatchObject({ state: 'claimed', attemptToken: expect.any(String), sessionGeneration: 0 });
    if (claim.state !== 'claimed') throw new Error('expected claimed request');
    await conversations.reset('owner-a', 'chat');
    await records.complete(
      'owner-a', chatRequest, claim.attemptToken, result(chatRequest.requestId, '旧请求回答'), 'old-private-id', new Date(now.getTime() + 1_000),
    );
    await expect(conversations.get('owner-a', 'chat')).resolves.toBeNull();
    const session = [...fixture.documents.values()].find(value => value.kind === 'chat' && 'generation' in value && !('requestId' in value));
    expect(session).toMatchObject({ generation: 1, activeRequestId: null, activeAttemptToken: null, lastCompletedRequestId: null });
  });

  it('does not let an in-flight failure clear or rewrite a reset session', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const conversations = createAiConversationRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const token = await claimToken(records, 'owner-a', chatRequest, now);
    await conversations.reset('owner-a', 'chat');
    const beforeSession = snapshot(fixture.documents).find(([key]) => key.startsWith('ai_sessions:'));
    await records.fail('owner-a', chatRequest, token, 'failed', new Date(now.getTime() + 1_000));
    expect(snapshot(fixture.documents).find(([key]) => key.startsWith('ai_sessions:'))).toEqual(beforeSession);
  });

  it('rolls back a failed transactional reset', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const conversations = createAiConversationRepository(fixture);
    await claimToken(records, 'owner-a', chatRequest, new Date('2026-09-06T00:00:00.000Z'));
    const before = snapshot(fixture.documents);
    fixture.failNextTransactionSetAt(1);
    await expect(conversations.reset('owner-a', 'chat')).rejects.toThrow('injected set failure 1');
    expect(snapshot(fixture.documents)).toEqual(before);
  });

  it('never rolls the active session back when an older cached request is replayed', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const conversations = createAiConversationRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const firstToken = await claimToken(records, 'owner-a', chatRequest, now);
    await records.complete('owner-a', chatRequest, firstToken, result(chatRequest.requestId, '第一答'), 'private-first', now);
    const secondRequest = { ...chatRequest, requestId: 'request-2', question: '第二问' };
    const secondToken = await claimToken(records, 'owner-a', secondRequest, new Date(now.getTime() + 1_000));
    await records.complete('owner-a', secondRequest, secondToken, result(secondRequest.requestId, '第二答'), 'private-second', new Date(now.getTime() + 1_000));

    await expect(records.claim('owner-a', chatRequest, new Date(now.getTime() + 2_000))).resolves.toMatchObject({ state: 'cached' });
    await expect(conversations.get('owner-a', 'chat')).resolves.toBe('private-second');
  });

  it('narrowly repairs only the last completed request when its current-generation pointer is missing', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const conversations = createAiConversationRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const token = await claimToken(records, 'owner-a', chatRequest, now);
    await records.complete('owner-a', chatRequest, token, result(chatRequest.requestId, '第一答'), 'private-first', now);
    const sessionEntry = [...fixture.documents.entries()].find(([key]) => key.startsWith('ai_sessions:'));
    if (!sessionEntry) throw new Error('expected session');
    fixture.documents.set(sessionEntry[0], { ...sessionEntry[1], difyConversationId: null });

    await expect(records.claim('owner-a', chatRequest, new Date(now.getTime() + 1_000))).resolves.toMatchObject({ state: 'cached' });
    await expect(conversations.get('owner-a', 'chat')).resolves.toBe('private-first');
  });

  it('does not repair an older cached pointer while the same-kind session has an active lease', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const firstToken = await claimToken(records, 'owner-a', chatRequest, now);
    await records.complete('owner-a', chatRequest, firstToken, result(chatRequest.requestId, '第一答'), 'private-first', now);
    const sessionEntry = [...fixture.documents.entries()].find(([key]) => key.startsWith('ai_sessions:'));
    if (!sessionEntry) throw new Error('expected session');
    fixture.documents.set(sessionEntry[0], { ...sessionEntry[1], difyConversationId: null });
    await claimToken(
      records,
      'owner-a',
      { ...chatRequest, requestId: 'active-request', question: '当前进行中的问题' },
      new Date(now.getTime() + 1_000),
    );
    const before = snapshot(fixture.documents);

    await expect(records.claim('owner-a', chatRequest, new Date(now.getTime() + 2_000))).resolves.toMatchObject({
      state: 'cached', result: { answer: '第一答' },
    });
    expect(snapshot(fixture.documents)).toEqual(before);
  });

  it('replays a sanitized legacy success without writing or repairing its missing session pointer', async () => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const token = await claimToken(records, 'owner-a', chatRequest, now);
    await records.complete('owner-a', chatRequest, token, result(chatRequest.requestId, '旧版回答'), 'private-legacy', now);
    const requestEntry = [...fixture.documents.entries()].find(([key]) => key.startsWith('ai_messages:'));
    const sessionEntry = [...fixture.documents.entries()].find(([key]) => key.startsWith('ai_sessions:'));
    if (!requestEntry || !sessionEntry) throw new Error('expected request and session records');
    const legacy: Record<string, unknown> = {
      ...requestEntry[1],
      result: { ...(requestEntry[1].result as Record<string, unknown>), hidden: 'discard-me' },
    };
    delete legacy.attemptCount;
    delete legacy.quotaChargedAt;
    fixture.documents.set(requestEntry[0], legacy);
    fixture.documents.set(sessionEntry[0], { ...sessionEntry[1], difyConversationId: null });
    const before = snapshot(fixture.documents);

    await expect(records.claim('owner-a', chatRequest, new Date(now.getTime() + 1_000))).resolves.toEqual({
      state: 'cached',
      result: result(chatRequest.requestId, '旧版回答'),
    });
    expect(snapshot(fixture.documents)).toEqual(before);
  });

  it.each([
    ['only attemptCount absent', { attemptCount: undefined }],
    ['only quotaChargedAt absent', { quotaChargedAt: undefined }],
    ['both operational fields null', { attemptCount: null, quotaChargedAt: null }],
    ['attemptCount malformed', { attemptCount: '1' }],
    ['quotaChargedAt malformed', { quotaChargedAt: 'not-an-iso-date' }],
  ])('rejects a successful record with %s and performs no writes', async (_case, patch) => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const token = await claimToken(records, 'owner-a', chatRequest, now);
    await records.complete('owner-a', chatRequest, token, result(chatRequest.requestId, '回答'), 'private-current', now);
    const requestEntry = [...fixture.documents.entries()].find(([key]) => key.startsWith('ai_messages:'));
    if (!requestEntry) throw new Error('expected request record');
    fixture.documents.set(requestEntry[0], { ...requestEntry[1], ...patch });
    const before = snapshot(fixture.documents);

    await expect(records.claim('owner-a', chatRequest, new Date(now.getTime() + 1_000))).rejects.toThrow();
    expect(snapshot(fixture.documents)).toEqual(before);
  });

  it.each([
    ['a mismatched result status', { status: 'failed' }],
    ['a mismatched result request ID', { requestId: 'other-request' }],
  ])('rejects a cached success with %s without repairing its session', async (_case, resultPatch) => {
    const fixture = createAiDatabaseFixture();
    const records = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const token = await claimToken(records, 'owner-a', chatRequest, now);
    await records.complete('owner-a', chatRequest, token, result(chatRequest.requestId, '第一答'), 'private-first', now);
    const requestEntry = [...fixture.documents.entries()].find(([key]) => key.startsWith('ai_messages:'));
    const sessionEntry = [...fixture.documents.entries()].find(([key]) => key.startsWith('ai_sessions:'));
    if (!requestEntry || !sessionEntry) throw new Error('expected request and session records');
    fixture.documents.set(requestEntry[0], {
      ...requestEntry[1],
      result: { ...(requestEntry[1].result as Record<string, unknown>), ...resultPatch },
    });
    fixture.documents.set(sessionEntry[0], { ...sessionEntry[1], difyConversationId: null });
    const beforeSession = structuredClone(fixture.documents.get(sessionEntry[0]));

    await expect(records.claim('owner-a', chatRequest, new Date(now.getTime() + 1_000))).rejects.toThrow('invalid successful AI record');
    expect(fixture.documents.get(sessionEntry[0])).toEqual(beforeSession);
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

  it.each([1, 2, 3, 4])('rolls back every claim write when transaction set %i fails', async setNumber => {
    const fixture = createAiDatabaseFixture();
    fixture.failNextTransactionSetAt(setNumber);
    await expect(createAiRecordRepository(fixture).claim(
      'owner-a', chatRequest, new Date('2026-09-06T00:00:00.000Z'),
    )).rejects.toThrow(`injected set failure ${setNumber}`);
    expect(snapshot(fixture.documents)).toEqual([]);
  });

  it.each([1, 2])('rolls back every complete write when transaction set %i fails', async setNumber => {
    const fixture = createAiDatabaseFixture();
    const repository = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const attemptToken = await claimToken(repository, 'owner-a', chatRequest, now);
    const before = snapshot(fixture.documents);

    fixture.failNextTransactionSetAt(setNumber);
    await expect(repository.complete(
      'owner-a', chatRequest, attemptToken, result(chatRequest.requestId, '回答'), 'conversation', now,
    )).rejects.toThrow(`injected set failure ${setNumber}`);
    expect(snapshot(fixture.documents)).toEqual(before);
  });

  it.each([1, 2])('rolls back every fail write when transaction set %i fails', async setNumber => {
    const fixture = createAiDatabaseFixture();
    const repository = createAiRecordRepository(fixture);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const attemptToken = await claimToken(repository, 'owner-a', chatRequest, now);
    const before = snapshot(fixture.documents);

    fixture.failNextTransactionSetAt(setNumber);
    await expect(repository.fail('owner-a', chatRequest, attemptToken, 'failed', now)).rejects.toThrow(`injected set failure ${setNumber}`);
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

  it('queries, merges, and deterministically limits owner history to the newest 50 records', async () => {
    const fixture = createAiDatabaseFixture();
    const { database, queries } = withHistoryQueryLog(fixture);
    const expected: Array<{ requestId: string; createdAt: string }> = [];
    for (let index = 0; index < 60; index += 1) {
      const recordId = `record-${String((index * 17) % 60).padStart(2, '0')}`;
      const kind = index % 2 === 0 ? 'chat' : 'trip';
      const createdAt = `2026-09-06T00:00:0${index % 5}.000Z`;
      const request: AiRequest = kind === 'chat'
        ? { requestId: recordId, kind, question: ` 问题 ${index} ` }
        : { requestId: recordId, kind, question: ` 调整 ${index} ` };
      fixture.documents.set(`${kind === 'chat' ? 'ai_messages' : 'trip_requests'}:${recordId}`, {
        _id: recordId,
        ownerId: 'owner-a',
        kind,
        request,
        result: result(recordId, `回答 ${index}`),
        status: 'succeeded',
        createdAt,
      });
      expected.push({ requestId: recordId, createdAt });
    }
    for (let index = 0; index < 4; index += 1) {
      fixture.documents.set(`ai_messages:other-${index}`, {
        _id: `other-${index}`, ownerId: 'owner-b', kind: 'chat',
        request: { requestId: `other-${index}`, kind: 'chat', question: '其他用户问题' },
        result: result(`other-${index}`, '其他用户回答'), status: 'succeeded', createdAt: '2026-09-07T00:00:00.000Z',
      });
    }

    const records = await createAiRecordRepository(database).list('owner-a');
    const ordered = expected
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.requestId.localeCompare(right.requestId))
      .slice(0, 50);
    expect(records).toHaveLength(50);
    expect(records.map(item => ({ requestId: item.requestId, createdAt: item.createdAt }))).toEqual(ordered);
    expect(records.every(item => item.prompt === item.prompt.trim() && !('recordId' in item) && !('_id' in item))).toBe(true);
    expect(JSON.stringify(records)).not.toMatch(/其他用户|owner-[ab]/);
    expect(queries).toEqual([
      { collection: 'ai_messages', query: { ownerId: 'owner-a' }, orders: [['createdAt', 'desc'], ['_id', 'asc']], limit: 50 },
      { collection: 'trip_requests', query: { ownerId: 'owner-a' }, orders: [['createdAt', 'desc'], ['_id', 'asc']], limit: 50 },
    ]);
  });

  it('uses safe prompts for chat, initial trip, follow-up, and invalid legacy records', async () => {
    const fixture = createAiDatabaseFixture();
    const records = [
      { id: 'chat-safe', kind: 'chat', request: { requestId: 'chat-safe', kind: 'chat', question: '  原始问题  ' } },
      { id: 'trip-safe', kind: 'trip', request: { requestId: 'trip-safe', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景'] } } },
      { id: 'trip-followup', kind: 'trip', request: { requestId: 'trip-followup', kind: 'trip', question: '  第二天轻松一点  ' } },
      { id: 'legacy-trip', kind: 'trip', request: { answer: '不能作为问题回显' } },
    ] as const;
    for (const [index, item] of records.entries()) {
      fixture.documents.set(`${item.kind === 'chat' ? 'ai_messages' : 'trip_requests'}:${item.id}`, {
        _id: item.id, ownerId: 'owner-a', kind: item.kind, request: item.request,
        result: result(item.id, `回答 ${index}`), status: 'succeeded', createdAt: `2026-09-06T00:00:0${index}.000Z`,
      });
    }
    fixture.documents.set('ai_messages:wrong-kind', {
      _id: 'wrong-kind', ownerId: 'owner-a', kind: 'trip', request: records[0].request,
      result: result('wrong-kind', '不应返回'), status: 'succeeded', createdAt: '2026-09-06T00:00:10.000Z',
    });
    fixture.documents.set('trip_requests:invalid-result', {
      _id: 'invalid-result', ownerId: 'owner-a', kind: 'trip', request: records[1].request,
      result: { ...result('invalid-result', '不应返回'), status: 'failed' }, status: 'succeeded', createdAt: '2026-09-06T00:00:11.000Z',
    });

    const history = await createAiRecordRepository(fixture).list('owner-a');
    expect(Object.fromEntries(history.map(item => [item.requestId, item.prompt]))).toEqual({
      'chat-safe': '原始问题',
      'trip-safe': '宜昌｜2人｜2天｜总预算3000元｜偏好：自然风景',
      'trip-followup': '第二天轻松一点',
      'legacy-trip': '历史行程定制',
    });
    expect(JSON.stringify(history)).not.toContain('不能作为问题回显');
  });
});

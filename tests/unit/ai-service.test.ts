import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiRequest, AiResult } from '../../shared/contracts';
import { createAiConversationRepository } from '../../cloudfunctions/ai/repository';
import { createAiRecordRepository, type AiRecordRepository } from '../../cloudfunctions/ai/records';
import { createLocalFactRetriever } from '../../cloudfunctions/ai/retrieval';
import { handleAiRequest } from '../../cloudfunctions/ai/service';
import type { DifyClient } from '../../cloudfunctions/ai/dify';

const request: AiRequest = { requestId: 'request-1', kind: 'chat', question: '三峡大坝适合几月去？' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('development mock AI service', () => {
  it('returns a deterministic mock answer by default in a development build', async () => {
    vi.stubGlobal('__BUILD_MODE__', 'development');
    const { submitAi } = await import('../../miniprogram/services/ai');
    await expect(submitAi(request)).resolves.toEqual(expect.objectContaining({
      requestId: request.requestId,
      status: 'succeeded',
      mode: 'mock',
      answer: '模拟回答：三峡大坝适合几月去？',
      error: null,
    }));
  });

  it('sends an unchanged request to aiService outside development mock mode', async () => {
    vi.stubGlobal('__BUILD_MODE__', 'demo');
    const liveResult: AiResult = {
      requestId: request.requestId, status: 'succeeded', answer: '真实回答', mode: 'dify', error: null, localFacts: [], references: [],
    };
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: liveResult } }));
    vi.stubGlobal('wx', { cloud: { callFunction } });
    const { submitAi } = await import('../../miniprogram/services/ai');
    await expect(submitAi(request)).resolves.toEqual(liveResult);
    expect(callFunction).toHaveBeenCalledWith({ name: 'aiService', data: { action: 'submit', request } });
  });

  it('keeps development mock and resets only the requested live conversation', async () => {
    vi.stubGlobal('__BUILD_MODE__', 'development');
    const { resetAiConversation, submitAi } = await import('../../miniprogram/services/ai');
    await expect(submitAi(request)).resolves.toMatchObject({ mode: 'mock' });
    await expect(resetAiConversation('trip')).resolves.toBeUndefined();

    vi.resetModules();
    vi.stubGlobal('__BUILD_MODE__', 'demo');
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: { kind: 'trip' } } }));
    vi.stubGlobal('wx', { cloud: { callFunction } });
    const live = await import('../../miniprogram/services/ai');
    await expect(live.resetAiConversation('trip')).resolves.toBeUndefined();
    expect(callFunction).toHaveBeenCalledWith({ name: 'aiService', data: { action: 'resetConversation', kind: 'trip' } });
  });

  it('keeps a live cloud failure as an error instead of falling back to mock', async () => {
    vi.stubGlobal('__BUILD_MODE__', 'demo');
    vi.stubGlobal('wx', { cloud: { callFunction: vi.fn(async () => ({ result: { code: 'AI_UNAVAILABLE', data: null, message: 'AI 服务暂不可用，请稍后重试。' } })) } });
    const { submitAi } = await import('../../miniprogram/services/ai');
    await expect(submitAi(request)).rejects.toThrow('AI 服务暂不可用，请稍后重试。');
  });

  it('loads live history through the owner-scoped aiService action', async () => {
    vi.stubGlobal('__BUILD_MODE__', 'demo');
    const history = [{ requestId: 'c1', kind: 'chat', createdAt: '2026-09-05T00:00:00.000Z', status: 'succeeded', answer: '回答', mode: 'dify', error: null, localFacts: [], references: [] }];
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: history } }));
    vi.stubGlobal('wx', { cloud: { callFunction } });
    const { listAiRecords } = await import('../../miniprogram/services/ai');

    await expect(listAiRecords()).resolves.toEqual(history);
    expect(callFunction).toHaveBeenCalledWith({ name: 'aiService', data: { action: 'listRecords' } });
  });
});

function database() {
  const documents = new Map<string, Record<string, unknown>>();
  return {
    documents,
    collection(name: string) {
      return {
        doc(id: string) {
          const key = `${name}:${id}`;
          return {
            async get() { const data = documents.get(key); if (!data) throw new Error('not found'); return { data }; },
            async set(input: { data: Record<string, unknown> }) { documents.set(key, { ...input.data }); },
          };
        },
        where(query: Record<string, unknown>) {
          return { limit() { return { async get() {
            const data = [...documents.entries()]
              .filter(([key]) => key.startsWith(`${name}:`))
              .map(([, value]) => value)
              .filter(value => Object.entries(query).every(([field, expected]) => value[field] === expected));
            return { data };
          } }; } };
        },
      };
    },
  };
}

function emptyRecords(): AiRecordRepository {
  return { find: vi.fn(async () => null), save: vi.fn(async () => undefined), list: vi.fn(async () => []) };
}

describe('private live AI service', () => {
  it('stores chat and trip conversations independently and resets only the requested slot', async () => {
    const db = database();
    const repository = createAiConversationRepository(db);
    const client: DifyClient = { send: vi.fn()
      .mockResolvedValueOnce({ answer: '聊天回答', conversationId: 'chat-c1' })
      .mockResolvedValueOnce({ answer: '行程回答', conversationId: 'trip-c1' }) };
    const dependencies = { ownerId: 'trusted-owner', user: 'derived-user', repository, records: createAiRecordRepository(db), dify: client, retrieve: vi.fn(async () => ['本地已核验资料']) };
    await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '问什么' } }, dependencies);
    await handleAiRequest({ action: 'submit', request: { requestId: 't1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景'] } } }, dependencies);
    await handleAiRequest({ action: 'resetConversation', kind: 'chat' }, dependencies);
    await expect(repository.get('trusted-owner', 'chat')).resolves.toBeNull();
    await expect(repository.get('trusted-owner', 'trip')).resolves.toBe('trip-c1');
    expect(client.send).toHaveBeenNthCalledWith(1, 'chat', expect.anything(), null, 'derived-user', ['本地已核验资料']);
    expect(client.send).toHaveBeenNthCalledWith(2, 'trip', expect.anything(), null, 'derived-user', ['本地已核验资料']);
  });

  it('returns a persisted result for an identical requestId without calling Dify twice', async () => {
    const db = database();
    const dify: DifyClient = { send: vi.fn(async () => ({ answer: '聊天回答', conversationId: 'chat-c1' })) };
    const dependencies = {
      ownerId: 'trusted-owner', user: 'derived-user', repository: createAiConversationRepository(db), records: createAiRecordRepository(db),
      dify, retrieve: vi.fn(async () => ['本地已核验资料']),
    };
    const event = { action: 'submit', request: { requestId: 'same-id', kind: 'chat', question: '同一个问题' } } as const;

    await expect(handleAiRequest(event, dependencies)).resolves.toMatchObject({ code: 'OK', data: { answer: '聊天回答' } });
    await expect(handleAiRequest(event, dependencies)).resolves.toMatchObject({ code: 'OK', data: { answer: '聊天回答' } });
    expect(dify.send).toHaveBeenCalledTimes(1);
    expect(dependencies.retrieve).toHaveBeenCalledTimes(1);
    await expect(handleAiRequest({ action: 'submit', request: { requestId: 'same-id', kind: 'chat', question: '换一个问题' } }, dependencies)).resolves.toMatchObject({ code: 'CONFLICT' });
  });

  it('does not hide database permission failures as missing conversations', async () => {
    const denied = {
      collection() {
        return { doc() { return { async get() { throw new Error('permission denied'); }, async set() {} }; } };
      },
    };
    const repository = createAiConversationRepository(denied);
    await expect(repository.get('trusted-owner', 'chat')).rejects.toThrow('permission denied');
  });

  it('returns only safe errors for unauthenticated, malformed and unavailable requests', async () => {
    const repository = createAiConversationRepository(database());
    const dify: DifyClient = { send: vi.fn(async () => { throw Object.assign(new Error('chat-secret'), { code: 'AI_UNAVAILABLE' }); }) };
    const dependencies = { ownerId: 'trusted-owner', user: 'derived-user', repository, records: emptyRecords(), dify, retrieve: vi.fn(async () => []) };
    expect((await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '问什么' } }, { ...dependencies, ownerId: null })).code).toBe('UNAUTHENTICATED');
    expect((await handleAiRequest(null, dependencies)).code).toBe('INVALID_INPUT');
    expect((await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat' } }, dependencies)).code).toBe('INVALID_INPUT');
    const result = await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '问什么' } }, dependencies);
    expect(result).toMatchObject({ code: 'AI_UNAVAILABLE', data: null, message: 'AI 服务暂不可用，请稍后重试。' });
    expect(JSON.stringify(result)).not.toContain('chat-secret');
  });

  it('accepts a budget with at most two decimals and rejects a more precise budget', async () => {
    const repository = createAiConversationRepository(database());
    const dify: DifyClient = { send: vi.fn(async () => ({ answer: '行程回答', conversationId: 'trip-c1' })) };
    const dependencies = { ownerId: 'trusted-owner', user: 'derived-user', repository, records: emptyRecords(), dify, retrieve: vi.fn(async () => []) };
    const valid = await handleAiRequest({ action: 'submit', request: { requestId: 't1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000.50, days: 2, preferences: ['自然风景'] } } }, dependencies);
    const invalid = await handleAiRequest({ action: 'submit', request: { requestId: 't2', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000.555, days: 2, preferences: ['自然风景'] } } }, dependencies);
    expect(valid).toMatchObject({ code: 'OK', data: { status: 'succeeded' } });
    expect(invalid).toMatchObject({ code: 'INVALID_INPUT', data: null });
    expect(dify.send).toHaveBeenCalledTimes(1);
  });

  it('reads only published local place facts before a Dify request and marks missing facts as uncertain', async () => {
    const calls: Record<string, unknown>[] = [];
    const places = [{ _id: 'published-place', status: 'published', name: '三峡大坝', category: 'scenic', district: '夷陵区', address: '湖北省宜昌市夷陵区', tags: ['工程景观'], intro: '已核验简介', openNotice: '开放以公告为准' }];
    const localDatabase = {
      collection(name: string) {
        return {
          where(query: Record<string, unknown>) { calls.push({ name, query }); return { limit() { return { async get() { return { data: places }; } }; } }; },
          doc(id: string) { return { async get() { if (name !== 'place_contents' || id !== 'published-place') throw new Error('not found'); return { data: { visitAdvice: '建议预留半天' } }; } }; },
        };
      },
    };
    const retrieve = createLocalFactRetriever(localDatabase);
    await expect(retrieve({ requestId: 'c1', kind: 'chat', question: '三峡大坝怎么去？' })).resolves.toEqual([expect.stringContaining('三峡大坝')]);
    await expect(retrieve({ requestId: 'c2', kind: 'chat', question: '未知地点' })).resolves.toEqual([expect.stringContaining('不确定')]);
    await expect(retrieve({ requestId: 't1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: [] } })).resolves.toEqual([expect.stringContaining('三峡大坝')]);
    await expect(retrieve({ requestId: 'c3', kind: 'chat', question: '宜昌有哪些景区？' })).resolves.toEqual([expect.stringContaining('三峡大坝')]);
    expect(calls).toEqual(Array.from({ length: 4 }, () => ({ name: 'places', query: { status: 'published' } })));
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiRequest } from '../../shared/contracts';
import { createAiConversationRepository } from '../../cloudfunctions/ai/repository';
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

  it('does not activate the mock adapter in a demo build', async () => {
    vi.stubGlobal('__BUILD_MODE__', 'demo');
    const { submitAi } = await import('../../miniprogram/services/ai');
    await expect(submitAi(request)).rejects.toThrow('模拟服务暂不可用，请稍后重试');
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
      };
    },
  };
}

describe('private live AI service', () => {
  it('stores chat and trip conversations independently and resets only the requested slot', async () => {
    const db = database();
    const repository = createAiConversationRepository(db);
    const client: DifyClient = { send: vi.fn()
      .mockResolvedValueOnce({ answer: '聊天回答', conversationId: 'chat-c1' })
      .mockResolvedValueOnce({ answer: '行程回答', conversationId: 'trip-c1' }) };
    const dependencies = { ownerId: 'trusted-owner', user: 'derived-user', repository, dify: client, retrieve: vi.fn(async () => ['本地已核验资料']) };
    await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '问什么' } }, dependencies);
    await handleAiRequest({ action: 'submit', request: { requestId: 't1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景'] } } }, dependencies);
    await handleAiRequest({ action: 'resetConversation', kind: 'chat' }, dependencies);
    await expect(repository.get('trusted-owner', 'chat')).resolves.toBeNull();
    await expect(repository.get('trusted-owner', 'trip')).resolves.toBe('trip-c1');
    expect(client.send).toHaveBeenNthCalledWith(1, 'chat', expect.anything(), null, 'derived-user', ['本地已核验资料']);
    expect(client.send).toHaveBeenNthCalledWith(2, 'trip', expect.anything(), null, 'derived-user', ['本地已核验资料']);
  });

  it('returns only safe errors for unauthenticated, malformed and unavailable requests', async () => {
    const repository = createAiConversationRepository(database());
    const dify: DifyClient = { send: vi.fn(async () => { throw Object.assign(new Error('chat-secret'), { code: 'AI_UNAVAILABLE' }); }) };
    const dependencies = { ownerId: 'trusted-owner', user: 'derived-user', repository, dify, retrieve: vi.fn(async () => []) };
    expect((await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '问什么' } }, { ...dependencies, ownerId: null })).code).toBe('UNAUTHENTICATED');
    expect((await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat' } }, dependencies)).code).toBe('INVALID_INPUT');
    const result = await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '问什么' } }, dependencies);
    expect(result).toMatchObject({ code: 'AI_UNAVAILABLE', data: null, message: 'AI 服务暂不可用，请稍后重试。' });
    expect(JSON.stringify(result)).not.toContain('chat-secret');
  });

  it('reads only published local place facts before a Dify request and marks missing facts as uncertain', async () => {
    const calls: Record<string, unknown>[] = [];
    const places = [{ _id: 'published-place', status: 'published', name: '三峡大坝', intro: '已核验简介', openNotice: '开放以公告为准' }];
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
    expect(calls).toEqual([{ name: 'places', query: { status: 'published' } }, { name: 'places', query: { status: 'published' } }]);
  });
});

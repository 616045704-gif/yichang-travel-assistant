import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiRequest, AiResult } from '../../shared/contracts';
import { createAiConversationRepository } from '../../cloudfunctions/ai/repository';
import {
  AiRateLimitError,
  AiRecordConflictError,
  AiRequestInProgressError,
  AiRetryLimitError,
} from '../../cloudfunctions/ai/records';
import { createLocalFactRetriever } from '../../cloudfunctions/ai/retrieval';
import { handleAiRequest, type AiServiceDependencies } from '../../cloudfunctions/ai/service';
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

function result(requestId: string, answer: string): AiResult {
  return { requestId, status: 'succeeded', answer, mode: 'dify', error: null, localFacts: [], references: [] };
}

function serviceDependencies(overrides: Partial<AiServiceDependencies> = {}): AiServiceDependencies {
  return {
    ownerId: 'trusted-owner',
    user: 'derived-user',
    repository: { get: vi.fn(async () => null), reset: vi.fn(async () => undefined) },
    records: {
      claim: vi.fn(async () => ({
        state: 'claimed' as const, attemptToken: 'attempt-test', conversationId: null, sessionGeneration: 0,
      })),
      complete: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
    },
    retrieve: vi.fn(async () => ['本地已核验资料']),
    dify: { send: vi.fn(async () => ({ answer: '回答', conversationId: 'private-id' })) },
    now: () => new Date('2026-09-06T00:00:00.000Z'),
    ...overrides,
  };
}

describe('private live AI service', () => {
  it('treats the wx-server-sdk missing-document error as an empty conversation', async () => {
    const message = 'document.get:fail document with _id missing-session does not exist';
    const missing = {
      collection() {
        return { doc() { return {
          async get() { throw Object.assign(new Error(message), { errCode: -1, errMsg: message }); },
          async set() {},
        }; } };
      },
    };
    const repository = createAiConversationRepository(missing);

    await expect(repository.get('trusted-owner', 'chat')).resolves.toBeNull();
  });

  it('recognizes an exact missing errMsg even when a wrapper message is present', async () => {
    const errMsg = 'document.get:fail document with _id missing-session does not exist';
    const missing = {
      collection() {
        return { doc() { return {
          async get() { throw Object.assign(new Error('database wrapper'), { errCode: -1, errMsg }); },
          async set() {},
        }; } };
      },
    };
    await expect(createAiConversationRepository(missing).get('trusted-owner', 'chat')).resolves.toBeNull();
  });

  it('claims before local retrieval and still retrieves before Dify', async () => {
    const order: string[] = [];
    const dependencies = serviceDependencies({
      records: {
        claim: vi.fn(async () => {
          order.push('claim');
          return { state: 'claimed', attemptToken: 'attempt-test', conversationId: null, sessionGeneration: 0 } as const;
        }),
        complete: vi.fn(async () => { order.push('complete'); }),
        fail: vi.fn(async () => undefined),
        list: vi.fn(async () => []),
      },
      retrieve: vi.fn(async () => { order.push('retrieve'); return ['本地已核验资料']; }),
      dify: { send: vi.fn(async () => { order.push('dify'); return { answer: '回答', conversationId: 'private-chat-id' }; }) },
    });
    const response = await handleAiRequest({ action: 'submit', request }, dependencies);
    expect(response).toMatchObject({ code: 'OK' });
    expect(order).toEqual(['claim', 'retrieve', 'dify', 'complete']);
    expect(dependencies.dify.send).toHaveBeenCalledWith('chat', request, null, 'derived-user', ['本地已核验资料']);
    expect(dependencies.records.complete).toHaveBeenCalledWith(
      'trusted-owner', request, 'attempt-test', expect.objectContaining({ answer: '回答' }), 'private-chat-id', expect.any(Date),
    );
    expect(JSON.stringify(response)).not.toMatch(/trusted-owner|derived-user|attempt-test|private-chat-id|DIFY_/);
  });

  it('returns a cached result without rewriting the session or calling dependencies', async () => {
    const cached = result(request.requestId, '缓存回答');
    const dependencies = serviceDependencies({
      records: { claim: vi.fn(async () => ({ state: 'cached' as const, result: cached })), complete: vi.fn(), fail: vi.fn(), list: vi.fn() },
    });
    await expect(handleAiRequest({ action: 'submit', request }, dependencies)).resolves.toMatchObject({
      code: 'OK', data: { answer: '缓存回答' },
    });
    expect(dependencies.retrieve).not.toHaveBeenCalled();
    expect(dependencies.dify.send).not.toHaveBeenCalled();
    expect(dependencies.repository.reset).not.toHaveBeenCalled();
  });

  it.each([
    [{ state: 'running' as const }, 'CONFLICT'],
    [{ state: 'missing_session' as const }, 'INVALID_INPUT'],
    [new AiRateLimitError('minute'), 'RATE_LIMITED'],
    [new AiRecordConflictError('request'), 'CONFLICT'],
    [new AiRequestInProgressError('cooldown'), 'CONFLICT'],
    [new AiRetryLimitError('retry limit'), 'CONFLICT'],
    [new Error('private database detail'), 'INTERNAL_ERROR'],
  ])('returns a safe public claim error without reading places or calling Dify', async (claimOutcome, expectedCode) => {
    const claim = claimOutcome instanceof Error ? vi.fn(async () => { throw claimOutcome; }) : vi.fn(async () => claimOutcome);
    const dependencies = serviceDependencies({
      records: { claim, complete: vi.fn(), fail: vi.fn(), list: vi.fn() },
    });
    const response = await handleAiRequest({ action: 'submit', request }, dependencies);
    expect(response).toMatchObject({ code: expectedCode, data: null });
    expect(dependencies.retrieve).not.toHaveBeenCalled();
    expect(dependencies.dify.send).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain('trusted-owner');
  });

  it('fences and fails a claimed request when local retrieval fails', async () => {
    const dependencies = serviceDependencies({ retrieve: vi.fn(async () => { throw new Error('private database detail'); }) });
    const response = await handleAiRequest({ action: 'submit', request }, dependencies);
    expect(dependencies.records.fail).toHaveBeenCalledWith(
      'trusted-owner', request, 'attempt-test', 'failed', expect.any(Date),
    );
    expect(dependencies.dify.send).not.toHaveBeenCalled();
    expect(response).toMatchObject({ code: 'INTERNAL_ERROR', message: '本地地点资料暂时无法读取，请稍后重试。' });
    expect(JSON.stringify(response)).not.toContain('private database detail');
  });

  it('marks a timed-out claimed request with the same attempt token and hides upstream details', async () => {
    const dependencies = serviceDependencies({
      dify: { send: vi.fn(async () => { throw Object.assign(new Error('private upstream detail'), { code: 'AI_TIMEOUT' }); }) },
    });
    const response = await handleAiRequest({ action: 'submit', request }, dependencies);
    expect(dependencies.records.fail).toHaveBeenCalledWith(
      'trusted-owner', request, 'attempt-test', 'timed_out', expect.any(Date),
    );
    expect(response).toMatchObject({ code: 'AI_TIMEOUT', message: 'AI 服务响应超时，请稍后重试。' });
    expect(JSON.stringify(response)).not.toContain('private upstream detail');
  });

  it('returns a safe internal error when saving the failed state also fails', async () => {
    const dependencies = serviceDependencies({
      records: {
        claim: vi.fn(async () => ({ state: 'claimed' as const, attemptToken: 'attempt-test', conversationId: null, sessionGeneration: 0 })),
        complete: vi.fn(), fail: vi.fn(async () => { throw new Error('private write detail'); }), list: vi.fn(),
      },
      dify: { send: vi.fn(async () => { throw Object.assign(new Error('private upstream detail'), { code: 'AI_UNAVAILABLE' }); }) },
    });
    const response = await handleAiRequest({ action: 'submit', request }, dependencies);
    expect(response).toMatchObject({ code: 'INTERNAL_ERROR', message: 'AI 请求状态暂时无法保存，请稍后重试。' });
    expect(JSON.stringify(response)).not.toMatch(/private (write|upstream) detail/);
  });

  it('does not mark an upstream success as failed when atomic completion cannot be saved', async () => {
    const dependencies = serviceDependencies({
      records: {
        claim: vi.fn(async () => ({ state: 'claimed' as const, attemptToken: 'attempt-test', conversationId: null, sessionGeneration: 0 })),
        complete: vi.fn(async () => { throw new Error('private completion detail'); }),
        fail: vi.fn(),
        list: vi.fn(),
      },
    });
    const response = await handleAiRequest({ action: 'submit', request }, dependencies);
    expect(response).toMatchObject({ code: 'INTERNAL_ERROR', message: 'AI 回答暂时无法保存，请稍后重试。' });
    expect(dependencies.records.fail).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain('private completion detail');
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
    const dify: DifyClient = { send: vi.fn(async () => { throw Object.assign(new Error('chat-secret'), { code: 'AI_UNAVAILABLE' }); }) };
    const dependencies = serviceDependencies({ dify, retrieve: vi.fn(async () => []) });
    expect((await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '问什么' } }, { ...dependencies, ownerId: null })).code).toBe('UNAUTHENTICATED');
    expect((await handleAiRequest(null, dependencies)).code).toBe('INVALID_INPUT');
    expect((await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat' } }, dependencies)).code).toBe('INVALID_INPUT');
    const result = await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '问什么' } }, dependencies);
    expect(result).toMatchObject({ code: 'AI_UNAVAILABLE', data: null, message: 'AI 服务暂不可用，请稍后重试。' });
    expect(JSON.stringify(result)).not.toContain('chat-secret');
  });

  it('accepts a budget with at most two decimals and rejects a more precise budget', async () => {
    const dify: DifyClient = { send: vi.fn(async () => ({ answer: '行程回答', conversationId: 'trip-c1' })) };
    const dependencies = serviceDependencies({ dify, retrieve: vi.fn(async () => []) });
    const valid = await handleAiRequest({ action: 'submit', request: { requestId: 't1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000.50, days: 2, preferences: ['自然风景'] } } }, dependencies);
    const invalid = await handleAiRequest({ action: 'submit', request: { requestId: 't2', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000.555, days: 2, preferences: ['自然风景'] } } }, dependencies);
    expect(valid).toMatchObject({ code: 'OK', data: { status: 'succeeded' } });
    expect(invalid).toMatchObject({ code: 'INVALID_INPUT', data: null });
    expect(dify.send).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the first trip input from only the five allowed fields and optional question', async () => {
    const dependencies = serviceDependencies();
    const unsafe = {
      requestId: 't-safe', kind: 'trip', question: '请定制', ownerId: 'client-owner',
      trip: {
        destination: ' 宜昌 ', people: 2, totalBudgetCny: 3000, days: 2,
        preferences: [' 自然风景 '], conversationId: 'client-conversation', local_verified_facts: 'client-facts',
      },
    };
    await expect(handleAiRequest({ action: 'submit', request: unsafe }, dependencies)).resolves.toMatchObject({ code: 'OK' });
    const safeRequest = {
      requestId: 't-safe', kind: 'trip', question: '请定制',
      trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景'] },
    };
    expect(dependencies.records.claim).toHaveBeenCalledWith('trusted-owner', safeRequest, expect.any(Date));
    expect(dependencies.dify.send).toHaveBeenCalledWith('trip', safeRequest, null, 'derived-user', ['本地已核验资料']);
    expect(JSON.stringify((dependencies.dify.send as ReturnType<typeof vi.fn>).mock.calls)).not.toContain('client-facts');
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

  it('treats missing optional content as empty but propagates other content database errors', async () => {
    function retrievalDatabase(contentError: unknown) {
      const place = { _id: 'published-place', status: 'published', name: '三峡大坝', category: 'scenic', intro: '已核验简介' };
      return {
        collection(name: string) {
          return {
            where() { return { limit() { return { async get() { return { data: [place] }; } }; } }; },
            doc() { return { async get() { if (name === 'place_contents') throw contentError; return { data: place }; } }; },
          };
        },
      };
    }
    await expect(createLocalFactRetriever(retrievalDatabase(new Error('not found')))(request)).resolves.toEqual([
      expect.stringContaining('本地已核验资料'),
    ]);
    await expect(createLocalFactRetriever(retrievalDatabase(new Error('permission denied')))(request)).rejects.toThrow('permission denied');
    const misleading = Object.assign(new Error('request failed: document does not exist because permission denied'), {
      code: 'PERMISSION_DENIED',
    });
    await expect(createLocalFactRetriever(retrievalDatabase(misleading))(request)).rejects.toBe(misleading);
  });
});

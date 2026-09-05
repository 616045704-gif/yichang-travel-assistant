import { describe, expect, it, vi } from 'vitest';
import { createDifyClient } from '../../cloudfunctions/ai/dify';

type RequestCall = (url: string, init: RequestInit) => Promise<Response>;

const environment = {
  DIFY_CHAT_API_BASE_URL: 'https://chat.example',
  DIFY_CHAT_API_KEY: 'chat-secret',
  DIFY_TRIP_API_BASE_URL: 'https://trip.example/',
  DIFY_TRIP_API_KEY: 'trip-secret',
};

describe('server-only Dify adapter', () => {
  it('routes chat to its own configuration and maps the question to a blocking query', async () => {
    const fetch = vi.fn<RequestCall>(async () => new Response(JSON.stringify({ answer: '春秋较舒适', conversation_id: 'chat-c1' }), { status: 200 }));
    const client = createDifyClient(environment, fetch);

    await expect(client.send('chat', { requestId: 'c1', kind: 'chat', question: '三峡大坝适合几月？' }, null, 'wx-user-a', [])).resolves.toEqual({ answer: '春秋较舒适', conversationId: 'chat-c1' });
    expect(fetch).toHaveBeenCalledWith('https://chat.example/v1/chat-messages', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      inputs: { local_verified_facts: '' }, query: '三峡大坝适合几月？', response_mode: 'blocking', conversation_id: '', user: 'wx-user-a',
    });
  });

  it('accepts the Dify API endpoint when it already ends with v1', async () => {
    const fetch = vi.fn<RequestCall>(async () => new Response(JSON.stringify({ answer: '回答', conversation_id: 'chat-c1' }), { status: 200 }));
    const client = createDifyClient({ ...environment, DIFY_CHAT_API_BASE_URL: 'https://api.dify.ai/v1' }, fetch);

    await client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'wx-user-a', []);

    expect(fetch.mock.calls[0][0]).toBe('https://api.dify.ai/v1/chat-messages');
  });

  it('uses the required common DIFY_BASE_URL when per-kind overrides are absent', async () => {
    const fetch = vi.fn<RequestCall>(async () => new Response(JSON.stringify({ answer: '回答', conversation_id: 'chat-c1' }), { status: 200 }));
    const client = createDifyClient({ DIFY_BASE_URL: 'https://common.example/v1', DIFY_CHAT_API_KEY: 'chat-secret', DIFY_TRIP_API_KEY: 'trip-secret' }, fetch);

    await client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'wx-user-a', []);

    expect(fetch.mock.calls[0][0]).toBe('https://common.example/v1/chat-messages');
  });

  it('maps a first trip to its fields but sends empty trip inputs for a follow-up', async () => {
    const fetch = vi.fn<RequestCall>(async () => new Response(JSON.stringify({ answer: '行程建议', conversation_id: 'trip-c1' }), { status: 200 }));
    const client = createDifyClient(environment, fetch);
    await client.send('trip', { requestId: 't1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景', '美食探索'] } }, null, 'wx-user-a', ['已核验资料']);
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      inputs: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: '自然风景,美食探索', local_verified_facts: '已核验资料' },
      query: '请根据以上旅行信息生成一份完整的定制行程。', response_mode: 'blocking', conversation_id: '', user: 'wx-user-a',
    });
    await client.send('trip', { requestId: 't2', kind: 'trip', question: '第二天轻松一些' }, 'trip-c1', 'wx-user-a', []);
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({
      inputs: { local_verified_facts: '' }, query: '第二天轻松一些', response_mode: 'blocking', conversation_id: 'trip-c1', user: 'wx-user-a',
    });
    expect(fetch.mock.calls[1][0]).toBe('https://trip.example/v1/chat-messages');
  });

  it('maps missing configuration and request failures to safe public errors', async () => {
    const client = createDifyClient({ ...environment, DIFY_CHAT_API_KEY: '' }, vi.fn());
    await expect(client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'user', [])).rejects.toMatchObject({ code: 'AI_UNAVAILABLE', message: 'AI 服务暂不可用，请稍后重试。' });
    const unavailable = createDifyClient(environment, vi.fn(async () => new Response('not-json', { status: 502 })));
    await expect(unavailable.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'user', [])).rejects.toMatchObject({ code: 'AI_UNAVAILABLE', message: 'AI 服务暂不可用，请稍后重试。' });
  });

  it('retries transient statuses and network failures with bounded backoff', async () => {
    const fetch = vi.fn<RequestCall>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('socket closed'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ answer: '恢复后的回答', conversation_id: 'chat-c1' }), { status: 200 }));
    const pause = vi.fn(async () => undefined);
    const client = createDifyClient(environment, fetch, pause);

    await expect(client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'user', [])).resolves.toMatchObject({ answer: '恢复后的回答' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(pause).toHaveBeenNthCalledWith(1, 150);
    expect(pause).toHaveBeenNthCalledWith(2, 400);
  });

  it('does not retry permanent upstream errors', async () => {
    const fetch = vi.fn<RequestCall>(async () => new Response('', { status: 400 }));
    const pause = vi.fn(async () => undefined);
    const client = createDifyClient(environment, fetch, pause);

    await expect(client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'user', [])).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('rejects a non-HTTPS service endpoint without making a request', async () => {
    const fetch = vi.fn<RequestCall>();
    const client = createDifyClient({ ...environment, DIFY_CHAT_API_BASE_URL: 'http://insecure.example' }, fetch);
    await expect(client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'user', [])).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps an aborted Dify request to a safe timeout error', async () => {
    const timeout = createDifyClient(environment, vi.fn<RequestCall>(async () => {
      const error = new Error('network detail');
      error.name = 'TimeoutError';
      throw error;
    }));
    await expect(timeout.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'user', [])).rejects.toMatchObject({ code: 'AI_TIMEOUT', message: 'AI 服务响应超时，请稍后重试。' });
  });

  it('caps a blocking Dify request below the CloudBase direct-call timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const client = createDifyClient(environment, vi.fn<RequestCall>(async () => new Response(JSON.stringify({ answer: '回答', conversation_id: 'chat-c1' }), { status: 200 })));

    await client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'user', []);

    expect(timeout).toHaveBeenCalledWith(45_000);
    timeout.mockRestore();
  });

  it('rejects an oversized upstream answer instead of passing it to the client', async () => {
    const client = createDifyClient(environment, vi.fn<RequestCall>(async () => new Response(JSON.stringify({ answer: 'a'.repeat(4_001), conversation_id: 'chat-c1' }), { status: 200 })));
    await expect(client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'user', [])).rejects.toMatchObject({ code: 'AI_UNAVAILABLE', message: 'AI 服务暂不可用，请稍后重试。' });
  });
});

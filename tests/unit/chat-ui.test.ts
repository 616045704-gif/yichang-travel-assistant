import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatModel } from '../../miniprogram/view-models/chat';
import { createMockAiClient, createWaitingMockAiClient } from '../fixtures/mock-ai';

describe('mock AI chat model', () => {
  it('rejects blank and 1001-character questions before invoking the client', async () => {
    const client = createMockAiClient([]);
    const model = new ChatModel(client);
    await expect(model.submit('  ')).rejects.toThrow('请输入 1–1000 字的问题');
    await expect(model.submit('a'.repeat(1001))).rejects.toThrow('请输入 1–1000 字的问题');
    expect(client.submit).not.toHaveBeenCalled();
  });

  it('keeps a failed question and retries the same request payload', async () => {
    const client = createMockAiClient([
      { status: 'failed', error: '网络连接不稳定，请重试' },
      { status: 'succeeded', answer: '模拟建议' },
    ]);
    const model = new ChatModel(client);
    await model.submit('三峡大坝适合几月去？');
    await model.retry();
    expect(client.submit).toHaveBeenCalledTimes(2);
    expect(client.submit.mock.calls[1][0].question).toBe('三峡大坝适合几月去？');
    expect(client.submit.mock.calls[1][0]).toEqual(client.submit.mock.calls[0][0]);
    expect(model.state.result?.answer).toBe('模拟建议');
  });

  it('suppresses duplicate submissions and restores visual waiting after returning to the page', async () => {
    const waiting = createWaitingMockAiClient();
    const model = new ChatModel(waiting.client);
    const first = model.submit('适合带孩子去哪里？');
    const duplicate = model.submit('另一条问题');
    expect(model.state.isSubmitting).toBe(true);
    expect(waiting.client.submit).toHaveBeenCalledTimes(1);
    model.onHide();
    expect(model.state).toMatchObject({ isVisible: false, isSubmitting: false });
    model.onShow();
    expect(model.state).toMatchObject({ isVisible: true, isSubmitting: true });
    waiting.resolve({ status: 'succeeded', answer: '模拟建议' });
    await Promise.all([first, duplicate]);
    expect(model.state).toMatchObject({ isSubmitting: false, result: { status: 'succeeded', answer: '模拟建议' } });
  });
});

type ChatPage = {
  data: {
    input: string;
    messages: Array<{ requestId: string; role: 'user' | 'assistant'; content: string }>;
    error: string;
    isSubmitting: boolean;
    result: unknown;
  };
  setData(value: Record<string, unknown>): void;
  newChat(): Promise<void>;
};

async function loadChatPage(resetAiConversation: ReturnType<typeof vi.fn>) {
  let page: ChatPage;
  vi.resetModules();
  vi.doMock('../../miniprogram/services/ai', () => ({
    resetAiConversation,
    submitAi: vi.fn(),
  }));
  vi.stubGlobal('Page', (value: ChatPage) => { page = value; });
  await import('../../miniprogram/pages/ai-chat/index');
  page!.setData = function (value) { Object.assign(this.data, value); };
  return page!;
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.doUnmock('../../miniprogram/services/ai'); });

describe('chat page conversation controls', () => {
  it('clears only the chat UI and chat conversation when New Chat is selected', async () => {
    const resetAiConversation = vi.fn(async () => undefined);
    const page = await loadChatPage(resetAiConversation);
    page.data.input = '继续聊三峡大坝';
    page.data.messages = [
      { requestId: 'chat-1', role: 'user', content: '第一问' },
      { requestId: 'chat-1', role: 'assistant', content: '第一答' },
    ];
    page.data.error = '旧错误';
    page.data.isSubmitting = false;
    page.data.result = { answer: '第一答' };

    await page.newChat();

    expect(resetAiConversation).toHaveBeenCalledWith('chat');
    expect(page.data).toMatchObject({ input: '', messages: [], error: '', isSubmitting: false, result: null });
    expect(resetAiConversation).not.toHaveBeenCalledWith('trip');
  });
});

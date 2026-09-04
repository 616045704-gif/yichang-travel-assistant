import { describe, expect, it } from 'vitest';
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

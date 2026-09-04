import type { AiResult } from '../../../shared/contracts';
import { ChatModel } from '../../view-models/chat';

type Message = { messageId: string; requestId: string; role: 'user' | 'assistant'; content: string; mode: '' | 'mock' };

const model = new ChatModel();

function toError(result: AiResult): string {
  return result.error || '网络连接不稳定，请重试';
}

Page({
  data: {
    input: '',
    messages: [] as Message[],
    error: '',
    isSubmitting: false,
    result: null as AiResult | null,
  },
  onLoad() { this.sync(); },
  onShow() { model.onShow(); this.sync(); },
  onHide() { model.onHide(); this.sync(); },
  onInput(event: WechatMiniprogram.Input) {
    model.state = { ...model.state, input: event.detail.value };
    this.setData({ input: event.detail.value, error: '' });
  },
  async submit() {
    if (this.data.isSubmitting) return;
    const input = this.data.input;
    if (!input.trim() || input.trim().length > 1000) {
      try { await model.submit(input); }
      catch (error) { this.setData({ error: error instanceof Error ? error.message : '请输入 1–1000 字的问题' }); }
      return;
    }
    const task = model.submit(input);
    const request = model.state.request;
    if (request && !this.data.messages.some(message => message.requestId === request.requestId && message.role === 'user')) {
      this.setData({ messages: [...this.data.messages, { messageId: `${request.requestId}-user`, requestId: request.requestId, role: 'user', content: request.question || '', mode: '' }] });
    }
    this.sync();
    const result = await task;
    this.finish(result);
  },
  async retry() {
    if (this.data.isSubmitting) return;
    try {
      const result = await model.retry();
      this.sync();
      this.finish(result);
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : '当前没有可重试的问题' });
    }
  },
  sync() {
    this.setData({ input: model.state.input, isSubmitting: model.state.isSubmitting, result: model.state.result });
  },
  finish(result: AiResult) {
    if (result.status !== 'succeeded' || !result.answer) {
      this.setData({ error: toError(result), result: null, isSubmitting: false });
      return;
    }
    const assistantMessage: Message = { messageId: `${result.requestId}-assistant`, requestId: result.requestId, role: 'assistant', content: result.answer, mode: 'mock' };
    const messages = this.data.messages.some(message => message.requestId === result.requestId && message.role === 'assistant')
      ? this.data.messages
      : [...this.data.messages, assistantMessage];
    this.setData({ messages, error: '', input: model.state.input, result, isSubmitting: false });
  },
});

import type { AiClient, AiRequest, AiResult, TripInput } from '../../shared/contracts';
import { submitAi } from '../services/ai';

const QUESTION_ERROR = '请输入 1–1000 字的问题';
const NETWORK_ERROR = '网络连接不稳定，请重试';
let requestSequence = 0;

export interface ChatState {
  input: string;
  request: AiRequest | null;
  result: AiResult | null;
  isSubmitting: boolean;
  isVisible: boolean;
}

const configuredClient: AiClient = { submit: submitAi };

export function validateTrip(input: TripInput): string[] {
  const errors: string[] = [];
  if (!input.destination.trim()) errors.push('请选择目的地');
  if (!Number.isInteger(input.people) || input.people < 1 || input.people > 20) errors.push('人数需为 1–20 的整数');
  if (!Number.isFinite(input.totalBudgetCny) || input.totalBudgetCny < 1 || input.totalBudgetCny > 100000) errors.push('总预算需为 1–100000 元');
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 7) errors.push('天数需为 1–7 的整数');
  if (input.preferences.length > 6) errors.push('偏好最多选择 6 项');
  return errors;
}

export class ChatModel {
  state: ChatState = { input: '', request: null, result: null, isSubmitting: false, isVisible: true };
  private inFlight: Promise<AiResult> | null = null;

  constructor(private readonly client: AiClient = configuredClient) {}

  submit(input: string): Promise<AiResult> {
    if (this.inFlight) return this.inFlight;
    const question = input.trim();
    this.state = { ...this.state, input };
    if (!question || question.length > 1000) return Promise.reject(new Error(QUESTION_ERROR));
    const request: AiRequest = { requestId: `chat-${Date.now()}-${++requestSequence}`, kind: 'chat', question };
    return this.send(request);
  }

  retry(): Promise<AiResult> {
    if (this.inFlight) return this.inFlight;
    if (!this.state.request) return Promise.reject(new Error('当前没有可重试的问题'));
    return this.send(this.state.request);
  }

  onHide() {
    this.state = { ...this.state, isVisible: false, isSubmitting: false };
  }

  onShow() {
    this.state = { ...this.state, isVisible: true, isSubmitting: this.inFlight !== null };
  }

  private send(request: AiRequest): Promise<AiResult> {
    this.state = { ...this.state, request, result: null, isSubmitting: this.state.isVisible };
    const task = this.run(request);
    this.inFlight = task;
    return task;
  }

  private async run(request: AiRequest): Promise<AiResult> {
    try {
      const result = await this.client.submit(request);
      this.state = {
        ...this.state,
        input: result.status === 'succeeded' ? '' : this.state.input,
        result,
      };
      return result;
    } catch {
      const result: AiResult = {
        requestId: request.requestId,
        status: 'failed',
        answer: null,
        mode: 'mock',
        error: NETWORK_ERROR,
        localFacts: [],
        references: [],
      };
      this.state = { ...this.state, result };
      return result;
    } finally {
      this.inFlight = null;
      this.state = { ...this.state, isSubmitting: false };
    }
  }
}

import { vi } from 'vitest';
import type { AiClient, AiRequest, AiResult, AiStatus } from '../../shared/contracts';

export interface MockAiResponse {
  status: AiStatus;
  answer?: string | null;
  error?: string | null;
}

function toResult(request: AiRequest, response: MockAiResponse): AiResult {
  return {
    requestId: request.requestId,
    status: response.status,
    answer: response.answer ?? null,
    mode: 'mock',
    error: response.error ?? null,
    localFacts: [],
    references: [],
  };
}

export function createMockAiClient(responses: MockAiResponse[]): AiClient & { submit: ReturnType<typeof vi.fn> } {
  const pending = [...responses];
  return {
    submit: vi.fn(async (request: AiRequest) => toResult(request, pending.shift() ?? { status: 'failed', error: '模拟服务暂不可用，请稍后重试' })),
  };
}

export function createWaitingMockAiClient() {
  let resolveRequest: ((response: MockAiResponse) => void) | null = null;
  const client: AiClient & { submit: ReturnType<typeof vi.fn> } = {
    submit: vi.fn((request: AiRequest) => new Promise<AiResult>(resolve => {
      resolveRequest = response => resolve(toResult(request, response));
    })),
  };
  return {
    client,
    resolve(response: MockAiResponse) {
      if (!resolveRequest) throw new Error('没有正在等待的模拟请求');
      resolveRequest(response);
    },
  };
}

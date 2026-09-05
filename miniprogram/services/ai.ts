import type { AiClient, AiKind, AiRequest, AiResult } from '../../shared/contracts';

declare const __BUILD_MODE__: string;

type CloudEnvelope<T> = { result?: { code?: string; data?: T | null; message?: string } };

function isDevelopmentMock() {
  return typeof __BUILD_MODE__ === 'undefined' || __BUILD_MODE__ === 'development';
}

function createDevelopmentAiClient(): AiClient {
  return {
    async submit(request: AiRequest): Promise<AiResult> {
      const answer = request.kind === 'chat'
        ? `模拟回答：${request.question ?? ''}`
        : `模拟行程建议：${request.trip?.destination ?? ''}`;
      return {
        requestId: request.requestId,
        status: 'succeeded',
        answer,
        mode: 'mock',
        error: null,
        localFacts: [],
        references: [],
      };
    },
  };
}

let client: AiClient | null = isDevelopmentMock() ? createDevelopmentAiClient() : null;
const records: AiResult[] = [];

export function configureAiClient(next: AiClient | null) {
  client = next;
}

async function callAi<T>(action: 'submit' | 'resetConversation', payload: Record<string, unknown>): Promise<T> {
  if (!wx.cloud?.callFunction) throw new Error('AI_UNAVAILABLE');
  const response = await wx.cloud.callFunction({ name: 'aiService', data: { action, ...payload } }) as CloudEnvelope<T>;
  if (response.result?.code !== 'OK' || response.result.data == null) throw new Error(response.result?.message || 'AI_UNAVAILABLE');
  return response.result.data;
}

function clearMockConversation(kind: AiKind) {
  void kind;
}

export async function submitAi(request: AiRequest): Promise<AiResult> {
  if (!client) return callAi<AiResult>('submit', { request });
  const result = await client.submit(request);
  records.push(result);
  return result;
}

export async function resetAiConversation(kind: AiKind): Promise<void> {
  if (client) {
    clearMockConversation(kind);
    return;
  }
  await callAi('resetConversation', { kind });
}

export function listMockAiRecords(): AiResult[] {
  return [...records];
}

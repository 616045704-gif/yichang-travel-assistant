import type { AiClient, AiRequest, AiResult } from '../../shared/contracts';

declare const __BUILD_MODE__: string;

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

let client: AiClient | null = typeof __BUILD_MODE__ === 'undefined' || __BUILD_MODE__ === 'development' ? createDevelopmentAiClient() : null;
const records: AiResult[] = [];

export function configureAiClient(next: AiClient | null) {
  client = next;
}

export async function submitAi(request: AiRequest): Promise<AiResult> {
  if (!client) throw new Error('模拟服务暂不可用，请稍后重试');
  const result = await client.submit(request);
  records.push(result);
  return result;
}

export function listMockAiRecords(): AiResult[] {
  return [...records];
}

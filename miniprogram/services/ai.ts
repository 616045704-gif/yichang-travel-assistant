import type { AiClient, AiRequest, AiResult } from '../../shared/contracts';

let client: AiClient | null = null;
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

import type { AiKind, AiRequest } from '../../shared/contracts';

type DifyEnvironment = Record<string, string | undefined>;
type FetchResponse = { ok: boolean; status: number; json(): Promise<unknown> };
type Fetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<FetchResponse>;

export interface DifyClient {
  send(kind: AiKind, request: AiRequest, conversationId: string | null, user: string, localFacts: string[]): Promise<{ answer: string; conversationId: string }>;
}

export class DifyServiceError extends Error {
  constructor(readonly code: 'AI_UNAVAILABLE' | 'AI_TIMEOUT') {
    super(code === 'AI_TIMEOUT' ? 'AI 服务响应超时，请稍后重试。' : 'AI 服务暂不可用，请稍后重试。');
  }
}

type DifyPayload = { inputs: Record<string, string | number>; query: string; response_mode: 'blocking'; conversation_id: string; user: string };

function configuration(kind: AiKind, environment: DifyEnvironment) {
  const baseUrl = environment[kind === 'chat' ? 'DIFY_CHAT_API_BASE_URL' : 'DIFY_TRIP_API_BASE_URL']?.trim();
  const apiKey = environment[kind === 'chat' ? 'DIFY_CHAT_API_KEY' : 'DIFY_TRIP_API_KEY']?.trim();
  if (!baseUrl || !apiKey) throw new DifyServiceError('AI_UNAVAILABLE');
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:') throw new Error('unsupported protocol');
  } catch { throw new DifyServiceError('AI_UNAVAILABLE'); }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

function payload(kind: AiKind, request: AiRequest, conversationId: string | null, user: string, localFacts: string[]): DifyPayload {
  const localVerifiedFacts = localFacts.join('\n').slice(0, 4_000);
  if (kind === 'chat') return { inputs: { local_verified_facts: localVerifiedFacts }, query: request.question || '', response_mode: 'blocking', conversation_id: conversationId || '', user };
  if (request.trip) {
    const trip = request.trip;
    return {
      inputs: { destination: trip.destination, people: trip.people, totalBudgetCny: trip.totalBudgetCny, days: trip.days, preferences: trip.preferences.join(','), local_verified_facts: localVerifiedFacts },
      query: '请根据以上旅行信息生成一份完整的定制行程。', response_mode: 'blocking', conversation_id: '', user,
    };
  }
  return { inputs: { local_verified_facts: localVerifiedFacts }, query: request.question || '', response_mode: 'blocking', conversation_id: conversationId || '', user };
}

function responseData(value: unknown) {
  if (!value || typeof value !== 'object') throw new DifyServiceError('AI_UNAVAILABLE');
  const result = value as Record<string, unknown>;
  const answer = typeof result.answer === 'string' ? result.answer.trim() : '';
  const conversationId = typeof result.conversation_id === 'string' ? result.conversation_id.trim() : '';
  if (!answer || answer.length > 8_000 || !conversationId) throw new DifyServiceError('AI_UNAVAILABLE');
  return { answer, conversationId };
}

function requestFailed(error: unknown) {
  if (error instanceof DifyServiceError) return error;
  if (error instanceof Error && error.name === 'TimeoutError') return new DifyServiceError('AI_TIMEOUT');
  return new DifyServiceError('AI_UNAVAILABLE');
}

export function createDifyClient(environment: DifyEnvironment, request: Fetch = fetch as unknown as Fetch): DifyClient {
  return {
    async send(kind, aiRequest, conversationId, user, localFacts) {
      const { baseUrl, apiKey } = configuration(kind, environment);
      try {
        const response = await request(`${baseUrl}/v1/chat-messages`, {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload(kind, aiRequest, conversationId, user, localFacts)), signal: AbortSignal.timeout(90_000),
        });
        if (!response.ok) throw new DifyServiceError('AI_UNAVAILABLE');
        return responseData(await response.json());
      } catch (error) { throw requestFailed(error); }
    },
  };
}

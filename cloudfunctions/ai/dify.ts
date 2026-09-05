import type { AiKind, AiRequest } from '../../shared/contracts';

type DifyEnvironment = Record<string, string | undefined>;
type FetchResponse = { ok: boolean; status: number; json(): Promise<unknown> };
type Fetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<FetchResponse>;
type Wait = (milliseconds: number) => Promise<void>;

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
  const baseUrl = environment[kind === 'chat' ? 'DIFY_CHAT_API_BASE_URL' : 'DIFY_TRIP_API_BASE_URL']?.trim()
    || environment.DIFY_BASE_URL?.trim();
  const apiKey = environment[kind === 'chat' ? 'DIFY_CHAT_API_KEY' : 'DIFY_TRIP_API_KEY']?.trim();
  if (!baseUrl || !apiKey) throw new DifyServiceError('AI_UNAVAILABLE');
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:') throw new Error('unsupported protocol');
  } catch { throw new DifyServiceError('AI_UNAVAILABLE'); }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

function chatMessagesEndpoint(baseUrl: string) {
  return `${baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`}/chat-messages`;
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
  if (!answer || answer.length > 4_000 || !conversationId) throw new DifyServiceError('AI_UNAVAILABLE');
  return { answer, conversationId };
}

function requestFailed(error: unknown) {
  if (error instanceof DifyServiceError) return error;
  if (error instanceof Error && error.name === 'TimeoutError') return new DifyServiceError('AI_TIMEOUT');
  return new DifyServiceError('AI_UNAVAILABLE');
}

function retryableStatus(status: number) { return status === 429 || status === 500 || status === 502 || status === 503 || status === 504; }
function wait(milliseconds: number) { return new Promise<void>(resolve => setTimeout(resolve, milliseconds)); }

export function createDifyClient(environment: DifyEnvironment, request: Fetch = fetch as unknown as Fetch, pause: Wait = wait): DifyClient {
  return {
    async send(kind, aiRequest, conversationId, user, localFacts) {
      const { baseUrl, apiKey } = configuration(kind, environment);
      const signal = AbortSignal.timeout(90_000);
      const init = {
        method: 'POST' as const, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(kind, aiRequest, conversationId, user, localFacts)), signal,
      };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await request(chatMessagesEndpoint(baseUrl), init);
          if (!response.ok) {
            if (retryableStatus(response.status) && attempt < 2) { await pause(attempt === 0 ? 150 : 400); continue; }
            throw new DifyServiceError('AI_UNAVAILABLE');
          }
          try { return responseData(await response.json()); }
          catch { throw new DifyServiceError('AI_UNAVAILABLE'); }
        } catch (error) {
          const mapped = requestFailed(error);
          if (mapped.code === 'AI_TIMEOUT' || error instanceof DifyServiceError || attempt === 2) throw mapped;
          await pause(attempt === 0 ? 150 : 400);
        }
      }
      throw new DifyServiceError('AI_UNAVAILABLE');
    },
  };
}

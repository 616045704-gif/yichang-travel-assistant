import type { AiRequest, AiResult, TripInput } from '../../shared/contracts';
import type { DifyClient } from './dify';
import type { AiConversationRepository } from './repository';
import type { LocalFactRetriever } from './retrieval';
import {
  AiRateLimitError,
  AiRecordConflictError,
  AiRequestInProgressError,
  AiRetryLimitError,
  type AiRecordRepository,
} from './records';

type Event = { action?: unknown; request?: unknown; kind?: unknown };
type ErrorCode = 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'CONFLICT' | 'RATE_LIMITED' | 'AI_UNAVAILABLE' | 'AI_TIMEOUT' | 'INTERNAL_ERROR';

function ok(data: unknown) { return { code: 'OK' as const, data, message: '', traceId: 'ai-service' }; }
function fail(code: ErrorCode, message: string) { return { code, data: null, message, traceId: 'ai-service' }; }
function validQuestion(value: unknown): value is string { return typeof value === 'string' && !!value.trim() && value.trim().length <= 1_000; }
function validBudget(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 100_000 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}
function validTrip(value: unknown): value is TripInput {
  if (!value || typeof value !== 'object') return false;
  const trip = value as Record<string, unknown>;
  return typeof trip.destination === 'string' && !!trip.destination.trim() && trip.destination.trim().length <= 80
    && Number.isInteger(trip.people) && (trip.people as number) >= 1 && (trip.people as number) <= 20
    && validBudget(trip.totalBudgetCny)
    && Number.isInteger(trip.days) && (trip.days as number) >= 1 && (trip.days as number) <= 7
    && Array.isArray(trip.preferences) && trip.preferences.length <= 6 && trip.preferences.every(item => typeof item === 'string' && !!item.trim() && item.length <= 20);
}
function requestInput(value: unknown): AiRequest | null {
  if (!value || typeof value !== 'object') return null;
  const request = value as Record<string, unknown>;
  if (typeof request.requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(request.requestId) || (request.kind !== 'chat' && request.kind !== 'trip')) return null;
  if (request.kind === 'chat' && !validQuestion(request.question)) return null;
  if (request.kind === 'trip' && !validTrip(request.trip) && !validQuestion(request.question)) return null;
  return {
    requestId: request.requestId, kind: request.kind,
    ...(validQuestion(request.question) ? { question: request.question.trim() } : {}),
    ...(validTrip(request.trip) ? { trip: {
      destination: request.trip.destination.trim(),
      people: request.trip.people,
      totalBudgetCny: request.trip.totalBudgetCny,
      days: request.trip.days,
      preferences: request.trip.preferences.map(item => item.trim()),
    } } : {}),
  };
}

function safeError(error: unknown) {
  if (error instanceof AiRateLimitError) return fail('RATE_LIMITED', '请求较频繁，请稍后再试。');
  if (error instanceof AiRecordConflictError) return fail('CONFLICT', '该请求编号已用于其他内容，请重新提交。');
  if (error instanceof AiRequestInProgressError) return fail('CONFLICT', '该请求刚刚处理过，请稍后重试。');
  if (error instanceof AiRetryLimitError) return fail('CONFLICT', '该请求已达到重试次数，请重新发起。');
  if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'AI_TIMEOUT') return fail('AI_TIMEOUT', 'AI 服务响应超时，请稍后重试。');
  if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'AI_UNAVAILABLE') return fail('AI_UNAVAILABLE', 'AI 服务暂不可用，请稍后重试。');
  return fail('INTERNAL_ERROR', 'AI 服务暂时无法处理，请稍后重试。');
}

export interface AiServiceDependencies {
  ownerId: string | null;
  user: string;
  repository: AiConversationRepository;
  records: AiRecordRepository;
  dify: DifyClient;
  retrieve: LocalFactRetriever;
  now?: () => Date;
}

export async function handleAiRequest(event: Event | null | undefined, dependencies: AiServiceDependencies) {
  if (!dependencies.ownerId) return fail('UNAUTHENTICATED', '请在微信中重新进入后再试。');
  if (!event || typeof event !== 'object') return fail('INVALID_INPUT', '不支持的 AI 服务请求。');
  const { ownerId } = dependencies;
  if (event.action === 'listRecords') {
    try { return ok(await dependencies.records.list(ownerId)); }
    catch { return fail('INTERNAL_ERROR', 'AI 记录暂时无法读取，请稍后重试。'); }
  }
  if (event.action === 'resetConversation') {
    if (event.kind !== 'chat' && event.kind !== 'trip') return fail('INVALID_INPUT', '会话类型无效。');
    try { await dependencies.repository.reset(ownerId, event.kind); return ok({ kind: event.kind }); }
    catch { return fail('INTERNAL_ERROR', '会话暂时无法重置，请稍后重试。'); }
  }
  if (event.action !== 'submit') return fail('INVALID_INPUT', '不支持的 AI 服务请求。');
  const request = requestInput(event.request);
  if (!request) return fail('INVALID_INPUT', '提问或行程信息无效。');
  const now = dependencies.now ?? (() => new Date());
  let claim: Awaited<ReturnType<AiRecordRepository['claim']>>;
  try {
    claim = await dependencies.records.claim(ownerId, request, now());
  } catch (error) {
    return safeError(error);
  }
  if (claim.state === 'running') return fail('CONFLICT', '该请求仍在处理中，请稍后重试。');
  if (claim.state === 'missing_session') return fail('INVALID_INPUT', '请先提交行程信息，再继续调整。');
  if (claim.state === 'cached') return ok(claim.result);

  let localFacts: string[];
  try {
    localFacts = await dependencies.retrieve(request);
  } catch {
    try {
      await dependencies.records.fail(ownerId, request, claim.attemptToken, 'failed', now());
    } catch {
      return fail('INTERNAL_ERROR', 'AI 请求状态暂时无法保存，请稍后重试。');
    }
    return fail('INTERNAL_ERROR', '本地地点资料暂时无法读取，请稍后重试。');
  }

  let response: { answer: string; conversationId: string };
  try {
    response = await dependencies.dify.send(request.kind, request, claim.conversationId, dependencies.user, localFacts);
  } catch (error) {
    const status = error && typeof error === 'object' && (error as { code?: unknown }).code === 'AI_TIMEOUT' ? 'timed_out' : 'failed';
    try {
      await dependencies.records.fail(ownerId, request, claim.attemptToken, status, now());
    } catch {
      return fail('INTERNAL_ERROR', 'AI 请求状态暂时无法保存，请稍后重试。');
    }
    return safeError(error);
  }

  const result: AiResult = {
    requestId: request.requestId,
    status: 'succeeded',
    answer: response.answer,
    mode: 'dify',
    error: null,
    localFacts,
    references: [],
  };
  try {
    await dependencies.records.complete(ownerId, request, claim.attemptToken, result, response.conversationId, now());
    return ok(result);
  } catch {
    return fail('INTERNAL_ERROR', 'AI 回答暂时无法保存，请稍后重试。');
  }
}

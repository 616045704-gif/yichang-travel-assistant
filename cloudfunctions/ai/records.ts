import { createHash, randomBytes } from 'node:crypto';
import type { AiHistoryItem, AiKind, AiRequest, AiResult, Source } from '../../shared/contracts';
import { CLAIM_STALE_MS, MAX_LOGICAL_ATTEMPTS, quotaWindows, RETRY_COOLDOWN_MS } from './quota';

type Document = Record<string, unknown>;
type DocumentReference = {
  get(): Promise<{ data?: Document | null }>;
  set(input: { data: Document }): Promise<unknown>;
};
type Query = {
  orderBy?(field: string, direction: 'asc' | 'desc'): Query;
  limit(count: number): { get(): Promise<{ data: Document[] }> };
};
type Collection = {
  doc(id: string): DocumentReference;
  where(query: Document): Query;
};
type Transaction = { collection(name: string): Collection };
type Database = Transaction & {
  runTransaction?<T>(callback: (transaction: Transaction) => Promise<T>, times?: number): Promise<T>;
};

export type AiRecordClaim =
  | { state: 'claimed'; attemptToken: string }
  | { state: 'running' }
  | { state: 'cached'; result: AiResult };

export interface AiRecordRepository {
  list(ownerId: string): Promise<AiHistoryItem[]>;
  /** Transitional compatibility for the Task 2 service migration. */
  find(ownerId: string, request: AiRequest): Promise<AiResult | null>;
  /** Transitional compatibility for the Task 2 service migration. */
  save(ownerId: string, request: AiRequest, result: AiResult): Promise<void>;
  claim?(ownerId: string, request: AiRequest, now: Date): Promise<AiRecordClaim>;
  complete?(ownerId: string, request: AiRequest, attemptToken: string, result: AiResult, difyConversationId: string, now: Date): Promise<void>;
  fail?(ownerId: string, request: AiRequest, attemptToken: string, status: 'failed' | 'timed_out', now: Date): Promise<void>;
}

export interface AtomicAiRecordRepository extends AiRecordRepository {
  claim(ownerId: string, request: AiRequest, now: Date): Promise<AiRecordClaim>;
  complete(ownerId: string, request: AiRequest, attemptToken: string, result: AiResult, difyConversationId: string, now: Date): Promise<void>;
  fail(ownerId: string, request: AiRequest, attemptToken: string, status: 'failed' | 'timed_out', now: Date): Promise<void>;
}

export class AiRecordConflictError extends Error {}
export class AiRateLimitError extends Error {}
export class AiRequestInProgressError extends Error {}
export class AiRetryLimitError extends Error {}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function documentId(ownerId: string, requestId: string) {
  return digest(`ai-record\u0000${ownerId}\u0000${requestId}`);
}

function newAttemptToken() {
  return randomBytes(32).toString('hex');
}

function sanitizedRequest(request: AiRequest): AiRequest {
  const question = typeof request.question === 'string' ? request.question : undefined;
  if (request.kind === 'chat') {
    return { requestId: request.requestId, kind: 'chat', ...(question === undefined ? {} : { question }) };
  }
  const trip = request.trip;
  return {
    requestId: request.requestId,
    kind: 'trip',
    ...(question === undefined ? {} : { question }),
    ...(trip ? { trip: {
      destination: trip.destination,
      people: trip.people,
      totalBudgetCny: trip.totalBudgetCny,
      days: trip.days,
      preferences: [...trip.preferences],
    } } : {}),
  };
}

function requestHash(request: AiRequest) {
  return digest(JSON.stringify(sanitizedRequest(request)));
}

function collectionName(kind: AiKind) {
  return kind === 'chat' ? 'ai_messages' : 'trip_requests';
}

function isNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; errCode?: unknown; errMsg?: unknown; message?: unknown };
  const code = String(value.code ?? value.errCode ?? '').toUpperCase();
  const message = String(value.message ?? value.errMsg ?? '').toLowerCase();
  return code === 'NOT_FOUND' || code.includes('DOCUMENT_NOT_FOUND') || message === 'not found' || message.includes('document does not exist')
    || /^document\.get:fail document with _id \S+ does not exist$/.test(message);
}

function boundedString(value: unknown, limit: number) {
  return typeof value === 'string' && value.length <= limit ? value : null;
}

function safeReference(value: unknown): Source | null {
  if (!value || typeof value !== 'object') return null;
  const reference = value as Record<string, unknown>;
  if (reference.kind !== 'local_verified' && reference.kind !== 'knowledge_reference') return null;
  const title = boundedString(reference.title, 200);
  const placeId = boundedString(reference.placeId, 128);
  const url = reference.url === null ? null : boundedString(reference.url, 2_000);
  const verifiedAt = reference.verifiedAt === null ? null : boundedString(reference.verifiedAt, 64);
  if (title === null || placeId === null || url === null && reference.url !== null || verifiedAt === null && reference.verifiedAt !== null) return null;
  return { kind: reference.kind, title, url, verifiedAt, placeId };
}

function safeResult(value: unknown): AiResult | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Record<string, unknown>;
  const statuses = ['queued', 'running', 'succeeded', 'failed', 'timed_out'] as const;
  if (typeof result.requestId !== 'string' || result.requestId.length > 100 || !statuses.includes(result.status as typeof statuses[number])) return null;
  if (result.mode !== 'mock' && result.mode !== 'dify') return null;
  const answer = result.answer === null ? null : boundedString(result.answer, 4_000);
  const error = result.error === null ? null : boundedString(result.error, 500);
  if (answer === null && result.answer !== null || error === null && result.error !== null) return null;
  if (result.status === 'succeeded' && (answer === null || error !== null)) return null;
  if (!Array.isArray(result.localFacts) || result.localFacts.length > 20
    || !result.localFacts.every(item => typeof item === 'string' && item.length <= 2_000)) return null;
  if (!Array.isArray(result.references) || result.references.length > 20) return null;
  const references = result.references.map(safeReference);
  if (references.some(reference => reference === null)) return null;
  return {
    requestId: result.requestId,
    status: result.status as AiResult['status'],
    answer,
    mode: result.mode,
    error,
    localFacts: [...result.localFacts] as string[],
    references: references as Source[],
  };
}

async function getDocument(collection: Collection, id: string) {
  try {
    return (await collection.doc(id).get()).data ?? null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function assertMatchingRecord(record: Document, ownerId: string, request: AiRequest) {
  if (record.ownerId !== ownerId || record.kind !== request.kind || record.inputHash !== requestHash(request)) {
    throw new AiRecordConflictError('requestId already used');
  }
}

function validIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function assertOperationalRecord(record: Document) {
  if (!Number.isSafeInteger(record.attemptCount) || Number(record.attemptCount) < 1) {
    throw new Error('invalid AI attemptCount');
  }
  if (!validIsoTimestamp(record.quotaChargedAt)) throw new Error('invalid AI quotaChargedAt');
}

function assertActiveAttempt(record: Document, attemptToken: string) {
  if (typeof attemptToken !== 'string' || !attemptToken || record.attemptToken !== attemptToken || record.status !== 'running') {
    throw new AiRecordConflictError('AI attempt is no longer active');
  }
}

function transactionRunner(database: Database) {
  if (!database.runTransaction) throw new Error('database transactions are unavailable');
  return database.runTransaction.bind(database);
}

async function chargeQuota(transaction: Transaction, ownerId: string, now: Date) {
  const windows = quotaWindows(ownerId, now);
  const current = await Promise.all(windows.map(window => getDocument(transaction.collection('usage_counters'), window.id)));
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];
    const counter = current[index];
    if (counter && (counter.ownerId !== ownerId || counter.windowType !== window.windowType || counter.windowStart !== window.windowStart
      || !Number.isSafeInteger(counter.count) || Number(counter.count) < 0)) {
      throw new Error('invalid AI quota counter');
    }
    if (Number(counter?.count ?? 0) >= window.limit) throw new AiRateLimitError('AI request quota exceeded');
  }
  const timestamp = now.toISOString();
  await Promise.all(windows.map((window, index) => {
    const counter = current[index];
    return transaction.collection('usage_counters').doc(window.id).set({ data: {
      ownerId,
      windowType: window.windowType,
      windowStart: window.windowStart,
      count: Number(counter?.count ?? 0) + 1,
      limit: window.limit,
      expiresAt: window.expiresAt,
      createdAt: typeof counter?.createdAt === 'string' ? counter.createdAt : timestamp,
      updatedAt: timestamp,
    } });
  }));
}

export function createAiRecordRepository(database: Database): AtomicAiRecordRepository {
  const runTransaction = <T>(callback: (transaction: Transaction) => Promise<T>) => transactionRunner(database)(callback, 3);
  return {
    async claim(ownerId, request, now) {
      return runTransaction(async transaction => {
        const collection = transaction.collection(collectionName(request.kind));
        const id = documentId(ownerId, request.requestId);
        const record = await getDocument(collection, id);
        const timestamp = now.toISOString();
        if (!record) {
          const attemptToken = newAttemptToken();
          await chargeQuota(transaction, ownerId, now);
          await collection.doc(id).set({ data: {
            ownerId,
            requestId: request.requestId,
            kind: request.kind,
            inputHash: requestHash(request),
            request: sanitizedRequest(request),
            status: 'running',
            attemptCount: 1,
            attemptToken,
            claimedAt: timestamp,
            quotaChargedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          } });
          return { state: 'claimed', attemptToken };
        }

        assertMatchingRecord(record, ownerId, request);
        assertOperationalRecord(record);
        if (record.status === 'succeeded') {
          const result = safeResult(record.result);
          if (!result) throw new Error('invalid successful AI record');
          return {
            state: 'cached',
            result,
          };
        }
        const claimedAt = Date.parse(String(record.claimedAt ?? ''));
        if (record.status === 'running' && Number.isFinite(claimedAt) && claimedAt + CLAIM_STALE_MS > now.getTime()) {
          return { state: 'running' };
        }
        if (record.status !== 'running' && record.status !== 'failed' && record.status !== 'timed_out') {
          throw new Error('invalid AI request status');
        }
        const attemptCount = record.attemptCount as number;
        if (attemptCount >= MAX_LOGICAL_ATTEMPTS) throw new AiRetryLimitError('AI retry limit exceeded');
        const latestAttemptAt = Date.parse(String(record.updatedAt ?? record.claimedAt ?? ''));
        if (!Number.isFinite(latestAttemptAt) || latestAttemptAt + RETRY_COOLDOWN_MS > now.getTime()) {
          throw new AiRequestInProgressError('AI retry cooldown active');
        }
        const attemptToken = newAttemptToken();
        await collection.doc(id).set({ data: {
          ...record,
          request: sanitizedRequest(request),
          status: 'running',
          attemptToken,
          claimedAt: timestamp,
          quotaChargedAt: typeof record.quotaChargedAt === 'string' && record.quotaChargedAt ? record.quotaChargedAt : timestamp,
          updatedAt: timestamp,
          attemptCount: attemptCount + 1,
        } });
        return { state: 'claimed', attemptToken };
      });
    },

    async complete(ownerId, request, attemptToken, result, difyConversationId, now) {
      if (!difyConversationId || difyConversationId.length > 256) throw new Error('invalid Dify conversation ID');
      await runTransaction(async transaction => {
        const collection = transaction.collection(collectionName(request.kind));
        const id = documentId(ownerId, request.requestId);
        const record = await getDocument(collection, id);
        if (!record) throw new Error('AI request claim not found');
        assertMatchingRecord(record, ownerId, request);
        assertOperationalRecord(record);
        assertActiveAttempt(record, attemptToken);
        const sanitizedResult = safeResult(result);
        if (!sanitizedResult || sanitizedResult.status !== 'succeeded' || sanitizedResult.requestId !== request.requestId) {
          throw new Error('invalid successful AI result');
        }
        await collection.doc(id).set({ data: {
          ...record,
          request: sanitizedRequest(request),
          status: 'succeeded',
          result: sanitizedResult,
          difyConversationId,
          updatedAt: now.toISOString(),
        } });
      });
    },

    async fail(ownerId, request, attemptToken, status, now) {
      await runTransaction(async transaction => {
        const collection = transaction.collection(collectionName(request.kind));
        const id = documentId(ownerId, request.requestId);
        const record = await getDocument(collection, id);
        if (!record) throw new Error('AI request claim not found');
        assertMatchingRecord(record, ownerId, request);
        assertOperationalRecord(record);
        assertActiveAttempt(record, attemptToken);
        await collection.doc(id).set({ data: {
          ...record,
          request: sanitizedRequest(request),
          status,
          updatedAt: now.toISOString(),
        } });
      });
    },

    async list(ownerId) {
      const documents = (await Promise.all((['chat', 'trip'] as const).map(async kind => {
        const data = (await database.collection(collectionName(kind)).where({ ownerId }).limit(50).get()).data;
        return data.map(item => ({ item, kind }));
      }))).flat();
      return documents.flatMap(({ item, kind }) => {
        const result = safeResult(item.result);
        if (!result || item.ownerId !== ownerId || item.kind !== kind || typeof item.createdAt !== 'string') return [];
        return [{ ...result, kind, createdAt: item.createdAt }];
      }).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 50);
    },

    async find(ownerId, request) {
      const data = await getDocument(database.collection(collectionName(request.kind)), documentId(ownerId, request.requestId));
      if (!data || data.ownerId !== ownerId || data.kind !== request.kind) return null;
      if (data.inputHash !== requestHash(request)) throw new AiRecordConflictError('requestId already used');
      return safeResult(data.result);
    },

    async save(ownerId, request, result) {
      const timestamp = new Date().toISOString();
      const sanitizedResult = safeResult(result);
      if (!sanitizedResult) throw new Error('invalid AI result');
      await database.collection(collectionName(request.kind)).doc(documentId(ownerId, request.requestId)).set({ data: {
        ownerId, requestId: request.requestId, kind: request.kind, inputHash: requestHash(request),
        request: sanitizedRequest(request), result: sanitizedResult, status: sanitizedResult.status, createdAt: timestamp, updatedAt: timestamp,
      } });
    },
  };
}

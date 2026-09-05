import { createHash } from 'node:crypto';
import type { AiHistoryItem, AiKind, AiRequest, AiResult } from '../../shared/contracts';

type Document = Record<string, unknown>;
type Collection = {
  doc(id: string): { get(): Promise<{ data?: Document | null }>; set(input: { data: Document }): Promise<unknown> };
  where(query: Document): { limit(count: number): { get(): Promise<{ data: Document[] }> } };
};
type Database = { collection(name: string): Collection };

export interface AiRecordRepository {
  find(ownerId: string, request: AiRequest): Promise<AiResult | null>;
  save(ownerId: string, request: AiRequest, result: AiResult): Promise<void>;
  list(ownerId: string): Promise<AiHistoryItem[]>;
}

export class AiRecordConflictError extends Error {}

function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function documentId(ownerId: string, requestId: string) { return digest(`ai-record\u0000${ownerId}\u0000${requestId}`); }
function requestHash(request: AiRequest) { return digest(JSON.stringify(request)); }
function collectionName(kind: AiKind) { return kind === 'chat' ? 'ai_messages' : 'trip_requests'; }
function isNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; errCode?: unknown; errMsg?: unknown; message?: unknown };
  const code = String(value.code ?? value.errCode ?? '').toUpperCase();
  const message = String(value.message ?? value.errMsg ?? '').toLowerCase();
  return code === 'NOT_FOUND' || code.includes('DOCUMENT_NOT_FOUND') || message === 'not found' || message.includes('document does not exist')
    || /^document\.get:fail document with _id \S+ does not exist$/.test(message);
}
function safeResult(value: unknown): AiResult | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Record<string, unknown>;
  if (typeof result.requestId !== 'string' || result.status !== 'succeeded' || typeof result.answer !== 'string' || result.answer.length > 4_000 || result.mode !== 'dify' || result.error !== null) return null;
  if (!Array.isArray(result.localFacts) || !result.localFacts.every(item => typeof item === 'string')) return null;
  if (!Array.isArray(result.references)) return null;
  return result as unknown as AiResult;
}
async function getDocument(collection: Collection, id: string) {
  try { return (await collection.doc(id).get()).data ?? null; }
  catch (error) { if (isNotFound(error)) return null; throw error; }
}

export function createAiRecordRepository(database: Database): AiRecordRepository {
  return {
    async find(ownerId, request) {
      const data = await getDocument(database.collection(collectionName(request.kind)), documentId(ownerId, request.requestId));
      if (!data || data.ownerId !== ownerId || data.kind !== request.kind) return null;
      if (data.inputHash !== requestHash(request)) throw new AiRecordConflictError('requestId already used');
      return safeResult(data.result);
    },
    async save(ownerId, request, result) {
      const timestamp = new Date().toISOString();
      await database.collection(collectionName(request.kind)).doc(documentId(ownerId, request.requestId)).set({ data: {
        ownerId, requestId: request.requestId, kind: request.kind, inputHash: requestHash(request), request, result,
        status: result.status, createdAt: timestamp, updatedAt: timestamp,
      } });
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
  };
}

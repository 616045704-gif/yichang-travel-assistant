import { createHash } from 'node:crypto';
import type { AiKind } from '../../shared/contracts';
import { isMissingDocument } from './database-errors';

type Document = Record<string, unknown>;
type Collection = {
  doc(id: string): {
    get(): Promise<{ data?: Document | null }>;
    set(input: { data: Document }): Promise<unknown>;
  };
};
type Transaction = { collection(name: string): Collection };
type Database = Transaction & {
  runTransaction?<T>(callback: (transaction: Transaction) => Promise<T>, times?: number): Promise<T>;
};

export interface AiConversationRepository {
  get(ownerId: string, kind: AiKind): Promise<string | null>;
  reset(ownerId: string, kind: AiKind): Promise<void>;
}

export function aiSessionDocumentId(ownerId: string, kind: AiKind) {
  return createHash('sha256').update(`ai-session\u0000${ownerId}\u0000${kind}`).digest('hex');
}

async function getDocument(collection: Collection, id: string) {
  try {
    return (await collection.doc(id).get()).data ?? null;
  } catch (error) {
    if (isMissingDocument(error)) return null;
    throw error;
  }
}

function generation(value: unknown) {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) >= Number.MAX_SAFE_INTEGER) {
    throw new Error('invalid AI session generation');
  }
  return value as number;
}

export function createAiConversationRepository(database: Database): AiConversationRepository {
  return {
    async get(ownerId, kind) {
      const data = await getDocument(database.collection('ai_sessions'), aiSessionDocumentId(ownerId, kind));
      if (!data) return null;
      return data.ownerId === ownerId && data.kind === kind && typeof data.difyConversationId === 'string' && data.difyConversationId
        ? data.difyConversationId
        : null;
    },

    async reset(ownerId, kind) {
      if (!database.runTransaction) throw new Error('database transactions are unavailable');
      await database.runTransaction(async transaction => {
        const id = aiSessionDocumentId(ownerId, kind);
        const current = await getDocument(transaction.collection('ai_sessions'), id);
        if (current && (current.ownerId !== ownerId || current.kind !== kind)) throw new Error('invalid AI session owner');
        const timestamp = new Date().toISOString();
        await transaction.collection('ai_sessions').doc(id).set({ data: {
          ownerId,
          kind,
          generation: generation(current?.generation) + 1,
          difyConversationId: null,
          activeRequestId: null,
          activeAttemptToken: null,
          leaseUntil: null,
          lastCompletedRequestId: null,
          updatedAt: timestamp,
        } });
      }, 3);
    },
  };
}

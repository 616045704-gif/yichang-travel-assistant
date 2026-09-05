import { createHash } from 'node:crypto';
import type { AiKind } from '../../shared/contracts';

type Document = Record<string, unknown>;
type Database = { collection(name: string): { doc(id: string): { get(): Promise<{ data: Document }>; set(input: { data: Document }): Promise<unknown> } } };

export interface AiConversationRepository {
  get(ownerId: string, kind: AiKind): Promise<string | null>;
  save(ownerId: string, kind: AiKind, conversationId: string): Promise<void>;
  reset(ownerId: string, kind: AiKind): Promise<void>;
}

function sessionId(ownerId: string, kind: AiKind) {
  return createHash('sha256').update(`ai-session\u0000${ownerId}\u0000${kind}`).digest('hex');
}

function now() { return new Date().toISOString(); }

export function createAiConversationRepository(database: Database): AiConversationRepository {
  const document = (ownerId: string, kind: AiKind) => database.collection('ai_sessions').doc(sessionId(ownerId, kind));
  return {
    async get(ownerId, kind) {
      try {
        const data = (await document(ownerId, kind).get()).data;
        return data.ownerId === ownerId && data.kind === kind && typeof data.difyConversationId === 'string' && data.difyConversationId ? data.difyConversationId : null;
      } catch { return null; }
    },
    async save(ownerId, kind, conversationId) {
      await document(ownerId, kind).set({ data: { ownerId, kind, difyConversationId: conversationId, updatedAt: now() } });
    },
    async reset(ownerId, kind) {
      await document(ownerId, kind).set({ data: { ownerId, kind, difyConversationId: null, updatedAt: now() } });
    },
  };
}

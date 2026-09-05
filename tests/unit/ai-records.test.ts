import { describe, expect, it } from 'vitest';
import type { AiRequest, AiResult } from '../../shared/contracts';
import { AiRecordConflictError, createAiRecordRepository } from '../../cloudfunctions/ai/records';

function database() {
  const documents = new Map<string, Record<string, unknown>>();
  return {
    collection(name: string) {
      return {
        doc(id: string) {
          const key = `${name}:${id}`;
          return {
            async get() { const data = documents.get(key); if (!data) throw new Error('not found'); return { data }; },
            async set(input: { data: Record<string, unknown> }) { documents.set(key, { ...input.data }); },
          };
        },
        where(query: Record<string, unknown>) {
          return { limit() { return { async get() {
            const data = [...documents.entries()]
              .filter(([key]) => key.startsWith(`${name}:`))
              .map(([, value]) => value)
              .filter(value => Object.entries(query).every(([field, expected]) => value[field] === expected));
            return { data };
          } }; } };
        },
      };
    },
  };
}

function result(requestId: string, answer: string): AiResult {
  return { requestId, status: 'succeeded', answer, mode: 'dify', error: null, localFacts: [], references: [] };
}

describe('private AI records', () => {
  it('treats the wx-server-sdk missing-document error as an empty record', async () => {
    const message = 'document.get:fail document with _id missing-record does not exist';
    const missing = {
      collection() {
        return {
          doc() {
            return {
              async get() { throw Object.assign(new Error(message), { errCode: -1, errMsg: message }); },
              async set() {},
            };
          },
          where() { return { limit() { return { async get() { return { data: [] }; } }; } }; },
        };
      },
    };
    const repository = createAiRecordRepository(missing);

    await expect(repository.find('owner-a', { requestId: 'missing', kind: 'chat', question: '问题' })).resolves.toBeNull();
  });

  it('stores chat and trip records separately and lists only the owner records', async () => {
    const repository = createAiRecordRepository(database());
    const chat: AiRequest = { requestId: 'chat-1', kind: 'chat', question: '问题' };
    const trip: AiRequest = { requestId: 'trip-1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: [] } };
    await repository.save('owner-a', chat, result(chat.requestId, '聊天回答'));
    await repository.save('owner-a', trip, result(trip.requestId, '行程回答'));
    await repository.save('owner-b', { ...chat, requestId: 'chat-2' }, result('chat-2', '其他用户回答'));

    await expect(repository.find('owner-a', chat)).resolves.toMatchObject({ answer: '聊天回答' });
    const records = await repository.list('owner-a');
    expect(records).toHaveLength(2);
    expect(records.map(item => item.kind).sort()).toEqual(['chat', 'trip']);
    expect(JSON.stringify(records)).not.toContain('其他用户回答');
  });

  it('rejects reuse of a requestId with different input', async () => {
    const repository = createAiRecordRepository(database());
    const original: AiRequest = { requestId: 'same-id', kind: 'chat', question: '原问题' };
    await repository.save('owner-a', original, result(original.requestId, '回答'));

    await expect(repository.find('owner-a', { ...original, question: '新问题' })).rejects.toBeInstanceOf(AiRecordConflictError);
  });
});

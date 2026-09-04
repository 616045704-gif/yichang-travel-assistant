import type { PageResult, RecordType, UserRecord } from '../../shared/contracts';
import { createHash } from 'node:crypto';

export interface UserRepository {
  isPublishedPlace(placeId: string): Promise<boolean>;
  setFavorite(ownerId: string, placeId: string, favorite: boolean): Promise<void>;
  recordBrowse(ownerId: string, placeId: string): Promise<string>;
  listRecords(ownerId: string, type: Exclude<RecordType, 'trips'>, cursor: string | null, pageSize: number): Promise<PageResult<UserRecord>>;
  favoritePlaceIds(ownerId: string, placeIds: string[]): Promise<Set<string>>;
  getPreferences(ownerId: string): Promise<string[]>;
  savePreferences(ownerId: string, preferences: string[]): Promise<string[]>;
}

type DocumentRef = { get(): Promise<{ data: Record<string, unknown> }>; set(input: { data: Record<string, unknown> }): Promise<unknown>; remove(): Promise<unknown> };
type Query = { get(): Promise<{ data: Record<string, unknown>[] }>; limit(count: number): { get(): Promise<{ data: Record<string, unknown>[] }> }; orderBy(field: string, direction: 'asc' | 'desc'): { skip(count: number): { limit(count: number): { get(): Promise<{ data: Record<string, unknown>[] }> } } } };
type Collection = { doc(id: string): DocumentRef; where(query: Record<string, unknown>): Query };
type Database = { collection(name: string): Collection; command: { in(values: string[]): unknown } };

function recordId(ownerId: string, placeId: string) { return createHash('sha256').update(`favorite-or-browse\u0000${ownerId}\u0000${placeId}`).digest('hex'); }
function preferenceId(ownerId: string) { return createHash('sha256').update(`preferences\u0000${ownerId}`).digest('hex'); }
function now() { return new Date().toISOString(); }
function decodeCursor(cursor: string | null) {
  if (!cursor) return 0;
  const value = Number(cursor);
  if (!Number.isInteger(value) || value < 0) throw new Error('INVALID_CURSOR');
  return value;
}

export function createUserRepository(database: Database): UserRepository {
  const collection = (name: string) => database.collection(name);
  return {
    async isPublishedPlace(placeId) {
      try { return (await collection('places').doc(placeId).get()).data.status === 'published'; }
      catch { return false; }
    },
    async setFavorite(ownerId, placeId, favorite) {
      const ref = collection('favorites').doc(recordId(ownerId, placeId));
      if (!favorite) { await ref.remove(); return; }
      await ref.set({ data: { ownerId, placeId, createdAt: now() } });
    },
    async recordBrowse(ownerId, placeId) {
      const viewedAt = now();
      await collection('browse_history').doc(recordId(ownerId, placeId)).set({ data: { ownerId, placeId, viewedAt } });
      return viewedAt;
    },
    async listRecords(ownerId, type, cursor, pageSize) {
      const offset = decodeCursor(cursor);
      const source = type === 'favorites' ? 'favorites' : 'browse_history';
      const timeField = type === 'favorites' ? 'createdAt' : 'viewedAt';
      const rows = (await collection(source).where({ ownerId }).orderBy(timeField, 'desc').skip(offset).limit(pageSize + 1).get()).data;
      const items = rows.slice(0, pageSize).map(row => ({ recordId: String(row._id), placeId: String(row.placeId), recordedAt: String(row[timeField]) }));
      return { items, nextCursor: rows.length > pageSize ? String(offset + pageSize) : null };
    },
    async favoritePlaceIds(ownerId, placeIds) {
      if (!placeIds.length) return new Set();
      const rows = (await collection('favorites').where({ ownerId, placeId: database.command.in(placeIds) }).limit(placeIds.length).get()).data;
      return new Set(rows.map(row => String(row.placeId)));
    },
    async getPreferences(ownerId) {
      try {
        const preferences = (await collection('user_preferences').doc(preferenceId(ownerId)).get()).data.preferences;
        return Array.isArray(preferences) ? preferences.filter((item): item is string => typeof item === 'string') : [];
      } catch { return []; }
    },
    async savePreferences(ownerId, preferences) {
      await collection('user_preferences').doc(preferenceId(ownerId)).set({ data: { ownerId, preferences, updatedAt: now() } });
      return preferences;
    },
  };
}

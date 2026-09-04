import type { RecordType } from '../../shared/contracts';
import type { UserRepository } from './repository';

type Event = { action?: unknown; placeId?: unknown; favorite?: unknown; type?: unknown; cursor?: unknown; pageSize?: unknown; preferences?: unknown; [key: string]: unknown };
const recordTypes: RecordType[] = ['favorites', 'browse', 'trips'];

function ok(data: unknown) { return { code: 'OK', data, message: '', traceId: 'user-testable' }; }
function fail(code: 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'NOT_FOUND' | 'INTERNAL_ERROR', message: string) { return { code, data: null, message, traceId: 'user-testable' }; }
function validPlaceId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value); }
function pageInput(event: Event) {
  if (!recordTypes.includes(event.type as RecordType)) throw new Error('INVALID');
  if (event.cursor !== undefined && event.cursor !== null && (typeof event.cursor !== 'string' || !/^\d+$/.test(event.cursor))) throw new Error('INVALID');
  if (event.pageSize !== undefined && (!Number.isInteger(event.pageSize) || (event.pageSize as number) < 1 || (event.pageSize as number) > 50)) throw new Error('INVALID');
  return { type: event.type as RecordType, cursor: (event.cursor as string | null | undefined) ?? null, pageSize: (event.pageSize as number | undefined) ?? 20 };
}
function preferencesInput(value: unknown) {
  if (!Array.isArray(value) || value.length > 6 || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 20)) throw new Error('INVALID');
  return [...new Set(value.map(item => (item as string).trim()))];
}

export async function handleUserRequest(event: Event, dependencies: { ownerId: string | null; repository: UserRepository }) {
  if (!dependencies.ownerId) return fail('UNAUTHENTICATED', '请在微信中重新进入后再试。');
  const { ownerId, repository } = dependencies;
  try {
    if (event.action === 'setFavorite') {
      if (!validPlaceId(event.placeId) || typeof event.favorite !== 'boolean') return fail('INVALID_INPUT', '收藏信息无效。');
      if (event.favorite && !(await repository.isPublishedPlace(event.placeId))) return fail('NOT_FOUND', '该地点暂不可查看。');
      await repository.setFavorite(ownerId, event.placeId, event.favorite);
      return ok({ placeId: event.placeId, favorite: event.favorite });
    }
    if (event.action === 'recordBrowse') {
      if (!validPlaceId(event.placeId)) return fail('INVALID_INPUT', '浏览地点无效。');
      if (!(await repository.isPublishedPlace(event.placeId))) return fail('NOT_FOUND', '该地点暂不可查看。');
      return ok({ placeId: event.placeId, viewedAt: await repository.recordBrowse(ownerId, event.placeId) });
    }
    if (event.action === 'listRecords') {
      const input = pageInput(event);
      if (input.type === 'trips') return ok({ items: [], nextCursor: null });
      return ok(await repository.listRecords(ownerId, input.type, input.cursor, input.pageSize));
    }
    if (event.action === 'getPreferences') return ok({ preferences: await repository.getPreferences(ownerId) });
    if (event.action === 'savePreferences') return ok({ preferences: await repository.savePreferences(ownerId, preferencesInput(event.preferences)) });
    return fail('INVALID_INPUT', '不支持的个人服务请求。');
  } catch (error) { return fail(error instanceof Error && error.message === 'INVALID' ? 'INVALID_INPUT' : 'INTERNAL_ERROR', '个人资料暂时无法加载，请稍后重试。'); }
}

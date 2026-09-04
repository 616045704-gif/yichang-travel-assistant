import type { PageResult, RecordType, UserRecord } from '../../shared/contracts';

type CloudEnvelope<T> = { result?: { code?: string; data?: T | null; message?: string } };
async function call<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  if (!wx.cloud?.callFunction) throw new Error('CLOUD_UNAVAILABLE');
  const response = await wx.cloud.callFunction({ name: 'userService', data: { action, ...payload } }) as CloudEnvelope<T>;
  if (response.result?.code !== 'OK' || response.result.data == null) throw new Error(response.result?.message || 'USER_SERVICE_ERROR');
  return response.result.data;
}
export function setFavorite(placeId: string, favorite: boolean) { return call<{ placeId: string; favorite: boolean }>('setFavorite', { placeId, favorite }); }
export function recordBrowse(placeId: string) { return call<{ placeId: string; viewedAt: string }>('recordBrowse', { placeId }); }
export function listRecords(type: Exclude<RecordType, 'trips'>, cursor: string | null = null) { return call<PageResult<UserRecord>>('listRecords', { type, cursor, pageSize: 20 }); }
export function getPreferences() { return call<{ preferences: string[] }>('getPreferences', {}); }
export function savePreferences(preferences: string[]) { return call<{ preferences: string[] }>('savePreferences', { preferences }); }

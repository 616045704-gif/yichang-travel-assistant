import type { Category, PageResult, PlaceDetail, PlaceSummary } from '../../shared/contracts';
import type { PlaceListRequest } from '../view-models/place-list';

type CloudEnvelope<T> = { result?: { code?: string; data?: T | null; message?: string } };

async function call<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  if (!wx.cloud?.callFunction) throw new Error('CLOUD_UNAVAILABLE');
  const response = await wx.cloud.callFunction({ name: 'placeService', data: { action, ...payload } }) as CloudEnvelope<T>;
  if (response.result?.code !== 'OK' || response.result.data == null) throw new Error(response.result?.message || 'PLACE_SERVICE_ERROR');
  return response.result.data;
}

export async function listPlaces(request: PlaceListRequest): Promise<PageResult<PlaceSummary>> {
  return call<PageResult<PlaceSummary>>('list', { ...request, tags: request.tag ? [request.tag] : [] });
}

export async function getPlaceDetail(placeId: string): Promise<PlaceDetail> {
  return call<PlaceDetail>('detail', { placeId });
}

export async function getHomePlaces(): Promise<{ featured: PlaceSummary[]; recommended: PlaceSummary[] }> {
  return call('home', {});
}

export function isCategory(value: string): value is Category {
  return ['scenic', 'restaurant', 'culture', 'camping'].includes(value);
}

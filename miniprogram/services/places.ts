import type { Category, PageResult, PlaceDetail, PlaceMarker, PlaceSummary } from '../../shared/contracts';
import type { PlaceListRequest } from '../view-models/place-list';

type CloudEnvelope<T> = { result?: { code?: string; data?: T | null; message?: string } };

async function call<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  if (!wx.cloud?.callFunction) throw new Error('CLOUD_UNAVAILABLE');
  const response = await wx.cloud.callFunction({ name: 'placeService', data: { action, ...payload } }) as CloudEnvelope<T>;
  if (response.result?.code !== 'OK' || response.result.data == null) throw new Error(response.result?.message || 'PLACE_SERVICE_ERROR');
  return response.result.data;
}

export async function listPlaces(request: PlaceListRequest): Promise<PageResult<PlaceSummary>> {
  const { category, ...rest } = request;
  return call<PageResult<PlaceSummary>>('list', { ...rest, ...(category ? { category } : {}), tags: request.tag ? [request.tag] : [] });
}

export async function getPlaceDetail(placeId: string): Promise<PlaceDetail> {
  return call<PlaceDetail>('detail', { placeId });
}

export async function getHomePlaces(): Promise<{ featured: PlaceSummary[]; recommended: PlaceSummary[] }> {
  return call('home', {});
}

export async function getMapMarkers(): Promise<PlaceMarker[]> {
  const response = await call<{ items: unknown[] }>('markers', {});
  if (Array.isArray(response.items) && response.items.every(isPlaceMarker)) return response.items;

  const markers: PlaceMarker[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const page = await listPlaces({ category: '', keyword: '', tag: '', cursor, pageSize: 50 });
    markers.push(...page.items.map(place => ({
      placeId: place.placeId,
      name: place.name,
      category: place.category,
      district: place.district,
      latitude: place.latitude,
      longitude: place.longitude,
      coordinateSystem: place.coordinateSystem,
    })));
    cursor = page.nextCursor;
    if (cursor && seenCursors.has(cursor)) throw new Error('PLACE_PAGINATION_ERROR');
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return markers;
}

function isPlaceMarker(value: unknown): value is PlaceMarker {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Record<string, unknown>;
  return typeof marker.placeId === 'string' && marker.placeId.trim().length > 0
    && typeof marker.name === 'string' && marker.name.trim().length > 0
    && typeof marker.category === 'string' && isCategory(marker.category)
    && typeof marker.district === 'string' && marker.district.trim().length > 0
    && marker.coordinateSystem === 'GCJ-02'
    && typeof marker.latitude === 'number' && Number.isFinite(marker.latitude) && Math.abs(marker.latitude) <= 90
    && typeof marker.longitude === 'number' && Number.isFinite(marker.longitude) && Math.abs(marker.longitude) <= 180;
}

export function isCategory(value: string): value is Category {
  return ['scenic', 'restaurant', 'culture', 'camping'].includes(value);
}

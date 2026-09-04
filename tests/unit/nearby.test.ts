import { describe, expect, it } from 'vitest';
import { handlePlaceRequest } from '../../cloudfunctions/places/service';
import type { PlaceRepository } from '../../cloudfunctions/places/repository';
import type { PlaceMarker } from '../../shared/contracts';

const origin = { latitude: 0, longitude: 0 };
const markers: PlaceMarker[] = [
  { placeId: 'near', name: '近点', category: 'scenic', latitude: 0.179011, longitude: 0, coordinateSystem: 'GCJ-02' },
  { placeId: 'edge', name: '边界点', category: 'restaurant', latitude: 0.179864, longitude: 0, coordinateSystem: 'GCJ-02' },
  { placeId: 'far', name: '远点', category: 'culture', latitude: 0.180763, longitude: 0, coordinateSystem: 'GCJ-02' },
];
const repository: PlaceRepository = { list: async () => ({ items: [], nextCursor: null }), detail: async () => null, markers: async () => markers };
const storage = { getTempFileURL: async () => ({ fileList: [] }) };

describe('nearby place service', () => {
  it('includes 19.9 km and 20 km points, excludes 20.1 km, and sorts by distance', async () => {
    const response = await handlePlaceRequest({ action: 'nearby', ...origin }, { repository, storage });
    expect(response).toMatchObject({ code: 'OK', data: { items: [{ placeId: 'near' }, { placeId: 'edge' }] } });
    expect((response.data as { items: Array<{ distanceMeters: number }> }).items[1].distanceMeters).toBeLessThanOrEqual(20_000);
  });
  it('filters categories, exposes public map fields only, and has stable ties', async () => {
    const tied: PlaceMarker[] = [{ ...markers[0], placeId: 'b' }, { ...markers[0], placeId: 'a' }];
    const tieRepository = { ...repository, markers: async () => tied };
    const response = await handlePlaceRequest({ action: 'nearby', ...origin, category: 'scenic' }, { repository: tieRepository, storage });
    expect(response.data).toEqual({ items: [expect.objectContaining({ placeId: 'a' }), expect.objectContaining({ placeId: 'b' })] });
    expect(Object.keys((response.data as { items: Record<string, unknown>[] }).items[0]).sort()).toEqual(['category', 'coordinateSystem', 'distanceMeters', 'latitude', 'longitude', 'name', 'placeId']);
  });
  it('returns invalid input rather than accepting malformed coordinates', async () => {
    await expect(handlePlaceRequest({ action: 'nearby', latitude: 91, longitude: 0 }, { repository, storage })).resolves.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

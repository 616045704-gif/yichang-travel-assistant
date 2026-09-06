import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHomePlaces, getMapMarkers, getNearbyPlaces, getPlaceDetail, isCategory, listPlaces } from '../../miniprogram/services/places';
import { scenicDetail, scenicPlace } from '../fixtures/places';

afterEach(() => { vi.unstubAllGlobals(); });

describe('place service client', () => {
  it('sends list, detail, home and map requests through the cloud boundary', async () => {
    const callFunction = vi.fn(async ({ data }: { data: { action: string } }) => ({ result: { code: 'OK', data: data.action === 'detail' ? scenicDetail : data.action === 'home' ? { featured: [scenicPlace], recommended: [] } : { items: [scenicPlace], nextCursor: null } } }));
    vi.stubGlobal('wx', { cloud: { callFunction } });
    await expect(listPlaces({ category: '', keyword: '', tag: '', cursor: null, pageSize: 20 })).resolves.toMatchObject({ items: [scenicPlace] });
    expect(callFunction).toHaveBeenCalledWith({ name: 'placeService', data: { action: 'list', keyword: '', tag: '', cursor: null, pageSize: 20, tags: [] } });
    await expect(getPlaceDetail(scenicPlace.placeId)).resolves.toEqual(scenicDetail);
    await expect(getHomePlaces()).resolves.toEqual({ featured: [scenicPlace], recommended: [] });
    await expect(getMapMarkers()).resolves.toEqual([scenicPlace]);
  });
  it('passes the current query only to nearby and validates categories locally', async () => {
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: { items: [scenicPlace] } } }));
    vi.stubGlobal('wx', { cloud: { callFunction } });
    await getNearbyPlaces({ latitude: 30.7, longitude: 111.3 }, 'scenic');
    expect(callFunction).toHaveBeenCalledWith({ name: 'placeService', data: { action: 'nearby', latitude: 30.7, longitude: 111.3, category: 'scenic' } });
    expect(isCategory('scenic')).toBe(true);
    expect(isCategory('other')).toBe(false);
  });
  it('surfaces service failures instead of treating an envelope as successful data', async () => {
    vi.stubGlobal('wx', { cloud: { callFunction: vi.fn(async () => ({ result: { code: 'INTERNAL_ERROR', data: null, message: '服务暂不可用' } })) } });
    await expect(getMapMarkers()).rejects.toThrow('服务暂不可用');
  });
});

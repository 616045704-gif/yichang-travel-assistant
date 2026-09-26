import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHomePlaces, getMapMarkers, getPlaceDetail, isCategory, listPlaces } from '../../miniprogram/services/places';
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
  it('loads public map markers without sending a user location and validates categories locally', async () => {
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: { items: [scenicPlace] } } }));
    vi.stubGlobal('wx', { cloud: { callFunction } });
    await getMapMarkers();
    expect(callFunction).toHaveBeenCalledWith({ name: 'placeService', data: { action: 'markers' } });
    expect(JSON.stringify(callFunction.mock.calls)).not.toContain('latitude');
    expect(JSON.stringify(callFunction.mock.calls)).not.toContain('longitude');
    expect(isCategory('scenic')).toBe(true);
    expect(isCategory('other')).toBe(false);
  });
  it('falls back to paged place summaries when a deployed legacy marker response has no district', async () => {
    const legacyMarker = Object.fromEntries(Object.entries(scenicPlace).filter(([key]) => key !== 'district'));
    const callFunction = vi.fn(async ({ data }: { data: { action: string; cursor?: string | null } }) => ({
      result: {
        code: 'OK',
        data: data.action === 'markers'
          ? { items: [legacyMarker] }
          : { items: [scenicPlace], nextCursor: null },
      },
    }));
    vi.stubGlobal('wx', { cloud: { callFunction } });

    await expect(getMapMarkers()).resolves.toEqual([{
      placeId: scenicPlace.placeId,
      name: scenicPlace.name,
      category: scenicPlace.category,
      district: scenicPlace.district,
      latitude: scenicPlace.latitude,
      longitude: scenicPlace.longitude,
      coordinateSystem: scenicPlace.coordinateSystem,
    }]);
    expect(callFunction).toHaveBeenNthCalledWith(1, { name: 'placeService', data: { action: 'markers' } });
    expect(callFunction).toHaveBeenNthCalledWith(2, { name: 'placeService', data: { action: 'list', keyword: '', tag: '', cursor: null, pageSize: 50, tags: [] } });
  });
  it('loads every fallback page and rejects a repeated pagination cursor', async () => {
    const legacyMarker = Object.fromEntries(Object.entries(scenicPlace).filter(([key]) => key !== 'district'));
    const secondPlace = { ...scenicPlace, placeId: 'second-place', name: '第二页地点', district: '夷陵区' };
    const callFunction = vi.fn(async ({ data }: { data: { action: string; cursor?: string | null } }) => ({
      result: {
        code: 'OK',
        data: data.action === 'markers'
          ? { items: [legacyMarker] }
          : data.cursor === null
            ? { items: [scenicPlace], nextCursor: 'page-2' }
            : { items: [secondPlace], nextCursor: null },
      },
    }));
    vi.stubGlobal('wx', { cloud: { callFunction } });

    await expect(getMapMarkers()).resolves.toMatchObject([
      { placeId: scenicPlace.placeId, district: scenicPlace.district },
      { placeId: secondPlace.placeId, district: secondPlace.district },
    ]);
    expect(callFunction).toHaveBeenCalledTimes(3);

    const repeatingCall = vi.fn(async ({ data }: { data: { action: string } }) => ({
      result: { code: 'OK', data: data.action === 'markers' ? { items: [legacyMarker] } : { items: [scenicPlace], nextCursor: 'same-cursor' } },
    }));
    vi.stubGlobal('wx', { cloud: { callFunction: repeatingCall } });
    await expect(getMapMarkers()).rejects.toThrow('PLACE_PAGINATION_ERROR');
  });
  it('surfaces service failures instead of treating an envelope as successful data', async () => {
    vi.stubGlobal('wx', { cloud: { callFunction: vi.fn(async () => ({ result: { code: 'INTERNAL_ERROR', data: null, message: '服务暂不可用' } })) } });
    await expect(getMapMarkers()).rejects.toThrow('服务暂不可用');
  });
});

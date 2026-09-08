import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMarkers, findPlaceByMarkerId, type MapPlace, type TravelMarker } from '../../miniprogram/view-models/map';
import type { Category } from '../../shared/contracts';

const places: MapPlace[] = [
  { placeId: 'test-b', name: '自动化景区点', category: 'scenic', latitude: 30.7, longitude: 111.3, coordinateSystem: 'GCJ-02' },
  { placeId: 'test-a', name: '自动化餐馆点', category: 'restaurant', latitude: 30.71, longitude: 111.31, coordinateSystem: 'GCJ-02' },
  { placeId: 'test-c', name: '自动化文化点', category: 'culture', latitude: 30.72, longitude: 111.32, coordinateSystem: 'GCJ-02' },
  { placeId: 'test-d', name: '自动化露营点', category: 'camping', latitude: 30.73, longitude: 111.33, coordinateSystem: 'GCJ-02' },
];

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('category map markers', () => {
  it.each(['scenic', 'restaurant', 'culture', 'camping'] as Category[])('shows only %s markers', category => {
    const result = buildMarkers(places, category);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ iconPath: '/assets/provided/map-marker.png', width: 36, height: 44 });
    expect(result[0]).not.toHaveProperty('callout');
  });
  it('restores all markers with stable numeric IDs across category and input ordering', () => {
    const all = buildMarkers(places, '');
    const scenic = buildMarkers(places, 'scenic')[0];
    expect(all).toHaveLength(4);
    expect(new Set(all.map(marker => marker.id)).size).toBe(4);
    expect(all.find(marker => marker.latitude === scenic.latitude && marker.longitude === scenic.longitude)!.id).toBe(scenic.id);
    expect(buildMarkers([...places].reverse(), '')).toEqual(all);
    expect(places[0].placeId).toBe('test-b');
  });
  it('excludes invalid coordinates, unknown categories, empty names and duplicates', () => {
    const invalid = [null, {}, { ...places[0], latitude: NaN }, { ...places[0], longitude: Infinity }, { ...places[0], latitude: 91 }, { ...places[0], longitude: -181 }, { ...places[0], category: 'other' }, { ...places[0], coordinateSystem: 'WGS84' }, { ...places[0], placeId: '' }, { ...places[0], name: ' ' }];
    expect(buildMarkers(invalid, '')).toEqual([]);
    expect(buildMarkers([places[0], places[0]], '')).toHaveLength(1);
    expect(buildMarkers([], '')).toEqual([]);
    expect(buildMarkers([places[0]], 'camping')).toEqual([]);
  });
  it('updates visible markers on actual page selection without moving the viewport or locating', async () => {
    type MapPage = {
      data: { places: MapPlace[]; category: Category | ''; markers: TravelMarker[]; center: { latitude: number; longitude: number } };
      setData(value: Record<string, unknown>): void;
      setPlaces(value: MapPlace[]): void;
      onCategoryChange(event: { detail: { category: string } }): void;
    };
    let page: MapPage;
    vi.stubGlobal('Page', (value: MapPage) => { page = value; });
    const getLocation = vi.fn();
    const setStorage = vi.fn();
    vi.stubGlobal('wx', { getLocation, setStorage });
    await import('../../miniprogram/pages/map/index');
    page!.setData = function (value) { Object.assign(this.data, value); };
    const center = { ...page!.data.center };
    page!.setPlaces(places);
    expect(page!.data.markers).toHaveLength(4);
    page!.onCategoryChange({ detail: { category: 'scenic' } });
    expect(page!.data.markers).toHaveLength(1);
    page!.setPlaces([places[1]]);
    expect(page!.data.markers).toEqual([]);
    page!.onCategoryChange({ detail: { category: '' } });
    expect(page!.data.markers).toHaveLength(1);
    page!.onCategoryChange({ detail: { category: 'invalid' } });
    expect(page!.data.category).toBe('');
    expect(page!.data.center).toEqual(center);
    expect(getLocation).not.toHaveBeenCalled();
    expect(setStorage).not.toHaveBeenCalled();
  });
  it('maps a marker tap to its public place and opens the shared detail route', async () => {
    expect(findPlaceByMarkerId(places, '', buildMarkers(places, '')[0].id)?.placeId).toBe('test-a');
    type MapPage = { data: { places: MapPlace[]; category: Category | ''; selectedPlace: MapPlace | null }; setData(value: Record<string, unknown>): void; onMarkerTap(event: { detail: { markerId: number } }): void; openSelectedPlace(): void };
    let page: MapPage;
    vi.stubGlobal('Page', (value: MapPage) => { page = value; });
    const navigateTo = vi.fn();
    vi.stubGlobal('wx', { navigateTo });
    await import('../../miniprogram/pages/map/index');
    page!.setData = function (value) { Object.assign(this.data, value); };
    page!.data.places = places;
    page!.data.category = '';
    page!.onMarkerTap({ detail: { markerId: 1 } });
    page!.openSelectedPlace();
    expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/place-detail/index?placeId=test-a' });
  });
});

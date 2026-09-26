import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMarkers, filterPlacesByRegion, findPlaceByMarkerId, REGION_VIEWPORTS, type MapPlace, type MapRegion, type TravelMarker } from '../../miniprogram/view-models/map';
import type { Category } from '../../shared/contracts';

const places: MapPlace[] = [
  { placeId: 'test-b', name: '自动化景区点', category: 'scenic', district: '西陵区', latitude: 30.7, longitude: 111.3, coordinateSystem: 'GCJ-02' },
  { placeId: 'test-a', name: '自动化餐馆点', category: 'restaurant', district: '夷陵区', latitude: 30.71, longitude: 111.31, coordinateSystem: 'GCJ-02' },
  { placeId: 'test-c', name: '自动化文化点', category: 'culture', district: '秭归县', latitude: 30.72, longitude: 111.32, coordinateSystem: 'GCJ-02' },
  { placeId: 'test-d', name: '自动化露营点', category: 'camping', district: '兴山县', latitude: 30.73, longitude: 111.33, coordinateSystem: 'GCJ-02' },
];

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('category map markers', () => {
  it('filters cloud-provided points by a selected Yichang region and keeps all points when no region is selected', () => {
    expect(filterPlacesByRegion(places, '')).toEqual(places);
    expect(filterPlacesByRegion(places, '城区').map(place => place.placeId)).toEqual(['test-b']);
    expect(filterPlacesByRegion(places, '夷陵区').map(place => place.placeId)).toEqual(['test-a']);
    expect(filterPlacesByRegion(places, '长阳县')).toEqual([]);
  });
  it('matches the district format used by the real CloudBase import batch', () => {
    const imported: MapPlace[] = [
      { ...places[0], placeId: 'prefixed-city', district: '宜昌市 / 西陵区' },
      { ...places[0], placeId: 'city-alias', district: '宜昌市 / 宜昌市区' },
      { ...places[0], placeId: 'prefixed-changyang', district: '宜昌市 / 长阳县' },
      { ...places[0], placeId: 'prefixed-wufeng', district: '宜昌市 / 五峰县' },
    ];

    expect(filterPlacesByRegion(imported, '城区').map(place => place.placeId)).toEqual(['prefixed-city', 'city-alias']);
    expect(filterPlacesByRegion(imported, '长阳县').map(place => place.placeId)).toEqual(['prefixed-changyang']);
    expect(filterPlacesByRegion(imported, '五峰县').map(place => place.placeId)).toEqual(['prefixed-wufeng']);
  });
  it('preserves the verified region counts of the 387-place import batch', () => {
    const counts: Array<{ district: string; count: number }> = [
      { district: '宜昌市 / 夷陵区', count: 58 }, { district: '宜昌市 / 秭归县', count: 46 },
      { district: '宜昌市 / 长阳县', count: 38 }, { district: '宜昌市 / 西陵区', count: 37 },
      { district: '宜昌市 / 宜都市', count: 36 }, { district: '宜昌市 / 远安县', count: 36 },
      { district: '宜昌市 / 当阳市', count: 27 }, { district: '宜昌市 / 枝江市', count: 27 },
      { district: '宜昌市 / 点军区', count: 25 }, { district: '宜昌市 / 兴山县', count: 22 },
      { district: '宜昌市 / 五峰县', count: 14 }, { district: '宜昌市 / 伍家岗区', count: 11 },
      { district: '宜昌市 / 宜昌市区', count: 7 }, { district: '宜昌市 / 猇亭区', count: 3 },
    ];
    const imported = counts.flatMap(({ district, count }, districtIndex) => Array.from({ length: count }, (_, index) => ({
      ...places[0], placeId: `imported-${districtIndex}-${index}`, district,
    })));
    const expected: Array<[MapRegion, number]> = [
      ['城区', 83], ['夷陵区', 58], ['秭归县', 46], ['兴山县', 22], ['长阳县', 38],
      ['远安县', 36], ['当阳市', 27], ['枝江市', 27], ['宜都市', 36], ['五峰县', 14],
    ];

    expect(imported).toHaveLength(387);
    for (const [region, count] of expected) expect(filterPlacesByRegion(imported, region)).toHaveLength(count);
  });
  it('defines a valid map viewport for every selectable region', () => {
    expect(Object.keys(REGION_VIEWPORTS)).toHaveLength(10);
    for (const viewport of Object.values(REGION_VIEWPORTS)) {
      expect(Number.isFinite(viewport.center.latitude)).toBe(true);
      expect(Number.isFinite(viewport.center.longitude)).toBe(true);
      expect(Math.abs(viewport.center.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(viewport.center.longitude)).toBeLessThanOrEqual(180);
      expect(viewport.scale).toBeGreaterThanOrEqual(5);
      expect(viewport.scale).toBeLessThanOrEqual(20);
    }
  });
  const expectedPaths: Record<Category, string> = {
    scenic: '/assets/provided/map-marker-scenic.png',
    restaurant: '/assets/provided/map-marker-restaurant.png',
    culture: '/assets/provided/map-marker-culture.png',
    camping: '/assets/provided/map-marker-camping.png',
  };
  it.each(['scenic', 'restaurant', 'culture', 'camping'] as Category[])('shows only %s markers', category => {
    const result = buildMarkers(places, category);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ iconPath: expectedPaths[category], width: 44, height: 54 });
    expect(result[0]).not.toHaveProperty('callout');
  });
  it('restores all markers with stable numeric IDs across category and input ordering', () => {
    const all = buildMarkers(places, '');
    const scenic = buildMarkers(places, 'scenic')[0];
    expect(all).toHaveLength(4);
    expect(new Set(all.map(marker => marker.iconPath))).toEqual(new Set(Object.values(expectedPaths)));
    expect(new Set(all.map(marker => marker.id)).size).toBe(4);
    expect(all.find(marker => marker.latitude === scenic.latitude && marker.longitude === scenic.longitude)!.id).toBe(scenic.id);
    expect(buildMarkers([...places].reverse(), '')).toEqual(all);
    for (const marker of all) {
      const source = places.find(place => place.latitude === marker.latitude && place.longitude === marker.longitude);
      expect(source).toBeTruthy();
      expect(marker.latitude).toBe(source!.latitude);
      expect(marker.longitude).toBe(source!.longitude);
    }
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
  it('moves the viewport to Changyang and restores the Yichang view for all places', async () => {
    type MapPage = {
      data: {
        center: { latitude: number; longitude: number };
        scale: number;
        region: MapRegion;
        regionIndex: number;
      };
      setData(value: Record<string, unknown>): void;
      onRegionChange(event: { detail: { value: string } }): void;
      onCategoryChange(event: { detail: { category: string } }): void;
    };
    let page: MapPage;
    vi.stubGlobal('Page', (value: MapPage) => { page = value; });
    const getLocation = vi.fn();
    vi.stubGlobal('wx', { getLocation });
    await import('../../miniprogram/pages/map/index');
    page!.setData = function (value) { Object.assign(this.data, value); };

    const defaultCenter = { ...page!.data.center };
    const defaultScale = page!.data.scale;
    page!.onRegionChange({ detail: { value: '5' } });
    expect(page!.data.region).toBe('长阳县');
    expect(page!.data.regionIndex).toBe(5);
    expect(page!.data.center).toEqual({ latitude: 30.4735, longitude: 111.2075 });
    expect(page!.data.scale).toBe(10);

    const changyangCenter = { ...page!.data.center };
    const changyangScale = page!.data.scale;
    page!.onCategoryChange({ detail: { category: 'scenic' } });
    expect(page!.data.center).toEqual(changyangCenter);
    expect(page!.data.scale).toBe(changyangScale);
    page!.onRegionChange({ detail: { value: '99' } });
    expect(page!.data.center).toEqual(changyangCenter);
    expect(page!.data.scale).toBe(changyangScale);
    expect(page!.data.region).toBe('长阳县');
    expect(page!.data.regionIndex).toBe(5);

    page!.onRegionChange({ detail: { value: '0' } });
    expect(page!.data.center).toEqual(defaultCenter);
    expect(page!.data.scale).toBe(defaultScale);
    expect(getLocation).not.toHaveBeenCalled();
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

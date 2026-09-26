import { CATEGORIES, type Category, type PlaceSummary } from '../../shared/contracts';

export type MapPlace = Pick<PlaceSummary, 'placeId' | 'name' | 'category' | 'district' | 'latitude' | 'longitude' | 'coordinateSystem'>;
export type MapRegion = '' | '城区' | '夷陵区' | '秭归县' | '兴山县' | '长阳县' | '远安县' | '当阳市' | '枝江市' | '宜都市' | '五峰县';

export interface MapViewport {
  center: { latitude: number; longitude: number };
  scale: number;
}

export interface TravelMarker {
  id: number;
  latitude: number;
  longitude: number;
  iconPath: string;
  width: number;
  height: number;
}

const MARKER_ICON_BY_CATEGORY: Record<Category, string> = {
  scenic: '/assets/provided/map-marker-scenic.png',
  restaurant: '/assets/provided/map-marker-restaurant.png',
  culture: '/assets/provided/map-marker-culture.png',
  camping: '/assets/provided/map-marker-camping.png',
};

function isMapPlace(value: unknown): value is MapPlace {
  if (!value || typeof value !== 'object') return false;
  const place = value as Record<string, unknown>;
  return typeof place.placeId === 'string' && place.placeId.trim().length > 0
    && typeof place.name === 'string' && place.name.trim().length > 0
    && typeof place.district === 'string' && place.district.trim().length > 0
    && CATEGORIES.some(category => category.value === place.category)
    && place.coordinateSystem === 'GCJ-02'
    && typeof place.latitude === 'number' && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90
    && typeof place.longitude === 'number' && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180;
}

const REGION_DISTRICTS: Record<Exclude<MapRegion, ''>, readonly string[]> = {
  城区: ['西陵区', '伍家岗区', '点军区', '猇亭区', '宜昌市区'],
  夷陵区: ['夷陵区'], 秭归县: ['秭归县'], 兴山县: ['兴山县'], 长阳县: ['长阳县', '长阳土家族自治县'],
  远安县: ['远安县'], 当阳市: ['当阳市'], 枝江市: ['枝江市'], 宜都市: ['宜都市'], 五峰县: ['五峰土家族自治县', '五峰县'],
};

// Fixed GCJ-02 administrative-area views; none of these coordinates represent the user.
export const REGION_VIEWPORTS: Record<Exclude<MapRegion, ''>, MapViewport> = {
  城区: { center: { latitude: 30.6919, longitude: 111.2865 }, scale: 11 },
  夷陵区: { center: { latitude: 30.768, longitude: 111.326 }, scale: 10 },
  秭归县: { center: { latitude: 30.825, longitude: 110.977 }, scale: 10 },
  兴山县: { center: { latitude: 31.349, longitude: 110.754 }, scale: 10 },
  长阳县: { center: { latitude: 30.4735, longitude: 111.2075 }, scale: 10 },
  远安县: { center: { latitude: 31.059, longitude: 111.64 }, scale: 10 },
  当阳市: { center: { latitude: 30.821, longitude: 111.788 }, scale: 10 },
  枝江市: { center: { latitude: 30.426, longitude: 111.76 }, scale: 10 },
  宜都市: { center: { latitude: 30.378, longitude: 111.45 }, scale: 10 },
  五峰县: { center: { latitude: 30.163, longitude: 111.073 }, scale: 10 },
};

export function getMapViewport(region: MapRegion, defaultCenter: MapViewport['center']): MapViewport {
  if (!region) return { center: { ...defaultCenter }, scale: 11 };
  const viewport = REGION_VIEWPORTS[region];
  return { center: { ...viewport.center }, scale: viewport.scale };
}

export function normalizeDistrict(district: string): string {
  let normalized = district.trim().replace(/\s+/gu, '');
  if (normalized.startsWith('湖北省')) normalized = normalized.slice(3);
  if (normalized.startsWith('宜昌市/')) return normalized.slice(4);
  if (normalized.startsWith('宜昌市／')) return normalized.slice(4);
  if (normalized.startsWith('宜昌市') && normalized !== '宜昌市区') return normalized.slice(3);
  return normalized;
}

export function filterPlacesByRegion(places: readonly MapPlace[], region: MapRegion): MapPlace[] {
  if (!region) return [...places];
  return places.filter(place => REGION_DISTRICTS[region].includes(normalizeDistrict(place.district)));
}

export function buildMarkers(places: readonly unknown[], category: Category | ''): TravelMarker[] {
  const unique = new Map<string, MapPlace>();
  for (const place of places) if (isMapPlace(place) && !unique.has(place.placeId)) unique.set(place.placeId, place);
  // Assign IDs before filtering, so changing category does not change a point's ID.
  return [...unique.values()]
    .sort((a, b) => a.placeId.localeCompare(b.placeId))
    .map((place, index) => ({ place, id: index + 1 }))
    .filter(({ place }) => !category || place.category === category)
    .map(({ place, id }) => ({
      id,
      latitude: place.latitude,
      longitude: place.longitude,
      iconPath: MARKER_ICON_BY_CATEGORY[place.category],
      width: 44,
      height: 54,
    }));
}

export function findPlaceByMarkerId(places: readonly unknown[], category: Category | '', markerId: number): MapPlace | null {
  const marker = buildMarkers(places, category).find(item => item.id === markerId);
  if (!marker) return null;
  const unique = new Map<string, MapPlace>();
  for (const place of places) if (isMapPlace(place) && !unique.has(place.placeId)) unique.set(place.placeId, place);
  return [...unique.values()].sort((a, b) => a.placeId.localeCompare(b.placeId)).find((place, index) => index + 1 === marker.id) || null;
}

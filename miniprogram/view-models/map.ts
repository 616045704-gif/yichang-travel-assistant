import { CATEGORIES, type Category, type PlaceSummary } from '../../shared/contracts';

export type MapPlace = Pick<PlaceSummary, 'placeId' | 'name' | 'category' | 'latitude' | 'longitude' | 'coordinateSystem'> & { distanceMeters?: number };

export interface TravelMarker {
  id: number;
  latitude: number;
  longitude: number;
  iconPath: string;
  width: number;
  height: number;
  callout: { content: string; display: 'BYCLICK'; fontSize: number; color: string; bgColor: string; borderRadius: number; padding: number };
}

function isMapPlace(value: unknown): value is MapPlace {
  if (!value || typeof value !== 'object') return false;
  const place = value as Record<string, unknown>;
  return typeof place.placeId === 'string' && place.placeId.trim().length > 0
    && typeof place.name === 'string' && place.name.trim().length > 0
    && CATEGORIES.some(category => category.value === place.category)
    && place.coordinateSystem === 'GCJ-02'
    && typeof place.latitude === 'number' && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90
    && typeof place.longitude === 'number' && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180;
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
      iconPath: '/assets/icons/location.png',
      width: 30,
      height: 38,
      callout: { content: place.name, display: 'BYCLICK', fontSize: 13, color: '#30254a', bgColor: '#ffffff', borderRadius: 14, padding: 10 },
    }));
}

export function findPlaceByMarkerId(places: readonly unknown[], category: Category | '', markerId: number): MapPlace | null {
  const marker = buildMarkers(places, category).find(item => item.id === markerId);
  if (!marker) return null;
  const unique = new Map<string, MapPlace>();
  for (const place of places) if (isMapPlace(place) && !unique.has(place.placeId)) unique.set(place.placeId, place);
  return [...unique.values()].sort((a, b) => a.placeId.localeCompare(b.placeId)).find((place, index) => index + 1 === marker.id) || null;
}

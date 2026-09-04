export const NEARBY_RADIUS_METERS = 20_000;

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== 'object') return false;
  const coordinate = value as Record<string, unknown>;
  return typeof coordinate.latitude === 'number' && Number.isFinite(coordinate.latitude) && Math.abs(coordinate.latitude) <= 90
    && typeof coordinate.longitude === 'number' && Number.isFinite(coordinate.longitude) && Math.abs(coordinate.longitude) <= 180;
}

/** Returns an unrounded great-circle distance so radius checks retain the exact boundary. */
export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to.latitude - from.latitude) * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

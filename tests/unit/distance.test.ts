import { describe, expect, it } from 'vitest';
import { distanceMeters, isCoordinate, NEARBY_RADIUS_METERS } from '../../cloudfunctions/places/distance';

describe('nearby distance', () => {
  it('keeps a zero-distance result at zero', () => {
    expect(distanceMeters({ latitude: 30.691, longitude: 111.286 }, { latitude: 30.691, longitude: 111.286 })).toBe(0);
  });
  it('uses a fixed twenty kilometre radius without rounding', () => {
    expect(NEARBY_RADIUS_METERS).toBe(20_000);
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0.179011, longitude: 0 })).toBeCloseTo(19_905, -1);
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0.179864, longitude: 0 })).toBeCloseTo(20_000, -1);
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0.180763, longitude: 0 })).toBeCloseTo(20_100, -1);
  });
  it('rejects invalid request coordinates', () => {
    expect(isCoordinate({ latitude: 30.7, longitude: 111.3 })).toBe(true);
    for (const value of [null, {}, { latitude: '30.7', longitude: 111.3 }, { latitude: 91, longitude: 111.3 }, { latitude: 30.7, longitude: Infinity }]) expect(isCoordinate(value)).toBe(false);
  });
});

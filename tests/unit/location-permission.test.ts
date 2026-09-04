import { afterEach, describe, expect, it, vi } from 'vitest';
import { openLocationSettings, requestCurrentLocation } from '../../miniprogram/services/location';

afterEach(() => { vi.unstubAllGlobals(); });

describe('user initiated location permission', () => {
  it('requests location only after the permission state is checked', async () => {
    const getLocation = vi.fn(({ success }: { success: (result: { latitude: number; longitude: number }) => void }) => success({ latitude: 30.7, longitude: 111.3 }));
    vi.stubGlobal('wx', { getSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: {} }), authorize: ({ success }: { success: () => void }) => success(), getLocation });
    await expect(requestCurrentLocation()).resolves.toEqual({ latitude: 30.7, longitude: 111.3 });
    expect(getLocation).toHaveBeenCalledWith(expect.objectContaining({ type: 'gcj02' }));
  });
  it('does not request a location after the user has denied it', async () => {
    const getLocation = vi.fn();
    vi.stubGlobal('wx', { getSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: { 'scope.userLocation': false } }), getLocation });
    await expect(requestCurrentLocation()).rejects.toThrow('denied');
    expect(getLocation).not.toHaveBeenCalled();
  });
  it('normalizes a denial from the first system authorization prompt', async () => {
    const getLocation = vi.fn();
    vi.stubGlobal('wx', { getSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: {} }), authorize: ({ fail }: { fail: (reason: { errMsg: string }) => void }) => fail({ errMsg: 'authorize:fail auth deny' }), getLocation });
    await expect(requestCurrentLocation()).rejects.toThrow('denied');
    expect(getLocation).not.toHaveBeenCalled();
  });
  it('opens settings only from an explicit retry action', async () => {
    const openSetting = vi.fn(({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: { 'scope.userLocation': true } }));
    vi.stubGlobal('wx', { openSetting });
    await expect(openLocationSettings()).resolves.toBe(true);
    expect(openSetting).toHaveBeenCalledOnce();
  });
  it('reports unavailable services without turning them into a permission grant', async () => {
    vi.stubGlobal('wx', { getSetting: ({ fail }: { fail: (reason: Error) => void }) => fail(new Error('system disabled')), openSetting: ({ fail }: { fail: (reason: Error) => void }) => fail(new Error('cancelled')) });
    await expect(requestCurrentLocation()).rejects.toThrow('unavailable');
    await expect(openLocationSettings()).resolves.toBe(false);
  });
});

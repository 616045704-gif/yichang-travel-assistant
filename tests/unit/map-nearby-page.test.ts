import { afterEach, describe, expect, it, vi } from 'vitest';

type MapPage = {
  data: Record<string, unknown>;
  setData(value: Record<string, unknown>): void;
  onShow(): void;
  onHide(): void;
  locateNearby(): Promise<void>;
  onOpenSettings(): Promise<void>;
};
const publicPlace = { placeId: 'public-place', name: '公共地点', category: 'scenic', latitude: 30.7, longitude: 111.3, coordinateSystem: 'GCJ-02' };

async function loadPage(wxMock: Record<string, unknown>) {
  let page: MapPage;
  vi.stubGlobal('Page', (value: MapPage) => { page = value; });
  vi.stubGlobal('wx', wxMock);
  await import('../../miniprogram/pages/map/index');
  page!.setData = function (value) { Object.assign(this.data, value); };
  return page!;
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('nearby map page', () => {
  it('loads public markers on entry without asking for a location', async () => {
    const getLocation = vi.fn();
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: { items: [publicPlace] } } }));
    const page = await loadPage({ cloud: { callFunction }, getLocation });
    page.onShow();
    await vi.waitFor(() => expect(page.data.places).toEqual([publicPlace]));
    expect(callFunction).toHaveBeenCalledWith({ name: 'placeService', data: { action: 'markers' } });
    expect(getLocation).not.toHaveBeenCalled();
  });

  it('uses an explicitly requested current location only for the nearby request', async () => {
    const callFunction = vi.fn(async ({ data }: { data: { action: string } }) => ({ result: { code: 'OK', data: { items: data.action === 'nearby' ? [{ ...publicPlace, distanceMeters: 1250 }] : [] } } }));
    const page = await loadPage({ cloud: { callFunction }, getSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: { 'scope.userLocation': true } }), getLocation: ({ success }: { success: (result: { latitude: number; longitude: number }) => void }) => success({ latitude: 30.71, longitude: 111.31 }) });
    await page.locateNearby();
    expect(callFunction).toHaveBeenCalledWith({ name: 'placeService', data: { action: 'nearby', latitude: 30.71, longitude: 111.31 } });
    expect(page.data.nearbyMode).toBe(true);
    expect(page.data.showLocation).toBe(true);
    expect(page.data.notice).toBe('');
  });

  it('keeps the map usable after denial and lets the user explicitly retry from settings', async () => {
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: { items: [] } } }));
    const page = await loadPage({ cloud: { callFunction }, getSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: { 'scope.userLocation': false } }), openSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: { 'scope.userLocation': false } }) });
    await page.locateNearby();
    expect(page.data.notice).toContain('未获得定位权限');
    expect(page.data.showSettings).toBe(true);
    expect(page.data.nearbyMode).toBe(false);
    await page.onOpenSettings();
    expect(callFunction).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'nearby' }) }));
  });

  it('clears the in-memory nearby session when leaving the map', async () => {
    const page = await loadPage({ cloud: { callFunction: vi.fn() } });
    page.onHide();
    expect(page.data.nearbyMode).toBe(false);
    expect(page.data.showLocation).toBe(false);
    expect(page.data.center).toEqual({ latitude: 30.6919, longitude: 111.2865 });
  });
  it('shows a clear message when the public marker request fails', async () => {
    const page = await loadPage({ cloud: { callFunction: vi.fn(async () => ({ result: { code: 'INTERNAL_ERROR', data: null, message: '网络错误' } })) } });
    page.onShow();
    await vi.waitFor(() => expect(page.data.notice).toContain('地图地点暂时无法加载'));
  });
  it('retries nearby only when the user enables location in settings', async () => {
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: { items: [] } } }));
    const page = await loadPage({ cloud: { callFunction }, openSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: { 'scope.userLocation': true } }), getSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: { 'scope.userLocation': true } }), getLocation: ({ success }: { success: (result: { latitude: number; longitude: number }) => void }) => success({ latitude: 30.7, longitude: 111.3 }) });
    await page.onOpenSettings();
    await vi.waitFor(() => expect(callFunction).toHaveBeenCalledWith({ name: 'placeService', data: { action: 'nearby', latitude: 30.7, longitude: 111.3 } }));
  });
});

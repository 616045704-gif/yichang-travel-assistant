import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

type MapPage = {
  data: Record<string, unknown>;
  setData(value: Record<string, unknown>): void;
  onShow(): void;
  onHide(): void;
  locateNearby(): Promise<void>;
  onOpenSettings(): Promise<void>;
  onCategoryChange(event: { detail: { category: string } }): void;
  onMapCategoryTap(event: { currentTarget: { dataset: { category: string } } }): void;
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
  it('keeps the map controls on white safe-area surfaces without changing map bindings', async () => {
    const [markup, css] = await Promise.all([
      readFile('miniprogram/pages/map/index.wxml', 'utf8'),
      readFile('miniprogram/pages/map/index.wxss', 'utf8'),
    ]);
    expect(markup).toContain('<map id="city-map"');
    expect(markup).toContain('bindmarkertap="onMarkerTap"');
    expect(markup).toContain('<cover-view class="map-filters"');
    expect(markup).toContain('<cover-image class="map-filter-icon"');
    expect(markup).toContain('class="map-filter-tab');
    expect(markup).toContain('bindtap="onMapCategoryTap"');
    expect(markup).not.toContain('<category-filter');
    expect(markup).toContain('bindtap="locateNearby"');
    expect(markup).toContain('bindtap="openSelectedPlace"');
    expect(markup).toContain('class="detail-button marker-hit-target"');
    expect(markup).toContain('class="map-bottom-stack"');
    expect(markup).toContain('/assets/provided/place-placeholder.jpg');
    expect(markup).toContain('/assets/provided/category-{{selectedPlace.category}}.png');
    expect(markup).toContain('{{selectedPlace.name}}');
    expect(markup.indexOf('class="map-actions"')).toBeLessThan(markup.indexOf('class="marker-card"'));
    expect(css).toContain('.map-bottom-stack');
    expect(css).toContain('gap: 16rpx');
    expect(css).toMatch(/\.map-filters\s*\{[^}]*pointer-events:\s*auto/);
    expect(css).toMatch(/\.map-filters\s*\{[^}]*left:\s*20rpx[^}]*right:\s*20rpx/);
    expect(css).toMatch(/\.map-filter-track\s*\{[^}]*gap:\s*12rpx[^}]*justify-content:\s*flex-start/);
    expect(css).toMatch(/\.map-filter-tab\s*\{[^}]*width:\s*100rpx[^}]*height:\s*112rpx[^}]*border-radius:\s*24rpx/);
    expect(css).toMatch(/\.map-filter-icon\s*\{[^}]*width:\s*56rpx[^}]*height:\s*56rpx/);
    expect(css).toMatch(/\.marker-card\s*\{[^}]*min-height:\s*280rpx[^}]*border-radius:\s*30rpx[^}]*box-shadow:/);
    expect(css).toMatch(/\.marker-cover\s*\{[^}]*width:\s*224rpx[^}]*height:\s*224rpx/);
    expect(css).toMatch(/\.marker-copy\s*\{[^}]*min-height:\s*224rpx[^}]*justify-content:\s*space-between/);
    expect(css).toMatch(/\.nearby-button, \.settings-button, \.detail-button\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*justify-content:\s*center[^}]*height:\s*72rpx[^}]*line-height:\s*1/);
    expect(css).toMatch(/\.detail-button\s*\{[^}]*width:\s*100%[^}]*align-self:\s*stretch/);
    expect(css).toMatch(/\.marker-name\s*\{[^}]*-webkit-line-clamp:\s*2/);
    expect(css).toMatch(/\.map-actions\s*\{[^}]*align-items:\s*center/);
    expect(css).toContain('bottom: calc(48rpx + env(safe-area-inset-bottom))');
  });

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

  it('reuses cached nearby coordinates for category changes without requesting location again', async () => {
    const callFunction = vi.fn(async ({ data }: { data: { action: string } }) => ({ result: { code: 'OK', data: { items: data.action === 'nearby' ? [publicPlace] : [] } } }));
    const getLocation = vi.fn(({ success }: { success: (result: { latitude: number; longitude: number }) => void }) => success({ latitude: 30.71, longitude: 111.31 }));
    const page = await loadPage({ cloud: { callFunction }, getSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: { 'scope.userLocation': true } }), getLocation });
    await page.locateNearby();
    page.onCategoryChange({ detail: { category: 'scenic' } });
    await vi.waitFor(() => expect(callFunction).toHaveBeenCalledWith({ name: 'placeService', data: { action: 'nearby', latitude: 30.71, longitude: 111.31, category: 'scenic' } }));
    expect(getLocation).toHaveBeenCalledTimes(1);
  });

  it('applies a cover-view category tap through the existing category state contract', async () => {
    const page = await loadPage({ cloud: { callFunction: vi.fn() } });
    page.onMapCategoryTap({ currentTarget: { dataset: { category: 'culture' } } });
    expect(page.data.category).toBe('culture');
    expect(page.data.selectedPlace).toBeNull();
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
  it('shows settings after a first authorization prompt is denied without requesting nearby places', async () => {
    const callFunction = vi.fn();
    const page = await loadPage({ cloud: { callFunction }, getSetting: ({ success }: { success: (result: { authSetting: Record<string, boolean> }) => void }) => success({ authSetting: {} }), authorize: ({ fail }: { fail: (reason: { errMsg: string }) => void }) => fail({ errMsg: 'authorize:fail auth deny' }) });
    await page.locateNearby();
    expect(page.data.showSettings).toBe(true);
    expect(page.data.notice).toContain('未获得定位权限');
    expect(page.data.nearbyMode).toBe(false);
    expect(callFunction).not.toHaveBeenCalled();
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

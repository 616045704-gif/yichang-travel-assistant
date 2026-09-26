import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

type MapPage = { data: Record<string, unknown>; setData(value: Record<string, unknown>): void; onShow(): void; onRegionChange(event: { detail: { value: string } }): void; };
const publicPlaces = [
  { placeId: 'city', name: '城区地点', category: 'scenic', district: '西陵区', latitude: 30.7, longitude: 111.3, coordinateSystem: 'GCJ-02' },
  { placeId: 'zigui', name: '秭归地点', category: 'culture', district: '秭归县', latitude: 30.8, longitude: 111.4, coordinateSystem: 'GCJ-02' },
];

async function loadPage() {
  let page: MapPage;
  vi.stubGlobal('Page', (value: MapPage) => { page = value; });
  vi.stubGlobal('wx', { cloud: { callFunction: vi.fn(async () => ({ result: { code: 'OK', data: { items: publicPlaces } } })) } });
  await import('../../miniprogram/pages/map/index');
  page!.setData = function (value) { Object.assign(this.data, value); };
  return page!;
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('manual region map page', () => {
  it('renders a manual region selector and no location controls', async () => {
    const [markup, app, privacy] = await Promise.all([readFile('miniprogram/pages/map/index.wxml', 'utf8'), readFile('miniprogram/app.json', 'utf8'), readFile('miniprogram/pages/privacy/index.wxml', 'utf8')]);
    expect(markup).toContain('bindchange="onRegionChange"');
    expect(markup).toContain('scale="{{scale}}"');
    expect(markup).toContain('选择区域');
    expect(markup).toContain('show-location="{{false}}"');
    expect(markup).not.toContain('定位我的附近');
    expect(markup).not.toContain('locateNearby');
    expect(app).not.toContain('getLocation');
    expect(app).not.toContain('scope.userLocation');
    expect(privacy).toContain('不会读取、申请或保存你的当前位置');
  });
  it('shows all cloud markers by default, then filters them after a manual region selection', async () => {
    const page = await loadPage();
    page.onShow();
    await vi.waitFor(() => expect(page.data.places).toEqual(publicPlaces));
    expect((page.data.markers as unknown[])).toHaveLength(2);
    page.onRegionChange({ detail: { value: '1' } });
    expect(page.data.region).toBe('城区');
    expect(page.data.places).toEqual([publicPlaces[0]]);
    expect((page.data.markers as unknown[])).toHaveLength(1);
  });
  it('shows a clear empty message for an area without collected places', async () => {
    const page = await loadPage();
    page.onShow();
    await vi.waitFor(() => expect(page.data.allPlaces).toEqual(publicPlaces));
    page.onRegionChange({ detail: { value: '4' } });
    expect(page.data.places).toEqual([]);
    expect(page.data.notice).toBe('该区域暂未收录地点');
  });
});

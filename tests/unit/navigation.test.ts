import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('four-tab application', () => {
  it('has four ordered tabs with complete resources and original icons', async () => {
    const app = JSON.parse(await readFile('miniprogram/app.json', 'utf8'));
    expect(app.tabBar?.list.map((tab: { text: string }) => tab.text)).toEqual(['首页', '发现', '地图', '我的']);
    for (const tab of app.tabBar.list) {
      expect(app.pages).toContain(tab.pagePath);
      for (const ext of ['ts', 'json', 'wxml', 'wxss']) expect((await readFile(`miniprogram/${tab.pagePath}.${ext}`)).length).toBeGreaterThan(0);
      for (const icon of [tab.iconPath, tab.selectedIconPath]) expect((await readFile(`miniprogram/${icon}`)).subarray(1, 4).toString()).toBe('PNG');
    }
  });
  it('home discovery action switches to a registered tab', async () => {
    let page: { openDiscover(): void };
    vi.stubGlobal('Page', (value: typeof page) => { page = value; });
    const switchTab = vi.fn();
    vi.stubGlobal('wx', { switchTab });
    await import('../../miniprogram/pages/home/index');
    page!.openDiscover();
    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/discover/index' });
  });
  it('startup without a cloud environment does not initialize or locate', async () => {
    let app: { globalData: { cloudStatus: string }; onLaunch(): void };
    vi.stubGlobal('App', (value: typeof app) => { app = value; });
    const init = vi.fn();
    vi.stubGlobal('wx', { cloud: { init }, getLocation: vi.fn() });
    await import('../../miniprogram/app');
    app!.onLaunch();
    expect(init).not.toHaveBeenCalled();
    expect(app!.globalData.cloudStatus).toBe('unconfigured');
  });
  it.each(['initialized', 'unavailable', 'error'])('handles configured cloud SDK state %s without user tracking', async state => {
    vi.stubGlobal('__CLOUD_ENV__', 'synthetic-development-env');
    let app: { globalData: { cloudStatus: string }; onLaunch(): void };
    vi.stubGlobal('App', (value: typeof app) => { app = value; });
    const init = vi.fn(() => { if (state === 'error') throw new Error('synthetic error'); });
    const getLocation = vi.fn();
    vi.stubGlobal('wx', { cloud: state === 'unavailable' ? undefined : { init }, getLocation });
    await import('../../miniprogram/app');
    app!.onLaunch();
    expect(app!.globalData.cloudStatus).toBe(state);
    if (state !== 'unavailable') expect(init).toHaveBeenCalledWith({ env: 'synthetic-development-env', traceUser: false });
    expect(getLocation).not.toHaveBeenCalled();
  });
  it.each(['discover', 'map'])('%s changes category without loading user data or location', async name => {
    let page: { data: { category: string; markers?: unknown[] }; setData: ReturnType<typeof vi.fn>; onCategoryChange(event: unknown): void };
    vi.stubGlobal('Page', (value: typeof page) => { page = value; });
    const getLocation = vi.fn();
    const callFunction = vi.fn();
    vi.stubGlobal('wx', { getLocation, cloud: { callFunction } });
    if (name === 'discover') await import('../../miniprogram/pages/discover/index');
    else await import('../../miniprogram/pages/map/index');
    page!.setData = vi.fn();
    page!.onCategoryChange({ detail: { category: 'camping' } });
    expect(page!.setData).toHaveBeenCalledWith(expect.objectContaining({ category: 'camping' }));
    expect(getLocation).not.toHaveBeenCalled();
    expect(callFunction).not.toHaveBeenCalled();
    if (name === 'map') expect(page!.data.markers).toEqual([]);
  });
  it('opens truthful privacy information without login or storage', async () => {
    let page: { showPrivacy(): void };
    vi.stubGlobal('Page', (value: typeof page) => { page = value; });
    const showModal = vi.fn();
    vi.stubGlobal('wx', { showModal });
    await import('../../miniprogram/pages/me/index');
    page!.showPrivacy();
    expect(showModal).toHaveBeenCalledWith(expect.objectContaining({ showCancel: false, content: expect.stringContaining('不读取定位') }));
  });
  it('includes all four async template branches with a retry binding', async () => {
    const template = await readFile('miniprogram/components/async-state/index.wxml', 'utf8');
    for (const state of ['loading', 'empty', 'error', 'ready']) expect(template).toContain(`status === '${state}'`);
    expect(template).toContain('bindtap="onRetry"');
    const map = await readFile('miniprogram/pages/map/index.wxml', 'utf8');
    expect(map).toContain('show-location="{{false}}"');
    expect(map).not.toContain('看看身边的宜昌');
    expect(map).not.toContain('定位我的附近');
    expect(map).not.toContain('page-title');
    expect(map).not.toContain('async-state');
  });
  it('lets category buttons fit their labels instead of the native fixed width', async () => {
    const css = await readFile('miniprogram/components/category-filter/index.wxss', 'utf8');
    expect(css).toMatch(/\.filter\s*\{[^}]*width:\s*auto/);
    expect(css).toContain('flex-wrap: wrap');
    const template = await readFile('miniprogram/components/category-filter/index.wxml', 'utf8');
    expect(template).toContain('size="mini"');
  });
});

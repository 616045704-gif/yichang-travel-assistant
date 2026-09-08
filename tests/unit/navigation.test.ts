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
  it('opens the discover tab with the category selected from a homepage card', async () => {
    let page: { onCategoryTap(event: unknown): void };
    vi.stubGlobal('Page', (value: typeof page) => { page = value; });
    const switchTab = vi.fn();
    const app = { globalData: { pendingDiscoverCategory: '' } };
    vi.stubGlobal('getApp', () => app);
    vi.stubGlobal('wx', { switchTab });
    await import('../../miniprogram/pages/home/index');
    page!.onCategoryTap({ currentTarget: { dataset: { category: 'culture' } } });
    expect(app.globalData.pendingDiscoverCategory).toBe('culture');
    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/discover/index' });
    const template = await readFile('miniprogram/pages/home/index.wxml', 'utf8');
    expect(template).toContain('bindtap="onCategoryTap"');
    expect(template).toContain('data-category="{{item.value}}"');
  });
  it('opens each homepage AI card on its own existing route', async () => {
    let page: { openAiChat(): void; openTripForm(): void };
    vi.stubGlobal('Page', (value: typeof page) => { page = value; });
    const navigateTo = vi.fn();
    vi.stubGlobal('wx', { navigateTo });
    await import('../../miniprogram/pages/home/index');
    page!.openAiChat();
    page!.openTripForm();
    expect(navigateTo).toHaveBeenNthCalledWith(1, { url: '/pages/ai-chat/index' });
    expect(navigateTo).toHaveBeenNthCalledWith(2, { url: '/pages/trip-form/index' });
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
  it.each(['discover', 'map'])('%s changes category without reading location', async name => {
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
    if (name === 'discover') expect(callFunction).toHaveBeenCalledWith(expect.objectContaining({ name: 'placeService' }));
    else expect(callFunction).not.toHaveBeenCalled();
    if (name === 'map') expect(page!.data.markers).toEqual([]);
  });
  it('registers personal routes and gives privacy its own truthful page', async () => {
    const app = JSON.parse(await readFile('miniprogram/app.json', 'utf8'));
    expect(app.pages).toEqual(expect.arrayContaining(['pages/records/index', 'pages/preferences/index', 'pages/privacy/index']));
    expect(app.requiredPrivateInfos).toEqual(expect.arrayContaining(['getLocation']));
    const privacy = await readFile('miniprogram/pages/privacy/index.wxml', 'utf8');
    expect(privacy).toContain('定位我的附近');
    expect(privacy).toContain('位置不会长期保存');
    expect(privacy).toContain('不要求手机号登录');
  });
  it('registers all AI routes and renders the mandatory warning and mock label', async () => {
    const app = JSON.parse(await readFile('miniprogram/app.json', 'utf8'));
    expect(app.pages).toEqual(expect.arrayContaining([
      'pages/ai-chat/index',
      'pages/trip-form/index',
      'pages/ai-history/index',
    ]));
    const chat = await readFile('miniprogram/pages/ai-chat/index.wxml', 'utf8');
    expect(chat).toContain('内容仅供出行参考，请以景区、交通等官方公告为准');
    expect(chat).toContain('模拟回答，仅用于交互测试');
    expect(chat).not.toContain('rich-text');
    const history = await readFile('miniprogram/pages/ai-history/index.wxml', 'utf8');
    expect(history).toContain('data-kind="chat"');
    expect(history).toContain('data-kind="trip"');
    expect(history).toContain("status === 'ready'");
  });
  it('includes all four async template branches with a retry binding', async () => {
    const template = await readFile('miniprogram/components/async-state/index.wxml', 'utf8');
    for (const state of ['loading', 'empty', 'error', 'ready']) expect(template).toContain(`status === '${state}'`);
    expect(template).toContain('bindtap="onRetry"');
    const map = await readFile('miniprogram/pages/map/index.wxml', 'utf8');
    expect(map).toContain('bindmarkertap="onMarkerTap"');
    expect(map).not.toContain('看看身边的宜昌');
    expect(map).toContain('定位我的附近');
    expect(map).not.toContain('page-title');
    expect(map).not.toContain('async-state');
  });
  it('drives async smoke states through the page-owned status binding', async () => {
    const smoke = await readFile('scripts/wechat-smoke.mjs', 'utf8');
    expect(smoke).toContain('await page.setData({ status });');
    expect(smoke).not.toContain('await state.setData({ status });');
    expect(smoke).toContain("state = await page.$('#content-state');");
    expect(smoke).toContain('Boolean(title), status !== \'ready\'');
    expect(smoke).toContain('Boolean(retry), status === \'error\'');
  });
  it('uses current selectors and asserts real secondary-page paths in the WeChat smoke check', async () => {
    const smoke = await readFile('scripts/wechat-smoke.mjs', 'utf8');
    expect(smoke).toContain('async function waitForPagePath');
    expect(smoke).toContain("await page.$$('.ai-quick-card')");
    expect(smoke).toContain("assert.equal(aiPage.path, 'pages/ai-chat/index')");
    expect(smoke).toContain("assert.equal(detailPage.path, 'pages/place-detail/index')");
    expect(smoke).toContain("await filter.$$('.category-tab')");
    expect(smoke).toContain('await categoryTabs[1].tap()');
    expect(smoke).toContain("await mapFilters.$$('.category-tab')");
    expect(smoke).toContain('await mapCategoryTabs[1].tap()');
    expect(smoke).toContain("await page.$('.search-trigger')");
    expect(smoke).toContain("await page.$('.search-input')");
    expect(smoke).toContain("await page.$('.search-close')");
    expect(smoke).toContain("assert.equal(await page.$('.search-input'), null)");
    expect(smoke).toContain("Typing must not start a request");
    expect(smoke).toContain("searchInput.trigger('confirm'");
    expect(smoke).toContain("map.trigger('markertap'");
    expect(smoke).toContain('/assets/provided/map-marker-camping.png');
    expect(smoke).toContain("assert.equal(recordsPage.query.type, 'favorites')");
    expect(smoke).not.toContain("page.$('.hero')");
    expect(smoke).not.toContain("filter.$$('.filter')");
    expect(smoke).not.toContain("mapFilters.$$('.filter')");
  });
  it('uses the approved horizontal category tabs without changing the event binding', async () => {
    const css = await readFile('miniprogram/components/category-filter/index.wxss', 'utf8');
    expect(css).toMatch(/\.category-tab\s*\{[^}]*height:\s*112rpx/);
    expect(css).toContain('flex: 0 0 auto');
    const template = await readFile('miniprogram/components/category-filter/index.wxml', 'utf8');
    expect(template).toContain('<scroll-view');
    expect(template).toContain('bindtap="onTabTap"');
  });
});

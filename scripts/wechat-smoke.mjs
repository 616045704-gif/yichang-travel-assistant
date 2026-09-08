import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import automator from 'miniprogram-automator';

async function waitForPagePath(miniProgram, expectedPath, timeout = 6000) {
  const deadline = Date.now() + timeout;
  let currentPage;
  while (Date.now() < deadline) {
    currentPage = await miniProgram.currentPage();
    if (currentPage?.path === expectedPath) return currentPage;
    await wait(100);
  }
  assert.equal(currentPage?.path, expectedPath);
  return currentPage;
}

// The user starts the official CLI for this project before running this check.
const endpoint = process.env.WECHAT_AUTOMATION_ENDPOINT;
if (!endpoint || !/^ws:\/\/127\.0\.0\.1:\d{1,5}$/.test(endpoint)) {
  console.error('BLOCKED: set WECHAT_AUTOMATION_ENDPOINT to the local port opened for this project.');
  process.exitCode = 2;
} else {
  let miniProgram;
  let state;
  let mapPage;
  let verifiedProject = false;
  try {
    const local = JSON.parse(await readFile('config/local.json', 'utf8'));
    miniProgram = await automator.connect({ wsEndpoint: endpoint });
    const actualAppId = await miniProgram.evaluate(() => wx.getAccountInfoSync().miniProgram.appId);
    assert.equal(actualAppId, local.appid, 'Automation must target the configured AppID');
    verifiedProject = true;
    await mkdir('.local', { recursive: true });
    const info = await miniProgram.systemInfo();
    console.log(`WeChat simulator SDK: ${info.SDKVersion}`);
    for (const name of ['home', 'discover', 'map', 'me']) {
      const page = await miniProgram.switchTab(`/pages/${name}/index`);
      await page.waitFor('.page');
      assert.equal(page.path, `pages/${name}/index`);
      if (name === 'home') {
        assert.ok(await page.$('.home-hero'));
        const aiCards = await page.$$('.ai-quick-card');
        assert.equal(aiCards.length, 2);
        const icons = await page.$$('.category-icon');
        assert.equal(icons.length, 4);
        const viewport = await page.size();
        for (const icon of icons) {
          const offset = await icon.offset();
          const size = await icon.size();
          assert.ok(offset.left >= 0 && offset.left + size.width <= viewport.width, 'Category icons must fit the viewport');
        }
      }
      await miniProgram.screenshot({ path: path.resolve('.local', `wechat-${name}.png`) });
      console.log(`PASS: ${name}`);
    }
    let page = await miniProgram.switchTab('/pages/home/index');
    const aiCards = await page.$$('.ai-quick-card');
    await aiCards[0].tap();
    const aiPage = await waitForPagePath(miniProgram, 'pages/ai-chat/index');
    assert.equal(aiPage.path, 'pages/ai-chat/index');
    console.log('PASS: Home AI card opens its secondary page');
    page = await miniProgram.switchTab('/pages/home/index');
    await page.setData({
      featuredStatus: 'ready',
      featured: [{ placeId: 'smoke-place', name: '自动化测试地点', category: 'scenic', district: '西陵区', intro: '', tags: [], coverUrl: '', isFavorite: false }],
    });
    const placeCard = await page.$('place-card');
    assert.ok(placeCard);
    const openArea = await placeCard.$('.open-area');
    assert.ok(openArea);
    await openArea.tap();
    const detailPage = await waitForPagePath(miniProgram, 'pages/place-detail/index');
    assert.equal(detailPage.path, 'pages/place-detail/index');
    console.log('PASS: Home place card opens its detail page');
    page = await miniProgram.switchTab('/pages/me/index');
    const menuRows = await page.$$('.menu-row');
    assert.ok(menuRows.length >= 1);
    assert.equal(await (await menuRows[0].$('.menu-title')).text(), '我的收藏');
    await menuRows[0].tap();
    const recordsPage = await waitForPagePath(miniProgram, 'pages/records/index');
    assert.equal(recordsPage.path, 'pages/records/index');
    assert.equal(recordsPage.query.type, 'favorites');
    console.log('PASS: Me menu opens its secondary page');
    const pageScreens = [
      ['place-detail', '/pages/place-detail/index?placeId=smoke-place'],
      ['records-favorites', '/pages/records/index?type=favorites'],
      ['records-browse', '/pages/records/index?type=browse'],
      ['preferences', '/pages/preferences/index'],
      ['privacy', '/pages/privacy/index'],
      ['ai-chat', '/pages/ai-chat/index'],
      ['ai-history', '/pages/ai-history/index'],
      ['trip-form', '/pages/trip-form/index'],
    ];
    for (const [name, route] of pageScreens) {
      const page = await miniProgram.reLaunch(route);
      assert.ok(page, `Expected ${name} page to open`);
      await page.waitFor('.page');
      await miniProgram.screenshot({ path: path.resolve('.local', `wechat-${name}.png`) });
      console.log(`PASS: ${name}`);
    }
    page = await miniProgram.switchTab('/pages/discover/index');
    await page.waitFor('#categories');
    const filter = await page.$('#categories');
    assert.ok(filter);
    const categoryTabs = await filter.$$('.category-tab');
    assert.equal(categoryTabs.length, 5);
    const searchTrigger = await page.$('.search-trigger');
    assert.ok(searchTrigger);
    assert.equal(await page.$('.search-input'), null);
    await searchTrigger.tap();
    const searchInput = await page.$('.search-input');
    const searchSend = await page.$('.search-send');
    assert.ok(searchInput);
    assert.ok(searchSend);
    await searchInput.input('三峡');
    assert.equal(await page.data('keyword'), '三峡');
    await searchSend.tap();
    await filter.callMethod('onTabTap', { currentTarget: { dataset: { category: 'scenic' } } });
    await page.waitFor(400);
    assert.equal(await page.data('category'), 'scenic');
    state = await page.$('#content-state');
    assert.ok(state);
    for (const status of ['loading', 'error', 'empty', 'ready']) {
      await page.setData({ status });
      await page.waitFor(100);
      state = await page.$('#content-state');
      const title = await state.$('.state-title');
      assert.equal(Boolean(title), status !== 'ready', `${status} title visibility must match its branch`);
      if (title) assert.ok(await title.text());
      const retry = await state.$('.retry');
      assert.equal(Boolean(retry), status === 'error', `${status} retry visibility must match its branch`);
      if (retry) await retry.tap();
      await miniProgram.screenshot({ path: path.resolve('.local', `wechat-discover-${status}.png`) });
      console.log(`PASS: ${status}`);
    }
    console.log('PASS: category layout and selection');
    mapPage = await miniProgram.switchTab('/pages/map/index');
    await mapPage.waitFor('#city-map');
    const map = await mapPage.$('#city-map');
    const mapSize = await map.size();
    const pageSize = await mapPage.size();
    assert.ok(Math.abs(Number(mapSize.height) - Number(pageSize.height)) <= 1, 'Map must fit the content viewport without overflowing');
    assert.equal(Number(mapSize.width), Number(pageSize.width));
    assert.deepEqual(await map.offset(), { left: 0, top: 0 });
    assert.equal(await mapPage.$('.location-card'), null);
    const overlay = await mapPage.$('.map-filters');
    assert.equal(await overlay.style('background-color'), 'rgba(0, 0, 0, 0)');
    assert.equal(await overlay.style('box-shadow'), 'none');
    assert.equal(await overlay.style('pointer-events'), 'auto');
    const mapFilters = await mapPage.$('#categories');
    const mapCategoryTabs = await mapFilters.$$('.category-tab');
    assert.equal(mapCategoryTabs.length, 5);
    const center = await mapPage.data('center');
    // Explicitly synthetic public-coordinate fixtures; never persisted or captured as real data.
    await mapPage.callMethod('setPlaces', [
      { placeId: 'e2e-scenic', name: '自动化测试点（景区）', category: 'scenic', latitude: 30.7, longitude: 111.3, coordinateSystem: 'GCJ-02' },
      { placeId: 'e2e-restaurant', name: '自动化测试点（餐馆）', category: 'restaurant', latitude: 30.71, longitude: 111.31, coordinateSystem: 'GCJ-02' },
    ]);
    assert.equal((await mapPage.data('markers')).length, 2);
    await mapFilters.callMethod('onTabTap', { currentTarget: { dataset: { category: 'scenic' } } });
    await mapPage.waitFor(400);
    assert.equal(await mapPage.data('category'), 'scenic');
    assert.equal((await mapPage.data('markers')).length, 1);
    // Element.property stringifies object arrays; query the actual component properties instead.
    const nativeMarkers = await miniProgram.evaluate(() => new Promise(resolve => {
      wx.createSelectorQuery().select('#city-map').fields({ properties: ['markers'] }, resolve).exec();
    }));
    assert.deepEqual(nativeMarkers.markers, await mapPage.data('markers'));
    await mapFilters.callMethod('onTabTap', { currentTarget: { dataset: { category: '' } } });
    await mapPage.waitFor(400);
    assert.equal((await mapPage.data('markers')).length, 2);
    assert.deepEqual(await mapPage.data('center'), center);
    console.log('PASS: full map viewport and category marker updates');
  } catch (error) {
    console.error(`WeChat smoke check failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (mapPage) await mapPage.callMethod('setPlaces', []).catch(() => {});
    if (state) await state.setData({ status: 'empty' }).catch(() => {});
    if (miniProgram) {
      if (verifiedProject) await miniProgram.switchTab('/pages/home/index').catch(() => {});
      miniProgram.disconnect();
    }
  }
}

import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import automator from 'miniprogram-automator';

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
        const hero = await page.$('.hero-art');
        assert.ok(hero);
        const art = await miniProgram.callWxMethod('getImageInfo', { src: '/assets/illustrations/yichang-ink.jpg' });
        assert.ok(art.width > 0 && art.height > 0, 'Original landscape asset must load');
        assert.equal(await (await page.$('.hero-title')).text(), '宜昌');
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
    const page = await miniProgram.switchTab('/pages/discover/index');
    await page.waitFor('#categories');
    const filter = await page.$('#categories');
    assert.ok(filter);
    const buttons = await filter.$$('.filter');
    assert.equal(buttons.length, 5);
    const first = await buttons[0].offset();
    const second = await buttons[1].offset();
    assert.equal(Math.round(first.top), Math.round(second.top), 'Categories should share a row');
    await buttons[1].tap();
    await page.waitFor(400);
    assert.equal(await page.data('category'), 'scenic');
    state = await page.$('#content-state');
    assert.ok(state);
    for (const status of ['loading', 'error', 'empty', 'ready']) {
      await state.setData({ status });
      await page.waitFor(100);
      const title = await state.$('.state-title');
      if (status === 'ready') assert.equal(title, null);
      else assert.ok(await title.text());
      const retry = await state.$('.retry');
      if (status === 'error') { assert.ok(retry); await retry.tap(); }
      else assert.equal(retry, null);
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
    assert.equal(await overlay.style('pointer-events'), 'none');
    const mapFilters = await mapPage.$('#categories');
    const mapButtons = await mapFilters.$$('.filter');
    assert.equal(await mapButtons[0].style('pointer-events'), 'auto');
    const center = await mapPage.data('center');
    // Explicitly synthetic public-coordinate fixtures; never persisted or captured as real data.
    await mapPage.callMethod('setPlaces', [
      { placeId: 'e2e-scenic', name: '自动化测试点（景区）', category: 'scenic', latitude: 30.7, longitude: 111.3, coordinateSystem: 'GCJ-02' },
      { placeId: 'e2e-restaurant', name: '自动化测试点（餐馆）', category: 'restaurant', latitude: 30.71, longitude: 111.31, coordinateSystem: 'GCJ-02' },
    ]);
    assert.equal((await mapPage.data('markers')).length, 2);
    await mapButtons[1].tap();
    await mapPage.waitFor(400);
    assert.equal(await mapPage.data('category'), 'scenic');
    assert.equal((await mapPage.data('markers')).length, 1);
    // Element.property stringifies object arrays; query the actual component properties instead.
    const nativeMarkers = await miniProgram.evaluate(() => new Promise(resolve => {
      wx.createSelectorQuery().select('#city-map').fields({ properties: ['markers'] }, resolve).exec();
    }));
    assert.deepEqual(nativeMarkers.markers, await mapPage.data('markers'));
    await mapButtons[0].tap();
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

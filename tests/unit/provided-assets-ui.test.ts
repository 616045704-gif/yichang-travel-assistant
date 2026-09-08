import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = 'miniprogram/assets/provided';
const assets = [
  ['home-hero.jpg', 0, 0, 300_000], ['discover-hero.jpg', 0, 0, 180_000],
  ['ai-chat.png', 512, 512, 180_000], ['trip-plan.png', 512, 512, 180_000],
  ['category-all.png', 128, 128, 30_000], ['category-scenic.png', 128, 128, 30_000], ['category-restaurant.png', 128, 128, 30_000],
  ['category-culture.png', 128, 128, 30_000], ['category-camping.png', 128, 128, 30_000],
  ['tab-home.png', 81, 81, 20_000], ['tab-home-active.png', 81, 81, 20_000], ['tab-discover.png', 81, 81, 20_000], ['tab-discover-active.png', 81, 81, 20_000],
  ['tab-map.png', 81, 81, 20_000], ['tab-map-active.png', 81, 81, 20_000], ['tab-me.png', 81, 81, 20_000], ['tab-me-active.png', 81, 81, 20_000],
  ['favorite.png', 128, 128, 20_000], ['favorite-active.png', 128, 128, 20_000],
  ['menu-favorite.png', 96, 96, 30_000], ['menu-history.png', 96, 96, 30_000], ['menu-ai.png', 96, 96, 30_000], ['menu-preferences.png', 96, 96, 30_000],
  ['map-marker.png', 72, 88, 20_000],
] as const;

function pngDimension(bytes: Buffer, offset: number) { return bytes.readUInt32BE(offset); }
function jpegDimensions(bytes: Buffer) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Invalid JPEG');
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG size marker not found');
}

describe('provided visual assets and UI boundary', () => {
  it('ships optimized derivatives within the agreed visual budget', async () => {
    let total = 0;
    let heroTotal = 0;
    let iconTotal = 0;
    for (const [file, width, height, maxBytes] of assets) {
      const path = `${root}/${file}`;
      const [bytes, info] = await Promise.all([readFile(path), stat(path)]);
      total += info.size;
      if (file.endsWith('-hero.jpg')) heroTotal += info.size;
      else iconTotal += info.size;
      expect(info.size).toBeLessThanOrEqual(maxBytes);
      if (width) {
        expect(bytes.subarray(1, 4).toString()).toBe('PNG');
        expect(pngDimension(bytes, 16)).toBe(width);
        expect(pngDimension(bytes, 20)).toBe(height);
      }
    }
    const placeholderPath = `${root}/place-placeholder.jpg`;
    const [placeholder, placeholderInfo] = await Promise.all([readFile(placeholderPath), stat(placeholderPath)]);
    expect(placeholderInfo.size).toBeLessThanOrEqual(80_000);
    expect(jpegDimensions(placeholder)).toEqual({ width: 480, height: 360 });
    expect(total + placeholderInfo.size).toBeLessThanOrEqual(1_000_000);
    expect(heroTotal).toBeLessThanOrEqual(450_000);
    expect(iconTotal + placeholderInfo.size).toBeLessThanOrEqual(610_000);
  });

  it('keeps routes, bindings and supported category values while replacing only presentation', async () => {
    const [app, home, map, me] = await Promise.all([
      readFile('miniprogram/app.json', 'utf8'),
      readFile('miniprogram/pages/home/index.wxml', 'utf8'),
      readFile('miniprogram/pages/map/index.wxml', 'utf8'),
      readFile('miniprogram/pages/me/index.ts', 'utf8'),
    ]);
    const config = JSON.parse(app);
    expect(config.tabBar.list.map((item: { pagePath: string }) => item.pagePath)).toEqual([
      'pages/home/index', 'pages/discover/index', 'pages/map/index', 'pages/me/index',
    ]);
    expect(config.tabBar.list.map((item: { iconPath: string; selectedIconPath: string }) => [item.iconPath, item.selectedIconPath])).toEqual([
      ['assets/provided/tab-home.png', 'assets/provided/tab-home-active.png'],
      ['assets/provided/tab-discover.png', 'assets/provided/tab-discover-active.png'],
      ['assets/provided/tab-map.png', 'assets/provided/tab-map-active.png'],
      ['assets/provided/tab-me.png', 'assets/provided/tab-me-active.png'],
    ]);
    expect(home).toContain('bindtap="openAiChat"');
    expect(home).toContain('bindtap="openTripForm"');
    expect(map).toContain('bindtap="locateNearby"');
    expect(me).not.toContain('意见反馈');
    expect(me).not.toContain('parking');
  });

  it('places the supplied Home Hero before one paired set of existing AI actions', async () => {
    const home = await readFile('miniprogram/pages/home/index.wxml', 'utf8');
    expect(home).toContain('class="home-hero"');
    expect(home).toContain('/assets/provided/home-hero.jpg');
    expect(home).toContain('class="ai-quick-grid"');
    expect(home).not.toContain('class="home-intro"');
    expect(home).not.toContain('class="ai-entry-list"');
    expect((home.match(/bindtap="openAiChat"/g) ?? []).length).toBe(1);
    expect((home.match(/bindtap="openTripForm"/g) ?? []).length).toBe(1);
    expect(home).toContain('/assets/provided/ai-chat.png');
    expect(home).toContain('/assets/provided/trip-plan.png');
    for (const retiredCopy of ['旅行助手', '从哪里开始', '从灵感到行程', '四类地点', '值得停留', '精选地点', '内容仅供出行参考，请以景区、交通等官方公告为准']) {
      expect(home).not.toContain(retiredCopy);
    }
  });
});

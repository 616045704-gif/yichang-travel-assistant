import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = 'miniprogram/assets/provided';
const assets = [
  ['home-hero.jpg', 0, 300_000], ['discover-hero.jpg', 0, 150_000],
  ['ai-chat.png', 120, 60_000], ['trip-plan.png', 120, 60_000],
  ['category-all.png', 96, 30_000], ['category-scenic.png', 96, 30_000], ['category-restaurant.png', 96, 30_000],
  ['category-culture.png', 96, 30_000], ['category-camping.png', 96, 30_000],
  ['tab-home.png', 81, 20_000], ['tab-home-active.png', 81, 20_000], ['tab-discover.png', 81, 20_000], ['tab-discover-active.png', 81, 20_000],
  ['tab-map.png', 81, 20_000], ['tab-map-active.png', 81, 20_000], ['tab-me.png', 81, 20_000], ['tab-me-active.png', 81, 20_000],
  ['favorite.png', 64, 20_000], ['favorite-active.png', 64, 20_000],
  ['menu-favorite.png', 96, 30_000], ['menu-history.png', 96, 30_000], ['menu-ai.png', 96, 30_000], ['menu-preferences.png', 96, 30_000],
] as const;

function pngDimension(bytes: Buffer, offset: number) { return bytes.readUInt32BE(offset); }

describe('provided visual assets and UI boundary', () => {
  it('ships optimized derivatives within the agreed visual budget', async () => {
    let total = 0;
    for (const [file, width, maxBytes] of assets) {
      const path = `${root}/${file}`;
      const [bytes, info] = await Promise.all([readFile(path), stat(path)]);
      total += info.size;
      expect(info.size).toBeLessThanOrEqual(maxBytes);
      if (width) {
        expect(bytes.subarray(1, 4).toString()).toBe('PNG');
        expect(pngDimension(bytes, 16)).toBe(width);
        expect(pngDimension(bytes, 20)).toBe(width);
      }
    }
    expect(total).toBeLessThanOrEqual(700_000);
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
});

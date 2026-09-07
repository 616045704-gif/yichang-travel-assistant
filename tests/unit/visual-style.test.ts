import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('travel visual presentation', () => {
  it('ships the modern purple yellow theme consistently with native navigation and original assets', async () => {
    const tokens = await readFile('miniprogram/styles/tokens.wxss', 'utf8');
    const app = JSON.parse(await readFile('miniprogram/app.json', 'utf8'));
    expect(tokens).toContain('--color-brand: #623bc7');
    expect(tokens).toContain('--color-brand-deep: #2b174d');
    expect(tokens).toContain('--color-action: #ffc400');
    expect(tokens).toContain('--color-page: #f8f6ff');
    expect(tokens).toContain('--font-sans: -apple-system');
    expect(tokens).not.toContain('--font-display:');
    expect(app.window.navigationBarBackgroundColor.toLowerCase()).toBe('#2b174d');
    expect(app.window.navigationBarTextStyle).toBe('white');
    expect(app.tabBar.backgroundColor.toLowerCase()).toBe('#2b174d');
    expect(app.tabBar.selectedColor.toLowerCase()).toBe('#ffc400');
    expect(app.tabBar.list.map((tab: { pagePath: string }) => tab.pagePath)).toEqual([
      'pages/home/index', 'pages/discover/index', 'pages/map/index', 'pages/me/index',
    ]);
    for (const category of ['scenic', 'restaurant', 'culture', 'camping']) {
      expect((await readFile(`miniprogram/assets/icons/category-${category}.png`)).subarray(1, 4).toString()).toBe('PNG');
    }
  });

  it('uses original rounded purple yellow icons for tabs, categories, and map markers', async () => {
    for (const name of ['home', 'discover', 'map', 'me']) {
      const idle = await readFile(`miniprogram/assets/icons/${name}.svg`, 'utf8');
      const active = await readFile(`miniprogram/assets/icons/${name}-active.svg`, 'utf8');
      expect(idle).toContain('#cfc2ff');
      expect(active).toContain('#ffc400');
      expect((await readFile(`miniprogram/assets/icons/${name}.png`)).subarray(1, 4).toString()).toBe('PNG');
      expect((await readFile(`miniprogram/assets/icons/${name}-active.png`)).subarray(1, 4).toString()).toBe('PNG');
    }
    for (const name of ['scenic', 'restaurant', 'culture', 'camping', 'location']) {
      const filename = name === 'location' ? name : `category-${name}`;
      const svg = await readFile(`miniprogram/assets/icons/${filename}.svg`, 'utf8');
      expect(svg).toContain('viewBox="0 0 64 64"');
      expect(svg).toContain('#ffc400');
    }
    const scenic = await readFile('miniprogram/assets/icons/category-scenic.png');
    expect(scenic.readUInt32BE(16)).toBe(96);
    expect(scenic.readUInt32BE(20)).toBe(96);
  });
  it('renders separate AI chat and trip entry cards with the disclaimer in the themed home', async () => {
    const home = await readFile('miniprogram/pages/home/index.wxml', 'utf8');
    const homeStyle = await readFile('miniprogram/pages/home/index.wxss', 'utf8');
    const chat = await readFile('miniprogram/pages/ai-chat/index.wxml', 'utf8');
    expect(home).not.toContain('yichang-ink.jpg');
    expect(home).not.toContain('把日子放慢');
    expect(homeStyle).toContain('.hero-orbit');
    expect(homeStyle).toContain('linear-gradient');
    expect(homeStyle).not.toContain('STKaiti');
    expect(home).toContain('自由问答');
    expect(home).toContain('行程定制');
    expect(home).toContain('bindtap="openAiChat"');
    expect(home).toContain('bindtap="openTripForm"');
    expect(homeStyle).toContain('.ai-entry-grid');
    expect(homeStyle).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(chat).not.toContain('我要定制行程');
    expect(chat).not.toContain('bindtap="openTripForm"');
    expect(home).toContain('内容仅供出行参考，请以景区、交通等官方公告为准');
    expect(home).toContain('featuredStatus');
    expect(home).toContain('place-card');
    expect(home).toContain('bind:open="openPlace"');
    expect(home).toContain('bindtap="openDiscover"');
    for (const feature of ['景点预约', '住宿预订', '活动日历']) expect(home).not.toContain(feature);
  });
  it('keeps the map visible and interactive between floating filter buttons', async () => {
    const css = await readFile('miniprogram/pages/map/index.wxss', 'utf8');
    const overlay = css.match(/\.map-filters\s*\{([^}]+)\}/)![1];
    expect(overlay).toContain('background: transparent');
    expect(overlay).toContain('box-shadow: none');
    expect(overlay).toContain('border: 0');
    expect(overlay).toContain('pointer-events: none');
    const buttons = await readFile('miniprogram/components/category-filter/index.wxss', 'utf8');
    expect(buttons).toMatch(/\.filter\s*\{[^}]*pointer-events:\s*auto/);
  });
  it('uses visible compact search and favorite controls for place browsing', async () => {
    const discover = await readFile('miniprogram/pages/discover/index.wxml', 'utf8');
    const discoverStyle = await readFile('miniprogram/pages/discover/index.wxss', 'utf8');
    const card = await readFile('miniprogram/components/place-card/index.wxml', 'utf8');
    const cardStyle = await readFile('miniprogram/components/place-card/index.wxss', 'utf8');
    const detail = await readFile('miniprogram/pages/place-detail/index.wxml', 'utf8');
    const detailStyle = await readFile('miniprogram/pages/place-detail/index.wxss', 'utf8');
    expect(discover).toContain('确认搜索');
    expect(discover).toContain('search-glyph');
    expect(discoverStyle).toContain('.search-icon');
    expect(card).toContain('favorite-icon');
    expect(cardStyle).toContain('.favorite-bar');
    expect(cardStyle).toContain('.favorite-icon::after');
    expect(detail).toContain('favorite-icon');
    expect(detailStyle).toContain('width: 136rpx');
  });

  it('uses the shared purple yellow surface on discovery, map, and place details', async () => {
    for (const page of ['discover', 'map', 'place-detail']) {
      const style = await readFile(`miniprogram/pages/${page}/index.wxss`, 'utf8');
      expect(style).toMatch(/var\(--color-brand(?:-deep)?\)/);
      expect(style).not.toContain('#a44d3e');
    }
  });

  it('keeps private travel, AI, and planning screens in the modern visual system', async () => {
    for (const page of ['me', 'records', 'preferences', 'privacy', 'ai-chat', 'ai-history', 'trip-form']) {
      const markup = await readFile(`miniprogram/pages/${page}/index.wxml`, 'utf8');
      const style = await readFile(`miniprogram/pages/${page}/index.wxss`, 'utf8');
      expect(markup).not.toContain('chapter-seal');
      expect(style).not.toContain('var(--font-display)');
      expect(style).toMatch(/var\(--color-(?:brand|surface|action|page)/);
    }
  });
});

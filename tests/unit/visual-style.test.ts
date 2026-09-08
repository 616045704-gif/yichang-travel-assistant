import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

function hasRgbaPixel(png: Buffer, red: number, green: number, blue: number) {
  const chunks: Buffer[] = [];
  let offset = 8;
  while (offset < png.length) {
    const size = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString();
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const rows = inflateSync(Buffer.concat(chunks));
  for (let index = 0; index < rows.length; index += 4) {
    if (rows[index] !== 0 && rows[index] === red && rows[index + 1] === green && rows[index + 2] === blue) return true;
  }
  return false;
}

describe('travel visual presentation', () => {
  it('ships the white editorial travel theme consistently with native navigation and original assets', async () => {
    const tokens = await readFile('miniprogram/styles/tokens.wxss', 'utf8');
    const app = JSON.parse(await readFile('miniprogram/app.json', 'utf8'));
    expect(tokens).toContain('--color-brand: #7454d8');
    expect(tokens).toContain('--color-brand-deep: #29243a');
    expect(tokens).toContain('--color-page: #f8f7fb');
    expect(tokens).toContain('--color-surface: #ffffff');
    expect(tokens).toContain('--font-sans: -apple-system');
    expect(tokens).not.toContain('--font-display:');
    expect(app.window.navigationBarBackgroundColor.toLowerCase()).toBe('#ffffff');
    expect(app.window.navigationBarTextStyle).toBe('black');
    expect(app.tabBar.backgroundColor.toLowerCase()).toBe('#ffffff');
    expect(app.tabBar.selectedColor.toLowerCase()).toBe('#7454d8');
    expect(app.tabBar.list.map((tab: { pagePath: string }) => tab.pagePath)).toEqual([
      'pages/home/index', 'pages/discover/index', 'pages/map/index', 'pages/me/index',
    ]);
    expect(app.tabBar.list.map((tab: { iconPath: string }) => tab.iconPath)).toEqual([
      'assets/provided/tab-home.png', 'assets/provided/tab-discover.png', 'assets/provided/tab-map.png', 'assets/provided/tab-me.png',
    ]);
    for (const category of ['scenic', 'restaurant', 'culture', 'camping']) {
      expect((await readFile(`miniprogram/assets/provided/category-${category}.png`)).subarray(1, 4).toString()).toBe('PNG');
    }
  });

  it('uses original refined purple accent icons for tabs, categories, and map markers', async () => {
    for (const name of ['home', 'discover', 'map', 'me']) {
      const idle = await readFile(`miniprogram/assets/icons/${name}.svg`, 'utf8');
      const active = await readFile(`miniprogram/assets/icons/${name}-active.svg`, 'utf8');
      expect(idle).toContain('#9b93a6');
      expect(active).toContain('#7454d8');
      expect((await readFile(`miniprogram/assets/icons/${name}.png`)).subarray(1, 4).toString()).toBe('PNG');
      const activePng = await readFile(`miniprogram/assets/icons/${name}-active.png`);
      expect(activePng.subarray(1, 4).toString()).toBe('PNG');
      expect(hasRgbaPixel(activePng, 116, 84, 216)).toBe(true);
    }
    for (const name of ['scenic', 'restaurant', 'culture', 'camping']) {
      const filename = `category-${name}`;
      const svg = await readFile(`miniprogram/assets/icons/${filename}.svg`, 'utf8');
      expect(svg).toContain('viewBox="0 0 64 64"');
      expect(svg).toContain('#7454d8');
    }
    const locationSvg = await readFile('miniprogram/assets/icons/location.svg', 'utf8');
    const locationPng = await readFile('miniprogram/assets/icons/location.png');
    expect(locationSvg).toContain('viewBox="0 0 60 76"');
    expect(locationPng.readUInt32BE(16)).toBe(60);
    expect(locationPng.readUInt32BE(20)).toBe(76);
    const scenic = await readFile('miniprogram/assets/icons/category-scenic.png');
    expect(scenic.readUInt32BE(16)).toBe(96);
    expect(scenic.readUInt32BE(20)).toBe(96);
  });
  it('renders the provided Home Hero with clean paired AI actions', async () => {
    const home = await readFile('miniprogram/pages/home/index.wxml', 'utf8');
    const homeStyle = await readFile('miniprogram/pages/home/index.wxss', 'utf8');
    const chat = await readFile('miniprogram/pages/ai-chat/index.wxml', 'utf8');
    expect(home).not.toContain('yichang-ink.jpg');
    expect(home).not.toContain('把日子放慢');
    expect(homeStyle).toContain('.home-hero');
    expect(homeStyle).toContain('.featured-list');
    expect(homeStyle).not.toContain('.hero-orbit');
    expect(homeStyle).not.toContain('STKaiti');
    expect(home).toContain('自由问答');
    expect(home).toContain('行程定制');
    expect(home).toContain('bindtap="openAiChat"');
    expect(home).toContain('bindtap="openTripForm"');
    expect(home).toContain('/assets/provided/home-hero.jpg');
    expect(home).toContain('home-hero-image');
    expect(homeStyle).toContain('.ai-quick-grid');
    expect(homeStyle).not.toContain('.home-intro');
    expect(homeStyle).not.toContain('.ai-entry-list');
    expect(homeStyle).not.toContain('background: var(--color-brand-deep)');
    expect(chat).not.toContain('我要定制行程');
    expect(chat).not.toContain('bindtap="openTripForm"');
    expect(home).not.toContain('旅行助手');
    expect(home).not.toContain('从哪里开始');
    expect(home).not.toContain('从灵感到行程');
    expect(home).not.toContain('四类地点');
    expect(home).not.toContain('值得停留');
    expect(home).not.toContain('精选地点');
    expect(home).not.toContain('内容仅供出行参考，请以景区、交通等官方公告为准');
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
    expect(discover).toContain('/assets/provided/discover-hero.jpg');
    expect(discover).toContain('discover-hero-copy');
    expect(discover).toContain('search-glyph');
    expect(discoverStyle).toContain('.search-icon');
    expect(card).toContain('cover-favorite');
    expect(card).toContain('/assets/provided/favorite-active.png');
    expect(cardStyle).toContain('.cover-wrap');
    expect(card).toContain('category-pill');
    expect(card).not.toContain('class="district"');
    expect(card).not.toContain('class="intro"');
    expect(card).not.toContain('class="tags"');
    expect(cardStyle).toContain('height: 336rpx');
    expect(cardStyle).toContain('.cover-favorite');
    expect(detail).toContain('detail-favorite-image');
    expect(detail).toContain('/assets/provided/favorite-active.png');
    expect(detailStyle).toContain('width: 64rpx');
  });

  it('uses the shared white editorial surface on discovery, map, and place details', async () => {
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

  it('uses the shared feedback component instead of platform-specific toast styling', async () => {
    for (const page of ['home', 'discover', 'place-detail', 'records', 'preferences']) {
      const markup = await readFile(`miniprogram/pages/${page}/index.wxml`, 'utf8');
      const logic = await readFile(`miniprogram/pages/${page}/index.ts`, 'utf8');
      expect(markup).toContain('<feedback-toast');
      expect(logic).not.toContain('wx.showToast');
      expect(logic).toContain('onFeedbackDismiss');
    }
  });
});

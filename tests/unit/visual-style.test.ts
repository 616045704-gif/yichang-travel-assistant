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
    for (const name of ['scenic', 'restaurant', 'culture', 'camping']) {
      const locationPng = await readFile(`miniprogram/assets/provided/map-marker-${name}.png`);
      expect(locationPng.readUInt32BE(16)).toBe(88);
      expect(locationPng.readUInt32BE(20)).toBe(108);
    }
    const scenic = await readFile('miniprogram/assets/provided/category-scenic.png');
    expect(scenic.readUInt32BE(16)).toBe(128);
    expect(scenic.readUInt32BE(20)).toBe(128);
  });
  it('uses a full-width category rail and a refined two-line map preview', async () => {
    const [markup, css] = await Promise.all([
      readFile('miniprogram/pages/map/index.wxml', 'utf8'),
      readFile('miniprogram/pages/map/index.wxss', 'utf8'),
    ]);
    expect(markup).toContain('/assets/provided/category-{{selectedPlace.category}}.png');
    expect(markup).toContain('hover-class="detail-button-pressed"');
    expect(css).toMatch(/\.map-filters\s*\{[^}]*left:\s*20rpx[^}]*right:\s*20rpx/);
    expect(css).toMatch(/\.marker-card\s*\{[^}]*border-radius:\s*30rpx[^}]*box-shadow:/);
    expect(css).toMatch(/\.marker-name\s*\{[^}]*display:\s*-webkit-box[^}]*-webkit-line-clamp:\s*2/);
    expect(css).toMatch(/\.map-actions\s*\{[^}]*align-items:\s*center/);
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
    expect(home).toContain('>出发吧</button>');
    expect(home).not.toContain('浏览所有地点');
    expect(home).toContain('category-heading-title">分类');
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
  it('keeps the map visible and the horizontal category tabs interactive', async () => {
    const css = await readFile('miniprogram/pages/map/index.wxss', 'utf8');
    const overlay = css.match(/\.map-filters\s*\{([^}]+)\}/)![1];
    expect(overlay).toContain('background: rgba(255, 255, 255, .95)');
    expect(overlay).toContain('box-shadow: 0 12rpx 30rpx');
    expect(overlay).toContain('border: 1rpx solid');
    expect(overlay).toContain('pointer-events: auto');
    const buttons = await readFile('miniprogram/components/category-filter/index.wxss', 'utf8');
    expect(buttons).toMatch(/\.category-tabs\s*\{[^}]*pointer-events:\s*auto/);
    expect(buttons).toMatch(/\.category-tab\s*\{[^}]*flex:\s*0\s+0\s+auto[^}]*height:\s*112rpx/);
    expect(buttons).toMatch(/\.category-tab-icon\s*\{[^}]*width:\s*56rpx[^}]*height:\s*56rpx/);
    expect(buttons).toContain('.category-tab.is-active');
    expect(buttons).not.toMatch(/(^|[},]\s*)(?:picker|scroll-view|view|image|text|#|\[)[^{]*\{/m);
  });
  it('uses visible compact search and favorite controls for place browsing', async () => {
    const discover = await readFile('miniprogram/pages/discover/index.wxml', 'utf8');
    const discoverStyle = await readFile('miniprogram/pages/discover/index.wxss', 'utf8');
    const card = await readFile('miniprogram/components/place-card/index.wxml', 'utf8');
    const cardStyle = await readFile('miniprogram/components/place-card/index.wxss', 'utf8');
    const detail = await readFile('miniprogram/pages/place-detail/index.wxml', 'utf8');
    const detailStyle = await readFile('miniprogram/pages/place-detail/index.wxss', 'utf8');
    expect(discover).toContain('发送搜索');
    expect(discover).toContain('>发送</button>');
    expect(discover).toContain('/assets/provided/discover-hero.jpg');
    expect(discover).toContain('discover-hero-copy');
    expect(discover).toContain('/assets/icons/discover-active.png');
    expect(discover).toContain('search-trigger-icon');
    expect(discover).toContain('aria-label="搜索地点"');
    expect(discover).toContain('hover-class="search-trigger-pressed"');
    expect(discover).toContain('hover-class="search-send-pressed"');
    expect(discoverStyle).toContain('.search-trigger');
    expect(discoverStyle).toContain('.search-send');
    expect(discoverStyle).toContain('pointer-events: none');
    expect(discoverStyle).toMatch(/\.discover-tools\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*nowrap/);
    expect(discoverStyle).toMatch(/\.discover-search\s*\{[^}]*flex:\s*0\s+0\s+88rpx/);
    expect(discoverStyle).toMatch(/\.discover-search\.is-expanded\s*\{[^}]*flex-basis:\s*400rpx/);
    expect(discoverStyle).toMatch(/\.discover-category\s*\{[^}]*flex:\s*1[^}]*min-width:\s*0/);
    expect(card).toContain('favorite-action');
    expect(card).toContain('/assets/provided/favorite-active.png');
    expect(cardStyle).toContain('.cover-wrap');
    expect(card).toContain('category-pill');
    expect(card).not.toContain('class="district"');
    expect(card).not.toContain('class="intro"');
    expect(card).not.toContain('class="tags"');
    expect(cardStyle).toContain('height: 336rpx');
    expect(cardStyle).toContain('.favorite-action');
    expect(card).not.toContain('cover-favorite');
    expect(detail).toContain('detail-favorite-image');
    expect(detail).toContain('/assets/provided/favorite-active.png');
    expect(detail).toContain('favorite-anchor');
    expect(detail).toContain("favorite-anchor {{favoritePending ? 'is-pending' : ''}}");
    expect(detail).toContain('bindtap="onFavorite"');
    expect(detail).toContain('aria-role="button"');
    expect(detail).not.toContain('<button class="favorite-button"');
    for (const filename of ['favorite.png', 'favorite-active.png']) {
      const favorite = await readFile(`miniprogram/assets/provided/${filename}`);
      expect(favorite.readUInt32BE(16)).toBe(128);
      expect(favorite.readUInt32BE(20)).toBe(128);
      expect(favorite.length).toBeGreaterThan(0);
      expect(favorite.length).toBeLessThanOrEqual(20_000);
    }
    expect(detail).toContain('detail-section-heading');
    expect(detail).toContain('section-marker');
    expect(detail).toContain('card-headline');
    expect(detail).toContain('<view class="title-row"><text class="eyebrow">');
    expect(detailStyle).toContain('height: 420rpx');
    expect(detailStyle).toContain('box-sizing: border-box');
    expect(detailStyle).toContain('width: 100%');
    expect(detailStyle).toContain('.section-marker.info');
    expect(detailStyle).toContain('.detail-section-heading');
    expect(detailStyle).toContain('font-size: 36rpx');
    expect(detailStyle).toContain('background: #f3f1fa');
    expect(detailStyle).toContain('border: 0');
    expect(detailStyle).toContain('position: absolute');
    expect(detailStyle).toContain('.favorite-anchor');
    expect(detailStyle).toContain('top: 24rpx');
    expect(detailStyle).toContain('right: 24rpx');
    expect(detailStyle).toContain('width: 88rpx');
    expect(detailStyle).toContain('width: 72rpx');
    expect(detailStyle).toContain('.place-name-heading { margin-top: 48rpx; }');
    expect(detailStyle).toContain('.favorite-anchor.is-pending');
    expect(detailStyle).toContain('box-shadow: 0 8rpx 24rpx rgba(53, 39, 92, .08)');
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

  it('gives the me page a pale travel identity and one aligned menu panel', async () => {
    const [markup, style] = await Promise.all([
      readFile('miniprogram/pages/me/index.wxml', 'utf8'),
      readFile('miniprogram/pages/me/index.wxss', 'utf8'),
    ]);
    expect(markup).toContain('class="travel-hero"');
    expect(markup).toContain('/assets/provided/tab-me-active.png');
    expect(style).toMatch(/\.me-page\s*\{[^}]*background:\s*var\(--color-page\)/);
    expect(style).toMatch(/\.travel-hero\s*\{[^}]*position:\s*relative[^}]*overflow:\s*hidden[^}]*linear-gradient/);
    expect(style).toMatch(/\.travel-motif\s*\{[^}]*opacity:\s*\.1[0-9][^}]*pointer-events:\s*none/);
    expect(style).toMatch(/\.profile-card\s*\{[^}]*margin-top:\s*-\d+rpx[^}]*background:\s*var\(--color-surface\)[^}]*box-shadow:/);
    expect(style).toMatch(/\.menu\s*\{[^}]*border:[^}]*border-radius:[^}]*background:\s*var\(--color-surface\)/);
    expect(style).toMatch(/\.menu-icon\s*\{[^}]*width:\s*72rpx[^}]*height:\s*72rpx/);
    for (const name of ['favorite', 'history', 'ai', 'preferences']) expect(style).toContain(`.menu-icon-shell-${name}`);
    expect(style).not.toContain('background: var(--color-brand-deep)');
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

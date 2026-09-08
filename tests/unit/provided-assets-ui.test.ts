import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
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
  ['map-marker-scenic.png', 88, 108, 24_000], ['map-marker-restaurant.png', 88, 108, 24_000],
  ['map-marker-culture.png', 88, 108, 24_000], ['map-marker-camping.png', 88, 108, 24_000],
] as const;

function pngDimension(bytes: Buffer, offset: number) { return bytes.readUInt32BE(offset); }
function pngCornerPaletteIndexes(bytes: Buffer) {
  const width = pngDimension(bytes, 16);
  const height = pngDimension(bytes, 20);
  if (bytes[24] !== 8 || bytes[25] !== 3) throw new Error('Expected an 8-bit indexed PNG');
  const chunks: Buffer[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString();
    if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const rows = inflateSync(Buffer.concat(chunks));
  const result = Buffer.alloc(width * height);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = rows[source++];
    for (let x = 0; x < width; x += 1) {
      const raw = rows[source++];
      const left = x ? result[y * width + x - 1] : 0;
      const up = y ? result[(y - 1) * width + x] : 0;
      const upperLeft = x && y ? result[(y - 1) * width + x - 1] : 0;
      const predictor = left + up - upperLeft;
      const pa = Math.abs(predictor - left);
      const pb = Math.abs(predictor - up);
      const pc = Math.abs(predictor - upperLeft);
      const predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft;
      const value = filter === 0 ? raw : filter === 1 ? raw + left : filter === 2 ? raw + up : filter === 3 ? raw + Math.floor((left + up) / 2) : filter === 4 ? raw + predicted : NaN;
      if (!Number.isFinite(value)) throw new Error(`Unsupported PNG filter: ${filter}`);
      result[y * width + x] = value & 0xff;
    }
  }
  return [result[0], result[width - 1], result[(height - 1) * width], result[result.length - 1]];
}
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

  it('keeps the trip card artwork filled through every outer corner', async () => {
    const bytes = await readFile(`${root}/trip-plan.png`);
    const paletteIndexes = pngCornerPaletteIndexes(bytes);
    const paletteOffset = bytes.indexOf(Buffer.from('PLTE'));
    expect(paletteOffset).toBeGreaterThan(0);
    for (const index of paletteIndexes) {
      const rgb = bytes.subarray(paletteOffset + 4 + index * 3, paletteOffset + 7 + index * 3);
      expect([...rgb]).not.toEqual([0, 0, 0]);
    }
  });

  it('keeps the supplied category artwork and enlarged supplied tab artwork intact', async () => {
    const renderer = await readFile('scripts/render-modern-icons.mjs', 'utf8');
    expect(renderer).not.toContain('gradientCategoryIcon');
    const fingerprints: Record<string, string> = {
      'category-all.png': 'be305e0e86bfb0fb10d48b9ac7e8adaa436ace2a601b53689cc3d34a097b779a',
      'category-scenic.png': '2844a863a3c27dd76586719b21189f7bd03976f2ed7a960e8d539274036bb0be',
      'category-restaurant.png': '7b27f297b9b3497a9a8dcde492af6e2fb731d6de7450a2002aea4f337c093726',
      'category-culture.png': '72119d9d7aafb93b00a8c32818e534710557048f08591a757c981c318c070229',
      'category-camping.png': 'fa8b8ffa52be565ed4039e4534f6b3fb85772c8cbc93ca9bf324c73546e46c77',
      'tab-home.png': '99f8c80691d79cbab099f58079b9c2688c8780a57a18ebf1bcc71b048dd4f415',
      'tab-home-active.png': '4c9530bef566e230beb4c9064a3eac08b322d8d0d49022ddce3bf6f774006feb',
      'tab-discover.png': '27d30c359b6e7a616167b106952e3e47097de94d7808b7194e0b2c4b45d93295',
      'tab-discover-active.png': 'dd74d5899c6ab6fe7672b95f510b465a905e3d18b0664e3e5469230d8623a71a',
      'tab-map.png': 'e70f144378a70ae2acbff69a4dcfd498a8403bb84097ded9c5e1aba17e185645',
      'tab-map-active.png': '797e26beb4a013e566b3c43b2039c12015920e2458a6c724d9b9260bedfcfd16',
      'tab-me.png': 'e89cf91ac3b8de304e73c56ef35601df65f93ef53b8ee4e829c67daf5923d446',
      'tab-me-active.png': '5accc8ce78130af606ec8f161eec254d8be813cc907ba8a7f164a8eccf26852e',
    };
    for (const [name, expected] of Object.entries(fingerprints)) {
      const bytes = await readFile(`${root}/${name}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected);
    }
  });

  it('ships four visually distinct category marker derivatives', async () => {
    const hashes = await Promise.all(['scenic', 'restaurant', 'culture', 'camping'].map(async category => {
      const bytes = await readFile(`${root}/map-marker-${category}.png`);
      return createHash('sha256').update(bytes).digest('hex');
    }));
    expect(new Set(hashes).size).toBe(4);
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
    const [home, homeStyle] = await Promise.all([
      readFile('miniprogram/pages/home/index.wxml', 'utf8'),
      readFile('miniprogram/pages/home/index.wxss', 'utf8'),
    ]);
    expect(home).toContain('class="home-hero"');
    expect(home).toContain('/assets/provided/home-hero.jpg');
    expect(home).toContain('class="ai-quick-grid"');
    expect(home).not.toContain('class="home-intro"');
    expect(home).not.toContain('class="ai-entry-list"');
    expect((home.match(/bindtap="openAiChat"/g) ?? []).length).toBe(1);
    expect((home.match(/bindtap="openTripForm"/g) ?? []).length).toBe(1);
    expect(home).toContain('/assets/provided/ai-chat.png');
    expect(home).toContain('/assets/provided/trip-plan.png');
    expect(homeStyle).toMatch(/\.ai-quick-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*16rpx/);
    expect(homeStyle).toMatch(/\.ai-quick-card\s*\{[^}]*width:\s*100%[^}]*height:\s*319rpx[^}]*aspect-ratio:\s*1\s*\/\s*1/);
    expect(homeStyle).toMatch(/\.ai-quick-image\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
    expect(homeStyle).toMatch(/\.category-icon\s*\{[^}]*width:\s*128rpx[^}]*height:\s*128rpx/);
    expect(homeStyle).toMatch(/\.category-label\s*\{[^}]*color:\s*var\(--color-text\)/);
    for (const retiredCopy of ['旅行助手', '从哪里开始', '从灵感到行程', '四类地点', '值得停留', '精选地点', '内容仅供出行参考，请以景区、交通等官方公告为准']) {
      expect(home).not.toContain(retiredCopy);
    }
  });
});

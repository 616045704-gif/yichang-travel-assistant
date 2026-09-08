# Home, Discover, and Map UI Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved modern Yichang travel UI revisions for Home, Discover, the shared place list, native Tab artwork, and Map without changing backend, route, data, or business contracts.

**Architecture:** Keep the existing page methods, cloud services, data shapes, native Tab routes, and shared `place-card` event contract. Apply deterministic local asset exports, convert the existing shared category component from chips to a picker-backed visual control, and update only presentation-facing WXML/WXSS plus the two TypeScript display adapters required for picker index mapping and marker appearance. The Map card continues to use `selectedPlace` and a local placeholder image, so no image field or extra request is added.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/TypeScript, Node.js ESM build scripts, bundled `sharp` for deterministic raster export, Vitest, existing build/package checks, WeChat Developer Tools controlled through Computer Use.

## Global Constraints

- Do not modify cloud functions, Dify calls/configuration, database fields, API payloads, page routes, category values, favorite behavior, or the timing of location authorization.
- Keep the native Tab order and routes exactly Home, Discover, Map, Me; top navigation and bottom Tab backgrounds remain `#FFFFFF`.
- Use `#7454D8` only for selected states, links, icons, and small accents; use `#F6C644` sparingly; do not add full-screen or full-card purple fills and do not introduce an antique style.
- Keep `home-hero.jpg` and `discover-hero.jpg` content unchanged. Home code must not duplicate the lettering embedded in the Home image.
- Home category icons display at `112 × 112rpx`; native Tab images remain `81 × 81px` but their artwork occupies approximately `68–72px` without selected-state size shifts.
- New AI derivatives are `512 × 512px` and at most `180KB` each; category derivatives are `128 × 128px` and at most `30KB` each; favorite derivatives are `128 × 128px` and at most `20KB` each.
- `map-marker.png` is `72 × 88px`, at most `20KB`, and displays at `36 × 44px`; `place-placeholder.jpg` is `480 × 360px` and at most `80KB`.
- `miniprogram/assets/provided` remains at most `1MB`; the built main package remains at most `1,900,000` bytes.
- Normal Map category changes filter loaded public markers locally. Nearby-mode category changes may call existing `loadNearby` with cached coordinates but must not call `wx.getLocation` again.
- Every code task starts with a failing focused test, ends with focused tests plus typecheck/lint as applicable, receives independent review, and is committed with a focused Conventional Commit.
- Preserve unrelated working-tree changes; stage exact paths only and never use `git add .`.

---

## File Map

| File | Responsibility |
| --- | --- |
| `scripts/export-revised-ui-assets.mjs` | Deterministically crop and resize user-provided AI, category, favorite, and Tab artwork without touching originals. |
| `scripts/render-modern-icons.mjs` | Render the new filled map marker into the provided-asset directory. |
| `miniprogram/assets/provided/*` | Optimized UI derivatives, new map marker, and local Map placeholder. |
| `miniprogram/pages/home/index.wxml`, `index.wxss` | Home CTA, new AI cards, category separator, and larger category icons. |
| `miniprogram/components/place-card/index.wxml`, `index.wxss` | Shared large-image card and favorite action below the title. |
| `miniprogram/components/category-filter/index.ts`, `index.wxml`, `index.wxss` | Picker index/value adapter and shared dropdown presentation. |
| `miniprogram/pages/discover/index.wxml`, `index.wxss` | Larger Hero and one-row dropdown/search toolbar. |
| `miniprogram/view-models/map.ts` | Marker image path, dimensions, and removal of the native text callout only. |
| `miniprogram/pages/map/index.wxml`, `index.wxss` | Touchable dropdown, one bottom stack, and image/text marker card. |
| `tests/unit/provided-assets-ui.test.ts` | Pixel, byte, package-budget, asset-reference, and Home visual contracts. |
| `tests/unit/components.test.ts` | Picker mapping and shared place-card structure/events. |
| `tests/unit/place-pages.test.ts` | Discover layout, bindings, state, and shared-card contracts. |
| `tests/unit/map-state.test.ts`, `map-nearby-page.test.ts` | Marker appearance, selection, cached-nearby behavior, and overlay structure. |
| `.local/ui-qa/2026-09-08/` | Ignored before/after simulator screenshots; not committed. |
| `docs/testing/2026-09-08-home-discover-map-ui-qa.md` | Independent test record tied to the tested commit. |

## Task 1: Lock the approved visual and behavior contract

**Files:**
- Modify: `tests/unit/provided-assets-ui.test.ts`
- Modify: `tests/unit/components.test.ts`
- Modify: `tests/unit/place-pages.test.ts`
- Modify: `tests/unit/map-state.test.ts`
- Modify: `tests/unit/map-nearby-page.test.ts`

**Interfaces:**
- Consumes: current page/component paths and the approved design spec.
- Produces: failing tests that describe the new resource dimensions, WXML structure, picker mapping, and unchanged Map/location behavior.

- [ ] **Step 1: Capture the baseline simulator state before app-source changes**

Use the `computer-use` skill to keep WeChat Developer Tools foreground and compile the current `D:\ChatGPT\宜昌旅游助手\dist` project. Capture Home, Discover, and Map to:

```text
.local/ui-qa/2026-09-08/before-home.png
.local/ui-qa/2026-09-08/before-discover.png
.local/ui-qa/2026-09-08/before-map.png
```

If the IDE is blocked by a modal or cannot compile, stop only for that blocking condition and record the exact message.

- [ ] **Step 2: Update the resource contract with exact sizes and budgets**

Change the resource table in `tests/unit/provided-assets-ui.test.ts` from `[file, width, maxBytes]` to `[file, width, height, maxBytes]`. Keep the existing Hero/menu rows with matching height values, and include:

```ts
['ai-chat.png', 512, 512, 180_000], ['trip-plan.png', 512, 512, 180_000],
['category-all.png', 128, 128, 30_000], ['category-scenic.png', 128, 128, 30_000],
['category-restaurant.png', 128, 128, 30_000], ['category-culture.png', 128, 128, 30_000],
['category-camping.png', 128, 128, 30_000],
['favorite.png', 128, 128, 20_000], ['favorite-active.png', 128, 128, 20_000],
['map-marker.png', 72, 88, 20_000],
```

Update the PNG assertion loop accordingly:

```ts
for (const [file, width, height, maxBytes] of assets) {
  const path = `${root}/${file}`;
  const [bytes, info] = await Promise.all([readFile(path), stat(path)]);
  total += info.size;
  expect(info.size).toBeLessThanOrEqual(maxBytes);
  if (width && height) {
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(pngDimension(bytes, 16)).toBe(width);
    expect(pngDimension(bytes, 20)).toBe(height);
  }
}
```

Add a JPEG dimension helper for the fixed Map placeholder and change the aggregate assertion:

```ts
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

const placeholder = await readFile(`${root}/place-placeholder.jpg`);
expect((await stat(`${root}/place-placeholder.jpg`)).size).toBeLessThanOrEqual(80_000);
expect(jpegDimensions(placeholder)).toEqual({ width: 480, height: 360 });
expect(total + (await stat(`${root}/place-placeholder.jpg`)).size).toBeLessThanOrEqual(1_000_000);
```

The JPEG dimension check must parse SOF0/SOF2 and assert `{ width: 480, height: 360 }`; it must not infer dimensions from filename.

- [ ] **Step 3: Add failing Home and place-card structure assertions**

Require the Home template and styles to satisfy:

```ts
expect(home).toContain('catchtap="openDiscover">出发吧');
expect(home).not.toContain('浏览所有地点');
expect(home).toContain('class="category-heading"');
expect(home).toContain('>分类</text>');
expect(home).not.toContain('class="ai-quick-title"');
expect(homeStyle).toContain('width: 112rpx');
expect(card.indexOf('class="name"')).toBeLessThan(card.indexOf('class="favorite-action"'));
expect(card).toContain('catchtap="onFavorite"');
expect(card).not.toContain('cover-favorite');
expect(cardStyle).toContain('.favorite-action');
```

- [ ] **Step 4: Replace chip-component tests with picker mapping tests**

Update `components.test.ts` to assert `<picker>`, `bindchange="onChange"`, the complete five-option label array, and these event results:

```ts
type Definition = {
  data: { options: Array<{ value: string; label: string }> };
  methods: Record<string, (this: Instance, event?: unknown) => void>;
  properties: Record<string, { value: unknown; observer?: (this: Instance, value?: unknown) => void }>;
};
const definition = await component('category-filter');
const ctx = instance({ value: '', selectedIndex: 0, options: definition.data.options });
definition.methods.onChange.call(ctx, { detail: { value: '3' } });
expect(ctx.triggerEvent).toHaveBeenCalledWith('categorychange', { category: 'culture' });
ctx.triggerEvent.mockClear();
definition.methods.onChange.call(ctx, { detail: { value: '99' } });
expect(ctx.triggerEvent).not.toHaveBeenCalled();
```

- [ ] **Step 5: Add failing Discover and Map presentation assertions**

In `place-pages.test.ts`, require `discover-tools`, Hero height `340rpx`, the existing category/search bindings, and the shared `place-card`. In the Map tests require:

```ts
expect(marker.iconPath).toBe('/assets/provided/map-marker.png');
expect(marker).toMatchObject({ width: 36, height: 44 });
expect(marker).not.toHaveProperty('callout');
expect(mapMarkup).toContain('/assets/provided/place-placeholder.jpg');
expect(mapMarkup).toContain('class="map-bottom-stack"');
expect(mapStyle).toContain('gap: 16rpx');
expect(mapStyle).toContain('pointer-events: auto');
```

Add a nearby-mode category test that first calls `locateNearby`, then sends `{ category: 'scenic' }`, and asserts one additional `nearby` cloud call with the cached latitude/longitude while the `getLocation` mock remains called exactly once.

- [ ] **Step 6: Run focused tests and verify the intended red state**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/provided-assets-ui.test.ts tests/unit/components.test.ts tests/unit/place-pages.test.ts tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts
```

Expected: FAIL only on the newly specified asset paths/dimensions and presentation structure. Existing cloud/service behavior tests must not fail.

- [ ] **Step 7: Commit the contract tests**

```powershell
git add tests/unit/provided-assets-ui.test.ts tests/unit/components.test.ts tests/unit/place-pages.test.ts tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts
git commit -m "test: define home discover map UI revision"
```

## Task 2: Export optimized artwork and create the Map visuals

**Files:**
- Create: `scripts/export-revised-ui-assets.mjs`
- Modify: `scripts/render-modern-icons.mjs`
- Modify: `miniprogram/assets/provided/ai-chat.png`, `trip-plan.png`
- Modify: `miniprogram/assets/provided/category-all.png`, `category-scenic.png`, `category-restaurant.png`, `category-culture.png`, `category-camping.png`
- Modify: `miniprogram/assets/provided/tab-*.png`, `favorite.png`, `favorite-active.png`
- Create: `miniprogram/assets/provided/map-marker.png`
- Create: `miniprogram/assets/provided/place-placeholder.jpg`
- Test: `tests/unit/provided-assets-ui.test.ts`

**Interfaces:**
- Consumes: originals under `icon+banner/` and existing `discover-hero.jpg`.
- Produces: deterministic optimized files at the exact paths expected by page markup and resource tests.

- [ ] **Step 1: Add a deterministic square-export script**

Create `scripts/export-revised-ui-assets.mjs`. It uses the bundled `sharp` package supplied by the Codex workspace; it does not add a project runtime dependency. The full export logic is:

```js
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const sourceRoot = path.resolve(process.argv[2] || 'icon+banner');
const outputRoot = path.resolve(process.argv[3] || 'miniprogram/assets/provided');
const exports = [
  ['自由问答.png', 'ai-chat.png', 512, 0, false, 180_000],
  ['行程定制.png', 'trip-plan.png', 512, 0, false, 180_000],
  ['全部.png', 'category-all.png', 128, 8, true, 30_000],
  ['景区.png', 'category-scenic.png', 128, 8, true, 30_000],
  ['餐馆.png', 'category-restaurant.png', 128, 8, true, 30_000],
  ['博物馆.png', 'category-culture.png', 128, 8, true, 30_000],
  ['露营地.png', 'category-camping.png', 128, 8, true, 30_000],
  ['未收藏.png', 'favorite.png', 128, 8, true, 20_000],
  ['已收藏.png', 'favorite-active.png', 128, 8, true, 20_000],
  ['首页.png', 'tab-home.png', 81, 5, true, 20_000],
  ['首页-选中.png', 'tab-home-active.png', 81, 5, true, 20_000],
  ['发现.png', 'tab-discover.png', 81, 5, true, 20_000],
  ['发现-选中.png', 'tab-discover-active.png', 81, 5, true, 20_000],
  ['地图.png', 'tab-map.png', 81, 5, true, 20_000],
  ['地图-选中.png', 'tab-map-active.png', 81, 5, true, 20_000],
  ['我的.png', 'tab-me.png', 81, 5, true, 20_000],
  ['我的-选中.png', 'tab-me-active.png', 81, 5, true, 20_000],
];

await mkdir(outputRoot, { recursive: true });
for (const [sourceName, targetName, size, margin, trim, maxBytes] of exports) {
  let image = sharp(path.join(sourceRoot, sourceName)).rotate();
  if (trim) image = image.trim({ background: '#ffffff', threshold: 10 });
  await image
    .resize(size - margin * 2, size - margin * 2, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
    .toFile(path.join(outputRoot, targetName));
  const bytes = (await stat(path.join(outputRoot, targetName))).size;
  if (bytes > maxBytes) throw new Error(`${targetName} exceeds ${maxBytes} bytes: ${bytes}`);
}

await sharp(path.join(outputRoot, 'discover-hero.jpg'))
  .resize(480, 360, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 78, mozjpeg: true })
  .toFile(path.join(outputRoot, 'place-placeholder.jpg'));
const placeholderBytes = (await stat(path.join(outputRoot, 'place-placeholder.jpg'))).size;
if (placeholderBytes > 80_000) throw new Error(`place-placeholder.jpg exceeds 80000 bytes: ${placeholderBytes}`);
```

For AI cards, `trim` is false so embedded titles/subtitles cannot be clipped. For Tab exports, 5px remains around tightly trimmed artwork. The script throws for missing inputs and oversized outputs.

- [ ] **Step 2: Render the new filled marker**

Extend `scripts/render-modern-icons.mjs` with `providedRoot` and a `mapMarker()` function that emits a transparent `72 × 88px` PNG. The shape contract is:

```js
const providedRoot = new URL('../miniprogram/assets/provided/', import.meta.url);
function mapMarker() {
  return png(72, 88, (x, y, set) => {
    const px = x + 0.5; const py = y + 0.5;
    const head = ((px - 36) / 27) ** 2 + ((py - 31) / 27) ** 2 <= 1 && py <= 42;
    const tail = py >= 31 && py <= 82 && Math.abs(px - 36) <= 25 * (82 - py) / 51;
    if (head || tail) set(palette.purple);
    if ((px - 36) ** 2 + (py - 30) ** 2 <= 12 ** 2) set([255, 255, 255, 255]);
    if ((px - 36) ** 2 + (py - 27) ** 2 <= 4 ** 2) set(palette.yellow);
    const wave = Math.abs(py - (34 + Math.sin((px - 23) / 5) * 2)) <= 1.3 && px >= 23 && px <= 49;
    if (wave) set(palette.purple);
  });
}
await writeFile(new URL('map-marker.png', providedRoot), mapMarker());
```

The result is filled, compact, purple/yellow, and contains one white river window rather than thin decorative linework.

- [ ] **Step 3: Export the local Map placeholder**

The final `sharp(...).resize(480, 360, { fit: 'cover' })` block in Step 1 center-crops the existing text-free Discover Hero to `4:3` and saves JPEG quality 78. Verify the source remains `discover-hero.jpg`; do not add text, tint, or a remote asset.

- [ ] **Step 4: Run the exports and resource tests**

Run:

```powershell
$env:NODE_PATH = 'C:\Users\61604\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node scripts\export-revised-ui-assets.mjs
node scripts\render-modern-icons.mjs
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/provided-assets-ui.test.ts
```

Expected: all resource dimensions and byte ceilings pass; `assets/provided` is at most `1,000,000` bytes.

- [ ] **Step 5: Visually inspect the four asset families**

Open the two AI cards, one category image, one paired Tab state, the new marker, and the placeholder at original resolution. Reject exports with clipped embedded text, unequal Tab visual scale, visible white crop seams, or marker details that disappear at `36 × 44px`.

- [ ] **Step 6: Commit only the export tooling and derived assets**

```powershell
git add scripts/export-revised-ui-assets.mjs scripts/render-modern-icons.mjs miniprogram/assets/provided/ai-chat.png miniprogram/assets/provided/trip-plan.png miniprogram/assets/provided/category-all.png miniprogram/assets/provided/category-scenic.png miniprogram/assets/provided/category-restaurant.png miniprogram/assets/provided/category-culture.png miniprogram/assets/provided/category-camping.png miniprogram/assets/provided/favorite.png miniprogram/assets/provided/favorite-active.png miniprogram/assets/provided/tab-home.png miniprogram/assets/provided/tab-home-active.png miniprogram/assets/provided/tab-discover.png miniprogram/assets/provided/tab-discover-active.png miniprogram/assets/provided/tab-map.png miniprogram/assets/provided/tab-map-active.png miniprogram/assets/provided/tab-me.png miniprogram/assets/provided/tab-me-active.png miniprogram/assets/provided/map-marker.png miniprogram/assets/provided/place-placeholder.jpg tests/unit/provided-assets-ui.test.ts
git commit -m "feat: refresh travel UI artwork"
```

## Task 3: Recompose Home and the shared place card

**Files:**
- Modify: `miniprogram/pages/home/index.wxml`, `index.wxss`
- Modify: `miniprogram/components/place-card/index.wxml`, `index.wxss`
- Modify: `tests/unit/provided-assets-ui.test.ts`, `tests/unit/components.test.ts`, `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: unchanged Home methods `openDiscover`, `openAiChat`, `openTripForm`, `onCategoryTap`, `openPlace`, `onFavorite`; unchanged place-card properties/events.
- Produces: the approved Home hierarchy and one shared non-overlapping favorite layout used by Home and Discover.

- [ ] **Step 1: Implement the Home structure without changing `index.ts`**

Use this content order in `home/index.wxml`:

```xml
<view class="home-hero" bindtap="openDiscover" aria-role="button" aria-label="浏览宜昌地点">
  <image class="home-hero-image" src="/assets/provided/home-hero.jpg" mode="aspectFill" />
  <view class="home-hero-shade"></view>
  <button class="home-hero-action" catchtap="openDiscover">出发吧</button>
</view>
<view class="ai-quick-grid">
  <button class="ai-quick-card" bindtap="openAiChat" aria-label="自由问答"><image class="ai-quick-image" src="/assets/provided/ai-chat.png" mode="widthFix" /></button>
  <button class="ai-quick-card" bindtap="openTripForm" aria-label="行程定制"><image class="ai-quick-image" src="/assets/provided/trip-plan.png" mode="widthFix" /></button>
</view>
<view class="category-separator"></view>
<view class="category-heading"><view class="category-heading-mark"></view><text class="category-heading-title">分类</text></view>
```

Keep the existing four-item loop, featured state branches, place-card bindings, and feedback toast after this block.

- [ ] **Step 2: Apply the exact Home layout values**

In `home/index.wxss`, keep the Hero at `560rpx`; center the CTA with `left: 50%`, `top: 300rpx`, and `transform: translateX(-50%)`; use `rgba(116, 84, 216, .92)`, `64rpx` height, and white text. Make AI buttons square image surfaces with no duplicate title, no native button outline, and a `16rpx` grid gap. Use a `12rpx` `#F1EFF7` separator, `32rpx` section spacing, a `12rpx` purple heading mark, and `112 × 112rpx` category icons.

- [ ] **Step 3: Move the favorite below the title in the shared card**

Replace `place-card/index.wxml` with the same cover/title open area followed by a sibling favorite button:

```xml
<view wx:if="{{place}}" class="place-card">
  <view class="open-area" bindtap="onOpen" aria-role="button" aria-label="{{'查看' + place.name}}">
    <view class="cover-wrap">
      <image wx:if="{{place.coverUrl && !imageFailed}}" class="cover" src="{{place.coverUrl}}" mode="aspectFill" binderror="onImageError" />
      <view wx:else class="cover placeholder">图片暂不可用</view>
      <view class="category-pill" aria-hidden="true"><text wx:if="{{place.category === 'scenic'}}">景区</text><text wx:elif="{{place.category === 'restaurant'}}">餐馆</text><text wx:elif="{{place.category === 'culture'}}">博物馆</text><text wx:else>露营地</text></view>
    </view>
    <view class="body"><text class="name">{{place.name}}</text></view>
  </view>
  <button class="favorite-action" loading="{{pending}}" disabled="{{pending}}" catchtap="onFavorite" aria-label="{{place.isFavorite ? '取消收藏' : '收藏地点'}}">
    <image class="favorite-image" src="{{place.isFavorite ? '/assets/provided/favorite-active.png' : '/assets/provided/favorite.png'}}" mode="aspectFit" />
    <text class="favorite-label">{{place.isFavorite ? '已收藏' : '收藏'}}</text>
  </button>
</view>
```

Style `.favorite-action` as a right-aligned transparent inline-flex action, `40rpx` image, `24rpx` label, no native border, and no absolute positioning. Do not use tag-name selectors in component WXSS.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/provided-assets-ui.test.ts tests/unit/components.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: PASS; `miniprogram/pages/home/index.ts` and `place-card/index.ts` remain unchanged.

- [ ] **Step 5: Request independent UI review and commit**

The reviewer must check CTA placement, embedded AI text legibility, category spacing, title/favorite order, event containment, and Home/Discover shared-card consistency. Address any blocker before committing.

```powershell
git add miniprogram/pages/home/index.wxml miniprogram/pages/home/index.wxss miniprogram/components/place-card/index.wxml miniprogram/components/place-card/index.wxss tests/unit/provided-assets-ui.test.ts tests/unit/components.test.ts tests/unit/visual-style.test.ts
git commit -m "feat: refine home and shared place cards"
```

## Task 4: Convert Discover filtering to a one-row picker toolbar

**Files:**
- Modify: `miniprogram/components/category-filter/index.ts`, `index.wxml`, `index.wxss`
- Modify: `miniprogram/pages/discover/index.wxml`, `index.wxss`
- Modify: `tests/unit/components.test.ts`, `tests/unit/place-pages.test.ts`, `tests/unit/visual-style.test.ts`, `tests/unit/navigation.test.ts`

**Interfaces:**
- Consumes: property `value: Category | ''`; source categories from `CATEGORIES`.
- Produces: unchanged event `categorychange` with `{ category: Category | '' }`; no Discover page handler changes.

- [ ] **Step 1: Implement the picker value adapter**

Use a module-level constant and observer so external Home-to-Discover selection remains visible:

```ts
import { CATEGORIES } from '../../../shared/contracts';
const OPTIONS = [{ value: '', label: '全部分类' }, ...CATEGORIES];

Component({
  properties: {
    value: { type: String, value: '', observer(value: string) {
      const index = OPTIONS.findIndex(item => item.value === value);
      this.setData({ selectedIndex: index >= 0 ? index : 0 });
    } },
  },
  data: { options: OPTIONS, labels: OPTIONS.map(item => item.label), selectedIndex: 0 },
  methods: {
    onChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
      const index = Number(event.detail.value);
      if (!Number.isInteger(index) || index < 0 || index >= OPTIONS.length) return;
      const category = OPTIONS[index].value;
      if (category !== '' && !CATEGORIES.some(item => item.value === category)) return;
      this.setData({ selectedIndex: index });
      this.triggerEvent('categorychange', { category });
    },
  },
});
```

- [ ] **Step 2: Replace chip markup with the dropdown surface**

```xml
<picker class="category-picker" mode="selector" range="{{labels}}" value="{{selectedIndex}}" bindchange="onChange">
  <view class="category-select" aria-label="地点分类">
    <text class="category-select-label">{{labels[selectedIndex]}}</text>
    <view class="category-select-chevron" aria-hidden="true"></view>
  </view>
</picker>
```

Style the host/picker at full width with `pointer-events: auto`; use an `80rpx` white surface, `20rpx` radius, `1rpx` border, ellipsis label, and purple CSS chevron.

- [ ] **Step 3: Put Discover category and search into one row**

Replace the separate filter/search wrappers with:

```xml
<view class="discover-tools">
  <view class="discover-category"><category-filter id="categories" value="{{category}}" bind:categorychange="onCategoryChange" /></view>
  <view class="search-panel"><input value="{{keyword}}" placeholder="搜索地点名称或简介" confirm-type="search" bindinput="onKeywordInput" bindconfirm="onSearch" /><button size="mini" class="search-icon" bindtap="onSearch" aria-label="确认搜索"><view class="search-glyph"></view></button></view>
</view>
```

Set Hero height to `340rpx`; `.discover-tools` is flex with `14rpx` gap; `.discover-category` is `214rpx`; `.search-panel` is flex: 1 and `80rpx` high. Preserve all list/status/footer markup and `index.ts` unchanged.

- [ ] **Step 4: Run focused checks**

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/components.test.ts tests/unit/place-pages.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: PASS; all five values emit correctly and Discover still calls the existing view model.

- [ ] **Step 5: Request independent review and commit**

Review at standard and narrow simulator widths, including the selected “文化馆/博物馆” ellipsis case and empty/error states.

```powershell
git add miniprogram/components/category-filter/index.ts miniprogram/components/category-filter/index.wxml miniprogram/components/category-filter/index.wxss miniprogram/pages/discover/index.wxml miniprogram/pages/discover/index.wxss tests/unit/components.test.ts tests/unit/place-pages.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts
git commit -m "feat: align discovery filters in one row"
```

## Task 5: Redesign Map markers and the selected-place card

**Files:**
- Modify: `miniprogram/view-models/map.ts`
- Modify: `miniprogram/pages/map/index.wxml`, `index.wxss`
- Modify: `tests/unit/map-state.test.ts`, `tests/unit/map-nearby-page.test.ts`, `tests/unit/navigation.test.ts`, `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: existing `MapPlace`, `buildMarkers`, `findPlaceByMarkerId`, `onCategoryChange`, `onMarkerTap`, `openSelectedPlace`, location methods, and shared picker event.
- Produces: the same marker IDs and selected place with a new marker bitmap and visual card; no service or contract changes.

- [ ] **Step 1: Change only marker presentation fields**

Remove the required `callout` property from `TravelMarker`. Keep stable sorting/filtering and return:

```ts
{
  id,
  latitude: place.latitude,
  longitude: place.longitude,
  iconPath: '/assets/provided/map-marker.png',
  width: 36,
  height: 44,
}
```

Do not change `isMapPlace`, marker ID assignment, `findPlaceByMarkerId`, or any service call.

- [ ] **Step 2: Build the Map bottom stack and image card**

Keep the map and top category filter. Replace the two independently anchored bottom blocks with:

```xml
<view class="map-bottom-stack">
  <view class="map-actions">
    <button class="nearby-button" loading="{{locating}}" disabled="{{locating}}" bindtap="locateNearby">定位我的附近</button>
    <text wx:if="{{notice}}" class="map-notice">{{notice}}</text>
    <button wx:if="{{showSettings}}" class="settings-button" bindtap="onOpenSettings">打开设置</button>
  </view>
  <view wx:if="{{selectedPlace}}" class="marker-card">
    <image class="marker-card-image" src="/assets/provided/place-placeholder.jpg" mode="aspectFill" />
    <view class="marker-card-content"><text class="marker-category">{{selectedPlace.category}}</text><text class="marker-name">{{selectedPlace.name}}</text><button class="detail-button" bindtap="openSelectedPlace">查看详情</button></view>
  </view>
</view>
```

The `.map-filters` wrapper and picker must be `pointer-events: auto`. Make `.map-bottom-stack` the only bottom-anchored container, with left/right `24rpx`, safe-area bottom, flex column, and `16rpx` gap. Make `.marker-card` a row with `176 × 144rpx` image, remaining content, `24rpx` radius, white 98% surface, and a restrained shadow.

- [ ] **Step 3: Preserve and test normal/nearby category behavior**

Do not edit `pages/map/index.ts` unless a test proves a purely presentational state-class need. The existing `onCategoryChange` must continue clearing `selectedPlace`; in nearby mode it calls `loadNearby(nearbyLocation)` with cached coordinates. Assert category changes never invoke `getLocation` a second time.

- [ ] **Step 4: Run focused checks**

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts tests/unit/navigation.test.ts tests/unit/visual-style.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: PASS; no cloud function, service, shared contract, route, or permission helper changes.

- [ ] **Step 5: Request independent review and commit**

The reviewer checks marker legibility at map scale, dropdown touchability, absence of the native callout, card/action separation with long names and permission messages, and unchanged marker-to-detail mapping.

```powershell
git add miniprogram/view-models/map.ts miniprogram/pages/map/index.wxml miniprogram/pages/map/index.wxss tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts tests/unit/navigation.test.ts tests/unit/visual-style.test.ts
git commit -m "feat: refine map markers and place preview"
```

## Task 6: Full verification, simulator screenshots, and independent QA

**Files:**
- Create: `docs/testing/2026-09-08-home-discover-map-ui-qa.md`
- Modify: the narrowest relevant test/source file only if a reproducible defect requires a regression fix.

**Interfaces:**
- Consumes: all final implementation commits and the approved design acceptance matrix.
- Produces: a clean build, before/after visual evidence, independent test record, and final Git history.

- [ ] **Step 1: Run the complete automated verification suite**

```powershell
node .local-tools\package\bin\npm-cli.js test
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
node .local-tools\package\bin\npm-cli.js run build
node scripts\check-package.mjs
node .local-tools\package\bin\npm-cli.js run verify:docs
git diff --check
```

Expected: every command exits 0; package check prints `Client routes, resources and boundary verified`.

- [ ] **Step 2: Request independent code review**

Use the `requesting-code-review` skill. Require the reviewer to compare the diff to the approved spec, inspect event propagation and picker mapping, verify Map marker IDs/nearby behavior, and reject any cloud/API/database/route change.

- [ ] **Step 3: Compile and capture after screenshots in WeChat Developer Tools**

Use the `computer-use` skill. Keep the IDE foreground and do not minimize or cover it. Compile the `dist` project, wait for rendering, and capture:

```text
.local/ui-qa/2026-09-08/after-home.png
.local/ui-qa/2026-09-08/after-discover.png
.local/ui-qa/2026-09-08/after-discover-culture.png
.local/ui-qa/2026-09-08/after-discover-empty.png
.local/ui-qa/2026-09-08/after-map.png
.local/ui-qa/2026-09-08/after-map-card.png
.local/ui-qa/2026-09-08/after-map-denied.png
```

Compare each final image to its matching baseline and the approved annotated screenshots. Inspect the console for fatal errors and component WXSS selector warnings.

- [ ] **Step 4: Have the independent test role execute the acceptance pass**

Give the tester the exact implementation commit and require actual checks of Home, Discover initial/culture/empty/error, Map initial/filter/card/denied-location, native Tab selected states, favorite default/selected/pending/error, and the console. The tester records every unavailable state as untested rather than inferred.

- [ ] **Step 5: Fix and retest any blocker**

For each reproducible defect, first add one focused regression assertion, run it red, apply the smallest presentation fix, rerun focused and full checks, request reviewer/tester recheck, and create a separate `fix:` commit. Do not weaken an assertion or change a service to hide a visual defect.

- [ ] **Step 6: Write and commit the factual QA record**

Create `docs/testing/2026-09-08-home-discover-map-ui-qa.md` with the actual tested commit, commands, pass/fail counts, simulator pages observed, screenshot paths, defects, and untested scope. Then run `npm run verify:docs` and commit only the report:

```powershell
git add docs/testing/2026-09-08-home-discover-map-ui-qa.md
git commit -m "docs: record home discover map UI QA"
```

## Plan Self-Review

- Spec coverage: Tasks 2–5 cover every asset, Home hierarchy, larger Home/Tab icons, shared list favorite position, Discover Hero/filter row, Map picker/marker/card/default image, and all required state boundaries.
- Contract coverage: Task 1 and Task 5 preserve category strings, page methods, Map marker IDs, nearby cached-location behavior, favorite events, routes, APIs, and database fields.
- Test coverage: Task 6 includes full automated checks, independent code review, independent test execution, WeChat Developer Tools compilation, before/after screenshots, console inspection, and factual QA documentation.
- Type consistency: `categorychange` always emits `{ category: Category | '' }`; `TravelMarker` keeps `id`, coordinates, `iconPath`, `width`, and `height`; no later task expects a Map `coverUrl`.
- Placeholder scan: all file paths, resource dimensions, byte ceilings, event names, test commands, visual states, and commit boundaries are explicit.

# Provided Asset Four-Tab UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the user-provided banner and illustration assets to a consistent, modern visual redesign of the Home, Discover, Map, and Me tabs without changing mini-program behavior.

**Architecture:** Keep all data, routes, event handlers, component properties, cloud calls, and map behavior intact. Add only optimized derived static assets, visual WXML rearrangement that preserves existing bindings, and WXSS/token updates. The existing native `tabBar` remains the navigation shell; its paths change only to optimized provided-image derivatives.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/TypeScript, Node.js ESM build scripts, Vitest, existing `scripts/build.mjs` and `scripts/check-package.mjs`.

## Global Constraints

- Preserve all cloud functions, Dify calls/configuration, database fields, interface parameters, map SDK behavior, location-authorisation timing, routes, and `bind*` business events.
- Do not add a parking category, an opinion-feedback route, a custom Tab bar, a UI framework, or a runtime dependency.
- Retain the user originals in `D:\ChatGPT\宜昌旅游助手\icon+banner`; only derived exports enter `miniprogram/assets/provided/`.
- Keep native Tab order and routes exactly `home`, `discover`, `map`, `me`; navigation and safe-area behavior remain native.
- Use `#FFFFFF`, `#F8F7FC`, `#1F1D2B`, `#827A93`, `#7454D8`, and sparing `#F6C644` only; no full-screen or full-card purple fills.
- The generated mini-program package must stay at or below `1_900_000` bytes, enforced by `node scripts/check-package.mjs`. New derived assets must total at most 700 KB: Hero images at most 450 KB, all icon assets at most 250 KB.
- `首页头图.png` intentionally retains its embedded “峡江胜境·诗画宜昌” lettering; homepage code must not render a second synonymous headline. `发现头图.png` remains a text-free background with WXML copy.
- `停车场.png` and `意见反馈.png` are not used because no matching current category/route/event exists.
- Every independent code task adds or updates automated tests, runs a focused test cycle, passes review, and gets a focused Conventional Commit.

---

## File Map

| File or directory | Responsibility |
| --- | --- |
| `miniprogram/assets/provided/` | Optimized, checked-in derivatives of user-supplied Hero, shortcut, category, Tab, favorite, and menu illustrations. |
| `miniprogram/app.json` | Existing native Tab configuration with derivative icon paths only. |
| `miniprogram/styles/tokens.wxss`, `miniprogram/app.wxss` | Global color, typography, spacing, white navigation surface and visual primitives. |
| `miniprogram/pages/home/index.wxml`, `index.wxss` | Home Hero, paired AI shortcut cards, categories, and featured content composition. |
| `miniprogram/pages/discover/index.wxml`, `index.wxss` | Discover Hero, compact filtering/search surface, and shared-list page hierarchy. |
| `miniprogram/components/place-card/index.wxml`, `index.wxss` | Shared larger-image place row and non-obscuring favorite control. |
| `miniprogram/components/category-filter/index.wxml`, `index.wxss` | Existing all/four-category filter visual treatment without changing emitted category values. |
| `miniprogram/pages/map/index.wxss` | Map-first floating filter, actions and selected-place sheet styling. |
| `miniprogram/pages/me/index.wxml`, `index.wxss` | Existing personal menu rendered with four matching supplied assets. |
| `miniprogram/pages/place-detail/index.wxml`, `index.wxss` | Existing detail favorite visual aligned with the shared place card. |
| `miniprogram/components/async-state/index.wxss`, `feedback-toast/index.wxss` | Loading, empty, error and feedback presentation under the same token system. |
| `tests/unit/provided-assets-ui.test.ts` | User-resource mapping, dimensions, byte budgets, WXML bindings and scope-regression tests. |
| `tests/unit/visual-style.test.ts` | Existing visual contract updated from generated icon/SVG assumptions to optimized supplied-image paths. |
| `docs/testing/2026-09-08-provided-assets-four-tab-ui-qa.md` | Independent test handoff and final factual verification record. |

## Task 1: Establish the asset and behavior contract before changing visuals

**Files:**
- Create: `tests/unit/provided-assets-ui.test.ts`
- Modify: `tests/unit/visual-style.test.ts`
- Test: `tests/unit/provided-assets-ui.test.ts`, `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: existing `miniprogram/app.json`, page WXML, CSS, and future asset paths under `miniprogram/assets/provided/`.
- Produces: executable protection that allows visual changes but rejects route/event/data/business changes and oversized/missing user-derived assets.

- [ ] **Step 1: Write the failing resource-contract test**

Create `tests/unit/provided-assets-ui.test.ts` with an asset table and direct behavior assertions:

```ts
import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = 'miniprogram/assets/provided';
const assets = [
  ['home-hero.jpg', 0, 450_000], ['discover-hero.jpg', 0, 450_000],
  ['ai-chat.png', 120, 60_000], ['trip-plan.png', 120, 60_000],
  ['category-all.png', 96, 30_000], ['category-scenic.png', 96, 30_000], ['category-restaurant.png', 96, 30_000],
  ['category-culture.png', 96, 30_000], ['category-camping.png', 96, 30_000],
  ['tab-home.png', 81, 20_000], ['tab-home-active.png', 81, 20_000],
  ['tab-discover.png', 81, 20_000], ['tab-discover-active.png', 81, 20_000],
  ['tab-map.png', 81, 20_000], ['tab-map-active.png', 81, 20_000],
  ['tab-me.png', 81, 20_000], ['tab-me-active.png', 81, 20_000],
  ['favorite.png', 64, 20_000], ['favorite-active.png', 64, 20_000],
  ['menu-favorite.png', 96, 30_000], ['menu-history.png', 96, 30_000],
  ['menu-ai.png', 96, 30_000], ['menu-preferences.png', 96, 30_000],
] as const;

function pngDimension(bytes: Buffer, offset: number) { return bytes.readUInt32BE(offset); }

describe('provided visual assets and UI boundary', () => {
  it('ships optimized derivatives within the agreed visual budget', async () => {
    let total = 0;
    for (const [file, width, maxBytes] of assets) {
      const path = `${root}/${file}`; const bytes = await readFile(path); const info = await stat(path);
      total += info.size; expect(info.size).toBeLessThanOrEqual(maxBytes);
      if (width) { expect(bytes.subarray(1, 4).toString()).toBe('PNG'); expect(pngDimension(bytes, 16)).toBe(width); expect(pngDimension(bytes, 20)).toBe(width); }
    }
    expect(total).toBeLessThanOrEqual(700_000);
  });

  it('keeps routes, bindings and supported category values while replacing only presentation', async () => {
    const [app, home, map, me] = await Promise.all([
      readFile('miniprogram/app.json', 'utf8'), readFile('miniprogram/pages/home/index.wxml', 'utf8'),
      readFile('miniprogram/pages/map/index.wxml', 'utf8'), readFile('miniprogram/pages/me/index.ts', 'utf8'),
    ]);
    expect(JSON.parse(app).tabBar.list.map((item: { pagePath: string }) => item.pagePath)).toEqual(['pages/home/index', 'pages/discover/index', 'pages/map/index', 'pages/me/index']);
    expect(home).toContain('bindtap="openAiChat"'); expect(home).toContain('bindtap="openTripForm"');
    expect(map).toContain('bindtap="locateNearby"'); expect(me).not.toContain('意见反馈'); expect(me).not.toContain('parking');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/provided-assets-ui.test.ts`

Expected: FAIL because `miniprogram/assets/provided/` does not yet exist.

- [ ] **Step 3: Update the old visual test’s assumptions**

Replace generated-SVG assertions in `tests/unit/visual-style.test.ts` with checks that `app.json` paths use `/assets/provided/tab-*.png`, the four category resources use `/assets/provided/category-*.png`, and both Hero WXML files use `/assets/provided/home-hero.jpg` and `/assets/provided/discover-hero.jpg`. Preserve assertions that Tab routes, white native surfaces, `openAiChat`, `openTripForm`, map interaction and shared feedback behavior remain present.

- [ ] **Step 4: Run the updated visual test and record expected failure**

Run: `node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/visual-style.test.ts`

Expected: FAIL only for missing provided paths/assets and old WXML layout expectations; no TypeScript/service test changes.

- [ ] **Step 5: Commit the test contract**

```powershell
git add tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts
git commit -m "test: define provided visual asset contract"
```

## Task 2: Produce optimized derivatives and wire the native Tab asset paths

**Files:**
- Create: all files named in `tests/unit/provided-assets-ui.test.ts` beneath `miniprogram/assets/provided/`
- Modify: `miniprogram/app.json`
- Modify: `tests/unit/provided-assets-ui.test.ts` only if actual JPEG dimension assertions are needed
- Test: `tests/unit/provided-assets-ui.test.ts`, `tests/unit/build.test.ts`

**Interfaces:**
- Consumes: untouched originals in `icon+banner`, the exact target-name table from Task 1, and the existing native `tabBar` schema.
- Produces: small raster assets and the same four Tab routes with new `iconPath` / `selectedIconPath` strings.

- [ ] **Step 1: Export assets outside the original folder**

Create `miniprogram/assets/provided/` and derive files using a one-off local image export workflow; do not add a package dependency or a runtime image processor. Use these exact source-to-target mappings:

```text
首页头图.png              -> home-hero.jpg
发现头图.png              -> discover-hero.jpg
自由问答.png              -> ai-chat.png
行程定制.png              -> trip-plan.png
景区.png / 餐馆.png / 博物馆.png / 露营地.png
                       -> category-scenic.png / category-restaurant.png / category-culture.png / category-camping.png
全部.png                -> category-all.png
首页.png / 首页-选中.png  -> tab-home.png / tab-home-active.png
发现.png / 发现-选中.png  -> tab-discover.png / tab-discover-active.png
地图.png / 地图-选中.png  -> tab-map.png / tab-map-active.png
我的.png / 我的-选中.png  -> tab-me.png / tab-me-active.png
未收藏.png / 已收藏.png  -> favorite.png / favorite-active.png
已收藏.png / 浏览记录.png / AI 问答记录.png / 旅行偏好.png
                       -> menu-favorite.png / menu-history.png / menu-ai.png / menu-preferences.png
```

Export rules: crop empty outer white canvas to the artwork’s visual bounds with 8–12% breathing room; use square 120px shortcut graphics, 96px category/menu graphics, 81px Tab graphics, and 64px favorite graphics. Make Tab graphics white-background-compatible and center them on the 81px canvas. Export the Home Hero as a high-quality JPEG that preserves the supplied lettering; export Discover Hero as a 16:9-ish JPEG without added lettering. Verify the target table’s per-file size caps before adding files to Git.

- [ ] **Step 2: Update only native icon paths in `app.json`**

Keep all labels and routes unchanged. The four list entries become:

```json
{
  "pagePath": "pages/home/index",
  "text": "首页",
  "iconPath": "assets/provided/tab-home.png",
  "selectedIconPath": "assets/provided/tab-home-active.png"
}
```

Use the same `tab-discover`, `tab-map`, and `tab-me` naming pattern for the remaining existing entries. Do not add `custom: true`, do not reorder the list, and do not alter `pages`.

- [ ] **Step 3: Run the asset and package checks**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts
node .local-tools\package\bin\npm-cli.js run build
node scripts\check-package.mjs
```

Expected: visual/resource tests PASS; build completes; package check prints `Client routes, resources and boundary verified`.

- [ ] **Step 4: Commit the derived assets and native paths**

```powershell
git add miniprogram/assets/provided miniprogram/app.json tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts
git commit -m "feat: add optimized provided visual assets"
```

## Task 3: Rebuild the shared visual primitives, category filter and place card

**Files:**
- Modify: `miniprogram/styles/tokens.wxss`, `miniprogram/app.wxss`
- Modify: `miniprogram/components/category-filter/index.wxml`, `index.wxss`
- Modify: `miniprogram/components/place-card/index.wxml`, `index.wxss`
- Modify: `miniprogram/pages/place-detail/index.wxml`, `index.wxss`
- Modify: `miniprogram/components/async-state/index.wxss`, `miniprogram/components/feedback-toast/index.wxss`
- Modify: `tests/unit/components.test.ts`, `tests/unit/visual-style.test.ts`
- Test: `tests/unit/components.test.ts`, `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: existing component properties (`value`, `place`, `pending`, `visible`, `tone`, `message`) and all existing component events.
- Produces: the common surface used by Home, Discover, map overlays, detail, empty/error states and feedback without altering component API shapes.

- [ ] **Step 1: Write failing component assertions**

Add assertions that the category component preserves `data-value="{{item.value}}"` and `bindtap="onSelect"`, but renders the all/category icon path safely; the place card preserves `bind:open` / `favoritechange`, uses `favorite.png` and `favorite-active.png`, and has a cover-overlay favorite class. Add assertions that no component WXSS uses a tag-name descendant selector such as `.favorite text`.

```ts
expect(filters).toContain('data-value="{{item.value}}"');
expect(filters).toContain('bindtap="onSelect"');
expect(card).toContain('/assets/provided/favorite.png');
expect(card).toContain('cover-favorite');
expect(cardStyle).not.toMatch(/\.favorite\s+text/);
```

- [ ] **Step 2: Run the focused test to verify failure**

Run: `node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/components.test.ts tests/unit/visual-style.test.ts`

Expected: FAIL on the new presentation assertions only.

- [ ] **Step 3: Implement the minimal visual-only component changes**

Use image markup that retains current WXML loops and event sources:

```xml
<button wx:for="{{options}}" wx:key="value" class="filter {{value === item.value ? 'selected' : ''}}" data-value="{{item.value}}" bindtap="onSelect">
  <image class="filter-icon" src="{{item.value ? '/assets/provided/category-' + item.value + '.png' : '/assets/provided/category-all.png'}}" mode="aspectFit" />
  <text>{{item.label}}</text>
</button>
```

Keep `onSelect` unchanged. In the place card, make the existing cover wrapper `position: relative`, keep the existing open area and favorite event separate, and render the chosen favorite image from existing `place.isFavorite` state. The favorite button must remain a button with `loading`, `disabled`, `catchtap="onFavorite"`, and its existing `aria-label`.

Use tokenized white surfaces, `20–24rpx` image corners, an approximately 40% cover width, two-line intro clamp, and a small cover-corner favorite control. Replace only presentational pseudo-element icons in the detail favorite and states with provided asset images; retain all names, fields, status branches and text.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/components.test.ts tests/unit/visual-style.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Request independent UI review before commit**

Give the reviewer the diff and require confirmation that: title text is not covered; `catchtap` prevents favorite from opening a place; category values still emit unchanged; detail favorite remains accessible; no forbidden component selector warning is reintroduced.

- [ ] **Step 6: Commit shared visual components**

```powershell
git add miniprogram/styles/tokens.wxss miniprogram/app.wxss miniprogram/components/category-filter miniprogram/components/place-card miniprogram/components/async-state/index.wxss miniprogram/components/feedback-toast/index.wxss miniprogram/pages/place-detail tests/unit/components.test.ts tests/unit/visual-style.test.ts
git commit -m "feat: unify provided asset visual components"
```

## Task 4: Recompose the Home page around the supplied Hero and paired AI actions

**Files:**
- Modify: `miniprogram/pages/home/index.wxml`, `miniprogram/pages/home/index.wxss`
- Modify: `tests/unit/provided-assets-ui.test.ts`, `tests/unit/visual-style.test.ts`
- Test: `tests/unit/provided-assets-ui.test.ts`, `tests/unit/visual-style.test.ts`, `tests/unit/navigation.test.ts`

**Interfaces:**
- Consumes: unchanged Home page methods `openDiscover`, `onCategoryTap`, `openPlace`, `onFavorite`, `openAiChat`, `openTripForm` and data fields `categories`, `featured`, `featuredStatus`, `feedback`.
- Produces: Hero-first Home layout with exactly one instance each of free chat and trip planning actions.

- [ ] **Step 1: Write the failing Home-layout assertions**

Add checks that the first Home content block references `/assets/provided/home-hero.jpg`; it contains `bindtap="openDiscover"`; the former `home-intro` and lower `ai-entry-list` are absent; `ai-chat.png` and `trip-plan.png` occur in an `ai-quick-grid`; both original navigation bindings occur once; and the disclaimer remains.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts`

Expected: FAIL because the old title area, old banner path and lower vertical AI rows still exist.

- [ ] **Step 3: Implement the structure without changing any handlers**

Use this WXML skeleton, retaining the existing category and featured blocks verbatim after it:

```xml
<view class="home-hero" bindtap="openDiscover" aria-role="button" aria-label="浏览宜昌地点">
  <image class="home-hero-image" src="/assets/provided/home-hero.jpg" mode="aspectFill" />
  <view class="home-hero-shade"></view>
  <button class="home-hero-action" catchtap="openDiscover">浏览所有地点</button>
</view>
<view class="assistant-section">
  <view class="section-heading compact-heading"><text class="section-title">旅行助手</text><text class="section-note">从灵感到行程</text></view>
  <view class="ai-quick-grid">
    <button class="ai-quick-card" bindtap="openAiChat"><image src="/assets/provided/ai-chat.png" mode="aspectFit" /><text>自由问答</text><text>景点与出行建议</text></button>
    <button class="ai-quick-card" bindtap="openTripForm"><image src="/assets/provided/trip-plan.png" mode="aspectFit" /><text>行程定制</text><text>按偏好规划旅程</text></button>
  </view>
</view>
```

Style the Home Hero at `28rpx` radius with a restrained bottom/side contrast veil only where the small action needs it; do not add a code-rendered title that duplicates the image lettering. Use an equal-width two-column grid, a white background, thin border, balanced internal space and no full-purple card for AI shortcuts. Keep the existing `state-shell`, category event attributes, featured `place-card`, feedback component and disclaimer.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: PASS, with no edits to `pages/home/index.ts`.

- [ ] **Step 5: Request independent UI review before commit**

Require the reviewer to inspect rendered Home on the iPhone 12/13 simulator for: supplied lettering fully visible; no duplicate headline; AI cards visually balanced; category labels readable; large place cover; favorite not overlapping a title; disclaimer visible.

- [ ] **Step 6: Commit the Home composition**

```powershell
git add miniprogram/pages/home/index.wxml miniprogram/pages/home/index.wxss tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts
git commit -m "feat: compose home around provided travel assets"
```

## Task 5: Apply the shared card system to Discover and the content-detail favorite

**Files:**
- Modify: `miniprogram/pages/discover/index.wxml`, `miniprogram/pages/discover/index.wxss`
- Modify: `miniprogram/pages/place-detail/index.wxml`, `miniprogram/pages/place-detail/index.wxss` if Task 3 did not complete the detail visual alignment
- Modify: `tests/unit/provided-assets-ui.test.ts`, `tests/unit/visual-style.test.ts`
- Test: `tests/unit/place-pages.test.ts`, `tests/unit/provided-assets-ui.test.ts`, `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: unchanged Discover methods `onCategoryChange`, `onKeywordInput`, `onSearch`, `openPlace`, `onFavorite`, `onRetry`; existing `place-card` contract.
- Produces: Discover Hero and shared large-image list without new filtering data or duplicate card implementation.

- [ ] **Step 1: Write failing Discover assertions**

Assert that Discover WXML contains `/assets/provided/discover-hero.jpg`, the existing `category-filter`, the existing input bindings and one `place-card` loop. Assert it does not contain the retired `discover-riverside.jpg` path and uses a `discover-hero-copy` code overlay.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/place-pages.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts`

Expected: FAIL only on the new Hero contract.

- [ ] **Step 3: Implement the Discover Hero and visual hierarchy**

Keep page bindings and status blocks intact. Replace only the banner surface with:

```xml
<view class="discover-hero">
  <image class="discover-hero-image" src="/assets/provided/discover-hero.jpg" mode="aspectFill" />
  <view class="discover-hero-shade"></view>
  <view class="discover-hero-copy"><text>发现宜昌</text><text>把下一次出发，放进今天。</text></view>
</view>
```

Place category filters and search below the Hero in the current order. Make the search surface a white bordered field with a compact action, preserve `bindinput`, `bindconfirm` and `bindtap`, and use the shared `place-card` rather than an additional Discover-only card class. Preserve loading/empty/error blocks and feedback toast exactly.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/place-pages.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: PASS.

- [ ] **Step 5: Commit Discover and detail visual consistency**

```powershell
git add miniprogram/pages/discover miniprogram/pages/place-detail tests/unit/place-pages.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts
git commit -m "feat: align discovery with shared travel cards"
```

## Task 6: Restyle Map and Me with existing behavior and supplied imagery

**Files:**
- Modify: `miniprogram/pages/map/index.wxss`
- Modify: `miniprogram/pages/me/index.wxml`, `miniprogram/pages/me/index.wxss`
- Modify: `tests/unit/map-nearby-page.test.ts`, `tests/unit/profile-pages.test.ts`, `tests/unit/provided-assets-ui.test.ts`
- Test: `tests/unit/map-nearby-page.test.ts`, `tests/unit/profile-pages.test.ts`, `tests/unit/provided-assets-ui.test.ts`

**Interfaces:**
- Consumes: unchanged Map bindings (`locateNearby`, `onOpenSettings`, `openSelectedPlace`, marker handling) and Me `entries` data / `openEntry` / `showPrivacy` methods.
- Produces: map-first control overlays and four supplied-image menu entries without changing map or personal-navigation behavior.

- [ ] **Step 1: Write failing regression assertions**

Extend existing tests to assert the map still includes `map`, `category-filter`, `locateNearby`, selected-place `openSelectedPlace`, and that the Me WXML image paths map only the four existing `item.icon` values. Assert no `意见反馈` text, no new `wx.navigateTo` target and no `custom-tab-bar` directory reference.

```ts
expect(meMarkup).toContain("/assets/provided/menu-{{item.icon}}.png");
expect(meLogic).not.toContain('意见反馈');
expect(mapMarkup).toContain('bindtap="locateNearby"');
expect(mapMarkup).toContain('bindtap="openSelectedPlace"');
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/map-nearby-page.test.ts tests/unit/profile-pages.test.ts tests/unit/provided-assets-ui.test.ts`

Expected: FAIL on new supplied-menu-image and visual class assertions only.

- [ ] **Step 3: Implement Map and Me presentation changes**

Keep Map WXML and TypeScript unchanged. In Map WXSS, leave `.city-map` full-screen; use `pointer-events: none` on the wrapper and `pointer-events: auto` only for interactive filters/actions; style controls with white `rgba(..., .96)` surfaces, thin borders and native-safe bottom spacing. Do not add a map Hero.

In Me WXML, keep the `wx:for`, `bindtap="openEntry"` and `data-url` unchanged; replace only the icon view with:

```xml
<image class="menu-icon" src="/assets/provided/menu-{{item.icon}}.png" mode="aspectFit" aria-hidden="true" />
```

Derivative menu files match current data values exactly: `menu-favorite.png`, `menu-history.png`, `menu-ai.png`, `menu-preferences.png`. Style the profile as a quiet travel identity row and menu as aligned white rows with 96px-derived icon images; keep privacy as its existing button and no feedback entry.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/map-nearby-page.test.ts tests/unit/profile-pages.test.ts tests/unit/provided-assets-ui.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: PASS, with no edits to `pages/map/index.ts` or `pages/me/index.ts`.

- [ ] **Step 5: Request independent UI review before commit**

Require the reviewer to check Map touch surfaces do not block map pan/zoom, selected-place panel remains above actions, Me icon/image alignment is consistent, and only current four menu destinations remain.

- [ ] **Step 6: Commit Map and Me visual changes**

```powershell
git add miniprogram/pages/map/index.wxss miniprogram/pages/me/index.wxml miniprogram/pages/me/index.wxss tests/unit/map-nearby-page.test.ts tests/unit/profile-pages.test.ts tests/unit/provided-assets-ui.test.ts
git commit -m "feat: restyle map and profile travel surfaces"
```

## Task 7: Full verification, independent testing and delivery record

**Files:**
- Create: `docs/testing/2026-09-08-provided-assets-four-tab-ui-qa.md`
- Modify: `tests/unit/provided-assets-ui.test.ts` only if a verified issue requires a regression assertion
- Test: all existing automated checks plus available WeChat simulator checks

**Interfaces:**
- Consumes: final implementation commit hashes and the existing `team-handoff.md` reporting format.
- Produces: factual independent-test record; no claims of simulator or device verification that did not occur.

- [ ] **Step 1: Run the complete development verification suite**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
node .local-tools\package\bin\npm-cli.js run build
node scripts\check-package.mjs
node .local-tools\package\bin\npm-cli.js run verify:docs
git diff --check
```

Expected: all checks exit 0. If the sandbox blocks build fixtures under the system temp directory, rerun the same full `npm test` command with approved local permissions and record that environmental restriction precisely.

- [ ] **Step 2: Have an independent test role execute the acceptance pass**

Supply the tester the final commit and these exact checks:

```text
1. iPhone 12/13 simulator: Home Hero lettering is visible, no duplicate code title, AI actions are horizontally paired, categories fit, favorite never overlaps a place title.
2. Discover: supplied Hero appears, category/search controls function, loaded list matches Home card geometry, empty/error/retry state is legible.
3. Map: panning/zooming works with overlays, category filtering works, location trigger and rejected-permission UI remain available, selected marker opens detail.
4. Me: exactly four existing navigation entries open their old destinations, privacy still opens its old page, no feedback entry exists.
5. Tab: each native icon has correct selected/idle artwork; safe area does not cover content.
6. Read the console for unsupported component WXSS selectors; report any occurrence as a defect.
```

The tester must run or explicitly mark unavailable every item, then report the actual commit, commands, screenshots or observations, defects, severity, pass scope and untested scope.

- [ ] **Step 3: Fix any independently reported UI defect with a new regression test**

For every reproducible defect, first add a focused assertion in `tests/unit/provided-assets-ui.test.ts` or the most relevant existing unit test, run it to verify failure, apply only the visual fix, rerun its focused test, request tester retest, and make a separate `fix:` commit. Do not change services or page TypeScript to hide a visual defect.

- [ ] **Step 4: Write the independent QA record**

Create `docs/testing/2026-09-08-provided-assets-four-tab-ui-qa.md` only after the independent test run. First run `git rev-parse HEAD` and write that exact output after `被测提交：`. The completed record must use this structure with factual values from the run, never blank or sample values:

```markdown
# 用户提供资源四 Tab UI 验收记录

- 测试角色：独立测试
- 被测提交：`git rev-parse HEAD` 的实际输出
- 日期：2026-09-08

## 自动化检查

| 命令 | 结果 | 证据/备注 |
| --- | --- | --- |
| `npm test` | 实际通过、失败或环境阻断状态 | 实际测试文件和断言数量，或完整阻断原因 |

## 模拟器复核

| 页面/状态 | 结果 | 实际观察或阻断原因 |
| --- | --- | --- |
| 首页 | 实际通过、失败或待测状态 | 已见的 Hero、AI 双入口、分类、卡片和收藏结果，或阻断原因 |

## 缺陷与未测项

- 仅列出实际发现的缺陷，或写“本次可测范围未发现缺陷”。未完成的真机、自动化端点或权限路径必须单独列为未测项。
```

- [ ] **Step 5: Commit the QA record separately**

```powershell
git add docs/testing/2026-09-08-provided-assets-four-tab-ui-qa.md
git commit -m "docs: record provided asset UI QA"
```

## Plan Self-Review

- Spec coverage: Task 2 covers every permitted supplied image; Tasks 3–6 cover the four requested tabs, shared place cards, detail favorites, category filters, state/toast styling and native Tab paths; Task 7 covers the required independent testing record.
- Intentional exclusions: no parking category, no feedback route, no custom Tab bar, no cloud/API/Dify/database/routes/TypeScript business edits; each exclusion is guarded by Task 1 or Task 6 tests.
- Cross-task consistency: `menu-ai.png` matches existing `entries[].icon === 'ai'`; all native Tab derivative names are identical in Task 1, Task 2 and `app.json`; no later task requires a new data property or handler.
- Placeholder scan: no incomplete requirement is delegated to an unspecified future task. Binary image exports are enumerated by exact source and target names, dimensions and byte ceilings.

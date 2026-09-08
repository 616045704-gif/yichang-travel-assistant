# Category Tabs, Map Markers, and Travel Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Discover and Map category pickers with the approved local-icon Tabs, add the collapsed inline Discover search, distinguish Map markers and refine its selected-place card, and give Me a restrained travel-pattern identity area without changing any business contract.

**Architecture:** Keep `CATEGORIES`, page routes, services, cloud calls, location timing, marker IDs, list requests and personal menu destinations unchanged. The shared `category-filter` remains the only category control and continues to emit `categorychange: { category }`; Discover adds one page-local `searchExpanded` presentation flag, Map selects a category-specific local marker asset in its existing view-model, and Me remains a WXML/WXSS-only visual change. The main agent integrates all source changes after independent Discover, Map and Me audits, then an independent tester validates the final commit.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/TypeScript, local PNG assets, Node.js ESM utilities, Vitest, TypeScript, ESLint, WeChat Developer Tools through Computer Use when its trusted automation endpoint is available.

## Global Constraints

- Do not modify cloud functions, Dify calls/configuration, database fields, API payloads, service contracts, page routes or location authorization timing.
- Keep category values exactly `'' | 'scenic' | 'restaurant' | 'culture' | 'camping'`; do not add parking or any other business entry.
- Reuse `miniprogram/assets/provided/category-*.png` for category Tabs without redrawing or recoloring the user's artwork.
- Keep `home-hero.jpg` and `discover-hero.jpg` content unchanged; this plan does not modify Home or place-detail.
- Top navigation and native bottom Tab backgrounds remain white; brand purple `#7454D8` is limited to selected states, icons, links and small actions.
- Discover input changes do not issue a request. Only the explicit send button or the keyboard search/confirm event calls the existing `onSearch` method.
- Map marker validation, de-duplication, sort order, ID assignment-before-filtering, coordinates, selection and detail route remain unchanged.
- Map location is still requested only after the user taps `定位我的附近`; denied-location and settings-retry paths remain available.
- Me keeps the existing four entries, their order, descriptions, URLs, `openEntry`, `showPrivacy`, privacy text and version text.
- Preserve unrelated working-tree changes, stage exact paths only and never use `git add .`.
- Every application change starts from a focused failing test, then passes focused and relevant regression checks before its independent Conventional Commit.

---

## File Map

| File | Responsibility |
| --- | --- |
| `miniprogram/components/category-filter/index.ts` | Validate Tab dataset values and preserve the `categorychange` event contract. |
| `miniprogram/components/category-filter/index.wxml` | Render five local-artwork category Tabs in one horizontal `scroll-view`. |
| `miniprogram/components/category-filter/index.wxss` | White Tab track, fixed item geometry and restrained active state. |
| `miniprogram/pages/discover/index.ts` | Hold the UI-only `searchExpanded` flag; preserve the existing request methods. |
| `miniprogram/pages/discover/index.wxml` | Put collapsed/expanded search first and the shared Tab viewport second on one row. |
| `miniprogram/pages/discover/index.wxss` | Animate the fixed left search controller without covering the scrolling category region. |
| `miniprogram/assets/provided/map-marker-*.png` | Four category-distinct purple pin assets derived from the supplied category artwork. |
| `miniprogram/view-models/map.ts` | Select marker `iconPath` by existing category while preserving IDs and coordinates. |
| `miniprogram/pages/map/index.wxml` | Add the supplied category icon to the existing selected-place card. |
| `miniprogram/pages/map/index.wxss` | Full-width floating Tab rail and refined bottom card/safe-area composition. |
| `miniprogram/pages/me/index.wxml` | Travel-pattern Hero, overlapping identity card and icon-shell menu structure. |
| `miniprogram/pages/me/index.wxss` | Pale patterned background, one light shadow and a single quiet menu surface. |
| `tests/unit/components.test.ts` | Shared Tab rendering, validation and event contract. |
| `tests/unit/place-pages.test.ts` | Discover collapsed-search behavior and unchanged request timing. |
| `tests/unit/map-state.test.ts` | Category marker paths, dimensions, stable IDs and selection. |
| `tests/unit/map-nearby-page.test.ts` | Map overlay/card structure and unchanged location behavior. |
| `tests/unit/profile-pages.test.ts` | Me structure and exact existing destinations. |
| `tests/unit/visual-style.test.ts` | Layout, style-token and WeChat component-selector regression checks. |
| `tests/unit/provided-assets-ui.test.ts` | Marker dimensions, distinctness and visual/package budgets. |
| `tests/unit/navigation.test.ts`, `scripts/wechat-smoke.mjs` | Replace retired picker selectors with current Tab/search interaction checks. |
| `docs/testing/2026-09-08-category-tabs-map-me-qa.md` | Independent tester record tied to the tested commit. |

## Task 1: Shared Category Tabs and Inline Discover Search

**Files:**
- Modify: `tests/unit/components.test.ts`
- Modify: `tests/unit/place-pages.test.ts`
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `tests/unit/navigation.test.ts`
- Modify: `scripts/wechat-smoke.mjs`
- Modify: `miniprogram/components/category-filter/index.ts`
- Modify: `miniprogram/components/category-filter/index.wxml`
- Modify: `miniprogram/components/category-filter/index.wxss`
- Modify: `miniprogram/pages/discover/index.ts`
- Modify: `miniprogram/pages/discover/index.wxml`
- Modify: `miniprogram/pages/discover/index.wxss`

**Interfaces:**
- Consumes: `CATEGORIES`, `value: Category | ''`, existing Discover `keyword`, `onKeywordInput`, `onSearch` and `onCategoryChange`.
- Produces: `onTabTap(event)` with unchanged `categorychange: { category }`; `expandSearch()` and `searchExpanded: boolean` used only by Discover markup.

- [ ] **Step 1: Replace picker tests with the failing Tab contract**

Update `tests/unit/components.test.ts` so its template assertion and component definition expect this contract:

```ts
expect(filters).toContain('<scroll-view');
expect(filters).toContain('scroll-x');
expect(filters).toContain('class="category-tabs"');
expect(filters).toContain('wx:for="{{options}}"');
expect(filters).toContain('bindtap="onTabTap"');
expect(filters).not.toContain('<picker');

const options = definition.data.options as Array<{ value: string; label: string }>;
expect(options).toEqual([
  { value: '', label: '全部分类' },
  { value: 'scenic', label: '景区' },
  { value: 'restaurant', label: '餐馆' },
  { value: 'culture', label: '文化馆/博物馆' },
  { value: 'camping', label: '露营地' },
]);
const ctx = instance({ value: '', selectedValue: '', options });
for (const category of ['', 'scenic', 'restaurant', 'culture', 'camping']) {
  ctx.triggerEvent.mockClear();
  definition.methods.onTabTap.call(ctx, { currentTarget: { dataset: { category } } });
  expect(ctx.triggerEvent).toHaveBeenCalledWith('categorychange', { category });
}
for (const category of ['parking', 'unknown', undefined]) {
  ctx.triggerEvent.mockClear();
  definition.methods.onTabTap.call(ctx, { currentTarget: { dataset: { category } } });
  expect(ctx.triggerEvent).not.toHaveBeenCalled();
}
```

Keep an observer test which maps valid external values to `selectedValue` and maps an invalid value to `''`. Stub `wx.getLocation` and `wx.cloud.callFunction` and assert that clicking a category calls neither.

- [ ] **Step 2: Add failing Discover presentation and request-timing tests**

Extend `tests/unit/place-pages.test.ts` with template-order and behavior assertions:

```ts
expect(discover.indexOf('class="discover-search"')).toBeLessThan(discover.indexOf('<category-filter'));
expect(discover).toContain('wx:if="{{!searchExpanded}}"');
expect(discover).toContain('bindtap="expandSearch"');
expect(discover).toContain('aria-label="打开搜索"');
expect(discover).toContain('focus="{{searchExpanded}}"');
expect(discover).toContain('confirm-type="search"');
expect(discover).toContain('bindconfirm="onSearch"');
expect(discover).toContain('aria-label="发送搜索"');
expect(discover).not.toContain('bindinput="onSearch"');
```

Load `pages/discover/index.ts` with stubbed `Page`, `getApp` and `wx.cloud.callFunction`. Assert that initial `searchExpanded` is false, `expandSearch()` changes only that flag, typing `三峡` changes only `keyword`, no cloud call occurs during either action, and `onSearch()` is the first action that reaches the existing list request. Preserve the existing category behavior which clears `keyword` and sends the selected category.

- [ ] **Step 3: Add failing one-row and component-WXSS assertions**

In `tests/unit/visual-style.test.ts`, require one-row flex geometry and class-only component selectors:

```ts
expect(discoverStyle).toMatch(/\.discover-tools\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*nowrap/);
expect(discoverStyle).toMatch(/\.discover-search\s*\{[^}]*flex:\s*0\s+0\s+88rpx/);
expect(discoverStyle).toMatch(/\.discover-search\.is-expanded\s*\{[^}]*flex-basis:\s*360rpx/);
expect(discoverStyle).toMatch(/\.discover-category\s*\{[^}]*flex:\s*1[^}]*min-width:\s*0/);
expect(categoryStyle).toContain('.category-tabs');
expect(categoryStyle).toMatch(/\.category-tab\s*\{[^}]*flex:\s*0\s+0\s+auto[^}]*height:\s*112rpx/);
expect(categoryStyle).toMatch(/\.category-tab-icon\s*\{[^}]*width:\s*56rpx[^}]*height:\s*56rpx/);
expect(categoryStyle).toContain('.category-tab.is-active');
expect(categoryStyle).not.toMatch(/(^|[},]\s*)(?:picker|scroll-view|view|image|text|#|\[)[^{]*\{/m);
```

Update `tests/unit/navigation.test.ts` and `scripts/wechat-smoke.mjs` from `.category-select`/picker-index operations to `.category-tab` dataset values. The smoke contract must require collapsed search before tapping, expanded input/send controls afterward, no result change while typing, a result change only after send or keyboard confirm, and a category click that does not call location.

- [ ] **Step 4: Run the focused tests and verify the new assertions fail**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/components.test.ts tests/unit/place-pages.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts
```

Expected: FAIL because the component is still a picker, Discover search is always expanded and the smoke selectors still target the picker.

- [ ] **Step 5: Implement the shared Tab without changing its public event**

Replace the component logic with the validated dataset adapter:

```ts
import { CATEGORIES, type Category } from '../../../shared/contracts';

type CategoryValue = Category | '';
const OPTIONS: Array<{ value: CategoryValue; label: string }> = [{ value: '', label: '全部分类' }, ...CATEGORIES];

Component({
  properties: {
    value: {
      type: String,
      value: '',
      observer(value: string) {
        const selectedValue = OPTIONS.some(option => option.value === value) ? value : '';
        this.setData({ selectedValue });
      },
    },
  },
  data: { options: OPTIONS, selectedValue: '' as CategoryValue },
  methods: {
    onTabTap(event: WechatMiniprogram.BaseEvent) {
      const category = event.currentTarget.dataset.category;
      if (typeof category !== 'string' || !OPTIONS.some(option => option.value === category)) return;
      this.setData({ selectedValue: category });
      this.triggerEvent('categorychange', { category });
    },
  },
});
```

Use this WXML structure, preserving the five existing local-image paths:

```xml
<scroll-view class="category-tabs" scroll-x enhanced show-scrollbar="{{false}}">
  <view class="category-tabs-track">
    <view wx:for="{{options}}" wx:key="value" class="category-tab {{selectedValue === item.value ? 'is-active' : ''}} {{item.value === 'culture' ? 'is-wide' : ''}}" data-category="{{item.value}}" bindtap="onTabTap" aria-role="button" aria-label="按{{item.label}}筛选">
      <image class="category-tab-icon" src="/assets/provided/category-{{item.value || 'all'}}.png" mode="aspectFit" aria-hidden="true" />
      <text class="category-tab-label">{{item.label}}</text>
    </view>
  </view>
</scroll-view>
```

Style the component with class selectors only: a white single-line track, `16rpx` gap, each item `flex: 0 0 auto`, `112rpx` high, `56rpx` artwork, a wider culture item, and a pale-purple `is-active` surface with thin purple border and purple label.

- [ ] **Step 6: Implement the fixed-left collapsed search**

Add only the UI flag and method to Discover:

```ts
data: {
  ...viewModel.state,
  searchExpanded: false,
  feedback: { visible: false, tone: 'info', message: '' },
},
onShow() {
  this.setData({ searchExpanded: false });
  const app = getApp<TravelApp>();
  const category = app.globalData.pendingDiscoverCategory;
  app.globalData.pendingDiscoverCategory = '';
  if (category) {
    void viewModel.setFilters({ category }).then(() => this.sync());
    return;
  }
  void this.refresh();
},
expandSearch() { this.setData({ searchExpanded: true }); },
```

Do not change `onKeywordInput` or `onSearch`. Replace only the toolbar with:

```xml
<view class="discover-tools">
  <view class="discover-search {{searchExpanded ? 'is-expanded' : ''}}">
    <button wx:if="{{!searchExpanded}}" class="search-trigger" bindtap="expandSearch" aria-label="打开搜索"><view class="search-glyph" aria-hidden="true"></view></button>
    <view wx:else class="search-panel">
      <input class="search-input" value="{{keyword}}" focus="{{searchExpanded}}" placeholder="搜索地点" confirm-type="search" bindinput="onKeywordInput" bindconfirm="onSearch" />
      <button class="search-send" bindtap="onSearch" aria-label="发送搜索"><view class="send-glyph" aria-hidden="true"></view></button>
    </view>
  </view>
  <view class="discover-category"><category-filter id="categories" value="{{category}}" bind:categorychange="onCategoryChange" /></view>
</view>
```

Use `display:flex; flex-wrap:nowrap`. Keep the search controller at `88rpx` collapsed and `360rpx` expanded; give the category wrapper `flex:1; min-width:0`. Keep both controls on the same row, use a white border/shadow, and limit the send button to a small purple surface. Do not overlay or absolutely position the input over the Tabs.

- [ ] **Step 7: Run focused checks and commit the Discover/Tab unit**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/components.test.ts tests/unit/place-pages.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: all commands exit 0; typing alone has zero list calls, and both send bindings target the unchanged `onSearch`.

Commit only these paths:

```powershell
git add -- miniprogram/components/category-filter miniprogram/pages/discover tests/unit/components.test.ts tests/unit/place-pages.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts scripts/wechat-smoke.mjs
git commit -m "feat: add inline search and shared category tabs"
```

## Task 2: Category-Specific Map Markers and Refined Place Card

**Files:**
- Create: `miniprogram/assets/provided/map-marker-scenic.png`
- Create: `miniprogram/assets/provided/map-marker-restaurant.png`
- Create: `miniprogram/assets/provided/map-marker-culture.png`
- Create: `miniprogram/assets/provided/map-marker-camping.png`
- Modify: `tests/unit/map-state.test.ts`
- Modify: `tests/unit/map-nearby-page.test.ts`
- Modify: `tests/unit/provided-assets-ui.test.ts`
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `miniprogram/view-models/map.ts`
- Modify: `miniprogram/pages/map/index.wxml`
- Modify: `miniprogram/pages/map/index.wxss`

**Interfaces:**
- Consumes: existing `MapPlace`, `TravelMarker`, `buildMarkers`, `findPlaceByMarkerId`, `selectedPlace`, `openSelectedPlace` and location actions.
- Produces: `MARKER_ICON_BY_CATEGORY: Record<Category, string>` and four local `88 × 108px` marker assets displayed by WeChat at `44 × 54px`.

- [ ] **Step 1: Add failing marker-path, stable-ID and asset assertions**

Change `tests/unit/map-state.test.ts` to assert:

```ts
const expectedPaths = {
  scenic: '/assets/provided/map-marker-scenic.png',
  restaurant: '/assets/provided/map-marker-restaurant.png',
  culture: '/assets/provided/map-marker-culture.png',
  camping: '/assets/provided/map-marker-camping.png',
};
for (const category of ['scenic', 'restaurant', 'culture', 'camping'] as Category[]) {
  expect(buildMarkers(places, category)[0]).toMatchObject({
    iconPath: expectedPaths[category], width: 44, height: 54,
  });
}
expect(new Set(buildMarkers(places, '').map(marker => marker.iconPath))).toEqual(new Set(Object.values(expectedPaths)));
```

Retain assertions for unchanged coordinates, four stable unique IDs across input reversal and category filtering, no `callout`, invalid-place rejection and the existing detail route.

In `tests/unit/provided-assets-ui.test.ts`, add the four markers at `88 × 108px`, each at most `24_000` bytes; assert their SHA-256 values are pairwise distinct and preserve the existing `1_000_000`-byte provided-assets and `1_900_000`-byte package limits.

- [ ] **Step 2: Add failing map-card and safe-area assertions**

Extend `tests/unit/map-nearby-page.test.ts` and `tests/unit/visual-style.test.ts`:

```ts
expect(markup).toContain('bindmarkertap="onMarkerTap"');
expect(markup).toContain('/assets/provided/category-{{selectedPlace.category}}.png');
expect(markup).toContain('/assets/provided/place-placeholder.jpg');
expect(markup).toContain('{{selectedPlace.name}}');
expect(markup).toContain('bindtap="openSelectedPlace"');
expect(css).toMatch(/\.map-filters\s*\{[^}]*left:\s*20rpx[^}]*right:\s*20rpx/);
expect(css).toMatch(/\.marker-card\s*\{[^}]*border-radius:\s*30rpx[^}]*box-shadow:/);
expect(css).toMatch(/\.marker-name\s*\{[^}]*-webkit-line-clamp:\s*2/);
```

Keep every current authorization, denial, settings retry, cached-coordinate and page-hide test unchanged.

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts
```

Expected: FAIL because Map still references one `map-marker.png`, the four derived assets do not exist and the card lacks a category image.

- [ ] **Step 4: Export four restrained marker assets from the supplied category artwork**

Create four transparent `88 × 108px` PNGs. Each uses the same `#7454D8` pin silhouette and white circular inset; composite the matching committed `category-*.png` inside that inset at identical scale. The exact mapping is:

```text
category-scenic.png     -> map-marker-scenic.png
category-restaurant.png -> map-marker-restaurant.png
category-culture.png    -> map-marker-culture.png
category-camping.png    -> map-marker-camping.png
```

Do not use `category-all.png` or any parking asset. Inspect all four exports at original resolution before coding; their pin geometry must be identical, their inset artwork visibly different and their corners transparent.

- [ ] **Step 5: Select the marker path without changing Map identity logic**

Add a typed path map in `miniprogram/view-models/map.ts`:

```ts
const MARKER_ICON_BY_CATEGORY: Record<Category, string> = {
  scenic: '/assets/provided/map-marker-scenic.png',
  restaurant: '/assets/provided/map-marker-restaurant.png',
  culture: '/assets/provided/map-marker-culture.png',
  camping: '/assets/provided/map-marker-camping.png',
};
```

Change only the final marker projection:

```ts
.map(({ place, id }) => ({
  id,
  latitude: place.latitude,
  longitude: place.longitude,
  iconPath: MARKER_ICON_BY_CATEGORY[place.category],
  width: 44,
  height: 54,
}));
```

Do not change validation, the unique map, sort, ID assignment, filtering order or `findPlaceByMarkerId`.

- [ ] **Step 6: Refine Map overlays while retaining all bindings**

Keep the `<map>`, category component, location actions and their order. Change the selected card category row to:

```xml
<view class="marker-category-row">
  <image class="marker-category-icon" src="/assets/provided/category-{{selectedPlace.category}}.png" mode="aspectFit" aria-hidden="true" />
  <text class="marker-category" wx:if="{{selectedPlace.category === 'scenic'}}">景区</text>
  <text class="marker-category" wx:elif="{{selectedPlace.category === 'restaurant'}}">餐馆</text>
  <text class="marker-category" wx:elif="{{selectedPlace.category === 'culture'}}">文化馆/博物馆</text>
  <text class="marker-category" wx:else>露营地</text>
</view>
```

Make `.map-filters` span from `left:20rpx` to `right:20rpx` with no hard-coded width. Keep the map fully pannable outside controls. Use a white `30rpx` bottom card with one light shadow, `place-placeholder.jpg` on the left, category icon/text and a two-line clamped name on the right, and the same `openSelectedPlace` button. Preserve `bottom: calc(48rpx + env(safe-area-inset-bottom))`, keep `.map-actions` before `.marker-card`, and do not cover denial/settings controls.

- [ ] **Step 7: Run focused checks and commit the Map unit**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts tests/unit/components.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
node scripts\check-package.mjs
```

Expected: all commands exit 0; all-marker mode contains four icon paths, IDs and coordinates remain stable, and no location request occurs during category changes outside the existing nearby flow.

Commit only Map and marker paths:

```powershell
git add -- miniprogram/assets/provided/map-marker-scenic.png miniprogram/assets/provided/map-marker-restaurant.png miniprogram/assets/provided/map-marker-culture.png miniprogram/assets/provided/map-marker-camping.png miniprogram/view-models/map.ts miniprogram/pages/map/index.wxml miniprogram/pages/map/index.wxss tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/visual-style.test.ts
git commit -m "feat: distinguish map markers and place preview"
```

## Task 3: Travel-Pattern Me Page

**Files:**
- Modify: `tests/unit/profile-pages.test.ts`
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `miniprogram/pages/me/index.wxml`
- Modify: `miniprogram/pages/me/index.wxss`

**Interfaces:**
- Consumes: the existing `entries` array, dynamic `menu-{{item.icon}}.png`, `openEntry`, `showPrivacy` and all current text.
- Produces: presentation classes only; no TypeScript or route change.

- [ ] **Step 1: Add failing structure, style and navigation-preservation assertions**

In `tests/unit/profile-pages.test.ts`, require:

```ts
expect(markup).toContain('class="travel-hero"');
expect(markup).toContain('/assets/provided/category-scenic.png');
expect(markup).toContain('/assets/provided/category-camping.png');
expect(markup).toContain('/assets/provided/tab-me-active.png');
expect(markup).toContain('aria-hidden="true"');
expect(markup).toContain('menu-icon-shell menu-icon-shell-{{item.icon}}');
expect(markup).toContain('/assets/provided/menu-{{item.icon}}.png');
expect(markup).not.toContain('意见反馈');
expect(logic).not.toContain('parking');
```

Load the Page definition and call `openEntry` for each existing entry. Assert the exact four URLs and order, assert an empty URL does not navigate, then assert `showPrivacy()` still navigates to `/pages/privacy/index`.

In `tests/unit/visual-style.test.ts`, require `.me-page` to use `var(--color-page)`, `.travel-hero` to be positioned, clipped and pale-gradient, `.travel-motif` to have low opacity and `pointer-events:none`, `.profile-card` to overlap with a negative top margin and use one light shadow, `.menu` to be one white bordered rounded panel, and `.menu-icon` to be exactly `72rpx` square.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/profile-pages.test.ts tests/unit/visual-style.test.ts tests/unit/provided-assets-ui.test.ts
```

Expected: FAIL because Me is still pure white, the profile mark is a CSS dot and there is no travel pattern or icon shell.

- [ ] **Step 3: Implement the Me presentation without editing TypeScript**

Use this structure around the current text and loop:

```xml
<view class="page me-page">
  <view class="travel-hero">
    <image class="travel-motif travel-motif-scenic" src="/assets/provided/category-scenic.png" mode="aspectFit" aria-hidden="true" />
    <image class="travel-motif travel-motif-camping" src="/assets/provided/category-camping.png" mode="aspectFit" aria-hidden="true" />
    <view class="travel-route" aria-hidden="true"></view>
    <view class="chapter-heading"><view><text class="eyebrow">我的旅行</text><text class="page-title">留下你的出发线索</text></view></view>
  </view>
  <view class="profile-card">
    <view class="profile-icon-shell"><image class="profile-icon" src="/assets/provided/tab-me-active.png" mode="aspectFit" aria-hidden="true" /></view>
    <view><text class="profile-title">你好，旅行者</text><text class="profile-subtitle">收藏灵感，规划下一段出发。</text></view>
  </view>
  <view class="menu">
    <view wx:for="{{entries}}" wx:key="title" class="menu-row" bindtap="openEntry" data-url="{{item.url}}">
      <view class="menu-icon-shell menu-icon-shell-{{item.icon}}"><image class="menu-icon" src="/assets/provided/menu-{{item.icon}}.png" mode="aspectFit" aria-hidden="true" /></view>
      <view class="menu-copy"><text class="menu-title">{{item.title}}</text><text class="note">{{item.description}}</text></view><view class="menu-arrow" aria-hidden="true"></view>
    </view>
  </view>
  <button class="privacy-button" bindtap="showPrivacy"><text>隐私说明</text><view class="menu-arrow" aria-hidden="true"></view></button>
  <text class="note personal-note">收藏、浏览、旅行偏好与 AI 问答记录只向对应用户展示。</text>
  <text class="footer-note">宜昌旅游助手 · 基础版</text>
</view>
```

Use a pale lilac-white Hero gradient, two low-opacity supplied motifs and one dotted CSS route with `pointer-events:none`. Give the identity card the only pronounced light shadow and overlap it over the Hero edge. Put the four existing rows in one white bordered panel; use `88rpx` pale icon shells with `72rpx` supplied images and four restrained shell tints. Keep privacy as its own smaller white panel and retain all copy. Do not add an avatar, login, feedback, parking or any new destination.

- [ ] **Step 4: Run focused checks and commit the Me unit**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/profile-pages.test.ts tests/unit/visual-style.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/navigation.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: all commands exit 0 and no change appears in `miniprogram/pages/me/index.ts`.

Commit only the Me paths:

```powershell
git add -- miniprogram/pages/me/index.wxml miniprogram/pages/me/index.wxss tests/unit/profile-pages.test.ts tests/unit/visual-style.test.ts
git commit -m "feat: add a travel identity to the me page"
```

## Task 4: Full Build, Computer-Use Preview and Independent Acceptance

**Files:**
- Create: `docs/testing/2026-09-08-category-tabs-map-me-qa.md`
- Modify: the narrowest relevant source/test only if a verified defect requires a regression fix.

**Interfaces:**
- Consumes: the three focused implementation commits and the current WeChat project configuration.
- Produces: a truthful commit-specific independent QA record and final Git history.

- [ ] **Step 1: Run the complete automated verification suite**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
node .local-tools\package\bin\npm-cli.js run build:dev
node scripts\check-package.mjs
node scripts\verify-docs.mjs
git diff --check
```

Expected: all available commands exit 0. Do not claim a blocked WeChat IDE check passed.

- [ ] **Step 2: Compile and inspect the three pages with Computer Use**

Keep WeChat Developer Tools foreground and visible. Import or select `D:\ChatGPT\宜昌旅游助手\dist`, compile after the development build, then inspect Discover, Map and Me at an iPhone 12/13-sized simulator. Capture local before/after screenshots under `.local/ui-qa/2026-09-08-category-tabs-map-me/` when the UI endpoint is available.

Verify:

```text
Discover: search is the first control; it expands in place; typing alone does not reload; send and keyboard search do; category Tabs remain on the same line and scroll.
Map: top Tabs are touchable without blocking pan/zoom; four categories have visibly different marker art; tapping a marker opens the image/name card; the detail button uses the existing route; location denial/settings controls remain reachable.
Me: pale travel pattern, identity card and one aligned four-entry panel render without overflow; every entry and privacy opens its existing page.
Console: no fatal compile error and no component-WXSS warning caused by tag, ID or attribute selectors.
```

If Computer Use reports that the trusted RPC service is not configured, the automator endpoint cannot attach or a window-state call times out, record that exact limitation and continue with static/build verification; do not invent screenshots or visual results.

- [ ] **Step 3: Obtain independent code/UI review and fix every material finding**

Give the reviewer the final implementation commit and ask them to check the approved design spec, exact route/event preservation, no parking, no input-triggered search, stable marker IDs, class-only component WXSS and the visual hierarchy. For each blocker or important finding, add a focused failing assertion, make the narrow fix, rerun the relevant focused suite and create a separate `fix:` commit.

- [ ] **Step 4: Have an independent tester execute and record acceptance**

The tester must run the full automated suite independently and attempt the same WeChat Developer Tools scenarios. Create `docs/testing/2026-09-08-category-tabs-map-me-qa.md` with:

```markdown
# 分类 Tab、地图与“我的”页面独立验收记录

- 测试角色：独立测试
- 被测提交：`git rev-parse HEAD` 的实际输出
- 日期：2026-09-08

## 自动化检查

| 命令 | 结果 | 证据/备注 |
| --- | --- | --- |
| `npm test` | 实际通过、失败或环境阻断状态 | 实际测试文件与断言数量，或完整阻断原因 |

## 页面与交互

| 页面/状态 | 结果 | 实际观察或阻断原因 |
| --- | --- | --- |
| 发现页搜索与分类 Tab | 实际结果 | 默认、展开、输入、发送、分类滚动 |
| 地图分类、点位与弹卡 | 实际结果 | 四类点位、点选、详情、定位权限 |
| “我的”页 | 实际结果 | 视觉层级、四入口、隐私入口 |

## 缺陷与未测项

- 只记录真实缺陷或明确写“本次可测范围未发现缺陷”。真机、自动化端点或权限路径未完成时必须单独列为未测项。
```

The tester must not describe unavailable simulator or device checks as passed.

- [ ] **Step 5: Commit the QA record separately and report final status**

Run `node scripts/verify-docs.mjs` and `git diff --check`, then:

```powershell
git add -- docs/testing/2026-09-08-category-tabs-map-me-qa.md
git commit -m "test: record category tab and travel profile QA"
```

Report the exact commits, successful checks, discovered defects, Computer Use status, remaining true-device checks and WeChat upload steps. Preserve every unrelated working-tree file.

## Plan Self-Review

- Spec coverage: Task 1 covers the shared five-category Tab and the exact fixed-left collapsed search interaction; Task 2 covers category-distinct markers and the image/text Map card; Task 3 covers the Me travel pattern and current four destinations; Task 4 covers build, Computer Use, independent review and independent test evidence.
- Scope coverage: no Home, place-detail, cloud function, Dify, database, service, API, route, location-timing, parking, feedback or login change is planned.
- Type consistency: `CategoryValue`, `onTabTap`, `searchExpanded`, `MARKER_ICON_BY_CATEGORY`, `selectedPlace.category` and every route/event name are identical in the test and implementation steps.
- Placeholder scan: all requirements, file paths, commands, assertions, dimensions and failure expectations are explicit; no deferred implementation placeholder is present.
- Independent audit: Discover, Map and Me were reviewed separately before this plan; the main agent owns integration, and a separate tester owns the final acceptance record.

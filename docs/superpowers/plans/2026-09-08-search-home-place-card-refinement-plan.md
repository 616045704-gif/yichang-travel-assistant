# Search, Home, and Place Card Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved collapsible Discover search, white Home Hero CTA, centered AI pair, and single-line-first place titles without changing any backend or business contract.

**Architecture:** Keep the current page methods, shared category component, view models, services, routes, and favorite event contract. Add one Discover-only `collapseSearch()` presentation method, replace utility icon rendering with page-local CSS geometry, and solve Home/place-card alignment through WXML/WXSS geometry only. The main agent integrates after two independent read-only audits; an independent test role validates the final commit.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/TypeScript, Vitest, TypeScript, ESLint, existing Node build scripts, WeChat Developer Tools through Computer Use when its trusted RPC endpoint is available.

## Global Constraints

- Do not modify cloud functions, Dify calls/configuration, database fields, service interfaces, page routes, category values, location behavior, or favorite persistence.
- Keep category values exactly `'' | 'scenic' | 'restaurant' | 'culture' | 'camping'`.
- Keep `home-hero.jpg`, `ai-chat.png`, `trip-plan.png`, and the user-provided favorite assets unchanged.
- Search input changes and search collapse must not request data; only the existing `onSearch()` submission path may search.
- Preserve Home/Discover loading, empty, error, pending-favorite, and feedback states.
- Do not alter Map or any unmentioned second-level page.
- Preserve unrelated worktree changes and stage only exact task paths.
- Every application task starts with a focused failing test, passes focused checks, receives independent review, and ends in a focused Conventional Commit.

---

## File Map

| File | Responsibility |
| --- | --- |
| `miniprogram/pages/discover/index.ts` | Add the UI-only search collapse state transition. |
| `miniprogram/pages/discover/index.wxml` | Render line search, close control, input, and paper-plane send control. |
| `miniprogram/pages/discover/index.wxss` | Keep search compact and categories usable; draw the utility icons. |
| `miniprogram/pages/home/index.wxss` | Restyle the existing Hero CTA and center the existing two AI images. |
| `miniprogram/components/place-card/index.wxss` | Give title priority and compact the existing favorite action. |
| `tests/unit/place-pages.test.ts` | Prove collapse is local-only and submission timing stays unchanged. |
| `tests/unit/visual-style.test.ts` | Lock the approved search, Home, and place-card geometry. |
| `tests/unit/components.test.ts` | Lock the shared card title/favorite relationship. |
| `tests/unit/provided-assets-ui.test.ts` | Replace obsolete Home spacing assertions with approved alignment. |
| `scripts/wechat-smoke.mjs` | Exercise search expand, collapse, re-expand, submit, and category access. |
| `tests/unit/navigation.test.ts` | Require the updated smoke interaction contract. |
| `docs/testing/2026-09-08-search-home-place-card-qa.md` | Record independent, commit-specific acceptance evidence. |

## Task 1: Collapsible Discover Search

**Files:**
- Modify: `tests/unit/place-pages.test.ts`
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `tests/unit/navigation.test.ts`
- Modify: `scripts/wechat-smoke.mjs`
- Modify: `miniprogram/pages/discover/index.ts`
- Modify: `miniprogram/pages/discover/index.wxml`
- Modify: `miniprogram/pages/discover/index.wxss`

**Interfaces:**
- Consumes: existing `searchExpanded`, `keyword`, `expandSearch()`, `onKeywordInput()`, `onSearch()`, and `category-filter`.
- Produces: `collapseSearch(): void`, which sets only `{ searchExpanded: false }`.

- [ ] **Step 1: Write the failing interaction test**

Extend the Discover page harness type and assertions in `tests/unit/place-pages.test.ts`:

```ts
type DiscoverPage = {
  data: { searchExpanded: boolean; keyword: string };
  setData(value: Record<string, unknown>): void;
  expandSearch(): void;
  collapseSearch(): void;
  onKeywordInput(event: { detail: { value: string } }): void;
  onSearch(): void;
};

page!.expandSearch();
page!.onKeywordInput({ detail: { value: '三峡' } });
page!.collapseSearch();
expect(page!.data).toMatchObject({ searchExpanded: false, keyword: '三峡' });
expect(callFunction).not.toHaveBeenCalled();
page!.expandSearch();
page!.onSearch();
```

Add markup assertions for `bindtap="collapseSearch"`, `aria-label="关闭搜索"`, `class="search-line-icon"`, and `class="send-glyph"`. Remove assertions requiring `/assets/icons/discover-active.png`, the text `发送`, or a `400rpx` expansion.

- [ ] **Step 2: Write the failing visual contract**

In `tests/unit/visual-style.test.ts`, require:

```ts
expect(discover).toContain('bindtap="collapseSearch"');
expect(discover).toContain('aria-label="关闭搜索"');
expect(discover).toContain('class="send-glyph"');
expect(discover).not.toContain('/assets/icons/discover-active.png');
expect(discover).not.toContain('>发送</button>');
expect(discoverStyle).toMatch(/\.discover-search\.is-expanded\s*\{[^}]*flex-basis:\s*324rpx/);
expect(discoverStyle).toMatch(/\.search-send\s*\{[^}]*background:\s*transparent/);
expect(discoverStyle).toMatch(/\.send-glyph\s*\{[^}]*width:\s*30rpx[^}]*height:\s*30rpx/);
expect(discoverStyle).toContain('.search-line-icon::after');
```

Update `tests/unit/navigation.test.ts` to require `scripts/wechat-smoke.mjs` to locate `.search-close`, verify the expanded input disappears after close, re-expand, and only then submit.

- [ ] **Step 3: Run the focused tests and verify failure**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/place-pages.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts
```

Expected: FAIL because `collapseSearch`, the close control, line icons, compact expansion, and updated smoke path do not exist.

- [ ] **Step 4: Implement the local-only collapse method**

Add next to `expandSearch()` in `miniprogram/pages/discover/index.ts`:

```ts
collapseSearch() { this.setData({ searchExpanded: false }); },
```

Do not edit `onKeywordInput()`, `onSearch()`, `onCategoryChange()`, the view model, or services.

- [ ] **Step 5: Replace the search toolbar markup**

Use this inner search structure in `miniprogram/pages/discover/index.wxml`:

```xml
<view class="discover-search {{searchExpanded ? 'is-expanded' : ''}}">
  <view wx:if="{{!searchExpanded}}" class="search-trigger-shell">
    <view class="search-line-icon" aria-hidden="true"></view>
    <button class="search-trigger" hover-class="search-control-pressed" bindtap="expandSearch" aria-label="打开搜索"></button>
  </view>
  <view wx:else class="search-panel">
    <view class="search-close-shell">
      <view class="close-glyph" aria-hidden="true"></view>
      <button class="search-close" hover-class="search-control-pressed" bindtap="collapseSearch" aria-label="关闭搜索"></button>
    </view>
    <input class="search-input" value="{{keyword}}" focus="{{searchExpanded}}" placeholder="搜索地点" aria-label="搜索地点" confirm-type="search" bindinput="onKeywordInput" bindconfirm="onSearch" />
    <view class="search-send-shell">
      <view class="send-glyph" aria-hidden="true"></view>
      <button class="search-send" hover-class="search-control-pressed" bindtap="onSearch" aria-label="发送搜索"></button>
    </view>
  </view>
</view>
```

Keep the adjacent `discover-category` markup and binding unchanged.

- [ ] **Step 6: Apply compact geometry and page-local icons**

In `miniprogram/pages/discover/index.wxss`, use `324rpx` expanded width, a `112rpx` white panel, `10rpx` gaps, `12rpx` horizontal padding, a `64rpx` transparent close hit area, and a `68rpx` transparent send hit area. Draw the magnifier with a `28rpx` circular border and a short `::after` handle; draw the close with two `26rpx` crossing strokes; draw a `30rpx` purple paper plane using one outlined wedge and center fold. Buttons remain absolutely over their icon shells, with `background: transparent`, and `search-control-pressed` uses only a pale circular hover surface.

- [ ] **Step 7: Update the smoke sequence**

After current search expansion in `scripts/wechat-smoke.mjs`, assert `.search-close` exists, tap it, assert `.search-input` is absent, assert a category tab still exists, then tap `.search-trigger` again before typing and submitting. Retain the existing proof that typing does not request and submission does.

- [ ] **Step 8: Run checks, request review, and commit**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/place-pages.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: all commands exit 0. Have an independent reviewer confirm that closing is local-only and categories remain reachable. Then commit only the Task 1 files with `fix: refine discover search controls`.

## Task 2: Home CTA, AI Pair, and Place Title Width

**Files:**
- Modify: `tests/unit/components.test.ts`
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `tests/unit/provided-assets-ui.test.ts`
- Modify: `miniprogram/pages/home/index.wxss`
- Modify: `miniprogram/components/place-card/index.wxss`

**Interfaces:**
- Consumes: existing Home markup and methods; existing place-card WXML, `open`, and `favoritechange` events.
- Produces: presentation-only CSS; no TypeScript or WXML contract change.

- [ ] **Step 1: Write failing Home geometry assertions**

Replace obsolete `24rpx`/`90%` assertions in `tests/unit/provided-assets-ui.test.ts` and extend `tests/unit/visual-style.test.ts`:

```ts
expect(homeStyle).toMatch(/\.home-hero-action\s*\{[^}]*top:\s*50%[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*\.94\)[^}]*color:\s*var\(--color-brand\)/);
expect(homeStyle).toMatch(/\.home-hero-shade\s*\{[^}]*display:\s*none/);
expect(homeStyle).toMatch(/\.ai-quick-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*288rpx\)[^}]*justify-content:\s*center[^}]*gap:\s*20rpx/);
expect(homeStyle).toMatch(/\.ai-quick-card\s*\{[^}]*width:\s*288rpx/);
expect(homeStyle).toMatch(/\.ai-quick-image\s*\{[^}]*width:\s*100%/);
```

- [ ] **Step 2: Write failing shared-card assertions**

In `tests/unit/components.test.ts` and `tests/unit/visual-style.test.ts`, require:

```ts
expect(cardStyle).toMatch(/\.card-meta\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
expect(cardStyle).toMatch(/\.name\s*\{[^}]*font-size:\s*32rpx[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*ellipsis/);
expect(cardStyle).toMatch(/\.favorite-action\s*\{[^}]*min-height:\s*64rpx/);
expect(cardStyle).toMatch(/\.favorite-image\s*\{[^}]*width:\s*34rpx[^}]*height:\s*34rpx/);
```

Keep the existing assertion that title precedes the favorite action and that the favorite is not on the cover.

- [ ] **Step 3: Run the focused tests and verify failure**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/components.test.ts tests/unit/visual-style.test.ts tests/unit/provided-assets-ui.test.ts
```

Expected: FAIL because Home still uses a purple CTA, fluid columns with `24rpx` gap and `90%` images, while the card uses flex, a `34rpx` wrapping title, and an `80rpx` favorite control.

- [ ] **Step 4: Restyle the existing Home controls**

In `miniprogram/pages/home/index.wxss`, retain the current event markup, hide the obsolete `.home-hero-shade`, and anchor the CTA at `top: 50%` with `transform: translate(-50%, -50%)`. Set the CTA to `rgba(255, 255, 255, .94)`, purple text, `58rpx` height, `24rpx` horizontal padding, and a light neutral shadow. Set `.ai-quick-grid` to two `288rpx` columns, `justify-content: center`, and `20rpx` gap; set each card to `288rpx` wide with zero padding and each image to `100%` width. Do not edit the image files or Home TypeScript.

- [ ] **Step 5: Prioritize the title in the shared card**

In `miniprogram/components/place-card/index.wxss`, change `.card-meta` to a two-column grid `minmax(0, 1fr) auto`, align center, and keep the existing gap. Set `.name` to `32rpx`, `white-space: nowrap`, `overflow: hidden`, and `text-overflow: ellipsis`. Reduce `.favorite-action` to `64rpx` minimum height, `8rpx` left padding, `4rpx` gap, and `22rpx` label; reduce `.favorite-image` to `34rpx`. Do not edit the component TypeScript or WXML.

- [ ] **Step 6: Run checks, request review, and commit**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test -- --run tests/unit/components.test.ts tests/unit/visual-style.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/navigation.test.ts
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
```

Expected: all commands exit 0. Have an independent reviewer inspect CTA contrast, symmetric AI spacing, the full sample title at normal width, and favorite event preservation. Then commit only the Task 2 files with `fix: align home actions and place titles`.

## Task 3: Build, Preview, and Independent Acceptance

**Files:**
- Create: `docs/testing/2026-09-08-search-home-place-card-qa.md`
- Modify: the narrowest relevant source/test file only if an observed defect requires a regression fix.

**Interfaces:**
- Consumes: the two focused implementation commits.
- Produces: a commit-specific independent QA record.

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
node .local-tools\package\bin\npm-cli.js test
node .local-tools\package\bin\npm-cli.js run typecheck
node .local-tools\package\bin\npm-cli.js run lint
node .local-tools\package\bin\npm-cli.js run build
node scripts\check-package.mjs
node scripts\verify-docs.mjs
git diff --check
```

Expected: all available commands exit 0 and the package check reports `Client routes, resources and boundary verified`.

- [ ] **Step 2: Preview with WeChat Developer Tools**

Keep the IDE visible and compile the existing `dist` project. Verify Home CTA position/style, symmetric AI pair, Discover expand/close/re-expand/send/category flow, and at least one normal and long place title. Inspect the console for fatal errors and new component-WXSS selector warnings. If Computer Use cannot attach because its trusted RPC service is unavailable, record the exact limitation and do not claim simulator interaction passed.

- [ ] **Step 3: Obtain independent code and UI review**

Give reviewers the exact implementation commits and this approved spec. Reject any backend/route/service change, search request during input or collapse, lost category interaction, Home image change, title overlap, or favorite-event change. Fix each material issue with one focused regression test and a separate `fix:` commit.

- [ ] **Step 4: Have the independent test role execute acceptance**

The tester independently runs the full suite and attempts the same IDE flows. Record exact commit, commands, counts, observable UI results, defects, and untested items in `docs/testing/2026-09-08-search-home-place-card-qa.md`; unavailable simulator or true-device scenarios must remain explicitly untested.

- [ ] **Step 5: Commit the QA record**

Run `node scripts/verify-docs.mjs` and `git diff --check`, then commit only the QA document with `test: record search and place card QA`.

## Plan Self-Review

- Spec coverage: Task 1 covers all search icon, close, submission, size, and category-access requirements; Task 2 covers the white Hero CTA, centered AI pair, same-row favorite, and long-title width; Task 3 covers build, preview, independent review, and independent test evidence.
- Placeholder scan: every change identifies exact files, selectors, method names, values, commands, expected failures, and expected passes; no deferred implementation placeholder remains.
- Type consistency: `collapseSearch()` only sets `searchExpanded`; `onSearch()`, category values, place-card events, routes, and service types are unchanged throughout the plan.

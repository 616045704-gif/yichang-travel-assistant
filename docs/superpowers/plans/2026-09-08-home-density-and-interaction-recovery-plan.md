# Home Density and Interaction Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine Home density, align place titles with favorite actions, enlarge the user's supplied category and tab artwork without redesigning it, and close the secondary-page interaction verification gap without changing business navigation.

**Architecture:** Keep every page method, route, custom event, service, and data contract unchanged. Limit application edits to WXML/WXSS and optimized derivatives of user-supplied PNG artwork; update the WeChat smoke test so current selectors and page-path assertions match the shipped UI.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/TypeScript, Node.js ESM, pure Node PNG renderer, Vitest, miniprogram-automator, WeChat Developer Tools via Computer Use.

## Global Constraints

- Do not modify cloud functions, Dify, database fields, service payloads, routes, navigation methods, or location timing.
- Preserve Home order: Hero, AI actions, category heading/grid, shared place list.
- Preserve `open`, `favoritechange`, and `categorychange` event contracts.
- Stage exact files only and preserve unrelated workspace changes.

## File Map

| File | Responsibility |
| --- | --- |
| `miniprogram/components/place-card/index.wxml` | Separate cover navigation from the title/favorite horizontal row. |
| `miniprogram/components/place-card/index.wxss` | Responsive title/favorite alignment and touch target. |
| `miniprogram/pages/home/index.wxss` | AI image scale/spacing and larger supplied category artwork. |
| `scripts/render-modern-icons.mjs` | Render only existing code-native fallback assets; never overwrite supplied category artwork. |
| `miniprogram/assets/provided/category-*.png` | Shipped category artwork for Home and picker. |
| `miniprogram/assets/provided/tab-*.png` | Supplied selected/unselected Tab artwork with reduced transparent padding. |
| `scripts/wechat-smoke.mjs` | Current selectors plus actual navigation-path checks. |
| `tests/unit/components.test.ts` | Shared card layout/event regression. |
| `tests/unit/provided-assets-ui.test.ts` | AI scale plus supplied category/Tab fingerprint and resource contract. |
| `tests/unit/navigation.test.ts` | Current smoke selector/path contract. |

## Task 1: Lock the revised visual and interaction contract

- [ ] Add failing assertions for `.card-meta`, title/favorite sibling order, `90%` AI image width, `128rpx` supplied category artwork, unchanged dark labels, supplied asset fingerprints, and current smoke selectors.
- [ ] Run the three focused test files and confirm they fail for the new requirements.

## Task 2: Implement the shared card and Home density

- [ ] Move the title into `.card-meta` beside the existing favorite button while retaining independent `bindtap` and `catchtap` handlers.
- [ ] Center AI artwork at `90%` width, use a `24rpx` grid gap and restrained image shadow, enlarge category artwork to `128rpx`, and keep category labels on `var(--color-text)`.
- [ ] Run component, visual, place-page, and navigation tests; then run typecheck and lint.

## Task 3: Preserve and enlarge the supplied icon family

- [ ] Restore the five `128 × 128px` category derivatives from the user's `icon+banner` artwork and remove renderer code that overwrites them.
- [ ] Enlarge the four selected/unselected Tab pairs only by trimming transparent padding inside the native `81 × 81px` canvases; do not redraw or recolor them.
- [ ] Inspect all supplied derivatives at original resolution and run fingerprint/resource/package-budget tests.

## Task 4: Restore real interaction coverage

- [ ] Replace retired smoke selectors (`.hero`, `.filter`, old map controls) with the shipped Home, picker, shared card, and map selectors.
- [ ] Tap the AI card and assert `pages/ai-chat/index`; return to Home, tap a populated place card and assert `pages/place-detail/index`.
- [ ] Validate the Discover/Map picker through the current component and assert the same category values; keep real-location paths untouched.
- [ ] Reopen and compile the current project in WeChat Developer Tools, then manually validate AI, category picker, detail, and Me-entry paths. Record unavailable automation as untested.

## Task 5: Independent review, QA, and commits

- [ ] Run full Vitest, typecheck, lint, development build, package check, docs verification, and `git diff --check`.
- [ ] Obtain an independent code/UI review and resolve every blocker or important finding.
- [ ] Capture final Home, Discover picker, detail, and one secondary page screenshot in `.local/ui-qa/2026-09-08-interaction-recovery/`.
- [ ] Have the independent test role update a commit-specific record under `docs/testing/`.
- [ ] Commit implementation and QA as separate focused Conventional Commits.

## Plan Self-Review

- Spec coverage: all four latest visual requests and the three reported interaction paths are mapped to a file and a verification step.
- Placeholder scan: no TBD/TODO or deferred implementation language remains.
- Type consistency: existing WXML event names and TypeScript handler signatures remain unchanged; the smoke test asserts the same registered routes.

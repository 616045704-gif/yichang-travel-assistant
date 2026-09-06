# AI History Selection Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the selected AI-history category visibly green and prevent the expanded detail from repeating the question already shown in its summary.

**Architecture:** Keep existing `selectedKind` and `expanded` page state. Render each tab with a complete conditional class string, use the defined `--color-primary` token for the selected background, and remove only the duplicate user message bubble from expanded detail. The assistant bubble, source card, disclaimer, filtering, and expansion mechanics remain intact.

**Tech Stack:** WXML, WXSS, TypeScript, Vitest, ESLint, esbuild.

## Global Constraints

- Modify only `miniprogram/pages/ai-history/`, its page test, and test documentation.
- Do not modify cloud functions, CloudBase, Dify, API keys, environment variables, persistence, sorting, filtering, or user isolation.
- Do not stage existing untracked files.
- Add automated coverage before each logic change and commit the logic and QA record separately.

---

### Task 1: Clarify selected tabs and expanded detail

**Files:**
- Modify: `miniprogram/pages/ai-history/index.wxml`
- Modify: `miniprogram/pages/ai-history/index.wxss`
- Modify: `tests/unit/ai-history.test.ts`

**Interfaces:**
- Consumes: existing `selectedKind: 'chat' | 'trip'` and `item.expanded` values.
- Produces: a green selected tab with light readable text; expanded records display the AI answer and sources but no second rendering of the prompt.

- [ ] **Step 1: Write the failing template/style test**

Update the AI-history markup expectations to require both complete tab class expressions and no `role="user"` bubble:

```ts
expect(markup).toContain("selectedKind === 'chat' ? 'history-tab history-tab-active' : 'history-tab'");
expect(markup).toContain("selectedKind === 'trip' ? 'history-tab history-tab-active' : 'history-tab'");
expect(markup).not.toContain('role="user"');
expect(markup).toContain('role="assistant"');
expect(markup).toContain('<source-card');
const styles = await readFile('miniprogram/pages/ai-history/index.wxss', 'utf8');
expect(styles).toContain('background: var(--color-primary)');
```

- [ ] **Step 2: Verify the test is red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-history.test.ts`

Expected: FAIL because the current template includes the duplicate user bubble and mixes a static tab class with a conditional fragment; the style references undefined `--color-ink` for selected-tab background.

- [ ] **Step 3: Apply the narrow presentation fix**

Replace each tab's mixed class attribute with a complete conditional class expression:

```xml
class="{{selectedKind === 'chat' ? 'history-tab history-tab-active' : 'history-tab'}}"
```

and the equivalent `trip` expression. Delete only this expanded-detail component:

```xml
<message-bubble role="user" content="{{item.prompt}}" mode="" label="" />
```

Keep the assistant bubble and source card. In WXSS, change `.history-tab-active` border/background from `var(--color-ink)` to the defined `var(--color-primary)` token.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-history.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\ai-history tests\\unit\\ai-history.test.ts
```

Commit only the three files with `fix: clarify AI history selection`.

### Task 2: Record test handoff

**Files:**
- Create: `docs/testing/2026-09-06-ai-history-selection-clarity-qa.md`

**Interfaces:**
- Consumes: Task 1 committed code and actual local test evidence.
- Produces: a factual record that distinguishes developer checks from pending developer-tool and real-device checks.

- [ ] **Step 1: Run the relevant final checks**

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-history.test.ts tests\\unit\\ai-records.test.ts tests\\unit\\ai-service.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\ai-history tests\\unit\\ai-history.test.ts
node scripts\\build.mjs --mode=demo
node scripts\\check-package.mjs
node scripts\\verify-docs.mjs
git diff --check
```

- [ ] **Step 2: Record and commit actual results**

Document the explicit defined-token root cause, checked behavior, no-cloud/no-Dify scope, and pending developer-tool, Android, iPhone, and independent-test checks. Commit only this record with `test: record AI history clarity QA`.

## Plan Self-Review

- The plan fixes the screenshot's invisible selected background at its source: undefined `--color-ink` is replaced by the existing green token.
- The prompt remains once in the summary, so removing its expanded bubble removes redundancy without data loss.
- No service or cloud boundary changes are included.

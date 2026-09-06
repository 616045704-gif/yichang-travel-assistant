# Local AI History Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local “AI 问答记录” page easy to scan by filtering free chat and trip records, then expanding an individual record on demand.

**Architecture:** Keep `listAiRecords()` and its cloud-function contract unchanged. The page will derive local display records from its existing results, hold `selectedKind` and `expandedRequestId` only in page data, and render filtering and expansion in WXML. No request, database, Dify, environment, or persistence behavior changes.

**Tech Stack:** TypeScript, native WeChat Mini Program WXML/WXSS, Vitest, ESLint, esbuild.

## Global Constraints

- Do not modify `aiService`, CloudBase collections, Dify workflow/model, API keys, or environment variables.
- Preserve existing current-user isolation, service-returned ordering, successful-record filtering, source cards, disclaimer, and error retry behavior.
- Do not delete, migrate, write, or re-order stored AI records.
- Do not stage existing untracked files.
- Add automated coverage for all modified behavior and commit each logical change separately.

---

### Task 1: Add local kind filtering and record expansion

**Files:**
- Modify: `miniprogram/pages/ai-history/index.ts`
- Modify: `miniprogram/pages/ai-history/index.wxml`
- Modify: `miniprogram/pages/ai-history/index.wxss`
- Modify: `tests/unit/ai-history.test.ts`

**Interfaces:**
- Consumes: existing `listAiRecords(): Promise<AiHistoryItem[]>` results with `kind`, `requestId`, `prompt`, `answer`, and `createdAt`.
- Produces: page data `{ records, selectedKind, expandedRequestId, visibleRecords, status, message }`; `selectKind` and `toggleRecord` only update local page state.

- [ ] **Step 1: Write the failing page test**

Extend `HistoryPage` with `selectKind(event)` and `toggleRecord(event)`. Mock one `chat` and one `trip` record. After `load()`, assert:

```ts
expect(page.data).toMatchObject({
  selectedKind: 'chat',
  expandedRequestId: '',
  visibleRecords: [{ requestId: 'chat-1', kind: 'chat', expanded: false }],
});
page.selectKind({ currentTarget: { dataset: { kind: 'trip' } } });
expect(page.data).toMatchObject({
  selectedKind: 'trip',
  expandedRequestId: '',
  visibleRecords: [{ requestId: 'trip-1', kind: 'trip', expanded: false }],
});
page.toggleRecord({ currentTarget: { dataset: { requestId: 'trip-1' } } });
expect(page.data).toMatchObject({ expandedRequestId: 'trip-1', visibleRecords: [{ requestId: 'trip-1', expanded: true }] });
page.toggleRecord({ currentTarget: { dataset: { requestId: 'trip-1' } } });
expect(page.data).toMatchObject({ expandedRequestId: '', visibleRecords: [{ requestId: 'trip-1', expanded: false }] });
```

Read WXML and assert it contains the two labels, `bindtap="selectKind"`, `bindtap="toggleRecord"`, `wx:if="{{item.expanded}}"`, the existing disclaimer, user bubble, assistant bubble, and source card.

- [ ] **Step 2: Verify the test is red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-history.test.ts`

Expected: FAIL because the page has no selected kind, visible record list, or tap handlers.

- [ ] **Step 3: Add minimal page state and derived presentation**

In `index.ts`, add:

```ts
type DisplayRecord = HistoryItem & { displayTime: string; expanded: boolean };
type SelectedKind = 'chat' | 'trip';

function displayTime(createdAt: string) {
  const value = new Date(createdAt);
  return Number.isNaN(value.getTime()) ? '' : `${value.getMonth() + 1}月${value.getDate()}日 ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}
```

Store full accepted records in `records`, then derive `visibleRecords` through a page-local `applyView(records, selectedKind, expandedRequestId)` helper. Set `selectedKind: 'chat'` and `expandedRequestId: ''` initially. `selectKind` validates only `chat` or `trip`, clears expansion, and re-derives `visibleRecords`; `toggleRecord` expands only a request in the current filtered list and toggles the same request closed.

In WXML, keep the heading and disclaimer, render two tab buttons with `data-kind`, use `visibleRecords`, and move the existing full message and source components inside `wx:if="{{item.expanded}}"`. Render prompt and `displayTime` on each always-visible summary card. Replace the global empty state title/message with category-aware text while preserving `bind:retry` for the error state.

In WXSS, add compact tab and summary-card styles matching existing color tokens without changing shared components.

- [ ] **Step 4: Verify behavior and checks**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-history.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\ai-history tests\\unit\\ai-history.test.ts
```

Expected: all exit 0.

- [ ] **Step 5: Commit the isolated local UI change**

```powershell
git add -- miniprogram/pages/ai-history/index.ts miniprogram/pages/ai-history/index.wxml miniprogram/pages/ai-history/index.wxss tests/unit/ai-history.test.ts
git diff --cached --check
git commit -m "fix: organize local AI history"
```

### Task 2: Record independent-test handoff

**Files:**
- Create: `docs/testing/2026-09-06-local-ai-history-organization-qa.md`

**Interfaces:**
- Consumes: Task 1 commit and successful local checks.
- Produces: a factual QA handoff showing developer checks, independent-test status, and unperformed device checks.

- [ ] **Step 1: Run combined relevant checks**

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-history.test.ts tests\\unit\\ai-records.test.ts tests\\unit\\ai-service.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\ai-history tests\\unit\\ai-history.test.ts
node scripts\\build.mjs --mode=demo
node scripts\\check-package.mjs
node scripts\\verify-docs.mjs
git diff --check
```

- [ ] **Step 2: Create the QA record**

Document the tested commit, actual command counts/results, and these confirmed scope facts: no cloud function deployment, no Dify call, no database migration, and no environment change. Mark independent tester, WeChat developer-tool visual verification, Android, and iPhone checks as pending until they occur.

- [ ] **Step 3: Commit the QA record**

```powershell
git add -- docs/testing/2026-09-06-local-ai-history-organization-qa.md
git diff --cached --check
git commit -m "test: record local AI history QA"
```

## Plan Self-Review

- Every accepted record remains in the original service order; filtering is a local view only.
- Selecting a type cannot create an extra cloud request, and expansion cannot transmit data.
- Both desired visual behaviors and existing safety presentation are covered by automated tests.
- No cloud, Dify, data migration, or session redesign work has entered the plan.

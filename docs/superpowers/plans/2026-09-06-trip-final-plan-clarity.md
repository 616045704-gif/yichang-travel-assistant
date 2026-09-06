# Trip Final Plan Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current itinerary and the requirements that will be used for its final version unambiguous in the local Mini Program UI.

**Architecture:** Keep the latest Dify result as the only displayed plan. Store each successfully answered adjustment in page memory, show it as a confirmed requirement, and compose the final-generation message from every stored requirement. Failed adjustments never enter that list. This changes no Dify workflow, CloudBase function, database, or configuration.

**Tech Stack:** TypeScript, native WeChat Mini Program WXML/WXSS, Vitest, ESLint, TypeScript compiler.

## Global Constraints

- Dify is still called only through the existing cloud-function boundary; do not change its workflow, keys, models, or prompts.
- Do not change CloudBase functions, database data, environment configuration, or deployment packages.
- The page stores confirmed requirements only for the current on-device planning session.
- Every behavior change starts with a failing test and ends with a focused Conventional Commit.

---

### Task 1: Preserve confirmed adjustments for final generation

**Files:**
- Modify: `tests/unit/trip-form.test.ts`
- Modify: `miniprogram/pages/trip-form/index.ts`

**Interfaces:**
- Page data gains `confirmedRequirements: string[]` and `isFinal: boolean`.
- A successful adjustment appends its exact submitted text to `confirmedRequirements`.
- The final request includes all confirmed texts and remains within the existing 1,000-character request limit; if it cannot, the page explains this before making a request.

- [ ] **Step 1: Add a failing behavior test**

Extend the trip follow-up test to submit two adjustments, including `推荐具体餐馆，要吃鱼和热干面`, then assert that the final request contains both adjustment texts, the page has both confirmed requirements, and the successful final response has `isFinal: true`.

- [ ] **Step 2: Run the focused test to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts`

Expected: FAIL because the page does not retain confirmed adjustment text or compose it into its final request.

- [ ] **Step 3: Implement the page-only state transition**

Add a final prompt builder in `index.ts` that numbers every confirmed requirement and returns no prompt if the existing 1,000-character input limit would be exceeded. Pass request metadata through `send` so only a succeeded adjustment is persisted. Preserve that metadata for retry. Clear the list and final marker only when the user restarts planning or starts a new first plan.

- [ ] **Step 4: Verify source behavior**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\trip-form\\index.ts tests\\unit\\trip-form.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the behavior change**

```powershell
git add -- miniprogram/pages/trip-form/index.ts tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "fix: preserve trip adjustments for final generation"
```

### Task 2: Display one current plan and its confirmed requirements

**Files:**
- Modify: `tests/unit/trip-form.test.ts`
- Modify: `miniprogram/pages/trip-form/index.wxml`
- Modify: `miniprogram/pages/trip-form/index.wxss`

**Interfaces:**
- The result area renders only `result`, with a visible `当前计划（可继续调整）` or `最终行程（当前版本）` heading.
- Confirmed requirements render before the adjustment input and explicitly state that they will be used for final generation.
- The primary control says `生成最终行程` until final output succeeds, then `重新生成最终行程`.

- [ ] **Step 1: Add a failing page-markup assertion**

Add a unit test that reads the trip page markup and expects the two current-plan headings, the confirmed-requirements label, and no `wx:for="{{results}}"` answer-history rendering.

- [ ] **Step 2: Run the focused test to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts`

Expected: FAIL because the markup currently repeats every historical answer without a current-version marker.

- [ ] **Step 3: Implement the clear current-version layout**

Render only the current `result` with its label and sources. Render the confirmed-requirements list, retaining no historical answers on screen. Add restrained card styling that follows the existing page colors and spacing. Do not change controls that call cloud services.

- [ ] **Step 4: Verify UI source and build**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\trip-form\\index.ts tests\\unit\\trip-form.test.ts
node scripts\\build.mjs --mode=demo
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the UI change**

```powershell
git add -- miniprogram/pages/trip-form/index.wxml miniprogram/pages/trip-form/index.wxss tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "fix: clarify current trip plan"
```

### Task 3: Record local validation evidence

**Files:**
- Create: `docs/testing/2026-09-06-trip-final-plan-clarity-qa.md`

- [ ] **Step 1: Record actual evidence**

Record each implementation commit, focused test, type check, lint, demo build, source markup assertion, and what remains untested: WeChat Developer Tools visual compilation and real cloud/Dify output. State that this change does not require cloud deployment.

- [ ] **Step 2: Validate the record and commit**

Run:

```powershell
node scripts\\verify-docs.mjs
git add -- docs/testing/2026-09-06-trip-final-plan-clarity-qa.md
git diff --cached --check
git commit -m "test: record trip final plan clarity QA"
```

Expected: both commands exit 0.

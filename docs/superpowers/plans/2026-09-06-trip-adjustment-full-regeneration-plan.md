# Trip Adjustment Full Regeneration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every successful trip adjustment is displayed as a complete itinerary covering every requested day.

**Architecture:** The local trip page will build one self-contained full-regeneration question from the existing form and all confirmed adjustments, including the required day count. Sending an adjustment uses that question instead of a bare partial request. The current response remains the complete current version, so the separate final-generation action is removed. No Dify workflow, CloudBase function, database, configuration, or deployment package changes.

**Tech Stack:** TypeScript, native WeChat Mini Program WXML/WXSS, Vitest, ESLint, TypeScript compiler.

## Global Constraints

- Dify continues to be called only through the existing cloud function; do not modify its workflow, keys, models, or configuration.
- Do not modify CloudBase functions, database documents, environment variables, or deployment packages.
- The page keeps confirmed adjustments only in its current local planning session.
- Every behavior change starts with a failing test and ends with a focused Conventional Commit.

---

### Task 1: Make an adjustment request self-contained and complete

**Files:**
- Modify: `tests/unit/trip-form.test.ts`
- Modify: `miniprogram/pages/trip-form/index.ts`

**Interfaces:**
- `submitAdjustment()` sends a question containing the form destination, people, total budget, exact day count, preferences, all previous confirmed requirements, and the new adjustment.
- The question explicitly requires every day from `第 1 天` through `第 N 天`, each with morning, afternoon and evening, and forbids a change-only reply.
- A requirement is added only after its complete regenerated reply succeeds; retry submits the identical question and retains that pending requirement.

- [ ] **Step 1: Add a failing full-regeneration test**

Replace the partial-adjustment expectations with a four-day form scenario. Assert the first adjustment request contains `4 天`, the form summary, `第 1 天至第 4 天`, and its new food requirement. Assert the second request contains both the food requirement and `去三峡人家`.

- [ ] **Step 2: Run the focused test to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts`

Expected: FAIL because the current adjustment request contains only the latest short adjustment.

- [ ] **Step 3: Implement the single full-regeneration question builder**

Build one bounded query from a validated `TripInput` and proposed confirmed requirements. Its fixed instructions require a complete day-by-day itinerary, no omitted days, no change-only summary, and no hidden reasoning. Reject the action with a clear local input-length message if that query exceeds 1,000 characters. Use it for every adjustment. Preserve the submitted raw adjustment separately as the displayed confirmed requirement.

- [ ] **Step 4: Verify the logic**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\trip-form\\index.ts tests\\unit\\trip-form.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the logic change**

```powershell
git add -- miniprogram/pages/trip-form/index.ts tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "fix: regenerate full trip after adjustments"
```

### Task 2: Remove the redundant final-generation action

**Files:**
- Modify: `tests/unit/trip-form.test.ts`
- Modify: `miniprogram/pages/trip-form/index.wxml`
- Modify: `miniprogram/pages/trip-form/index.wxss`

**Interfaces:**
- After an adjustment succeeds, the heading says `当前完整行程（已应用调整）`.
- The adjustment action says `应用调整并重新生成完整行程`.
- The post-result primary final-generation action no longer renders; users cannot mistake a partial reply for a final plan.

- [ ] **Step 1: Add a failing markup assertion**

Assert the page contains the current-complete label and adjustment-action label, and that it does not contain `生成最终行程`.

- [ ] **Step 2: Run the focused test to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts`

Expected: FAIL because the current markup still renders the post-result final-generation button.

- [ ] **Step 3: Implement the simpler page controls**

Use the confirmed-requirement count to label a non-final current plan as complete after adjustments. Remove the lower primary button when results exist, retain only the initial form generation button, and rename the adjustment button. Keep the existing restart action and error/retry behavior.

- [ ] **Step 4: Verify local compilation**

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
git commit -m "fix: simplify complete trip adjustments"
```

### Task 3: Record validation evidence

**Files:**
- Create: `docs/testing/2026-09-06-trip-adjustment-full-regeneration-qa.md`

- [ ] **Step 1: Record tests and boundaries**

Record actual commits, test output, type checking, lint, demo build and markup assertions. State that live Dify and WeChat Developer Tools visual checks remain manual checks and that no cloud deployment is needed.

- [ ] **Step 2: Validate and commit the record**

Run:

```powershell
node scripts\\verify-docs.mjs
git add -- docs/testing/2026-09-06-trip-adjustment-full-regeneration-qa.md
git diff --cached --check
git commit -m "test: record full trip adjustment QA"
```

Expected: both commands exit 0.

# Trip Quota Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permit normal consecutive trip planning while accurately showing safe server-side rate-limit messages.

**Architecture:** Keep the existing user-scoped CloudBase quota transaction and Dify boundary. Change only the two quota constants and the trip-page exception presentation; a service envelope continues to become an `Error` inside `miniprogram/services/ai.ts`, and the page chooses a bounded user-facing fallback.

**Tech Stack:** TypeScript, CloudBase transaction fixture, native WeChat Mini Program, Vitest, ESLint, esbuild.

## Global Constraints

- Dify remains reachable only through `aiService`; no API key, environment value, Dify workflow, or model setting is changed.
- Quotas remain owner-scoped: 6 new requests per fixed UTC minute and 50 new requests per `Asia/Shanghai` calendar day.
- Cached same-ID replies and the existing allowed logical retry do not consume quota again.
- The trip page may expose only the cloud function's existing safe message; unknown errors retain the network fallback.
- Every logic change has a red-green test and a focused Conventional Commit. Do not stage existing untracked files.

---

### Task 1: Expand the owner-scoped quota without removing it

**Files:**
- Modify: `cloudfunctions/ai/quota.ts:3-4`
- Modify: `tests/unit/ai-records.test.ts:114-131`

**Interfaces:**
- Consumes: `quotaWindows(ownerId, now)`.
- Produces: minute windows with `limit: 6` and daily windows with `limit: 50`; `AiRateLimitError` remains the rejection type after each ceiling.

- [ ] **Step 1: Write the failing boundary test**

Replace the existing quota-loop assertion with this test body:

```ts
for (let index = 0; index < 6; index += 1) {
  const request = { ...chatRequest, requestId: `minute-${index}` };
  const token = await claimToken(records, 'owner-a', request, base);
  await records.fail('owner-a', request, token, 'failed', base);
}
await expect(records.claim('owner-a', { ...chatRequest, requestId: 'minute-7' }, base))
  .rejects.toBeInstanceOf(AiRateLimitError);
```

Then use one request per subsequent minute for indexes `6` through `49`, assert `day-51` rejects at `base + 51 minutes`, and retain the next-Shanghai-day success assertion.

- [ ] **Step 2: Run the focused test to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts`

Expected: FAIL because the constants still limit the first window to 3 requests and the day to 20.

- [ ] **Step 3: Make the smallest implementation change**

In `cloudfunctions/ai/quota.ts`, replace:

```ts
export const MINUTE_LIMIT = 3;
export const DAY_LIMIT = 20;
```

with:

```ts
export const MINUTE_LIMIT = 6;
export const DAY_LIMIT = 50;
```

- [ ] **Step 4: Verify the quota boundary and style**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts
node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\quota.ts tests\\unit\\ai-records.test.ts
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the isolated quota change**

```powershell
git add -- cloudfunctions/ai/quota.ts tests/unit/ai-records.test.ts
git diff --cached --check
git commit -m "fix: allow normal consecutive AI requests"
```

### Task 2: Show the cloud function's safe failure message on the trip page

**Files:**
- Modify: `miniprogram/pages/trip-form/index.ts:111-115`
- Modify: `tests/unit/trip-form.test.ts:14-24, 75-95`

**Interfaces:**
- Consumes: a rejected `submitAi(request)` promise whose reason may be an `Error`.
- Produces: the rate-limit text `请求较频繁，请稍后再试。` for an `Error` carrying that message, and `网络连接不稳定，请重试` for other thrown values.

- [ ] **Step 1: Write the failing page test**

Add this test after the existing network-failure test:

```ts
it('shows the safe cloud-function rate-limit message instead of calling it a network failure', async () => {
  const submitAi = vi.fn().mockRejectedValue(new Error('请求较频繁，请稍后再试。'));
  const page = await loadTripPage({ submitAi });
  page.onDestination({ detail: { value: '宜昌' } });
  page.onPeople({ detail: { value: '2' } });
  page.onBudget({ detail: { value: '3000' } });
  page.onDays({ detail: { value: '2' } });
  await page.submit();
  expect(page.data.error).toBe('请求较频繁，请稍后再试。');
});
```

- [ ] **Step 2: Run the focused page test to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts`

Expected: FAIL because `send()` always replaces rejected promise messages with the generic network string.

- [ ] **Step 3: Add a narrow exception-message guard**

Add above `Page` in `miniprogram/pages/trip-form/index.ts`:

```ts
function thrownErrorMessage(error: unknown) {
  return error instanceof Error && error.message === '请求较频繁，请稍后再试。'
    ? error.message
    : '网络连接不稳定，请重试';
}
```

Change the `catch` branch in `send()` to:

```ts
} catch (error) {
  this.setData({ result: null, error: thrownErrorMessage(error) });
}
```

- [ ] **Step 4: Verify the page behavior, types, and style**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\trip-form\\index.ts tests\\unit\\trip-form.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the isolated UI feedback change**

```powershell
git add -- miniprogram/pages/trip-form/index.ts tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "fix: explain trip request rate limits"
```

### Task 3: Validate, record handoff, and prepare safe deployment

**Files:**
- Modify: `docs/testing/2026-09-06-trip-chatflow-performance-qa.md`

**Interfaces:**
- Consumes: the two commits from Tasks 1–2 and their successful checks.
- Produces: a factual record of development checks, independent-test status, deployment scope, and remaining WeChat developer-tool checks.

- [ ] **Step 1: Run the combined relevant checks**

Run each command separately:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts tests\\unit\\trip-form.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\quota.ts miniprogram\\pages\\trip-form\\index.ts tests\\unit\\ai-records.test.ts tests\\unit\\trip-form.test.ts
node scripts\\build.mjs --mode=demo
node scripts\\check-package.mjs
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Record actual evidence without overclaiming**

Append the two commit IDs, command results, server diagnosis (`RATE_LIMITED`, not Dify timeout), selected limits, and the following manual checks: rebuild in WeChat developer tools; make an initial trip request, a follow-up, and rapid new requests; confirm success until the configured ceiling and the exact rate-limit message afterward. Mark Android/iPhone and independent tester status as pending unless actually performed by that role.

- [ ] **Step 3: Commit the validation record**

```powershell
git add -- docs/testing/2026-09-06-trip-chatflow-performance-qa.md
git diff --cached --check
git commit -m "test: record trip quota feedback QA"
```

- [ ] **Step 4: Obtain deployment approval before any cloud write**

Tell the user that deployment will upload only the `aiService` function code containing the new quota constants. Confirm that Dify settings, API keys, and cloud environment variables will remain untouched, then wait for explicit approval before deploying.

## Plan self-review

- Requirement coverage: Task 1 retains and raises the two owner-scoped ceilings; Task 2 makes the real safe `RATE_LIMITED` response visible; Task 3 validates, documents, and defers cloud deployment for explicit approval.
- No secrets or Dify configuration occur in the changed files.
- The test names, request counts, constants, and expected user copy match the designed behavior.

# Chat Quota Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow up to 100 new AI requests per user per Shanghai calendar day and explain a quota rejection accurately in the free-chat page.

**Architecture:** Keep CloudBase's owner-scoped counters, the existing six-new-requests-per-minute protection, and the cloud-function-to-Dify boundary. Raise only the daily counter. `ChatModel` converts only the server's existing safe rate-limit message into UI text; all other exceptions retain the generic network fallback.

**Tech Stack:** TypeScript, Vitest, CloudBase database fixture, ESLint, esbuild.

## Global Constraints

- Dify workflow, model, API keys, environment variables, and request boundary remain unchanged.
- The Mini Program does not call Dify directly.
- Quotas remain owner-scoped; cached replies and allowed logical retries do not consume another quota slot.
- No untracked user files are staged.
- Each logic change gets a focused test and Conventional Commit.

---

### Task 1: Raise the daily owner quota

**Files:**
- Modify: `cloudfunctions/ai/quota.ts:3-4`
- Modify: `tests/unit/ai-records.test.ts` (existing quota boundary test)

**Interfaces:**
- Consumes: `quotaWindows(ownerId, now)`.
- Produces: a minute window with `limit: 6` and a Shanghai-day window with `limit: 100`.

- [ ] **Step 1: Write the failing quota boundary test**

Change the existing test title to say `100 per Shanghai day`; keep the first six requests in one minute, then permit requests with indexes `6` through `99` one minute apart, and assert request `day-101` rejects:

```ts
for (let index = 6; index < 100; index += 1) {
  const now = new Date(base.getTime() + index * 60_000);
  const request = { ...chatRequest, requestId: `day-${index + 1}` };
  const token = await claimToken(records, 'owner-a', request, now);
  await records.fail('owner-a', request, token, 'failed', now);
}
await expect(records.claim(
  'owner-a', { ...chatRequest, requestId: 'day-101' }, new Date(base.getTime() + 101 * 60_000),
)).rejects.toBeInstanceOf(AiRateLimitError);
```

- [ ] **Step 2: Verify the test is red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts`

Expected: the 51st daily request rejects because `DAY_LIMIT` is still 50.

- [ ] **Step 3: Make the minimal quota change**

Replace this constant:

```ts
export const DAY_LIMIT = 50;
```

with:

```ts
export const DAY_LIMIT = 100;
```

- [ ] **Step 4: Verify and commit the isolated quota change**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts
node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\quota.ts tests\\unit\\ai-records.test.ts
```

Commit only `cloudfunctions/ai/quota.ts` and `tests/unit/ai-records.test.ts` with `fix: expand daily AI request allowance`.

### Task 2: Show a safe quota message in free chat

**Files:**
- Modify: `miniprogram/view-models/chat.ts:4-5,62-74`
- Modify: `tests/unit/chat-ui.test.ts` (ChatModel tests)

**Interfaces:**
- Consumes: a rejected `AiClient.submit()` promise.
- Produces: `请求较频繁，请稍后再试。` only for an `Error` with exactly that safe message; unknown errors produce `网络连接不稳定，请重试`.

- [ ] **Step 1: Write the failing UI-model test**

Add this test in the `mock AI chat model` suite:

```ts
it('keeps the safe cloud-function rate-limit message', async () => {
  const client = { submit: vi.fn().mockRejectedValue(new Error('请求较频繁，请稍后再试。')) };
  const model = new ChatModel(client);
  const result = await model.submit('宜昌有哪些露营地适合我？');
  expect(result).toMatchObject({ status: 'failed', error: '请求较频繁，请稍后再试。' });
});
```

- [ ] **Step 2: Verify the test is red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\chat-ui.test.ts`

Expected: the result still has the generic network text.

- [ ] **Step 3: Make the smallest exception guard**

Add `RATE_LIMIT_ERROR` and a helper:

```ts
const RATE_LIMIT_ERROR = '请求较频繁，请稍后再试。';

function userFacingError(error: unknown) {
  return error instanceof Error && error.message === RATE_LIMIT_ERROR ? RATE_LIMIT_ERROR : NETWORK_ERROR;
}
```

Change `catch {` to `catch (error) {` and set `error: userFacingError(error)` in the failed result.

- [ ] **Step 4: Verify and commit the isolated chat UI change**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\chat-ui.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\view-models\\chat.ts tests\\unit\\chat-ui.test.ts
```

Commit only `miniprogram/view-models/chat.ts` and `tests/unit/chat-ui.test.ts` with `fix: explain chat request rate limits`.

### Task 3: Validate and record independent-test handoff

**Files:**
- Create: `docs/testing/2026-09-06-chat-quota-feedback-qa.md`

**Interfaces:**
- Consumes: the two committed changes and successful local checks.
- Produces: an evidence-based QA handoff that identifies unperformed cloud and device checks.

- [ ] **Step 1: Run combined relevant checks**

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts tests\\unit\\chat-ui.test.ts tests\\unit\\ai-service.test.ts tests\\unit\\dify-adapter.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\quota.ts miniprogram\\view-models\\chat.ts tests\\unit\\ai-records.test.ts tests\\unit\\chat-ui.test.ts
node scripts\\build.mjs --mode=demo
node scripts\\check-package.mjs
git diff --check
```

- [ ] **Step 2: Record the actual results and limits**

Document the evidence, the `RATE_LIMITED` diagnosis, daily limit 100, minute limit 6, and mark cloud deployment, Dify live call, Android, iPhone, and independent tester checks as pending until actually performed.

- [ ] **Step 3: Commit the QA record and prepare deployment**

Commit only the QA record with `test: record chat quota feedback QA`. The only upload needed is the rebuilt `dist/cloudfunctions/aiService` code; Dify and cloud environment settings are out of scope.

## Plan Self-Review

- The plan covers the user-reported daily quota exhaustion and its misleading free-chat UI message.
- It preserves the short-term burst protection and user isolation.
- It has no Dify configuration, keys, or environment-file changes.

# Dify Blocking Integration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing blocking `chat` and `trip` Dify Chatflow integration with atomic request claims, owner-scoped quotas, recoverable session persistence, deterministic history, and safe operational verification.

**Architecture:** Keep the mini-program behind the `aiService` CloudBase boundary and retain the deployed blocking Dify adapter. Add a transaction-backed request state machine around the existing per-kind record collections; the same transaction claims a new request and charges its minute/day quota, while successful completion stores the private Dify conversation ID and updates the matching chat-or-trip session. Continue querying published local place data before every new Dify call, and expose only sanitized results and history summaries to the client.

**Tech Stack:** Native WeChat Mini Program TypeScript, CloudBase `wx-server-sdk` 4.0.2, CloudBase database transactions, Node.js `fetch`/`AbortSignal`, Dify Chat Messages API in blocking mode, Vitest 4, TypeScript 5.9, ESLint 9, esbuild.

## Global Constraints

- The two existing Dify Chatflows remain `chat` for free questions and `trip` for itinerary generation and follow-up adjustments.
- Required CloudBase function environment variables remain exactly `DIFY_BASE_URL`, `DIFY_CHAT_API_KEY`, and `DIFY_TRIP_API_KEY`; real values are entered only in the CloudBase console and never placed in source, tests, documentation, logs, screenshots, chat, or Git. Unit tests use unmistakably non-secret sentinel strings. Remove support for legacy per-kind base URL overrides.
- The mini-program never calls Dify directly and never sends `ownerId`, OpenID, Dify user, or Dify conversation ID.
- Every new upstream request first completes its atomic claim/quota/session-lease check, then queries published `places` and matching `place_contents`, and only then sends server-produced `local_verified_facts` to Dify. Rate-limited or session-conflicting requests do not consume place-database reads.
- The first `trip` request maps `destination`, `people`, `totalBudgetCny`, `days`, `preferences`, and optional `local_verified_facts`; the built-in `query` remains the current user message.
- `chat` and `trip` keep independent owner-scoped `ai_sessions` records with generation and lease fields. Resetting one kind increments only that generation, clears only that pointer/lease, and prevents an older in-flight completion from restoring it.
- Dify remains blocking with a 45-second upstream deadline, at most three attempts, 150 ms then 400 ms backoff, and retries only for network failures or HTTP 429/500/502/503/504.
- A request/session claim becomes stale after 90 seconds. A same-ID cached replay and the single retry of the same failed logical request do not consume quota again. Logical retries have a one-second cooldown and a maximum of two total upstream invocations, including the first.
- Quotas are 3 new requests per owner per fixed one-minute UTC-aligned window and 20 new requests per owner per `Asia/Shanghai` calendar day.
- `usage_counters`, `ai_sessions`, `ai_messages`, and `trip_requests` remain `ADMINONLY`; users access their own records only through cloud functions.
- Dify cannot guarantee exactly-once execution after an ambiguous network disconnect. The implementation prevents concurrent duplicate CloudBase calls but does not claim upstream exactly-once semantics.
- Every code task follows red-green testing and ends in a focused Conventional Commit. Do not stage the user-owned untracked technical design file.

## Implementation references

- [CloudBase transaction operations](https://docs.cloudbase.net/en/database/transaction): server-side `runTransaction`, automatic commit/rollback, and cross-document ACID behavior.
- [CloudBase database query API](https://docs.cloudbase.net/api-reference/webv1/database): chained `orderBy` calls for deterministic multi-field sorting.
- [CloudBase index management](https://docs.cloudbase.net/database/data-index): compound-index configuration for owner filtering plus newest-first ordering.

---

## File structure and boundaries

| Path | Responsibility |
| --- | --- |
| `cloudfunctions/ai/quota.ts` | Pure quota-window calculation, limits, expiry, and deterministic counter IDs. |
| `cloudfunctions/ai/database-errors.ts` | Recognize only the CloudBase missing-document variants that may be treated as absent data. |
| `cloudfunctions/ai/records.ts` | Transactional request/session claim, bounded retry, finalize/fail operations, strict quota charging, narrow cached recovery, and ordered owner history. |
| `cloudfunctions/ai/repository.ts` | Provide the deterministic session document ID, read isolated sessions, and transactionally reset by incrementing generation. |
| `cloudfunctions/ai/retrieval.ts` | Query published local place data and propagate all database failures except an absent optional content document. |
| `cloudfunctions/ai/service.ts` | Validate requests, retrieve local facts, coordinate claim/session/Dify/finalization, and map safe public errors. |
| `cloudfunctions/ai/dify.ts` | Preserve distinct Chatflow routing, common base URL, server-only keys, blocking timeout, retry allowlist, and sanitized errors. |
| `shared/ai-history.ts` | Produce the same safe question or trip summary for server-persisted and development-mock history. |
| `shared/contracts.ts` | Add the required safe `prompt` field to `AiHistoryItem`; no private Dify field enters public contracts. |
| `miniprogram/services/ai.ts` | Save a safe prompt with development history and forward live calls only to `aiService`. |
| `miniprogram/pages/ai-history/*` | Render the original question/trip summary before the assistant answer and preserve loading/error/empty states. |
| `database/schema.md` | Make the documented combined record state model match production. |
| `database/indexes.json` | Define owner/newest-first compound indexes for both AI record collections. |
| `database/security-rules.json` | Retain deny-all client access for all private collections, including `usage_counters`. |
| `docs/runbooks/dify-chatflow.md` | Document non-secret environment setup, collections, indexes, deployment, smoke tests, and rollback. |
| `tests/helpers/ai-database.ts` | Transaction-capable in-memory CloudBase fixture with ordered owner queries. |
| `tests/unit/ai-records.test.ts` | Verify claims, conflicts, quotas, stale recovery, finalization, ordering, and owner isolation. |
| `tests/unit/ai-service.test.ts` | Verify local-first orchestration, session repair/isolation, safe failures, and no duplicate Dify calls. |
| `tests/unit/dify-adapter.test.ts` | Lock down both routes, environment names, trip inputs, timeout, retries, and sanitized errors. |
| `tests/unit/ai-history.test.ts` | Verify prompt/summary rendering before the assistant answer. |
| `tests/unit/build.test.ts` | Prove the client bundle and runbook contain no Dify secrets or direct Dify calls. |
| `docs/testing/2026-09-06-dify-blocking-hardening-qa.md` | Record independent verification against the final hardening commit. |

### Task 1: Add transactional request claims and owner quotas

**Files:**
- Create: `cloudfunctions/ai/quota.ts`
- Create: `tests/helpers/ai-database.ts`
- Modify: `cloudfunctions/ai/records.ts:1-65`
- Modify: `cloudfunctions/ai/repository.ts:1-47`
- Modify: `tests/unit/ai-records.test.ts:1-78`

**Interfaces:**
- Consumes: normalized `AiRequest`, trusted `ownerId`, and server `Date`.
- Produces: `AiRecordRepository.claim`, `complete`, `fail`, and `list`; `AiRecordClaim`; `AiRecordConflictError`; `AiRateLimitError`; `AiRequestInProgressError`; `AiRetryLimitError`; `aiSessionDocumentId`.

- [ ] **Step 1: Create a transaction-capable test database fixture**

Create `tests/helpers/ai-database.ts` with a serialized `runTransaction` fixture. Each transaction clones the document map, applies changes to the clone, commits the clone only when the callback resolves, and discards it on rejection. Its collection query must support `where(query).orderBy(field, direction).orderBy(field, direction).limit(count).get()` so repository tests exercise the same chain used in production.

```ts
export type TestDocument = Record<string, unknown>;

export function createAiDatabaseFixture() {
  const documents = new Map<string, TestDocument>();
  let queue: Promise<void> = Promise.resolve();

  function api(store: Map<string, TestDocument>) {
    return {
      collection(name: string) {
        return {
          doc(id: string) {
            const key = `${name}:${id}`;
            return {
              async get() {
                const data = store.get(key);
                if (!data) throw new Error('not found');
                return { data: { ...data } };
              },
              async set(input: { data: TestDocument }) {
                store.set(key, { ...input.data, _id: id });
              },
            };
          },
          where(query: TestDocument) {
            const orders: Array<{ field: string; direction: 'asc' | 'desc' }> = [];
            const builder = {
              orderBy(field: string, direction: 'asc' | 'desc') { orders.push({ field, direction }); return builder; },
              limit(count: number) {
                return { async get() {
                  const data = [...store.entries()]
                    .filter(([key]) => key.startsWith(`${name}:`))
                    .map(([, value]) => ({ ...value }))
                    .filter(value => Object.entries(query).every(([field, expected]) => value[field] === expected))
                    .sort((left, right) => {
                      for (const order of orders) {
                        const compared = String(left[order.field] ?? '').localeCompare(String(right[order.field] ?? ''));
                        if (compared) return order.direction === 'asc' ? compared : -compared;
                      }
                      return 0;
                    })
                    .slice(0, count);
                  return { data };
                } };
              },
            };
            return builder;
          },
        };
      },
    };
  }

  return {
    documents,
    ...api(documents),
    runTransaction<T>(callback: (transaction: ReturnType<typeof api>) => Promise<T>, _times = 3): Promise<T> {
      const run = queue.then(async () => {
        const staged = new Map([...documents].map(([key, value]) => [key, { ...value }]));
        const result = await callback(api(staged));
        documents.clear();
        for (const [key, value] of staged) documents.set(key, value);
        return result;
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}
```

- [ ] **Step 2: Write failing claim, conflict, stale, and quota tests**

Replace the ad-hoc database fixture in `tests/unit/ai-records.test.ts` with `createAiDatabaseFixture()` and add these cases:

```ts
const chatRequest: AiRequest = { requestId: 'chat-request', kind: 'chat', question: '三峡大坝怎么去？' };

it('allows only one concurrent claimant for the same logical request', async () => {
  const records = createAiRecordRepository(createAiDatabaseFixture());
  const now = new Date('2026-09-06T00:00:00.000Z');
  const claims = await Promise.all(Array.from({ length: 4 }, () => records.claim('owner-a', chatRequest, now)));
  expect(claims.filter(claim => claim.state === 'claimed')).toHaveLength(1);
  expect(claims.filter(claim => claim.state === 'running')).toHaveLength(3);
});

it('rejects changed input under the same request ID', async () => {
  const records = createAiRecordRepository(createAiDatabaseFixture());
  const now = new Date('2026-09-06T00:00:00.000Z');
  await records.claim('owner-a', chatRequest, now);
  await expect(records.claim('owner-a', { ...chatRequest, question: '不同问题' }, now)).rejects.toBeInstanceOf(AiRecordConflictError);
});

it('allows one cooled-down failed or stale retry without charging quota twice', async () => {
  const fixture = createAiDatabaseFixture();
  const records = createAiRecordRepository(fixture);
  const started = new Date('2026-09-06T00:00:00.000Z');
  expect(await records.claim('owner-a', chatRequest, started)).toMatchObject({ state: 'claimed' });
  await records.fail('owner-a', chatRequest, 'failed', new Date('2026-09-06T00:00:10.000Z'));
  expect(await records.claim('owner-a', chatRequest, new Date('2026-09-06T00:00:20.000Z'))).toMatchObject({ state: 'claimed' });
  expect(await records.claim('owner-b', chatRequest, started)).toMatchObject({ state: 'claimed' });
  expect(await records.claim('owner-b', chatRequest, new Date('2026-09-06T00:01:30.000Z'))).toMatchObject({ state: 'claimed' });
  const counters = [...fixture.documents.entries()].filter(([key]) => key.startsWith('usage_counters:'));
  expect(counters.filter(([, value]) => value.ownerId === 'owner-a' && value.windowType === 'day')[0][1].count).toBe(1);
  expect(counters.filter(([, value]) => value.ownerId === 'owner-b' && value.windowType === 'day')[0][1].count).toBe(1);
});

it('rejects a third logical invocation and an immediate retry', async () => {
  const records = createAiRecordRepository(createAiDatabaseFixture());
  const started = new Date('2026-09-06T00:00:00.000Z');
  await records.claim('owner-a', chatRequest, started);
  await records.fail('owner-a', chatRequest, 'failed', started);
  await expect(records.claim('owner-a', chatRequest, new Date(started.getTime() + 500))).rejects.toBeInstanceOf(AiRequestInProgressError);
  await records.claim('owner-a', chatRequest, new Date(started.getTime() + 1_000));
  await records.fail('owner-a', chatRequest, 'timed_out', new Date(started.getTime() + 1_100));
  await expect(records.claim('owner-a', chatRequest, new Date(started.getTime() + 2_100))).rejects.toBeInstanceOf(AiRetryLimitError);
});

it('enforces 3 per fixed minute and 20 per Shanghai day with owner and day isolation', async () => {
  const records = createAiRecordRepository(createAiDatabaseFixture());
  const base = new Date('2026-09-06T00:00:00.000Z');
  for (let index = 0; index < 3; index += 1) {
    await records.claim('owner-a', { ...chatRequest, requestId: `minute-${index}` }, base);
  }
  await expect(records.claim('owner-a', { ...chatRequest, requestId: 'minute-4' }, base)).rejects.toBeInstanceOf(AiRateLimitError);
  await expect(records.claim('owner-b', { ...chatRequest, requestId: 'minute-owner-b' }, base)).resolves.toMatchObject({ state: 'claimed' });
  for (let index = 3; index < 20; index += 1) {
    await records.claim('owner-a', { ...chatRequest, requestId: `day-${index}` }, new Date(base.getTime() + index * 60_000));
  }
  await expect(records.claim('owner-a', { ...chatRequest, requestId: 'day-21' }, new Date(base.getTime() + 21 * 60_000))).rejects.toBeInstanceOf(AiRateLimitError);
  await expect(records.claim('owner-a', { ...chatRequest, requestId: 'next-day' }, new Date('2026-09-06T16:00:00.000Z'))).resolves.toMatchObject({ state: 'claimed' });
});
```

- [ ] **Step 3: Run the focused tests and confirm red state**

Run: `npm run test -- tests/unit/ai-records.test.ts`

Expected: FAIL because `claim`, `complete`, `fail`, `AiRateLimitError`, and transaction support do not exist.

- [ ] **Step 4: Implement deterministic quota windows**

Create `cloudfunctions/ai/quota.ts`:

```ts
import { createHash } from 'node:crypto';

export const MINUTE_LIMIT = 3;
export const DAY_LIMIT = 20;
export const CLAIM_STALE_MS = 90_000;
export const RETRY_COOLDOWN_MS = 1_000;
export const MAX_LOGICAL_ATTEMPTS = 2;

function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }

function shanghaiDay(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function quotaWindows(ownerId: string, now: Date) {
  const minuteStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString();
  const dayStart = shanghaiDay(now);
  return [
    { id: digest(`usage\u0000${ownerId}\u0000minute\u0000${minuteStart}`), ownerId, windowType: 'minute' as const, windowStart: minuteStart, limit: MINUTE_LIMIT, expiresAt: new Date(now.getTime() + 2 * 60 * 60_000).toISOString() },
    { id: digest(`usage\u0000${ownerId}\u0000day\u0000${dayStart}`), ownerId, windowType: 'day' as const, windowStart: dayStart, limit: DAY_LIMIT, expiresAt: new Date(now.getTime() + 32 * 24 * 60 * 60_000).toISOString() },
  ];
}
```

- [ ] **Step 5: Replace record find/save with a transactional state machine**

In `cloudfunctions/ai/records.ts`, retain deterministic record IDs and request hashes, then expose this contract:

```ts
export type AiRecordClaim =
  | { state: 'claimed' }
  | { state: 'running' }
  | { state: 'cached'; result: AiResult };

export interface AiRecordRepository {
  claim(ownerId: string, request: AiRequest, now: Date): Promise<AiRecordClaim>;
  complete(ownerId: string, request: AiRequest, result: AiResult, difyConversationId: string, now: Date): Promise<void>;
  fail(ownerId: string, request: AiRequest, status: 'failed' | 'timed_out', now: Date): Promise<void>;
  list(ownerId: string): Promise<AiHistoryItem[]>;
}

export class AiRecordConflictError extends Error {}
export class AiRateLimitError extends Error {}
export class AiRequestInProgressError extends Error {}
export class AiRetryLimitError extends Error {}
```

Implement `claim` with `database.runTransaction(callback, 3)` so transaction conflicts receive at most three platform retries. For a new record, read both deterministic `usage_counters` documents, reject before writing when either count reaches its limit, increment both counters, and set the request record with `status: 'running'`, normalized `request`, `inputHash`, `attemptCount: 1`, `claimedAt`, `quotaChargedAt`, `createdAt`, and `updatedAt`. For an existing record:

```ts
if (record.ownerId !== ownerId || record.kind !== request.kind || record.inputHash !== requestHash(request)) {
  throw new AiRecordConflictError('requestId already used');
}
if (record.status === 'succeeded') {
  const result = safeResult(record.result);
  if (!result) throw new Error('invalid successful AI record');
  return { state: 'cached', result };
}
if (record.status === 'running' && Date.parse(String(record.claimedAt)) + CLAIM_STALE_MS > now.getTime()) {
  return { state: 'running' };
}
await document.set({ data: {
  ...record, status: 'running', claimedAt: now.toISOString(), updatedAt: now.toISOString(),
  attemptCount: Number(record.attemptCount || 0) + 1,
} });
return { state: 'claimed' };
```

Do not increment counters when reclaiming a failed, timed-out, malformed legacy running, or stale running record that already has `quotaChargedAt`. Require `RETRY_COOLDOWN_MS` since the latest attempt and reject when `attemptCount >= MAX_LOGICAL_ATTEMPTS`. Validate existing quota documents against the expected owner, window type, window start, and a non-negative safe-integer count; malformed counters throw a generic internal error and no write occurs. `complete` must transactionally preserve the original request fields, set `status: 'succeeded'`, a strictly sanitized `result`, private `difyConversationId`, and `updatedAt`. `fail` must preserve `quotaChargedAt` and set only the safe terminal status and timestamps.

Build `safeResult` field by field. Accept only `requestId`, recognized status/mode, a bounded answer/error, bounded string `localFacts`, and valid public reference fields. Never spread a stored result into a public DTO. Strictly rebuild stored trip requests from `destination`, `people`, `totalBudgetCny`, `days`, and `preferences`; discard all unknown nested fields.

Rename the current private `sessionId` helper in `cloudfunctions/ai/repository.ts` to the exported `aiSessionDocumentId(ownerId, kind)` and keep repository reads/resets on that helper. Task 2 imports the same helper into `records.complete`, keeping session ID generation identical in transaction finalization, normal reads, resets, and narrow cached repair.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm run test -- tests/unit/ai-records.test.ts`

Expected: PASS, including one winner under concurrent claim and exact quota boundaries.

Run: `npm run typecheck && npm run lint`

Expected: PASS.

Commit:

```bash
git add cloudfunctions/ai/quota.ts cloudfunctions/ai/records.ts cloudfunctions/ai/repository.ts tests/helpers/ai-database.ts tests/unit/ai-records.test.ts
git diff --cached --check
git commit -m "feat: add atomic AI request claims"
```

### Task 2: Add session generations and coordinate safe local-first calls

**Files:**
- Create: `cloudfunctions/ai/database-errors.ts`
- Modify: `cloudfunctions/ai/repository.ts:1-47`
- Modify: `cloudfunctions/ai/retrieval.ts:1-62`
- Modify: `cloudfunctions/ai/service.ts:1-79`
- Modify: `tests/unit/ai-service.test.ts:75-205`
- Modify: `tests/unit/dify-adapter.test.ts:13-119`

**Interfaces:**
- Consumes: Task 1 `AiRecordRepository`, existing `DifyClient.send`, existing `AiConversationRepository`, and `LocalFactRetriever`.
- Produces: owner-and-kind session generation/lease, claim-before-retrieval blocking orchestration, `CONFLICT` for running/reused/retry-exhausted IDs, `RATE_LIMITED` for local quota, reset-safe completion, and propagated local database failures.

- [ ] **Step 1: Write failing orchestration and recovery tests**

Update the service dependency fixtures to expose `claim`, `complete`, `fail`, and `list`, then add:

Update the imports to include `AiServiceDependencies` from `cloudfunctions/ai/service`, `AiRateLimitError` and `AiRetryLimitError` from `cloudfunctions/ai/records`, `createAiDatabaseFixture` from `tests/helpers/ai-database`, and the existing `AiRequest`/`AiResult` contracts.

```ts
function result(requestId: string, answer: string): AiResult {
  return { requestId, status: 'succeeded', answer, mode: 'dify', error: null, localFacts: [], references: [] };
}

function serviceDependencies(overrides: Partial<AiServiceDependencies> = {}): AiServiceDependencies {
  return {
    ownerId: 'trusted-owner', user: 'derived-user',
    repository: { get: vi.fn(async () => null), reset: vi.fn(async () => undefined) },
    records: {
      claim: vi.fn(async () => ({ state: 'claimed' as const, conversationId: null, sessionGeneration: 0 })), complete: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined), list: vi.fn(async () => []),
    },
    retrieve: vi.fn(async () => ['本地已核验资料']),
    dify: { send: vi.fn(async () => ({ answer: '回答', conversationId: 'private-id' })) },
    now: () => new Date('2026-09-06T00:00:00.000Z'),
    ...overrides,
  };
}

it('claims the session before local retrieval and still retrieves before Dify', async () => {
  const order: string[] = [];
  const records = {
    claim: vi.fn(async () => { order.push('claim'); return { state: 'claimed' as const, conversationId: null, sessionGeneration: 0 }; }),
    complete: vi.fn(async () => { order.push('complete'); }),
    fail: vi.fn(async () => undefined), list: vi.fn(async () => []),
  };
  const dependencies = {
    ownerId: 'trusted-owner', user: 'derived-user', records,
    repository: { get: vi.fn(async () => null), save: vi.fn(async () => undefined), reset: vi.fn(async () => undefined) },
    retrieve: vi.fn(async () => { order.push('retrieve'); return ['本地已核验资料']; }),
    dify: { send: vi.fn(async () => { order.push('dify'); return { answer: '回答', conversationId: 'private-chat-id' }; }) },
    now: () => new Date('2026-09-06T00:00:00.000Z'),
  };
  await expect(handleAiRequest({ action: 'submit', request }, dependencies)).resolves.toMatchObject({ code: 'OK' });
  expect(order).toEqual(['claim', 'retrieve', 'dify', 'complete']);
  expect(dependencies.dify.send).toHaveBeenCalledWith('chat', request, null, 'derived-user', ['本地已核验资料']);
});

it('returns a cached result without directly rewriting the session', async () => {
  const cached = result('request-1', '缓存回答');
  const repository = { get: vi.fn(async () => null), reset: vi.fn(async () => undefined) };
  const dependencies = {
    ownerId: 'trusted-owner', user: 'derived-user', repository,
    records: { claim: vi.fn(async () => ({ state: 'cached' as const, result: cached })), complete: vi.fn(), fail: vi.fn(), list: vi.fn() },
    retrieve: vi.fn(async () => ['本地已核验资料']), dify: { send: vi.fn() }, now: () => new Date('2026-09-06T00:00:00.000Z'),
  };
  await expect(handleAiRequest({ action: 'submit', request }, dependencies)).resolves.toMatchObject({ code: 'OK', data: { answer: '缓存回答' } });
  expect(dependencies.dify.send).not.toHaveBeenCalled();
});

it('serializes different request IDs for the same owner and kind but not across kinds', async () => {
  const fixture = createAiDatabaseFixture();
  const records = createAiRecordRepository(fixture);
  const now = new Date('2026-09-06T00:00:00.000Z');
  await expect(records.claim('owner-a', { requestId: 'chat-1', kind: 'chat', question: '第一问' }, now)).resolves.toMatchObject({ state: 'claimed' });
  await expect(records.claim('owner-a', { requestId: 'chat-2', kind: 'chat', question: '第二问' }, now)).resolves.toMatchObject({ state: 'running' });
  await expect(records.claim('owner-a', { requestId: 'trip-1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: [] } }, now)).resolves.toMatchObject({ state: 'claimed' });
});

it('does not let an in-flight completion restore a reset session', async () => {
  const fixture = createAiDatabaseFixture();
  const records = createAiRecordRepository(fixture);
  const repository = createAiConversationRepository(fixture);
  const now = new Date('2026-09-06T00:00:00.000Z');
  const claim = await records.claim('owner-a', request, now);
  expect(claim).toMatchObject({ state: 'claimed', sessionGeneration: 0 });
  await repository.reset('owner-a', 'chat');
  await records.complete('owner-a', request, result(request.requestId, '旧请求回答'), 'old-private-id', new Date(now.getTime() + 1_000));
  await expect(repository.get('owner-a', 'chat')).resolves.toBeNull();
});

it('never rolls the active session back when an older cached request is replayed', async () => {
  const fixture = createAiDatabaseFixture();
  const records = createAiRecordRepository(fixture);
  const now = new Date('2026-09-06T00:00:00.000Z');
  await records.claim('owner-a', request, now);
  await records.complete('owner-a', request, result(request.requestId, '第一答'), 'private-first', now);
  const second = { ...request, requestId: 'request-2', question: '第二问' };
  await records.claim('owner-a', second, new Date(now.getTime() + 1_000));
  await records.complete('owner-a', second, result(second.requestId, '第二答'), 'private-second', new Date(now.getTime() + 1_000));
  await expect(records.claim('owner-a', request, new Date(now.getTime() + 2_000))).resolves.toMatchObject({ state: 'cached' });
  await expect(createAiConversationRepository(fixture).get('owner-a', 'chat')).resolves.toBe('private-second');
});

it.each([
  [{ state: 'running' as const }, 'CONFLICT'],
  [new AiRateLimitError('minute'), 'RATE_LIMITED'],
  [new AiRetryLimitError('retry limit'), 'CONFLICT'],
])('returns a safe public error without calling Dify', async (claimOutcome, expectedCode) => {
  const claim = claimOutcome instanceof Error ? vi.fn(async () => { throw claimOutcome; }) : vi.fn(async () => claimOutcome);
  const dependencies = serviceDependencies({ records: { claim, complete: vi.fn(), fail: vi.fn(), list: vi.fn() } });
  const response = await handleAiRequest({ action: 'submit', request }, dependencies);
  expect(response).toMatchObject({ code: expectedCode, data: null });
  expect(dependencies.dify.send).not.toHaveBeenCalled();
});

it('marks a timed-out claimed request and keeps the public error free of private details', async () => {
  const dependencies = serviceDependencies({
    dify: { send: vi.fn(async () => { throw Object.assign(new Error('private upstream detail'), { code: 'AI_TIMEOUT' }); }) },
  });
  const response = await handleAiRequest({ action: 'submit', request }, dependencies);
  expect(dependencies.records.fail).toHaveBeenCalledWith('trusted-owner', request, 'timed_out', expect.any(Date));
  expect(response).toMatchObject({ code: 'AI_TIMEOUT', message: 'AI 服务响应超时，请稍后重试。' });
  expect(JSON.stringify(response)).not.toContain('private upstream detail');
});
```

Add a retrieval regression case:

```ts
function createRetrievalDatabase(options: { contentError: Error }) {
  const place = { _id: 'published-place', status: 'published', name: '三峡大坝', category: 'scenic', intro: '已核验简介' };
  return {
    collection(name: string) {
      return {
        where() { return { limit() { return { async get() { return { data: [place] }; } }; } }; },
        doc() { return { async get() { if (name === 'place_contents') throw options.contentError; return { data: place }; } }; },
      };
    },
  };
}

it('treats missing optional content as empty but propagates other content database errors', async () => {
  const missing = createRetrievalDatabase({ contentError: new Error('not found') });
  await expect(createLocalFactRetriever(missing)(request)).resolves.toEqual([expect.stringContaining('本地已核验资料')]);
  const denied = createRetrievalDatabase({ contentError: new Error('permission denied') });
  await expect(createLocalFactRetriever(denied)(request)).rejects.toThrow('permission denied');
});
```

- [ ] **Step 2: Extend adapter regression coverage for both routes and required environment names**

In `tests/unit/dify-adapter.test.ts`, keep all current timeout/retry cases and add one common-base test that invokes both kinds and inspects only test sentinel headers:

```ts
it('uses one common base URL and distinct server-only credentials for chat and trip', async () => {
  const fetch = vi.fn<RequestCall>(async () => new Response(JSON.stringify({ answer: '回答', conversation_id: 'private-id' }), { status: 200 }));
  const client = createDifyClient({
    DIFY_BASE_URL: 'https://unit.example/v1',
    DIFY_CHAT_API_KEY: 'unit-chat-credential',
    DIFY_TRIP_API_KEY: 'unit-trip-credential',
  }, fetch);
  await client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'derived-user', ['已核验资料']);
  await client.send('trip', { requestId: 't1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景'] } }, null, 'derived-user', ['已核验资料']);
  expect(fetch.mock.calls.map(call => call[0])).toEqual(['https://unit.example/v1/chat-messages', 'https://unit.example/v1/chat-messages']);
  expect(fetch.mock.calls.map(call => (call[1]?.headers as Record<string, string>).Authorization)).toEqual(['Bearer unit-chat-credential', 'Bearer unit-trip-credential']);
  expect(JSON.stringify(fetch.mock.calls)).not.toContain('DIFY_CHAT_API_KEY');
});

it('ignores legacy per-kind base URL overrides', async () => {
  const fetch = vi.fn<RequestCall>(async () => new Response(JSON.stringify({ answer: '回答', conversation_id: 'private-id' }), { status: 200 }));
  const client = createDifyClient({
    DIFY_BASE_URL: 'https://unit.example/v1', DIFY_CHAT_API_BASE_URL: 'https://stale.example',
    DIFY_CHAT_API_KEY: 'unit-chat-credential', DIFY_TRIP_API_KEY: 'unit-trip-credential',
  }, fetch);
  await client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'derived-user', []);
  expect(fetch.mock.calls[0][0]).toBe('https://unit.example/v1/chat-messages');
});
```

These are non-secret test sentinels, not deployable credentials.

- [ ] **Step 3: Run focused tests and confirm red state**

Run: `npm run test -- tests/unit/ai-service.test.ts tests/unit/dify-adapter.test.ts`

Expected: FAIL because the service still calls `find/save`, cannot map running/local-quota/retry-limit outcomes, has no owner-and-kind session lease or reset generation, and `contentFor` suppresses all errors.

- [ ] **Step 4: Centralize exact missing-document recognition**

Create `cloudfunctions/ai/database-errors.ts` and use it from `records.ts`, `repository.ts`, and `retrieval.ts`:

```ts
export function isMissingDocument(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; errCode?: unknown; errMsg?: unknown; message?: unknown };
  const code = String(value.code ?? value.errCode ?? '').toUpperCase();
  const message = String(value.message ?? value.errMsg ?? '').toLowerCase();
  return code === 'NOT_FOUND'
    || code.includes('DOCUMENT_NOT_FOUND')
    || message === 'not found'
    || message.includes('document does not exist')
    || /^document\.get:fail document with _id \S+ does not exist$/.test(message);
}
```

Change `contentFor` so only `isMissingDocument(error)` returns `{}`; every other error is rethrown.

- [ ] **Step 5: Add the owner-and-kind generation lease**

Extend `AiRecordClaim` to return the conversation snapshot captured by the transaction:

```ts
export type AiRecordClaim =
  | { state: 'claimed'; conversationId: string | null; sessionGeneration: number }
  | { state: 'running' }
  | { state: 'missing_session' }
  | { state: 'cached'; result: AiResult };
```

During `records.claim`, read the deterministic `ai_sessions` document in the same transaction. Treat a missing session as generation `0`. Before quota charging, return `running` when `activeRequestId` belongs to another request and `leaseUntil` is newer than `now`. Return `missing_session` for a trip follow-up without a Dify pointer. Otherwise store `activeRequestId`, the current generation, and `leaseUntil = now + 90 seconds`; store the same `sessionGeneration` on the request record. `chat` and `trip` use different session document IDs, so they do not block each other.

For a cached success, return the sanitized result without normally changing the session. The transaction may repair a missing Dify pointer only when all of these are true: the record has a numeric `sessionGeneration`; it equals the current session generation; `lastCompletedRequestId` equals this request ID; and the session pointer is empty. Legacy records or older cached requests never repair a session.

During `records.complete`, always finalize the claimed request record, but update the session pointer and `lastCompletedRequestId` and clear the lease only when both `generation === record.sessionGeneration` and `activeRequestId === request.requestId`. During `records.fail`, clear the lease only under the same check. An intervening reset or newer lease therefore cannot be overwritten.

Change `repository.reset` to `database.runTransaction(callback, 3)`: read the current session, write `generation + 1`, set `difyConversationId`, `activeRequestId`, `leaseUntil`, and `lastCompletedRequestId` to `null`, preserve the trusted owner/kind, and update `updatedAt`. Remove the now-unused public `save` method from `AiConversationRepository`.

- [ ] **Step 6: Update service orchestration and public errors**

Add `now?: () => Date` to `AiServiceDependencies`, default it to `() => new Date()`, and change the submit path to this order:

```ts
const claim = await dependencies.records.claim(ownerId, request, now());
if (claim.state === 'running') {
  return fail('CONFLICT', '该请求仍在处理中，请稍后重试。');
}
if (claim.state === 'missing_session') {
  return fail('INVALID_INPUT', '请先提交行程信息，再继续调整。');
}
if (claim.state === 'cached') {
  return ok(claim.result);
}
let localFacts: string[];
try {
  localFacts = await dependencies.retrieve(request);
} catch {
  await dependencies.records.fail(ownerId, request, 'failed', now());
  return fail('INTERNAL_ERROR', '本地地点资料暂时无法读取，请稍后重试。');
}
let response: { answer: string; conversationId: string };
try {
  response = await dependencies.dify.send(request.kind, request, claim.conversationId, dependencies.user, localFacts);
} catch (error) {
  const isTimeout = error && typeof error === 'object' && (error as { code?: unknown }).code === 'AI_TIMEOUT';
  try {
    await dependencies.records.fail(ownerId, request, isTimeout ? 'timed_out' : 'failed', now());
  } catch {
    return fail('INTERNAL_ERROR', 'AI 请求状态暂时无法保存，请稍后重试。');
  }
  return safeError(error);
}
const result: AiResult = {
  requestId: request.requestId, status: 'succeeded', answer: response.answer,
  mode: 'dify', error: null, localFacts, references: [],
};
try {
  await dependencies.records.complete(ownerId, request, result, response.conversationId, now());
  return ok(result);
} catch {
  return fail('INTERNAL_ERROR', 'AI 回答暂时无法保存，请稍后重试。');
}
```

Map `AiRateLimitError` to `RATE_LIMITED` with `请求较频繁，请稍后再试。`; map `AiRecordConflictError`, `AiRequestInProgressError`, `AiRetryLimitError`, and `running` to distinct safe `CONFLICT` messages; retain the existing safe `AI_TIMEOUT`, `AI_UNAVAILABLE`, and `INTERNAL_ERROR` messages. If persisting a failed state also fails, return `INTERNAL_ERROR` and do not expose either database or upstream details. If Dify succeeds but the atomic result/session transaction fails, leave the request claim recoverable by the 90-second stale rule and return the safe save-failure message; do not incorrectly mark the upstream call as failed.

In `requestInput`, never spread the client trip object. Rebuild exactly `{ destination, people, totalBudgetCny, days, preferences }` from validated values and discard every other top-level or nested field.

The Dify adapter keeps the existing route selection, first-trip six custom inputs, built-in `query`, 45-second deadline, three-attempt ceiling, retry status allowlist, and safe response parser. Change configuration lookup to use only `DIFY_BASE_URL`; remove per-kind base URL selection from code and tests.

- [ ] **Step 7: Run focused and boundary tests, then commit**

Run: `npm run test -- tests/unit/ai-service.test.ts tests/unit/dify-adapter.test.ts tests/unit/ai-records.test.ts`

Expected: PASS; chat and trip route to separate credentials, the claim precedes local retrieval and local retrieval precedes Dify, running/limited/exhausted calls never reach Dify, reset wins against in-flight completion, and old cached success cannot roll back a session.

Run: `npm run typecheck && npm run lint && npm run build && npm run check:package`

Expected: PASS; the demo mini-program package contains no Dify endpoint, credential name, bearer header, server SDK, or private conversation ID.

Commit:

```bash
git add cloudfunctions/ai/database-errors.ts cloudfunctions/ai/records.ts cloudfunctions/ai/repository.ts cloudfunctions/ai/retrieval.ts cloudfunctions/ai/service.ts tests/unit/ai-service.test.ts tests/unit/dify-adapter.test.ts
git diff --cached --check
git commit -m "fix: harden blocking AI orchestration"
```

### Task 3: Align persisted history, indexes, and the history page

**Files:**
- Create: `shared/ai-history.ts`
- Create: `tests/unit/ai-history.test.ts`
- Modify: `shared/contracts.ts:64-67`
- Modify: `cloudfunctions/ai/records.ts:44-65`
- Modify: `miniprogram/services/ai.ts:1-70`
- Modify: `miniprogram/pages/ai-history/index.ts:1-20`
- Modify: `miniprogram/pages/ai-history/index.wxml:1`
- Modify: `miniprogram/pages/ai-history/index.wxss:1`
- Modify: `tests/unit/ai-records.test.ts:35-78`
- Modify: `tests/unit/ai-service.test.ts:16-73`
- Modify: `database/schema.md:17-31`
- Modify: `database/indexes.json:8-11`

**Interfaces:**
- Consumes: successful combined records from Task 1 and existing `listRecords` cloud action.
- Produces: required `AiHistoryItem.prompt`, newest-first owner history, and user-before-assistant rendering.

- [ ] **Step 1: Write failing summary, ordering, and UI tests**

Create `tests/unit/ai-history.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAiRequestSummary } from '../../shared/ai-history';

type HistoryPage = {
  data: Record<string, unknown>;
  setData(value: Record<string, unknown>): void;
  load(): Promise<void>;
};

afterEach(() => { vi.resetModules(); vi.unstubAllGlobals(); vi.doUnmock('../../miniprogram/services/ai'); });

describe('AI history presentation', () => {
  it('formats chat, initial trip and trip follow-up inputs without private fields', () => {
    expect(formatAiRequestSummary({ requestId: 'c1', kind: 'chat', question: '三峡大坝怎么去？' })).toBe('三峡大坝怎么去？');
    expect(formatAiRequestSummary({ requestId: 't1', kind: 'trip', trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景', '美食探索'] } })).toBe('宜昌｜2人｜2天｜总预算3000元｜偏好：自然风景、美食探索');
    expect(formatAiRequestSummary({ requestId: 't2', kind: 'trip', question: '第二天轻松一点' })).toBe('第二天轻松一点');
  });

  it('renders the saved prompt before the assistant response', async () => {
    vi.doMock('../../miniprogram/services/ai', () => ({ listAiRecords: vi.fn(async () => [{
      requestId: 'c1', kind: 'chat', prompt: '原始问题', createdAt: '2026-09-06T00:00:00.000Z',
      status: 'succeeded', answer: 'AI 回答', mode: 'dify', error: null, localFacts: [], references: [],
    }]) }));
    let page: HistoryPage;
    vi.stubGlobal('Page', (definition: HistoryPage) => { page = definition; });
    await import('../../miniprogram/pages/ai-history/index');
    page!.setData = function (value) { Object.assign(this.data, value); };
    await page!.load();
    expect(page!.data).toMatchObject({ status: 'ready', records: [{ prompt: '原始问题', answer: 'AI 回答' }] });
  });
});
```

Extend `tests/unit/ai-records.test.ts` by seeding more than 50 mixed owner records with deliberately shuffled storage order and equal timestamps. Assert the result contains only the trusted owner, has length 50, orders `createdAt` descending, uses record ID ascending for ties, and includes safe chat/trip prompts. Extend the query fixture assertions to require both `orderBy('createdAt', 'desc')` and `orderBy('_id', 'asc')`.

- [ ] **Step 2: Run focused tests and confirm red state**

Run: `npm run test -- tests/unit/ai-history.test.ts tests/unit/ai-records.test.ts tests/unit/ai-service.test.ts`

Expected: FAIL because `formatAiRequestSummary`, `AiHistoryItem.prompt`, ordered database queries, and user bubbles do not exist.

- [ ] **Step 3: Add the shared safe summary contract**

Create `shared/ai-history.ts`:

```ts
import type { AiRequest } from './contracts';

export function formatAiRequestSummary(request: AiRequest) {
  if (request.question) return request.question.trim();
  if (!request.trip) return request.kind === 'trip' ? '历史行程定制' : '历史自由问答';
  const trip = request.trip;
  const preferences = trip.preferences.length ? trip.preferences.join('、') : '未指定';
  return `${trip.destination}｜${trip.people}人｜${trip.days}天｜总预算${trip.totalBudgetCny}元｜偏好：${preferences}`;
}
```

Change the public contract to:

```ts
export interface AiHistoryItem extends AiResult {
  kind: AiKind;
  prompt: string;
  createdAt: string;
}
```

No Dify user or conversation identifier is added to this contract.

- [ ] **Step 4: Order and sanitize owner history in the repository**

For both `ai_messages` and `trip_requests`, query:

```ts
database.collection(collectionName(kind))
  .where({ ownerId })
  .orderBy('createdAt', 'desc')
  .orderBy('_id', 'asc')
  .limit(50)
  .get();
```

Map each valid successful record to an internal `{ recordId: item._id, ...result, kind, prompt: formatAiRequestSummary(safeRequest(item.request, kind)), createdAt }`. For legacy records without a valid stored request, use `历史自由问答` or `历史行程定制`; never synthesize a question from an answer. Merge both collections, sort by `createdAt DESC` then `recordId ASC`, remove `recordId`, and return the first 50.

- [ ] **Step 5: Render user input before each saved assistant answer**

In `miniprogram/services/ai.ts`, append development records with `prompt: formatAiRequestSummary(request)`. In `miniprogram/pages/ai-history/index.wxml`, render:

```xml
<view wx:for="{{records}}" wx:key="requestId" class="history-item">
  <text class="history-title">{{item.title}}</text>
  <message-bubble role="user" content="{{item.prompt}}" mode="" label="" />
  <message-bubble role="assistant" content="{{item.answer}}" mode="{{item.mode}}" label="{{item.mode === 'mock' ? '模拟回答，仅用于交互测试' : ''}}" />
  <source-card facts="{{item.localFacts}}" references="{{item.references}}" />
</view>
```

Keep the existing disclaimer and retry/empty UI. Add only spacing needed between the two bubbles; do not render any internal identifier.

Update the live-history fixture in `tests/unit/ai-service.test.ts` to include `prompt: '原始问题'`, and assert `listAiRecords()` preserves that field unchanged from the owner-scoped cloud response.

- [ ] **Step 6: Align schema and indexes with the combined-record implementation**

Update `database/schema.md` so `ai_messages` and `trip_requests` document deterministic `_id=hash(ownerId,requestId)`, `ownerId`, `requestId`, `kind`, `inputHash`, sanitized `request`, public `result`, private optional `difyConversationId`, `status`, `attemptCount`, `lastAttemptAt`, `sessionGeneration`, `claimedAt`, `quotaChargedAt`, `createdAt`, and `updatedAt`. Document `ai_sessions.generation`, `activeRequestId`, `leaseUntil`, and `lastCompletedRequestId`, plus backward-compatible reads and no destructive migration.

Replace the `ai_messages` index and retain the equivalent trip index:

```json
{ "collection": "ai_messages", "name": "owner_created", "fields": [["ownerId", "asc"], ["createdAt", "desc"], ["_id", "asc"]] },
{ "collection": "trip_requests", "name": "owner_created", "fields": [["ownerId", "asc"], ["createdAt", "desc"], ["_id", "asc"]] }
```

Keep `usage_counters` in `database/security-rules.json` with both client read and write set to `false`.

- [ ] **Step 7: Run focused and full checks, then commit**

Run: `npm run test -- tests/unit/ai-history.test.ts tests/unit/ai-records.test.ts tests/unit/ai-service.test.ts tests/contracts/database-security.test.ts`

Expected: PASS with 50 newest owner-only records and visible safe prompts.

Run: `npm run typecheck && npm run lint && npm run build && npm run build:demo && npm run check:package`

Expected: PASS.

Commit:

```bash
git add shared/ai-history.ts shared/contracts.ts cloudfunctions/ai/records.ts miniprogram/services/ai.ts miniprogram/pages/ai-history/index.ts miniprogram/pages/ai-history/index.wxml miniprogram/pages/ai-history/index.wxss database/schema.md database/indexes.json tests/unit/ai-history.test.ts tests/unit/ai-records.test.ts tests/unit/ai-service.test.ts tests/contracts/database-security.test.ts
git diff --cached --check
git commit -m "feat: show ordered AI request history"
```

### Task 4: Update the non-secret CloudBase deployment runbook

**Files:**
- Modify: `docs/runbooks/dify-chatflow.md:1-67`
- Modify: `tests/unit/build.test.ts:120-175`

**Interfaces:**
- Consumes: Tasks 1–3 deployment artifacts and database declarations.
- Produces: a secret-free, step-by-step console procedure and automated documentation/package guard.

- [ ] **Step 1: Write a failing runbook contract test**

Add to `tests/unit/build.test.ts`:

```ts
it('documents only the required Dify variable names and hardening deployment resources', async () => {
  const runbook = await readFile(path.join(process.cwd(), 'docs/runbooks/dify-chatflow.md'), 'utf8');
  for (const name of ['DIFY_BASE_URL', 'DIFY_CHAT_API_KEY', 'DIFY_TRIP_API_KEY', 'usage_counters', 'ai_messages', 'trip_requests', 'ADMINONLY', '120 秒', '45 秒']) {
    expect(runbook).toContain(name);
  }
  expect(runbook).toContain('destination');
  expect(runbook).toContain('local_verified_facts');
  expect(runbook).not.toContain('DIFY_CHAT_API_BASE_URL');
  expect(runbook).not.toContain('DIFY_TRIP_API_BASE_URL');
  expect(runbook).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{12,}/);
});
```

- [ ] **Step 2: Run the contract test and confirm red state**

Run: `npm run test -- tests/unit/build.test.ts`

Expected: FAIL because the current runbook does not yet document `usage_counters`, the required hardening indexes, or the exact permission label.

- [ ] **Step 3: Expand the runbook with exact console steps and no values**

Update `docs/runbooks/dify-chatflow.md` with these operational steps:

1. Sign in to the Tencent Cloud account that owns the target mini-program and open the intended CloudBase environment.
2. Open **Cloud Functions → aiService → Function configuration → Environment variables**.
3. Add the names `DIFY_BASE_URL`, `DIFY_CHAT_API_KEY`, and `DIFY_TRIP_API_KEY`. Paste each value only into its masked console field; do not put it in chat, a local file, a screenshot, a command, or Git.
4. Save the configuration and verify only that all three names exist. Do not reveal or copy their values during verification.
5. Remove legacy `DIFY_CHAT_API_BASE_URL` and `DIFY_TRIP_API_BASE_URL` entries if present; both applications must use the verified common HTTPS base URL.
6. Keep the function timeout at 120 seconds. The code-level Dify deadline stays 45 seconds.
7. Confirm the first trip Chatflow has `destination`, `people`, `totalBudgetCny`, `days`, `preferences`, and optional `local_verified_facts`; both flows continue using built-in `query`.
8. Create or verify `ai_sessions`, `ai_messages`, `trip_requests`, and `usage_counters`, each with `ADMINONLY` direct access.
9. Create `ownerId ASC + createdAt DESC + _id ASC` indexes on `ai_messages` and `trip_requests`; configure lifecycle cleanup for expired usage counters according to the target CloudBase environment's supported TTL policy.
10. Build and deploy `aiService` without replacing its environment variables.
11. Verify a chat question, initial trip, trip follow-up, chat reset, trip reset, cached retry, understandable timeout/unavailable message, and 3-per-minute rejection without recording private IDs.

State explicitly that the mini-program calls only `wx.cloud.callFunction({ name: 'aiService' })`, local published data is retrieved before Dify, and chat/trip sessions remain isolated. Retain the no-secret rollback procedure.

- [ ] **Step 4: Run documentation and leak checks, then commit**

Run: `npm run test -- tests/unit/build.test.ts`

Expected: PASS.

Run: `npm run build:demo && npm run check:package && npm run verify:docs && git diff --check`

Expected: PASS; no secret value or direct Dify client call is present in the mini-program package.

Commit:

```bash
git add docs/runbooks/dify-chatflow.md tests/unit/build.test.ts
git diff --cached --check
git commit -m "docs: add Dify hardening deployment steps"
```

### Task 5: Deploy, smoke-test, and independently accept the hardening

**Files:**
- Create: `docs/testing/2026-09-06-dify-blocking-hardening-qa.md`

**Interfaces:**
- Consumes: the final application commit from Tasks 1–4, the already configured CloudBase environment, and the two published Chatflows.
- Produces: deployed `aiService`, verified private collections/indexes, real observable smoke results, and an independent QA record tied to an exact commit.

- [ ] **Step 1: Run the complete developer verification gate**

Run each command separately and record its exit result:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
npm run build:demo
npm run check:package
npm run verify:docs
git diff --check
```

Expected: all commands PASS. The Vitest summary must have no failing test file; the existing environment-dependent database security test may remain explicitly skipped only when the required CloudBase test environment is unavailable.

- [ ] **Step 2: Review the deployable package before cloud changes**

Inspect `dist/miniprogram` and `dist/cloudfunctions/aiService` with the existing package checker. Confirm the client contains no Dify domain, `/v1/chat-messages`, environment-variable name, authorization header, `wx-server-sdk`, or private conversation identifier. Confirm only the cloud function bundle contains the Dify adapter.

- [ ] **Step 3: Apply CloudBase collection and index configuration**

In the target CloudBase environment, verify `usage_counters` exists and is `ADMINONLY`; do not modify the unrelated environment. Verify the two compound indexes exactly match `database/indexes.json`. Do not delete or rewrite existing AI records.

- [ ] **Step 4: Deploy the cloud function without touching secret values**

Deploy `dist/cloudfunctions/aiService` with cloud dependencies and retain the three existing required environment-variable entries. Confirm the function timeout remains 120 seconds. Verification records may list variable names and presence only; they must not contain values.

- [ ] **Step 5: Run real blocking smoke tests**

Use non-sensitive prompts and record only observable outcomes:

- Send one free question and one follow-up; both return `mode: dify` and the follow-up remains in the chat context.
- Submit one itinerary with all five trip fields plus the built-in query, then one adjustment; both return `mode: dify` and remain in trip context.
- Verify chat content does not appear in trip context and vice versa; reset each kind separately.
- Ask about a known published place and verify the response includes the observable local verified-facts source card before accepting Dify supplementation.
- Replay one completed request ID with identical input and verify the returned result is identical without creating another visible history entry.
- While one chat request is in flight, submit a different chat request and verify it receives the processing conflict without reaching Dify; verify a trip request can still proceed independently.
- Reset a conversation while a controlled request is in flight and verify the older completion cannot restore the reset context.
- Replay an older successful request after a newer turn and verify the current conversation does not move backward.
- Fail the same logical request twice and verify a third logical invocation is rejected until the client creates a new request ID.
- Submit four unique requests inside one fixed minute and verify the fourth returns the understandable rate-limit message without a fabricated answer.
- Verify the history page shows the original user question/trip summary before each answer and returns newest-first owner-only records.
- Observe timeout/unavailable handling through a controlled non-production failure path; do not remove or replace live credentials merely to force an error.

The 20-per-day limit, two-real-user isolation, ambiguous upstream disconnect, and legacy partial-write recovery may be accepted through automated tests if safely reproducing them in the live environment is impractical. Mark each unexecuted live case explicitly; do not claim it was run.

- [ ] **Step 6: Perform independent code review and QA**

The reviewer inspects the final application commit for transaction correctness, owner scoping, quota charging exactly once, bounded logical retries, session generation/lease races, safe cached replay, strict request/result whitelists, database error propagation, common-base Dify routing, and client/server leakage. A separate tester reruns the complete gate from Step 1 and checks the real smoke evidence from Step 5.

Create `docs/testing/2026-09-06-dify-blocking-hardening-qa.md` with:

- tested Git commit hash;
- environment name only, without account IDs, user identifiers, keys, or conversation IDs;
- every command actually executed and its result;
- each real smoke case and observable result;
- defects found and their resolution commit;
- untested or blocked items, especially Android/iPhone, two-user isolation, daily quota, and ambiguous network completion;
- independent reviewer and tester disposition stated separately.

- [ ] **Step 7: Commit the acceptance record**

Run: `npm run verify:docs && git diff --check`

Expected: PASS.

Commit:

```bash
git add docs/testing/2026-09-06-dify-blocking-hardening-qa.md
git diff --cached --check
git commit -m "test: record Dify hardening acceptance"
```

## Plan self-review

- **Spec coverage:** Task 1 covers deterministic request claims, concurrent deduplication, bounded logical retries, strict stored-result/counter validation, stale recovery, and 3/minute plus 20/day atomic quotas. Task 2 covers claim-before-retrieval/database-before-Dify orchestration, both Chatflow routes, owner-kind session generations and leases, reset-safe completion, safe cached replay, blocking timeout/retries, strict request whitelisting, and safe errors. Task 3 covers canonical persistence, indexes, owner-scoped newest-first history, and original-input display. Task 4 covers the three required environment-variable names, removal of legacy base overrides, and exact CloudBase console/deployment procedure without values. Task 5 covers complete checks, Git discipline, deployment, real smoke tests, and independent acceptance.
- **Placeholder scan:** The plan contains no unfinished implementation marker; every code change names concrete files, interfaces, assertions, commands, expected results, and commit boundaries.
- **Type consistency:** `AiRecordRepository.claim/complete/fail/list`, `AiRecordClaim.state`, `AiHistoryItem.prompt`, `formatAiRequestSummary`, `AiRateLimitError`, `AiRequestInProgressError`, `AiRetryLimitError`, `aiSessionDocumentId`, and existing `DifyClient.send` use the same names and shapes in all tasks. Public contracts contain no Dify conversation field.
- **Scope control:** The plan does not add streaming, asynchronous workers, payments, booking, login, real-time data, destructive migration, or new client access to private collections.

# AI Session History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save `chat` and `trip` as separate owner-scoped multi-session histories and let users open a session to read its complete transcript.

**Architecture:** Add a public opaque `sessionId` to requests and create it only through `aiService`; retain Dify conversation IDs exclusively in per-session CloudBase documents. New request records carry that public ID, while a read-only `legacy-chat` / `legacy-trip` compatibility path groups pre-upgrade records that have no ID. Replace the history wall with a list page and session-detail page, and make trip regeneration explicitly create a new trip session.

**Tech Stack:** TypeScript, CloudBase transaction fixture, native WeChat Mini Program WXML/WXSS, Vitest, ESLint, esbuild.

## Global Constraints

- Dify remains callable only through `aiService`; do not change Dify workflows, model settings, keys, or environment variables.
- Never expose OpenID, Dify conversation IDs, leases, usage counters, or environment values in public contracts, pages, tests, logs, or Git.
- Both record collections and `ai_sessions` remain `ADMINONLY`; every read/write verifies current owner and kind on the server.
- Existing documents are not deleted or bulk-rewritten. Missing `sessionId` is readable only under the owner-scoped `legacy-chat` / `legacy-trip` compatibility sessions.
- Every code task starts with a failing test, ends with its own focused Conventional Commit, and leaves current untracked files untouched.

---

### Task 1: Define public session contracts and owner-scoped service actions

**Files:**
- Modify: `shared/contracts.ts`
- Modify: `miniprogram/services/ai.ts`
- Modify: `cloudfunctions/ai/service.ts`
- Modify: `tests/unit/ai-service.test.ts`

**Interfaces:**
- `AiRequest` gains `sessionId: string`.
- New public types are `AiSessionSummary { sessionId; kind; title; preview; createdAt; updatedAt }` and `AiSessionDetail { session: AiSessionSummary; records: AiHistoryItem[] }`.
- `aiService` accepts `createSession`, `listSessions`, `listSessionRecords`, and existing `submit`; `submit` rejects an absent/malformed session ID before claim/retrieval/Dify.

- [ ] **Step 1: Add failing service-contract tests**

Add tests that call `handleAiRequest({ action: 'createSession', kind: 'chat' }, dependencies)` and expect a public summary, call `listSessions` and `listSessionRecords` with only public data, and assert that a `submit` request without `sessionId` returns `INVALID_INPUT` without calling records, retrieval, or Dify.

```ts
expect(await handleAiRequest({ action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '问题' } }, dependencies))
  .toMatchObject({ code: 'INVALID_INPUT', data: null });
expect(dependencies.records.claim).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused test to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-service.test.ts`

Expected: FAIL because the current request has no session ID and the service exposes only `listRecords` / `resetConversation`.

- [ ] **Step 3: Add contracts and the safe client adapter**

Define the summary/detail types and make `sessionId` required in `AiRequest`. In `miniprogram/services/ai.ts`, add:

```ts
export const createAiSession = (kind: AiKind) => callAi<AiSessionSummary>('createSession', { kind });
export const listAiSessions = (kind?: AiKind) => callAi<AiSessionSummary[]>('listSessions', kind ? { kind } : {});
export const listAiSessionRecords = (sessionId: string) => callAi<AiSessionDetail>('listSessionRecords', { sessionId });
```

Extend the service event union and validation so only `s_` plus 22 base64url characters or the two legacy literals are accepted. Route the three actions to repository methods and use the existing safe error envelope; do not make `listRecords` public after this change.

- [ ] **Step 4: Verify contracts and boundary behavior**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-service.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js shared\\contracts.ts miniprogram\\services\\ai.ts cloudfunctions\\ai\\service.ts tests\\unit\\ai-service.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the public contract change**

```powershell
git add -- shared/contracts.ts miniprogram/services/ai.ts cloudfunctions/ai/service.ts tests/unit/ai-service.test.ts
git diff --cached --check
git commit -m "feat: add owner-scoped AI session actions"
```

### Task 2: Persist multiple private sessions and compatible record histories

**Files:**
- Modify: `cloudfunctions/ai/repository.ts`
- Modify: `cloudfunctions/ai/records.ts`
- Modify: `tests/helpers/ai-database.ts`
- Modify: `tests/unit/ai-records.test.ts`
- Modify: `database/schema.md`
- Modify: `database/indexes.json`
- Modify: `tests/contracts/database-security.test.ts`

**Interfaces:**
- `AiConversationRepository.create(ownerId, kind, now)`, `get(ownerId, sessionId, kind)`, `list(ownerId, kind?)`, and `legacy(ownerId, kind)` create/read summaries without exposing private Dify values.
- `AiRecordRepository.claim/complete/fail` take a validated session summary; `listSession(ownerId, sessionId)` returns only the session's safe records.

- [ ] **Step 1: Add failing multi-session and legacy tests**

Create two chat sessions and one trip session for one owner. Store records in each and assert a list request separates types, a detail reads only its ID, and another owner cannot read/claim either ID. Add legacy fixture records with no `sessionId`, assert they appear only in the matching legacy summary, and assert a legacy Dify ID is used only when owner and kind match.

```ts
await expect(records.listSession('owner-b', chatSession.sessionId)).resolves.toEqual([]);
await expect(records.listSession('owner-a', tripSession.sessionId)).resolves.toEqual([]);
expect(JSON.stringify(await sessions.list('owner-a'))).not.toContain('private-conversation');
```

- [ ] **Step 2: Run record/security tests to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts tests\\contracts\\database-security.test.ts`

Expected: FAIL because session documents are currently hashed only by owner/kind and records do not carry session IDs.

- [ ] **Step 3: Implement one document per public session**

Generate a new public ID with `randomBytes(16).toString('base64url')` as `s_<value>`; store it with `ownerId`, `kind`, blank private conversation ID, timestamps, title/preview, and the existing active-lease fields. Hash owner plus public ID for the document key. Preserve deterministic owner/kind documents as legacy only.

Add `sessionId` to sanitized new record input and stored records. In successful completion, update that session's private Dify ID, title from the safe first prompt, preview from the safe answer, and `updatedAt`. Query session records with owner and sessionId; for legacy literals query only records with owner/kind and an absent session field. Validate all malformed documents fail closed.

Update the schema and add indexes named `owner_kind_updated` on `ai_sessions` (`ownerId`, `kind`, `updatedAt desc`, `_id asc`) and `owner_session_created` on both record collections (`ownerId`, `sessionId`, `createdAt desc`, `_id asc`). Keep all direct client rules deny-all.

- [ ] **Step 4: Verify persistence and privacy**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts tests\\contracts\\database-security.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\repository.ts cloudfunctions\\ai\\records.ts tests\\helpers\\ai-database.ts tests\\unit\\ai-records.test.ts tests\\contracts\\database-security.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the persistence and compatibility change**

```powershell
git add -- cloudfunctions/ai/repository.ts cloudfunctions/ai/records.ts tests/helpers/ai-database.ts tests/unit/ai-records.test.ts database/schema.md database/indexes.json tests/contracts/database-security.test.ts
git diff --cached --check
git commit -m "feat: persist separate AI conversation sessions"
```

### Task 3: Replace the history wall with session list and detail pages

**Files:**
- Modify: `miniprogram/app.json`
- Modify: `miniprogram/pages/ai-history/index.ts`, `index.wxml`, `index.wxss`
- Create: `miniprogram/pages/ai-session/index.ts`, `index.wxml`, `index.wxss`, `index.json`
- Modify: `tests/unit/ai-history.test.ts`
- Create: `tests/unit/ai-session-page.test.ts`

**Interfaces:**
- `ai-history` renders `{ chatSessions, tripSessions }` and navigates with only `sessionId` and `kind` query values.
- `ai-session` validates those values, calls `listAiSessionRecords(sessionId)`, and renders all safe records from one returned detail object.

- [ ] **Step 1: Add failing page tests**

Mock `listAiSessions` with one item of each kind and assert `ai-history` stores separate arrays and navigates to `/pages/ai-session/index?sessionId=s_example&kind=chat`. Create a detail-page test that mocks a two-record transcript, verifies both user prompts and answers become visible data, and verifies malformed route input produces the existing friendly error state without a cloud call.

- [ ] **Step 2: Run page tests to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-history.test.ts tests\\unit\\ai-session-page.test.ts`

Expected: FAIL because the history page renders a flat `listAiRecords()` result and no detail page exists.

- [ ] **Step 3: Implement list then detail navigation**

Register `pages/ai-session/index` in `app.json`. Render headings “自由问答” and “行程定制”; each card shows title, preview and updated time and binds `openSession`. In the detail page, call the session-record adapter, render message/source components in chronological order, and add “继续此会话” that navigates only to `/pages/ai-chat/index?sessionId=...` for chat or `/pages/trip-form/index?sessionId=...` for trip.

Use existing `async-state` components for loading/empty/error/retry. Do not place answer text or source data in navigation query strings.

- [ ] **Step 4: Verify list/detail UI**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-history.test.ts tests\\unit\\ai-session-page.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\ai-history miniprogram\\pages\\ai-session tests\\unit\\ai-history.test.ts tests\\unit\\ai-session-page.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the history UI change**

```powershell
git add -- miniprogram/app.json miniprogram/pages/ai-history miniprogram/pages/ai-session tests/unit/ai-history.test.ts tests/unit/ai-session-page.test.ts
git diff --cached --check
git commit -m "feat: show AI history by conversation session"
```

### Task 4: Bind active chat/trip UI to sessions and remove ambiguous regeneration

**Files:**
- Modify: `miniprogram/view-models/chat.ts`
- Modify: `miniprogram/pages/ai-chat/index.ts`, `index.wxml`
- Modify: `miniprogram/pages/trip-form/index.ts`, `index.wxml`
- Modify: `tests/unit/chat-ui.test.ts`, `tests/unit/trip-form.test.ts`

**Interfaces:**
- Active screens store one public `sessionId` for their own kind. A new chat/session or trip/replan obtains a new server session before sending; follow-up uses the same ID.

- [ ] **Step 1: Add failing flow tests**

For chat, mock `createAiSession` and verify first send includes its returned chat session ID, next send retains it, and `newChat` obtains a different ID. For trip, verify successful initial generation sets a session ID and removes the normal generate control; adjustment sends that ID; replan creates a new trip ID then submits the unchanged current five-field form exactly once.

- [ ] **Step 2: Run the focused UI tests to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\chat-ui.test.ts tests\\unit\\trip-form.test.ts`

Expected: FAIL because current requests have no session ID, new chat resets a global kind pointer, and the generate button always renders.

- [ ] **Step 3: Implement per-page session lifecycle**

Make `ChatModel` accept/hold a public chat session ID and include it in each request. On page load, accept a valid `sessionId` query only when it belongs to chat; otherwise lazily call `createAiSession('chat')` before first send. Apply the symmetric trip lifecycle: initial plan lazily creates a trip session, adjustment requires it, and replan explicitly creates a fresh session then calls `submit()`.

In `trip-form/index.wxml`, wrap the original generate button in `wx:if="{{!results.length}}"`; rename the post-result restart control to “按当前条件重新生成”. The restart handler must retain form fields, clear only visual prior results, and submit once after the new server session is available.

- [ ] **Step 4: Verify active-session UI behavior**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\chat-ui.test.ts tests\\unit\\trip-form.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js miniprogram\\view-models\\chat.ts miniprogram\\pages\\ai-chat miniprogram\\pages\\trip-form tests\\unit\\chat-ui.test.ts tests\\unit\\trip-form.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit active session and trip UX change**

```powershell
git add -- miniprogram/view-models/chat.ts miniprogram/pages/ai-chat miniprogram/pages/trip-form tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "fix: keep AI conversations and trips in explicit sessions"
```

### Task 5: Record migration, deployment and independent validation

**Files:**
- Modify: `docs/runbooks/dify-chatflow.md`
- Modify: `docs/testing/2026-09-06-trip-chatflow-performance-qa.md`

- [ ] **Step 1: Document exact non-destructive rollout**

Add instructions to create the three new composite indexes before function release, preserve `ADMINONLY`, deploy only the rebuilt `aiService` package while retaining all existing environment variables, and confirm legacy chat/trip cards appear after release. State explicitly that no CloudBase collection or legacy record is deleted.

- [ ] **Step 2: Run the combined verification**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-service.test.ts tests\\unit\\ai-records.test.ts tests\\unit\\ai-history.test.ts tests\\unit\\ai-session-page.test.ts tests\\unit\\chat-ui.test.ts tests\\unit\\trip-form.test.ts tests\\contracts\\database-security.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai miniprogram\\pages\\ai-history miniprogram\\pages\\ai-session miniprogram\\pages\\ai-chat miniprogram\\pages\\trip-form miniprogram\\services\\ai.ts miniprogram\\view-models\\chat.ts shared\\contracts.ts tests\\unit\\ai-service.test.ts tests\\unit\\ai-records.test.ts tests\\unit\\ai-history.test.ts tests\\unit\\ai-session-page.test.ts tests\\unit\\chat-ui.test.ts tests\\unit\\trip-form.test.ts
node scripts\\build.mjs --mode=demo
node scripts\\check-package.mjs
node scripts\\verify-docs.mjs
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Write factual QA evidence and commit**

Record commit IDs, command counts/results, legacy compatibility coverage, and unperformed CloudBase/WeChat/Android/iPhone checks. Do not claim deployed indexes, real Dify continuity, or independent tester approval without actual evidence.

```powershell
git add -- docs/runbooks/dify-chatflow.md docs/testing/2026-09-06-trip-chatflow-performance-qa.md
git diff --cached --check
git commit -m "test: record AI session history QA"
```

- [ ] **Step 4: Obtain explicit cloud-write approval**

Before creating indexes or deploying `aiService`, tell the user that CloudBase will add indexes and upload the rebuilt function code while preserving environment variables, Dify configuration and existing records. Wait for explicit approval, then verify the function status and one chat and one trip session list/detail flow in WeChat developer tools.

## Plan self-review

- Task 1 provides only public session contracts; Task 2 owns data isolation and old-record compatibility; Task 3 owns history navigation; Task 4 owns active conversation and unambiguous trip controls; Task 5 owns controlled rollout and factual QA.
- All session identifiers used across tasks share the same `sessionId` name and public/private boundary.
- The plan contains no Dify key, environment value, destructive migration, or direct client database access.

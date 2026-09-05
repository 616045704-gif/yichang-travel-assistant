# 双 Dify Chatflow 多轮助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过安全云函数将既有 `submitAi(request)` 接入两条独立 Dify Chatflow，并让自由问答和行程定制各自支持原生多轮对话。

**Architecture:** 客户端保持 `AiRequest { requestId, kind, question?, trip? }` 与 `submitAi(request)`；体验构建调用 `aiService` 云函数，开发构建保留 mock。云函数从可信 OPENID 派生 Dify user，按 kind 选用两套环境变量和服务端 `ai_sessions` 会话槽位，先检索本地已发布地点资料，再以 blocking `POST /v1/chat-messages` 调用对应 Chatflow，私有保存 Dify conversation ID。

**Tech Stack:** 原生微信小程序 TypeScript、CloudBase 云函数、Node.js `fetch`、Dify Chatflow Chat Messages API、Vitest、TypeScript、ESLint、esbuild。

## Global Constraints

- 不修改既有 `AiRequest` 字段名、`kind: 'chat' | 'trip'`、自由问答 `question`、行程 `TripInput` 或统一 `submitAi(request)` 入口。
- 允许 `kind: 'trip'` 携带 `question` 作为已有行程会话的后续调整；首次行程仍携带 `trip`。不添加前端 history 字段。
- Dify 只可由云函数调用。`DIFY_CHAT_API_BASE_URL`、`DIFY_CHAT_API_KEY`、`DIFY_TRIP_API_BASE_URL`、`DIFY_TRIP_API_KEY` 只能在云函数环境变量中设置，绝不写入客户端、测试夹具、示例配置、日志或 Git。
- 两条 Dify Chatflow 都必须配置可选文本输入变量 `local_verified_facts`；该字段只由云函数填写，客户端既不发送也不展示其原始值。
- 云函数必须从可信调用上下文获取身份，前端不得传 ownerId、openid、Dify user 或 conversation ID。
- chat/trip conversation ID 必须保存于不同的、当前用户私有的服务端槽位；新对话只能清理对应槽位。
- 每次 live 调用先查询本地 `places`/`place_contents` 的已核验资料；资料不足时明确提示，绝不伪造易变信息。
- 真实 Dify 失败不得回退成 mock 成功；开发构建或未配置云环境时保持 mock 可用。
- 每个逻辑改动有自动化测试与聚焦 Conventional Commit；应用完成后由独立测试角色基于最终功能提交实际验收并在 `docs/testing/` 留档。

---

## File structure and boundaries

| Path | Responsibility |
| --- | --- |
| `cloudfunctions/aiService/index.ts` | 读取可信身份并调用 AI 请求服务，不暴露密钥或 Dify ID。 |
| `cloudfunctions/ai/dify.ts` | 构建两条 Dify blocking 请求、超时与安全响应解析。 |
| `cloudfunctions/ai/repository.ts` | 按 owner/kind 保存、读取、清除 private conversation ID；保存 AI 会话/消息。 |
| `cloudfunctions/ai/service.ts` | 校验 request、检索本地事实、路由 chat/trip、映射统一响应。 |
| `cloudfunctions/ai/retrieval.ts` | 从已发布地点和详情生成有限的本地已核验事实。 |
| `miniprogram/services/ai.ts` | 在 demo/live 模式经 `wx.cloud.callFunction` 调用 aiService；开发 mock 仍可注入。 |
| `miniprogram/pages/ai-chat/*` | 追加多轮消息并提供“新对话”。 |
| `miniprogram/pages/trip-form/*` | 首次表单结果后提供“继续调整行程”输入与“重新规划”。 |
| `shared/contracts.ts` | 保持请求字段不变；将 `AiResult.mode` 扩为 `'mock' | 'dify'`。 |
| `docs/runbooks/dify-chatflow.md` | 非敏感环境变量名称、部署次序、验证和回滚说明。 |

### Task 1: Define the live AI boundary and Dify adapter

**Files:**
- Create: `cloudfunctions/aiService/index.ts`, `cloudfunctions/ai/dify.ts`, `cloudfunctions/ai/service.ts`, `cloudfunctions/ai/repository.ts`, `cloudfunctions/ai/retrieval.ts`, `tests/unit/dify-adapter.test.ts`, `tests/unit/ai-service.test.ts`
- Modify: `shared/contracts.ts`, `database/schema.md`, `database/indexes.json`, `cloudfunctions/README.md`

**Interfaces:**
- Consumes `AiRequest` without renaming its fields.
- Produces cloud action `{ action: 'submit', request: AiRequest } → AiResult` and `{ action: 'resetConversation', kind: AiKind } → { kind: AiKind }`.
- Produces `DifyClient.send(kind, request, conversationId, user, localFacts): Promise<{ answer: string; conversationId: string }>`.

- [ ] **Step 1: Write failing live-boundary tests**

```ts
it('routes chat to its own key and maps question to Dify query', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ answer: '春秋较舒适', conversation_id: 'chat-c1' }), { status: 200 }));
  const client = createDifyClient({ DIFY_CHAT_API_BASE_URL: 'https://chat.example', DIFY_CHAT_API_KEY: 'chat-secret', DIFY_TRIP_API_BASE_URL: 'https://trip.example', DIFY_TRIP_API_KEY: 'trip-secret' }, fetch);
  await expect(client.send('chat', { requestId: 'c1', kind: 'chat', question: '三峡大坝适合几月？' }, null, 'wx-user-a', [])).resolves.toEqual({ answer: '春秋较舒适', conversationId: 'chat-c1' });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ inputs: {}, query: '三峡大坝适合几月？', response_mode: 'blocking', conversation_id: '', user: 'wx-user-a' });
});

it('maps first trip fields to inputs but a trip follow-up sends empty inputs', async () => {
  // Assert preferences becomes “自然风景,美食探索”; then assert a kind trip request with question and existing ID uses inputs: {}.
});

it('stores chat and trip conversations independently and resets only the requested slot', async () => {
  // Submit each kind for the same owner, reset chat, and assert trip’s conversation ID remains.
});

it('rejects missing Dify configuration and never serializes a secret in an error', async () => {
  // Use empty environment, expect AI_UNAVAILABLE, and assert response text excludes the configured secret literal.
});
```

- [ ] **Step 2: Run the focused tests and confirm red state**

Run: `npm run test -- tests/unit/dify-adapter.test.ts tests/unit/ai-service.test.ts`

Expected: FAIL because the live adapter, AI service entry and conversation repository do not exist.

- [ ] **Step 3: Implement server-only routing, local retrieval and private conversation storage**

```ts
type DifyPayload = { inputs: Record<string, string | number>; query: string; response_mode: 'blocking'; conversation_id: string; user: string };

function toPayload(kind: AiKind, request: AiRequest, conversationId: string | null, user: string): DifyPayload {
  if (kind === 'chat') return { inputs: {}, query: request.question!, response_mode: 'blocking', conversation_id: conversationId ?? '', user };
  if (request.trip) return { inputs: { destination: request.trip.destination, people: request.trip.people, totalBudgetCny: request.trip.totalBudgetCny, days: request.trip.days, preferences: request.trip.preferences.join(',') }, query: '请根据以上旅行信息生成一份完整的定制行程。', response_mode: 'blocking', conversation_id: '', user };
  return { inputs: {}, query: request.question!, response_mode: 'blocking', conversation_id: conversationId!, user };
}
```

Use `fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat-messages`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(90_000) })` only in `cloudfunctions/ai/dify.ts`. Validate a successful JSON response has non-empty `answer` and `conversation_id`; map timeout, non-2xx and invalid responses to safe `AI_TIMEOUT`/`AI_UNAVAILABLE` errors without logging headers, body secrets, user IDs, or conversation IDs.

Store one deterministic `ai_sessions` document per `(ownerId, kind)` with `difyConversationId`; every read and write filters trusted owner ID and kind. `resetConversation` clears only that document’s Dify ID. Before `send`, query only published `places` and matching `place_contents`, form capped plain-text local facts, and always include them as server-owned `inputs.local_verified_facts`. The two Dify Chatflows are configured with this optional text variable. Return the same verified facts separately in `AiResult.localFacts`; never fabricate a Dify citation.

- [ ] **Step 4: Run server tests and package checks**

Run: `npm run test -- tests/unit/dify-adapter.test.ts tests/unit/ai-service.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS; `dist/cloudfunctions/aiService/` is an independent deployable package.

- [ ] **Step 5: Commit the secure live service boundary**

```bash
git add shared/contracts.ts database/schema.md database/indexes.json cloudfunctions/README.md cloudfunctions/aiService cloudfunctions/ai tests/unit/dify-adapter.test.ts tests/unit/ai-service.test.ts
git diff --cached --check
git commit -m "feat: add secure multi-turn Dify AI service"
```

### Task 2: Connect the unified client service without changing callers

**Files:**
- Modify: `miniprogram/services/ai.ts`, `tests/unit/ai-service.test.ts`, `tests/unit/build.test.ts`

**Interfaces:**
- Consumes `submitAi(request)` callers unchanged.
- Produces `resetAiConversation(kind: AiKind): Promise<void>` for page controls.

- [ ] **Step 1: Write failing client-mode tests**

```ts
it('sends the unchanged request to aiService only outside development mock mode', async () => {
  vi.stubGlobal('__BUILD_MODE__', 'demo');
  const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: { requestId: 'c1', status: 'succeeded', answer: '真实回答', mode: 'dify', error: null, localFacts: [], references: [] } }));
  vi.stubGlobal('wx', { cloud: { callFunction } });
  const { submitAi } = await import('../../miniprogram/services/ai');
  await submitAi({ requestId: 'c1', kind: 'chat', question: '兴山有什么好吃的？' });
  expect(callFunction).toHaveBeenCalledWith({ name: 'aiService', data: { action: 'submit', request: { requestId: 'c1', kind: 'chat', question: '兴山有什么好吃的？' } } });
});

it('keeps development mock and sends reset only for its selected kind', async () => {
  // Assert development result mode mock; then assert reset call contains { action: 'resetConversation', kind: 'trip' }.
});
```

- [ ] **Step 2: Run focused tests and confirm red state**

Run: `npm run test -- tests/unit/ai-service.test.ts tests/unit/build.test.ts`

Expected: FAIL because live cloud dispatch and reset function do not exist.

- [ ] **Step 3: Add a safe cloud adapter while retaining the mock adapter**

```ts
async function callAi<T>(action: 'submit' | 'resetConversation', payload: Record<string, unknown>): Promise<T> {
  if (!wx.cloud?.callFunction) throw new Error('AI_UNAVAILABLE');
  const response = await wx.cloud.callFunction({ name: 'aiService', data: { action, ...payload } }) as CloudEnvelope<T>;
  if (response.result?.code !== 'OK' || response.result.data == null) throw new Error(response.result?.message || 'AI_UNAVAILABLE');
  return response.result.data;
}

export function submitAi(request: AiRequest): Promise<AiResult> {
  return isDevelopmentMock() ? submitMock(request) : callAi('submit', { request });
}

export async function resetAiConversation(kind: AiKind): Promise<void> {
  if (isDevelopmentMock()) { clearMockConversation(kind); return; }
  await callAi('resetConversation', { kind });
}
```

Do not import server code, `fetch`, a Dify URL or any secret in `miniprogram/**`. Retain listMockAiRecords for development-only history and ensure a cloud failure stays an error rather than switching to mock.

- [ ] **Step 4: Run focused and general checks**

Run: `npm run test -- tests/unit/ai-service.test.ts tests/unit/build.test.ts`

Expected: PASS.

Run: `npm run test`

Expected: PASS.

Run: `npm run typecheck && npm run lint && npm run build && npm run build:demo && npm run check:package`

Expected: all commands PASS.

- [ ] **Step 5: Commit unified client dispatch**

```bash
git add miniprogram/services/ai.ts tests/unit/ai-service.test.ts tests/unit/build.test.ts
git diff --cached --check
git commit -m "feat: route unified AI client through cloud service"
```

### Task 3: Add multi-turn controls to both independent pages

**Files:**
- Modify: `miniprogram/pages/ai-chat/index.ts`, `miniprogram/pages/ai-chat/index.wxml`, `miniprogram/pages/ai-chat/index.wxss`, `miniprogram/pages/trip-form/index.ts`, `miniprogram/pages/trip-form/index.wxml`, `miniprogram/pages/trip-form/index.wxss`, `tests/unit/chat-ui.test.ts`, `tests/unit/trip-form.test.ts`

**Interfaces:**
- Consumes unchanged `submitAi(request)` and new `resetAiConversation(kind)`.
- Produces `newChat()` and `restartTrip()` controls; trip follow-ups create `{ requestId, kind: 'trip', question }` without a `trip` payload.

- [ ] **Step 1: Write failing multi-turn page tests**

```ts
it('clears only the chat UI and chat conversation when New Chat is selected', async () => {
  // Populate captured chat page messages, call newChat, and assert resetAiConversation receives 'chat' while messages/input/result are cleared.
});

it('sends a trip adjustment without rebuilding the form payload', async () => {
  // After a successful first trip, enter “第二天太累了”, submit adjustment, and assert submitAi receives { kind: 'trip', question: '第二天太累了' } without trip.
});

it('restarts only the trip conversation and retains the editable form fields', async () => {
  // Assert reset uses 'trip' and existing form values remain available for a fresh plan.
});
```

- [ ] **Step 2: Run page tests and confirm red state**

Run: `npm run test -- tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts`

Expected: FAIL because page reset and trip-adjustment methods do not exist.

- [ ] **Step 3: Implement page controls without exposing Dify IDs**

```ts
async newChat() {
  await resetAiConversation('chat');
  model.state = { input: '', request: null, result: null, isSubmitting: false, isVisible: true };
  this.setData({ input: '', messages: [], error: '', result: null, isSubmitting: false });
}

async submitAdjustment() {
  const question = this.data.adjustment.trim();
  if (!question || this.data.isSubmitting) return;
  await this.send({ requestId: `trip-${Date.now()}-${++tripSequence}`, kind: 'trip', question });
}

async restartTrip() {
  await resetAiConversation('trip');
  this.setData({ adjustment: '', adjustmentError: '', result: null, lastRequest: null });
}
```

Render “新对话” on the chat page. After a successful trip result, render an input labeled “对行程还有什么想调整的？” and a send button; render “重新规划” separately. Both pages retain the disclaimer, plain-text `message-bubble`, loading/error/retry states and never render conversation IDs. Append successful follow-up results to visible messages rather than overwriting prior result text.

- [ ] **Step 4: Run UI and full checks**

Run: `npm run test -- tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts`

Expected: PASS.

Run: `npm run test && npm run typecheck && npm run lint && npm run build && npm run build:demo && npm run check:package`

Expected: all commands PASS.

- [ ] **Step 5: Commit page-level multi-turn controls**

```bash
git add miniprogram/pages/ai-chat miniprogram/pages/trip-form tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "feat: add multi-turn controls for chat and trip assistants"
```

### Task 4: Document environment setup and independently verify the feature

**Files:**
- Create: `docs/runbooks/dify-chatflow.md`, `docs/testing/2026-09-05-dify-multiturn-assistants-qa.md`

**Interfaces:**
- Consumes the final Task 1–3 commits.
- Produces a non-sensitive deployment checklist and independent test record; it does not store values for any environment variable.

- [ ] **Step 1: Write the runbook with only names and procedures**

Document the four server environment variable names, CloudBase configuration location, `/v1/chat-messages` endpoint suffix, required Dify Chatflow input names (`local_verified_facts` for both apps plus the five first-trip fields), deploy order, how to verify two separate conversation IDs without printing either value, and rollback by unsetting live configuration or deploying the prior cloud function version. Do not include example secret values, full authorization headers or user identifiers.

- [ ] **Step 2: Run developer verification**

Run: `npm run test`

Expected: PASS.

Run: `npm run typecheck && npm run lint && npm run build && npm run build:demo && npm run check:package && npm run verify:docs && git diff --check`

Expected: all commands PASS.

- [ ] **Step 3: Have an independent tester verify the final commit**

The tester independently runs the commands above, inspects source/package boundaries, tests mock behavior, two chat turns, two trip turns, isolated resets and missing-config error branches. The tester records actual results and explicitly lists unexecuted Dify development-cloud calls, real API credentials, Android/iPhone, true network timeout and cross-user cloud verification as blocked until the user configures a development environment.

- [ ] **Step 4: Commit the runbook and QA evidence separately**

```bash
git add docs/runbooks/dify-chatflow.md
git diff --cached --check
git commit -m "docs: add Dify Chatflow configuration runbook"

git add docs/testing/2026-09-05-dify-multiturn-assistants-qa.md
git diff --cached --check
git commit -m "test: record multi-turn Dify assistant acceptance"
```

## Plan self-review

- Spec coverage: Task 1 provides private two-app routing, local-first facts and server conversation storage; Task 2 preserves the unified client; Task 3 adds both page-level multi-turn controls; Task 4 covers secret-safe configuration and independent verification.
- Completeness scan: every task has concrete tests, red/green commands, implementation boundaries and focused commits.
- Type consistency: `AiRequest`, `AiResult`, `AiKind`, `submitAi`, `resetAiConversation`, `chatConversationId` and `tripConversationId` retain one definition and no page sends a Dify-specific field.

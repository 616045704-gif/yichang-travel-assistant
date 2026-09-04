# 模拟 AI 助手界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可从首页和“我的”进入的模拟 AI 自由聊天、行程定制、会话内回答记录与失败重试体验。

**Architecture:** 页面依赖 `miniprogram/services/ai.ts` 定义的 AI 客户端接口，聊天状态放在独立 `view-models/chat.ts`，并通过运行时注入的测试夹具模拟回答。页面不包含 Dify 地址、密钥或真实网络请求；模拟记录只存在运行会话内，并与现有云端个人记录隔离。

**Tech Stack:** 原生微信小程序 TypeScript、WXML、WXSS、Vitest、ESLint、esbuild。

## Global Constraints

- 此阶段不接入 Dify，不调用真实 AI 服务，不提交任何凭据。
- 每个成功结果必须显示“模拟回答，仅用于交互测试”。
- 所有 AI 页面必须显示“内容仅供出行参考，请以景区、交通等官方公告为准”。
- 问题仅允许 1–1000 个字符；答案仅作为文本渲染，不使用 `rich-text` 或 HTML。
- 行程字段为目的地、人数、全团总预算、天数、偏好；人数 1–20，天数 1–7，总预算 1–100000 元，偏好最多 6 项；明确“总预算，不含往返宜昌大交通”。
- 失败必须保留输入和明确的重试入口，不能渲染成成功或空状态。
- 回答记录仅是当前模拟会话，页面必须标明“模拟记录，未持久化”；不得改写云端收藏、浏览或偏好记录。
- mock 实现不放进 `miniprogram/**mock**`，且体验构建不得包含它。
- 每项代码变更都有自动化测试、聚焦 Conventional Commit、定向测试、`typecheck`、`lint`、`build`、`check:package` 与差异检查；实施完成后独立测试角色基于提交版本重新验收并记录。

---

## File structure and boundaries

| Path | Responsibility |
| --- | --- |
| `shared/contracts.ts` | `TripInput`、聊天任务、结果和模拟记录的唯一类型来源。 |
| `miniprogram/services/ai.ts` | 页面唯一 AI 接口、运行时适配器注入和会话内记录仓库。 |
| `miniprogram/view-models/chat.ts` | 输入校验、提交互斥、错误映射、重试与离开/恢复状态。 |
| `tests/fixtures/mock-ai.ts` | 仅供测试注入的成功、失败、等待模拟器，不进入小程序包。 |
| `miniprogram/components/message-bubble/*` | 纯文本消息与显著模拟标记。 |
| `miniprogram/components/source-card/*` | 本地事实/引用的只读文本分组；无资料时隐藏。 |
| `miniprogram/pages/ai-chat/*` | 自由聊天入口、状态呈现和行程跳转。 |
| `miniprogram/pages/trip-form/*` | 五字段校验、结果和重试。 |
| `miniprogram/pages/ai-history/*` | 会话内聊天/行程结果回看及未持久化提示。 |
| `miniprogram/pages/home/*`, `miniprogram/pages/me/*`, `miniprogram/app.json` | 注册页面并提供可达入口。 |

### Task 1: Define mock-AI contracts and state boundary

**Files:**
- Modify: `shared/contracts.ts`
- Create: `miniprogram/services/ai.ts`, `miniprogram/view-models/chat.ts`, `tests/fixtures/mock-ai.ts`, `tests/unit/chat-ui.test.ts`, `tests/unit/trip-form.test.ts`

**Interfaces:**
- Produces `TripInput { destination: string; people: number; totalBudgetCny: number; days: number; preferences: string[] }`.
- Produces `AiRequest { requestId: string; kind: 'chat' | 'trip'; question?: string; trip?: TripInput }` and `AiResult { requestId: string; status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out'; answer: string | null; mode: 'mock'; error: string | null; localFacts: string[]; references: Source[] }`.
- Produces `AiClient.submit(request): Promise<AiResult>` and `ChatModel.submit(input)`, `retry()`, `onHide()`, `onShow()`.

- [ ] **Step 1: Write failing contract and model tests**

```ts
it('rejects blank and 1001-character questions before invoking the client', async () => {
  const client = { submit: vi.fn() };
  const model = new ChatModel(client);
  await expect(model.submit('  ')).rejects.toThrow('请输入 1–1000 字的问题');
  await expect(model.submit('a'.repeat(1001))).rejects.toThrow('请输入 1–1000 字的问题');
  expect(client.submit).not.toHaveBeenCalled();
});

it('keeps a failed question and retries the same request payload', async () => {
  const client = createMockAiClient([{ status: 'failed', error: '网络连接不稳定，请重试' }, { status: 'succeeded', answer: '模拟建议' }]);
  const model = new ChatModel(client);
  await model.submit('三峡大坝适合几月去？');
  await model.retry();
  expect(client.submit).toHaveBeenCalledTimes(2);
  expect(client.submit.mock.calls[1][0].question).toBe('三峡大坝适合几月去？');
});

it('accepts only a valid five-field trip input', () => {
  expect(validateTrip({ destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['山水'] })).toEqual([]);
  expect(validateTrip({ destination: '', people: 21, totalBudgetCny: 0, days: 8, preferences: Array(7).fill('慢游') })).toEqual(expect.arrayContaining(['请选择目的地', '人数需为 1–20 的整数', '总预算需为 1–100000 元', '天数需为 1–7 的整数', '偏好最多选择 6 项']));
});
```

- [ ] **Step 2: Run the new tests and confirm red state**

Run: `npm run test -- tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts`

Expected: FAIL because `ChatModel`, `validateTrip` and the mock client fixture do not exist.

- [ ] **Step 3: Add the exact shared types, validation and injectable service**

```ts
export type AiKind = 'chat' | 'trip';
export type AiStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out';
export interface TripInput { destination: string; people: number; totalBudgetCny: number; days: number; preferences: string[]; }
export interface AiRequest { requestId: string; kind: AiKind; question?: string; trip?: TripInput; }
export interface AiResult { requestId: string; status: AiStatus; answer: string | null; mode: 'mock'; error: string | null; localFacts: string[]; references: Source[]; }
```

```ts
export interface AiClient { submit(request: AiRequest): Promise<AiResult>; }
let client: AiClient | null = null;
const records: AiResult[] = [];
export function configureAiClient(next: AiClient | null) { client = next; }
export async function submitAi(request: AiRequest) {
  if (!client) throw new Error('模拟服务暂不可用，请稍后重试');
  const result = await client.submit(request);
  records.push(result);
  return result;
}
export function listMockAiRecords() { return [...records]; }
```

Implement `ChatModel` with `state = { input: '', request: null, result: null, isSubmitting: false, isVisible: true }`; reject invalid input; set `isSubmitting` while awaiting; preserve the last `AiRequest` on failure; call `submitAi` in `retry`; stop visual waiting on `onHide` and restore it from the saved request on `onShow`. Keep the test fixture in `tests/fixtures/mock-ai.ts` and import it only from tests.

- [ ] **Step 4: Run focused tests and static checks**

Run: `npm run test -- tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with no TypeScript diagnostics.

- [ ] **Step 5: Commit the core interaction boundary**

```bash
git add shared/contracts.ts miniprogram/services/ai.ts miniprogram/view-models/chat.ts tests/fixtures/mock-ai.ts tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "feat: add mock AI interaction state"
```

### Task 2: Build chat, itinerary and mock-history pages

**Files:**
- Create: `miniprogram/components/message-bubble/index.ts`, `miniprogram/components/message-bubble/index.json`, `miniprogram/components/message-bubble/index.wxml`, `miniprogram/components/message-bubble/index.wxss`, `miniprogram/components/source-card/index.ts`, `miniprogram/components/source-card/index.json`, `miniprogram/components/source-card/index.wxml`, `miniprogram/components/source-card/index.wxss`, `miniprogram/pages/ai-chat/index.ts`, `miniprogram/pages/ai-chat/index.json`, `miniprogram/pages/ai-chat/index.wxml`, `miniprogram/pages/ai-chat/index.wxss`, `miniprogram/pages/trip-form/index.ts`, `miniprogram/pages/trip-form/index.json`, `miniprogram/pages/trip-form/index.wxml`, `miniprogram/pages/trip-form/index.wxss`, `miniprogram/pages/ai-history/index.ts`, `miniprogram/pages/ai-history/index.json`, `miniprogram/pages/ai-history/index.wxml`, `miniprogram/pages/ai-history/index.wxss`
- Modify: `miniprogram/app.json`
- Test: `tests/unit/chat-ui.test.ts`, `tests/unit/trip-form.test.ts`, `tests/unit/navigation.test.ts`

**Interfaces:**
- Consumes `ChatModel`, `validateTrip`, `submitAi` and `listMockAiRecords` from Task 1.
- Produces three registered, navigable page routes: `/pages/ai-chat/index`, `/pages/trip-form/index`, `/pages/ai-history/index`.

- [ ] **Step 1: Extend the failing page tests**

```ts
it('registers all AI routes and renders the mandatory warning and mock label', async () => {
  const app = JSON.parse(await readFile('miniprogram/app.json', 'utf8'));
  expect(app.pages).toEqual(expect.arrayContaining(['pages/ai-chat/index', 'pages/trip-form/index', 'pages/ai-history/index']));
  const chat = await readFile('miniprogram/pages/ai-chat/index.wxml', 'utf8');
  expect(chat).toContain('内容仅供出行参考，请以景区、交通等官方公告为准');
  expect(chat).toContain('模拟回答，仅用于交互测试');
  expect(chat).not.toContain('rich-text');
});

it('keeps itinerary input after a network failure and exposes retry', async () => {
  // Mount the captured trip page with an injected failed client, submit valid form data,
  // then assert destination, people, totalBudgetCny, days, preferences and retry action remain in page data.
});
```

- [ ] **Step 2: Run page tests and confirm red state**

Run: `npm run test -- tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts tests/unit/navigation.test.ts`

Expected: FAIL because the page/component files and routes do not yet exist.

- [ ] **Step 3: Implement pages and components with plain-text-only rendering**

```xml
<!-- message-bubble/index.wxml -->
<view class="bubble bubble-{{role}}"><text class="bubble-text">{{content}}</text><text wx:if="{{mode === 'mock'}}" class="mock-label">模拟回答，仅用于交互测试</text></view>
```

```xml
<!-- ai-chat/index.wxml -->
<view class="page ai-page"><text class="disclaimer">内容仅供出行参考，请以景区、交通等官方公告为准</text><message-bubble wx:for="{{messages}}" wx:key="requestId" role="{{item.role}}" content="{{item.content}}" mode="{{item.mode}}" /><view wx:if="{{error}}" class="error-panel"><text>{{error}}</text><button bindtap="retry">重试</button></view><textarea value="{{input}}" bindinput="onInput" maxlength="1000" /><button bindtap="submit" disabled="{{isSubmitting}}">发送</button><button bindtap="openTripForm">我要定制行程</button></view>
```

Implement the trip page with five explicitly bound fields, a multi-select preference control capped at six selections, inline validation errors, result text, mock label and retry. Implement history by calling `listMockAiRecords()` on `onShow`; show “模拟记录，未持久化” above records and a truthful empty state when none exist. Use `setData` to synchronize models; call `model.onHide()` and `model.onShow()` from lifecycle methods. Register custom components using relative paths in each page JSON.

- [ ] **Step 4: Run focused checks**

Run: `npm run test -- tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts tests/unit/navigation.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with no diagnostics.

- [ ] **Step 5: Commit the AI page flow**

```bash
git add miniprogram/app.json miniprogram/components/message-bubble miniprogram/components/source-card miniprogram/pages/ai-chat miniprogram/pages/trip-form miniprogram/pages/ai-history tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts tests/unit/navigation.test.ts
git diff --cached --check
git commit -m "feat: add mock AI chat trip and history pages"
```

### Task 3: Connect entry points and preserve personal-record isolation

**Files:**
- Modify: `miniprogram/pages/home/index.ts`, `miniprogram/pages/home/index.wxml`, `miniprogram/pages/home/index.wxss`, `miniprogram/pages/me/index.ts`, `miniprogram/pages/me/index.wxml`, `miniprogram/pages/me/index.wxss`, `tests/unit/navigation.test.ts`, `tests/unit/profile-pages.test.ts`

**Interfaces:**
- Consumes routes from Task 2.
- Produces `openAiChat()` on the home page and `/pages/ai-history/index` in the “我的” entries list.

- [ ] **Step 1: Write failing entry and isolation tests**

```ts
it('opens the registered AI chat route from home', async () => {
  let page: { openAiChat(): void };
  vi.stubGlobal('Page', (value: typeof page) => { page = value; });
  const navigateTo = vi.fn(); vi.stubGlobal('wx', { navigateTo });
  await import('../../miniprogram/pages/home/index');
  page!.openAiChat();
  expect(navigateTo).toHaveBeenCalledWith({ url: '/pages/ai-chat/index' });
});

it('links AI history from my page without calling userService', async () => {
  const me = await readFile('miniprogram/pages/me/index.ts', 'utf8');
  expect(me).toContain('/pages/ai-history/index');
  expect(me).not.toContain('listRecords(\'trips\'');
});
```

- [ ] **Step 2: Run entry tests and confirm red state**

Run: `npm run test -- tests/unit/navigation.test.ts tests/unit/profile-pages.test.ts`

Expected: FAIL because the AI home action and history menu entry do not exist.

- [ ] **Step 3: Implement only the two navigation additions**

```ts
// home/index.ts
openAiChat() { wx.navigateTo({ url: '/pages/ai-chat/index' }); }

// me/index.ts entry
{ title: 'AI 问答记录', description: '回看本次模拟的问答与行程', symbol: '✦', url: '/pages/ai-history/index' }
```

Replace the homepage “AI 问答准备中” badge with a tappable action bound to `openAiChat`. Update the “我的” explanatory copy to distinguish existing personal records from “模拟记录，未持久化”; do not modify `miniprogram/services/user.ts` or `records` page behavior.

- [ ] **Step 4: Run focused tests**

Run: `npm run test -- tests/unit/navigation.test.ts tests/unit/profile-pages.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the reachable entry points**

```bash
git add miniprogram/pages/home miniprogram/pages/me tests/unit/navigation.test.ts tests/unit/profile-pages.test.ts
git diff --cached --check
git commit -m "feat: link mock AI assistant entry points"
```

### Task 4: Developer verification and independent test handoff

**Files:**
- Create: `docs/testing/2026-09-04-mock-ai-assistant-qa.md`
- Modify: no application source unless a discovered defect requires its own `fix:` commit and targeted regression test.

**Interfaces:**
- Consumes the three feature commits from Tasks 1–3.
- Produces an independent verification record containing the tested commit, commands, actual outcomes, defects, scope and untested items.

- [ ] **Step 1: Run developer verification against the final feature commit**

Run: `npm run test -- tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts tests/unit/navigation.test.ts tests/unit/profile-pages.test.ts`

Expected: PASS.

Run: `npm run test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `npm run check:package`

Expected: PASS; the client bundle contains no Dify address/key, no `wx.request` AI call and no injected test fixture.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 2: Hand the actual commit to an independent test role**

Provide the commit hash, feature scope and the commands above. The tester independently runs the commands, inspects registered routes and template copy, tests mock success/failure/retry and invalid itinerary boundaries, and records actual results. It must explicitly state that cloud persistence, Dify, Android/iPhone device validation and genuine network behavior are not part of this mock-stage release.

- [ ] **Step 3: Address any blocking defect in a separate red-green cycle**

For each defect, first add a test reproducing it, run it red, make the smallest targeted fix, run the targeted test and all Task 4 checks green, then create a separate `fix:` commit. Give the new commit to the independent tester for revalidation.

- [ ] **Step 4: Commit the independent QA record only after actual verification**

```bash
git add docs/testing/2026-09-04-mock-ai-assistant-qa.md
git diff --cached --check
git commit -m "test: record mock AI assistant acceptance"
```

## Plan self-review

- Spec coverage: Tasks 1–3 cover all approved entry points, chat, itinerary fields, labels, disclaimer, errors, retries, session-only history, packaging boundary and lifecycle behavior. Task 4 covers developer checks and independent QA.
- Completeness scan: no deferred implementation markers remain; the only conditional path is a real defect, whose required red-green fix sequence is explicitly specified.
- Type consistency: `TripInput`, `AiRequest`, `AiResult`, `AiClient`, `ChatModel`, `submitAi`, `listMockAiRecords` and the three page routes are defined once and referenced with the same names in later tasks.

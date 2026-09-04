# AI 助手首页双入口布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页 AI 区展示并列的自由问答与行程定制入口，分别直达现有独立页面。

**Architecture:** 仅修改首页 WXML/WXSS/页面方法和聊天页 WXML/WXSS，并更新导航与视觉契约测试。两个新入口只调用 `wx.navigateTo`，复用已注册的 `/pages/ai-chat/index` 与 `/pages/trip-form/index`，不改变 AI 服务或请求对象。

**Tech Stack:** 原生微信小程序 TypeScript、WXML、WXSS、Vitest、TypeScript、ESLint、esbuild。

## Global Constraints

- 此任务只调整前端界面和页面布局；不得修改云函数、Dify 预留接口、`AiRequest`、`AiResult`、`kind`、`question`、`trip`、模拟回答或调用参数。
- 首页必须提供并列的“自由问答”和“行程定制”入口，分别直达现有聊天与行程页面。
- 聊天页面不得再展示“我要定制行程”跨页入口。
- 保留现有免责声明、国风视觉令牌、模拟标识、“我的 → AI 问答记录”及所有既有页面路由。
- 每项源码改动必须有自动化测试；提交前运行定向测试、全量测试、类型检查、静态检查、开发/体验构建、包检查与差异检查。

---

## File structure and boundaries

| Path | Responsibility |
| --- | --- |
| `miniprogram/pages/home/index.ts` | 添加直达既有行程页的导航方法；现有聊天导航方法不变。 |
| `miniprogram/pages/home/index.wxml` | 将单一 AI 操作替换为语义清晰的并列双卡入口。 |
| `miniprogram/pages/home/index.wxss` | 在原 AI 卷轴区内定义等宽双卡及窄屏安全的布局。 |
| `miniprogram/pages/ai-chat/index.wxml` | 移除行程跨页按钮和仅为它服务的容器。 |
| `miniprogram/pages/ai-chat/index.wxss` | 移除不再使用的 `.trip-link` 规则并保留字符计数布局。 |
| `tests/unit/navigation.test.ts` | 验证首页两个方法导航至各自已注册路由。 |
| `tests/unit/visual-style.test.ts` | 验证双卡标记、双卡布局和聊天页入口移除。 |

### Task 1: Implement the two direct homepage entries

**Files:**
- Modify: `miniprogram/pages/home/index.ts`, `miniprogram/pages/home/index.wxml`, `miniprogram/pages/home/index.wxss`, `miniprogram/pages/ai-chat/index.wxml`, `miniprogram/pages/ai-chat/index.wxss`
- Test: `tests/unit/navigation.test.ts`, `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes existing registered routes `/pages/ai-chat/index` and `/pages/trip-form/index`.
- Produces `openAiChat(): void` and `openTripForm(): void` on the home page; neither function calls `submitAi`, `userService`, cloud functions or network APIs.

- [ ] **Step 1: Add failing navigation and layout tests**

```ts
it('opens each homepage AI card on its own existing route', async () => {
  let page: { openAiChat(): void; openTripForm(): void };
  vi.stubGlobal('Page', (value: typeof page) => { page = value; });
  const navigateTo = vi.fn();
  vi.stubGlobal('wx', { navigateTo });
  await import('../../miniprogram/pages/home/index');
  page!.openAiChat();
  page!.openTripForm();
  expect(navigateTo).toHaveBeenNthCalledWith(1, { url: '/pages/ai-chat/index' });
  expect(navigateTo).toHaveBeenNthCalledWith(2, { url: '/pages/trip-form/index' });
});

it('uses two homepage AI cards and removes the chat-to-trip shortcut', async () => {
  const home = await readFile('miniprogram/pages/home/index.wxml', 'utf8');
  const homeStyle = await readFile('miniprogram/pages/home/index.wxss', 'utf8');
  const chat = await readFile('miniprogram/pages/ai-chat/index.wxml', 'utf8');
  expect(home).toContain('自由问答');
  expect(home).toContain('行程定制');
  expect(home).toContain('bindtap="openAiChat"');
  expect(home).toContain('bindtap="openTripForm"');
  expect(homeStyle).toContain('.ai-entry-grid');
  expect(homeStyle).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  expect(chat).not.toContain('我要定制行程');
  expect(chat).not.toContain('bindtap="openTripForm"');
});
```

- [ ] **Step 2: Run the focused tests and confirm red state**

Run: `npm run test -- tests/unit/navigation.test.ts tests/unit/visual-style.test.ts`

Expected: FAIL because `openTripForm`, `.ai-entry-grid`, double-card text and chat-entry removal do not yet exist.

- [ ] **Step 3: Add the minimal direct navigation and layout implementation**

```ts
// miniprogram/pages/home/index.ts
openAiChat() { wx.navigateTo({ url: '/pages/ai-chat/index' }); },
openTripForm() { wx.navigateTo({ url: '/pages/trip-form/index' }); },
```

```xml
<!-- within miniprogram/pages/home/index.wxml .ai-copy -->
<view class="ai-entry-grid">
  <button class="ai-action ai-action-chat" bindtap="openAiChat"><text class="ai-action-kicker">随心问问</text><text class="ai-action-title">自由问答</text><text class="ai-action-note">景点、文化与出行建议</text><text class="ai-action-arrow" aria-hidden="true">›</text></button>
  <button class="ai-action ai-action-trip" bindtap="openTripForm"><text class="ai-action-kicker">从容成行</text><text class="ai-action-title">行程定制</text><text class="ai-action-note">填写偏好，生成模拟建议</text><text class="ai-action-arrow" aria-hidden="true">›</text></button>
</view>
```

```css
/* miniprogram/pages/home/index.wxss */
.ai-entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16rpx; margin-top: 20rpx; }
.ai-action { position: relative; display: flex; flex-direction: column; align-items: flex-start; min-width: 0; min-height: 164rpx; padding: 20rpx; border: 1rpx solid #c4ad7d; border-radius: 20rpx; text-align: left; }
.ai-action-chat { background: rgba(251, 246, 233, .9); color: #66522c; }
.ai-action-trip { background: rgba(231, 217, 185, .92); color: #5d4730; }
.ai-action-kicker { font-size: 19rpx; letter-spacing: 3rpx; opacity: .75; }.ai-action-title { margin-top: 6rpx; font-family: var(--font-display); font-size: 29rpx; }.ai-action-note { margin-top: 8rpx; font-size: 20rpx; line-height: 1.5; }.ai-action-arrow { position: absolute; right: 18rpx; bottom: 14rpx; font-size: 34rpx; }
```

Remove the old one-button `.ai-action` styling, remove the `openTripForm` method and its button from `miniprogram/pages/ai-chat/index.ts`/`.wxml`, and remove the unused `.trip-link` CSS rule. Do not modify imports, `ChatModel`, `submitAi`, request construction, page routes or service files.

- [ ] **Step 4: Run focused tests and full verification**

Run: `npm run test -- tests/unit/navigation.test.ts tests/unit/visual-style.test.ts`

Expected: PASS.

Run: `npm run test`

Expected: PASS; existing AI service and form tests remain unchanged.

Run: `npm run typecheck`

Expected: PASS with no diagnostics.

Run: `npm run lint`

Expected: PASS with no lint diagnostics.

Run: `npm run build`

Expected: PASS.

Run: `npm run build:demo`

Expected: PASS; no development simulator is included.

Run: `npm run check:package`

Expected: PASS; no client boundary violation.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Commit the focused front-end layout change**

```bash
git add miniprogram/pages/home/index.ts miniprogram/pages/home/index.wxml miniprogram/pages/home/index.wxss miniprogram/pages/ai-chat/index.ts miniprogram/pages/ai-chat/index.wxml miniprogram/pages/ai-chat/index.wxss tests/unit/navigation.test.ts tests/unit/visual-style.test.ts
git diff --cached --check
git commit -m "feat: split AI homepage entry points"
```

## Plan self-review

- Spec coverage: the only task delivers both homepage cards, direct existing routes, chat shortcut removal, retained visual direction and tests proving no service or request boundary participates.
- Completeness scan: the task includes its test, red-state command, exact implementation, green-state commands and focused commit.
- Type consistency: both method names and route strings are defined in the task and match existing route names; no new request type or field is introduced.

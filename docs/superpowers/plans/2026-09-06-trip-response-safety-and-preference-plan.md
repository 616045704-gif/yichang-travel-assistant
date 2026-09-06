# 行程回答净化与偏好选择修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 只向用户显示 Dify 的最终回答，并使两个旅行偏好界面的选中状态稳定可见。

**Architecture:** 在云函数的 Dify 适配器成功响应边界剥离 `<think>` 推理区块，之后才允许回答进入服务、数据库和小程序。两个偏好页面预先生成 `{ value, selected }` 展示数据，WXML 只读取该布尔值；点击逻辑仍以字符串数组为真实输入。

**Tech Stack:** TypeScript、Native WeChat Mini Program WXML、CloudBase 云函数、Vitest、ESLint、esbuild。

## Global Constraints

- 不修改 Dify 的模型、提示词、工作流、环境变量或密钥。
- 小程序只调用 `aiService`；Dify API Key 不得出现在客户端、测试输出或 Git。
- 推理文本不得返回客户端、存入记录或在历史页显示。
- 偏好上限保持 6 项，行程表单和“我的 → 旅行偏好”均使用相同六个选项。
- 每项逻辑改动先红后绿测试、独立 Conventional Commit；不得暂存已有无关未跟踪文件。

---

## 文件职责

| 路径 | 责任 |
| --- | --- |
| `cloudfunctions/ai/dify.ts` | 将上游 Dify 回答净化为仅用户可见的最终正文。 |
| `tests/unit/dify-adapter.test.ts` | 锁定推理区块不会穿过云函数边界。 |
| `miniprogram/pages/trip-form/index.ts` 与 `.wxml` | 维护并渲染行程表单偏好的输入值和展示状态。 |
| `miniprogram/pages/preferences/index.ts` 与 `.wxml` | 维护并渲染个人偏好页的输入值和展示状态。 |
| `tests/unit/trip-form.test.ts` | 验证行程偏好可选中和取消。 |
| `tests/unit/preferences-page.test.ts` | 验证个人偏好页可选中、取消并保持六项限制。 |

### Task 1: 在云函数边界过滤推理文本

**Files:**

- Modify: `cloudfunctions/ai/dify.ts:48-55`
- Modify: `tests/unit/dify-adapter.test.ts:13-21`

**Interfaces:**

- Consumes: Dify 成功响应的 `answer: string`。
- Produces: `DifyClient.send()` 仍返回 `{ answer: string; conversationId: string }`，其中 `answer` 只含最终正文。

- [ ] **Step 1: 写出失败测试**

在 `tests/unit/dify-adapter.test.ts` 的首个成功路由测试后加入：

```ts
it('strips Dify reasoning blocks before an answer can leave the cloud function', async () => {
  const fetch = vi.fn<RequestCall>(async () => new Response(JSON.stringify({
    answer: '<think><!--dify-deepseek-reasoning-->内部推理</think>\n第1天：上午游览。',
    conversation_id: 'chat-c1',
  }), { status: 200 }));
  const client = createDifyClient(environment, fetch);
  await expect(client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'wx-user-a', []))
    .resolves.toEqual({ answer: '第1天：上午游览。', conversationId: 'chat-c1' });
});

it('rejects an answer that contains only a Dify reasoning block', async () => {
  const fetch = vi.fn<RequestCall>(async () => new Response(JSON.stringify({
    answer: '<think>内部推理</think>', conversation_id: 'chat-c1',
  }), { status: 200 }));
  const client = createDifyClient(environment, fetch);
  await expect(client.send('chat', { requestId: 'c1', kind: 'chat', question: '问题' }, null, 'wx-user-a', []))
    .rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
});
```

- [ ] **Step 2: 运行红灯测试**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\dify-adapter.test.ts`

Expected: FAIL because the current adapter returns `<think>` content unchanged.

- [ ] **Step 3: 写最小净化实现**

在 `cloudfunctions/ai/dify.ts` 的 `responseData` 前新增：

```ts
function userFacingAnswer(value: string) {
  const withoutThinkBlocks = value
    .replace(/<think\\b[^>]*>[\\s\\S]*?<\\/think\\s*>/gi, '')
    .replace(/<!--\\s*dify-deepseek-reasoning\\s*-->/gi, '')
    .trim();
  return /<\\/?think\\b/i.test(withoutThinkBlocks) ? '' : withoutThinkBlocks;
}
```

把 `responseData` 内的赋值改为：

```ts
const answer = typeof result.answer === 'string' ? userFacingAnswer(result.answer) : '';
```

保留现有的空值、4,000 字符和会话标识验证，不新增客户端过滤。

- [ ] **Step 4: 运行绿灯测试和静态检查**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\dify-adapter.test.ts`

Expected: PASS.

Run: `node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\dify.ts tests\\unit\\dify-adapter.test.ts`

Expected: no output, exit 0.

- [ ] **Step 5: 提交云函数修复**

```bash
git add -- cloudfunctions/ai/dify.ts tests/unit/dify-adapter.test.ts
git diff --cached --check
git commit -m "fix: hide Dify reasoning output"
```

### Task 2: 用显式状态渲染旅行偏好

**Files:**

- Modify: `miniprogram/pages/trip-form/index.ts:5-50`
- Modify: `miniprogram/pages/trip-form/index.wxml:1`
- Modify: `miniprogram/pages/preferences/index.ts:3-25`
- Modify: `miniprogram/pages/preferences/index.wxml:1`
- Modify: `tests/unit/trip-form.test.ts:4-20`
- Create: `tests/unit/preferences-page.test.ts`

**Interfaces:**

- Consumes: `string[]` 的已选偏好；每项值保持不变。
- Produces: 行程页 `preferenceOptions` 和个人页 `options` 均为 `{ value: string; selected: boolean }[]`，模板使用 `item.value` 与 `item.selected`。

- [ ] **Step 1: 写出失败测试**

扩展 `tests/unit/trip-form.test.ts` 的 `TripPage.data`：

```ts
preferenceOptions: Array<{ value: string; selected: boolean }>;
```

新增：

```ts
it('updates the visible selected state when a trip preference is toggled', async () => {
  const page = await loadTripPage();
  page.onTogglePreference({ currentTarget: { dataset: { value: '自然风景' } } });
  expect(page.data.preferenceOptions.find(item => item.value === '自然风景')).toMatchObject({ selected: true });
  page.onTogglePreference({ currentTarget: { dataset: { value: '自然风景' } } });
  expect(page.data.preferenceOptions.find(item => item.value === '自然风景')).toMatchObject({ selected: false });
});
```

创建 `tests/unit/preferences-page.test.ts`，按现有 `Page` 测试模式加载页面、模拟 `getPreferences` 返回空数组，并写入：

```ts
it('updates the visible selected state when a saved preference is toggled', async () => {
  const page = await loadPreferencesPage();
  await page.load();
  page.onToggle({ currentTarget: { dataset: { value: '自然风景' } } });
  expect(page.data.options.find(item => item.value === '自然风景')).toMatchObject({ selected: true });
  page.onToggle({ currentTarget: { dataset: { value: '自然风景' } } });
  expect(page.data.options.find(item => item.value === '自然风景')).toMatchObject({ selected: false });
});
```

- [ ] **Step 2: 运行红灯测试**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts tests\\unit\\preferences-page.test.ts`

Expected: FAIL because current data items are strings and have no `selected` field.

- [ ] **Step 3: 写最小前端实现**

在两个页面各自声明：

```ts
type PreferenceOption = { value: string; selected: boolean };
function visibleOptions(selected: string[]): PreferenceOption[] {
  return optionValues.map(value => ({ value, selected: selected.includes(value) }));
}
```

行程页将选项常量改为 `optionValues`，初始化为 `preferenceOptions: visibleOptions([])`；`updateForm` 构造 `form` 后写入：

```ts
this.setData({ form, preferenceOptions: visibleOptions(form.preferences), errors: [], error: '' });
```

个人偏好页将初始 `options` 改为 `visibleOptions([])`；`load` 成功、`onToggle` 和 `onSave` 每次更新 `selected` 时，同时写入 `options: visibleOptions(selected)`。

将两个 WXML 循环分别改为：

```xml
<button wx:for="{{preferenceOptions}}" wx:key="value" class="preference {{item.selected ? 'selected' : ''}}" data-value="{{item.value}}" bindtap="onTogglePreference">{{item.value}}</button>
```

```xml
<button wx:for="{{options}}" wx:key="value" class="choice {{item.selected ? 'selected' : ''}}" data-value="{{item.value}}" bindtap="onToggle">{{item.value}}</button>
```

不得改变 CSS、六项限制、保存 API 或行程请求载荷。

- [ ] **Step 4: 运行绿灯测试和相关检查**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\trip-form.test.ts tests\\unit\\preferences-page.test.ts`

Expected: PASS.

Run: `node node_modules\\typescript\\bin\\tsc --noEmit`

Expected: no diagnostics.

Run: `node node_modules\\eslint\\bin\\eslint.js miniprogram\\pages\\trip-form\\index.ts miniprogram\\pages\\preferences\\index.ts tests\\unit\\trip-form.test.ts tests\\unit\\preferences-page.test.ts`

Expected: no output, exit 0.

- [ ] **Step 5: 提交前端修复**

```bash
git add -- miniprogram/pages/trip-form/index.ts miniprogram/pages/trip-form/index.wxml miniprogram/pages/preferences/index.ts miniprogram/pages/preferences/index.wxml tests/unit/trip-form.test.ts tests/unit/preferences-page.test.ts
git diff --cached --check
git commit -m "fix: render selected travel preferences"
```

### Task 3: 构建、独立验收和部署前检查

**Files:**

- Modify: `docs/testing/2026-09-06-trip-chatflow-performance-qa.md`

**Interfaces:**

- Consumes: Task 1 和 Task 2 的提交及小程序 demo 构建包。
- Produces: 包含提交号、实际检查、缺陷修复和待执行手工验收的独立记录。

- [ ] **Step 1: 运行完整关联验证**

Run each command separately:

```bash
node node_modules\\vitest\\vitest.mjs run tests\\unit\\dify-adapter.test.ts tests\\unit\\trip-form.test.ts tests\\unit\\preferences-page.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\dify.ts miniprogram\\pages\\trip-form\\index.ts miniprogram\\pages\\preferences\\index.ts tests\\unit\\dify-adapter.test.ts tests\\unit\\trip-form.test.ts tests\\unit\\preferences-page.test.ts
node scripts\\build.mjs --mode=demo
node scripts\\check-package.mjs
git diff --check
```

Expected: every command exits 0; the demo package still only calls `aiService`.

- [ ] **Step 2: 记录独立验收**

在既有 QA 文档添加本次两个提交、实际命令结果和待手工项：开发者工具编译后点选/取消行程偏好和个人偏好；提交一次行程，确认答案不含 `<think>`；记录实际耗时。

- [ ] **Step 3: 提交验收记录**

```bash
git add -- docs/testing/2026-09-06-trip-chatflow-performance-qa.md
git diff --cached --check
git commit -m "test: record trip response safety QA"
```

## 计划自查

- 规格覆盖：Task 1 实现并测试云端推理隔离；Task 2 实现并测试两处偏好按钮的显式选中状态；Task 3 构建、边界检查和验收记录。
- 范围控制：没有修改 Dify 设置、密钥、环境变量、行程内容逻辑或数据库结构。
- 类型一致：两个页面均以 `{ value, selected }` 提供 WXML 所需字段；原始 `string[]` 仍是所有请求和保存接口的输入。

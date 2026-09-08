# 行程调整输入框 iPhone 主动滚动控制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 iPhone 键盘弹出后主动把行程调整输入框定位回可视区域，使用户始终看得到输入框和正在输入的文字。

**Architecture:** 调整 `textarea` 监听组件级 `keyboardheightchange` 事件；键盘高度大于 0 时，由页面方法调用 `wx.pageScrollTo` 定位唯一输入框 ID。该处理只管理页面视野，不修改焦点、输入值、行程状态或 AI 调用链。

**Tech Stack:** 原生微信小程序 WXML、TypeScript、官方 `miniprogram-api-typings`、Vitest、ESLint、esbuild。

## Global Constraints

- 使用 `TextareaKeyboardHeightChange` 事件类型；组件事件最低基础库为 2.7.0。
- 使用 `wx.pageScrollTo` 的 `selector` 和 `duration`；选择器定位最低基础库为 2.7.3，不使用最低基础库 2.23.1 才支持的 `offsetTop`。
- 不注册全局键盘监听，不增加计时器，不增加焦点状态，不修改 WXSS。
- 不修改 Dify、云函数、数据库、环境变量、密钥、行程提示词、会话或用户记录。
- 只暂存本计划列出的文件，不暂存 `project.config.json` 或仓库内其他现有未提交内容。
- 开发者工具验证不能代替 iPhone 微信二维码预览验收。

---

### Task 1: 键盘弹出后主动定位调整输入框

**Files:**
- Modify: `tests/unit/trip-form.test.ts:6-43,46-67`
- Modify: `miniprogram/pages/trip-form/index.wxml:41-45`
- Modify: `miniprogram/pages/trip-form/index.ts:49-95`

**Interfaces:**
- Consumes: `WechatMiniprogram.TextareaKeyboardHeightChange`，事件详情 `{ height: number; duration: number }`。
- Produces: `onAdjustmentKeyboardHeightChange(event): void`；键盘打开时调用 `wx.pageScrollTo({ selector: '#trip-adjustment-input', duration: 0 })`。
- WXML contract: 调整 `textarea` 具有 `id="trip-adjustment-input"` 和 `bindkeyboardheightchange="onAdjustmentKeyboardHeightChange"`。

- [ ] **Step 1: 扩展页面测试类型和微信 API 测试桩**

把测试页类型加入方法：

```ts
onAdjustmentKeyboardHeightChange(event: { detail: { height: number; duration: number } }): void;
```

把 `loadTripPage` 的参数类型改为：

```ts
async function loadTripPage(options: {
  submitAi?: ReturnType<typeof vi.fn>;
  resetAiConversation?: ReturnType<typeof vi.fn>;
  pageScrollTo?: ReturnType<typeof vi.fn>;
} = {}) {
```

并把全局微信测试桩改为：

```ts
vi.stubGlobal('wx', {
  showToast: vi.fn(),
  pageScrollTo: options.pageScrollTo ?? vi.fn(),
});
```

- [ ] **Step 2: 写入失败回归测试**

在首个 WXML 测试中加入：

```ts
expect(adjustmentTextarea).toContain('id="trip-adjustment-input"');
expect(adjustmentTextarea).toContain('bindkeyboardheightchange="onAdjustmentKeyboardHeightChange"');
```

新增行为测试：

```ts
it('returns the focused trip adjustment field to view when the keyboard opens', async () => {
  const pageScrollTo = vi.fn();
  const page = await loadTripPage({ pageScrollTo });

  page.onAdjustmentKeyboardHeightChange({ detail: { height: 320, duration: 0 } });

  expect(pageScrollTo).toHaveBeenCalledTimes(1);
  expect(pageScrollTo).toHaveBeenCalledWith({ selector: '#trip-adjustment-input', duration: 0 });

  pageScrollTo.mockClear();
  page.onAdjustmentKeyboardHeightChange({ detail: { height: 0, duration: 0 } });
  expect(pageScrollTo).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: 运行定向测试确认失败**

Run:

```powershell
node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts
```

Expected: FAIL；旧 WXML 缺少 ID 和键盘事件绑定，页面对象也没有 `onAdjustmentKeyboardHeightChange`。

- [ ] **Step 4: 加入 WXML 定位点和键盘事件绑定**

把调整输入框改为：

```xml
<textarea id="trip-adjustment-input" value="{{adjustment}}" maxlength="1000" adjust-position="{{false}}" placeholder="例如：第二天安排轻松一些；推荐具体餐馆，要吃鱼和热干面" bindinput="onAdjustment" bindkeyboardheightchange="onAdjustmentKeyboardHeightChange" />
```

其外层 `view.adjustment-field` 和其他控件保持不变。

- [ ] **Step 5: 加入页面滚动处理方法**

在 `onAdjustment` 后加入：

```ts
onAdjustmentKeyboardHeightChange(event: WechatMiniprogram.TextareaKeyboardHeightChange) {
  if (event.detail.height <= 0) return;
  void wx.pageScrollTo({ selector: '#trip-adjustment-input', duration: 0 });
},
```

不使用事件中的 `duration`，因为最终定位应立即完成，不播放第二段滚动动画。

- [ ] **Step 6: 运行定向检查确认通过**

Run:

```powershell
node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts
node node_modules\typescript\bin\tsc --noEmit
node node_modules\eslint\bin\eslint.js miniprogram\pages\trip-form\index.ts tests\unit\trip-form.test.ts
git diff --check -- miniprogram/pages/trip-form/index.wxml miniprogram/pages/trip-form/index.ts tests/unit/trip-form.test.ts
```

Expected: 行程表单测试 8/8 通过；类型检查、静态检查和差异检查退出码均为 0。

- [ ] **Step 7: 提交主动滚动修复**

```powershell
git add -- miniprogram/pages/trip-form/index.wxml miniprogram/pages/trip-form/index.ts tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "fix: restore trip input after keyboard opens"
```

### Task 2: 完整验证、真实包构建和真机待验记录

**Files:**
- Modify: `docs/testing/2026-09-08-trip-adjustment-ios-keyboard-qa.md`
- Generated but not committed: `dist/`

**Interfaces:**
- Consumes: Task 1 已提交的输入框定位和页面滚动处理。
- Produces: 包含主动滚动逻辑的真实 `dist`，以及区分本地检查和 iPhone 结果的验收记录。

- [ ] **Step 1: 运行完整本地检查**

Run:

```powershell
node node_modules\vitest\vitest.mjs run
node node_modules\typescript\bin\tsc --noEmit
node node_modules\eslint\bin\eslint.js .
node scripts\verify-docs.mjs
git diff --check
```

Expected: 所有可运行测试通过；数据库安全集成测试如因环境条件跳过，按实际输出记录；其余命令退出码为 0。若受限沙箱阻止构建测试读取 Windows 临时目录，使用同一命令在获准的沙箱外重跑并同时记录两次结果。

- [ ] **Step 2: 重新生成并检查真实预览包**

Run:

```powershell
node scripts\build.mjs --mode=demo
node scripts\check-package.mjs --mode=demo
```

Expected: 构建和包检查退出码为 0；`dist/miniprogram/pages/trip-form/index.wxml` 包含 `trip-adjustment-input` 和 `onAdjustmentKeyboardHeightChange`，生成的页面脚本包含 `pageScrollTo`。

- [ ] **Step 3: 更新验收记录**

在 `docs/testing/2026-09-08-trip-adjustment-ios-keyboard-qa.md` 中如实追加：

- `84766e9` 的外层容器修复仍被用户在 iPhone 上确认无效；输入框保持焦点并能接收文字，只是页面视野滚走。
- 本次主动滚动修复的提交号、失败测试、定向测试、全量测试、类型检查、静态检查、文档检查和真实包检查结果。
- iPhone 新二维码复测在用户返回结果前保持待验，不声称真机通过。

- [ ] **Step 4: 提交验收记录**

```powershell
git add -- docs/testing/2026-09-08-trip-adjustment-ios-keyboard-qa.md
git diff --cached --check
git commit -m "test: record active iOS keyboard scroll QA"
```

- [ ] **Step 5: 用户执行 iPhone 独立验收**

用户在微信开发者工具点击“预览”，用 iPhone 扫描新二维码并执行：

1. 打开“行程定制”并生成行程。
2. 滚动到调整输入框并点击。
3. 键盘弹出后连续输入不少于 10 个汉字。
4. 确认输入框被定位在键盘上方，文字始终可见。
5. 点击“确认调整”，确认完整行程正常重新生成。

Expected: 步骤 1–5 全部成功。若页面仍然离开输入框，则不再追加键盘属性或计时器，转为独立调整页面方案。

## Plan Self-Review

- Task 1 覆盖事件输入、页面滚动输出、键盘关闭分支和原有 WXML 接口。
- Task 2 覆盖全量回归、真实生成物、独立真机验收和失败后的停止条件。
- 类型名、事件名、选择器 ID 和测试期望在设计、WXML、TypeScript 与测试中一致。
- 各步骤内容完整，没有无关重构、云端修改或敏感信息。

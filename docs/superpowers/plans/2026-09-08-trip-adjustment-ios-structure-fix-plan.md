# 行程调整输入框 iPhone 结构修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 iPhone 微信二维码预览中的行程调整意见框保持焦点并可连续输入，不再自动滚回“当前计划”开头。

**Architecture:** 将行程调整 `textarea` 的外层从表单标签 `label` 替换为普通布局容器 `view`，使其结构与同一 iPhone 上已验证正常的自由问答输入框保持一致。保留现有类名、输入绑定、字数限制、键盘属性和所有 AI 调用逻辑，只改变一个结构变量。

**Tech Stack:** 原生微信小程序 WXML、TypeScript、Vitest、ESLint、esbuild。

## Global Constraints

- 只修改行程调整输入框的外层 WXML 容器及其自动化测试。
- 不修改页面文字、视觉样式、表单状态、按钮行为、Dify、云函数、数据库、环境变量、密钥、会话记录或行程提示词。
- 每个逻辑改动单独提交，不暂存 `project.config.json` 或仓库内其他现有未提交文件。
- 开发者工具验证不能代替 iPhone 微信二维码预览验收。

---

### Task 1: 将调整输入框改为普通布局容器

**Files:**
- Modify: `tests/unit/trip-form.test.ts:46-63`
- Modify: `miniprogram/pages/trip-form/index.wxml:41-45`

**Interfaces:**
- Consumes: `adjustment` 页面状态和现有 `onAdjustment(event)` 输入事件。
- Produces: `view.adjustment-field` 包裹的 `textarea`；保留 `value="{{adjustment}}"`、`maxlength="1000"`、`adjust-position="{{false}}"` 和 `bindinput="onAdjustment"`。

- [ ] **Step 1: 写入失败回归测试**

在 `tests/unit/trip-form.test.ts` 首个 WXML 测试中，取得调整输入框后加入普通容器断言：

```ts
const adjustmentTextarea = markup.match(/<textarea[^>]*bindinput="onAdjustment"[^>]*\/>/)?.[0] ?? '';
expect(adjustmentTextarea).toContain('value="{{adjustment}}"');
expect(adjustmentTextarea).toContain('maxlength="1000"');
expect(adjustmentTextarea).toContain('adjust-position="{{false}}"');
expect(markup).toContain('<view class="adjustment-field"><text>对行程还有什么想调整的？</text><textarea');
expect(markup).not.toContain('<label class="adjustment-field">');
```

保留原有“键盘属性只出现一次”和“拒绝静态字符串值”的断言。

- [ ] **Step 2: 运行定向测试确认失败**

Run:

```powershell
node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts
```

Expected: FAIL，提示找不到 `<view class="adjustment-field">`，且当前 WXML 仍包含 `<label class="adjustment-field">`。

- [ ] **Step 3: 实施单变量结构修改**

将 `miniprogram/pages/trip-form/index.wxml` 的调整区域改为：

```xml
<view wx:if="{{results.length}}" class="adjustment-card card">
  <view class="adjustment-field"><text>对行程还有什么想调整的？</text><textarea value="{{adjustment}}" maxlength="1000" adjust-position="{{false}}" placeholder="例如：第二天安排轻松一些；推荐具体餐馆，要吃鱼和热干面" bindinput="onAdjustment" /></view>
  <text wx:if="{{adjustmentError}}" class="adjustment-error">{{adjustmentError}}</text>
  <button class="button-primary adjustment-button" loading="{{isSubmitting}}" disabled="{{isSubmitting}}" bindtap="submitAdjustment">确认调整</button>
  <button class="button-secondary restart-button" disabled="{{isSubmitting}}" bindtap="restartTrip">重新规划</button>
</view>
```

不修改 `index.wxss` 或 `index.ts`。

- [ ] **Step 4: 运行定向检查确认通过**

Run:

```powershell
node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts
node node_modules\typescript\bin\tsc --noEmit
node node_modules\eslint\bin\eslint.js miniprogram\pages\trip-form\index.wxml tests\unit\trip-form.test.ts
git diff --check -- miniprogram/pages/trip-form/index.wxml tests/unit/trip-form.test.ts
```

Expected: 行程表单测试全部通过；类型检查、静态检查和差异检查退出码均为 0。

- [ ] **Step 5: 提交结构修复**

```powershell
git add -- miniprogram/pages/trip-form/index.wxml tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "fix: simplify trip adjustment input wrapper"
```

### Task 2: 重建真实预览包并记录验收边界

**Files:**
- Modify: `docs/testing/2026-09-08-trip-adjustment-ios-keyboard-qa.md`
- Generated but not committed: `dist/`

**Interfaces:**
- Consumes: Task 1 已提交的 WXML 结构修复。
- Produces: 包含 `view.adjustment-field` 的真实 `dist` 预览包，以及明确区分本地检查和 iPhone 真机结果的验收记录。

- [ ] **Step 1: 运行完整本地检查**

Run:

```powershell
node node_modules\vitest\vitest.mjs run
node node_modules\typescript\bin\tsc --noEmit
node node_modules\eslint\bin\eslint.js .
node scripts\verify-docs.mjs
git diff --check
```

Expected: 所有本地检查退出码为 0；如集成测试因环境要求被明确跳过，按现有测试输出如实记录，不能写成通过。

- [ ] **Step 2: 生成并核对真实预览包**

Run:

```powershell
node scripts\build.mjs --mode=demo
node scripts\check-package.mjs --mode=demo
```

Expected: 构建和包检查均通过；`dist/miniprogram/pages/trip-form/index.wxml` 包含 `<view class="adjustment-field">`，不包含 `<label class="adjustment-field">`。

- [ ] **Step 3: 更新待验记录**

把 `docs/testing/2026-09-08-trip-adjustment-ios-keyboard-qa.md` 更新为以下事实：

- 两种 `adjust-position` 写法均已由用户在 iPhone 复测并确认无效。
- 同一台 iPhone 上，自由问答长内容和多轮输入正常。
- 本次只对齐输入框外层结构，本地自动化与真实包构建结果按实际命令记录。
- iPhone 最终步骤“生成行程 → 点击调整框 → 连续输入文字 → 确认调整”在用户复测前标记为待验，不能声称真机通过。

- [ ] **Step 4: 提交验收记录**

```powershell
git add -- docs/testing/2026-09-08-trip-adjustment-ios-keyboard-qa.md
git diff --cached --check
git commit -m "test: update iOS trip input acceptance record"
```

- [ ] **Step 5: 用户执行 iPhone 独立验收**

用户在微信开发者工具点击“预览”，用 iPhone 扫描新二维码，然后：

1. 打开“行程定制”并生成行程。
2. 滚动到“对行程还有什么想调整的？”输入框。
3. 点击输入框并连续输入不少于 10 个汉字。
4. 确认页面没有跳回“当前计划”，输入文字保持可见。
5. 点击“确认调整”，确认完整行程可正常重新生成。

Expected: 步骤 1–5 全部成功。若步骤 3 仍复现跳动，停止继续增加输入属性，转为评估 `.card` 裁切或独立输入区域架构。

## Plan Self-Review

- 覆盖设计中的唯一代码变量：`label.adjustment-field` 替换为 `view.adjustment-field`。
- 自动化测试同时保护结构变化和原有输入接口，未修改样式或业务逻辑。
- 真实包检查与 iPhone 独立验收分开记录，不会把开发者工具结果误报为真机通过。
- 各步骤内容完整，未包含无关重构或云端改动。

# 行程调整输入框 iPhone 键盘定位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 防止 iPhone 微信在点击行程调整意见框时把长页面自动滚到当前计划开头。

**Architecture:** 只让行程调整 `textarea` 禁用微信原生的页面自动顶起。保留页面的普通滚动和输入事件，不引入焦点回调、手动滚动或自定义键盘处理。

**Tech Stack:** 原生微信小程序 WXML、Vitest、TypeScript、ESLint、esbuild。

## Global Constraints

- 只修改行程调整 `textarea` 的键盘定位属性，不改初始表单输入框或其他页面。
- 不改 Dify、云函数、数据库、环境变量、密钥、AppID、行程内容、会话或用户记录。
- 先有失败测试；通过相关检查后创建聚焦 Git commit；验收记录单独提交。
- 真实 `dist` 包必须在最后用 `demo` 模式重新生成；iPhone 扫码验证由用户完成。

---

### Task 1: 禁止调整输入框触发原生页面顶起

**Files:**
- Modify: `tests/unit/trip-form.test.ts:46-60`
- Modify: `miniprogram/pages/trip-form/index.wxml:41-45`

**Interfaces:**
- 行程调整框保留 `value="{{adjustment}}"`、`maxlength="1000"`、`bindinput="onAdjustment"`。
- 该元素额外具有静态属性 `adjust-position="false"`。
- 其他 `input` 或 `textarea` 不获得该属性。

- [ ] **Step 1: 写入失败回归测试**

在 `tests/unit/trip-form.test.ts` 的首个 markup 测试中加入：

```ts
const adjustmentTextarea = markup.match(/<textarea[^>]*bindinput="onAdjustment"[^>]*\/>/)?.[0] ?? '';
expect(adjustmentTextarea).toContain('adjust-position="false"');
expect((markup.match(/adjust-position="false"/g) ?? [])).toHaveLength(1);
```

- [ ] **Step 2: 运行定向测试确认失败**

Run:

```powershell
node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts
```

Expected: FAIL，因为当前调整 `textarea` 没有 `adjust-position="false"`。

- [ ] **Step 3: 最小实现**

把行程调整框改为：

```xml
<textarea value="{{adjustment}}" maxlength="1000" adjust-position="false" placeholder="例如：第二天安排轻松一些；推荐具体餐馆，要吃鱼和热干面" bindinput="onAdjustment" />
```

不新增 `bindfocus`、`bindblur`、`pageScrollTo`、`cursor-spacing` 或 CSS 定位规则。

- [ ] **Step 4: 验证并提交功能改动**

Run:

```powershell
node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts
node node_modules\typescript\bin\tsc --noEmit
node node_modules\eslint\bin\eslint.js miniprogram\pages\trip-form\index.wxml tests\unit\trip-form.test.ts
node scripts\build.mjs --mode=demo
node scripts\check-package.mjs --mode=demo
git diff --check
```

Then:

```powershell
git add -- miniprogram/pages/trip-form/index.wxml tests/unit/trip-form.test.ts
git diff --cached --check
git commit -m "fix: keep trip adjustment input in place"
```

### Task 2: 记录真机验证边界

**Files:**
- Create: `docs/testing/2026-09-08-trip-adjustment-ios-keyboard-qa.md`

**Interfaces:**
- 记录实际自动化命令、真实包重建结果和用户待执行的 iPhone 二维码预览步骤。

- [ ] **Step 1: 运行全量本地检查**

Run:

```powershell
node node_modules\vitest\vitest.mjs run
node node_modules\typescript\bin\tsc --noEmit
node node_modules\eslint\bin\eslint.js .
node scripts\verify-docs.mjs
git diff --check
```

Expected: 全部本地检查退出 0；真实 iPhone 键盘行为保持待验。

- [ ] **Step 2: 写入并提交验收记录**

记录被测提交、根因、WXML 属性、自动化结果、未改动的云端边界，以及用户在 iPhone 上执行“生成行程 → 点击调整意见框 → 输入并提交”的待验步骤。然后执行：

```powershell
git add -- docs/testing/2026-09-08-trip-adjustment-ios-keyboard-qa.md
git diff --cached --check
git commit -m "test: record iOS trip input QA"
```

## Plan Self-Review

- Task 1 覆盖了设计中唯一的页面行为改动和“只作用于调整框”的回归保护。
- Task 2 把本地可验证范围和不可替代的 iPhone 真机验证明确分开。
- 计划没有涉及 Dify、云函数、数据库、密钥、AppID 或无关 UI。

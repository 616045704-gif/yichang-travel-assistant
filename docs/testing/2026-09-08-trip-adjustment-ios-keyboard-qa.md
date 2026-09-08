# 行程调整输入框 iPhone 键盘定位验收记录

日期：2026-09-08
功能被测提交：`e679c61`（`fix: bind trip keyboard adjustment as boolean`）

## 变更范围与根因

iPhone 微信二维码预览中，行程生成后的调整 `textarea` 在键盘出现后会触发原生自动页面顶起，并错误滚动到“当前计划”开头。开发者工具不复现该 iPhone 原生键盘行为。

首次修复使用了静态字符串 `adjust-position="false"`，iPhone 复测后行为没有变化。根因是该值没有以 WXML 布尔表达式传入；修正版本改为 `adjust-position="{{false}}"`，并新增测试拒绝旧字符串写法。保留原有输入事件、1000 字限制、调整提交、重新规划、行程生成、Dify 和云函数边界。初始表单输入框及其他页面未改动。

## 实际执行

| 项目 | 实际执行 | 结果 |
| --- | --- | --- |
| 输入框属性回归 | `node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts` | 7/7 通过；断言真正的布尔绑定仅出现在调整输入框，并拒绝静态字符串写法。 |
| 类型检查 | `node node_modules\typescript\bin\tsc --noEmit` | 通过。 |
| 定向静态检查 | `node node_modules\eslint\bin\eslint.js miniprogram\pages\trip-form\index.wxml tests\unit\trip-form.test.ts` | 通过。 |
| 真实体验包 | `node scripts\build.mjs --mode=demo` | 通过；当前完整 `dist` 已重新生成并包含 `adjust-position="{{false}}"`。 |
| 包边界 | `node scripts\check-package.mjs --mode=demo` | 通过。 |
| 文档与空白 | `node scripts\verify-docs.mjs`、`git diff --check` | 通过。 |
| 全量测试 | `node node_modules\vitest\vitest.mjs run` | 282 通过、1 跳过；全部可运行测试通过。 |

## 待验项

- iPhone 微信二维码预览：生成行程后点击“对行程还有什么想调整的？”，确认键盘出现后页面不再跳到“当前计划”，可输入意见并点击“确认调整”。
- Android、真实 Dify/CloudBase 调用及体验版发布不由本次 WXML 属性修改替代验证。
- 独立测试角色：待验。本记录为开发执行的本地验证，不能替代独立真机验收。

## 阶段结论

本次修复的自动化、全量回归、构建和包边界检查已通过，真实 `dist` 包已生成。iPhone 真机二维码验证是本次唯一决定性外部验收步骤。

# 行程调整输入框 iPhone 键盘定位验收记录

日期：2026-09-08
功能被测提交：`82f1783`（`fix: keep trip adjustment input in place`）

## 变更范围与根因

iPhone 微信二维码预览中，行程生成后的调整 `textarea` 在键盘出现后会触发原生自动页面顶起，并错误滚动到“当前计划”开头。开发者工具不复现该 iPhone 原生键盘行为。

调整框现设置 `adjust-position="false"`，使微信不再接管整页滚动。保留原有输入事件、1000 字限制、调整提交、重新规划、行程生成、Dify 和云函数边界。初始表单输入框及其他页面未改动。

## 实际执行

| 项目 | 实际执行 | 结果 |
| --- | --- | --- |
| 输入框属性回归 | `node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts` | 7/7 通过；断言该属性仅出现在调整输入框。 |
| 类型检查 | `node node_modules\typescript\bin\tsc --noEmit` | 通过。 |
| 定向静态检查 | `node node_modules\eslint\bin\eslint.js miniprogram\pages\trip-form\index.wxml tests\unit\trip-form.test.ts` | 通过。 |
| 真实体验包 | `node scripts\build.mjs --mode=demo` | 通过；当前 `dist` 是真实 AI 包。 |
| 包边界 | `node scripts\check-package.mjs --mode=demo` | 通过。 |
| 文档与空白 | `node scripts\verify-docs.mjs`、`git diff --check` | 通过。 |
| 全量测试 | `node node_modules\vitest\vitest.mjs run` | 本次功能相关 7 项通过；全量为 281 通过、1 跳过、1 失败。失败来自用户工作区中另一个未提交的 `tests/unit/visual-style.test.ts` 品牌改名断言，当前产品源码尚未完成该独立改动；未修改、未回退或混入本次提交。 |

## 待验项

- iPhone 微信二维码预览：生成行程后点击“对行程还有什么想调整的？”，确认键盘出现后页面不再跳到“当前计划”，可输入意见并点击“确认调整”。
- Android、真实 Dify/CloudBase 调用及体验版发布不由本次 WXML 属性修改替代验证。
- 独立测试角色：待验。本记录为开发执行的本地验证，不能替代独立真机验收。

## 阶段结论

本次修复的自动化、构建和包边界检查已通过，真实 `dist` 包已生成。iPhone 真机二维码验证是本次唯一决定性外部验收步骤；在该未完成的独立品牌工作区改动完成前，不能声称全仓全量测试通过。

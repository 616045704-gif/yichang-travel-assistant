# 行程调整输入框 iPhone 键盘定位验收记录

日期：2026-09-08，更新于 2026-09-09
功能被测提交：`c867eb0`（`fix: move trip adjustment to separate page`）

## 真机复现与方案结论

iPhone 微信二维码预览中，生成行程后点击长结果页底部的调整 `textarea`，键盘能够弹出且输入框仍可接收文字，但页面视野会在不到一秒内滚回“当前计划”开头。微信开发者工具不复现，同一台 iPhone 上自由问答的长内容和多轮输入正常。

以下尝试均经用户真机复测后确认无效：

- 静态值 `adjust-position="false"`。
- 布尔绑定 `adjust-position="{{false}}"`。
- 将输入框外层由 `label` 改为 `view`（`84766e9`）。
- 监听 `keyboardheightchange` 后调用 `wx.pageScrollTo` 主动定位输入框（`98f9c5d`）。

因此，不再继续叠加键盘属性或滚动计时器。本次把调整输入框从长行程结果页移到独立的短页面：用户点击“调整行程”，在新页面输入并确认，页面通过 EventChannel 把文字交回原行程页，原行程页继续调用既有 `submitAdjustment()` 完整重新生成逻辑。Dify、云函数、本地地点检索和会话逻辑均未修改。

## 实际执行

| 项目 | 实际执行 | 结果 |
| --- | --- | --- |
| 失败测试 | 实现前运行行程表单、导航和新页面定向测试 | 5 项按预期失败：缺少新路由、新页面、打开页面按钮和回传处理。 |
| 修复后定向测试 | `node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts tests\unit\trip-adjustment-page.test.ts tests\unit\navigation.test.ts` | 3 个文件、26 项全部通过；覆盖独立编辑页、输入校验、EventChannel 回传和沿用完整重新生成。 |
| 全量测试 | `node node_modules\vitest\vitest.mjs run --reporter=dot` | 30 个文件、285 项通过；1 个数据库安全集成测试按环境条件跳过。 |
| 类型检查 | `node node_modules\typescript\bin\tsc --noEmit` | 通过。 |
| 静态检查 | `node node_modules\eslint\bin\eslint.js .` | 通过。 |
| 文档与空白 | `node scripts\verify-docs.mjs`、`git diff --check` | 文档 60 项验证通过；差异检查通过。 |
| 体验包构建 | `node scripts\build.mjs --mode=demo` | 通过；`dist` 已重新生成。 |
| 包边界 | `node scripts\check-package.mjs --mode=demo` | 通过。 |
| 生成物结构核对 | 核对 `dist/miniprogram/app.json`、行程页和调整页 | 新路由、独立页面和 `openAdjustmentPage` 已进入生成物；旧 `pageScrollTo` 和长页调整输入框未进入生成物。 |

## 待验项

- 用户在 iPhone 微信中执行普通编译并扫描新二维码，完成“生成行程 → 调整行程 → 输入不少于 10 个汉字 → 确认调整”。
- 合格标准：独立调整页输入框始终可见；确认后返回原页并生成包含调整要求的完整行程。
- 独立真机验收：待用户复测。本地自动化和开发者工具不能替代该结果。
- Android、真实 Dify/CloudBase 调用及体验版发布不由本次纯前端结构修改替代验证。

## 阶段结论

独立调整页面、自动化回归、类型检查、静态检查、文档检查、体验包构建和包边界检查均已完成。当前只差 iPhone 新二维码复测；在用户返回结果前，不声称真机问题已经解决。

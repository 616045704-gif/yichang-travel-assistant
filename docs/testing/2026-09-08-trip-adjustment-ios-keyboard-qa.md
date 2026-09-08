# 行程调整输入框 iPhone 键盘定位验收记录

日期：2026-09-08，更新于 2026-09-09
功能被测提交：`604e92f`（`fix: clarify trip regeneration progress`）

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
| 状态反馈失败测试 | 修改行程页测试后运行 `node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts` | 2 项按预期失败：旧页面缺少按钮区域加载状态、成功反馈和新版行程定位。 |
| 状态反馈定向测试 | `node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts` | 9 项全部通过；覆盖请求中的可见状态、成功反馈、自动定位和按钮对齐约束。 |
| 全量测试 | `node node_modules\vitest\vitest.mjs run --reporter=dot` | 30 个文件、286 项通过；1 个数据库安全集成测试按环境条件跳过。 |
| 类型检查 | `node node_modules\typescript\bin\tsc --noEmit` | 通过。 |
| 静态检查 | `node node_modules\eslint\bin\eslint.js .` | 通过。 |
| 文档与空白 | `node scripts\verify-docs.mjs`、`git diff --check` | 文档 60 项验证通过；差异检查通过。 |
| 体验包构建 | `node scripts\build.mjs --mode=demo` | 通过；`dist` 已重新生成。 |
| 包边界 | `node scripts\check-package.mjs --mode=demo` | 通过。 |
| 生成物结构核对 | 核对 `dist/miniprogram/app.json`、行程页和调整页 | 独立调整页、按钮区域加载提示、成功反馈和新版行程定位已进入生成物；长页调整输入框未进入生成物。 |

## 待验项

- 用户已在 iPhone 微信中确认独立调整页可以输入内容并返回原行程页，原来的键盘上滑阻断问题不再出现。
- 用户发现返回后生成提示位于长页面上方，当前视野看不到；按钮仅表现为不明显的禁用状态，且“重新规划”文字未与主按钮统一对齐。
- `604e92f` 把重新生成提示放到按钮区域，主按钮等待时显示转圈和“生成中…”，成功后显示“新行程已生成”并自动定位新版行程；两个操作按钮改用同一套水平、垂直居中规则。失败提示和重试也会显示在按钮区域。
- 用户需在 iPhone 新二维码中再次完成一次行程调整，确认等待提示始终可见、按钮文字对齐，并在成功后自动看到新版完整行程。
- 独立真机最终验收：待用户复测。本地自动化和开发者工具不能替代该结果。
- Android、真实 Dify/CloudBase 调用及体验版发布不由本次纯前端结构修改替代验证。

## 阶段结论

独立调整页面已由用户在 iPhone 验证可输入并返回。生成状态反馈的定向测试 9 项通过；完整回归 286 项通过、1 项按环境条件跳过；类型检查、静态检查、文档检查、体验包构建和包边界检查均通过。当前只差 iPhone 新二维码确认等待和完成反馈，在用户返回结果前不声称最终真机验收通过。

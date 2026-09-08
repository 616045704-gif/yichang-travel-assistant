# 行程调整输入框 iPhone 键盘定位验收记录

日期：2026-09-08
功能被测提交：`84766e9`（`fix: simplify trip adjustment input wrapper`）

## 真机复现与对照证据

iPhone 微信二维码预览中，生成行程后点击调整 `textarea`，键盘能够弹出，但不到一秒页面会滚回“当前计划”开头，导致无法输入。微信开发者工具不复现。

用户已在同一台 iPhone、同一份最新预览包完成以下对照：

- 静态值 `adjust-position="false"` 的预览版本仍然复现。
- 布尔绑定 `adjust-position="{{false}}"` 的预览版本仍然复现。
- 自由问答页面在长内容和多轮对话后可以正常点击、输入和继续对话。
- 最新包标题已经更新，排除了旧二维码或旧缓存。

因此，先前把问题归因于 `adjust-position` 写法的结论已被真机结果否定。本次修复只处理行程页独有的结构差异：把调整 `textarea` 外层从 `label.adjustment-field` 换成 `view.adjustment-field`。输入绑定、1000 字限制、样式类、调整提交、重新规划、行程生成、Dify 和云函数边界均未修改。

## 实际执行

| 项目 | 实际执行 | 结果 |
| --- | --- | --- |
| 失败测试 | 修改测试后运行 `node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts` | 旧 WXML 按预期失败：仍为 `label.adjustment-field`；其余 6 项通过。 |
| 修复后定向测试 | `node node_modules\vitest\vitest.mjs run tests\unit\trip-form.test.ts` | 7/7 通过。 |
| 类型检查 | `node node_modules\typescript\bin\tsc --noEmit` | 通过。 |
| 静态检查 | `node node_modules\eslint\bin\eslint.js .` | 通过。定向检查 WXML 时仅报告该文件没有 ESLint 匹配配置，无错误且退出码为 0。 |
| 文档与空白 | `node scripts\verify-docs.mjs`、`git diff --check` | 文档 60 项验证通过；差异检查通过。 |
| 全量测试 | `node node_modules\vitest\vitest.mjs run` | 放开 Windows 临时目录读取权限后，282 通过、1 个数据库安全集成测试按环境条件跳过。受限沙箱内首次运行的 13 项构建测试因临时目录 `Access is denied` 失败，不是产品代码失败。 |
| 真实体验包 | `node scripts\build.mjs --mode=demo` | 通过；当前 `dist` 已重新生成。 |
| 包边界 | `node scripts\check-package.mjs --mode=demo` | 通过。 |
| 生成物结构核对 | 核对源文件与 `dist/miniprogram/pages/trip-form/index.wxml` | 两者都包含 `view.adjustment-field`，都不包含 `label.adjustment-field`；应用标题为“三峡旅游小助手”。 |

## 待验项

- 用户在 iPhone 微信中扫描本次重新生成的二维码，执行“生成行程 → 点击调整框 → 连续输入不少于 10 个汉字 → 确认调整”。
- 合格标准：页面不跳回“当前计划”，已输入文字保持可见，完整行程能够正常重新生成。
- 独立真机验收：待用户复测。本地自动化和开发者工具不能代替该结果。
- Android、真实 Dify/CloudBase 调用及体验版发布不由本次前端结构修改替代验证。

## 阶段结论

结构修复、自动化回归、类型检查、静态检查、文档检查、真实包构建和包边界检查均已完成。当前只差 iPhone 新二维码复测；在该结果返回前，不声称真机问题已解决。如果仍复现，将停止继续叠加输入属性，转为评估卡片裁切或独立输入区域的页面架构。

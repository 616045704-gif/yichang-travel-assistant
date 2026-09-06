# 自由问答限额与提示验收记录

日期：2026-09-06  
测试范围提交：`d9d9f02`（`fix: expand daily AI request allowance`）、`2af14dd`（`fix: explain chat request rate limits`）

## 变更范围

- 用户维度的上海自然日新 AI 请求上限由 50 次提高到 100 次。
- 固定一分钟内最多 6 次新请求的保护保持不变。
- 自由问答收到云函数安全错误“请求较频繁，请稍后再试。”时，页面显示该原因；其余异常仍显示“网络连接不稳定，请重试”。
- Dify 工作流、模型、API Key、云函数环境变量、前端到 Dify 的调用边界均未改动。

## 根因证据

用户提供的 CloudBase 函数日志显示：函数以 200 完成，但业务结果为 `RATE_LIMITED`，并返回“请求较频繁，请稍后再试。”。因此问题是项目自身的用户请求配额已耗尽，不是 Dify 超时，也不是腾讯云函数崩溃。

## 开发自测

| 项目 | 实际执行 | 结果 |
| --- | --- | --- |
| 每日限额边界 | `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts` | 41/41 通过。前 6 个同分钟新请求可用、第 7 个受限；每日第 101 个新请求受限；下一上海自然日恢复。 |
| 自由问答提示 | `node node_modules\\vitest\\vitest.mjs run tests\\unit\\chat-ui.test.ts` | 5/5 通过。安全的限额文本被保留，未知异常仍回退为网络提示。 |
| AI 调用边界回归 | `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-records.test.ts tests\\unit\\chat-ui.test.ts tests\\unit\\ai-service.test.ts tests\\unit\\dify-adapter.test.ts` | 100/100 通过。测试使用本地替身，不会发起真实 Dify 请求。 |
| 类型检查 | `node node_modules\\typescript\\bin\\tsc --noEmit` | 通过。 |
| 代码规范 | `node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\quota.ts miniprogram\\view-models\\chat.ts tests\\unit\\ai-records.test.ts tests\\unit\\chat-ui.test.ts` | 通过。 |
| demo 构建和客户端边界 | `node scripts\\build.mjs --mode=demo`、`node scripts\\check-package.mjs` | 通过；客户端仍仅调用 `aiService`。 |
| 工作区检查 | `git diff --check` | 通过。 |

## 独立验收与未测项

- 独立测试角色：待验。本记录中的命令由开发角色执行，不能代替独立测试放行。
- 云函数部署：待执行。需要上传重新构建后的 `dist/cloudfunctions/aiService`；无需、也不应修改 Dify 或云端环境变量。
- 微信开发者工具：待在部署后重新编译并验证：正常自由问答、超过每分钟 6 次时的提示、超过当日 100 次时的提示，以及稍后可继续重试。
- Android 与 iPhone 真机、真实 CloudBase 数据库及真实 Dify 调用：待验。

## 阶段结论

本地自动化与构建通过，可进入仅包含 `aiService` 的云函数部署和开发者工具回归；尚不能称为真机或独立测试验收通过。

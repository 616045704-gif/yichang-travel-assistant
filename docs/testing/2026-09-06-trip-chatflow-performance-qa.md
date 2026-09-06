# Trip Chatflow 性能验收记录（待独立验收）

日期：2026-09-06
被测代码提交：`adbbb4b`（`fix: cap Dify trip local facts input`）
被测 Dify 发布版本：`#4`

## 本次变更

- Dify `trip` 已简化为“开始 → 快速行程生成 → 直接回复”。
- 开始节点包含可选文本 `local_verified_facts`；快速节点优先使用该资料。
- 已删除旧的并行知识检索、变量聚合和旧回复节点。
- 快速节点使用 `deepseek-v4-flash` 聊天模型，参数中最大输出为 900、思考模式为关闭、记忆窗口为 3。
- 云函数对 `trip` 的 `local_verified_facts` 截断到 Dify 开始字段的 256 字符限制；`chat` 仍保持 4000 字符上限。

## 实际执行与结果

| 项目 | 输入/操作 | 结果 |
| --- | --- | --- |
| Dify 发布前检查 | 流程图检查清单 | 通过：所有问题已解决 |
| Dify 首次规划 | 宜昌、2 人、3000 元、2 天、自然风景/轻松步行；提供短本地已核验资料 | 成功，约 26.4 秒 |
| Dify 追问 | 同一会话输入“第二天安排得更轻松一些” | 成功，约 16.6 秒 |
| Dify 输出结构 | 检查每天上午/下午/晚上，每时段最多 3 项 | 通过 |
| Dify 输出边界 | 检查有官方公告提醒、无长篇推理展示 | 通过；预览界面仍显示平台的“已深度思考”运行标签，已核对节点设置为 `deepseek-v4-flash` 且思考模式为关闭 |
| 单元测试 | `node node_modules\\vitest\\vitest.mjs run tests/unit/dify-adapter.test.ts` | 18/18 通过 |
| 类型检查 | `node node_modules\\typescript\\bin\\tsc --noEmit` | 通过 |
| 代码规范检查 | `node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\dify.ts tests\\unit\\dify-adapter.test.ts` | 通过 |
| 构建 | `node scripts\\build.mjs` | 通过 |

## 缺陷与未测项

- 本机没有可操作的微信开发者工具或小程序实例，未能从小程序页面实际点击 `trip` 并记录云函数端到端耗时；此项待云函数部署后由独立测试角色在真机或开发者工具补验。
- 本次仅发布 Dify 流程；含 256 字符保护的云函数提交尚未部署到 CloudBase，等待部署确认。
- 未声称独立测试团队已放行。本记录是开发验证，独立验收状态为**待验**。

# 双 Dify Chatflow 多轮助手独立验收记录

## 验收信息

- 角色：独立测试负责人（未参与本功能应用代码实现）
- 验收日期：2026-09-05
- 被测完整功能提交链：`d25ed48`、`54a50b1`、`9022ca3`、`86fceb9`、`8237de4`
- 被测最终功能提交：`8237de4 docs: add Dify Chatflow configuration runbook`
- 验收范围：双 Dify Chatflow 的云函数路由与安全边界、统一客户端切换、自由问答/行程定制多轮控制、模拟模式回归、构建包边界和运行手册。

## 实际执行与结果

本终端未将 `npm` 加入 PATH，因此以下检查使用项目已安装依赖及 Node 24.19.0 直接执行，与对应 `npm run` 脚本的底层命令一致。首次在受限环境运行测试时，Vitest 的 esbuild 子进程受到 `EPERM` 拦截；随后在获准的本地测试环境重新执行，未更改应用源码或依赖。

| 实际命令/检查 | 结果 |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run tests/unit/dify-adapter.test.ts tests/unit/ai-service.test.ts tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts` | 通过：4 个文件、22 项测试。覆盖两套 Dify 映射、私有会话槽位与分别重置、缺失配置/超时安全错误、客户端 mock/live 分流、聊天新对话、行程追问与重新规划。 |
| `node node_modules/vitest/vitest.mjs run` | 通过：23 个文件、118 项测试；`tests/integration/database-security.test.ts` 的 1 项既有云数据库测试按配置跳过。 |
| `node node_modules/typescript/bin/tsc --noEmit` | 通过。 |
| `node node_modules/eslint/bin/eslint.js .` | 通过。 |
| `node scripts/build.mjs` | 通过：development 构建就绪。 |
| `node scripts/build.mjs --mode=demo` | 通过：demo 构建就绪，验证体验构建可生成。 |
| `node scripts/check-package.mjs` | 通过：客户端路由、资源和包边界验证通过。 |
| `node scripts/verify-docs.mjs` | 通过：新增验收记录前验证 15 份文档。记录加入后已再次执行，见“交付前复核”。 |
| `git diff --check` | 通过，无空白错误。 |

## 独立复核证据

- 客户端 `miniprogram/services/ai.ts` 在开发构建保留 mock；非开发模式仅通过 `wx.cloud.callFunction({ name: 'aiService' })` 提交原始 `AiRequest` 或指定 `kind` 的重置请求。云函数失败会向页面抛出错误，不回退为模拟成功。
- 对 `miniprogram/` 和 demo 构建产物 `dist/miniprogram/` 进行关键词扫描：没有 Dify URL、环境变量/Key、授权头、`fetch`、`conversation_id`、Chat Messages 路径或 `wx.request`。命中的仅是 `resetAiConversation` 等本地函数名；包检查同时通过。
- `cloudfunctions/ai/dify.ts` 按 `kind` 分别选择 `DIFY_CHAT_API_BASE_URL`/`DIFY_CHAT_API_KEY` 与 `DIFY_TRIP_API_BASE_URL`/`DIFY_TRIP_API_KEY`，仅在云函数侧以 HTTPS blocking `POST /v1/chat-messages` 调用。首次行程携带五个表单输入；行程追问仅传 `question` 和原行程会话。
- `cloudfunctions/ai/service.ts` 在调用 Dify 前执行资料检索，将 `local_verified_facts` 作为服务器拥有的 Dify 输入；公开 `AiResult` 只含答案、模式、本地事实和引用，不含 Dify 会话标识。`repository.ts` 以可信 owner 与 `chat`/`trip` 构成两个独立私有槽位，重置仅写入目标种类。
- `ai-chat` 的“新对话”只重置 `chat` 并清空聊天界面；`trip-form` 的“重新规划”只重置 `trip` 并保留编辑中的表单字段。成功行程追问构造 `{ requestId, kind: 'trip', question }`，不重建或传输 `trip`。
- `message-bubble` 仅在 `mode === 'mock'` 时显示模拟标识；AI 页面保留出行免责声明。运行手册只记录变量名称与部署/回滚步骤，未包含密钥值、授权头或会话标识。

## 缺陷与结论

- 阻断缺陷：无。
- 非阻断缺陷：无。
- 结论：在本地可自动化验证的范围内，通过验收；可放行上述提交链用于后续由用户配置开发云环境后的真实 Dify 联调。

## 可放行范围与未测项

本次仅放行本地源码、单元/构建/静态边界与模拟模式范围。以下项目未配置或未执行，不得视为已通过：

- 真实 Dify App Key、两条真实 Chatflow、`/v1/chat-messages` 网络调用，以及真实上游超时/非 2xx 响应。
- 微信开发云环境的 `aiService` 部署、环境变量设置、真实本地地点数据库检索和云端会话保存。
- 两个真实微信用户之间的云端数据与会话隔离。
- 微信开发者工具中的页面视觉/交互验收，以及 Android 与 iPhone 真机连续演示。
- 既有 `tests/integration/database-security.test.ts` 所需云数据库集成环境。

真实环境可用后，应按 [`dify-chatflow.md`](../runbooks/dify-chatflow.md) 完成双助手首次/后续对话、相互隔离重置、错误提示与双用户、Android/iPhone 验收，并单独更新测试记录。

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

## 真实云环境补充验收（2026-09-05）

### 环境与责任边界

- 执行角色：部署实施者与自动化验证执行者；本节不是独立测试团队复验，不替代后续双用户和真机验收。
- 被测 Git：`f57b054 test: stabilize WeChat async state smoke checks`，包含 `6b418e0..f57b054` 的双 Chatflow 实现、部署修复和模拟器验收修复。
- 目标小程序、腾讯云账户与 CloudBase 环境均已由自动化运行时与本地忽略配置核对；验收记录不保留具体标识。
- 云函数：`aiService`，Node.js 20.19，状态“正常”，执行超时 120 秒；不记录函数操作标识。
- 云端资源：`places`、`place_contents`、`ai_sessions` 均已创建并设置为 `ADMINONLY`；函数环境已配置 `DIFY_BASE_URL`、两套各自的 API Base URL 和两套各自的 API Key。本文档、Git 变更和测试输出均未记录密钥值。

### 实际执行与结果

| 实际检查 | 结果 |
| --- | --- |
| 微信开发者工具 CLI 登录与项目核验 | 通过：CLI 返回已登录；自动化运行时核对实际 AppID 与本地忽略配置一致；模拟器基础库为 3.16.2。 |
| `node scripts/wechat-smoke.mjs`（通过本地自动化端口连接） | 通过：首页、发现、地图、我的四个入口，loading/error/empty/ready 四状态，分类布局与选择、全屏地图和分类点位更新均输出 PASS。 |
| 忽略目录中的真实 AI 冒烟脚本 | 通过：`chat` 初次问答返回 `OK/dify`（116 字）；`trip` 初次规划返回 `OK/dify`（1501 字）；重置 `chat` 后，以不含行程表单的追问继续 `trip` 仍返回 `OK/dify`（812 字）；随后重新建立 `chat` 返回 `OK/dify`（57 字）。脚本只输出类型、状态、模式和长度。 |
| `node node_modules/vitest/vitest.mjs run` | 通过：23 个文件、122 项测试；1 个需专用云数据库凭据的既有测试跳过。 |
| `node node_modules/typescript/bin/tsc --noEmit` | 通过。 |
| `node node_modules/eslint/bin/eslint.js .` | 通过。 |
| `node scripts/build.mjs` | 通过：development 构建就绪；构建产物使用已忽略的本地 AppID 与云环境 ID。 |
| `node scripts/check-package.mjs` | 通过：客户端路由、资源和前后端边界验证通过。 |
| `node scripts/import-content.mjs --target development --dry-run` | 通过：4 个地点及对应详情通过导入前校验；未执行云端写入。 |
| `node scripts/verify-docs.mjs`、`git diff --check` | 通过。 |

真实调用的顺序验证了 `chat` 与 `trip` 使用不同的 Dify 应用配置。`trip` 在 `chat` 被重置后仍可只凭追问继续，证明云端按用户与 `kind` 保存独立会话槽位；随后 `chat` 可重新建立自己的会话。前端全程只调用 `wx.cloud.callFunction({ name: 'aiService' })`。

### 联调中发现并修复的问题

- CloudBase 普通云函数默认 3 秒超时不足以等待 blocking Chatflow；已将 `aiService` 执行超时调整为 120 秒，客户端内部仍保留 90 秒上游中断与可理解的超时提示。
- 首轮配置复核发现 `DIFY_TRIP_API_KEY` 曾误用 `chat` 应用密钥；已从 `trip` 应用访问点重新核验并替换。最终四次真实调用均在更正后执行。
- 微信开发者工具 3.16.2 会使旧的组件自动化句柄保留先前分支；`f57b054` 改为由页面更新状态并在每次状态切换后重新获取组件句柄，完整模拟器回归通过。

### 结论与剩余未测项

- 阻断缺陷：无。
- 结论：正确账号下的双 Dify Chatflow、CloudBase 函数入口、blocking 请求、真实微信身份注入和独立会话续接已通过联调，可供后续内容导入与真机验收。
- 云端 `places`/`place_contents` 当前未导入发布态内容；真实函数已成功访问空集合，但“非空已核验资料传入 Dify”本次只由自动化单元测试覆盖。仓库中的 4 条示例均为 `draft`，且导入工具没有管理端写入适配器，因此未绕过发布流程写入云端。
- 仍未执行：两个真实微信用户之间的端到端隔离、真实上游超时/非 2xx 故障注入、Android 与 iPhone 真机连续演示、需专用集成环境的云数据库规则测试。以上均不得视为已放行。

## 最终云端复验（2026-09-05）

本节复验 `f57b054..c714e6b`，并取代上一节关于“90 秒上游中断”和仅三张集合的当前状态描述。被测最终应用提交为 `c714e6b fix: bound blocking Dify requests`；正确账号、AppID、环境和 `aiService` 函数标识未变。

### 云端配置复核

- `ai_sessions`、`ai_messages`、`trip_requests`、`places`、`place_contents` 均已创建并设置为 `ADMINONLY`。
- `aiService` 仍为 Node.js 20.19，函数执行超时 120 秒，公网访问可用；Dify 必需环境变量已配置在函数侧，未写入前端、仓库或验收输出。
- blocking Dify 请求的云函数内部总等待上限已调整为 45 秒，低于 CloudBase 客户端约 60 秒的直接调用断开边界；429、500、502、503、504 和网络失败仍最多尝试三次并受同一总时限约束。

### 实际执行与结果

| 实际检查 | 结果 |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run` | 通过：24 个文件、134 项测试；1 个需要专用云数据库规则环境的集成测试按配置跳过。 |
| `node node_modules/typescript/bin/tsc --noEmit`、`node node_modules/eslint/bin/eslint.js .` | 均通过。 |
| `node scripts/build.mjs`、`node scripts/check-package.mjs`、`node scripts/verify-docs.mjs` | 均通过；客户端路由、资源、前后端边界和文档引用有效。 |
| `node scripts/wechat-smoke.mjs`（本地自动化端口） | 通过：首页、发现、地图、我的；loading/error/empty/ready；分类布局、选择、全屏地图与点位更新全部 PASS。 |
| 忽略目录中的真实 AI 冒烟脚本 | 通过：`chat` 返回 `OK/dify`（96 字），首次 `trip` 返回 `OK/dify`（1551 字），重置 `chat` 后 `trip` 追问仍返回 `OK/dify`（411 字），重新建立 `chat` 返回 `OK/dify`（69 字）；同 `requestId` 重放结果完全一致；历史列表返回 4 条并同时包含 `chat`、`trip`。脚本没有输出密钥、用户标识或 Dify 会话标识。 |
| `git diff --check` | 通过。 |

### 复验中发现并关闭的问题

- 新建空记录集合后，`wx-server-sdk 4.0.2` 对不存在文档抛出 `document.get:fail document with _id … does not exist`。原判断未识别该官方错误形态，首次提问会返回内部错误。已新增精确回归测试并由 `fe644f1` 修复；权限错误和其他数据库异常仍继续上抛，不会被误当作“没有历史”。
- 一次行程追问在约 60 秒处由 CloudBase 客户端以 `ESOCKETTIMEDOUT` 断开，而当时 Dify 上游允许等待 90 秒。已新增边界测试并由 `c714e6b` 将上游总等待限制为 45 秒；重新部署后完整真实冒烟一次通过。
- `ai_messages` 与 `trip_requests` 的真实写入、按用户查询、`chat`/`trip` 分类、同请求幂等返回均已由最终云端冒烟覆盖。

### 最终阶段结论与未测项

- 阻断缺陷：无。
- 阶段结论：双 Dify Chatflow、CloudBase 私有会话与记录、blocking 请求、受限重试/超时、前端隔离和模拟器交互已通过当前开发环境验收。
- 尚未放行：非空发布态地点资料的真实云端传入、两个真实微信用户的端到端隔离、可控的真实 429/5xx 故障注入、Android/iPhone 真机连续演示，以及需要专用环境的数据库安全规则集成测试。

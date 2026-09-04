# 模拟 AI 助手独立验收记录

- **测试角色：** 独立测试负责人（未参与本模块应用源码实现）
- **验收日期：** 2026-09-04
- **被测 Git commit：** `4e26c8adc22947733bd9d1c0cde8df3dbc552062`
- **被测范围：** `218b99f`、`89d4c7b`、`83306d9`、`4e26c8a` 组成的模拟 AI 交互阶段；不接入 Dify。

## 实际执行项与结果

| 实际命令 | 结果 |
| --- | --- |
| `npm run test -- tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts tests/unit/navigation.test.ts tests/unit/profile-pages.test.ts` | 当前主机未安装/未暴露 `npm`，命令无法启动（`npm is not recognized`）；随后使用项目本地 Vitest 的等价命令完成同一检查。 |
| `node .\\node_modules\\vitest\\vitest.mjs run tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts tests/unit/navigation.test.ts tests/unit/profile-pages.test.ts` | 通过：4 个测试文件、22 项测试全部通过。 |
| `node .\\node_modules\\vitest\\vitest.mjs run` | 通过：22 个测试文件、102 项测试通过；`tests/integration/database-security.test.ts` 的 1 项集成测试按现有测试配置跳过。 |
| `node .\\node_modules\\typescript\\bin\\tsc --noEmit` | 通过：无 TypeScript 诊断。 |
| `node .\\node_modules\\eslint\\bin\\eslint.js .` | 通过：无 ESLint 诊断。 |
| `node scripts/build.mjs --mode=development` | 通过：生成开发包，并完成内置包检查。 |
| `node scripts/check-package.mjs` | 通过：客户端路由、资源和边界校验成功。 |
| `node scripts/build.mjs --mode=demo` | 通过：生成体验包，并按 demo 模式完成内置包检查。 |
| `node --input-type=module -e "import('./scripts/check-package.mjs').then(({checkPackage}) => checkPackage({ mode: 'demo' }))"` | 通过：再次以 demo 模式检查已生成体验包。 |
| `rg -n -i 'createDevelopmentAiClient|tests/fixtures|api\\.dify\\.|DIFY_API_KEY|wx\\.request\\s*\\(' dist/miniprogram` | 通过：无匹配；demo 产物不含开发模拟适配器、测试夹具、Dify 地址/密钥或 `wx.request`。 |
| `git diff --check` | 通过：无空白错误。 |

## 独立复核证据

- `miniprogram/app.json` 已注册 `/pages/ai-chat/index`、`/pages/trip-form/index` 和 `/pages/ai-history/index`；首页的 AI 入口跳转聊天页，“我的”的“AI 问答记录”入口跳转历史页。
- 三个 AI 页面均显示“内容仅供出行参考，请以景区、交通等官方公告为准”。聊天、行程结果和历史记录通过 `message-bubble` 显示“模拟回答，仅用于交互测试”。回答由 WXML `text` 节点渲染，聊天模板未使用 `rich-text`。
- `ChatModel` 对空白和超过 1000 字的问题在调用服务前拒绝，运行中复用同一个 in-flight 请求以抑制重复提交；失败保留原输入和原请求，`retry()` 重新使用该请求。定向测试覆盖这些行为以及离开/返回时的等待状态恢复。
- 行程页实际绑定目的地、人数、总预算、天数、旅行偏好五项；校验人数 1–20 的整数、天数 1–7 的整数、预算 1–100000 元、偏好最多 6 项，并明确“预算为全团总预算，不含往返宜昌大交通”。失败后保留表单输入和 `lastRequest`，提供重试；定向测试已验证失败与重试使用同一请求。
- 历史页只从会话内 `listMockAiRecords()` 读取成功模拟结果，明确写明“模拟记录，未持久化”；“我的”页也区分了云端个人记录与模拟记录。AI 服务未导入或调用 `userService`，未改写收藏、浏览、偏好或真实个人记录。
- 开发构建的默认模拟客户端只在 `__BUILD_MODE__ === 'development'`（及未定义的测试运行期）启用；demo 构建通过常量折叠排除该适配器。源代码和 demo 产物复核均未发现 Dify、真实网络请求或凭据。

## 缺陷与结论

本次可执行验收范围内未发现阻断或高、中、低严重度缺陷。

**可放行范围：** 通过当前 commit 的模拟 AI 页面与会话内交互验收：自由聊天、行程五字段表单、回答记录、失败提示与重试、首页/“我的”入口，以及开发包/体验包的 AI 服务边界。此结论仅代表模拟阶段，不代表真实 AI、云端个人记录或完整产品验收。

## 未测项与限制

- 未在 Android 与 iPhone 真机、微信开发者工具模拟器或扫码体验版执行 UI 操作；本次页面行为证据来自独立代码复核和自动化测试。
- 未验证真实网络断连、超时及网络恢复；仅验证了可注入模拟服务的失败/重试分支。
- 未接入或验证 Dify、Dify 凭据、真实云函数、云数据库查询、云端 AI 记录持久化及其用户隔离；这些均不属于本模拟阶段的可放行范围。
- 未验证地点资料优先规则、真实交通/景区信息准确性，或完整“定位 → 详情 → 收藏 → AI 提问”的真机连续演示。
- 主机缺少可直接调用的 `npm`，因此上述测试采用项目本地 Node/Vitest、TypeScript 与 ESLint 的等价命令执行；所有实际可运行检查均已通过。

# AI 助手首页双入口布局独立验收记录

- **测试角色：** 独立测试负责人（未参与本模块应用源码实现）
- **验收日期：** 2026-09-04
- **被测 Git commit：** `9dbc49e9d1be6ea7e1049aba9024b8ac0a153f89`
- **被测范围：** 首页 AI 区拆分为“自由问答”和“行程定制”两个并列直达入口，并移除聊天页的行程定制快捷入口；不涉及 AI 服务、云函数、Dify 预留边界或请求参数。

## 实际执行项与结果

| 实际命令 | 结果 |
| --- | --- |
| `npm run test -- tests/unit/navigation.test.ts tests/unit/visual-style.test.ts` | 当前主机未安装/未暴露 `npm`，命令无法启动（`npm is not recognized`）；随后使用项目本地 Vitest 的等价命令完成同一检查。 |
| `node .\\node_modules\\vitest\\vitest.mjs run tests/unit/navigation.test.ts tests/unit/visual-style.test.ts` | 通过：2 个测试文件、16 项测试全部通过。 |
| `node .\\node_modules\\vitest\\vitest.mjs run` | 通过：22 个测试文件、102 项测试通过；`tests/integration/database-security.test.ts` 的 1 项既有集成测试按现有配置跳过。 |
| `node .\\node_modules\\typescript\\bin\\tsc --noEmit` | 通过：无 TypeScript 诊断。 |
| `node .\\node_modules\\eslint\\bin\\eslint.js .` | 通过：无 ESLint 诊断。 |
| `node scripts/build.mjs` | 通过：开发包构建完成（`Build ready: dist/ (development)`）。 |
| `node scripts/build.mjs --mode=demo` | 通过：体验包构建完成（`Build ready: dist/ (demo)`）。 |
| `node scripts/check-package.mjs` | 通过：客户端路由、资源和边界校验成功。 |
| `git diff --check 9dbc49e^ 9dbc49e` | 通过：无空白错误。 |
| `git diff --check` | 通过：工作区差异无空白错误。 |

> 上表中 `node` 实际使用工作区提供的 Node.js 24.19.0 运行时；首次在受限沙箱执行 Vitest/构建时，`esbuild` 子进程被拒绝（`spawn EPERM`），随后在获准的项目执行环境中复验通过。这是执行环境限制，不是应用测试失败。

## 独立复核证据

- `git show --stat 9dbc49e` 与 `git diff --name-status 9dbc49e^ 9dbc49e` 显示本提交仅修改首页、聊天页的 TS/WXML/WXSS 和 `navigation`、`visual-style` 测试，共 8 个前端文件；无后端或服务文件。
- 首页 `openAiChat()` 仍使用 `/pages/ai-chat/index`，新增 `openTripForm()` 使用 `/pages/trip-form/index`。定向导航测试实际断言两个调用按顺序分别导航至这两个已注册路由。
- 首页模板含“自由问答”和“行程定制”两张按钮卡，分别绑定 `openAiChat`、`openTripForm`；样式包含 `.ai-entry-grid` 与 `grid-template-columns: repeat(2, minmax(0, 1fr))`，符合并列双卡布局。
- 聊天页模板不再含“我要定制行程”或 `bindtap="openTripForm"`，聊天页的同名页面方法和 `.trip-link` 样式也已移除；现有输入字数信息与免责声明保留。
- 对 `miniprogram/services/ai.ts`、`shared/contracts.ts`、`miniprogram/view-models/chat.ts`、`miniprogram/pages/trip-form/` 和 `cloudfunctions/` 执行提交差异检查，输出为空：模拟服务、`AiRequest`/`AiResult`、`kind`、`question`、`trip`、请求构造和全部云函数均未在本提交改动。源码复核仍确认聊天请求使用 `{ kind: 'chat', question }`，行程请求使用 `{ kind: 'trip', trip }`。
- `check-package` 与开发/体验构建均成功，表明既有客户端资源与包边界未因布局调整破坏。

## 缺陷与结论

本次可执行验收范围内未发现阻断、高、中或低严重度缺陷。

**可放行范围：** `9dbc49e` 的纯前端 AI 首页布局调整：首页双入口直达既有聊天页与行程页、聊天页去除行程跨页快捷入口，以及相关导航/视觉自动化契约。现有 AI 服务、模拟回答、请求字段、Dify 预留边界、云函数和调用参数均未被本提交改变。

## 未测项与限制

- 未在微信开发者工具模拟器、Android 或 iPhone 真机执行实际点击和视觉检查；并列卡片的运行时视觉、触控范围及窄屏表现仅由 WXML/WXSS 静态复核和自动化测试覆盖。
- 未执行真实网络、Dify、云函数、云数据库、个人记录或真实 AI 请求验证；这些不属于本次纯布局提交的可放行范围。
- 全量测试中已有 1 项数据库安全集成测试按既有配置跳过，未将其计入本次通过项。
- 主机未暴露 `npm`；已以项目本地运行时的等价命令完成所有可运行验证。

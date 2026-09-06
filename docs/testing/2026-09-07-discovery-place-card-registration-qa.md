# 发现页 place-card 注册独立测试验收记录

- 角色：独立测试负责人（与开发和代码审查角色分离）
- 日期：2026-09-07（Asia/Shanghai）
- 被测 Git commit：`6cea8f8d7a92fc4137578d97aba40ac889707b59`（`fix: register discovery place cards`）
- 范围：发现页加载到地点数据时所用的 `place-card` 自定义组件注册。未修改应用代码之外的云端配置、数据、权限、密钥或环境变量。

## 实际执行项

| 命令 | 实际结果 |
| --- | --- |
| `node .local-tools/package/bin/npm-cli.js run test` | 通过：27 个测试文件通过、1 个集成测试文件跳过；245 个测试通过、1 个跳过。`tests/unit/place-pages.test.ts` 4 个用例全部通过，包含本提交新增的组件注册断言。首次受限沙箱运行时 Vitest/esbuild 创建子进程被拒绝（`spawn EPERM`）；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run lint` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run build` | 通过：`Build ready: dist/ (development)`。首次受限沙箱运行因 esbuild 子进程 `spawn EPERM` 失败；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run check:package` | 通过：客户端路由、资源和边界检查通过。 |
| `node .local-tools/package/bin/npm-cli.js run verify:docs` | 通过：验证 31 份文档。 |
| `git diff --check 6cea8f8^..6cea8f8` | 通过：无空白错误。 |

## 独立复核证据

- `miniprogram/pages/discover/index.wxml` 在异步状态为 `ready` 时使用 `<place-card>` 循环渲染地点列表；本提交在同页 `index.json` 的 `usingComponents` 中新增了 `"place-card": "/components/place-card/index"`，路径与组件目录一致。
- 新增 `tests/unit/place-pages.test.ts` 用例实际解析发现页 JSON，并断言 `usingComponents` 含精确的 `place-card` 注册路径；该测试随完整套件通过。
- 被测差异仅包含发现页组件注册及对应自动化覆盖；未触及地点云函数、Dify、数据库权限、地点数据、环境变量或密钥。

## 缺陷与结论

未发现本地自动化、类型、静态检查、构建或包边界中的阻断缺陷。

### 放行范围

放行本地构建范围：发现页在地点数据处于就绪状态时可解析并渲染其声明的 `place-card` 自定义组件，不会因页面配置缺失组件注册而导致列表卡片渲染失败。

## 未测项与限制

- 未在微信开发者工具模拟器、Android 或 iPhone 真机验证实际编译、组件渲染、图片加载、卡片点击详情或滚动分页。
- 未调用真实 `placeService` 或读取真实 `places` 数据；云函数部署、网络失败和 `published` 筛选不在本提交的独立验收范围。
- 未更改或验证 Dify、云数据库权限、密钥、环境变量或地点数据。

# placeService 云函数部署包独立测试验收记录

- 角色：独立测试负责人（与开发和代码审查角色分离）
- 日期：2026-09-06（Asia/Shanghai）
- 被测 Git commit：`0b62ec67af3f8fbe71555a3c10960095f61699f8`（`fix: declare place service cloud dependency`）
- 范围：为 `placeService` 部署包声明 CloudBase 服务端 SDK，以及相应的构建边界自动化覆盖；后附 2026-09-07 的独立云端部署与一次只读列表调用核验。未修改云端配置。

## 实际执行项

| 命令 | 实际结果 |
| --- | --- |
| `node .local-tools/package/bin/npm-cli.js run test` | 通过：27 个测试文件通过、1 个集成测试文件跳过；243 个测试通过、1 个跳过。新增部署包断言位于 `tests/unit/build.test.ts`，该文件 44 个用例全部通过。首次受限沙箱执行时 Vitest/esbuild 创建子进程被拒绝（`spawn EPERM`）；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run lint` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run build` | 通过：`Build ready: dist/ (development)`。首次受限沙箱执行同样因 esbuild 子进程 `spawn EPERM` 失败；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run check:package` | 通过：客户端路由、资源和边界检查通过。 |
| `node .local-tools/package/bin/npm-cli.js run verify:docs` | 通过：验证 29 份文档。 |
| `git diff --check 0b62ec6^..0b62ec6` | 通过：无空白错误。 |

## 独立复核证据

- `cloudfunctions/placeService/package.json` 是独立可部署云函数目录的包清单，声明 `wx-server-sdk` 精确版本 `4.0.2`；该依赖与既有 `aiService` 云函数清单保持一致。
- 新增 `tests/unit/build.test.ts` 用例实际读取该清单，并断言依赖对象精确等于 `{ "wx-server-sdk": "4.0.2" }`，避免部署包遗漏运行时 SDK 或引入额外依赖。
- 被测差异仅新增该包清单和自动化断言；未触及 Dify 实现、密钥、环境变量、云数据库权限、地点数据或小程序前端行为。

## 缺陷与结论

未发现本地自动化、类型、静态检查、构建、客户端包边界或文档检查中的阻断缺陷。

### 放行范围

放行本地部署包准备范围：构建产物中的 `placeService` 云函数具备明确的 `wx-server-sdk@4.0.2` 运行时依赖，并由自动化测试覆盖。该结论不等同于函数已上传、安装依赖、部署或在当前微信云环境成功调用。

## 云端部署验证（2026-09-07，独立复验）

- 对应代码提交：`0b62ec67af3f8fbe71555a3c10960095f61699f8`（`fix: declare place service cloud dependency`）。
- 已在 CloudBase 控制台独立查看开发环境 `yichang-dev-d3glky2csb41de48e` 的函数详情：`placeService`（`lam-nv3neuip`）状态为“正常”，运行环境为 Node.js 20.19；控制台显示上次部署时间为 2026-09-07 00:07:48，且提示“与已部署代码一致”。在线代码工作区中可见 `node_modules` 与 `package.json`。
- 在控制台测试面板仅执行一次非写入调用：`{"action":"list","category":"scenic","pageSize":1}`。结果为成功，返回 `code: "OK"`、一条 `scenic` 地点（“185平台”）和 `nextCursor`；响应的 `isFavorite` 为 `false`，未触发用户记录或地点数据写入。请求运行时间 378 ms，内存使用 28.67 MB。
- 该结果独立确认已部署函数可连接真实 `places` 数据并完成景区分类读取。测试过程中未上传代码、未部署新版本、未更改 Dify、环境变量、密钥、云数据库权限或地点数据。

### 云端验证结论与限制

在上述当前开发环境中，`placeService` 已部署且景区列表读取可用。此验证仅覆盖单次 `scenic` 列表读取；其余三个分类、详情 `sections`/`sources`、`published` 过滤的反例、分页、云存储临时 URL、网络错误、小程序前端实际调用及 Android/iPhone 真机体验仍未由本独立测试角色复验。

## 未测项与限制

- 已完成一次控制台只读 `scenic` 列表调用，但未由本角色执行上传/部署动作，亦未验证云端依赖安装过程。
- 未独立复验其余分类、真实 `place_contents`、`published` 筛选反例、云存储临时 URL 或数据库权限配置。
- 未在模拟器、Android 或 iPhone 真机验证地点列表。
- 工作区已有的无关未提交项（`project.config.json`、`.pnpm-store/`、技术设计草稿及 Python 缓存）保持未动，未纳入本次验收范围。

# 地点收藏状态降级独立测试验收记录

- 角色：独立测试负责人（与开发和代码审查角色分离）
- 日期：2026-09-07（Asia/Shanghai）
- 被测 Git commit：`4b42ffd7da181f2050a40c0b73d0f33307222e80`（`fix: keep public places readable without favorites`）
- 范围：当可选的用户收藏状态查询失败时，已发布公共地点列表仍可读取，并统一返回 `isFavorite: false`。未修改或测试云端数据、权限、密钥或环境配置。

## 实际执行项

| 命令 | 实际结果 |
| --- | --- |
| `node .local-tools/package/bin/npm-cli.js run test` | 通过：27 个测试文件通过、1 个集成测试文件跳过；244 个测试通过、1 个跳过。`tests/unit/place-service.test.ts` 8 个用例全部通过，包含本提交新增的收藏状态异常降级用例。首次受限沙箱运行时 Vitest/esbuild 创建子进程被拒绝（`spawn EPERM`）；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run lint` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run build` | 通过：`Build ready: dist/ (development)`。首次受限沙箱运行因 esbuild 子进程 `spawn EPERM` 失败；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run check:package` | 通过：客户端路由、资源和边界检查通过。 |
| `node .local-tools/package/bin/npm-cli.js run verify:docs` | 通过：验证 30 份文档。 |
| `git diff --check 4b42ffd^..4b42ffd` | 通过：无空白错误。 |

## 独立复核证据

- `handlePlaceRequest` 的 `withFavorites` 仅处理个性化收藏元数据：当 `favoritePlaceIds` 抛出异常时捕获错误并保留空集合；随后把每项 `isFavorite` 计算为 `false`。公共地点 repository 查询仍在该逻辑之前/之外执行，不会因收藏元数据服务不可用而中断。
- 新增单测将 `favoritePlaceIds` 注入为抛出 `favorites unavailable` 的函数，调用 `list` 后实际断言响应仍为 `OK`，并包含 `scenic` 已发布地点且 `isFavorite: false`。
- 函数的 `detail` 分支也复用同一 `withFavorites` 辅助逻辑；因此代码路径同样具备该降级行为，但本提交新增自动化用例仅直接覆盖 `list` 分支。
- 被测差异仅涉及地点云函数的可选收藏元数据失败处理及单测；未触及 Dify、环境变量、密钥、云数据库权限或地点数据。

## 缺陷与结论

未发现本地自动化、类型、静态检查、构建或包边界中的阻断缺陷。

### 放行范围

放行本地可运行范围：收藏状态读取临时失败时，已发布公共地点列表不会因该个性化元数据失败而变为错误或空白，条目以“未收藏”安全降级。该结论不代表真实云函数、真实用户收藏数据或前端页面已在真机完成验证。

## 未测项与限制

- 未在 CloudBase 执行真实收藏查询失败场景；未改变或检查 `favorites` 集合数据、数据库权限或用户隔离。
- 新增自动化用例只直接覆盖列表；详情分支通过共享辅助函数获得同一逻辑，但未新增专门的详情异常断言。
- 未在微信开发者工具、Android 或 iPhone 真机验证收藏按钮、列表显示或重试体验。
- 未运行 Dify 相关真实调用，未读取或变更任何 Dify、环境变量、密钥或云端配置。

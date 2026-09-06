# 有封面地点优先排序独立测试验收记录

- 角色：独立测试负责人（与开发和代码审查角色分离）
- 日期：2026-09-07（Asia/Shanghai）
- 被测 Git commit：`69321248c92a1540012f2e651ce60314536d088b`（`fix: prioritize places with covers`）
- 范围：地点列表中有封面的已发布地点优先显示；无封面地点仍通过分页可达；既有分类、关键字、标签与游标行为保持。未修改应用代码、云端数据、配置或用户已有文件。

## 实际执行项

| 命令 | 实际结果 |
| --- | --- |
| `node .local-tools/package/bin/npm-cli.js run test` | 通过：28 个测试文件通过、1 个集成测试文件跳过；250 个测试通过、1 个跳过。`tests/unit/place-service.test.ts` 9 个用例全部通过，包含本提交新增的封面优先/跨页可达用例。首次受限沙箱运行时 Vitest/esbuild 创建子进程被拒绝（`spawn EPERM`）；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run lint` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run build` | 通过：`Build ready: dist/ (development)`。首次受限沙箱运行因 esbuild 子进程 `spawn EPERM` 失败；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run check:package` | 通过：客户端路由、资源和边界检查通过。 |
| `node .local-tools/package/bin/npm-cli.js run verify:docs` | 通过：验证 34 份文档。 |
| `git diff --check 6932124^..6932124` | 通过：无空白错误。 |

## 独立复核证据

- 排序发生在 `matches(document, input)` 之后，因此分类、关键字和标签筛选仍先排除不匹配或非 `published` 的地点；本提交没有改变筛选谓词或数据库读取条件。
- 新排序仅根据非空字符串 `coverFileId` 把有封面地点排在前面；相同封面状态下仍使用原有的 `name + _id` 稳定次序。
- 游标编码与解码仍是名称和 ID 的二元键，并在已排序数组中定位后续起点；本提交未改变游标格式、合法性校验或分页切片逻辑。
- 新增用例以页大小 1 依次读取一条有封面地点和两条无封面地点，实际断言有封面地点优先、两条无封面地点仍分别出现在第二与第三页，且最后一页 `nextCursor` 为 `null`。
- 既有用例实际覆盖分类、关键字、标签组合筛选、草稿排除、分页跨数据库批次和篡改游标拒绝；完整套件通过。

## 缺陷与结论

未发现本地自动化、类型、静态检查、构建、包边界或文档检查中的阻断缺陷。

### 放行范围

放行本地可运行范围：已发布地点会在相同筛选结果中按“有封面优先、名称与 ID 稳定排序”显示；无封面地点不被过滤，仍可通过连续分页获取；既有筛选与游标格式保持不变。

## 未测项与限制

- 未调用真实 `placeService` 或读取真实云端地点数据；未验证当前封面临时 URL 可用性、真实数据排序或网络错误。
- 未在微信开发者工具、Android 或 iPhone 真机验证列表首屏、滚动分页、图片加载或分类切换体验。
- 未验证一个在旧排序下签发、跨本次部署后继续使用的历史分页游标；常规同一排序版本内的游标分页已由自动化覆盖。
- 未修改或验证 Dify、云端配置、数据库权限、密钥、环境变量或用户数据。

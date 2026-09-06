# 用户提供地点图片绑定交付前独立测试验收记录

- 角色：独立测试负责人（与开发和代码审查角色分离）
- 日期：2026-09-07（Asia/Shanghai）
- 被测实现基线：`1a48d1ef55afeb23ecac78528dec8421f58b6b7b`（`docs: fix image binding preflight formatting`）；功能实现来自其祖先 `5c0aa24`（`feat: prepare user-provided image binding import`）、清单保护测试 `8f986ea`（`test: protect user-provided place image manifest`）和前置核对记录 `dcdb0b8`。
- 范围：25 条用户提供图片映射的本地清单保护、绑定生成器、重跑去重、前置核对记录与交付检查。未执行云端写入、未修改应用代码、云数据、权限、密钥或环境变量。

## 实际执行项

| 命令 | 实际结果 |
| --- | --- |
| `node .local-tools/package/bin/npm-cli.js run test` | 通过：28 个测试文件通过、1 个集成测试文件跳过；249 个测试通过、1 个跳过。`featured-image-manifest` 的 5 个用例和 `user-provided-image-binding` 的 3 个用例均通过。首次受限沙箱运行时 Vitest/esbuild 创建子进程被拒绝（`spawn EPERM`）；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run lint` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run build` | 通过：`Build ready: dist/ (development)`。首次受限沙箱运行因 esbuild 子进程 `spawn EPERM` 失败；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run check:package` | 通过：客户端路由、资源和边界检查通过。 |
| `node .local-tools/package/bin/npm-cli.js run verify:docs` | 通过：验证 33 份文档（本验收记录新增前）。 |
| `git diff --check 8f986ea^..dcdb0b8` | **失败**：前置核对记录的日期行有一处尾随空格。详见 P2-01。 |

## 独立复核证据

- 清单测试实际读取 `content/featured-place-images.json`，断言严格为 25 条、全部 `user_provided`、四类均覆盖，且每条恰有 3 个不重复的对象名；校验器也通过。生成器仅遍历此清单，因此输出范围仅为这 25 条目标。
- 绑定生成器为每条目标将第 1 个对象映射到 `coverFileId`，将第 2、3 个对象按固定顺序添加为详情图片节；单测断言原有文字节仍保留。
- 重跑逻辑只过滤当前目标的两条详情图片文件标识，保留原有文字和无关图片，再追加两条当前目标图片；对应单测实际覆盖该去重行为。
- 生成器在输出前校验地点 ID、`status === "published"`、分类、GCJ-02 坐标系和配对详情文档，任何不符合条件的目标都会中止生成。前置记录报告清单、对象、地点和详情均已完成数量级核对；本角色未重新执行云端读取或写入。
- 当前 `placeService` 契约与生成字段一致：封面与详情图片仅接受 `cloud://` 文件标识并在服务端解析临时 URL，详情页仅在获得 URL 时渲染图片。

## 缺陷与结论

### P2-01：前置记录存在尾随空格，导致差异空白检查失败

`docs/testing/2026-09-07-user-provided-image-binding-preflight.md` 的日期行末尾包含空格；`git diff --check 8f986ea^..dcdb0b8` 因此失败。

影响：不影响图片绑定生成器或自动化运行结果，但不满足项目“交付前相关检查均通过”的纪律。应由开发/文档负责人删除该尾随空格后，重新执行差异空白检查和文档验证；本独立测试角色未修改该文件。

### P2-01 复验结果：已修复

被测提交 `1a48d1e` 仅移除了该日期行的尾随空格。独立实际执行 `git diff --check 8f986ea^..1a48d1e`，结果通过；随后执行 `node .local-tools/package/bin/npm-cli.js run verify:docs`，结果通过（验证 34 份文档）。未发现新的文档格式或引用问题。

### 放行结论

生成器、清单保护、可重跑去重、本地构建范围以及 P2-01 的文档格式复验均通过，**放行本地图片绑定准备范围**。该放行不等同于云端导入或小程序真机体验通过。

## 未测项与限制

- 未执行 CloudBase 生成包导入或任何数据库/云存储写入；未独立复核 25 条云端封面、两张详情图片、原文保留或非目标地点未改。
- 未在微信开发者工具、Android 或 iPhone 真机验证四类列表封面、详情图片加载或卡片跳转。
- 前置记录的云端核对结论在本次验收中仅作文件审查；未由本角色重新调用云端资源。
- 未改动或验证 Dify、环境变量、密钥、云数据库权限或用户数据。

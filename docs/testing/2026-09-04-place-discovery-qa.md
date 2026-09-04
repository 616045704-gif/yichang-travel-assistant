# 地点列表与详情独立测试验收记录

- 角色：独立测试负责人（与开发、自审角色分离）
- 日期：2026-09-04（Asia/Shanghai）
- 被测提交（首轮）：`edf4a782bf6ea4c39e800ecf9a6cc6304b3e52b0`（`fix: harden place query and detail media handling`）
- 被测提交（最终复验）：`cd37cf8`（`test: cover place service response envelopes`）
- 包含的功能提交：`9a06260 feat: add cloud-backed place discovery and detail`（已确认是最终复验提交的祖先）
- 范围：发现页的四分类、关键字/标签筛选、分页与图文详情；`placeService` 的公开地点读取、发布状态过滤和云存储临时图片 URL。未测试收藏、地图附近、用户记录、AI 或真实部署。

## 实际执行项

| 命令 | 实际结果 |
| --- | --- |
| `node .local-tools/package/bin/npm-cli.js run test` | 通过：10 个测试文件、57 个测试全部通过。首次在受限沙箱运行时，Vitest/esbuild 启动子进程被拒绝（`spawn EPERM`）；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run lint` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run build` | 通过：`Build ready: dist/ (development)`。首次受限沙箱运行因 esbuild 子进程 `spawn EPERM` 失败；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run check:package` | 通过：客户端路由、资源和边界检查通过。 |
| `node .local-tools/package/bin/npm-cli.js run validate:content` | 通过：4 个地点、4 份详情资料有效。 |
| `node .local-tools/package/bin/npm-cli.js run verify:docs` | 通过：验证 9 份文档。 |
| `git diff --check edf4a78^..edf4a78` | 通过：无空白错误。 |

## 最终复验（`cd37cf8`）

| 命令 | 实际结果 |
| --- | --- |
| `node .local-tools/package/bin/npm-cli.js run test` | 通过：11 个测试文件、60 个测试全部通过，其中新增 `tests/unit/place-service-entry.test.ts` 的 3 个用例全部通过。因 Vitest/esbuild 需要子进程，按权限流程在受限环境外执行。 |
| `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run lint` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run build` | 通过：`Build ready: dist/ (development)`；按权限流程在受限环境外执行。 |
| `node .local-tools/package/bin/npm-cli.js run check:package` | 通过：客户端路由、资源和边界检查通过。 |
| `node .local-tools/package/bin/npm-cli.js run validate:content` | 通过：4 个地点、4 份详情资料有效。 |
| `node .local-tools/package/bin/npm-cli.js run verify:docs` | 通过：验证 10 份文档。 |
| `git diff --check cd37cf8^..cd37cf8` | 通过：无空白错误。 |

## 独立复核证据

- 四分类资料契约：`tests/unit/content-validation.test.ts` 断言种子资料含 `scenic`、`restaurant`、`culture`、`camping` 四类；共享契约 `CATEGORIES` 提供对应中文标签。
- 搜索/筛选：`tests/unit/place-service.test.ts` 覆盖分类、名称/别名关键字和标签的组合筛选；`tests/unit/place-pages.test.ts` 覆盖关键字去空白及切换分类时重置游标。
- 分页：`tests/unit/place-service.test.ts` 覆盖多页读取、跨越数据库单批次、篡改游标拒绝；前端视图模型覆盖重试时不追加重复项。
- 竞态：`tests/unit/place-pages.test.ts` 覆盖旧筛选请求的迟到响应不会覆盖新筛选结果。
- 仅已发布：`tests/unit/place-service.test.ts` 断言列表不泄露草稿地点，未知或未发布的详情返回 `null`。
- 图片临时 URL：`tests/unit/place-storage.test.ts` 覆盖合法图片 section 才附加云存储临时 URL；详情页模板仅对有 URL 的图片渲染图片元素。
- 页面接入：发现页经 `miniprogram/services/places.ts` 调用 `placeService`，并以 `placeId` 跳转同一详情页；详情页通过 `getPlaceDetail` 读取服务端结果。包检查已通过，地点内容没有写入发现页或详情页模板。

## 缺陷与结论

### P1-01：`placeService` 边界响应缺少直接自动化覆盖

未找到直接调用 `cloudfunctions/placeService/index.ts` 的自动化用例。因此下列已实现的服务边界未被本次测试套件实际验证：

- 非法列表入参返回 `INVALID_INPUT`（非法分类、超长关键字、非法标签、非法/篡改游标、越界页大小）；
- 详情页未知或未发布地点经服务入口返回 `NOT_FOUND`（当前仅 repository 层断言返回 `null`）；
- 合法详情经服务入口合并封面和 section 临时 URL 后返回 `OK`。

首轮严重度：P1（本需求明确要求上述行为具有自动化覆盖；当时未发现实际运行时错误，但不能以实现阅读替代测试证据）。

### P1-01 复验结果：已修复

最终提交新增 `tests/unit/place-service-entry.test.ts`，经实际运行验证：

- 非法 `list` 标签输入映射为公开 `INVALID_INPUT` 信封；
- 缺失详情映射为不泄露数据库错误的 `NOT_FOUND` 信封；
- 合法详情仅返回解析后的封面和 section 临时媒体 URL，并映射为 `OK`。

该测试通过可注入的 repository 与 storage 适配器直接覆盖服务边界；P1-01 已关闭。

## 放行范围

本次放行“地点列表与详情”的本地可运行范围：四分类资料契约、搜索/标签筛选、分页、防止筛选竞态覆盖、仅返回 `published` 地点、非法列表入参错误信封、未知/未发布详情的 `NOT_FOUND`、详情图片临时 URL、页面调用链、构建与客户端包边界，均已在最终提交 `cd37cf8` 上独立复验通过。

该放行仅针对本地自动化和构建范围，不等同于真实云数据库、云存储或真机验收通过。

## 未测项与限制

- 未部署/连接真实微信云数据库、云函数或云存储；未验证真实临时 URL 时效、权限和网络失败。
- 未在 Android 或 iPhone 真机、微信开发者工具模拟器中运行；未验证真实点击、图片加载、滚动分页和小程序路由体验。
- 内容校验只覆盖当前 4 条合成草稿资料，不代表首版 20–30 条已核验、可发布的地点资料。
- 本范围不包含地图附近定位与授权/拒绝、收藏和浏览记录隔离、AI 调用、Dify、部署或体验二维码。

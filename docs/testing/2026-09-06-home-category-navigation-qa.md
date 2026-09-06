# 首页地点分类卡片独立测试验收记录

- 角色：独立测试负责人（与开发和代码审查角色分离）
- 日期：2026-09-06（Asia/Shanghai）
- 被测 Git commit：`d070a77f8d0f68147e64f6aabd707b40f020bfc8`（`fix: activate homepage place category cards`）
- 范围：首页“景区、餐馆、文化馆/博物馆、露营地”四张分类卡片到发现页的分类筛选传递。未测试地点云函数部署、真实云数据库数据、Dify、地图、收藏和用户记录。

## 实际执行项

| 命令 | 实际结果 |
| --- | --- |
| `node .local-tools/package/bin/npm-cli.js run test` | 通过：27 个测试文件通过、1 个集成测试文件跳过；242 个测试通过、1 个跳过。首次受限沙箱执行时，Vitest/esbuild 创建子进程被拒绝（`spawn EPERM`）；按权限流程在受限环境外复跑后通过。测试输出的 `ai-service` 错误日志为已有失败路径测试的预期日志，套件结果为通过。 |
| `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run lint` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run build` | 通过：`Build ready: dist/ (development)`。首次受限沙箱执行同样因 esbuild 子进程 `spawn EPERM` 失败；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run check:package` | 通过：客户端路由、资源和边界检查通过。 |
| `node .local-tools/package/bin/npm-cli.js run verify:docs` | 通过：验证 28 份文档。 |
| `git diff --check d070a77^..d070a77` | 通过：无空白错误。 |

## 独立复核证据

- 共享分类契约 `shared/contracts.ts` 明确给出四个值：`scenic`（景区）、`restaurant`（餐馆）、`culture`（文化馆/博物馆）和 `camping`（露营地）。首页使用该契约循环渲染四张卡片。
- `miniprogram/pages/home/index.wxml` 的分类卡片循环项同时包含 `data-category="{{item.value}}"` 与 `bindtap="onCategoryTap"`；每张已渲染卡片均因此携带自身分类并绑定同一点击处理器。
- `miniprogram/pages/home/index.ts` 仅接受上述共享契约中的合法分类；合法点击将分类写入临时全局状态 `pendingDiscoverCategory`，再使用 `wx.switchTab` 打开 `/pages/discover/index`。未知值会被忽略，不发生跳转。
- `miniprogram/pages/discover/index.ts` 的 `onShow` 读取该临时状态、立即清空，并调用 `viewModel.setFilters({ category })` 后同步页面状态；因此切换发现页时会按被点击分类请求列表，而不会把该筛选意外保留给后续普通进入。
- `tests/unit/navigation.test.ts` 实际覆盖首页分类卡片的合法分类（`culture`）会写入临时全局状态并切换到发现页，同时断言模板含事件与数据属性；通用合法性校验依赖同一份四类 `CATEGORIES` 契约。测试套件已实际通过。
- 本提交差异仅涉及 `miniprogram/app.ts`、首页/发现页的分类状态传递及其单测；未触及 `cloudfunctions/ai/**`、`aiService`、Dify 配置、环境变量文件、云数据库权限或地点数据。构建与客户端边界检查均通过。

## 缺陷与结论

未发现本地自动化、类型、静态检查、构建或包边界中的阻断缺陷。

### 放行范围

放行被测提交的本地可运行范围：首页四张地点分类卡片均可把对应分类带入发现页，发现页会以该分类刷新数据；普通“去发现宜昌”入口仍直接切换发现页。该结论不代表云函数部署、真实云数据读取或真机交互已经完成验收。

## 未测项与限制

- 未在微信开发者工具模拟器、Android 或 iPhone 真机中实际点击验证；因此未覆盖小程序运行时的 tab 切换、生命周期和视觉/无障碍表现。
- 未部署或调用真实 `placeService` 云函数，未读取真实 `places` 集合，未核验 `published` 地点、网络异常或云端权限。
- 未核验当前开发者工具选择的云环境，也未变更 Dify、环境变量、密钥、云数据库权限或地点数据。
- 工作区在验收前已存在无关未提交项：`project.config.json`、`.pnpm-store/`、技术设计草稿和 Python 缓存；本次未修改、未纳入被测提交或本验收范围。

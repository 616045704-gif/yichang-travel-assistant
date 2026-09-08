# 首页、发现页与地图视觉调整独立验收记录

- 测试角色：独立测试
- 被测提交：`b911a5df319e534c995ca9c7b2f62e8ab314cce2`
- 对照基线：`2398320`
- 日期：2026-09-08
- 测试范围：首页、发现页、地图页、共享分类筛选与地点卡的本轮视觉调整；不包含云端数据、Dify 或真机验收。

## 自动化与构建检查

| 命令 | 结果 | 实际证据/备注 |
| --- | --- | --- |
| `node .local-tools\package\bin\npm-cli.js test` | 通过 | 29 个测试文件通过、271 项断言通过；1 项数据库集成测试按配置跳过。AI 服务失败路径输出的 `stderr` 是对应安全失败断言的预期日志。 |
| `node .local-tools\package\bin\npm-cli.js run typecheck` | 通过 | `tsc --noEmit` 退出码 0。 |
| `node .local-tools\package\bin\npm-cli.js run lint` | 通过 | `eslint .` 退出码 0。 |
| `node scripts\build.mjs --mode=development` | 通过 | 输出 `Build ready: dist/ (development)`。 |
| `node scripts\check-package.mjs` | 通过 | 输出 `Client routes, resources and boundary verified`。 |
| `node .local-tools\package\bin\npm-cli.js run verify:docs` | 通过 | 在写入本记录前实际校验 51 份文档。 |
| `git diff --check 2398320..b911a5d` | 通过 | 无空白错误输出。 |

## 范围与边界复核

- `2398320..b911a5d` 的应用改动仅涉及派生静态资源、首页/发现/地图 WXSS/WXML、共享分类筛选和地点卡，以及与展示适配直接相关的 `category-filter` 索引映射、`TravelMarker` 图标/callout 字段和测试。
- 该范围未修改 `cloudfunctions/`、`shared/` 合约、`miniprogram/services/`、任何页面 `index.ts`、`app.json` 路由或 `project.config.json`。
- 分类组件仍发出原名 `categorychange`，并将 picker 索引映射回既有五个类别值；共享地点卡仍发出 `open` 与 `favoritechange`；地图仍使用既有 `onMarkerTap`、`selectedPlace`、`openSelectedPlace` 与定位入口。
- 完整测试、包体边界检查及导航测试均通过；本次没有证据显示新增云函数、Dify 调用、数据库字段、接口或页面路由。

## 开发者工具截图复核

已审查忽略目录 `.local/ui-qa/2026-09-08/` 中的前后截图。以下为截图证据的视觉复核，不将其表述为独立现场操作或真机结果。

| 截图/页面 | 结果 | 实际观察 |
| --- | --- | --- |
| `before-home.png` → `after-home.png` | 通过 | 首页头图内的旧白色“浏览所有地点”胶囊已替换为居中的紫色“出发吧”；两张 AI 图片卡完整展示，未见重复代码标题；分类标题和紫色标记可见，四列分类未重叠。 |
| `after-home-list.png` | 通过 | 地点大图右上仍有类型标签；黑色粗体地点名位于图片下方；收藏图标与“收藏/已收藏”位于标题下独立区域，未覆盖图片、标签或名称。 |
| `before-discover.png` → `after-discover.png` | 通过 | 发现头图视觉高度增大；分类选择框与搜索框同一行；地点列表使用与首页一致的大图、标签、名称和标题下收藏结构。 |
| `before-map.png` → `after-map.png` | 通过 | 地图顶部已从多枚分类胶囊转为单个分类选择框；地图使用统一的填充式紫色点位，截图中未见原生文字 callout。 |
| `after-map-card.png` | 通过 | marker 弹卡包含本地默认旅行图、分类、地点名称和“查看详情”；弹卡与地图控件之间未见可见重叠。 |

## 缺陷与未测项

### 缺陷

- 本次可测范围未发现阻断或高优先级缺陷。

### 未测项

- 未由独立测试角色在微信开发者工具中现场操作 picker、关键词搜索、收藏、地图拖拽缩放、点位切换、定位授权/拒绝和“打开设置”流程；已审查的是开发者工具导出的截图证据。
- 未在 Android 与 iPhone 真机上验证安全区、原生 picker 样式、地图触摸、定位授权和 Tab 图标的实际显示。模拟器或截图均不等同于真机验收。
- 未执行端到端微信自动化：当前没有 `WECHAT_AUTOMATION_ENDPOINT`。
- 云端数据库、真实地点内容、收藏持久化、用户隔离、Dify 调用和真实定位不在本轮独立运行范围；数据库集成测试在全量套件中按配置跳过。

## 阶段结论

本提交在自动化、类型、Lint、开发模式构建、包体边界、源码范围以及所提供的前后截图复核范围内通过，可作为前端视觉调整的阶段性放行版本。真机、真实云端及现场交互未测，不构成完整体验版或发布验收结论。

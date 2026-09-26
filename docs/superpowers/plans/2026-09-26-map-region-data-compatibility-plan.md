# 地图区域数据兼容修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use systematic debugging and test-driven development; complete independent review before implementation and independent QA before delivery.

**Goal:** 让真实云数据库地点在手动选择宜昌区域后正确显示，并兼容尚未返回 `district` 的旧版 marker 接口。

**Architecture:** 区域名称在地图 view-model 边界统一规范化，不改写现有 387 条云数据；地点客户端优先使用轻量 marker 接口，发现旧响应缺少 `district` 时分页读取既有 list 接口补全。云函数 marker 契约继续显式返回 `district`，部署时单独更新 `placeService`。

**Tech Stack:** 微信小程序、TypeScript、微信云函数、Vitest。

## Global Constraints

- 不恢复或调用 `wx.getLocation`，不新增位置权限。
- 不修改 AI 问答、收藏、浏览记录及其他正常功能。
- 地点仍来自云数据库，不在前端硬编码地点内容。
- 应用代码必须有自动化测试、独立代码审查和独立测试记录。

---

### Task 1: 真实区域值兼容

**Files:**
- Modify: `miniprogram/view-models/map.ts`
- Modify: `tests/unit/map-state.test.ts`

**Interfaces:**
- Consumes: 云数据库返回的 `district: string`
- Produces: `normalizeDistrict(district: string): string` 与兼容真实导入格式的 `filterPlacesByRegion`

- [ ] 增加测试，证明 `宜昌市 / 西陵区`、`宜昌市 / 宜昌市区`、`宜昌市 / 长阳县`、`宜昌市 / 五峰县` 能命中对应区域。
- [ ] 运行定向测试并确认修复前失败。
- [ ] 在筛选边界做严格的宜昌前缀与分隔符规范化，并补城区别名。
- [ ] 运行定向测试确认通过。

### Task 2: 旧 marker 接口兼容与契约

**Files:**
- Modify: `miniprogram/services/places.ts`
- Modify: `cloudfunctions/places/repository.ts`
- Modify: `tests/unit/place-client.test.ts`
- Modify: `tests/unit/place-service.test.ts`

**Interfaces:**
- Consumes: 新版 `{ items: PlaceMarker[] }` 或缺少 `district` 的旧版 marker 响应
- Produces: 始终带合法 `district` 的 `PlaceMarker[]`

- [ ] 增加旧 marker 缺 `district` 时回退 list 分页补全的客户端测试。
- [ ] 增加 marker 云函数响应包含 `district` 的精确契约断言。
- [ ] 运行定向测试并确认至少旧响应兼容测试失败。
- [ ] 实现 marker 运行时校验与 list 分页回退，不吞掉服务错误。
- [ ] 运行定向测试、全量单元测试、类型检查、静态检查、构建与包检查。
- [ ] 由独立测试角色复验并记录被测 commit、结果、缺陷和未测项。

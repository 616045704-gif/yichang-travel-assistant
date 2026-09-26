# 地图区域数据兼容独立测试验收记录

## 被测范围与基线

- 测试角色：独立测试负责人（未参与本次应用代码实现）。
- 测试日期：2026-09-26。
- 被测 Git `HEAD`：`90747bb2a31665eb9758bbff866190dd899cc2bc`。
- 工作区状态：被测内容为相对上述 `HEAD` 的未提交改动；本记录不把它描述为已提交版本。
- 被测范围：移除定位与位置权限、地图手动区域筛选、真实 `district` 格式规范化、新旧 marker 接口兼容及缺少 `district` 时回退分页 list。
- 数据样本：只读核对 `.local/import/places.json`，不改写本地导入数据。

## 阶段结论

**自动化与本地构建范围阶段通过。** 定向测试 30/30 通过；全量测试在把临时目录切换到项目内后可确认 273 个非跳过用例全部通过，另有 1 个云数据库安全集成用例按设计跳过。类型检查、ESLint、演示包构建、包边界、内容、文档及差异格式检查均通过。387 条导入地点全部带 `district`，原始区域值均能归入当前十个手动选择区域，城区合计 83 条。

本结论不是完整发布验收。云端 `placeService` 部署、真实云数据库查询、微信开发者工具体验版、Android/iPhone 真机交互均未验证；现有全局覆盖率阈值也仍未达到。

## 实际执行项与结果

| 执行项 | 结果 | 证据摘要 |
| --- | --- | --- |
| `node node_modules/vitest/vitest.mjs run tests/unit/map-state.test.ts tests/unit/place-client.test.ts tests/unit/place-service.test.ts tests/unit/map-nearby-page.test.ts` | PASS | 4 个文件、30 个测试全部通过。覆盖真实 `宜昌市 / 区县` 格式、城区别名、区域筛选、marker 契约及旧响应回退。 |
| `node node_modules/vitest/vitest.mjs run` | 环境阻塞后隔离通过 | 首次运行：26 个文件通过、1 个文件失败、1 个文件跳过；260 通过、13 失败、1 跳过。13 个失败全部位于 `tests/unit/build.test.ts`，错误为系统 Temp 路径 `Access is denied` 和由此导致的入口文件无法解析。 |
| 设置 `TEMP`/`TMP` 为项目内临时目录后运行 `node node_modules/vitest/vitest.mjs run tests/unit/build.test.ts` | PASS | 48/48 通过；复跑结束后测试临时目录已清理。结合首次全量结果，未发现业务断言失败。 |
| `npm run typecheck` | PASS | `tsc --noEmit`，退出码 0。 |
| `npm run lint` | PASS | ESLint 退出码 0。 |
| `npm run build:demo` | PASS | 输出 `Build ready: dist/ (demo)`。 |
| `npm run check:package` | PASS | 输出 `Client routes, resources and boundary verified`。 |
| `npm run validate:content` | PASS | `4 places, 4 details` 的项目内演示内容有效。此命令不等同于下述 387 条本地导入数据统计。 |
| `npm run verify:docs` | PASS | 新增本记录前验证 60 份文档；新增后再次验证，结果见文末复核。 |
| `git diff --check` | PASS | 新增本记录前退出码 0；新增后再次检查，结果见文末复核。 |
| `rg -n "wx\\.getLocation|scope\\.userLocation|requiredPrivateInfos|定位我的附近|附近 20 公里|20公里" miniprogram cloudfunctions shared scripts --glob '!dist/**'` | PASS | 无匹配；退出码 1 表示未找到相关调用、权限或旧文案。 |

## 387 条真实区域数据只读统计

`.local/import/places.json` 为逐行 JSON。实际读取 387 个非空行，387 条均解析成功，解析错误 0 条，缺少 `district` 0 条。

| 手动选择区域 | 对应原始 `district` | 条数 |
| --- | --- | ---: |
| 城区 | `宜昌市 / 西陵区` 37、`宜昌市 / 伍家岗区` 11、`宜昌市 / 点军区` 25、`宜昌市 / 猇亭区` 3、`宜昌市 / 宜昌市区` 7 | 83 |
| 夷陵区 | `宜昌市 / 夷陵区` | 58 |
| 秭归县 | `宜昌市 / 秭归县` | 46 |
| 兴山县 | `宜昌市 / 兴山县` | 22 |
| 长阳县 | `宜昌市 / 长阳县` | 38 |
| 远安县 | `宜昌市 / 远安县` | 36 |
| 当阳市 | `宜昌市 / 当阳市` | 27 |
| 枝江市 | `宜昌市 / 枝江市` | 27 |
| 宜都市 | `宜昌市 / 宜都市` | 36 |
| 五峰县 | `宜昌市 / 五峰县` | 14 |
| 合计 | 14 种原始区域值，归并为 10 个选择区域 | 387 |

未选择区域时展示全部 387 条的行为由 `map-state` 与 `map-nearby-page` 定向测试覆盖；这里只对源数据条数和区域分布做只读核对。

## 覆盖率状态

本次独立 QA 未重复运行覆盖率命令；引用同一轮交付上下文中已完成的完整覆盖率结果：273 通过、1 跳过，测试断言全部通过，但全局覆盖率阈值未达到，分别为 statements 73.52%、branches 73.79%、functions 74.14%、lines 79.72%。因此不能把本阶段结论扩大为“所有质量门禁通过”。

## 缺陷与风险

1. **未发现本次区域兼容改动的产品功能缺陷。** 核心定向测试、旧 marker 回退和真实数据分布均符合预期。
2. **QA-ENV-01（环境，不计产品缺陷）：** Windows 沙箱禁止 esbuild 从系统 Temp 读取测试夹具，导致首次全量运行中 `build.test.ts` 13 项失败；把 Temp 定向到项目可写目录后该文件 48/48 通过。
3. **QA-GATE-01（质量门禁）：** 全局覆盖率仍低于仓库阈值。断言通过不消除该门禁，是否补齐全仓覆盖应作为独立质量任务处理。

## 未测试项

- 未部署或调用云端 `placeService`，因此未验证云函数实际发布版本是否返回 `district`。
- 未使用真实云数据库验证 387 条地点的 marker、列表、详情端到端展示。
- 未在微信开发者工具体验版中逐区域点击核对地图标记和卡片。
- 未执行 Android 与 iPhone 真机测试、安全区、触控、性能及弱网检查。
- 未验证体验版上传、扫码访问和生产云环境。
- 本次没有修改或回归 AI 问答、收藏、浏览记录等非地图业务；全量自动化测试仅提供基础回归覆盖。

## 放行范围

可放行当前未提交工作区进入主智能体整合与后续云端部署验证；不可据此宣布体验版或生产环境已完整放行。发布前至少还需部署 `placeService`、用真实云数据验证各区域非空与详情链路，并完成 Android/iPhone 真机检查。

## 记录新增后复核

- `npm run verify:docs`：PASS，61 份文档通过验证。
- `git diff --check`：PASS，退出码 0。
- QA 临时目录已清理；本测试角色只新增本记录，未修改或撤销应用代码。

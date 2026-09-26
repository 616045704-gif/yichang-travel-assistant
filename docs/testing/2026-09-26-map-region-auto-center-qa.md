# 地图区域自动跳转独立测试验收记录

## 被测范围与基线

- 测试角色：独立测试负责人（未参与本次应用代码实现）。
- 测试日期：2026-09-26。
- 被测 Git `HEAD`：`90747bb2a31665eb9758bbff866190dd899cc2bc`。
- 工作区状态：被测实现是相对上述 `HEAD` 的未提交改动，工作区同时包含此前的定位移除、手动区域筛选和真实区域数据兼容改动；本记录不把它描述为已提交版本。
- 本次验收范围：选择长阳县后的地图中心与缩放变化、选择全部地点后的默认视野恢复、分类切换和非法索引的无副作用、地图标记/列表/详情入口回归、定位 API 与位置权限残留检查。

## 阶段结论

**自动化与本地构建范围阶段通过。** 地图及相关定向测试 54/54 通过；全量测试在把 `TEMP`/`TMP` 切换到项目内可写临时目录后为 275 个通过、1 个按设计跳过。类型检查、相关 ESLint、全量 ESLint、演示包构建、包边界和差异格式检查均通过。

选择长阳县会把地图中心更新为 GCJ-02 坐标 `30.4735, 111.2075`，缩放级别从默认 `11` 更新为 `10`；选择“全部地点”会恢复宜昌默认中心和默认缩放。分类切换与非法区域索引不会改变当前区域视野，也不会触发定位调用。

本结论不是微信开发者工具或真机发布验收。地图视觉移动、固定行政区中心在腾讯地图底图上的主观位置、真实云数据标记和 Android/iPhone 真机体验仍待验证。

## 实际执行项与结果

| 执行项 | 结果 | 证据摘要 |
| --- | --- | --- |
| `npm test -- --run tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts tests/unit/navigation.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/place-client.test.ts tests/unit/place-service.test.ts` | PASS | 6 个文件、54 个测试全部通过；地图状态测试直接覆盖长阳中心/缩放、全部地点恢复、分类切换与非法索引无副作用，相关页面/导航/地点服务测试提供回归覆盖。 |
| `npm test` | 环境阻塞后复验通过 | 首次运行 262 通过、13 失败、1 跳过；13 个失败全部位于 `tests/unit/build.test.ts`，原因是受限系统 Temp 路径 `Access is denied`，地图测试均已通过。 |
| 设置 `TEMP`/`TMP` 为项目内 `.tmp-map-auto-center-qa` 后再次运行 `npm test` | PASS | 27 个文件通过、1 个文件跳过；275 个测试通过、1 个云数据库安全集成用例按设计跳过。复验后临时目录已清理。 |
| `npm run typecheck` | PASS | `tsc --noEmit`，退出码 0。 |
| `eslint miniprogram/pages/map/index.ts miniprogram/view-models/map.ts tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts` | PASS | 本次地图相关源文件与测试无 ESLint 问题。 |
| `npm run lint` | PASS | 全仓 ESLint 退出码 0。 |
| `npm run build` | PASS | 输出 `Build ready: dist/ (demo)`。 |
| `node scripts/check-package.mjs` | PASS | 输出 `Client routes, resources and boundary verified`。 |
| 检查 `dist/miniprogram/pages/map` | PASS | 构建产物包含动态 `scale="{{scale}}"`、选择区域控件，以及长阳中心 `30.4735, 111.2075` 和缩放级别 `10`。 |
| `rg` 扫描定位调用、位置权限和旧文案 | PASS | 在 `miniprogram`、`cloudfunctions`、`shared`、`scripts` 和本次 `dist/miniprogram` 中均未发现 `wx.getLocation`、`scope.userLocation`、`requiredPrivateInfos`、“定位我的附近”或“附近 20 公里”等残留。 |
| `git diff --check` | PASS | 新增本记录前退出码 0；新增后再次检查，结果见文末复核。 |

## 行为核对

| 场景 | 预期 | 结果 |
| --- | --- | --- |
| 选择长阳县 | `region`/`regionIndex` 更新，中心切换到长阳，缩放调整到县域视野 | PASS；区域为 `长阳县`、索引为 `5`、中心为 `30.4735, 111.2075`、缩放为 `10`。 |
| 选择全部地点 | 恢复默认宜昌中心与默认缩放 | PASS；恢复进入页面时的默认中心与缩放 `11`。 |
| 已选长阳后切换分类 | 只重新筛选标记，不移动区域视野 | PASS；中心与缩放保持不变。 |
| 已选长阳后传入非法索引 | 不更新区域、中心、缩放 | PASS；索引 `99` 无副作用。 |
| 定位与权限 | 不调用用户定位，不声明位置权限 | PASS；自动化替身确认 `getLocation` 未调用，源代码与构建产物扫描无定位/权限残留。 |
| 地图标记、列表和详情入口 | 原有筛选、标记映射、详情导航继续可用 | PASS；相关定向测试通过。 |

## 缺陷与风险

1. **未发现本次区域自动跳转改动的产品功能缺陷。** 自动化状态变更、回归检查和本地构建均符合预期。
2. **QA-ENV-01（环境，不计产品缺陷）：** Windows 沙箱禁止构建夹具从系统 Temp 读取文件，造成首次全量测试中 13 项构建测试失败；切换到项目内可写临时目录后全量复验通过。
3. **QA-VISUAL-01（待现场验证）：** 固定行政区中心和缩放已由状态测试验证，但本次未在微信开发者工具或真机上观察腾讯地图的实际动画/重绘效果，因此不能把自动化通过等同于视觉体验已验收。

## 未测试项

- 未在微信开发者工具中手动选择长阳县并观察地图实际平移/缩放动画、标记密度与遮挡。
- 未使用真实云数据库逐区域检查标记、地点卡片与详情数据。
- 未在 Android 与 iPhone 真机检查地图组件重绘、触控、网络延迟和安全区表现。
- 未上传体验版、扫码验证或检查生产云环境。
- 未核验固定行政区中心是否达到产品希望的视觉构图；如开发者工具中仍觉得偏移，应根据实际标记分布单独调整中心或缩放。

## 放行范围

可放行当前未提交工作区进入主智能体整合，并在微信开发者工具中进行一次长阳/全部地点的人工视觉确认；不可据此宣布体验版或真机完整放行。

## 记录新增后复核

- `npm run verify:docs`：PASS，62 份文档通过验证。
- `git diff --check`：PASS，退出码 0。
- QA 临时目录已清理；本测试角色只新增本记录，未修改或撤销应用代码与测试代码。

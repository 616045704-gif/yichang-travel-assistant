# 分类大地图 Implementation Plan

> **For agentic workers:** Use executing-plans to implement this approved adjustment in the current session.

**Goal:** 将地图页改为全幅地图与悬浮分类，并实现可接收云端地点结果的分类标记更新。

**Architecture:** 地图页面管理所选分类和公开地点数组；纯 view-model 校验并转换地点为原生地图标记。当前数组为空，真实云数据连接遵循主计划 08–10。

**Tech Stack:** 现有原生微信小程序、TypeScript、WXML、WXSS、Vitest、官方模拟器自动化。

## Global Constraints

- 地点内容必须来自云数据库，不在前端加入实际地点样例。
- 不读取或保存用户位置。
- 修改覆盖自动化测试，检查通过后独立 Git 提交。

## 任务 1：布局与标记模型

文件：修改 map 四件套、navigation.test.ts、scripts/wechat-smoke.mjs；新增 miniprogram/view-models/map.ts、tests/unit/map-state.test.ts 和原创 marker 图标；更新 UI 说明。

接口：MapPlace 仅包含 placeId、name、category、latitude、longitude、coordinateSystem；buildMarkers(places, category) 输出原生数字 ID 标记；页面 setPlaces(places) 同步当前分类的标记，onCategoryChange 重新筛选。

- [x] 写分类切换、全部恢复、稳定 ID、无效坐标、重复地点、无数据及视野不变测试，运行确认行为缺失。
- [x] 实现纯筛选转换：在全部有效地点上排序分配 ID，再按分类筛选；图标统一，点击气泡显示地点名。
- [x] 实现满高地图和顶部悬浮分类，删除卡片和说明，保留原生 tab。
- [x] 扩展模拟器检查：测地图占满内容区，注入明确标注的合成点测试实际分类事件，结束恢复空数据，不截图或发布测试点。
- [x] 运行 test、test:coverage、typecheck、lint、build、check:package、verify:docs、test:e2e 及差异检查。
- [x] 只暂存本次文件并提交 `feat: make map immersive with category marker filtering`。

纯模型验收示例：同一输入含 scenic 与 restaurant 时，buildMarkers(input, 'scenic') 只返回前者，buildMarkers(input, '') 返回两者，前者在两次输出中的 ID 相同。NaN 纬度和不支持的坐标系直接排除。

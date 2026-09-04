# 山水文旅风格 Implementation Plan

> **For agentic workers:** Use executing-plans in the current session; request code review before delivery.

**Goal:** 按用户参考统一四页国风视觉，并去掉地图分类背景板。

**Architecture:** 保留现有原生页面和状态逻辑，修改共享 tokens、WXSS、展示模板及原创资源；地图透明覆盖层与单独按钮分离。

**Tech Stack:** TypeScript、WXML、WXSS、Vitest、官方微信模拟器与内置 imagegen。

## Global Constraints

- 不添加交易、预约或假地点；装饰图不作为地点数据。
- 不读取位置，不改云端配置。
- 每项逻辑修改覆盖测试并独立提交，保留无关未跟踪文档。

## 任务 1：透明地图筛选

文件：miniprogram/pages/map/index.wxss、miniprogram/components/category-filter/index.wxss、tests/unit/visual-style.test.ts、scripts/wechat-smoke.mjs。

- [x] 添加容器透明、不整块拦截手势及按钮可接收事件的测试，运行观察失败。
- [x] 容器采用 `background: transparent; border: 0; box-shadow: none; padding: 0; pointer-events: none`，按钮采用 `pointer-events: auto`。
- [x] 模拟器读取透明样式，实际点击分类并检查 markers；测试、静态、构建、包检查通过后提交 `fix: remove map filter backdrop`。

## 任务 2：统一山水文旅视觉

文件：miniprogram/styles/tokens.wxss、app.wxss、app.json，pages/home、discover、me 的展示模板与样式，共享组件样式，assets/illustrations 与 assets/icons；tests/unit/visual-style.test.ts、scripts/wechat-smoke.mjs、docs/runbooks/ui-style.md。

- [x] 添加主题颜色与导航一致、装饰图资源有效、页面保留真实状态与免责声明的测试，运行观察失败。
- [x] 宣纸背景 #f5eddf、文字 #38382e、青绿 #627968、朱红 #a44d3e、古金 #b29a65；标题使用宋体优先字体链，正文系统字体。
- [x] 首页使用本地原创无字山水插图、宜昌标题、四分类印章和 AI 卷轴卡片；发现/我的添加同体系的标题与纸色卡片。仅改展示，不新增未就绪入口。
- [x] 将现有图标 SVG 改为古金/朱红色并导出 PNG，装饰图复制压缩至项目；记录素材来源与完整提示词。
- [x] 运行 test、test:coverage、typecheck、lint、build、check:package、verify:docs、test:e2e，检查四页截图及代码差异；请求只读审查。
- [x] 更新检查记录与计划，只提交本次文件，提交 `feat: apply ink landscape travel theme`。

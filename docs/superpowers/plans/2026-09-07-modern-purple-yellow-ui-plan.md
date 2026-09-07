# 现代紫黄 UI 改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变小程序任何业务行为、云函数、Dify 调用、数据库字段或接口的前提下，将全部页面和状态统一为现代高饱和紫黄旅行工具界面。

**Architecture:** 使用共享 WXSS 令牌和组件规范统一导航、排版、表面、按钮与状态；以项目原创 SVG/PNG 图标替换当前线性图标和字符图形；仅更改 WXML、WXSS、前端静态资源以及现有前端提示的呈现容器。原有事件绑定、条件分支、提示文案、服务调用和数据结构保持不变。

**Tech Stack:** 微信小程序 WXML/WXSS、TypeScript、SVG/PNG 静态资源、Vitest、TypeScript、ESLint、官方微信开发者工具与 miniprogram-automator。

## Global Constraints

- 只改 `miniprogram/` 的视觉、布局、原创图标和前端提示呈现；不得编辑 `cloudfunctions/`、`database/`、`shared/`、Dify 配置、环境变量、接口或数据字段。
- 不使用古风字体、印章、卷轴、宣纸、水墨图、诗句式装饰、emoji、Unicode 图形箭头，也不复制参考案例的图形、文案或资源。
- 保留所有现有事件名、跳转路径、云函数调用、位置授权时机、加载/错误条件、重试行为、收藏写入和 AI 安全提示；视觉反馈不能制造成功状态。
- 保留地点照片及其云端读取方式，不能在页面中硬编码地点资料。
- 图标必须是项目原创；源 SVG 与原生 Tab 所需 PNG 同步更新。原生 Tab 继续使用四个既有页面与路径。
- 每项应用代码或 UI 改动先写失败测试、通过相关检查后再提交；测试记录由独立测试角色在单独提交中归档。

## File Structure

| 文件/目录 | 责任 |
| --- | --- |
| `miniprogram/styles/tokens.wxss` | 唯一的紫黄颜色、排版、间距、圆角、阴影令牌 |
| `miniprogram/app.wxss`、`miniprogram/app.json` | 全局基础样式和原生导航/Tab 配色 |
| `miniprogram/assets/icons/` | 原创 SVG 与 Tab/分类/地图所需 PNG 图标 |
| `miniprogram/components/feedback-toast/` | 可主题化的成功、错误与信息提示表面；不决定任何业务结果 |
| 现有 `components/*` | 卡片、筛选、消息、来源和异步状态的一致视觉 |
| `miniprogram/pages/*/index.wxml`、`index.wxss` | 逐页现代布局，不改变绑定表达式、数据字段或导航事件 |
| 现有页面 `index.ts` | 仅把既有 `wx.showToast` 展示替换为同文案、同结果的视觉提示组件状态；不改条件、服务调用或跳转 |
| `miniprogram/view-models/map.ts` | 仅更新原生地图 marker callout 与图标的颜色/资源路径；marker 筛选、ID、坐标和数据契约不变 |
| `tests/unit/visual-style.test.ts`、`tests/unit/components.test.ts`、`tests/unit/navigation.test.ts` | 视觉资源、状态组件、Tab 和原有交互契约的回归保护 |
| `scripts/wechat-smoke.mjs` | 四个 Tab 的截图与主题化控件冒烟检查 |
| `docs/testing/2026-09-07-modern-purple-yellow-ui-qa.md` | 独立验收、逐页截图结果、缺陷和未测项 |

---

### Task 1: 建立紫黄设计令牌与原生导航外壳

**Files:**
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `miniprogram/styles/tokens.wxss`
- Modify: `miniprogram/app.wxss`
- Modify: `miniprogram/app.json`

**Interfaces:**
- Consumes: 所有页面和组件的现有 `var(--color-*)` 引用，以及 `app.json` 的四个 Tab 配置。
- Produces: `--color-brand: #623bc7`、`--color-brand-deep: #2b174d`、`--color-action: #ffc400`、`--color-surface: #ffffff`、`--color-page: #f8f6ff`、`--color-text: #30254a`、`--color-muted: #746c8b`、`--radius-card: 28rpx`、`--space-page: 32rpx`；四个原有 Tab 路径不变。

- [ ] **Step 1: 写失败的视觉规范测试。**

在 `tests/unit/visual-style.test.ts` 用以下断言替换“paper theme”断言，保留对地点图片和四个分类 PNG 可读取的检查：

```ts
expect(tokens).toContain('--color-brand: #623bc7');
expect(tokens).toContain('--color-brand-deep: #2b174d');
expect(tokens).toContain('--color-action: #ffc400');
expect(tokens).toContain('--color-page: #f8f6ff');
expect(tokens).toContain('--font-sans: -apple-system');
expect(tokens).not.toContain('--font-display:');
expect(app.window.navigationBarBackgroundColor.toLowerCase()).toBe('#2b174d');
expect(app.window.navigationBarTextStyle).toBe('white');
expect(app.tabBar.backgroundColor.toLowerCase()).toBe('#2b174d');
expect(app.tabBar.selectedColor.toLowerCase()).toBe('#ffc400');
expect(app.tabBar.list.map((tab: { pagePath: string }) => tab.pagePath)).toEqual([
  'pages/home/index', 'pages/discover/index', 'pages/map/index', 'pages/me/index',
]);
```

- [ ] **Step 2: 运行目标测试，确认它因旧宣纸/朱红令牌而失败。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/visual-style.test.ts`

Expected: FAIL，缺少 `--color-brand: #623bc7`，且原生导航仍是米色/朱红。

- [ ] **Step 3: 实现共享令牌和导航外壳。**

将 `tokens.wxss` 的古风令牌替换为上述 `Produces` 中的精确颜色，并补齐 `--color-border: #ddd5ff`、`--color-danger: #c83f56`、`--color-success: #25866c`、`--shadow-card: 0 12rpx 32rpx rgba(70, 43, 139, .10)`。在 `app.wxss` 建立无衬线 `font-family: var(--font-sans)`、雾紫页面背景、32rpx 页边距、统一标题/区块标题/说明文字、28rpx 白卡、88rpx 主次按钮和 999rpx 标签；删除 `.chapter-seal`、`.paper-rule` 及所有宋体依赖。更新 `app.json` 为深紫原生导航、白色导航文字、深紫 Tab、浅紫默认态、亮黄选中态；不调整 `pages`、`requiredPrivateInfos` 或任一 Tab 路径。

- [ ] **Step 4: 运行目标测试，确认主题与导航契约通过。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/visual-style.test.ts tests/unit/navigation.test.ts`

Expected: PASS；仍验证四个 Tab 资源与原有页面顺序。

- [ ] **Step 5: 运行基础静态检查并提交。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run typecheck`

Run: `node .local-tools\\package\\bin\\npm-cli.js run lint`

Run: `git add miniprogram/styles/tokens.wxss miniprogram/app.wxss miniprogram/app.json tests/unit/visual-style.test.ts`

Run: `git commit -m "feat: establish modern purple yellow theme"`

Expected: 检查通过，提交只含视觉令牌和原生导航外壳。

### Task 2: 制作原创圆润紫黄图标资源

**Files:**
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `miniprogram/assets/icons/home.svg`, `home-active.svg`, `discover.svg`, `discover-active.svg`, `map.svg`, `map-active.svg`, `me.svg`, `me-active.svg`
- Modify: `miniprogram/assets/icons/category-scenic.svg`, `category-restaurant.svg`, `category-culture.svg`, `category-camping.svg`, `location.svg`
- Modify: 与上述 SVG 同名的现有 `.png` 文件

**Interfaces:**
- Consumes: `app.json` 的 `iconPath`/`selectedIconPath`，首页四分类的 `/assets/icons/category-{{item.value}}.png`，地图 `iconPath: '/assets/icons/location.png'`。
- Produces: 同名路径、同尺寸、可被微信原生 Tab 和地图读取的项目原创紫黄 PNG；SVG 作为可审查源文件。

- [ ] **Step 1: 为图标系统添加失败测试。**

在 `tests/unit/visual-style.test.ts` 增加以下检查：

```ts
for (const name of ['home', 'discover', 'map', 'me']) {
  const idle = await readFile(`miniprogram/assets/icons/${name}.svg`, 'utf8');
  const active = await readFile(`miniprogram/assets/icons/${name}-active.svg`, 'utf8');
  expect(idle).toContain('#cfc2ff');
  expect(active).toContain('#ffc400');
  expect((await readFile(`miniprogram/assets/icons/${name}.png`)).subarray(1, 4).toString()).toBe('PNG');
  expect((await readFile(`miniprogram/assets/icons/${name}-active.png`)).subarray(1, 4).toString()).toBe('PNG');
}
for (const name of ['scenic', 'restaurant', 'culture', 'camping', 'location']) {
  const svg = await readFile(`miniprogram/assets/icons/${name === 'location' ? name : `category-${name}`}.svg`, 'utf8');
  expect(svg).toContain('viewBox="0 0 64 64"');
  expect(svg).toContain('#ffc400');
}
```

- [ ] **Step 2: 运行目标测试，确认旧线条图标与朱红激活态失败。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/visual-style.test.ts`

Expected: FAIL，现有 Tab SVG 使用灰褐色/朱红色且分类 SVG 不含亮黄。

- [ ] **Step 3: 以统一几何规则重绘并同步栅格资源。**

将所有上述 SVG 改为 64×64 画布、圆角方形或圆形底座、简化填充形状与固定安全留白：首页为屋顶/定位组合、发现为路线卡片、地图为折线地图针、我的为旅行者头像；景区为江流山峰、餐饮为餐盘、文化为展馆、露营为帐篷、地图为位置针。未选中 Tab 固定浅紫 `#cfc2ff`，选中 Tab 固定亮黄 `#ffc400`，分类和位置图标使用亮黄背景/深紫图形或深紫背景/亮黄图形。根据每个已更新 SVG 导出相同文件名的 PNG；Tab PNG 保持 81×81，分类 PNG 保持 96×96，地图 PNG 保持现有可用于 `30×38` marker 的透明尺寸。不得留下 `stroke="#817969"`、`#A44D3E`、emoji 或参考案例图形。

- [ ] **Step 4: 运行目标测试与资源检查。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/visual-style.test.ts tests/unit/navigation.test.ts`

Run: `node scripts\\check-package.mjs`

Expected: PASS；所有 Tab、分类与地图资源仍可在包检查中读取。

- [ ] **Step 5: 提交图标资源。**

Run: `git add miniprogram/assets/icons tests/unit/visual-style.test.ts`

Run: `git commit -m "feat: add modern purple yellow icon system"`

Expected: 提交只包含原创图标源/导出资源及其静态测试。

### Task 3: 统一共享组件与反馈状态表面

**Files:**
- Create: `miniprogram/components/feedback-toast/index.json`
- Create: `miniprogram/components/feedback-toast/index.ts`
- Create: `miniprogram/components/feedback-toast/index.wxml`
- Create: `miniprogram/components/feedback-toast/index.wxss`
- Modify: `miniprogram/components/async-state/index.wxml`, `index.wxss`
- Modify: `miniprogram/components/category-filter/index.wxss`
- Modify: `miniprogram/components/message-bubble/index.wxss`
- Modify: `miniprogram/components/place-card/index.wxml`, `index.wxss`
- Modify: `miniprogram/components/source-card/index.wxss`
- Modify: `tests/unit/components.test.ts`

**Interfaces:**
- Consumes: `async-state` 的 `status/title/message/retryText` 和既有 `retry` 事件、`category-filter` 的 `categorychange`、`place-card` 的 `open/favoritechange`。
- Produces: 不变的组件事件和数据属性；新增 `feedback-toast` 属性 `visible: boolean`、`tone: 'success' | 'error' | 'info'`、`message: string`，且只发 `dismiss`。

- [ ] **Step 1: 写失败的组件样式与状态契约测试。**

在 `tests/unit/components.test.ts` 增加：

```ts
const state = await readFile('miniprogram/components/async-state/index.wxml', 'utf8');
const stateStyle = await readFile('miniprogram/components/async-state/index.wxss', 'utf8');
const feedback = await readFile('miniprogram/components/feedback-toast/index.wxml', 'utf8');
const feedbackStyle = await readFile('miniprogram/components/feedback-toast/index.wxss', 'utf8');
expect(state).not.toContain('﹏');
expect(state).not.toContain('>!</view>');
expect(stateStyle).toContain('var(--color-action)');
expect(feedback).toContain('feedback-toast');
expect(feedback).toContain('bindtap="dismiss"');
expect(feedbackStyle).toContain('var(--color-brand-deep)');
expect(feedbackStyle).toContain('var(--color-action)');
```

- [ ] **Step 2: 运行目标测试，确认新组件和现代状态样式尚不存在。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/components.test.ts`

Expected: FAIL，因为项目没有 `feedback-toast`，且空/错误状态仍使用字符图形。

- [ ] **Step 3: 实现纯呈现反馈组件与共享组件样式。**

`feedback-toast` 只在 `visible && message` 时渲染白色圆角浮层，按 `tone` 显示原创 CSS 几何成功、错误或信息符号与传入消息；点击关闭控件触发 `dismiss`，不调用任何服务。`async-state` 保留 loading、empty、error、ready 四分支和 retry 绑定，改为紫色轨迹与亮黄点的 loading 图形、白卡空状态和红色错误状态。筛选器、聊天气泡、来源卡、地点卡统一白卡/浅紫边框/紫黄控件；保留 `pending` 禁用、图片失败回退、收藏和打开事件，不改变其 TypeScript 逻辑。

- [ ] **Step 4: 运行组件与行为回归。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/components.test.ts tests/unit/navigation.test.ts`

Expected: PASS；分类事件、异步重试、地点卡打开/收藏、图片失败回退均保持原契约。

- [ ] **Step 5: 提交共享组件。**

Run: `git add miniprogram/components tests/unit/components.test.ts`

Run: `git commit -m "feat: unify modern feedback and shared components"`

Expected: 提交只包含共享视觉组件和对应测试。

### Task 4: 改造首页、发现、地图与地点详情

**Files:**
- Modify: `miniprogram/pages/home/index.wxml`, `index.wxss`, `index.ts`, `index.json`
- Modify: `miniprogram/pages/discover/index.wxml`, `index.wxss`, `index.ts`, `index.json`
- Modify: `miniprogram/pages/map/index.wxml`, `index.wxss`, `index.json`
- Modify: `miniprogram/pages/place-detail/index.wxml`, `index.wxss`, `index.ts`, `index.json`
- Modify: `miniprogram/view-models/map.ts`
- Modify: `tests/unit/visual-style.test.ts`, `tests/unit/map-state.test.ts`, `tests/unit/navigation.test.ts`

**Interfaces:**
- Consumes: 既有 `openDiscover/onCategoryTap/openAiChat/openTripForm/openPlace/onFavorite`，`categorychange`，`locateNearby/onOpenSettings/openSelectedPlace`，`buildMarkers`。
- Produces: 相同事件绑定、页面数据、路线、地图 marker ID/坐标/筛选契约和地点云端读取；地图 marker 仅换用紫黄图标与 callout 颜色。

- [ ] **Step 1: 写失败的主路径视觉/地图测试。**

在 `tests/unit/visual-style.test.ts` 加入：

```ts
const homeStyle = await readFile('miniprogram/pages/home/index.wxss', 'utf8');
const home = await readFile('miniprogram/pages/home/index.wxml', 'utf8');
expect(home).not.toContain('yichang-ink.jpg');
expect(home).not.toContain('把日子放慢');
expect(homeStyle).toContain('.hero-orbit');
expect(homeStyle).toContain('linear-gradient');
expect(homeStyle).not.toContain('STKaiti');
for (const page of ['discover', 'map', 'place-detail']) {
  const style = await readFile(`miniprogram/pages/${page}/index.wxss`, 'utf8');
  expect(style).toContain('var(--color-brand)');
  expect(style).not.toContain('#a44d3e');
}
```

在 `tests/unit/map-state.test.ts` 追加：

```ts
expect(buildMarkers([validPlace], '')[0]).toMatchObject({
  iconPath: '/assets/icons/location.png',
  callout: { color: '#30254a', bgColor: '#ffffff' },
});
```

- [ ] **Step 2: 运行目标测试，确认旧水墨首页、朱红样式和地图 callout 失败。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/visual-style.test.ts tests/unit/map-state.test.ts`

Expected: FAIL，因为首页仍依赖水墨图和古风文案，地图 callout 仍使用旧米色主题。

- [ ] **Step 3: 实现四个主页面的现代布局。**

首页移除水墨图片、印章、古风文案、卷轴杆和竖排装饰，改为深紫/品牌紫渐变 hero，添加仅作装饰的 `.hero-orbit`、`.hero-river` 和 `.hero-pin` 几何元素，保留“去发现宜昌”、四分类、自由问答、行程定制、精选地点及全部既有绑定。发现页改为现代标题、筛选胶囊、图标化搜索、白色地点卡和资料提示。地图保持全屏 `<map>`、透明且不拦截手势的 `.map-filters`、原定位/设置/详情按钮与 `selectedPlace` 条件，重绘浮层为紫黄卡；将 `buildMarkers()` 的 `callout` 改为 `color: '#30254a'`、`bgColor: '#ffffff'`，不动 marker 过滤或排序。详情页改为大图加白色信息卡、紫色标签和图标收藏胶囊；继续使用 `place` 字段、原图片节和资料说明。

在首页、发现、地点详情的每个既有 `wx.showToast` 调用处，仅将现有成功/失败文案和图标结果映射到 `feedback-toast` 的同文案 `tone`；事件条件、`setFavorite` 调用、失败分支和页面跳转不得变化。各页 JSON 注册该组件，WXML 以 `feedback` 数据绑定渲染，关闭仅复位视觉可见状态。

- [ ] **Step 4: 运行主路径、定位和页面路由回归。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/visual-style.test.ts tests/unit/navigation.test.ts tests/unit/map-state.test.ts tests/unit/map-nearby-page.test.ts tests/unit/place-pages.test.ts`

Expected: PASS；地点仍从服务读取，地图仍只在主动定位时请求位置，详情收藏与搜索/分类行为不变。

- [ ] **Step 5: 提交主浏览体验。**

Run: `git add miniprogram/pages/home miniprogram/pages/discover miniprogram/pages/map miniprogram/pages/place-detail miniprogram/view-models/map.ts tests/unit/visual-style.test.ts tests/unit/map-state.test.ts tests/unit/navigation.test.ts`

Run: `git commit -m "feat: restyle primary travel discovery screens"`

Expected: 提交只包含首页、发现、地图、地点详情的视觉与对应测试。

### Task 5: 改造个人、AI、行程与辅助页面及提示呈现

**Files:**
- Modify: `miniprogram/pages/me/index.wxml`, `index.wxss`, `index.ts`, `index.json`
- Modify: `miniprogram/pages/records/index.wxml`, `index.wxss`, `index.ts`, `index.json`
- Modify: `miniprogram/pages/preferences/index.wxml`, `index.wxss`, `index.ts`, `index.json`
- Modify: `miniprogram/pages/privacy/index.wxml`, `index.wxss`
- Modify: `miniprogram/pages/ai-chat/index.wxml`, `index.wxss`
- Modify: `miniprogram/pages/ai-history/index.wxml`, `index.wxss`
- Modify: `miniprogram/pages/trip-form/index.wxml`, `index.wxss`
- Modify: `tests/unit/profile-pages.test.ts`, `tests/unit/chat-ui.test.ts`, `tests/unit/trip-form.test.ts`, `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: 所有已注册个人/AI 路由、`openEntry/showPrivacy`、记录加载与删除、偏好保存、AI 提交/重试/新对话、行程提交/调整/重新规划。
- Produces: 不变的路由、owner-scoped 数据访问、提示文字、AI 免责声明、表单校验和操作事件；`feedback-toast` 仅接收已有 `wx.showToast` 的展示结果。

- [ ] **Step 1: 写失败的二级页面与提示回归测试。**

在 `tests/unit/profile-pages.test.ts` 为个人菜单加入以下断言：

```ts
const me = await readFile('miniprogram/pages/me/index.wxml', 'utf8');
expect(me).toContain('feedback-toast');
expect(me).not.toContain('♡');
expect(me).not.toContain('◷');
expect(me).not.toContain('✦');
expect(me).not.toContain('☷');
```

在 `tests/unit/visual-style.test.ts` 增加：

```ts
for (const page of ['me', 'records', 'preferences', 'privacy', 'ai-chat', 'ai-history', 'trip-form']) {
  const style = await readFile(`miniprogram/pages/${page}/index.wxss`, 'utf8');
  expect(style).toContain('var(--color-surface)');
  expect(style).not.toContain('var(--font-display)');
}
```

保留 `chat-ui.test.ts` 和 `trip-form.test.ts` 中对提交抑制、重试、AI 安全提示、表单字段与完整重生成的已有断言。

- [ ] **Step 2: 运行目标测试，确认旧字符图标、宋体令牌或未注册提示组件失败。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/profile-pages.test.ts tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts tests/unit/visual-style.test.ts`

Expected: FAIL，个人页面仍含字符图形，二级页面仍引用旧显示字体或旧纸色样式。

- [ ] **Step 3: 实现现代二级页面与同文案反馈。**

个人页用四个原创图标替换 `symbol` 字符，保留 `entries` 的标题、描述和 URL。记录、偏好与隐私使用现代标题、白卡列表/信息块、紫色辅助说明和可换行的小屏布局。AI 聊天、AI 历史与行程页使用同一免责声明信息条、深紫用户气泡、白色助手气泡、黄色提交按钮、浅紫输入/偏好胶囊及错误/等待面板；不变更输入长度、重试、新对话、调整或重启行为。

仅在 `records`、`preferences` 的既有 `wx.showToast` 成功/失败调用处接入同文案的 `feedback-toast`。为所有拥有 toast 的页面在 `index.json` 注册组件、在 WXML 追加反馈层和在 TypeScript 增加只控制其可见性的 `feedback`/`onFeedbackDismiss`；不得改动任何服务调用参数、条件或错误文字。无 `wx.showToast` 的页面只改 WXML/WXSS，不增加新的弹窗。

- [ ] **Step 4: 运行个人和 AI 行为回归。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/profile-pages.test.ts tests/unit/preferences-page.test.ts tests/unit/user-records.test.ts tests/unit/ai-history.test.ts tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts`

Expected: PASS；个人数据仍按用户隔离，保存和移除仅沿原路径调用服务，AI/行程的提交、错误、重试和重启状态不变。

- [ ] **Step 5: 提交二级页面与反馈表面。**

Run: `git add miniprogram/pages/me miniprogram/pages/records miniprogram/pages/preferences miniprogram/pages/privacy miniprogram/pages/ai-chat miniprogram/pages/ai-history miniprogram/pages/trip-form tests/unit/profile-pages.test.ts tests/unit/chat-ui.test.ts tests/unit/trip-form.test.ts tests/unit/visual-style.test.ts`

Run: `git commit -m "feat: restyle personal and AI travel screens"`

Expected: 提交只包含二级页面视觉、同文案提示呈现和对应测试。

### Task 6: 逐页视觉验证、自动化检查与独立验收

**Files:**
- Modify: `scripts/wechat-smoke.mjs`
- Modify: `tests/unit/visual-style.test.ts`
- Create: `docs/testing/2026-09-07-modern-purple-yellow-ui-qa.md`

**Interfaces:**
- Consumes: 现有微信自动化 endpoint、四个 Tab、`async-state` 分支、地图 marker 设置方法和所有已注册页面。
- Produces: 四个 Tab 自动截图、逐页人工截图记录，以及不宣称真机或云端路径已验证的独立 QA 结论。

- [ ] **Step 1: 写失败的自动视觉验证。**

在 `tests/unit/visual-style.test.ts` 断言 `scripts/wechat-smoke.mjs` 包含主题化检查：

```ts
const smoke = await readFile('scripts/wechat-smoke.mjs', 'utf8');
expect(smoke).toContain("'rgb(43, 23, 77)'");
expect(smoke).toContain("'.button-primary'");
expect(smoke).toContain("'rgb(255, 196, 0)'");
expect(smoke).toContain("'wechat-home.png'");
expect(smoke).toContain("'wechat-map.png'");
```

- [ ] **Step 2: 运行目标测试，确认冒烟脚本尚未检查紫黄视觉。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test -- tests/unit/visual-style.test.ts`

Expected: FAIL，因为旧脚本仅验证水墨图与布局，不验证新的 Tab/主按钮颜色。

- [ ] **Step 3: 更新冒烟脚本并进行逐页截图比对。**

删除水墨资源断言，保留四个 Tab 截图输出 `.local/wechat-home.png`、`.local/wechat-discover.png`、`.local/wechat-map.png`、`.local/wechat-me.png`，并断言页面背景/导航为深紫系、可见主操作为亮黄、分类图标数量仍为 4、地图过滤层仍透明且按钮仍接收事件。使用官方微信开发者工具逐一打开地点详情、收藏、浏览、偏好、隐私、AI 问答、AI 历史、行程页，分别截取正常态；将已有异步页面切换到 loading、empty、error，并截图验证提示、重试和禁用态。截图只保存于忽略的 `.local/`，不提交地点数据、账户、位置或密钥。

- [ ] **Step 4: 运行完整自动检查。**

Run: `node .local-tools\\package\\bin\\npm-cli.js run test`

Run: `node .local-tools\\package\\bin\\npm-cli.js run typecheck`

Run: `node .local-tools\\package\\bin\\npm-cli.js run lint`

Run: `node .local-tools\\package\\bin\\npm-cli.js run build`

Run: `node .local-tools\\package\\bin\\npm-cli.js run check:package`

Run: `node .local-tools\\package\\bin\\npm-cli.js run verify:docs`

Run: `node .local-tools\\package\\bin\\npm-cli.js run test:e2e`

Expected: 自动化检查全部通过；若未设置 `WECHAT_AUTOMATION_ENDPOINT`，`test:e2e` 明确记录为阻止，不能写成通过。

- [ ] **Step 5: 独立测试与验收记录。**

由未参与实现的测试角色对最后一个应用提交执行 Task 6 的可运行检查、审阅 `.local/` 的逐页截图、核验正常/加载/空/错误/定位拒绝/禁用反馈，以及确认没有修改云函数、Dify、字段和接口。将被测 commit、角色、命令、截图结论、缺陷、可放行范围、真机/云端未测项写入 `docs/testing/2026-09-07-modern-purple-yellow-ui-qa.md`；不得把开发自测写成独立验收。

- [ ] **Step 6: 提交验证脚本和独立 QA 记录。**

Run: `git add scripts/wechat-smoke.mjs tests/unit/visual-style.test.ts`

Run: `git commit -m "test: verify modern purple yellow UI"`

Run: `git add docs/testing/2026-09-07-modern-purple-yellow-ui-qa.md`

Run: `git commit -m "docs: record modern UI QA"`

Expected: 验证脚本和独立 QA 分别独立提交；QA 报告如实说明未测项目。

## Final Review Checklist

- [ ] 所有视觉改动均遵循 `docs/superpowers/specs/2026-09-07-modern-purple-yellow-ui-design.md`，且没有恢复古风元素。
- [ ] 所有图标为项目原创，四个 Tab、四分类、地图、搜索、收藏、个人、AI、状态和方向图标没有 emoji 或平台字符图形。
- [ ] 所有页面的正常、加载、空、错误、提示、禁用与小屏长文本状态可读；现有业务条件和服务调用不变。
- [ ] `git diff --check` 通过，且每一逻辑改动与独立 QA 使用聚焦的 Conventional Commit。
- [ ] 交付前请求只读代码审查，并明确区分开发自测、代码审查、独立测试与 Android/iPhone 真机验收状态。

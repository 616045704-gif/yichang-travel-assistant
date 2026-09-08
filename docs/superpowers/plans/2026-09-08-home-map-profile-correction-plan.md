# 首页、地图与个人页视觉纠偏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按用户提供的真机截图纠正首页 AI 卡片、地图地点弹卡与个人页顶部视觉，并恢复所有相关入口的实际可点击性。

**Architecture:** 保持页面数据、云函数、Dify、数据库、接口和跳转目标不变，只调整 WXML/WXSS 结构与触控承载元素。个人页顶部使用 CSS 插画和现有本地图标组成可维护的旅行 Hero；首页 AI 入口改用等分网格；地图分类、点位与详情卡分别验证事件链和原生地图覆盖层。

**Tech Stack:** 微信小程序 WXML/WXSS/TypeScript、Vitest、微信开发者工具。

## Global Constraints

- 不修改云函数、Dify 调用、数据库字段、已有接口、业务逻辑或页面跳转目标。
- 分类值仅允许 `''`、`scenic`、`restaurant`、`culture`、`camping`。
- 图标继续使用 `miniprogram/assets/provided/` 中由用户提供的本地图标。
- 个人页只修改顶部 Hero 与个人信息卡，菜单及其后的内容保持原样。
- `dist` 是微信开发者工具导入目录，必须使用 `npm run build` 生成 demo 构建。

---

### Task 1: 锁定可测视觉与触控契约

**Files:**
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `tests/unit/map-nearby-page.test.ts`
- Modify: `tests/unit/profile-pages.test.ts`

**Interfaces:**
- Consumes: 现有页面 WXML/WXSS 与页面方法名。
- Produces: 首页等分 AI 网格、30% CTA 底色、地图大卡布局、个人页 Hero 结构和点击热区的自动化契约。

- [ ] **Step 1: 写入失败测试**

```ts
expect(homeStyle).toContain('background: rgba(255, 255, 255, .30)')
expect(home).toContain('class="ai-quick-card" bindtap="openAiChat"')
expect(mapStyle).toMatch(/\.marker-card\s*\{[^}]*min-height:\s*240rpx/)
expect(map).toContain('class="marker-hit-target"')
expect(me).toContain('class="profile-avatar-art"')
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --run tests/unit/visual-style.test.ts tests/unit/map-nearby-page.test.ts tests/unit/profile-pages.test.ts`

Expected: FAIL，缺少新结构或新尺寸断言。

### Task 2: 修正首页 CTA 与 AI 双卡几何

**Files:**
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.wxss`
- Test: `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: `openDiscover()`、`openAiChat()`、`openTripForm()`。
- Produces: 两列等宽、同高、同边距的 AI 入口，以及背景 30% 透明但文字保持不透明的“出发吧”。

- [ ] **Step 1: 将 AI 入口承载元素改为无原生按钮内边距的等分网格项**

```xml
<view class="ai-quick-card" bindtap="openAiChat" aria-role="button" aria-label="自由问答">
  <image class="ai-quick-image" src="/assets/provided/ai-chat.png" mode="aspectFill" />
</view>
```

- [ ] **Step 2: 固定网格列宽与媒体比例**

```css
.ai-quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16rpx; padding: 0 16rpx; }
.ai-quick-card { width: 100%; aspect-ratio: 1 / 1; overflow: hidden; }
.ai-quick-image { width: 100%; height: 100%; }
```

- [ ] **Step 3: 仅降低 CTA 背景透明度**

```css
.home-hero-action { background: rgba(255, 255, 255, .30); }
```

- [ ] **Step 4: 运行首页单元测试**

Run: `npm test -- --run tests/unit/visual-style.test.ts tests/unit/navigation.test.ts tests/unit/provided-assets-ui.test.ts`

Expected: PASS。

### Task 3: 扩大地图地点卡并恢复点击事件链

**Files:**
- Modify: `miniprogram/pages/map/index.wxml`
- Modify: `miniprogram/pages/map/index.wxss`
- Modify: `miniprogram/components/category-filter/index.wxml`
- Modify: `miniprogram/components/category-filter/index.wxss`
- Modify: `miniprogram/pages/map/index.ts` only if runtime reproduction identifies a state transition defect
- Test: `tests/unit/map-nearby-page.test.ts`
- Test: `tests/unit/components.test.ts`
- Test: `tests/unit/map-state.test.ts`

**Interfaces:**
- Consumes: `onCategoryChange(event)`、`onMarkerTap(event)`、`openSelectedPlace()`、`locateNearby()`。
- Produces: 至少 `240rpx` 高的地图地点卡、稳定的左右列对齐、完整按钮热区，以及可验证的分类/点位/详情点击链。

- [ ] **Step 1: 为分类 Tab、点位卡与详情入口建立完整点击热区**

```xml
<view class="category-tab-hit" data-category="{{item.value}}" bindtap="onTabTap" aria-role="button">
  <image class="category-tab-icon" ... />
  <text class="category-tab-label">{{item.label}}</text>
</view>
```

- [ ] **Step 2: 放大地点卡并对齐图片、分类、标题与按钮**

```css
.marker-card { min-height: 240rpx; padding: 24rpx; gap: 24rpx; align-items: center; }
.marker-cover { width: 220rpx; height: 208rpx; flex-basis: 220rpx; }
.marker-copy { min-height: 208rpx; justify-content: space-between; }
.detail-button { box-sizing: border-box; width: 100%; }
```

- [ ] **Step 3: 运行地图与组件测试**

Run: `npm test -- --run tests/unit/map-nearby-page.test.ts tests/unit/map-state.test.ts tests/unit/components.test.ts tests/unit/navigation.test.ts`

Expected: PASS。

### Task 4: 按参考图重做个人页顶部

**Files:**
- Modify: `miniprogram/pages/me/index.wxml`
- Modify: `miniprogram/pages/me/index.wxss`
- Test: `tests/unit/profile-pages.test.ts`
- Test: `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: `/assets/provided/category-scenic.png`、`/assets/provided/category-camping.png`、`/assets/provided/tab-me-active.png`。
- Produces: 浅紫旅行插画 Hero、可读的三层文案、悬浮白色个人信息卡；`.menu` 及后续 DOM 保持不变。

- [ ] **Step 1: 写入旅行 Hero 和个人卡装饰结构**

```xml
<view class="travel-hero">
  <text class="travel-kicker">我的旅行</text>
  <text class="travel-title">留下你的出发线索</text>
  <text class="travel-subtitle">去看更大的世界，遇见更好的自己 ✨</text>
  <view class="travel-illustration" aria-hidden="true">...</view>
  <view class="profile-card">
    <view class="profile-avatar-art"><image class="profile-icon" ... /></view>
    <view class="profile-copy">...</view>
    <text class="profile-script">Let's Go</text>
  </view>
</view>
```

- [ ] **Step 2: 使用层次明确的淡紫背景与悬浮卡片**

```css
.travel-hero { min-height: 410rpx; background: linear-gradient(135deg, #dfe3ff 0%, #f3efff 58%, #eef7ff 100%); }
.profile-card { position: absolute; left: 22rpx; right: 22rpx; bottom: 22rpx; min-height: 142rpx; }
```

- [ ] **Step 3: 运行个人页测试**

Run: `npm test -- --run tests/unit/profile-pages.test.ts tests/unit/visual-style.test.ts`

Expected: PASS。

### Task 5: 构建、真机尺寸检查与独立验收

**Files:**
- Create: `docs/testing/2026-09-08-home-map-profile-correction-qa.md`
- Generated: `dist/**`

**Interfaces:**
- Consumes: Tasks 1–4 的页面输出。
- Produces: 微信开发者工具中的点击与几何验收证据。

- [ ] **Step 1: 运行完整静态检查与测试**

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm test`

Run: `npm run build`

Expected: 全部退出码为 0。

- [ ] **Step 2: 在微信开发者工具实际点击**

验证：首页“出发吧”进入发现、自由问答进入 AI 页面、行程定制进入行程页、四个分类均切换到发现；地图五个分类可切换、点位弹出地点卡、地点卡按钮进入详情；底部四个 Tab 均可切换。

- [ ] **Step 3: 在模拟器测量可见几何**

验证：首页两张 AI 图可见宽高差不超过 2px，左右外边距差不超过 2px；地图地点卡高度不少于 120px，左右列顶边差不超过 2px；个人页顶部与参考图一致呈现浅紫 Hero 和悬浮白卡。

- [ ] **Step 4: 独立测试角色记录结果**

在 QA 文档写明被测 commit、实际点击项、几何数据、截图、缺陷与未测项；模拟器结果不得表述为真机通过。


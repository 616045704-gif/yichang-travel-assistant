# UI Correction Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按已确认的纠偏设计恢复发现与地图的统一横向分类 Tab，完成“我的”顶部完整旅行插画与人物卡片，校准地图按钮和弹卡，并以冷启动真实点击与落盘截图证明全部指定改动。

**Architecture:** 主智能体独占实现与整合；独立 UI、代码和测试角色先完成只读审查，实施后再次独立复核。地图继续使用 `cover-view/cover-image` 兼容原生地图层，但视觉 token 与发现页一致；“我的”顶部只消费两张新增本地位图，菜单起始节点及其后保持字节级业务结构不变。

**Tech Stack:** 微信小程序 WXML/WXSS/TypeScript、用户本地 PNG、ImageGen 原创位图、Vitest、ESLint、TypeScript、微信开发者工具 Stable 3.16.2、Computer Use。

## Global Constraints

- 不修改云函数、Dify、数据库字段、云接口、服务请求、分类值、页面跳转目标和定位授权时机。
- 分类值保持 `'' | 'scenic' | 'restaurant' | 'culture' | 'camping'`，不新增停车场或其他业务入口。
- 分类和底部导航继续使用 `miniprogram/assets/provided/` 中的用户本地图标，不重绘、不 recolor。
- 首页头图、发现头图、地点列表、详情页、底部 Tab 和“我的”下半部分不改。
- 首页现有 30% CTA 与两张等分 AI 卡属于保留项，只增加防回归测试，不重新设计。
- 地图地点无封面字段时继续使用本地统一占位图，不扩大接口或数据库范围。
- 每个逻辑改动独立测试、独立 commit；只暂存精确路径，不使用 `git add .`。
- 最终验收必须在构建后完整关闭微信开发者工具、从项目列表重开，不依赖热更新。
- 自动化测试、合成事件和点击波纹均不能代替真实可见控件中心点击。

---

## File Map

| File | Responsibility |
| --- | --- |
| `miniprogram/assets/provided/me-hero-travel.png` | 完整浅紫蓝旅行插画背景，不含界面文字。 |
| `miniprogram/assets/provided/me-traveler-avatar.png` | 独立旅行者人物头像。 |
| `miniprogram/pages/me/index.wxml` | 仅替换 Hero 装饰与头像资源，保留菜单结构和事件。 |
| `miniprogram/pages/me/index.wxss` | Hero/个人卡布局，不改变下半页尺寸体系。 |
| `miniprogram/components/category-filter/index.wxss` | 发现页分类 Tab 的统一视觉 token。 |
| `miniprogram/pages/map/index.wxml` | 保留地图 cover 分类结构、地图卡与原事件。 |
| `miniprogram/pages/map/index.wxss` | 映射统一 Tab token，修正弹卡和按钮文字/框体对齐。 |
| `tests/unit/profile-pages.test.ts` | 新 Hero 资源、旧拼图移除、菜单不变。 |
| `tests/unit/components.test.ts` | 共享五项 Tab 和事件契约。 |
| `tests/unit/map-nearby-page.test.ts` | Map cover Tab、按钮热区与布局契约。 |
| `tests/unit/visual-style.test.ts` | 跨页 Tab token、Hero、首页保留项、地图几何。 |
| `tests/unit/provided-assets-ui.test.ts` | 新位图存在、尺寸和资源预算。 |
| `scripts/wechat-smoke.mjs` | 扩充五项分类、按钮和各入口运行时断言。 |
| `docs/testing/2026-09-08-ui-correction-reset-qa.md` | 独立测试记录、截图清单、缺陷与未测项。 |
| `.local/qa/<commit>-stable-3.16.2-ios-sim/` | 只在本地保存冷启动验收 PNG 和 manifest，不提交仓库。 |

---

### Task 1: Lock the Correct Visual Contract

**Files:**
- Modify: `tests/unit/profile-pages.test.ts`
- Modify: `tests/unit/map-nearby-page.test.ts`
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `tests/unit/provided-assets-ui.test.ts`

**Interfaces:**
- Consumes: 当前 WXML/WXSS 与设计说明 `docs/superpowers/specs/2026-09-08-ui-correction-reset-design.md`。
- Produces: 能先失败、后证明纠偏完成的结构和视觉契约。

- [ ] **Step 1: 将“我的”测试从错误拼图契约改为完整资产契约**

```ts
expect(meMarkup).toContain('/assets/provided/me-hero-travel.png');
expect(meMarkup).toContain('/assets/provided/me-traveler-avatar.png');
expect(meMarkup).not.toContain('/assets/provided/tab-me-active.png');
expect(meMarkup).not.toContain('travel-motif');
expect(meMarkup.indexOf('class="profile-card"')).toBeLessThan(meMarkup.indexOf('class="menu"'));
expect(meMarkup.slice(meMarkup.indexOf('class="menu"'))).toBe(previousMenuTail);
```

- [ ] **Step 2: 锁定发现和地图相同 Tab token**

统一 token 采用能在地图一屏容纳且与参考图比例一致的数值：普通项 `100rpx`、文化项 `184rpx`、高度 `112rpx`、图标 `56rpx`、圆角 `24rpx`、间距 `12rpx`。测试分别提取 `.category-tab` 与 `.map-filter-tab` 并比较这些值，禁止 `space-between`。

```ts
for (const value of ['100rpx', '112rpx', '56rpx', '24rpx']) {
  expect(categoryCss).toContain(value);
  expect(mapCss).toContain(value);
}
expect(categoryCss).toContain('gap: 12rpx');
expect(mapCss).toContain('gap: 12rpx');
expect(mapCss).not.toContain('justify-content: space-between');
```

- [ ] **Step 3: 锁定地图按钮居中和右栏宽度**

```ts
expect(mapCss).toMatch(/\.nearby-button[^}]*height:\s*72rpx/);
expect(mapCss).toMatch(/\.nearby-button[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*justify-content:\s*center/);
expect(mapCss).toMatch(/\.detail-button[^}]*width:\s*100%[^}]*height:\s*72rpx/);
expect(mapMarkup).toContain('class="detail-button marker-hit-target"');
```

- [ ] **Step 4: 保留首页已满足项的防回归断言**

```ts
expect(homeCss).toContain('background: rgba(255, 255, 255, .30)');
expect(homeCss).toMatch(/\.ai-quick-grid[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*16rpx/);
```

- [ ] **Step 5: 运行聚焦测试并确认因新资源和新契约缺失而失败**

Run: `node .local-tools/package/bin/npm-cli.js test -- --run tests/unit/profile-pages.test.ts tests/unit/map-nearby-page.test.ts tests/unit/visual-style.test.ts tests/unit/provided-assets-ui.test.ts`

Expected: FAIL，失败仅指向 `me-hero-travel.png`、`me-traveler-avatar.png`、跨页 Tab token 或按钮布局契约。

- [ ] **Step 6: Commit failing contract**

```powershell
git add -- tests/unit/profile-pages.test.ts tests/unit/map-nearby-page.test.ts tests/unit/visual-style.test.ts tests/unit/provided-assets-ui.test.ts
git commit -m "test: lock ui correction contract"
```

---

### Task 2: Create the Two Approved Me Assets

**Files:**
- Create: `miniprogram/assets/provided/me-hero-travel.png`
- Create: `miniprogram/assets/provided/me-traveler-avatar.png`

**Interfaces:**
- Consumes: 用户参考图，只作为构图、色彩和层级参考。
- Produces: 不含文字的完整旅行背景位图和独立人物头像位图。

- [ ] **Step 1: 用 ImageGen 生成完整 Hero 背景**

Prompt requirements: `ui-mockup`；浅紫蓝现代扁平旅行插画；右侧山峰、路线、定位点、飞机和旅行路牌形成完整场景；左侧保留干净文字安全区；无文字、无 logo、无水印、无古风、无分类图标拼贴；宽幅约 5:3。

- [ ] **Step 2: 用 ImageGen 生成独立头像**

Prompt requirements: `illustration-story`；现代友好年轻旅行者半身头像；浅紫蓝配色；圆形构图安全区；无文字、无 logo、无水印；不得看起来像底部导航图标。

- [ ] **Step 3: 检查两张输出**

使用 `view_image` 验证背景左侧负空间、右侧完整插画、头像清晰和无文字错误。将最终输出复制进上述精确路径，不覆盖任何用户本地原图。

- [ ] **Step 4: 运行资源测试**

Run: `node .local-tools/package/bin/npm-cli.js test -- --run tests/unit/provided-assets-ui.test.ts`

Expected: PASS，新资源存在、可解码、尺寸满足至少 2× UI 使用尺寸，单张不突破现有小程序资源预算。

- [ ] **Step 5: Commit assets**

```powershell
git add -- miniprogram/assets/provided/me-hero-travel.png miniprogram/assets/provided/me-traveler-avatar.png
git commit -m "feat: add profile travel artwork"
```

---

### Task 3: Integrate the Me Hero Without Touching the Menu

**Files:**
- Modify: `miniprogram/pages/me/index.wxml`
- Modify: `miniprogram/pages/me/index.wxss`
- Test: `tests/unit/profile-pages.test.ts`
- Test: `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: `/assets/provided/me-hero-travel.png`、`/assets/provided/me-traveler-avatar.png`。
- Produces: 完整插画 Hero、内嵌个人卡，菜单及所有 URL/事件不变。

- [ ] **Step 1: 删除旧拼图节点并接入完整背景和头像**

```xml
<view class="travel-hero">
  <image class="travel-hero-art" src="/assets/provided/me-hero-travel.png" mode="aspectFill" aria-hidden="true" />
  <view class="travel-copy">...</view>
  <view class="profile-card">
    <view class="profile-avatar-art"><image class="profile-icon" src="/assets/provided/me-traveler-avatar.png" mode="aspectFill" /></view>
    <view class="profile-copy">...</view>
    <text class="profile-script" aria-hidden="true">Let's Go</text>
  </view>
</view>
```

从 `<view class="menu">` 开始的 WXML 不做任何内容、顺序、事件或 URL 修改。

- [ ] **Step 2: 局部校准 Hero，不改变页面全局 padding**

```css
.travel-hero { height: 420rpx; margin-right: -10rpx; margin-left: -10rpx; }
.travel-hero-art { position:absolute; inset:0; width:100%; height:100%; }
.profile-card { left:22rpx; right:22rpx; bottom:22rpx; min-height:148rpx; }
```

文字区域、插画和白卡层级分别为 2、1、3；插画不得盖住主标题。

- [ ] **Step 3: 运行聚焦测试**

Run: `node .local-tools/package/bin/npm-cli.js test -- --run tests/unit/profile-pages.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts`

Expected: PASS。

- [ ] **Step 4: Commit Me integration**

```powershell
git add -- miniprogram/pages/me/index.wxml miniprogram/pages/me/index.wxss tests/unit/profile-pages.test.ts tests/unit/visual-style.test.ts
git commit -m "feat: rebuild profile travel header"
```

---

### Task 4: Restore One Category Tab Visual System

**Files:**
- Modify: `miniprogram/components/category-filter/index.wxss`
- Modify: `miniprogram/pages/map/index.wxss`
- Test: `tests/unit/components.test.ts`
- Test: `tests/unit/map-nearby-page.test.ts`
- Test: `tests/unit/visual-style.test.ts`

**Interfaces:**
- Consumes: 现有共享组件事件 `categorychange: { category }` 与地图 `onMapCategoryTap → applyCategory`。
- Produces: 发现/地图视觉相同且地图保持原生层可点击的五项 Tab。

- [ ] **Step 1: 将共享 Tab 和地图 cover Tab 映射到相同 token**

两端均使用：普通 `100rpx`、文化 `184rpx`、高 `112rpx`、图标 `56rpx`、圆角 `24rpx`、固定 `12rpx` 间距、相同边框/阴影/选中态。地图 track 使用 `justify-content:flex-start`。

- [ ] **Step 2: 保留交互承载与业务方法**

不修改 `category-filter/index.ts`、`map/index.ts`、分类值、定位方法、markers 构建和详情路由；地图继续使用 `cover-view/cover-image`。

- [ ] **Step 3: 运行聚焦测试**

Run: `node .local-tools/package/bin/npm-cli.js test -- --run tests/unit/components.test.ts tests/unit/map-nearby-page.test.ts tests/unit/visual-style.test.ts tests/unit/map-state.test.ts tests/unit/place-pages.test.ts`

Expected: PASS。

- [ ] **Step 4: Commit unified Tabs**

```powershell
git add -- miniprogram/components/category-filter/index.wxss miniprogram/pages/map/index.wxss tests/unit/components.test.ts tests/unit/map-nearby-page.test.ts tests/unit/visual-style.test.ts
git commit -m "fix: restore unified category tabs"
```

---

### Task 5: Align the Map Card and Both Buttons

**Files:**
- Modify: `miniprogram/pages/map/index.wxss`
- Test: `tests/unit/map-nearby-page.test.ts`
- Test: `tests/unit/visual-style.test.ts`
- Modify: `scripts/wechat-smoke.mjs`

**Interfaces:**
- Consumes: 当前 `marker-card`、`nearby-button`、`detail-button` 和原有 `bindtap`。
- Produces: 定位按钮与卡片中心对齐、两个按钮文字/框体居中、详情按钮填满右侧信息栏。

- [ ] **Step 1: 固定按钮盒模型**

```css
.nearby-button, .settings-button, .detail-button {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  min-height: 72rpx;
  margin: 0;
  padding: 0 24rpx;
  line-height: 1;
}
.detail-button { width: 100%; align-self: stretch; }
```

- [ ] **Step 2: 扩充 smoke 几何断言**

记录定位按钮、地点卡、图片、右栏和详情按钮 rect，断言：定位按钮与卡中心 `centerX` 差不超过 2px；详情按钮 left/width 与右栏差不超过 2px；按钮不进入图片列；两按钮高度差不超过 2px。

- [ ] **Step 3: 运行地图测试**

Run: `node .local-tools/package/bin/npm-cli.js test -- --run tests/unit/map-nearby-page.test.ts tests/unit/visual-style.test.ts tests/unit/navigation.test.ts`

Expected: PASS。

- [ ] **Step 4: Commit button correction**

```powershell
git add -- miniprogram/pages/map/index.wxss tests/unit/map-nearby-page.test.ts tests/unit/visual-style.test.ts scripts/wechat-smoke.mjs
git commit -m "fix: align map action buttons"
```

---

### Task 6: Main-Agent Build and Self-Review

**Files:**
- No new production files.

**Interfaces:**
- Consumes: Tasks 1–5 commits。
- Produces: 可供独立复核和冷启动验收的 `dist/`。

- [ ] **Step 1: 对照设计文档逐项检查 diff**

Run: `git diff 7e05267..HEAD -- miniprogram tests scripts`

Expected: 只包含两张新资产、Me Hero、两端分类视觉、地图按钮/测试；首页、发现头图、列表、详情、底部 Tab、服务和云函数无差异。

- [ ] **Step 2: 运行全部验证**

```powershell
node .local-tools/package/bin/npm-cli.js test
node .local-tools/package/bin/npm-cli.js run typecheck
node .local-tools/package/bin/npm-cli.js run lint
node scripts/build.mjs --mode=demo
node scripts/check-package.mjs --mode=demo
node scripts/verify-docs.mjs
git diff --check
```

Expected: 除既有真实数据库环境测试明确跳过外全部通过；build 输出 `Build ready: dist/ (demo)`。

- [ ] **Step 3: 主智能体视觉自查**

在不声称运行时通过的前提下，检查源图内容、资源尺寸和 WXML/WXSS 层级，确认无旧拼图、无 Tab 图标头像、无第二套 Tab token。

---

### Task 7: Independent Post-Implementation Reviews

**Files:**
- Modify only if reviewer finds a material defect; each fix requires a focused test and separate commit.

**Interfaces:**
- Consumes: Task 6 的 HEAD 与设计文档。
- Produces: 独立 UI verdict 和独立代码 verdict。

- [ ] **Step 1: UI reviewer**

逐项检查“我的”参考构图、下半页未动、发现/地图 Tab 一致、地图按钮和弹卡对齐、首页保留项。Critical/Important 未清零不得进入验收。

- [ ] **Step 2: Code reviewer**

检查服务/接口/路由/定位/分类契约不变、map cover 层有效、点击绑定覆盖完整可见框、测试没有固化错误视觉。Critical/Important 未清零不得进入验收。

- [ ] **Step 3: Fix and re-review**

每个有效问题先补失败测试，再做最窄修复、运行聚焦测试、单独 commit，并把新 HEAD 交回原 reviewer 复核至 Ready。

---

### Task 8: Independent Cold-Start QA and Screenshot Evidence

**Files:**
- Create: `docs/testing/2026-09-08-ui-correction-reset-qa.md`
- Create locally, do not commit: `.local/qa/<7位commit>-stable-3.16.2-ios-sim/*.png`
- Create locally, do not commit: `.local/qa/<7位commit>-stable-3.16.2-ios-sim/manifest.md`

**Interfaces:**
- Consumes: reviewer-ready HEAD 和已生成的 `dist/`。
- Produces: 冷启动真实点击记录、1:1 PNG、几何数据、缺陷/未测项。

- [ ] **Step 1: 冷启动**

先关闭微信开发者工具主窗口并回到项目列表，再重新打开项目；不要再次编译。记录 DevTools、Stable 3.16.2、模拟器和 HEAD。

- [ ] **Step 2: 真实点击**

按独立测试审查清单依次实点：底部四 Tab；首页 CTA、两个 AI 入口、四分类和一个地点卡；发现搜索展开/关闭/输入/纸飞机/五分类/地点卡；地图五分类、至少两类真实 marker、旧卡清除、详情；定位允许和拒绝；“我的”四入口和隐私说明。

- [ ] **Step 3: 保存截图**

至少保存设计说明要求的 6 张，完整目标为 QA 审查定义的 `01-home-default.png` 至 `30-home-featured-detail.png`。所有图片保存到 commit 命名目录；定位成功图去除精确位置和账号信息，且不提交仓库。

- [ ] **Step 4: 几何测量**

记录首页 AI 卡、两端 Tab、地图卡、定位按钮/卡中心线、两个按钮文字中心、Hero/个人卡的原始 px 与计算式；所有要求按设计说明的 2px 阈值判断。

- [ ] **Step 5: 独立测试记录**

QA 文档必须区分 PASS、FAIL、BLOCKED、NOT TESTED；合成事件和单元测试只列为辅助证据。定位权限或真机未完成时不得写成通过。

- [ ] **Step 6: Commit QA record**

```powershell
git add -- docs/testing/2026-09-08-ui-correction-reset-qa.md
git commit -m "test: record ui correction reset qa"
```

---

### Task 9: Final Requirement-by-Requirement Audit

**Files:**
- Read: `docs/superpowers/specs/2026-09-08-ui-correction-reset-design.md`
- Read: `docs/testing/2026-09-08-ui-correction-reset-qa.md`
- Read: `.local/qa/<commit>-stable-3.16.2-ios-sim/manifest.md`

**Interfaces:**
- Consumes: 最终 HEAD、独立 review、独立 QA 和截图。
- Produces: 可交付或明确未完成的最终结论。

- [ ] **Step 1: 建立逐条追踪表**

设计说明中的每一项分别映射到：生产文件、自动化命令、冷启动点击步骤、截图文件和 reviewer verdict。缺任一必要证据即判未完成。

- [ ] **Step 2: 主智能体复看全部截图**

不得只读 QA 文字；主智能体逐张检查截图与参考图、布局、active 状态、弹卡、按钮和二级页是否对应。

- [ ] **Step 3: 复跑最终文档和工作树检查**

Run: `node scripts/verify-docs.mjs`

Run: `git diff --check`

Run: `git status --short`

Expected: 任务文件已提交；只剩用户既有的 `project.config.json` 和无关未跟踪文件。

- [ ] **Step 4: 仅在全部证据成立时交付**

最终报告列出 commit、检查结果、冷启动实际点击、截图目录、已知问题、真机未测项和微信上传步骤。任一 Critical/Important、必测点击或必需截图缺失时继续修复，不得缩小完成标准。

## Plan Self-Review

- Spec coverage: Task 1–5 覆盖“我的”顶部、统一分类 Tab、地图弹卡与按钮、首页保留项；Task 8 覆盖冷启动真实点击与截图；Task 9 覆盖交付前再次对照设计文档。
- Scope coverage: 服务、云函数、Dify、数据库、接口、路线、定位时机、首页/发现头图、地点列表、详情页、底部 Tab 与“我的”下半页均列为禁止修改。
- Type consistency: 分类值、`categorychange`、`onMapCategoryTap → applyCategory`、`openSelectedPlace`、`openEntry` 和既有 URL 保持当前签名。
- Placeholder scan: 所有文件、资源名、尺寸、命令、预期结果、截图目录和验收阈值均明确；不存在 TODO/TBD。

---

### Task 10: Make Both Category Bars Fill Their Available Width

**Files:**
- Modify: `miniprogram/components/category-filter/index.wxss`
- Modify: `miniprogram/pages/map/index.wxss`
- Modify: `tests/unit/visual-style.test.ts`
- Modify: `tests/unit/map-nearby-page.test.ts`

**Interfaces:**
- Consumes: 既有五项 `options` / `mapCategories` 数据及原 `bindtap`，不改变分类值或事件。
- Produces: 发现页搜索按钮右侧完整五等分分类栏，以及地图页无右侧空白的五等分分类栏。

- [ ] **Step 1: Write the failing width contract**

断言两个轨道均为 `display: flex; width: 100%; gap: 8rpx`，分类项均为 `flex: 1 1 0; width: auto; min-width: 0`，并移除 `.is-wide` 固定宽度。标签必须允许两行，不能使用 `white-space: nowrap` 或 `text-overflow: ellipsis`。

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `node .local-tools/package/bin/npm-cli.js test -- --run tests/unit/visual-style.test.ts tests/unit/map-nearby-page.test.ts`

Expected: FAIL，仅指向旧 `100rpx/184rpx/12rpx` 固定宽度契约。

- [ ] **Step 3: Implement equal-width tracks**

共享组件和地图原生覆盖层分别改用同一组 token：轨道 `width: 100%`、`gap: 8rpx`；项目 `flex: 1 1 0`、`width: auto`、`min-width: 0`、高度 `112rpx`；长标签两行居中。保留 `56rpx` 本地图标、边框、圆角、背景、阴影和选中态。

- [ ] **Step 4: Run focused and full verification**

Run: `node .local-tools/package/bin/npm-cli.js test -- --run tests/unit/visual-style.test.ts tests/unit/map-nearby-page.test.ts tests/unit/navigation.test.ts`

Expected: PASS。

Run: `node .local-tools/package/bin/npm-cli.js run typecheck && node .local-tools/package/bin/npm-cli.js run lint && node scripts/build.mjs --mode=demo && node scripts/check-package.mjs --mode=demo`

Expected: 全部退出码 0，构建输出 `Build ready: dist/ (demo)`。

- [ ] **Step 5: Commit the focused correction**

```powershell
git add -- miniprogram/components/category-filter/index.wxss miniprogram/pages/map/index.wxss tests/unit/visual-style.test.ts tests/unit/map-nearby-page.test.ts docs/superpowers/plans/2026-09-08-ui-correction-reset-plan.md
git commit -m "fix: fit all category tabs on screen"
```

- [ ] **Step 6: Cold-start visual QA**

完整关闭微信开发者工具并从项目列表重开。分别保存发现页默认状态和地图页默认状态截图，确认发现页搜索按钮与五分类全部可见、地图五分类填满栏宽且右侧无空白；逐项点击五分类，确认完整卡片热区仍可用。

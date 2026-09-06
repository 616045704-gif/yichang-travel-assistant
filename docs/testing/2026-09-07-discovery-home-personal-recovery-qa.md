# 发现、首页与个人服务恢复独立测试验收记录

- 角色：独立测试负责人（与开发和代码审查角色分离）
- 日期：2026-09-07（Asia/Shanghai）
- 被测实现基线：`3ba522a5049ed1488b460bfdfea4796650f99b01`（`fix: complete home featured actions`）；基础恢复提交为其父提交 `1dd36cbfe4e401ab23b19d01ac1d975f979ec0ff`（`fix: restore discovery home and personal service`）。
- 范围：发现页“全部”分类、首页精选地点、`userService` 部署包与详情收藏按钮紧凑样式。未修改应用代码、云端数据、配置、权限、密钥或用户已有文件。

## 实际执行项

| 命令 | 实际结果 |
| --- | --- |
| `node .local-tools/package/bin/npm-cli.js run test` | 最终复验通过：28 个测试文件通过、1 个集成测试文件跳过；252 个测试通过、1 个跳过。`place-service` 的“全部”与首页服务用例、首页精选事件模板断言和 `userService` SDK 清单断言均通过。每次首次受限沙箱运行时 Vitest/esbuild 创建子进程被拒绝（`spawn EPERM`）；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run lint` | 通过。 |
| `node .local-tools/package/bin/npm-cli.js run build` | 通过：`Build ready: dist/ (development)`。首次受限沙箱运行因 esbuild 子进程 `spawn EPERM` 失败；按权限流程在受限环境外复跑后通过。 |
| `node .local-tools/package/bin/npm-cli.js run check:package` | 通过：客户端路由、资源和边界检查通过。 |
| `node .local-tools/package/bin/npm-cli.js run verify:docs` | 最终复验通过：验证 36 份文档。 |
| `git diff --check 1dd36cb^..3ba522a` | 通过：无空白错误。 |

## 独立复核证据

- 前端 `listPlaces` 对空分类不再发送 `category` 字段；云函数 `listInput` 同时将空字符串规范为未筛选，形成前后端兼容。既有关键字、标签、游标和分页字段仍原样传递；新增服务用例实际验证空分类返回 `OK`。
- 新增 `home` 服务分支读取已发布列表前四项、复用收藏降级与封面临时 URL 解析；首页会在 `onShow` 调用该服务，并以 `loading`、`ready`、`empty`、`error` 状态渲染。
- `cloudfunctions/userService/package.json` 声明了 `wx-server-sdk@4.0.2`，与其他云函数部署包的运行时依赖一致；构建已生成云函数包。
- 详情页收藏按钮使用固定内容宽度的 flex 项、紧凑内边距和不换行样式，避免占用标题行的剩余宽度。

## 缺陷与结论

### P1-01：首页精选地点卡片没有可用的详情跳转

首页模板将精选项渲染为 `<place-card>`，但未绑定组件的 `open` 事件，首页脚本也没有对应的 `openPlace` 方法。`place-card` 点击区域只会触发 `open` 自定义事件；没有父页面监听时不会导航到详情页。因此精选卡片呈现为可点击地点卡片，却不能进入共用详情页。

最小修复：在首页为 `place-card` 添加 `bind:open="openPlace"`，并实现与发现页一致的 `wx.navigateTo` 跳转；新增自动化用例覆盖该事件和详情路由。

#### P1-01 复验结果：已修复

`3ba522a` 在首页 `place-card` 添加 `bind:open="openPlace"`，并实现 `openPlace`，以 URL 编码的 `placeId` 跳转到共用详情页。视觉模板自动化断言确认该绑定存在；类型检查、构建和完整测试套件通过。未在模拟器或真机实际点击，见未测项。

### P1-02：新增 userService 部署依赖没有直接自动化覆盖

本提交新增 `cloudfunctions/userService/package.json` 以解决部署时 SDK 缺失，但未找到针对该清单的直接自动化断言。现有 `build.test.ts` 仅直接断言 `aiService` 与 `placeService` 的 SDK 清单。完整构建成功不等同于精确验证该运行时依赖。

最小修复：仿照既有两项 SDK 清单测试，新增 `userService` 依赖严格等于 `wx-server-sdk@4.0.2` 的断言。

#### P1-02 复验结果：已修复

`3ba522a` 在 `build.test.ts` 新增 `userService` 部署清单断言，严格验证其依赖为 `wx-server-sdk@4.0.2`；该文件 45 个用例及完整测试套件均实际通过。

### 放行结论

空分类兼容、搜索参数保持、首页服务数据加载及详情跳转、`userService` SDK 部署包自动化覆盖、收藏按钮紧凑样式以及本地构建检查均通过；P1-01 与 P1-02 已关闭，**放行本地可运行范围**。该结论不等同于云端部署、真实个人记录或真机体验通过。

## 未测项与限制

- 未部署或调用真实 `userService`；未验证微信身份、收藏写入、浏览记录、SDK 安装或真实函数日志。
- 未在 CloudBase 验证 `home` 服务、封面临时 URL、真实已发布地点排序或网络失败。
- 未在微信开发者工具、Android 或 iPhone 真机验证“全部”列表、首页精选加载、精选跳转、收藏按钮实际尺寸或收藏反馈。
- 未改动或验证 Dify、环境变量、密钥、云数据库权限或用户数据。

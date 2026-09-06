# 发现、首页与个人服务恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复全部/搜索、首页精选、个人记录服务和详情收藏按钮。

**Architecture:** 前端省略空分类，云端兼容空分类；首页经既有 placeService 读取有封面优先的已发布地点；userService 只补齐可部署 SDK 依赖。

**Tech Stack:** TypeScript、Vitest、微信小程序、CloudBase。

## Global Constraints

- 不更改 Dify、密钥、环境变量、数据库权限或已存在地点资料。
- 收藏、浏览和偏好继续只以可信微信身份访问。
- 每项行为先补测试，功能和验收记录分别提交。

### Task 1: 地点列表与首页

**Files:** `miniprogram/services/places.ts`, `cloudfunctions/places/service.ts`, `miniprogram/pages/home/*`, `tests/unit/place-client.test.ts`, `tests/unit/place-service.test.ts`。

- [ ] 写空分类与首页动作失败测试；客户端省略空分类、服务端兼容空分类、实现 `home` 返回四条有封面优先地点，首页加载并渲染 `place-card`。
- [ ] 运行相关测试、类型和静态检查，提交 `fix: restore discovery and home places`。

### Task 2: 个人服务与收藏样式

**Files:** `cloudfunctions/userService/package.json`, `miniprogram/pages/place-detail/index.wxss`, 对应构建/样式测试。

- [ ] 写部署包 SDK 和紧凑按钮失败测试；补齐 `wx-server-sdk@4.0.2` 与按钮固定紧凑样式。
- [ ] 运行完整检查，提交 `fix: restore personal service deployment`。

### Task 3: 独立验收与部署

- [ ] 独立测试角色复验提交、记录实际结果和未测项；部署 `placeService`、`userService` 后在开发者工具验证真实路径。

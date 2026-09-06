# 用户提供地点图片绑定实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为已登记的 25 个用户提供地点图片建立可追溯的云存储绑定：每个地点的第 1 张图片作为列表封面，第 2、3 张图片显示在地点详情页。

**Architecture:** 本地图片清单是唯一的授权与映射来源。先用自动化测试固定清单约束，再在当前开发环境的云开发控制台逐条读取并更新对应的 `places` 与 `place_contents` 文档。应用仍通过既有 `placeService` 读取数据，不新增前端硬编码数据、云函数、权限或环境变量。

**Tech Stack:** TypeScript、Vitest、微信小程序、CloudBase 云数据库与云存储、现有 `placeService` 云函数。

## 全局约束

- 只处理 `content/featured-place-images.json` 中的 25 条 `sourceType: "user_provided"` 记录；不得顺带修改其余地点。
- 每条记录必须恰有 3 个不重复的 `objectNames`；第 1 项写入 `places.coverFileId`，第 2、3 项以图片节追加到配对 `place_contents.sections`。
- 仅使用当前开发云环境中已存在、且对象名与清单完全一致的云存储图片；不上传、删除或替换图片。
- 写入前逐条确认地点已发布、分类匹配、坐标仍为 GCJ-02，且存在唯一配对详情文档；任一前置条件不满足则停止该条并记录，不猜测或创建新文档。
- 原有文字详情、分类、名称、状态、坐标和其他字段必须原样保留。详情图片使用 `{ type: "image", fileId, alt }`，其中 `alt` 为地点名加图片序号。
- 不修改 Dify、密钥、环境变量、云开发权限、数据库安全规则或云函数的公开接口。
- 验收记录不得写入云环境标识、云文件 ID、函数 ID、密钥或用户身份信息。

---

## 任务 1：固定用户提供图片清单的自动化保护

**文件：**

- 修改：`tests/unit/featured-image-manifest.test.ts`
- 验证：`content/featured-place-images.json`

- [ ] **步骤 1：添加实际清单完整性测试。**

  在现有清单测试中读取 `content/featured-place-images.json`，断言清单为 25 条、全部为 `user_provided`、每条有 3 个不重复的对象名、分类仅在允许类别内，并继续复用 `validateFeaturedImages` 断言无校验错误。

- [ ] **步骤 2：运行目标测试。**

  Run: `node .local-tools\package\bin\npm-cli.js run test -- tests/unit/featured-image-manifest.test.ts`

  Expected: 清单测试全部通过，且缺失对象名、重复对象名或未授权来源会被测试捕获。

- [ ] **步骤 3：运行相关静态检查。**

  Run: `node .local-tools\package\bin\npm-cli.js run typecheck`

  Run: `node .local-tools\package\bin\npm-cli.js run lint`

  Expected: 两项检查通过。

- [ ] **步骤 4：创建聚焦提交。**

  ```powershell
  git add tests/unit/featured-image-manifest.test.ts
  git commit -m "test: protect user-provided place image manifest"
  ```

## 任务 2：云端写入前置核对与可恢复快照

**文件：**

- 新建：`docs/testing/2026-09-07-user-provided-image-binding-preflight.md`
- 读取：`content/featured-place-images.json`
- 读取/写入：当前开发云环境的 `places`、`place_contents` 与云存储对象

- [ ] **步骤 1：逐条进行只读前置核对。**

  对 25 条清单记录逐条核对：云存储中 3 个对象都存在；`places` 中存在对应 ID、`published` 为 `true`、分类一致、坐标系为 GCJ-02；存在唯一的 `place_contents` 配对文档。将汇总数量、通过/阻止项和未测项写入前置核对记录；不记录云文件 ID。

- [ ] **步骤 2：记录仅限本次操作使用的恢复快照。**

  在执行界面中保留每一条更新前的 `coverFileId` 和 `sections` 值，仅在本次会话用于回退。快照不得提交到仓库、不得包含敏感标识。

- [ ] **步骤 3：验证前置记录格式。**

  Run: `node .local-tools\package\bin\npm-cli.js run verify:docs`

  Expected: 文档检查通过，记录清晰说明 25 条目标、实际核对结果和任何阻止项。

- [ ] **步骤 4：创建聚焦提交。**

  ```powershell
  git add docs/testing/2026-09-07-user-provided-image-binding-preflight.md
  git commit -m "docs: record place image binding preflight"
  ```

## 任务 3：按清单绑定封面与详情图片

**读取/写入：**

- 当前开发云环境 `places`：只更新 25 条目标文档的 `coverFileId`
- 当前开发云环境 `place_contents`：只向对应 25 条目标详情的 `sections` 末尾追加两项图片节

- [ ] **步骤 1：从云存储读取每条对象的实际文件标识。**

  只读取名称与清单完全一致的三个对象，取得控制台返回的文件标识。文件标识必须属于当前开发环境；找不到或不匹配则停止该条。

- [ ] **步骤 2：写入封面。**

  对每个已通过前置核对的地点，将第 1 个对象的文件标识写入 `places.coverFileId`。写后立即重新读取该文档，确认值精确一致且未改变其他字段。

- [ ] **步骤 3：追加详情图片节。**

  保留原有 `sections` 的所有元素及顺序，在末尾依次追加第 2、3 个对象：

  ```json
  { "type": "image", "fileId": "当前开发环境中的已核对文件标识", "alt": "地点名图片 2" }
  { "type": "image", "fileId": "当前开发环境中的已核对文件标识", "alt": "地点名图片 3" }
  ```

  写后重新读取并确认原文字节未被替换、恰好新增两项图片节、顺序与清单一致。

- [ ] **步骤 4：失败时精确回退。**

  任一条写后验证失败，立即使用该条的会话恢复快照恢复 `coverFileId` 与 `sections`，记录失败原因并停止该条的后续写入。已经验证通过的其他地点不作无关回写。

- [ ] **步骤 5：执行项目验证。**

  Run: `node .local-tools\package\bin\npm-cli.js run test`

  Run: `node .local-tools\package\bin\npm-cli.js run build`

  Run: `node .local-tools\package\bin\npm-cli.js run check:package`

  Expected: 自动化测试、构建和小程序包检查均通过；无需为了数据绑定修改应用代码。

## 任务 4：独立验收、运行检查与交付记录

**文件：**

- 新建：`docs/testing/2026-09-07-user-provided-image-binding-qa.md`
- 读取：`pages/discover`、`pages/place-detail`、当前开发云环境的目标数据

- [ ] **步骤 1：由独立测试角色复核云端结果。**

  对 25 条目标抽取覆盖四类地点的记录，独立核验封面字段、两项详情图片节、原有文字详情保留，以及非目标地点未改动。记录被测 Git commit、实际执行项、结果、缺陷和未测项。

- [ ] **步骤 2：在微信开发者工具实际运行。**

  编译当前工作区，检查发现页四类筛选至少各显示一张已绑定封面；进入覆盖四类的详情页，检查封面与第 2、3 张详情图片可见。若云图片加载失败，记录响应与地点范围，不把失败伪装为通过。

- [ ] **步骤 3：运行交付前完整检查。**

  Run: `node .local-tools\package\bin\npm-cli.js run test`

  Run: `node .local-tools\package\bin\npm-cli.js run typecheck`

  Run: `node .local-tools\package\bin\npm-cli.js run lint`

  Run: `node .local-tools\package\bin\npm-cli.js run build`

  Run: `node .local-tools\package\bin\npm-cli.js run check:package`

  Run: `node .local-tools\package\bin\npm-cli.js run verify:docs`

  Expected: 全部通过；如果有未测项或云端加载问题，验收记录明确标注，不声称已放行。

- [ ] **步骤 4：创建独立验收记录提交。**

  ```powershell
  git add docs/testing/2026-09-07-user-provided-image-binding-qa.md
  git commit -m "docs: record user-provided image binding QA"
  ```

## 最终复核

- [ ] 确认每个代码或文档提交都是聚焦的，未暂存用户已有的无关改动。
- [ ] 确认仅 25 个清单地点发生云端字段更新，且每条都有 1 张封面和 2 张详情图片。
- [ ] 确认不提交或展示云环境标识、文件标识、密钥、Dify 配置或用户数据。
- [ ] 确认独立验收记录如实说明已测与未测范围。

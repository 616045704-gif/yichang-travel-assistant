# 宜昌旅游 AI 微信小程序分阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可通过微信体验版二维码运行的宜昌旅游小程序，完成地点发现、地图附近、收藏记录、真实 AI 问答和行程定制的面试演示闭环。

**Architecture:** 原生微信小程序只承担展示、交互和主动授权定位；业务统一通过微信云函数访问云数据库和云存储。AI 先完成明确标记的模拟交互，再通过云函数先检索本地已核验地点、后调用用户现有 Dify 应用；后端控制用户归属、调用额度、任务状态及来源展示。

**Tech Stack:** 原生微信小程序、TypeScript、WXML、WXSS、微信地图组件、微信云开发数据库/存储/Node.js 云函数、现有 Dify 应用；拟采用 Vitest、TypeScript 检查、ESLint 和微信开发者工具自动化。具体版本在任务 01 核验、任务 02 锁定，不假定本地已经安装。

## Global Constraints

以下是设计说明和 AGENTS.md 的项目级原文约束，全部任务均适用：

- 首版目标是完成真实可运行的体验版，而非公开运营产品。
- 首版不要求手机号登录，不包含支付、购票、预约或商家入驻。
- 首版导入约 20–30 条精选地点资料。地点内容存在云数据库，图片存在云存储，不硬编码到小程序页面。
- 用户主动点击“定位我的附近”后才申请位置授权。
- 授权后显示当前位置 20 公里内的四类地点，可按分类筛选。
- 用户资料类集合仅允许用户通过云函数访问自己的记录；公共地点资料由后端读取。
- Dify API 地址和 API Key 仅由用户在云函数环境变量中配置，绝不写入前端代码、数据库或版本库。
- 不会复刻、迁移或替换用户已有的 Dify Agent、知识库、模型或提示词。
- 云函数必须先查询本地地点数据库，再调用 Dify 聊天助手。
- 传给 Dify 的本地已核验资料优先级高于知识库补充内容；资料冲突时以本地资料为准。
- 对没有可靠资料的问题，AI 必须说明不确定，不得虚构价格、营业状态、交通时刻或预约政策。
- AI 页面必须展示“内容仅供出行参考，请以景区、交通等官方公告为准”。
- 位置仅在用户主动点击定位后读取，仅用于当前 20 公里筛选，默认不长期保存。
- 公开内容不直接复制其他小程序，易变信息需标记资料来源和最后核验时间。
- Dify 或网络异常时必须展示可理解的重试提示，不能白屏或伪造成功。
- 每完成一项逻辑改动，必须创建一个对应的、聚焦的 Git commit；提交信息使用清晰的 Conventional Commit 风格，例如 `feat: add place detail page`。
- 提交前和交付前，必须运行所有与改动有关的测试、静态检查和验证命令。任何相关检查失败时，不得提交或交付。
- 不得将无关改动混入同一个 commit，不得使用 `git add .`。

---

## 0. 阅读顺序、当前基线与计划使用方式

1. 先读根目录 `AGENTS.md`。
2. 产品范围以 `docs/superpowers/specs/2026-09-04-yichang-travel-mini-program-design.md` 为准。
3. 参考 `docs/superpowers/specs/2026-09-04-yichang-travel-mini-program-technical-design.md` 的技术建议；该文件在本计划编写时为未跟踪的 V1.0 评审稿，不视为已获批准的新范围，不修改、不顺带提交。
4. 已有 `docs/superpowers/plans/2026-09-04-repository-bootstrap-plan.md` 只覆盖仓库初始化；本计划承接其结果，不重复初始化 Git。

基线：2026-09-04，HEAD 为 `3a1b145 chore: initialize project workflow`；目前只有项目文档、Git 配置和规则，没有业务源码、依赖清单或测试程序。本文件中的源码路径、脚本及测试命令都是后续任务要创建的目标，不能现在宣称已经通过。

本次只写实施计划，不生成业务代码，也不连接账号、创建云资源、修改 Dify、导入真实资料或上传体验版。遵照用户“先不要写代码”，以下使用接口契约、具体验收用例和操作清单，不附实现代码或测试代码。

项目包含多个子系统，建议按阶段独立执行和审查；为保持跨模块接口一致，本次提供一份完整主计划。若后续需要多人并行，可把同一阶段的任务摘成独立执行计划，仍以本文契约和依赖为准。当前没有启动任何子代理；执行时由用户选择同会话分批执行或子代理方式。

## 1. 阶段、依赖与检查关口

| 阶段 | 任务 | 可演示/可验收产物 | 放行条件 | 工作量估算 |
| --- | --- | --- | --- | --- |
| P0 准备与契约 | 01–03 | 账号能力清单、可构建空壳、接口契约 | 环境与工具明确；前后端共用类型；无密钥进仓库 | 2–3 人日 |
| P1 页面与模拟 AI | 04–07 | 四导航页、共用详情、聊天/行程完整交互 | 本地自动化通过；模拟 AI 明示；未接数据库时地点为空状态 | 3–4 人日 |
| P2 数据与用户闭环 | 08–12 | 20–30 地点、云图片、列表详情、收藏历史偏好反馈 | 全部内容由云端提供；双用户隔离；重启仍可读取 | 4–6 人日 |
| P3 地图与隐私 | 13–14 | 默认地图、20 公里附近、拒绝授权降级 | 距离边界准确；不主动定位；位置无持久化 | 2–3 人日 |
| P4 真实 AI | 15–19 | 本地检索、可靠任务、Dify 问答和行程历史 | 主体功能稳定；真实调用；资料优先、失败和限额测试通过 | 5–7 人日 |
| P5 质量与真机 | 20–21 | 安全回归、Android/iPhone 测试证据 | 所有验收底线通过；无未关闭阻断缺陷 | 2–3 人日 |
| P6 体验版交付 | 22–23 | 体验二维码、成员、演示脚本、录屏和回滚手册 | 两个真实体验成员可扫码；真实 AI 开启；发布复验通过 | 1–2 人日 |

合计估算 19–28 人日，不是承诺日期；平台申请、素材授权、用户确认及设备等待时间另外计算。任务 01 后依据实际接入条件再安排日历，不以面试时间倒逼跳过安全或真实 AI 验收。

主依赖：P0 → P1 → P2 → P3 → P4 → P5 → P6。素材收集可自 P0 开始，由内容负责人独立推进；真实 Dify 集成只在 P3 放行后开始。P0 仅登记现有 Dify 应用信息，不进行模型生成或改配置。

负责人沿用设计中的产品、UI、前端、后端、测试、统筹角色；这表示职责分工，不自动授权创建代理、变更模型或向他人分派任务。

2026-09-04 已核对用户原先组建团队并要求补齐专职测试的明确约定；应用模块按[团队测试交接规则](../../testing/team-handoff.md)安排独立测试。该约定不扩大到创建新的用户任务、对外联系或购买服务，模型变更仍须遵守用户授权。

### 外部条件与暂停边界

| 条件 | 提供方 | 最迟需要 | 缺失时可继续做什么 / 不能做什么 |
| --- | --- | --- | --- |
| AppID、开发权限、可用云环境和预算授权 | 用户 | 08；真机位置能力在 14 前 | 可做本地开发；不得代用户开通付费套餐 |
| 小程序类目及位置接口使用资格、隐私配置权限 | 用户与平台 | 14 | 可做模拟授权测试；未核验不得宣布真机定位可用 |
| 20–30 地点资料、图片使用权、核验负责人 | 用户/内容负责人 | 09 | 可用合成测试夹具；不得当成真实地点导入体验环境 |
| Dify 应用类型、部署版本、API 输入与响应文档 | 用户 | 17 | 可完成本地检索和任务模拟；不得推测配置或索要明文 Key 入聊天 |
| 现有应用的本地资料优先规则可用性 | 用户 | 17 | 缺少规则时，先请求最小配置调整许可；不私自替换提示词 |
| 隐私文案、保留期、反馈接收职责 | 产品负责人 | 14/21 | 开发按候选策略测试；未确认不开放真实体验数据 |
| Android、iPhone、两个测试微信账号、体验成员和展示时间 | 用户/测试负责人 | 21/22 | 可运行自动化；不得将模拟器结果当双端真机结果 |

## 2. 目标目录与职责

本节是路径约定，执行时创建；不调整现有设计文件。每个页面目录均包含 `index.ts`、`index.wxml`、`index.wxss`、`index.json`，组件同样使用这四个文件。

| 路径 | 职责 |
| --- | --- |
| `package.json`、`package-lock.json`、`tsconfig.json`、`eslint.config.mjs`、`vitest.config.ts` | 锁定依赖、检查和测试命令 |
| `project.config.json`、`miniprogram/app.ts`、`miniprogram/app.json`、`miniprogram/app.wxss` | 小程序入口、四个 tab、云环境初始化和基础样式 |
| `miniprogram/config/runtime.ts`、`miniprogram/styles/tokens.wxss` | 构建模式、非敏感环境选择、颜色/间距/圆角令牌 |
| `miniprogram/pages/home/`、`discover/`、`map/`、`me/` | 首页、发现、地图、我的 |
| `miniprogram/pages/place-detail/`、`ai-chat/`、`trip-form/` | 共用地点详情、自由问答、行程表单与结果 |
| `miniprogram/pages/records/`、`ai-history/`、`preferences/`、`privacy/`、`feedback/` | 收藏/浏览列表、会话历史、偏好、隐私说明、反馈 |
| `miniprogram/components/place-card/`、`category-filter/`、`async-state/`、`message-bubble/`、`source-card/` | 小而单一职责的可复用组件 |
| `miniprogram/services/cloud.ts`、`places.ts`、`user.ts`、`ai.ts`、`location.ts`、`feedback.ts` | 页面之外的后端适配和授权边界 |
| `miniprogram/view-models/place-list.ts`、`chat.ts`、`map.ts` | 可独立测试的分页、聊天轮询、地图状态管理 |
| `shared/contracts.ts`、`shared/validation.ts` | 不含服务端依赖的请求/响应类型、纯校验规则 |
| `cloudfunctions/placeService/index.ts`、`userService/index.ts`、`aiService/index.ts`、`feedbackService/index.ts` | 客户端可调用的业务入口 |
| `cloudfunctions/aiWorker/index.ts`、`maintenance/index.ts` | 仅服务端可触发的 AI 执行与过期任务/数据维护 |
| `cloudfunctions/common/auth.ts`、`response.ts`、`logging.ts`、`db.ts` | 可信身份、错误信封、脱敏日志、数据库适配 |
| `cloudfunctions/places/repository.ts`、`distance.ts`、`storage.ts` | 地点查询、球面距离、文件 ID 解析 |
| `cloudfunctions/users/repository.ts`、`cloudfunctions/ai/jobs.ts`、`quota.ts`、`retrieval.ts`、`context.ts`、`dify.ts`、`sources.ts` | 用户归属、AI 任务/额度/检索/上下文/外部适配/来源校验 |
| `database/schema.md`、`indexes.json`、`security-rules.json`、`storage-rules.md` | 数据字典、索引、客户端默认拒绝、图片访问规则 |
| `content/places.seed.json`、`content/place-contents.seed.json`、`content/source-register.md` | 经核验的可发布公开资料和版权台账 |
| `scripts/build.mjs`、`check-package.mjs`、`verify-docs.mjs`、`validate-content.mjs`、`import-content.mjs`、`release-check.mjs` | 构建、包隔离、文档/内容校验、管理端导入、发布检查 |
| `tests/unit/`、`tests/contracts/`、`tests/integration/`、`tests/e2e/`、`tests/fixtures/` | 单元、契约、真实开发云、开发者工具测试与合成夹具 |
| `docs/runbooks/`、`docs/testing/` | 能力核验、数据导入、Dify 配置、发布及脱敏验收记录 |

构建输出统一至被忽略的 `dist/`：`dist/miniprogram/` 仅含客户端资源；每个可部署云函数单独输出到 `dist/cloudfunctions/<函数名>/`，包含打包后的 CommonJS 入口和自身运行依赖声明，不能依赖云端存在相邻源码目录。测试夹具、模拟适配器、服务端代码和文档均不得进入体验版小程序包。

## 3. 前后端契约与产品口径

### 3.1 基础类型和公共规则

- `Category` 取值固定为 `scenic`、`restaurant`、`culture`、`camping`，对应景区、餐馆、文化馆/博物馆、露营地。
- `PlaceSummary`：`placeId, name, category, district, address, latitude, longitude, coordinateSystem, intro, tags, coverFileId, coverUrl, isFavorite, verifiedAt`；仅附近结果增加 `distanceMeters`。坐标统一 GCJ-02，缺坐标不得发布地图点。
- `PlaceDetail` 在摘要上增加 `openNotice, visitAdvice, diningInfo, sources, sections`；不适用的餐饮信息或时长为 null，不编造。`sections` 仅支持文本和云图片，不支持任意 HTML。
- `Source`：`kind(local_verified/knowledge_reference), title, url, verifiedAt, placeId`；本地已核验卡片与 Dify 实际引用分组展示，缺失的字段为 null，不补造。
- `PageResult<T>`：`items, nextCursor`。默认 `pageSize=20`，最大 50；游标是不含用户身份的受校验分页位置，非法游标返回输入错误。
- `ApiResult<T>`：`code, data, message, traceId`；成功 `code=OK`，失败数据为 null。错误枚举：`INVALID_INPUT, UNAUTHENTICATED, NOT_FOUND, CONFLICT, RATE_LIMITED, NETWORK_ERROR, AI_UNAVAILABLE, AI_TIMEOUT, INTERNAL_ERROR`。他人资源与不存在资源统一返回 `NOT_FOUND`，避免泄露存在性。
- 前端不传 `ownerId/openid`。服务端从可信调用上下文取身份；无身份立即拒绝。服务端时间使用 UTC 存储，界面按用户时区展示；每日额度按 Asia/Shanghai 切日。
- `TripInput`：`destination, people, totalBudgetCny, days, preferences`。候选产品口径：目的地限宜昌及收录区域；人数 1–20 整数；天数 1–7；全团人民币总预算 1–100000 元，不含往返宜昌大交通，允许两位小数；偏好最多 6 个。任务 01 确认文案，不能把总预算解释成人均预算。
- 普通问题 trim 后 1–1000 字符；反馈 1–1000 字符；关键词最多 50 字符；所有入口在服务端复验类型、枚举、范围和未知字段，不执行用户提供的数据库表达式或正则。

### 3.2 云函数动作表

以下函数名和动作名在所有任务、测试和文档中保持一致；均返回 `ApiResult`。

| 函数/动作 | 输入 | 成功数据 |
| --- | --- | --- |
| `placeService.home` | 无 | `featured: PlaceSummary[]`、`recommended: PlaceSummary[]`（由 app_settings 控制） |
| `placeService.list` | `category?, keyword?, tags?, cursor?, pageSize?` | `PageResult<PlaceSummary>` |
| `placeService.detail` | `placeId` | `PlaceDetail` |
| `placeService.markers` | `category?` | 已发布地点的精简点位列表，不附用户当前位置 |
| `placeService.nearby` | `latitude, longitude, category?` | `radiusMeters=20000, items: PlaceSummary[]`，按距离升序 |
| `userService.setFavorite` | `placeId, favorite:boolean` | `placeId, favorite`，重复同值不反转 |
| `userService.recordBrowse` | `placeId` | `placeId, viewedAt` |
| `userService.listRecords` | `type: favorites/browse/trips, cursor?, pageSize?` | 当前用户记录的分页结果 |
| `userService.getPreferences` | 无 | `preferences: string[]` |
| `userService.savePreferences` | `preferences: string[]` | 服务端持久化后的偏好 |
| `aiService.submit` | `requestId, sessionId?, kind: chat/trip, question? / trip?` | `jobId, sessionId, status`；chat 只允许 question，trip 只允许 trip |
| `aiService.getResult` | `jobId` | `jobId, sessionId, status, answer?, localFacts, references, error?, mode: mock/live` |
| `aiService.listSessions` | `cursor?, pageSize?` | `PageResult<SessionSummary>`（不返回 Dify 会话标识） |
| `aiService.listMessages` | `sessionId, cursor?, pageSize?` | `PageResult<Message>`，每条含角色、正文、来源、状态、时间 |
| `feedbackService.submit` | `kind: place/ai/general, targetId?, content` | `feedbackId, status=received`；纠错检查地点存在，AI 反馈检查本人消息归属 |

`SessionSummary` 为 `sessionId,title,kind,updatedAt`；`Message` 为 `messageId,jobId,role,content,localFacts,references,status,createdAt`。行程历史返回 `tripId,jobId,sessionId,input,status,result,createdAt`，通过 `jobId` 查询本人结果。

`aiWorker` 和 `maintenance` 不是前端动作。它们验证平台可信内部调用身份/触发器上下文，不接受客户端传来的“内部调用=true”；权限和部署身份具体机制在任务 16 的开发云实测后锁定。

### 3.3 状态、错误和重试

- 页面状态固定覆盖 loading、ready、empty、error；加载失败保留明确重试按钮，不把失败渲染成空数据。
- 收藏等待服务端确认后改变最终状态，失败保留原值；重复点击不产生重复记录。
- AI：`queued → running → succeeded / failed / timed_out`；终态不可被迟到回调覆盖。模拟回复 `mode=mock`，体验版只允许 `mode=live`。
- `requestId` 用于一次用户提交的幂等。网络结果不明时用原 requestId 查回原任务；明确终态后，用户主动重试生成新 requestId 并提示可能再次调用模型。
- 同一会话只允许一个进行中的请求；同一 requestId 换问题返回 `CONFLICT`，不能返回与当前输入不符的旧答案。
- 前端按 1、2、3、5 秒间隔轮询，之后上限 5 秒；页面隐藏/离开停止轮询，返回按 jobId 恢复；超过界面等待目标显示仍在处理中，不据此伪造服务端超时。

## 4. 数据库、图片、隐私和 AI 边界

### 4.1 集合、字段与索引

所有集合默认拒绝客户端直接读写；云函数使用特权 SDK 时仍必须显式验证归属，不能以“数据库规则已配置”代替后端鉴权。

| 集合 | 必要字段（除 `_id`） | 索引/一致性规则 |
| --- | --- | --- |
| `places` | 摘要事实字段、aliases、status、source 信息、verifiedAt、updatedAt | status+category+name+_id；status+updatedAt；仅 published 对外可见 |
| `place_contents` | placeId、sections、visitAdvice、diningInfo、notices | `_id=placeId`，一地一文档 |
| `favorites` | ownerId、placeId、createdAt | 确定性 ID=hash(ownerId,placeId)；ownerId+createdAt+_id |
| `browse_history` | ownerId、placeId、viewedAt | 确定性 ID=hash(ownerId,placeId)；ownerId+viewedAt+_id |
| `ai_sessions` | ownerId、title、kind、difyConversationId、activeJobId、updatedAt | ownerId+updatedAt+_id；会话锁与任务领取事务协调 |
| `ai_messages` | ownerId、sessionId、jobId、role、content、localFacts、references、status、createdAt | ownerId+sessionId+createdAt+_id；任务+角色确定性 ID |
| `trip_requests` | ownerId、sessionId、jobId、input、result、status、createdAt | ownerId+createdAt+_id；`_id=jobId` |
| `feedback` | ownerId、kind、targetId、content、status、createdAt | ownerId+createdAt；仅管理端处理，无普通用户跨人查询入口 |
| `app_settings` | featuredPlaceIds、recommendedPlaceIds、aiEnabled、限额数值 | 固定公开投影，管理端写入；不含 Dify 地址和凭据 |
| `user_preferences` | ownerId、preferences、updatedAt | `_id=hash(ownerId)` |
| `ai_jobs` | ownerId、requestId、inputHash、sessionId、kind、status、attempt、deadlineAt、leaseToken、result、errorCode、createdAt、updatedAt | 确定性 owner+request ID；status+createdAt；status+deadlineAt |
| `usage_counters` | ownerId、windowType、windowStart、count、expiresAt | 确定性 owner+窗口 ID；扣减与创建任务在事务内完成 |

后三个集合为落实偏好持久化、幂等和限流所需的内部支撑，不新增用户功能。ownerId 来自可信身份，仅留在服务端。客户端返回字段使用白名单，不返回 ownerId、Dify ID、内部错误堆栈。

初期数据小，名称/别名/标签筛选可在后端分页读取已发布精简数据后内存过滤；必须遍历完数据库分页，不得依赖某个 SDK 默认返回全部。用户记录一律服务端筛选身份后分页，不能下载其他用户数据再筛选。

### 4.2 地点资料和图片

- 每条地点必须有可追溯来源、核验日期、分类、有效坐标和版权清晰的封面；四类均有覆盖，总计 20–30 条。来源不可用、图片权利不明或坐标不明的条目保持 draft。发布验收统计的是云端 published 条目，不能以 seed 文件总数或 draft 条目凑数。
- 图片存云存储，数据库保存 fileId；临时 URL 按需解析，过期重新取，不把短期 URL 当永久地址。普通用户不得上传/覆盖公共地点图片。
- `source-register.md` 记录公开来源 URL、资料字段对应关系、图片权利依据和核验日期，不放用户私人授权文件；授权证据私下保管。
- 批量导入先 dry-run，再导入开发环境，人工抽检后导入演示环境。稳定 placeId 幂等 upsert，不删除集合、不覆盖用户记录；先建 draft、补图片与内容、验证后再发布。
- 距离公式使用同一 GCJ-02 坐标体系的球面距离；先以未取整米数判断 `<=20000`，再格式化显示。默认地图中心采用明确标注的宜昌城区中心配置，不代表用户位置。

### 4.3 隐私候选策略（体验前确认）

- 位置只存在当前页面内存和附近请求参数；不写数据库、本地 storage、AI 请求、埋点、普通日志；离开地图清空位置和附近临时结果。返回地图默认城区视图，不自动重新读取位置。
- AI 问题/回答需持久化才能回看；候选保留期为 90 天，浏览记录 90 天、反馈 90 天、终态 AI 任务 7 天、额度窗口 2 天；收藏和偏好在受控体验期间保留，体验项目关闭时统一安排清理。到期清理只在用户批准期限后部署。
- 隐私说明明确：问题和行程参数会发送给外部 AI 服务；不发送定位结果、微信身份或设备标识；用户自填的敏感文字仍可能外传，因此输入区提醒不填写身份证、电话等信息。
- 现有 Dify 侧的会话保留和删除规则由用户确认并如实告知；本地清理不等于 Dify 记录已删除。不新增没有配套实现的“一键跨系统删除”承诺。

### 4.4 AI 可靠性与成本

- 默认候选限额：每人每分钟 3 次、每天 20 次、输入 1000 字符；创建新任务时原子计数，同 requestId 不重复计数。到达外部服务后的失败/超时不自动返还额度，避免重试造成无界成本；界面说明已发起请求可能计入次数。
- 数据库不可用时不绕过检索直接问 Dify。检索候选最多 8 地点，上下文总计最多 12000 字符，只传公开事实、来源和核验时间；按名称/别名精确匹配、分类/区域/标签顺序选择。
- 目的地歧义时返回需要补充的提示，不随意选地；没有命中只说明本地未收录，不推断地点不存在。
- 本地事实卡片由后端直接生成；AI 生成内容标为建议，知识库引用仅使用服务端校验过的 Dify 引用元数据，不把“给模型看过的资料”伪装成它实际引用。
- 系统级本地优先规则必须核验。若现有 Dify 不支持且用户不允许最小调整，则真实 AI 阶段阻塞；仅把约束塞进问题不是验收合格的替代品。
- Dify 适配器根据现有应用模式使用阻塞或服务端消费流式事件，前端首版无需逐字流式。完整结束事件/有效完整响应之前不写成功；断流、空答案、暂停待人处理等不当成成功。
- 超时配置候选：worker 120 秒、Dify 请求 90 秒、留 15 秒收尾；实际数值必须在部署环境允许范围内，并满足 Dify 请求+收尾 < worker 时限。若现有应用耗时不满足，报告阻塞，不擅自换 Agent、模型或后端架构。
- 输出目标最多 4000 字符用于展示/存储；模型侧 token 限制需由现有 Dify 配置支持并经用户同意。客户端截断不能替代费用控制。应用无法设置硬 token 上限时，用调用额度和平台费用告警兜底，并明确剩余风险。
- 可靠执行采用平台已验证的异步调用；提交函数写任务后等待平台接受投递才返回，不依赖未 await 的后台 Promise。补偿任务只重新投递从未开始的 queued 任务；running 超时标记结果未知，不自动再次调用 Dify。

## 5. 自动化与提交规约

任务 02 建立以下命令；后续所有源码任务先写失败测试、运行确认失败、再实现、重跑相关测试，最后检查并提交。文档任务不要求伪造自动化业务测试，使用文档/链接/差异验证并在提交正文说明。

| 命令 | 定义与成功标准 |
| --- | --- |
| `npm ci` | 按 lockfile 安装成功，退出 0；首次任务 02 用安装生成锁文件 |
| `npm run typecheck` | 客户端、共享契约、云函数、测试类型检查均无错 |
| `npm run lint` | 所有源文件和测试无 lint 错误 |
| `npm run test -- tests/unit/<文件>.test.ts` | 执行具体用例，全部通过；红灯阶段必须是预期行为缺失而不是工具未安装 |
| `npm run test` | 单元和契约测试全部通过；不调用真实 Dify、不读取生产数据 |
| `npm run test:coverage` | 距离、鉴权、额度、任务状态等关键模块分支覆盖率至少 90%；全局至少 80% |
| `npm run build` | 生成独立客户端包和每个云函数可部署包，不含测试和机密 |
| `npm run check:package` | 检查路由/资源存在、禁止前端 Dify 请求与服务端模块、演示包无 mock 适配器 |
| `npm run verify:docs` | Markdown 本地链接、标题结构、检查清单和禁止占位文字检查通过 |
| `npm run validate:content` | 格式/分类/坐标/来源/图片 fileId/核验日期和总数校验通过 |
| `npm run test:integration` | 仅显式选定开发云，真实 SDK 测事务、规则、身份和持久化；缺账号报 BLOCKED，不能报 PASS |
| `npm run test:e2e` | 已开启测试专用开发者工具自动化端口后，执行页面操作和断网/授权 stub 用例 |
| `npm run release:check` | 检查演示环境、live 模式、函数/索引/规则版本、密钥扫描和验收证据齐全 |

每次提交前：运行相关定向测试及 `npm run typecheck`、`npm run lint`、`npm run build`、`git diff --check`；影响包边界增加 `npm run check:package`，影响安全/持久化增加真实云集成测试，交付阶段运行全部命令。测试脚本不得把“未配置”“跳过全部”当作通过。

Git 固定流程：先 `git status --short`，仅 `git add <本任务已列出的实际改动路径>`，再 `git diff --cached --check`、`git diff --cached --stat`，核对没有无关文件后创建本任务 Conventional Commit。提交正文记录已运行命令及结果；没有自动化适用性时写清原因和替代验证。不能为了凑提交而提交红灯代码，不自动推送远程。

## 6. 详细任务清单

任务内的每个勾选项是一项操作；实现项以列出的行为和接口为完成边界。较长任务按行为逐个红—绿循环，不一次性写完全部页面才测试。未开始的任务保持未勾选。

### 任务 01：核验接入前提并冻结首版口径（P0）

**负责人/依赖：** 产品与统筹；设计文档已提供。

**文件：** 新建 `docs/runbooks/readiness.md`、`docs/testing/acceptance-matrix.md`；不修改未提交技术稿。

**输入→输出：** 设计和用户提供的平台信息 → 能力状态、候选口径确认记录、按本文第 7 节编号的验收矩阵。

- [ ] 核对 Git 状态和最新设计，把现存未跟踪文件列为保护对象。
- [ ] 记录开发者工具版本、AppID 配置方式、云环境可用性、Node.js/基础库可选版本、位置能力状态、Dify 应用类型信息；不抄录任何凭据或设备 ID。
- [ ] 请用户在实施开始时确认预算口径、人数/天数范围、数据保留期及体验预算；未获得确认的内容标成“执行前需用户确认”，不虚构已批准。
- [ ] 将设计十项验收逐一映射到任务和测试证据，登记用户/平台依赖的负责人和最迟阶段。
- [ ] 运行 `git diff --check`；逐项核对设计范围和 Markdown 本地链接；提交 `docs: record implementation readiness and acceptance gates`，正文说明仅文档，使用范围/链接/差异校验。

**验收：** 没有把技术评审稿当批准；未配置的能力清楚阻塞对应后续任务，而不是阻塞所有本地准备。

### 任务 02：建立可测试、可独立部署的项目骨架（P0）

**文件：** 新建第 2 节根目录配置、`miniprogram/app.ts`、`miniprogram/app.json`、`miniprogram/app.wxss`、home 页面四件套的最小空壳、`scripts/build.mjs`、`scripts/check-package.mjs`、`scripts/verify-docs.mjs`、`tests/unit/build.test.ts`；修改 `.gitignore`；新建 `docs/runbooks/development.md`。

**输入→输出：** 01 工具可用性 → 第 5 节检查命令、客户端/云函数独立构建约定。

- [ ] 编写构建测试：缺入口、错误页面路径、客户端引入服务端模块分别必须失败；合法最小输入产生独立输出目录。
- [ ] 安装并锁定兼容的 TypeScript、Vitest、ESLint、小程序类型声明及构建依赖，运行 `npm run test -- tests/unit/build.test.ts` 确认预期红灯。
- [ ] 建立构建与检查脚本，忽略 dist、coverage、本地私有配置、凭据和真实验收附件；开发模式模拟适配器可用，体验构建排除它。
- [ ] 运行定向测试、typecheck、lint、build、check:package、verify:docs；开发者工具能导入空壳，无页面缺失错误。
- [ ] 核对新增依赖和锁文件均属本任务后，提交 `chore: scaffold testable mini program and cloud builds`。

**验收：** 从干净依赖安装可复现构建；没有自动写入真实环境信息；单个函数包不依赖源码相邻目录。

### 任务 03：建立共享契约、鉴权和错误边界（P0）

**文件：** 新建 `shared/contracts.ts`、`shared/validation.ts`、`cloudfunctions/common/auth.ts`、`response.ts`、`logging.ts`、`miniprogram/services/cloud.ts`、`tests/contracts/api.test.ts`、`tests/unit/auth.test.ts`、`tests/unit/validation.test.ts`。

**输入→输出：** 第 3 节字段/动作 → 前后端唯一类型源、`requireUser(context)`、`callService(functionName, action, payload)` 与统一错误映射。

- [ ] 编写用例：伪造 ownerId 不替代可信身份；无身份拒绝；错误堆栈/授权头/精确位置不得进入返回值或日志。
- [ ] 编写边界用例：空问题、1000/1001 字符、非法分类、NaN/Infinity、非法经纬度、非整数人数、预算口径及额外字段。
- [ ] 运行三组定向测试确认红灯，再建立白名单校验、统一信封和前端可理解提示。
- [ ] 运行定向及通用检查；错误提示映射逐项对照第 3.3 节。
- [ ] 提交 `feat: define service contracts and trusted identity boundary`。

**验收：** 页面只依赖统一适配器；客户端身份字段不能影响数据库查询。

### 任务 04：基础视觉、导航和通用状态（P1）

**文件：** 修改任务 02 的 `miniprogram/app.ts`、`miniprogram/app.json`、`miniprogram/app.wxss` 和 home 页面四件套；新建 `miniprogram/styles/tokens.wxss`、`miniprogram/config/runtime.ts`、discover/map/me 页面四件套及 async-state/category-filter/place-card 组件四件套；新建 `tests/unit/navigation.test.ts`、`tests/unit/components.test.ts`。

**输入→输出：** 共享契约 → 四 tab 导航、分类选择事件 `categorychange`、卡片 `open(placeId)` 和 `favoritechange(placeId,favorite)` 事件。

- [ ] 测试四 tab 路由、四分类枚举、加载/空/失败/重试状态，卡片不得自行请求定位或调用 Dify。
- [ ] 运行两组测试确认红灯。
- [ ] 建立江水青绿/暖砂金/米白样式、16–20px 圆角与原创图标；保证按钮触达区域、长文本换行、底部安全区；不复制其他小程序资产。
- [ ] 运行测试及通用检查，开发者工具逐页切换并验证 loading/error/empty 展示。
- [ ] 提交 `feat: add navigation and reusable travel UI states`。

**验收：** 页面无真实地点硬编码；云数据未接入时显示空状态，不用假地点冒充真实内容。

### 任务 05：首页、发现与共用地点详情交互（P1）

**文件：** 修改 home/discover 页面；新建 place-detail 页面四件套、`miniprogram/services/places.ts`、`view-models/place-list.ts`、`tests/unit/place-pages.test.ts`、`tests/fixtures/places.ts`。

**输入→输出：** home/list/detail 契约 → 分类/搜索/标签/分页界面和唯一详情路由 `placeId`。

- [ ] 编写用例：切换分类重置游标、搜索去空格、重试不重复追加、旧请求晚返回不覆盖新筛选、详情不存在可返回。
- [ ] 运行 `npm run test -- tests/unit/place-pages.test.ts` 确认红灯。
- [ ] 接入服务适配器；只在自动化中注入合成测试地点，运行页面从服务取数据；详情图文、地址、开放提示、标签、来源/日期和收藏区域齐全。
- [ ] 运行定向及通用检查，验证图片失败占位、无餐饮信息不展示空标题、热门/精选不由前端写死。
- [ ] 提交 `feat: add place discovery and shared detail interactions`。

**验收：** 列表和未来地图使用同一路由；数据库尚不可用时显示真实错误或空状态。

### 任务 06：模拟聊天和行程定制（P1）

**文件：** 新建 ai-chat/trip-form 页面四件套、message-bubble/source-card 组件四件套、`miniprogram/services/ai.ts`、`miniprogram/view-models/chat.ts`、`tests/fixtures/mock-ai.ts`、`tests/unit/chat-ui.test.ts`、`tests/unit/trip-form.test.ts`。

**输入→输出：** submit/getResult 契约和 TripInput → 可注入 mock/live 适配器的同一交互，不改变后续页面接口。

- [ ] 用例覆盖发送/等待/成功/失败/重试、重复点击、输入长度、行程五字段、预算标识，以及离开停止轮询、返回恢复。
- [ ] 运行两组定向测试确认红灯。
- [ ] 完成纯文本聊天、分节行程结果和本地事实/实际引用分组；开发模式每条模拟结果显著显示“模拟回答，仅用于交互测试”。
- [ ] 显示强制免责声明；运行定向及通用检查、check:package，验证 mock 错误不变成成功、文本不得任意执行 HTML/脚本。
- [ ] 提交 `feat: add clearly labeled mock AI and trip interactions`。

**验收：** 不访问真实 Dify；未支持结构化输出时允许分节文本，不强行生成虚假地点链接。

### 任务 07：“我的”、记录、偏好、隐私和反馈页面（P1）

**文件：** 修改 me 页面；新建 records/ai-history/preferences/privacy/feedback 页面四件套、`miniprogram/services/user.ts`、`feedback.ts`、`tests/unit/profile-pages.test.ts`。

**输入→输出：** 用户/AI 历史/反馈动作 → 可回到地点详情、AI 会话及行程结果的个人功能入口。

- [ ] 测试收藏/浏览/行程三种记录入口、历史分页、偏好最多 6 项、反馈失败保留草稿、未成功提交不得显示“已收到”。
- [ ] 运行 `npm run test -- tests/unit/profile-pages.test.ts` 确认红灯。
- [ ] 完成页面和适配器；隐私文案说明主动定位、外部 AI、记录用途和待确认的保留策略；不加入手机号登录。
- [ ] 运行测试及通用检查，从“我的”能到所有次级页面并返回；清单未接云时显示未加载/错误，而非伪造个人历史。
- [ ] 提交 `feat: add personal records preferences and feedback pages`。

**验收：** P1 整体可走完界面流程，mock 状态清楚；不宣称持久化已经完成。

### 任务 08：开发云数据库、索引与访问规则（P2）

**文件：** 新建 `database/schema.md`、`indexes.json`、`security-rules.json`、`storage-rules.md`、`cloudfunctions/common/db.ts`、`tests/integration/database-security.test.ts`、`docs/runbooks/cloud-environments.md`。

**输入→输出：** 01 已获授权环境和第 4 节模型 → 12 个集合、索引、公共图片访问策略及受限服务入口。

- [ ] 写集成用例：客户端直接读/写所有集合被拒绝；普通用户不能覆盖地点图片；可信服务端能读公开地点。
- [ ] 在明确选择的开发环境运行测试确认规则尚未满足；禁止连接演示环境跑破坏性测试。
- [ ] 经用户授权创建/配置开发资源；记录实际运行时、事务能力、查询上限、索引完成状态；私有记录不可通过存储公开路径泄露。
- [ ] 运行 `npm run test:integration`、相关类型/静态/构建检查；两测试账号的原始身份与日志留本地，不提交。
- [ ] 提交 `feat: define cloud data model indexes and access rules`。

**验收：** 云函数可用特权 SDK 不等于匿名可操作；规则通过真实云验证，不能仅靠本地 mock。

### 任务 09：内容校验、管理端导入和首批资料（P2）

**文件：** 新建两份 content seed 文件和 source-register.md、`scripts/validate-content.mjs`、`scripts/import-content.mjs`、`tests/unit/content-validation.test.ts`、`docs/runbooks/content-import.md`。

**输入→输出：** 用户确认的资料与合法图片 → 20–30 条四类已发布地点和对应云图片/详情。

- [ ] 写用例：缺来源、缺核验日期、重复 placeId、错误坐标/坐标系、无权图片、未覆盖四类分别拒绝发布；重复导入不增加重复地点。
- [ ] 运行定向测试确认红灯；建立 dry-run 校验和幂等导入，导入脚本只用管理端身份，不提供前端管理动作。
- [ ] 逐条整理来源，上传有权图片，记录 fileId，再执行 `npm run validate:content` 和 `npm run import:content -- --target development --dry-run`；任务中为 import:content 注册上述管理脚本。
- [ ] 通过后才执行 `npm run import:content -- --target development --apply`，抽检每类至少 2 条（该类不足 2 条则全检）；验证图文、坐标、来源日期及首次/再次导入结果一致。
- [ ] 运行测试和通用检查，提交 `feat: add validated place content import workflow`；仅提交权利明确的公开文本/fileId/台账，不提交凭据或私人授权附件。

**验收：** 如果真实素材不足，停在内容门槛，不补造景点事实凑数。

### 任务 10：地点查询云函数与前端真实数据连接（P2）

**文件：** 新建 `cloudfunctions/placeService/index.ts`、`cloudfunctions/places/repository.ts`、`storage.ts`、`tests/unit/place-service.test.ts`、`tests/integration/place-service.test.ts`；修改前端 places 服务及 home/discover/place-detail 页面。

**输入→输出：** 08 数据结构、09 内容 → home/list/detail/markers 实际接口；nearby 留给 13。

- [ ] 写用例：只读 published、分类关键词标签联合筛选、分页无漏项、未知详情 NOT_FOUND、文件 URL 失效重新解析、设置中下架推荐不展示。
- [ ] 运行地点单元测试确认红灯。
- [ ] 实现服务并部署开发环境，返回白名单字段；列表/首页/详情切换到同一真实云适配器；图片解析失败仍保留文字。
- [ ] 运行单元/真实云集成/通用检查，修改一条开发云地点简介后刷新页面，证明内容不在前端；恢复测试改动。
- [ ] 提交 `feat: serve published places from cloud data`。

**验收：** 四类地点和首页配置真实可查，数据库更新无需改前端源码。

### 任务 11：收藏、浏览与基础旅行偏好持久化（P2）

**文件：** 新建 `cloudfunctions/userService/index.ts`、`cloudfunctions/users/repository.ts`、`tests/unit/user-records.test.ts`、`tests/integration/user-isolation.test.ts`；修改前端 user 服务、详情/记录/偏好页面。

**输入→输出：** 可信身份和 PlaceDetail → setFavorite/recordBrowse/listRecords/getPreferences/savePreferences；trips 类型先返回合法空集合，19 接入实际结果。

- [ ] 用例：同值收藏重复提交仅一条、取消不存在收藏成功、同一地点浏览只保留最近一次、详情加载失败不记浏览。
- [ ] 用例：A 伪造 B 身份/游标无法看到 B 收藏/浏览/偏好，收藏地点下架显示“地点暂不可用”且可取消，不泄露下架详情。
- [ ] 运行定向测试确认红灯；实现服务端归属过滤、确定性 ID 和事务/并发一致性，详情读取成功后记录浏览；记录写失败不遮挡已加载详情。
- [ ] 运行单元/集成/通用检查；微信退出重进后记录和偏好仍可读，列表收藏状态同步。
- [ ] 提交 `feat: persist private favorites browsing and preferences`。

**验收：** 持久化依赖可信云身份，不依赖手机号和本地缓存。

### 任务 12：反馈入库与个人数据闭环（P2）

**文件：** 新建 `cloudfunctions/feedbackService/index.ts`、`tests/unit/feedback.test.ts`、`tests/integration/feedback.test.ts`；修改前端 feedback 服务和反馈页面；新建 `docs/runbooks/feedback-handling.md`。

**输入→输出：** 当前用户和合法反馈 → received 状态；管理端按负责人流程处理，不新增运营后台。

- [ ] 写用例：空内容/超长拒绝，普通用户不能伪造处理状态、不能关联其他用户 AI 消息，数据库失败无成功回执。
- [ ] 运行定向测试确认红灯，实施白名单入库和每用户每分钟 3 次反馈频率限制（复用 usage_counters 的独立窗口类型，不占 AI 额度）。
- [ ] 连上真实服务，明确“已收到”不等于“已修复”，文档写明管理端查看及纠错重新核验流程。
- [ ] 运行单元/集成/通用检查，复验收藏→浏览→偏好→反馈闭环。
- [ ] 提交 `feat: persist validated user feedback`。

**验收：** P2 放行：地点与私人记录全部真实，不暴露反馈列表和他人内容。

### 任务 13：后端 20 公里附近筛选（P3）

**文件：** 新建 `cloudfunctions/places/distance.ts`、`tests/unit/distance.test.ts`、`tests/unit/nearby.test.ts`；修改 placeService 入口及 repository。

**输入→输出：** 已发布地点和当次 GCJ-02 坐标 → `nearby` 半径固定 20000 米、距离升序结果。

- [ ] 写用例：19.9km/20km/20.1km 分别纳入/纳入/排除；零距离；非法经纬度；多页地点全部参与；分类过滤与等距稳定排序。
- [ ] 运行两组定向测试确认红灯，使用独立预计算距离夹具验证，不用被测距离函数生成期望值。
- [ ] 实现未取整距离过滤、显示值单独格式化；地点读取分页完整、只返精简字段；请求位置不传日志封装器。
- [ ] 运行测试和通用检查；抓取测试数据库/日志证明位置未持久化，宜昌以外返回真实空结果。
- [ ] 提交 `feat: filter nearby places within twenty kilometers`。

**验收：** 不默默扩大半径、不把默认城区地点称为附近结果。

### 任务 14：地图交互、主动授权和隐私说明（P3）

**文件：** 修改 map/privacy 页面、`miniprogram/app.json`；新建 `services/location.ts`、`view-models/map.ts`、`tests/unit/location-permission.test.ts`、`tests/unit/map-state.test.ts`、`docs/testing/location-checklist.md`。

**输入→输出：** markers/nearby + 用户点击 → 默认地图、授权后附近标记、简卡和同一 placeId 详情入口。

- [ ] 写用例：首次进入不调用定位；点击后才请求隐私/位置授权；拒绝、定位失败、系统定位关闭仍保留默认浏览。
- [ ] 写用例：marker 数字 ID 与 placeId 映射稳定，切分类/旧响应竞态正确；离开清理位置；返回不自动重定位。
- [ ] 运行两组测试确认红灯，完成地图、简卡、“附近 20 公里暂无收录地点”和用户主动进入设置重试；不反复强弹授权。
- [ ] 依据开发者平台当时要求完成隐私声明和位置接口配置，核对已确认保留策略；Android/iPhone 各检查主动授权与拒绝路径，证据脱敏。
- [ ] 运行相关测试、通用检查和 P0–P3 回归，提交 `feat: add consent based nearby map and privacy flow`。

**验收：** 主体稳定后才放行真实 AI；平台能力不可用时列为阻塞，不能声称体验版地图功能完成。

### 任务 15：本地检索、上下文和来源可信边界（P4）

**文件：** 新建 `cloudfunctions/ai/retrieval.ts`、`context.ts`、`sources.ts`、`tests/unit/retrieval.test.ts`、`tests/unit/source-trust.test.ts`、`tests/fixtures/ai-cases.json`。

**输入→输出：** question 或 TripInput + 地点 repository → 最多 8 候选/12000 字符上下文、直接取库的 localFacts、检索状态。

- [ ] 写用例：名称/别名命中，多地行程，歧义提示，无命中，未发布不引用；spy 断言先查 places/place_contents 再允许调用 provider。
- [ ] 写冲突和注入夹具：用户“忽略本地资料”不改变事实卡片；模型生成非法 placeId/脚本 URL 被丢弃；仅传入资料不自动生成 references。
- [ ] 运行两组测试确认红灯；完成规则检索、上下文边界、公开字段白名单及 https 引用校验，不新增向量数据库。
- [ ] 运行定向及通用检查，确认数据库异常时 provider 从未被调用；无可靠价格信息不产生伪价格字段。
- [ ] 提交 `feat: prioritize verified local context and trusted sources`。

**验收：** 自动化能证明调用顺序和事实来源；不能宣称仅靠该步骤已经保证模型遵循规则。

### 任务 16：AI 任务、幂等、限额和可靠执行（P4）

**文件：** 新建 `cloudfunctions/aiService/index.ts`、`cloudfunctions/aiWorker/index.ts`、`cloudfunctions/maintenance/index.ts`、`cloudfunctions/ai/jobs.ts`、`quota.ts`、`tests/unit/ai-jobs.test.ts`、`tests/unit/quota.test.ts`、`tests/integration/ai-jobs.test.ts`、`docs/runbooks/ai-jobs.md`。

**输入→输出：** submit/getResult +可信身份 +15 检索 +可注入 provider → 持久化任务、同会话互斥、原子限额、可恢复真实任务状态。

- [ ] 写用例：重复 requestId 单任务单计数、不同输入相同 ID 冲突、并发达到 3/min 或 20/day 后拒绝、跨午夜切窗、跨用户 jobId 拒绝。
- [ ] 写用例：双 worker 只能一次领取；投递失败保留 queued 可补偿；running 超时只改终态不重调模型；迟到响应不覆盖 timed_out；终态写库失败不伪造成功。
- [ ] 运行单元测试确认红灯；开发云实测可靠异步调用、内部身份限制、worker 时限和补偿定时器；SDK 不支持可靠投递时暂停本任务，不能用后台 Promise 替代。
- [ ] 实现事务建任务/扣额度/会话锁；worker 携 leaseToken 完成时原子写消息、行程结果和任务状态并释放锁；补偿扫描超时，清理仅限已批准策略；不设置自动重新生成回答。
- [ ] 运行单元/真实云并发集成/通用检查，提交 `feat: add reliable private AI jobs and usage limits`。

**验收：** 此阶段 provider 仍为明确模拟测试适配器，不调用真实 Dify；不能保证外部 API exactly-once，文档必须说明超时结果未知和主动重试风险。

### 任务 17：现有 Dify 应用核验及安全适配（P4）

**文件：** 新建 `cloudfunctions/ai/dify.ts`、`tests/unit/dify-adapter.test.ts`、`tests/integration/dify-live.test.ts`、`docs/runbooks/dify-integration.md`；修改 worker provider 装配。

**输入→输出：** 15 上下文、16 任务、用户在服务端设置的 Dify 环境变量 → answer、difyConversationId、经校验的引用元数据。

- [ ] 用户在云函数环境变量中配置 `DIFY_API_BASE_URL`、`DIFY_API_KEY`、服务端不透明用户映射所需 `DIFY_USER_SALT`；不把任何值写入文档、数据库、前端或测试输出。
- [ ] 记录现有应用自己的 API 文档、输入变量、模式、实际延迟、引用字段和本地优先规则。缺必要系统规则先获得最小修改许可；用户不允许则报告本阶段阻塞，不重建 Agent。
- [ ] 编写适配器用例并跑红灯：401、429、5xx、超时、断流、空回答、响应格式不符、会话失效、缺引用、流式终止；传给 Dify 的 user 为稳定不透明标识，不用 OPENID。
- [ ] 接入实际支持模式；仅访问配置的 HTTPS 地址，禁用任意用户 URL 和带授权跨域重定向；限制响应体，异常只记录错误码/耗时/traceId；无内部凭据回传。
- [ ] 在授权测试额度内运行 `npm run test:integration -- tests/integration/dify-live.test.ts` 和相关单元/通用检查；用来源冲突、无资料、连续会话各至少一例实测，记录脱敏结果后提交 `feat: integrate existing Dify app through secure worker`。

**验收：** 只复用用户现有应用；未达到本地优先、无可靠信息明确不确定，不能以事实卡片正确为由放行相矛盾的 AI 答案。

### 任务 18：真实自由问答、来源和问答历史（P4）

**文件：** 修改前端 ai 服务、chat view-model、ai-chat/ai-history 页面、aiService；新建 `tests/unit/ai-history.test.ts`、`tests/e2e/chat-flow.test.ts`、`tests/integration/ai-history-isolation.test.ts`。

**输入→输出：** 16–17 live 任务 → 真实聊天、listSessions/listMessages、本人的持久化历史。

- [ ] 写用例：重进恢复 queued/running/终态，历史分页有序不重复，自己的会话可以续聊、他人 sessionId 不可读写，Dify ID 不出现在客户端返回。
- [ ] 写页面用例：真实失败不调用 mock、轮询失败可查回状态、无引用仍能显示回答但不伪来源、免责声明持续可见。
- [ ] 运行相关单元用例确认红灯，连接 live 适配器及真实历史；把外部会话 ID 留在数据库服务端。
- [ ] 运行定向单元/集成/e2e 和通用检查，网络异常后恢复真实状态而不是追加同一条答案。
- [ ] 提交 `feat: connect live chat and private AI history`。

**验收：** 关闭后重开可见提问、答案、时间及来源；记录写失败不向用户虚报“已保存”。

### 任务 19：真实行程定制与行程历史（P4）

**文件：** 修改 trip-form 页面、ai 服务、shared validation、ai worker、userService 的 trips 查询；新建 `tests/unit/trip-generation.test.ts`、`tests/e2e/trip-flow.test.ts`。

**输入→输出：** TripInput → 同一 AI 任务链，trip_requests 保存表单/状态/分节结果，“我的”回看。

- [ ] 写用例：预算为全团总额且不含往返大交通、人数天数边界、目的地不明确提示补充，偏好不触发位置读取。
- [ ] 写结果用例：概要/每日安排/预算估算/注意事项可显示；无可靠单项价格不编金额；未知地点不能生成本地详情链接；失败表单内容保留可编辑。
- [ ] 运行定向用例确认红灯，沿用检索/worker/限额链，不另开绕过规则的行程 API。
- [ ] 运行单元/e2e/真实问答回归及通用检查；真实测试一份 2 天行程和一份超范围表单，关闭再开读取结果。
- [ ] 提交 `feat: connect itinerary generation and private trip history`。

**验收：** P4 放行：自由问答与行程均有真实调用证据，不以模拟 UI 通过代替真实 AI。

### 任务 20：异常、安全、清理和发布自动化回归（P5）

**文件：** 新建 `tests/integration/security-regression.test.ts`、`tests/unit/retention.test.ts`、`tests/e2e/failure-paths.test.ts`、`scripts/release-check.mjs`、`docs/testing/regression-report.md`；修改 maintenance 及必要的相关行为测试。

**输入→输出：** 全部业务与已批准的保留策略 → 越权/滥用/失败/清理/包内容检查证据。

- [ ] 写回归测试：所有用户资源逐入口 A/B 越权；worker/maintenance 普通用户调用拒绝；前端不存在 Dify 地址/Key/调用；数据库及日志无当次定位。
- [ ] 写清理测试：只删除已过期的指定记录、不能删未过期或进行中任务；模拟时钟测试 7/90 天边界；批准期限未配置时禁止破坏性清理。
- [ ] 写断网、图片失败、空库、云函数错误、Dify 超时/断流/429 和分页竞态用例；对缺失行为先跑红灯，按实际问题建立最小修复和专属测试，不把多个无关修复混在一个 commit。
- [ ] 运行 `npm run test`、`npm run test:coverage`、`npm run test:integration`、`npm run test:e2e`、typecheck、lint、build、check:package、validate:content、verify:docs；报告任何跳过/阻塞，不能算通过。
- [ ] 提交 `test: enforce privacy security and failure regression gates`；若发现独立修复，分别用聚焦的 `fix:` 提交且逐个测试通过。

**验收：** 密钥扫描覆盖源代码、构建产物、暂存差异及已有 Git 历史的可疑凭据模式，报告只给路径/规则不打印值；发现泄露先报告并轮换，不擅自重写历史。

### 任务 21：Android / iPhone 连续演示与视觉验收（P5）

**文件：** 新建 `docs/testing/device-acceptance.md`；更新 acceptance-matrix/regression-report；真实录屏、原始截图放本地受限证据目录，不提交设备身份和位置画面。

**输入→输出：** P4 live 功能、20 自动化通过 → 两端真机的日期、平台版本、用例结果和脱敏证据索引。

- [ ] 每台设备独立完成“进入→发现→地图主动定位→简卡→详情→收藏→我的→AI 问答→历史→行程定制→重进回看”。
- [ ] 每台设备分别测试拒绝位置、系统定位关闭、宜昌以外无附近地点、断网、超时、长回答滚动、键盘遮挡、安全区及图片加载失败。
- [ ] 用 A/B 两个账号交叉验证收藏和 AI 会话隔离；关闭小程序重开验证记录持久化；证据只记录 A/B，不记 OPENID。
- [ ] 对失败建立对应自动化回归并单独修复提交；重新跑相关自动化和真机路径，直到无阻断缺陷。
- [ ] 运行 verify:docs、`git diff --check`；提交 `docs: record Android and iPhone acceptance evidence`，正文说明真机证据记录为文档变更，并列替代验证。

**验收：** 真机设备不足、账号不足或测试未执行均列阻塞；不可填写预期结果冒充实际通过。

### 任务 22：演示环境部署、上传体验版及复验（P6）

**文件：** 新建 `docs/runbooks/experience-release.md`、`docs/testing/release-record.md`；更新非敏感构建配置与相应 `tests/unit/release-config.test.ts`（若更改代码配置）。

**输入→输出：** 20–21 全绿、用户授权部署资源/上传 → 受控演示环境、体验版版本号、受限二维码及体验成员核验。

- [ ] 核对用户批准的演示环境、费用限额和成员；先记录可回退版本/数据库结构/内容版本，创建备份留在私有存储，不提交用户数据。
- [ ] 按“集合和访问规则→索引完成→函数及内部触发权限→用户填写服务端变量→地点图片/资料→配置”的顺序部署；演示环境不导入测试用户记录，不运行清库脚本。
- [ ] 构建 live-only 小程序包；验证公共业务配置不含 Dify 地址/Key，mock 不在包中；运行全量检查和 `npm run release:check`，缺任一真机证据禁止上传。
- [ ] 用户/开发者在微信开发者工具上传对应 Git commit 的版本，在平台按当时流程设置体验版及授权体验成员；不申请公开发布，不更改类目或购买套餐来绕过门槛。
- [ ] Android/iPhone 体验成员分别扫码，复验一次定位/拒绝、详情、收藏、真实问答和历史；二维码与体验成员名单只通过私密渠道交付，不写入公开仓库。
- [ ] 运行文档和差异检查，提交 `docs: record controlled experience release and rollback procedure`；若有构建配置行为改动，先以独立测试通过的 `chore:` commit 记录，再记录部署结果。

**验收：** 发布记录包含 commit、上传版本、函数/规则/索引/内容版本、测试时间、live 开关、成员可访问结果；不保存真实 Key 或完整环境变量导出。

### 任务 23：面试演示包、交接和稳定性准备（P6）

**文件：** 新建 `docs/runbooks/interview-demo.md`、`docs/runbooks/operations.md`；更新 release-record；录屏本地私密保存。

**输入→输出：** 可扫码 live 体验版 → 3–5 分钟演示脚本、已实测问题和行程案例、备用录屏、运维和异常恢复清单。

- [ ] 准备并实测三个问题：一个已收录地点事实、一个宜昌文化背景、一个缺可靠实时资料的问题；另准备一份口径明确的 2 天行程，记录检查点而非把固定答案当真实调用。
- [ ] 录制真实完整闭环；核查录屏不暴露 Key、身份、精确位置或私人问答；现场网络异常时明确说明展示录屏，不把模拟结果伪装为线上成功。
- [ ] 写出面试前检查清单：体验版/二维码未失效、成员可入、额度足够、图片正常、一次真实问答成功、两端定位可用、备用录屏可播放。
- [ ] 写出监控与回滚操作：只记录 traceId/耗时/状态/调用量；异常先关闭 AI 入口并显示维护提示，非 AI 功能保留；按记录恢复上一函数/客户端版本与兼容配置，不删用户记录、不回退成 mock。
- [ ] 运行 verify:docs、`git diff --check`、最终验收矩阵复核，提交 `docs: add interview demonstration and operations handoff`。

**验收：** 交接包括构建/测试/部署步骤、内容更新流程、告警查看位置、Dify 变量名和用户配置方式、隐私边界、剩余限制；不包含秘密值。只有第 7 节全部达标才称首版完成。

## 7. 设计验收追踪矩阵

| 编号 / 设计要求 | 实现任务 | 自动化证据 | 实际验收证据 |
| --- | --- | --- | --- |
| A01 四类列表/地图共用详情，内容取自数据库 | 05、09、10、14 | place-pages/place-service/map-state | 改云数据后刷新即变；四类逐条进入详情 |
| A02 约 20 公里，拒绝不中断 | 13、14 | distance/nearby/location-permission | 两端授权/拒绝/外地空结果 |
| A03 收藏、浏览、AI 历史重进可读 | 11、18、19 | user-records/ai-history/trip-generation | 关闭重开，“我的”回看三类记录 |
| A04 自由问答与行程真实调用 | 06、17–19 | dify-adapter/chat-flow/trip-flow | 两条 live 链路及服务端脱敏追踪结果 |
| A05 Key 不出现在前端、请求、日志和页面 | 02、03、17、20、22 | build/auth/dify-adapter/security-regression | 包检查、网络检查、日志检查，不截图真实授权头 |
| A06 本地优先，无可靠信息不编造 | 15、17、19 | retrieval/source-trust/ai-cases | 冲突、无资料、同名歧义实测；正文和事实卡片均核对 |
| A07 断网/超时/空库/拒绝/接口错误可理解 | 04–07、14、16–20 | failure-paths/ai-jobs | 两端异常检查表，真实失败不调用模拟回退 |
| A08 Android+iPhone 连续演示 | 21 | e2e 辅助而非替代 | 两台真实手机完整路径通过 |
| A09 二维码、成员、示例、录屏 | 22、23 | release:check 的完整性检查 | 实际扫码成功、实测案例、录屏可播 |
| A10 用户记录仅本人可见（AGENTS 底线） | 03、08、11、16、18、20 | database-security/user-isolation/ai-history-isolation | A/B 真机交叉检查，不泄露他人资源存在性 |

补充覆盖：搜索/标签筛选（05/10）、首页推荐配置（10）、云图片和版权台账（09）、基础偏好（07/11）、隐私/反馈（12/14）、单用户限额（16）、模拟到真实接入顺序（06→17）、来源日期（09/15）、受控体验而非公开运营（22）。

## 8. 主要风险及处理准则

| 风险 | 提前发现点 | 处理与停止条件 |
| --- | --- | --- |
| 平台位置能力/类目或隐私资格不满足 | 01、14 | 保留默认地图开发；申请/配置由有权限用户处理，不能把失败隐藏为附近结果 |
| Dify 模式不兼容、响应超过平台时限 | 17 | 用现有应用实际 API 选择阻塞/服务端流汇总；超出时限请求用户决策，不擅自新建服务 |
| Dify 系统不接受本地优先规则 | 17 冲突测试 | 请求必要的最小配置许可；未获许可或仍失败则 A06 不通过 |
| 异步调用权限或可靠投递不可用 | 16 | 用开发云证据确定；不依赖函数返回后的后台执行，不把未投递任务显示成功 |
| 地点资料不足或版权不明 | 09 | 条目留 draft；等待合法资料，不复制其他小程序补齐 |
| 模型费用和重试放大 | 16、17、20 | 原子额度、同会话单任务、明确重试、预算告警；结果未知不自动重调 |
| 模型引用与事实不一致 | 15、17、21 | 分离本地事实与建议；实际冲突阻止发布，不承诺技术已消除全部幻觉 |
| 演示时网络/定位异常 | 21、23 | 可理解降级和真实备用录屏；录屏说明与线上运行区分 |

不为降低风险擅自新增支付、票务、手机号、复杂后台、实时交通天气接口、位置历史、向量库或另一个 AI Agent。

## 9. 技术核验依据与文档自检

核验日期：2026-09-04。外部平台能力以用户实际账号、部署版本和实施当日控制台为准，本计划中的数值目标不等于平台保证。

- Dify 官方要求从后端使用 API Key，并按不同应用类型选择接口。本计划据此设置服务端凭据和应用核验关口。[Dify API 入门](https://docs.dify.ai/en/api-reference/guides/get-started)
- Dify 将 Chat/Legacy Agent 与新 Agent 分别提供 API 指引；本计划不假定用户所说“Agent”必然支持某一响应模式。[Chat App API](https://docs.dify.ai/en/api-reference/guides/chat)、[Agent API](https://docs.dify.ai/en/api-reference/guides/agent)
- 云函数超时配置与函数类型有关，超时会强制终止；因此异步任务仍设置执行上限并预留落库时间。[CloudBase 基础配置](https://docs.cloudbase.net/cloud-function/function-configuration/config)
- CloudBase 提供定时触发能力，但投递、权限、重试和具体版本配置必须在开发环境核验，不能等同于外部调用恰好一次。[CloudBase 定时触发器](https://docs.cloudbase.net/cloud-function/timer-trigger)
- 本次微信官方位置/隐私页面未能成功读取，因此未声称已核实当前账号类目、隐私或体验版操作要求；任务 01、14、22 必须在官方文档和账号后台复核。[微信位置接口文档入口](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getLocation.html)、[微信隐私文档入口](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/)

计划交付自检：设计各节已映射到阶段/任务/A01–A10；接口名、状态名、集合名统一；所有任务有目标文件、依赖、明确测试行为、验证步骤及提交名称；没有把未来测试列为已通过。当前仅 Markdown 变更，执行代码、账号资源和真实验收均未开始。

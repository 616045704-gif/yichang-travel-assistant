# 云数据库资料结构

本目录是云开发部署清单的受版本控制来源。`security-rules.json` 是逐集合的 CloudBase `ModifySafeRule` 操作清单，安全基线是**所有集合客户端直读、直写均拒绝**。云函数使用特权 SDK 也必须从可信调用上下文取得 `ownerId`，不能接受客户端传入的身份。

## 公共地点

| 集合 | 字段与约束 |
| --- | --- |
| `places` | `_id=placeId`；`name`、`aliases[]`、`category`（`scenic`/`restaurant`/`culture`/`camping`）、`district`、`address`、`latitude`、`longitude`、`coordinateSystem=GCJ-02`、`intro`、`tags[]`、`coverFileId?`、`openNotice`、`status`（`draft`/`published`/`archived`）、`sources[]`、`verifiedAt`、`updatedAt`。只有 `published` 且坐标完整的条目可进入列表、详情或地图投影。 |
| `place_contents` | `_id=placeId`；`sections[]`（仅文本或受控云图片）、`visitAdvice?`、`diningInfo?`、`notices[]`、`updatedAt`。一地点一详情；对应地点不发布时不得返回。 |
| `app_settings` | 推荐地点 ID、AI 开关和限额数值；不得保存 Dify 地址、密钥或会话 ID。 |

地点服务只返回字段白名单。列表/地图不返回 `status`、管理备注或原始图片权限记录；云存储 file ID 由服务端按需解析临时 URL。资料来源与核验时间必须随详情可追溯；无来源、版权不清、坐标无效的条目保持 `draft`。

## 用户与内部集合

| 集合 | 字段与一致性 |
| --- | --- |
| `favorites` | `_id=hash(ownerId,placeId)`；`ownerId`、`placeId`、`createdAt`。`setFavorite` 幂等。 |
| `browse_history` | `_id=hash(ownerId,placeId)`；`ownerId`、`placeId`、`viewedAt`。详情成功后 upsert，仅保留最近一条。 |
| `ai_sessions` | `_id=hash(ownerId,kind)`；`ownerId`、`kind`（`chat`/`trip`）、`generation`、`difyConversationId`（仅服务端，可为空）、`activeRequestId`、`activeAttemptToken`、`leaseUntil`、`lastCompletedRequestId`、`updatedAt`。每位用户的两类助手分别维护 generation、指针与租约；reset 在事务内递增 generation 并清空当前指针/租约，客户端永不读取任何私有会话字段。 |
| `ai_messages` | `_id=hash(ownerId,requestId)`；`ownerId`、`requestId`、`kind=chat`、`inputHash`、清洗后的 `request`、公开 `result`、仅服务端使用的 `difyConversationId?`、`status`、`attemptCount`、`attemptToken`、`lastAttemptAt`、`sessionGeneration`、`claimedAt`、`quotaChargedAt`、`createdAt`、`updatedAt`。历史接口只返回清洗后的结果、原始输入摘要 `prompt` 与时间，不返回私有字段。 |
| `trip_requests` | `_id=hash(ownerId,requestId)`；字段与 `ai_messages` 相同，`kind=trip`，`request` 仅保留行程五字段或追问文本。自由问答和行程记录分别存储、分别续接。 |
| `feedback` | `ownerId`、`kind`、`targetId?`、`content`、`status`、`createdAt`；仅管理端处理。 |
| `user_preferences` | `_id=hash(ownerId)`；`ownerId`、`preferences[]`、`updatedAt`。 |
| `ai_jobs` | 确定性 `ownerId+requestId`；`inputHash`、`sessionId`、`kind`、`status`、`deadlineAt`、`result?`、`errorCode?`、时间字段。 |
| `usage_counters` | 确定性 `ownerId+窗口`；`windowType`、`windowStart`、`count`、`expiresAt`。 |

所有用户查询先在服务端以可信 `ownerId` 过滤，再分页；跨用户资源和不存在资源都返回 `NOT_FOUND`。位置不写入任何集合、日志或 AI 请求。

AI 请求记录采用兼容读取而不做破坏性迁移：缺少有效 `request` 的旧成功记录仍可显示固定摘要“历史自由问答”或“历史行程定制”，不会从回答反推用户输入；同时缺少 `attemptCount` 与 `quotaChargedAt` 的旧成功记录只能只读重放清洗后的缓存，不修复会话指针。只缺一个字段、显式 `null` 或字段畸形均拒绝读取为可重试记录。新写入继续使用上述组合记录结构，部署时不批量改写或删除旧记录。

## 索引与状态

索引清单见 [indexes.json](indexes.json)。地点导入只允许 `draft → published`；内容修订或撤下使用 `archived`/`draft`，不物理删除地点或用户记录。所有时间以 UTC ISO 8601 存储。

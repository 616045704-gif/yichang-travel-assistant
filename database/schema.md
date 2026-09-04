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
| `ai_sessions` | `ownerId`、`title`、`kind`、`difyConversationId`（仅服务端）、`activeJobId`、`updatedAt`。 |
| `ai_messages` | `ownerId`、`sessionId`、`jobId`、`role`、`content`、`localFacts[]`、`references[]`、`status`、`createdAt`；任务+角色使用确定性 ID。 |
| `trip_requests` | `_id=jobId`；`ownerId`、`sessionId`、`input`、`result`、`status`、`createdAt`。 |
| `feedback` | `ownerId`、`kind`、`targetId?`、`content`、`status`、`createdAt`；仅管理端处理。 |
| `user_preferences` | `_id=hash(ownerId)`；`ownerId`、`preferences[]`、`updatedAt`。 |
| `ai_jobs` | 确定性 `ownerId+requestId`；`inputHash`、`sessionId`、`kind`、`status`、`deadlineAt`、`result?`、`errorCode?`、时间字段。 |
| `usage_counters` | 确定性 `ownerId+窗口`；`windowType`、`windowStart`、`count`、`expiresAt`。 |

所有用户查询先在服务端以可信 `ownerId` 过滤，再分页；跨用户资源和不存在资源都返回 `NOT_FOUND`。位置不写入任何集合、日志或 AI 请求。

## 索引与状态

索引清单见 [indexes.json](indexes.json)。地点导入只允许 `draft → published`；内容修订或撤下使用 `archived`/`draft`，不物理删除地点或用户记录。所有时间以 UTC ISO 8601 存储。

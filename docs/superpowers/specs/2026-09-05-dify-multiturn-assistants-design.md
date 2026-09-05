# 双 Dify Chatflow 多轮助手设计

## 目标与范围

将当前模拟 AI 升级为两个独立的 Dify Chatflow：自由问答助手与行程定制助手。两者均调用 Dify `POST /v1/chat-messages` 的 blocking 模式，并通过各自独立的 `conversation_id` 支持原生多轮上下文。

保持现有前端 `AiRequest`、`kind`、`question`、`trip` 与 `submitAi(request)` 不变。前端不直接调用 Dify，不持有 API Key、稳定用户标识或 `conversation_id`。本地开发未配置 Dify 时继续使用当前 mock 模式。

## 服务端路由与安全边界

新增客户端可调用的 `aiService` 云函数。小程序的 `submitAi(request)` 在 live 模式只调用该云函数；云函数从可信调用上下文获取用户身份，派生稳定但不暴露给客户端的 Dify `user` 字段。

云函数按请求 `kind` 选择环境变量和会话槽位：

| kind | Dify 配置 | 服务端会话槽位 |
| --- | --- | --- |
| `chat` | `DIFY_CHAT_API_BASE_URL`、`DIFY_CHAT_API_KEY` | `chatConversationId` |
| `trip` | `DIFY_TRIP_API_BASE_URL`、`DIFY_TRIP_API_KEY` | `tripConversationId` |

两条 Dify Chatflow 都配置可选文本输入变量 `local_verified_facts`。云函数在调用前查询本地已发布地点与详情，将整理后的已核验资料写入这一服务端字段；小程序不发送、存储或展示它的原始输入值。

真实密钥、Dify 地址、稳定用户标识和 conversation ID 均不得出现在小程序包、前端日志或 Git。云函数先查询本地地点资料；本地已核验资料优先于 Dify 补充内容。若本地查询、Dify 配置或请求失败，返回可理解错误，不伪造 mock 成功。

## 请求映射与多轮会话

自由问答保持页面字段 `question`。云函数首次将它映射为 Dify `query`，传空 `conversation_id`；Dify 返回的 conversation ID 写入当前用户的 `chatConversationId`。后续 `kind: 'chat'` 复用该会话 ID。

行程首次请求保留既有 `TripInput` 字段，并映射到 Dify `inputs.destination`、`people`、`totalBudgetCny`、`days` 和逗号分隔的 `preferences`；`query` 固定为生成完整定制行程的说明。成功后写入 `tripConversationId`。行程页结果下方新增纯文本追问输入；后续调整只提交新的 `kind: 'trip'` 请求文本，由云函数复用 `tripConversationId`，不重新要求填写表单。

不拼接或传输前端 history。Dify 的 `conversation_id` 是唯一多轮上下文机制。

## 会话控制与记录

自由问答页提供“新对话”，只清除当前用户的 `chatConversationId`；行程页提供“重新规划”，只清除当前用户的 `tripConversationId`。两个操作互不影响。会话 ID 仅保存在服务端私有记录，AI 问答和行程记录仍按当前用户隔离。

服务端仅向客户端返回最终文本、来源数据、状态与 `mode`；不返回 Dify conversation ID。页面继续以现有 `AiResult.answer` 作为展示字段。

## 开发模式与验证

开发或未配置 Dify 的环境保留 `mode: 'mock'`。配置齐全且 live 模式开启时使用 `mode: 'dify'`；真实失败绝不自动回退为模拟成功。

测试覆盖：两类首次/后续请求的 Dify 映射、会话隔离、新会话清理、行程追问、环境变量缺失、Dify 异常、mock 回归与客户端包中无密钥或 Dify 请求。真实 Dify 调用、云环境、真机与双用户隔离需要在用户配置开发云环境变量后独立验收。

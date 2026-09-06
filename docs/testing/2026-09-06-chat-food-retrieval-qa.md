# 自由问答餐饮资料筛选本地验收记录

## 范围

本次仅修改 `aiService` 的本地地点资料筛选。餐饮/吃面问题仅使用餐馆资料；若问题中指定了已发布地点存在的区，则仅使用该区餐馆资料。Dify 工作流、模型、知识库、密钥、环境变量、数据库记录和小程序直连边界均未改动。

## 被测提交

- `ba2178c fix: narrow chat food fact retrieval`

## 实际执行与结果

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 夷陵区吃面分类和区域筛选 | 通过 | `tests/unit/ai-service.test.ts` 构造夷陵区面馆、夷陵区含鱼文本的景区、其他区面馆；`夷陵区有什么吃面的地方？` 只返回夷陵区面馆资料。 |
| 无本地餐馆资料时的回答引导 | 通过 | 同一测试断言无餐馆的区会返回“直接回答用户问题”“不要虚构具体商户”的安全事实提示。 |
| AI 服务与 Dify 适配器单测 | 通过 | `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-service.test.ts tests\\unit\\dify-adapter.test.ts`：54/54 通过。测试中的预期安全诊断输出不含敏感内容。 |
| 类型检查 | 通过 | `node node_modules\\typescript\\bin\\tsc --noEmit`：退出码 0。 |
| 针对性 lint | 通过 | `node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\retrieval.ts tests\\unit\\ai-service.test.ts`：退出码 0。 |
| 演示构建 | 通过 | `node scripts\\build.mjs --mode=demo`：输出 `Build ready: dist/ (demo)`。 |
| 客户端与云函数边界 | 通过 | `node scripts\\check-package.mjs`：输出 `Client routes, resources and boundary verified`。 |
| 文档校验 | 通过 | `node scripts\\verify-docs.mjs`：输出 `Documents verified: 23`。 |

## 部署与人工验证

- 仅可部署 `dist/cloudfunctions/aiService`；保留现有依赖、超时、环境变量和 CloudBase 数据，不查看或修改环境变量值。
- 部署后在微信开发者工具新建自由问答，发送：`夷陵区有什么吃面的地方？`。
- 期望：回答聚焦面食/餐馆，不把鱼、景区或露营地表述成面馆；标准官方公告提示仍存在。

## 未测项

- 本地测试没有调用真实 Dify，也未读取生产地点数据库；因此真实知识库补充内容和实际商户资料需在部署后人工验证。
- 尚未做微信开发者工具或真机人工验证。

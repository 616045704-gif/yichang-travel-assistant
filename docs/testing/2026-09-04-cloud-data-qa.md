# 云数据基础独立 QA 记录

- **角色：** 独立测试负责人
- **日期：** 2026-09-04
- **被测提交：** `78e3ace fix: harden cloud data deployment checks`
- **范围：** 云数据库集合权限规则、地点种子资料校验、导入 dry-run 与本地构建边界。

## 实际执行与结果

| 检查 | 命令 | 结果 | 证据摘要 |
| --- | --- | --- | --- |
| 单元与契约测试 | `node .local-tools/package/bin/npm-cli.js run test` | 通过 | 7 个测试文件、49 项测试全部通过；包括内容校验和数据库访问基线。该命令在沙箱内因 `spawn EPERM` 不能启动 esbuild，获准在受限外环境复跑后通过。 |
| 内容校验 | `node .local-tools/package/bin/npm-cli.js run validate:content` | 通过 | 输出 `Content valid: 4 places, 4 details`。 |
| 导入预演 | `node .local-tools/package/bin/npm-cli.js run import:content -- --target development --dry-run` | 通过 | 只输出预演计划；4 个地点 ID 与 4 个详情 ID 一一对应，未执行云端写入。 |
| 规则部署计划 | `node .local-tools/package/bin/npm-cli.js run plan:security-rules -- --target yichang-dev` | 通过 | 为 12 个集合生成 `CUSTOM`、`read=false`、`write=false` 的安全规则计划；未调用部署接口。 |
| 类型检查 | `node .local-tools/package/bin/npm-cli.js run typecheck` | 通过 | `tsc --noEmit` 无错误。 |
| 静态检查 | `node .local-tools/package/bin/npm-cli.js run lint` | 通过 | `eslint .` 无错误。 |
| 构建 | `node .local-tools/package/bin/npm-cli.js run build` | 通过 | 输出 `Build ready: dist/ (development)`；同样需在受限外环境运行以允许 esbuild 子进程。 |
| 小程序包边界 | `node .local-tools/package/bin/npm-cli.js run check:package` | 通过 | 输出客户端路由、资源和边界均已验证。 |
| 文档校验 | `node .local-tools/package/bin/npm-cli.js run verify:docs` | 通过 | 输出 `Documents verified: 8`。 |

## 审查修复复核

复核 `78e3ace` 相对前一提交的修复：安全规则已调整为可生成 CloudBase `ModifySafeRule` 计划的 12 项 `CUSTOM` 拒绝规则；内容校验新增发布资料的字段级官方证据、UTC 时间格式与动态事实拦截；所谓集成测试在没有真实开发云适配器时不会给出误导性的绿色结果。以上变更由本地测试、内容校验和规则计划命令覆盖。

## 缺陷与放行结论

本次可执行的本地检查未发现明确缺陷。范围内的本地数据结构、规则计划、内容校验、导入预演及构建边界可阶段放行。

这不是云端或真机完整验收：数据库规则尚未实际部署到开发云；未使用两个真实测试账号验证直接访问拒绝、跨账号收藏/浏览/AI 记录隔离和地点图片写入拒绝；未实际导入开发云或验证索引状态；Android 与 iPhone 真机及微信位置授权流程均未测。完成这些项目后才可签署对应云端和设备验收。

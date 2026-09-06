# 精选地点封面图独立验收记录

- 日期：2026-09-06
- 测试角色：独立测试
- 被测提交：`e32b46f`（`test: cover featured place projection consistency`）
- 验收范围：精选地点封面图资料清单校验，以及数据库投影下的列表、详情、地图标记一致性。

## 实际执行项

| 命令 | 结果 | 证据摘要 |
| --- | --- | --- |
| `node node_modules/vitest/vitest.mjs run tests/unit/featured-image-manifest.test.ts tests/unit/place-service.test.ts tests/unit/place-storage.test.ts` | 通过 | 3 个测试文件、11 个测试全部通过；首次在隔离环境启动时因 esbuild 子进程 `EPERM` 失败，获准在受限环境外重跑后通过。 |
| `node node_modules/typescript/bin/tsc --noEmit` | 通过 | 退出码 0。 |
| `node node_modules/eslint/bin/eslint.js .` | 通过 | 退出码 0。 |
| `node scripts/verify-docs.mjs` | 通过 | 输出 `Documents verified: 27`。 |
| `git diff --check` | 通过 | 无输出，退出码 0。 |

## 独立复核结论

1. 封面图资料清单的单元测试已覆盖 Commons 文件页、作者、许可、署名、CloudBase 文件 ID、核验时间、唯一地点 ID 及四类地点校验。
2. 地点服务测试已覆盖一条已发布且具备 `cloud://` 封面的地点：列表、详情与地图标记均保留相同地点 ID；详情保留相同封面 ID；地图标记保留相同 GCJ-02 经纬度。
3. 既有导入盘点摘要为：`places` 中已发布地点 387 条、已配对详情 387 条、封面 ID 为 0 条；分类覆盖为景区 244、餐馆 130、文化 1、露营地 12。该摘要来自既有导入盘点，实际云端只读连接此前超时，未在本次独立验收中重新读取云端。

## 缺陷与风险

- 本次没有发现可由本地自动化检查复现的阻断缺陷。
- 当前被测提交是投影一致性测试提交；尚无实际 CloudBase 上传返回的封面文件 ID，因此不能据此确认线上图片存在或可访问。

## 待验范围

- CloudBase 云存储对象、实际上传流程、数据库目标字段更新，以及线上地点资料/图片逐项复核。
- 微信小程序真实列表、详情页和地图页面的端到端一致性。
- Android 与 iPhone 真机、定位授权与拒绝、网络异常路径及体验二维码。
- 图片主体匹配、Wikimedia Commons 页面许可与最终署名展示的人工逐项核验。

## 安全说明

本次独立测试未读取、输出、写入或提交 Dify API Key、环境变量文件、CloudBase 凭据或其他密钥；未执行任何云端写入或权限变更。

## 阶段结论

本地自动化验收范围可阶段通过；云端资料与图片、端到端页面和真机验收均明确待验，不能据此宣称完整发布验收通过。

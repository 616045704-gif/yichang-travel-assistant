# 真实与模拟构建目录隔离验收记录

日期：2026-09-08
被测提交：`42a77e1`（`fix: ignore development build output`）

## 根因与修复范围

此前 `demo` 真实 AI 构建和 `development` 模拟构建都写入 `dist`。后续界面验收显式运行开发构建时，会把开发者工具当前读取的真实包替换为“模拟回答”包。

本次将输出目录永久隔离：

- `demo` 模式输出 `dist`，其中 AI 客户端调用 `aiService`；微信开发者工具和体验版只使用该目录。
- `development` 模式输出 `dist-dev`，其中保留模拟回答，仅供界面开发。
- ESLint 与 Git 忽略规则都识别 `dist-dev` 为生成目录。
- 操作指引规定：真实测试或上传前执行 `npm run build` 并导入 `dist`；不能导入或上传 `dist-dev`。

未修改 Dify、云函数、数据库、环境变量、密钥、AppID 或用户位置逻辑。

## 实际执行与结果

| 项目 | 实际执行 | 结果 |
| --- | --- | --- |
| 目录隔离回归 | `node node_modules\vitest\vitest.mjs run tests\unit\build.test.ts` | 48/48 通过；覆盖开发构建不能改变真实包。 |
| 连续构建产物 | `node scripts\build.mjs --mode=demo` → 记录 `dist/miniprogram/services/ai.js` SHA-256 → `node scripts\build.mjs --mode=development` → 比对 SHA-256 | 通过；哈希一致。开发构建输出为 `dist-dev/ (development)`，未改动 `dist`。 |
| AI 包边界 | 读取两个生成的 `services/ai.js` | 通过；`dist` 包含 `aiService` 且未启用模拟客户端；`dist-dev` 启用模拟客户端。 |
| 最终恢复 | `node scripts\build.mjs --mode=demo` | 通过；当前 `dist` 是真实 AI 包。 |
| 全量自动化 | `node node_modules\vitest\vitest.mjs run` | 276 通过、1 跳过。云函数安全失败路径的结构化日志是测试预期输出。 |
| 类型与静态检查 | `node node_modules\typescript\bin\tsc --noEmit`、`node node_modules\eslint\bin\eslint.js .` | 通过。 |
| 内容、文档与包检查 | `node scripts\validate-content.mjs`、`node scripts\verify-docs.mjs`、`node scripts\check-package.mjs --mode=demo` | 通过；本地种子仍为 4 条，云端发布资料数量需另行确认。 |
| 工作区格式 | `git diff --check` | 通过。 |

## 未测项

- 微信开发者工具重新编译和真实问答需由用户实际验证；此修复完成后工具应继续只打开 `dist`。
- CloudBase、Dify 真实调用、Android/iPhone 真机、体验版扫码及云端地点资料完整性不由本地构建测试替代。
- 独立测试角色：待验。本记录为开发执行的可重复本地验收，不能称为独立测试放行。

## 阶段结论

模拟开发构建已无法覆盖真实 AI 包。后续其他对话即使执行 `npm run build:dev` 或显式开发构建，也只会改动 `dist-dev`；只要微信开发者工具继续使用 `dist`，就不会再显示模拟回答。

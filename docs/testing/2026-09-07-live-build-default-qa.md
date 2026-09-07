# 默认真实 AI 构建验收记录

日期：2026-09-07  
被测提交：`f8d0cfc`（`fix: default builds to live AI mode`）

## 变更范围

- 普通构建脚本没有显式传入模式时，默认生成 `demo` 包（客户端调用云函数 `aiService`），不再生成开发模拟回答包。
- `npm run build` 明确传入 `--mode=demo`；新增仅供本地模拟的 `npm run build:dev`。
- 程序化构建 API 的默认 `development` 保持不变，避免影响现有隔离测试夹具。
- 新增单元测试覆盖命令行默认值和三个构建命令的约定。

## 开发自测

| 项目 | 实际执行 | 结果 |
| --- | --- | --- |
| 默认模式与脚本约定 | `node node_modules\\vitest\\vitest.mjs run tests\\unit\\build.test.ts` | 46/46 通过。 |
| 全量自动化测试 | `node node_modules\\vitest\\vitest.mjs run` | 255 通过、1 跳过。云函数失败路径的结构化日志为测试预期输出。 |
| 类型检查 | `node node_modules\\typescript\\bin\\tsc --noEmit` | 通过。 |
| 静态检查 | `node node_modules\\eslint\\bin\\eslint.js .` | 通过。 |
| 内容与文档 | `node scripts\\validate-content.mjs`、`node scripts\\verify-docs.mjs` | 通过；本地种子为 4 条，云端发布数量仍需人工确认。 |
| 生成包 | `node scripts\\build.mjs` | 通过，输出明确为 `dist/ (demo)`。 |
| 产物检查 | 读取新生成的 `dist/miniprogram/services/ai.js` | 包含 `aiService`，不含“模拟回答”或“模拟行程”。 |
| 工作区格式 | `git diff --check` | 通过。 |

## 已知环境限制与未测项

- 当前终端找不到 `npm` / `npm.cmd` 可执行文件，故未直接执行 `npm run build`；其完全等价的底层命令 `node scripts\\build.mjs --mode=demo` 及无参数默认 `node scripts\\build.mjs` 均已验证。使用微信开发者工具上传前，可在本机安装 Node.js 的 npm 后执行一次 `npm run build`，或直接执行已验证的底层命令。
- 未读取或变更 Dify API Key、Dify 流程、云函数环境变量和云端配置。
- 未做 CloudBase 真实调用、微信开发者工具编译、Android/iPhone 真机和体验版扫码验证。
- 独立测试角色：待验。本记录为开发自测，不构成独立测试放行。

## 阶段结论

本地构建回退为模拟回答的根因已被消除并由自动化测试覆盖。当前 `dist` 是真实云函数 AI 包；仍须在微信开发者工具重新导入 `dist`、编译并进行一次真实问答后，才能确认体验版端到端可用。

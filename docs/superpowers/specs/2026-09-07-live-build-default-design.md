# 真实体验包默认构建设计

## 目标

防止常规本地构建把微信开发者工具正在使用的 `dist` 体验包覆盖成会返回模拟回答的开发包。

## 根因

`scripts/build.mjs` 的命令行默认构建模式是 `development`，而 `npm run build` 未传入模式。开发模式和体验模式都写入同一个 `dist` 目录，因此任意一次普通构建都会覆盖此前的真实体验包。`development` 模式的 AI 服务会创建本地模拟客户端；`demo` 模式则调用 `aiService` 云函数。

## 设计

- `npm run build` 改为明确执行 `node scripts/build.mjs --mode=demo`。
- 新增 `npm run build:dev`，它是唯一用于生成模拟回答包的便捷命令，明确传入 `--mode=development`。
- 保留 `npm run build:demo`，与默认 `build` 产出相同的真实体验包，兼容已有发布指引。
- 直接执行 `node scripts/build.mjs` 时，命令行默认模式也改为 `demo`；避免绕开 npm 脚本后再次覆盖体验包。
- `buildProject()` 的程序化默认参数仍为 `development`，以保持既有单元测试隔离；真实命令行和体验版流程必须显式走 `demo`。
- 构建脚本导出解析命令行模式的纯函数，测试默认、`demo` 和 `development` 三种情况。
- 发布文档说明：日常/体验版构建用 `npm run build`；只有需要本地模拟交互时才用 `npm run build:dev`。

## 非范围

- 不改小程序 AI 页面、Dify、云函数、云数据库、环境变量、密钥、AppID 或开发者工具账号配置。
- 不改 `dist` 输出目录结构，也不移动或删除用户已有的备份目录。
- 不把模拟代码删除；它保留给明确的本地开发场景。

## 验收标准

- 普通构建与 `build:demo` 均生成不含“模拟回答”代码、且调用 `aiService` 的 `dist` 包。
- `build:dev` 仍能明确生成模拟包，供本地交互开发使用。
- 未传模式的命令行解析结果为 `demo`；显式传入 `--mode=development` 时才是开发模式。
- 构建、包边界、类型、规范和文档检查均通过。

## 设计自查

- 根因在构建模式与同一输出目录的组合，方案直接改变默认入口而不改变云端行为。
- 模拟模式保留但需显式选择，真实体验版不再依赖使用者记忆额外参数。
- 所有行为差异可由无网络、无密钥的自动化测试验证。

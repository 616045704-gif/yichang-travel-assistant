# 首页交互恢复交付前独立验收记录

- 测试角色：独立测试
- 最终被测提交：`4758884`
- 本轮已实际运行自动化的提交：`e21748c760cceb85370a485d491caf318f5c6db3`
- 日期：2026-09-08
- 范围：首页 AI/地点交互、发现/地图分类交互、原生 Tab 与微信开发者工具冒烟恢复。

## 已实际执行的检查

| 命令/检查 | 结果 | 实际证据/备注 |
| --- | --- | --- |
| `git show --check e21748c` | 通过 | 无补丁空白错误输出。 |
| `node .local-tools\package\bin\npm-cli.js test` | 通过 | 在 `e21748c` 上实际运行：29 个测试文件通过、275 项断言通过；1 项数据库集成测试按配置跳过。AI 服务失败路径的 stderr 为安全失败断言预期日志。 |
| `node .local-tools\package\bin\npm-cli.js run typecheck` | 通过 | 在 `e21748c` 上 `tsc --noEmit` 退出码 0。 |
| `node .local-tools\package\bin\npm-cli.js run lint` | 通过 | 在 `e21748c` 上 `eslint .` 退出码 0。 |
| `node scripts\build.mjs --mode=development` | 通过 | 在 `e21748c` 上输出 `Build ready: dist/ (development)`。 |
| `node scripts\check-package.mjs` | 通过 | 在 `e21748c` 上输出 `Client routes, resources and boundary verified`。 |
| 关键源/产物 SHA-256 对比 | 通过 | 在 `e21748c` 上对 Home/Discover/Map WXML/WXSS、分类筛选与地点卡 WXML/WXSS、AI/地图关键派生资源共 14 个源文件与 `dist/miniprogram` 对应文件逐一比对，全部一致。 |

## 交互覆盖与代码级替代验证

- `e21748c` 的新增 smoke 选择器/路径断言被全量 Vitest 覆盖：两张 `.ai-quick-card`、AI 聊天路径、地点详情路径、分类选择器与地图分类切换入口。
- 该提交的 `navigation.test.ts` 在全量套件中通过；已覆盖当前选择器名称及次级页面路径的静态 smoke 合约。
- 在测试提交运行时，页面业务 TypeScript、云函数、Dify、数据库字段、接口和路由均未发生本轮修改；开发模式包体边界检查通过。
- 最终提交 `4758884` 由统筹方标记为增加真实 picker tap、收藏 query 校验、导航有界等待和校准后的图标资源。由于该最终提交通知发生在本测试角色完成 `e21748c` 的命令执行之后，且收到“停止所有新的工具尝试”指令，未对 `4758884` 再次运行命令。不得将上表的 `e21748c` 命令结果表述为 `4758884` 的完整自动化通过证据。

## Computer Use 与微信自动化

- 已成功通过 Computer Use 发现并定位前台微信开发者工具窗口：应用为 `D:\微信web开发者工具\微信开发者工具.exe`，窗口标题为 `yichang-travel`，窗口 id 为 `4524008`。
- 随后调用 `get_window_state({ include_screenshot: false, include_text: true })` 读取开发者工具状态未返回；宿主在约 856.5 秒后中止该调用。该次没有返回可用页面树、截图或明确的 `Trusted RPC service is not configured` 错误。
- 因此没有在微信开发者工具中实际点击自由问答、行程定制、地点详情、我的收藏、发现/地图分类，也没有取得本轮新的微信端截图；没有把微信编译或交互写作通过。
- 未获提供可连接的 `WECHAT_AUTOMATION_ENDPOINT`，故未执行官方微信自动化端到端脚本。

## 最终提交 `4758884` 的独立非 UI 复验

在收到补充复验指令后，已对最终提交 `47588841cc3cd631f0ea5c483af052c0dc1464c6` 实际运行以下命令：

| 命令/检查 | 结果 | 实际证据/备注 |
| --- | --- | --- |
| `git show --check 4758884` | 通过 | 无补丁空白错误输出。 |
| `node node_modules/vitest/vitest.mjs run tests/unit/navigation.test.ts tests/unit/provided-assets-ui.test.ts tests/unit/components.test.ts` | 通过 | 3 个测试文件、28 项断言通过；覆盖当前 AI/地点/分类/导航 smoke 合约、picker 映射及资源契约。 |
| `node node_modules/typescript/bin/tsc --noEmit` | 通过 | 退出码 0。 |
| `node node_modules/eslint/bin/eslint.js .` | 通过 | 退出码 0。 |
| `node scripts/check-package.mjs` | 通过 | 输出 `Client routes, resources and boundary verified`。 |
| `node scripts/build.mjs --mode=development` | 通过 | 输出 `Build ready: dist/ (development)`。 |
| 关键 source/dist SHA-256 | 通过 | Home/Discover/Map WXML/WXSS、分类筛选与地点卡 WXML/WXSS、AI/地图关键派生资源共 14 项均与 `dist/miniprogram` 对应文件一致。 |
| `git diff --check` | 通过 | 无空白错误输出。 |

该复验未重新发起 Computer Use，也没有把静态/单元检查替代为微信端页面交互结论。

## 缺陷与未测项

### 缺陷

- 在已实际运行的 `e21748c` 自动化、构建、包体和哈希检查范围内未发现缺陷。
- 最终提交的独立非 UI 复验未发现缺陷；微信端现场交互证据仍缺失。

### 未测项

- `4758884` 未由本测试角色重跑全量 Vitest；已完成的定向 3 文件、28 断言检查不能替代最终提交的全套回归。
- 微信开发者工具中的实际编译、页面点击、自由问答/行程定制跳转、地点详情、收藏、发现与地图 picker、地图触控及导航有界等待待验。
- Android/iPhone 真机、原生 picker 样式、定位授权/拒绝、真实云端地点/收藏、Dify、用户隔离及微信端到端自动化待验。

## 阶段结论

`e21748c` 全量回归通过；最终交付目标 `4758884` 的定向非 UI 回归、类型、Lint、开发构建、包体与关键产物一致性均通过。微信开发者工具交互、真机及真实云端路径仍无独立实测证据，因此本记录只对非 UI 可测范围阶段放行，不作完整微信端交付放行结论。

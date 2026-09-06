# 地点搜索与收藏样式独立验收记录

- 被测实现提交：`acc42efb64f910a385c8b8746419450ba6f09b6a`（`fix: refine place search and favorites`）
- 验收角色：独立测试
- 验收日期：2026-09-07
- 结论：**有条件不通过**。功能代码的静态复核与现有自动化检查均通过；但“一刀鲜酒楼不得作为全部列表/首页首项”的新增服务端行为没有可执行的针对性测试，未满足项目的行为变更测试纪律。补充该断言并复验后方可放行。

## 范围与静态复核

- 发现页 WXML 仅含一个地点关键词输入框；可见的 `🔍` 确认按钮使用 `bindtap="onSearch"`，输入框回车也绑定 `onSearch`。
- 发现页和首页的 `place-card` 均绑定 `bind:favoritechange="onFavorite"`；卡片组件仍以 `favoritechange` 事件发出地点标识和目标收藏状态。
- 列表收藏控件由右对齐的 `favorite-bar` 包裹，使用紧凑的图标加文字按钮（132rpx × 64rpx）。
- 详情收藏控件为图标加文字按钮，样式明确为 136rpx × 72rpx。
- 通用地点排序将“一刀鲜酒楼”置后，首页服务端筛除该项后再截取四条，因而其不会成为全部列表或首页的首项。
- 复核范围内未见 Dify、密钥、环境变量、云数据库权限或云端数据的改动。

## 实际执行项与结果

| 检查 | 结果 |
| --- | --- |
| `git diff --check acc42ef^..acc42ef` | 通过 |
| 相关 Vitest 启动 | 受本机受限子进程策略阻断（`spawn EPERM`）；未将此视为代码失败 |
| `npm run test`（以本机权限复验） | 通过：28 个测试文件通过、1 个跳过；253 项通过、1 项跳过 |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过 |
| `npm run build`（以本机权限复验） | 通过，生成开发构建产物 |
| `npm run check:package`（构建后） | 通过 |
| `npm run verify:docs` | 通过，36 份文档已验证 |

完整测试日志中 AI 服务的预期失败路径会输出安全错误诊断；测试本身均通过。

## 缺陷

### P1：一刀鲜排序/首页排除没有行为测试

`cloudfunctions/places/repository.ts` 新增“一刀鲜酒楼”排序规则，`cloudfunctions/places/service.ts` 新增首页排除规则；但 `tests/unit/place-service.test.ts` 仅断言首页 `featured` 是数组，未构造该地点并断言它不在首页、也不在全部列表首项。`tests/unit/visual-style.test.ts` 只覆盖界面文本/样式。应补充服务端单元测试后重新验收。

## 未测项

- 微信开发者工具与真机上的实际点击、布局、无障碍表现。
- 已部署云函数面对真实已发布地点数据的排序与首页返回结果；本次未读取或修改云端数据。
- 收藏接口的真实登录态和云函数部署可用性；本次仅验证前端事件绑定与本地自动化测试。

# 首页与发现大图地点卡复验记录

- 测试角色：独立测试
- 被测提交：`6c5f6d2ffff998a13853a2495535a60c3c0666b5`
- 日期：2026-09-08
- 改动边界：首页、发现页共用 `place-card` 与其自动化测试；未修改页面 TypeScript、云函数、接口或数据库。

## 自动化检查

| 命令 | 结果 | 证据/备注 |
| --- | --- | --- |
| `node .local-tools\\package\\bin\\npm-cli.js test` | 通过 | 29 个测试文件、270 项断言通过；1 项集成测试按既有配置跳过。 |
| `node .local-tools\\package\\bin\\npm-cli.js run typecheck` | 通过 | TypeScript 无诊断。 |
| `node .local-tools\\package\\bin\\npm-cli.js run lint` | 通过 | ESLint 无诊断。 |
| `node .local-tools\\package\\bin\\npm-cli.js run build` | 通过 | 与其他检查并行时曾短暂报 `menu-history.png` `ENOENT`；确认资源存在后顺序重跑，输出 `Build ready: dist/ (demo)`。 |
| `node scripts\\check-package.mjs` | 通过 | 客户端资源、路由与边界检查通过。 |
| `git diff --check` | 通过 | 未发现空白错误。 |

## 独立复核结论

- 首页已去除“旅行助手”“从哪里开始”“从灵感到行程”“四类地点”“值得停留”“精选地点”等模块标题和弱说明。
- AI 图标尺寸为 `136rpx`，分类图标尺寸为 `96rpx`，均使用已提供资源。
- 共享地点卡仅呈现大图、右上类型胶囊、黑色粗体名称和低存在感右下收藏；不再渲染行政区、简介或多个标签。
- 收藏仍以 `catchtap="onFavorite"` 触发，分类、跳转、搜索、收藏与重试的原有事件绑定未改。
- `place-card` 仅被首页和发现页引用；本次未新增停车场、意见反馈或自定义 Tab。

## 缺陷与未测项

- 本次可自动化与静态可测范围未发现可复现缺陷，可放行当前代码提交。
- 待验：独立测试角色的微信开发者工具截图与交互、Android/iPhone 真机、地图定位授权/拒绝、原生 Tab 选中态，以及端到端自动化（本机未设置 `WECHAT_AUTOMATION_ENDPOINT`）。

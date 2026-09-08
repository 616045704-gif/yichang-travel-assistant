# 搜索、首页与地点卡片独立验收记录

- 测试角色：独立测试（`independent_qa`）
- 被测提交：`57117fe6437dd2087fd2ba5f2a8454dc8f6fc941`
- 包含前置实现提交：`149041c`、`7799076`
- 日期：2026-09-08
- 测试环境：Windows、微信开发者工具 Stable `2.02.2608060`、iPhone 12/13 模拟器

## 自动化检查

| 命令 | 结果 | 证据/备注 |
| --- | --- | --- |
| `node .local-tools\package\bin\npm-cli.js test` | 通过 | 受限沙箱首轮因 Windows 临时目录访问被拒，13 个构建夹具失败；按原命令在允许环境复跑通过。29 个测试文件通过、1 个跳过；280 个断言通过、1 个跳过。跳过项为需要真实数据库环境的安全集成测试。 |
| `node .local-tools\package\bin\npm-cli.js run typecheck` | 通过 | `tsc --noEmit`，退出码 0。 |
| `node .local-tools\package\bin\npm-cli.js run lint` | 通过 | ESLint，退出码 0。 |
| `node .local-tools\package\bin\npm-cli.js run build` | 通过 | 生成 `dist/` demo 包，输出 `Build ready: dist/ (demo)`。 |
| `node scripts\check-package.mjs --mode=demo` | 通过 | 输出 `Client routes, resources and boundary verified`。 |
| `node scripts\check-package.mjs` | 通过 | 默认模式包检查同样通过。 |
| `node scripts\verify-docs.mjs` | 通过 | 创建本记录前共验证 56 份文档。 |
| `git diff --check` | 通过 | 无空白错误，退出码 0。 |

## `dist` 与源码一致性

执行 demo 构建后，对本轮直接交付到小程序包的文件进行 SHA-256 对比：

| 源文件 | `dist` 文件 | 结果 |
| --- | --- | --- |
| `miniprogram/pages/discover/index.wxml` | `dist/miniprogram/pages/discover/index.wxml` | 哈希一致 |
| `miniprogram/pages/discover/index.wxss` | `dist/miniprogram/pages/discover/index.wxss` | 哈希一致 |
| `miniprogram/pages/home/index.wxss` | `dist/miniprogram/pages/home/index.wxss` | 哈希一致 |
| `miniprogram/components/place-card/index.wxss` | `dist/miniprogram/components/place-card/index.wxss` | 哈希一致 |

`miniprogram/pages/discover/index.ts` 经构建转译为 `dist/miniprogram/pages/discover/index.js`；产物中实际存在 `searchExpanded`、`collapseSearch()`、`onKeywordInput()`、`onSearch()` 与 `onCategoryChange()`，其中收起搜索仅更新 `searchExpanded`，输入与提交仍为分离路径。

## 微信开发者工具预览

| 页面/状态 | 结果 | 独立实际观察 |
| --- | --- | --- |
| 编译与控制台 | 通过 | 在重新生成 `dist/` 后通过开发者工具重新编译，模拟器正常渲染；调试器显示 `Errors: 0, Warnings: 4`。可见警告为基础库资源预加载及自动热重载提示，未见致命编译错误或本轮新增的组件 WXSS 标签、ID、属性选择器警告。 |
| 首页 Hero 行动按钮 | 通过 | “出发吧”为白色胶囊按钮、紫色文字，位于头图水平居中区域；头图内容未被修改。 |
| 首页 AI 双图 | 通过 | “自由问答”和“行程定制”两张现有图片等宽、同高并居中排列，左右视觉权重一致。 |
| 发现页默认搜索 | 通过 | 页面进入后最左为普通线框放大镜，不再使用原发现页彩色图标；分类 Tab 与搜索保持同一横排。 |
| 搜索展开与关闭 | 通过 | 点击放大镜后原位展开；左侧关闭控件、输入区及右侧紫色线框纸飞机均显示，纸飞机无色块底。点击左侧关闭控件后搜索恢复为单一放大镜。 |
| 分类可用性 | 通过 | 搜索收起后点击“景区”，选中态切换成功，地点列表保持可用。搜索展开时仍可看到右侧分类项。 |
| 普通标题与收藏 | 通过 | “三峡人家风景区”标题与收藏控件处于同一水平行，收藏不覆盖标题。 |
| 长标题布局 | 通过 | “三峡大坝-屈原故里旅游区”在有限宽度下单行省略，右侧收藏控件仍保持独立区域，无重叠或换行挤压。 |
| 收藏点击热区 | 通过 | 点击“三峡竹海景区”右侧收藏区域后状态更新为“已收藏”，证明缩小后的视觉图标仍保留可点击热区。为避免通过取消收藏删除该记录，本次未执行反向切换。 |

## 缺陷与未测项

- 本次可测范围未发现致命、重要或一般级别的实现缺陷。
- 发现页原生输入框没有向 Computer Use 返回可访问性焦点，因此未自动输入关键词，也未人工执行纸飞机发送或键盘确认；“输入不触发请求、关闭不触发请求、仅提交搜索”由通过的页面单元测试与 smoke 脚本契约覆盖。
- 未执行官方 CLI 的额外预览命令；已使用打开的微信开发者工具对本轮 `dist` 完成重新编译与模拟器预览，且未上传代码。
- 未执行 Android 或 iPhone 真机测试；模拟器结果不能替代真机验收。
- 未执行真实数据库安全集成测试；测试套件明确跳过 1 项，需具备真实数据库环境后补测。
- 本次收藏热区验证为当前测试用户新增了“三峡竹海景区”收藏；未执行取消收藏，避免在没有单独确认的情况下删除用户数据。
- Computer Use 截图用于本次会话内即时检查，未另存为仓库文件。

## 结论

提交 `57117fe` 连同 `149041c`、`7799076` 通过完整自动化回归（除 1 项明确跳过的真实数据库安全集成测试）、类型检查、代码规范、demo 构建、包边界、文档和差异检查。本轮源码与 `dist` 对应文件一致；微信开发者工具预览确认首页白色居中“出发吧”、AI 双图对齐、发现页放大镜/关闭/无底纸飞机、分类切换、长标题与收藏同行以及收藏点击热区均符合验收要求。

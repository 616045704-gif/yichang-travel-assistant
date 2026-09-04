# 本地开发与微信导入

## 工具与本地配置

安装 Node.js 22.12 或更新的兼容 LTS 版本，使用项目锁文件安装依赖：

```powershell
npm ci
npm run test
npm run typecheck
npm run lint
npm run build
npm run check:package
npm run verify:docs
```

当前助手运行环境没有全局 npm，已临时下载 npm 11.11.0 到忽略目录 `.local-tools/package/`。该机器可将上面的 `npm` 换为 `node .local-tools/package/bin/npm-cli.js`。此临时工具不属于交付依赖；普通安装 Node.js 的电脑直接使用 npm。

复制 `config/local.example.json` 为 `config/local.json`，填写自己的 AppID；尚无云环境时 `cloudEnv` 保持空字符串。本地配置被 Git 忽略，只允许 AppID 和环境 ID，不能放 AppSecret、Dify 地址或密钥。

## 导入微信开发者工具

1. 安装官方 Windows 稳定版，使用有该小程序开发权限的微信扫码登录。
2. 执行 `npm run build`。选择“导入项目”，目录选本项目的 **dist 文件夹**，不要选 miniprogram 源码文件夹。
3. 构建已在 dist 中生成项目配置和本地 AppID；确认界面显示自己的 AppID。不要覆盖生成内容创建另一套模板。
4. 选择小程序编译，使用开发者工具当前可用的稳定基础库，记录实际版本。保持合法域名校验开启。
5. 点击“编译”，验证页面正常打开，记录工具版本和基础库版本。TypeScript 已由项目构建为 JS，不再选择额外的 TS 编译插件。
6. 每次改源码后重新构建，再在工具内编译；不要直接编辑 dist，重建会覆盖它。

实际编译与真机预览依赖已安装且登录的微信开发者工具。单元测试只验证代码和资源，不能据此宣称微信运行验收已通过。

## 创建开发云环境

1. 使用真实 AppID 导入后，点击工具中的“云开发”入口，按当前页面开通。
2. 建议环境名称 `yichang-dev`。环境 ID 由平台生成，复制到本地配置的 `cloudEnv`；名称不是环境 ID。
3. 如果出现付费套餐或充值要求，由用户查看价格并决定费用上限。本项目尚无预算授权，不能默认购买；未创建环境时仍可预览骨架。
4. 记录环境地区、可选 Node.js 运行时、基础能力和套餐；不填写 Dify 密钥、不导入用户数据。
5. 修改配置后重新构建和编译。`wx.cloud.init` 只初始化 SDK，不证明数据库和函数已可用；真实连通验证在后续部署服务时完成。
6. 数据库集合与规则按计划任务 08 部署，默认拒绝客户端直接访问。骨架阶段无需手动创建无权限保护的数据集合。

## 构建与验收边界

- 输出为 `dist/miniprogram/` 和每个独立的 `dist/cloudfunctions/<函数名>/`，导入目录为 dist。
- 发布候选构建使用 `npm run build:demo`，拒绝引入测试与模拟模块；当前无真实业务，不可作为体验版交付。
- `test:integration`、`validate:content`、`release:check` 是明确的阶段关口，未接入时返回 BLOCKED（退出码 2），不冒充测试通过。对应阶段实现后替换。
- 单元测试使用临时合成资料，不调用微信、Dify 或真实数据库。
- 禁止将个人配置、微信登录数据、身份标识、用户位置和原始截图提交 Git。

## 微信模拟器回归

已使用工具 2.02.2608060、基础库 3.16.2 和官方 miniprogram-automator 0.12.1 验证。先完成微信登录，在设置的安全页开启服务端口；不需要开启获取登录票据或全局自动信任。

每次构建后，用本机实际的 CLI 路径开启本项目自动化，再执行：

```powershell
& 'D:\微信web开发者工具\cli.bat' auto --project 'D:\ChatGPT\宜昌旅游助手\dist' --auto-port 9420 --trust-project
$env:WECHAT_AUTOMATION_ENDPOINT = 'ws://127.0.0.1:9420'
npm run test:e2e
```

`--trust-project` 仅针对自己创建的本项目。工具需要片刻完成编译后才可连接；遇到端口未就绪，等待工具完成编译再运行测试。新版本 Windows 工具不能由旧 SDK 的 launch 直接启动，因此先运行官方 CLI，再使用 SDK connect。

测试先核对 AppID，再切换四页、检查分类布局与点击、四种通用状态；结束恢复首页，截图写入 `.local/`。该脚本不创建云资源、不获取登录票据、不调用 Dify。没有配置本地端口时报告 BLOCKED；连接或断言失败时退出 1。

重新构建会保留 `dist` 根目录及其 `project.private.config.json`，以兼容打开中的开发者工具；其余生成文件仍会替换，禁止手工修改。

# 地点资料导入与回退

## 导入前

1. 在 `content/` 更新地点、详情和来源台账；不得填入密钥、用户资料或精确用户位置。
2. 运行 `npm run validate:content`。它检查四类枚举、唯一 ID、来源、核验日期、GCJ-02 坐标、详情一对一和动态信息禁用词。
3. 上传已获权图片到目标云存储，填入真实 `cloud://` file ID；公开演示样例无图片时保持 `draft`。
4. 使用真实 development 环境 ID 运行 `npm run plan:security-rules -- --target <envId>`，由安全管理端按输出逐项调用 CloudBase `ModifySafeRule`；每项为 `CUSTOM`，规则本体是 `{ "read": false, "write": false }`。随后用普通账号确认客户端无法直读或写入任何集合。

## 导入与复核

### 向半斗整理收集工作簿（公开体验资料）

此路径只处理用户提供的 `.xlsx` 地点表。它不把工作簿、生成的 JSON Lines、密钥或云环境信息放进 Git、聊天记录或小程序包。

1. 在项目根目录运行：

   ```powershell
   python scripts/convert_user_collected_workbook.py --source "<工作簿路径>"
   ```

   只查看终端的数量报告：已接收数量、拒绝数量、四类数量和拒绝行号。两份生成文件固定在已忽略的 `.local/import/`：`places.jsonl` 与 `place_contents.jsonl`。
2. 进入 CloudBase 控制台的数据库页面，先分别导出当前 `places` 与 `place_contents` 集合，作为回退备份；不要导出或改动用户集合、环境变量或权限。
3. 导入 `place_contents.jsonl`，选择 **JSON Lines** 格式和 **Upsert**。成功后再以相同选项导入 `places.jsonl`。先写详情、后公开地点，避免公开地点先出现而没有详情。
4. 两次控制台导入互相独立，不是跨集合事务。任一次失败都应停止：若详情已成功、地点失败，重新导入详情备份；若地点已成功但复核发现问题，先把对应地点改为 `draft`，再用两个备份恢复。修复后重新转换并导入，不能宣称本批次完整成功。
5. 保持两个集合为 `ADMINONLY`；不创建前端导入入口。分别抽查景区、餐馆、文化馆/博物馆、露营地各一条：应为 `published`、有对应详情、来源为“向半斗整理收集”。列表、地图和详情应可正常打开；缺少图片时显示既有占位提示。
6. 资料属于本地整理参考，不是官方核验资料。价格、营业时间、交通和预约只作参考，必须显示“请以官方公告为准”。AI 提问命中导入地点时，回答上下文应带“本地整理参考”，而不是“本地已核验资料”。

不要在本说明、命令行输出、截图、Git 提交或任何前端文件中填写 API Key、访问令牌、用户标识、完整环境标识或工作簿原始行内容。

```powershell
npm run import:content -- --target development --dry-run
npm run import:content -- --target development --apply
```

导入工具只接受 `development` 目标并要求由部署环境提供管理端适配器；本仓库默认适配器只输出计划，不能写云端。真实适配器必须以 `placeId` upsert `places`，并以相同 ID upsert `place_contents`；任何校验错误都在写入前阻断。重复导入相同内容不得增加文档数量。

`tests/integration/database-security.test.ts` 默认跳过，以免把本地检查当云端验证。仅在设置 `RUN_CLOUDBASE_INTEGRATION=1` 并提供已审核的 `CLOUDBASE_SECURITY_ADAPTER` 后运行；该适配器必须实际验证 12 个集合的客户端拒绝、两个测试账号的跨用户拒绝，以及地点图片上传/覆盖/删除拒绝。缺少适配器时测试会失败，不能产生“权限已验证”的假阳性。

抽检每个分类至少一条的来源、坐标和详情；确认图片权利与动态信息后，才由管理端把目标条目从 `draft` 改为 `published`。普通用户永远不获得导入入口。

## 回退

导入前保存同一 `placeId` 的受控备份。发现问题时恢复该地点的上一版本，或将它改回 `draft`；不得清空集合、删除用户收藏/浏览记录，或用全库回滚处理单条内容问题。

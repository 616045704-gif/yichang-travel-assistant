# 地点资料导入与回退

## 导入前

1. 在 `content/` 更新地点、详情和来源台账；不得填入密钥、用户资料或精确用户位置。
2. 运行 `npm run validate:content`。它检查四类枚举、唯一 ID、来源、核验日期、GCJ-02 坐标、详情一对一和动态信息禁用词。
3. 上传已获权图片到目标云存储，填入真实 `cloud://` file ID；公开演示样例无图片时保持 `draft`。
4. 部署集合、索引和默认拒绝规则。用普通账号确认客户端无法直读或写入任何集合。

## 导入与复核

```powershell
npm run import:content -- --target development --dry-run
npm run import:content -- --target development --apply
```

导入工具只接受 `development` 目标并要求由部署环境提供管理端适配器；本仓库默认适配器只输出计划，不能写云端。真实适配器必须以 `placeId` upsert `places`，并以相同 ID upsert `place_contents`；任何校验错误都在写入前阻断。重复导入相同内容不得增加文档数量。

抽检每个分类至少一条的来源、坐标和详情；确认图片权利与动态信息后，才由管理端把目标条目从 `draft` 改为 `published`。普通用户永远不获得导入入口。

## 回退

导入前保存同一 `placeId` 的受控备份。发现问题时恢复该地点的上一版本，或将它改回 `draft`；不得清空集合、删除用户收藏/浏览记录，或用全库回滚处理单条内容问题。

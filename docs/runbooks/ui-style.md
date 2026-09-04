# 基础 UI 规范

沿用[已确认设计](../superpowers/specs/2026-09-04-yichang-travel-mini-program-design.md)，视觉以用户参考确认的[山水文旅调整](../superpowers/specs/2026-09-04-ink-travel-design.md)为准，不引入额外产品范围。

| 项目 | 约定 |
| --- | --- |
| 主色 | 山水青绿 #627968，深墨绿 #3F574A，朱红选中态 #A44D3E |
| 辅色 | 古金 #B29A65，浅纸金 #EBE0C9 |
| 背景 | 宣纸米色 #F5EDDF，卡片 #FCF8EF |
| 圆角 | 共享卡片与控件 24rpx，地图独立按钮 44rpx；首页全幅山水画 |
| 字体 | 正文系统字体 28rpx，标题宋体优先并回退 serif；首页宜昌二字楷体优先，真机字体随系统有所不同 |
| 触达 | 可点击按钮高度至少 88rpx；底部保留安全区 |
| 长文 | 地点名称、描述和状态提示允许换行；分类允许换行排列 |
| 图标 | 本项目原创线条 SVG，栅格化为 81×81 PNG 供原生 tabBar 使用；源 SVG 一并保留 |
| 主视觉 | 原创水墨山水装饰图，配合宜昌标题与印章；不作为任何地点的实景资料 |

## 四页状态

- 首页：品牌主视觉、发现入口、四分类、AI 准备状态、精选资料未接入提示。
- 发现：四分类与全部切换，未接入时如实显示空状态；没有合成地点。
- 地图：铺满内容区，顶部分类容器背景、边框与整体阴影全部移除，透明容器不拦截手势，按钮单独接收事件。浅米按钮保持底图上的可读性，朱红表示选中。公开地点结果接入后，切换分类更新对应标记；当前默认无地点数据，不读取用户位置。
- 我的：收藏、浏览、问答、偏好、反馈均标注准备中；隐私说明可打开。

## 组件契约

- `async-state`：loading 显示加载；empty 显示说明；error 显示错误与重试，触发 retry；ready 显示 slot。
- `category-filter`：接收 value，只发 categorychange，detail 为 category；类别使用共享枚举。
- `place-card`：仅展示传入的地点，发 open(placeId) 与 favoritechange(placeId, favorite)；等待服务端确认收藏，pending 时禁用；图片失败显示占位。
- 地图 `setPlaces` 接收公开地点结果；`buildMarkers` 排除无效坐标、重复 placeId 和未知分类，切分类保持数字 ID 与视野稳定，点击标记气泡显示地点名。

数据组件不得申请定位或调用 Dify。云环境未配置时启动不调用初始化；配置后关闭 traceUser，SDK 初始化状态不代表云业务已连通。

## 微信内人工核验

- [ ] 四个 tab 可切换且选中色正常；字体放大后主要操作仍可见。
- [ ] 发现和地图的分类选择状态更新；地图可拖动，无定位授权弹窗。
- [ ] 我的隐私说明可打开关闭；准备中的入口不会跳转到不存在的页面。
- [ ] 在开发者工具的组件调试中分别设置 loading、empty、error、ready，确认文字和重试状态。
- [ ] 小屏与底部安全区无遮挡，长地点名和分类名换行正常。

以上是微信实际渲染检查，不以 Node.js 单元测试替代。

## 原创素材记录

- 工具：内置 imagegen，2026-09-04 生成，未使用 API/CLI 备用方式。
- 项目资产：`miniprogram/assets/illustrations/yichang-ink.jpg`，原图按比例缩至 1125px 宽并压缩用于小程序；原始生成图留在工具输出目录。
- 用途：首页装饰山水，不属于地点集合，不代表真实地标或景区照片。参考截图仅用于理解整体风格，未裁切、复制其图文。
- 分类图标由本项目 SVG 源码绘制，PNG 为同源导出；原 tab 图标沿用源码并调整颜色。

完整生成提示词：

```text
Create an original decorative background illustration asset for a Yichang travel mini program. Chinese traditional meticulous ink-and-watercolor shan shui landscape on warm ivory rice paper (#f5eddf), aged subtle paper grain, muted jade green layered steep Yangtze river gorge mountains, mist, winding broad pale river leading into distance, tiny traditional riverside pavilion and trees on the far right foreground, one very small boat. Elegant restrained museum cultural tourism art, hand painted detailed organic brushwork, no vector flat style, no photorealism. Landscape 3:2 aspect ratio. Composition: top left 45% mostly empty pale paper for application title text that will be added separately, landscape concentrated lower half and right third, edges dissolve gently into ivory paper. NO text, letters, logos, frames, UI, seals, or recognizable copied architectural landmark. This is an imaginative decorative landscape inspired by Yichang's river and mountains, not a factual place photo.
```

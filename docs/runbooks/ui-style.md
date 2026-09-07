# 现代紫黄 UI 规范

遵循[产品设计](../superpowers/specs/2026-09-04-yichang-travel-mini-program-design.md)与已确认的[现代紫黄视觉方案](../superpowers/specs/2026-09-07-modern-purple-yellow-ui-design.md)。仅定义前端呈现；不改变地点、用户记录、AI 或云函数的数据契约。

| 项目 | 约定 |
| --- | --- |
| 主色 | 品牌紫 `#623BC7`，深紫 `#2B174D`，高亮黄 `#FFC400` |
| 页面与文字 | 浅紫页面 `#F8F6FF`、白色卡片、深灰紫正文 `#30254A`、柔灰紫辅助文字 `#746C8B` |
| 字体 | `-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif`；不使用宋体、楷体或仿古展示字体 |
| 圆角与留白 | 页面 32rpx、卡片 28rpx、控件 20rpx；卡片使用轻紫投影，避免厚重描边 |
| 按钮 | 黄色主按钮配深紫文字；白底紫描边为次按钮；危险操作使用柔红色语义反馈 |
| 原生导航 | 深紫导航栏和 Tab 栏，白色标题/未选中图标，黄色表示选中状态 |
| 图标 | 项目原创的圆角几何图标；Tab 与分类图标均保留 SVG 源及同源 PNG，不复制参考作品资产 |

## 页面与反馈状态

- 首页：深紫渐变品牌首屏，CSS 几何河流/轨道元素、分类、AI 入口及精选地点。
- 发现：分类筛选、紧凑搜索、地点卡片与深紫资料提示；不使用印章、卷轴或水墨装饰。
- 地图：保留可交互的全屏地图和透明筛选容器；独立圆角按钮使用紫黄状态色。
- 我的与辅助页：统一英文小标签、中文标题、白色模块卡与紫色强调；个人记录仍只对对应用户可见。
- `async-state`：加载、空白、错误、重试均为同一套几何图形与卡片反馈。
- `feedback-toast`：收藏与偏好操作失败/成功使用可关闭的站内紫黄提示，不依赖系统 Toast 外观。

## 组件契约

- `async-state`：loading 显示加载；empty 显示说明；error 显示错误与重试，触发 retry；ready 显示 slot。
- `feedback-toast`：接收 `visible`、`tone` 与 `message`，只发出 `dismiss`，不调用服务或改写业务数据。
- `category-filter`：接收 value，只发 categorychange，detail 为 category；类别使用共享枚举。
- `place-card`：仅展示传入的地点，发 open(placeId) 与 favoritechange(placeId, favorite)；等待服务端确认收藏，pending 时禁用；图片失败显示占位。
- 地图 `setPlaces` 接收公开地点结果；`buildMarkers` 排除无效坐标、重复 placeId 和未知分类，切分类保持数字 ID 与视野稳定，点击标记气泡显示地点名。

数据组件不得申请定位或调用 Dify。云环境未配置时启动不调用初始化；配置后关闭 traceUser，SDK 初始化状态不代表云业务已连通。

## 微信内人工核验

- [ ] 四个 tab 可切换，深紫底栏、黄色选中态与原创图标正确显示。
- [ ] 首页、发现、地图、详情、我的页的标题、卡片、按钮与空状态均使用紫黄系统；没有印章、水墨或仿古字体。
- [ ] 发现和地图的分类选择状态更新；地图可拖动，无定位授权弹窗。
- [ ] 收藏失败、移除收藏、保存偏好出现可关闭的站内提示；loading、empty、error、retry 均可读。
- [ ] 我的隐私说明、浏览/收藏记录、AI 记录、旅行偏好均可打开；操作不跳转到不存在的页面。
- [ ] 小屏与底部安全区无遮挡，长地点名、状态和分类名换行正常。

以上是微信实际渲染检查，不以 Node.js 单元测试替代。

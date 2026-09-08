# 行程调整输入框 iPhone 主动滚动控制设计

## 问题结论

iPhone 微信二维码预览中，用户点击行程调整框后，键盘正常弹出，输入框仍保持焦点，用户也能继续打字，但页面视野瞬间滚回“当前计划”开头，因此看不到输入框和正在输入的内容。微信开发者工具不复现；同一台 iPhone 上的自由问答长内容和多轮输入正常。

以下三种被动结构或属性调整已经由用户在 iPhone 上验证无效：

1. `adjust-position="false"`。
2. `adjust-position="{{false}}"`。
3. 将调整输入框外层从 `label` 换成 `view`。

这说明继续修改 `textarea` 的静态属性或外层标签不能控制最终视野。问题位于键盘出现后的页面滚动阶段，而不是焦点、输入事件、Dify、云函数或表单数据阶段。

## 方案选择

采用用户确认的主动滚动方案：调整 `textarea` 监听微信原生 `keyboardheightchange` 事件。当事件报告键盘高度大于 0 时，页面立即调用 `wx.pageScrollTo`，按唯一 ID 把调整输入框重新定位到当前可视区域顶部，使输入框稳定显示在键盘上方。

该方案使用项目已安装的官方微信小程序类型定义：`TextareaKeyboardHeightChange` 的事件详情包含 `height` 和 `duration`，最低基础库为 2.7.0；`wx.pageScrollTo` 的 `selector` 定位最低基础库为 2.7.3。实现只使用 `height`、`selector` 和零时长滚动，不依赖较新的 `offsetTop`。

不采用以下方案：

- 不继续增加 `textarea` 静态属性，因为三次真机复测已经证明被动调整无效。
- 不把调整框移到行程上方，避免打乱“先看计划、再提调整”的阅读顺序。
- 不拆分为独立页面，避免新增跨页面状态同步和返回后的结果刷新逻辑。

## 页面行为与数据流

1. 用户点击调整输入框，微信弹出键盘。
2. `textarea` 触发 `keyboardheightchange`。
3. 键盘高度为 0 时不滚动，避免收起键盘后改变用户位置。
4. 键盘高度大于 0 时调用：

```ts
wx.pageScrollTo({
  selector: '#trip-adjustment-input',
  duration: 0,
});
```

5. 页面把调整输入框定位到可视区域，焦点和已输入文字保持不变。
6. `onAdjustment`、`submitAdjustment`、完整行程重新生成和异常处理继续走原有逻辑。

不注册全局键盘监听，不需要页面卸载清理，也不保存键盘高度。组件事件可能多次触发时，每次都是定位到同一个目标、零动画的幂等操作，不修改业务状态。

## 代码边界

- `miniprogram/pages/trip-form/index.wxml`：为调整 `textarea` 增加唯一 ID 和键盘高度事件绑定。
- `miniprogram/pages/trip-form/index.ts`：增加键盘高度事件处理方法，只负责判断高度并调用页面滚动 API。
- `tests/unit/trip-form.test.ts`：验证 WXML 绑定、键盘打开时的定位调用及键盘关闭时不滚动。
- `docs/testing/2026-09-08-trip-adjustment-ios-keyboard-qa.md`：追加第三次真机失败和新方案的实际验收结果。

不修改 WXSS、Dify、云函数、数据库、环境变量、密钥、行程提示词、会话或用户记录。

## 异常处理

`wx.pageScrollTo` 只影响页面视野。即使某台旧设备不支持选择器或调用失败，输入焦点、文字内容和提交逻辑也不会被清空；本次不弹出错误提示，以免打断用户输入。当前上线目标使用的微信客户端版本应满足基础库 2.7.3 以上。

## 测试与验收

自动化测试应覆盖：

1. 调整输入框具有 `id="trip-adjustment-input"` 和 `bindkeyboardheightchange="onAdjustmentKeyboardHeightChange"`。
2. 键盘高度大于 0 时，`wx.pageScrollTo` 使用该 ID、`duration: 0` 调用一次。
3. 键盘高度等于 0 时不调用页面滚动。
4. 原有行程输入、偏好选择、完整重新生成、重试和重新规划测试继续通过。

本地检查通过后重新生成真实 `dist`。最终验收由用户在 iPhone 新二维码中执行“生成行程 → 点击调整框 → 连续输入文字 → 确认调整”：输入框必须在键盘上方可见，文字不丢失，完整行程可重新生成。开发者工具结果不能替代真机验收。

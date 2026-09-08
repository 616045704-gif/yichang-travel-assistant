export {};

Page({
  data: {
    adjustment: '',
    error: '',
  },
  onInput(event: WechatMiniprogram.Input) {
    this.setData({ adjustment: event.detail.value, error: '' });
  },
  confirmAdjustment() {
    const adjustment = this.data.adjustment.trim();
    if (!adjustment || adjustment.length > 1000) {
      this.setData({ error: '请输入 1–1000 字的行程调整建议' });
      return;
    }
    const eventChannel = this.getOpenerEventChannel();
    if (!eventChannel.emit) {
      this.setData({ error: '无法返回行程页面，请重新进入行程定制' });
      return;
    }
    eventChannel.emit('confirmAdjustment', { adjustment });
    wx.navigateBack();
  },
});

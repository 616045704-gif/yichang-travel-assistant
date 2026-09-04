export {};

Page({
  data: {
    entries: [
      { title: '我的收藏', description: '把心动的地方留到下一次', symbol: '♡', url: '/pages/records/index?type=favorites' },
      { title: '浏览记录', description: '回看曾经发现的好地方', symbol: '◷', url: '/pages/records/index?type=browse' },
      { title: 'AI 问答记录', description: '回看本次模拟的问答与行程', symbol: '✦', url: '/pages/ai-history/index' },
      { title: '旅行偏好', description: '认识你喜欢的旅行方式', symbol: '☷', url: '/pages/preferences/index' },
    ],
  },
  openEntry(event: WechatMiniprogram.BaseEvent) { const url = event.currentTarget.dataset.url as string | undefined; if (url) wx.navigateTo({ url }); },
  showPrivacy() { wx.navigateTo({ url: '/pages/privacy/index' }); },
});

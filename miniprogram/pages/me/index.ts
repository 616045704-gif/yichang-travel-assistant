export {};

Page({
  data: {
    entries: [
      { title: '我的收藏', description: '把心动的地方留到下一次', symbol: '♡' },
      { title: '浏览记录', description: '回看曾经发现的好地方', symbol: '◷' },
      { title: 'AI 问答记录', description: '留存每一次旅行灵感', symbol: '✧' },
      { title: '旅行偏好', description: '认识你喜欢的旅行方式', symbol: '☷' },
      { title: '意见反馈', description: '一起完善这份宜昌指南', symbol: '↗' },
    ],
  },
  showPrivacy() {
    wx.showModal({
      title: '当前版本隐私说明',
      content: '当前为基础页面版本，不读取定位、不要求手机号，也不保存收藏或问答记录。云端个人记录与外部 AI 尚未接入，开放前将补充实际数据用途和保留规则。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#176b5b',
    });
  },
});

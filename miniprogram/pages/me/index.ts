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
      content: '仅当你点击“定位我的附近”时，才会申请并读取当前位置，用于当次 20 公里地点筛选；不会长期保存位置。拒绝定位后仍可浏览地图。当前不要求手机号；收藏和问答记录功能尚未接入。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#176b5b',
    });
  },
});

import { CATEGORIES } from '../../../shared/contracts';

Page({
  data: { categories: CATEGORIES },
  openDiscover() { wx.switchTab({ url: '/pages/discover/index' }); },
  openAiChat() { wx.navigateTo({ url: '/pages/ai-chat/index' }); },
  openTripForm() { wx.navigateTo({ url: '/pages/trip-form/index' }); },
});

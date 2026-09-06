import { CATEGORIES, type Category } from '../../../shared/contracts';

type TravelApp = { globalData: { pendingDiscoverCategory: Category | '' } };

Page({
  data: { categories: CATEGORIES },
  openDiscover() { wx.switchTab({ url: '/pages/discover/index' }); },
  onCategoryTap(event: WechatMiniprogram.TouchEvent) {
    const category: unknown = event.currentTarget.dataset.category;
    if (typeof category !== 'string' || !CATEGORIES.some(item => item.value === category)) return;
    getApp<TravelApp>().globalData.pendingDiscoverCategory = category as Category;
    wx.switchTab({ url: '/pages/discover/index' });
  },
  openAiChat() { wx.navigateTo({ url: '/pages/ai-chat/index' }); },
  openTripForm() { wx.navigateTo({ url: '/pages/trip-form/index' }); },
});

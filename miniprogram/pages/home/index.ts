import { CATEGORIES, type Category } from '../../../shared/contracts';
import type { PlaceSummary } from '../../../shared/contracts';
import { getHomePlaces } from '../../services/places';

type TravelApp = { globalData: { pendingDiscoverCategory: Category | '' } };

Page({
  data: { categories: CATEGORIES, featured: [] as PlaceSummary[], featuredStatus: 'loading' as 'loading' | 'ready' | 'empty' | 'error' },
  onShow() { void this.loadFeatured(); },
  async loadFeatured() {
    try { const { featured } = await getHomePlaces(); this.setData({ featured, featuredStatus: featured.length ? 'ready' : 'empty' }); }
    catch { this.setData({ featuredStatus: 'error' }); }
  },
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

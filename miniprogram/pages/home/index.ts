import { CATEGORIES, type Category } from '../../../shared/contracts';
import type { PlaceSummary } from '../../../shared/contracts';
import { getHomePlaces } from '../../services/places';
import { setFavorite } from '../../services/user';

type TravelApp = { globalData: { pendingDiscoverCategory: Category | '' } };

Page({
  data: { categories: CATEGORIES, featured: [] as PlaceSummary[], featuredStatus: 'loading' as 'loading' | 'ready' | 'empty' | 'error', feedback: { visible: false, tone: 'info', message: '' } },
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
  openPlace(event: WechatMiniprogram.CustomEvent<{ placeId: string }>) {
    wx.navigateTo({ url: `/pages/place-detail/index?placeId=${encodeURIComponent(event.detail.placeId)}` });
  },
  async onFavorite(event: WechatMiniprogram.CustomEvent<{ placeId: string; favorite: boolean }>) {
    try { const result = await setFavorite(event.detail.placeId, event.detail.favorite); this.setData({ [`featured[${this.data.featured.findIndex(item => item.placeId === result.placeId)}].isFavorite`]: result.favorite }); }
    catch { this.setData({ feedback: { visible: true, tone: 'error', message: '收藏未保存，请稍后重试' } }); }
  },
  onFeedbackDismiss() { this.setData({ 'feedback.visible': false }); },
  openAiChat() { wx.navigateTo({ url: '/pages/ai-chat/index' }); },
  openTripForm() { wx.navigateTo({ url: '/pages/trip-form/index' }); },
});

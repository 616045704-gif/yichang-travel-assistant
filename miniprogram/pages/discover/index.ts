import type { Category } from '../../../shared/contracts';
import { listPlaces } from '../../services/places';
import { setFavorite } from '../../services/user';
import { PlaceListViewModel } from '../../view-models/place-list';

const viewModel = new PlaceListViewModel(listPlaces);
type TravelApp = { globalData: { pendingDiscoverCategory: Category | '' } };

Page({
  data: { ...viewModel.state, feedback: { visible: false, tone: 'info', message: '' } },
  onShow() {
    const app = getApp<TravelApp>();
    const category = app.globalData.pendingDiscoverCategory;
    app.globalData.pendingDiscoverCategory = '';
    if (category) { void viewModel.setFilters({ category }).then(() => this.sync()); return; }
    void this.refresh();
  },
  sync() { this.setData(viewModel.state); },
  async refresh() { await viewModel.reload(); this.sync(); },
  onCategoryChange(event: WechatMiniprogram.CustomEvent<{ category: Category | '' }>) {
    this.setData({ category: event.detail.category, keyword: '' });
    void viewModel.setFilters({ category: event.detail.category, keyword: '' }).then(() => this.sync());
  },
  onKeywordInput(event: WechatMiniprogram.Input) { this.setData({ keyword: event.detail.value }); },
  onSearch() { void viewModel.setFilters({ keyword: this.data.keyword, tag: '' }).then(() => this.sync()); },
  onRetry() { void this.refresh(); },
  onReachBottom() { void viewModel.loadMore().then(() => this.sync()); },
  openPlace(event: WechatMiniprogram.CustomEvent<{ placeId: string }>) {
    wx.navigateTo({ url: `/pages/place-detail/index?placeId=${encodeURIComponent(event.detail.placeId)}` });
  },
  async onFavorite(event: WechatMiniprogram.CustomEvent<{ placeId: string; favorite: boolean }>) {
    try { const result = await setFavorite(event.detail.placeId, event.detail.favorite); this.setData({ [`items[${this.data.items.findIndex((item: { placeId: string }) => item.placeId === result.placeId)}].isFavorite`]: result.favorite }); }
    catch { this.setData({ feedback: { visible: true, tone: 'error', message: '收藏未保存，请稍后重试' } }); }
  },
  onFeedbackDismiss() { this.setData({ 'feedback.visible': false }); },
});

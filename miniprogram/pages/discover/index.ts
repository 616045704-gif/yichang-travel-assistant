import type { Category } from '../../../shared/contracts';
import { listPlaces } from '../../services/places';
import { PlaceListViewModel } from '../../view-models/place-list';

const viewModel = new PlaceListViewModel(listPlaces);
type TravelApp = { globalData: { pendingDiscoverCategory: Category | '' } };

Page({
  data: viewModel.state,
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
    this.setData({ category: event.detail.category });
    void viewModel.setFilters({ category: event.detail.category }).then(() => this.sync());
  },
  onKeywordInput(event: WechatMiniprogram.Input) { this.setData({ keyword: event.detail.value }); },
  onTagInput(event: WechatMiniprogram.Input) { this.setData({ tag: event.detail.value }); },
  onSearch() { void viewModel.setFilters({ keyword: this.data.keyword, tag: this.data.tag }).then(() => this.sync()); },
  onRetry() { void this.refresh(); },
  onReachBottom() { void viewModel.loadMore().then(() => this.sync()); },
  openPlace(event: WechatMiniprogram.CustomEvent<{ placeId: string }>) {
    wx.navigateTo({ url: `/pages/place-detail/index?placeId=${encodeURIComponent(event.detail.placeId)}` });
  },
});

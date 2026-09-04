import type { Category } from '../../../shared/contracts';

Page({
  data: { category: '' as Category | '' },
  onCategoryChange(event: WechatMiniprogram.CustomEvent<{ category: Category | '' }>) {
    this.setData({ category: event.detail.category });
  },
});

import { YICHANG_CENTER } from '../../config/runtime';
import type { Category } from '../../../shared/contracts';

Page({
  data: { center: YICHANG_CENTER, markers: [], category: '' as Category | '' },
  onCategoryChange(event: WechatMiniprogram.CustomEvent<{ category: Category | '' }>) {
    this.setData({ category: event.detail.category });
  },
});

import { CATEGORIES } from '../../../shared/contracts';

Page({
  data: { categories: CATEGORIES },
  openDiscover() { wx.switchTab({ url: '/pages/discover/index' }); },
});

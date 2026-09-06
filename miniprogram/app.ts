import { runtime } from './config/runtime';
import type { Category } from '../shared/contracts';

App({
  globalData: { cloudStatus: 'unconfigured', pendingDiscoverCategory: '' as Category | '' },
  onLaunch() {
    if (!runtime.cloudEnv) return;
    if (!wx.cloud) {
      this.globalData.cloudStatus = 'unavailable';
      return;
    }
    try {
      wx.cloud.init({ env: runtime.cloudEnv, traceUser: false });
      this.globalData.cloudStatus = 'initialized';
    } catch {
      this.globalData.cloudStatus = 'error';
    }
  },
});

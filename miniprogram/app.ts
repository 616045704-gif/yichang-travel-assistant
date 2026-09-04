import { runtime } from './config/runtime';

App({
  globalData: { cloudStatus: 'unconfigured' },
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

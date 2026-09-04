import { getPreferences, savePreferences } from '../../services/user';

const options = ['自然风景', '人文历史', '美食探索', '亲子出行', '轻松慢游', '露营体验'];
Page({
  data: { options, selected: [] as string[], status: 'loading', message: '', saving: false },
  onLoad() { void this.load(); },
  async load() {
    this.setData({ status: 'loading', message: '' });
    try { this.setData({ selected: (await getPreferences()).preferences, status: 'ready' }); }
    catch { this.setData({ status: 'error', message: '旅行偏好暂时无法加载，请检查网络后重试。' }); }
  },
  onRetry() { void this.load(); },
  onToggle(event: WechatMiniprogram.BaseEvent) {
    const value = event.currentTarget.dataset.value as string | undefined;
    if (!value) return;
    const selected = this.data.selected.includes(value) ? this.data.selected.filter(item => item !== value) : [...this.data.selected, value];
    if (selected.length > 6) return;
    this.setData({ selected });
  },
  async onSave() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try { this.setData({ selected: (await savePreferences(this.data.selected)).preferences }); wx.showToast({ title: '已保存', icon: 'success' }); }
    catch { wx.showToast({ title: '保存失败，请稍后重试', icon: 'none' }); }
    finally { this.setData({ saving: false }); }
  },
});

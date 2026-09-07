import { getPreferences, savePreferences } from '../../services/user';

const optionValues = ['自然风景', '人文历史', '美食探索', '亲子出行', '轻松慢游', '露营体验'];
type PreferenceOption = { value: string; selected: boolean };

function visibleOptions(selected: string[]): PreferenceOption[] {
  return optionValues.map(value => ({ value, selected: selected.includes(value) }));
}

Page({
  data: { options: visibleOptions([]), selected: [] as string[], status: 'loading', message: '', saving: false, feedback: { visible: false, tone: 'info', message: '' } },
  onLoad() { void this.load(); },
  async load() {
    this.setData({ status: 'loading', message: '' });
    try {
      const selected = (await getPreferences()).preferences;
      this.setData({ selected, options: visibleOptions(selected), status: 'ready' });
    }
    catch { this.setData({ status: 'error', message: '旅行偏好暂时无法加载，请检查网络后重试。' }); }
  },
  onRetry() { void this.load(); },
  onToggle(event: WechatMiniprogram.BaseEvent) {
    const value = event.currentTarget.dataset.value as string | undefined;
    if (!value) return;
    const selected = this.data.selected.includes(value) ? this.data.selected.filter(item => item !== value) : [...this.data.selected, value];
    if (selected.length > 6) return;
    this.setData({ selected, options: visibleOptions(selected) });
  },
  async onSave() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const selected = (await savePreferences(this.data.selected)).preferences;
      this.setData({ selected, options: visibleOptions(selected) });
      this.setData({ feedback: { visible: true, tone: 'success', message: '已保存' } });
    }
    catch { this.setData({ feedback: { visible: true, tone: 'error', message: '保存失败，请稍后重试' } }); }
    finally { this.setData({ saving: false }); }
  },
  onFeedbackDismiss() { this.setData({ 'feedback.visible': false }); },
});

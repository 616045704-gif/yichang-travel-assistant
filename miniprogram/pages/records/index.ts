import type { RecordType, UserRecord } from '../../../shared/contracts';
import { getPlaceDetail } from '../../services/places';
import { listRecords, setFavorite } from '../../services/user';

type DisplayRecord = UserRecord & { name: string; unavailable: boolean };
Page({
  data: { type: 'favorites' as Exclude<RecordType, 'trips'>, title: '我的收藏', status: 'loading', message: '', items: [] as DisplayRecord[], nextCursor: null as string | null, feedback: { visible: false, tone: 'info', message: '' } },
  onLoad(query: Record<string, string | undefined>) {
    const type: Exclude<RecordType, 'trips'> = query.type === 'browse' ? 'browse' : 'favorites';
    this.setData({ type, title: type === 'browse' ? '浏览记录' : '我的收藏' });
    void this.load();
  },
  async load(cursor: string | null = null, append = false) {
    if (!append) this.setData({ status: 'loading', message: '' });
    try {
      const page = await listRecords(this.data.type, cursor);
      const items = await Promise.all(page.items.map(async record => {
        try { return { ...record, name: (await getPlaceDetail(record.placeId)).name, unavailable: false }; }
        catch { return { ...record, name: '地点暂不可用', unavailable: true }; }
      }));
      const merged = append ? [...this.data.items, ...items] : items;
      this.setData({ items: merged, nextCursor: page.nextCursor, status: merged.length ? 'ready' : 'empty' });
    } catch { this.setData({ status: 'error', message: '个人记录暂时无法加载，请检查网络后重试。' }); }
  },
  onRetry() { void this.load(); },
  onReachBottom() { if (this.data.nextCursor) void this.load(this.data.nextCursor, true); },
  openPlace(event: WechatMiniprogram.BaseEvent) {
    const placeId = event.currentTarget.dataset.placeId as string | undefined;
    if (placeId) wx.navigateTo({ url: `/pages/place-detail/index?placeId=${encodeURIComponent(placeId)}` });
  },
  async removeUnavailableFavorite(event: WechatMiniprogram.BaseEvent) {
    const placeId = event.currentTarget.dataset.placeId as string | undefined;
    if (!placeId || this.data.type !== 'favorites') return;
    try { await setFavorite(placeId, false); this.setData({ feedback: { visible: true, tone: 'success', message: '已移除收藏' } }); void this.load(); }
    catch { this.setData({ feedback: { visible: true, tone: 'error', message: '移除失败，请稍后重试' } }); }
  },
  onFeedbackDismiss() { this.setData({ 'feedback.visible': false }); },
});

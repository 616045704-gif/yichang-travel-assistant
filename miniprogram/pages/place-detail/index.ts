import type { PlaceDetail } from '../../../shared/contracts';
import { getPlaceDetail } from '../../services/places';
import { recordBrowse, setFavorite } from '../../services/user';

Page({
  data: { placeId: '', place: null as PlaceDetail | null, status: 'loading', message: '', favoritePending: false, feedback: { visible: false, tone: 'info', message: '' } },
  onLoad(query: Record<string, string | undefined>) { this.setData({ placeId: query.placeId || '' }); void this.loadDetail(); },
  async loadDetail() {
    if (!this.data.placeId) { this.setData({ status: 'error', message: '地点信息无效，请返回列表后重试。' }); return; }
    this.setData({ status: 'loading', message: '' });
    try {
      const place = await getPlaceDetail(this.data.placeId);
      this.setData({ place, status: 'ready' });
      void recordBrowse(place.placeId).catch(() => { /* A record failure must not hide a successfully loaded public detail. */ });
    }
    catch { this.setData({ status: 'error', message: '地点资料暂时无法加载，请返回列表后重试。' }); }
  },
  onRetry() { void this.loadDetail(); },
  async onFavorite() {
    const place = this.data.place;
    if (!place || this.data.favoritePending) return;
    this.setData({ favoritePending: true });
    try { const result = await setFavorite(place.placeId, !place.isFavorite); this.setData({ 'place.isFavorite': result.favorite }); }
    catch { this.setData({ feedback: { visible: true, tone: 'error', message: '收藏未保存，请稍后重试' } }); }
    finally { this.setData({ favoritePending: false }); }
  },
  onFeedbackDismiss() { this.setData({ 'feedback.visible': false }); },
});

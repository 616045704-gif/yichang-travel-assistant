import type { PlaceDetail } from '../../../shared/contracts';
import { getPlaceDetail } from '../../services/places';

Page({
  data: { placeId: '', place: null as PlaceDetail | null, status: 'loading', message: '' },
  onLoad(query: Record<string, string | undefined>) { this.setData({ placeId: query.placeId || '' }); void this.loadDetail(); },
  async loadDetail() {
    if (!this.data.placeId) { this.setData({ status: 'error', message: '地点信息无效，请返回列表后重试。' }); return; }
    this.setData({ status: 'loading', message: '' });
    try { this.setData({ place: await getPlaceDetail(this.data.placeId), status: 'ready' }); }
    catch { this.setData({ status: 'error', message: '地点资料暂时无法加载，请返回列表后重试。' }); }
  },
  onRetry() { void this.loadDetail(); },
});

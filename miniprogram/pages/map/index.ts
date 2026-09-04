import { YICHANG_CENTER } from '../../config/runtime';
import { CATEGORIES, type Category } from '../../../shared/contracts';
import { buildMarkers, type MapPlace, type TravelMarker } from '../../view-models/map';

Page({
  data: { center: YICHANG_CENTER, places: [] as MapPlace[], markers: [] as TravelMarker[], category: '' as Category | '' },
  // Receives the public placeService.markers result when cloud data is connected.
  setPlaces(places: MapPlace[]) {
    this.setData({ places: [...places], markers: buildMarkers(places, this.data.category) });
  },
  onCategoryChange(event: WechatMiniprogram.CustomEvent<{ category: Category | '' }>) {
    const category = event.detail.category;
    if (category !== '' && !CATEGORIES.some(item => item.value === category)) return;
    this.setData({ category, markers: buildMarkers(this.data.places, category) });
  },
});

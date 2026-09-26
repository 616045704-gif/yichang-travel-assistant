import { YICHANG_CENTER } from '../../config/runtime';
import { CATEGORIES, type Category } from '../../../shared/contracts';
import { getMapMarkers } from '../../services/places';
import { buildMarkers, filterPlacesByRegion, findPlaceByMarkerId, getMapViewport, type MapPlace, type MapRegion, type TravelMarker } from '../../view-models/map';

let requestSerial = 0;
const MAP_CATEGORIES: Array<{ value: Category | ''; label: string }> = [{ value: '', label: '全部分类' }, ...CATEGORIES];
const MAP_REGIONS: Array<{ value: MapRegion; label: string }> = [
  { value: '', label: '全部地点' }, { value: '城区', label: '宜昌城区' }, { value: '夷陵区', label: '夷陵区' }, { value: '秭归县', label: '秭归县' }, { value: '兴山县', label: '兴山县' }, { value: '长阳县', label: '长阳县' }, { value: '远安县', label: '远安县' }, { value: '当阳市', label: '当阳市' }, { value: '枝江市', label: '枝江市' }, { value: '宜都市', label: '宜都市' }, { value: '五峰县', label: '五峰县' },
];

Page({
  data: { center: YICHANG_CENTER, scale: 11, allPlaces: [] as MapPlace[], places: [] as MapPlace[], markers: [] as TravelMarker[], mapCategories: MAP_CATEGORIES, mapRegions: MAP_REGIONS, category: '' as Category | '', region: '' as MapRegion, regionIndex: 0, selectedPlace: null as MapPlace | null, notice: '' },
  onShow() { void this.loadPublicMarkers(); },
  onHide() { requestSerial += 1; this.setData({ selectedPlace: null }); },
  onUnload() { this.onHide(); },
  async loadPublicMarkers() {
    const token = ++requestSerial;
    try {
      const places = await getMapMarkers();
      if (token === requestSerial) this.setPlaces(places);
    } catch { if (token === requestSerial) this.setData({ notice: '地图地点暂时无法加载，请稍后重试。' }); }
  },
  setPlaces(places: MapPlace[]) {
    this.setData({ allPlaces: [...places] });
    this.refreshMarkers();
  },
  refreshMarkers() {
    const places = filterPlacesByRegion(this.data.allPlaces, this.data.region);
    this.setData({ places, markers: buildMarkers(places, this.data.category), selectedPlace: null, notice: places.length ? '' : '该区域暂未收录地点' });
  },
  onCategoryChange(event: WechatMiniprogram.CustomEvent<{ category: Category | '' }>) {
    this.applyCategory(event.detail.category);
  },
  onMapCategoryTap(event: WechatMiniprogram.TouchEvent) {
    this.applyCategory(event.currentTarget.dataset.category);
  },
  applyCategory(category: unknown) {
    if (category !== '' && !CATEGORIES.some(item => item.value === category)) return;
    this.setData({ category: category as Category | '' });
    this.refreshMarkers();
  },
  onRegionChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const index = Number(event.detail.value);
    const option = MAP_REGIONS[index];
    if (!option) return;
    const viewport = getMapViewport(option.value, YICHANG_CENTER);
    this.setData({ region: option.value, regionIndex: index, center: viewport.center, scale: viewport.scale });
    this.refreshMarkers();
  },
  onMarkerTap(event: WechatMiniprogram.CustomEvent<{ markerId: number }>) {
    this.setData({ selectedPlace: findPlaceByMarkerId(this.data.places, this.data.category, Number(event.detail.markerId)) });
  },
  openSelectedPlace() {
    const placeId = this.data.selectedPlace?.placeId;
    if (placeId) wx.navigateTo({ url: `/pages/place-detail/index?placeId=${encodeURIComponent(placeId)}` });
  },
});

import { YICHANG_CENTER } from '../../config/runtime';
import { CATEGORIES, type Category } from '../../../shared/contracts';
import { getMapMarkers, getNearbyPlaces } from '../../services/places';
import { openLocationSettings, requestCurrentLocation } from '../../services/location';
import { buildMarkers, findPlaceByMarkerId, type MapPlace, type TravelMarker } from '../../view-models/map';

let requestSerial = 0;
let nearbyLocation: { latitude: number; longitude: number } | null = null;

Page({
  data: { center: YICHANG_CENTER, places: [] as MapPlace[], markers: [] as TravelMarker[], category: '' as Category | '', selectedPlace: null as MapPlace | null, notice: '', locating: false, nearbyMode: false, showLocation: false, showSettings: false },
  onShow() { if (!this.data.nearbyMode) void this.loadPublicMarkers(); },
  onHide() { requestSerial += 1; nearbyLocation = null; this.setData({ center: YICHANG_CENTER, nearbyMode: false, showLocation: false, selectedPlace: null, locating: false, showSettings: false }); },
  onUnload() { this.onHide(); },
  async loadPublicMarkers() {
    const token = ++requestSerial;
    try {
      const places = await getMapMarkers();
      if (token === requestSerial && !this.data.nearbyMode) this.setPlaces(places);
    } catch { if (token === requestSerial) this.setData({ notice: '地图地点暂时无法加载，请稍后重试。' }); }
  },
  setPlaces(places: MapPlace[]) {
    this.setData({ places: [...places], markers: buildMarkers(places, this.data.category), selectedPlace: null });
  },
  onCategoryChange(event: WechatMiniprogram.CustomEvent<{ category: Category | '' }>) {
    const category = event.detail.category;
    if (category !== '' && !CATEGORIES.some(item => item.value === category)) return;
    this.setData({ category, markers: buildMarkers(this.data.places, category), selectedPlace: null });
    if (this.data.nearbyMode && nearbyLocation) void this.loadNearby(nearbyLocation);
  },
  async locateNearby() {
    const token = ++requestSerial;
    this.setData({ locating: true, notice: '', selectedPlace: null, showSettings: false });
    try {
      const location = await requestCurrentLocation();
      if (token !== requestSerial) return;
      nearbyLocation = location;
      await this.loadNearby(location, token);
    } catch (error) {
      if (token !== requestSerial) return;
      const message = error instanceof Error && error.message === 'denied' ? '未获得定位权限，仍可手动浏览地图和地点。' : '定位暂不可用，仍可手动浏览地图和地点。';
      this.setData({ locating: false, notice: message, showSettings: error instanceof Error && error.message === 'denied' });
    }
  },
  async loadNearby(location: { latitude: number; longitude: number }, token = ++requestSerial) {
    try {
      const places = await getNearbyPlaces(location, this.data.category);
      if (token !== requestSerial) return;
      this.setData({ center: location, nearbyMode: true, showLocation: true, locating: false, places, markers: buildMarkers(places, this.data.category), notice: places.length ? '' : '附近 20 公里暂无收录地点' });
    } catch {
      if (token === requestSerial) this.setData({ locating: false, notice: '附近地点暂时无法加载，请稍后重试。', showSettings: false });
    }
  },
  async onOpenSettings() {
    if (await openLocationSettings()) void this.locateNearby();
  },
  onMarkerTap(event: WechatMiniprogram.CustomEvent<{ markerId: number }>) {
    this.setData({ selectedPlace: findPlaceByMarkerId(this.data.places, this.data.category, Number(event.detail.markerId)) });
  },
  openSelectedPlace() {
    const placeId = this.data.selectedPlace?.placeId;
    if (placeId) wx.navigateTo({ url: `/pages/place-detail/index?placeId=${encodeURIComponent(placeId)}` });
  },
});

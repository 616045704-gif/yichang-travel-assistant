import type { PlaceSummary } from '../../../shared/contracts';

Component({
  properties: {
    place: { type: Object, value: null as PlaceSummary | null, observer() { this.setData({ imageFailed: false }); } },
    pending: { type: Boolean, value: false },
  },
  data: { imageFailed: false },
  methods: {
    onOpen() {
      const place = this.data.place as PlaceSummary | null;
      if (place?.placeId) this.triggerEvent('open', { placeId: place.placeId });
    },
    onFavorite() {
      const place = this.data.place as PlaceSummary | null;
      if (!place?.placeId || this.data.pending) return;
      this.triggerEvent('favoritechange', { placeId: place.placeId, favorite: !place.isFavorite });
    },
    onImageError() { this.setData({ imageFailed: true }); },
  },
});

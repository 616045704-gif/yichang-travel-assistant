import type { PlaceDetail, PlaceSummary } from '../../shared/contracts';

export const scenicPlace: PlaceSummary = {
  placeId: 'synthetic-scenic', name: '合成景区', category: 'scenic', district: '西陵区', address: '合成地址',
  latitude: 30.7, longitude: 111.2, coordinateSystem: 'GCJ-02', intro: '合成地点简介', tags: ['江景', '亲子'],
  coverFileId: null, coverUrl: null, isFavorite: false, verifiedAt: '2026-09-04T00:00:00.000Z',
};

export const culturePlace: PlaceSummary = {
  ...scenicPlace, placeId: 'synthetic-culture', name: '合成博物馆', category: 'culture', tags: ['人文'],
};

export const scenicDetail: PlaceDetail = {
  ...scenicPlace,
  openNotice: '开放提示以官方公告为准。', visitAdvice: '建议预留半天。', diningInfo: null,
  sources: [{ kind: 'local_verified', title: '合成官方来源', url: null, verifiedAt: '2026-09-04T00:00:00.000Z', placeId: scenicPlace.placeId }],
  sections: [{ type: 'text', text: '合成图文详情。' }],
};

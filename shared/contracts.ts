export const CATEGORIES = [
  { value: 'scenic', label: '景区' },
  { value: 'restaurant', label: '餐馆' },
  { value: 'culture', label: '文化馆/博物馆' },
  { value: 'camping', label: '露营地' },
] as const;

export type Category = typeof CATEGORIES[number]['value'];
export type AsyncStatus = 'loading' | 'ready' | 'empty' | 'error';
export interface PlaceSummary {
  placeId: string;
  name: string;
  category: Category;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  coordinateSystem: 'GCJ-02';
  intro: string;
  tags: string[];
  coverFileId: string;
  coverUrl: string | null;
  isFavorite: boolean;
  verifiedAt: string;
  distanceMeters?: number;
}

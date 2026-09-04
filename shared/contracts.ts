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
  coverFileId: string | null;
  coverUrl: string | null;
  isFavorite: boolean;
  verifiedAt: string;
  distanceMeters?: number;
}

export interface Source {
  kind: 'local_verified' | 'knowledge_reference';
  title: string;
  url: string | null;
  verifiedAt: string | null;
  placeId: string;
}

export type PlaceSection =
  | { type: 'text'; text: string }
  | { type: 'image'; fileId: string; alt: string; url?: string | null };

export interface PlaceDetail extends PlaceSummary {
  openNotice: string | null;
  visitAdvice: string | null;
  diningInfo: string | null;
  sources: Source[];
  sections: PlaceSection[];
}

export interface PlaceMarker {
  placeId: string;
  name: string;
  category: Category;
  latitude: number;
  longitude: number;
  coordinateSystem: 'GCJ-02';
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiResult<T> {
  code: 'OK' | 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'AI_UNAVAILABLE' | 'AI_TIMEOUT' | 'INTERNAL_ERROR';
  data: T | null;
  message: string;
  traceId: string;
}

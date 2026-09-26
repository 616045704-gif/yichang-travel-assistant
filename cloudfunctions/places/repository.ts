import type { Category, PageResult, PlaceDetail, PlaceMarker, PlaceSection, PlaceSummary } from '../../shared/contracts';

export interface PlaceRepository {
  list(input: { category?: Category; keyword?: string; tags?: string[]; cursor?: string | null; pageSize?: number }): Promise<PageResult<PlaceSummary>>;
  detail(placeId: string): Promise<PlaceDetail | null>;
  markers(): Promise<PlaceMarker[]>;
}

type Database = { collection(name: string): { where(query: Record<string, unknown>): { skip(count: number): { limit(count: number): { get(): Promise<{ data: Record<string, unknown>[] }> } } }; doc(id: string): { get(): Promise<{ data: Record<string, unknown> }> } } };
const categories: Category[] = ['scenic', 'restaurant', 'culture', 'camping'];

export class InvalidPlaceInputError extends Error {}

function summary(document: Record<string, unknown>): PlaceSummary {
  const latitude = Number(document.latitude);
  const longitude = Number(document.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || document.coordinateSystem !== 'GCJ-02') throw new InvalidPlaceInputError('地点坐标无效。');
  return {
    placeId: String(document._id), name: String(document.name), category: document.category as Category,
    district: String(document.district), address: String(document.address), latitude, longitude,
    coordinateSystem: 'GCJ-02', intro: String(document.intro), tags: Array.isArray(document.tags) ? document.tags.map(String) : [],
    coverFileId: typeof document.coverFileId === 'string' ? document.coverFileId : null, coverUrl: null, isFavorite: false,
    verifiedAt: String(document.verifiedAt),
  };
}

function marker(document: Record<string, unknown>): PlaceMarker {
  const place = summary(document);
  return { placeId: place.placeId, name: place.name, category: place.category, district: place.district, latitude: place.latitude, longitude: place.longitude, coordinateSystem: place.coordinateSystem };
}

function matches(document: Record<string, unknown>, input: { category?: Category; keyword?: string; tags?: string[] }) {
  if (!categories.includes(document.category as Category) || document.status !== 'published') return false;
  if (input.category && document.category !== input.category) return false;
  const keyword = input.keyword?.trim().toLocaleLowerCase();
  const haystack = [document.name, document.intro, ...(Array.isArray(document.aliases) ? document.aliases : [])].join(' ').toLocaleLowerCase();
  if (keyword && !haystack.includes(keyword)) return false;
  const tags = Array.isArray(document.tags) ? document.tags.map(String) : [];
  return !(input.tags?.some(tag => !tags.includes(tag.trim())));
}

function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(decoded) || decoded.length !== 2 || !decoded.every(value => typeof value === 'string' && value.length)) throw new Error('invalid');
    return decoded as [string, string];
  } catch { throw new InvalidPlaceInputError('分页游标无效。'); }
}
function encodeCursor(document: Record<string, unknown>) { return Buffer.from(JSON.stringify([document.name, document._id])).toString('base64url'); }

function safeSections(value: unknown): PlaceSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap<PlaceSection>(section => {
    if (!section || typeof section !== 'object') return [];
    const item = section as Record<string, unknown>;
    if (item.type === 'text' && typeof item.text === 'string') return [{ type: 'text' as const, text: item.text }];
    if (item.type === 'image' && typeof item.fileId === 'string' && item.fileId.startsWith('cloud://') && typeof item.alt === 'string') return [{ type: 'image' as const, fileId: item.fileId, alt: item.alt }];
    return [];
  });
}

export function createPlaceRepository(database: Database): PlaceRepository {
  return {
    async list(input) {
      const pageSize = Math.min(Math.max(input.pageSize || 20, 1), 50);
      const cursor = decodeCursor(input.cursor);
      const records: Record<string, unknown>[] = [];
      for (let skip = 0; ; skip += 100) {
        const batch = (await database.collection('places').where({ status: 'published' }).skip(skip).limit(100).get()).data;
        records.push(...batch);
        if (batch.length < 100) break;
      }
      const filtered = records
        .filter(document => matches(document, input))
        .sort((a, b) => {
          const featuredOrder = Number(a.name === '一刀鲜酒楼') - Number(b.name === '一刀鲜酒楼');
          const coverOrder = Number(typeof b.coverFileId === 'string' && b.coverFileId.length > 0) - Number(typeof a.coverFileId === 'string' && a.coverFileId.length > 0);
          return featuredOrder || coverOrder || `${a.name}\u0000${a._id}`.localeCompare(`${b.name}\u0000${b._id}`);
        });
      const cursorIndex = cursor ? filtered.findIndex(item => item.name === cursor[0] && item._id === cursor[1]) : -1;
      if (cursor && cursorIndex < 0) throw new InvalidPlaceInputError('分页游标无效。');
      const start = cursor ? cursorIndex + 1 : 0;
      const page = filtered.slice(start, start + pageSize);
      return { items: page.map(summary), nextCursor: start + pageSize < filtered.length ? encodeCursor(page[page.length - 1]) : null };
    },
    async detail(placeId) {
      try {
        const place = (await database.collection('places').doc(placeId).get()).data;
        if (!matches(place, {})) return null;
        let content: Record<string, unknown> = {};
        try { content = (await database.collection('place_contents').doc(placeId).get()).data; } catch { /* A published summary remains readable if supplemental content is unavailable. */ }
        return {
          ...summary(place), openNotice: typeof place.openNotice === 'string' ? place.openNotice : null,
          visitAdvice: typeof content.visitAdvice === 'string' ? content.visitAdvice : null,
          diningInfo: typeof content.diningInfo === 'string' ? content.diningInfo : null,
          sections: safeSections(content.sections),
          sources: (Array.isArray(place.sources) ? place.sources : []).flatMap(source => {
            if (!source || typeof source !== 'object') return [];
            const item = source as Record<string, unknown>;
            if (typeof item.title !== 'string' || !item.title.trim()) return [];
            return [{ kind: place.sourceLevel === 'user_collected' ? 'local_reference' as const : 'local_verified' as const, title: item.title, url: typeof item.url === 'string' ? item.url : null, verifiedAt: typeof item.verifiedAt === 'string' ? item.verifiedAt : null, placeId }];
          }),
        };
      } catch { return null; }
    },
    async markers() {
      const records: Record<string, unknown>[] = [];
      for (let skip = 0; ; skip += 100) {
        const batch = (await database.collection('places').where({ status: 'published' }).skip(skip).limit(100).get()).data;
        records.push(...batch);
        if (batch.length < 100) break;
      }
      return records.filter(document => matches(document, {})).flatMap(document => {
        try { return [marker(document)]; } catch { return []; }
      });
    },
  };
}

import type { Category, PageResult, PlaceDetail, PlaceSummary } from '../../shared/contracts';

export interface PlaceRepository {
  list(input: { category?: Category; keyword?: string; tags?: string[]; cursor?: string | null; pageSize?: number }): Promise<PageResult<PlaceSummary>>;
  detail(placeId: string): Promise<PlaceDetail | null>;
}

type Database = { collection(name: string): { where(query: Record<string, unknown>): { limit(count: number): { get(): Promise<{ data: Record<string, unknown>[] }> } }; doc(id: string): { get(): Promise<{ data: Record<string, unknown> }> } } };
const categories: Category[] = ['scenic', 'restaurant', 'culture', 'camping'];

function summary(document: Record<string, unknown>): PlaceSummary {
  return {
    placeId: String(document._id), name: String(document.name), category: document.category as Category,
    district: String(document.district), address: String(document.address), latitude: Number(document.latitude), longitude: Number(document.longitude),
    coordinateSystem: 'GCJ-02', intro: String(document.intro), tags: Array.isArray(document.tags) ? document.tags.map(String) : [],
    coverFileId: typeof document.coverFileId === 'string' ? document.coverFileId : null, coverUrl: null, isFavorite: false,
    verifiedAt: String(document.verifiedAt),
  };
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

function decodeCursor(cursor: string | null | undefined) { return cursor ? JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as [string, string] : null; }
function encodeCursor(document: Record<string, unknown>) { return Buffer.from(JSON.stringify([document.name, document._id])).toString('base64url'); }

export function createPlaceRepository(database: Database): PlaceRepository {
  return {
    async list(input) {
      const pageSize = Math.min(Math.max(input.pageSize || 20, 1), 50);
      const cursor = decodeCursor(input.cursor);
      const records = (await database.collection('places').where({ status: 'published' }).limit(100).get()).data
        .filter(document => matches(document, input))
        .sort((a, b) => `${a.name}\u0000${a._id}`.localeCompare(`${b.name}\u0000${b._id}`));
      const start = cursor ? records.findIndex(item => item.name === cursor[0] && item._id === cursor[1]) + 1 : 0;
      const page = records.slice(Math.max(start, 0), Math.max(start, 0) + pageSize);
      return { items: page.map(summary), nextCursor: start + pageSize < records.length ? encodeCursor(page[page.length - 1]) : null };
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
          sections: Array.isArray(content.sections) ? content.sections.filter(section => section && (section.type === 'text' || section.type === 'image')) as PlaceDetail['sections'] : [],
          sources: (Array.isArray(place.sources) ? place.sources : []).map(source => ({ kind: 'local_verified' as const, title: String(source.title), url: typeof source.url === 'string' ? source.url : null, verifiedAt: typeof place.verifiedAt === 'string' ? place.verifiedAt : null, placeId })),
        };
      } catch { return null; }
    },
  };
}

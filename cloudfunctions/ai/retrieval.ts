import type { AiRequest } from '../../shared/contracts';

type Document = Record<string, unknown>;
type Database = { collection(name: string): { where(query: Document): { limit(count: number): { get(): Promise<{ data: Document[] }> } }; doc(id: string): { get(): Promise<{ data: Document }> } } };

export type LocalFactRetriever = (request: AiRequest) => Promise<string[]>;

function terms(request: AiRequest) {
  const value = request.trip?.destination || request.question || '';
  return value.trim().toLocaleLowerCase();
}

function asText(value: unknown, limit: number) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''; }

function matches(place: Document, term: string) {
  if (!term) return false;
  const values = [place.name, place.district, place.address, ...(Array.isArray(place.aliases) ? place.aliases : [])]
    .filter((value): value is string => typeof value === 'string' && !!value.trim());
  return values.some(value => term.includes(value.toLocaleLowerCase()));
}

async function contentFor(database: Database, placeId: string) {
  try { return (await database.collection('place_contents').doc(placeId).get()).data; }
  catch { return {}; }
}

function fact(place: Document, content: Document) {
  const title = asText(place.name, 80);
  const details = [asText(place.intro, 280), asText(place.openNotice, 180), asText(content.visitAdvice, 180), asText(content.diningInfo, 180)]
    .filter(Boolean);
  if (!title || !details.length) return null;
  return `【本地已核验资料】${title}：${details.join('；')}`.slice(0, 800);
}

export function createLocalFactRetriever(database: Database): LocalFactRetriever {
  return async request => {
    const published = (await database.collection('places').where({ status: 'published' }).limit(50).get()).data;
    const term = terms(request);
    const matched = published.filter(place => matches(place, term)).slice(0, 5);
    const facts = (await Promise.all(matched.map(async place => fact(place, await contentFor(database, String(place._id)))))).filter((item): item is string => !!item);
    return facts.length ? facts : ['本地已核验资料暂未命中；请明确说明不确定，不要虚构价格、营业状态、交通时刻或预约政策。'];
  };
}

import type { AiRequest } from '../../shared/contracts';
import { isMissingDocument } from './database-errors';

type Document = Record<string, unknown>;
type Query = { limit(count: number): { get(): Promise<{ data: Document[] }> }; skip?(count: number): { limit(count: number): { get(): Promise<{ data: Document[] }> } } };
type Database = { collection(name: string): { where(query: Document): Query; doc(id: string): { get(): Promise<{ data: Document }> } } };

export type LocalFactRetriever = (request: AiRequest) => Promise<string[]>;

function terms(request: AiRequest) {
  const value = request.trip?.destination || request.question || '';
  return value.trim().toLocaleLowerCase();
}

function asText(value: unknown, limit: number) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''; }

const categoryTerms: Record<string, string[]> = {
  scenic: ['景区', '景点', '自然风光'],
  restaurant: ['餐馆', '餐厅', '美食', '吃面', '米粉', '早餐', '小吃', '宵夜'],
  culture: ['文化馆', '博物馆', '人文'],
  camping: ['露营地', '露营'],
};
const foodTerms = ['餐馆', '餐厅', '美食', '吃', '面', '粉', '早餐', '小吃', '饭', '宵夜'];

function normalized(value: string) { return value.toLocaleLowerCase().replace(/[\s，。！？、；：,.!?;:()（）\-_/]+/g, ''); }

function isFoodQuestion(term: string) {
  const query = normalized(term);
  return foodTerms.some(foodTerm => query.includes(normalized(foodTerm)));
}

function namedDistrict(term: string, places: Document[]) {
  const query = normalized(term);
  const districts = places
    .map(place => asText(place.district, 80))
    .filter(Boolean)
    .sort((left, right) => normalized(right).length - normalized(left).length);
  return districts.find(district => query.includes(normalized(district))) || null;
}

function matches(place: Document, term: string) {
  if (!term) return false;
  const values = [
    place.name, place.district, place.address,
    ...(Array.isArray(place.aliases) ? place.aliases : []),
    ...(Array.isArray(place.tags) ? place.tags : []),
    ...(typeof place.category === 'string' ? categoryTerms[place.category] || [] : []),
  ]
    .filter((value): value is string => typeof value === 'string' && !!value.trim());
  const query = normalized(term);
  return values.some(value => {
    const candidate = normalized(value);
    return candidate.length >= 2 && (query.includes(candidate) || candidate.includes(query));
  });
}

async function contentFor(database: Database, placeId: string) {
  try { return (await database.collection('place_contents').doc(placeId).get()).data; }
  catch (error) {
    if (isMissingDocument(error)) return {};
    throw error;
  }
}

function fact(place: Document, content: Document) {
  const title = asText(place.name, 80);
  const details = [asText(place.intro, 280), asText(place.openNotice, 180), asText(content.visitAdvice, 180), asText(content.diningInfo, 180)]
    .filter(Boolean);
  if (!title || !details.length) return null;
  if (place.sourceLevel === 'user_collected') return `【本地整理参考】${title}：${details.join('；')}；价格、营业时间、交通和预约请以官方公告为准。`.slice(0, 800);
  return `【本地已核验资料】${title}：${details.join('；')}`.slice(0, 800);
}

export function createLocalFactRetriever(database: Database): LocalFactRetriever {
  return async request => {
    const query = database.collection('places').where({ status: 'published' });
    const published: Document[] = [];
    for (let skip = 0; ; skip += 100) {
      const batch = query.skip ? (await query.skip(skip).limit(100).get()).data : skip === 0 ? (await query.limit(100).get()).data : [];
      published.push(...batch);
      if (batch.length < 100) break;
    }
    const term = terms(request);
    const foodQuestion = isFoodQuestion(term);
    const district = namedDistrict(term, published);
    const matched = published
      .filter(place => !foodQuestion || place.category === 'restaurant')
      .filter(place => !district || asText(place.district, 80) === district)
      .filter(place => matches(place, term))
      .slice(0, 5);
    const facts = (await Promise.all(matched.map(async place => fact(place, await contentFor(database, String(place._id)))))).filter((item): item is string => !!item);
    return facts.length ? facts : ['本地已核验资料暂未命中；请直接回答用户问题，可结合知识库补充背景或通用建议。无可靠资料时请明确不确定，不要虚构具体商户、价格、营业状态、交通时刻或预约政策。'];
  };
}

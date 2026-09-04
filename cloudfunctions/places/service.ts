import { InvalidPlaceInputError, type PlaceRepository } from './repository';
import { resolveCoverUrls, resolveSectionImageUrls } from './storage';
import { distanceMeters, isCoordinate, NEARBY_RADIUS_METERS } from './distance';
import type { Category, PlaceMarker } from '../../shared/contracts';

type Storage = { getTempFileURL(input: { fileList: string[] }): Promise<{ fileList: Array<{ fileID: string; tempFileURL?: string }> }> };
type Event = { action?: unknown; category?: unknown; keyword?: unknown; tags?: unknown; cursor?: unknown; pageSize?: unknown; placeId?: unknown; latitude?: unknown; longitude?: unknown };
const categories = ['scenic', 'restaurant', 'culture', 'camping'];

function ok(data: unknown) { return { code: 'OK', data, message: '', traceId: 'place-testable' }; }
function fail(code: 'INVALID_INPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR', message: string) { return { code, data: null, message, traceId: 'place-testable' }; }

function nearbyInput(event: Event): { latitude: number; longitude: number; category?: Category } {
  const coordinate = { latitude: event.latitude, longitude: event.longitude };
  if (!isCoordinate(coordinate)) throw new InvalidPlaceInputError('当前位置无效，请重新定位。');
  if (event.category !== undefined && (typeof event.category !== 'string' || !categories.includes(event.category))) throw new InvalidPlaceInputError('分类参数无效。');
  return { latitude: coordinate.latitude, longitude: coordinate.longitude, category: event.category as Category | undefined };
}

function nearby(markers: readonly PlaceMarker[], input: { latitude: number; longitude: number; category?: Category }) {
  return markers
    .filter(marker => !input.category || marker.category === input.category)
    .map(marker => ({ ...marker, distanceMeters: distanceMeters(input, marker) }))
    .filter(marker => marker.distanceMeters <= NEARBY_RADIUS_METERS)
    .sort((left, right) => left.distanceMeters - right.distanceMeters || left.placeId.localeCompare(right.placeId));
}

export function listInput(event: Event) {
  const { category, keyword, tags, cursor, pageSize } = event;
  if (category !== undefined && (typeof category !== 'string' || !categories.includes(category))) throw new InvalidPlaceInputError('分类参数无效。');
  if (keyword !== undefined && (typeof keyword !== 'string' || keyword.length > 50)) throw new InvalidPlaceInputError('搜索内容无效。');
  if (tags !== undefined && (!Array.isArray(tags) || tags.length > 6 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 20))) throw new InvalidPlaceInputError('标签参数无效。');
  if (cursor !== undefined && cursor !== null && (typeof cursor !== 'string' || !cursor || cursor.length > 512)) throw new InvalidPlaceInputError('分页游标无效。');
  if (pageSize !== undefined && (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > 50)) throw new InvalidPlaceInputError('分页数量无效。');
  return { category: category as never, keyword: keyword as string | undefined, tags: tags as string[] | undefined, cursor: cursor as string | null | undefined, pageSize: pageSize as number | undefined };
}

export async function handlePlaceRequest(event: Event, dependencies: { repository: PlaceRepository; storage: Storage }) {
  if (event.action === 'list') {
    try {
      const page = await dependencies.repository.list(listInput(event));
      return ok({ ...page, items: await resolveCoverUrls(page.items, dependencies.storage) });
    } catch (error) { return fail(error instanceof InvalidPlaceInputError ? 'INVALID_INPUT' : 'INTERNAL_ERROR', error instanceof InvalidPlaceInputError ? error.message : '地点资料暂时无法加载。'); }
  }
  if (event.action === 'detail') {
    if (typeof event.placeId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(event.placeId)) return fail('INVALID_INPUT', '地点信息无效。');
    const detail = await dependencies.repository.detail(event.placeId);
    if (!detail) return fail('NOT_FOUND', '该地点暂不可查看。');
    const [withCover] = await resolveCoverUrls([detail], dependencies.storage);
    return ok({ ...withCover, sections: await resolveSectionImageUrls(detail.sections, dependencies.storage) });
  }
  if (event.action === 'markers') {
    try { return ok({ items: await dependencies.repository.markers() }); }
    catch { return fail('INTERNAL_ERROR', '地图地点暂时无法加载。'); }
  }
  if (event.action === 'nearby') {
    try {
      // The request coordinate is used only for this calculation and is never persisted or logged.
      return ok({ items: nearby(await dependencies.repository.markers(), nearbyInput(event)) });
    } catch (error) { return fail(error instanceof InvalidPlaceInputError ? 'INVALID_INPUT' : 'INTERNAL_ERROR', error instanceof InvalidPlaceInputError ? error.message : '附近地点暂时无法加载。'); }
  }
  return fail('INVALID_INPUT', '不支持的地点服务请求。');
}

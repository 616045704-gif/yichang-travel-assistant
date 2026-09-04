import { createPlaceRepository, InvalidPlaceInputError } from '../places/repository';
import { resolveCoverUrls, resolveSectionImageUrls } from '../places/storage';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function ok(data: unknown) { return { code: 'OK', data, message: '', traceId: `place-${Date.now()}` }; }
function fail(code: 'INVALID_INPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR', message: string) { return { code, data: null, message, traceId: `place-${Date.now()}` }; }

function listInput(event: Record<string, unknown>) {
  const { category, keyword, tags, cursor, pageSize } = event;
  if (category !== undefined && (typeof category !== 'string' || !['scenic', 'restaurant', 'culture', 'camping'].includes(category))) throw new InvalidPlaceInputError('分类参数无效。');
  if (keyword !== undefined && (typeof keyword !== 'string' || keyword.length > 50)) throw new InvalidPlaceInputError('搜索内容无效。');
  if (tags !== undefined && (!Array.isArray(tags) || tags.length > 6 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 20))) throw new InvalidPlaceInputError('标签参数无效。');
  if (cursor !== undefined && cursor !== null && (typeof cursor !== 'string' || !cursor || cursor.length > 512)) throw new InvalidPlaceInputError('分页游标无效。');
  if (pageSize !== undefined && (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > 50)) throw new InvalidPlaceInputError('分页数量无效。');
  return { category: category as never, keyword: keyword as string | undefined, tags: tags as string[] | undefined, cursor: cursor as string | null | undefined, pageSize: pageSize as number | undefined };
}

exports.main = async (event: { action?: string; category?: string; keyword?: string; tags?: string[]; cursor?: string | null; pageSize?: number; placeId?: string }) => {
  const repository = createPlaceRepository(cloud.database());
  if (event.action === 'list') {
    try {
      const page = await repository.list(listInput(event));
      return ok({ ...page, items: await resolveCoverUrls(page.items, cloud) });
    } catch (error) { return fail(error instanceof InvalidPlaceInputError ? 'INVALID_INPUT' : 'INTERNAL_ERROR', error instanceof InvalidPlaceInputError ? error.message : '地点资料暂时无法加载。'); }
  }
  if (event.action === 'detail') {
    if (typeof event.placeId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(event.placeId)) return fail('INVALID_INPUT', '地点信息无效。');
    const detail = await repository.detail(event.placeId);
    if (!detail) return fail('NOT_FOUND', '该地点暂不可查看。');
    const [withCover] = await resolveCoverUrls([detail], cloud);
    return ok({ ...withCover, sections: await resolveSectionImageUrls(detail.sections, cloud) });
  }
  return fail('INVALID_INPUT', '不支持的地点服务请求。');
};

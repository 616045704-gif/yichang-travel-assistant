import { createPlaceRepository } from '../places/repository';
import { resolveCoverUrls } from '../places/storage';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function ok(data: unknown) { return { code: 'OK', data, message: '', traceId: `place-${Date.now()}` }; }
function fail(code: 'INVALID_INPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR', message: string) { return { code, data: null, message, traceId: `place-${Date.now()}` }; }

exports.main = async (event: { action?: string; category?: string; keyword?: string; tags?: string[]; cursor?: string | null; pageSize?: number; placeId?: string }) => {
  const repository = createPlaceRepository(cloud.database());
  if (event.action === 'list') {
    if (event.category && !['scenic', 'restaurant', 'culture', 'camping'].includes(event.category)) return fail('INVALID_INPUT', '分类参数无效。');
    const page = await repository.list({ category: event.category as never, keyword: event.keyword, tags: event.tags, cursor: event.cursor, pageSize: event.pageSize });
    return ok({ ...page, items: await resolveCoverUrls(page.items, cloud) });
  }
  if (event.action === 'detail') {
    if (!event.placeId) return fail('INVALID_INPUT', '缺少地点信息。');
    const detail = await repository.detail(event.placeId);
    if (!detail) return fail('NOT_FOUND', '该地点暂不可查看。');
    const [withCover] = await resolveCoverUrls([detail], cloud);
    return ok(withCover);
  }
  return fail('INVALID_INPUT', '不支持的地点服务请求。');
};

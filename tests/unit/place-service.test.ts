import { describe, expect, it } from 'vitest';
import { createPlaceRepository } from '../../cloudfunctions/places/repository';
import { culturePlace, scenicDetail, scenicPlace } from '../fixtures/places';
import { handlePlaceRequest } from '../../cloudfunctions/places/service';

function database() {
  const places = [
    { ...scenicPlace, _id: scenicPlace.placeId, status: 'published', aliases: ['合成江景'], sources: [{ title: '来源', url: 'https://example.test' }], openNotice: scenicDetail.openNotice },
    { ...culturePlace, _id: culturePlace.placeId, status: 'published', aliases: [], sources: [] },
    { ...culturePlace, _id: 'draft-place', name: '草稿地点', status: 'draft', aliases: [], sources: [] },
  ];
  const contents = { [scenicPlace.placeId]: { _id: scenicPlace.placeId, sections: scenicDetail.sections, visitAdvice: scenicDetail.visitAdvice, diningInfo: null } };
  return { collection(name: string) { return { where() { return { skip(offset: number) { return { limit(count: number) { return { async get() { return { data: places.slice(offset, offset + count) }; } }; } }; } }; }, doc(id: string) { return { async get() { const data = name === 'places' ? places.find(item => item._id === id) : contents[id as keyof typeof contents]; if (!data) throw new Error('not found'); return { data }; } }; } }; } };
}

describe('place repository', () => {
  it('only returns published places with combined category, keyword, and tag filters', async () => {
    const result = await createPlaceRepository(database()).list({ category: 'scenic', keyword: '江景', tags: ['亲子'] });
    expect(result.items).toEqual([expect.objectContaining({ placeId: scenicPlace.placeId })]);
  });
  it('paginates without leaking draft entries', async () => {
    const repository = createPlaceRepository(database());
    const first = await repository.list({ pageSize: 1 });
    const second = await repository.list({ cursor: first.nextCursor, pageSize: 1 });
    expect([...first.items, ...second.items].map(item => item.placeId).sort()).toEqual([culturePlace.placeId, scenicPlace.placeId].sort());
  });
  it('returns null for an unknown or unpublished detail', async () => {
    const repository = createPlaceRepository(database());
    await expect(repository.detail('missing')).resolves.toBeNull();
    await expect(repository.detail('draft-place')).resolves.toBeNull();
  });
  it('labels user-collected sources as local reference in a detail response', async () => {
    const places = [{ ...scenicPlace, _id: scenicPlace.placeId, status: 'published', sourceLevel: 'user_collected', aliases: [], sources: [{ title: '向半斗整理收集', url: null }] }];
    const db = { collection(name: string) { return { where() { return { skip() { return { limit() { return { async get() { return { data: places }; } }; } }; } }; }, doc(id: string) { return { async get() { const data = name === 'places' ? places.find(item => item._id === id) : { sections: [] }; if (!data) throw new Error('not found'); return { data }; } }; } }; } };
    await expect(createPlaceRepository(db).detail(scenicPlace.placeId)).resolves.toMatchObject({
      sources: [expect.objectContaining({ kind: 'local_reference', title: '向半斗整理收集' })],
    });
  });
  it('reads beyond the database batch and rejects a tampered cursor', async () => {
    const many = Array.from({ length: 101 }, (_, index) => ({ ...scenicPlace, _id: `synthetic-${index}`, name: `地点${index.toString().padStart(3, '0')}`, status: 'published', aliases: [], sources: [] }));
    const db = { collection() { return { where() { return { skip(offset: number) { return { limit(count: number) { return { async get() { return { data: many.slice(offset, offset + count) }; } }; } }; } }; }, doc() { return { async get() { throw new Error('not found'); } }; } }; } };
    const repository = createPlaceRepository(db);
    const first = await repository.list({ pageSize: 50 });
    const third = await repository.list({ cursor: (await repository.list({ cursor: first.nextCursor, pageSize: 50 })).nextCursor, pageSize: 50 });
    expect(third.items).toHaveLength(1);
    await expect(repository.list({ cursor: 'eyJub3QiOiJhbi1pc3N1ZWQtY3Vyc29yIn0' })).rejects.toThrow('分页游标无效');
  });
  it('projects only the trusted user’s favorite state into public place responses', async () => {
    const repository = createPlaceRepository(database());
    const storage = { async getTempFileURL() { return { fileList: [] }; } };
    const response = await handlePlaceRequest({ action: 'detail', placeId: scenicPlace.placeId }, { repository, storage, favoritePlaceIds: async ids => new Set(ids) });
    expect(response).toMatchObject({ code: 'OK', data: { placeId: scenicPlace.placeId, isFavorite: true } });
  });
  it('keeps published places readable when optional favorite state is unavailable', async () => {
    const repository = createPlaceRepository(database());
    const storage = { async getTempFileURL() { return { fileList: [] }; } };
    const response = await handlePlaceRequest(
      { action: 'list', pageSize: 20 },
      { repository, storage, favoritePlaceIds: async () => { throw new Error('favorites unavailable'); } },
    );
    expect(response.code).toBe('OK');
    expect((response.data as { items: Array<{ category: string; isFavorite: boolean }> }).items).toContainEqual(
      expect.objectContaining({ category: 'scenic', isFavorite: false }),
    );
  });
  it('keeps a covered published place consistent between list, detail and marker responses', async () => {
    const covered = { ...scenicPlace, _id: scenicPlace.placeId, status: 'published', aliases: [], coverFileId: 'cloud://approved-bucket/covers/synthetic.jpg', sources: [], openNotice: scenicDetail.openNotice };
    const db = { collection(name: string) { return { where() { return { skip() { return { limit() { return { async get() { return { data: [covered] }; } }; } }; } }; }, doc(id: string) { return { async get() { const data = name === 'places' ? (id === covered._id ? covered : null) : (id === covered._id ? { sections: [] } : null); if (!data) throw new Error('not found'); return { data }; } }; } }; } };
    const storage = { async getTempFileURL({ fileList }: { fileList: string[] }) { return { fileList: fileList.map(fileID => ({ fileID, tempFileURL: `https://temp.example/${fileID.split('/').pop()}` })) }; } };
    const list = await handlePlaceRequest({ action: 'list' }, { repository: createPlaceRepository(db), storage });
    const detail = await handlePlaceRequest({ action: 'detail', placeId: scenicPlace.placeId }, { repository: createPlaceRepository(db), storage });
    const markers = await handlePlaceRequest({ action: 'markers' }, { repository: createPlaceRepository(db), storage });

    expect(list).toMatchObject({ code: 'OK' });
    expect(detail).toMatchObject({ code: 'OK' });
    expect(markers).toMatchObject({ code: 'OK' });
    const listed = (list.data as { items: Array<{ placeId: string; coverFileId: string | null; coverUrl: string | null; latitude: number; longitude: number }> }).items[0];
    const detailed = detail.data as { placeId: string; coverFileId: string | null; coverUrl: string | null };
    const marker = (markers.data as { items: Array<{ placeId: string; latitude: number; longitude: number }> }).items.find(item => item.placeId === listed.placeId);

    expect(listed).toMatchObject({ placeId: scenicPlace.placeId, coverFileId: covered.coverFileId, coverUrl: 'https://temp.example/synthetic.jpg' });
    expect(detailed).toMatchObject({ placeId: listed.placeId, coverFileId: listed.coverFileId, coverUrl: listed.coverUrl });
    expect(marker).toMatchObject({ placeId: listed.placeId, latitude: listed.latitude, longitude: listed.longitude });
  });
});

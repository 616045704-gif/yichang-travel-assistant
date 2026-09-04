import { describe, expect, it } from 'vitest';
import { createPlaceRepository } from '../../cloudfunctions/places/repository';
import { culturePlace, scenicDetail, scenicPlace } from '../fixtures/places';

function database() {
  const places = [
    { ...scenicPlace, _id: scenicPlace.placeId, status: 'published', aliases: ['合成江景'], sources: [{ title: '来源', url: 'https://example.test' }], openNotice: scenicDetail.openNotice },
    { ...culturePlace, _id: culturePlace.placeId, status: 'published', aliases: [], sources: [] },
    { ...culturePlace, _id: 'draft-place', name: '草稿地点', status: 'draft', aliases: [], sources: [] },
  ];
  const contents = { [scenicPlace.placeId]: { _id: scenicPlace.placeId, sections: scenicDetail.sections, visitAdvice: scenicDetail.visitAdvice, diningInfo: null } };
  return { collection(name: string) { return { where() { return { limit() { return { async get() { return { data: places }; } }; } }; }, doc(id: string) { return { async get() { const data = name === 'places' ? places.find(item => item._id === id) : contents[id as keyof typeof contents]; if (!data) throw new Error('not found'); return { data }; } }; } }; } };
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
});

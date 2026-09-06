import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { PlaceListViewModel } from '../../miniprogram/view-models/place-list';
import { culturePlace, scenicPlace } from '../fixtures/places';

describe('place discovery view model', () => {
  it('registers the place card used to render loaded discovery results', async () => {
    const pageConfig = JSON.parse(await readFile('miniprogram/pages/discover/index.json', 'utf8'));
    expect(pageConfig.usingComponents).toMatchObject({ 'place-card': '/components/place-card/index' });
  });

  it('trims a keyword and resets its cursor when the category changes', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [scenicPlace], nextCursor: 'next-page' });
    const model = new PlaceListViewModel(fetchPage);
    await model.setFilters({ keyword: '  江景  ' });
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '江景', cursor: null }));
    await model.setFilters({ category: 'culture' });
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'culture', keyword: '江景', cursor: null }));
    expect(model.state.items).toEqual([scenicPlace]);
  });

  it('does not append duplicate items when retrying the same page', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [culturePlace], nextCursor: null });
    const model = new PlaceListViewModel(fetchPage);
    await model.reload();
    await model.retry();
    expect(model.state.items).toEqual([culturePlace]);
  });

  it('ignores a late response from an obsolete filter request', async () => {
    let resolveFirst!: (value: { items: typeof scenicPlace[]; nextCursor: null }) => void;
    const first = new Promise<{ items: typeof scenicPlace[]; nextCursor: null }>(resolve => { resolveFirst = resolve; });
    const fetchPage = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce({ items: [culturePlace], nextCursor: null });
    const model = new PlaceListViewModel(fetchPage);
    const pending = model.setFilters({ category: 'scenic' });
    await model.setFilters({ category: 'culture' });
    resolveFirst({ items: [scenicPlace], nextCursor: null });
    await pending;
    expect(model.state.items).toEqual([culturePlace]);
  });
});

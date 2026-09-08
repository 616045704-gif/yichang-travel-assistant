import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaceListViewModel } from '../../miniprogram/view-models/place-list';
import { culturePlace, scenicPlace } from '../fixtures/places';

describe('place discovery view model', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it('keeps existing discovery bindings while using the supplied Hero and shared card', async () => {
    const [discover, discoverStyle, detail] = await Promise.all([
      readFile('miniprogram/pages/discover/index.wxml', 'utf8'),
      readFile('miniprogram/pages/discover/index.wxss', 'utf8'),
      readFile('miniprogram/pages/place-detail/index.wxml', 'utf8'),
    ]);
    expect(discover).toContain('/assets/provided/discover-hero.jpg');
    expect(discover).toContain('class="discover-hero-copy"');
    expect(discover).toContain('<category-filter');
    expect(discover).toContain('bind:categorychange="onCategoryChange"');
    expect(discover).toContain('bindinput="onKeywordInput"');
    expect(discover).toContain('bindconfirm="onSearch"');
    expect(discover).toContain('<place-card');
    expect(discover).toContain('class="discover-tools"');
    expect(discover.indexOf('class="discover-search')).toBeLessThan(discover.indexOf('<category-filter'));
    expect(discover).toContain('wx:if="{{!searchExpanded}}"');
    expect(discover).toContain('bindtap="expandSearch"');
    expect(discover).toContain('aria-label="打开搜索"');
    expect(discover).toContain('bindtap="collapseSearch"');
    expect(discover).toContain('aria-label="关闭搜索"');
    expect(discover).toContain('class="search-line-icon"');
    expect(discover).toContain('class="send-glyph"');
    expect(discover).toContain('focus="{{searchExpanded}}"');
    expect(discover).toContain('aria-label="发送搜索"');
    expect(discover).not.toContain('bindinput="onSearch"');
    expect(discoverStyle).toContain('height: 340rpx');
    expect(discoverStyle).toContain('flex-basis: 324rpx');
    expect(discover).not.toContain('/assets/icons/discover-active.png');
    expect(discover).not.toContain('>发送</button>');
    expect(discover).not.toContain('discover-riverside.jpg');
    expect(detail).toContain('/assets/provided/favorite-active.png');
    expect(detail).toContain('bindtap="onFavorite"');
  });

  it('expands and edits search locally, then requests only after explicit submission', async () => {
    type DiscoverPage = {
      data: { searchExpanded: boolean; keyword: string };
      setData(value: Record<string, unknown>): void;
      expandSearch(): void;
      collapseSearch(): void;
      onKeywordInput(event: { detail: { value: string } }): void;
      onSearch(): void;
    };
    let page: DiscoverPage;
    vi.stubGlobal('Page', (value: DiscoverPage) => { page = value; });
    vi.stubGlobal('getApp', () => ({ globalData: { pendingDiscoverCategory: '' } }));
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: { items: [], nextCursor: null } } }));
    vi.stubGlobal('wx', { cloud: { callFunction } });
    await import('../../miniprogram/pages/discover/index');
    page!.setData = function (value) { Object.assign(this.data, value); };

    expect(page!.data.searchExpanded).toBe(false);
    page!.expandSearch();
    expect(page!.data.searchExpanded).toBe(true);
    page!.onKeywordInput({ detail: { value: '三峡' } });
    expect(page!.data.keyword).toBe('三峡');
    page!.collapseSearch();
    expect(page!.data).toMatchObject({ searchExpanded: false, keyword: '三峡' });
    expect(callFunction).not.toHaveBeenCalled();

    page!.expandSearch();
    page!.onSearch();
    await vi.waitFor(() => expect(callFunction).toHaveBeenCalledWith({
      name: 'placeService',
      data: expect.objectContaining({ action: 'list', keyword: '三峡' }),
    }));
  });

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

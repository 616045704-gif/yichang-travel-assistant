import type { Category, PageResult, PlaceSummary } from '../../shared/contracts';

export interface PlaceListFilters { category: Category | ''; keyword: string; tag: string; }
export interface PlaceListRequest extends PlaceListFilters { cursor: string | null; pageSize: number; }
export interface PlaceListState extends PlaceListFilters {
  items: PlaceSummary[];
  nextCursor: string | null;
  status: 'loading' | 'ready' | 'empty' | 'error';
  message: string;
}
export type PlacePageFetcher = (request: PlaceListRequest) => Promise<PageResult<PlaceSummary>>;

const initialFilters: PlaceListFilters = { category: '', keyword: '', tag: '' };

export class PlaceListViewModel {
  state: PlaceListState = { ...initialFilters, items: [], nextCursor: null, status: 'empty', message: '' };
  private requestVersion = 0;

  constructor(private readonly fetchPage: PlacePageFetcher) {}

  async setFilters(next: Partial<PlaceListFilters>) {
    this.state = { ...this.state, ...next, keyword: (next.keyword ?? this.state.keyword).trim(), tag: (next.tag ?? this.state.tag).trim(), nextCursor: null };
    await this.load(null, true);
  }

  async reload() { await this.load(null, true); }
  async retry() { await this.load(null, true); }
  async loadMore() {
    if (!this.state.nextCursor || this.state.status === 'loading') return;
    await this.load(this.state.nextCursor, false);
  }

  private async load(cursor: string | null, replace: boolean) {
    const version = ++this.requestVersion;
    this.state = { ...this.state, status: 'loading', message: '' };
    try {
      const result = await this.fetchPage({ category: this.state.category, keyword: this.state.keyword, tag: this.state.tag, cursor, pageSize: 20 });
      if (version !== this.requestVersion) return;
      const items = replace ? result.items : [...this.state.items, ...result.items.filter(item => !this.state.items.some(existing => existing.placeId === item.placeId))];
      this.state = { ...this.state, items, nextCursor: result.nextCursor, status: items.length ? 'ready' : 'empty', message: '' };
    } catch {
      if (version !== this.requestVersion) return;
      this.state = { ...this.state, status: 'error', message: '地点资料暂时无法加载，请检查网络后重试。' };
    }
  }
}

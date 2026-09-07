import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Instance = { data: Record<string, unknown>; triggerEvent: ReturnType<typeof vi.fn>; setData(value: Record<string, unknown>): void };
type Definition = { methods: Record<string, (this: Instance, event?: unknown) => void>; properties: Record<string, { value: unknown; observer?: (this: Instance) => void }> };
async function component(name: string) {
  let definition: Definition;
  vi.stubGlobal('Component', (value: Definition) => { definition = value; });
  await import(`../../miniprogram/components/${name}/index.ts`);
  return definition!;
}
function instance(data: Record<string, unknown>): Instance {
  return { data, triggerEvent: vi.fn(), setData(value) { Object.assign(this.data, value); } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('reusable travel components', () => {
  it('uses modern visual feedback without changing component action contracts', async () => {
    const state = await readFile('miniprogram/components/async-state/index.wxml', 'utf8');
    const stateStyle = await readFile('miniprogram/components/async-state/index.wxss', 'utf8');
    const feedback = await readFile('miniprogram/components/feedback-toast/index.wxml', 'utf8');
    const feedbackStyle = await readFile('miniprogram/components/feedback-toast/index.wxss', 'utf8');
    const card = await readFile('miniprogram/components/place-card/index.wxml', 'utf8');
    const cardStyle = await readFile('miniprogram/components/place-card/index.wxss', 'utf8');
    const filters = await readFile('miniprogram/components/category-filter/index.wxml', 'utf8');
    expect(state).not.toContain('﹏');
    expect(state).not.toContain('>!</view>');
    expect(stateStyle).toContain('var(--color-brand)');
    expect(feedback).toContain('feedback-toast');
    expect(feedback).toContain('bindtap="dismiss"');
    expect(feedback).toContain('feedback-close-mark');
    expect(feedbackStyle).not.toMatch(/\.feedback-close\s+view/);
    expect(filters).toContain('data-value="{{item.value}}"');
    expect(filters).toContain('bindtap="onSelect"');
    expect(filters).toContain('/assets/provided/category-');
    expect(card).toContain('cover-favorite');
    expect(card).toContain('/assets/provided/favorite.png');
    expect(cardStyle).not.toMatch(/\.favorite\s+text/);
    expect(feedbackStyle).toContain('var(--color-brand-deep)');
    expect(feedbackStyle).toContain('var(--color-action)');
  });

  it('uses reference labels rather than claiming every local fact is verified', async () => {
    await expect(readFile('miniprogram/components/source-card/index.wxml', 'utf8')).resolves.toContain('本地资料参考');
    const detail = await readFile('miniprogram/pages/place-detail/index.wxml', 'utf8');
    expect(detail).toContain('资料说明');
    expect(detail).toContain('local_reference');
    expect(detail).toContain('价格、营业时间、交通和预约请以官方公告为准。');
  });
  it('emits a valid category selection and rejects unknown values', async () => {
    const definition = await component('category-filter');
    const ctx = instance({ value: '' });
    definition.methods.onSelect.call(ctx, { currentTarget: { dataset: { value: 'culture' } } });
    expect(ctx.triggerEvent).toHaveBeenCalledWith('categorychange', { category: 'culture' });
    ctx.triggerEvent.mockClear();
    definition.methods.onSelect.call(ctx, { currentTarget: { dataset: { value: 'unknown' } } });
    expect(ctx.triggerEvent).not.toHaveBeenCalled();
  });
  it('only exposes retry from an error state', async () => {
    const definition = await component('async-state');
    for (const status of ['loading', 'empty', 'ready']) {
      const ctx = instance({ status });
      definition.methods.onRetry.call(ctx);
      expect(ctx.triggerEvent).not.toHaveBeenCalled();
    }
    const ctx = instance({ status: 'error' });
    definition.methods.onRetry.call(ctx);
    expect(ctx.triggerEvent).toHaveBeenCalledWith('retry');
  });
  it('emits a dismiss event for a visible feedback message without changing page data', async () => {
    const definition = await component('feedback-toast');
    const ctx = instance({ visible: true, tone: 'error', message: '保存失败，请稍后重试' });
    definition.methods.dismiss.call(ctx);
    expect(ctx.triggerEvent).toHaveBeenCalledWith('dismiss');
    expect(ctx.data).toMatchObject({ visible: true, tone: 'error', message: '保存失败，请稍后重试' });
  });
  it('emits card actions without changing favorite or requesting location', async () => {
    const definition = await component('place-card');
    const ctx = instance({ place: { placeId: 'synthetic-test-id', isFavorite: false }, pending: false });
    const getLocation = vi.fn();
    vi.stubGlobal('wx', { getLocation, cloud: { callFunction: vi.fn() } });
    definition.methods.onOpen.call(ctx);
    definition.methods.onFavorite.call(ctx);
    expect(ctx.triggerEvent).toHaveBeenCalledWith('open', { placeId: 'synthetic-test-id' });
    expect(ctx.triggerEvent).toHaveBeenCalledWith('favoritechange', { placeId: 'synthetic-test-id', favorite: true });
    expect(ctx.data.place).toEqual({ placeId: 'synthetic-test-id', isFavorite: false });
    expect(getLocation).not.toHaveBeenCalled();
    ctx.data.pending = true;
    ctx.triggerEvent.mockClear();
    definition.methods.onFavorite.call(ctx);
    expect(ctx.triggerEvent).not.toHaveBeenCalled();
    definition.methods.onImageError.call(ctx);
    expect(ctx.data.imageFailed).toBe(true);
    definition.properties.place.observer!.call(ctx);
    expect(ctx.data.imageFailed).toBe(false);
    ctx.data.place = null;
    ctx.triggerEvent.mockClear();
    definition.methods.onOpen.call(ctx);
    definition.methods.onFavorite.call(ctx);
    expect(ctx.triggerEvent).not.toHaveBeenCalled();
  });
});

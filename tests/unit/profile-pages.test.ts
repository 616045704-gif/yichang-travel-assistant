import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('personal pages', () => {
  it('navigates only to implemented personal pages and privacy details', async () => {
    let page: { openEntry(event: unknown): void; showPrivacy(): void };
    vi.stubGlobal('Page', (value: typeof page) => { page = value; });
    const navigateTo = vi.fn();
    vi.stubGlobal('wx', { navigateTo });
    await import('../../miniprogram/pages/me/index');
    page!.openEntry({ currentTarget: { dataset: { url: '/pages/records/index?type=favorites' } } });
    page!.showPrivacy();
    expect(navigateTo).toHaveBeenNthCalledWith(1, { url: '/pages/records/index?type=favorites' });
    expect(navigateTo).toHaveBeenNthCalledWith(2, { url: '/pages/privacy/index' });
  });
  it('links AI history from my page without calling userService', async () => {
    const me = await readFile('miniprogram/pages/me/index.ts', 'utf8');
    const template = await readFile('miniprogram/pages/me/index.wxml', 'utf8');
    expect(me).toContain('/pages/ai-history/index');
    expect(me).not.toContain("listRecords('trips'");
    expect(template).toContain('模拟记录，未持久化');
  });
  it('does not send an identity field from the user client', async () => {
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: { placeId: 'place-1', favorite: true } } }));
    vi.stubGlobal('wx', { cloud: { callFunction } });
    const { setFavorite } = await import('../../miniprogram/services/user');
    await setFavorite('place-1', true);
    expect(callFunction).toHaveBeenCalledWith({ name: 'userService', data: { action: 'setFavorite', placeId: 'place-1', favorite: true } });
  });
  it('does not treat a failed browse write as a failed detail read', async () => {
    let page: { data: { placeId: string }; setData: ReturnType<typeof vi.fn>; onLoad(query: Record<string, string>): void };
    vi.stubGlobal('Page', (value: typeof page) => { page = value; });
    const callFunction = vi.fn(async ({ name, data }: { name: string; data: { action: string } }) => {
      if (name === 'placeService') return { result: { code: 'OK', data: { placeId: data.action === 'detail' ? 'place-1' : '', name: '合成地点', isFavorite: false } } };
      return { result: { code: 'INTERNAL_ERROR', data: null, message: '写入失败' } };
    });
    vi.stubGlobal('wx', { cloud: { callFunction }, showToast: vi.fn() });
    await import('../../miniprogram/pages/place-detail/index');
    page!.data = { placeId: '' }; page!.setData = vi.fn((value: Record<string, unknown>) => Object.assign(page!.data, value)); page!.onLoad({ placeId: 'place-1' });
    await vi.waitFor(() => expect(page!.setData).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' })));
  });
});

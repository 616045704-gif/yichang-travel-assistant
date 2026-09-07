import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('personal pages', () => {
  it('uses the four supplied menu illustrations without changing personal destinations', async () => {
    const [markup, logic] = await Promise.all([
      readFile('miniprogram/pages/me/index.wxml', 'utf8'),
      readFile('miniprogram/pages/me/index.ts', 'utf8'),
    ]);
    expect(markup).toContain('src="/assets/provided/menu-{{item.icon}}.png"');
    expect(markup).toContain('bindtap="openEntry"');
    expect(markup).toContain('data-url="{{item.url}}"');
    expect(markup).not.toContain('意见反馈');
    expect(logic).toContain("icon: 'favorite'");
    expect(logic).toContain("icon: 'history'");
    expect(logic).toContain("icon: 'ai'");
    expect(logic).toContain("icon: 'preferences'");
  });

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
  it('links private AI history from my page without calling userService', async () => {
    const me = await readFile('miniprogram/pages/me/index.ts', 'utf8');
    const template = await readFile('miniprogram/pages/me/index.wxml', 'utf8');
    expect(me).toContain('/pages/ai-history/index');
    expect(me).not.toContain("listRecords('trips'");
    expect(template).toContain('AI 问答记录只向对应用户展示');
    expect(me).not.toContain("symbol: '♡'");
    expect(me).not.toContain("symbol: '◷'");
    expect(me).not.toContain("symbol: '✦'");
    expect(me).not.toContain("symbol: '☷'");
  });
  it('loads owner-scoped live AI records through aiService', async () => {
    vi.stubGlobal('__BUILD_MODE__', 'demo');
    let page: { data: Record<string, unknown>; setData(value: Record<string, unknown>): void; load(): Promise<void> };
    vi.stubGlobal('Page', (value: typeof page) => { page = value; });
    const record = { requestId: 'trip-1', kind: 'trip', prompt: '宜昌｜2人｜2天｜总预算3000元｜偏好：自然风景', createdAt: '2026-09-05T00:00:00.000Z', status: 'succeeded', answer: '行程回答', mode: 'dify', error: null, localFacts: [], references: [] };
    const callFunction = vi.fn(async () => ({ result: { code: 'OK', data: [record] } }));
    vi.stubGlobal('wx', { cloud: { callFunction } });
    await import('../../miniprogram/pages/ai-history/index');
    page!.setData = function (value) { Object.assign(this.data, value); };

    await page!.load();

    expect(callFunction).toHaveBeenCalledWith({ name: 'aiService', data: { action: 'listRecords' } });
    expect(page!.data).toMatchObject({ status: 'ready', records: [expect.objectContaining({
      kind: 'trip', title: '行程定制结果', prompt: '宜昌｜2人｜2天｜总预算3000元｜偏好：自然风景',
    })] });
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
  it('does not state that the implemented AI question flow is unavailable in privacy copy', async () => {
    const privacy = await readFile('miniprogram/pages/privacy/index.wxml', 'utf8');
    expect(privacy).toContain('AI 问答会使用你输入的问题生成出行参考');
    expect(privacy).not.toContain('AI 问答与意见反馈尚未在当前版本开放');
  });
});

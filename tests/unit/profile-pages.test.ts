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
    expect(markup).toContain('class="travel-hero"');
    expect(markup).toContain('class="travel-kicker"');
    expect(markup).toContain('class="travel-title"');
    expect(markup).toContain('class="travel-subtitle"');
    expect(markup).toContain('class="travel-hero-art"');
    expect(markup).toContain('class="profile-avatar-art"');
    expect(markup.indexOf('class="profile-card"')).toBeLessThan(markup.indexOf('class="menu"'));
    expect(markup).toContain('/assets/provided/me-hero-travel.png');
    expect(markup).toContain('/assets/provided/me-traveler-avatar.png');
    expect(markup).not.toContain('/assets/provided/category-scenic.png');
    expect(markup).not.toContain('/assets/provided/category-camping.png');
    expect(markup).not.toContain('/assets/provided/tab-me-active.png');
    expect(markup).not.toContain('travel-motif');
    expect(markup).toContain('menu-icon-shell menu-icon-shell-{{item.icon}}');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('bindtap="openEntry"');
    expect(markup).toContain('hover-class="menu-row-pressed"');
    expect(markup).toContain('hover-class="privacy-button-pressed"');
    expect(markup).toContain('data-url="{{item.url}}"');
    expect(markup).not.toContain('意见反馈');
    expect(logic).toContain("icon: 'favorite'");
    expect(logic).toContain("icon: 'history'");
    expect(logic).toContain("icon: 'ai'");
    expect(logic).toContain("icon: 'preferences'");
    expect(logic).not.toContain('parking');
  });

  it('navigates only to implemented personal pages and privacy details', async () => {
    type PersonalPage = {
      data: { entries: Array<{ title: string; icon: string; url: string }> };
      openEntry(event: unknown): void;
      showPrivacy(): void;
    };
    let page: PersonalPage;
    vi.stubGlobal('Page', (value: typeof page) => { page = value; });
    const navigateTo = vi.fn();
    vi.stubGlobal('wx', { navigateTo });
    await import('../../miniprogram/pages/me/index');
    expect(page!.data.entries.map(entry => [entry.title, entry.icon, entry.url])).toEqual([
      ['我的收藏', 'favorite', '/pages/records/index?type=favorites'],
      ['浏览记录', 'history', '/pages/records/index?type=browse'],
      ['AI 问答记录', 'ai', '/pages/ai-history/index'],
      ['旅行偏好', 'preferences', '/pages/preferences/index'],
    ]);
    for (const entry of page!.data.entries) page!.openEntry({ currentTarget: { dataset: { url: entry.url } } });
    page!.openEntry({ currentTarget: { dataset: {} } });
    page!.showPrivacy();
    expect(navigateTo).toHaveBeenNthCalledWith(1, { url: '/pages/records/index?type=favorites' });
    expect(navigateTo).toHaveBeenNthCalledWith(2, { url: '/pages/records/index?type=browse' });
    expect(navigateTo).toHaveBeenNthCalledWith(3, { url: '/pages/ai-history/index' });
    expect(navigateTo).toHaveBeenNthCalledWith(4, { url: '/pages/preferences/index' });
    expect(navigateTo).toHaveBeenNthCalledWith(5, { url: '/pages/privacy/index' });
    expect(navigateTo).toHaveBeenCalledTimes(5);
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

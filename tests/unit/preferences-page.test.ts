import { afterEach, describe, expect, it, vi } from 'vitest';

type PreferencesPage = {
  data: {
    options: Array<{ value: string; selected: boolean }>;
    selected: string[];
  };
  setData(value: Record<string, unknown>): void;
  load(): Promise<void>;
  onToggle(event: { currentTarget: { dataset: { value: string } } }): void;
};

async function loadPreferencesPage() {
  let page: PreferencesPage;
  vi.doMock('../../miniprogram/services/user', () => ({
    getPreferences: vi.fn(async () => ({ preferences: [] })),
    savePreferences: vi.fn(async (preferences: string[]) => ({ preferences })),
  }));
  vi.stubGlobal('Page', (value: PreferencesPage) => { page = value; });
  vi.stubGlobal('wx', { showToast: vi.fn() });
  await import('../../miniprogram/pages/preferences/index');
  page!.setData = function (value) { Object.assign(this.data, value); };
  return page!;
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.doUnmock('../../miniprogram/services/user'); });

describe('saved travel preferences', () => {
  it('updates the visible selected state when a saved preference is toggled', async () => {
    const page = await loadPreferencesPage();
    await page.load();

    page.onToggle({ currentTarget: { dataset: { value: '自然风景' } } });
    expect(page.data.options.find(item => item.value === '自然风景')).toMatchObject({ selected: true });

    page.onToggle({ currentTarget: { dataset: { value: '自然风景' } } });
    expect(page.data.options.find(item => item.value === '自然风景')).toMatchObject({ selected: false });
  });
});

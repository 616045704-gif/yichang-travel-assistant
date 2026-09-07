import { afterEach, describe, expect, it, vi } from 'vitest';

type PreferencesPage = {
  data: {
    options: Array<{ value: string; selected: boolean }>;
    selected: string[];
    feedback: { visible: boolean; tone: string; message: string };
  };
  setData(value: Record<string, unknown>): void;
  load(): Promise<void>;
  onToggle(event: { currentTarget: { dataset: { value: string } } }): void;
  onSave(): Promise<void>;
  onFeedbackDismiss(): void;
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
  page!.setData = function (value) {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'feedback.visible') this.data.feedback.visible = item as boolean;
      else Object.assign(this.data, { [key]: item });
    }
  };
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
  it('uses the shared feedback state after saving and allows it to be dismissed', async () => {
    const page = await loadPreferencesPage();
    await page.load();
    await page.onSave();
    expect(page.data.feedback).toEqual({ visible: true, tone: 'success', message: '已保存' });
    page.onFeedbackDismiss();
    expect(page.data.feedback.visible).toBe(false);
  });
});

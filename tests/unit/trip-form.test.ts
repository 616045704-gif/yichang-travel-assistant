import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateTrip } from '../../miniprogram/view-models/chat';
import { createMockAiClient } from '../fixtures/mock-ai';

type TripPage = {
  data: {
    form: { destination: string; people: string; totalBudgetCny: string; days: string; preferences: string[] };
    preferenceOptions: Array<{ value: string; selected: boolean }>;
    error: string;
    result: { answer: string | null } | null;
    results: Array<{ answer: string | null }>;
    adjustment: string;
    confirmedRequirements: string[];
  };
  setData(value: Record<string, unknown>): void;
  onDestination(event: { detail: { value: string } }): void;
  onPeople(event: { detail: { value: string } }): void;
  onBudget(event: { detail: { value: string } }): void;
  onDays(event: { detail: { value: string } }): void;
  onTogglePreference(event: { currentTarget: { dataset: { value: string } } }): void;
  submit(): Promise<void>;
  onAdjustment(event: { detail: { value: string } }): void;
  submitAdjustment(): Promise<void>;
  restartTrip(): Promise<void>;
  retry(): Promise<void>;
};

async function loadTripPage(options: { submitAi?: ReturnType<typeof vi.fn>; resetAiConversation?: ReturnType<typeof vi.fn> } = {}) {
  let page: TripPage;
  if (options.submitAi || options.resetAiConversation) {
    vi.doMock('../../miniprogram/services/ai', () => ({
      submitAi: options.submitAi ?? vi.fn(),
      resetAiConversation: options.resetAiConversation ?? vi.fn(),
    }));
  }
  vi.stubGlobal('Page', (value: TripPage) => { page = value; });
  vi.stubGlobal('wx', { showToast: vi.fn() });
  await import('../../miniprogram/pages/trip-form/index');
  page!.setData = function (value) { Object.assign(this.data, value); };
  return page!;
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('trip input validation', () => {
  it('marks one complete current trip and removes the redundant final-generation action', () => {
    const markup = readFileSync('miniprogram/pages/trip-form/index.wxml', 'utf8');

    expect(markup).toContain('当前计划（可继续调整）');
    expect(markup).toContain('当前完整行程（已应用调整）');
    expect(markup).toContain('已确认要求（每次都会用于完整重新生成）');
    expect(markup).toContain('确认调整');
    expect(markup).not.toContain('应用调整并重新生成完整行程');
    expect(markup).not.toContain('生成最终行程');
    expect(markup).not.toContain('wx:for="{{results}}"');

    const adjustmentTextarea = markup.match(/<textarea[^>]*bindinput="onAdjustment"[^>]*\/>/)?.[0] ?? '';
    expect(adjustmentTextarea).toContain('adjust-position="{{false}}"');
    expect((markup.match(/adjust-position="{{false}}"/g) ?? [])).toHaveLength(1);
    expect(markup).not.toContain('adjust-position="false"');
  });

  it('accepts only a valid five-field trip input', () => {
    expect(validateTrip({ destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['山水'] })).toEqual([]);
    expect(validateTrip({ destination: '', people: 21, totalBudgetCny: 0, days: 8, preferences: Array(7).fill('慢游') })).toEqual(expect.arrayContaining([
      '请选择目的地',
      '人数需为 1–20 的整数',
      '总预算需为 1–100000 元',
      '天数需为 1–7 的整数',
      '偏好最多选择 6 项',
    ]));
  });

  it('keeps itinerary input after a network failure and exposes retry', async () => {
    const { configureAiClient } = await import('../../miniprogram/services/ai');
    const client = createMockAiClient([{ status: 'failed', error: '网络连接不稳定，请重试' }, { status: 'succeeded', answer: '模拟行程建议' }]);
    configureAiClient(client);
    const page = await loadTripPage();
    page.onDestination({ detail: { value: '宜昌' } });
    page.onPeople({ detail: { value: '2' } });
    page.onBudget({ detail: { value: '3000' } });
    page.onDays({ detail: { value: '2' } });
    page.onTogglePreference({ currentTarget: { dataset: { value: '山水' } } });
    await page.submit();
    expect(page.data.form).toEqual({ destination: '宜昌', people: '2', totalBudgetCny: '3000', days: '2', preferences: ['山水'] });
    expect(page.data.result).toBeNull();
    expect(page.data.error).toBe('网络连接不稳定，请重试');
    await expect(page.retry()).resolves.toBeUndefined();
    expect(client.submit).toHaveBeenCalledTimes(2);
    expect(client.submit.mock.calls[1][0]).toEqual(client.submit.mock.calls[0][0]);
  });

  it('shows the safe cloud-function rate-limit message instead of calling it a network failure', async () => {
    const submitAi = vi.fn().mockRejectedValue(new Error('请求较频繁，请稍后再试。'));
    const page = await loadTripPage({ submitAi });
    page.onDestination({ detail: { value: '宜昌' } });
    page.onPeople({ detail: { value: '2' } });
    page.onBudget({ detail: { value: '3000' } });
    page.onDays({ detail: { value: '2' } });

    await page.submit();

    expect(page.data.error).toBe('请求较频繁，请稍后再试。');
  });

  it('updates the visible selected state when a trip preference is toggled', async () => {
    const page = await loadTripPage();

    page.onTogglePreference({ currentTarget: { dataset: { value: '自然风景' } } });
    expect(page.data.preferenceOptions.find(item => item.value === '自然风景')).toMatchObject({ selected: true });

    page.onTogglePreference({ currentTarget: { dataset: { value: '自然风景' } } });
    expect(page.data.preferenceOptions.find(item => item.value === '自然风景')).toMatchObject({ selected: false });
  });

  it('regenerates every requested day after each confirmed adjustment', async () => {
    const submitAi = vi.fn()
      .mockResolvedValueOnce({ requestId: 'trip-first', status: 'succeeded', answer: '首版行程', mode: 'mock', error: null, localFacts: [], references: [] })
      .mockResolvedValueOnce({ requestId: 'trip-food', status: 'succeeded', answer: '第 1 天至第 4 天的完整餐饮行程', mode: 'mock', error: null, localFacts: [], references: [] })
      .mockResolvedValueOnce({ requestId: 'trip-family', status: 'succeeded', answer: '第 1 天至第 4 天的三峡人家完整行程', mode: 'mock', error: null, localFacts: [], references: [] });
    const page = await loadTripPage({ submitAi });
    page.onDestination({ detail: { value: '宜昌' } });
    page.onPeople({ detail: { value: '2' } });
    page.onBudget({ detail: { value: '6000' } });
    page.onDays({ detail: { value: '4' } });
    page.onTogglePreference({ currentTarget: { dataset: { value: '自然风景' } } });
    await page.submit();
    page.onAdjustment({ detail: { value: '第一天吃热干面，第二天吃鱼，推荐具体餐馆' } });
    await page.submitAdjustment();

    expect(submitAi).toHaveBeenCalledTimes(2);
    expect(submitAi.mock.calls[1][0]).toMatchObject({ kind: 'trip', question: expect.stringContaining('4 天') });
    expect(submitAi.mock.calls[1][0].question).toContain('宜昌');
    expect(submitAi.mock.calls[1][0].question).toContain('第 1 天至第 4 天');
    expect(submitAi.mock.calls[1][0].question).toContain('第一天吃热干面，第二天吃鱼，推荐具体餐馆');
    expect(submitAi.mock.calls[1][0]).not.toHaveProperty('trip');
    expect(page.data.results).toHaveLength(2);
    expect(page.data.results.map(item => item.answer)).toEqual(['第 1 天至第 4 天的完整餐饮行程', '首版行程']);
    expect(page.data.confirmedRequirements).toEqual(['第一天吃热干面，第二天吃鱼，推荐具体餐馆']);

    page.onAdjustment({ detail: { value: '安排去三峡人家' } });
    await page.submitAdjustment();

    expect(submitAi.mock.calls[2][0]).toMatchObject({ kind: 'trip', question: expect.stringContaining('第 1 天至第 4 天') });
    expect(submitAi.mock.calls[2][0].question).toContain('第一天吃热干面，第二天吃鱼，推荐具体餐馆');
    expect(submitAi.mock.calls[2][0].question).toContain('安排去三峡人家');
    expect(submitAi.mock.calls[2][0]).not.toHaveProperty('trip');
    expect(page.data.confirmedRequirements).toEqual(['第一天吃热干面，第二天吃鱼，推荐具体餐馆', '安排去三峡人家']);
    expect(page.data.results.map(item => item.answer)).toEqual(['第 1 天至第 4 天的三峡人家完整行程', '第 1 天至第 4 天的完整餐饮行程', '首版行程']);
  });

  it('restarts only the trip conversation and retains the editable form fields', async () => {
    const resetAiConversation = vi.fn(async () => undefined);
    const page = await loadTripPage({ resetAiConversation });
    page.data.form = { destination: '三峡大坝', people: '3', totalBudgetCny: '5000', days: '3', preferences: ['轻松慢游'] };
    page.data.result = { answer: '旧行程' };
    page.data.results = [{ answer: '旧行程' }];
    page.data.adjustment = '改慢一点';

    await page.restartTrip();

    expect(resetAiConversation).toHaveBeenCalledWith('trip');
    expect(resetAiConversation).not.toHaveBeenCalledWith('chat');
    expect(page.data.form).toEqual({ destination: '三峡大坝', people: '3', totalBudgetCny: '5000', days: '3', preferences: ['轻松慢游'] });
    expect(page.data).toMatchObject({ result: null, results: [], adjustment: '' });
  });
});

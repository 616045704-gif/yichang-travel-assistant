import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('sends a trip adjustment without rebuilding the form payload', async () => {
    const submitAi = vi.fn()
      .mockResolvedValueOnce({ requestId: 'trip-first', status: 'succeeded', answer: '首版行程', mode: 'mock', error: null, localFacts: [], references: [] })
      .mockResolvedValueOnce({ requestId: 'trip-follow-up', status: 'succeeded', answer: '已放慢第二天节奏', mode: 'mock', error: null, localFacts: [], references: [] });
    const page = await loadTripPage({ submitAi });
    page.onDestination({ detail: { value: '宜昌' } });
    page.onPeople({ detail: { value: '2' } });
    page.onBudget({ detail: { value: '3000' } });
    page.onDays({ detail: { value: '2' } });
    page.onTogglePreference({ currentTarget: { dataset: { value: '自然风景' } } });
    await page.submit();
    page.onAdjustment({ detail: { value: '第二天太累了' } });
    await page.submitAdjustment();

    expect(submitAi).toHaveBeenCalledTimes(2);
    expect(submitAi.mock.calls[1][0]).toMatchObject({ kind: 'trip', question: '第二天太累了' });
    expect(submitAi.mock.calls[1][0]).not.toHaveProperty('trip');
    expect(page.data.results).toHaveLength(2);
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateTrip } from '../../miniprogram/view-models/chat';
import { createMockAiClient } from '../fixtures/mock-ai';

type TripPage = {
  data: {
    form: { destination: string; people: string; totalBudgetCny: string; days: string; preferences: string[] };
    error: string;
    result: { answer: string | null } | null;
  };
  setData(value: Record<string, unknown>): void;
  onDestination(event: { detail: { value: string } }): void;
  onPeople(event: { detail: { value: string } }): void;
  onBudget(event: { detail: { value: string } }): void;
  onDays(event: { detail: { value: string } }): void;
  onTogglePreference(event: { currentTarget: { dataset: { value: string } } }): void;
  submit(): Promise<void>;
  retry(): Promise<void>;
};

async function loadTripPage() {
  let page: TripPage;
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
});

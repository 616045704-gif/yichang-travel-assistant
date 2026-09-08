import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

type AdjustmentPage = {
  data: { adjustment: string; error: string };
  setData(value: Record<string, unknown>): void;
  getOpenerEventChannel(): { emit(name: string, payload: { adjustment: string }): void };
  onInput(event: { detail: { value: string } }): void;
  confirmAdjustment(): void;
};

async function loadAdjustmentPage() {
  let page: AdjustmentPage;
  vi.stubGlobal('Page', (value: AdjustmentPage) => { page = value; });
  const navigateBack = vi.fn();
  vi.stubGlobal('wx', { navigateBack });
  await import('../../miniprogram/pages/trip-adjustment/index');
  page!.setData = function (value) { Object.assign(this.data, value); };
  return { page: page!, navigateBack };
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('trip adjustment editor page', () => {
  it('keeps the textarea on its own short page', () => {
    const markup = readFileSync('miniprogram/pages/trip-adjustment/index.wxml', 'utf8');

    expect(markup).toContain('<textarea');
    expect(markup).toContain('value="{{adjustment}}"');
    expect(markup).toContain('maxlength="1000"');
    expect(markup).toContain('bindinput="onInput"');
    expect(markup).toContain('bindtap="confirmAdjustment"');
    expect(markup).not.toContain('当前计划');
    expect(markup).not.toContain('current-plan');
  });

  it('validates text and returns a confirmed adjustment to the trip page', async () => {
    const { page, navigateBack } = await loadAdjustmentPage();
    const emit = vi.fn();
    page.getOpenerEventChannel = () => ({ emit });

    page.confirmAdjustment();
    expect(page.data.error).toBe('请输入 1–1000 字的行程调整建议');
    expect(emit).not.toHaveBeenCalled();
    expect(navigateBack).not.toHaveBeenCalled();

    page.onInput({ detail: { value: '  第二天安排轻松一些  ' } });
    page.confirmAdjustment();

    expect(emit).toHaveBeenCalledWith('confirmAdjustment', { adjustment: '第二天安排轻松一些' });
    expect(navigateBack).toHaveBeenCalledTimes(1);
  });
});

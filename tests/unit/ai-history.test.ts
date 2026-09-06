import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAiRequestSummary } from '../../shared/ai-history';

type HistoryPage = {
  data: Record<string, unknown>;
  setData(value: Record<string, unknown>): void;
  load(): Promise<void>;
  onRetry(): void;
  selectKind(event: { currentTarget: { dataset: { kind: string } } }): void;
  toggleRecord(event: { currentTarget: { dataset: { index: number } } }): void;
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.doUnmock('../../miniprogram/services/ai');
});

describe('AI history presentation', () => {
  it('formats chat, initial trip, empty preferences, follow-up, and invalid legacy inputs safely', () => {
    expect(formatAiRequestSummary({ requestId: 'c1', kind: 'chat', question: '  三峡大坝怎么去？  ' })).toBe('三峡大坝怎么去？');
    expect(formatAiRequestSummary({
      requestId: 't1', kind: 'trip', question: '忽略这段附言',
      trip: { destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['自然风景', '美食探索'] },
    })).toBe('宜昌｜2人｜2天｜总预算3000元｜偏好：自然风景、美食探索');
    expect(formatAiRequestSummary({
      requestId: 't2', kind: 'trip', trip: { destination: '宜昌', people: 1, totalBudgetCny: 800, days: 1, preferences: [] },
    })).toBe('宜昌｜1人｜1天｜总预算800元｜偏好：未指定');
    expect(formatAiRequestSummary({ requestId: 't3', kind: 'trip', question: '  第二天轻松一点  ' })).toBe('第二天轻松一点');
    expect(formatAiRequestSummary(null, 'chat')).toBe('历史自由问答');
    expect(formatAiRequestSummary(null, 'trip')).toBe('历史行程定制');
  });

  it('loads the saved prompt and renders it before the assistant response', async () => {
    vi.doMock('../../miniprogram/services/ai', () => ({ listAiRecords: vi.fn(async () => [{
      requestId: 'c1', kind: 'chat', prompt: '原始问题', createdAt: '2026-09-06T00:00:00.000Z',
      status: 'succeeded', answer: 'AI 回答', mode: 'dify', error: null, localFacts: [], references: [],
    }]) }));
    let page: HistoryPage;
    vi.stubGlobal('Page', (definition: HistoryPage) => { page = definition; });
    await import('../../miniprogram/pages/ai-history/index');
    page!.setData = function (value) { Object.assign(this.data, value); };
    await page!.load();
    expect(page!.data).toMatchObject({ status: 'ready', records: [{ prompt: '原始问题', answer: 'AI 回答' }] });

    const markup = await readFile('miniprogram/pages/ai-history/index.wxml', 'utf8');
    const userBubble = markup.indexOf('role="user"');
    const assistantBubble = markup.indexOf('role="assistant"');
    expect(userBubble).toBeGreaterThan(-1);
    expect(assistantBubble).toBeGreaterThan(userBubble);
    expect(markup).toContain('content="{{item.prompt}}"');
    expect(markup).toContain('<source-card');
    expect(markup).toContain('内容仅供出行参考');
    expect(markup).toContain('bind:retry="onRetry"');
    expect(markup).not.toMatch(/item\.(?:requestId|recordId)/);
  });

  it('filters local records by type and expands only the selected record', async () => {
    const listAiRecords = vi.fn(async () => [
      {
        requestId: 'chat-1', kind: 'chat' as const, prompt: '自由问答', createdAt: '2026-09-06T00:00:00.000Z',
        status: 'succeeded' as const, answer: '自由问答回答', mode: 'dify' as const, error: null, localFacts: [], references: [],
      },
      {
        requestId: 'trip-1', kind: 'trip' as const, prompt: '宜昌｜2人｜2天', createdAt: '2026-09-06T01:00:00.000Z',
        status: 'succeeded' as const, answer: '行程回答', mode: 'dify' as const, error: null, localFacts: [], references: [],
      },
    ]);
    vi.doMock('../../miniprogram/services/ai', () => ({ listAiRecords }));
    let page: HistoryPage;
    vi.stubGlobal('Page', (definition: HistoryPage) => { page = definition; });
    await import('../../miniprogram/pages/ai-history/index');
    page!.setData = function (value) { Object.assign(this.data, value); };

    await page!.load();
    expect(page!.data).toMatchObject({
      selectedKind: 'chat',
      expandedRequestId: '',
      visibleRecords: [{ requestId: 'chat-1', kind: 'chat', expanded: false }],
    });
    expect(listAiRecords).toHaveBeenCalledTimes(1);

    page!.selectKind({ currentTarget: { dataset: { kind: 'trip' } } });
    expect(page!.data).toMatchObject({
      selectedKind: 'trip',
      expandedRequestId: '',
      visibleRecords: [{ requestId: 'trip-1', kind: 'trip', expanded: false }],
    });
    expect(listAiRecords).toHaveBeenCalledTimes(1);

    page!.toggleRecord({ currentTarget: { dataset: { index: 0 } } });
    expect(page!.data).toMatchObject({
      expandedRequestId: 'trip-1',
      visibleRecords: [{ requestId: 'trip-1', expanded: true }],
    });
    page!.toggleRecord({ currentTarget: { dataset: { index: 0 } } });
    expect(page!.data).toMatchObject({
      expandedRequestId: '',
      visibleRecords: [{ requestId: 'trip-1', expanded: false }],
    });

    const markup = await readFile('miniprogram/pages/ai-history/index.wxml', 'utf8');
    expect(markup).toContain('自由问答');
    expect(markup).toContain('行程定制');
    expect(markup).toContain('bindtap="selectKind"');
    expect(markup).toContain('bindtap="toggleRecord"');
    expect(markup).toContain('wx:if="{{item.expanded}}"');
    expect(markup).toContain('内容仅供出行参考');
    expect(markup).toContain('role="user"');
    expect(markup).toContain('role="assistant"');
    expect(markup).toContain('<source-card');
  });
});

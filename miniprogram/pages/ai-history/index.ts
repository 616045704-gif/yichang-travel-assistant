import type { AiHistoryItem, AsyncStatus } from '../../../shared/contracts';
import { listAiRecords } from '../../services/ai';

type HistoryItem = AiHistoryItem & { title: string };
type SelectedKind = 'chat' | 'trip';
type DisplayRecord = HistoryItem & { displayTime: string; expanded: boolean };

function displayTime(createdAt: string) {
  const value = new Date(createdAt);
  if (Number.isNaN(value.getTime())) return '';
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  return `${value.getMonth() + 1}月${value.getDate()}日 ${hour}:${minute}`;
}

function visibleRecords(records: HistoryItem[], kind: SelectedKind, expandedRequestId: string): DisplayRecord[] {
  return records
    .filter(record => record.kind === kind)
    .map(record => ({ ...record, displayTime: displayTime(record.createdAt), expanded: record.requestId === expandedRequestId }));
}

Page({
  data: {
    records: [] as HistoryItem[],
    selectedKind: 'chat' as SelectedKind,
    expandedRequestId: '',
    visibleRecords: [] as DisplayRecord[],
    status: 'loading' as AsyncStatus,
    message: '',
  },
  onShow() { void this.load(); },
  async load() {
    this.setData({ status: 'loading', message: '' });
    try {
      const records = (await listAiRecords())
        .filter(result => result.status === 'succeeded' && Boolean(result.answer) && Boolean(result.prompt))
        .map(result => ({ ...result, title: result.kind === 'trip' ? '行程定制结果' : '自由问答结果' }));
      this.setData({
        records,
        selectedKind: 'chat',
        expandedRequestId: '',
        visibleRecords: visibleRecords(records, 'chat', ''),
        status: records.length ? 'ready' : 'empty',
      });
    } catch (error) {
      this.setData({ status: 'error', message: error instanceof Error ? error.message : 'AI 记录暂时无法读取，请稍后重试。' });
    }
  },
  selectKind(event: { currentTarget: { dataset: { kind?: string } } }) {
    const kind = event.currentTarget.dataset.kind;
    if (kind !== 'chat' && kind !== 'trip') return;
    this.setData({
      selectedKind: kind,
      expandedRequestId: '',
      visibleRecords: visibleRecords(this.data.records, kind, ''),
    });
  },
  toggleRecord(event: { currentTarget: { dataset: { index?: number } } }) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;
    const record = this.data.visibleRecords[index];
    if (!record) return;
    const requestId = record.requestId;
    const expandedRequestId = this.data.expandedRequestId === requestId ? '' : requestId;
    this.setData({
      expandedRequestId,
      visibleRecords: visibleRecords(this.data.records, this.data.selectedKind, expandedRequestId),
    });
  },
  onRetry() { void this.load(); },
});

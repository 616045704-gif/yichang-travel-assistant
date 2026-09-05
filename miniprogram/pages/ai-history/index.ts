import type { AiHistoryItem, AsyncStatus } from '../../../shared/contracts';
import { listAiRecords } from '../../services/ai';

type HistoryItem = AiHistoryItem & { title: string };

Page({
  data: { records: [] as HistoryItem[], status: 'loading' as AsyncStatus, message: '' },
  onShow() { void this.load(); },
  async load() {
    this.setData({ status: 'loading', message: '' });
    try {
      const records = (await listAiRecords())
        .filter(result => result.status === 'succeeded' && Boolean(result.answer))
        .map(result => ({ ...result, title: result.kind === 'trip' ? '行程定制结果' : '自由问答结果' }));
      this.setData({ records, status: records.length ? 'ready' : 'empty' });
    } catch (error) {
      this.setData({ status: 'error', message: error instanceof Error ? error.message : 'AI 记录暂时无法读取，请稍后重试。' });
    }
  },
  onRetry() { void this.load(); },
});

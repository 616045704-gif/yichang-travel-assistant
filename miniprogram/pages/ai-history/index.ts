import type { AiResult } from '../../../shared/contracts';
import { listMockAiRecords } from '../../services/ai';

type HistoryItem = AiResult & { title: string };

Page({
  data: { records: [] as HistoryItem[] },
  onShow() {
    const records = listMockAiRecords()
      .filter(result => result.status === 'succeeded' && Boolean(result.answer))
      .map(result => ({ ...result, title: result.requestId.startsWith('trip-') ? '行程定制结果' : '自由问答结果' }));
    this.setData({ records });
  },
});

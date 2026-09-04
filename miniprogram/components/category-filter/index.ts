import { CATEGORIES } from '../../../shared/contracts';

Component({
  properties: { value: { type: String, value: '' } },
  data: { options: [{ value: '', label: '全部' }, ...CATEGORIES] },
  methods: {
    onSelect(event: WechatMiniprogram.TouchEvent) {
      const category: unknown = event.currentTarget.dataset.value;
      if (category !== '' && !CATEGORIES.some(item => item.value === category)) return;
      this.triggerEvent('categorychange', { category });
    },
  },
});

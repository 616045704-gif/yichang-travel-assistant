import { CATEGORIES } from '../../../shared/contracts';

const OPTIONS = [{ value: '', label: '全部分类' }, ...CATEGORIES];

Component({
  properties: {
    value: {
      type: String,
      value: '',
      observer(value: string) {
        const selectedIndex = OPTIONS.findIndex(option => option.value === value);
        this.setData({ selectedIndex: selectedIndex >= 0 ? selectedIndex : 0 });
      },
    },
  },
  data: {
    options: OPTIONS,
    labels: OPTIONS.map(option => option.label),
    selectedIndex: 0,
  },
  methods: {
    onChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
      const selectedIndex = Number(event.detail.value);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= OPTIONS.length) return;
      const category = OPTIONS[selectedIndex].value;
      this.setData({ selectedIndex });
      this.triggerEvent('categorychange', { category });
    },
  },
});

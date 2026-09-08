import { CATEGORIES, type Category } from '../../../shared/contracts';

type CategoryValue = Category | '';
const OPTIONS: Array<{ value: CategoryValue; label: string }> = [{ value: '', label: '全部分类' }, ...CATEGORIES];
function isCategoryValue(value: unknown): value is CategoryValue {
  return typeof value === 'string' && OPTIONS.some(option => option.value === value);
}

Component({
  properties: {
    value: {
      type: String,
      value: '',
      observer(value: string) {
        const selectedValue = isCategoryValue(value) ? value : '';
        this.setData({ selectedValue });
      },
    },
  },
  data: {
    options: OPTIONS,
    selectedValue: '' as CategoryValue,
  },
  methods: {
    onTabTap(event: WechatMiniprogram.BaseEvent) {
      const category = event.currentTarget.dataset.category;
      if (!isCategoryValue(category)) return;
      this.setData({ selectedValue: category });
      this.triggerEvent('categorychange', { category }, { bubbles: true, composed: true });
    },
  },
});

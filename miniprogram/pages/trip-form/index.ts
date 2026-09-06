import type { AiRequest, AiResult, TripInput } from '../../../shared/contracts';
import { resetAiConversation, submitAi } from '../../services/ai';
import { validateTrip } from '../../view-models/chat';

const preferenceValues = ['自然风景', '人文历史', '美食探索', '亲子出行', '轻松慢游', '露营体验'];
let tripSequence = 0;

type FormState = { destination: string; people: string; totalBudgetCny: string; days: string; preferences: string[] };
type PreferenceOption = { value: string; selected: boolean };

function visibleOptions(selected: string[]): PreferenceOption[] {
  return preferenceValues.map(value => ({ value, selected: selected.includes(value) }));
}

function makeTrip(form: FormState): TripInput {
  return {
    destination: form.destination.trim(),
    people: Number(form.people),
    totalBudgetCny: Number(form.totalBudgetCny),
    days: Number(form.days),
    preferences: form.preferences,
  };
}

function networkError(result: AiResult): string {
  return result.error || '网络连接不稳定，请重试';
}

Page({
  data: {
    preferenceOptions: visibleOptions([]),
    form: { destination: '', people: '', totalBudgetCny: '', days: '', preferences: [] as string[] },
    errors: [] as string[],
    error: '',
    result: null as AiResult | null,
    results: [] as AiResult[],
    adjustment: '',
    adjustmentError: '',
    isSubmitting: false,
    lastRequest: null as AiRequest | null,
  },
  onDestination(event: WechatMiniprogram.Input) { this.updateForm({ destination: event.detail.value }); },
  onPeople(event: WechatMiniprogram.Input) { this.updateForm({ people: event.detail.value }); },
  onBudget(event: WechatMiniprogram.Input) { this.updateForm({ totalBudgetCny: event.detail.value }); },
  onDays(event: WechatMiniprogram.Input) { this.updateForm({ days: event.detail.value }); },
  onTogglePreference(event: WechatMiniprogram.BaseEvent) {
    const value = event.currentTarget.dataset.value as string | undefined;
    if (!value) return;
    const selected = this.data.form.preferences;
    if (selected.includes(value)) { this.updateForm({ preferences: selected.filter(item => item !== value) }); return; }
    if (selected.length >= 6) { this.setData({ errors: ['偏好最多选择 6 项'] }); return; }
    this.updateForm({ preferences: [...selected, value] });
  },
  async submit() {
    if (this.data.isSubmitting) return;
    const trip = makeTrip(this.data.form);
    const errors = validateTrip(trip);
    if (errors.length) { this.setData({ errors, error: '', result: null }); return; }
    const request: AiRequest = { requestId: `trip-${Date.now()}-${++tripSequence}`, kind: 'trip', trip };
    await this.send(request);
  },
  onAdjustment(event: WechatMiniprogram.Input) {
    this.setData({ adjustment: event.detail.value, adjustmentError: '', error: '' });
  },
  async submitAdjustment() {
    if (this.data.isSubmitting) return;
    const question = this.data.adjustment.trim();
    if (!question || question.length > 1000) {
      this.setData({ adjustmentError: '请输入 1–1000 字的行程调整建议' });
      return;
    }
    await this.send({ requestId: `trip-${Date.now()}-${++tripSequence}`, kind: 'trip', question });
  },
  async restartTrip() {
    if (this.data.isSubmitting) return;
    try {
      await resetAiConversation('trip');
      this.setData({ adjustment: '', adjustmentError: '', error: '', result: null, results: [], lastRequest: null });
    } catch {
      this.setData({ error: '重新规划暂时无法开始，请重试' });
    }
  },
  async retry() {
    if (this.data.isSubmitting || !this.data.lastRequest) return;
    await this.send(this.data.lastRequest);
  },
  updateForm(change: Partial<FormState>) {
    const form = { ...this.data.form, ...change };
    this.setData({ form, preferenceOptions: visibleOptions(form.preferences), errors: [], error: '' });
  },
  async send(request: AiRequest) {
    const isFirstPlan = Boolean(request.trip);
    this.setData({
      isSubmitting: true,
      error: '',
      errors: [],
      result: isFirstPlan ? null : this.data.result,
      results: isFirstPlan ? [] : this.data.results,
      lastRequest: request,
    });
    try {
      const result = await submitAi(request);
      if (result.status === 'succeeded' && result.answer) {
        this.setData({
          result,
          results: [...this.data.results, result],
          adjustment: request.question ? '' : this.data.adjustment,
          adjustmentError: '',
          error: '',
        });
      }
      else this.setData({ result: null, error: networkError(result) });
    } catch {
      this.setData({ result: null, error: '网络连接不稳定，请重试' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },
});

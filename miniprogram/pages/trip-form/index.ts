import type { AiRequest, AiResult, TripInput } from '../../../shared/contracts';
import { submitAi } from '../../services/ai';
import { validateTrip } from '../../view-models/chat';

const preferenceOptions = ['自然风景', '人文历史', '美食探索', '亲子出行', '轻松慢游', '露营体验'];
let tripSequence = 0;

type FormState = { destination: string; people: string; totalBudgetCny: string; days: string; preferences: string[] };

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
    preferenceOptions,
    form: { destination: '', people: '', totalBudgetCny: '', days: '', preferences: [] as string[] },
    errors: [] as string[],
    error: '',
    result: null as AiResult | null,
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
  async retry() {
    if (this.data.isSubmitting || !this.data.lastRequest) return;
    await this.send(this.data.lastRequest);
  },
  updateForm(change: Partial<FormState>) {
    this.setData({ form: { ...this.data.form, ...change }, errors: [], error: '' });
  },
  async send(request: AiRequest) {
    this.setData({ isSubmitting: true, error: '', errors: [], result: null, lastRequest: request });
    try {
      const result = await submitAi(request);
      if (result.status === 'succeeded' && result.answer) this.setData({ result, error: '' });
      else this.setData({ result: null, error: networkError(result) });
    } catch {
      this.setData({ result: null, error: '网络连接不稳定，请重试' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },
});

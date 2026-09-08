import type { AiRequest, AiResult, TripInput } from '../../../shared/contracts';
import { resetAiConversation, submitAi } from '../../services/ai';
import { validateTrip } from '../../view-models/chat';

const preferenceValues = ['自然风景', '人文历史', '美食探索', '亲子出行', '轻松慢游', '露营体验'];
let tripSequence = 0;

type FormState = { destination: string; people: string; totalBudgetCny: string; days: string; preferences: string[] };
type PreferenceOption = { value: string; selected: boolean };
type SendOptions = { confirmedRequirement?: string };

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

function thrownErrorMessage(error: unknown) {
  return error instanceof Error && error.message === '请求较频繁，请稍后再试。'
    ? error.message
    : '网络连接不稳定，请重试';
}

function fullRegenerationQuestion(trip: TripInput, requirements: string[]): string | null {
  const preferences = trip.preferences.length ? trip.preferences.join('、') : '无';
  const items = requirements.map((requirement, index) => `${index + 1}. ${requirement}`).join('\n');
  const question = [
    `请按以下基础条件重新输出一份完整、可直接执行的 ${trip.days} 天宜昌行程。`,
    `基础条件：目的地 ${trip.destination}；${trip.people} 人；总预算 ${trip.totalBudgetCny} 元；${trip.days} 天；偏好：${preferences}。`,
    `已确认要求：\n${items}`,
    `必须从第 1 天至第 ${trip.days} 天逐天完整输出，每天按上午、下午、晚上安排，最多 3 项。不要只说明修改点，不得省略任何一天；不写思考过程和长篇介绍。价格、营业时间、交通、预约以官方公告为准。`,
  ].join('\n');
  return question.length <= 1000 ? question : null;
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
    confirmedRequirements: [] as string[],
    isSubmitting: false,
    lastRequest: null as AiRequest | null,
    lastConfirmedRequirement: '',
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
    if (this.data.isSubmitting || this.data.results.length) return;
    const trip = makeTrip(this.data.form);
    const errors = validateTrip(trip);
    if (errors.length) { this.setData({ errors, error: '', result: null }); return; }
    const request: AiRequest = { requestId: `trip-${Date.now()}-${++tripSequence}`, kind: 'trip', trip };
    await this.send(request);
  },
  openAdjustmentPage() {
    if (this.data.isSubmitting) return;
    wx.navigateTo({
      url: '/pages/trip-adjustment/index',
      events: {
        confirmAdjustment: (payload: { adjustment?: unknown }) => {
          if (typeof payload.adjustment !== 'string') return;
          this.setData({ adjustment: payload.adjustment, adjustmentError: '', error: '' });
          void this.submitAdjustment();
        },
      },
    });
  },
  async submitAdjustment() {
    if (this.data.isSubmitting) return;
    const question = this.data.adjustment.trim();
    if (!question || question.length > 1000) {
      this.setData({ adjustmentError: '请输入 1–1000 字的行程调整建议' });
      return;
    }
    const trip = makeTrip(this.data.form);
    const errors = validateTrip(trip);
    if (errors.length) {
      this.setData({ errors, adjustmentError: '', error: '' });
      return;
    }
    const fullQuestion = fullRegenerationQuestion(trip, [...this.data.confirmedRequirements, question]);
    if (!fullQuestion) {
      this.setData({ adjustmentError: '已确认要求过长，请精简后再重新生成完整行程。' });
      return;
    }
    await this.send({ requestId: `trip-${Date.now()}-${++tripSequence}`, kind: 'trip', question: fullQuestion }, { confirmedRequirement: question });
  },
  async restartTrip() {
    if (this.data.isSubmitting) return;
    try {
      await resetAiConversation('trip');
      this.setData({
        adjustment: '',
        adjustmentError: '',
        confirmedRequirements: [],
        error: '',
        result: null,
        results: [],
        lastRequest: null,
        lastConfirmedRequirement: '',
      });
    } catch {
      this.setData({ error: '重新规划暂时无法开始，请重试' });
    }
  },
  async retry() {
    if (this.data.isSubmitting || !this.data.lastRequest) return;
    await this.send(this.data.lastRequest, {
      confirmedRequirement: this.data.lastConfirmedRequirement || undefined,
    });
  },
  updateForm(change: Partial<FormState>) {
    const form = { ...this.data.form, ...change };
    this.setData({ form, preferenceOptions: visibleOptions(form.preferences), errors: [], error: '' });
  },
  async send(request: AiRequest, options: SendOptions = {}) {
    const isFirstPlan = Boolean(request.trip);
    const existingResult = isFirstPlan ? null : this.data.result;
    this.setData({
      isSubmitting: true,
      error: '',
      errors: [],
      result: existingResult,
      results: isFirstPlan ? [] : this.data.results,
      lastRequest: request,
      lastConfirmedRequirement: options.confirmedRequirement ?? '',
    });
    try {
      const result = await submitAi(request);
      if (result.status === 'succeeded' && result.answer) {
        this.setData({
          result,
          results: [result, ...this.data.results],
          adjustment: request.question ? '' : this.data.adjustment,
          confirmedRequirements: options.confirmedRequirement
            ? [...this.data.confirmedRequirements, options.confirmedRequirement]
            : this.data.confirmedRequirements,
          adjustmentError: '',
          error: '',
        });
      }
      else this.setData({ result: existingResult, error: networkError(result) });
    } catch (error) {
      this.setData({ result: existingResult, error: thrownErrorMessage(error) });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },
});

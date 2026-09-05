import type { AiKind } from './contracts';

type UnknownRecord = Record<string, unknown>;

function validQuestion(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.trim().length <= 1_000;
}

function validBudget(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 100_000
    && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

function validTrip(value: unknown): value is UnknownRecord & {
  destination: string;
  people: number;
  totalBudgetCny: number;
  days: number;
  preferences: string[];
} {
  if (!value || typeof value !== 'object') return false;
  const trip = value as UnknownRecord;
  return typeof trip.destination === 'string' && !!trip.destination.trim() && trip.destination.trim().length <= 80
    && Number.isInteger(trip.people) && Number(trip.people) >= 1 && Number(trip.people) <= 20
    && validBudget(trip.totalBudgetCny)
    && Number.isInteger(trip.days) && Number(trip.days) >= 1 && Number(trip.days) <= 7
    && Array.isArray(trip.preferences) && trip.preferences.length <= 6
    && trip.preferences.every(item => typeof item === 'string' && !!item.trim() && item.trim().length <= 20);
}

export function formatAiRequestSummary(value: unknown, fallbackKind: AiKind = 'chat') {
  const request = value && typeof value === 'object' ? value as UnknownRecord : null;
  const kind: AiKind = request?.kind === 'chat' || request?.kind === 'trip' ? request.kind : fallbackKind;
  if (kind === 'trip' && validTrip(request?.trip)) {
    const preferences = request.trip.preferences.length
      ? request.trip.preferences.map(item => item.trim()).join('、')
      : '未指定';
    return `${request.trip.destination.trim()}｜${request.trip.people}人｜${request.trip.days}天｜总预算${request.trip.totalBudgetCny}元｜偏好：${preferences}`;
  }
  if (validQuestion(request?.question)) return request.question.trim();
  return kind === 'trip' ? '历史行程定制' : '历史自由问答';
}

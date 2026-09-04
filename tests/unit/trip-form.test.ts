import { describe, expect, it } from 'vitest';
import { validateTrip } from '../../miniprogram/view-models/chat';

describe('trip input validation', () => {
  it('accepts only a valid five-field trip input', () => {
    expect(validateTrip({ destination: '宜昌', people: 2, totalBudgetCny: 3000, days: 2, preferences: ['山水'] })).toEqual([]);
    expect(validateTrip({ destination: '', people: 21, totalBudgetCny: 0, days: 8, preferences: Array(7).fill('慢游') })).toEqual(expect.arrayContaining([
      '请选择目的地',
      '人数需为 1–20 的整数',
      '总预算需为 1–100000 元',
      '天数需为 1–7 的整数',
      '偏好最多选择 6 项',
    ]));
  });
});

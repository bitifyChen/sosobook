import { describe, expect, it } from 'vitest';
import {
  buildDailyCarryForwardCurve,
  calculateFillRate,
  calculateLossPercent,
  FILL_RATE_THRESHOLD,
  memberCompetitionScore,
  rankEntries,
  validateCompetitionStartDate,
} from './competition';

describe('competition utilities', () => {
  it('calculates weight-loss percentage', () => expect(calculateLossPercent(80, 76)).toBe(5));
  it('uses shared ranks for ties', () => {
    const result = rankEntries([
      { nickname: 'A', lossPct: 3 },
      { nickname: 'B', lossPct: 3 },
      { nickname: 'C', lossPct: 1 },
    ]);
    expect(result.map((item) => item.rank)).toEqual([1, 1, 3]);
  });
  it('uses the latest percentage curve value when no provisional score exists', () => {
    expect(
      memberCompetitionScore({
        provisionalLossPct: null,
        percentageCurve: [
          { dateKey: '2026-09-16', value: 0 },
          { dateKey: '2026-09-24', value: 3.25 },
        ],
      })
    ).toBe(3.25);
    expect(memberCompetitionScore({ percentageCurve: [] })).toBeNull();
  });
  it('calculates fill rate from actual curve dates', () => {
    const result = calculateFillRate(
      {
        percentageCurve: [
          { dateKey: '2026-09-14', value: 0 },
          { dateKey: '2026-09-16', value: 1.2 },
        ],
      },
      '2026-09-14',
      '2026-09-24'
    );

    expect(result).toEqual({ filledDays: 2, expectedDays: 11, percent: 18 });
    expect(FILL_RATE_THRESHOLD).toBe(60);
  });
  it('carries the previous weight through missing competition dates', () => {
    const result = buildDailyCarryForwardCurve(
      [
        { dateKey: '2026-09-22', weightKg: 70 },
        { dateKey: '2026-09-24', weightKg: 69.5 },
      ],
      '2026-09-22',
      '2026-09-24',
      (record) => ({ weightKg: record.weightKg })
    );

    expect(result).toEqual([
      { dateKey: '2026-09-22', weightKg: 70, isCarriedForward: false },
      { dateKey: '2026-09-23', weightKg: 70, isCarriedForward: true },
      { dateKey: '2026-09-24', weightKg: 69.5, isCarriedForward: false },
    ]);
  });
  it('starts the curve from the first available record when the baseline date is empty', () => {
    const result = buildDailyCarryForwardCurve(
      [{ dateKey: '2026-09-16', weightKg: 68.4 }],
      '2026-09-14',
      '2026-09-18',
      (record) => ({ weightKg: record.weightKg })
    );

    expect(result).toEqual([
      { dateKey: '2026-09-16', weightKg: 68.4, isCarriedForward: false },
      { dateKey: '2026-09-17', weightKg: 68.4, isCarriedForward: true },
      { dateKey: '2026-09-18', weightKg: 68.4, isCarriedForward: true },
    ]);
  });
  it('can visually backfill before the first record without changing the source dates', () => {
    const result = buildDailyCarryForwardCurve(
      [{ dateKey: '2026-09-16', weightKg: 68.4 }],
      '2026-09-14',
      '2026-09-18',
      (record) => ({ weightKg: record.weightKg }),
      { fillBeforeFirst: true }
    );

    expect(result).toEqual([
      { dateKey: '2026-09-14', weightKg: 68.4, isCarriedForward: true },
      { dateKey: '2026-09-15', weightKg: 68.4, isCarriedForward: true },
      { dateKey: '2026-09-16', weightKg: 68.4, isCarriedForward: false },
      { dateKey: '2026-09-17', weightKg: 68.4, isCarriedForward: true },
      { dateKey: '2026-09-18', weightKg: 68.4, isCarriedForward: true },
    ]);
  });
  it('rejects competition start dates before today', () => {
    expect(() => validateCompetitionStartDate('2026-09-21', '2026-09-22')).toThrow(
      '競賽開始日不能早於今天'
    );
    expect(validateCompetitionStartDate('2026-09-22', '2026-09-22')).toBe(true);
    expect(validateCompetitionStartDate('2026-09-23', '2026-09-22')).toBe(true);
  });
});

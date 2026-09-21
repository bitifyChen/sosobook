import { describe, expect, it } from 'vitest';
import { buildMonthCells, calculateStreak, canBackfillDate } from './date';

describe('date utilities', () => {
  it('builds a six-week calendar grid', () => expect(buildMonthCells(2026, 8)).toHaveLength(42));
  it('counts a streak ending today', () => {
    expect(
      calculateStreak(
        [{ dateKey: '2026-09-18' }, { dateKey: '2026-09-19' }, { dateKey: '2026-09-20' }],
        '2026-09-20'
      )
    ).toBe(3);
  });
  it('only permits a seven-day backfill window', () => {
    expect(canBackfillDate('2026-09-13', '2026-09-20')).toBe(true);
    expect(canBackfillDate('2026-09-12', '2026-09-20')).toBe(false);
  });
});

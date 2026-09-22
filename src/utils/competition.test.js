import { describe, expect, it } from 'vitest';
import { calculateLossPercent, rankEntries, validateCompetitionStartDate } from './competition';

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
  it('rejects competition start dates before today', () => {
    expect(() => validateCompetitionStartDate('2026-09-21', '2026-09-22')).toThrow(
      '競賽開始日不能早於今天'
    );
    expect(validateCompetitionStartDate('2026-09-22', '2026-09-22')).toBe(true);
    expect(validateCompetitionStartDate('2026-09-23', '2026-09-22')).toBe(true);
  });
});

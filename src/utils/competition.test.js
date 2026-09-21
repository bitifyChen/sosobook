import { describe, expect, it } from 'vitest';
import { calculateLossPercent, rankEntries } from './competition';

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
});

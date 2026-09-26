import { describe, expect, it } from 'vitest';
import { adjustWeight, formatWeight, normalizeWeight, WEIGHT_STEP } from './weight';

describe('weight utilities', () => {
  it('normalizes and formats weights to two decimal places', () => {
    expect(normalizeWeight('60.256')).toBe(60.26);
    expect(formatWeight(60)).toBe('60.00');
    expect(formatWeight(60.25)).toBe('60.25');
    expect(WEIGHT_STEP).toBe(0.01);
  });

  it('adjusts by one hundredth and clamps to the input range', () => {
    expect(adjustWeight(60, -0.01)).toBe(59.99);
    expect(adjustWeight(60.01, 0.01)).toBe(60.02);
    expect(adjustWeight(20, -0.01)).toBe(20);
    expect(adjustWeight(300, 0.01)).toBe(300);
  });
});

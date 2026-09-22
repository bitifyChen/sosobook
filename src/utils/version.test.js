import { describe, expect, it } from 'vitest';
import { compareVersions, isValidVersion, normalizeVersion } from './version';

describe('application versions', () => {
  it('keeps the complete three-part version', () => {
    expect(normalizeVersion('v0.1.2')).toBe('0.1.2');
    expect(isValidVersion('0.1.2')).toBe(true);
  });

  it('compares major, minor, and patch numbers', () => {
    expect(compareVersions('0.1.2', '0.1.1')).toBe(1);
    expect(compareVersions('0.2.0', '0.1.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.1.1', '0.1.2')).toBe(-1);
  });

  it('rejects versions that cannot be compared safely', () => {
    expect(isValidVersion('0.1')).toBe(false);
    expect(isValidVersion('latest')).toBe(false);
  });
});

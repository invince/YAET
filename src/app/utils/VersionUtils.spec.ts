import {compareVersions} from './VersionUtils';

describe('compareVersions', () => {
  it('should return 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('3.1.4', '3.1.4')).toBe(0);
    expect(compareVersions('0.0.0', '0.0.0')).toBe(0);
  });

  it('should return 1 when version1 is greater', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('3.2.0', '3.1.9')).toBe(1);
  });

  it('should return -1 when version1 is smaller', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('should handle different segment lengths', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
  });

  it('should handle single segment versions', () => {
    expect(compareVersions('2', '1')).toBe(1);
    expect(compareVersions('1', '2')).toBe(-1);
    expect(compareVersions('1', '1')).toBe(0);
  });
});

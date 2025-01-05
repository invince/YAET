export function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);

  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = v1Parts[i] || 0; // If no value exists, assume 0
    const part2 = v2Parts[i] || 0;

    if (part1 > part2) {
      return 1; // version1 is greater
    }
    if (part1 < part2) {
      return -1; // version2 is greater
    }
  }

  return 0; // Versions are equal
}

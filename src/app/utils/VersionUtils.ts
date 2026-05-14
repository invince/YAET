export function compareVersions(version1: string, version2: string): number {
  const sanitize = (v: string) =>
    v.split('.').map(seg => {
      const num = Number(seg);
      return isNaN(num) ? 0 : num;
    });

  const v1Parts = sanitize(version1);
  const v2Parts = sanitize(version2);

  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = v1Parts[i] || 0;
    const part2 = v2Parts[i] || 0;

    if (part1 > part2) {
      return 1;
    }
    if (part1 < part2) {
      return -1;
    }
  }

  return 0;
}

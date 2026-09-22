const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export const normalizeVersion = (version) =>
  String(version ?? '')
    .trim()
    .replace(/^v/i, '');

export const isValidVersion = (version) => VERSION_PATTERN.test(normalizeVersion(version));

export const compareVersions = (left, right) => {
  const leftParts = normalizeVersion(left)
    .split('.')
    .map((part) => Number(part) || 0);
  const rightParts = normalizeVersion(right)
    .split('.')
    .map((part) => Number(part) || 0);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index])
      return leftParts[index] > rightParts[index] ? 1 : -1;
  }

  return 0;
};

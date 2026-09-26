export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 300;
export const WEIGHT_STEP = 0.01;

export const normalizeWeight = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

export const formatWeight = (value) => {
  const numeric = normalizeWeight(value);
  return numeric === null ? '—' : numeric.toFixed(2);
};

export const adjustWeight = (value, delta) => {
  const current = normalizeWeight(value) ?? 60;
  const next = normalizeWeight(current + delta) ?? current;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, next));
};

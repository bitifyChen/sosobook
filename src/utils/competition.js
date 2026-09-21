export const calculateLossPercent = (baselineWeight, currentWeight) => {
  const baseline = Number(baselineWeight);
  const current = Number(currentWeight);
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(current)) return null;
  return Number((((baseline - current) / baseline) * 100).toFixed(2));
};

export const pickLatestRecordOnOrBefore = (records, dateKey) =>
  [...records]
    .filter((record) => record.dateKey <= dateKey)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0] || null;

export const recordsInRange = (records, startDate, endDate) =>
  [...records]
    .filter((record) => record.dateKey >= startDate && record.dateKey <= endDate)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

export const buildPercentageCurve = (records, baselineWeight) =>
  records.map((record) => ({
    dateKey: record.dateKey,
    value: calculateLossPercent(baselineWeight, record.weightKg),
  }));

export const rankEntries = (entries) => {
  const sorted = [...entries].sort((a, b) => {
    const scoreDifference = (b.lossPct ?? -Infinity) - (a.lossPct ?? -Infinity);
    if (scoreDifference !== 0) return scoreDifference;
    return String(a.nickname || '').localeCompare(String(b.nickname || ''), 'zh-Hant');
  });

  let previousScore = null;
  let previousRank = 0;
  return sorted.map((entry, index) => {
    const rank = entry.lossPct === previousScore ? previousRank : index + 1;
    previousScore = entry.lossPct;
    previousRank = rank;
    return { ...entry, rank };
  });
};

export const generateInviteCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join('');
};

export const competitionStatus = (competition, todayKey) => {
  if (competition.status === 'settled') return 'settled';
  if (todayKey < competition.startDate) return 'upcoming';
  if (todayKey > competition.endDate) return 'awaiting-settlement';
  return 'active';
};

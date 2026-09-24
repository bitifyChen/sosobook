import { addDays, daysBetween, toDateKey } from './date';

export const FILL_RATE_THRESHOLD = 60;

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

export const buildDailyCarryForwardCurve = (
  records,
  startDate,
  endDate,
  mapRecord = (record) => record,
  { fillBeforeFirst = false } = {}
) => {
  if (!startDate || !endDate || startDate > endDate) return [];

  const rangedRecords = recordsInRange(records, startDate, endDate);
  const recordByDate = new Map(rangedRecords.map((record) => [record.dateKey, record]));
  const curve = [];
  const firstRecord = rangedRecords[0] || null;
  let latestRecord = null;

  for (let dateKey = startDate; dateKey <= endDate; dateKey = addDays(dateKey, 1)) {
    const record = recordByDate.get(dateKey);
    if (record) latestRecord = record;
    if (!latestRecord) {
      if (!fillBeforeFirst || !firstRecord) continue;

      curve.push({
        dateKey,
        ...mapRecord(firstRecord),
        isCarriedForward: true,
      });
      continue;
    }

    curve.push({
      dateKey,
      ...mapRecord(latestRecord),
      isCarriedForward: record ? Boolean(record.isCarriedForward) : true,
    });
  }

  return curve;
};

export const validateCompetitionStartDate = (startDate, todayKey = toDateKey()) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(startDate) || startDate < todayKey) {
    const error = new Error('競賽開始日不能早於今天，請選擇今天或未來的日期。');
    error.code = 'COMPETITION_START_IN_PAST';
    throw error;
  }
  return true;
};

export const buildPercentageCurve = (records, baselineWeight) =>
  records.map((record) => ({
    dateKey: record.dateKey,
    value: calculateLossPercent(baselineWeight, record.weightKg),
  }));

export const calculateFillRate = (member, startDate, endDate) => {
  if (!member || !startDate || !endDate || endDate < startDate) {
    return { filledDays: 0, expectedDays: 0, percent: null };
  }

  const expectedDays = daysBetween(startDate, endDate) + 1;
  const filledDays = new Set(
    (member.percentageCurve || [])
      .map((point) => point.dateKey)
      .filter((dateKey) => dateKey >= startDate && dateKey <= endDate)
  ).size;

  return {
    filledDays,
    expectedDays,
    percent: Math.min(100, Math.round((filledDays / expectedDays) * 100)),
  };
};

export const memberCompetitionScore = (member) => {
  if (member?.provisionalLossPct !== null && member?.provisionalLossPct !== undefined) {
    const score = Number(member.provisionalLossPct);
    return Number.isFinite(score) ? score : null;
  }

  const latestPoint = [...(member?.percentageCurve || [])]
    .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)))
    .find((point) => point?.value !== null && point?.value !== undefined);
  const score = Number(latestPoint?.value);
  return Number.isFinite(score) ? score : null;
};

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

import { badges } from '@/data/assets';

export const defaultAchievementStats = Object.freeze({
  weightRecordCount: 0,
  completedCompetitionCount: 0,
  championCount: 0,
});

const statKeyBySeries = {
  record: 'weightRecordCount',
  finish: 'completedCompetitionCount',
  champion: 'championCount',
};

export const badgeSeries = [
  { key: 'record', label: '體重紀錄系列', statKey: 'weightRecordCount' },
  { key: 'finish', label: '完賽系列', statKey: 'completedCompetitionCount' },
  { key: 'champion', label: '冠軍系列', statKey: 'championCount' },
];

export const normalizeAchievementStats = (stats = {}) =>
  Object.fromEntries(
    Object.entries(defaultAchievementStats).map(([key, fallback]) => {
      const value = Number(stats[key]);
      return [key, Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback];
    })
  );

export const getBadgeProgress = (stats = {}, availableBadges = badges) => {
  const normalized = normalizeAchievementStats(stats);

  return availableBadges
    .filter((badge) => badge.series && Number.isInteger(badge.threshold))
    .map((badge) => {
      const statKey = statKeyBySeries[badge.series];
      const current = normalized[statKey] || 0;
      return {
        ...badge,
        current,
        unlocked: current >= badge.threshold,
        progress: Math.min(1, current / badge.threshold),
      };
    })
    .sort((left, right) => {
      if (left.series !== right.series) return left.series.localeCompare(right.series);
      return left.threshold - right.threshold;
    });
};

export const findNewlyUnlockedBadge = (
  seriesKey,
  previousCount,
  currentCount,
  availableBadges = badges
) => {
  const previous = Math.max(0, Number(previousCount) || 0);
  const current = Math.max(previous, Number(currentCount) || 0);
  return availableBadges
    .filter(
      (badge) =>
        badge.series === seriesKey &&
        Number.isInteger(badge.threshold) &&
        badge.threshold > previous &&
        badge.threshold <= current
    )
    .sort((left, right) => left.threshold - right.threshold)[0];
};

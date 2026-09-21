const storagePrefix = 'sosobook-viewed-competition-results';

const getStorageKey = (uid) => storagePrefix + ':' + (uid || 'anonymous');

const readViewedIds = (uid) => {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(getStorageKey(uid));
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const getViewedCompetitionResultIds = (uid) => readViewedIds(uid);

export const markCompetitionResultViewed = (uid, competitionId) => {
  const ids = new Set(readViewedIds(uid));
  ids.add(competitionId);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getStorageKey(uid), JSON.stringify([...ids]));
  }

  return [...ids];
};

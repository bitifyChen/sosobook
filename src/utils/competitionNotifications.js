const storagePrefix = 'sosobook-competition-status';

const storageKey = (uid) => `${storagePrefix}:${uid || 'anonymous'}`;

const toCount = (value) => {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
};

const normalizeSnapshot = (value) => {
  if (!value || typeof value !== 'object') return null;

  const competitions =
    value.competitions && typeof value.competitions === 'object' ? value.competitions : {};
  const totals = value.totals && typeof value.totals === 'object' ? value.totals : {};

  return {
    version: 1,
    competitions,
    totals: {
      completedCompetitionCount: toCount(totals.completedCompetitionCount),
      championCount: toCount(totals.championCount),
    },
  };
};

export const readCompetitionStatusSnapshot = (uid) => {
  if (typeof window === 'undefined') return null;

  try {
    const saved = window.localStorage.getItem(storageKey(uid));
    return saved ? normalizeSnapshot(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
};

export const writeCompetitionStatusSnapshot = (uid, competitions, totals) => {
  const snapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    competitions: Object.fromEntries(
      (Array.isArray(competitions) ? competitions : [])
        .filter((competition) => competition?.id)
        .map((competition) => [
          competition.id,
          {
            status: competition.status || null,
            endDate: competition.endDate || null,
          },
        ])
    ),
    totals: {
      completedCompetitionCount: toCount(totals?.completedCompetitionCount),
      championCount: toCount(totals?.championCount),
    },
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(uid), JSON.stringify(snapshot));
    } catch {
      // 儲存空間受限時仍可繼續使用，只是不會跨次造訪記住狀態。
    }
  }

  return snapshot;
};

export const findNewlySettledCompetitions = (
  previousSnapshot,
  competitions,
  viewedCompetitionIds = []
) => {
  const previousCompetitions = previousSnapshot?.competitions || {};
  const hasSnapshot = Boolean(previousSnapshot);
  const viewed = new Set(viewedCompetitionIds);

  return (Array.isArray(competitions) ? competitions : []).filter((competition) => {
    if (competition?.status !== 'settled') return false;

    const previous = previousCompetitions[competition.id];
    if (previous) return previous.status !== 'settled';

    // 新裝置第一次同步時只建立基準，不重播帳號既有的歷史結果。
    // 之後若使用者在這台裝置上看過競賽，再由狀態變化觸發提示。
    return hasSnapshot && !viewed.has(competition.id);
  });
};

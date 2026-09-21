const TAIPEI_TIMEZONE = 'Asia/Taipei';

export const toDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const parseDateKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

export const addDays = (key, days) => {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

export const daysBetween = (fromKey, toKey) => {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  return Math.round((to - from) / 86400000);
};

export const formatDate = (key, options = {}) =>
  new Intl.DateTimeFormat('zh-TW', {
    timeZone: TAIPEI_TIMEZONE,
    month: 'long',
    day: 'numeric',
    weekday: options.weekday ? 'short' : undefined,
    year: options.year ? 'numeric' : undefined,
  }).format(parseDateKey(key));

export const monthLabel = (year, monthIndex) => `${year} 年 ${monthIndex + 1} 月`;

export const buildMonthCells = (year, monthIndex) => {
  const firstDay = new Date(year, monthIndex, 1, 12);
  const gridStart = new Date(firstDay);
  gridStart.setDate(1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      key: toDateKey(date),
      day: date.getDate(),
      currentMonth: date.getMonth() === monthIndex,
    };
  });
};

export const calculateStreak = (records, todayKey = toDateKey()) => {
  const keys = new Set(records.map((record) => record.dateKey));
  let cursor = keys.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let streak = 0;

  while (keys.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

export const isFutureDate = (key) => key > toDateKey();

export const canBackfillDate = (key, todayKey = toDateKey()) => {
  const difference = daysBetween(key, todayKey);
  return difference >= 0 && difference <= 7;
};

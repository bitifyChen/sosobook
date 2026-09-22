import registry from './asset-registry.json';

const asset = (path) => `${import.meta.env.BASE_URL}img/${path}`;

const toAsset = (item, fallbackAlt) => ({
  id: item.assetId,
  key: item.key,
  assetId: item.assetId,
  version: item.currentVersion,
  src: asset(item.file),
  alt: item.alt || fallbackAlt,
  ...(item.series ? { series: item.series } : {}),
  ...(item.category ? { category: item.category } : {}),
  ...(Number.isInteger(item.threshold) ? { threshold: item.threshold } : {}),
});

export const avatars = registry.avatars.map((item, index) =>
  toAsset(item, `人物角色 ${index + 1}`)
);

export const stickers = registry.stickers.map((item, index) => ({
  ...toAsset(item, `心情貼紙 ${index + 1}`),
  name: item.label || item.alt || `心情貼紙 ${index + 1}`,
  category: item.category || 'other',
}));

export const stickerCategories = [
  { id: 'all', label: '全部' },
  { id: 'food', label: '食物' },
  { id: 'fitness', label: '健身' },
  { id: 'sport', label: '運動' },
  { id: 'outdoors', label: '野孩子' },
  { id: 'other', label: '其他' },
];

const badgeModules = import.meta.glob('../../public/img/badge/*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

const badgeSeriesLabels = {
  record: '體重紀錄徽章',
  finish: '完賽徽章',
  champion: '冠軍獎盃',
};

export const badges = Object.entries(badgeModules)
  .map(([filePath, source]) => {
    const normalizedPath = filePath.replaceAll('\\', '/');
    const match = /\/badge\/(record|finish|champion)\/(\d+)\.webp$/.exec(normalizedPath);
    if (!match) return null;

    const [, series, thresholdValue] = match;
    const threshold = Number(thresholdValue);
    const key = `${series}-${threshold}`;
    return {
      id: key,
      key,
      assetId: key,
      version: 1,
      src:
        typeof source === 'string'
          ? source
          : `${import.meta.env.BASE_URL}img/badge/${series}/${threshold}.webp`,
      alt: `${badgeSeriesLabels[series]} ${threshold}`,
      name: `${badgeSeriesLabels[series]} ${threshold}`,
      series,
      threshold,
    };
  })
  .filter(Boolean)
  .sort(
    (left, right) => left.series.localeCompare(right.series) || left.threshold - right.threshold
  );

export const navAssets = {
  card: asset('nav/image-gen-1(6).webp'),
  calendar: asset('nav/image-gen-2(6).webp'),
  competition: asset('nav/image-gen-3(5).webp'),
  checkIn: asset('nav/image-gen-4(4).webp'),
};

export const referenceImage = asset('reference/spring-journal-reference.webp');

export const loginBackgrounds = [
  {
    id: 'login-background-01',
    src: asset('background/login-background-01.webp'),
    alt: '春日校園與朋友們的手繪插畫',
  },
];

export const getRandomLoginBackground = () => {
  const storageKey = 'sosobook-login-background';
  let previousId = '';

  try {
    previousId = window.sessionStorage.getItem(storageKey) || '';
  } catch {
    // 瀏覽器限制儲存空間時，仍然可以正常隨機選圖。
  }

  const candidates = loginBackgrounds.filter((background) => background.id !== previousId);
  const selected = candidates[Math.floor(Math.random() * candidates.length)] || loginBackgrounds[0];

  try {
    window.sessionStorage.setItem(storageKey, selected.id);
  } catch {
    // 不影響登入頁顯示。
  }

  return selected;
};

export const avatarById = (id) =>
  avatars.find((avatar) => avatar.id === id || avatar.key === id) || avatars[0];
export const stickerById = (id) =>
  stickers.find((sticker) => sticker.id === id || sticker.key === id) || stickers[0];
export const badgeById = (id) =>
  badges.find((badge) => badge.id === id || badge.key === id) || badges[0];

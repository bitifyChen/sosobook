const STORAGE_VERSION = 1;
const MAX_RECENT_STICKERS = 8;
const RECENT_STICKERS_UPDATED_EVENT = 'sosobook:recent-stickers-updated';

const storageKey = (uid) => `sosobook-recent-stickers:${uid || 'guest'}`;

export const readRecentStickerIds = (uid, availableIds = []) => {
  const allowed = new Set(availableIds);

  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(uid)) || 'null');
    if (saved?.version !== STORAGE_VERSION || !Array.isArray(saved.ids)) return [];
    return [...new Set(saved.ids)]
      .filter((id) => typeof id === 'string' && allowed.has(id))
      .slice(0, MAX_RECENT_STICKERS);
  } catch {
    return [];
  }
};

export const rememberStickerSelection = (uid, stickerId, currentIds = []) => {
  if (!stickerId) return currentIds.slice(0, MAX_RECENT_STICKERS);

  const ids = [stickerId, ...currentIds.filter((id) => id !== stickerId)].slice(
    0,
    MAX_RECENT_STICKERS
  );

  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify({ version: STORAGE_VERSION, ids }));
  } catch {
    // 儲存空間不可用時仍可正常選擇貼紙。
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(RECENT_STICKERS_UPDATED_EVENT, {
        detail: { uid: uid || 'guest', ids },
      })
    );
  }

  return ids;
};

export { MAX_RECENT_STICKERS, RECENT_STICKERS_UPDATED_EVENT };

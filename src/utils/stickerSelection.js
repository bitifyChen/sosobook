export const MAX_STICKERS_PER_RECORD = 5;

const asStickerList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export const normalizeStickerIds = (stickerIds, legacyStickerId = null) => {
  const source = Array.isArray(stickerIds) ? stickerIds : asStickerList(legacyStickerId);

  return [...new Set(source.map((id) => (typeof id === 'string' ? id.trim() : id)))]
    .filter((id) => typeof id === 'string' && id)
    .slice(0, MAX_STICKERS_PER_RECORD);
};

export const getRecordStickerIds = (record) =>
  normalizeStickerIds(record?.stickerIds, record?.stickerId);

export const buildStickerCompatibilityFields = (stickerIds, legacyStickerId = null) => {
  const normalizedStickerIds = normalizeStickerIds(stickerIds, legacyStickerId);
  return {
    stickerIds: normalizedStickerIds,
    stickerId: normalizedStickerIds[0] || null,
  };
};

export const normalizeRecordStickerFields = (record) => {
  return {
    ...record,
    ...buildStickerCompatibilityFields(record?.stickerIds, record?.stickerId),
  };
};

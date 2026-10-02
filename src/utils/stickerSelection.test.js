import { describe, expect, it } from 'vitest';
import {
  buildStickerCompatibilityFields,
  getRecordStickerIds,
  normalizeRecordStickerFields,
  normalizeStickerIds,
} from './stickerSelection';

describe('record sticker compatibility', () => {
  it('maps a legacy single sticker and an empty value without writing back', () => {
    expect(getRecordStickerIds({ stickerId: 'old-sticker' })).toEqual(['old-sticker']);
    expect(getRecordStickerIds({ stickerId: null })).toEqual([]);
    expect(getRecordStickerIds({})).toEqual([]);
  });

  it('uses an explicit stickerIds array as the source of truth', () => {
    expect(getRecordStickerIds({ stickerIds: [], stickerId: 'legacy-sticker' })).toEqual([]);
    expect(
      getRecordStickerIds({ stickerIds: ['new-a', 'new-b'], stickerId: 'legacy-sticker' })
    ).toEqual(['new-a', 'new-b']);
  });

  it('trims, deduplicates, and limits new selections to five stickers', () => {
    expect(normalizeStickerIds([' a ', 'b', 'a', 'c', 'd', 'e', 'f'])).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('builds matching compatibility fields for dual writes', () => {
    expect(buildStickerCompatibilityFields(['a', 'b'])).toEqual({
      stickerIds: ['a', 'b'],
      stickerId: 'a',
    });
    expect(buildStickerCompatibilityFields([])).toEqual({ stickerIds: [], stickerId: null });
  });

  it('normalizes legacy records in memory without persisting them', () => {
    const legacy = { dateKey: '2026-10-01', weightKg: 60, stickerId: 'old-sticker' };
    expect(normalizeRecordStickerFields(legacy)).toEqual({
      ...legacy,
      stickerIds: ['old-sticker'],
      stickerId: 'old-sticker',
    });
  });
});

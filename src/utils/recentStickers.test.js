import { beforeEach, describe, expect, it } from 'vitest';
import { readRecentStickerIds, rememberStickerSelection } from './recentStickers';

describe('recent sticker storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps eight unique sticker selections in newest-first order', () => {
    let ids = [];
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'c']) {
      ids = rememberStickerSelection('user-1', id, ids);
    }

    expect(ids).toEqual(['c', 'i', 'h', 'g', 'f', 'e', 'd', 'b']);
    expect(readRecentStickerIds('user-1', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])).toEqual(
      ids
    );
  });

  it('does not record the empty sticker choice and filters unavailable assets', () => {
    let ids = rememberStickerSelection('user-1', 'old-sticker', []);
    ids = rememberStickerSelection('user-1', null, ids);

    expect(ids).toEqual(['old-sticker']);
    expect(readRecentStickerIds('user-1', ['new-sticker'])).toEqual([]);
  });

  it('keeps recent stickers separate for each local account', () => {
    rememberStickerSelection('user-1', 'a', []);
    rememberStickerSelection('user-2', 'b', []);

    expect(readRecentStickerIds('user-1', ['a', 'b'])).toEqual(['a']);
    expect(readRecentStickerIds('user-2', ['a', 'b'])).toEqual(['b']);
  });
});

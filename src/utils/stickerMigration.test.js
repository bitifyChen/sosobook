import { describe, expect, it } from 'vitest';
import {
  legacyStickerIdsFor,
  migrateStickerIds,
  needsStickerIdsMigration,
} from '../../scripts/migrate-sticker-ids.mjs';

const makeRecordSnapshot = (path, data) => {
  const updates = [];
  return {
    id: path.split('/').at(-1),
    ref: {
      path,
      update: async (payload) => updates.push(payload),
    },
    data: () => data,
    updates,
  };
};

const makeDb = (recordSnapshots) => ({
  collection: () => ({
    get: async () => ({
      size: 1,
      docs: [
        {
          ref: {
            collection: () => ({
              get: async () => ({ docs: recordSnapshots }),
            }),
          },
        },
      ],
    }),
  }),
});

describe('sticker id migration', () => {
  it('converts only a legacy stickerId value to a one-item array', () => {
    expect(legacyStickerIdsFor({ stickerId: ' old-sticker ' })).toEqual(['old-sticker']);
    expect(legacyStickerIdsFor({ stickerId: null })).toEqual([]);
    expect(needsStickerIdsMigration({ stickerId: 'old-sticker' })).toBe(true);
    expect(needsStickerIdsMigration({ stickerIds: [] })).toBe(false);
  });

  it('keeps dry-run read-only and reports planned, skipped, and scanned records', async () => {
    const legacy = makeRecordSnapshot('users/u/weightRecords/2026-10-01', {
      stickerId: 'old-sticker',
    });
    const current = makeRecordSnapshot('users/u/weightRecords/2026-10-02', {
      stickerId: 'new-sticker',
      stickerIds: ['new-sticker'],
    });

    const result = await migrateStickerIds({
      db: makeDb([legacy, current]),
      log: () => {},
    });

    expect(result.stats).toMatchObject({
      usersScanned: 1,
      recordsScanned: 2,
      plannedUpdates: 1,
      skippedRecords: 1,
      updatedRecords: 0,
      errorRecords: 0,
    });
    expect(legacy.updates).toEqual([]);
  });

  it('updates only records missing stickerIds when explicitly applied', async () => {
    const legacy = makeRecordSnapshot('users/u/weightRecords/2026-10-01', {
      stickerId: 'old-sticker',
    });
    const empty = makeRecordSnapshot('users/u/weightRecords/2026-10-02', {
      stickerId: null,
    });
    const current = makeRecordSnapshot('users/u/weightRecords/2026-10-03', {
      stickerId: 'new-sticker',
      stickerIds: ['new-sticker'],
    });

    const result = await migrateStickerIds({
      db: makeDb([legacy, empty, current]),
      apply: true,
      log: () => {},
    });

    expect(result.stats.updatedRecords).toBe(2);
    expect(legacy.updates).toEqual([{ stickerIds: ['old-sticker'] }]);
    expect(empty.updates).toEqual([{ stickerIds: [] }]);
    expect(current.updates).toEqual([]);
  });
});

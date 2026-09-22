import { describe, expect, it } from 'vitest';
import { findNewlySettledCompetitions } from './competitionNotifications';

const settledCompetition = {
  id: 'competition-1',
  status: 'settled',
  endDate: '2026-09-21',
};

describe('competition notification snapshots', () => {
  it('does not replay existing results on a new device', () => {
    expect(findNewlySettledCompetitions(null, [settledCompetition])).toEqual([]);
  });

  it('notifies when an existing competition changes to settled', () => {
    expect(
      findNewlySettledCompetitions(
        {
          competitions: {
            [settledCompetition.id]: { status: 'active', endDate: settledCompetition.endDate },
          },
        },
        [settledCompetition]
      )
    ).toEqual([settledCompetition]);
  });
});

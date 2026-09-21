---
name: sosobook-competition
description: Implement or review SosoBook competition creation, invite-code joining, provisional leaderboards, settlement rules, and immutable certificate snapshots.
metadata:
  short-description: SosoBook competition and certificates
---

# SosoBook Competition

Read `MVP_SPEC.md` before changing competition behavior.

Fixed MVP rules:

- Individual competitions only.
- Invite codes are exactly six uppercase English letters.
- The competition start-date weight is the baseline.
- Missing baseline data may be backfilled only within the seven-day window.
- Ranking is `(baselineWeight - latestWeight) / baselineWeight * 100`.
- Missing end-day data uses the latest record on or before the end date.
- Equal percentages share a rank.
- Participants may leave before start, not after start.

During a competition, the client may publish only the user's provisional percentage, rank, and freshness metadata. Never publish raw weight.

The official GitHub Actions settlement script must read private records, apply the fixed rules, write an immutable certificate snapshot, and mark the competition settled idempotently. Other participants see percentage curves; the current user sees their own actual-weight curve.

Test no baseline, late join outside the backfill window, weight gain, missing end-day data, equal scores, edited historical records, duplicate settlement runs, and one-participant competitions.

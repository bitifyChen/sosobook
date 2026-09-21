---
name: sosobook-firebase
description: Implement or review SosoBook Google authentication, Firestore data access, security rules, offline persistence, and privacy boundaries.
metadata:
  short-description: SosoBook Firebase data and security
---

# SosoBook Firebase

Read `MVP_SPEC.md` before changing the data model.

- `users/{uid}` and `users/{uid}/weightRecords/{dateKey}` are private to the owner.
- Competition member documents contain only public display data and provisional percentage and rank fields.
- Official certificates are readable by members of that competition but are not client-writable.
- A participant's raw certificate curve is readable only by that participant.
- Use Firebase Google sign-in and store nickname, height in centimeters, and avatar ID in the user profile.
- Use `YYYY-MM-DD` local-date keys in `Asia/Taipei`.
- Support Firestore web offline persistence and last-write-wins for same-day multi-device conflicts.
- Validate ownership and allowed fields in Firestore Rules.
- Prevent clients from writing settlement status, certificate summaries, ranks, or official curves.
- Keep Firebase Admin credentials only in GitHub Actions Secrets.

Test allowed and denied reads and writes with the Firebase Emulator or isolated fixtures. Do not put secrets in frontend code or repository files.

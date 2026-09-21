import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!credentialJson) throw new Error('缺少 FIREBASE_SERVICE_ACCOUNT_JSON。');

const serviceAccount = JSON.parse(credentialJson);
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const lossPercent = (baseline, final) => Number((((baseline - final) / baseline) * 100).toFixed(2));
const rank = (entries) => {
  const sorted = [...entries].sort(
    (a, b) => b.lossPct - a.lossPct || a.nickname.localeCompare(b.nickname, 'zh-Hant')
  );
  let previous;
  let previousRank = 0;
  return sorted.map((entry, index) => {
    const place = entry.lossPct === previous ? previousRank : index + 1;
    previous = entry.lossPct;
    previousRank = place;
    return { ...entry, rank: place };
  });
};

const competitions = await db
  .collection('competitions')
  .where('status', '==', 'active')
  .where('endDate', '<', today)
  .get();
for (const competitionDoc of competitions.docs) {
  const competition = competitionDoc.data();
  const existing = await competitionDoc.ref.collection('certificate').doc('result').get();
  if (existing.exists) continue;

  const members = await competitionDoc.ref.collection('members').get();
  const calculated = [];
  for (const memberDoc of members.docs) {
    const member = memberDoc.data();
    const records = await db
      .collection('users')
      .doc(member.uid)
      .collection('weightRecords')
      .where('dateKey', '>=', competition.startDate)
      .where('dateKey', '<=', competition.endDate)
      .orderBy('dateKey')
      .get();
    const values = records.docs.map((doc) => doc.data());
    const baseline = values.find((record) => record.dateKey === competition.startDate);
    const final = values.at(-1);
    if (!baseline || !final) continue;
    calculated.push({
      uid: member.uid,
      nickname: member.nickname,
      avatarId: member.avatarId,
      baselineWeight: baseline.weightKg,
      finalWeight: final.weightKg,
      finalDate: final.dateKey,
      lossPct: lossPercent(baseline.weightKg, final.weightKg),
      curve: values.map((record) => ({ dateKey: record.dateKey, weightKg: record.weightKg })),
    });
  }

  const results = rank(calculated);
  const batch = db.batch();
  batch.create(competitionDoc.ref.collection('certificate').doc('result'), {
    competitionId: competitionDoc.id,
    competitionName: competition.name,
    startDate: competition.startDate,
    endDate: competition.endDate,
    championUids: results.filter((entry) => entry.rank === 1).map((entry) => entry.uid),
    participantCount: results.length,
    settledAt: Timestamp.now(),
    schemaVersion: 1,
  });
  for (const result of results) {
    batch.create(competitionDoc.ref.collection('certificateParticipants').doc(result.uid), {
      uid: result.uid,
      nickname: result.nickname,
      avatarId: result.avatarId,
      lossPct: result.lossPct,
      rank: result.rank,
      finalDate: result.finalDate,
      percentageCurve: result.curve.map((point) => ({
        dateKey: point.dateKey,
        value: lossPercent(result.baselineWeight, point.weightKg),
      })),
    });
    batch.create(competitionDoc.ref.collection('certificatePrivate').doc(result.uid), {
      uid: result.uid,
      baselineWeightKg: result.baselineWeight,
      finalWeightKg: result.finalWeight,
      weightCurve: result.curve,
    });
  }
  batch.update(competitionDoc.ref, {
    status: 'settled',
    settledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  console.log(
    `Settled ${competition.name} (${competitionDoc.id}) with ${results.length} valid participants.`
  );
}

console.log(`Settlement scan complete: ${competitions.size} competition(s) checked.`);

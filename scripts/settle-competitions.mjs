import { appendFile } from 'node:fs/promises';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!credentialJson) throw new Error('缺少 FIREBASE_SERVICE_ACCOUNT_JSON。');

const serviceAccount = JSON.parse(credentialJson);
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const getTaipeiDateKey = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(value)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const triggerTime = new Date();
const today = getTaipeiDateKey(triggerTime);

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

const allCompetitions = await db.collection('competitions').get();
const settlementStats = {
  totalCompetitions: allCompetitions.size,
  activeCompetitions: 0,
  dueCompetitions: 0,
  notDueCompetitions: 0,
  invalidDateCompetitions: 0,
  settledCompetitions: 0,
  skippedExistingCertificate: 0,
  membersScanned: 0,
  validParticipants: 0,
  excludedParticipants: 0,
  changedDocuments: 0,
};
const dueCompetitions = allCompetitions.docs.filter((competitionDoc) => {
  const competition = competitionDoc.data();
  if (competition.status !== 'active') return false;
  settlementStats.activeCompetitions += 1;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(competition.endDate || '')) {
    settlementStats.invalidDateCompetitions += 1;
    return false;
  }
  if (competition.endDate < today) {
    settlementStats.dueCompetitions += 1;
    return true;
  }
  settlementStats.notDueCompetitions += 1;
  return false;
});

console.log(
  `[settle] Triggered at ${triggerTime.toISOString()} UTC via ${process.env.GITHUB_EVENT_NAME || 'local'}; ` +
    `Taipei date ${today}; scanned ${settlementStats.totalCompetitions} competition document(s), ` +
    `${settlementStats.activeCompetitions} active, ${settlementStats.dueCompetitions} due, ` +
    `${settlementStats.notDueCompetitions} not due, ${settlementStats.invalidDateCompetitions} invalid end date(s).`
);

for (const competitionDoc of dueCompetitions) {
  const competition = competitionDoc.data();
  const existing = await competitionDoc.ref.collection('certificate').doc('result').get();
  if (existing.exists) {
    settlementStats.skippedExistingCertificate += 1;
    console.log(
      `[settle] ${competitionDoc.id}: certificate already exists; changed 0 document(s).`
    );
    continue;
  }

  const members = await competitionDoc.ref.collection('members').get();
  settlementStats.membersScanned += members.size;
  const calculated = [];
  let noRecords = 0;
  let missingBaseline = 0;
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
    if (!values.length) {
      noRecords += 1;
      continue;
    }
    const baseline = values.find((record) => record.dateKey === competition.startDate);
    const final = values.at(-1);
    if (!baseline || !final) {
      missingBaseline += 1;
      continue;
    }
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
  const changedDocuments = 2 + results.length * 2;
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
  settlementStats.settledCompetitions += 1;
  settlementStats.validParticipants += results.length;
  settlementStats.excludedParticipants += members.size - results.length;
  settlementStats.changedDocuments += changedDocuments;
  console.log(
    `[settle] Settled ${competition.name} (${competitionDoc.id}) with ${results.length} valid participant(s); ` +
      `${changedDocuments} Firestore document(s) changed ` +
      `(no records: ${noRecords}, missing baseline: ${missingBaseline}).`
  );
}

const summaryLines = [
  '## Competition settlement',
  '',
  `- Taipei date: \`${today}\``,
  `- Competition documents scanned: ${settlementStats.totalCompetitions}`,
  `- Active competitions: ${settlementStats.activeCompetitions}`,
  `- Due for settlement: ${settlementStats.dueCompetitions}`,
  `- Not yet due: ${settlementStats.notDueCompetitions}`,
  `- Invalid or missing end date: ${settlementStats.invalidDateCompetitions}`,
  `- Settled this run: ${settlementStats.settledCompetitions}`,
  `- Skipped because certificate already exists: ${settlementStats.skippedExistingCertificate}`,
  `- Members scanned: ${settlementStats.membersScanned}`,
  `- Valid participants: ${settlementStats.validParticipants}`,
  `- Excluded participants: ${settlementStats.excludedParticipants}`,
  `- Firestore documents changed: **${settlementStats.changedDocuments}**`,
];
console.log(`Settlement scan complete: ${summaryLines.slice(2).join('; ')}.`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summaryLines.join('\n')}\n`, 'utf8');
}

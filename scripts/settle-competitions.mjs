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
const FILL_RATE_THRESHOLD = 60;
const MAX_BATCH_WRITES = 500;
const isValidDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const dateKeyToUtc = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
const inclusiveDays = (startDate, endDate) =>
  Math.floor((dateKeyToUtc(endDate) - dateKeyToUtc(startDate)) / 86400000) + 1;
const calculateFillRate = (records, startDate, endDate) => {
  if (!startDate || !endDate || endDate < startDate) {
    return { filledDays: 0, expectedDays: 0, percent: null };
  }
  const expectedDays = inclusiveDays(startDate, endDate);
  const filledDays = new Set(
    records
      .map((record) => record.dateKey)
      .filter((dateKey) => dateKey >= startDate && dateKey <= endDate)
  ).size;
  return {
    filledDays,
    expectedDays,
    percent: Math.min(100, Math.round((filledDays / expectedDays) * 100)),
  };
};

const lossPercent = (baseline, final) => Number((((baseline - final) / baseline) * 100).toFixed(2));
const rank = (entries) => {
  const sorted = [...entries].sort(
    (a, b) =>
      b.lossPct - a.lossPct ||
      String(a.nickname || '').localeCompare(String(b.nickname || ''), 'zh-Hant')
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
  belowFillRateParticipants: 0,
  unrankedParticipants: 0,
  noRecordParticipants: 0,
  invalidWeightParticipants: 0,
  changedDocuments: 0,
};
const dueCompetitions = allCompetitions.docs.filter((competitionDoc) => {
  const competition = competitionDoc.data();
  if (competition.status !== 'active') return false;
  settlementStats.activeCompetitions += 1;
  if (
    !isValidDateKey(competition.startDate) ||
    !isValidDateKey(competition.endDate) ||
    competition.startDate > competition.endDate
  ) {
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
    `${settlementStats.notDueCompetitions} not due, ${settlementStats.invalidDateCompetitions} invalid date range(s).`
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
  let invalidWeights = 0;
  for (const memberDoc of members.docs) {
    const member = memberDoc.data();
    const memberUid = member.uid || memberDoc.id;
    const records = await db
      .collection('users')
      .doc(memberUid)
      .collection('weightRecords')
      .where('dateKey', '>=', competition.startDate)
      .where('dateKey', '<=', competition.endDate)
      .orderBy('dateKey')
      .get();
    const values = records.docs.map((doc) => doc.data());
    if (!values.length) {
      noRecords += 1;
      calculated.push({
        uid: memberUid,
        nickname: member.nickname,
        avatarId: member.avatarId,
        baselineWeight: null,
        finalWeight: null,
        finalDate: null,
        lossPct: null,
        fillRatePercent: 0,
        filledDays: 0,
        expectedDays: inclusiveDays(competition.startDate, competition.endDate),
        curve: [],
      });
      continue;
    }
    const hasInvalidWeight = values.some((record) => {
      const weight = Number(record.weightKg);
      return !Number.isFinite(weight) || weight <= 0;
    });
    if (hasInvalidWeight) {
      invalidWeights += 1;
      calculated.push({
        uid: memberUid,
        nickname: member.nickname,
        avatarId: member.avatarId,
        baselineWeight: null,
        finalWeight: null,
        finalDate: null,
        lossPct: null,
        fillRatePercent: 0,
        filledDays: 0,
        expectedDays: inclusiveDays(competition.startDate, competition.endDate),
        curve: [],
      });
      continue;
    }
    const baseline = values[0];
    const final = values.at(-1);
    const baselineWeight = Number(baseline.weightKg);
    const finalWeight = Number(final.weightKg);
    const fillRate = calculateFillRate(values, competition.startDate, competition.endDate);
    calculated.push({
      uid: memberUid,
      nickname: member.nickname,
      avatarId: member.avatarId,
      baselineWeight,
      finalWeight,
      finalDate: final.dateKey,
      lossPct: lossPercent(baselineWeight, finalWeight),
      fillRatePercent: fillRate.percent,
      filledDays: fillRate.filledDays,
      expectedDays: fillRate.expectedDays,
      curve: values.map((record) => ({ dateKey: record.dateKey, weightKg: record.weightKg })),
    });
  }

  const ranked = rank(
    calculated.filter(
      (entry) => entry.lossPct !== null && entry.fillRatePercent >= FILL_RATE_THRESHOLD
    )
  );
  const unranked = calculated
    .filter((entry) => entry.lossPct === null || entry.fillRatePercent < FILL_RATE_THRESHOLD)
    .map((entry) => ({ ...entry, rank: null }));
  const belowFillRate = unranked.filter((entry) => entry.fillRatePercent < FILL_RATE_THRESHOLD);
  const results = [...ranked, ...unranked];
  const changedDocuments = 2 + results.length * 2;
  if (changedDocuments > MAX_BATCH_WRITES) {
    throw new Error(
      `${competitionDoc.id} 需要寫入 ${changedDocuments} 份文件，超過 Firestore 單次批次上限 ${MAX_BATCH_WRITES}。`
    );
  }
  const batch = db.batch();
  batch.create(competitionDoc.ref.collection('certificate').doc('result'), {
    competitionId: competitionDoc.id,
    competitionName: competition.name,
    startDate: competition.startDate,
    endDate: competition.endDate,
    championUids: results.filter((entry) => entry.rank === 1).map((entry) => entry.uid),
    participantCount: results.length,
    qualifiedParticipantCount: ranked.length,
    fillRateThreshold: FILL_RATE_THRESHOLD,
    settledAt: Timestamp.now(),
    schemaVersion: 2,
  });
  for (const result of results) {
    batch.create(competitionDoc.ref.collection('certificateParticipants').doc(result.uid), {
      uid: result.uid,
      nickname: result.nickname,
      avatarId: result.avatarId,
      lossPct: result.lossPct,
      rank: result.rank,
      finalDate: result.finalDate,
      fillRatePercent: result.fillRatePercent,
      filledDays: result.filledDays,
      expectedDays: result.expectedDays,
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
  settlementStats.validParticipants += ranked.length;
  settlementStats.belowFillRateParticipants += belowFillRate.length;
  settlementStats.unrankedParticipants += unranked.length;
  settlementStats.noRecordParticipants += noRecords;
  settlementStats.invalidWeightParticipants += invalidWeights;
  settlementStats.changedDocuments += changedDocuments;
  console.log(
    `[settle] Settled ${competition.name} (${competitionDoc.id}) with ${results.length} participant snapshot(s); ` +
      `${changedDocuments} Firestore document(s) changed ` +
      `(qualified: ${ranked.length}, below ${FILL_RATE_THRESHOLD}%: ${belowFillRate.length}, ` +
      `no records: ${noRecords}, invalid weights: ${invalidWeights}).`
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
  `- Invalid or missing date range: ${settlementStats.invalidDateCompetitions}`,
  `- Settled this run: ${settlementStats.settledCompetitions}`,
  `- Skipped because certificate already exists: ${settlementStats.skippedExistingCertificate}`,
  `- Members scanned: ${settlementStats.membersScanned}`,
  `- Qualified and ranked participants: ${settlementStats.validParticipants}`,
  `- Below ${FILL_RATE_THRESHOLD}% fill rate: ${settlementStats.belowFillRateParticipants}`,
  `- Unranked participants: ${settlementStats.unrankedParticipants}`,
  `- Participants with no competition records: ${settlementStats.noRecordParticipants}`,
  `- Participants with invalid weight data: ${settlementStats.invalidWeightParticipants}`,
  `- Firestore documents changed: **${settlementStats.changedDocuments}**`,
];
console.log(`Settlement scan complete: ${summaryLines.slice(2).join('; ')}.`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summaryLines.join('\n')}\n`, 'utf8');
}

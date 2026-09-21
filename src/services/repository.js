import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider, isFirebaseConfigured } from '@/firebase';
import * as mockRepository from '@/services/mockRepository';
import { toDateKey } from '@/utils/date';
import { generateInviteCode } from '@/utils/competition';

const isMockMode = import.meta.env.VITE_FIREBASE_MOCK === 'true';
const toPlain = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });
const requireFirebase = () => {
  if (isFirebaseConfigured) return;
  const error = new Error('Firebase 尚未設定，現在無法讀取或保存資料。');
  error.code = 'FIREBASE_NOT_CONFIGURED';
  throw error;
};

export const repositoryMode = isMockMode ? 'mock' : isFirebaseConfigured ? 'firebase' : 'setup';

export const subscribeAuth = (callback) => {
  if (isMockMode) return mockRepository.subscribeAuth(callback);
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const login = async () => {
  if (isMockMode) return mockRepository.login();
  requireFirebase();
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

export const logout = async () => {
  if (isMockMode) return mockRepository.logout();
  if (!isFirebaseConfigured) return;
  await signOut(auth);
};

export const getProfile = async (uid) => {
  if (isMockMode) return mockRepository.getProfile(uid);
  requireFirebase();
  const snapshot = await getDoc(doc(db, 'users', uid));
  return snapshot.exists() ? toPlain(snapshot) : null;
};

export const saveProfile = async (uid, profile) => {
  if (isMockMode) return mockRepository.saveProfile(uid, profile);
  requireFirebase();
  const profileRef = doc(db, 'users', uid);
  const existing = await getDoc(profileRef);
  const editableFields = {
    nickname: profile.nickname.trim(),
    heightCm: Number(profile.heightCm),
    avatarId: profile.avatarId,
  };
  const updatedAt = new Date().toISOString();

  if (existing.exists()) {
    await updateDoc(profileRef, {
      ...editableFields,
      updatedAt: serverTimestamp(),
    });
    return {
      id: existing.id,
      ...existing.data(),
      ...editableFields,
      updatedAt,
    };
  }

  const payload = {
    uid,
    ...editableFields,
    email: profile.email || null,
    updatedAt,
  };
  await setDoc(profileRef, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return payload;
};

export const listRecords = async (uid) => {
  if (isMockMode) return mockRepository.listRecords(uid);
  requireFirebase();
  const recordsQuery = query(collection(db, 'users', uid, 'weightRecords'), orderBy('dateKey'));
  const snapshot = await getDocs(recordsQuery);
  return snapshot.docs.map(toPlain);
};

export const saveWeightRecord = async (uid, record) => {
  if (isMockMode) return mockRepository.saveWeightRecord(uid, record);
  requireFirebase();
  const payload = {
    dateKey: record.dateKey,
    weightKg: Number(record.weightKg),
    stickerId: record.stickerId,
    source: record.source || 'normal',
    updatedAt: new Date().toISOString(),
  };
  const recordRef = doc(db, 'users', uid, 'weightRecords', payload.dateKey);
  const existing = await getDoc(recordRef);
  const timestamps = { updatedAt: serverTimestamp() };
  if (!existing.exists()) timestamps.createdAt = serverTimestamp();

  await setDoc(recordRef, { ...payload, ...timestamps }, { merge: true });
  return payload;
};

export const deleteWeightRecord = async (uid, dateKey) => {
  if (isMockMode) return mockRepository.deleteWeightRecord(uid, dateKey);
  requireFirebase();
  await deleteDoc(doc(db, 'users', uid, 'weightRecords', dateKey));
};

const loadFirebaseCompetition = async (uid, competitionId) => {
  const competitionSnapshot = await getDoc(doc(db, 'competitions', competitionId));
  if (!competitionSnapshot.exists()) return null;

  const membersSnapshot = await getDocs(collection(db, 'competitions', competitionId, 'members'));
  const competition = {
    ...toPlain(competitionSnapshot),
    members: membersSnapshot.docs.map(toPlain),
  };

  if (competition.status === 'settled') {
    const certificateSnapshot = await getDoc(
      doc(db, 'competitions', competitionId, 'certificate', 'result')
    );
    const participantsSnapshot = await getDocs(
      collection(db, 'competitions', competitionId, 'certificateParticipants')
    );
    const privateSnapshot = await getDoc(
      doc(db, 'competitions', competitionId, 'certificatePrivate', uid)
    );
    competition.certificate = certificateSnapshot.exists() ? toPlain(certificateSnapshot) : null;
    competition.certificateParticipants = participantsSnapshot.docs.map(toPlain);
    competition.privateCurve = privateSnapshot.exists()
      ? privateSnapshot.data().weightCurve || []
      : [];
  }
  return competition;
};

export const listCompetitions = async (uid) => {
  if (isMockMode) return mockRepository.listCompetitions(uid);
  requireFirebase();
  const membershipQuery = query(collectionGroup(db, 'members'), where('uid', '==', uid));
  const membershipSnapshot = await getDocs(membershipQuery);
  const competitions = await Promise.all(
    membershipSnapshot.docs.map((membership) =>
      loadFirebaseCompetition(uid, membership.data().competitionId)
    )
  );
  return competitions.filter(Boolean);
};

export const getCompetition = async (uid, competitionId) => {
  if (isMockMode) return mockRepository.getCompetition(uid, competitionId);
  requireFirebase();
  return loadFirebaseCompetition(uid, competitionId);
};

const reserveInviteCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateInviteCode();
    const snapshot = await getDoc(doc(db, 'competitionInviteCodes', code));
    if (!snapshot.exists()) return code;
  }
  throw new Error('邀請碼產生失敗，請再試一次。');
};

export const createCompetition = async (uid, profile, input) => {
  if (isMockMode) return mockRepository.createCompetition(uid, profile, input);
  requireFirebase();
  const inviteCode = await reserveInviteCode();
  const id = doc(collection(db, 'competitions')).id;
  const competition = {
    id,
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    inviteCode,
    createdBy: uid,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const member = {
    uid,
    competitionId: id,
    nickname: profile.nickname,
    avatarId: profile.avatarId,
    role: 'host',
    provisionalLossPct: null,
    provisionalRank: null,
    joinedAt: new Date().toISOString(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'competitions', id), {
    ...competition,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'competitions', id, 'members', uid), {
    ...member,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'competitionInviteCodes', inviteCode), {
    competitionId: id,
    competitionName: competition.name,
    startDate: competition.startDate,
    endDate: competition.endDate,
    createdBy: uid,
    active: true,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { ...competition, members: [member] };
};

export const updateCompetition = async (uid, competitionId, input) => {
  if (isMockMode) return mockRepository.updateCompetition(uid, competitionId, input);
  requireFirebase();
  const payload = {
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
  };

  const batch = writeBatch(db);
  batch.update(doc(db, 'competitions', competitionId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'competitionInviteCodes', input.inviteCode), {
    competitionName: payload.name,
    startDate: payload.startDate,
    endDate: payload.endDate,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return loadFirebaseCompetition(uid, competitionId);
};

export const joinCompetition = async (uid, profile, inviteCode) => {
  if (isMockMode) return mockRepository.joinCompetition(uid, profile, inviteCode);
  requireFirebase();
  const code = inviteCode.trim().toUpperCase();

  const inviteSnapshot = await getDoc(doc(db, 'competitionInviteCodes', code));
  if (!inviteSnapshot.exists() || !inviteSnapshot.data().active)
    throw new Error('找不到這個競賽房間。');
  const invite = inviteSnapshot.data();
  if (invite.endDate < toDateKey()) throw new Error('這場競賽已經結束，無法再加入。');
  const competitionId = invite.competitionId;
  await setDoc(doc(db, 'competitions', competitionId, 'members', uid), {
    uid,
    competitionId,
    inviteCode: code,
    nickname: profile.nickname,
    avatarId: profile.avatarId,
    role: 'member',
    provisionalLossPct: null,
    provisionalRank: null,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return loadFirebaseCompetition(uid, competitionId);
};

export const updateProvisionalScore = async (uid, competitionId, payload) => {
  if (isMockMode) return mockRepository.updateProvisionalScore(uid, competitionId, payload);
  requireFirebase();
  await updateDoc(doc(db, 'competitions', competitionId, 'members', uid), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const leaveCompetition = async (uid, competitionId) => {
  if (isMockMode) return mockRepository.leaveCompetition(uid, competitionId);
  requireFirebase();
  await deleteDoc(doc(db, 'competitions', competitionId, 'members', uid));
};

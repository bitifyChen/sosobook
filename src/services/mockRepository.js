import { toDateKey } from '@/utils/date';
import { defaultAchievementStats, normalizeAchievementStats } from '@/utils/badges';
import { generateInviteCode, validateCompetitionStartDate } from '@/utils/competition';

const storageKey = 'sosobook-firebase-mock';
const emptyCompetitionFixtures = { competitions: [] };
let mockCompetitionFixturesPromise;
const mockUser = {
  uid: 'mock-google-user',
  displayName: 'SosoBook 測試使用者',
  email: 'test@sosobook.local',
  photoURL: null,
};

const createEmptyState = () => ({
  user: null,
  profiles: {},
  records: {},
  competitions: {},
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const fixtureUserId = 'demo-user';

const loadMockCompetitionFixtures = async () => {
  if (typeof fetch !== 'function') return emptyCompetitionFixtures;
  if (!mockCompetitionFixturesPromise) {
    const fixturesUrl = `${import.meta.env.BASE_URL}src/data/mock-competition-fixtures.json`;
    mockCompetitionFixturesPromise = fetch(fixturesUrl)
      .then((response) => (response.ok ? response.json() : emptyCompetitionFixtures))
      .catch(() => emptyCompetitionFixtures);
  }
  return mockCompetitionFixturesPromise;
};

const hydrateCompetitionFixture = (fixture, uid, profile) => {
  const replaceUser = (item) =>
    item.uid === fixtureUserId
      ? { ...item, uid, nickname: profile.nickname, avatarId: profile.avatarId }
      : item;
  const competition = clone(fixture);

  if (competition.createdBy === fixtureUserId) competition.createdBy = uid;
  competition.members = competition.members.map(replaceUser);
  if (competition.certificate) {
    competition.certificate.championUids = competition.certificate.championUids.map((item) =>
      item === fixtureUserId ? uid : item
    );
  }
  if (competition.certificateParticipants) {
    competition.certificateParticipants = competition.certificateParticipants.map(replaceUser);
  }
  return competition;
};

const seedMockCompetitions = async (state, uid) => {
  const profile = state.profiles[uid];
  if (uid !== mockUser.uid || !profile) return false;
  const mockCompetitionFixtures = await loadMockCompetitionFixtures();

  let changed = false;
  mockCompetitionFixtures.competitions.forEach((fixture) => {
    const existing = state.competitions[fixture.id];
    if (!existing) {
      state.competitions[fixture.id] = hydrateCompetitionFixture(fixture, uid, profile);
      changed = true;
      return;
    }

    const hydratedFixture = hydrateCompetitionFixture(fixture, uid, profile);
    existing.members = existing.members.map((member) => {
      if (Array.isArray(member.percentageCurve)) return member;
      const fixtureMember = hydratedFixture.members.find((item) => item.uid === member.uid);
      if (!fixtureMember) return member;
      changed = true;
      return { ...member, percentageCurve: fixtureMember.percentageCurve || [] };
    });
  });
  return changed;
};

const readState = () => {
  if (typeof window === 'undefined') return createEmptyState();

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return createEmptyState();
    const parsed = JSON.parse(saved);
    return {
      ...createEmptyState(),
      ...parsed,
      profiles: parsed.profiles || {},
      records: parsed.records || {},
      competitions: parsed.competitions || {},
    };
  } catch {
    return createEmptyState();
  }
};

const writeState = (state) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
};

const now = () => new Date().toISOString();

const loadCompetition = (competitionId) => {
  const state = readState();
  return state.competitions[competitionId] ? clone(state.competitions[competitionId]) : null;
};

export const subscribeAuth = (callback) => {
  const state = readState();
  callback(state.user ? clone(state.user) : null);
  return () => {};
};

export const login = async () => {
  const state = readState();
  state.user = state.user || mockUser;
  writeState(state);
  return clone(state.user);
};

export const logout = async () => {
  const state = readState();
  state.user = null;
  writeState(state);
};

export const getProfile = async (uid) => {
  const state = readState();
  return state.profiles[uid] ? clone(state.profiles[uid]) : null;
};

export const saveProfile = async (uid, profile) => {
  const state = readState();
  const previous = state.profiles[uid];
  const payload = {
    uid,
    nickname: profile.nickname.trim(),
    heightCm: Number(profile.heightCm),
    avatarId: profile.avatarId,
    email: profile.email || state.user?.email || null,
    achievementStats: normalizeAchievementStats(
      previous?.achievementStats || defaultAchievementStats
    ),
    createdAt: previous?.createdAt || now(),
    updatedAt: now(),
  };
  state.profiles[uid] = payload;
  writeState(state);
  return clone(payload);
};

export const listRecords = async (uid) => {
  const state = readState();
  return Object.values(state.records[uid] || {})
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .map(clone);
};

export const saveWeightRecord = async (uid, record) => {
  const state = readState();
  const records = state.records[uid] || {};
  const previous = records[record.dateKey];
  const payload = {
    dateKey: record.dateKey,
    weightKg: Number(record.weightKg),
    stickerId: record.stickerId,
    source: record.source || 'normal',
    createdAt: previous?.createdAt || now(),
    updatedAt: now(),
  };
  records[record.dateKey] = payload;
  state.records[uid] = records;
  writeState(state);
  return clone(payload);
};

export const deleteWeightRecord = async (uid, dateKey) => {
  const state = readState();
  if (state.records[uid]) delete state.records[uid][dateKey];
  writeState(state);
};

export const listCompetitions = async (uid) => {
  const state = readState();
  if (await seedMockCompetitions(state, uid)) writeState(state);
  return Object.values(state.competitions)
    .filter((competition) => competition.members.some((member) => member.uid === uid))
    .map(clone);
};

export const getCompetition = async (_uid, competitionId) => loadCompetition(competitionId);

export const createCompetition = async (uid, profile, input) => {
  validateCompetitionStartDate(input.startDate);
  const state = readState();
  let inviteCode = generateInviteCode();
  while (Object.values(state.competitions).some((item) => item.inviteCode === inviteCode)) {
    inviteCode = generateInviteCode();
  }

  const id = `mock-competition-${Date.now().toString(36)}`;
  const timestamp = now();
  const member = {
    uid,
    competitionId: id,
    nickname: profile.nickname,
    avatarId: profile.avatarId,
    role: 'host',
    provisionalLossPct: null,
    provisionalRank: null,
    joinedAt: timestamp,
    updatedAt: timestamp,
  };
  const competition = {
    id,
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    inviteCode,
    createdBy: uid,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    members: [member],
  };
  state.competitions[id] = competition;
  writeState(state);
  return clone(competition);
};

export const updateCompetition = async (_uid, competitionId, input) => {
  const state = readState();
  const competition = state.competitions[competitionId];
  if (!competition) throw new Error('找不到這場競賽。');
  competition.name = input.name.trim();
  competition.startDate = input.startDate;
  competition.endDate = input.endDate;
  competition.updatedAt = now();
  writeState(state);
  return clone(competition);
};

export const joinCompetition = async (uid, profile, inviteCode) => {
  const state = readState();
  const code = inviteCode.trim().toUpperCase();
  const competition = Object.values(state.competitions).find((item) => item.inviteCode === code);
  if (!competition) throw new Error('找不到這個競賽房間。');

  const existing = competition.members.find((member) => member.uid === uid);
  if (!existing) {
    competition.members.push({
      uid,
      competitionId: competition.id,
      inviteCode: code,
      nickname: profile.nickname,
      avatarId: profile.avatarId,
      role: 'member',
      provisionalLossPct: null,
      provisionalRank: null,
      joinedAt: now(),
      updatedAt: now(),
    });
    writeState(state);
  }
  return clone(competition);
};

export const updateProvisionalScore = async (uid, competitionId, payload) => {
  const state = readState();
  const competition = state.competitions[competitionId];
  const member = competition?.members.find((item) => item.uid === uid);
  if (!member) throw new Error('找不到競賽參賽資料。');
  Object.assign(member, payload, { updatedAt: now() });
  writeState(state);
};

export const leaveCompetition = async (uid, competitionId) => {
  const state = readState();
  const competition = state.competitions[competitionId];
  if (!competition) return;
  competition.members = competition.members.filter((member) => member.uid !== uid);
  writeState(state);
};

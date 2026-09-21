import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import * as repository from '@/services/repository';
import { addDays, calculateStreak, toDateKey } from '@/utils/date';
import { badgeSeries, findNewlyUnlockedBadge } from '@/utils/badges';
import {
  buildPercentageCurve,
  calculateLossPercent,
  pickLatestRecordOnOrBefore,
  rankEntries,
  recordsInRange,
} from '@/utils/competition';

export const useAppStore = defineStore('app', () => {
  const state = reactive({
    authReady: false,
    busy: false,
    loginPending: false,
    authError: null,
    user: null,
    profile: null,
    records: [],
    competitions: [],
    toast: null,
    confirm: null,
    badgeViewerQueue: [],
    mode: repository.repositoryMode,
  });

  let confirmResolver = null;

  const recordsByDate = computed(() =>
    Object.fromEntries(state.records.map((item) => [item.dateKey, item]))
  );
  const latestRecord = computed(
    () => [...state.records].sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0] || null
  );
  const streak = computed(() => calculateStreak(state.records));

  const notify = (message, kind = 'success') => {
    state.toast = { message, kind, id: Date.now() };
  };

  const isCompetitionIndexPending = (cause) => {
    const code = cause?.code || '';
    const message = cause?.message || '';
    return (
      (code === 'failed-precondition' || code === 'FAILED_PRECONDITION') &&
      (message.includes('COLLECTION_GROUP_ASC') || message.includes('index is not ready'))
    );
  };

  const loadCompetitionsWithFallback = async () => {
    try {
      return {
        competitions: await repository.listCompetitions(state.user.uid),
        indexPending: false,
      };
    } catch (cause) {
      if (!isCompetitionIndexPending(cause)) {
        cause.sosoBookOperation = '競賽列表';
        throw cause;
      }
      return { competitions: [], indexPending: true };
    }
  };

  const notifyCompetitionIndexPending = () => {
    notify('競賽索引正在建立，會員卡與體重紀錄可先正常使用；稍後重新整理即可載入競賽。', 'warning');
  };

  const getAuthErrorMessage = (cause) => {
    const code = cause?.code || '';
    if (code === 'permission-denied' || code === 'PERMISSION_DENIED')
      return 'Google 已登入，但 Firebase 資料權限不足，請確認最新的 Firestore Rules 已部署。';
    if (code === 'failed-precondition')
      return 'Google 已登入，但 Firestore 尚未完成資料庫或索引設定。';
    if (code === 'auth/popup-blocked') return '登入視窗被瀏覽器擋下，請允許此網站開啟彈出視窗。';
    if (code === 'auth/popup-closed-by-user') return '登入視窗已關閉，尚未完成 Google 登入。';
    if (code === 'auth/unauthorized-domain')
      return '目前這個網址尚未加入 Firebase Authentication 的授權網域。';
    if (cause?.sosoBookOperation)
      return `Google 已登入，但${cause.sosoBookOperation}讀取失敗，請確認 Firebase Rules。`;
    return cause?.message || '目前無法完成登入，請稍後再試。';
  };

  const openBadgeViewer = (badge) => {
    state.badgeViewerQueue.push(badge);
  };

  const closeBadgeViewer = () => {
    state.badgeViewerQueue.shift();
  };

  const revealNewBadge = (seriesKey, previousCount, currentCount) => {
    const badge = findNewlyUnlockedBadge(seriesKey, previousCount, currentCount);
    const series = badgeSeries.find((item) => item.key === seriesKey);
    if (!badge || !series) return;
    openBadgeViewer({
      ...badge,
      seriesLabel: series.label,
      current: currentCount,
      unlocked: true,
      mode: 'earned',
    });
  };

  const competitionAchievementStats = (competitions) => {
    const userId = state.user?.uid;
    const settled = (Array.isArray(competitions) ? competitions : []).filter(
      (competition) => competition.status === 'settled'
    );
    const championCount = settled.filter((competition) => {
      if (!userId) return false;
      if (competition.certificate?.championUids?.includes(userId)) return true;
      return competition.certificateParticipants?.some(
        (participant) => participant.uid === userId && participant.rank === 1
      );
    }).length;
    return {
      completedCompetitionCount: settled.length,
      championCount,
    };
  };

  const buildCompetitionJoinPrompt = (competition) => {
    const today = toDateKey();
    if (!competition || competition.startDate > today) return null;

    const lastDate = competition.endDate < today ? competition.endDate : today;
    let missingDays = 0;
    for (let cursor = competition.startDate; cursor <= lastDate; cursor = addDays(cursor, 1)) {
      if (!recordsByDate.value[cursor]) missingDays += 1;
    }

    if (!missingDays) return null;
    return {
      kind: competition.startDate === today ? 'first-day' : 'missing-days',
      missingDays,
    };
  };

  const askConfirm = (options = {}) =>
    new Promise((resolve) => {
      confirmResolver = resolve;
      state.confirm = {
        title: options.title || '要確認一下嗎？',
        message: options.message || '請確認要繼續這個動作。',
        tone: options.tone || 'info',
        confirmText: options.confirmText || '確認繼續',
        cancelText: options.cancelText || '先不要',
        id: Date.now(),
      };
    });

  const resolveConfirm = (value) => {
    const resolver = confirmResolver;
    confirmResolver = null;
    state.confirm = null;
    resolver?.(value);
  };

  const loadAll = async () => {
    if (!state.user) return;
    state.busy = true;
    const loadTask = (operation, task) =>
      task.catch((cause) => {
        cause.sosoBookOperation = operation;
        throw cause;
      });
    try {
      const [profile, records, competitionResult] = await Promise.all([
        loadTask('會員資料', repository.getProfile(state.user.uid)),
        loadTask('體重紀錄', repository.listRecords(state.user.uid)),
        loadCompetitionsWithFallback(),
      ]);
      state.profile = profile;
      state.records = Array.isArray(records) ? records : [];
      state.competitions = Array.isArray(competitionResult.competitions)
        ? competitionResult.competitions
        : [];
      if (competitionResult.indexPending) notifyCompetitionIndexPending();
      else if (state.competitions.length) {
        try {
          await refreshScores();
        } catch (cause) {
          console.error('[SosoBook] 暫算競賽曲線同步失敗。', cause);
        }
      }
    } finally {
      state.busy = false;
    }
  };

  const syncAuthState = async (user) => {
    state.authReady = false;
    state.user = user;
    state.authError = null;

    try {
      if (user) await loadAll();
      else {
        state.profile = null;
        state.records = [];
        state.competitions = [];
        state.badgeViewerQueue = [];
      }
    } catch (cause) {
      state.profile = null;
      state.records = [];
      state.competitions = [];
      state.authError = getAuthErrorMessage(cause);
      notify(state.authError, 'error');
      console.error('[SosoBook] Firebase 初始化失敗。', cause);
    } finally {
      state.busy = false;
      state.authReady = true;
    }
  };

  const init = () =>
    repository.subscribeAuth((user) => {
      void syncAuthState(user);
    });

  const login = async () => {
    state.authError = null;
    state.busy = true;
    state.loginPending = true;
    try {
      const user = await repository.login();
      if (repository.repositoryMode === 'mock') await syncAuthState(user);
    } catch (cause) {
      state.authError = getAuthErrorMessage(cause);
      notify(state.authError, 'error');
      state.busy = false;
    } finally {
      state.loginPending = false;
      if (state.authReady) state.busy = false;
    }
  };

  const logout = async () => {
    await repository.logout();
    state.user = null;
    state.profile = null;
    state.authError = null;
    state.badgeViewerQueue = [];
  };

  const saveProfile = async (profile) => {
    state.busy = true;
    try {
      const savedProfile = await repository.saveProfile(state.user.uid, {
        ...profile,
        email: state.user.email,
      });
      state.profile = savedProfile;
      try {
        const competitionResult = await loadCompetitionsWithFallback();
        state.competitions = competitionResult.competitions;
        if (competitionResult.indexPending) {
          notify('會員卡已保存；競賽索引正在建立，稍後重新整理即可載入競賽。', 'warning');
        } else {
          notify('健身卡資料已保存！');
        }
      } catch (cause) {
        console.error('[SosoBook] 會員卡已保存，但競賽列表更新失敗。', cause);
        notify('會員卡已保存，但競賽資料暫時無法更新。', 'warning');
      }
    } catch (cause) {
      const message =
        cause?.code === 'permission-denied'
          ? '會員卡尚未能同步，請確認最新的 Firestore Rules 已部署。'
          : cause?.message || '會員卡保存失敗，請稍後再試。';
      notify(message, 'error');
      throw cause;
    } finally {
      state.busy = false;
    }
  };

  const refreshCompetitions = async () => {
    const previousStats = competitionAchievementStats(state.competitions);
    const competitionResult = await loadCompetitionsWithFallback();
    if (competitionResult.indexPending) {
      notifyCompetitionIndexPending();
      return;
    }
    state.competitions = competitionResult.competitions;
    const currentStats = competitionAchievementStats(state.competitions);
    revealNewBadge(
      'finish',
      previousStats.completedCompetitionCount,
      currentStats.completedCompetitionCount
    );
    revealNewBadge('champion', previousStats.championCount, currentStats.championCount);
  };

  const refreshScores = async () => {
    const today = toDateKey();
    for (const competition of state.competitions) {
      if (competition.status === 'settled' || today > competition.endDate) continue;
      const baseline = state.records.find((record) => record.dateKey === competition.startDate);
      const current = pickLatestRecordOnOrBefore(
        state.records,
        today < competition.endDate ? today : competition.endDate
      );
      if (!baseline || !current || current.dateKey < competition.startDate) {
        await repository.updateProvisionalScore(state.user.uid, competition.id, {
          provisionalLossPct: null,
          provisionalRank: null,
          provisionalAsOf: null,
          percentageCurve: [],
        });
        continue;
      }
      const provisionalLossPct = calculateLossPercent(baseline.weightKg, current.weightKg);
      const percentageCurve = buildPercentageCurve(
        recordsInRange(state.records, competition.startDate, current.dateKey),
        baseline.weightKg
      );
      const entries = rankEntries(
        competition.members.map((member) => ({
          ...member,
          lossPct: member.uid === state.user.uid ? provisionalLossPct : member.provisionalLossPct,
        }))
      );
      const own = entries.find((entry) => entry.uid === state.user.uid);
      await repository.updateProvisionalScore(state.user.uid, competition.id, {
        provisionalLossPct,
        provisionalRank: own?.rank || null,
        provisionalAsOf: current.dateKey,
        percentageCurve,
      });
    }
    await refreshCompetitions();
  };

  const saveRecord = async (record) => {
    const previousRecordCount = state.records.length;
    await repository.saveWeightRecord(state.user.uid, record);
    state.records = await repository.listRecords(state.user.uid);
    await refreshScores();
    revealNewBadge('record', previousRecordCount, state.records.length);
    notify('今天的體重已記下！');
  };

  const deleteRecord = async (dateKey) => {
    await repository.deleteWeightRecord(state.user.uid, dateKey);
    state.records = await repository.listRecords(state.user.uid);
    await refreshScores();
    notify('這天的體重與貼紙已刪除。');
  };

  const createCompetition = async (input) => {
    const item = await repository.createCompetition(state.user.uid, state.profile, input);
    await refreshCompetitions();
    await refreshScores();
    notify(`競賽成立，邀請碼是 ${item.inviteCode}`);
    return item;
  };

  const updateCompetition = async (id, input) => {
    const current = state.competitions.find((item) => item.id === id);
    const item = await repository.updateCompetition(state.user.uid, id, {
      ...input,
      inviteCode: current?.inviteCode,
    });
    await refreshCompetitions();
    notify('競賽設定已更新！');
    return item;
  };

  const joinCompetition = async (code) => {
    const item = await repository.joinCompetition(state.user.uid, state.profile, code);
    await refreshCompetitions();
    await refreshScores();
    notify(`已加入「${item.name}」！`);
    const joinedCompetition =
      state.competitions.find((competition) => competition.id === item.id) || item;
    if (!state.competitions.some((competition) => competition.id === item.id)) {
      state.competitions = [...state.competitions, joinedCompetition];
    }
    return {
      ...joinedCompetition,
      joinPrompt: buildCompetitionJoinPrompt(joinedCompetition),
    };
  };

  const leaveCompetition = async (id) => {
    await repository.leaveCompetition(state.user.uid, id);
    await refreshCompetitions();
    notify('已離開競賽。');
  };

  return {
    state,
    recordsByDate,
    latestRecord,
    streak,
    notify,
    openBadgeViewer,
    closeBadgeViewer,
    askConfirm,
    resolveConfirm,
    init,
    login,
    logout,
    loadAll,
    saveProfile,
    saveRecord,
    deleteRecord,
    createCompetition,
    updateCompetition,
    joinCompetition,
    leaveCompetition,
  };
});

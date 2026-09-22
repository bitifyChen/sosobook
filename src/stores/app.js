import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import * as repository from '@/services/repository';
import { addDays, calculateStreak, toDateKey } from '@/utils/date';
import { badgeSeries, findNewlyUnlockedBadge } from '@/utils/badges';
import { getViewedCompetitionResultIds } from '@/utils/competitionHistory';
import {
  findNewlySettledCompetitions,
  readCompetitionStatusSnapshot,
  writeCompetitionStatusSnapshot,
} from '@/utils/competitionNotifications';
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
    startupProgress: 8,
    startupLabel: '正在確認登入狀態…',
    competitionsReady: false,
    authError: null,
    user: null,
    profile: null,
    records: [],
    competitions: [],
    toast: null,
    confirm: null,
    checkIn: { open: false, dateKey: null },
    badgeViewerQueue: [],
    competitionCompletionQueue: [],
    mode: repository.repositoryMode,
  });

  let confirmResolver = null;
  let competitionRefreshPromise = null;

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

  const openCheckIn = (dateKey = toDateKey()) => {
    state.checkIn.open = true;
    state.checkIn.dateKey = dateKey || toDateKey();
  };
  const closeCheckIn = () => {
    state.checkIn.open = false;
    state.checkIn.dateKey = null;
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

  const revealNewBadges = (seriesKey, previousCount, currentCount) => {
    const series = badgeSeries.find((item) => item.key === seriesKey);
    if (!series) return;

    let cursor = Math.max(0, Number(previousCount) || 0);
    const current = Math.max(cursor, Number(currentCount) || 0);
    while (cursor < current) {
      const badge = findNewlyUnlockedBadge(seriesKey, cursor, current);
      if (!badge) break;
      openBadgeViewer({
        ...badge,
        seriesLabel: series.label,
        current,
        unlocked: true,
        mode: 'earned',
      });
      cursor = badge.threshold;
    }
  };

  const openCompetitionCompletion = (competition) => {
    state.competitionCompletionQueue.push({
      id: competition.id,
      name: competition.name,
      startDate: competition.startDate,
      endDate: competition.endDate,
    });
  };

  const closeCompetitionCompletion = () => {
    state.competitionCompletionQueue.shift();
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

  const syncCompetitions = (competitions) => {
    const nextCompetitions = Array.isArray(competitions) ? competitions : [];
    const previousCompetitions = new Map(
      state.competitions.map((competition) => [competition.id, competition])
    );
    const previousSnapshot = readCompetitionStatusSnapshot(state.user?.uid);
    const viewedIds = getViewedCompetitionResultIds(state.user?.uid);
    const newlySettled = findNewlySettledCompetitions(
      previousSnapshot,
      nextCompetitions,
      viewedIds
    );
    const currentStats = competitionAchievementStats(nextCompetitions);
    const newlySettledChampions = newlySettled.filter((competition) => {
      if (competition.certificate?.championUids?.includes(state.user?.uid)) return true;
      return competition.certificateParticipants?.some(
        (participant) => participant.uid === state.user?.uid && participant.rank === 1
      );
    }).length;
    const previousStats = previousSnapshot?.totals || {
      completedCompetitionCount: Math.max(
        0,
        currentStats.completedCompetitionCount - newlySettled.length
      ),
      championCount: Math.max(0, currentStats.championCount - newlySettledChampions),
    };

    state.competitions = nextCompetitions;
    writeCompetitionStatusSnapshot(state.user?.uid, nextCompetitions, currentStats);

    const newlyJoinedCompetitionCount = nextCompetitions.filter((competition) => {
      const previous = previousCompetitions.get(competition.id);
      return previous && (competition.members?.length || 0) > (previous.members?.length || 0);
    }).length;
    if (newlyJoinedCompetitionCount) {
      notify(
        newlyJoinedCompetitionCount === 1
          ? '有新成員加入你的競賽！'
          : `${newlyJoinedCompetitionCount} 場競賽有新成員加入！`
      );
    }

    newlySettled.forEach(openCompetitionCompletion);
    revealNewBadges(
      'finish',
      previousStats.completedCompetitionCount,
      currentStats.completedCompetitionCount
    );
    revealNewBadges('champion', previousStats.championCount, currentStats.championCount);
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
      const [profile, records] = await Promise.all([
        loadTask('會員資料', repository.getProfile(state.user.uid)),
        loadTask('體重紀錄', repository.listRecords(state.user.uid)),
      ]);
      state.profile = profile;
      state.records = Array.isArray(records) ? records : [];
      await loadCompetitionData();
    } finally {
      state.busy = false;
    }
  };

  const loadCompetitionData = async () => {
    if (!state.user) return;
    state.competitionsReady = false;
    try {
      const competitionResult = await loadCompetitionsWithFallback();
      if (competitionResult.indexPending) {
        state.competitions = [];
        notifyCompetitionIndexPending();
      } else {
        syncCompetitions(competitionResult.competitions);
      }
      if (!competitionResult.indexPending && state.competitions.length) {
        try {
          await refreshScores();
        } catch (cause) {
          console.error('[SosoBook] 暫算競賽曲線同步失敗。', cause);
        }
      }
    } finally {
      state.competitionsReady = true;
    }
  };

  const syncAuthState = async (user) => {
    state.authReady = false;
    state.user = user;
    state.authError = null;
    state.competitionsReady = false;
    state.startupProgress = user ? 32 : 82;
    state.startupLabel = user ? '正在載入會員資料與手帳…' : '正在準備登入頁面…';

    try {
      if (user) {
        state.busy = true;
        const loadTask = (operation, task) =>
          task.catch((cause) => {
            cause.sosoBookOperation = operation;
            throw cause;
          });
        const [profile, records] = await Promise.all([
          loadTask('會員資料', repository.getProfile(user.uid)),
          loadTask('體重紀錄', repository.listRecords(user.uid)),
        ]);
        state.profile = profile;
        state.records = Array.isArray(records) ? records : [];
        state.startupProgress = 100;
        state.startupLabel = '手帳準備完成';
      } else {
        state.profile = null;
        state.records = [];
        state.competitions = [];
        closeCheckIn();
        state.badgeViewerQueue = [];
        state.competitionCompletionQueue = [];
        state.competitionsReady = true;
        state.startupProgress = 100;
        state.startupLabel = '登入頁面準備完成';
      }
    } catch (cause) {
      state.profile = null;
      state.records = [];
      state.competitions = [];
      state.competitionCompletionQueue = [];
      state.authError = getAuthErrorMessage(cause);
      notify(state.authError, 'error');
      console.error('[SosoBook] Firebase 初始化失敗。', cause);
    } finally {
      state.busy = false;
      state.authReady = true;
    }

    if (user && !state.authError) {
      void loadCompetitionData().catch((cause) => {
        console.error('[SosoBook] 競賽背景同步失敗。', cause);
        notify('手帳已載入，但競賽資料暫時無法同步。', 'warning');
      });
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
    closeCheckIn();
    state.badgeViewerQueue = [];
    state.competitionCompletionQueue = [];
  };

  const saveProfile = async (profile) => {
    state.busy = true;
    try {
      const savedProfile = await repository.saveProfile(state.user.uid, {
        ...profile,
        email: state.user.email,
      });
      state.profile = savedProfile;
      notify('健身卡資料已保存！');

      // 會員卡保存不應被競賽索引或網路狀態拖住；競賽資料在背景更新即可。
      void refreshCompetitions({ notifyOnIndexPending: false }).catch((cause) => {
        console.error('[SosoBook] 會員卡已保存，但競賽列表背景更新失敗。', cause);
      });
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

  const refreshCompetitions = async ({ notifyOnIndexPending = true } = {}) => {
    if (!state.user) return;
    if (competitionRefreshPromise) return competitionRefreshPromise;

    competitionRefreshPromise = (async () => {
      const competitionResult = await loadCompetitionsWithFallback();
      if (competitionResult.indexPending) {
        if (notifyOnIndexPending) notifyCompetitionIndexPending();
        return;
      }
      syncCompetitions(competitionResult.competitions);
    })();

    try {
      return await competitionRefreshPromise;
    } finally {
      competitionRefreshPromise = null;
    }
  };

  const refreshScores = async () => {
    const today = toDateKey();
    const updates = state.competitions.map(async (competition) => {
      if (competition.status === 'settled' || today > competition.endDate) return false;
      const currentMember = competition.members.find((member) => member.uid === state.user.uid);
      const baseline = state.records.find((record) => record.dateKey === competition.startDate);
      const current = pickLatestRecordOnOrBefore(
        state.records,
        today < competition.endDate ? today : competition.endDate
      );
      let payload;
      if (!baseline || !current || current.dateKey < competition.startDate) {
        payload = {
          provisionalLossPct: null,
          provisionalRank: null,
          provisionalAsOf: null,
          percentageCurve: [],
        };
      } else {
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
        payload = {
          provisionalLossPct,
          provisionalRank: own?.rank || null,
          provisionalAsOf: current.dateKey,
          percentageCurve,
        };
      }

      const scoreUnchanged =
        (currentMember?.provisionalLossPct ?? null) === payload.provisionalLossPct &&
        (currentMember?.provisionalRank ?? null) === payload.provisionalRank &&
        (currentMember?.provisionalAsOf ?? null) === payload.provisionalAsOf &&
        JSON.stringify(currentMember?.percentageCurve || []) ===
          JSON.stringify(payload.percentageCurve);
      if (scoreUnchanged) return false;

      await repository.updateProvisionalScore(state.user.uid, competition.id, payload);
      return true;
    });
    const results = await Promise.all(updates);
    if (results.some(Boolean)) await refreshCompetitions();
  };

  const saveRecord = async (record) => {
    const previousRecordCount = state.records.length;
    await repository.saveWeightRecord(state.user.uid, record);
    state.records = await repository.listRecords(state.user.uid);
    await refreshScores();
    revealNewBadges('record', previousRecordCount, state.records.length);
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
    const normalizedCode = code.trim().toUpperCase();
    const existingCompetition = state.competitions.find(
      (competition) =>
        competition.inviteCode === normalizedCode &&
        competition.members?.some((member) => member.uid === state.user?.uid)
    );
    if (existingCompetition) {
      const error = new Error('你已經在這場競賽中，請直接前往競賽查看。');
      error.code = 'ALREADY_JOINED';
      error.competitionId = existingCompetition.id;
      throw error;
    }
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
    closeCompetitionCompletion,
    askConfirm,
    resolveConfirm,
    openCheckIn,
    closeCheckIn,
    init,
    login,
    logout,
    loadAll,
    refreshCompetitions,
    saveProfile,
    saveRecord,
    deleteRecord,
    createCompetition,
    updateCompetition,
    joinCompetition,
    leaveCompetition,
  };
});

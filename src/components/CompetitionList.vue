<script setup>
import { Flag } from 'lucide-vue-next';
import { avatarById } from '@/data/assets';
import {
  getViewedCompetitionResultIds,
  markCompetitionResultViewed,
} from '@/utils/competitionHistory';
import { competitionStatus, rankEntries } from '@/utils/competition';
import { daysBetween, toDateKey } from '@/utils/date';

const props = defineProps({
  history: {
    type: Boolean,
    default: false,
  },
});

const store = useAppStore();
const today = toDateKey();
const viewedIds = ref(new Set(getViewedCompetitionResultIds(store.state.user?.uid)));
const statusText = {
  active: '進行中',
  upcoming: '準備開賽',
  'awaiting-settlement': '等待結算',
  settled: '已完賽',
};
watch(
  () => store.state.user?.uid,
  (uid) => {
    viewedIds.value = new Set(getViewedCompetitionResultIds(uid));
  }
);
const items = computed(() => {
  const allItems = store.state.competitions.map((item) => {
    const lifecycle = competitionStatus(item, today);
    const own = item.members.find((member) => member.uid === store.state.user.uid);
    const eligibleMembers = item.members.filter(
      (member) => member.provisionalLossPct !== null && member.provisionalLossPct !== undefined
    );
    const provisionalRankings = rankEntries(
      eligibleMembers.map((member) => ({
        ...member,
        lossPct: member.provisionalLossPct,
      }))
    );
    const calculatedOwnRank = provisionalRankings.find(
      (member) => member.uid === store.state.user.uid
    )?.rank;
    const settledResult =
      lifecycle === 'settled'
        ? item.certificateParticipants?.find((participant) => participant.uid === own?.uid)
        : null;
    const baselinePending = lifecycle !== 'settled' && own?.provisionalLossPct == null;
    const scoreValue = lifecycle === 'settled' ? settledResult?.lossPct : own?.provisionalLossPct;
    return {
      ...item,
      lifecycle,
      own,
      ownRank: baselinePending ? null : (own?.provisionalRank ?? calculatedOwnRank),
      baselinePending,
      scoreText: scoreValue == null ? '—' : `${Number(scoreValue).toFixed(2)}%`,
      scoreLabel: lifecycle === 'settled' ? '完賽成績' : baselinePending ? '尚未計算' : '目前成績',
      settledResult,
      resultViewed: viewedIds.value.has(item.id),
      daysLeft: Math.max(0, daysBetween(today, item.endDate)),
    };
  });

  const visibleItems = props.history
    ? allItems.filter((item) => item.lifecycle === 'settled')
    : allItems.filter((item) => item.lifecycle !== 'settled' || !item.resultViewed);

  return visibleItems.sort((left, right) => {
    if (props.history) return right.endDate.localeCompare(left.endDate);

    const priority = { settled: 0, active: 1, 'awaiting-settlement': 2, upcoming: 3 };
    return priority[left.lifecycle] - priority[right.lifecycle];
  });
});

const openCompetition = (item) => {
  if (item.lifecycle !== 'settled') return;
  viewedIds.value = new Set(markCompetitionResultViewed(store.state.user?.uid, item.id));
};
</script>

<template>
  <div v-if="items.length" class="competition-list">
    <RouterLink
      v-for="item in items"
      :key="item.id"
      class="paper-card competition-card"
      :to="'/competitions/' + item.id"
      @click="openCompetition(item)"
    >
      <div :class="['card-ribbon', 'card-ribbon--' + item.lifecycle]">
        {{ statusText[item.lifecycle] }}
      </div>
      <div class="competition-title">
        <div class="flag-icon"><Flag fill="currentColor" /></div>
        <div>
          <h2>{{ item.name }}</h2>
          <p>{{ item.startDate }} — {{ item.endDate }}</p>
        </div>
      </div>
      <div class="competition-stats">
        <div>
          <strong
            >#{{
              item.lifecycle === 'settled' ? item.settledResult?.rank || '—' : item.ownRank || '—'
            }}</strong
          ><span>{{
            item.lifecycle === 'settled'
              ? '完賽名次'
              : item.baselinePending
                ? '待補基準'
                : '目前名次'
          }}</span>
        </div>
        <div>
          <strong>{{ item.scoreText }}</strong
          ><span>{{ item.scoreLabel }}</span>
        </div>
        <div>
          <strong>{{ item.lifecycle === 'active' ? item.daysLeft : '—' }}</strong
          ><span>{{ item.lifecycle === 'settled' ? '已完成' : '剩餘天數' }}</span>
        </div>
      </div>
      <div class="competition-card-footer">
        <div class="member-stack">
          <img
            v-for="member in item.members.slice(0, 4)"
            :key="member.uid"
            :src="avatarById(member.avatarId).src"
            :alt="member.nickname"
          /><span>{{ item.members.length }} 人參賽</span>
        </div>
        <span v-if="item.lifecycle === 'settled' && !props.history" class="competition-result-cta"
          >查看結果!</span
        >
      </div>
    </RouterLink>
  </div>
  <div v-else class="paper-card empty-state">
    <h2>{{ props.history ? '還沒有已完賽的歷史紀錄' : '還沒有進行中的比賽' }}</h2>
    <p>
      {{
        props.history ? '競賽封存後就會在這裡留下紀錄。' : '建立一場比賽或向朋友索取加入的邀請碼。'
      }}
    </p>
  </div>
</template>

<script setup>
import { Flag } from 'lucide-vue-next';
import { avatarById } from '@/data/assets';
import {
  calculateFillRate,
  competitionStatus,
  FILL_RATE_THRESHOLD,
  memberCompetitionScore,
  rankEntries,
} from '@/utils/competition';
import { daysBetween, toDateKey } from '@/utils/date';

const props = defineProps({
  history: {
    type: Boolean,
    default: false,
  },
});

const store = useAppStore();
const today = toDateKey();
const statusText = {
  active: '進行中',
  upcoming: '準備開賽',
  'awaiting-settlement': '等待結算',
  settled: '已完賽',
};
const items = computed(() => {
  const allItems = store.state.competitions.map((item) => {
    const lifecycle = competitionStatus(item, today);
    const own = item.members.find((member) => member.uid === store.state.user.uid);
    const curveEndDate = lifecycle === 'settled' || today >= item.endDate ? item.endDate : today;
    const membersWithScore = item.members.map((member) => ({
      ...member,
      lossPct: memberCompetitionScore(member),
      fillRatePercent: calculateFillRate(member, item.startDate, curveEndDate).percent,
    }));
    const provisionalRankings = rankEntries(
      membersWithScore.filter(
        (member) => member.lossPct !== null && member.fillRatePercent >= FILL_RATE_THRESHOLD
      )
    );
    const calculatedOwnRank = provisionalRankings.find(
      (member) => member.uid === store.state.user.uid
    )?.rank;
    const settledResult =
      lifecycle === 'settled'
        ? item.certificateParticipants?.find((participant) => participant.uid === own?.uid)
        : null;
    const ownWithScore = membersWithScore.find((member) => member.uid === own?.uid);
    const ownScore = ownWithScore?.lossPct ?? null;
    const scorePending = lifecycle !== 'settled' && ownScore == null;
    const belowFillRate =
      !scorePending &&
      ownWithScore?.fillRatePercent != null &&
      ownWithScore.fillRatePercent < FILL_RATE_THRESHOLD;
    const scoreValue = lifecycle === 'settled' ? settledResult?.lossPct : ownScore;
    return {
      ...item,
      lifecycle,
      own,
      ownRank: scorePending || belowFillRate ? null : (own?.provisionalRank ?? calculatedOwnRank),
      scorePending,
      belowFillRate,
      scoreText: scoreValue == null ? '—' : `${Number(scoreValue).toFixed(2)}%`,
      scoreLabel:
        lifecycle === 'settled'
          ? '完賽成績'
          : scorePending
            ? '尚無期間資料'
            : belowFillRate
              ? `未達 ${FILL_RATE_THRESHOLD}%`
              : '目前成績',
      settledResult,
      daysLeft: Math.max(0, daysBetween(today, item.endDate)),
    };
  });

  const visibleItems = props.history
    ? allItems.filter((item) => item.lifecycle === 'settled')
    : allItems.filter((item) => item.lifecycle !== 'settled');

  return visibleItems.sort((left, right) => {
    if (props.history) return right.endDate.localeCompare(left.endDate);

    const priority = { settled: 0, active: 1, 'awaiting-settlement': 2, upcoming: 3 };
    return priority[left.lifecycle] - priority[right.lifecycle];
  });
});
</script>

<template>
  <div v-if="!store.state.competitionsReady" class="paper-card competition-loading-state">
    <div class="loader" aria-hidden="true"></div>
    <div>
      <h2>正在同步競賽</h2>
      <p>手帳已經可以使用，競賽資料會在背景補上。</p>
    </div>
  </div>
  <div v-else-if="items.length" class="competition-list">
    <RouterLink
      v-for="item in items"
      :key="item.id"
      class="paper-card competition-card"
      :to="'/competitions/' + item.id"
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
              : item.scorePending
                ? '尚無期間資料'
                : item.belowFillRate
                  ? `未達 ${FILL_RATE_THRESHOLD}%`
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

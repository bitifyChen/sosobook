<script setup>
import { Pencil, Settings } from 'lucide-vue-next';
import { avatarById } from '@/data/assets';
import { badgeSeries, getBadgeProgress, normalizeAchievementStats } from '@/utils/badges';

const store = useAppStore();
const form = reactive({ nickname: '', heightCm: 165, avatarId: 'avatar-1' });
watch(
  () => store.state.profile,
  (profile) => profile && Object.assign(form, profile),
  { immediate: true }
);
const settled = computed(() => store.state.competitions.filter((c) => c.status === 'settled'));
const achievementStats = computed(() => {
  const stored = normalizeAchievementStats(store.state.profile?.achievementStats);
  const userId = store.state.user?.uid;
  const championCount = settled.value.filter((competition) => {
    if (!userId) return false;
    if (competition.certificate?.championUids?.includes(userId)) return true;
    return competition.certificateParticipants?.some(
      (participant) => participant.uid === userId && participant.rank === 1
    );
  }).length;

  return normalizeAchievementStats({
    ...stored,
    weightRecordCount: Math.max(stored.weightRecordCount, store.state.records.length),
    completedCompetitionCount: Math.max(stored.completedCompetitionCount, settled.value.length),
    championCount: Math.max(stored.championCount, championCount),
  });
});
const badgeSeriesProgress = computed(() => {
  const progress = getBadgeProgress(achievementStats.value);
  return badgeSeries.map((series) => {
    const items = progress.filter((badge) => badge.series === series.key);
    return {
      ...series,
      current: achievementStats.value[series.statKey],
      unlocked: items.filter((badge) => badge.unlocked),
      next: items.find((badge) => !badge.unlocked),
      hasBadges: items.length > 0,
    };
  });
});
const openBadge = (series, badge, unlocked) => {
  store.openBadgeViewer({
    ...badge,
    seriesLabel: series.label,
    current: series.current,
    unlocked,
    mode: 'view',
  });
};
</script>

<template>
  <section class="page-section narrow-page">
    <header class="page-header split-header">
      <div>
        <p class="eyebrow">MY CARD</p>
        <h1>我的健身會員卡</h1>
      </div>
      <RouterLink class="round-button card-settings-button" to="/setting" aria-label="開啟設定">
        <Settings />
      </RouterLink>
    </header>
    <article class="player-card">
      <div class="card-hole"></div>
      <RouterLink
        class="round-button icon-link card-edit-button"
        to="/welcome?mode=edit"
        aria-label="修改會員資料"
      >
        <Pencil />
      </RouterLink>
      <p class="member-label">SOSO WELLNESS CLUB · MEMBER</p>
      <div class="player-main">
        <div class="avatar-stage">
          <img :src="avatarById(form.avatarId).src" :alt="form.nickname" />
        </div>
        <div>
          <span>NAME</span>
          <h2>{{ form.nickname }}</h2>
        </div>
      </div>
      <div class="player-numbers">
        <div>
          <strong>{{ store.latestRecord?.weightKg?.toFixed(1) || '—' }}</strong
          ><span>目前 kg</span>
        </div>
        <div>
          <strong>{{ store.streak }}</strong
          ><span>連續天</span>
        </div>
        <div>
          <strong>{{ store.state.competitions.length }}</strong
          ><span>參賽</span>
        </div>
      </div>
      <div class="card-stamp">KEEP<br />GOING!</div>
    </article>
    <section class="badge-series-list" aria-label="成就徽章">
      <article
        v-for="series in badgeSeriesProgress"
        :key="series.key"
        class="paper-card badge-series"
      >
        <header class="badge-series-heading">
          <span class="badge-series-line"></span>
          <h2>{{ series.label }}徽章</h2>
          <span class="badge-series-line"></span>
          <small>已完成 {{ series.current }} 次</small>
        </header>
        <div v-if="series.hasBadges" class="badge-track">
          <button
            v-for="badge in series.unlocked"
            :key="badge.id"
            class="badge-item unlocked"
            type="button"
            @click="openBadge(series, badge, true)"
          >
            <div class="badge-image-wrap">
              <img :src="badge.src" :alt="badge.alt" />
            </div>
            <span>{{ badge.threshold }}</span>
          </button>
          <button
            v-if="series.next"
            class="badge-item next-badge"
            type="button"
            @click="openBadge(series, series.next, false)"
          >
            <div class="badge-image-wrap">
              <img :src="series.next.src" :alt="`${series.next.alt}，尚未解鎖`" />
              <strong aria-hidden="true">?</strong>
            </div>
            <span>{{ series.next.threshold }}</span>
          </button>
        </div>
        <p v-else class="badge-empty">這個系列的徽章準備中</p>
      </article>
    </section>
  </section>
</template>

<route lang="json">
{
  "name": "card",
  "path": "/card"
}
</route>

<script setup>
import {
  ArrowLeft,
  Clock3,
  Copy,
  Crown,
  Eye,
  EyeOff,
  LogOut,
  Pencil,
  Trophy,
} from 'lucide-vue-next';
import { avatarById } from '@/data/assets';
import { markCompetitionResultViewed } from '@/utils/competitionHistory';
import {
  buildDailyCarryForwardCurve,
  calculateFillRate,
  competitionStatus,
  FILL_RATE_THRESHOLD,
  memberCompetitionScore,
  rankEntries,
} from '@/utils/competition';
import { daysBetween, formatDate, toDateKey } from '@/utils/date';
import FillRateHelpDialog from '@/components/FillRateHelpDialog.vue';

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const item = computed(() => store.state.competitions.find((c) => c.id === route.params.id));
const isEditRoute = computed(() => route.name === 'competition-edit');
const isOwner = computed(() => item.value?.createdBy === store.state.user?.uid);
const lifecycle = computed(() =>
  item.value ? competitionStatus(item.value, toDateKey()) : 'active'
);
const isSettled = computed(() => lifecycle.value === 'settled');
const showCompetitionCurve = computed(() => lifecycle.value !== 'upcoming');
const competitionCurveEndDate = computed(() => {
  if (!item.value) return null;
  const today = toDateKey();
  return isSettled.value
    ? item.value.endDate
    : today < item.value.endDate
      ? today
      : item.value.endDate;
});
watch(
  [isSettled, item],
  ([settled, competition]) => {
    if (settled && competition) {
      markCompetitionResultViewed(store.state.user?.uid, competition.id);
    }
  },
  { immediate: true }
);
const chartMode = ref('everyone');
const showPrivateWeights = ref(true);
const showFillRateHelp = ref(false);
const rankings = computed(() => {
  if (isSettled.value && item.value?.certificateParticipants?.length) {
    return [...item.value.certificateParticipants]
      .map((member) => ({
        ...member,
        fillRatePercent: member.fillRatePercent ?? fillRateFor(member).percent,
      }))
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  }
  const members = item.value?.members || [];
  const membersWithScore = members.map((member) => ({
    ...member,
    lossPct: memberCompetitionScore(member),
    fillRatePercent: calculateFillRate(member, item.value?.startDate, competitionCurveEndDate.value)
      .percent,
  }));
  const eligible = rankEntries(
    membersWithScore.filter(
      (member) => member.lossPct !== null && member.fillRatePercent >= FILL_RATE_THRESHOLD
    )
  );
  const unranked = membersWithScore
    .filter((member) => member.lossPct == null || member.fillRatePercent < FILL_RATE_THRESHOLD)
    .map((member) => ({
      ...member,
      rank: null,
    }));
  return [...eligible, ...unranked];
});
const own = computed(() => rankings.value.find((m) => m.uid === store.state.user?.uid));
const scorePending = computed(() => !isSettled.value && own.value?.lossPct == null);
const ownBelowFillRate = computed(() => isBelowFillRate(own.value));
const left = computed(() =>
  Math.max(0, daysBetween(toDateKey(), item.value?.endDate || toDateKey()))
);
const weightDelta = computed(() => {
  const curve = item.value?.privateCurve || [];
  if (curve.length < 2) return null;
  return Number((curve[curve.length - 1].weightKg - curve[0].weightKg).toFixed(2));
});
const formatSigned = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
const formatLoss = (value) => (value == null ? '—' : `${Number(value).toFixed(2)}%`);
const fillRateFor = (member) =>
  calculateFillRate(member, item.value?.startDate, competitionCurveEndDate.value);
const isBelowFillRate = (member) =>
  member?.fillRatePercent != null && member.fillRatePercent < FILL_RATE_THRESHOLD;
const formatFillRatePercent = (member) => {
  const { percent } = fillRateFor(member);
  return percent == null ? '—' : `${percent}%`;
};
const formatFillRateDays = (member) => {
  const { filledDays, expectedDays } = fillRateFor(member);
  return expectedDays ? `${filledDays}/${expectedDays}天` : '—';
};
const chartColors = ['#2777c8', '#e27664', '#e1a82e', '#4d9b70', '#8d6bb8', '#d16b9b'];
const desaturateColor = (hex, factor = 0.36) => {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  return `hsl(${Math.round(hue)} ${Math.round(saturation * factor * 100)}% ${Math.round(
    lightness * 100
  )}%)`;
};
const buildSmoothSegmentPath = (points, index) => {
  const point = points[index];
  const next = points[index + 1];
  const previous = points[index - 1] || point;
  const afterNext = points[index + 2] || next;
  const controlOne = {
    x: point.x + (next.x - previous.x) / 6,
    y: point.y + (next.y - previous.y) / 6,
  };
  const controlTwo = {
    x: next.x - (afterNext.x - point.x) / 6,
    y: next.y - (afterNext.y - point.y) / 6,
  };

  return `M ${point.x} ${point.y} C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${next.x} ${next.y}`;
};
const personalCurve = computed(() => {
  if (!item.value) return [];
  if (isSettled.value) {
    return buildDailyCarryForwardCurve(
      item.value.privateCurve || [],
      item.value.startDate,
      competitionCurveEndDate.value,
      (record) => ({ weightKg: Number(record.weightKg) }),
      { fillBeforeFirst: true }
    );
  }

  if (competitionCurveEndDate.value < item.value.startDate) return [];

  return buildDailyCarryForwardCurve(
    store.state.records,
    item.value.startDate,
    competitionCurveEndDate.value,
    (record) => ({ weightKg: Number(record.weightKg) }),
    { fillBeforeFirst: true }
  );
});
const chartSeries = computed(() => {
  if (!showCompetitionCurve.value) return [];
  if (chartMode.value === 'personal') {
    const curve = personalCurve.value
      .map((point) => ({ ...point, value: Number(point.weightKg) }))
      .filter((point) => Number.isFinite(point.value));
    return curve.length
      ? [{ uid: store.state.user?.uid, label: '我的實際體重', curve, kind: 'weight' }]
      : [];
  }
  return rankings.value
    .map((member) => {
      const rawCurve = (member.percentageCurve || [])
        .map((point) => ({ ...point, value: Number(point.value) }))
        .filter((point) => Number.isFinite(point.value));
      const isObservedCurve = rawCurve[0]?.dateKey !== item.value.startDate;
      return {
        uid: member.uid,
        label: member.nickname,
        isObservedCurve,
        curve: buildDailyCarryForwardCurve(
          rawCurve,
          item.value.startDate,
          competitionCurveEndDate.value,
          (point) => ({ value: point.value }),
          { fillBeforeFirst: true }
        ),
        kind: 'percentage',
      };
    })
    .filter((series) => series.curve.length);
});
const curveEmptyMessage = computed(() => {
  if (chartMode.value === 'personal') {
    return '競賽期間尚未有體重紀錄，暫時無法繪製個人曲線。';
  }
  if (!rankings.value.some((member) => member.lossPct != null)) {
    return '參賽者尚未有競賽期間體重資料，暫時沒有可顯示的曲線。';
  }
  return '曲線資料會在成員完成打卡後同步，目前還沒有可顯示的資料。';
});
const chart = computed(() => {
  const sources = chartSeries.value;
  const dateKeys = [
    ...new Set(sources.flatMap((series) => series.curve.map((point) => point.dateKey))),
  ].sort();
  const values = sources.flatMap((series) => series.curve.map((point) => point.value));
  if (!sources.length || !dateKeys.length || !values.length) return { series: [] };

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = (rawMax - rawMin || 1) * 0.15;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const left = 32;
  const right = 322;
  const top = 18;
  const bottom = 128;
  const xFor = (dateKey) =>
    left + (dateKeys.indexOf(dateKey) / Math.max(1, dateKeys.length - 1)) * (right - left);
  const yFor = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const series = sources.map((source, index) => {
    const points = source.curve.map((point) => ({
      ...point,
      x: xFor(point.dateKey),
      y: yFor(point.value),
    }));
    const color = chartColors[index % chartColors.length];
    return {
      ...source,
      color,
      mutedColor: desaturateColor(color),
      points,
      segments: points.slice(0, -1).map((point, segmentIndex) => ({
        path: buildSmoothSegmentPath(points, segmentIndex),
        isCarriedForward: Boolean(
          point.isCarriedForward || points[segmentIndex + 1].isCarriedForward
        ),
      })),
    };
  });
  const unit = chartMode.value === 'personal' ? 'kg' : '%';
  const precision = unit === 'kg' ? 2 : 1;
  const label = (dateKey) => dateKey.slice(5).replace('-', '/');
  return {
    series,
    hasObservedCurve: series.some((item) => item.isObservedCurve),
    unit,
    maxLabel: `${rawMax.toFixed(precision)} ${unit}`,
    minLabel: `${rawMin.toFixed(precision)} ${unit}`,
    startLabel: label(dateKeys[0]),
    endLabel: label(dateKeys[dateKeys.length - 1]),
  };
});
const copyCode = async () => {
  await navigator.clipboard?.writeText(item.value.inviteCode);
  store.notify('邀請碼已複製！');
};
const leave = async () => {
  const confirmed = await store.askConfirm({
    tone: 'warning',
    title: '要離開這場競賽嗎？',
    message: '離開後會從這場競賽的暫定排行榜移除，開始後就不能再自行退出。',
    confirmText: '確認離開',
    cancelText: '先留下來',
  });
  if (!confirmed) return;
  await store.leaveCompetition(item.value.id);
  router.replace('/competitions');
};
</script>

<template>
  <section v-if="!store.state.competitionsReady && !isEditRoute" class="page-section">
    <div class="paper-card competition-loading-state">
      <div class="loader" aria-hidden="true"></div>
      <div>
        <h1>正在同步競賽</h1>
        <p>手帳已經開啟，這場競賽的資料正在背景載入。</p>
      </div>
    </div>
  </section>
  <section v-else-if="item && !isEditRoute" class="page-section">
    <header class="page-header competition-detail-header">
      <div>
        <button class="back-button" @click="router.back()"><ArrowLeft />返回</button>
        <p class="eyebrow">PARTY NOTE</p>
        <h1>{{ item.name }}</h1>
        <p>
          {{ formatDate(item.startDate, { year: true }) }} —
          {{ formatDate(item.endDate) }}
        </p>
      </div>
      <RouterLink
        v-if="isOwner && !isSettled"
        class="round-button competition-edit-button"
        :to="`/competitions/${item.id}/edit`"
        aria-label="編輯競賽"
      >
        <Pencil :size="19" />
      </RouterLink>
    </header>

    <div class="race-hero paper-card">
      <div v-if="isSettled" class="trophy-seal">
        <Trophy />
        <span>名次</span>
        <strong>#{{ own?.rank || '—' }}</strong>
      </div>
      <div v-else class="countdown">
        <Clock3 />
        <div class="countdown-copy">
          <div class="countdown-value">
            <strong>{{ left }}</strong
            ><b>天</b>
          </div>
          <span>距離結算</span>
        </div>
      </div>
      <div :class="['personal-fill-rate', { 'fill-rate-warning': isBelowFillRate(own) }]">
        <span class="personal-fill-rate-label">
          填寫率
          <button
            class="fill-rate-help-button"
            type="button"
            aria-label="查看填寫率說明"
            @click="showFillRateHelp = true"
          >
            ?
          </button>
        </span>
        <strong>{{ formatFillRatePercent(own) }}</strong>
        <small>{{ formatFillRateDays(own) }}</small>
      </div>
      <div class="personal-score">
        <span>{{ isSettled ? '我的最終成績' : '我的目前成績' }}</span
        ><strong>{{ formatLoss(own?.lossPct) }}</strong
        ><small>{{
          ownBelowFillRate
            ? `未達 ${FILL_RATE_THRESHOLD}% 填寫率`
            : isSettled
              ? '正式結算'
              : scorePending
                ? '尚無競賽期間資料'
                : `暫定第 ${own?.rank || '—'} 名`
        }}</small>
      </div>
      <div v-if="isSettled" class="settled-result-ticket">
        <div>
          <span>我的體重差異</span>
          <strong>{{
            showPrivateWeights && weightDelta !== null
              ? `${formatSigned(weightDelta)} kg`
              : '**** kg'
          }}</strong>
        </div>
        <button
          class="weight-visibility-toggle"
          type="button"
          :aria-label="showPrivateWeights ? '隱藏體重差異' : '顯示體重差異'"
          @click="showPrivateWeights = !showPrivateWeights"
        >
          <EyeOff v-if="showPrivateWeights" :size="20" />
          <Eye v-else :size="20" />
        </button>
      </div>
      <button v-else class="invite-ticket" @click="copyCode">
        <span>邀請碼</span><strong>{{ item.inviteCode }}</strong
        ><Copy :size="18" />
      </button>
    </div>

    <div class="section-title">
      <div>
        <p class="eyebrow">LEADERBOARD</p>
        <h2>活力排行榜</h2>
      </div>
    </div>
    <div class="paper-card leaderboard">
      <div
        v-for="member in rankings"
        :key="member.uid"
        :class="[
          'rank-row',
          {
            me: member.uid === store.state.user.uid,
            'below-fill-rate': isBelowFillRate(member),
          },
        ]"
      >
        <div class="rank-number">
          <Crown v-if="member.rank === 1" fill="currentColor" /><span v-else>{{
            member.rank || '—'
          }}</span>
        </div>
        <img :src="avatarById(member.avatarId).src" :alt="member.nickname" />
        <div class="rank-name">
          <strong class="name">
            {{ member.nickname
            }}<span class="label" v-if="member.uid === store.state.user.uid">YOU</span>
          </strong>
          <small :class="['rank-fill-rate', { warning: isBelowFillRate(member) }]">
            填寫率 {{ formatFillRatePercent(member) }}（{{ formatFillRateDays(member) }}）
          </small>
        </div>
        <b>{{ formatLoss(member.lossPct) }}</b>
      </div>
    </div>

    <section v-if="showCompetitionCurve" class="curve-section">
      <div class="section-title curve-heading">
        <div>
          <p class="eyebrow">RACE CURVE</p>
          <h2>比賽期間曲線</h2>
        </div>
        <div class="curve-switcher" role="tablist" aria-label="曲線顯示範圍">
          <button
            :class="{ active: chartMode === 'everyone' }"
            role="tab"
            :aria-selected="chartMode === 'everyone'"
            @click="chartMode = 'everyone'"
          >
            大家
          </button>
          <button
            :class="{ active: chartMode === 'personal' }"
            role="tab"
            :aria-selected="chartMode === 'personal'"
            @click="chartMode = 'personal'"
          >
            個人
          </button>
        </div>
      </div>
      <div class="paper-card curve-card">
        <template v-if="chart.series.length">
          <div class="curve-chart-meta">
            <span>{{
              chartMode === 'personal'
                ? '實際體重 kg'
                : chart.hasObservedCurve
                  ? '相對變化 %'
                  : '減重百分比 %'
            }}</span>
            <span>{{ chart.maxLabel }} ／ {{ chart.minLabel }}</span>
          </div>
          <svg class="curve-chart" viewBox="0 0 340 150" role="img" aria-label="比賽期間曲線圖">
            <line v-for="y in [35, 80, 125]" :key="y" x1="32" x2="322" :y1="y" :y2="y" />
            <template v-for="series in chart.series" :key="series.uid">
              <path
                v-for="(segment, segmentIndex) in series.segments"
                :key="`${series.uid}-segment-${segmentIndex}`"
                :class="{ 'curve-segment-dashed': segment.isCarriedForward }"
                :d="segment.path"
                :stroke="segment.isCarriedForward ? series.mutedColor : series.color"
              />
            </template>
            <template v-for="series in chart.series" :key="`${series.uid}-points`">
              <circle
                v-for="point in series.points"
                :key="`${series.uid}-${point.dateKey}`"
                :cx="point.x"
                :cy="point.y"
                r="4"
                :fill="point.isCarriedForward ? series.mutedColor : series.color"
              />
            </template>
          </svg>
          <div class="curve-axis-labels">
            <span>{{ chart.startLabel }}</span
            ><span>{{ chart.endLabel }}</span>
          </div>
          <div class="curve-legend">
            <span v-for="series in chart.series" :key="series.uid">
              <i :style="{ backgroundColor: series.color }"></i>{{ series.label }}
            </span>
          </div>
          <p class="curve-note">
            虛線代表該日沒有實際填寫，圖表僅沿用鄰近紀錄補值；補值不計入填寫率。
          </p>
        </template>
        <div v-else class="curve-empty">
          <Trophy :size="28" />
          <p>{{ curveEmptyMessage }}</p>
        </div>
      </div>
    </section>

    <p class="privacy-note">
      大家模式只顯示百分比，不會顯示他人的實際體重；個人模式才會顯示你的實際體重。
    </p>
    <button
      v-if="item.createdBy !== store.state.user.uid && !isSettled"
      class="text-button danger"
      @click="leave"
    >
      <LogOut />離開這場競賽
    </button>
  </section>
  <section v-else-if="!isEditRoute" class="page-section">
    <div class="paper-card empty-state">
      <h1>找不到這場競賽</h1>
      <RouterLink to="/competitions">回競賽列表</RouterLink>
    </div>
  </section>
  <RouterView v-if="isEditRoute" />
  <FillRateHelpDialog :open="showFillRateHelp" @close="showFillRateHelp = false" />
</template>

<route lang="json">
{
  "name": "competition-detail",
  "path": "/competitions/:id"
}
</route>

<script setup>
import { ChevronLeft, ChevronRight, Flame, Pencil } from 'lucide-vue-next';
import { addDays, buildMonthCells, formatDate, monthLabel, toDateKey } from '@/utils/date';
import { stickerById } from '@/data/assets';

const store = useAppStore();
const today = toDateKey();
const now = new Date();
const shown = ref(new Date(now.getFullYear(), now.getMonth(), 1));
const selectedKey = ref(today);
const cells = computed(() => buildMonthCells(shown.value.getFullYear(), shown.value.getMonth()));
const recordList = computed(() => (Array.isArray(store.state.records) ? store.state.records : []));
const selected = computed(() => {
  const recordsByDate = store.recordsByDate || {};
  return recordsByDate[selectedKey.value];
});
const selectedIsFuture = computed(() => selectedKey.value > today);
const selectedIsBackfill = computed(() => selected.value?.source === 'backfill');
const bmiForWeight = (weightKg) => {
  const heightCm = Number(store.state.profile?.heightCm);
  if (!heightCm || !Number.isFinite(Number(weightKg))) return null;
  return Number((Number(weightKg) / (heightCm / 100) ** 2).toFixed(1));
};
const bmi = computed(() => {
  return selected.value ? bmiForWeight(selected.value.weightKg) : null;
});
const previous = computed(
  () =>
    [...recordList.value]
      .filter((r) => r.dateKey < selectedKey.value)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0]
);
const delta = computed(() =>
  selected.value && previous.value
    ? Number((selected.value.weightKg - previous.value.weightKg).toFixed(1))
    : null
);
const trendRecords = computed(() => {
  const firstDate = addDays(today, -89);
  return [...recordList.value]
    .filter((record) => record.dateKey >= firstDate && record.dateKey <= today)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
});
const sampleTrendPoints = (points = [], maxPoints = 31) => {
  if (points.length <= maxPoints) return points;
  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * (points.length - 1));
    return points[sourceIndex];
  });
};
const buildBezierPath = (points = []) => {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const tension = 0.18;
  return points.slice(0, -1).reduce((path, current, index) => {
    const next = points[index + 1];
    const previous = points[index - 1] ?? current;
    const after = points[index + 2] ?? next;
    const control1 = {
      x: current.x + (next.x - previous.x) * tension,
      y: current.y + (next.y - previous.y) * tension,
    };
    const control2 = {
      x: next.x - (after.x - current.x) * tension,
      y: next.y - (after.y - current.y) * tension,
    };
    const minY = Math.min(current.y, next.y);
    const maxY = Math.max(current.y, next.y);
    control1.y = Math.min(maxY, Math.max(minY, control1.y));
    control2.y = Math.min(maxY, Math.max(minY, control2.y));

    return `${path} C ${control1.x.toFixed(2)} ${control1.y.toFixed(2)} ${control2.x.toFixed(2)} ${control2.y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }, `M ${points[0].x} ${points[0].y}`);
};
const buildTrendChart = (points = []) => {
  const safePoints = Array.isArray(points)
    ? points.filter((point) => Number.isFinite(Number(point?.value)))
    : [];
  if (!safePoints.length) return { points: [] };
  const values = safePoints.map((point) => point.value);
  const visiblePoints = sampleTrendPoints(safePoints);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = (rawMax - rawMin || 1) * 0.18;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const left = 10;
  const right = 330;
  const top = 12;
  const bottom = 74;
  const xFor = (index) => left + (index / Math.max(1, visiblePoints.length - 1)) * (right - left);
  const yFor = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const plottedPoints = visiblePoints.map((point, index) => ({
    ...point,
    x: xFor(index),
    y: yFor(point.value),
  }));
  return {
    points: plottedPoints,
    path: buildBezierPath(plottedPoints),
    latestValue: values[values.length - 1],
    minLabel: rawMin.toFixed(1),
    maxLabel: rawMax.toFixed(1),
    startLabel: safePoints[0].dateKey.slice(5).replace('-', '/'),
    endLabel: safePoints[safePoints.length - 1].dateKey.slice(5).replace('-', '/'),
  };
};
const weightTrend = computed(() =>
  buildTrendChart(
    trendRecords.value.map((record) => ({ dateKey: record.dateKey, value: record.weightKg }))
  )
);
const bmiTrend = computed(() =>
  buildTrendChart(
    trendRecords.value
      .map((record) => ({ dateKey: record.dateKey, value: bmiForWeight(record.weightKg) }))
      .filter((point) => point.value !== null)
  )
);
const calendarTapWindow = 320;
const calendarTapMoveTolerance = 12;
const lastCalendarTap = ref(null);
const calendarPointerStart = ref(null);
const openCheckIn = (dateKey) => {
  if (dateKey > today) return;
  store.openCheckIn(dateKey);
};
const handleCalendarDoubleClick = (dateKey) => {
  selectedKey.value = dateKey;
  openCheckIn(dateKey);
};
const handleCalendarPointerDown = (event, dateKey) => {
  if (event.pointerType === 'mouse') return;
  calendarPointerStart.value = {
    dateKey,
    x: event.clientX,
    y: event.clientY,
  };
};
const handleCalendarPointerUp = (event, dateKey) => {
  if (event.pointerType === 'mouse') return;

  const start = calendarPointerStart.value;
  calendarPointerStart.value = null;
  if (!start || start.dateKey !== dateKey) {
    lastCalendarTap.value = null;
    return;
  }

  const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
  if (moved > calendarTapMoveTolerance) {
    lastCalendarTap.value = null;
    return;
  }

  const now = Date.now();
  const isDoubleTap =
    lastCalendarTap.value?.dateKey === dateKey &&
    now - lastCalendarTap.value.timestamp <= calendarTapWindow;
  lastCalendarTap.value = isDoubleTap ? null : { dateKey, timestamp: now };

  if (isDoubleTap) {
    event.preventDefault();
    handleCalendarDoubleClick(dateKey);
  }
};
const handleCalendarPointerCancel = () => {
  calendarPointerStart.value = null;
  lastCalendarTap.value = null;
};
const moveMonth = (amount) => {
  shown.value = new Date(shown.value.getFullYear(), shown.value.getMonth() + amount, 1);
};
const touchStartX = ref(null);
const handleTouchStart = (event) => {
  touchStartX.value = event.changedTouches[0]?.clientX ?? null;
};
const handleTouchEnd = (event) => {
  if (touchStartX.value === null) return;
  const endX = event.changedTouches[0]?.clientX;
  if (endX === undefined) return;
  const distance = endX - touchStartX.value;
  if (Math.abs(distance) >= 48) moveMonth(distance < 0 ? 1 : -1);
  touchStartX.value = null;
};
</script>

<template>
  <section class="page-section">
    <header class="page-header calendar-heading">
      <div>
        <p class="eyebrow">MY WELLNESS JOURNAL</p>
        <h1>{{ store.state.profile?.nickname }}的手帳</h1>
      </div>
      <div class="calendar-heading-actions">
        <div class="streak-badge" aria-label="連續打卡天數">
          <span class="streak-icon"><Flame :size="18" fill="currentColor" /></span>
          <div>
            <strong>{{ store.streak }}</strong
            ><span>天連續打卡</span>
          </div>
        </div>
      </div>
    </header>

    <div
      class="paper-card calendar-card"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
    >
      <button
        v-if="!selectedIsFuture"
        class="round-button calendar-checkin-button"
        type="button"
        aria-label="編輯所選日期的打卡"
        @click="openCheckIn(selectedKey)"
      >
        <Pencil :size="19" />
      </button>
      <div class="month-switcher">
        <button aria-label="上個月" @click="moveMonth(-1)"><ChevronLeft /></button>
        <h2>{{ monthLabel(shown.getFullYear(), shown.getMonth()) }}</h2>
        <button aria-label="下個月" @click="moveMonth(1)"><ChevronRight /></button>
      </div>
      <div class="week-row">
        <span v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day">{{ day }}</span>
      </div>
      <div class="calendar-grid">
        <button
          v-for="cell in cells"
          :key="cell.key"
          :class="[
            'calendar-day',
            {
              muted: !cell.currentMonth,
              today: cell.key === today,
              selected: cell.key === selectedKey,
            },
          ]"
          :aria-label="`${cell.key}${store.recordsByDate[cell.key] ? ` ${store.recordsByDate[cell.key].weightKg.toFixed(1)} kg` : ''}${cell.key <= today ? '，雙擊編輯' : ''}`"
          @click="selectedKey = cell.key"
          @dblclick.stop.prevent="handleCalendarDoubleClick(cell.key)"
          @pointerdown="handleCalendarPointerDown($event, cell.key)"
          @pointerup="handleCalendarPointerUp($event, cell.key)"
          @pointercancel="handleCalendarPointerCancel"
        >
          <span class="calendar-day-number">{{ cell.day }}</span>
          <small
            v-if="store.recordsByDate[cell.key]"
            :class="[
              'calendar-day-weight',
              { backfill: store.recordsByDate[cell.key].source === 'backfill' },
            ]"
            >{{ store.recordsByDate[cell.key].weightKg.toFixed(1) }}</small
          >
          <img
            v-if="store.recordsByDate[cell.key]?.stickerId"
            :src="stickerById(store.recordsByDate[cell.key].stickerId).src"
            alt="已打卡"
          />
        </button>
      </div>
    </div>

    <article class="paper-card day-detail">
      <span v-if="selectedIsBackfill" class="backfill-tag">補登</span>
      <div>
        <p class="eyebrow">{{ formatDate(selectedKey, { weekday: true }) }}</p>
        <template v-if="selected">
          <div class="day-detail-metrics">
            <div class="day-detail-metric weight-metric">
              <span class="metric-label">體重</span>
              <h2 class="metric-value">{{ selected.weightKg.toFixed(1) }} <small>kg</small></h2>
            </div>
            <div class="day-detail-metric bmi-metric">
              <span class="metric-label">BMI</span>
              <strong class="metric-value">{{ bmi === null ? '--' : bmi }}</strong>
            </div>
            <p :class="['change', { good: delta !== null && delta < 0 }]">
              與上一筆
              <strong>{{
                delta === null ? '--' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`
              }}</strong>
            </p>
          </div>
        </template>
        <template v-else-if="selectedIsFuture"
          ><h2 class="empty-title">這天還沒到來</h2>
          <p>好好運動，時間到再來記錄狀態。</p></template
        >
        <template v-else
          ><h2 class="empty-title">這天還是空白頁</h2>
          <p>補上一張貼紙，留下今天的狀態。</p></template
        >
      </div>
      <img
        v-if="selected?.stickerId"
        class="detail-sticker"
        :src="stickerById(selected.stickerId).src"
        :alt="stickerById(selected.stickerId).alt"
      />
      <button
        v-if="selected || selectedKey <= today"
        class="round-button icon-link"
        type="button"
        aria-label="編輯這天的打卡"
        @click="openCheckIn(selectedKey)"
      >
        <Pencil :size="17" />
      </button>
    </article>
    <section class="body-trend-section">
      <div class="section-title">
        <div>
          <p class="eyebrow">MY BODY TREND</p>
          <h2>我的體重曲線</h2>
        </div>
        <span>近 3 個月・{{ trendRecords.length }} 筆紀錄</span>
      </div>
      <div class="paper-card body-trend-card">
        <div class="trend-row">
          <div class="trend-row-header">
            <div><strong>體重</strong><small>kg</small></div>
            <strong v-if="weightTrend.points.length" class="trend-current"
              >{{ weightTrend.latestValue.toFixed(1) }} kg</strong
            >
          </div>
          <template v-if="weightTrend.points.length">
            <svg class="trend-chart" viewBox="0 0 340 86" role="img" aria-label="體重曲線圖">
              <line v-for="y in [16, 45, 74]" :key="y" x1="10" x2="330" :y1="y" :y2="y" />
              <path :d="weightTrend.path" />
              <circle
                v-for="point in weightTrend.points"
                :key="point.dateKey"
                :cx="point.x"
                :cy="point.y"
                r="3.5"
              />
            </svg>
            <div class="trend-axis-labels">
              <span>{{ weightTrend.startLabel }}</span
              ><span>{{ weightTrend.minLabel }}–{{ weightTrend.maxLabel }} kg</span
              ><span>{{ weightTrend.endLabel }}</span>
            </div>
          </template>
          <p v-else class="trend-empty">完成第一次打卡後，就會留下體重曲線。</p>
        </div>

        <div class="trend-divider"></div>

        <div class="trend-row">
          <div class="trend-row-header">
            <div><strong>BMI</strong><small>身高計算</small></div>
            <strong v-if="bmiTrend.points.length" class="trend-current">{{
              bmiTrend.latestValue.toFixed(1)
            }}</strong>
          </div>
          <template v-if="bmiTrend.points.length">
            <svg
              class="trend-chart trend-chart--bmi"
              viewBox="0 0 340 86"
              role="img"
              aria-label="BMI 曲線圖"
            >
              <line v-for="y in [16, 45, 74]" :key="y" x1="10" x2="330" :y1="y" :y2="y" />
              <path :d="bmiTrend.path" />
              <circle
                v-for="point in bmiTrend.points"
                :key="point.dateKey"
                :cx="point.x"
                :cy="point.y"
                r="3.5"
              />
            </svg>
            <div class="trend-axis-labels">
              <span>{{ bmiTrend.startLabel }}</span
              ><span>{{ bmiTrend.minLabel }}–{{ bmiTrend.maxLabel }}</span
              ><span>{{ bmiTrend.endLabel }}</span>
            </div>
          </template>
          <p v-else class="trend-empty">填寫會員卡身高後，就能看到 BMI 曲線。</p>
        </div>
      </div>
    </section>
  </section>
</template>

<route lang="json">
{
  "name": "calendar",
  "path": "/"
}
</route>

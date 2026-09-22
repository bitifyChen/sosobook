<script setup>
import { navAssets } from '@/data/assets';
import { toDateKey } from '@/utils/date';

const store = useAppStore();
const FIRST_VISIT_TOOLTIP_KEY = 'sosobook.checkin-tooltip-seen.v1';
const button = ref(null);
const visible = ref(true);
const showFirstVisitTooltip = ref(false);
const dragging = ref(false);
const dragged = ref(false);
const position = reactive({ left: null, top: null });
let dragState = null;

const missingToday = computed(() => !store.recordsByDate[toDateKey()]);
const showFab = computed(() => visible.value && missingToday.value && !store.state.checkIn.open);
const firstVisitTooltipKey = computed(() => {
  const uid = store.state.user?.uid;
  return uid ? `${FIRST_VISIT_TOOLTIP_KEY}:${uid}` : null;
});
const fabStyle = computed(() => {
  if (position.left === null) return undefined;
  return {
    left: `${position.left}px`,
    top: `${position.top}px`,
    right: 'auto',
    bottom: 'auto',
  };
});
onMounted(() => {
  const key = firstVisitTooltipKey.value;
  if (!key) return;
  try {
    if (!localStorage.getItem(key)) {
      showFirstVisitTooltip.value = true;
      localStorage.setItem(key, 'true');
    }
  } catch {
    showFirstVisitTooltip.value = true;
  }
});
const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
const open = () => {
  if (dragged.value) {
    dragged.value = false;
    return;
  }
  store.openCheckIn(toDateKey());
};
const close = () => {
  visible.value = false;
};
const beginDrag = (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const rect = button.value?.getBoundingClientRect();
  if (!rect) return;
  dragged.value = false;
  position.left = rect.left;
  position.top = rect.top;
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };
  dragging.value = true;
  event.currentTarget.setPointerCapture?.(event.pointerId);
};
const moveDrag = (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
  if (distance > 6) dragged.value = true;
  if (!dragged.value) return;
  position.left = clamp(
    event.clientX - dragState.offsetX,
    10,
    window.innerWidth - dragState.width - 10
  );
  position.top = clamp(
    event.clientY - dragState.offsetY,
    10,
    window.innerHeight - dragState.height - 92
  );
};
const finishDrag = (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  if (dragged.value) {
    position.left = Math.max(10, window.innerWidth - dragState.width - 16);
    position.top = clamp(position.top, 10, window.innerHeight - dragState.height - 92);
  }
  dragState = null;
  dragging.value = false;
};
</script>

<template>
  <div
    v-if="showFab"
    :class="['checkin-fab-wrap', { 'checkin-fab-wrap--dragging': dragging }]"
    :style="fabStyle"
  >
    <div v-if="showFirstVisitTooltip" class="checkin-fab-note" role="status">
      今天還沒記錄喔～來打卡吧！
    </div>
    <button
      ref="button"
      :class="[
        'checkin-fab',
        { 'checkin-fab--missing': missingToday, 'checkin-fab--dragging': dragging },
      ]"
      type="button"
      aria-label="開啟今日打卡，按住可拖曳"
      @click="open"
      @pointerdown.stop="beginDrag"
      @pointermove.stop="moveDrag"
      @pointerup.stop="finishDrag"
      @pointercancel.stop="finishDrag"
    >
      <img :src="navAssets.checkIn" alt="" />
      <span>打卡</span>
    </button>
    <button
      class="checkin-fab-close"
      type="button"
      aria-label="關閉浮動打卡按鈕"
      @click.stop="close"
    >
      <span aria-hidden="true">×</span>
    </button>
  </div>
</template>

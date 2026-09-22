<script setup>
import { Scale, Trash2, X } from 'lucide-vue-next';
import { stickerCategories, stickers } from '@/data/assets';
import { readRecentStickerIds, rememberStickerSelection } from '@/utils/recentStickers';
import { canBackfillDate, formatDate, isFutureDate, toDateKey } from '@/utils/date';

const store = useAppStore();
const isOpen = computed(() => Boolean(store.state.checkIn.open));
const dateKey = computed(() => store.state.checkIn.dateKey || toDateKey());
const existing = computed(() => store.recordsByDate[dateKey.value]);
const form = reactive({ weightKg: 60, stickerId: null });
const error = ref('');
const stickerBrowserOpen = ref(false);
const selectedStickerCategory = ref('all');
const recentStickerIds = ref([]);
const weightInput = ref(null);
const weightValue = ref(null);
const stickerPanel = ref(null);
const closeButton = ref(null);
const isToday = computed(() => dateKey.value === toDateKey());
const userId = computed(() => store.state.user?.uid || 'guest');
const stickerIds = stickers.map((sticker) => sticker.id);
const selectedSticker = computed(
  () => stickers.find((sticker) => sticker.id === form.stickerId) || null
);

const loadRecentStickers = () => {
  recentStickerIds.value = readRecentStickerIds(userId.value, stickerIds);
};

watch(userId, loadRecentStickers, { immediate: true });

const recentStickers = computed(() => {
  const orderedIds = [...recentStickerIds.value, ...stickerIds];
  return [...new Set(orderedIds)]
    .map((id) => stickers.find((sticker) => sticker.id === id))
    .filter(Boolean)
    .slice(0, 5);
});

const availableStickerCategories = computed(() => stickerCategories);

const stickerCategoryOrder = new Map(
  stickerCategories
    .filter((category) => category.id !== 'all')
    .map((category, index) => [category.id, index])
);

const sortStickersByCategory = (items) => {
  const originalOrder = new Map(stickers.map((sticker, index) => [sticker.id, index]));
  return [...items].sort(
    (left, right) =>
      (stickerCategoryOrder.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
        (stickerCategoryOrder.get(right.category) ?? Number.MAX_SAFE_INTEGER) ||
      originalOrder.get(left.id) - originalOrder.get(right.id)
  );
};

const visibleStickers = computed(() => {
  if (selectedStickerCategory.value !== 'all') {
    return stickers.filter((sticker) => sticker.category === selectedStickerCategory.value);
  }

  return sortStickersByCategory(stickers);
});

const toggleStickerBrowser = async () => {
  const container = weightInput.value;
  const element = weightValue.value;
  const panel = stickerPanel.value;
  const beforeContainer = container?.getBoundingClientRect();
  const before = element?.getBoundingClientRect();
  const beforePanel = panel?.getBoundingClientRect();
  container?.getAnimations().forEach((animation) => animation.cancel());
  element?.getAnimations().forEach((animation) => animation.cancel());
  panel?.getAnimations().forEach((animation) => animation.cancel());
  stickerBrowserOpen.value = !stickerBrowserOpen.value;
  await nextTick();

  const afterContainer = container?.getBoundingClientRect();
  const after = element?.getBoundingClientRect();
  const afterPanel = panel?.getBoundingClientRect();
  if (!before || !after || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const animations = [];
  const scaleX = before.width / after.width;
  const scaleY = before.height / after.height;
  animations.push(
    element.animate(
      [
        {
          transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${scaleX}, ${scaleY})`,
          transformOrigin: 'top left',
        },
        { transform: 'translate(0, 0) scale(1, 1)', transformOrigin: 'top left' },
      ],
      {
        duration: 320,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }
    )
  );

  if (beforeContainer && afterContainer && beforeContainer.height !== afterContainer.height) {
    animations.push(
      container.animate(
        [{ height: `${beforeContainer.height}px` }, { height: `${afterContainer.height}px` }],
        {
          duration: 320,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      )
    );
  }

  if (beforePanel && afterPanel && beforePanel.height !== afterPanel.height) {
    const expanding = stickerBrowserOpen.value;
    animations.push(
      panel.animate(
        [
          {
            height: `${beforePanel.height}px`,
            transform: `scaleY(${expanding ? 0.94 : 1})`,
            transformOrigin: 'top center',
          },
          {
            height: `${afterPanel.height}px`,
            transform: `scaleY(${expanding ? 1 : 0.94})`,
            transformOrigin: 'top center',
          },
        ],
        {
          duration: 320,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      )
    );
  }

  Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
    animations.forEach((animation) => animation.cancel());
  });
};

const resetForm = () => {
  Object.assign(form, {
    weightKg: existing.value?.weightKg || store.latestRecord?.weightKg || 60,
    stickerId: existing.value?.stickerId ?? null,
  });
  stickerBrowserOpen.value = false;
  selectedStickerCategory.value = 'all';
  error.value = '';
};

watch([dateKey, existing], resetForm, { immediate: true });
watch(
  isOpen,
  async (open) => {
    if (!open) {
      document.body.classList.remove('dialog-open');
      return;
    }
    resetForm();
    document.body.classList.add('dialog-open');
    await nextTick();
    closeButton.value?.focus();
  },
  { immediate: true }
);
onBeforeUnmount(() => document.body.classList.remove('dialog-open'));

const allowed = computed(
  () => existing.value || (!isFutureDate(dateKey.value) && canBackfillDate(dateKey.value))
);
const close = () => store.closeCheckIn();
const submit = async () => {
  if (!allowed.value) return;
  error.value = '';
  try {
    await store.saveRecord({
      dateKey: dateKey.value,
      weightKg: form.weightKg,
      stickerId: form.stickerId,
      source: existing.value?.source || (dateKey.value === toDateKey() ? 'normal' : 'backfill'),
    });
    recentStickerIds.value = rememberStickerSelection(
      userId.value,
      form.stickerId,
      recentStickerIds.value
    );
    close();
  } catch (cause) {
    error.value = cause.message || '暫時無法保存，請稍後再試。';
  }
};
const remove = async () => {
  if (!existing.value) return;
  const confirmed = await store.askConfirm({
    tone: 'danger',
    title: '刪除這天的紀錄嗎？',
    message: '刪除後，這天會恢復成空白日期；之後重新補記時仍會遵循最近 7 天的補登規則。',
    confirmText: '刪除紀錄',
    cancelText: '先保留',
  });
  if (!confirmed) return;
  error.value = '';
  try {
    await store.deleteRecord(dateKey.value);
    close();
  } catch (cause) {
    error.value = cause.message || '暫時無法刪除，請稍後再試。';
  }
};
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="checkin-backdrop" @click.self="close">
      <section
        :class="['checkin-modal', { 'checkin-modal--sticker-browser': stickerBrowserOpen }]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        tabindex="-1"
        @keydown.esc="close"
      >
        <button
          ref="closeButton"
          class="checkin-close"
          type="button"
          aria-label="關閉今日打卡視窗"
          @click.stop="close"
        >
          <X :size="20" />
        </button>
        <img
          v-if="selectedSticker"
          class="checkin-selected-sticker"
          :src="selectedSticker.src"
          :alt="`目前選擇：${selectedSticker.name}`"
        />
        <p class="eyebrow">DAILY CHECK-IN</p>
        <h1 id="checkin-title">
          {{ existing ? '修改這一天' : isToday ? '今天，感覺如何？' : '補記這一天' }}
        </h1>
        <p class="checkin-date">{{ formatDate(dateKey, { weekday: true, year: true }) }}</p>

        <div v-if="!allowed" class="empty-state">
          <h2>這頁暫時不能補記</h2>
          <p>空白日期僅能補登最近 7 天；已有紀錄仍可隨時修改。</p>
        </div>
        <form v-else class="checkin-card" @submit.prevent="submit">
          <label ref="weightInput" class="weight-input">
            <Scale :size="28" />
            <span>體重</span>
            <div ref="weightValue">
              <input
                v-model.number="form.weightKg"
                type="number"
                min="20"
                max="300"
                step="0.1"
                required
              />
              <b>kg</b>
            </div>
          </label>
          <fieldset>
            <legend class="sticker-section-heading">
              <span>今天的貼紙</span>
              <button
                class="sticker-browser-toggle"
                type="button"
                :aria-expanded="stickerBrowserOpen"
                @click="toggleStickerBrowser"
              >
                {{ stickerBrowserOpen ? '收起貼紙' : '瀏覽全部' }}
              </button>
            </legend>

            <div ref="stickerPanel" class="sticker-panel">
              <div v-if="stickerBrowserOpen" class="sticker-browser">
                <div class="sticker-category-tabs" role="tablist" aria-label="貼紙分類">
                  <button
                    v-for="category in availableStickerCategories"
                    :key="category.id"
                    class="sticker-category-tab"
                    :class="{ active: selectedStickerCategory === category.id }"
                    type="button"
                    role="tab"
                    :aria-selected="selectedStickerCategory === category.id"
                    @click="selectedStickerCategory = category.id"
                  >
                    {{ category.label }}
                  </button>
                </div>
                <div class="sticker-grid sticker-grid--browser">
                  <p v-if="!visibleStickers.length" class="sticker-empty">這個分類還沒有貼紙</p>
                  <label
                    v-if="selectedStickerCategory === 'all'"
                    :class="[
                      'sticker-option',
                      'sticker-option--none',
                      { selected: form.stickerId === null },
                    ]"
                  >
                    <input v-model="form.stickerId" type="radio" :value="null" />
                    <span>無</span>
                  </label>
                  <label
                    v-for="sticker in visibleStickers"
                    :key="sticker.id"
                    :class="['sticker-option', { selected: form.stickerId === sticker.id }]"
                    :title="sticker.name"
                  >
                    <input v-model="form.stickerId" type="radio" :value="sticker.id" />
                    <img :src="sticker.src" :alt="sticker.alt" />
                  </label>
                </div>
              </div>
              <div v-else class="sticker-grid sticker-grid--recent">
                <label
                  :class="[
                    'sticker-option',
                    'sticker-option--none',
                    { selected: form.stickerId === null },
                  ]"
                >
                  <input v-model="form.stickerId" type="radio" :value="null" />
                  <span>無</span>
                </label>
                <label
                  v-for="sticker in recentStickers"
                  :key="sticker.id"
                  :class="['sticker-option', { selected: form.stickerId === sticker.id }]"
                >
                  <input v-model="form.stickerId" type="radio" :value="sticker.id" />
                  <img :src="sticker.src" :alt="sticker.alt" />
                </label>
              </div>
            </div>
          </fieldset>
          <p v-if="error" class="form-error">{{ error }}</p>
          <button class="primary-button">
            {{ existing ? '保存修改' : isToday ? '貼上，完成打卡！' : '補上這天紀錄' }}
          </button>
          <button v-if="existing" class="delete-record-button" type="button" @click="remove">
            <Trash2 :size="17" />刪除這天紀錄
          </button>
        </form>
      </section>
    </div>
  </Teleport>
</template>

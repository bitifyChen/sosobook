<script setup>
import { Scale, Trash2, X } from 'lucide-vue-next';
import { stickers } from '@/data/assets';
import { canBackfillDate, formatDate, isFutureDate, toDateKey } from '@/utils/date';

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const dateKey = computed(() => route.params.date || toDateKey());
const existing = computed(() => store.recordsByDate[dateKey.value]);
const form = reactive({ weightKg: 60, stickerId: null });
const error = ref('');
const isToday = computed(() => dateKey.value === toDateKey());

const resetForm = () => {
  Object.assign(form, {
    weightKg: existing.value?.weightKg || store.latestRecord?.weightKg || 60,
    stickerId: existing.value?.stickerId ?? null,
  });
};
watch([dateKey, existing], resetForm, { immediate: true });
onMounted(() => document.body.classList.add('dialog-open'));
onBeforeUnmount(() => document.body.classList.remove('dialog-open'));

const allowed = computed(
  () => existing.value || (!isFutureDate(dateKey.value) && canBackfillDate(dateKey.value))
);
const close = () => router.replace('/');
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
    <div class="checkin-backdrop" @click.self="close">
      <section
        class="checkin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        tabindex="-1"
        @keydown.esc="close"
      >
        <button class="checkin-close" aria-label="關閉今日打卡視窗" @click="close">
          <X :size="20" />
        </button>
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
          <label class="weight-input">
            <Scale :size="28" />
            <span>體重</span>
            <div>
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
            <legend><span>今天的貼紙</span><small>可以選擇不貼</small></legend>
            <div class="sticker-grid">
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
                v-for="sticker in stickers"
                :key="sticker.id"
                :class="['sticker-option', { selected: form.stickerId === sticker.id }]"
              >
                <input v-model="form.stickerId" type="radio" :value="sticker.id" />
                <img :src="sticker.src" :alt="sticker.alt" />
              </label>
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

<route lang="json">
{
  "name": "check-in",
  "path": "/check-in/:date?"
}
</route>

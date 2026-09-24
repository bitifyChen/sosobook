<script setup>
import { HelpCircle, X } from 'lucide-vue-next';
import { FILL_RATE_THRESHOLD } from '@/utils/competition';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(['close']);
const dialog = ref(null);
let previousFocus = null;

watch(
  () => props.open,
  async (visible) => {
    document.body.classList.toggle('dialog-open', visible);
    if (visible) {
      previousFocus = document.activeElement;
      await nextTick();
      dialog.value?.focus();
    } else {
      previousFocus?.focus?.();
      previousFocus = null;
    }
  },
  { immediate: true }
);

const close = () => emit('close');
const onKeydown = (event) => {
  if (event.key === 'Escape') close();
};

onBeforeUnmount(() => document.body.classList.remove('dialog-open'));
</script>

<template>
  <Teleport to="body">
    <Transition name="fill-rate-help">
      <div v-if="props.open" class="fill-rate-help-backdrop" @click.self="close">
        <section
          ref="dialog"
          class="fill-rate-help-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fill-rate-help-title"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <button
            class="fill-rate-help-close"
            type="button"
            aria-label="關閉填寫率說明"
            @click="close"
          >
            <X :size="20" />
          </button>
          <div class="fill-rate-help-icon" aria-hidden="true">
            <HelpCircle :size="30" />
          </div>
          <p class="eyebrow">RACE NOTE</p>
          <h2 id="fill-rate-help-title">填寫率是什麼？</h2>
          <p class="fill-rate-help-message">
            填寫率是你在競賽期間實際填寫體重的天數，占目前應填寫天數的比例。曲線中的虛線補值不算實際填寫。
          </p>
          <div class="fill-rate-help-rule">
            <strong>達標標準：{{ FILL_RATE_THRESHOLD }}%</strong>
            <small>低於標準會以示警色顯示，並排在排行榜合格者之後，名次顯示為「—」。</small>
          </div>
          <button class="fill-rate-help-primary" type="button" @click="close">知道了</button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

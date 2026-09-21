<script setup>
import { AlertTriangle, HelpCircle, LogOut, X } from 'lucide-vue-next';

const store = useAppStore();
const dialog = ref(null);
let previousFocus = null;

watch(
  () => store.state.confirm?.id,
  async (id) => {
    if (id) {
      previousFocus = document.activeElement;
      document.body.classList.add('dialog-open');
      await nextTick();
      dialog.value?.focus();
    } else {
      document.body.classList.remove('dialog-open');
      previousFocus?.focus?.();
      previousFocus = null;
    }
  }
);

const close = () => store.resolveConfirm(false);
const confirm = () => store.resolveConfirm(true);
const onKeydown = (event) => {
  if (event.key === 'Escape') close();
};
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="store.state.confirm" class="confirm-backdrop" @keydown="onKeydown">
        <section
          ref="dialog"
          class="confirm-box"
          role="alertdialog"
          aria-modal="true"
          tabindex="-1"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
        >
          <button class="confirm-close" aria-label="關閉確認視窗" @click="close">
            <X :size="19" />
          </button>
          <div :class="['confirm-badge', store.state.confirm.tone]" aria-hidden="true">
            <LogOut v-if="store.state.confirm.tone === 'danger'" />
            <AlertTriangle v-else-if="store.state.confirm.tone === 'warning'" />
            <HelpCircle v-else />
          </div>
          <p class="eyebrow">小小確認頁</p>
          <h2 id="confirm-title">{{ store.state.confirm.title }}</h2>
          <p id="confirm-message" class="confirm-message">{{ store.state.confirm.message }}</p>
          <div class="confirm-actions">
            <button class="confirm-cancel" @click="close">
              {{ store.state.confirm.cancelText }}
            </button>
            <button :class="['confirm-primary', store.state.confirm.tone]" @click="confirm">
              {{ store.state.confirm.confirmText }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

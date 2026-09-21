<script setup>
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-vue-next';
const store = useAppStore();
let timer;
watch(
  () => store.state.toast?.id,
  () => {
    clearTimeout(timer);
    if (store.state.toast)
      timer = setTimeout(() => {
        store.state.toast = null;
      }, 3200);
  }
);
const close = () => {
  store.state.toast = null;
};
</script>
<template>
  <Teleport to="body">
    <div class="notification-stack" aria-live="polite" aria-atomic="true">
      <Transition name="notification">
        <div
          v-if="store.state.toast"
          :class="['notification-toast', store.state.toast.kind]"
          role="status"
        >
          <div class="notification-icon" aria-hidden="true">
            <CheckCircle2 v-if="store.state.toast.kind === 'success'" />
            <AlertTriangle
              v-else-if="store.state.toast.kind === 'warning' || store.state.toast.kind === 'error'"
            />
            <Info v-else />
          </div>
          <div class="notification-copy">
            <strong>{{
              store.state.toast.kind === 'success'
                ? '手帳已更新'
                : store.state.toast.kind === 'error'
                  ? '這頁需要再試一次'
                  : '手帳小提醒'
            }}</strong
            ><span>{{ store.state.toast.message }}</span>
          </div>
          <button class="notification-close" aria-label="關閉通知" @click="close">
            <X :size="18" />
          </button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

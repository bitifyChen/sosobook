<script setup>
import { Download, Share2, X } from 'lucide-vue-next';

const store = useAppStore();
const route = useRoute();
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const PROMPT_STORAGE_KEY = 'sosobook.pwa-install-dismissed.v1';
const deferredPrompt = shallowRef(null);
const visible = ref(false);
const showIosSteps = ref(false);
const isIos = ref(false);
const isMobile = ref(false);
const isStandalone = ref(false);
const installedThisSession = ref(false);
let showTimer;
let standaloneQuery;

const isLoginStage = computed(
  () =>
    store.state.authReady &&
    !store.state.user &&
    !store.state.loginPending &&
    route.name === 'login'
);
const canOfferInstall = computed(
  () =>
    isMobile.value &&
    !isStandalone.value &&
    !installedThisSession.value &&
    (isIos.value || Boolean(deferredPrompt.value)) &&
    isLoginStage.value
);

const readDismissedAt = () => {
  try {
    return Number(window.localStorage.getItem(PROMPT_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};

const recentlyDismissed = () => Date.now() - readDismissedAt() < DISMISS_COOLDOWN_MS;

const schedulePrompt = () => {
  window.clearTimeout(showTimer);
  if (!canOfferInstall.value || recentlyDismissed()) {
    visible.value = false;
    return;
  }
  showTimer = window.setTimeout(() => {
    if (canOfferInstall.value && !recentlyDismissed()) visible.value = true;
  }, 900);
};

const updateEnvironment = () => {
  const userAgent = window.navigator.userAgent;
  isIos.value =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  isMobile.value =
    isIos.value || window.matchMedia('(max-width: 1024px) and (pointer: coarse)').matches;
  isStandalone.value =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

const handleInstallAvailable = (event) => {
  event.preventDefault();
  deferredPrompt.value = event;
  schedulePrompt();
};

const handleInstalled = () => {
  deferredPrompt.value = null;
  visible.value = false;
  installedThisSession.value = true;
};

const dismiss = () => {
  try {
    window.localStorage.setItem(PROMPT_STORAGE_KEY, String(Date.now()));
  } catch {
    // 無法使用本機儲存時，仍允許關閉本次提示。
  }
  visible.value = false;
  showIosSteps.value = false;
};

const install = async () => {
  if (isIos.value) {
    if (showIosSteps.value) {
      dismiss();
      return;
    }
    showIosSteps.value = true;
    return;
  }

  const prompt = deferredPrompt.value;
  if (!prompt) return;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferredPrompt.value = null;
    if (choice.outcome === 'accepted') {
      installedThisSession.value = true;
      visible.value = false;
    } else dismiss();
  } catch {
    deferredPrompt.value = null;
    dismiss();
  }
};

watch(canOfferInstall, schedulePrompt);

onMounted(() => {
  updateEnvironment();
  standaloneQuery = window.matchMedia('(display-mode: standalone)');
  standaloneQuery.addEventListener?.('change', updateEnvironment);
  window.addEventListener('beforeinstallprompt', handleInstallAvailable);
  window.addEventListener('appinstalled', handleInstalled);
  window.addEventListener('resize', updateEnvironment);
  schedulePrompt();
});

onBeforeUnmount(() => {
  window.clearTimeout(showTimer);
  standaloneQuery?.removeEventListener?.('change', updateEnvironment);
  window.removeEventListener('beforeinstallprompt', handleInstallAvailable);
  window.removeEventListener('appinstalled', handleInstalled);
  window.removeEventListener('resize', updateEnvironment);
});
</script>

<template>
  <Transition name="pwa-install">
    <aside
      v-if="visible"
      class="pwa-install-prompt"
      role="dialog"
      aria-modal="false"
      aria-labelledby="pwa-install-title"
    >
      <button class="pwa-install-close" type="button" aria-label="稍後再提示" @click="dismiss">
        <X :size="18" />
      </button>
      <div class="pwa-install-icon" aria-hidden="true">
        <Share2 v-if="isIos" :size="25" />
        <Download v-else :size="25" />
      </div>
      <div class="pwa-install-copy">
        <p class="eyebrow">ADD TO HOME SCREEN</p>
        <strong id="pwa-install-title">先把 SosoBook 加到主畫面</strong>
        <p>加入後請從主畫面開啟，再使用 Google 登入一次即可。</p>
        <ol v-if="showIosSteps" class="pwa-install-steps">
          <li>點選瀏覽器的「分享」按鈕。</li>
          <li>選擇「加入主畫面」。</li>
          <li>點選「新增」，再從主畫面開啟 SosoBook。</li>
        </ol>
      </div>
      <div class="pwa-install-actions">
        <button type="button" class="pwa-install-later" @click="dismiss">直接登入</button>
        <button type="button" class="pwa-install-primary" @click="install">
          {{ isIos ? (showIosSteps ? '我知道了' : '查看步驟') : '先加入主畫面' }}
        </button>
      </div>
    </aside>
  </Transition>
</template>

<script setup>
import { RefreshCw, X } from 'lucide-vue-next';
import { APP_VERSION } from '@/config/appVersion';
import { forceReloadPwa } from '@/services/pwa';
import { compareVersions, isValidVersion } from '@/utils/version';

const DISMISS_STORAGE_KEY = 'sosobook.pwa-update-dismissed.v1';
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const visible = ref(false);
const checking = ref(false);
const updating = ref(false);
const required = ref(false);
const latestVersion = ref('');
const minimumVersion = ref('');
let checkTimer;

const versionManifestUrl = () => {
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/version.json`;
  baseUrl.searchParams.set('check', String(Date.now()));
  return baseUrl;
};

const readDismissed = () => {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISS_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

const wasRecentlyDismissed = (version) => {
  const dismissed = readDismissed();
  return dismissed?.version === version && Date.now() - Number(dismissed.at) < DISMISS_COOLDOWN_MS;
};

const rememberDismissed = (version) => {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify({ version, at: Date.now() }));
  } catch {
    // 無法使用本機儲存時，仍允許關閉這次提示。
  }
};

const checkForUpdate = async () => {
  if (checking.value || updating.value || !navigator.onLine) return;

  checking.value = true;
  try {
    const response = await fetch(versionManifestUrl(), {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    });
    if (!response.ok) return;

    const manifest = await response.json();
    if (!isValidVersion(manifest.version)) return;

    const remoteMinimumVersion = isValidVersion(manifest.minimumVersion)
      ? manifest.minimumVersion
      : '0.0.0';
    const hasNewerVersion = compareVersions(manifest.version, APP_VERSION) > 0;
    const belowMinimum = compareVersions(APP_VERSION, remoteMinimumVersion) < 0;
    if (!hasNewerVersion && !belowMinimum) return;

    const mustUpdate = belowMinimum;
    if (!mustUpdate && wasRecentlyDismissed(manifest.version)) return;

    latestVersion.value = manifest.version;
    minimumVersion.value = remoteMinimumVersion;
    required.value = mustUpdate;
    visible.value = true;
  } catch {
    // 版本檔無法取得時不打斷使用者；下一次回到前景或重新連線會再檢查。
  } finally {
    checking.value = false;
  }
};

const dismiss = () => {
  if (required.value) return;
  rememberDismissed(latestVersion.value);
  visible.value = false;
};

const updateNow = async () => {
  if (updating.value) return;
  updating.value = true;
  try {
    await forceReloadPwa({ expectUpdate: true });
  } finally {
    updating.value = false;
  }
};

const handleVisibility = () => {
  if (document.visibilityState === 'visible') void checkForUpdate();
};

const handleOnline = () => void checkForUpdate();

onMounted(() => {
  checkTimer = window.setTimeout(() => void checkForUpdate(), 1400);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('online', handleOnline);
});

onBeforeUnmount(() => {
  window.clearTimeout(checkTimer);
  document.removeEventListener('visibilitychange', handleVisibility);
  window.removeEventListener('online', handleOnline);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="pwa-update">
      <div v-if="visible" class="pwa-update-backdrop">
        <section
          class="pwa-update-card"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="pwa-update-title"
        >
          <button
            v-if="!required"
            class="pwa-update-close"
            type="button"
            aria-label="稍後提醒"
            @click="dismiss"
          >
            <X :size="19" />
          </button>
          <div class="pwa-update-icon" aria-hidden="true">
            <RefreshCw :size="24" />
          </div>
          <p class="eyebrow">SOSOBOOK UPDATE</p>
          <h2 id="pwa-update-title">
            {{ required ? '請先更新 SosoBook' : 'SosoBook 有新版本了' }}
          </h2>
          <p class="pwa-update-message">
            目前使用 v{{ APP_VERSION }}，最新版本是 v{{
              latestVersion
            }}。更新會保留你的登入狀態與資料。
          </p>
          <p v-if="required" class="pwa-update-required">
            這個版本低於最低支援版本 v{{ minimumVersion }}，請更新後再繼續使用。
          </p>
          <div class="pwa-update-actions">
            <button v-if="!required" type="button" class="pwa-update-later" @click="dismiss">
              稍後提醒
            </button>
            <button
              type="button"
              class="pwa-update-primary"
              :class="{ 'pwa-update-primary--full': required }"
              :disabled="updating"
              @click="updateNow"
            >
              <RefreshCw v-if="updating" class="spinning" :size="17" />
              {{ updating ? '更新中…' : '立即更新' }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

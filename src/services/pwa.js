import { registerSW } from 'virtual:pwa-register';

let updateServiceWorker = null;
let pwaRegistration = null;
let registered = false;
let forceReloadPromise = null;
const PWA_UPDATE_CHECK_TIMEOUT_MS = 6000;
const PWA_WAITING_TIMEOUT_MS = 8000;
const PWA_ACTIVATION_TIMEOUT_MS = 6000;

const withTimeout = (task, timeoutMs, fallbackValue) =>
  Promise.race([
    Promise.resolve(task),
    new Promise((resolve) => window.setTimeout(() => resolve(fallbackValue), timeoutMs)),
  ]);

const waitForWaitingWorker = (registration) =>
  new Promise((resolve) => {
    const startedAt = Date.now();

    const check = () => {
      if (registration?.waiting) {
        resolve(true);
        return;
      }

      if (Date.now() - startedAt >= PWA_WAITING_TIMEOUT_MS) {
        resolve(false);
        return;
      }

      window.setTimeout(check, 100);
    };

    check();
  });

const waitForReloadOrFallback = () =>
  new Promise((resolve) => {
    const fallbackTimer = window.setTimeout(() => {
      window.location.reload();
      resolve();
    }, PWA_ACTIVATION_TIMEOUT_MS);

    window.addEventListener(
      'pagehide',
      () => {
        window.clearTimeout(fallbackTimer);
        resolve();
      },
      { once: true }
    );
  });

export const registerPwa = () => {
  if (registered || typeof window === 'undefined') return;

  registered = true;
  updateServiceWorker = registerSW({
    immediate: true,
    onRegisteredSW: (_scriptUrl, registration) => {
      pwaRegistration = registration;
    },
    onRegisterError: (cause) => {
      console.warn('[SosoBook] PWA 更新服務初始化失敗。', cause);
    },
  });
};

const runForceReload = async ({ expectUpdate = false } = {}) => {
  registerPwa();

  try {
    const registration =
      pwaRegistration ||
      (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null);

    if (!registration || !updateServiceWorker) {
      window.location.reload();
      return;
    }

    await withTimeout(registration.update(), PWA_UPDATE_CHECK_TIMEOUT_MS);

    const updateIsWaiting =
      Boolean(registration.waiting) ||
      (expectUpdate ? await waitForWaitingWorker(registration) : false);

    if (updateIsWaiting) {
      // 提示式更新會在新版 Service Worker 接管後自行刷新；這裡只保留逾時備援。
      await updateServiceWorker(true);
      await waitForReloadOrFallback();
      return;
    }
  } catch (cause) {
    console.warn('[SosoBook] PWA 強制更新檢查失敗，改以重新載入目前頁面。', cause);
  }

  window.location.reload();
};

export const forceReloadPwa = (options) => {
  if (typeof window === 'undefined') return Promise.resolve();

  if (!forceReloadPromise) {
    forceReloadPromise = runForceReload(options).finally(() => {
      forceReloadPromise = null;
    });
  }

  return forceReloadPromise;
};

import { registerSW } from 'virtual:pwa-register';

let updateServiceWorker = null;
let pwaRegistration = null;
let registered = false;

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

export const forceReloadPwa = async () => {
  registerPwa();

  try {
    const registration =
      pwaRegistration ||
      (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null);
    await registration?.update();
    await updateServiceWorker?.(true);
  } catch (cause) {
    console.warn('[SosoBook] PWA 強制更新檢查失敗，改以重新載入目前頁面。', cause);
  }

  if (typeof window !== 'undefined') window.location.reload();
};

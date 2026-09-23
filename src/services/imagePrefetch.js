import { avatars, badges, stickers } from '@/data/assets';

let prefetchStarted = false;
let onlineListenerBound = false;

const wait = (duration) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });

const loadImage = (src) =>
  new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = resolve;
    image.onerror = resolve;
    image.src = src;
  });

const scheduleDuringIdle = (task) => {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(task, { timeout: 8000 });
  } else {
    window.setTimeout(task, 2000);
  }
};

const runPrefetch = async () => {
  const urls = [...avatars, ...stickers, ...badges].map((item) => item.src);
  for (const src of urls) {
    if (navigator.onLine === false) break;
    await loadImage(src);
    await wait(24);
  }
};

export const prefetchDeferredImages = () => {
  if (typeof window === 'undefined' || prefetchStarted) return;

  if (navigator.onLine === false) {
    if (!onlineListenerBound) {
      onlineListenerBound = true;
      window.addEventListener('online', prefetchDeferredImages, { once: true });
    }
    return;
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) return;

  prefetchStarted = true;
  scheduleDuringIdle(() => {
    void runPrefetch();
  });
};

import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import VueRouter from 'unplugin-vue-router/vite';
import { fileURLToPath, URL } from 'node:url';
import { APP_VERSION, MINIMUM_SUPPORTED_VERSION } from './src/config/appVersion.js';

const releaseManifest = () => ({
  name: 'sosobook-release-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify(
        {
          version: APP_VERSION,
          minimumVersion: MINIMUM_SUPPORTED_VERSION,
        },
        null,
        2
      ),
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [
      releaseManifest(),
      VueRouter({
        routesFolder: 'src/pages',
        dts: 'src/typed-router.d.ts',
      }),
      AutoImport({
        imports: ['vue', 'vue-router'],
        dirs: ['src/stores'],
        dts: 'src/auto-imports.d.ts',
        vueTemplate: true,
      }),
      Components({
        dirs: ['src/components'],
        extensions: ['vue'],
        deep: true,
        dts: 'src/components.d.ts',
      }),
      vue(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['app-128.png', 'app-512.png', 'logo.webp'],
        manifest: {
          name: 'SosoBook 體重日記',
          short_name: 'SosoBook',
          lang: 'zh-Hant',
          description: '用貼紙記錄每日體重，和朋友一起參加減重競賽。',
          theme_color: '#fff7df',
          background_color: '#fff7df',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: 'app-128.png',
              sizes: '128x128',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'app-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg}'],
          globIgnores: ['img/reference/**', 'app-icon.*', '**/*.{png,jpg,jpeg}'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.destination === 'image' && url.origin === self.location.origin,
              handler: 'CacheFirst',
              options: {
                cacheName: 'sosobook-images-v1',
                cacheableResponse: { statuses: [0, 200] },
                expiration: {
                  maxEntries: 180,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
              },
            },
            {
              urlPattern: ({ request, url }) =>
                request.destination === 'font' && url.origin === self.location.origin,
              handler: 'CacheFirst',
              options: {
                cacheName: 'sosobook-fonts-v1',
                cacheableResponse: { statuses: [0, 200] },
                expiration: {
                  maxEntries: 32,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
  };
});

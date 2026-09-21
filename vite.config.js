import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import VueRouter from 'unplugin-vue-router/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [
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
        registerType: 'autoUpdate',
        includeAssets: ['app-128.png', 'app-512.png', 'logo.webp'],
        manifest: {
          name: 'SosoBook 體重日記',
          short_name: 'SosoBook',
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
          globPatterns: ['**/*.{js,css,html,png,svg,webp}'],
          globIgnores: ['img/reference/**', 'app-icon.*', '**/*.{png,jpg,jpeg}'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: 'index.html',
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

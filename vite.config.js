import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
        loadPaths: ['src/styles'],
      },
    },
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        lang: 'ru',
        name: 'Бюджет на день',
        short_name: 'Бюджет',
        description: 'Дневной бюджет и учёт долгов',
        theme_color: '#10161A',
        background_color: '#10161A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    // Vitest's own default exclude list only covers build artifacts/deps
    // (node_modules, dist, .git, etc.) — it doesn't know about git worktrees,
    // which physically nest a full second copy of this repo's tree on disk
    // (e.g. .worktrees/<branch>/src/**). Without this, running the suite
    // from this directory would also collect and run every spec file inside
    // any worktree, duplicating (and potentially destabilizing, since two
    // copies of the same spec file run in the same process) the real run.
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
  },
});

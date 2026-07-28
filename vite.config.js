import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ command }) => ({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
        loadPaths: ['src/styles'],
      },
    },
  },
  // https, not http: crypto.randomUUID() (used everywhere a new db record
  // gets its id) and the service worker this app needs to be installable
  // both require a secure context, which plain http only ever satisfies on
  // localhost — testing over the LAN from a real phone needs this too.
  // Self-signed (not mkcert) deliberately: no CA/profile install needed on
  // the test device, just a one-time "continue anyway" past the warning,
  // which fits an occasional personal-device test better than the trusted-
  // but-more-setup alternative. Dev-server only — the real deployment (a
  // real server + real cert) doesn't need Vite's own cert.
  server: command === 'serve' ? { https: true } : undefined,
  plugins: [
    vue(),
    ...(command === 'serve' ? [basicSsl()] : []),
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
    //
    // server/ is its own separate Node package (own package.json, run via
    // `node --test`, not vitest) — server/*.test.js files use node:test
    // syntax, which vitest can't execute, so without this exclude it reports
    // them as a false "no test suite found" failure alongside the real
    // (passing) client-side run.
    exclude: [...configDefaults.exclude, '**/.worktrees/**', '**/server/**'],
  },
}));

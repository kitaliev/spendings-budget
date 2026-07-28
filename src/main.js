import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { syncPlugin } from './stores/syncPlugin.js';
// Self-hosted (not a Google Fonts CDN link) — ships the actual woff2 files
// as bundled assets, including the subset that covers the ruble sign (₽,
// U+20BD falls in the "latin-ext" subset's U+20AD-20C0 range, not
// "cyrillic" — the browser's own unicode-range matching picks the right
// @font-face block automatically once all of them are registered here).
import '@fontsource-variable/inter';
import './styles/main.scss';

const pinia = createPinia();
pinia.use(syncPlugin);

createApp(App).use(pinia).mount('#app');

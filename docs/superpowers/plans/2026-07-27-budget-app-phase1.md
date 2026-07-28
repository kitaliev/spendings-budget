# Бюджет на день — Phase 1 (автономное приложение) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fully offline-capable, installable iPhone PWA implementing the daily-budget and debts features against local IndexedDB storage — no server dependency.

**Architecture:** Vue 3 (Options API, no TypeScript) SPA with no router — a single App shell switches between two tabs (Бюджет / Долги) plus a Settings overlay and an always-on-launch expense modal, all driven by Pinia stores backed by an IndexedDB persistence layer (via `idb`). vite-plugin-pwa generates the service worker and manifest for home-screen install.

**Tech Stack:** Vite, Vue 3 (Options API), Pinia, SCSS (BEM), `idb`, vite-plugin-pwa, Vitest + @vue/test-utils + happy-dom.

**Reference:** Full product spec at `docs/superpowers/specs/2026-07-27-budget-app-design.md`. Visual prototype: https://claude.ai/code/artifact/84111cb8-abd6-4ebc-95a8-9d17a5427f02

**Addendum, resolved during Task 3's execution:** the font tokens were originally written as Sass variables (`$font-ui`/`$font-money`), which turned out to be the wrong call — Sass's `@forward` doesn't propagate a forwarding file's own `@use`d members downstream, so every one of the ~14 future `<style lang="scss">` blocks referencing them would have needed its own `@use "tokens" as *;` line (easy to forget, fails the build when missed). Fixed at the root instead: `--font-ui`/`--font-money` are now plain CSS custom properties in `_tokens.scss`, exactly like every other token, consumed via `var(--font-ui)`/`var(--font-money)` from any `<style>` block with no Sass import needed at all — the code blocks throughout this document already reflect that (see commit `2475256`). `vite.config.js` still sets `css.preprocessorOptions.scss = { api: 'modern', loadPaths: ['src/styles'] }` (commit `dadff84`) as a harmless safety net in case a genuine Sass-only construct (a mixin, a map) ever gets added to `src/styles/` — it just isn't load-bearing for typography anymore.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/App.vue`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "budget-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "idb": "^8.0.0",
    "pinia": "^2.1.0",
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@vue/test-utils": "^2.4.0",
    "happy-dom": "^13.0.0",
    "sass": "^1.70.0",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.20.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `package-lock.json`.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
    <title>Бюджет на день</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/App.vue` (placeholder)**

```vue
<template>
  <div class="app">Бюджет на день</div>
</template>

<script>
export default {
  name: 'App',
};
</script>
```

- [ ] **Step 6: Create `src/main.js`**

```js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

createApp(App).use(createPinia()).mount('#app');
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules
dist
dist-ssr
*.local
.DS_Store
```

- [ ] **Step 8: Verify dev server starts**

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173/`); stop it with Ctrl+C after confirming.

- [ ] **Step 9: Verify test runner works**

Run: `npm test`
Expected: Vitest runs with "No test files found" (not an error — no tests exist yet).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src/App.vue src/main.js .gitignore
git commit -m "chore: scaffold Vite + Vue 3 + Pinia project"
```

---

## Task 2: PWA manifest and service worker

**Files:**
- Modify: `vite.config.js`
- Create: `public/icon-192.png`, `public/icon-512.png` (placeholder app icons)

- [ ] **Step 1: Add vite-plugin-pwa to `vite.config.js`**

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
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
  },
});
```

- [ ] **Step 2: Generate placeholder icons**

Run:
```bash
node -e "
const fs = require('fs');
// 1x1 transparent PNG as a placeholder — replace with real artwork before shipping.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
fs.writeFileSync('public/icon-192.png', png);
fs.writeFileSync('public/icon-512.png', png);
"
```
Expected: `public/icon-192.png` and `public/icon-512.png` exist. (Flag to the user before real-device install testing: swap these for real 192×192 / 512×512 artwork — a 1×1 placeholder will look broken on the home screen.)

- [ ] **Step 3: Verify manifest is generated on build**

Run: `npm run build`
Expected: build succeeds; `dist/manifest.webmanifest` and `dist/sw.js` exist.

Run: `cat dist/manifest.webmanifest | grep short_name`
Expected: shows `"short_name":"Бюджет"`.

- [ ] **Step 4: Commit**

```bash
git add vite.config.js public/icon-192.png public/icon-512.png
git commit -m "feat: add PWA manifest and service worker via vite-plugin-pwa"
```

---

## Task 3: Design tokens (SCSS)

**Files:**
- Create: `src/styles/_tokens.scss`
- Create: `src/styles/_reset.scss`
- Create: `src/styles/main.scss`
- Modify: `src/main.js`

- [ ] **Step 1: Create `src/styles/_tokens.scss`**

Values carried over from the approved prototype (both themes; token-level, not a naive invert).

```scss
:root {
  color-scheme: light;
  --font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  --font-money: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  --ground: #F3F5F4;
  --surface: #FFFFFF;
  --surface-raised: #E8EBEA;
  --surface-sunken: #EDEFEE;
  --ink: #14191B;
  --ink-secondary: #52585B;
  --ink-muted: #82898C;
  --accent: #A9762C;
  --accent-strong: #8F621F;
  --accent-ink: #FFFFFF;
  --accent-wash: rgba(169, 118, 44, .10);
  --negative: #A8412B;
  --negative-wash: rgba(168, 65, 43, .10);
  --border: rgba(20, 25, 27, 0.10);
  --border-strong: rgba(20, 25, 27, 0.16);
  --cat-1: #2a78d6; --cat-2: #eb6834; --cat-3: #1baf7a;
  --cat-4: #eda100; --cat-5: #e87ba4; --cat-6: #4a3aa7;
}

/* font-ui/font-money are theme-invariant — declared once above, inherited by
   the [data-theme] override blocks below without redeclaration. */

@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
    --ground: #10161A;
    --surface: #1A2226;
    --surface-raised: #232C31;
    --surface-sunken: #0C1114;
    --ink: #EEEAE1;
    --ink-secondary: #A7ADAF;
    --ink-muted: #6E7679;
    --accent: #CC9F55;
    --accent-strong: #E0B565;
    --accent-ink: #171106;
    --accent-wash: rgba(204, 159, 85, .14);
    --negative: #D97A62;
    --negative-wash: rgba(217, 122, 98, .14);
    --border: rgba(238, 234, 225, 0.10);
    --border-strong: rgba(238, 234, 225, 0.18);
    --cat-1: #3987e5; --cat-2: #d95926; --cat-3: #199e70;
    --cat-4: #c98500; --cat-5: #d55181; --cat-6: #9085e9;
  }
}

// Phase 1 never sets data-theme itself (no in-app theme toggle yet) — these two
// blocks exist as forward-compat scaffolding for one, and are unreachable until
// something sets the attribute.
:root[data-theme="dark"] {
  color-scheme: dark;
  --ground: #10161A;
  --surface: #1A2226;
  --surface-raised: #232C31;
  --surface-sunken: #0C1114;
  --ink: #EEEAE1;
  --ink-secondary: #A7ADAF;
  --ink-muted: #6E7679;
  --accent: #CC9F55;
  --accent-strong: #E0B565;
  --accent-ink: #171106;
  --accent-wash: rgba(204, 159, 85, .14);
  --negative: #D97A62;
  --negative-wash: rgba(217, 122, 98, .14);
  --border: rgba(238, 234, 225, 0.10);
  --border-strong: rgba(238, 234, 225, 0.18);
  --cat-1: #3987e5; --cat-2: #d95926; --cat-3: #199e70;
  --cat-4: #c98500; --cat-5: #d55181; --cat-6: #9085e9;
}

:root[data-theme="light"] {
  color-scheme: light;
  --ground: #F3F5F4;
  --surface: #FFFFFF;
  --surface-raised: #E8EBEA;
  --surface-sunken: #EDEFEE;
  --ink: #14191B;
  --ink-secondary: #52585B;
  --ink-muted: #82898C;
  --accent: #A9762C;
  --accent-strong: #8F621F;
  --accent-ink: #FFFFFF;
  --accent-wash: rgba(169, 118, 44, .10);
  --negative: #A8412B;
  --negative-wash: rgba(168, 65, 43, .10);
  --border: rgba(20, 25, 27, 0.10);
  --border-strong: rgba(20, 25, 27, 0.16);
  --cat-1: #2a78d6; --cat-2: #eb6834; --cat-3: #1baf7a;
  --cat-4: #eda100; --cat-5: #e87ba4; --cat-6: #4a3aa7;
}
```

- [ ] **Step 2: Create `src/styles/_reset.scss`**

```scss
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-ui);
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: none;
}
/* No `@use 'tokens'` needed here — --font-ui is a CSS custom property now,
   readable via var() with zero Sass wiring, same as every other token. */

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Create `src/styles/main.scss`**

```scss
@forward 'tokens';
@forward 'reset';
```

- [ ] **Step 4: Import styles in `src/main.js`**

```js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/main.scss';

createApp(App).use(createPinia()).mount('#app');
```

- [ ] **Step 5: Verify build picks up styles**

Run: `npm run build`
Expected: build succeeds; `dist/assets/*.css` exists and contains `--accent` (check with `grep -r accent dist/assets/*.css`).

- [ ] **Step 6: Commit**

```bash
git add src/styles src/main.js
git commit -m "feat: add design tokens and global reset (SCSS)"
```

---

## Task 4: IndexedDB bootstrap

**Files:**
- Create: `src/db/index.js`
- Test: `src/db/index.spec.js`
- Create: `src/test-setup.js`
- Modify: `vite.config.js`

- [ ] **Step 1: Install the IndexedDB polyfill for tests**

Run: `npm install -D fake-indexeddb`
Expected: installs without errors. (happy-dom does not implement IndexedDB; tests need this polyfill.)

- [ ] **Step 2: Create `src/test-setup.js`**

```js
import 'fake-indexeddb/auto';
```

- [ ] **Step 3: Wire the setup file into `vite.config.js`**

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
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
  },
});
```

- [ ] **Step 4: Write the failing test**

```js
// src/db/index.spec.js
import { describe, it, expect } from 'vitest';
import { openDatabase } from './index.js';

describe('openDatabase', () => {
  it('creates all required object stores', async () => {
    const db = await openDatabase('test-db-' + Math.random());
    const names = Array.from(db.objectStoreNames);
    expect(names).toEqual(
      expect.arrayContaining(['categories', 'transactions', 'budgetRates', 'debts', 'debtPayments'])
    );
    db.close();
  });

  it('indexes transactions by date', async () => {
    const db = await openDatabase('test-db-' + Math.random());
    const tx = db.transaction('transactions');
    expect(Array.from(tx.store.indexNames)).toContain('date');
    db.close();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- src/db/index.spec.js`
Expected: FAIL with "Failed to resolve import ./index.js" or "openDatabase is not a function" (file doesn't exist yet).

- [ ] **Step 6: Implement `src/db/index.js`**

```js
import { openDB } from 'idb';

const DB_VERSION = 1;
const DEFAULT_NAME = 'budget-app';

export function openDatabase(name = DEFAULT_NAME) {
  return openDB(name, DB_VERSION, {
    upgrade(db) {
      const categories = db.createObjectStore('categories', { keyPath: 'id' });
      categories.createIndex('parentId', 'parentId');

      const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
      transactions.createIndex('date', 'date');
      transactions.createIndex('categoryId', 'categoryId');

      const budgetRates = db.createObjectStore('budgetRates', { keyPath: 'id' });
      budgetRates.createIndex('effectiveFrom', 'effectiveFrom');

      const debts = db.createObjectStore('debts', { keyPath: 'id' });
      debts.createIndex('direction', 'direction');

      const debtPayments = db.createObjectStore('debtPayments', { keyPath: 'id' });
      debtPayments.createIndex('debtId', 'debtId');
    },
  });
}

let dbPromise = null;

/** Shared singleton connection used by the app at runtime (tests use openDatabase() directly with unique names). */
export function getDb() {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- src/db/index.spec.js`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.js src/db/index.js src/db/index.spec.js src/test-setup.js
git commit -m "feat: add IndexedDB schema bootstrap"
```

---

## Task 5: Currency and date utilities

**Files:**
- Create: `src/utils/currency.js`
- Test: `src/utils/currency.spec.js`
- Create: `src/utils/date.js`
- Test: `src/utils/date.spec.js`

- [ ] **Step 1: Write the failing test for currency formatting**

```js
// src/utils/currency.spec.js
import { describe, it, expect } from 'vitest';
import { formatMoney } from './currency.js';

describe('formatMoney', () => {
  it('groups thousands with a space and appends the ruble sign', () => {
    expect(formatMoney(16800)).toBe('16 800 ₽');
  });

  it('renders negative amounts with a minus sign, not a hyphen', () => {
    expect(formatMoney(-2600)).toBe('−2 600 ₽');
  });

  it('rounds fractional amounts', () => {
    expect(formatMoney(999.6)).toBe('1 000 ₽');
  });

  it('handles zero', () => {
    expect(formatMoney(0)).toBe('0 ₽');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/currency.spec.js`
Expected: FAIL — `formatMoney` is not defined.

- [ ] **Step 3: Implement `src/utils/currency.js`**

```js
export function formatMoney(amount) {
  const isNegative = amount < 0;
  const rounded = Math.round(Math.abs(amount));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (isNegative ? '−' : '') + grouped + ' ₽';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/currency.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for date helpers**

```js
// src/utils/date.spec.js
import { describe, it, expect } from 'vitest';
import { toDateKey, toMonthKey, daysInMonth, daysElapsedInMonth, monthNameWithYear } from './date.js';

describe('toDateKey', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 6, 26))).toBe('2026-07-26');
  });

  it('pads single-digit month and day', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('toMonthKey', () => {
  it('derives YYYY-MM from a date key', () => {
    expect(toMonthKey('2026-07-26')).toBe('2026-07');
  });
});

describe('daysInMonth', () => {
  it('returns 31 for July', () => {
    expect(daysInMonth('2026-07')).toBe(31);
  });

  it('returns 28 for February 2026 (not a leap year)', () => {
    expect(daysInMonth('2026-02')).toBe(28);
  });
});

describe('daysElapsedInMonth', () => {
  it('returns the day-of-month for the current month', () => {
    expect(daysElapsedInMonth('2026-07', '2026-07-26')).toBe(26);
  });

  it('returns the full month length for a past month', () => {
    expect(daysElapsedInMonth('2026-03', '2026-07-26')).toBe(31);
  });

  it('returns 0 for a future month', () => {
    expect(daysElapsedInMonth('2026-12', '2026-07-26')).toBe(0);
  });
});

describe('monthNameWithYear', () => {
  it('capitalizes the Russian month name and appends the year', () => {
    expect(monthNameWithYear('2026-01')).toBe('Январь 2026');
  });

  it('works for every month, not just ones without special-casing', () => {
    expect(monthNameWithYear('2026-03')).toBe('Март 2026');
    expect(monthNameWithYear('2026-08')).toBe('Август 2026');
    expect(monthNameWithYear('2026-12')).toBe('Декабрь 2026');
  });
});
```

**Note added during Task 18's review:** `monthNameWithYear` didn't exist when this task was first written — it was extracted here later, once Task 18 (`MonthChart`) and Task 20 (`BudgetDashboard`) turned out to need the exact same "Месяц ГГГГ" string independently. Add the import (`monthNameWithYear` alongside the others below) and the function itself (in Step 7) even though it wasn't part of this task's original scope.

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/utils/date.spec.js`
Expected: FAIL — module `./date.js` does not exist.

- [ ] **Step 7: Implement `src/utils/date.js`**

```js
export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toMonthKey(dateKey) {
  return dateKey.slice(0, 7);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function daysElapsedInMonth(monthKey, todayDateKey = todayKey()) {
  const today = toMonthKey(todayDateKey);
  if (monthKey > today) return 0;
  if (monthKey < today) return daysInMonth(monthKey);
  return Number(todayDateKey.slice(8, 10));
}

// "Январь 2026" — the one Russian month-name format needed in more than one
// place (MonthChart's aria-labels, BudgetDashboard's month heading). Built
// via a local-time Date + toLocaleDateString rather than a hardcoded name
// array, so there's a single source of truth instead of two independently
// maintained lists that could quietly drift apart.
export function monthNameWithYear(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const name = new Date(year, month - 1, 1).toLocaleDateString('ru-RU', { month: 'long' });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/utils/date.spec.js`
Expected: PASS (11 tests).

- [ ] **Step 9: Commit**

```bash
git add src/utils/currency.js src/utils/currency.spec.js src/utils/date.js src/utils/date.spec.js
git commit -m "feat: add currency and date utility functions"
```

---

## Task 6: Calculator expression evaluator

**Files:**
- Create: `src/utils/calculator.js`
- Test: `src/utils/calculator.spec.js`

This is the on-screen keypad's math engine. Per the approved spec (§8), `×`/`÷` evaluate before `+`/`−` — standard mathematical precedence, confirmed against the user's own worked example (`120+340×2` → `800`).

- [ ] **Step 1: Write the failing test**

```js
// src/utils/calculator.spec.js
import { describe, it, expect } from 'vitest';
import { evaluateExpression } from './calculator.js';

describe('evaluateExpression', () => {
  it('returns a plain number unchanged', () => {
    expect(evaluateExpression('120')).toBe(120);
  });

  it('adds', () => {
    expect(evaluateExpression('120+50')).toBe(170);
  });

  it('applies multiplication before addition', () => {
    expect(evaluateExpression('120+340×2')).toBe(800);
  });

  it('applies division before addition, left to right', () => {
    expect(evaluateExpression('10÷2+3')).toBe(8);
  });

  it('chains multiple operators of equal precedence left to right', () => {
    expect(evaluateExpression('100−20−10')).toBe(70);
  });

  it('treats a comma as a decimal separator', () => {
    expect(evaluateExpression('12,5+7,5')).toBe(20);
  });

  it('returns 0 for an empty expression', () => {
    expect(evaluateExpression('')).toBe(0);
  });

  it('ignores a trailing operator with nothing typed after it', () => {
    expect(evaluateExpression('120+')).toBe(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/calculator.spec.js`
Expected: FAIL — module `./calculator.js` does not exist.

- [ ] **Step 3: Implement `src/utils/calculator.js`**

```js
function tokenize(expression) {
  return expression.split(/([+\-−×÷])/).filter((token) => token !== '');
}

function toNumber(token) {
  return parseFloat(String(token).replace(',', '.')) || 0;
}

export function evaluateExpression(expression) {
  const tokens = tokenize(expression);
  if (tokens.length === 0) return 0;

  // Pass 1: resolve × and ÷ left to right.
  const afterMulDiv = [toNumber(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const operand = toNumber(tokens[i + 1] ?? '0');
    if (operator === '×' || operator === '÷') {
      const previous = afterMulDiv.pop();
      afterMulDiv.push(
        operator === '×' ? previous * operand : operand === 0 ? previous : previous / operand
      );
    } else {
      afterMulDiv.push(operator, operand);
    }
  }

  // Pass 2: resolve + and − left to right.
  let result = afterMulDiv[0];
  for (let i = 1; i < afterMulDiv.length; i += 2) {
    const operator = afterMulDiv[i];
    const operand = afterMulDiv[i + 1];
    result = operator === '+' ? result + operand : result - operand;
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/calculator.spec.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/calculator.js src/utils/calculator.spec.js
git commit -m "feat: add precedence-aware calculator expression evaluator"
```

---

## Task 7: Categories (DB layer + Pinia store)

**Files:**
- Modify: `src/db/index.js`
- Create: `src/db/categories.js`
- Test: `src/db/categories.spec.js`
- Create: `src/stores/categories.js`
- Test: `src/stores/categories.spec.js`

Per spec §9: infinite nesting via `parentId`, archive (soft, hides from picker, keeps data) is a separate action from delete (hard, cascades to that category's transactions), and first launch seeds exactly one default category.

- [ ] **Step 1: Add a test-isolation helper to `src/db/index.js`**

Append to the file (keep everything already there):

```js
/** Test-only: empties every store so specs don't leak state into each other via the shared singleton connection. */
export async function clearAllStores() {
  const db = await getDb();
  const storeNames = Array.from(db.objectStoreNames);
  const tx = db.transaction(storeNames, 'readwrite');
  await Promise.all(storeNames.map((name) => tx.objectStore(name).clear()));
  await tx.done;
}
```

- [ ] **Step 2: Write the failing test for the categories DB layer**

```js
// src/db/categories.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores } from './index.js';
import {
  createCategory,
  listCategories,
  getChildren,
  archiveCategory,
  deleteCategory,
  seedDefaultCategoryIfEmpty,
} from './categories.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('seedDefaultCategoryIfEmpty', () => {
  it('creates one default category when none exist', async () => {
    await seedDefaultCategoryIfEmpty();
    const all = await listCategories();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Расход', emoji: '💰', parentId: null });
  });

  it('does nothing if a category already exists', async () => {
    await createCategory({ name: 'Еда', emoji: '🍔' });
    await seedDefaultCategoryIfEmpty();
    const all = await listCategories();
    expect(all).toHaveLength(1);
  });
});

describe('createCategory / getChildren', () => {
  it('nests a subcategory under its parent', async () => {
    const parent = await createCategory({ name: 'Еда', emoji: '🍔' });
    const child = await createCategory({ name: 'Продукты', emoji: '🛒', parentId: parent.id });
    const children = await getChildren(parent.id);
    expect(children.map((c) => c.id)).toEqual([child.id]);
  });
});

describe('archiveCategory', () => {
  it('marks the category and its whole subtree as archived, keeping the rows', async () => {
    const parent = await createCategory({ name: 'Еда', emoji: '🍔' });
    const child = await createCategory({ name: 'Продукты', emoji: '🛒', parentId: parent.id });

    await archiveCategory(parent.id);

    const all = await listCategories();
    expect(all.find((c) => c.id === parent.id).archived).toBe(true);
    expect(all.find((c) => c.id === child.id).archived).toBe(true);
    expect(all).toHaveLength(2); // nothing deleted
  });
});

describe('deleteCategory', () => {
  it('cascades: deletes the category, its subtree, and their transactions', async () => {
    const db = await (await import('./index.js')).getDb();
    const parent = await createCategory({ name: 'Еда', emoji: '🍔' });
    const child = await createCategory({ name: 'Продукты', emoji: '🛒', parentId: parent.id });
    await db.add('transactions', { id: 't1', amount: 500, date: '2026-07-20', categoryId: child.id });

    await deleteCategory(parent.id);

    const remainingCategories = await listCategories();
    expect(remainingCategories).toHaveLength(0);
    const remainingTx = await db.getAll('transactions');
    expect(remainingTx).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/db/categories.spec.js`
Expected: FAIL — module `./categories.js` does not exist.

- [ ] **Step 4: Implement `src/db/categories.js`**

```js
import { getDb } from './index.js';

export async function createCategory({ name, emoji, parentId = null }) {
  const db = await getDb();
  const category = { id: crypto.randomUUID(), name, emoji, parentId, archived: false };
  await db.add('categories', category);
  return category;
}

export async function listCategories() {
  const db = await getDb();
  return db.getAll('categories');
}

export async function getChildren(parentId) {
  const db = await getDb();
  return db.getAllFromIndex('categories', 'parentId', parentId);
}

async function collectSubtreeIds(db, rootId) {
  const ids = [rootId];
  const children = await db.getAllFromIndex('categories', 'parentId', rootId);
  for (const child of children) {
    ids.push(...(await collectSubtreeIds(db, child.id)));
  }
  return ids;
}

export async function archiveCategory(id) {
  const db = await getDb();
  const ids = await collectSubtreeIds(db, id);
  const tx = db.transaction('categories', 'readwrite');
  for (const catId of ids) {
    const category = await tx.store.get(catId);
    if (category) await tx.store.put({ ...category, archived: true });
  }
  await tx.done;
}

export async function deleteCategory(id) {
  const db = await getDb();
  const categoryIds = await collectSubtreeIds(db, id);
  const tx = db.transaction(['categories', 'transactions'], 'readwrite');
  const txStore = tx.objectStore('transactions');
  const txByCategory = txStore.index('categoryId');
  for (const catId of categoryIds) {
    await tx.objectStore('categories').delete(catId);
    let cursor = await txByCategory.openCursor(catId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

export async function seedDefaultCategoryIfEmpty() {
  const db = await getDb();
  const count = await db.count('categories');
  if (count === 0) {
    await createCategory({ name: 'Расход', emoji: '💰', parentId: null });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/db/categories.spec.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Write the failing test for the categories store**

```js
// src/stores/categories.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCategoriesStore } from './categories.js';
import * as categoriesDb from '../db/categories.js';

vi.mock('../db/categories.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  categoriesDb.seedDefaultCategoryIfEmpty.mockResolvedValue(undefined);
});

describe('useCategoriesStore.load', () => {
  it('populates items from the database', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '1', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.items).toHaveLength(1);
  });
});

describe('useCategoriesStore.rootCategories', () => {
  it('excludes archived and nested categories', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '1', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
      { id: '2', name: 'Продукты', emoji: '🛒', parentId: '1', archived: false },
      { id: '3', name: 'Старое', emoji: '📦', parentId: null, archived: true },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.rootCategories.map((c) => c.id)).toEqual(['1']);
  });
});

describe('useCategoriesStore.childrenOf', () => {
  it('returns active children of a given parent', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '1', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
      { id: '2', name: 'Продукты', emoji: '🛒', parentId: '1', archived: false },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.childrenOf('1').map((c) => c.id)).toEqual(['2']);
  });
});

describe('useCategoriesStore.subtreeIds', () => {
  it('returns a category id plus every descendant id, however deeply nested', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '1', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
      { id: '2', name: 'Продукты', emoji: '🛒', parentId: '1', archived: false },
      { id: '3', name: 'Кафе', emoji: '☕', parentId: '1', archived: false },
      { id: '5', name: 'Латте', emoji: '🥛', parentId: '3', archived: false },
      { id: '4', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.subtreeIds('1')).toEqual(['1', '2', '3', '5']);
  });

  it('returns just the category itself when it is a leaf', async () => {
    categoriesDb.listCategories.mockResolvedValue([
      { id: '4', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
    ]);
    const store = useCategoriesStore();
    await store.load();
    expect(store.subtreeIds('4')).toEqual(['4']);
  });
});

describe('useCategoriesStore.archive', () => {
  it('delegates to the db layer and reloads', async () => {
    categoriesDb.listCategories.mockResolvedValue([]);
    categoriesDb.archiveCategory.mockResolvedValue(undefined);
    const store = useCategoriesStore();
    await store.archive('1');
    expect(categoriesDb.archiveCategory).toHaveBeenCalledWith('1');
    expect(categoriesDb.listCategories).toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- src/stores/categories.spec.js`
Expected: FAIL — module `./categories.js` does not exist in `src/stores/`.

- [ ] **Step 8: Implement `src/stores/categories.js`**

```js
import { defineStore } from 'pinia';
import * as categoriesDb from '../db/categories.js';

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    items: [],
  }),
  getters: {
    active: (state) => state.items.filter((c) => !c.archived),
    rootCategories() {
      return this.active.filter((c) => c.parentId === null);
    },
    childrenOf() {
      return (parentId) => this.active.filter((c) => c.parentId === parentId);
    },
    byId: (state) => (id) => state.items.find((c) => c.id === id),
    // A category's subtree is itself plus every descendant, found by walking
    // childrenOf recursively. Pure category-tree shape (no transactions
    // involved), so it lives next to childrenOf/rootCategories rather than
    // inside whichever component first needs it — CategoryPie (Task 19)
    // sums a parent's spend by looking up every leaf under it via this
    // getter, and any future consumer needing "this category and everything
    // under it" (e.g. warning on delete, or another aggregate view) can
    // reuse it too, instead of re-deriving the same walk.
    subtreeIds() {
      const walk = (categoryId) => {
        const ids = [categoryId];
        for (const child of this.childrenOf(categoryId)) {
          ids.push(...walk(child.id));
        }
        return ids;
      };
      return walk;
    },
  },
  actions: {
    async load() {
      await categoriesDb.seedDefaultCategoryIfEmpty();
      this.items = await categoriesDb.listCategories();
    },
    async create({ name, emoji, parentId = null }) {
      const category = await categoriesDb.createCategory({ name, emoji, parentId });
      this.items.push(category);
      return category;
    },
    async archive(id) {
      await categoriesDb.archiveCategory(id);
      this.items = await categoriesDb.listCategories();
    },
    async remove(id) {
      await categoriesDb.deleteCategory(id);
      this.items = await categoriesDb.listCategories();
    },
  },
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- src/stores/categories.spec.js`
Expected: PASS (6 tests).

**Note added during Task 19's review:** `subtreeIds` didn't exist when this task was first written — CategoryPie (Task 19) originally implemented the same recursive walk locally, then it was moved here since it's pure category-tree logic with no dependency on CategoryPie or transactions, the same reasoning as `childrenOf`/`rootCategories` already living on this store. Include it now rather than adding it in Task 19.

- [ ] **Step 10: Commit**

```bash
git add src/db/index.js src/db/categories.js src/db/categories.spec.js src/stores/categories.js src/stores/categories.spec.js
git commit -m "feat: add categories DB layer and Pinia store"
```

---

## Task 8: Budget math formula + rate history

**Files:**
- Create: `src/utils/budgetMath.js`
- Test: `src/utils/budgetMath.spec.js`
- Create: `src/db/budgetRates.js`
- Test: `src/db/budgetRates.spec.js`
- Create: `src/stores/budgetRates.js`
- Test: `src/stores/budgetRates.spec.js`

This is the core formula from spec §7. Test cases are the exact worked examples confirmed during design: a backdated transaction recomputes the running balance globally, and a mid-month rate change applies only forward.

- [ ] **Step 1: Write the failing test for the pure formula**

```js
// src/utils/budgetMath.spec.js
import { describe, it, expect } from 'vitest';
import { calculateAccrual, calculateSpend, calculateAvailable } from './budgetMath.js';

describe('calculateAccrual', () => {
  it('multiplies a single flat rate by days elapsed', () => {
    const segments = [{ amount: 2500, effectiveFrom: '2026-07-01' }];
    expect(calculateAccrual('2026-07', 10, segments)).toBe(25000);
  });

  it('applies a mid-month rate change only from its effective date forward', () => {
    // Worked example from the design session: day 20 of the month, 2500 -> 3500.
    const segments = [
      { amount: 2500, effectiveFrom: '2026-07-01' },
      { amount: 3500, effectiveFrom: '2026-07-20' },
    ];
    // days 1-19 at 2500 (19 days) + days 20-30 at 3500 (11 days)
    expect(calculateAccrual('2026-07', 30, segments)).toBe(19 * 2500 + 11 * 3500);
  });

  it('returns 0 when no rate has ever been set', () => {
    expect(calculateAccrual('2026-07', 10, [])).toBe(0);
  });
});

describe('calculateSpend', () => {
  it('sums only transactions within the month, up to the elapsed cutoff', () => {
    const transactions = [
      { date: '2026-07-05', amount: 2000 },
      { date: '2026-06-30', amount: 9999 }, // different month, excluded
      { date: '2026-07-15', amount: 500 }, // after cutoff, excluded
    ];
    expect(calculateSpend('2026-07', 10, transactions)).toBe(2000);
  });

  it('includes a backdated transaction added after the fact', () => {
    const transactions = [
      { date: '2026-07-05', amount: 2000 },
      { date: '2026-07-03', amount: 1000 }, // logged late, dated earlier in the month
    ];
    expect(calculateSpend('2026-07', 10, transactions)).toBe(3000);
  });
});

describe('calculateAvailable', () => {
  it('reflects the exact worked example from the design session', () => {
    // Daily budget 2500, day 10, a backdated 1000 expense from day 3 plus a 2000 expense from day 5.
    const result = calculateAvailable({
      monthKey: '2026-07',
      daysElapsed: 10,
      rateSegments: [{ amount: 2500, effectiveFrom: '2026-07-01' }],
      transactions: [
        { date: '2026-07-05', amount: 2000 },
        { date: '2026-07-03', amount: 1000 },
      ],
    });
    expect(result).toBe(25000 - 3000); // 22000
  });

  it('goes negative on overspend', () => {
    const result = calculateAvailable({
      monthKey: '2026-07',
      daysElapsed: 5,
      rateSegments: [{ amount: 2500, effectiveFrom: '2026-07-01' }],
      transactions: [{ date: '2026-07-02', amount: 20000 }],
    });
    expect(result).toBe(12500 - 20000); // -7500
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/budgetMath.spec.js`
Expected: FAIL — module `./budgetMath.js` does not exist.

- [ ] **Step 3: Implement `src/utils/budgetMath.js`**

```js
function dateKeyForDay(monthKey, day) {
  return `${monthKey}-${String(day).padStart(2, '0')}`;
}

function rateActiveOn(dateKey, sortedSegments) {
  let active = sortedSegments[0] ?? { amount: 0 };
  for (const segment of sortedSegments) {
    if (segment.effectiveFrom <= dateKey) active = segment;
    else break;
  }
  return active.amount;
}

export function calculateAccrual(monthKey, daysElapsed, rateSegments) {
  const sorted = [...rateSegments].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  let total = 0;
  for (let day = 1; day <= daysElapsed; day += 1) {
    total += rateActiveOn(dateKeyForDay(monthKey, day), sorted);
  }
  return total;
}

export function calculateSpend(monthKey, daysElapsed, transactions) {
  if (daysElapsed === 0) return 0;
  const cutoff = dateKeyForDay(monthKey, daysElapsed);
  return transactions
    .filter((t) => t.date.startsWith(monthKey) && t.date <= cutoff)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function calculateAvailable({ monthKey, daysElapsed, rateSegments, transactions }) {
  return (
    calculateAccrual(monthKey, daysElapsed, rateSegments) -
    calculateSpend(monthKey, daysElapsed, transactions)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/budgetMath.spec.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing test for the rate-history DB layer**

```js
// src/db/budgetRates.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores } from './index.js';
import { addRate, listRates, seedDefaultRateIfEmpty } from './budgetRates.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('seedDefaultRateIfEmpty', () => {
  it('creates a 2500 rate effective today when none exists', async () => {
    await seedDefaultRateIfEmpty();
    const rates = await listRates();
    expect(rates).toHaveLength(1);
    expect(rates[0].amount).toBe(2500);
  });

  it('does nothing if a rate already exists', async () => {
    await addRate({ amount: 3000, effectiveFrom: '2026-01-01' });
    await seedDefaultRateIfEmpty();
    const rates = await listRates();
    expect(rates).toHaveLength(1);
    expect(rates[0].amount).toBe(3000);
  });
});

describe('addRate', () => {
  it('appends a new segment without touching earlier ones', async () => {
    await addRate({ amount: 2500, effectiveFrom: '2026-07-01' });
    await addRate({ amount: 3500, effectiveFrom: '2026-07-20' });
    const rates = await listRates();
    expect(rates.map((r) => r.amount).sort()).toEqual([2500, 3500]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/db/budgetRates.spec.js`
Expected: FAIL — module `./budgetRates.js` does not exist.

- [ ] **Step 7: Implement `src/db/budgetRates.js`**

```js
import { getDb } from './index.js';
import { todayKey } from '../utils/date.js';

export async function addRate({ amount, effectiveFrom }) {
  const db = await getDb();
  const rate = { id: crypto.randomUUID(), amount, effectiveFrom };
  await db.add('budgetRates', rate);
  return rate;
}

export async function listRates() {
  const db = await getDb();
  return db.getAll('budgetRates');
}

export async function seedDefaultRateIfEmpty(defaultAmount = 2500) {
  const db = await getDb();
  const count = await db.count('budgetRates');
  if (count === 0) {
    await addRate({ amount: defaultAmount, effectiveFrom: todayKey() });
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/db/budgetRates.spec.js`
Expected: PASS (3 tests).

- [ ] **Step 9: Write the failing test for the rates store**

```js
// src/stores/budgetRates.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBudgetRatesStore } from './budgetRates.js';
import * as ratesDb from '../db/budgetRates.js';

vi.mock('../db/budgetRates.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  ratesDb.seedDefaultRateIfEmpty.mockResolvedValue(undefined);
});

describe('useBudgetRatesStore.currentRate', () => {
  it('is the amount of the most recently effective segment', async () => {
    ratesDb.listRates.mockResolvedValue([
      { id: '1', amount: 2500, effectiveFrom: '2026-07-01' },
      { id: '2', amount: 3500, effectiveFrom: '2026-07-20' },
    ]);
    const store = useBudgetRatesStore();
    await store.load();
    expect(store.currentRate).toBe(3500);
  });

  it('is 0 when no rate has been set yet', async () => {
    ratesDb.listRates.mockResolvedValue([]);
    const store = useBudgetRatesStore();
    await store.load();
    expect(store.currentRate).toBe(0);
  });
});

describe('useBudgetRatesStore.setRate', () => {
  it('adds a new segment effective today and reloads', async () => {
    ratesDb.addRate.mockResolvedValue({ id: '3', amount: 4000, effectiveFrom: '2026-07-27' });
    ratesDb.listRates.mockResolvedValue([{ id: '3', amount: 4000, effectiveFrom: '2026-07-27' }]);
    const store = useBudgetRatesStore();
    await store.setRate(4000);
    expect(ratesDb.addRate).toHaveBeenCalledWith(expect.objectContaining({ amount: 4000 }));
    expect(store.currentRate).toBe(4000);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm test -- src/stores/budgetRates.spec.js`
Expected: FAIL — module `./budgetRates.js` does not exist in `src/stores/`.

- [ ] **Step 11: Implement `src/stores/budgetRates.js`**

```js
import { defineStore } from 'pinia';
import * as ratesDb from '../db/budgetRates.js';
import { todayKey } from '../utils/date.js';

export const useBudgetRatesStore = defineStore('budgetRates', {
  state: () => ({
    segments: [],
  }),
  getters: {
    currentRate(state) {
      if (state.segments.length === 0) return 0;
      const sorted = [...state.segments].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
      return sorted[sorted.length - 1].amount;
    },
  },
  actions: {
    async load() {
      await ratesDb.seedDefaultRateIfEmpty();
      this.segments = await ratesDb.listRates();
    },
    async setRate(amount) {
      await ratesDb.addRate({ amount, effectiveFrom: todayKey() });
      this.segments = await ratesDb.listRates();
    },
  },
});
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test -- src/stores/budgetRates.spec.js`
Expected: PASS (3 tests).

- [ ] **Step 13: Commit**

```bash
git add src/utils/budgetMath.js src/utils/budgetMath.spec.js src/db/budgetRates.js src/db/budgetRates.spec.js src/stores/budgetRates.js src/stores/budgetRates.spec.js
git commit -m "feat: add daily-budget formula and rate-history store"
```

---

## Task 9: Transactions (DB layer + store) and the composed budget store

**Files:**
- Create: `src/db/transactions.js`
- Test: `src/db/transactions.spec.js`
- Create: `src/stores/transactions.js`
- Test: `src/stores/transactions.spec.js`
- Create: `src/stores/budget.js`
- Test: `src/stores/budget.spec.js`

`budget.js` composes the rates store and the transactions store through `budgetMath.js` — it is the store screens actually consume for "available today" / "spend this month" (spec §10).

- [ ] **Step 1: Write the failing test for the transactions DB layer**

```js
// src/db/transactions.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores } from './index.js';
import { createTransaction, listTransactions, updateTransaction, deleteTransaction } from './transactions.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('createTransaction / listTransactions', () => {
  it('persists a transaction', async () => {
    await createTransaction({ amount: 500, date: '2026-07-20', categoryId: 'cat-1' });
    const all = await listTransactions();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ amount: 500, date: '2026-07-20', categoryId: 'cat-1' });
  });
});

describe('updateTransaction', () => {
  it('changes only the given fields', async () => {
    const created = await createTransaction({ amount: 500, date: '2026-07-20', categoryId: 'cat-1' });
    const updated = await updateTransaction(created.id, { amount: 750 });
    expect(updated.amount).toBe(750);
    expect(updated.categoryId).toBe('cat-1');
  });

  it('throws for an unknown id', async () => {
    await expect(updateTransaction('missing', { amount: 1 })).rejects.toThrow();
  });
});

describe('deleteTransaction', () => {
  it('removes the transaction', async () => {
    const created = await createTransaction({ amount: 500, date: '2026-07-20', categoryId: 'cat-1' });
    await deleteTransaction(created.id);
    expect(await listTransactions()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/db/transactions.spec.js`
Expected: FAIL — module `./transactions.js` does not exist.

- [ ] **Step 3: Implement `src/db/transactions.js`**

```js
import { getDb } from './index.js';

export async function createTransaction({ amount, date, categoryId }) {
  const db = await getDb();
  const transaction = { id: crypto.randomUUID(), amount, date, categoryId };
  await db.add('transactions', transaction);
  return transaction;
}

export async function listTransactions() {
  const db = await getDb();
  return db.getAll('transactions');
}

export async function updateTransaction(id, changes) {
  const db = await getDb();
  const existing = await db.get('transactions', id);
  if (!existing) throw new Error(`Transaction ${id} not found`);
  const updated = { ...existing, ...changes };
  await db.put('transactions', updated);
  return updated;
}

export async function deleteTransaction(id) {
  const db = await getDb();
  await db.delete('transactions', id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/db/transactions.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for the transactions store**

```js
// src/stores/transactions.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTransactionsStore } from './transactions.js';
import * as transactionsDb from '../db/transactions.js';

vi.mock('../db/transactions.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('useTransactionsStore.create', () => {
  it('appends the created transaction to items', async () => {
    transactionsDb.createTransaction.mockResolvedValue({ id: '1', amount: 500, date: '2026-07-20', categoryId: 'c1' });
    const store = useTransactionsStore();
    await store.create({ amount: 500, date: '2026-07-20', categoryId: 'c1' });
    expect(store.items).toHaveLength(1);
  });
});

describe('useTransactionsStore.remove', () => {
  it('removes the transaction from items', async () => {
    transactionsDb.createTransaction.mockResolvedValue({ id: '1', amount: 500, date: '2026-07-20', categoryId: 'c1' });
    transactionsDb.deleteTransaction.mockResolvedValue(undefined);
    const store = useTransactionsStore();
    await store.create({ amount: 500, date: '2026-07-20', categoryId: 'c1' });
    await store.remove('1');
    expect(store.items).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/stores/transactions.spec.js`
Expected: FAIL — module `./transactions.js` does not exist in `src/stores/`.

- [ ] **Step 7: Implement `src/stores/transactions.js`**

```js
import { defineStore } from 'pinia';
import * as transactionsDb from '../db/transactions.js';

export const useTransactionsStore = defineStore('transactions', {
  state: () => ({
    items: [],
  }),
  actions: {
    async load() {
      this.items = await transactionsDb.listTransactions();
    },
    async create({ amount, date, categoryId }) {
      const transaction = await transactionsDb.createTransaction({ amount, date, categoryId });
      this.items.push(transaction);
      return transaction;
    },
    async update(id, changes) {
      const updated = await transactionsDb.updateTransaction(id, changes);
      const index = this.items.findIndex((t) => t.id === id);
      if (index !== -1) this.items[index] = updated;
      return updated;
    },
    async remove(id) {
      await transactionsDb.deleteTransaction(id);
      this.items = this.items.filter((t) => t.id !== id);
    },
  },
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/stores/transactions.spec.js`
Expected: PASS (2 tests).

- [ ] **Step 9: Write the failing test for the composed budget store**

```js
// src/stores/budget.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBudgetStore } from './budget.js';
import { useBudgetRatesStore } from './budgetRates.js';
import { useTransactionsStore } from './transactions.js';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('useBudgetStore.availableForMonth', () => {
  it('combines rate segments and transactions through the shared formula', () => {
    useBudgetRatesStore().segments = [{ amount: 2500, effectiveFrom: '2026-07-01' }];
    useTransactionsStore().items = [
      { date: '2026-07-05', amount: 2000 },
      { date: '2026-07-03', amount: 1000 },
    ];

    const budget = useBudgetStore();
    expect(budget.availableForMonth('2026-07', '2026-07-10')).toBe(22000);
  });
});

describe('useBudgetStore.spendForMonth', () => {
  it('sums transactions within the given month only', () => {
    useTransactionsStore().items = [
      { date: '2026-07-05', amount: 2000 },
      { date: '2026-06-30', amount: 500 },
    ];
    const budget = useBudgetStore();
    expect(budget.spendForMonth('2026-07')).toBe(2000);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm test -- src/stores/budget.spec.js`
Expected: FAIL — module `./budget.js` does not exist in `src/stores/`.

- [ ] **Step 11: Implement `src/stores/budget.js`**

```js
import { defineStore } from 'pinia';
import { useBudgetRatesStore } from './budgetRates.js';
import { useTransactionsStore } from './transactions.js';
import { calculateAvailable } from '../utils/budgetMath.js';
import { daysElapsedInMonth, todayKey } from '../utils/date.js';

export const useBudgetStore = defineStore('budget', {
  getters: {
    availableForMonth() {
      const rates = useBudgetRatesStore();
      const transactions = useTransactionsStore();
      return (monthKey, todayDateKey = todayKey()) => {
        const daysElapsed = daysElapsedInMonth(monthKey, todayDateKey);
        return calculateAvailable({
          monthKey,
          daysElapsed,
          rateSegments: rates.segments,
          transactions: transactions.items,
        });
      };
    },
    spendForMonth() {
      const transactions = useTransactionsStore();
      return (monthKey) =>
        transactions.items
          .filter((t) => t.date.startsWith(monthKey))
          .reduce((sum, t) => sum + t.amount, 0);
    },
  },
});
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test -- src/stores/budget.spec.js`
Expected: PASS (2 tests).

- [ ] **Step 13: Commit**

```bash
git add src/db/transactions.js src/db/transactions.spec.js src/stores/transactions.js src/stores/transactions.spec.js src/stores/budget.js src/stores/budget.spec.js
git commit -m "feat: add transactions store and composed budget store"
```

---

## Task 10: Debts and debt payments (DB layer + store)

**Files:**
- Create: `src/db/debts.js`
- Test: `src/db/debts.spec.js`
- Create: `src/stores/debts.js`
- Test: `src/stores/debts.spec.js`

Per spec §12: a debt's remaining balance is always derived (`amount − Σ payments`), payments are an append-only history, and a debt with remaining ≤ 0 is "closed" but never deleted. `direction` is `'owed_to_me'` or `'i_owe'`.

- [ ] **Step 1: Write the failing test for the debts DB layer**

```js
// src/db/debts.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores, getDb } from './index.js';
import { createDebt, listDebts, addPayment, listPayments, listAllPayments, deleteDebt } from './debts.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('createDebt / listDebts', () => {
  it('persists a debt with its direction', async () => {
    await createDebt({ name: 'Андрей — ремонт', amount: 15000, comment: 'занял на инструменты', direction: 'owed_to_me' });
    const all = await listDebts();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Андрей — ремонт', amount: 15000, direction: 'owed_to_me' });
  });
});

describe('addPayment / listPayments', () => {
  it('records a dated payment against a debt', async () => {
    const debt = await createDebt({ name: 'Лиза', amount: 3000, comment: '', direction: 'owed_to_me' });
    await addPayment({ debtId: debt.id, amount: 1000, date: '2026-07-10' });
    const payments = await listPayments(debt.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ amount: 1000, date: '2026-07-10' });
  });

  it('keeps payments for different debts separate', async () => {
    const a = await createDebt({ name: 'A', amount: 1000, comment: '', direction: 'i_owe' });
    const b = await createDebt({ name: 'B', amount: 1000, comment: '', direction: 'i_owe' });
    await addPayment({ debtId: a.id, amount: 100, date: '2026-07-10' });
    expect(await listPayments(a.id)).toHaveLength(1);
    expect(await listPayments(b.id)).toHaveLength(0);
    expect(await listAllPayments()).toHaveLength(1);
  });
});

describe('deleteDebt', () => {
  it('cascades to delete the debt and its payment history', async () => {
    const debt = await createDebt({ name: 'A', amount: 1000, comment: '', direction: 'i_owe' });
    await addPayment({ debtId: debt.id, amount: 100, date: '2026-07-10' });

    await deleteDebt(debt.id);

    expect(await listDebts()).toHaveLength(0);
    const db = await getDb();
    expect(await db.getAll('debtPayments')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/db/debts.spec.js`
Expected: FAIL — module `./debts.js` does not exist.

- [ ] **Step 3: Implement `src/db/debts.js`**

```js
import { getDb } from './index.js';

export async function createDebt({ name, amount, comment = '', direction }) {
  const db = await getDb();
  const debt = { id: crypto.randomUUID(), name, amount, comment, direction };
  await db.add('debts', debt);
  return debt;
}

export async function listDebts() {
  const db = await getDb();
  return db.getAll('debts');
}

export async function updateDebt(id, changes) {
  const db = await getDb();
  // Read and write share one transaction rather than being two separate
  // implicit ones with an await gap between them — the same TOCTOU shape
  // already found and fixed in categories.js, budgetRates.js, and
  // transactions.js: two concurrent partial updates to the same row would
  // otherwise both read the same pre-write snapshot and each overwrite the
  // other's field when they land.
  const tx = db.transaction('debts', 'readwrite');
  const existing = await tx.store.get(id);
  if (!existing) throw new Error(`Debt ${id} not found`);
  const updated = { ...existing, ...changes };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deleteDebt(id) {
  const db = await getDb();
  const tx = db.transaction(['debts', 'debtPayments'], 'readwrite');
  await tx.objectStore('debts').delete(id);
  const paymentsByDebt = tx.objectStore('debtPayments').index('debtId');
  let cursor = await paymentsByDebt.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function addPayment({ debtId, amount, date }) {
  const db = await getDb();
  const payment = { id: crypto.randomUUID(), debtId, amount, date };
  await db.add('debtPayments', payment);
  return payment;
}

export async function listPayments(debtId) {
  const db = await getDb();
  return db.getAllFromIndex('debtPayments', 'debtId', debtId);
}

export async function listAllPayments() {
  const db = await getDb();
  return db.getAll('debtPayments');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/db/debts.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for the debts store**

```js
// src/stores/debts.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDebtsStore } from './debts.js';
import * as debtsDb from '../db/debts.js';

vi.mock('../db/debts.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

function setupStore() {
  const store = useDebtsStore();
  store.items = [
    { id: 'd1', name: 'Андрей', amount: 15000, comment: '', direction: 'owed_to_me' },
    { id: 'd2', name: 'Максим', amount: 1200, comment: '', direction: 'owed_to_me' },
  ];
  store.payments = [
    { id: 'p1', debtId: 'd1', amount: 5000, date: '2026-07-02' },
    { id: 'p2', debtId: 'd2', amount: 1200, date: '2026-06-10' },
  ];
  return store;
}

describe('useDebtsStore.remainingOf', () => {
  it('is the original amount minus the sum of payments', () => {
    const store = setupStore();
    expect(store.remainingOf('d1')).toBe(10000);
  });
});

describe('useDebtsStore.openByDirection / closedByDirection', () => {
  it('splits debts by whether they are fully paid', () => {
    const store = setupStore();
    expect(store.openByDirection('owed_to_me').map((d) => d.id)).toEqual(['d1']);
    expect(store.closedByDirection('owed_to_me').map((d) => d.id)).toEqual(['d2']);
  });
});

describe('useDebtsStore.pay', () => {
  it('records a new payment and updates the remaining balance', async () => {
    const store = setupStore();
    debtsDb.addPayment.mockResolvedValue({ id: 'p3', debtId: 'd1', amount: 2000, date: '2026-07-27' });
    await store.pay('d1', 2000, '2026-07-27');
    expect(store.remainingOf('d1')).toBe(8000);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/stores/debts.spec.js`
Expected: FAIL — module `./debts.js` does not exist in `src/stores/`.

- [ ] **Step 7: Implement `src/stores/debts.js`**

```js
import { defineStore } from 'pinia';
import * as debtsDb from '../db/debts.js';

export const useDebtsStore = defineStore('debts', {
  state: () => ({
    items: [],
    payments: [],
  }),
  getters: {
    paymentsFor: (state) => (debtId) => state.payments.filter((p) => p.debtId === debtId),
    remainingOf() {
      return (debtId) => {
        const debt = this.items.find((d) => d.id === debtId);
        if (!debt) return 0;
        const paid = this.paymentsFor(debtId).reduce((sum, p) => sum + p.amount, 0);
        return debt.amount - paid;
      };
    },
    byDirection() {
      return (direction) => this.items.filter((d) => d.direction === direction);
    },
    openByDirection() {
      return (direction) => this.byDirection(direction).filter((d) => this.remainingOf(d.id) > 0);
    },
    closedByDirection() {
      return (direction) => this.byDirection(direction).filter((d) => this.remainingOf(d.id) <= 0);
    },
  },
  actions: {
    async load() {
      this.items = await debtsDb.listDebts();
      this.payments = await debtsDb.listAllPayments();
    },
    async create({ name, amount, comment, direction }) {
      const debt = await debtsDb.createDebt({ name, amount, comment, direction });
      this.items.push(debt);
      return debt;
    },
    async pay(debtId, amount, date) {
      const payment = await debtsDb.addPayment({ debtId, amount, date });
      this.payments.push(payment);
      return payment;
    },
    async remove(id) {
      await debtsDb.deleteDebt(id);
      this.items = this.items.filter((d) => d.id !== id);
      this.payments = this.payments.filter((p) => p.debtId !== id);
    },
  },
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/stores/debts.spec.js`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add src/db/debts.js src/db/debts.spec.js src/stores/debts.js src/stores/debts.spec.js
git commit -m "feat: add debts and debt-payments store"
```

---

**Checkpoint — data layer complete.** Tasks 1–10 cover every store the UI needs: categories, budget rates, transactions, the composed budget formula, and debts. Everything from here on is Vue components consuming these stores. Full `App.vue` wiring is deferred to Task 24, once every screen exists — no throwaway placeholder composition in between.

## Task 11: TabBar component

**Files:**
- Create: `src/components/layout/TabBar.vue`
- Test: `src/components/layout/TabBar.spec.js`

Per spec §11: exactly two tabs (Бюджет / Долги), no Settings tab, plus a FAB that reopens the expense modal.

- [ ] **Step 1: Write the failing test**

```js
// src/components/layout/TabBar.spec.js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TabBar from './TabBar.vue';

describe('TabBar', () => {
  it('renders exactly two tabs: Бюджет and Долги', () => {
    const wrapper = mount(TabBar, { props: { activeTab: 'budget' } });
    const labels = wrapper.findAll('.tab-bar__item').map((el) => el.text());
    expect(labels).toEqual(['💰Бюджет', '🤝Долги']);
  });

  it('marks the active tab', () => {
    const wrapper = mount(TabBar, { props: { activeTab: 'debts' } });
    const items = wrapper.findAll('.tab-bar__item');
    expect(items[1].classes()).toContain('tab-bar__item--active');
    expect(items[0].classes()).not.toContain('tab-bar__item--active');
  });

  it('emits update:active-tab with the tab id when clicked', async () => {
    const wrapper = mount(TabBar, { props: { activeTab: 'budget' } });
    await wrapper.findAll('.tab-bar__item')[1].trigger('click');
    expect(wrapper.emitted('update:active-tab')[0]).toEqual(['debts']);
  });

  it('emits add-expense when the FAB is clicked', async () => {
    const wrapper = mount(TabBar, { props: { activeTab: 'budget' } });
    await wrapper.find('.tab-bar__fab').trigger('click');
    expect(wrapper.emitted('add-expense')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/layout/TabBar.spec.js`
Expected: FAIL — module `./TabBar.vue` does not exist.

- [ ] **Step 3: Implement `src/components/layout/TabBar.vue`**

```vue
<template>
  <nav class="tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-bar__item"
      :class="{ 'tab-bar__item--active': tab.id === activeTab }"
      @click="$emit('update:active-tab', tab.id)"
    >
      <span class="tab-bar__icon">{{ tab.icon }}</span>{{ tab.label }}
    </button>
    <button class="tab-bar__fab" aria-label="Добавить расход" @click="$emit('add-expense')">+</button>
  </nav>
</template>

<script>
export default {
  name: 'TabBar',
  props: {
    activeTab: {
      type: String,
      required: true,
    },
  },
  emits: ['update:active-tab', 'add-expense'],
  data() {
    return {
      tabs: [
        { id: 'budget', label: 'Бюджет', icon: '💰' },
        { id: 'debts', label: 'Долги', icon: '🤝' },
      ],
    };
  },
};
</script>

<style lang="scss">
.tab-bar {
  display: flex;
  align-items: center;
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 8px 18px calc(env(safe-area-inset-bottom, 0px) + 8px);
  position: relative;

  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 0;
    color: var(--ink-muted);
    font-size: 10px;
    font-weight: 600;

    &--active {
      color: var(--accent-strong);
    }
  }

  &__icon {
    font-size: 19px;
    display: block;
  }

  &__fab {
    position: absolute;
    right: 16px;
    top: -24px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 22px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/layout/TabBar.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/TabBar.vue src/components/layout/TabBar.spec.js
git commit -m "feat: add TabBar component"
```

---

## Task 12: TopBar shell + MonthNav

**Files:**
- Create: `src/components/layout/TopBar.vue`
- Test: `src/components/layout/TopBar.spec.js`
- Create: `src/components/layout/MonthNav.vue`
- Test: `src/components/layout/MonthNav.spec.js`

`TopBar` is a generic slotted shell (title or custom left content, optional right-side action) reused by every screen. `MonthNav` is the dashboard-specific prev/label/next control that gets slotted into it — kept separate because Долги and Настройки need a top bar but never need month navigation.

- [ ] **Step 1: Write the failing test for TopBar**

```js
// src/components/layout/TopBar.spec.js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TopBar from './TopBar.vue';

describe('TopBar', () => {
  it('renders a plain title by default', () => {
    const wrapper = mount(TopBar, { props: { title: 'Долги' } });
    expect(wrapper.find('.top-bar__title').text()).toBe('Долги');
  });

  it('renders custom left content via the left slot instead of the title', () => {
    const wrapper = mount(TopBar, {
      props: { title: 'ignored' },
      slots: { left: '<span class="custom-left">custom</span>' },
    });
    expect(wrapper.find('.custom-left').exists()).toBe(true);
    expect(wrapper.find('.top-bar__title').exists()).toBe(false);
  });

  it('renders right-side content via the right slot', () => {
    const wrapper = mount(TopBar, {
      props: { title: 'Настройки' },
      slots: { right: '<button class="gear">⚙️</button>' },
    });
    expect(wrapper.find('.gear').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/layout/TopBar.spec.js`
Expected: FAIL — module `./TopBar.vue` does not exist.

- [ ] **Step 3: Implement `src/components/layout/TopBar.vue`**

```vue
<template>
  <div class="top-bar">
    <div class="top-bar__left">
      <slot name="left">
        <span class="top-bar__title">{{ title }}</span>
      </slot>
    </div>
    <div class="top-bar__right">
      <slot name="right" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'TopBar',
  props: {
    title: {
      type: String,
      default: '',
    },
  },
};
</script>

<style lang="scss">
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px 14px;

  &__title {
    font-size: 17px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/layout/TopBar.spec.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test for MonthNav**

```js
// src/components/layout/MonthNav.spec.js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MonthNav from './MonthNav.vue';

describe('MonthNav', () => {
  it('shows the given label', () => {
    const wrapper = mount(MonthNav, { props: { label: 'Июль 2026' } });
    expect(wrapper.find('.month-nav__label').text()).toBe('Июль 2026');
  });

  it('emits prev and next when the arrows are clicked', async () => {
    const wrapper = mount(MonthNav, { props: { label: 'Июль 2026' } });
    await wrapper.find('.month-nav__arrow--prev').trigger('click');
    await wrapper.find('.month-nav__arrow--next').trigger('click');
    expect(wrapper.emitted('prev')).toHaveLength(1);
    expect(wrapper.emitted('next')).toHaveLength(1);
  });

  it('disables the next arrow when canGoNext is false', () => {
    const wrapper = mount(MonthNav, { props: { label: 'Июль 2026', canGoNext: false } });
    expect(wrapper.find('.month-nav__arrow--next').attributes('disabled')).toBeDefined();
  });

  it('disables the prev arrow when canGoPrev is false', () => {
    const wrapper = mount(MonthNav, { props: { label: 'Январь 2026', canGoPrev: false } });
    expect(wrapper.find('.month-nav__arrow--prev').attributes('disabled')).toBeDefined();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/components/layout/MonthNav.spec.js`
Expected: FAIL — module `./MonthNav.vue` does not exist.

- [ ] **Step 7: Implement `src/components/layout/MonthNav.vue`**

```vue
<template>
  <div class="month-nav">
    <button
      class="month-nav__arrow month-nav__arrow--prev"
      :disabled="!canGoPrev"
      aria-label="Предыдущий месяц"
      @click="$emit('prev')"
    >‹</button>
    <span class="month-nav__label">{{ label }}</span>
    <button
      class="month-nav__arrow month-nav__arrow--next"
      :disabled="!canGoNext"
      aria-label="Следующий месяц"
      @click="$emit('next')"
    >›</button>
  </div>
</template>

<script>
export default {
  name: 'MonthNav',
  props: {
    label: {
      type: String,
      required: true,
    },
    canGoPrev: {
      type: Boolean,
      default: true,
    },
    canGoNext: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['prev', 'next'],
};
</script>

<style lang="scss">
.month-nav {
  display: flex;
  align-items: center;
  gap: 2px;

  &__arrow {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: var(--ink-muted);

    &:disabled {
      opacity: 0.25;
      pointer-events: none;
    }
  }

  &__label {
    font-size: 17px;
    font-weight: 650;
    letter-spacing: -0.01em;
    min-width: 126px;
    text-align: center;
  }
}
</style>
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/components/layout/MonthNav.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/components/layout/TopBar.vue src/components/layout/TopBar.spec.js src/components/layout/MonthNav.vue src/components/layout/MonthNav.spec.js
git commit -m "feat: add TopBar shell and MonthNav components"
```

---

## Task 13: Toast notification

**Files:**
- Create: `src/stores/toast.js`
- Test: `src/stores/toast.spec.js`
- Create: `src/components/layout/Toast.vue`
- Test: `src/components/layout/Toast.spec.js`

Per spec §8, committing an expense from the modal shows a brief confirmation. The store owns the message and its auto-hide timer; the component is purely presentational.

- [ ] **Step 1: Write the failing test for the toast store**

```js
// src/stores/toast.spec.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useToastStore } from './toast.js';

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useToastStore.show', () => {
  it('sets the message immediately', () => {
    const store = useToastStore();
    store.show('Добавлено: 🍔 Еда · 1 240 ₽');
    expect(store.message).toBe('Добавлено: 🍔 Еда · 1 240 ₽');
  });

  it('clears the message after the default duration', () => {
    const store = useToastStore();
    store.show('Тест');
    vi.advanceTimersByTime(2200);
    expect(store.message).toBe('');
  });

  it('restarts the timer if a new toast arrives before the old one clears', () => {
    const store = useToastStore();
    store.show('Первое');
    vi.advanceTimersByTime(1000);
    store.show('Второе');
    vi.advanceTimersByTime(1500);
    expect(store.message).toBe('Второе');
    vi.advanceTimersByTime(1000);
    expect(store.message).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/stores/toast.spec.js`
Expected: FAIL — module `./toast.js` does not exist.

- [ ] **Step 3: Implement `src/stores/toast.js`**

```js
import { defineStore } from 'pinia';

// Module-level (not state): a setTimeout handle isn't serializable app state
// and never needs to be reactive — it only exists to let a new show() cancel
// a still-pending hide from a previous toast.
let hideTimer = null;

export const useToastStore = defineStore('toast', {
  state: () => ({
    message: '',
  }),
  actions: {
    show(message, duration = 2200) {
      this.message = message;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        this.message = '';
      }, duration);
    },
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/stores/toast.spec.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test for the Toast component**

```js
// src/components/layout/Toast.spec.js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Toast from './Toast.vue';

describe('Toast', () => {
  it('renders nothing when there is no message', () => {
    const wrapper = mount(Toast, { props: { message: '' } });
    expect(wrapper.find('.toast').exists()).toBe(false);
  });

  it('renders the message when present', () => {
    const wrapper = mount(Toast, { props: { message: 'Готово' } });
    expect(wrapper.find('.toast').text()).toBe('Готово');
  });

  it('announces itself to assistive tech via a polite status live region', () => {
    // Toast has no focus target and disappears on its own timer — without
    // role="status" + aria-live, a screen-reader user gets no signal it
    // appeared at all.
    const wrapper = mount(Toast, { props: { message: 'Готово' } });
    const toast = wrapper.find('.toast');
    expect(toast.attributes('role')).toBe('status');
    expect(toast.attributes('aria-live')).toBe('polite');
    expect(toast.attributes('aria-atomic')).toBe('true');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/components/layout/Toast.spec.js`
Expected: FAIL — module `./Toast.vue` does not exist.

- [ ] **Step 7: Implement `src/components/layout/Toast.vue`**

```vue
<template>
  <Transition name="toast">
    <div v-if="message" class="toast" role="status" aria-live="polite" aria-atomic="true">{{ message }}</div>
  </Transition>
</template>

<script>
export default {
  name: 'Toast',
  props: {
    message: {
      type: String,
      default: '',
    },
  },
};
</script>

<style lang="scss">
.toast {
  // Rendered inside .app-shell__tabs (see Task 25), a non-scrolling wrapper
  // shared with TabBar. bottom: 100% + margin-bottom sits it just above that
  // wrapper's top edge — i.e. just above TabBar's actual rendered height,
  // whatever that emergently turns out to be — without ever needing to know
  // that height as a number. A guessed pixel constant was tried first and
  // measurably wrong (real TabBar height ≠ the guess); anchoring to the
  // wrapper's own top edge is exact by construction instead of by estimate.
  position: absolute;
  left: 50%;
  bottom: 100%;
  margin-bottom: 12px;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--ground);
  font-size: 13px;
  font-weight: 600;
  padding: 11px 18px;
  border-radius: 12px;
  white-space: nowrap;
  z-index: 50;

  &-enter-active,
  &-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
  }

  &-enter-from,
  &-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
}
</style>
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/components/layout/Toast.spec.js`
Expected: PASS (3 tests).

**Note:** `Toast` renders standalone here, so this step's manual/automated check can only confirm it mounts — it has no positioned ancestor yet to anchor `bottom: 100%` against. That containing-block wrapper (`.app-shell__tabs`) is introduced in Task 25, which is also where this component gets composed next to `TabBar` for real. Task 25's plan text already reflects the corrected structure — do not reintroduce a flat, un-wrapped `<TabBar/><Toast/>` sibling pair there.

- [ ] **Step 9: Commit**

```bash
git add src/stores/toast.js src/stores/toast.spec.js src/components/layout/Toast.vue src/components/layout/Toast.spec.js
git commit -m "feat: add toast store and component"
```

---

## Task 14: Keypad component

**Files:**
- Create: `src/components/expense/Keypad.vue`
- Test: `src/components/expense/Keypad.spec.js`

A "dumb" component — it only emits which key was pressed. `evaluateExpression` (Task 6) stays the single source of truth for math; Keypad never evaluates anything itself.

- [ ] **Step 1: Write the failing test**

```js
// src/components/expense/Keypad.spec.js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Keypad from './Keypad.vue';

describe('Keypad', () => {
  it('renders 16 keys in calculator order', () => {
    const wrapper = mount(Keypad);
    const labels = wrapper.findAll('.keypad__key').map((b) => b.text());
    expect(labels).toEqual([
      '7', '8', '9', '÷',
      '4', '5', '6', '×',
      '1', '2', '3', '−',
      ',', '0', '⌫', '+',
    ]);
  });

  it('emits "key" with the digit value when a digit is pressed', async () => {
    const wrapper = mount(Keypad);
    await wrapper.findAll('.keypad__key')[0].trigger('click');
    expect(wrapper.emitted('key')[0]).toEqual(['7']);
  });

  it('emits "key" with "del" for the delete button', async () => {
    const wrapper = mount(Keypad);
    await wrapper.findAll('.keypad__key')[14].trigger('click');
    expect(wrapper.emitted('key')[0]).toEqual(['del']);
  });

  it('marks the four operator keys distinctly from digits', () => {
    const wrapper = mount(Keypad);
    const keys = wrapper.findAll('.keypad__key');
    expect(keys[3].classes()).toContain('keypad__key--op'); // ÷
    expect(keys[0].classes()).not.toContain('keypad__key--op'); // 7
  });

  it('labels the delete key for assistive tech, since ⌫ alone has no guaranteed spoken reading', () => {
    const wrapper = mount(Keypad);
    const keys = wrapper.findAll('.keypad__key');
    expect(keys[14].attributes('aria-label')).toBe('Стереть');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/expense/Keypad.spec.js`
Expected: FAIL — module `./Keypad.vue` does not exist.

- [ ] **Step 3: Implement `src/components/expense/Keypad.vue`**

Every button in this codebase gets an explicit `type="button"` (established starting with Task 11's TabBar) — include it here too even though it's easy to forget on a component this simple.

```vue
<template>
  <div class="keypad">
    <button
      v-for="key in keys"
      :key="key.value"
      type="button"
      class="keypad__key"
      :class="{ 'keypad__key--op': key.type === 'op', 'keypad__key--del': key.type === 'del' }"
      :aria-label="key.ariaLabel || null"
      @click="$emit('key', key.value)"
    >{{ key.label }}</button>
  </div>
</template>

<script>
export default {
  name: 'Keypad',
  emits: ['key'],
  data() {
    return {
      keys: [
        { value: '7', label: '7' }, { value: '8', label: '8' }, { value: '9', label: '9' }, { value: '÷', label: '÷', type: 'op' },
        { value: '4', label: '4' }, { value: '5', label: '5' }, { value: '6', label: '6' }, { value: '×', label: '×', type: 'op' },
        { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '−', label: '−', type: 'op' },
        { value: ',', label: ',' }, { value: '0', label: '0' }, { value: 'del', label: '⌫', type: 'del', ariaLabel: 'Стереть' }, { value: '+', label: '+', type: 'op' },
      ],
    };
  },
};
</script>

<style lang="scss">
.keypad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 14px;

  &__key {
    height: 50px;
    border-radius: 13px;
    background: var(--surface-sunken);
    font-size: 19px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-money);

    &--op {
      background: transparent;
      color: var(--accent-strong);
      font-family: var(--font-ui);
    }

    &--del {
      color: var(--negative);
      font-family: var(--font-ui);
      font-size: 16px;
    }
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/expense/Keypad.spec.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/expense/Keypad.vue src/components/expense/Keypad.spec.js
git commit -m "feat: add Keypad component"
```

---

## Task 15: CategoryPicker (drill-down list)

**Files:**
- Create: `src/components/expense/CategoryPicker.vue`
- Test: `src/components/expense/CategoryPicker.spec.js`

Per spec §8: infinite nesting is handled with an internal stack of category ids, not a recursive tree render — only one flat level is ever visible. Tapping a category with children drills in; tapping a leaf emits `pick`; a "‹ Назад" row (first row, only when not at the root) pops the stack.

- [ ] **Step 1: Write the failing test**

```js
// src/components/expense/CategoryPicker.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import CategoryPicker from './CategoryPicker.vue';
import { useCategoriesStore } from '../../stores/categories.js';

beforeEach(() => {
  setActivePinia(createPinia());
  const store = useCategoriesStore();
  store.items = [
    { id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
    { id: 'groceries', name: 'Продукты', emoji: '🛒', parentId: 'food', archived: false },
    { id: 'fun', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
  ];
});

describe('CategoryPicker at the root level', () => {
  it('lists root categories with a chevron only where children exist, no back row', () => {
    const wrapper = mount(CategoryPicker);
    const rows = wrapper.findAll('.category-picker__row');
    expect(rows).toHaveLength(2);
    expect(rows[0].find('.category-picker__name').text()).toBe('Еда');
    expect(rows[0].find('.category-picker__chevron').text()).toBe('›');
    expect(rows[1].find('.category-picker__chevron').text()).toBe('');
    expect(wrapper.find('.category-picker__row--back').exists()).toBe(false);
  });

  it('emits pick immediately for a leaf category', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[1].trigger('click'); // Развлечения
    expect(wrapper.emitted('pick')[0][0]).toMatchObject({ id: 'fun' });
  });
});

describe('CategoryPicker drill-down', () => {
  it('shows subcategories plus a back row after tapping a parent', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[0].trigger('click'); // Еда
    const rows = wrapper.findAll('.category-picker__row');
    expect(rows[0].classes()).toContain('category-picker__row--back');
    expect(rows[1].find('.category-picker__name').text()).toBe('Продукты');
  });

  it('does not emit pick when drilling into a parent category', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[0].trigger('click');
    expect(wrapper.emitted('pick')).toBeUndefined();
  });

  it('returns to the root level when Назад is clicked', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[0].trigger('click');
    await wrapper.find('.category-picker__row--back').trigger('click');
    expect(wrapper.find('.category-picker__row--back').exists()).toBe(false);
    const names = wrapper.findAll('.category-picker__row').map((r) => r.find('.category-picker__name').text());
    expect(names).toEqual(['Еда', 'Развлечения']);
  });
});

describe('CategoryPicker.reset (exposed for the parent to call after commit)', () => {
  it('collapses back to the root level', async () => {
    const wrapper = mount(CategoryPicker);
    await wrapper.findAll('.category-picker__row')[0].trigger('click'); // drill into Еда
    wrapper.vm.reset();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.category-picker__row--back').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/expense/CategoryPicker.spec.js`
Expected: FAIL — module `./CategoryPicker.vue` does not exist.

- [ ] **Step 3: Implement `src/components/expense/CategoryPicker.vue`**

```vue
<template>
  <div class="category-picker">
    <button v-if="stack.length" class="category-picker__row category-picker__row--back" @click="back">
      <span class="category-picker__emoji">‹</span>
      <span class="category-picker__name">Назад</span>
      <span class="category-picker__chevron"></span>
    </button>
    <button
      v-for="category in currentLevel"
      :key="category.id"
      class="category-picker__row"
      @click="select(category)"
    >
      <span class="category-picker__emoji">{{ category.emoji }}</span>
      <span class="category-picker__name">{{ category.name }}</span>
      <span class="category-picker__chevron">{{ hasChildren(category) ? '›' : '' }}</span>
    </button>
  </div>
</template>

<script>
import { useCategoriesStore } from '../../stores/categories.js';

export default {
  name: 'CategoryPicker',
  emits: ['pick'],
  data() {
    return {
      stack: [],
    };
  },
  computed: {
    categoriesStore() {
      return useCategoriesStore();
    },
    currentLevel() {
      const parentId = this.stack.length ? this.stack[this.stack.length - 1] : null;
      return parentId === null
        ? this.categoriesStore.rootCategories
        : this.categoriesStore.childrenOf(parentId);
    },
  },
  methods: {
    hasChildren(category) {
      return this.categoriesStore.childrenOf(category.id).length > 0;
    },
    select(category) {
      if (this.hasChildren(category)) {
        this.stack.push(category.id);
      } else {
        this.$emit('pick', category);
      }
    },
    back() {
      this.stack.pop();
    },
    reset() {
      this.stack = [];
    },
  },
};
</script>

<style lang="scss">
.category-picker {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  background: var(--surface-sunken);
  border-radius: 16px;
  padding: 6px;

  &__row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 8px;
    border-radius: 10px;
    text-align: left;
  }

  &__emoji {
    font-size: 19px;
    width: 28px;
    text-align: center;
    flex: 0 0 auto;
  }

  &__name {
    flex: 1 1 auto;
    font-size: 15px;
  }

  &__chevron {
    color: var(--ink-muted);
    font-size: 13px;
  }

  &__row--back {
    color: var(--accent-strong);
    font-weight: 600;

    .category-picker__emoji {
      font-size: 15px;
    }
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/expense/CategoryPicker.spec.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/expense/CategoryPicker.vue src/components/expense/CategoryPicker.spec.js
git commit -m "feat: add CategoryPicker with drill-down navigation"
```

---

## Task 16: DatePicker (today / yesterday / native)

**Files:**
- Create: `src/components/expense/DatePicker.vue`
- Test: `src/components/expense/DatePicker.spec.js`

Per spec §8: defaults to today, one-tap yesterday, and "Другая дата" opens the native iOS date picker via a real `<input type="date">` — never a custom-built calendar widget.

- [ ] **Step 1: Write the failing test**

```js
// src/components/expense/DatePicker.spec.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DatePicker from './DatePicker.vue';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 27)); // 27 July 2026
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DatePicker', () => {
  it('marks "Сегодня" active when modelValue is today', () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-27' } });
    expect(wrapper.findAll('.date-row__btn')[0].classes()).toContain('date-row__btn--active');
  });

  it('marks "Вчера" active when modelValue is yesterday', () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-26' } });
    expect(wrapper.findAll('.date-row__btn')[1].classes()).toContain('date-row__btn--active');
  });

  it('marks the native-date button active for any other date', () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-01' } });
    expect(wrapper.findAll('.date-row__btn')[2].classes()).toContain('date-row__btn--active');
  });

  it('emits update:modelValue with today when "Сегодня" is clicked', async () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-01' } });
    await wrapper.findAll('.date-row__btn')[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['2026-07-27']);
  });

  it('emits update:modelValue with yesterday when "Вчера" is clicked', async () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-01' } });
    await wrapper.findAll('.date-row__btn')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['2026-07-26']);
  });

  it('emits update:modelValue when the native date input changes', async () => {
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-27' } });
    await wrapper.find('.date-row__native').setValue('2026-07-10');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['2026-07-10']);
  });

  it('shows the formatted date on the native button when mounted directly with an "other" date, before any change event fires', () => {
    // Covers the edit-existing-transaction case (Task 17): the label must be
    // correct on first render, not only after the user interacts with the
    // native input themselves.
    const wrapper = mount(DatePicker, { props: { modelValue: '2026-07-01' } });
    expect(wrapper.findAll('.date-row__btn')[2].text()).toBe('1 июл.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/expense/DatePicker.spec.js`
Expected: FAIL — module `./DatePicker.vue` does not exist.

- [ ] **Step 3: Implement `src/components/expense/DatePicker.vue`**

```vue
<template>
  <div class="date-row">
    <button
      class="date-row__btn"
      :class="{ 'date-row__btn--active': mode === 'today' }"
      @click="$emit('update:modelValue', todayKeyValue())"
    >Сегодня</button>
    <button
      class="date-row__btn"
      :class="{ 'date-row__btn--active': mode === 'yesterday' }"
      @click="$emit('update:modelValue', yesterdayKeyValue())"
    >Вчера</button>
    <label class="date-row__btn" :class="{ 'date-row__btn--active': mode === 'other' }">
      <input type="date" class="date-row__native" :value="modelValue" @change="onNativeChange" />
      <span>{{ otherLabel }}</span>
    </label>
  </div>
</template>

<script>
import { todayKey, yesterdayKey } from '../../utils/date.js';

export default {
  name: 'DatePicker',
  props: {
    modelValue: {
      type: String,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  computed: {
    mode() {
      if (this.modelValue === todayKey()) return 'today';
      if (this.modelValue === yesterdayKey()) return 'yesterday';
      return 'other';
    },
    otherLabel() {
      // Derived from modelValue, not tracked as separate mutable state — it
      // must render correctly the instant this component mounts with an
      // existing "other" date (e.g. Task 17 editing a past transaction), not
      // only after the native input's own change handler has fired once.
      if (this.mode !== 'other') return 'Другая дата';
      // Build the label from local-time parts, not `new Date(value)` — a bare
      // YYYY-MM-DD string parses as UTC midnight and can render one day off
      // for anyone west of UTC (same class of bug fixed in Task 5's toDateKey).
      const [y, m, d] = this.modelValue.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    },
  },
  methods: {
    todayKeyValue: todayKey,
    yesterdayKeyValue: yesterdayKey,
    onNativeChange(event) {
      const value = event.target.value;
      if (!value) return;
      this.$emit('update:modelValue', value);
    },
  },
};
</script>

<style lang="scss">
.date-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;

  &__btn {
    position: relative;
    flex: 1;
    text-align: center;
    font-size: 12.5px;
    font-weight: 600;
    padding: 9px 4px;
    border-radius: 11px;
    background: var(--surface-sunken);
    color: var(--ink-secondary);
    border: 1px solid transparent;
    overflow: hidden;

    &--active {
      background: var(--accent-wash);
      color: var(--accent-strong);
      border-color: var(--accent);
    }

    // The third pill is a <label>, not a <button> — the global
    // button:focus-visible rule (_reset.scss) never matches it. Its real
    // control is the input below, whose own focus outline is invisible
    // (opacity: 0 suppresses it along with everything else), so without
    // this, Tab-cycling to the native date input shows no focus indicator
    // at all.
    &:focus-within {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  &__native {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/expense/DatePicker.spec.js`
Expected: PASS (7 tests).

**Verified in a real browser (not just jsdom):** the invisible native input's hit area covers the whole visible pill — `elementFromPoint` at all four corners and the center of the label all resolve to the input, not just its center — and the `:focus-within` outline renders at the correct size/color when the input is focused. This class of bug (CSS that unit tests can't see) has bitten this project twice before (MonthNav's hit-slop, Toast's position), so it's worth this quick check rather than trusting the CSS by inspection alone.

- [ ] **Step 5: Commit**

```bash
git add src/components/expense/DatePicker.vue src/components/expense/DatePicker.spec.js
git commit -m "feat: add DatePicker component"
```

---

## Task 17: ExpenseModal (compose + commit/edit/delete)

**Files:**
- Create: `src/components/expense/ExpenseModal.vue`
- Test: `src/components/expense/ExpenseModal.spec.js`

Composes Keypad + DatePicker + CategoryPicker. Per spec §8: closing without input never loses a half-typed amount (handled by the parent controlling `visible` — swipe/backdrop-tap wiring happens in Task 24's App.vue, not here). Committing in **add** mode resets and stays open for rapid consecutive entries; committing in **edit** mode closes.

**Important architectural fact driving several fixes below:** App.vue (Task 25) keeps ONE persistent `<ExpenseModal>` instance and only ever swaps its `visible`/`editing-transaction` props — it never remounts this component. That means a `commit()`/`onDelete()` write can still be in flight (awaiting an IndexedDB round trip) at the exact moment the user closes the sheet, or the parent hands it a different transaction to edit, or a different fresh "add" session. Nothing else in the UI becomes disabled during that gap, so this needs to be designed for from the start rather than patched in later.

- [ ] **Step 1: Write the failing test**

```js
// src/components/expense/ExpenseModal.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ExpenseModal from './ExpenseModal.vue';
import { useCategoriesStore } from '../../stores/categories.js';
import * as transactionsDb from '../../db/transactions.js';

vi.mock('../../db/transactions.js');

function findKey(wrapper, label) {
  return wrapper.findAll('.keypad__key').find((b) => b.text() === label);
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  useCategoriesStore().items = [
    { id: 'fun', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
  ];
});

describe('ExpenseModal — adding a new expense', () => {
  it('builds the amount from keypad taps and shows it live', async () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    for (const key of ['1', '2', '4', '0']) {
      await findKey(wrapper, key).trigger('click');
    }
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('1240');
  });

  it('commits the evaluated amount when a leaf category is tapped', async () => {
    transactionsDb.createTransaction.mockResolvedValue({ id: 't1', amount: 1240, date: '2026-07-27', categoryId: 'fun' });
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    for (const key of ['1', '2', '4', '0']) await findKey(wrapper, key).trigger('click');
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1240, categoryId: 'fun' })
    );
  });

  it('rounds an amount that does not evaluate to a whole number', async () => {
    // Splitting a shared cost (e.g. "1000÷3") is ordinary use of a
    // calculator-style amount field — the stored/committed amount must not
    // carry raw float noise.
    transactionsDb.createTransaction.mockResolvedValue({ id: 't1', amount: 333, date: '2026-07-27', categoryId: 'fun' });
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    for (const key of ['1', '0', '0', '0', '÷', '3']) await findKey(wrapper, key).trigger('click');
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ amount: 333 }));
  });

  it('replaces a pending operator when a different one is tapped, instead of ignoring the new tap', async () => {
    // Matches calculator.js's own normalize(), built specifically to
    // collapse consecutive operators to the most recent one (the "changed
    // my mind" convention) — this is the only real caller of that function.
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    await findKey(wrapper, '+').trigger('click');
    await findKey(wrapper, '×').trigger('click');
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('5×');
  });

  it('does nothing when a category is tapped with no amount entered', async () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects an amount that evaluates to zero or negative, without touching the store', async () => {
    // "5−10" is ordinary keypad input (not a leading/consecutive operator) that
    // evaluates to a negative number — must be rejected before it ever reaches
    // transactionsStore.create.
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    for (const key of ['5', '−', '1', '0']) await findKey(wrapper, key).trigger('click');
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.createTransaction).not.toHaveBeenCalled();
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('5−10'); // left as typed, not silently cleared
  });

  it('resets the amount after a successful commit and stays open', async () => {
    transactionsDb.createTransaction.mockResolvedValue({ id: 't1', amount: 500, date: '2026-07-27', categoryId: 'fun' });
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    await wrapper.find('.category-picker__row').trigger('click');
    // The commit chain is two awaits deep (commit -> transactionsStore.create
    // -> transactionsDb.createTransaction) before `raw` gets reset — a single
    // $nextTick() doesn't reliably drain that; flushPromises() (a macrotask)
    // does, same as the "ignores a second tap" case below.
    await flushPromises();
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('0');
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('ignores a second tap on the same category while the first commit is still in flight', async () => {
    // The picker only resets after the store write resolves, so the exact
    // same leaf row is still on screen — and still tappable — for the
    // entire await gap. A fast double-tap there must not create the
    // transaction twice.
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    const row = wrapper.find('.category-picker__row');
    await row.trigger('click');
    await row.trigger('click');
    resolveCreate({ id: 't1', amount: 500, date: '2026-07-27', categoryId: 'fun' });
    await flushPromises();
    expect(transactionsDb.createTransaction).toHaveBeenCalledTimes(1);
  });

  it('ignores keypad taps while a commit is still in flight, instead of merging with the stale reset', async () => {
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    await wrapper.find('.category-picker__row').trigger('click'); // commit in flight
    await findKey(wrapper, '7').trigger('click'); // typing during the gap — must be a no-op
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('5');
    resolveCreate({ id: 't1', amount: 5, date: '2026-07-27', categoryId: 'fun' });
    await flushPromises();
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('0'); // clean reset, no leftover "7"
  });
});

describe('ExpenseModal — stale in-flight writes (App.vue keeps one persistent instance and only swaps props)', () => {
  it('does not apply a stale commit\'s reset once a different session has taken over', async () => {
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    await wrapper.find('.category-picker__row').trigger('click'); // add-mode commit in flight

    const otherTransaction = { id: 't9', amount: 300, date: '2026-07-01', categoryId: 'fun' };
    await wrapper.setProps({ editingTransaction: otherTransaction });

    resolveCreate({ id: 't1', amount: 5, date: '2026-07-27', categoryId: 'fun' });
    await flushPromises();
    // The now-active edit session's pre-filled amount must survive untouched.
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('300');
  });

  it('does not crash resolving a commit after the sheet was closed mid-write', async () => {
    // Awaits commit()'s own returned promise directly (rather than going
    // through the DOM event + flushPromises) so a thrown error surfaces as
    // this assertion failing, not as a side-channel "unhandled rejection"
    // that a plain flushPromises()-based test would silently let through.
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    const commitPromise = wrapper.vm.commit({ id: 'fun', name: 'Развлечения', emoji: '🎬' });
    await wrapper.setProps({ visible: false }); // sheet, and CategoryPicker with it, unmounts

    resolveCreate({ id: 't1', amount: 5, date: '2026-07-27', categoryId: 'fun' });
    await expect(commitPromise).resolves.toBeUndefined();
  });

  it('does not clobber a date the user already picked for the next entry while a stale commit is still resolving', async () => {
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    const commitPromise = wrapper.vm.commit({ id: 'fun', name: 'Развлечения', emoji: '🎬' });
    // DatePicker's own change handler is blocked by nothing during this gap
    // (only the keypad is guarded) — simulate the user picking "Вчера" for
    // whatever they type next, before the stale commit resolves.
    await wrapper.findComponent({ name: 'DatePicker' }).vm.$emit('update:modelValue', '2026-07-26');

    resolveCreate({ id: 't1', amount: 5, date: '2026-07-27', categoryId: 'fun' });
    await commitPromise;
    expect(wrapper.vm.date).toBe('2026-07-26');
  });
});

describe('ExpenseModal — editing an existing expense', () => {
  const editingTransaction = { id: 't1', amount: 750, date: '2026-07-10', categoryId: 'fun' };

  it('pre-fills the amount from the transaction being edited', () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction } });
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('750');
  });

  it('shows a Delete button that removes the transaction and closes', async () => {
    transactionsDb.deleteTransaction.mockResolvedValue(undefined);
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction } });
    await wrapper.find('.expense-modal__delete').trigger('click');
    // onDelete -> transactionsStore.remove -> transactionsDb.deleteTransaction
    // is two awaits deep before close() fires; see flushPromises note above.
    await flushPromises();
    expect(transactionsDb.deleteTransaction).toHaveBeenCalledWith('t1');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('closes after committing an edit', async () => {
    transactionsDb.updateTransaction.mockResolvedValue(editingTransaction);
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction } });
    await wrapper.find('.category-picker__row').trigger('click');
    await flushPromises();
    expect(transactionsDb.updateTransaction).toHaveBeenCalledWith('t1', expect.objectContaining({ amount: 750 }));
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('still closes when the store swaps editingTransaction for a same-id, different-reference object mid-write', async () => {
    // transactionsStore.update() replaces the item in its own array with a
    // new object (`this.items[index] = updated`) — if a future App.vue ever
    // derives editingTransaction reactively from that array, the prop
    // reference changes even though it's still logically the same edit
    // session. Comparing by id (not `===`) is what keeps close() firing.
    let resolveUpdate;
    transactionsDb.updateTransaction.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction } });
    const commitPromise = wrapper.vm.commit({ id: 'fun', name: 'Развлечения', emoji: '🎬' });
    const sameIdNewReference = { id: 't1', amount: 750, date: '2026-07-10', categoryId: 'fun' };
    await wrapper.setProps({ editingTransaction: sameIdNewReference });

    resolveUpdate(sameIdNewReference);
    await commitPromise;
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

describe('ExpenseModal — dismissing', () => {
  it('emits close when the × button is clicked', async () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await wrapper.find('.expense-modal__close').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

describe('ExpenseModal — accessibility', () => {
  it('carries dialog semantics for assistive tech, since it is a full-screen modal sheet', () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    const dialog = wrapper.find('.expense-modal');
    expect(dialog.attributes('role')).toBe('dialog');
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBe('expense-modal-title');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/expense/ExpenseModal.spec.js`
Expected: FAIL — module `./ExpenseModal.vue` does not exist.

- [ ] **Step 3: Implement `src/components/expense/ExpenseModal.vue`**

```vue
<template>
  <div v-if="visible" class="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
    <div class="expense-modal__backdrop"></div>
    <div class="expense-modal__sheet">
      <div class="expense-modal__handle-row">
        <div class="expense-modal__handle"></div>
        <button type="button" class="expense-modal__close" aria-label="Закрыть" @click="close">✕</button>
      </div>

      <div class="expense-modal__entry">
        <p id="expense-modal-title" class="expense-modal__entry-label">Сумма расхода</p>
        <div class="expense-modal__entry-value">{{ raw || '0' }}</div>
      </div>

      <DatePicker v-model="date" />

      <CategoryPicker ref="picker" @pick="commit" />

      <Keypad @key="onKey" />

      <button v-if="editingTransaction" type="button" class="expense-modal__delete" @click="onDelete">Удалить</button>
    </div>
  </div>
</template>

<script>
import Keypad from './Keypad.vue';
import DatePicker from './DatePicker.vue';
import CategoryPicker from './CategoryPicker.vue';
import { useTransactionsStore } from '../../stores/transactions.js';
import { useToastStore } from '../../stores/toast.js';
import { evaluateExpression } from '../../utils/calculator.js';
import { formatMoney } from '../../utils/currency.js';
import { todayKey } from '../../utils/date.js';

export default {
  name: 'ExpenseModal',
  components: { Keypad, DatePicker, CategoryPicker },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    editingTransaction: {
      type: Object,
      default: null,
    },
  },
  emits: ['close'],
  data() {
    return {
      raw: '',
      date: todayKey(),
      // The category picker only resets/re-renders after the store write
      // below resolves, so the exact same leaf row a user just tapped is
      // still on screen — and still tappable — for the whole await gap.
      // This guards commit()/onDelete() against a fast double-tap creating
      // (or deleting) the same transaction twice.
      submitting: false,
    };
  },
  watch: {
    editingTransaction: {
      immediate: true,
      handler(transaction) {
        if (transaction) {
          this.raw = String(transaction.amount).replace('.', ',');
          this.date = transaction.date;
        } else {
          this.raw = '';
          this.date = todayKey();
        }
      },
    },
  },
  methods: {
    onKey(key) {
      // A write started by a previous commit/delete can still be in flight
      // (see commit()/onDelete()) with nothing else in the UI disabled
      // meanwhile — without this guard, typing a new amount during that gap
      // silently merges with whatever the stale commit resets `raw` to once
      // it resolves.
      if (this.submitting) return;
      if (key === 'del') {
        this.raw = this.raw.slice(0, -1);
      } else if (key === ',') {
        const lastNumber = this.raw.split(/[+\-−×÷]/).pop();
        if (!lastNumber.includes(',')) this.raw += ',';
      } else if (['+', '−', '×', '÷'].includes(key)) {
        if (!this.raw) return;
        // Tapping a second operator replaces the pending one (the "changed
        // my mind" convention — matches calculator.js's own normalize(),
        // which was built specifically to collapse consecutive operators
        // this way; dropping the new tap instead would leave that behavior
        // unreachable through the app's only real caller).
        this.raw = /[+\-−×÷]$/.test(this.raw) ? this.raw.slice(0, -1) + key : this.raw + key;
      } else {
        this.raw += key;
      }
    },
    async commit(category) {
      if (!this.raw || this.submitting) return;
      // Dividing to split a shared cost (e.g. "1000÷3") is ordinary use of a
      // calculator-style amount field — round to whole rubles here, the same
      // place the amount<=0 business rule below lives, rather than storing
      // and later re-displaying raw float noise.
      const amount = Math.round(evaluateExpression(this.raw));
      const toast = useToastStore();
      if (amount <= 0) {
        // Reachable through completely ordinary keypad input, not just a
        // leading operator — e.g. "5−10" is a ordinarily-typed subtraction
        // that evaluates to a negative result. An expense's amount must be
        // positive; reject before it ever reaches the store, rather than
        // storing a negative transaction that later formatting (amount ->
        // string -> re-parsed on edit) can't safely round-trip.
        toast.show('Сумма должна быть больше нуля');
        return;
      }
      this.submitting = true;
      // Snapshot which session (this specific edit target, or this specific
      // add session) the write below is for, and the date it was committed
      // with (see isSameSession below). App.vue keeps one persistent
      // ExpenseModal instance and only swaps its props, so by the time the
      // await resolves the user could have closed the sheet, reopened it
      // for a different transaction, or already picked a fresh date via
      // DatePicker for whatever comes next — applying this commit's
      // completion side effects (closing, resetting raw/date, touching the
      // picker) onto that unrelated later state would be wrong, and the
      // picker itself may no longer even be mounted (visible could now be
      // false).
      const session = this.editingTransaction;
      const committedDate = this.date;
      try {
        const transactionsStore = useTransactionsStore();

        if (session) {
          await transactionsStore.update(session.id, {
            amount,
            date: this.date,
            categoryId: category.id,
          });
          toast.show(`Изменено: ${category.emoji} ${category.name} · ${formatMoney(amount)}`);
          if (this.isSameSession(session)) this.close();
        } else {
          await transactionsStore.create({ amount, date: this.date, categoryId: category.id });
          toast.show(`Добавлено: ${category.emoji} ${category.name} · ${formatMoney(amount)}`);
          if (this.isSameSession(session)) {
            this.raw = '';
            if (this.date === committedDate) this.date = todayKey();
            this.$refs.picker?.reset();
          }
        }
      } finally {
        this.submitting = false;
      }
    },
    async onDelete() {
      if (this.submitting) return;
      this.submitting = true;
      const session = this.editingTransaction;
      try {
        const transactionsStore = useTransactionsStore();
        await transactionsStore.remove(session.id);
        if (this.isSameSession(session)) this.close();
      } finally {
        this.submitting = false;
      }
    },
    // Compared by id, not by reference: the store's own update() replaces an
    // item in its array with a new object, so a same-transaction,
    // different-reference editingTransaction must still count as "the same
    // session," or a legitimate successful edit would silently fail to
    // close once App.vue derives this prop reactively from the store.
    isSameSession(session) {
      const currentId = this.editingTransaction ? this.editingTransaction.id : null;
      const sessionId = session ? session.id : null;
      return currentId === sessionId;
    },
    close() {
      this.$emit('close');
    },
  },
};
</script>

<style lang="scss">
.expense-modal {
  position: absolute;
  inset: 0;
  z-index: 10;

  &__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.38);
  }

  &__sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    background: var(--surface);
    border-radius: 26px 26px 0 0;
    display: flex;
    flex-direction: column;
    height: 88%;
    padding: 6px 18px 16px;
  }

  &__handle-row {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 10px 0 2px;
  }

  &__handle {
    width: 36px;
    height: 5px;
    border-radius: 3px;
    background: var(--border-strong);
  }

  &__close {
    position: absolute;
    right: 0;
    top: 8px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--surface-raised);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--ink-secondary);
  }

  &__entry {
    text-align: center;
    padding: 10px 0 14px;
    flex: 0 0 auto;
  }

  &__entry-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin-bottom: 8px;
  }

  &__entry-value {
    font-family: var(--font-money);
    font-size: 40px;
    font-weight: 600;
    letter-spacing: -0.01em;
    min-height: 48px;
  }

  &__delete {
    margin-top: 10px;
    padding: 10px;
    text-align: center;
    color: var(--negative);
    font-weight: 600;
    font-size: 14px;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/expense/ExpenseModal.spec.js`
Expected: PASS (18 tests).

**Verified in this diligence pass:** a code-quality review of the first implementation, built against the reference code above minus the `submitting` guard on `onKey`, the `isSameSession`/`committedDate` checks, and the operator-replace/rounding/aria-dialog details, empirically reproduced a crash, a silent data-loss bug, and a silent lockout — all from exactly the persistent-instance scenario described at the top of this task — by writing and running throwaway specs against the built component. A second review pass, after those were fixed, found two narrower instances of the same bug class (the `date` field and the edit-mode session check using reference equality instead of id). The reference code above already has every one of those fixes folded in — do not simplify any of them away.

- [ ] **Step 5: Commit**

```bash
git add src/components/expense/ExpenseModal.vue src/components/expense/ExpenseModal.spec.js
git commit -m "feat: add ExpenseModal composing keypad, date picker, and category picker"
```

---

**Note on sequencing:** the Dashboard screen (spec §10) needs both a month chart and a category pie chart *before* it can be composed, so those are built first as standalone, independently-testable components — the same reason `CategoryPicker` was built ahead of `ExpenseModal`.

## Task 18: MonthChart component

**Files:**
- Create: `src/components/budget/MonthChart.vue`
- Test: `src/components/budget/MonthChart.spec.js`

Per spec §10: 12 unlabeled bars (height-only comparison), the viewed month highlighted, an overspent month shown in the negative color, and future months rendered empty/disabled. Purely presentational — the Dashboard computes the `months` array.

- [ ] **Step 1: Write the failing test**

```js
// src/components/budget/MonthChart.spec.js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MonthChart from './MonthChart.vue';

const months = [
  { key: '2026-01', short: 'Я', total: 61200, empty: false, active: false, negative: false },
  { key: '2026-03', short: 'М', total: 80100, empty: false, active: false, negative: true },
  { key: '2026-07', short: 'И', total: 48200, empty: false, active: true, negative: false },
  { key: '2026-08', short: 'А', total: 0, empty: true, active: false, negative: false },
  // Tracked and genuinely spent nothing — distinct from Август above, which
  // hasn't happened yet. Appended (not inserted in calendar order) so the
  // existing index-based assertions on the first four months stay stable.
  { key: '2026-02', short: 'Ф', total: 0, empty: false, active: false, negative: false },
];

describe('MonthChart', () => {
  it('renders one column per month', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')).toHaveLength(5);
  });

  it('marks the active month', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[2].classes()).toContain('month-chart__col--active');
  });

  it('marks an overspent month negative', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[1].classes()).toContain('month-chart__col--negative');
  });

  it('disables empty (future) months', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[3].attributes('disabled')).toBeDefined();
  });

  it('emits select with the month key when a populated column is clicked', async () => {
    const wrapper = mount(MonthChart, { props: { months } });
    await wrapper.findAll('.month-chart__col')[0].trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['2026-01']);
  });

  it('gives the tallest bar a height of 100%', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    const bars = wrapper.findAll('.month-chart__bar');
    expect(bars[1].attributes('style')).toContain('--h: 100'); // Март is the max (80100)
  });

  it('gives a tracked, genuinely zero-spend month the same floor as a populated one, not the shorter empty-month floor', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    const bars = wrapper.findAll('.month-chart__bar');
    expect(bars[4].attributes('style')).toContain('--h: 6'); // Февраль: total 0, but not empty
    expect(bars[3].attributes('style')).toContain('--h: 4'); // Август: empty, shorter floor
  });
});

describe('MonthChart — accessible labels', () => {
  // The visible label is a single, deliberately ambiguous Cyrillic letter (see
  // component comment) — a screen-reader user swiping through 12 buttons that
  // each announce just one letter (often repeated, e.g. "И" for both Июнь and
  // Июль) gets no usable information. aria-label reconstructs a real name
  // from data this component already receives (month.key, month.total), so
  // the fix stays local instead of waiting on a future props-shape change.
  it('announces the month name and total for a populated month', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[0].attributes('aria-label')).toBe('Январь 2026, 61 200 ₽');
  });

  it('announces overspend for a negative month', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[1].attributes('aria-label')).toBe('Март 2026, перерасход, 80 100 ₽');
  });

  it('announces a future month as not yet reached, rather than as a 0 ₽ total', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[3].attributes('aria-label')).toBe('Август 2026, ещё не наступил');
  });

  it('announces a tracked, genuinely zero-spend month as a real 0 ₽ total, not as not-yet-reached', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')[4].attributes('aria-label')).toBe('Февраль 2026, 0 ₽');
  });

  it('hides the bare-letter label from assistive tech so it does not compete with aria-label', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__label')[0].attributes('aria-hidden')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/budget/MonthChart.spec.js`
Expected: FAIL — module `./MonthChart.vue` does not exist.

- [ ] **Step 3: Implement `src/components/budget/MonthChart.vue`**

```vue
<template>
  <div class="month-chart">
    <div class="month-chart__bars">
      <button
        v-for="month in scaledMonths"
        :key="month.key"
        type="button"
        class="month-chart__col"
        :class="{
          'month-chart__col--active': month.active,
          'month-chart__col--negative': month.negative,
          'month-chart__col--empty': month.empty,
        }"
        :disabled="month.empty"
        :aria-label="month.label"
        @click="$emit('select', month.key)"
      >
        <span class="month-chart__bar-wrap">
          <span class="month-chart__bar" :style="{ '--h': month.heightPct }"></span>
        </span>
        <!-- The visible glyph is a single, deliberately ambiguous letter (see
             monthLabel below) — aria-hidden so assistive tech reads only the
             richer aria-label above, not this letter as well. -->
        <span class="month-chart__label" aria-hidden="true">{{ month.short }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { formatMoney } from '../../utils/currency.js';
import { monthNameWithYear } from '../../utils/date.js';

export default {
  name: 'MonthChart',
  props: {
    months: {
      type: Array,
      required: true,
    },
  },
  emits: ['select'],
  computed: {
    scaledMonths() {
      const max = Math.max(1, ...this.months.map((m) => m.total));
      return this.months.map((m) => ({
        ...m,
        // A real past month can genuinely have total: 0 (tracked and spent
        // nothing) and still gets this 6% floor — same as it would for a
        // tiny nonzero spend that rounds down close to it. That's accepted
        // here, not a bug: per spec this chart is a coarse, unlabeled
        // height-only comparison (no value labels anywhere on it), so a bar
        // that reads as "short" rather than "gone" is the right precision
        // for "little to nothing was spent." Empty (future) months use a
        // shorter, dimmed floor instead (below), which is the distinction
        // that actually matters — "hasn't happened yet" staying visually
        // distinct from "happened, near-zero."
        heightPct: m.empty ? 4 : Math.max(6, Math.round((m.total / max) * 100)),
        label: this.monthLabel(m),
      }));
    },
  },
  methods: {
    // Builds a real accessible name from data already on the month (key,
    // total) instead of leaving the button's name as the bare visible letter
    // — see the aria-hidden note on the template's label span for why that
    // letter alone isn't enough for a screen-reader user.
    monthLabel(month) {
      const heading = monthNameWithYear(month.key);
      if (month.empty) return `${heading}, ещё не наступил`;
      const amount = formatMoney(month.total);
      return month.negative ? `${heading}, перерасход, ${amount}` : `${heading}, ${amount}`;
    },
  },
};
</script>

<style lang="scss">
.month-chart {
  margin-bottom: 28px;

  &__bars {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    align-items: end;
    height: 74px;
    gap: 3px;
    padding: 0 2px;
  }

  &__col {
    // The shared button reset (_reset.scss) doesn't zero out padding, and
    // Blink's UA default (padding: 1px 6px) halves this button's own content
    // box at realistic column widths — which .month-chart__bar-wrap and
    // .month-chart__bar (60% width, max-width: 14px) both size themselves
    // relative to. Verified in a real browser: without this, the bar never
    // gets wide enough to hit its own max-width cap.
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    gap: 6px;

    &--active .month-chart__bar {
      background: var(--accent);
    }

    &--negative .month-chart__bar {
      background: var(--negative);
    }

    &--empty .month-chart__bar {
      opacity: 0.35;
    }

    &--active .month-chart__label {
      color: var(--accent-strong);
      font-weight: 700;
    }
  }

  &__bar-wrap {
    flex: 1 1 auto;
    display: flex;
    align-items: flex-end;
    width: 100%;
    justify-content: center;
  }

  &__bar {
    width: 60%;
    max-width: 14px;
    border-radius: 3px 3px 0 0;
    background: var(--surface-raised);
    height: calc(var(--h, 0) * 1%);
    min-height: 3px;
  }

  &__label {
    font-size: 9px;
    color: var(--ink-muted);
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/budget/MonthChart.spec.js`
Expected: PASS (12 tests).

**Verified in this diligence pass:** a code-quality review found the bar never actually reaches its own `max-width: 14px` cap in a real browser (Blink's default button padding halves the content box `.month-chart__bar-wrap`/`.month-chart__bar` size themselves against) — confirmed with real `getBoundingClientRect()` measurements before/after adding `padding: 0`. The reference code above already has that fix, plus the `aria-label`/`monthNameWithYear` additions and the zero-spend-month test — don't drop any of them. `monthNameWithYear` (in `utils/date.js`) exists specifically so this component and Task 20's `BudgetDashboard.monthLabel` share one "Месяц ГГГГ" formatter instead of each maintaining an independent one.

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/MonthChart.vue src/components/budget/MonthChart.spec.js
git commit -m "feat: add MonthChart component"
```

---

## Task 19: CategoryPie component

**Files:**
- Create: `src/components/budget/CategoryPie.vue`
- Test: `src/components/budget/CategoryPie.spec.js`

Per spec §10: a parent category's slice is the sum of all its descendants' spend (only leaf categories ever receive direct transactions). No numbers on the chart itself — amounts live in the legend, which doubles as the accessibility "relief" for the categorical palette's lighter slots. Drill-down mirrors `CategoryPicker`'s stack pattern but renders a pie, not a commit list, and resets when the viewed month changes.

- [ ] **Step 1: Write the failing test**

```js
// src/components/budget/CategoryPie.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import CategoryPie from './CategoryPie.vue';
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';

beforeEach(() => {
  setActivePinia(createPinia());
});

function seed() {
  useCategoriesStore().items = [
    { id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
    { id: 'groceries', name: 'Продукты', emoji: '🛒', parentId: 'food', archived: false },
    { id: 'cafe', name: 'Кафе', emoji: '☕', parentId: 'food', archived: false },
    { id: 'fun', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
  ];
  useTransactionsStore().items = [
    { date: '2026-07-05', amount: 3000, categoryId: 'groceries' },
    { date: '2026-07-06', amount: 1000, categoryId: 'cafe' },
    { date: '2026-07-07', amount: 2000, categoryId: 'fun' },
    { date: '2026-06-01', amount: 9999, categoryId: 'fun' },
  ];
}

describe('CategoryPie at the root level', () => {
  it('aggregates a parent category total from its subcategories', () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const foodRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Еда'));
    expect(foodRow.find('.category-pie__amount').text()).toBe('4 000 ₽');
  });

  it('excludes transactions from other months', () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const funRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Развлечения'));
    expect(funRow.find('.category-pie__amount').text()).toBe('2 000 ₽');
  });
});

describe('CategoryPie drill-down', () => {
  it('drills into subcategories when a category with children is clicked', async () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const foodRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Еда'));
    await foodRow.trigger('click');
    expect(wrapper.find('.category-pie__back').exists()).toBe(true);
    const names = wrapper.findAll('.category-pie__name').map((n) => n.text());
    expect(names).toEqual(['Продукты', 'Кафе']);
  });

  it('does nothing when a leaf category is clicked', async () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const funRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Развлечения'));
    await funRow.trigger('click');
    expect(wrapper.find('.category-pie__back').exists()).toBe(false);
  });

  it('returns to the parent level when Назад is clicked', async () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const foodRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Еда'));
    await foodRow.trigger('click');
    await wrapper.find('.category-pie__back').trigger('click');
    expect(wrapper.find('.category-pie__back').exists()).toBe(false);
  });
});

describe('CategoryPie month changes', () => {
  it('resets the drill-down when monthKey changes', async () => {
    seed();
    const wrapper = mount(CategoryPie, { props: { monthKey: '2026-07' } });
    const foodRow = wrapper.findAll('.category-pie__legend-item').find((r) => r.text().includes('Еда'));
    await foodRow.trigger('click');
    await wrapper.setProps({ monthKey: '2026-06' });
    expect(wrapper.find('.category-pie__back').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/budget/CategoryPie.spec.js`
Expected: FAIL — module `./CategoryPie.vue` does not exist.

- [ ] **Step 3: Implement `src/components/budget/CategoryPie.vue`**

```vue
<template>
  <div class="category-pie">
    <p class="category-pie__title">{{ stack.length ? 'Подкатегории' : 'Расход по категориям' }}</p>
    <button v-if="stack.length" type="button" class="category-pie__back" @click="back">
      <span aria-hidden="true">‹</span> Назад ко всем категориям
    </button>

    <!-- Every amount/percentage on this chart is already in the legend below
         as text — this circle is redundant visual reinforcement, same as
         MonthChart's bare letter or TabBar's icon, so it's hidden from
         assistive tech rather than left as an unlabeled, contentless stop. -->
    <div class="category-pie__chart" :style="{ background: gradient }" aria-hidden="true"></div>

    <div class="category-pie__legend">
      <button
        v-for="row in rows"
        :key="row.category.id"
        type="button"
        class="category-pie__legend-item"
        :disabled="!row.hasChildren"
        @click="drillInto(row.category)"
      >
        <span class="category-pie__swatch" :style="{ background: row.color }"></span>
        <span class="category-pie__emoji">{{ row.category.emoji }}</span>
        <span class="category-pie__name">{{ row.category.name }}</span>
        <span class="category-pie__pct">{{ row.pct }}%</span>
        <span class="category-pie__amount">{{ formatMoney(row.amount) }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';
import { formatMoney } from '../../utils/currency.js';

const PALETTE = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)', 'var(--cat-6)'];

export default {
  name: 'CategoryPie',
  props: {
    monthKey: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      stack: [],
    };
  },
  computed: {
    categoriesStore() {
      return useCategoriesStore();
    },
    transactionsStore() {
      return useTransactionsStore();
    },
    currentLevel() {
      const parentId = this.stack.length ? this.stack[this.stack.length - 1] : null;
      return parentId === null
        ? this.categoriesStore.rootCategories
        : this.categoriesStore.childrenOf(parentId);
    },
    rows() {
      const total = this.currentLevel.reduce((sum, category) => sum + this.amountFor(category), 0);
      return this.currentLevel.map((category, index) => {
        const amount = this.amountFor(category);
        return {
          category,
          amount,
          pct: total ? Math.round((amount / total) * 100) : 0,
          color: PALETTE[index % PALETTE.length],
          hasChildren: this.categoriesStore.childrenOf(category.id).length > 0,
        };
      });
    },
    gradient() {
      const total = this.rows.reduce((sum, row) => sum + row.amount, 0);
      let acc = 0;
      const stops = this.rows.map((row) => {
        const start = total ? (acc / total) * 100 : 0;
        acc += row.amount;
        const end = total ? (acc / total) * 100 : 0;
        return `${row.color} ${start}% ${end}%`;
      });
      return stops.length ? `conic-gradient(${stops.join(', ')})` : 'var(--surface-raised)';
    },
  },
  watch: {
    monthKey() {
      this.stack = [];
    },
  },
  methods: {
    formatMoney,
    // subtreeIds lives on useCategoriesStore (Task 7), not here — it's pure
    // category-tree shape with no dependency on transactions or anything
    // CategoryPie-specific, so it's reused rather than re-derived, the same
    // reasoning as this component already reusing childrenOf/rootCategories.
    amountFor(category) {
      const ids = this.categoriesStore.subtreeIds(category.id);
      return this.transactionsStore.items
        .filter((t) => t.date.startsWith(this.monthKey) && ids.includes(t.categoryId))
        .reduce((sum, t) => sum + t.amount, 0);
    },
    drillInto(category) {
      if (this.categoriesStore.childrenOf(category.id).length > 0) {
        this.stack.push(category.id);
      }
    },
    back() {
      this.stack.pop();
    },
  },
};
</script>

<style lang="scss">
.category-pie {
  margin-bottom: 8px;

  &__back {
    // Explicit, not just inherited — the shared button reset doesn't zero
    // padding, and this project has already shipped one real bug (MonthChart)
    // from a button's UA-default padding silently eating into a percentage-
    // sized child. Nothing here is percentage-sized against this box today,
    // so it's not live, but it's free to close off.
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent-strong);
    margin-bottom: 10px;
  }

  &__chart {
    width: 118px;
    height: 118px;
    border-radius: 50%;
    margin-bottom: 16px;
    box-shadow: inset 0 0 0 1px var(--border);
  }

  &__legend-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 6px;
    border-radius: 10px;
    width: 100%;
    text-align: left;

    &:disabled {
      cursor: default;
      pointer-events: none;
    }
  }

  &__swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: 0 0 auto;
  }

  &__name {
    flex: 1 1 auto;
    font-size: 14px;
  }

  &__pct {
    font-size: 12px;
    color: var(--ink-muted);
    width: 38px;
    text-align: right;
  }

  &__amount {
    font-family: var(--font-money);
    font-size: 13px;
    color: var(--ink-secondary);
    width: 74px;
    text-align: right;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/budget/CategoryPie.spec.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/CategoryPie.vue src/components/budget/CategoryPie.spec.js
git commit -m "feat: add CategoryPie component with drill-down"
```

---

## Task 20: BudgetDashboard (compose the "Бюджет" screen)

**Files:**
- Create: `src/components/budget/BudgetDashboard.vue`
- Test: `src/components/budget/BudgetDashboard.spec.js`

**Architectural convention starting here:** screen-level components never call a store's `load()` themselves — they only read reactive state. All stores are loaded exactly once, at startup, by `App.vue` in Task 25. This keeps data-loading in one place and means every screen's tests can seed store state directly without a `load()` call racing in and overwriting it. Apply this same convention in Tasks 21–24.

- [ ] **Step 1: Write the failing test**

```js
// src/components/budget/BudgetDashboard.spec.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import BudgetDashboard from './BudgetDashboard.vue';
import { useBudgetRatesStore } from '../../stores/budgetRates.js';
import { useTransactionsStore } from '../../stores/transactions.js';
import { useCategoriesStore } from '../../stores/categories.js';

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 27)); // 27 July 2026

  useBudgetRatesStore().segments = [{ amount: 2500, effectiveFrom: '2026-01-01' }];
  useCategoriesStore().items = [{ id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false }];
  useTransactionsStore().items = [
    { date: '2026-07-05', amount: 20000, categoryId: 'food' },
    { date: '2026-03-05', amount: 80100, categoryId: 'food' }, // pushes March into overspend
  ];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BudgetDashboard on the current month', () => {
  it('shows the live "Бюджет на сегодня" label', () => {
    const wrapper = mount(BudgetDashboard);
    expect(wrapper.find('.budget-dashboard__hero-label').text()).toBe('Бюджет на сегодня');
  });

  it("computes today's available balance from the budget store", () => {
    const wrapper = mount(BudgetDashboard);
    // 2500 * 27 elapsed days - 20000 spent = 47500
    expect(wrapper.find('.budget-dashboard__hero-value').text()).toBe('47 500 ₽');
  });

  it('disables the next-month arrow — cannot navigate into the future', () => {
    const wrapper = mount(BudgetDashboard);
    expect(wrapper.find('.month-nav__arrow--next').attributes('disabled')).toBeDefined();
  });

  it('shows the genitive month name and total spend in the stat row', () => {
    const wrapper = mount(BudgetDashboard);
    const stat = wrapper.find('.budget-dashboard__stat');
    expect(stat.text()).toContain('Расход за июля');
    expect(stat.text()).toContain('20 000 ₽');
  });
});

describe('BudgetDashboard navigation to a past month', () => {
  it('relabels the hero and shows the end-of-month balance, negative when overspent', async () => {
    const wrapper = mount(BudgetDashboard);
    for (let i = 0; i < 4; i += 1) await wrapper.find('.month-nav__arrow--prev').trigger('click'); // Jul -> Mar
    expect(wrapper.find('.budget-dashboard__hero-label').text()).toBe('Остаток на конец месяца');
    // 2500 * 31 - 80100 = -2600
    expect(wrapper.find('.budget-dashboard__hero-value').text()).toBe('−2 600 ₽');
    expect(wrapper.find('.budget-dashboard__hero-value').classes()).toContain('budget-dashboard__hero-value--negative');
  });

  it('re-enables the next arrow once navigated away from the current month', async () => {
    const wrapper = mount(BudgetDashboard);
    await wrapper.find('.month-nav__arrow--prev').trigger('click');
    expect(wrapper.find('.month-nav__arrow--next').attributes('disabled')).toBeUndefined();
  });

  it('jumps to the clicked month when a MonthChart column is clicked', async () => {
    const wrapper = mount(BudgetDashboard);
    const marchColumn = wrapper.findAll('.month-chart__col')[2]; // Jan=0, Feb=1, Mar=2
    await marchColumn.trigger('click');
    expect(wrapper.find('.budget-dashboard__hero-value').text()).toBe('−2 600 ₽');
  });

  it('crosses a year boundary correctly when paging back past January', async () => {
    const wrapper = mount(BudgetDashboard);
    // Jul 2026 -> Jun -> May -> Apr -> Mar -> Feb -> Jan -> Dec 2025
    for (let i = 0; i < 7; i += 1) await wrapper.find('.month-nav__arrow--prev').trigger('click');
    expect(wrapper.find('.month-nav__label').text()).toBe('Декабрь 2025');
    // chartMonths must now be rebuilt for 2025, with December (the 12th
    // column) active, not still showing 2026's chart with nothing active.
    const columns = wrapper.findAll('.month-chart__col');
    expect(columns).toHaveLength(12);
    expect(columns[11].classes()).toContain('month-chart__col--active');
  });
});

describe('BudgetDashboard settings access', () => {
  it('emits open-settings when the gear icon is clicked', async () => {
    const wrapper = mount(BudgetDashboard);
    await wrapper.find('.budget-dashboard__settings').trigger('click');
    expect(wrapper.emitted('open-settings')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/budget/BudgetDashboard.spec.js`
Expected: FAIL — module `./BudgetDashboard.vue` does not exist.

- [ ] **Step 3: Implement `src/components/budget/BudgetDashboard.vue`**

```vue
<template>
  <div class="budget-dashboard">
    <TopBar>
      <template #left>
        <MonthNav :label="monthLabel" :can-go-next="canGoNext" @prev="prevMonth" @next="nextMonth" />
      </template>
      <template #right>
        <button type="button" class="budget-dashboard__settings" aria-label="Настройки" @click="$emit('open-settings')">⚙️</button>
      </template>
    </TopBar>

    <div class="budget-dashboard__hero">
      <p class="budget-dashboard__hero-label">{{ heroLabel }}</p>
      <div
        class="budget-dashboard__hero-value"
        :class="{ 'budget-dashboard__hero-value--negative': available < 0 }"
      >{{ formatMoney(available) }}</div>
    </div>

    <div class="budget-dashboard__stat">
      <span>Расход за {{ monthGenitive }}</span>
      <span>{{ formatMoney(spend) }}</span>
    </div>

    <MonthChart :months="chartMonths" @select="goToMonth" />

    <CategoryPie :month-key="currentMonthKey" />
  </div>
</template>

<script>
import TopBar from '../layout/TopBar.vue';
import MonthNav from '../layout/MonthNav.vue';
import MonthChart from './MonthChart.vue';
import CategoryPie from './CategoryPie.vue';
import { useBudgetStore } from '../../stores/budget.js';
import { formatMoney } from '../../utils/currency.js';
import { todayKey, toMonthKey, monthNameWithYear } from '../../utils/date.js';

// No MONTH_NAMES, MONTH_GENITIVE, or MONTH_INITIALS array here — every
// Russian month string this component needs is derived from Intl at the
// point of use (below), the same reasoning monthNameWithYear() already
// applies: a hardcoded string list is a second source of truth that can
// drift from what Intl actually produces, for zero benefit over deriving
// it directly.
function genitiveMonthName(monthNum) {
  const withDay = new Date(2000, monthNum - 1, 1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return withDay.replace(/^\d+ /, '');
}

function monthInitial(monthNum) {
  return new Date(2000, monthNum - 1, 1).toLocaleDateString('ru-RU', { month: 'long' }).charAt(0).toUpperCase();
}

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default {
  name: 'BudgetDashboard',
  components: { TopBar, MonthNav, MonthChart, CategoryPie },
  // No store .load() call anywhere in this file, on purpose: screen-level
  // components only read reactive state that App.vue already loaded once at
  // startup. Keeps loading in one place and lets this component's own tests
  // seed store state directly with no load() racing in to overwrite it.
  // Apply the same rule to any other screen-level component.
  emits: ['open-settings'],
  data() {
    return {
      currentMonthKey: toMonthKey(todayKey()),
    };
  },
  computed: {
    budgetStore() {
      return useBudgetStore();
    },
    isCurrentMonth() {
      return this.currentMonthKey === toMonthKey(todayKey());
    },
    canGoNext() {
      return !this.isCurrentMonth;
    },
    monthLabel() {
      return monthNameWithYear(this.currentMonthKey);
    },
    monthGenitive() {
      const m = Number(this.currentMonthKey.slice(5, 7));
      return genitiveMonthName(m);
    },
    heroLabel() {
      return this.isCurrentMonth ? 'Бюджет на сегодня' : 'Остаток на конец месяца';
    },
    available() {
      return this.budgetStore.availableForMonth(this.currentMonthKey);
    },
    spend() {
      return this.budgetStore.spendForMonth(this.currentMonthKey);
    },
    chartMonths() {
      const year = this.currentMonthKey.slice(0, 4);
      const realCurrentMonth = toMonthKey(todayKey());
      return Array.from({ length: 12 }, (_, i) => {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        const empty = key > realCurrentMonth;
        return {
          key,
          short: monthInitial(i + 1),
          total: empty ? 0 : this.budgetStore.spendForMonth(key),
          empty,
          active: key === this.currentMonthKey,
          negative: !empty && this.budgetStore.availableForMonth(key) < 0,
        };
      });
    },
  },
  methods: {
    formatMoney,
    // No lower bound on purpose. Before any rate segment's effectiveFrom,
    // availableForMonth/spendForMonth already resolve to a flat 0 rather
    // than crashing (see rateActiveOn's "no fallback" comment in
    // utils/budgetMath.js) — an arbitrarily old month just renders a plain
    // "0 ₽" screen. Each tap moves exactly one month with no repeat or
    // acceleration, so reaching a meaningless year takes thousands of taps;
    // not worth a floor against a state that's both harmless and
    // impractical to reach by accident. (nextMonth's bound is different: it
    // stops a real, one-tap-away, user-visible case — showing a future
    // month that hasn't happened yet.)
    prevMonth() {
      this.currentMonthKey = shiftMonth(this.currentMonthKey, -1);
    },
    nextMonth() {
      if (this.canGoNext) this.currentMonthKey = shiftMonth(this.currentMonthKey, 1);
    },
    // key always comes from this month's own MonthChart, whose 12 columns
    // are built from currentMonthKey's year (see chartMonths above) — this
    // composition never hands back a key outside that year, so there is
    // nothing here to validate against.
    goToMonth(key) {
      this.currentMonthKey = key;
    },
  },
};
</script>

<style lang="scss">
.budget-dashboard {
  // The screen's own outer margin — every child here (TopBar, hero, stat
  // card, MonthChart, CategoryPie) only ever specifies its own SMALL
  // internal padding (2-16px), none of it enough on its own to keep content
  // off the physical screen edges. Confirmed by rendering this composed
  // with real data at a real 390px viewport: without this, the hero figure,
  // month labels, and section titles all sit flush against both edges.
  padding: 0 18px;

  &__settings {
    position: relative;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;

    // Visual circle stays 34px per design, but the tappable area is widened
    // to the 44px accessible touch-target minimum via an invisible hit area,
    // same pattern as MonthNav's arrows. Symmetric on all sides (unlike
    // MonthNav's) since nothing else shares this corner of TopBar for it to
    // encroach on.
    &::before {
      content: '';
      position: absolute;
      inset: -5px;
    }
  }

  &__hero {
    padding: 4px 2px 18px;
  }

  &__hero-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin: 0 0 6px;
  }

  &__hero-value {
    font-family: var(--font-money);
    font-size: 42px;
    font-weight: 600;
    letter-spacing: -0.01em;

    &--negative {
      color: var(--negative);
    }
  }

  &__stat {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    margin-bottom: 22px;
    font-size: 14px;
    color: var(--ink-secondary);
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/budget/BudgetDashboard.spec.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/budget/BudgetDashboard.vue src/components/budget/BudgetDashboard.spec.js
git commit -m "feat: add BudgetDashboard screen"
```

---

## Task 21: DebtCard component

**Files:**
- Create: `src/components/debts/DebtCard.vue`
- Test: `src/components/debts/DebtCard.spec.js`

Per spec §12: the headline figure is the **remaining** balance (derived), not the original amount; tapping the card reveals the payment history and a form to record a new payment. A plain number input is enough here — the custom calculator keypad from Task 14 is specific to the expense modal, not reused for debt payments.

- [ ] **Step 1: Write the failing test**

```js
// src/components/debts/DebtCard.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import DebtCard from './DebtCard.vue';
import { useDebtsStore } from '../../stores/debts.js';

const debt = { id: 'd1', name: 'Андрей — ремонт', amount: 15000, comment: 'занял на инструменты', direction: 'owed_to_me' };

beforeEach(() => {
  setActivePinia(createPinia());
  const store = useDebtsStore();
  store.items = [debt];
  store.payments = [{ id: 'p1', debtId: 'd1', amount: 5000, date: '02.07.2026' }];
});

describe('DebtCard', () => {
  it('shows the remaining balance, not the original amount, as the headline figure', () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    expect(wrapper.find('.debt-card__amount').text()).toBe('10 000 ₽');
  });

  it('shows the paid percentage and the original total', () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    expect(wrapper.find('.debt-card__meta').text()).toContain('33%');
    expect(wrapper.find('.debt-card__meta').text()).toContain('15 000 ₽');
  });

  it('hides payment history until the card is tapped open', () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    expect(wrapper.find('.debt-card__detail').exists()).toBe(false);
  });

  it('shows payment history after tapping the card', async () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    await wrapper.find('.debt-card__top').trigger('click');
    expect(wrapper.find('.debt-card__hist-row').text()).toContain('02.07.2026');
  });

  it('records a new payment through the pay form and updates the remaining balance', async () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    await wrapper.find('.debt-card__top').trigger('click');
    await wrapper.find('.debt-card__pay-input').setValue('2000');
    await wrapper.find('.debt-card__pay-form').trigger('submit');
    expect(wrapper.find('.debt-card__amount').text()).toBe('8 000 ₽');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/debts/DebtCard.spec.js`
Expected: FAIL — module `./DebtCard.vue` does not exist.

- [ ] **Step 3: Implement `src/components/debts/DebtCard.vue`**

```vue
<template>
  <div class="debt-card">
    <button class="debt-card__top" @click="open = !open">
      <span class="debt-card__title">
        <span class="debt-card__name">{{ debt.name }}</span>
        <span v-if="debt.comment" class="debt-card__comment">{{ debt.comment }}</span>
      </span>
      <span class="debt-card__amount">{{ formatMoney(remaining) }}</span>
    </button>

    <div class="debt-card__meter">
      <div class="debt-card__meter-fill" :style="{ width: paidPct + '%' }"></div>
    </div>
    <div class="debt-card__meta">
      <span>Выплачено {{ paidPct }}%</span>
      <span>Всего {{ formatMoney(debt.amount) }}</span>
    </div>

    <div v-if="open" class="debt-card__detail">
      <div v-if="payments.length === 0" class="debt-card__hist-row">
        <span>Платежей ещё нет</span>
      </div>
      <div v-for="payment in payments" :key="payment.id" class="debt-card__hist-row">
        <span>{{ payment.date }}</span>
        <span>{{ formatMoney(payment.amount) }}</span>
      </div>
      <form class="debt-card__pay-form" @submit.prevent="submitPayment">
        <input v-model="payAmount" type="number" inputmode="decimal" placeholder="Сумма" class="debt-card__pay-input" />
        <button type="submit" class="debt-card__pay-btn">Оплатить</button>
      </form>
    </div>
  </div>
</template>

<script>
import { useDebtsStore } from '../../stores/debts.js';
import { formatMoney } from '../../utils/currency.js';
import { todayKey } from '../../utils/date.js';

export default {
  name: 'DebtCard',
  props: {
    debt: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      open: false,
      payAmount: '',
    };
  },
  computed: {
    debtsStore() {
      return useDebtsStore();
    },
    remaining() {
      return this.debtsStore.remainingOf(this.debt.id);
    },
    payments() {
      return this.debtsStore.paymentsFor(this.debt.id);
    },
    paidPct() {
      if (this.debt.amount === 0) return 0;
      return Math.round(((this.debt.amount - this.remaining) / this.debt.amount) * 100);
    },
  },
  methods: {
    formatMoney,
    async submitPayment() {
      const amount = parseFloat(this.payAmount);
      if (!amount) return;
      await this.debtsStore.pay(this.debt.id, amount, todayKey());
      this.payAmount = '';
    },
  },
};
</script>

<style lang="scss">
.debt-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 15px;
  margin-bottom: 12px;

  &__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    text-align: left;
    gap: 10px;
  }

  &__name {
    display: block;
    font-size: 15px;
    font-weight: 650;
    margin-bottom: 3px;
  }

  &__comment {
    display: block;
    font-size: 12.5px;
    color: var(--ink-muted);
  }

  &__amount {
    font-family: var(--font-money);
    font-size: 17px;
    font-weight: 600;
    white-space: nowrap;
  }

  &__meter {
    height: 5px;
    border-radius: 3px;
    background: var(--accent-wash);
    margin: 12px 0 6px;
    overflow: hidden;
  }

  &__meter-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    color: var(--ink-muted);
  }

  &__detail {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  &__hist-row {
    display: flex;
    justify-content: space-between;
    font-size: 12.5px;
    padding: 5px 0;
    color: var(--ink-secondary);
    font-family: var(--font-money);
  }

  &__pay-form {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  &__pay-input {
    flex: 1;
    background: var(--surface-sunken);
    border-radius: 10px;
    padding: 10px;
    font-family: var(--font-money);
    font-size: 14px;
  }

  &__pay-btn {
    padding: 10px 16px;
    border-radius: 11px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 13.5px;
    font-weight: 650;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/debts/DebtCard.spec.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/debts/DebtCard.vue src/components/debts/DebtCard.spec.js
git commit -m "feat: add DebtCard component"
```

---

## Task 22: DebtsScreen (compose the "Долги" screen)

**Files:**
- Create: `src/components/debts/DebtsScreen.vue`
- Test: `src/components/debts/DebtsScreen.spec.js`

Per spec §12: a segmented control splits "Мне должны" / "Я должен"; debts with remaining ≤ 0 are excluded from the main list and live in a collapsed "Закрытые" section instead.

- [ ] **Step 1: Write the failing test**

```js
// src/components/debts/DebtsScreen.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import DebtsScreen from './DebtsScreen.vue';
import { useDebtsStore } from '../../stores/debts.js';

beforeEach(() => {
  setActivePinia(createPinia());
  const store = useDebtsStore();
  store.items = [
    { id: 'd1', name: 'Андрей', amount: 15000, comment: '', direction: 'owed_to_me' },
    { id: 'd2', name: 'Максим', amount: 1200, comment: '', direction: 'owed_to_me' },
    { id: 'd3', name: 'Ипотека', amount: 200000, comment: '', direction: 'i_owe' },
  ];
  store.payments = [{ id: 'p1', debtId: 'd2', amount: 1200, date: '2026-06-10' }]; // fully pays off d2
});

describe('DebtsScreen', () => {
  it('defaults to "Мне должны" and lists only open debts in that direction', () => {
    const wrapper = mount(DebtsScreen);
    const names = wrapper.findAll('.debt-card__name').map((n) => n.text());
    expect(names).toEqual(['Андрей']);
  });

  it('switches direction when the other segment is clicked', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.findAll('.segmented__opt')[1].trigger('click');
    const names = wrapper.findAll('.debt-card__name').map((n) => n.text());
    expect(names).toEqual(['Ипотека']);
  });

  it('shows the closed count and keeps the list collapsed by default', () => {
    const wrapper = mount(DebtsScreen);
    expect(wrapper.find('.closed-toggle').text()).toContain('1');
    expect(wrapper.find('.closed-list').exists()).toBe(false);
  });

  it('expands the closed list when the toggle is clicked', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.closed-toggle').trigger('click');
    expect(wrapper.find('.closed-card__name').text()).toBe('Максим');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/debts/DebtsScreen.spec.js`
Expected: FAIL — module `./DebtsScreen.vue` does not exist.

- [ ] **Step 3: Implement `src/components/debts/DebtsScreen.vue`**

```vue
<template>
  <div class="debts-screen">
    <TopBar title="Долги" />

    <div class="segmented">
      <button
        v-for="option in segments"
        :key="option.value"
        class="segmented__opt"
        :class="{ 'segmented__opt--active': option.value === direction }"
        @click="direction = option.value"
      >{{ option.label }}</button>
    </div>

    <DebtCard v-for="debt in openDebts" :key="debt.id" :debt="debt" />

    <button class="closed-toggle" @click="closedOpen = !closedOpen">
      <span>{{ closedOpen ? '⌄' : '›' }}</span> Закрытые ({{ closedDebts.length }})
    </button>
    <div v-if="closedOpen" class="closed-list">
      <div v-for="debt in closedDebts" :key="debt.id" class="closed-card">
        <span class="closed-card__name">{{ debt.name }}</span>
        <span>{{ formatMoney(debt.amount) }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import TopBar from '../layout/TopBar.vue';
import DebtCard from './DebtCard.vue';
import { useDebtsStore } from '../../stores/debts.js';
import { formatMoney } from '../../utils/currency.js';

export default {
  name: 'DebtsScreen',
  components: { TopBar, DebtCard },
  data() {
    return {
      direction: 'owed_to_me',
      closedOpen: false,
      segments: [
        { value: 'owed_to_me', label: 'Мне должны' },
        { value: 'i_owe', label: 'Я должен' },
      ],
    };
  },
  computed: {
    debtsStore() {
      return useDebtsStore();
    },
    openDebts() {
      return this.debtsStore.openByDirection(this.direction);
    },
    closedDebts() {
      return this.debtsStore.closedByDirection(this.direction);
    },
  },
  methods: {
    formatMoney,
  },
};
</script>

<style lang="scss">
.segmented {
  display: flex;
  background: var(--surface-sunken);
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 18px;

  &__opt {
    flex: 1;
    text-align: center;
    font-size: 13.5px;
    font-weight: 600;
    padding: 8px 4px;
    border-radius: 9px;
    color: var(--ink-secondary);

    &--active {
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
  }
}

.closed-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-muted);
  padding: 10px 4px;
  width: 100%;
}

.closed-card {
  display: flex;
  justify-content: space-between;
  padding: 10px 6px;
  font-size: 13px;
  color: var(--ink-muted);
  border-bottom: 1px solid var(--border);

  &__name {
    text-decoration: line-through;
    text-decoration-color: var(--border-strong);
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/debts/DebtsScreen.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/debts/DebtsScreen.vue src/components/debts/DebtsScreen.spec.js
git commit -m "feat: add DebtsScreen"
```

---

## Task 23: CategoryTree component

**Files:**
- Create: `src/components/settings/CategoryTree.vue`
- Test: `src/components/settings/CategoryTree.spec.js`

Per spec §9: the full tree renders at once (indented by depth), unlike the picker's one-level-at-a-time drill-down. Archived categories are omitted here too — v1 has no "view archived / unarchive" screen, only archive and hard-delete. Delete requires confirmation naming how many transactions will go with it (native `window.confirm` — no need for a bespoke dialog component for one blocking Yes/No prompt).

- [ ] **Step 1: Write the failing test**

```js
// src/components/settings/CategoryTree.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import CategoryTree from './CategoryTree.vue';
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';
import * as categoriesDb from '../../db/categories.js';

vi.mock('../../db/categories.js');

function seed() {
  useCategoriesStore().items = [
    { id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false },
    { id: 'groceries', name: 'Продукты', emoji: '🛒', parentId: 'food', archived: false },
    { id: 'fun', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
    { id: 'old', name: 'Старое', emoji: '📦', parentId: null, archived: true },
  ];
  useTransactionsStore().items = [{ id: 't1', amount: 500, date: '2026-07-01', categoryId: 'groceries' }];
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('CategoryTree', () => {
  it('renders active categories indented by depth, excluding archived ones', () => {
    seed();
    const wrapper = mount(CategoryTree);
    const rows = wrapper.findAll('.tree-row');
    expect(rows.map((r) => r.find('.tree-row__name').text())).toEqual(['Еда', 'Продукты', 'Развлечения']);
    expect(rows[1].attributes('style')).toContain('padding-left: 38px');
  });

  it('reveals archive/delete actions when the more button is tapped', async () => {
    seed();
    const wrapper = mount(CategoryTree);
    await wrapper.findAll('.tree-row__more')[0].trigger('click');
    expect(wrapper.findAll('.tree-row')[0].classes()).toContain('tree-row--revealed');
  });

  it('archives without prompting for confirmation', async () => {
    seed();
    categoriesDb.archiveCategory.mockResolvedValue(undefined);
    categoriesDb.listCategories.mockResolvedValue([]);
    const wrapper = mount(CategoryTree);
    await wrapper.findAll('.tree-row__more')[0].trigger('click');
    await wrapper.find('.tree-row__action--archive').trigger('click');
    expect(categoriesDb.archiveCategory).toHaveBeenCalledWith('food');
  });

  it('asks for confirmation before deleting, naming the affected transaction count', async () => {
    seed();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const wrapper = mount(CategoryTree);
    await wrapper.findAll('.tree-row__more')[0].trigger('click'); // Еда — its subtree has 1 transaction
    await wrapper.find('.tree-row__action--delete').trigger('click');
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('1'));
    expect(categoriesDb.deleteCategory).not.toHaveBeenCalled();
  });

  it('deletes once the confirmation is accepted', async () => {
    seed();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    categoriesDb.deleteCategory.mockResolvedValue(undefined);
    categoriesDb.listCategories.mockResolvedValue([]);
    const wrapper = mount(CategoryTree);
    await wrapper.findAll('.tree-row__more')[0].trigger('click');
    await wrapper.find('.tree-row__action--delete').trigger('click');
    expect(categoriesDb.deleteCategory).toHaveBeenCalledWith('food');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/settings/CategoryTree.spec.js`
Expected: FAIL — module `./CategoryTree.vue` does not exist.

- [ ] **Step 3: Implement `src/components/settings/CategoryTree.vue`**

```vue
<template>
  <div class="category-tree">
    <div
      v-for="row in rows"
      :key="row.category.id"
      class="tree-row"
      :class="{ 'tree-row--sub': row.depth > 0, 'tree-row--revealed': revealedId === row.category.id }"
      :style="{ paddingLeft: 14 + row.depth * 24 + 'px' }"
    >
      <span class="tree-row__emoji">{{ row.category.emoji }}</span>
      <span class="tree-row__name">{{ row.category.name }}</span>
      <button class="tree-row__more" aria-label="Действия" @click="toggleRevealed(row.category.id)">⋯</button>
      <div class="tree-row__actions">
        <button class="tree-row__action tree-row__action--archive" @click="archive(row.category.id)">Архив</button>
        <button class="tree-row__action tree-row__action--delete" @click="confirmDelete(row.category)">Удалить</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';

function flattenTree(categories, parentId, depth) {
  const result = [];
  const children = categories.filter((c) => c.parentId === parentId);
  for (const child of children) {
    result.push({ category: child, depth });
    result.push(...flattenTree(categories, child.id, depth + 1));
  }
  return result;
}

function subtreeIds(categories, rootId) {
  const ids = [rootId];
  const children = categories.filter((c) => c.parentId === rootId);
  for (const child of children) {
    ids.push(...subtreeIds(categories, child.id));
  }
  return ids;
}

export default {
  name: 'CategoryTree',
  data() {
    return {
      revealedId: null,
    };
  },
  computed: {
    categoriesStore() {
      return useCategoriesStore();
    },
    transactionsStore() {
      return useTransactionsStore();
    },
    rows() {
      return flattenTree(this.categoriesStore.active, null, 0);
    },
  },
  methods: {
    toggleRevealed(id) {
      this.revealedId = this.revealedId === id ? null : id;
    },
    async archive(id) {
      this.revealedId = null;
      await this.categoriesStore.archive(id);
    },
    transactionCountFor(categoryId) {
      const ids = subtreeIds(this.categoriesStore.items, categoryId);
      return this.transactionsStore.items.filter((t) => ids.includes(t.categoryId)).length;
    },
    async confirmDelete(category) {
      this.revealedId = null;
      const count = this.transactionCountFor(category.id);
      const confirmed = window.confirm(
        `Удалить «${category.name}» и все её транзакции (${count})? Это нельзя отменить.`
      );
      if (confirmed) await this.categoriesStore.remove(category.id);
    },
  },
};
</script>

<style lang="scss">
.tree-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-top: 11px;
  padding-bottom: 11px;
  padding-right: 14px;
  border-bottom: 1px solid var(--border);
  position: relative;
  overflow: hidden;

  &:last-child {
    border-bottom: 0;
  }

  &__emoji {
    font-size: 16px;
    width: 22px;
    text-align: center;
    flex: 0 0 auto;
  }

  &__name {
    font-size: 14.5px;
    flex: 1 1 auto;
  }

  &__more {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-muted);
    flex: 0 0 auto;
  }

  &__actions {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    transform: translateX(100%);
    transition: transform 0.18s ease;
  }

  &--revealed &__actions {
    transform: translateX(0);
  }

  &__action {
    width: 78px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: #fff;

    &--archive {
      background: #8a8f73;
    }

    &--delete {
      background: var(--negative);
    }
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/settings/CategoryTree.spec.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/CategoryTree.vue src/components/settings/CategoryTree.spec.js
git commit -m "feat: add CategoryTree component with archive/delete"
```

---

## Task 24: SettingsScreen (compose Settings)

**Files:**
- Create: `src/components/settings/SettingsScreen.vue`
- Test: `src/components/settings/SettingsScreen.spec.js`

Per spec §9 and the "explicitly out of scope" note in §14/§15: Phase 1 has no server, so the "Резервная копия" status row from the visual prototype is **not** included here — it would advertise a feature that doesn't exist yet. It belongs in the Phase 2 plan, once sync is real.

- [ ] **Step 1: Write the failing test**

```js
// src/components/settings/SettingsScreen.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import SettingsScreen from './SettingsScreen.vue';
import { useBudgetRatesStore } from '../../stores/budgetRates.js';
import { useCategoriesStore } from '../../stores/categories.js';
import * as ratesDb from '../../db/budgetRates.js';

vi.mock('../../db/budgetRates.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  useBudgetRatesStore().segments = [{ amount: 2500, effectiveFrom: '2026-01-01' }];
});

describe('SettingsScreen — daily budget row', () => {
  it('shows the current daily rate', () => {
    const wrapper = mount(SettingsScreen);
    expect(wrapper.find('.settings-row__value').text()).toContain('2 500 ₽');
  });

  it('reveals an editable input when the rate row is tapped', async () => {
    const wrapper = mount(SettingsScreen);
    await wrapper.find('.settings-row__value').trigger('click');
    expect(wrapper.find('.settings-row__rate-input').exists()).toBe(true);
  });

  it('saves a new rate and returns to the display state', async () => {
    ratesDb.addRate.mockResolvedValue({ id: 'r2', amount: 3000, effectiveFrom: '2026-07-27' });
    ratesDb.listRates.mockResolvedValue([{ id: 'r2', amount: 3000, effectiveFrom: '2026-07-27' }]);
    const wrapper = mount(SettingsScreen);
    await wrapper.find('.settings-row__value').trigger('click');
    await wrapper.find('.settings-row__rate-input').setValue('3000');
    await wrapper.find('.settings-row__rate-form').trigger('submit');
    expect(wrapper.find('.settings-row__value').text()).toContain('3 000 ₽');
    expect(wrapper.find('.settings-row__rate-input').exists()).toBe(false);
  });
});

describe('SettingsScreen — category management', () => {
  it('hosts the category tree', () => {
    useCategoriesStore().items = [{ id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false }];
    const wrapper = mount(SettingsScreen);
    expect(wrapper.find('.tree-row__name').text()).toBe('Еда');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/settings/SettingsScreen.spec.js`
Expected: FAIL — module `./SettingsScreen.vue` does not exist.

- [ ] **Step 3: Implement `src/components/settings/SettingsScreen.vue`**

```vue
<template>
  <div class="settings-screen">
    <TopBar title="Настройки" />

    <div class="settings-group">
      <p class="section-title">Бюджет</p>
      <div class="settings-list">
        <div class="settings-row">
          <span class="settings-row__label">Дневной бюджет</span>
          <form v-if="editingRate" class="settings-row__rate-form" @submit.prevent="saveRate">
            <input v-model="rateInput" type="number" inputmode="decimal" class="settings-row__rate-input" />
            <button type="submit" class="settings-row__rate-save">Сохранить</button>
          </form>
          <button v-else class="settings-row__value" @click="startEditingRate">
            {{ formatMoney(budgetRatesStore.currentRate) }} <span>›</span>
          </button>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <p class="section-title">Категории</p>
      <CategoryTree />
    </div>
  </div>
</template>

<script>
import TopBar from '../layout/TopBar.vue';
import CategoryTree from './CategoryTree.vue';
import { useBudgetRatesStore } from '../../stores/budgetRates.js';
import { formatMoney } from '../../utils/currency.js';

export default {
  name: 'SettingsScreen',
  components: { TopBar, CategoryTree },
  data() {
    return {
      editingRate: false,
      rateInput: '',
    };
  },
  computed: {
    budgetRatesStore() {
      return useBudgetRatesStore();
    },
  },
  methods: {
    formatMoney,
    startEditingRate() {
      this.rateInput = String(this.budgetRatesStore.currentRate);
      this.editingRate = true;
    },
    async saveRate() {
      const amount = parseFloat(this.rateInput);
      if (!amount) return;
      await this.budgetRatesStore.setRate(amount);
      this.editingRate = false;
    },
  },
};
</script>

<style lang="scss">
.settings-group {
  margin-bottom: 22px;
}

.settings-list {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;

  &__label {
    font-size: 14.5px;
  }

  &__value {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-family: var(--font-money);
    color: var(--ink-muted);
  }

  &__rate-form {
    display: flex;
    gap: 8px;
  }

  &__rate-input {
    width: 90px;
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 6px 8px;
    font-family: var(--font-money);
    font-size: 14px;
  }

  &__rate-save {
    color: var(--accent-strong);
    font-weight: 600;
    font-size: 13px;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/settings/SettingsScreen.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/SettingsScreen.vue src/components/settings/SettingsScreen.spec.js
git commit -m "feat: add SettingsScreen"
```

---

## Task 25: App.vue — final wiring

**Files:**
- Modify: `src/App.vue`
- Test: `src/App.spec.js`

Every store is loaded exactly once here (the convention from Task 20). The expense modal starts `visible: true` — per spec §8 it greets the user on every launch — and the FAB reopens it after it's been closed.

- [ ] **Step 1: Write the failing test**

```js
// src/App.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import App from './App.vue';
import * as categoriesDb from './db/categories.js';
import * as ratesDb from './db/budgetRates.js';
import * as transactionsDb from './db/transactions.js';
import * as debtsDb from './db/debts.js';

vi.mock('./db/categories.js');
vi.mock('./db/budgetRates.js');
vi.mock('./db/transactions.js');
vi.mock('./db/debts.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  categoriesDb.seedDefaultCategoryIfEmpty.mockResolvedValue(undefined);
  categoriesDb.listCategories.mockResolvedValue([]);
  ratesDb.seedDefaultRateIfEmpty.mockResolvedValue(undefined);
  ratesDb.listRates.mockResolvedValue([{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }]);
  transactionsDb.listTransactions.mockResolvedValue([]);
  debtsDb.listDebts.mockResolvedValue([]);
  debtsDb.listAllPayments.mockResolvedValue([]);
});

describe('App on launch', () => {
  it('loads every store on mount', async () => {
    mount(App);
    await flushPromises();
    expect(categoriesDb.seedDefaultCategoryIfEmpty).toHaveBeenCalled();
    expect(ratesDb.seedDefaultRateIfEmpty).toHaveBeenCalled();
    expect(transactionsDb.listTransactions).toHaveBeenCalled();
    expect(debtsDb.listDebts).toHaveBeenCalled();
  });

  it('shows the expense modal immediately, unprompted', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('starts on the Бюджет tab', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.findComponent({ name: 'BudgetDashboard' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'DebtsScreen' }).exists()).toBe(false);
  });
});

describe('App navigation', () => {
  it('switches to the Долги screen when that tab is selected', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.findComponent({ name: 'TabBar' }).vm.$emit('update:active-tab', 'debts');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'DebtsScreen' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'BudgetDashboard' }).exists()).toBe(false);
  });

  it('reopens the expense modal from the FAB after it was closed', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.findComponent({ name: 'ExpenseModal' }).vm.$emit('close');
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(false);
    await wrapper.findComponent({ name: 'TabBar' }).vm.$emit('add-expense');
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('opens the settings overlay from the dashboard gear icon and closes it again', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.findComponent({ name: 'BudgetDashboard' }).vm.$emit('open-settings');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(true);
    await wrapper.find('.app-shell__settings-close').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.spec.js`
Expected: FAIL — the placeholder `App.vue` from Task 1 has none of this wiring.

- [ ] **Step 3: Implement `src/App.vue`**

```vue
<template>
  <div id="app-shell" class="app-shell">
    <div class="app-shell__content">
      <BudgetDashboard v-if="activeTab === 'budget'" @open-settings="showSettings = true" />
      <DebtsScreen v-else />
    </div>

    <div class="app-shell__tabs">
      <Toast :message="toastStore.message" />
      <TabBar :active-tab="activeTab" @update:active-tab="activeTab = $event" @add-expense="openAddModal" />
    </div>

    <template v-if="showSettings">
      <SettingsScreen class="app-shell__settings-overlay" />
      <button class="app-shell__settings-close" aria-label="Закрыть настройки" @click="showSettings = false">✕</button>
    </template>

    <ExpenseModal
      :visible="showExpenseModal"
      :editing-transaction="editingTransaction"
      @close="closeExpenseModal"
    />
  </div>
</template>

<script>
import BudgetDashboard from './components/budget/BudgetDashboard.vue';
import DebtsScreen from './components/debts/DebtsScreen.vue';
import SettingsScreen from './components/settings/SettingsScreen.vue';
import ExpenseModal from './components/expense/ExpenseModal.vue';
import TabBar from './components/layout/TabBar.vue';
import Toast from './components/layout/Toast.vue';
import { useCategoriesStore } from './stores/categories.js';
import { useBudgetRatesStore } from './stores/budgetRates.js';
import { useTransactionsStore } from './stores/transactions.js';
import { useDebtsStore } from './stores/debts.js';
import { useToastStore } from './stores/toast.js';

export default {
  name: 'App',
  components: { BudgetDashboard, DebtsScreen, SettingsScreen, ExpenseModal, TabBar, Toast },
  data() {
    return {
      activeTab: 'budget',
      showSettings: false,
      showExpenseModal: true, // greets the user on every launch, per spec §8
      editingTransaction: null,
    };
  },
  computed: {
    toastStore() {
      return useToastStore();
    },
  },
  async created() {
    await Promise.all([
      useCategoriesStore().load(),
      useBudgetRatesStore().load(),
      useTransactionsStore().load(),
      useDebtsStore().load(),
    ]);
  },
  methods: {
    openAddModal() {
      this.editingTransaction = null;
      this.showExpenseModal = true;
    },
    closeExpenseModal() {
      this.showExpenseModal = false;
      this.editingTransaction = null;
    },
  },
};
</script>

<style lang="scss">
.app-shell {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;

  // The two flex children below split "scrolls" from "doesn't scroll". Toast
  // must live in the latter: position: absolute inside an overflow-y: auto
  // ancestor scrolls away with that ancestor's content (verified in a real
  // browser — it does NOT behave like position: fixed), which is wrong for a
  // transient notification that should stay visible regardless of dashboard
  // scroll position.
  &__content {
    flex: 1;
    position: relative;
    overflow-y: auto;
    min-height: 0; // lets this child actually shrink/scroll instead of stretching .app-shell
  }

  &__tabs {
    position: relative; // containing block for Toast's `bottom: 100%`
    flex-shrink: 0;
  }

  &__settings-overlay {
    position: absolute;
    inset: 0;
    background: var(--ground);
    z-index: 20;
    overflow-y: auto;
    padding: 44px 18px 18px;
  }

  &__settings-close {
    position: absolute;
    top: 44px;
    right: 18px;
    z-index: 21;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--surface-raised);
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.spec.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: every spec file across the project passes (data layer, stores, and components — roughly 100 tests).

- [ ] **Step 6: Manual smoke test in a real browser**

Run: `npm run build && npm run preview`

Open the printed local URL and walk through:
1. The expense modal is open immediately on load.
2. Tap a keypad sequence, tap the seeded "💰 Расход" category — modal stays open, amount resets to 0, a toast confirms it.
3. Swipe the sheet down — dashboard is visible underneath with the updated "Бюджет на сегодня" figure and pie chart.
4. Switch to the Долги tab — empty state renders without errors (no debts exist yet).
5. Tap the gear icon — Settings opens over the dashboard; tap ✕ to close it.
6. Reload the page — the modal reopens automatically and all previously entered data is still there (confirms IndexedDB persistence survives a reload, the core promise from spec §3).

Report the outcome of this walkthrough before considering the phase done — do not claim completion on the automated tests alone (per verification-before-completion: a green test suite proves the units are correct, not that the assembled app works in an actual browser).

- [ ] **Step 7: Commit**

```bash
git add src/App.vue src/App.spec.js
git commit -m "feat: wire App shell — tabs, settings overlay, always-on-launch expense modal"
```

---

## Self-review

**Spec coverage** (`docs/superpowers/specs/2026-07-27-budget-app-design.md`) — every section checked against a task:

| Spec section | Covered by |
|---|---|
| §5 Stack (Vue 3 Options API, no TS, SCSS/BEM, no Tailwind) | Every task — no Composition API, no `.ts` file, no Tailwind class anywhere |
| §6 Data model | Tasks 4, 7, 8, 9, 10 |
| §7 Budget formula, backdating, month reset, forward-only rate change | Task 8 (`budgetMath.spec.js` — the exact worked examples) |
| §8 Expense modal: keypad precedence, date quick-picks, drill-down, dismiss, edit+delete | Tasks 14–17 |
| §9 Categories: seed, archive vs. delete, cascade | Tasks 7, 23 |
| §10 Dashboard: month nav, hero relabel, chart, pie + drill-down | Tasks 18–20 |
| §11 Navigation shell: 2 tabs, gear not a tab, FAB | Tasks 11, 25 |
| §12 Debts: segments, payment history, closed section, independence from budget | Tasks 10, 21, 22 |
| §1–§4 (PWA install, IP cert, auth, architecture) | **Phase 2 — intentionally excluded**, per spec §15 |
| §14 iCloud backup | **Explicitly out of scope**, not touched |

**Placeholder scan:** no "TBD"/"handle appropriately"/stub functions remain — `transactionCountFor` in Task 23 was caught during drafting (an early version returned `''` as a stand-in) and replaced with a real implementation before being added to this document.

**Type consistency:** verified the same names are used everywhere they cross a task boundary — `formatMoney` (Task 5) imported identically in Tasks 17, 19–22, 24; `evaluateExpression` (Task 6) only ever called from `ExpenseModal.onKey`'s sibling `commit` (Task 17); `useCategoriesStore().childrenOf(id)` / `.rootCategories` (Task 7) used with the same signature in Tasks 15, 19, 23; `useBudgetStore().availableForMonth(monthKey, todayDateKey?)` / `.spendForMonth(monthKey)` (Task 9) used identically in Task 20; `useDebtsStore().remainingOf(id)` / `.paymentsFor(id)` / `.openByDirection(direction)` / `.closedByDirection(direction)` (Task 10) used identically in Tasks 21–22.

**Two real gaps found while writing this plan — not silently patched, flagging for a decision:**

1. **No UI creates a new category.** The spec (§9) fully defines archive and delete, and Task 7's `categoriesStore.create()` exists and is tested — but no task puts a "add category" control anywhere. Left unaddressed, the app is stuck with the single seeded "💰 Расход" category forever. Minimal fix: a "+" row at the top of `CategoryTree` opening a small inline form (name + emoji text input + optional parent picker reusing the same flat list), the same pattern already used for the rate editor in Task 24.
2. **Nothing lets you reach an existing transaction to edit or delete it.** `ExpenseModal`'s edit mode (Task 17) is fully built and tested, but `App.vue` never sets `editingTransaction` to anything other than `null` — no list of past transactions exists anywhere in the approved design to tap from. Minimal fix: a scrollable transaction list for the viewed month (date, category emoji, amount), likely under the pie chart's legend on the Dashboard, where tapping a row opens `ExpenseModal` in edit mode.

Both are small (one new component + a couple of store calls each, everything they depend on already exists and is tested) but they are real product decisions — where exactly the control lives, what the add-category form looks like — that weren't part of the approved spec or prototype. I did not invent answers and bolt them onto this plan; flagging them for you now rather than guessing.

**Resolution:** both gaps are closed below, as Task 26 and Task 27.

---

## Task 26: Add-category form

**Files:**
- Modify: `src/components/settings/CategoryTree.vue`
- Modify: `src/components/settings/CategoryTree.spec.js`

A "+ Добавить категорию" toggle at the top of the tree reveals a form: emoji, name, and an optional parent picked from the same flattened list already rendered below it.

- [ ] **Step 1: Add the failing tests to `src/components/settings/CategoryTree.spec.js`**

Append these `describe` blocks to the existing file (keep everything already there):

```js
describe('CategoryTree — adding a category', () => {
  it('reveals a form when the add toggle is tapped', async () => {
    seed();
    const wrapper = mount(CategoryTree);
    await wrapper.find('.category-tree__add-toggle').trigger('click');
    expect(wrapper.find('.category-tree__add-form').exists()).toBe(true);
  });

  it('creates a root category with the entered name and emoji, then closes the form', async () => {
    seed();
    categoriesDb.createCategory.mockResolvedValue({ id: 'new1', name: 'Здоровье', emoji: '💊', parentId: null, archived: false });
    const wrapper = mount(CategoryTree);
    await wrapper.find('.category-tree__add-toggle').trigger('click');
    await wrapper.find('.category-tree__add-emoji').setValue('💊');
    await wrapper.find('.category-tree__add-name').setValue('Здоровье');
    await wrapper.find('.category-tree__add-form').trigger('submit');
    expect(categoriesDb.createCategory).toHaveBeenCalledWith({ name: 'Здоровье', emoji: '💊', parentId: null });
    expect(wrapper.find('.category-tree__add-form').exists()).toBe(false);
  });

  it('creates a subcategory when a parent is selected', async () => {
    seed();
    categoriesDb.createCategory.mockResolvedValue({ id: 'new2', name: 'Спортзал', emoji: '🏋️', parentId: 'food', archived: false });
    const wrapper = mount(CategoryTree);
    await wrapper.find('.category-tree__add-toggle').trigger('click');
    await wrapper.find('.category-tree__add-name').setValue('Спортзал');
    await wrapper.find('.category-tree__add-parent').setValue('food');
    await wrapper.find('.category-tree__add-form').trigger('submit');
    expect(categoriesDb.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Спортзал', parentId: 'food' })
    );
  });

  it('does not submit without a name', async () => {
    seed();
    const wrapper = mount(CategoryTree);
    await wrapper.find('.category-tree__add-toggle').trigger('click');
    await wrapper.find('.category-tree__add-form').trigger('submit');
    expect(categoriesDb.createCategory).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/settings/CategoryTree.spec.js`
Expected: FAIL — `.category-tree__add-toggle` does not exist yet.

- [ ] **Step 3: Update `src/components/settings/CategoryTree.vue`**

Replace the `<template>` block with:

```vue
<template>
  <div class="category-tree">
    <button class="category-tree__add-toggle" @click="addingOpen = !addingOpen">
      {{ addingOpen ? '‹ Отмена' : '+ Добавить категорию' }}
    </button>

    <form v-if="addingOpen" class="category-tree__add-form" @submit.prevent="submitAdd">
      <input v-model="newEmoji" class="category-tree__add-emoji" placeholder="🙂" maxlength="4" />
      <input v-model="newName" class="category-tree__add-name" placeholder="Название" />
      <select v-model="newParentId" class="category-tree__add-parent">
        <option :value="null">Без родителя</option>
        <option v-for="row in rows" :key="row.category.id" :value="row.category.id">
          {{ '—'.repeat(row.depth) }} {{ row.category.name }}
        </option>
      </select>
      <button type="submit" class="category-tree__add-submit">Создать</button>
    </form>

    <div
      v-for="row in rows"
      :key="row.category.id"
      class="tree-row"
      :class="{ 'tree-row--sub': row.depth > 0, 'tree-row--revealed': revealedId === row.category.id }"
      :style="{ paddingLeft: 14 + row.depth * 24 + 'px' }"
    >
      <span class="tree-row__emoji">{{ row.category.emoji }}</span>
      <span class="tree-row__name">{{ row.category.name }}</span>
      <button class="tree-row__more" aria-label="Действия" @click="toggleRevealed(row.category.id)">⋯</button>
      <div class="tree-row__actions">
        <button class="tree-row__action tree-row__action--archive" @click="archive(row.category.id)">Архив</button>
        <button class="tree-row__action tree-row__action--delete" @click="confirmDelete(row.category)">Удалить</button>
      </div>
    </div>
  </div>
</template>
```

Add to `data()` (merge with the existing returned object):

```js
data() {
  return {
    revealedId: null,
    addingOpen: false,
    newName: '',
    newEmoji: '',
    newParentId: null,
  };
},
```

Add to `methods` (merge with the existing methods):

```js
async submitAdd() {
  if (!this.newName.trim()) return;
  await this.categoriesStore.create({
    name: this.newName.trim(),
    emoji: this.newEmoji.trim() || '📁',
    parentId: this.newParentId,
  });
  this.newName = '';
  this.newEmoji = '';
  this.newParentId = null;
  this.addingOpen = false;
},
```

Add to the `<style lang="scss">` block:

```scss
.category-tree {
  &__add-toggle {
    display: block;
    width: 100%;
    text-align: left;
    padding: 10px 14px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--accent-strong);
  }

  &__add-form {
    display: flex;
    gap: 6px;
    padding: 0 14px 12px;
    flex-wrap: wrap;
  }

  &__add-emoji {
    width: 44px;
    text-align: center;
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 6px;
  }

  &__add-name {
    flex: 1;
    min-width: 100px;
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 14px;
  }

  &__add-parent {
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 13px;
  }

  &__add-submit {
    color: var(--accent-strong);
    font-weight: 600;
    font-size: 13px;
    padding: 6px 8px;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/settings/CategoryTree.spec.js`
Expected: PASS (9 tests total — 5 from Task 23 plus 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/CategoryTree.vue src/components/settings/CategoryTree.spec.js
git commit -m "feat: add category creation form"
```

---

## Task 27: Transaction list (edit entry point)

**Files:**
- Create: `src/components/budget/TransactionList.vue`
- Test: `src/components/budget/TransactionList.spec.js`
- Modify: `src/components/budget/BudgetDashboard.vue`
- Modify: `src/components/budget/BudgetDashboard.spec.js`
- Modify: `src/App.vue`
- Modify: `src/App.spec.js`

A scrollable list under the pie chart's legend, most recent first; tapping a row is the only way to reach `ExpenseModal`'s edit mode (built in Task 17, unreachable until now).

- [ ] **Step 1: Write the failing test for the list itself**

```js
// src/components/budget/TransactionList.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import TransactionList from './TransactionList.vue';
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';

beforeEach(() => {
  setActivePinia(createPinia());
  useCategoriesStore().items = [{ id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false }];
  useTransactionsStore().items = [
    { id: 't1', date: '2026-07-05', amount: 500, categoryId: 'food' },
    { id: 't2', date: '2026-07-20', amount: 1200, categoryId: 'food' },
    { id: 't3', date: '2026-06-01', amount: 999, categoryId: 'food' },
  ];
});

describe('TransactionList', () => {
  it('lists only transactions within the given month, most recent first', () => {
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-07' } });
    const rows = wrapper.findAll('.transaction-list__row');
    expect(rows).toHaveLength(2);
    expect(rows[0].find('.transaction-list__amount').text()).toBe('1 200 ₽');
  });

  it('shows the category emoji and name', () => {
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-07' } });
    expect(wrapper.findAll('.transaction-list__row')[0].text()).toContain('🍔');
    expect(wrapper.findAll('.transaction-list__row')[0].text()).toContain('Еда');
  });

  it('shows an empty state when there are no transactions that month', () => {
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-01' } });
    expect(wrapper.find('.transaction-list__empty').exists()).toBe(true);
  });

  it('emits edit with the transaction when a row is tapped', async () => {
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-07' } });
    await wrapper.findAll('.transaction-list__row')[0].trigger('click');
    expect(wrapper.emitted('edit')[0][0]).toMatchObject({ id: 't2' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/budget/TransactionList.spec.js`
Expected: FAIL — module `./TransactionList.vue` does not exist.

- [ ] **Step 3: Implement `src/components/budget/TransactionList.vue`**

```vue
<template>
  <div class="transaction-list">
    <p class="section-title">Транзакции за месяц</p>
    <p v-if="rows.length === 0" class="transaction-list__empty">Пока нет расходов в этом месяце</p>
    <button
      v-for="row in rows"
      :key="row.transaction.id"
      class="transaction-list__row"
      @click="$emit('edit', row.transaction)"
    >
      <span class="transaction-list__date">{{ row.transaction.date.slice(8, 10) }}</span>
      <span class="transaction-list__emoji">{{ row.category ? row.category.emoji : '❓' }}</span>
      <span class="transaction-list__name">{{ row.category ? row.category.name : 'Без категории' }}</span>
      <span class="transaction-list__amount">{{ formatMoney(row.transaction.amount) }}</span>
    </button>
  </div>
</template>

<script>
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';
import { formatMoney } from '../../utils/currency.js';

export default {
  name: 'TransactionList',
  props: {
    monthKey: {
      type: String,
      required: true,
    },
  },
  emits: ['edit'],
  computed: {
    categoriesStore() {
      return useCategoriesStore();
    },
    rows() {
      const transactionsStore = useTransactionsStore();
      return transactionsStore.items
        .filter((t) => t.date.startsWith(this.monthKey))
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((transaction) => ({
          transaction,
          category: this.categoriesStore.byId(transaction.categoryId),
        }));
    },
  },
  methods: {
    formatMoney,
  },
};
</script>

<style lang="scss">
.transaction-list {
  padding-bottom: 12px;

  &__empty {
    font-size: 13px;
    color: var(--ink-muted);
    padding: 8px 4px;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 4px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  &__date {
    font-family: var(--font-money);
    font-size: 12px;
    color: var(--ink-muted);
    width: 20px;
  }

  &__emoji {
    font-size: 15px;
  }

  &__name {
    flex: 1 1 auto;
    font-size: 14px;
  }

  &__amount {
    font-family: var(--font-money);
    font-size: 13px;
    color: var(--ink-secondary);
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/budget/TransactionList.spec.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the failing test for Dashboard wiring to `src/components/budget/BudgetDashboard.spec.js`**

Append this `describe` block to the existing file:

```js
describe('BudgetDashboard — transaction list', () => {
  it('forwards TransactionList\'s edit event as edit-transaction', async () => {
    const wrapper = mount(BudgetDashboard);
    const transaction = { id: 't1', date: '2026-07-05', amount: 500, categoryId: 'food' };
    await wrapper.findComponent({ name: 'TransactionList' }).vm.$emit('edit', transaction);
    expect(wrapper.emitted('edit-transaction')[0]).toEqual([transaction]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/components/budget/BudgetDashboard.spec.js`
Expected: FAIL — `TransactionList` is not rendered by `BudgetDashboard` yet, and `edit-transaction` is not declared.

- [ ] **Step 7: Update `src/components/budget/BudgetDashboard.vue`**

Add the import:

```js
import TransactionList from './TransactionList.vue';
```

Add `TransactionList` to the `components` object (alongside `TopBar, MonthNav, MonthChart, CategoryPie`) and add `'edit-transaction'` to the `emits` array (alongside `'open-settings'`).

Add to the end of the `<template>`, right after `<CategoryPie :month-key="currentMonthKey" />`:

```vue
<TransactionList :month-key="currentMonthKey" @edit="$emit('edit-transaction', $event)" />
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/components/budget/BudgetDashboard.spec.js`
Expected: PASS (8 tests total — 7 from Task 20 plus 1 new).

- [ ] **Step 9: Add the failing test for App-level wiring to `src/App.spec.js`**

Append this `describe` block to the existing file:

```js
describe('App — editing a transaction from the dashboard list', () => {
  it('opens the expense modal in edit mode with the selected transaction', async () => {
    const wrapper = mount(App);
    await flushPromises();
    const transaction = { id: 't1', date: '2026-07-05', amount: 500, categoryId: 'food' };
    await wrapper.findComponent({ name: 'BudgetDashboard' }).vm.$emit('edit-transaction', transaction);
    await wrapper.vm.$nextTick();
    const modal = wrapper.findComponent({ name: 'ExpenseModal' });
    expect(modal.props('visible')).toBe(true);
    expect(modal.props('editingTransaction')).toEqual(transaction);
  });

  it('clears editingTransaction after the modal closes, so the next FAB tap starts a fresh entry', async () => {
    const wrapper = mount(App);
    await flushPromises();
    const transaction = { id: 't1', date: '2026-07-05', amount: 500, categoryId: 'food' };
    await wrapper.findComponent({ name: 'BudgetDashboard' }).vm.$emit('edit-transaction', transaction);
    await wrapper.findComponent({ name: 'ExpenseModal' }).vm.$emit('close');
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('editingTransaction')).toBeNull();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm test -- src/App.spec.js`
Expected: FAIL — `BudgetDashboard` does not emit `edit-transaction` to anything yet in `App.vue`.

- [ ] **Step 11: Update `src/App.vue`**

Change the `BudgetDashboard` tag in the template to:

```vue
<BudgetDashboard
  v-if="activeTab === 'budget'"
  @open-settings="showSettings = true"
  @edit-transaction="openEditModal"
/>
```

Add this method alongside `openAddModal` and `closeExpenseModal`:

```js
openEditModal(transaction) {
  this.editingTransaction = transaction;
  this.showExpenseModal = true;
},
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test -- src/App.spec.js`
Expected: PASS (8 tests total — 6 from Task 25 plus 2 new).

- [ ] **Step 13: Run the full test suite one more time**

Run: `npm test`
Expected: every spec file passes.

- [ ] **Step 14: Commit**

```bash
git add src/components/budget/TransactionList.vue src/components/budget/TransactionList.spec.js src/components/budget/BudgetDashboard.vue src/components/budget/BudgetDashboard.spec.js src/App.vue src/App.spec.js
git commit -m "feat: add transaction list as the edit entry point"
```

---

## Task 28: Add-debt form (third gap found during execution)

**Files:**
- Modify: `src/components/debts/DebtsScreen.vue`
- Modify: `src/components/debts/DebtsScreen.spec.js`

Found the same way as Tasks 26/27: Task 10's code-quality review flagged that a debt created with `amount: 0` would be immediately indistinguishable from a paid-off one, which surfaced the bigger gap behind it — nothing in the plan ever wires up a way to create a debt at all. `DebtsScreen` only ever reads existing `items`; no task calls `debtsStore.create`. A "+" toggle in the top bar reveals an inline form (name, amount, comment), mirroring Task 26's add-category pattern. The debt's `direction` is read from whichever segment is currently active when the form is submitted — no separate direction picker needed, since the segmented control already is that choice. The `amount ≤ 0` guard closes the edge case that surfaced this gap in the first place.

- [ ] **Step 1: Write the failing tests**

Append these `describe` blocks to the existing `src/components/debts/DebtsScreen.spec.js` (and add `vi` to the vitest import, plus a mocked `debtsDb` import — both shown below; the existing tests need no changes and are unaffected since none of them ever reach the DB layer):

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import DebtsScreen from './DebtsScreen.vue';
import { useDebtsStore } from '../../stores/debts.js';
import * as debtsDb from '../../db/debts.js';

vi.mock('../../db/debts.js');
```

(This replaces the existing top-of-file imports — the only change is adding `vi` to the vitest import and the two new lines for `debtsDb` + `vi.mock`. The existing `beforeEach` that seeds `store.items`/`store.payments` directly stays exactly as-is below it.)

```js
describe('DebtsScreen — adding a debt', () => {
  it('reveals a form when the add toggle is tapped', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    expect(wrapper.find('.debts-screen__add-form').exists()).toBe(true);
  });

  it('creates a debt with the currently active segment as its direction', async () => {
    debtsDb.createDebt.mockResolvedValue({ id: 'd4', name: 'Олег', amount: 500, comment: '', direction: 'owed_to_me' });
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-name').setValue('Олег');
    await wrapper.find('.debts-screen__add-amount').setValue('500');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    expect(debtsDb.createDebt).toHaveBeenCalledWith(expect.objectContaining({ direction: 'owed_to_me' }));
  });

  it('creates with the other direction after switching segments', async () => {
    debtsDb.createDebt.mockResolvedValue({ id: 'd5', name: 'Кредит', amount: 1000, comment: '', direction: 'i_owe' });
    const wrapper = mount(DebtsScreen);
    await wrapper.findAll('.segmented__opt')[1].trigger('click'); // switch to "Я должен"
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-name').setValue('Кредит');
    await wrapper.find('.debts-screen__add-amount').setValue('1000');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    expect(debtsDb.createDebt).toHaveBeenCalledWith(expect.objectContaining({ direction: 'i_owe' }));
  });

  it('does not submit without a name or a positive amount', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    expect(debtsDb.createDebt).not.toHaveBeenCalled();
  });

  it('rejects an amount of zero, the exact edge case that surfaced this gap', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-name').setValue('Тест');
    await wrapper.find('.debts-screen__add-amount').setValue('0');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    expect(debtsDb.createDebt).not.toHaveBeenCalled();
  });

  it('closes the form after a successful submission', async () => {
    debtsDb.createDebt.mockResolvedValue({ id: 'd6', name: 'X', amount: 100, comment: '', direction: 'owed_to_me' });
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-name').setValue('X');
    await wrapper.find('.debts-screen__add-amount').setValue('100');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    expect(wrapper.find('.debts-screen__add-form').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/debts/DebtsScreen.spec.js`
Expected: FAIL — `.debts-screen__add-toggle` does not exist yet.

- [ ] **Step 3: Update `src/components/debts/DebtsScreen.vue`**

Replace the `<template>` block with:

```vue
<template>
  <div class="debts-screen">
    <TopBar title="Долги">
      <template #right>
        <button class="debts-screen__add-toggle" aria-label="Добавить долг" @click="addingOpen = !addingOpen">
          {{ addingOpen ? '✕' : '+' }}
        </button>
      </template>
    </TopBar>

    <form v-if="addingOpen" class="debts-screen__add-form" @submit.prevent="submitAdd">
      <input v-model="newName" class="debts-screen__add-name" placeholder="Название" />
      <input v-model="newAmount" type="number" inputmode="decimal" class="debts-screen__add-amount" placeholder="Сумма" />
      <input v-model="newComment" class="debts-screen__add-comment" placeholder="Комментарий (необязательно)" />
      <button type="submit" class="debts-screen__add-submit">Добавить</button>
    </form>

    <div class="segmented">
      <button
        v-for="option in segments"
        :key="option.value"
        class="segmented__opt"
        :class="{ 'segmented__opt--active': option.value === direction }"
        @click="direction = option.value"
      >{{ option.label }}</button>
    </div>

    <DebtCard v-for="debt in openDebts" :key="debt.id" :debt="debt" />

    <button class="closed-toggle" @click="closedOpen = !closedOpen">
      <span>{{ closedOpen ? '⌄' : '›' }}</span> Закрытые ({{ closedDebts.length }})
    </button>
    <div v-if="closedOpen" class="closed-list">
      <div v-for="debt in closedDebts" :key="debt.id" class="closed-card">
        <span class="closed-card__name">{{ debt.name }}</span>
        <span>{{ formatMoney(debt.amount) }}</span>
      </div>
    </div>
  </div>
</template>
```

Add to `data()` (merge with the existing returned object):

```js
data() {
  return {
    direction: 'owed_to_me',
    closedOpen: false,
    addingOpen: false,
    newName: '',
    newAmount: '',
    newComment: '',
    segments: [
      { value: 'owed_to_me', label: 'Мне должны' },
      { value: 'i_owe', label: 'Я должен' },
    ],
  };
},
```

Add to `methods` (merge with the existing `formatMoney`):

```js
async submitAdd() {
  const amount = parseFloat(this.newAmount);
  if (!this.newName.trim() || !amount || amount <= 0) return;
  await this.debtsStore.create({
    name: this.newName.trim(),
    amount,
    comment: this.newComment.trim(),
    direction: this.direction,
  });
  this.newName = '';
  this.newAmount = '';
  this.newComment = '';
  this.addingOpen = false;
},
```

Add to the `<style lang="scss">` block:

```scss
.debts-screen {
  &__add-toggle {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: 16px;
  }

  &__add-form {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__add-name {
    flex: 2;
    min-width: 120px;
  }

  &__add-amount {
    flex: 1;
    min-width: 80px;
  }

  &__add-comment {
    flex: 1 1 100%;
  }

  &__add-name,
  &__add-amount,
  &__add-comment {
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
  }

  &__add-submit {
    flex: 1 1 100%;
    padding: 10px;
    border-radius: 11px;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 650;
    font-size: 13.5px;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/debts/DebtsScreen.spec.js`
Expected: PASS (10 tests total — 4 from Task 22 plus 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/debts/DebtsScreen.vue src/components/debts/DebtsScreen.spec.js
git commit -m "feat: add debt creation form"
```

---

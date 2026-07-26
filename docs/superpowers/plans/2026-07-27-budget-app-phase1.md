# Бюджет на день — Phase 1 (автономное приложение) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fully offline-capable, installable iPhone PWA implementing the daily-budget and debts features against local IndexedDB storage — no server dependency.

**Architecture:** Vue 3 (Options API, no TypeScript) SPA with no router — a single App shell switches between two tabs (Бюджет / Долги) plus a Settings overlay and an always-on-launch expense modal, all driven by Pinia stores backed by an IndexedDB persistence layer (via `idb`). vite-plugin-pwa generates the service worker and manifest for home-screen install.

**Tech Stack:** Vite, Vue 3 (Options API), Pinia, SCSS (BEM), `idb`, vite-plugin-pwa, Vitest + @vue/test-utils + happy-dom.

**Reference:** Full product spec at `docs/superpowers/specs/2026-07-27-budget-app-design.md`. Visual prototype: https://claude.ai/code/artifact/84111cb8-abd6-4ebc-95a8-9d17a5427f02

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

$font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
$font-money: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
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
  font-family: $font-ui;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: none;
}

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
@use 'tokens' as *;
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
import { toDateKey, toMonthKey, daysInMonth, daysElapsedInMonth } from './date.js';

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
```

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
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/utils/date.spec.js`
Expected: PASS (9 tests).

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
Expected: PASS (4 tests).

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
Expected: PASS (6 tests).

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
  const existing = await db.get('debts', id);
  if (!existing) throw new Error(`Debt ${id} not found`);
  const updated = { ...existing, ...changes };
  await db.put('debts', updated);
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
Expected: PASS (5 tests).

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
Expected: PASS (4 tests).

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
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/components/layout/Toast.spec.js`
Expected: FAIL — module `./Toast.vue` does not exist.

- [ ] **Step 7: Implement `src/components/layout/Toast.vue`**

```vue
<template>
  <Transition name="toast">
    <div v-if="message" class="toast">{{ message }}</div>
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
  position: absolute;
  left: 50%;
  bottom: 28px;
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
Expected: PASS (2 tests).

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/expense/Keypad.spec.js`
Expected: FAIL — module `./Keypad.vue` does not exist.

- [ ] **Step 3: Implement `src/components/expense/Keypad.vue`**

```vue
<template>
  <div class="keypad">
    <button
      v-for="key in keys"
      :key="key.value"
      class="keypad__key"
      :class="{ 'keypad__key--op': key.type === 'op', 'keypad__key--del': key.type === 'del' }"
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
        { value: ',', label: ',' }, { value: '0', label: '0' }, { value: 'del', label: '⌫', type: 'del' }, { value: '+', label: '+', type: 'op' },
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
    font-family: $font-money;

    &--op {
      background: transparent;
      color: var(--accent-strong);
      font-family: $font-ui;
    }

    &--del {
      color: var(--negative);
      font-family: $font-ui;
      font-size: 16px;
    }
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/expense/Keypad.spec.js`
Expected: PASS (4 tests).

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
  data() {
    return {
      otherLabel: 'Другая дата',
    };
  },
  computed: {
    mode() {
      if (this.modelValue === todayKey()) return 'today';
      if (this.modelValue === yesterdayKey()) return 'yesterday';
      return 'other';
    },
  },
  methods: {
    todayKeyValue: todayKey,
    yesterdayKeyValue: yesterdayKey,
    onNativeChange(event) {
      const value = event.target.value;
      if (!value) return;
      this.otherLabel = new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
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
  }

  &__native {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    cursor: pointer;
  }
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/expense/DatePicker.spec.js`
Expected: PASS (6 tests).

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

- [ ] **Step 1: Write the failing test**

```js
// src/components/expense/ExpenseModal.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
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

  it('does nothing when a category is tapped with no amount entered', async () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.createTransaction).not.toHaveBeenCalled();
  });

  it('resets the amount after a successful commit and stays open', async () => {
    transactionsDb.createTransaction.mockResolvedValue({ id: 't1', amount: 500, date: '2026-07-27', categoryId: 'fun' });
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    await wrapper.find('.category-picker__row').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('0');
    expect(wrapper.emitted('close')).toBeUndefined();
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
    expect(transactionsDb.deleteTransaction).toHaveBeenCalledWith('t1');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('closes after committing an edit', async () => {
    transactionsDb.updateTransaction.mockResolvedValue(editingTransaction);
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction } });
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.updateTransaction).toHaveBeenCalledWith('t1', expect.objectContaining({ amount: 750 }));
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/expense/ExpenseModal.spec.js`
Expected: FAIL — module `./ExpenseModal.vue` does not exist.

- [ ] **Step 3: Implement `src/components/expense/ExpenseModal.vue`**

```vue
<template>
  <div v-if="visible" class="expense-modal">
    <div class="expense-modal__backdrop"></div>
    <div class="expense-modal__sheet">
      <div class="expense-modal__handle-row">
        <div class="expense-modal__handle"></div>
        <button class="expense-modal__close" aria-label="Закрыть" @click="close">✕</button>
      </div>

      <div class="expense-modal__entry">
        <p class="expense-modal__entry-label">Сумма расхода</p>
        <div class="expense-modal__entry-value">{{ raw || '0' }}</div>
      </div>

      <DatePicker v-model="date" />

      <CategoryPicker ref="picker" @pick="commit" />

      <Keypad @key="onKey" />

      <button v-if="editingTransaction" class="expense-modal__delete" @click="onDelete">Удалить</button>
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
      if (key === 'del') {
        this.raw = this.raw.slice(0, -1);
      } else if (key === ',') {
        const lastNumber = this.raw.split(/[+\-−×÷]/).pop();
        if (!lastNumber.includes(',')) this.raw += ',';
      } else if (['+', '−', '×', '÷'].includes(key)) {
        if (this.raw && !/[+\-−×÷]$/.test(this.raw)) this.raw += key;
      } else {
        this.raw += key;
      }
    },
    async commit(category) {
      if (!this.raw) return;
      const amount = evaluateExpression(this.raw);
      const transactionsStore = useTransactionsStore();
      const toast = useToastStore();

      if (this.editingTransaction) {
        await transactionsStore.update(this.editingTransaction.id, {
          amount,
          date: this.date,
          categoryId: category.id,
        });
        toast.show(`Изменено: ${category.emoji} ${category.name} · ${formatMoney(amount)}`);
        this.close();
      } else {
        await transactionsStore.create({ amount, date: this.date, categoryId: category.id });
        toast.show(`Добавлено: ${category.emoji} ${category.name} · ${formatMoney(amount)}`);
        this.raw = '';
        this.date = todayKey();
        this.$refs.picker.reset();
      }
    },
    async onDelete() {
      const transactionsStore = useTransactionsStore();
      await transactionsStore.remove(this.editingTransaction.id);
      this.close();
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
    font-family: $font-money;
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
Expected: PASS (9 tests).

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
];

describe('MonthChart', () => {
  it('renders one column per month', () => {
    const wrapper = mount(MonthChart, { props: { months } });
    expect(wrapper.findAll('.month-chart__col')).toHaveLength(4);
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
        class="month-chart__col"
        :class="{
          'month-chart__col--active': month.active,
          'month-chart__col--negative': month.negative,
          'month-chart__col--empty': month.empty,
        }"
        :disabled="month.empty"
        @click="$emit('select', month.key)"
      >
        <span class="month-chart__bar-wrap">
          <span class="month-chart__bar" :style="{ '--h': month.heightPct }"></span>
        </span>
        <span class="month-chart__label">{{ month.short }}</span>
      </button>
    </div>
  </div>
</template>

<script>
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
        heightPct: m.empty ? 4 : Math.max(6, Math.round((m.total / max) * 100)),
      }));
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
Expected: PASS (6 tests).

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
    <button v-if="stack.length" class="category-pie__back" @click="back">‹ Назад ко всем категориям</button>

    <div class="category-pie__chart" :style="{ background: gradient }"></div>

    <div class="category-pie__legend">
      <button
        v-for="row in rows"
        :key="row.category.id"
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
    subtreeIds(rootId) {
      const ids = [rootId];
      for (const child of this.categoriesStore.childrenOf(rootId)) {
        ids.push(...this.subtreeIds(child.id));
      }
      return ids;
    },
    amountFor(category) {
      const ids = this.subtreeIds(category.id);
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
    font-family: $font-money;
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
        <button class="budget-dashboard__settings" aria-label="Настройки" @click="$emit('open-settings')">⚙️</button>
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
import { todayKey, toMonthKey } from '../../utils/date.js';

const MONTH_NAMES = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTH_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTH_INITIALS = ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'];

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default {
  name: 'BudgetDashboard',
  components: { TopBar, MonthNav, MonthChart, CategoryPie },
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
      const [y, m] = this.currentMonthKey.split('-').map(Number);
      const name = MONTH_NAMES[m - 1];
      return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
    },
    monthGenitive() {
      const m = Number(this.currentMonthKey.slice(5, 7));
      return MONTH_GENITIVE[m - 1];
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
          short: MONTH_INITIALS[i],
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
    prevMonth() {
      this.currentMonthKey = shiftMonth(this.currentMonthKey, -1);
    },
    nextMonth() {
      if (this.canGoNext) this.currentMonthKey = shiftMonth(this.currentMonthKey, 1);
    },
    goToMonth(key) {
      this.currentMonthKey = key;
    },
  },
};
</script>

<style lang="scss">
.budget-dashboard {
  &__settings {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
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
    font-family: $font-money;
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
Expected: PASS (8 tests).

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
    font-family: $font-money;
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
    font-family: $font-money;
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
    font-family: $font-money;
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
    font-family: $font-money;
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
    font-family: $font-money;
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
    <BudgetDashboard v-if="activeTab === 'budget'" @open-settings="showSettings = true" />
    <DebtsScreen v-else />

    <TabBar :active-tab="activeTab" @update:active-tab="activeTab = $event" @add-expense="openAddModal" />

    <template v-if="showSettings">
      <SettingsScreen class="app-shell__settings-overlay" />
      <button class="app-shell__settings-close" aria-label="Закрыть настройки" @click="showSettings = false">✕</button>
    </template>

    <ExpenseModal
      :visible="showExpenseModal"
      :editing-transaction="editingTransaction"
      @close="closeExpenseModal"
    />

    <Toast :message="toastStore.message" />
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

---

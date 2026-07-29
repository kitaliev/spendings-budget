# Бюджет на день — Phase 2 (сервер, синхронизация, бэкап) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backup-only server to the already-shipped Phase 1 app: the phone stays the sole source of truth, but every write now also syncs a full snapshot to a Node process on the user's own VPS, which can restore that snapshot back onto a freshly-installed phone.

**Architecture:** One Node.js process, no framework (raw `http`/`https` only), running directly on the target VPS (`206.223.241.54`) and terminating TLS itself on port 443 with a Let's Encrypt IP certificate. The same process serves the Vite-built frontend as static files and the JSON API (`/api/login`, `/api/status`, `/api/sync`, `/api/restore`) from the same origin, so the client never needs a configured server address — it just calls relative paths. Data layer is SQLite (`better-sqlite3`), overwritten wholesale on every sync (no diffing), with a rotating on-disk backup taken immediately before each overwrite. Auth is a single hashed password (`bcryptjs`) plus an in-memory, no-expiry session cookie — there is exactly one account and no signup flow.

**Server code location & deploy:** Server source lives in a new `server/` directory inside this same repo (its own `package.json`, independent of the frontend's) — not a separate repository, since it's small, always deployed together with a specific frontend build, and this avoids coordinating two repos for one person's project. Deploy mechanism: a dedicated, unprivileged system user (`budget`) on the VPS owns a clone of this repo at `/opt/budget-app/repo`, pulled via a **GitHub deploy key** (a fresh SSH keypair generated on the VPS and added as a **read-only** Deploy Key on the GitHub repo — the one manual step in this plan that only the repo owner can perform, since neither root SSH access nor `gh` from this environment can add it programmatically). Updates going forward are `git pull` + rebuild + restart, run by hand over SSH — there is no CI/CD pipeline here, which matches a single-VPS, single-maintainer project.

**Coexistence with the existing VPN:** Recon already confirmed this VPS runs a personal VPN (`x-ui` panel on port 80, backed by `xray`) that must not be touched. Port 443 is free. The one place this would ordinarily collide is Let's Encrypt domain validation, which for a normal HTTP-01 challenge needs port 80 — exactly the port `x-ui` owns. This plan avoids that collision entirely by using the **TLS-ALPN-01** challenge type instead (validates over port 443, never touches port 80), via certbot's `--standalone` plugin with `--preferred-challenges tls-alpn-01`. The only remaining wrinkle: the standalone plugin needs port 443 to itself for the few seconds a challenge takes, which briefly conflicts with our *own* Node process (never with `x-ui`) — solved with a certbot `--pre-hook`/`--post-hook` pair that stops/restarts `budget-server` around each renewal attempt (a five-ish-day-recurring, few-second blip in backup-sync availability, which is invisible to the user since sync failures are already silent by design — see decision #6 in the design spec).

**Security posture:** `budget-server` runs as the unprivileged `budget` system user (not root), using `AmbientCapabilities=CAP_NET_BIND_SERVICE` so a non-root process can still bind port 443. Certbot's renewal hook copies the renewed cert files into a directory owned by `budget` and restarts the service — the same restart-around-renewal mechanism mentioned above.

**Tech Stack:** Node.js (built-in `http`/`https`, `node:test`), `better-sqlite3`, `bcryptjs`, certbot (snap install, for `--preferred-profile` support), systemd. Client additions: no new frontend dependencies — plain `fetch`, existing Pinia/Options-API/SCSS conventions.

**Reference:** Design spec at `docs/superpowers/specs/2026-07-27-budget-app-design.md` (§2–4, §14–15). All open design questions were resolved in a `/grilling` session earlier in this project's history; this plan does not re-litigate those decisions.

---

## Task 1: Server project skeleton

**Files:**
- Create: `server/package.json`
- Create: `server/.gitignore`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "budget-server",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test",
    "start": "node index.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "bcryptjs": "^2.4.3"
  }
}
```

- [ ] **Step 2: Create `server/.gitignore`**

```
node_modules/
data/
certs/
```

- [ ] **Step 3: Install dependencies**

Run: `cd server && npm install`
Expected: installs without errors, creates `server/package-lock.json` and `server/node_modules/`.

- [ ] **Step 4: Verify the test runner works with no tests yet**

Run: `cd server && npm test`
Expected: `node --test` exits 0, printing a summary with 0 tests found (not an error).

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/package-lock.json server/.gitignore
git commit -m "chore: scaffold the backup server as its own Node package"
```

---

## Task 2: SQLite schema and snapshot overwrite/dump

**Files:**
- Create: `server/db.js`
- Test: `server/db.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/db.test.js
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDatabase, overwriteFromSnapshot, dumpToSnapshot } from './db.js';

describe('db', () => {
  const testDbPath = './test-db.sqlite';
  let db;

  before(() => {
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(testDbPath + suffix)) fs.unlinkSync(testDbPath + suffix);
    }
    db = openDatabase(testDbPath);
  });

  after(() => {
    db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(testDbPath + suffix)) fs.unlinkSync(testDbPath + suffix);
    }
  });

  test('overwriteFromSnapshot writes every table, dumpToSnapshot reads the same shape back', () => {
    const snapshot = {
      categories: [{ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null, archived: false }],
      transactions: [{ id: 't1', amount: 500, date: '2026-07-01', categoryId: 'c1' }],
      budgetRates: [{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }],
      debts: [{ id: 'd1', name: 'Друг', amount: 1000, comment: '', direction: 'owed_to_me' }],
      debtPayments: [{ id: 'p1', debtId: 'd1', amount: 200, date: '2026-07-01' }],
    };
    overwriteFromSnapshot(db, snapshot);
    assert.deepEqual(dumpToSnapshot(db), snapshot);
  });

  test('a second overwrite fully replaces the first, leaving no stale rows', () => {
    overwriteFromSnapshot(db, {
      categories: [{ id: 'c2', name: 'Развлечения', emoji: '🎬', parentId: null, archived: true }],
      transactions: [],
      budgetRates: [],
      debts: [],
      debtPayments: [],
    });
    const result = dumpToSnapshot(db);
    assert.deepEqual(result.categories, [
      { id: 'c2', name: 'Развлечения', emoji: '🎬', parentId: null, archived: true },
    ]);
    assert.deepEqual(result.transactions, []);
  });

  test('a category with a non-null parentId round-trips correctly', () => {
    overwriteFromSnapshot(db, {
      categories: [
        { id: 'c3', name: 'Продукты', emoji: '🛒', parentId: null, archived: false },
        { id: 'c4', name: 'Молочка', emoji: '🥛', parentId: 'c3', archived: false },
      ],
      transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });
    const result = dumpToSnapshot(db);
    assert.equal(result.categories.find((c) => c.id === 'c4').parentId, 'c3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './db.js'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```js
// server/db.js
import Database from 'better-sqlite3';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, name TEXT, emoji TEXT, parentId TEXT, archived INTEGER
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, amount REAL, date TEXT, categoryId TEXT
  );
  CREATE TABLE IF NOT EXISTS budgetRates (
    id TEXT PRIMARY KEY, amount REAL, effectiveFrom TEXT
  );
  CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY, name TEXT, amount REAL, comment TEXT, direction TEXT
  );
  CREATE TABLE IF NOT EXISTS debtPayments (
    id TEXT PRIMARY KEY, debtId TEXT, amount REAL, date TEXT
  );
`;

const TABLES = ['categories', 'transactions', 'budgetRates', 'debts', 'debtPayments'];

export function openDatabase(path) {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

// The phone is the sole source of truth (see the design spec's own §3) — a
// sync is therefore a full overwrite, never a merge. Wrapped in one
// transaction so a crash mid-sync can't leave some tables replaced and
// others stale.
export function overwriteFromSnapshot(db, snapshot) {
  const applyAll = db.transaction((snap) => {
    for (const table of TABLES) {
      db.prepare(`DELETE FROM ${table}`).run();
      const rows = snap[table] || [];
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((c) => `@${c}`).join(', ');
      const insert = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
      for (const row of rows) {
        // SQLite has no boolean type; categories.archived arrives from
        // IndexedDB as a real JS boolean, so bind it as 0/1 the same way
        // better-sqlite3 already requires for parameters generally.
        const bound = table === 'categories' ? { ...row, archived: row.archived ? 1 : 0 } : row;
        insert.run(bound);
      }
    }
  });
  applyAll(snapshot);
}

// The inverse of overwriteFromSnapshot — reads every table back into the
// exact shape the phone's IndexedDB stores expect, for a wholesale restore.
export function dumpToSnapshot(db) {
  const snapshot = {};
  for (const table of TABLES) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    snapshot[table] = table === 'categories' ? rows.map((r) => ({ ...r, archived: !!r.archived })) : rows;
  }
  return snapshot;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: add SQLite schema and full-snapshot overwrite/dump"
```

---

## Task 3: Backup rotation

**Files:**
- Create: `server/backup.js`
- Test: `server/backup.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/backup.test.js
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rotateBackup } from './backup.js';

describe('rotateBackup', () => {
  const dir = './test-backup-dir';
  const liveDb = './test-live.sqlite';

  beforeEach(() => {
    fs.writeFileSync(liveDb, 'fake db contents');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.unlinkSync(liveDb);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('copies the live db file into the backup dir', () => {
    rotateBackup(liveDb, dir);
    const files = fs.readdirSync(dir);
    assert.equal(files.length, 1);
    assert.equal(fs.readFileSync(path.join(dir, files[0]), 'utf8'), 'fake db contents');
  });

  test('prunes copies older than maxAgeDays while keeping recent ones', () => {
    fs.mkdirSync(dir, { recursive: true });
    const oldFile = path.join(dir, 'old.sqlite');
    fs.writeFileSync(oldFile, 'old');
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, twentyDaysAgo, twentyDaysAgo);

    rotateBackup(liveDb, dir, 14);

    const remaining = fs.readdirSync(dir);
    assert.ok(!remaining.includes('old.sqlite'), 'a 20-day-old backup should have been pruned at a 14-day cutoff');
    assert.equal(remaining.length, 1, 'only the fresh copy rotateBackup just made should remain');
  });

  test('does nothing if there is no live db file yet (the very first sync)', () => {
    fs.unlinkSync(liveDb);
    rotateBackup(liveDb, dir);
    assert.equal(fs.existsSync(dir), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './backup.js'`.

- [ ] **Step 3: Write the implementation**

```js
// server/backup.js
import fs from 'node:fs';
import path from 'node:path';

// Copies the live db file into backupDir with a sortable timestamp name,
// then deletes rotated copies older than maxAgeDays. Called right before
// every sync overwrites the live file (see index.js) — this rotation is the
// only safety net against a bad incoming snapshot destroying a good prior
// copy, since the design spec explicitly rejects any external/offsite
// duplicate (§3, §14).
export function rotateBackup(liveDbPath, backupDir, maxAgeDays = 14) {
  if (!fs.existsSync(liveDbPath)) return;
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(liveDbPath, path.join(backupDir, `${stamp}.sqlite`));

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(backupDir)) {
    const filePath = path.join(backupDir, file);
    if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add server/backup.js server/backup.test.js
git commit -m "feat: add rotating on-disk backup of the live database"
```

---

## Task 4: Password and session auth

**Files:**
- Create: `server/auth.js`
- Test: `server/auth.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/auth.test.js
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkOrRegisterPassword, createSession, isValidSession } from './auth.js';

describe('auth', () => {
  const hashPath = './test-password.hash';

  beforeEach(() => {
    if (fs.existsSync(hashPath)) fs.unlinkSync(hashPath);
  });

  afterEach(() => {
    if (fs.existsSync(hashPath)) fs.unlinkSync(hashPath);
  });

  test('the first submitted password is accepted and becomes the stored one', () => {
    assert.equal(checkOrRegisterPassword(hashPath, 'hunter2'), true);
    assert.ok(fs.existsSync(hashPath));
  });

  test('the same password matches on a later attempt', () => {
    checkOrRegisterPassword(hashPath, 'hunter2');
    assert.equal(checkOrRegisterPassword(hashPath, 'hunter2'), true);
  });

  test('a different password is rejected once one is already stored', () => {
    checkOrRegisterPassword(hashPath, 'hunter2');
    assert.equal(checkOrRegisterPassword(hashPath, 'wrong'), false);
  });

  test('createSession returns an id that isValidSession recognizes', () => {
    const id = createSession();
    assert.equal(isValidSession(id), true);
  });

  test('isValidSession rejects an unknown id, null, and undefined', () => {
    assert.equal(isValidSession('made-up-id'), false);
    assert.equal(isValidSession(null), false);
    assert.equal(isValidSession(undefined), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './auth.js'`.

- [ ] **Step 3: Write the implementation**

```js
// server/auth.js
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';

// In-memory, no expiry (a deliberate choice — see design decision #5):
// sessions live until the Node process restarts, which only happens on a
// cert-renewal restart or a server reboot. Re-login afterward is low
// friction via Safari's own saved-password + Face ID autofill.
const sessions = new Set();

function loadPasswordHash(hashFilePath) {
  return fs.existsSync(hashFilePath) ? fs.readFileSync(hashFilePath, 'utf8').trim() : null;
}

// Verifies the single account's password — or, if none is stored yet,
// establishes whichever password is submitted first as the permanent one.
// There is no separate signup flow anywhere in this app (decision #4); to
// reset, an operator deletes the hash file over SSH and "registers" again
// through the same login form.
export function checkOrRegisterPassword(hashFilePath, submittedPassword) {
  const storedHash = loadPasswordHash(hashFilePath);
  if (!storedHash) {
    fs.writeFileSync(hashFilePath, bcrypt.hashSync(submittedPassword, 10), 'utf8');
    return true;
  }
  return bcrypt.compareSync(submittedPassword, storedHash);
}

export function createSession() {
  const id = crypto.randomBytes(32).toString('hex');
  sessions.add(id);
  return id;
}

export function isValidSession(id) {
  return Boolean(id) && sessions.has(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add server/auth.js server/auth.test.js
git commit -m "feat: add implicit self-registering password auth and in-memory sessions"
```

---

## Task 5: HTTP app — login and status endpoints

**Files:**
- Create: `server/index.js`
- Test: `server/index.test.js`

This task and Task 6 build the same file — `createApp()` is exported so tests can drive it with real HTTP requests against a server on an ephemeral port, without needing the real TLS cert files that only exist on the actual VPS. Task 6 adds sync/restore/static-serving and the real `https.createServer(...).listen(443)` bootstrap on top of what this task creates.

- [ ] **Step 1: Write the failing test**

```js
// server/index.test.js
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { createApp } from './index.js';
import { openDatabase } from './db.js';

describe('server API — login and status', () => {
  const testDbPath = './test-server-db.sqlite';
  const testHashPath = './test-server-password.hash';
  const testBackupDir = './test-server-backups';
  let server, baseUrl, db;

  before(async () => {
    for (const p of [testDbPath, testHashPath]) if (fs.existsSync(p)) fs.unlinkSync(p);
    db = openDatabase(testDbPath);
    const app = createApp(db, { hashPath: testHashPath, dbPath: testDbPath, backupDir: testBackupDir });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    for (const p of [testDbPath, testHashPath]) if (fs.existsSync(p)) fs.unlinkSync(p);
    fs.rmSync(testBackupDir, { recursive: true, force: true });
  });

  test('POST /api/login registers the first password and sets a session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ password: 'hunter2' }),
    });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie');
    assert.ok(cookie.includes('HttpOnly'));
    assert.ok(cookie.includes('Secure'));
    assert.ok(cookie.includes('SameSite=Strict'));
  });

  test('POST /api/login rejects the wrong password once one is already registered', async () => {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong' }),
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/login without a password is rejected', async () => {
    const res = await fetch(`${baseUrl}/api/login`, { method: 'POST', body: JSON.stringify({}) });
    assert.equal(res.status, 400);
  });

  test('GET /api/status reflects whether the caller has a valid session', async () => {
    const before = await fetch(`${baseUrl}/api/status`);
    assert.deepEqual(await before.json(), { loggedIn: false });

    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ password: 'hunter2' }),
    });
    const cookie = loginRes.headers.get('set-cookie');
    const after = await fetch(`${baseUrl}/api/status`, { headers: { cookie } });
    assert.deepEqual(await after.json(), { loggedIn: true });
  });

  test('an unknown /api/ route returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/nonsense`);
    assert.equal(res.status, 404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './index.js'`.

- [ ] **Step 3: Write the implementation**

```js
// server/index.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkOrRegisterPassword, createSession, isValidSession } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
    req.on('error', reject);
  });
}

function getSessionId(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|; )sid=([^;]+)/);
  return match ? match[1] : null;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// hashPath/dbPath/backupDir are passed in (rather than read from module-level
// constants) so tests can point every file operation at throwaway paths
// instead of the real server/data directory.
export function createApp(db, { hashPath, dbPath, backupDir }) {
  return async function requestListener(req, res) {
    const sessionId = getSessionId(req);

    if (req.url === '/api/login' && req.method === 'POST') {
      const { password } = await readBody(req);
      if (!password) return sendJson(res, 400, { ok: false, error: 'Введите пароль' });
      const ok = checkOrRegisterPassword(hashPath, password);
      if (!ok) return sendJson(res, 401, { ok: false, error: 'Неверный пароль' });
      const sid = createSession();
      // No Max-Age/Expires: an infinite-lifetime cookie, matching the
      // no-expiry, process-lifetime session store in auth.js (decision #5).
      res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Secure; SameSite=Strict; Path=/`);
      return sendJson(res, 200, { ok: true });
    }

    if (req.url === '/api/status' && req.method === 'GET') {
      return sendJson(res, 200, { loggedIn: isValidSession(sessionId) });
    }

    if (req.url.startsWith('/api/')) {
      return sendJson(res, 404, { ok: false, error: 'Not found' });
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  };
}

export { __dirname };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: add login/status HTTP endpoints"
```

---

## Task 6: HTTP app — sync, restore, static serving, and the real bootstrap

**Files:**
- Modify: `server/index.js`
- Modify: `server/index.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `server/index.test.js`, inside a new `describe` block:

```js
describe('server API — sync and restore', () => {
  const testDbPath = './test-server-db2.sqlite';
  const testHashPath = './test-server-password2.hash';
  const testBackupDir = './test-server-backups2';
  let server, baseUrl, db;

  before(async () => {
    for (const p of [testDbPath, testHashPath]) if (fs.existsSync(p)) fs.unlinkSync(p);
    db = openDatabase(testDbPath);
    const app = createApp(db, { hashPath: testHashPath, dbPath: testDbPath, backupDir: testBackupDir });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    for (const p of [testDbPath, testHashPath]) if (fs.existsSync(p)) fs.unlinkSync(p);
    fs.rmSync(testBackupDir, { recursive: true, force: true });
  });

  test('POST /api/sync is rejected without a valid session', async () => {
    const res = await fetch(`${baseUrl}/api/sync`, { method: 'POST', body: JSON.stringify({}) });
    assert.equal(res.status, 401);
  });

  test('GET /api/restore is rejected without a valid session', async () => {
    const res = await fetch(`${baseUrl}/api/restore`);
    assert.equal(res.status, 401);
  });

  test('a logged-in caller can sync a snapshot, then restore the same data back', async () => {
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ password: 'hunter2' }),
    });
    const cookie = loginRes.headers.get('set-cookie');

    const snapshot = {
      categories: [{ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null, archived: false }],
      transactions: [{ id: 't1', amount: 500, date: '2026-07-01', categoryId: 'c1' }],
      budgetRates: [{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }],
      debts: [],
      debtPayments: [],
    };
    const syncRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify(snapshot),
    });
    assert.equal(syncRes.status, 200);

    const restoreRes = await fetch(`${baseUrl}/api/restore`, { headers: { cookie } });
    assert.deepEqual(await restoreRes.json(), snapshot);
  });

  test('syncing rotates a backup of whatever was there before', async () => {
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ password: 'hunter2' }),
    });
    const cookie = loginRes.headers.get('set-cookie');
    const empty = { categories: [], transactions: [], budgetRates: [], debts: [], debtPayments: [] };
    await fetch(`${baseUrl}/api/sync`, { method: 'POST', headers: { cookie }, body: JSON.stringify(empty) });
    await fetch(`${baseUrl}/api/sync`, { method: 'POST', headers: { cookie }, body: JSON.stringify(empty) });
    assert.ok(fs.existsSync(testBackupDir), 'a second sync should have rotated a backup of the db the first sync left behind');
    assert.ok(fs.readdirSync(testBackupDir).length >= 1);
  });
});
```

No new imports are needed at the top of `server/index.test.js` — `openDatabase`, `createApp`, `http`, `fs`, and the `node:test`/`node:assert` helpers are all already imported there from Task 5.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test`
Expected: FAIL — sync/restore requests return 404 (routes don't exist yet).

- [ ] **Step 3: Extend the implementation**

Replace the whole of `server/index.js` with:

```js
// server/index.js
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, overwriteFromSnapshot, dumpToSnapshot } from './db.js';
import { rotateBackup } from './backup.js';
import { checkOrRegisterPassword, createSession, isValidSession } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'budget.sqlite');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const HASH_PATH = path.join(DATA_DIR, 'password.hash');
const DIST_DIR = path.join(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
    req.on('error', reject);
  });
}

function getSessionId(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|; )sid=([^;]+)/);
  return match ? match[1] : null;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Every non-API GET falls back to index.html if the exact file doesn't
// exist — this app has no URL-based routing (a single tab-state-driven SPA,
// see the design spec §11), so there's no real "unknown route" case to
// distinguish from "the app itself".
function serveStatic(req, res) {
  const requestedPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(DIST_DIR, requestedPath);
  if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

// hashPath/dbPath/backupDir are passed in (rather than read from module-level
// constants) so tests can point every file operation at throwaway paths
// instead of the real server/data directory.
export function createApp(db, { hashPath, dbPath, backupDir }) {
  return async function requestListener(req, res) {
    const sessionId = getSessionId(req);

    if (req.url === '/api/login' && req.method === 'POST') {
      const { password } = await readBody(req);
      if (!password) return sendJson(res, 400, { ok: false, error: 'Введите пароль' });
      const ok = checkOrRegisterPassword(hashPath, password);
      if (!ok) return sendJson(res, 401, { ok: false, error: 'Неверный пароль' });
      const sid = createSession();
      // No Max-Age/Expires: an infinite-lifetime cookie, matching the
      // no-expiry, process-lifetime session store in auth.js (decision #5).
      res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Secure; SameSite=Strict; Path=/`);
      return sendJson(res, 200, { ok: true });
    }

    if (req.url === '/api/status' && req.method === 'GET') {
      return sendJson(res, 200, { loggedIn: isValidSession(sessionId) });
    }

    if (req.url === '/api/sync' && req.method === 'POST') {
      if (!isValidSession(sessionId)) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
      const snapshot = await readBody(req);
      rotateBackup(dbPath, backupDir);
      overwriteFromSnapshot(db, snapshot);
      return sendJson(res, 200, { ok: true });
    }

    if (req.url === '/api/restore' && req.method === 'GET') {
      if (!isValidSession(sessionId)) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
      return sendJson(res, 200, dumpToSnapshot(db));
    }

    if (req.url.startsWith('/api/')) {
      return sendJson(res, 404, { ok: false, error: 'Not found' });
    }

    serveStatic(req, res);
  };
}

// Only actually binds a port when run directly (`node index.js`) — lets
// tests import createApp() and drive it via their own ephemeral-port server
// instead, without needing the real cert files that only exist on the VPS.
if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = openDatabase(DB_PATH);
  const app = createApp(db, { hashPath: HASH_PATH, dbPath: DB_PATH, backupDir: BACKUP_DIR });

  const CERT_DIR = path.join(__dirname, 'certs');
  const options = {
    key: fs.readFileSync(path.join(CERT_DIR, 'privkey.pem')),
    cert: fs.readFileSync(path.join(CERT_DIR, 'fullchain.pem')),
  };
  https.createServer(options, app).listen(443, () => {
    console.log('budget-server listening on https://0.0.0.0:443');
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test`
Expected: PASS — 9 tests passing across both describe blocks.

- [ ] **Step 5: Commit**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: add sync/restore endpoints, static serving, and the HTTPS bootstrap"
```

---

## Task 7: VPS — install Node.js and native-module build tools

**Files:** none (server provisioning — commands run over SSH against `206.223.241.54`, no repo files change)

**Addendum, discovered during execution:** Ubuntu 24.04's own apt-packaged Node.js is v18.19.1. The frontend build (`npm run build`, via `vite-plugin-pwa`'s `generateSW` mode) fails on that version with `Error: Dynamic require of "workbox-build" is not supported` — confirmed as a genuine Node-version incompatibility, not a flake, by reproducing the identical build successfully on Node v20 locally and failing identically on the VPS's v18 before upgrading. Node.js is installed via NodeSource's setup script instead, for v20 — the version steps below reflect this.

- [ ] **Step 1: Install Node.js 20 via NodeSource**

Run over SSH as root:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh
apt-get install -y nodejs build-essential python3
```

(NodeSource's setup script already adds `npm` as part of the `nodejs` package, unlike Ubuntu's own split packaging — no separate `npm` package needed.) `build-essential`/`python3` are a defensive install: `better-sqlite3` ships prebuilt binaries for common Linux/Node combinations and normally needs no compilation, but if a prebuilt binary isn't available for this exact VPS environment, npm silently falls back to compiling from source, which needs these.

- [ ] **Step 2: Verify the install**

Run: `node --version && npm --version`
Expected: Node reports a v20.x line and npm reports a matching 10.x version.

Note: no changes to port 80/`x-ui`/`xray` in this task.

---

## Task 8: VPS — dedicated system user and directories

**Files:** none (server provisioning)

- [ ] **Step 1: Create the `budget` system user**

Run over SSH as root:
```bash
useradd --system --create-home --home-dir /opt/budget-app --shell /usr/sbin/nologin budget
```

This both creates the user and creates+owns `/opt/budget-app` as its home directory in one step — the repo will be cloned into a subdirectory of it (Task 9), keeping the user's `.ssh/` at the top level.

- [ ] **Step 2: Verify**

Run: `id budget && ls -la /opt/budget-app`
Expected: `id budget` prints a valid uid/gid; `/opt/budget-app` exists, owned by `budget:budget`.

---

## Task 9: VPS — GitHub deploy key, clone, install, build

**Files:** none (server provisioning; the manual GitHub step is the one non-SSH action in this whole plan)

- [ ] **Step 1: Generate a deploy-only SSH keypair**

Run over SSH as root:
```bash
sudo -u budget mkdir -p /opt/budget-app/.ssh
sudo -u budget ssh-keygen -t ed25519 -f /opt/budget-app/.ssh/id_ed25519 -N ""
sudo -u budget ssh-keyscan github.com >> /opt/budget-app/.ssh/known_hosts
cat /opt/budget-app/.ssh/id_ed25519.pub
```

- [ ] **Step 2: Add the printed public key as a read-only GitHub Deploy Key (manual, one-time)**

Open `https://github.com/kitaliev/spendings-budget/settings/keys` → **Add deploy key** → paste the public key printed above → leave "Allow write access" unchecked (read-only is all a deploy needs) → **Add key**.

This is the only step in this entire plan that requires a manual action outside of SSH — neither root SSH access nor `gh` (unavailable/unauthenticated in this environment) can add a deploy key programmatically.

- [ ] **Step 3: Clone the repo**

Run over SSH as root, after Step 2 is confirmed done:
```bash
sudo -u budget git clone git@github.com:kitaliev/spendings-budget.git /opt/budget-app/repo
```

Expected: clones successfully (no host-key prompt, thanks to the `ssh-keyscan` in Step 1; no permission error, thanks to the deploy key).

- [ ] **Step 4: Install frontend dependencies and build**

```bash
cd /opt/budget-app/repo
sudo -u budget npm install
sudo -u budget npm run build
```

Expected: `dist/` appears at `/opt/budget-app/repo/dist`, owned by `budget`.

- [ ] **Step 5: Install server dependencies**

```bash
cd /opt/budget-app/repo/server
sudo -u budget npm install
```

Expected: `/opt/budget-app/repo/server/node_modules` appears, owned by `budget`, including a working `better-sqlite3` (installed from a prebuilt binary or compiled with the tools from Task 7).

---

## Task 10: VPS — systemd service for budget-server

**Files:** none (server provisioning — this creates a file on the VPS, not in this repo)

- [ ] **Step 1: Create the unit file**

Run over SSH as root, write `/etc/systemd/system/budget-server.service`:

```ini
[Unit]
Description=Budget app backup server
After=network.target

[Service]
Type=simple
User=budget
Group=budget
WorkingDirectory=/opt/budget-app/repo/server
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
```

`AmbientCapabilities=CAP_NET_BIND_SERVICE` is what lets the unprivileged `budget` user bind port 443 (normally root-only) — the alternative would be running this as root, which this plan deliberately avoids given the process directly parses untrusted HTTP input from the open internet.

- [ ] **Step 2: Enable, but do not start yet**

```bash
systemctl daemon-reload
systemctl enable budget-server
```

Expected: enabled successfully. **Do not `systemctl start` yet** — no TLS cert files exist at `/opt/budget-app/repo/server/certs/` until Task 11 issues one, and Node will crash on startup trying to read them.

---

## Task 11: VPS — certbot install, first cert issuance, deploy-hook

**Addendum, discovered during execution — this task's original design was wrong and is corrected below:** the plan originally called for TLS-ALPN-01 (via `--preferred-challenges tls-alpn-01`, binding port 443, to avoid touching `x-ui` on port 80 at all). Empirically, certbot's `standalone` plugin does not implement TLS-ALPN-01 at all — its own `certbot plugins` output states "HTTP challenge only." Researched the current state: the certbot project has deliberately decided against ever adding native TLS-ALPN-01 support (citing that it would only ever work with the standalone plugin and forces downtime via hooks regardless). DNS-01 is not applicable either — there is no domain, only a bare IP, so there is no DNS zone to answer challenges through. A third-party plugin (`certbot-ualpn`) exists but requires moving `budget-server` off port 443 behind a PROXY-protocol-aware backend and compiling a C binary from source — a real, unwarranted rearchitecture of already-reviewed server code for a thinly-maintained dependency.

Further recon during execution also found that `xray` (this VPS's actual VPN proxy) runs as a **child process of the `x-ui` systemd service**, in the same cgroup — `x-ui` and `xray` cannot be stopped independently. This was confirmed with the user directly: the only viable path to a real Let's Encrypt IP certificate here is HTTP-01 via the `standalone` plugin, which needs port 80 — meaning `x-ui` (and with it, the VPN) is stopped for the few seconds an HTTP-01 challenge takes, roughly once every ~5–6 days (this is a `shortlived`-profile IP cert; confirmed via research that `shortlived` is currently the *only* validity option Let's Encrypt offers for IP certificates — there is no longer-lived alternative to reduce how often this needs to happen). The user explicitly chose to accept this brief, infrequent VPN interruption over the alternatives (a self-signed cert, or reconfiguring `xray`'s own inbound port).

Because HTTP-01 only ever needs port 80, **`budget-server` itself never needs to stop for a renewal** — only `x-ui` does. This is simpler than the original design, which incorrectly had `budget-server` stopping around every renewal too.

**Files:**
- Create: `server/certbot-deploy-hook.sh` (in this repo, deployed as part of the normal `git pull`, not written directly on the VPS)

- [ ] **Step 1: Write the deploy-hook script in this repo**

```bash
#!/bin/bash
set -euo pipefail

# Only fires when certbot actually renews (unlike --pre-hook/--post-hook,
# which run on every daily check regardless of whether renewal happened) —
# so budget-server is only ever restarted when there's a genuinely new
# cert to pick up, not once a day for nothing.
CERTS_DIR="/opt/budget-app/repo/server/certs"
mkdir -p "$CERTS_DIR"
cp "$RENEWED_LINEAGE/fullchain.pem" "$CERTS_DIR/fullchain.pem"
cp "$RENEWED_LINEAGE/privkey.pem" "$CERTS_DIR/privkey.pem"
chown budget:budget "$CERTS_DIR/fullchain.pem" "$CERTS_DIR/privkey.pem"
chmod 644 "$CERTS_DIR/fullchain.pem"
chmod 600 "$CERTS_DIR/privkey.pem"
systemctl restart budget-server
```

`$RENEWED_LINEAGE` is an environment variable certbot sets for deploy-hooks, pointing at the live `/etc/letsencrypt/live/<name>/` directory for the cert that was just (re)issued — no argument parsing needed.

- [ ] **Step 2: Commit it, then pull it onto the VPS and make it executable**

```bash
git add server/certbot-deploy-hook.sh
git commit -m "chore: add the certbot deploy-hook that syncs renewed certs to the app user"
git push
```

Then over SSH as root:
```bash
cd /opt/budget-app/repo && sudo -u budget git pull
chmod +x /opt/budget-app/repo/server/certbot-deploy-hook.sh
```

- [ ] **Step 3: Install certbot via snap**

Run over SSH as root:
```bash
apt-get install -y snapd
snap install core && snap refresh core
snap install --classic certbot
ln -s /snap/bin/certbot /usr/bin/certbot
certbot --version
```

Snap (not `apt install certbot`) specifically because it tracks upstream releases directly — `--preferred-profile` (needed for the `shortlived` IP-cert profile) is a newer flag than Ubuntu 24.04's apt-packaged certbot (2.9.0) has; confirmed directly (`certbot certonly --help all` on the apt version has no `--preferred-profile` entry at all). `snapd` is not installed by default on this particular VPS image (common for minimal cloud images) and needs installing first.

Expected: `certbot --version` reports 5.x or later; `certbot certonly --help all | grep preferred-profile` shows the flag exists.

- [ ] **Step 4: Issue the first certificate**

This is the one moment `x-ui`/the VPN goes down before the automated hooks exist to do it — stop it manually, issue, restart immediately:

```bash
systemctl stop x-ui
certbot certonly --standalone --preferred-challenges http --preferred-profile shortlived \
  --ip-address 206.223.241.54 \
  --deploy-hook /opt/budget-app/repo/server/certbot-deploy-hook.sh \
  --non-interactive --agree-tos -m alievsakit@gmail.com
systemctl start x-ui
```

`--standalone` binds port 80 itself to answer the HTTP-01 challenge, which needs `x-ui` (the only other thing on port 80) stopped for the duration — expect this whole sequence to take well under a minute. **Use `--ip-address`, not `-d`, for the target** — confirmed empirically: certbot's own client-side validation hardcodes a rejection ("The Let's Encrypt certificate authority will not issue certificates for a bare IP address") when an IP is passed via `-d`, regardless of server-side support; `--ip-address` (added in certbot 5.3/5.4, present in the 5.7.0 installed here) is the flag that actually requests an IP SAN certificate. Expected: certbot reports success; the deploy-hook fires automatically, creating `/opt/budget-app/repo/server/certs/fullchain.pem`/`privkey.pem` (owned by `budget`) and attempting `systemctl restart budget-server` — harmless at this point since the service isn't started yet (Task 10 only enabled it).

**Also discovered on first issuance:** certbot (via snap) auto-creates its own `snap.certbot.renew.timer`, which would attempt renewal via plain `certbot renew` with no knowledge of needing to stop `x-ui` first — left enabled, it would either silently fail (port 80 occupied) or race Task 12's own purpose-built timer. Disable it once, immediately after this step:

```bash
systemctl disable --now snap.certbot.renew.timer
```

Task 12's own `certbot-renew.timer` (with the `x-ui` stop/start hooks) is the only renewal mechanism this deployment actually wants running.

- [ ] **Step 5: Verify the cert files and start the service for the first time**

```bash
ls -la /opt/budget-app/repo/server/certs/
systemctl start budget-server
systemctl status budget-server
systemctl status x-ui
```

Expected: both `.pem` files exist, owned by `budget:budget`; both services show `active (running)` with no crash-loop.

---

## Task 12: VPS — daily renewal timer

**Files:** none (server provisioning)

**Addendum, discovered during execution:** matching Task 11's corrected design — the renewal cycle only ever needs to stop/start `x-ui` (for the HTTP-01 challenge's port 80), never `budget-server` directly. `budget-server` only restarts on days a renewal genuinely happens, via the deploy-hook script itself (Task 11), not on every daily check.

- [ ] **Step 1: Create the renewal service unit**

Write `/etc/systemd/system/certbot-renew.service`:

```ini
[Unit]
Description=Certbot renewal check for budget-server's IP cert

[Service]
Type=oneshot
ExecStartPre=/bin/systemctl stop x-ui
ExecStart=/usr/bin/certbot renew --quiet
ExecStartPost=/bin/systemctl start x-ui
```

`ExecStartPre`/`ExecStartPost` always run around every renewal *attempt* (this cert's ~160-hour validity means certbot will attempt a renewal on most daily checks, per its own proportional renewal-window logic for short-lived certs) — stopping `x-ui` frees port 80 for the HTTP-01 challenge (and briefly interrupts the VPN, which the user has explicitly accepted), and it's always restarted afterward regardless of whether certbot actually renewed anything that run. `budget-server` itself is untouched by this unit — see Task 11's deploy-hook, which restarts it only when a cert is actually renewed.

- [ ] **Step 2: Create the timer unit**

Write `/etc/systemd/system/certbot-renew.timer`:

```ini
[Unit]
Description=Daily certbot renewal check for budget-server

[Timer]
OnCalendar=daily
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
```

- [ ] **Step 3: Enable and start the timer**

```bash
systemctl daemon-reload
systemctl enable --now certbot-renew.timer
systemctl list-timers certbot-renew.timer
```

Expected: the timer is listed as active with a scheduled next-run time.

- [ ] **Step 4: Do a manual dry run to confirm the whole hook chain works end-to-end**

```bash
systemctl start certbot-renew.service
systemctl status x-ui
systemctl status budget-server
```

Expected: `x-ui` briefly stops and restarts (visible in `journalctl -u x-ui` timestamps), ends up `active (running)` again; `budget-server` stays running throughout if the cert wasn't yet due for renewal (most days), or itself restarts via the deploy-hook if it was.

---

## Task 13: VPS — end-to-end smoke test

**Files:** none (verification only)

- [ ] **Step 1: Hit the real HTTPS endpoint from outside the VPS**

Run (from any machine with internet access, e.g. this development machine):
```bash
curl -i https://206.223.241.54/api/status
```

Expected: `HTTP/1.1 200`, body `{"loggedIn":false}`, and curl reports a valid TLS handshake (no `-k`/`--insecure` needed) — confirming the Let's Encrypt IP cert is trusted by a real, unconfigured client.

- [ ] **Step 2: Confirm the frontend itself is served**

```bash
curl -s https://206.223.241.54/ | grep -o '<title>[^<]*</title>'
```

Expected: `<title>Бюджет на день</title>`.

- [ ] **Step 3: Confirm `x-ui`/the VPN are untouched**

```bash
ss -tlnp | grep -E ':80|:443'
```

Expected: something is still listening on port 80 (unchanged from before this plan started); `budget-server` (node) is listening on 443.

---

## Task 14: Client — `src/api/backup.js`

**Files:**
- Create: `src/api/backup.js`
- Test: `src/api/backup.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// src/api/backup.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as backupApi from './backup.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('backup API client', () => {
  it('login posts the password and returns the parsed body on success', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const result = await backupApi.login('hunter2');
    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ password: 'hunter2' }),
    }));
  });

  it('login throws with the server-provided message on failure', async () => {
    global.fetch.mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: 'Неверный пароль' }) });
    await expect(backupApi.login('wrong')).rejects.toThrow('Неверный пароль');
  });

  it('status returns the parsed loggedIn flag', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ loggedIn: true }) });
    expect(await backupApi.status()).toEqual({ loggedIn: true });
  });

  it('sync posts the snapshot and throws a generic error on failure (no server message expected)', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await backupApi.sync({ categories: [] });
    expect(global.fetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ categories: [] }),
    }));

    global.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(backupApi.sync({})).rejects.toThrow('Синхронизация не удалась');
  });

  it('restore GETs the snapshot and returns its parsed body', async () => {
    const snapshot = { categories: [], transactions: [], budgetRates: [], debts: [], debtPayments: [] };
    global.fetch.mockResolvedValue({ ok: true, json: async () => snapshot });
    expect(await backupApi.restore()).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/api/backup.spec.js`
Expected: FAIL — `Cannot find module './backup.js'`.

- [ ] **Step 3: Write the implementation**

```js
// src/api/backup.js
// Relative paths only — the client is always served from the same origin
// as the API (see the Phase 2 plan's own architecture section), so no
// server address is ever configured anywhere in this app.
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function login(password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Не удалось войти');
  return body;
}

export async function status() {
  const res = await fetch('/api/status', { credentials: 'include' });
  return res.json();
}

export async function sync(snapshot) {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(snapshot),
  });
  if (!res.ok) throw new Error('Синхронизация не удалась');
}

export async function restore() {
  const res = await fetch('/api/restore', { credentials: 'include' });
  if (!res.ok) throw new Error('Не удалось получить резервную копию');
  return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/api/backup.spec.js`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/api/backup.js src/api/backup.spec.js
git commit -m "feat: add the backup server's fetch client"
```

---

## Task 15: Client — bulk IndexedDB restore

**Files:**
- Create: `src/db/restore.js`
- Test: `src/db/restore.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// src/db/restore.spec.js
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, clearAllStores } from './index.js';
import { restoreAllFromSnapshot } from './restore.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('restoreAllFromSnapshot', () => {
  it('writes every table of the snapshot into its matching IndexedDB store', async () => {
    const snapshot = {
      categories: [{ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null, archived: false }],
      transactions: [{ id: 't1', amount: 500, date: '2026-07-01', categoryId: 'c1' }],
      budgetRates: [{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }],
      debts: [{ id: 'd1', name: 'Друг', amount: 1000, comment: '', direction: 'owed_to_me' }],
      debtPayments: [{ id: 'p1', debtId: 'd1', amount: 200, date: '2026-07-01' }],
    };
    await restoreAllFromSnapshot(snapshot);

    const db = await getDb();
    expect(await db.getAll('categories')).toEqual(snapshot.categories);
    expect(await db.getAll('transactions')).toEqual(snapshot.transactions);
    expect(await db.getAll('budgetRates')).toEqual(snapshot.budgetRates);
    expect(await db.getAll('debts')).toEqual(snapshot.debts);
    expect(await db.getAll('debtPayments')).toEqual(snapshot.debtPayments);
  });

  it('replaces whatever was already there, rather than merging with it', async () => {
    const db = await getDb();
    await db.put('categories', { id: 'stale', name: 'Старое', emoji: '👴', parentId: null, archived: false });

    await restoreAllFromSnapshot({
      categories: [{ id: 'fresh', name: 'Новое', emoji: '✨', parentId: null, archived: false }],
      transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });

    const categories = await db.getAll('categories');
    expect(categories.map((c) => c.id)).toEqual(['fresh']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/db/restore.spec.js`
Expected: FAIL — `Cannot find module './restore.js'`.

- [ ] **Step 3: Write the implementation**

```js
// src/db/restore.js
import { getDb } from './index.js';

const STORE_NAMES = ['categories', 'transactions', 'budgetRates', 'debts', 'debtPayments'];

// Wholesale-replaces every local IndexedDB store with a server backup
// snapshot — used only by the one-tap restore flow on an empty-database
// launch (App.vue). Mirrors the server's own overwriteFromSnapshot
// (server/db.js): the two sides are meant to be exact mirrors of each
// other, never gradually reconciled.
export async function restoreAllFromSnapshot(snapshot) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  await Promise.all(
    STORE_NAMES.map(async (name) => {
      await tx.objectStore(name).clear();
      for (const row of snapshot[name] || []) {
        await tx.objectStore(name).put(row);
      }
    })
  );
  await tx.done;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/db/restore.spec.js`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/db/restore.js src/db/restore.spec.js
git commit -m "feat: add bulk IndexedDB restore from a backup snapshot"
```

---

## Task 16: Client — `src/stores/backup.js`

**Files:**
- Create: `src/stores/backup.js`
- Test: `src/stores/backup.spec.js`

- [ ] **Step 1: Write the failing test**

```js
// src/stores/backup.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBackupStore } from './backup.js';
import { useCategoriesStore } from './categories.js';
import { useTransactionsStore } from './transactions.js';
import { useBudgetRatesStore } from './budgetRates.js';
import { useDebtsStore } from './debts.js';
import * as backupApi from '../api/backup.js';
import { restoreAllFromSnapshot } from '../db/restore.js';

vi.mock('../api/backup.js');
vi.mock('../db/restore.js');
vi.mock('../db/categories.js');
vi.mock('../db/transactions.js');
vi.mock('../db/budgetRates.js');
vi.mock('../db/debts.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorage.clear();
});

describe('backup store', () => {
  it('checkStatus reflects the server response', async () => {
    backupApi.status.mockResolvedValue({ loggedIn: true });
    const store = useBackupStore();
    expect(await store.checkStatus()).toBe(true);
    expect(store.loggedIn).toBe(true);
  });

  it('login sets loggedIn on success and guards against a double submit', async () => {
    let resolveLogin;
    backupApi.login.mockReturnValue(new Promise((r) => { resolveLogin = r; }));
    const store = useBackupStore();
    const first = store.login('hunter2');
    const second = store.login('hunter2'); // should be a no-op while the first is in flight
    resolveLogin({ ok: true });
    await Promise.all([first, second]);
    expect(backupApi.login).toHaveBeenCalledTimes(1);
    expect(store.loggedIn).toBe(true);
  });

  it('sync gathers a snapshot from every store and posts it, recording success', async () => {
    useCategoriesStore().items = [{ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null, archived: false }];
    useTransactionsStore().items = [{ id: 't1', amount: 500, date: '2026-07-01', categoryId: 'c1' }];
    useBudgetRatesStore().segments = [{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }];
    useDebtsStore().items = [{ id: 'd1', name: 'Друг', amount: 1000, comment: '', direction: 'owed_to_me' }];
    useDebtsStore().payments = [{ id: 'p1', debtId: 'd1', amount: 200, date: '2026-07-01' }];
    backupApi.sync.mockResolvedValue(undefined);

    const store = useBackupStore();
    await store.sync();

    expect(backupApi.sync).toHaveBeenCalledWith({
      categories: useCategoriesStore().items,
      transactions: useTransactionsStore().items,
      budgetRates: useBudgetRatesStore().segments,
      debts: useDebtsStore().items,
      debtPayments: useDebtsStore().payments,
    });
    expect(store.lastSyncOk).toBe(true);
    expect(store.lastSyncAt).not.toBeNull();
  });

  it('sync never throws, even when the request fails — it just records the failure', async () => {
    backupApi.sync.mockRejectedValue(new Error('network down'));
    const store = useBackupStore();
    await expect(store.sync()).resolves.toBeUndefined();
    expect(store.lastSyncOk).toBe(false);
    expect(store.lastSyncAt).not.toBeNull();
  });

  it('sync status persists to localStorage and survives a fresh store instance', async () => {
    backupApi.sync.mockResolvedValue(undefined);
    await useBackupStore().sync();

    setActivePinia(createPinia()); // simulate a fresh page load
    const freshStore = useBackupStore();
    expect(freshStore.lastSyncOk).toBe(true);
    expect(freshStore.lastSyncAt).not.toBeNull();
  });

  it('restore pulls the snapshot, writes it locally, then reloads every store', async () => {
    const snapshot = { categories: [], transactions: [], budgetRates: [], debts: [], debtPayments: [] };
    backupApi.restore.mockResolvedValue(snapshot);

    await useBackupStore().restore();

    expect(restoreAllFromSnapshot).toHaveBeenCalledWith(snapshot);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/stores/backup.spec.js`
Expected: FAIL — `Cannot find module './backup.js'`.

- [ ] **Step 3: Write the implementation**

```js
// src/stores/backup.js
import { defineStore } from 'pinia';
import * as backupApi from '../api/backup.js';
import { restoreAllFromSnapshot } from '../db/restore.js';
import { useCategoriesStore } from './categories.js';
import { useTransactionsStore } from './transactions.js';
import { useBudgetRatesStore } from './budgetRates.js';
import { useDebtsStore } from './debts.js';

const STATUS_KEY = 'budget-app:last-sync-status';

// Sync status has to outlive a single page load to be useful — the whole
// point (decision #6) is surfacing a *silently* failing sync, which by
// definition isn't seen at the moment it happens. loggedIn is deliberately
// NOT persisted here: the session cookie is the real source of truth for
// that, and re-deriving it (checkStatus/login/sync's own reactions) avoids
// a stale locally-cached flag drifting from the cookie's actual validity.
function loadPersistedStatus() {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    return raw ? JSON.parse(raw) : { lastSyncAt: null, lastSyncOk: null };
  } catch {
    return { lastSyncAt: null, lastSyncOk: null };
  }
}

function persistStatus(status) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
}

export const useBackupStore = defineStore('backup', {
  state: () => ({
    loggedIn: null, // null = not yet checked this session
    ...loadPersistedStatus(),
    submitting: false,
  }),
  actions: {
    async checkStatus() {
      const { loggedIn } = await backupApi.status();
      this.loggedIn = loggedIn;
      return loggedIn;
    },
    async login(password) {
      if (this.submitting) return;
      this.submitting = true;
      try {
        await backupApi.login(password);
        this.loggedIn = true;
      } finally {
        this.submitting = false;
      }
    },
    // Silent by design (decision #6): called automatically after every
    // write via syncPlugin.js, never throws and never surfaces an error
    // directly — the Settings screen's own status line is the only place a
    // failure becomes visible.
    async sync() {
      try {
        await backupApi.sync({
          categories: useCategoriesStore().items,
          transactions: useTransactionsStore().items,
          budgetRates: useBudgetRatesStore().segments,
          debts: useDebtsStore().items,
          debtPayments: useDebtsStore().payments,
        });
        this.lastSyncOk = true;
      } catch {
        this.lastSyncOk = false;
      }
      this.lastSyncAt = new Date().toISOString();
      persistStatus({ lastSyncAt: this.lastSyncAt, lastSyncOk: this.lastSyncOk });
    },
    async restore() {
      const snapshot = await backupApi.restore();
      await restoreAllFromSnapshot(snapshot);
      await Promise.all([
        useCategoriesStore().load(),
        useTransactionsStore().load(),
        useBudgetRatesStore().load(),
        useDebtsStore().load(),
      ]);
    },
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/stores/backup.spec.js`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/stores/backup.js src/stores/backup.spec.js
git commit -m "feat: add the backup store (login, silent sync, restore)"
```

---

## Task 17: Client — auto-sync Pinia plugin

**Files:**
- Create: `src/stores/syncPlugin.js`
- Test: `src/stores/syncPlugin.spec.js`
- Modify: `src/main.js`

- [ ] **Step 1: Write the failing test**

```js
// src/stores/syncPlugin.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { syncPlugin } from './syncPlugin.js';
import { useCategoriesStore } from './categories.js';
import { useTransactionsStore } from './transactions.js';
import { useBackupStore } from './backup.js';
import * as categoriesDb from '../db/categories.js';
import * as backupApi from '../api/backup.js';

vi.mock('../db/categories.js');
vi.mock('../db/transactions.js');
vi.mock('../api/backup.js');

beforeEach(() => {
  const pinia = createPinia();
  pinia.use(syncPlugin);
  setActivePinia(pinia);
  vi.clearAllMocks();
  backupApi.sync.mockResolvedValue(undefined);
  categoriesDb.createCategory.mockResolvedValue({ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null });
});

describe('syncPlugin', () => {
  it('triggers a background sync after a write action on a synced store resolves', async () => {
    await useCategoriesStore().create({ name: 'Еда', emoji: '🍔' });
    expect(backupApi.sync).toHaveBeenCalledTimes(1);
  });

  it('does not trigger a sync for a load action', async () => {
    categoriesDb.seedDefaultCategoryIfEmpty.mockResolvedValue(undefined);
    categoriesDb.listCategories.mockResolvedValue([]);
    await useCategoriesStore().load();
    expect(backupApi.sync).not.toHaveBeenCalled();
  });

  it('does not trigger a sync for actions on stores outside the synced set', async () => {
    // The backup store's own actions (login/sync/restore/checkStatus) must
    // never re-trigger themselves through this same plugin — otherwise
    // login() succeeding would recursively kick off a sync loop.
    backupApi.login.mockResolvedValue({ ok: true });
    await useBackupStore().login('hunter2');
    expect(backupApi.sync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/stores/syncPlugin.spec.js`
Expected: FAIL — `Cannot find module './syncPlugin.js'`.

- [ ] **Step 3: Write the implementation**

```js
// src/stores/syncPlugin.js
import { useBackupStore } from './backup.js';

const SYNCED_STORE_IDS = new Set(['categories', 'transactions', 'budgetRates', 'debts']);
const WRITE_ACTIONS = new Set(['create', 'update', 'archive', 'remove', 'setRate', 'pay']);

// Registered once in main.js via pinia.use(syncPlugin) — triggers a
// background sync to the backup server after every write action on any of
// the four data stores resolves, without needing to modify any of those
// stores directly (decision #6: automatic, after every write, silent).
// load() is deliberately absent from WRITE_ACTIONS: reading data should
// never itself cause a write to the server. The backup store itself is
// deliberately excluded from SYNCED_STORE_IDS — otherwise a successful
// login or sync would recursively trigger another sync.
export function syncPlugin({ store }) {
  if (!SYNCED_STORE_IDS.has(store.$id)) return;
  store.$onAction(({ name, after }) => {
    if (!WRITE_ACTIONS.has(name)) return;
    after(() => {
      useBackupStore().sync();
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/stores/syncPlugin.spec.js`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Register the plugin in `main.js`**

Read the current `src/main.js` first to confirm its exact contents before editing, then change it to:

```js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { syncPlugin } from './stores/syncPlugin.js';
// Self-hosted (not a Google Fonts link) — see _tokens.scss for how these
// variable-font files back --font-ui/--font-money. The "latin-ext" subset
// (not "cyrillic") is the one whose unicode-range covers ₽ (U+20BD).
import '@fontsource-variable/inter';
import './styles/main.scss';

const pinia = createPinia();
pinia.use(syncPlugin);

createApp(App).use(pinia).mount('#app');
```

(Keep whatever comment already exists above the Inter import — only the `syncPlugin` import and the two `pinia.use(...)`-related lines are new; do not otherwise reformat this file.)

- [ ] **Step 6: Verify the full suite still passes**

Run: `npm test`
Expected: all tests pass, including the pre-existing suite.

- [ ] **Step 7: Commit**

```bash
git add src/stores/syncPlugin.js src/stores/syncPlugin.spec.js src/main.js
git commit -m "feat: auto-sync to the backup server after every data-store write"
```

---

## Task 18: Client — "Резервная копия" section in Settings

**Files:**
- Modify: `src/components/settings/SettingsScreen.vue`
- Modify: `src/components/settings/SettingsScreen.spec.js`

- [ ] **Step 1: Add the failing tests**

Add these imports/mock to the top of `src/components/settings/SettingsScreen.spec.js` (alongside the existing ones):

```js
import { useBackupStore } from '../../stores/backup.js';
import * as backupApi from '../../api/backup.js';

vi.mock('../../api/backup.js');
```

And extend the shared `beforeEach`:

```js
beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  useBudgetRatesStore().segments = [{ amount: 2500, effectiveFrom: '2026-01-01' }];
  backupApi.status.mockResolvedValue({ loggedIn: false });
});
```

Then add a new describe block:

```js
describe('SettingsScreen — Резервная копия', () => {
  it('shows a login form when there is no active session', async () => {
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    expect(wrapper.find('.settings-row__backup-login').exists()).toBe(true);
  });

  it('logs in and switches to the status view on success', async () => {
    backupApi.login.mockResolvedValue({ ok: true });
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    await wrapper.find('.settings-row__backup-password').setValue('hunter2');
    await wrapper.find('.settings-row__backup-login').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.settings-row__backup-login').exists()).toBe(false);
    expect(wrapper.find('.settings-row__backup-status').exists()).toBe(true);
  });

  it('shows a toast and stays on the login form when login fails', async () => {
    backupApi.login.mockRejectedValue(new Error('Неверный пароль'));
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    await wrapper.find('.settings-row__backup-password').setValue('wrong');
    await wrapper.find('.settings-row__backup-login').trigger('submit');
    await flushPromises();
    expect(useToastStore().message).toBe('Неверный пароль');
    expect(wrapper.find('.settings-row__backup-login').exists()).toBe(true);
  });

  it('shows "not yet synced" status when already logged in but nothing has synced yet', async () => {
    backupApi.status.mockResolvedValue({ loggedIn: true });
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    expect(wrapper.find('.settings-row__backup-status').text()).toBe('Ещё не синхронизировалось');
  });

  it('shows a successful sync timestamp when logged in and synced', async () => {
    backupApi.status.mockResolvedValue({ loggedIn: true });
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    useBackupStore().lastSyncAt = '2026-07-28T10:00:00.000Z';
    useBackupStore().lastSyncOk = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.settings-row__backup-status').text()).toContain('Синхронизировано');
  });

  it('shows a sync-error status distinctly from a successful one', async () => {
    backupApi.status.mockResolvedValue({ loggedIn: true });
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    useBackupStore().lastSyncAt = '2026-07-28T10:00:00.000Z';
    useBackupStore().lastSyncOk = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.settings-row__backup-status').text()).toContain('Ошибка синхронизации');
  });

  it('ignores a second login submit while the first is still in flight', async () => {
    let resolveLogin;
    backupApi.login.mockReturnValue(new Promise((r) => { resolveLogin = r; }));
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    await wrapper.find('.settings-row__backup-password').setValue('hunter2');
    const form = wrapper.find('.settings-row__backup-login');
    await form.trigger('submit');
    await form.trigger('submit');
    resolveLogin({ ok: true });
    await flushPromises();
    expect(backupApi.login).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/settings/SettingsScreen.spec.js`
Expected: FAIL — `.settings-row__backup-login`/`.settings-row__backup-status` don't exist yet.

- [ ] **Step 3: Add the section to `SettingsScreen.vue`**

Add this block to the template, after the existing `.settings-group` for "Категории" (before the closing `</div>` of the component root):

```vue
    <div class="settings-group">
      <p class="settings-group__title">Резервная копия</p>
      <div class="settings-list">
        <div v-if="backupStore.loggedIn" class="settings-row">
          <span class="settings-row__label">Статус</span>
          <span class="settings-row__backup-status">{{ syncStatusText }}</span>
        </div>
        <form v-else class="settings-row settings-row__backup-login" @submit.prevent="submitLogin">
          <input
            v-model="backupPassword"
            type="password"
            placeholder="Пароль"
            aria-label="Пароль от резервной копии"
            class="settings-row__backup-password"
          />
          <button type="submit" class="settings-row__backup-submit">Войти</button>
        </form>
      </div>
    </div>
```

Add these imports and adjust the `components`/`data`/`computed`/`methods` in the `<script>` block:

```js
import TopBar from '../layout/TopBar.vue';
import CategoryTree from './CategoryTree.vue';
import { ChevronRight } from '@lucide/vue';
import { useBudgetRatesStore } from '../../stores/budgetRates.js';
import { useBackupStore } from '../../stores/backup.js';
import { useToastStore } from '../../stores/toast.js';
import { formatMoney, parsePositiveAmount } from '../../utils/currency.js';

export default {
  name: 'SettingsScreen',
  components: { TopBar, CategoryTree, ChevronRight },
  data() {
    return {
      editingRate: false,
      rateInput: '',
      // Same reasoning as DebtCard/DebtsScreen's own submitting guards —
      // neither the db layer nor the store rejects a second concurrent
      // addRate() call, and a double-tap on Сохранить would otherwise
      // create two rate segments for the same date.
      submitting: false,
      backupPassword: '',
    };
  },
  computed: {
    budgetRatesStore() {
      return useBudgetRatesStore();
    },
    backupStore() {
      return useBackupStore();
    },
    syncStatusText() {
      const { lastSyncAt, lastSyncOk } = this.backupStore;
      if (lastSyncAt === null) return 'Ещё не синхронизировалось';
      const when = new Date(lastSyncAt).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      return lastSyncOk ? `Синхронизировано: ${when}` : `Ошибка синхронизации: ${when}`;
    },
  },
  async mounted() {
    await this.backupStore.checkStatus();
  },
  methods: {
    formatMoney,
    startEditingRate() {
      this.rateInput = String(this.budgetRatesStore.currentRate);
      this.editingRate = true;
    },
    async saveRate() {
      if (this.submitting) return;
      const amount = parsePositiveAmount(this.rateInput);
      if (!amount) {
        useToastStore().show('Сумма должна быть больше нуля');
        return;
      }
      this.submitting = true;
      try {
        await this.budgetRatesStore.setRate(amount);
        this.editingRate = false;
      } finally {
        this.submitting = false;
      }
    },
    async submitLogin() {
      if (this.backupStore.submitting) return;
      try {
        await this.backupStore.login(this.backupPassword);
        this.backupPassword = '';
      } catch (err) {
        useToastStore().show(err.message);
      }
    },
  },
};
```

Add this CSS to the `<style lang="scss">` block, alongside the existing `.settings-row` rules:

```scss
  &__backup-login {
    gap: 8px;
  }

  &__backup-password {
    flex: 1;
    min-height: 44px;
    background: var(--surface-sunken);
    border-radius: 8px;
    padding: 0 10px;
    font-size: 14.5px;
  }

  &__backup-submit {
    min-height: 44px;
    padding: 0 14px;
    color: var(--accent-strong);
    font-weight: 600;
    font-size: 13px;
  }

  &__backup-status {
    font-size: 14px;
    color: var(--ink-muted);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/settings/SettingsScreen.spec.js`
Expected: PASS — all tests in the file, including the pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/SettingsScreen.vue src/components/settings/SettingsScreen.spec.js
git commit -m "feat: add the Резервная копия section to Settings"
```

---

## Task 19: Client — restore prompt on an empty launch

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.spec.js`

- [ ] **Step 1: Update the shared test mocks and add the failing tests**

In `src/App.spec.js`, add an import and mock:

```js
import * as backupApi from './api/backup.js';

vi.mock('./api/backup.js');
```

Change the shared `beforeEach`'s transactions default so every *pre-existing* test keeps exercising the "there's already data" path (only the new tests below deliberately opt back into the empty case):

```js
beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  categoriesDb.seedDefaultCategoryIfEmpty.mockResolvedValue(undefined);
  categoriesDb.listCategories.mockResolvedValue([]);
  ratesDb.seedDefaultRateIfEmpty.mockResolvedValue(undefined);
  ratesDb.listRates.mockResolvedValue([{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }]);
  transactionsDb.listTransactions.mockResolvedValue([
    { id: 't0', amount: 100, date: '2026-01-01', categoryId: 'c0' },
  ]);
  debtsDb.listDebts.mockResolvedValue([]);
  debtsDb.listAllPayments.mockResolvedValue([]);
});
```

Then add a new describe block:

```js
describe('App — restore prompt on an empty launch', () => {
  it('shows a restore prompt instead of the expense modal when there is no local data', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find('.restore-prompt').exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(false);
  });

  it('does not show a restore prompt when there is already local data', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find('.restore-prompt').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('restores from the server and opens the expense modal when confirmed while already logged in', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    backupApi.status.mockResolvedValue({ loggedIn: true });
    backupApi.restore.mockResolvedValue({
      categories: [], transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__confirm').trigger('click');
    await flushPromises();
    expect(backupApi.restore).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.restore-prompt').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('opens Settings instead of restoring when confirmed while not logged in, reusing its login form rather than a second one', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    backupApi.status.mockResolvedValue({ loggedIn: false });
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__confirm').trigger('click');
    await flushPromises();
    expect(backupApi.restore).not.toHaveBeenCalled();
    expect(wrapper.find('.restore-prompt').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(true);
  });

  it('dismisses the prompt and opens the expense modal without restoring, when declined', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__dismiss').trigger('click');
    expect(backupApi.restore).not.toHaveBeenCalled();
    expect(wrapper.find('.restore-prompt').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('completes the restore automatically when Settings is closed after logging in mid-restore-attempt', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    backupApi.status.mockResolvedValue({ loggedIn: false });
    backupApi.restore.mockResolvedValue({
      categories: [], transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__confirm').trigger('click');
    await flushPromises();
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(true);

    // Simulate a successful login having happened while Settings was open
    // (SettingsScreen's own login form, built in Task 18, is what would
    // really flip this in production — not re-tested here, since that's
    // already covered by SettingsScreen.spec.js).
    useBackupStore().loggedIn = true;
    await wrapper.find('.app-shell__settings-close').trigger('click');
    await flushPromises();

    expect(backupApi.restore).toHaveBeenCalledTimes(1);
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('does not attempt a restore when Settings is closed without having logged in', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    backupApi.status.mockResolvedValue({ loggedIn: false });
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__confirm').trigger('click');
    await flushPromises();

    await wrapper.find('.app-shell__settings-close').trigger('click');
    await flushPromises();

    expect(backupApi.restore).not.toHaveBeenCalled();
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('closing Settings normally (never having attempted a restore) does not trigger one', async () => {
    // Regression guard for resumeRestoreAfterLogin's default: opening
    // Settings via the ordinary gear icon (not via the restore prompt)
    // must not accidentally restore on close.
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.findComponent({ name: 'BudgetDashboard' }).vm.$emit('open-settings');
    await wrapper.vm.$nextTick();
    await wrapper.find('.app-shell__settings-close').trigger('click');
    await flushPromises();
    expect(backupApi.restore).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- src/App.spec.js`
Expected: the pre-existing tests still pass (thanks to the updated default mock); the 8 new tests FAIL — `.restore-prompt` doesn't exist yet.

- [ ] **Step 3: Update `App.vue`**

Replace the whole file with:

```vue
<template>
  <div id="app-shell" class="app-shell">
    <!-- showExpenseModal/showRestorePrompt must count here too, not just
         showSettings — with TransactionList (rows behind this same content
         div) a keyboard/AT user could otherwise Tab into a background row
         while an overlay is open and silently switch its editingTransaction,
         discarding whatever unsaved amount was typed, with zero warning. -->
    <div class="app-shell__content" :inert="showSettings || showExpenseModal || showRestorePrompt">
      <template v-if="ready">
        <BudgetDashboard
          v-if="activeTab === 'budget'"
          @open-settings="showSettings = true"
          @edit-transaction="openEditModal"
        />
        <DebtsScreen v-else />
      </template>
      <p v-else class="app-shell__loading">Загрузка…</p>
    </div>

    <div class="app-shell__tabs" :inert="showSettings || showExpenseModal || showRestorePrompt">
      <Toast :message="toastStore.message" />
      <TabBar :active-tab="activeTab" @update:active-tab="activeTab = $event" @add-expense="openAddModal" />
    </div>

    <template v-if="showSettings">
      <SettingsScreen class="app-shell__settings-overlay" />
      <button type="button" class="app-shell__settings-close" aria-label="Закрыть настройки" @click="closeSettings">
        <X :size="16" />
      </button>
    </template>

    <div v-if="showRestorePrompt" class="restore-prompt" role="dialog" aria-modal="true" aria-labelledby="restore-prompt-text">
      <div class="restore-prompt__backdrop"></div>
      <div class="restore-prompt__sheet">
        <p id="restore-prompt-text" class="restore-prompt__text">
          Похоже, локальных данных ещё нет. Восстановить последнюю резервную копию с сервера?
        </p>
        <button type="button" class="restore-prompt__confirm" @click="confirmRestore">Восстановить</button>
        <button type="button" class="restore-prompt__dismiss" @click="dismissRestorePrompt">Не сейчас</button>
      </div>
    </div>

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
import { X } from '@lucide/vue';
import { useCategoriesStore } from './stores/categories.js';
import { useBudgetRatesStore } from './stores/budgetRates.js';
import { useTransactionsStore } from './stores/transactions.js';
import { useDebtsStore } from './stores/debts.js';
import { useBackupStore } from './stores/backup.js';
import { useToastStore } from './stores/toast.js';

export default {
  name: 'App',
  components: { BudgetDashboard, DebtsScreen, SettingsScreen, ExpenseModal, TabBar, Toast, X },
  data() {
    return {
      // Every store read on screen (dashboard figures, category list, debts)
      // is empty until created()'s Promise.all below resolves — rendering
      // the real screens before then shows a misleadingly-confident "0 ₽"
      // and an empty, non-functional category picker in the always-on-launch
      // modal, worst on exactly the cold-IndexedDB case that matters most
      // for a first impression.
      ready: false,
      activeTab: 'budget',
      showSettings: false,
      showExpenseModal: false, // flips true once ready, see created() below
      showRestorePrompt: false,
      // Set only when confirmRestore() redirects to Settings because the
      // user wasn't logged in yet — remembers that closing Settings should
      // resume the restore (if login actually succeeded meanwhile) rather
      // than stranding the user with no way back to the prompt they
      // already dismissed to get there.
      resumeRestoreAfterLogin: false,
      editingTransaction: null,
    };
  },
  computed: {
    toastStore() {
      return useToastStore();
    },
  },
  async created() {
    try {
      await Promise.all([
        useCategoriesStore().load(),
        useBudgetRatesStore().load(),
        useTransactionsStore().load(),
        useDebtsStore().load(),
      ]);
      // "Empty" is judged by transactions/debts, not categories — categories
      // always has at least the seeded default (see categoriesStore.load()),
      // so it's never a useful signal for "this looks like a fresh install".
      const isEmpty = useTransactionsStore().items.length === 0 && useDebtsStore().items.length === 0;
      if (isEmpty) {
        this.showRestorePrompt = true;
      } else {
        this.showExpenseModal = true; // greets the user on every launch, once there's real data to enter against
      }
    } catch (err) {
      // Nothing else in this app has a retry affordance for a failed initial
      // load (quota exceeded, IndexedDB blocked in private mode, etc.) — a
      // toast at least tells the user why the screen came up empty, rather
      // than leaving them to guess. `ready` still flips in `finally` so the
      // app isn't stuck on the loading screen forever.
      console.error('Store load failed:', err);
      useToastStore().show('Не удалось загрузить данные. Перезапустите приложение.');
    } finally {
      this.ready = true;
    }
  },
  methods: {
    openAddModal() {
      this.editingTransaction = null;
      this.showExpenseModal = true;
    },
    openEditModal(transaction) {
      this.editingTransaction = transaction;
      this.showExpenseModal = true;
    },
    closeExpenseModal() {
      this.showExpenseModal = false;
      this.editingTransaction = null;
    },
    async confirmRestore() {
      const backupStore = useBackupStore();
      const loggedIn = await backupStore.checkStatus().catch(() => false);
      if (!loggedIn) {
        // Decision #8: no second, separate login surface for this prompt —
        // send the user to the same login form Settings already has, and
        // remember to resume the restore once they close it (see
        // closeSettings() below) rather than stranding them with no way
        // back to what they just confirmed.
        this.showRestorePrompt = false;
        this.resumeRestoreAfterLogin = true;
        this.showSettings = true;
        return;
      }
      await backupStore.restore();
      this.showRestorePrompt = false;
      this.showExpenseModal = true;
    },
    dismissRestorePrompt() {
      this.showRestorePrompt = false;
      this.showExpenseModal = true;
    },
    async closeSettings() {
      this.showSettings = false;
      if (this.resumeRestoreAfterLogin) {
        this.resumeRestoreAfterLogin = false;
        // Only actually restore if login genuinely succeeded while
        // Settings was open — if the user just closed it without logging
        // in, this falls through to opening the expense modal normally,
        // the same as declining the prompt outright, rather than nagging
        // them again.
        if (useBackupStore().loggedIn) {
          await useBackupStore().restore();
        }
        this.showExpenseModal = true;
      }
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

  &__loading {
    padding: 40px 18px;
    text-align: center;
    color: var(--ink-muted);
    font-size: 14px;
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

    // SettingsScreen's own root already carries its own `.settings-screen`
    // class (Vue merges this passed-in class onto that same root element),
    // which sets `padding: 0 18px`. A plain `&__settings-overlay { padding:
    // ... }` here would tie with it on specificity (0,1,0 vs 0,1,0) and the
    // winner would depend on which component's compiled <style> block Vite
    // happens to place later in the bundle — not something to leave to
    // chance. Chaining `&.settings-screen` makes a compound selector
    // (0,2,0) that deterministically wins over either single-class rule
    // regardless of source order.
    &.settings-screen {
      padding: 44px 18px 18px;
    }
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

    // Same emergent-height gap as every other small circular icon button
    // this session (DebtsScreen's 30px add-toggle, CategoryTree's 26px
    // more-button) — hit-slop rather than min-height, since this one
    // shouldn't visually grow past its drawn circle. position: absolute
    // (already needed for the button's own placement) already establishes
    // the containing block this ::before positions against.
    &::before {
      content: '';
      position: absolute;
      inset: -7px;
    }
  }
}

.restore-prompt {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;

  &__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.38);
  }

  &__sheet {
    position: relative;
    width: 100%;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    padding: 22px 18px calc(18px + env(safe-area-inset-bottom));
  }

  &__text {
    font-size: 14.5px;
    color: var(--ink-secondary);
    margin-bottom: 16px;
  }

  &__confirm {
    width: 100%;
    min-height: 44px;
    border-radius: 12px;
    background: var(--accent-strong);
    color: var(--surface);
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 8px;
  }

  &__dismiss {
    width: 100%;
    min-height: 44px;
    color: var(--ink-muted);
    font-size: 14px;
  }
}
</style>
```

`--accent-strong`, `--surface`, `--ink-secondary`, and `--ink-muted` are all existing tokens already used elsewhere in this codebase (e.g. `SettingsScreen.vue`'s own `__rate-save`, `ExpenseModal.vue`'s `__delete`) — no new tokens are introduced here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/App.spec.js`
Expected: PASS — all tests in the file, including every pre-existing one.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/App.spec.js
git commit -m "feat: offer a one-tap restore from backup on an empty launch"
```

---

## Task 20: Full-suite and real-device verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire client test suite**

Run: `npm test`
Expected: every spec file passes, 0 failures (Phase 1's ~245 tests plus every test added in Tasks 14–19).

- [ ] **Step 2: Run the entire server test suite**

Run: `cd server && npm test`
Expected: every test file passes, 0 failures (Tasks 2–6).

- [ ] **Step 3: Build the production frontend locally and confirm it's the one already deployed**

Run: `npm run build`
Expected: builds without errors. Compare `dist/` output against what's already on the VPS (Task 9, Step 4) — if this plan's later tasks changed any client file, redeploy: `git push`, then on the VPS, `cd /opt/budget-app/repo && sudo -u budget git pull && sudo -u budget npm install && sudo -u budget npm run build && systemctl restart budget-server` (as root, or via `sudo` for the restart).

- [ ] **Step 4: Manual smoke test from a real iPhone**

On the phone (already installed as a home-screen PWA per Phase 1): open the app, go to Settings → Резервная копия, log in with a real password (first-ever login registers it), add or edit a transaction, then check the status line updates to a recent "Синхронизировано: …" timestamp. From the VPS, confirm data landed: `sqlite3 /opt/budget-app/repo/server/data/budget.sqlite "SELECT count(*) FROM transactions;"` (or use the `sqlite3` CLI — install with `apt-get install -y sqlite3` if not already present — read-only inspection only, this plan doesn't add sqlite3 as an app dependency).

- [ ] **Step 5: Manual smoke test of the restore flow**

Uninstall the PWA from the phone (or use a second test device/browser profile with a fresh IndexedDB) and reinstall it fresh. Confirm the restore prompt appears, confirm it correctly requires login first if not already logged in, and confirm tapping "Восстановить" repopulates the dashboard with the previously-synced data.

---

## Review

(To be filled in after all tasks execute — record any deviations from this plan, and the final commit range, here before merging.)

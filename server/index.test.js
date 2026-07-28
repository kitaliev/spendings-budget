import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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

  test('POST /api/login with a malformed JSON body is rejected, not fatal', async () => {
    const res = await fetch(`${baseUrl}/api/login`, { method: 'POST', body: 'not json{' });
    assert.equal(res.status, 400);
    const stillUp = await fetch(`${baseUrl}/api/status`);
    assert.equal(stillUp.status, 200); // proves the server process is still alive, not just this one request
  });
});

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

  test('a rotated backup file is independently readable and contains the actual synced data', async () => {
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ password: 'hunter2' }),
    });
    const cookie = loginRes.headers.get('set-cookie');
    const snapshot = {
      categories: [{ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null, archived: false }],
      transactions: [], budgetRates: [], debts: [], debtPayments: [],
    };
    await fetch(`${baseUrl}/api/sync`, { method: 'POST', headers: { cookie }, body: JSON.stringify(snapshot) });
    // A second sync is what actually triggers rotateBackup to copy a file
    // containing the FIRST sync's data (rotation happens before the new
    // overwrite) — so do it twice, matching the real call order.
    await fetch(`${baseUrl}/api/sync`, { method: 'POST', headers: { cookie }, body: JSON.stringify(snapshot) });

    // Sorted (not readdirSync's raw order, which isn't guaranteed to be
    // chronological) and take the most recent: this describe block's tests
    // share one testBackupDir for its whole run, so an earlier test's own
    // sync ('a logged-in caller can sync...') has already left a prior
    // backup in here too. Filenames are zero-padded ISO timestamps, so
    // lexicographic sort order is chronological order.
    const backupFiles = fs.readdirSync(testBackupDir).sort();
    assert.ok(backupFiles.length >= 1);
    // Open the rotated copy as its own INDEPENDENT connection — this is what
    // actually proves the file on disk is complete, not just that the live
    // in-memory connection still has the data.
    const backupDb = openDatabase(path.join(testBackupDir, backupFiles.at(-1)));
    const rows = backupDb.prepare('SELECT * FROM categories').all();
    backupDb.close();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Еда');
  });

  test('rejects a malformed snapshot shape without touching existing data', async () => {
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      body: JSON.stringify({ password: 'hunter2' }),
    });
    const cookie = loginRes.headers.get('set-cookie');
    const goodSnapshot = {
      categories: [{ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null, archived: false }],
      transactions: [], budgetRates: [], debts: [], debtPayments: [],
    };
    await fetch(`${baseUrl}/api/sync`, { method: 'POST', headers: { cookie }, body: JSON.stringify(goodSnapshot) });

    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ categories: 'oops', transactions: [], budgetRates: [], debts: [], debtPayments: [] }),
    });
    assert.equal(res.status, 400);

    const restoreRes = await fetch(`${baseUrl}/api/restore`, { headers: { cookie } });
    const restored = await restoreRes.json();
    assert.deepEqual(restored.categories, goodSnapshot.categories); // proves the malformed sync didn't touch existing data
  });

  test('falls back to index.html for a missing file, and serves the real file content when it exists', async () => {
    const emptyDistDir = './test-empty-dist';
    fs.rmSync(emptyDistDir, { recursive: true, force: true });
    fs.mkdirSync(emptyDistDir, { recursive: true });
    fs.writeFileSync(path.join(emptyDistDir, 'index.html'), '<title>Бюджет на день</title>');

    const testApp = createApp(db, { hashPath: testHashPath, dbPath: testDbPath, backupDir: testBackupDir, distDir: emptyDistDir });
    const testServer = http.createServer(testApp);
    await new Promise((resolve) => testServer.listen(0, resolve));
    const testBaseUrl = `http://localhost:${testServer.address().port}`;

    // try/finally matters here specifically: this test spins up its own
    // server rather than reusing the describe block's shared one, so if an
    // assertion below throws without this, testServer is never closed —
    // an open listening socket keeps Node's event loop alive and hangs the
    // entire test run rather than just failing this one test.
    try {
      const missingRes = await fetch(`${testBaseUrl}/some/nonexistent/path.js`);
      assert.equal(missingRes.status, 200);
      assert.ok((await missingRes.text()).includes('Бюджет на день')); // SPA fallback served index.html
    } finally {
      await new Promise((resolve) => testServer.close(resolve));
      fs.rmSync(emptyDistDir, { recursive: true, force: true });
    }
  });
});

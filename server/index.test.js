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

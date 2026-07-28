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

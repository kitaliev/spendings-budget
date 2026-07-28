import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
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

  test('the hash file is created with mode 0o600 (owner-only)', () => {
    checkOrRegisterPassword(hashPath, 'hunter2');
    const mode = fs.statSync(hashPath).mode & 0o777;
    assert.equal(mode, 0o600, `expected mode 0o600, got ${mode.toString(8)}`);
  });

  test('concurrent registration: if file exists by write time, falls through to comparison instead of throwing', async () => {
    // Simulate the race: pre-populate the file with a known bcrypt hash
    // (this represents another concurrent request winning the race),
    // then call checkOrRegisterPassword with a different password.
    // It should detect EEXIST and compare against the stored hash,
    // not throw, not overwrite, and return false (wrong password).
    const wrongPassword = 'correct-horse-battery-staple';
    const rightPassword = 'hunter2';
    const rightHash = bcrypt.hashSync(rightPassword, 10);

    fs.writeFileSync(hashPath, rightHash, { encoding: 'utf8', mode: 0o600 });

    // Now call checkOrRegisterPassword with the wrong password — it should
    // detect that the file exists (EEXIST on the write), fall through to
    // comparison, and return false because wrongPassword != rightPassword.
    const result = checkOrRegisterPassword(hashPath, wrongPassword);
    assert.equal(result, false, 'should reject wrong password when file already exists from concurrent write');

    // Verify the original hash was not overwritten.
    const storedHash = fs.readFileSync(hashPath, 'utf8').trim();
    assert.equal(storedHash, rightHash, 'original hash should not be overwritten');
  });
});

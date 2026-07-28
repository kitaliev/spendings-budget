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

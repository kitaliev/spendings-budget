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
    if (fs.existsSync(liveDb)) fs.unlinkSync(liveDb);
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

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

  // Regression test: an earlier version derived the INSERT column list from
  // Object.keys(rows[0]) alone. Here row 0 has fewer keys than row 1, so
  // that earlier version generated an INSERT statement covering only
  // id/name — row 1's emoji, parentId, and archived were silently dropped
  // (better-sqlite3 ignores bound properties a prepared statement doesn't
  // reference; it only throws for a referenced column that's missing).
  // No exception, no warning, just quietly wrong data after the preceding
  // DELETE had already destroyed the previous rows.
  test('a row with fewer keys than a later row in the same table does not corrupt the later row', () => {
    overwriteFromSnapshot(db, {
      categories: [
        { id: 'c5', name: 'Прочее' },
        { id: 'c6', name: 'Кино', emoji: '🎬', parentId: null, archived: true },
      ],
      transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });
    const result = dumpToSnapshot(db);
    assert.deepEqual(result.categories.find((c) => c.id === 'c6'), {
      id: 'c6', name: 'Кино', emoji: '🎬', parentId: null, archived: true,
    });
    // The shorter row's omitted fields should degrade to sane defaults
    // (null / false), not crash and not silently reuse another row's values.
    assert.deepEqual(result.categories.find((c) => c.id === 'c5'), {
      id: 'c5', name: 'Прочее', emoji: null, parentId: null, archived: false,
    });
  });
});

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

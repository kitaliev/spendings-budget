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

// Fixed per-table column lists, matching SCHEMA. Deriving these from
// Object.keys(rows[0]) instead (as an earlier version did) is unsafe on two
// counts: (1) any row after the first whose key set is a superset of row
// 0's silently drops its extra fields — better-sqlite3's named-parameter
// binding only throws for a referenced column that's *missing* from the
// bound object, never for one present on the object but absent from the
// SQL, so there's no exception to catch; and (2) an unexpected key becoming
// part of the generated SQL identifier list is a needless crash surface
// (`SqliteError: table X has no column named Y`). Expressing the columns as
// a compile-time constant closes both: column names never come from client
// data, so row shape (whether ragged, reordered, or from an unvalidated
// HTTP body in the future /api/sync handler) can't affect them.
const COLUMNS = {
  categories: ['id', 'name', 'emoji', 'parentId', 'archived'],
  transactions: ['id', 'amount', 'date', 'categoryId'],
  budgetRates: ['id', 'amount', 'effectiveFrom'],
  debts: ['id', 'name', 'amount', 'comment', 'direction'],
  debtPayments: ['id', 'debtId', 'amount', 'date'],
};

export function openDatabase(dbPath) {
  const db = new Database(dbPath);
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
      const columns = COLUMNS[table];
      const placeholders = columns.map((c) => `@${c}`).join(', ');
      const insert = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
      for (const row of rows) {
        // Build the bound object by explicitly assigning every declared
        // column, rather than passing `row` through as-is. This matters
        // for rows that omit an optional field entirely: better-sqlite3
        // throws "Missing named parameter" if a referenced column has no
        // property at all on the bound object, but happily binds an
        // explicit `undefined` as NULL. Assigning `bound[col] = row[col]`
        // always creates the property (value undefined if absent on row),
        // so a ragged row degrades to NULL columns instead of crashing.
        const bound = {};
        for (const col of columns) bound[col] = row[col];
        // SQLite has no boolean type; categories.archived arrives from
        // IndexedDB as a real JS boolean, so bind it as 0/1 the same way
        // better-sqlite3 already requires for parameters generally.
        if (table === 'categories') bound.archived = row.archived ? 1 : 0;
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

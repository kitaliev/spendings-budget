import { getDb } from './index.js';

const STORE_NAMES = ['categories', 'transactions', 'budgetRates', 'debts', 'debtPayments'];

// Wholesale-replaces every local IndexedDB store with a server backup
// snapshot — used only by the one-tap restore flow on an empty-database
// launch (App.vue). Mirrors the server's own overwriteFromSnapshot
// (server/db.js): the two sides are meant to be exact mirrors of each
// other, never gradually reconciled.
//
// Deliberately no shape validation here, unlike the server's own
// overwriteFromSnapshot boundary (server/index.js's isValidSnapshot):
// this function's input always comes from this app's own /api/restore
// endpoint, which is a plain SQL SELECT read back from a database whose
// only write path (the server's /api/sync handler) already validates
// this exact shape before ever storing anything. There's no code path
// by which a legitimate response here could be malformed the way an
// arbitrary HTTP client's request body could be.
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

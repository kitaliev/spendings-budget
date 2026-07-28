import { getDb } from './index.js';

const STORE_NAMES = ['categories', 'transactions', 'budgetRates', 'debts', 'debtPayments'];

// Wholesale-replaces every local IndexedDB store with a server backup
// snapshot — used only by the one-tap restore flow on an empty-database
// launch (App.vue). Mirrors the server's own overwriteFromSnapshot
// (server/db.js): the two sides are meant to be exact mirrors of each
// other, never gradually reconciled.
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

import { openDB } from 'idb';

const DB_VERSION = 1;
const DEFAULT_NAME = 'budget-app';

export function openDatabase(name = DEFAULT_NAME) {
  return openDB(name, DB_VERSION, {
    upgrade(db) {
      const categories = db.createObjectStore('categories', { keyPath: 'id' });
      categories.createIndex('parentId', 'parentId');

      const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
      transactions.createIndex('date', 'date');
      transactions.createIndex('categoryId', 'categoryId');

      const budgetRates = db.createObjectStore('budgetRates', { keyPath: 'id' });
      budgetRates.createIndex('effectiveFrom', 'effectiveFrom');

      const debts = db.createObjectStore('debts', { keyPath: 'id' });
      debts.createIndex('direction', 'direction');

      const debtPayments = db.createObjectStore('debtPayments', { keyPath: 'id' });
      debtPayments.createIndex('debtId', 'debtId');
    },
  });
}

let dbPromise = null;

/** Shared singleton connection used by the app at runtime. */
export function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** Test-only: empties every store so specs don't leak state into each other via the shared singleton connection. */
export async function clearAllStores() {
  const db = await getDb();
  const storeNames = Array.from(db.objectStoreNames);
  const tx = db.transaction(storeNames, 'readwrite');
  await Promise.all(storeNames.map((name) => tx.objectStore(name).clear()));
  await tx.done;
}

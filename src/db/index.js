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

/** Shared singleton connection used by the app at runtime (tests use openDatabase() directly with unique names). */
export function getDb() {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

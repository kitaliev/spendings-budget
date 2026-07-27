import { getDb } from './index.js';

export async function createDebt({ name, amount, comment = '', direction }) {
  const db = await getDb();
  const debt = { id: crypto.randomUUID(), name, amount, comment, direction };
  await db.add('debts', debt);
  return debt;
}

export async function listDebts() {
  const db = await getDb();
  return db.getAll('debts');
}

export async function updateDebt(id, changes) {
  const db = await getDb();
  // Read and write share one transaction rather than being two separate
  // implicit ones with an await gap between them — the same TOCTOU shape
  // already found and fixed in categories.js, budgetRates.js, and
  // transactions.js: two concurrent partial updates to the same row would
  // otherwise both read the same pre-write snapshot and each overwrite the
  // other's field when they land.
  const tx = db.transaction('debts', 'readwrite');
  const existing = await tx.store.get(id);
  if (!existing) throw new Error(`Debt ${id} not found`);
  const updated = { ...existing, ...changes };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deleteDebt(id) {
  const db = await getDb();
  const tx = db.transaction(['debts', 'debtPayments'], 'readwrite');
  await tx.objectStore('debts').delete(id);
  const paymentsByDebt = tx.objectStore('debtPayments').index('debtId');
  let cursor = await paymentsByDebt.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function addPayment({ debtId, amount, date }) {
  const db = await getDb();
  const payment = { id: crypto.randomUUID(), debtId, amount, date };
  await db.add('debtPayments', payment);
  return payment;
}

export async function listPayments(debtId) {
  const db = await getDb();
  return db.getAllFromIndex('debtPayments', 'debtId', debtId);
}

export async function listAllPayments() {
  const db = await getDb();
  return db.getAll('debtPayments');
}

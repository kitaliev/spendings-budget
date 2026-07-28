import { getDb } from './index.js';

export async function createTransaction({ amount, date, categoryId }) {
  const db = await getDb();
  const transaction = { id: crypto.randomUUID(), amount, date, categoryId };
  await db.add('transactions', transaction);
  return transaction;
}

export async function listTransactions() {
  const db = await getDb();
  return db.getAll('transactions');
}

export async function updateTransaction(id, changes) {
  const db = await getDb();
  // Read and write share one transaction (same pattern as budgetRates.js's
  // addRate) rather than being two separate implicit transactions with an
  // await gap between them: two concurrent partial updates to the same row
  // would otherwise both read the same pre-write snapshot and each overwrite
  // the other's field when they land.
  const tx = db.transaction('transactions', 'readwrite');
  const existing = await tx.store.get(id);
  if (!existing) throw new Error(`Transaction ${id} not found`);
  const updated = { ...existing, ...changes };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function deleteTransaction(id) {
  const db = await getDb();
  await db.delete('transactions', id);
}

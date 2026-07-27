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
  const existing = await db.get('transactions', id);
  if (!existing) throw new Error(`Transaction ${id} not found`);
  const updated = { ...existing, ...changes };
  await db.put('transactions', updated);
  return updated;
}

export async function deleteTransaction(id) {
  const db = await getDb();
  await db.delete('transactions', id);
}

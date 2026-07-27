import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores } from './index.js';
import { createTransaction, listTransactions, updateTransaction, deleteTransaction } from './transactions.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('createTransaction / listTransactions', () => {
  it('persists a transaction', async () => {
    await createTransaction({ amount: 500, date: '2026-07-20', categoryId: 'cat-1' });
    const all = await listTransactions();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ amount: 500, date: '2026-07-20', categoryId: 'cat-1' });
  });
});

describe('updateTransaction', () => {
  it('changes only the given fields', async () => {
    const created = await createTransaction({ amount: 500, date: '2026-07-20', categoryId: 'cat-1' });
    const updated = await updateTransaction(created.id, { amount: 750 });
    expect(updated.amount).toBe(750);
    expect(updated.categoryId).toBe('cat-1');
  });

  it('throws for an unknown id', async () => {
    await expect(updateTransaction('missing', { amount: 1 })).rejects.toThrow();
  });

  it('does not lose one of two concurrent partial updates to the same row', async () => {
    const created = await createTransaction({ amount: 500, date: '2026-07-20', categoryId: 'cat-1' });
    await Promise.all([
      updateTransaction(created.id, { amount: 750 }),
      updateTransaction(created.id, { date: '2026-07-21' }),
    ]);
    const [stored] = await listTransactions();
    expect(stored).toMatchObject({ amount: 750, date: '2026-07-21' });
  });
});

describe('deleteTransaction', () => {
  it('removes the transaction', async () => {
    const created = await createTransaction({ amount: 500, date: '2026-07-20', categoryId: 'cat-1' });
    await deleteTransaction(created.id);
    expect(await listTransactions()).toHaveLength(0);
  });
});

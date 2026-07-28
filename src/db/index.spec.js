import { describe, it, expect } from 'vitest';
import { openDatabase } from './index.js';

describe('openDatabase', () => {
  it('creates all required object stores', async () => {
    const db = await openDatabase('test-db-' + Math.random());
    const names = Array.from(db.objectStoreNames);
    expect(names).toEqual(
      expect.arrayContaining(['categories', 'transactions', 'budgetRates', 'debts', 'debtPayments'])
    );
    db.close();
  });

  it('indexes transactions by date', async () => {
    const db = await openDatabase('test-db-' + Math.random());
    const tx = db.transaction('transactions');
    expect(Array.from(tx.store.indexNames)).toContain('date');
    db.close();
  });

  it('creates every store with its expected indexes', async () => {
    const db = await openDatabase('test-db-' + Math.random());
    const expected = {
      categories: ['parentId'],
      transactions: ['date', 'categoryId'],
      budgetRates: ['effectiveFrom'],
      debts: ['direction'],
      debtPayments: ['debtId'],
    };
    for (const [store, indexes] of Object.entries(expected)) {
      expect(Array.from(db.transaction(store).store.indexNames)).toEqual(expect.arrayContaining(indexes));
    }
    db.close();
  });
});

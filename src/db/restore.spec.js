import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, clearAllStores } from './index.js';
import { restoreAllFromSnapshot } from './restore.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('restoreAllFromSnapshot', () => {
  it('writes every table of the snapshot into its matching IndexedDB store', async () => {
    const snapshot = {
      categories: [{ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null, archived: false }],
      transactions: [{ id: 't1', amount: 500, date: '2026-07-01', categoryId: 'c1' }],
      budgetRates: [{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }],
      debts: [{ id: 'd1', name: 'Друг', amount: 1000, comment: '', direction: 'owed_to_me' }],
      debtPayments: [{ id: 'p1', debtId: 'd1', amount: 200, date: '2026-07-01' }],
    };
    await restoreAllFromSnapshot(snapshot);

    const db = await getDb();
    expect(await db.getAll('categories')).toEqual(snapshot.categories);
    expect(await db.getAll('transactions')).toEqual(snapshot.transactions);
    expect(await db.getAll('budgetRates')).toEqual(snapshot.budgetRates);
    expect(await db.getAll('debts')).toEqual(snapshot.debts);
    expect(await db.getAll('debtPayments')).toEqual(snapshot.debtPayments);
  });

  it('replaces whatever was already there, rather than merging with it', async () => {
    const db = await getDb();
    await db.put('categories', { id: 'stale', name: 'Старое', emoji: '👴', parentId: null, archived: false });

    await restoreAllFromSnapshot({
      categories: [{ id: 'fresh', name: 'Новое', emoji: '✨', parentId: null, archived: false }],
      transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });

    const categories = await db.getAll('categories');
    expect(categories.map((c) => c.id)).toEqual(['fresh']);
  });

  it('a row missing an optional field is stored as-is, with that field simply absent', async () => {
    await restoreAllFromSnapshot({
      categories: [{ id: 'c1', name: 'Еда', emoji: '🍔' }], // no parentId, no archived
      transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });
    const db = await getDb();
    const stored = await db.get('categories', 'c1');
    expect(stored).toEqual({ id: 'c1', name: 'Еда', emoji: '🍔' });
  });

  it('a row with an unexpected extra field preserves that field rather than dropping it', async () => {
    await restoreAllFromSnapshot({
      categories: [{ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null, archived: false, futureField: 'x' }],
      transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });
    const db = await getDb();
    const stored = await db.get('categories', 'c1');
    expect(stored.futureField).toBe('x');
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTransactionsStore } from './transactions.js';
import * as transactionsDb from '../db/transactions.js';

vi.mock('../db/transactions.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('useTransactionsStore.create', () => {
  it('appends the created transaction to items', async () => {
    transactionsDb.createTransaction.mockResolvedValue({ id: '1', amount: 500, date: '2026-07-20', categoryId: 'c1' });
    const store = useTransactionsStore();
    await store.create({ amount: 500, date: '2026-07-20', categoryId: 'c1' });
    expect(store.items).toHaveLength(1);
  });
});

describe('useTransactionsStore.remove', () => {
  it('removes the transaction from items', async () => {
    transactionsDb.createTransaction.mockResolvedValue({ id: '1', amount: 500, date: '2026-07-20', categoryId: 'c1' });
    transactionsDb.deleteTransaction.mockResolvedValue(undefined);
    const store = useTransactionsStore();
    await store.create({ amount: 500, date: '2026-07-20', categoryId: 'c1' });
    await store.remove('1');
    expect(store.items).toHaveLength(0);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDebtsStore } from './debts.js';
import * as debtsDb from '../db/debts.js';

vi.mock('../db/debts.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

function setupStore() {
  const store = useDebtsStore();
  store.items = [
    { id: 'd1', name: 'Андрей', amount: 15000, comment: '', direction: 'owed_to_me' },
    { id: 'd2', name: 'Максим', amount: 1200, comment: '', direction: 'owed_to_me' },
  ];
  store.payments = [
    { id: 'p1', debtId: 'd1', amount: 5000, date: '2026-07-02' },
    { id: 'p2', debtId: 'd2', amount: 1200, date: '2026-06-10' },
  ];
  return store;
}

describe('useDebtsStore.remainingOf', () => {
  it('is the original amount minus the sum of payments', () => {
    const store = setupStore();
    expect(store.remainingOf('d1')).toBe(10000);
  });
});

describe('useDebtsStore.openByDirection / closedByDirection', () => {
  it('splits debts by whether they are fully paid', () => {
    const store = setupStore();
    expect(store.openByDirection('owed_to_me').map((d) => d.id)).toEqual(['d1']);
    expect(store.closedByDirection('owed_to_me').map((d) => d.id)).toEqual(['d2']);
  });
});

describe('useDebtsStore.pay', () => {
  it('records a new payment and updates the remaining balance', async () => {
    const store = setupStore();
    debtsDb.addPayment.mockResolvedValue({ id: 'p3', debtId: 'd1', amount: 2000, date: '2026-07-27' });
    await store.pay('d1', 2000, '2026-07-27');
    expect(store.remainingOf('d1')).toBe(8000);
  });
});

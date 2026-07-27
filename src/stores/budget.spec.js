import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBudgetStore } from './budget.js';
import { useBudgetRatesStore } from './budgetRates.js';
import { useTransactionsStore } from './transactions.js';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('useBudgetStore.availableForMonth', () => {
  it('combines rate segments and transactions through the shared formula', () => {
    useBudgetRatesStore().segments = [{ amount: 2500, effectiveFrom: '2026-07-01' }];
    useTransactionsStore().items = [
      { date: '2026-07-05', amount: 2000 },
      { date: '2026-07-03', amount: 1000 },
    ];

    const budget = useBudgetStore();
    expect(budget.availableForMonth('2026-07', '2026-07-10')).toBe(22000);
  });
});

describe('useBudgetStore.spendForMonth', () => {
  it('sums transactions within the given month only', () => {
    useTransactionsStore().items = [
      { date: '2026-07-05', amount: 2000 },
      { date: '2026-06-30', amount: 500 },
    ];
    const budget = useBudgetStore();
    expect(budget.spendForMonth('2026-07')).toBe(2000);
  });
});

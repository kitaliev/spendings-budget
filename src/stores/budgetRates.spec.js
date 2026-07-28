import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBudgetRatesStore } from './budgetRates.js';
import * as ratesDb from '../db/budgetRates.js';

vi.mock('../db/budgetRates.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  ratesDb.seedDefaultRateIfEmpty.mockResolvedValue(undefined);
});

describe('useBudgetRatesStore.currentRate', () => {
  it('is the amount of the most recently effective segment', async () => {
    ratesDb.listRates.mockResolvedValue([
      { id: '1', amount: 2500, effectiveFrom: '2026-07-01' },
      { id: '2', amount: 3500, effectiveFrom: '2026-07-20' },
    ]);
    const store = useBudgetRatesStore();
    await store.load();
    expect(store.currentRate).toBe(3500);
  });

  it('is 0 when no rate has been set yet', async () => {
    ratesDb.listRates.mockResolvedValue([]);
    const store = useBudgetRatesStore();
    await store.load();
    expect(store.currentRate).toBe(0);
  });
});

describe('useBudgetRatesStore.setRate', () => {
  it('adds a new segment effective today and reloads', async () => {
    ratesDb.addRate.mockResolvedValue({ id: '3', amount: 4000, effectiveFrom: '2026-07-27' });
    ratesDb.listRates.mockResolvedValue([{ id: '3', amount: 4000, effectiveFrom: '2026-07-27' }]);
    const store = useBudgetRatesStore();
    await store.setRate(4000);
    expect(ratesDb.addRate).toHaveBeenCalledWith(expect.objectContaining({ amount: 4000 }));
    expect(store.currentRate).toBe(4000);
  });
});

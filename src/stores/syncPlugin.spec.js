import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { syncPlugin } from './syncPlugin.js';
import { useCategoriesStore } from './categories.js';
import { useTransactionsStore } from './transactions.js';
import { useBudgetRatesStore } from './budgetRates.js';
import { useDebtsStore } from './debts.js';
import { useBackupStore } from './backup.js';
import * as categoriesDb from '../db/categories.js';
import * as transactionsDb from '../db/transactions.js';
import * as budgetRatesDb from '../db/budgetRates.js';
import * as debtsDb from '../db/debts.js';
import * as backupApi from '../api/backup.js';

vi.mock('../db/categories.js');
vi.mock('../db/transactions.js');
vi.mock('../db/budgetRates.js');
vi.mock('../db/debts.js');
vi.mock('../api/backup.js');

beforeEach(() => {
  const pinia = createPinia();
  pinia.use(syncPlugin);
  // pinia.use() only queues a plugin (in an internal "toBeInstalled" array)
  // until an app is actually installed via app.use(pinia) — that's what
  // flushes the queue into the array Pinia consults when constructing each
  // store. main.js always installs a real app, so this is invisible there;
  // every other spec in this folder gets away with bare
  // setActivePinia(createPinia()) because none of them registers a plugin.
  // Here we do, so a throwaway app is needed to make pinia.use() take
  // effect at all — without it, syncPlugin would silently never run.
  createApp({}).use(pinia);
  setActivePinia(pinia);
  vi.clearAllMocks();
  backupApi.sync.mockResolvedValue(undefined);
  categoriesDb.createCategory.mockResolvedValue({ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null });
});

describe('syncPlugin', () => {
  it('triggers a background sync after a write action on a synced store resolves', async () => {
    await useCategoriesStore().create({ name: 'Еда', emoji: '🍔' });
    expect(backupApi.sync).toHaveBeenCalledTimes(1);
  });

  it('does not trigger a sync for a load action', async () => {
    categoriesDb.seedDefaultCategoryIfEmpty.mockResolvedValue(undefined);
    categoriesDb.listCategories.mockResolvedValue([]);
    await useCategoriesStore().load();
    expect(backupApi.sync).not.toHaveBeenCalled();
  });

  it('does not trigger a sync for actions on stores outside the synced set', async () => {
    // The backup store's own actions (login/sync/restore/checkStatus) must
    // never re-trigger themselves through this same plugin — otherwise
    // login() succeeding would recursively kick off a sync loop.
    backupApi.login.mockResolvedValue({ ok: true });
    await useBackupStore().login('hunter2');
    expect(backupApi.sync).not.toHaveBeenCalled();
  });

  // WRITE_ACTIONS in syncPlugin.js is a hand-maintained list of string
  // literals with no structural link back to these stores' real method
  // names, and nothing in this repo (no lint rule, no shared constant)
  // would catch the two drifting apart. A future rename — e.g. debts.js's
  // pay -> recordPayment — would silently stop syncing after that one
  // action with nothing failing loudly. This table calls every real write
  // action on all four stores once each (categories.create is already
  // covered above) so a rename like that surfaces here as a named failure
  // instead of staying invisible.
  it.each([
    {
      label: 'categories.archive',
      setup: () => {
        categoriesDb.archiveCategory.mockResolvedValue(undefined);
        categoriesDb.listCategories.mockResolvedValue([]);
      },
      action: () => useCategoriesStore().archive('c1'),
    },
    {
      label: 'categories.remove',
      setup: () => {
        categoriesDb.deleteCategory.mockResolvedValue(undefined);
        categoriesDb.listCategories.mockResolvedValue([]);
        // categories.remove also reloads transactionsStore internally
        // (see categories.js) — that reload is itself a load(), so it must
        // not contribute a second sync, but it does need a resolved value
        // to avoid hanging.
        transactionsDb.listTransactions.mockResolvedValue([]);
      },
      action: () => useCategoriesStore().remove('c1'),
    },
    {
      label: 'transactions.create',
      setup: () => {
        transactionsDb.createTransaction.mockResolvedValue({
          id: 't1',
          amount: 100,
          date: '2026-07-01',
          categoryId: 'c1',
        });
      },
      action: () => useTransactionsStore().create({ amount: 100, date: '2026-07-01', categoryId: 'c1' }),
    },
    {
      label: 'transactions.update',
      setup: () => {
        transactionsDb.updateTransaction.mockResolvedValue({
          id: 't1',
          amount: 200,
          date: '2026-07-01',
          categoryId: 'c1',
        });
      },
      action: () => useTransactionsStore().update('t1', { amount: 200 }),
    },
    {
      label: 'transactions.remove',
      setup: () => {
        transactionsDb.deleteTransaction.mockResolvedValue(undefined);
      },
      action: () => useTransactionsStore().remove('t1'),
    },
    {
      label: 'budgetRates.setRate',
      setup: () => {
        budgetRatesDb.addRate.mockResolvedValue({ amount: 1000, effectiveFrom: '2026-07-29' });
        budgetRatesDb.listRates.mockResolvedValue([]);
      },
      action: () => useBudgetRatesStore().setRate(1000),
    },
    {
      label: 'debts.create',
      setup: () => {
        debtsDb.createDebt.mockResolvedValue({ id: 'd1', name: 'Андрей', amount: 5000, comment: '', direction: 'owed_to_me' });
      },
      action: () => useDebtsStore().create({ name: 'Андрей', amount: 5000, comment: '', direction: 'owed_to_me' }),
    },
    {
      label: 'debts.pay',
      setup: () => {
        debtsDb.addPayment.mockResolvedValue({ id: 'p1', debtId: 'd1', amount: 1000, date: '2026-07-29' });
      },
      action: () => useDebtsStore().pay('d1', 1000, '2026-07-29'),
    },
    {
      label: 'debts.remove',
      setup: () => {
        debtsDb.deleteDebt.mockResolvedValue(undefined);
      },
      action: () => useDebtsStore().remove('d1'),
    },
  ])('triggers a background sync after $label resolves', async ({ setup, action }) => {
    setup();
    const callsBefore = backupApi.sync.mock.calls.length;
    await action();
    expect(backupApi.sync.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

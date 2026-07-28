import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBackupStore } from './backup.js';
import { useCategoriesStore } from './categories.js';
import { useTransactionsStore } from './transactions.js';
import { useBudgetRatesStore } from './budgetRates.js';
import { useDebtsStore } from './debts.js';
import * as backupApi from '../api/backup.js';
import { restoreAllFromSnapshot } from '../db/restore.js';
import * as categoriesDb from '../db/categories.js';
import * as transactionsDb from '../db/transactions.js';
import * as ratesDb from '../db/budgetRates.js';
import * as debtsDb from '../db/debts.js';

vi.mock('../api/backup.js');
vi.mock('../db/restore.js');
vi.mock('../db/categories.js');
vi.mock('../db/transactions.js');
vi.mock('../db/budgetRates.js');
vi.mock('../db/debts.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorage.clear();
});

describe('backup store', () => {
  it('checkStatus reflects the server response', async () => {
    backupApi.status.mockResolvedValue({ loggedIn: true });
    const store = useBackupStore();
    expect(await store.checkStatus()).toBe(true);
    expect(store.loggedIn).toBe(true);
  });

  it('login sets loggedIn on success and guards against a double submit', async () => {
    let resolveLogin;
    backupApi.login.mockReturnValue(new Promise((r) => { resolveLogin = r; }));
    const store = useBackupStore();
    const first = store.login('hunter2');
    const second = store.login('hunter2'); // should be a no-op while the first is in flight
    resolveLogin({ ok: true });
    await Promise.all([first, second]);
    expect(backupApi.login).toHaveBeenCalledTimes(1);
    expect(store.loggedIn).toBe(true);
  });

  it('resets submitting after a failed login, so a retry is possible', async () => {
    backupApi.login.mockRejectedValue(new Error('Неверный пароль'));
    const store = useBackupStore();
    await expect(store.login('wrong')).rejects.toThrow('Неверный пароль');
    expect(store.submitting).toBe(false);
  });

  it('sync gathers a snapshot from every store and posts it, recording success', async () => {
    useCategoriesStore().items = [{ id: 'c1', name: 'Еда', emoji: '🍔', parentId: null, archived: false }];
    useTransactionsStore().items = [{ id: 't1', amount: 500, date: '2026-07-01', categoryId: 'c1' }];
    useBudgetRatesStore().segments = [{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }];
    useDebtsStore().items = [{ id: 'd1', name: 'Друг', amount: 1000, comment: '', direction: 'owed_to_me' }];
    useDebtsStore().payments = [{ id: 'p1', debtId: 'd1', amount: 200, date: '2026-07-01' }];
    backupApi.sync.mockResolvedValue(undefined);

    const store = useBackupStore();
    await store.sync();

    expect(backupApi.sync).toHaveBeenCalledWith({
      categories: useCategoriesStore().items,
      transactions: useTransactionsStore().items,
      budgetRates: useBudgetRatesStore().segments,
      debts: useDebtsStore().items,
      debtPayments: useDebtsStore().payments,
    });
    expect(store.lastSyncOk).toBe(true);
    expect(store.lastSyncAt).not.toBeNull();
  });

  it('sync never throws, even when the request fails — it just records the failure', async () => {
    backupApi.sync.mockRejectedValue(new Error('network down'));
    const store = useBackupStore();
    await expect(store.sync()).resolves.toBeUndefined();
    expect(store.lastSyncOk).toBe(false);
    expect(store.lastSyncAt).not.toBeNull();
  });

  it('sync status persists to localStorage and survives a fresh store instance', async () => {
    backupApi.sync.mockResolvedValue(undefined);
    await useBackupStore().sync();

    setActivePinia(createPinia()); // simulate a fresh page load
    const freshStore = useBackupStore();
    expect(freshStore.lastSyncOk).toBe(true);
    expect(freshStore.lastSyncAt).not.toBeNull();
  });

  it('restore pulls the snapshot, writes it locally, then reloads every store', async () => {
    const snapshot = { categories: [], transactions: [], budgetRates: [], debts: [], debtPayments: [] };
    backupApi.restore.mockResolvedValue(snapshot);

    await useBackupStore().restore();

    expect(restoreAllFromSnapshot).toHaveBeenCalledWith(snapshot);
    expect(categoriesDb.listCategories).toHaveBeenCalled();
    expect(transactionsDb.listTransactions).toHaveBeenCalled();
    expect(ratesDb.listRates).toHaveBeenCalled();
    expect(debtsDb.listDebts).toHaveBeenCalled();
    expect(debtsDb.listAllPayments).toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBackupStore } from './backup.js';
import { useCategoriesStore } from './categories.js';
import * as categoriesModule from './categories.js'; // namespace import so a single test below can spyOn its named export
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

  it('sync never rejects even if gathering the snapshot itself throws synchronously', async () => {
    const store = useBackupStore();
    // Makes the categories half of the snapshot-gathering object literal throw
    // synchronously, before backupApi.sync is ever called — this is a
    // different failure mode than the network-rejection test above (it
    // happens while *building* the request, not while awaiting it), and nothing
    // previously proved the try/catch in _performSync is scoped widely enough
    // to also catch this.
    const brokenAccessor = vi.spyOn(categoriesModule, 'useCategoriesStore').mockImplementation(() => {
      throw new Error('boom');
    });

    try {
      await expect(store.sync()).resolves.toBeUndefined();
      expect(store.lastSyncOk).toBe(false);
      expect(store.syncInFlight).toBe(false); // confirms the store isn't left wedged either
    } finally {
      brokenAccessor.mockRestore(); // must not leak a throwing useCategoriesStore into later tests
    }
  });

  it('sync status persists to localStorage and survives a fresh store instance', async () => {
    backupApi.sync.mockResolvedValue(undefined);
    await useBackupStore().sync();

    setActivePinia(createPinia()); // simulate a fresh page load
    const freshStore = useBackupStore();
    expect(freshStore.lastSyncOk).toBe(true);
    expect(freshStore.lastSyncAt).not.toBeNull();
  });

  it('coalesces overlapping sync calls into exactly one queued follow-up, not one per call', async () => {
    let resolveFirst;
    backupApi.sync.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
    backupApi.sync.mockResolvedValue(undefined); // the coalesced follow-up resolves immediately

    const store = useBackupStore();
    const first = store.sync();
    const second = store.sync(); // fired while the first is still in flight — must queue, not post a second request
    const third = store.sync(); // already queued — must not turn into a second queued follow-up

    // Nothing but the original request has actually gone out yet: overlapping
    // calls must not produce overlapping in-flight requests.
    expect(backupApi.sync).toHaveBeenCalledTimes(1);

    resolveFirst();
    await Promise.all([first, second, third]);

    // Exactly one queued follow-up ran once the first settled — not one per
    // overlapping call — and it still recorded status correctly, proving the
    // queued write wasn't silently dropped.
    expect(backupApi.sync).toHaveBeenCalledTimes(2);
    expect(store.lastSyncOk).toBe(true);
    expect(store.lastSyncAt).not.toBeNull();
    expect(store.syncInFlight).toBe(false);
    expect(store.syncQueued).toBe(false);
  });

  it('a sync() call arriving while the queued follow-up is itself still in flight gets its own follow-up too', async () => {
    // Proves the coalescing loop needs to be a `while`, not an `if`: a call
    // landing during the SECOND (already-queued) _performSync must still
    // schedule a third one, rather than being silently dropped once that
    // second call settles. Uses a signal promise (resolved the instant the
    // second backupApi.sync call actually fires) instead of guessing a
    // fixed number of microtask flushes — deterministic regardless of how
    // many internal await hops it takes to get there.
    let resolveFirst;
    let resolveSecond;
    let signalSecondCallStarted;
    const secondCallStarted = new Promise((resolve) => { signalSecondCallStarted = resolve; });

    backupApi.sync
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => {
        signalSecondCallStarted();
        return new Promise((r) => { resolveSecond = r; });
      })
      .mockResolvedValue(undefined);

    const store = useBackupStore();
    const first = store.sync();
    const second = store.sync(); // queues behind the first

    resolveFirst();
    await secondCallStarted; // the queued follow-up is now itself in flight

    // Arrives while that SECOND call is in flight. With `if (this.syncQueued)`
    // this would be dropped once the second call settles; only a `while`
    // loop re-checks the flag and fires a third request for it.
    const third = store.sync();

    resolveSecond();
    await Promise.all([first, second, third]);

    expect(backupApi.sync).toHaveBeenCalledTimes(3);
    expect(store.syncInFlight).toBe(false);
    expect(store.syncQueued).toBe(false);
  });

  it('a single sync call with nothing queued behind it fires exactly one request, same as before', async () => {
    backupApi.sync.mockResolvedValue(undefined);
    const store = useBackupStore();

    await store.sync();

    expect(backupApi.sync).toHaveBeenCalledTimes(1);
    expect(store.lastSyncOk).toBe(true);
    expect(store.syncInFlight).toBe(false);
    expect(store.syncQueued).toBe(false);
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

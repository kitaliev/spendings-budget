import { defineStore } from 'pinia';
import * as backupApi from '../api/backup.js';
import { restoreAllFromSnapshot } from '../db/restore.js';
import { useCategoriesStore } from './categories.js';
import { useTransactionsStore } from './transactions.js';
import { useBudgetRatesStore } from './budgetRates.js';
import { useDebtsStore } from './debts.js';

const STATUS_KEY = 'budget-app:last-sync-status';

// Sync status has to outlive a single page load to be useful — the whole
// point (decision #6) is surfacing a *silently* failing sync, which by
// definition isn't seen at the moment it happens. loggedIn is deliberately
// NOT persisted here: the session cookie is the real source of truth for
// that, and re-deriving it (checkStatus/login/sync's own reactions) avoids
// a stale locally-cached flag drifting from the cookie's actual validity.
function loadPersistedStatus() {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    return raw ? JSON.parse(raw) : { lastSyncAt: null, lastSyncOk: null };
  } catch {
    return { lastSyncAt: null, lastSyncOk: null };
  }
}

function persistStatus(status) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
}

export const useBackupStore = defineStore('backup', {
  state: () => ({
    loggedIn: null, // null = not yet checked this session
    ...loadPersistedStatus(),
    submitting: false,
  }),
  actions: {
    async checkStatus() {
      const { loggedIn } = await backupApi.status();
      this.loggedIn = loggedIn;
      return loggedIn;
    },
    async login(password) {
      if (this.submitting) return;
      this.submitting = true;
      try {
        await backupApi.login(password);
        this.loggedIn = true;
      } finally {
        this.submitting = false;
      }
    },
    // Silent by design (decision #6): called automatically after every
    // write via syncPlugin.js, never throws and never surfaces an error
    // directly — the Settings screen's own status line is the only place a
    // failure becomes visible.
    async sync() {
      try {
        await backupApi.sync({
          categories: useCategoriesStore().items,
          transactions: useTransactionsStore().items,
          budgetRates: useBudgetRatesStore().segments,
          debts: useDebtsStore().items,
          debtPayments: useDebtsStore().payments,
        });
        this.lastSyncOk = true;
      } catch {
        this.lastSyncOk = false;
      }
      this.lastSyncAt = new Date().toISOString();
      try {
        persistStatus({ lastSyncAt: this.lastSyncAt, lastSyncOk: this.lastSyncOk });
      } catch {
        // localStorage can throw (quota exceeded, Safari private browsing with
        // zero quota) — sync() must never throw regardless (decision #6), so a
        // failed persist just means the status won't survive a reload; the
        // in-memory lastSyncAt/lastSyncOk are still correct for this session.
      }
    },
    async restore() {
      const snapshot = await backupApi.restore();
      await restoreAllFromSnapshot(snapshot);
      // Known limitation, not fixed here: categoriesStore.load() and
      // budgetRatesStore.load() each call their own seedDefaultCategoryIfEmpty()/
      // seedDefaultRateIfEmpty() before listing — reused as-is since this task's
      // scope is the backup store, not those files. This means restoring a
      // genuinely-all-categories-deleted backup (reachable through ordinary,
      // already-shipped Phase 1 UI — CategoryTree's delete flow has no
      // don't-delete-the-last-one guard) will silently reseed a default
      // category that wasn't part of what was actually backed up.
      await Promise.all([
        useCategoriesStore().load(),
        useTransactionsStore().load(),
        useBudgetRatesStore().load(),
        useDebtsStore().load(),
      ]);
    },
  },
});

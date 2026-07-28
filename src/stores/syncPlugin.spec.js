import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { syncPlugin } from './syncPlugin.js';
import { useCategoriesStore } from './categories.js';
import { useTransactionsStore } from './transactions.js';
import { useBackupStore } from './backup.js';
import * as categoriesDb from '../db/categories.js';
import * as backupApi from '../api/backup.js';

vi.mock('../db/categories.js');
vi.mock('../db/transactions.js');
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
});

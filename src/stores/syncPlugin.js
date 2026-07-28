import { useBackupStore } from './backup.js';

const SYNCED_STORE_IDS = new Set(['categories', 'transactions', 'budgetRates', 'debts']);
const WRITE_ACTIONS = new Set(['create', 'update', 'archive', 'remove', 'setRate', 'pay']);

// Registered once in main.js via pinia.use(syncPlugin) — triggers a
// background sync to the backup server after every write action on any of
// the four data stores resolves, without needing to modify any of those
// stores directly (decision #6: automatic, after every write, silent).
// load() is deliberately absent from WRITE_ACTIONS: reading data should
// never itself cause a write to the server. The backup store itself is
// deliberately excluded from SYNCED_STORE_IDS — otherwise a successful
// login or sync would recursively trigger another sync.
export function syncPlugin({ store }) {
  if (!SYNCED_STORE_IDS.has(store.$id)) return;
  store.$onAction(({ name, after }) => {
    if (!WRITE_ACTIONS.has(name)) return;
    after(() => {
      useBackupStore().sync();
    });
  });
}

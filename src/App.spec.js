import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import App from './App.vue';
import { useToastStore } from './stores/toast.js';
import { useBackupStore } from './stores/backup.js';
import * as categoriesDb from './db/categories.js';
import * as ratesDb from './db/budgetRates.js';
import * as transactionsDb from './db/transactions.js';
import * as debtsDb from './db/debts.js';
import * as backupApi from './api/backup.js';
import * as restoreDb from './db/restore.js';

vi.mock('./db/categories.js');
vi.mock('./db/budgetRates.js');
vi.mock('./db/transactions.js');
vi.mock('./db/debts.js');
vi.mock('./api/backup.js');
vi.mock('./db/restore.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  categoriesDb.seedDefaultCategoryIfEmpty.mockResolvedValue(undefined);
  categoriesDb.listCategories.mockResolvedValue([]);
  ratesDb.seedDefaultRateIfEmpty.mockResolvedValue(undefined);
  ratesDb.listRates.mockResolvedValue([{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }]);
  transactionsDb.listTransactions.mockResolvedValue([
    { id: 't0', amount: 100, date: '2026-01-01', categoryId: 'c0' },
  ]);
  debtsDb.listDebts.mockResolvedValue([]);
  debtsDb.listAllPayments.mockResolvedValue([]);
  // Real (fake-indexeddb-backed) IndexedDB writes dispatch their completion
  // events as actual queued tasks, per spec — not microtasks — so unlike
  // every other db module mocked above, leaving this one real would mean
  // backupStore.restore()'s chain needs more macrotask ticks to settle than
  // a single `await flushPromises()` provides (confirmed by tracing: the
  // real restoreAllFromSnapshot() does eventually resolve, just well after
  // the assertions below already ran). Mocking it keeps this file testing
  // what it's meant to — App.vue's orchestration — fully microtask-based
  // like the rest of this suite; restoreAllFromSnapshot's actual behavior
  // against real IndexedDB is already exhaustively covered by db/restore.spec.js.
  restoreDb.restoreAllFromSnapshot.mockResolvedValue(undefined);
});

describe('App on launch', () => {
  it('loads every store on mount, exactly once', async () => {
    mount(App);
    await flushPromises();
    expect(categoriesDb.seedDefaultCategoryIfEmpty).toHaveBeenCalledTimes(1);
    expect(ratesDb.seedDefaultRateIfEmpty).toHaveBeenCalledTimes(1);
    expect(transactionsDb.listTransactions).toHaveBeenCalledTimes(1);
    expect(debtsDb.listDebts).toHaveBeenCalledTimes(1);
  });

  it('loads every store concurrently rather than one after another', async () => {
    let resolveCategories, resolveRates, resolveTransactions, resolveDebts;
    categoriesDb.seedDefaultCategoryIfEmpty.mockReturnValue(new Promise((r) => { resolveCategories = r; }));
    ratesDb.seedDefaultRateIfEmpty.mockReturnValue(new Promise((r) => { resolveRates = r; }));
    transactionsDb.listTransactions.mockReturnValue(new Promise((r) => { resolveTransactions = r; }));
    debtsDb.listDebts.mockReturnValue(new Promise((r) => { resolveDebts = r; }));

    mount(App);
    await flushPromises();
    // If these were awaited one at a time instead of via Promise.all, only
    // the first store's gating call would have been invoked by now — the
    // rest wouldn't even start until that first store's own load() (which
    // itself awaits a second db call after this one) had fully resolved.
    expect(categoriesDb.seedDefaultCategoryIfEmpty).toHaveBeenCalledTimes(1);
    expect(ratesDb.seedDefaultRateIfEmpty).toHaveBeenCalledTimes(1);
    expect(transactionsDb.listTransactions).toHaveBeenCalledTimes(1);
    expect(debtsDb.listDebts).toHaveBeenCalledTimes(1);

    resolveCategories(undefined);
    resolveRates(undefined);
    resolveTransactions([]);
    resolveDebts([]);
    await flushPromises();
  });

  it('shows a loading state until every store resolves, then the dashboard', async () => {
    let resolveCategories;
    categoriesDb.listCategories.mockReturnValue(new Promise((r) => { resolveCategories = r; }));
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find('.app-shell__loading').exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'BudgetDashboard' }).exists()).toBe(false);

    resolveCategories([]);
    await flushPromises();
    expect(wrapper.find('.app-shell__loading').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'BudgetDashboard' }).exists()).toBe(true);
  });

  it('shows a toast and still leaves the loading state if a store fails to load', async () => {
    categoriesDb.listCategories.mockRejectedValue(new Error('IndexedDB blocked'));
    const wrapper = mount(App);
    await flushPromises();
    expect(useToastStore().message).toBe('Не удалось загрузить данные. Перезапустите приложение.');
    // Doesn't get stuck on the loading screen forever...
    expect(wrapper.find('.app-shell__loading').exists()).toBe(false);
    // ...but also doesn't force the always-on-launch modal open onto broken data.
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(false);
  });

  it('shows the expense modal immediately, unprompted', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('starts on the Бюджет tab', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.findComponent({ name: 'BudgetDashboard' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'DebtsScreen' }).exists()).toBe(false);
  });

  it('renders a message from the toast store', async () => {
    const wrapper = mount(App);
    await flushPromises();
    useToastStore().show('Тест');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'Toast' }).props('message')).toBe('Тест');
  });
});

describe('App navigation', () => {
  it('switches to the Долги screen when that tab is selected', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.findComponent({ name: 'TabBar' }).vm.$emit('update:active-tab', 'debts');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'DebtsScreen' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'BudgetDashboard' }).exists()).toBe(false);
  });

  it('reopens the expense modal from the FAB after it was closed', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.findComponent({ name: 'ExpenseModal' }).vm.$emit('close');
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(false);
    await wrapper.findComponent({ name: 'TabBar' }).vm.$emit('add-expense');
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('opens the settings overlay from the dashboard gear icon and closes it again', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.findComponent({ name: 'BudgetDashboard' }).vm.$emit('open-settings');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(true);
    expect(wrapper.find('.app-shell__settings-close').attributes('type')).toBe('button');
    await wrapper.find('.app-shell__settings-close').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(false);
  });

  it('makes the covered dashboard/tabs inert while the settings overlay is open, so a keyboard user cannot reach hidden controls underneath it', async () => {
    // happy-dom doesn't implement the `inert` IDL property on HTMLElement,
    // so Vue can't shortcut this binding through the property path the way
    // it does for e.g. `disabled` — it falls back to a literal string
    // attribute ("true"/"false") instead of omitting/adding a bare `inert`.
    // Real Chrome does implement the property and was already used (via
    // Puppeteer, for CategoryTree's identical pattern) to prove the actual
    // focus-blocking behavior works; this test only guards the binding
    // expression itself against regressing.
    const wrapper = mount(App);
    await flushPromises();
    // The always-on-launch expense modal is itself an inert-triggering
    // overlay now (see the next test) — close it first so this test's
    // baseline genuinely has nothing covering the dashboard/tabs.
    await wrapper.findComponent({ name: 'ExpenseModal' }).vm.$emit('close');
    expect(wrapper.find('.app-shell__content').attributes('inert')).toBe('false');
    expect(wrapper.find('.app-shell__tabs').attributes('inert')).toBe('false');

    await wrapper.findComponent({ name: 'BudgetDashboard' }).vm.$emit('open-settings');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.app-shell__content').attributes('inert')).toBe('true');
    expect(wrapper.find('.app-shell__tabs').attributes('inert')).toBe('true');

    await wrapper.find('.app-shell__settings-close').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.app-shell__content').attributes('inert')).toBe('false');
    expect(wrapper.find('.app-shell__tabs').attributes('inert')).toBe('false');
  });

  it('also makes the dashboard/tabs inert while the expense modal is open, so a background TransactionList row cannot be reached and silently swap the in-progress edit', async () => {
    const wrapper = mount(App);
    await flushPromises();
    // showExpenseModal starts true (the always-on-launch modal) — assert
    // that alone already makes the background inert, then confirm closing
    // it clears that, independently of the settings-overlay condition.
    expect(wrapper.find('.app-shell__content').attributes('inert')).toBe('true');
    expect(wrapper.find('.app-shell__tabs').attributes('inert')).toBe('true');

    await wrapper.findComponent({ name: 'ExpenseModal' }).vm.$emit('close');
    expect(wrapper.find('.app-shell__content').attributes('inert')).toBe('false');
    expect(wrapper.find('.app-shell__tabs').attributes('inert')).toBe('false');

    await wrapper.findComponent({ name: 'TabBar' }).vm.$emit('add-expense');
    expect(wrapper.find('.app-shell__content').attributes('inert')).toBe('true');
    expect(wrapper.find('.app-shell__tabs').attributes('inert')).toBe('true');
  });
});

describe('App — editing a transaction from the dashboard list', () => {
  it('opens the expense modal in edit mode with the selected transaction', async () => {
    const wrapper = mount(App);
    await flushPromises();
    // Closed first, on purpose: created() already flips showExpenseModal to
    // true unconditionally (the always-on-launch modal), so without this the
    // visible === true assertion below would pass even if openEditModal did
    // nothing at all — it would just be reading the launch-time state back.
    // Closing first forces the assertion to only pass if edit-transaction
    // itself reopens the modal.
    await wrapper.findComponent({ name: 'ExpenseModal' }).vm.$emit('close');
    const transaction = { id: 't1', date: '2026-07-05', amount: 500, categoryId: 'food' };
    await wrapper.findComponent({ name: 'BudgetDashboard' }).vm.$emit('edit-transaction', transaction);
    await wrapper.vm.$nextTick();
    const modal = wrapper.findComponent({ name: 'ExpenseModal' });
    expect(modal.props('visible')).toBe(true);
    expect(modal.props('editingTransaction')).toEqual(transaction);
  });

  it('clears editingTransaction after the modal closes, so the next FAB tap starts a fresh entry', async () => {
    const wrapper = mount(App);
    await flushPromises();
    const transaction = { id: 't1', date: '2026-07-05', amount: 500, categoryId: 'food' };
    await wrapper.findComponent({ name: 'BudgetDashboard' }).vm.$emit('edit-transaction', transaction);
    await wrapper.findComponent({ name: 'ExpenseModal' }).vm.$emit('close');
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('editingTransaction')).toBeNull();
  });
});

describe('App — restore prompt on an empty launch', () => {
  it('shows a restore prompt instead of the expense modal when there is no local data', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find('.restore-prompt').exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(false);
  });

  it('does not show a restore prompt when there is already local data', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find('.restore-prompt').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('restores from the server and opens the expense modal when confirmed while already logged in', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    backupApi.status.mockResolvedValue({ loggedIn: true });
    backupApi.restore.mockResolvedValue({
      categories: [], transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__confirm').trigger('click');
    await flushPromises();
    expect(backupApi.restore).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.restore-prompt').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('opens Settings instead of restoring when confirmed while not logged in, reusing its login form rather than a second one', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    backupApi.status.mockResolvedValue({ loggedIn: false });
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__confirm').trigger('click');
    await flushPromises();
    expect(backupApi.restore).not.toHaveBeenCalled();
    expect(wrapper.find('.restore-prompt').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(true);
  });

  it('dismisses the prompt and opens the expense modal without restoring, when declined', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__dismiss').trigger('click');
    expect(backupApi.restore).not.toHaveBeenCalled();
    expect(wrapper.find('.restore-prompt').exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('completes the restore automatically when Settings is closed after logging in mid-restore-attempt', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    backupApi.status.mockResolvedValue({ loggedIn: false });
    backupApi.restore.mockResolvedValue({
      categories: [], transactions: [], budgetRates: [], debts: [], debtPayments: [],
    });
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__confirm').trigger('click');
    await flushPromises();
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(true);

    // Simulate a successful login having happened while Settings was open
    // (SettingsScreen's own login form, built in Task 18, is what would
    // really flip this in production — not re-tested here, since that's
    // already covered by SettingsScreen.spec.js).
    useBackupStore().loggedIn = true;
    await wrapper.find('.app-shell__settings-close').trigger('click');
    await flushPromises();

    expect(backupApi.restore).toHaveBeenCalledTimes(1);
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('does not attempt a restore when Settings is closed without having logged in', async () => {
    transactionsDb.listTransactions.mockResolvedValue([]);
    backupApi.status.mockResolvedValue({ loggedIn: false });
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.find('.restore-prompt__confirm').trigger('click');
    await flushPromises();

    await wrapper.find('.app-shell__settings-close').trigger('click');
    await flushPromises();

    expect(backupApi.restore).not.toHaveBeenCalled();
    expect(wrapper.findComponent({ name: 'ExpenseModal' }).props('visible')).toBe(true);
  });

  it('closing Settings normally (never having attempted a restore) does not trigger one', async () => {
    // Regression guard for resumeRestoreAfterLogin's default: opening
    // Settings via the ordinary gear icon (not via the restore prompt)
    // must not accidentally restore on close.
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.findComponent({ name: 'BudgetDashboard' }).vm.$emit('open-settings');
    await wrapper.vm.$nextTick();
    await wrapper.find('.app-shell__settings-close').trigger('click');
    await flushPromises();
    expect(backupApi.restore).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import App from './App.vue';
import { useToastStore } from './stores/toast.js';
import * as categoriesDb from './db/categories.js';
import * as ratesDb from './db/budgetRates.js';
import * as transactionsDb from './db/transactions.js';
import * as debtsDb from './db/debts.js';

vi.mock('./db/categories.js');
vi.mock('./db/budgetRates.js');
vi.mock('./db/transactions.js');
vi.mock('./db/debts.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  categoriesDb.seedDefaultCategoryIfEmpty.mockResolvedValue(undefined);
  categoriesDb.listCategories.mockResolvedValue([]);
  ratesDb.seedDefaultRateIfEmpty.mockResolvedValue(undefined);
  ratesDb.listRates.mockResolvedValue([{ id: 'r1', amount: 2500, effectiveFrom: '2026-01-01' }]);
  transactionsDb.listTransactions.mockResolvedValue([]);
  debtsDb.listDebts.mockResolvedValue([]);
  debtsDb.listAllPayments.mockResolvedValue([]);
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
});

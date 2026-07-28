import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import App from './App.vue';
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
  it('loads every store on mount', async () => {
    mount(App);
    await flushPromises();
    expect(categoriesDb.seedDefaultCategoryIfEmpty).toHaveBeenCalled();
    expect(ratesDb.seedDefaultRateIfEmpty).toHaveBeenCalled();
    expect(transactionsDb.listTransactions).toHaveBeenCalled();
    expect(debtsDb.listDebts).toHaveBeenCalled();
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
    await wrapper.find('.app-shell__settings-close').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'SettingsScreen' }).exists()).toBe(false);
  });
});

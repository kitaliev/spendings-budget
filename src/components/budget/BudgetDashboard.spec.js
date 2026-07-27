import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import BudgetDashboard from './BudgetDashboard.vue';
import { useBudgetRatesStore } from '../../stores/budgetRates.js';
import { useTransactionsStore } from '../../stores/transactions.js';
import { useCategoriesStore } from '../../stores/categories.js';

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 27)); // 27 July 2026

  useBudgetRatesStore().segments = [{ amount: 2500, effectiveFrom: '2026-01-01' }];
  useCategoriesStore().items = [{ id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false }];
  useTransactionsStore().items = [
    { date: '2026-07-05', amount: 20000, categoryId: 'food' },
    { date: '2026-03-05', amount: 80100, categoryId: 'food' }, // pushes March into overspend
  ];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BudgetDashboard on the current month', () => {
  it('shows the live "Бюджет на сегодня" label', () => {
    const wrapper = mount(BudgetDashboard);
    expect(wrapper.find('.budget-dashboard__hero-label').text()).toBe('Бюджет на сегодня');
  });

  it("computes today's available balance from the budget store", () => {
    const wrapper = mount(BudgetDashboard);
    // 2500 * 27 elapsed days - 20000 spent = 47500
    expect(wrapper.find('.budget-dashboard__hero-value').text()).toBe('47 500 ₽');
  });

  it('disables the next-month arrow — cannot navigate into the future', () => {
    const wrapper = mount(BudgetDashboard);
    expect(wrapper.find('.month-nav__arrow--next').attributes('disabled')).toBeDefined();
  });
});

describe('BudgetDashboard navigation to a past month', () => {
  it('relabels the hero and shows the end-of-month balance, negative when overspent', async () => {
    const wrapper = mount(BudgetDashboard);
    for (let i = 0; i < 4; i += 1) await wrapper.find('.month-nav__arrow--prev').trigger('click'); // Jul -> Mar
    expect(wrapper.find('.budget-dashboard__hero-label').text()).toBe('Остаток на конец месяца');
    // 2500 * 31 - 80100 = -2600
    expect(wrapper.find('.budget-dashboard__hero-value').text()).toBe('−2 600 ₽');
    expect(wrapper.find('.budget-dashboard__hero-value').classes()).toContain('budget-dashboard__hero-value--negative');
  });

  it('re-enables the next arrow once navigated away from the current month', async () => {
    const wrapper = mount(BudgetDashboard);
    await wrapper.find('.month-nav__arrow--prev').trigger('click');
    expect(wrapper.find('.month-nav__arrow--next').attributes('disabled')).toBeUndefined();
  });

  it('jumps to the clicked month when a MonthChart column is clicked', async () => {
    const wrapper = mount(BudgetDashboard);
    const marchColumn = wrapper.findAll('.month-chart__col')[2]; // Jan=0, Feb=1, Mar=2
    await marchColumn.trigger('click');
    expect(wrapper.find('.budget-dashboard__hero-value').text()).toBe('−2 600 ₽');
  });
});

describe('BudgetDashboard settings access', () => {
  it('emits open-settings when the gear icon is clicked', async () => {
    const wrapper = mount(BudgetDashboard);
    await wrapper.find('.budget-dashboard__settings').trigger('click');
    expect(wrapper.emitted('open-settings')).toHaveLength(1);
  });
});

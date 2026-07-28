import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import TransactionList from './TransactionList.vue';
import { useCategoriesStore } from '../../stores/categories.js';
import { useTransactionsStore } from '../../stores/transactions.js';

beforeEach(() => {
  setActivePinia(createPinia());
  useCategoriesStore().items = [{ id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false }];
  useTransactionsStore().items = [
    { id: 't1', date: '2026-07-05', amount: 500, categoryId: 'food' },
    { id: 't2', date: '2026-07-20', amount: 1200, categoryId: 'food' },
    { id: 't3', date: '2026-06-01', amount: 999, categoryId: 'food' },
  ];
});

describe('TransactionList', () => {
  it('lists only transactions within the given month, most recent first', () => {
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-07' } });
    const rows = wrapper.findAll('.transaction-list__row');
    expect(rows).toHaveLength(2);
    expect(rows[0].find('.transaction-list__amount').text()).toBe('1 200 ₽');
  });

  it('shows the category emoji and name', () => {
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-07' } });
    expect(wrapper.findAll('.transaction-list__row')[0].text()).toContain('🍔');
    expect(wrapper.findAll('.transaction-list__row')[0].text()).toContain('Еда');
  });

  it('shows an empty state when there are no transactions that month', () => {
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-01' } });
    expect(wrapper.find('.transaction-list__empty').exists()).toBe(true);
  });

  it('emits edit with the transaction when a row is tapped', async () => {
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-07' } });
    await wrapper.findAll('.transaction-list__row')[0].trigger('click');
    expect(wrapper.emitted('edit')[0][0]).toMatchObject({ id: 't2' });
  });

  it('falls back to a placeholder emoji and label when a transaction has no matching category', () => {
    useTransactionsStore().items = [
      { id: 't4', date: '2026-07-10', amount: 300, categoryId: 'missing' },
    ];
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-07' } });
    const row = wrapper.find('.transaction-list__row');
    expect(row.text()).toContain('❓');
    expect(row.text()).toContain('Без категории');
  });

  it('keeps a stable, defined order for same-day transactions instead of reversing them', () => {
    // a.date < b.date ? 1 : -1 (the original comparator) claims a < b AND
    // b < a for equal dates simultaneously — not a valid comparator, and
    // proven to reverse equal-date runs rather than leave them stable.
    useTransactionsStore().items = [
      { id: 'a', date: '2026-07-15', amount: 100, categoryId: 'food' },
      { id: 'b', date: '2026-07-15', amount: 200, categoryId: 'food' },
      { id: 'c', date: '2026-07-15', amount: 300, categoryId: 'food' },
    ];
    const wrapper = mount(TransactionList, { props: { monthKey: '2026-07' } });
    const rows = wrapper.findAll('.transaction-list__row');
    expect(rows.map((r) => r.find('.transaction-list__amount').text())).toEqual(['100 ₽', '200 ₽', '300 ₽']);
  });
});

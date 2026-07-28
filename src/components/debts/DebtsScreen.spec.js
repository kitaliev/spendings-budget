import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import DebtsScreen from './DebtsScreen.vue';
import { useDebtsStore } from '../../stores/debts.js';

beforeEach(() => {
  setActivePinia(createPinia());
  const store = useDebtsStore();
  store.items = [
    { id: 'd1', name: 'Андрей', amount: 15000, comment: '', direction: 'owed_to_me' },
    { id: 'd2', name: 'Максим', amount: 1200, comment: '', direction: 'owed_to_me' },
    { id: 'd3', name: 'Ипотека', amount: 200000, comment: '', direction: 'i_owe' },
  ];
  store.payments = [{ id: 'p1', debtId: 'd2', amount: 1200, date: '2026-06-10' }]; // fully pays off d2
});

describe('DebtsScreen', () => {
  it('defaults to "Мне должны" and lists only open debts in that direction', () => {
    const wrapper = mount(DebtsScreen);
    const names = wrapper.findAll('.debt-card__name').map((n) => n.text());
    expect(names).toEqual(['Андрей']);
  });

  it('switches direction when the other segment is clicked', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.findAll('.segmented__opt')[1].trigger('click');
    const names = wrapper.findAll('.debt-card__name').map((n) => n.text());
    expect(names).toEqual(['Ипотека']);
  });

  it('shows the closed count and keeps the list collapsed by default', () => {
    const wrapper = mount(DebtsScreen);
    expect(wrapper.find('.closed-toggle').text()).toContain('1');
    expect(wrapper.find('.closed-list').exists()).toBe(false);
  });

  it('expands the closed list when the toggle is clicked', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.closed-toggle').trigger('click');
    expect(wrapper.find('.closed-card__name').text()).toBe('Максим');
  });

  it('reflects the collapsed/expanded state via aria-expanded', async () => {
    const wrapper = mount(DebtsScreen);
    expect(wrapper.find('.closed-toggle').attributes('aria-expanded')).toBe('false');
    await wrapper.find('.closed-toggle').trigger('click');
    expect(wrapper.find('.closed-toggle').attributes('aria-expanded')).toBe('true');
  });
});

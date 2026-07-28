import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import DebtsScreen from './DebtsScreen.vue';
import { useDebtsStore } from '../../stores/debts.js';
import * as debtsDb from '../../db/debts.js';

vi.mock('../../db/debts.js');

beforeEach(() => {
  setActivePinia(createPinia());
  // vi.mock('../../db/debts.js') above is an auto-mock shared across every
  // test in this file — its call history otherwise accumulates test-to-test,
  // which would make the "adding a debt" tests below (several of which assert
  // not.toHaveBeenCalled()/toHaveBeenCalledTimes(1)) see calls left over from
  // earlier tests. Same fix already used in ExpenseModal.spec.js for the same
  // reason.
  vi.clearAllMocks();
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

  it('marks the active segment with aria-current', async () => {
    const wrapper = mount(DebtsScreen);
    const opts = wrapper.findAll('.segmented__opt');
    expect(opts[0].attributes('aria-current')).toBe('true');
    expect(opts[1].attributes('aria-current')).toBeUndefined();
    await opts[1].trigger('click');
    expect(opts[0].attributes('aria-current')).toBeUndefined();
    expect(opts[1].attributes('aria-current')).toBe('true');
  });

  it('re-filters the closed list too when direction switches, not just the open one', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.findAll('.segmented__opt')[1].trigger('click'); // -> i_owe, which has no closed debts
    expect(wrapper.find('.closed-toggle').exists()).toBe(false);
  });

  it('shows the closed count and keeps the list collapsed by default', () => {
    const wrapper = mount(DebtsScreen);
    expect(wrapper.find('.closed-toggle').text()).toContain('1');
    expect(wrapper.find('.closed-list').exists()).toBe(false);
  });

  it('hides the closed-toggle entirely when there are no closed debts, rather than showing a dead-end "Закрытые (0)"', () => {
    const store = useDebtsStore();
    store.payments = []; // nothing paid off -> nothing closed, in either direction
    const wrapper = mount(DebtsScreen);
    expect(wrapper.find('.closed-toggle').exists()).toBe(false);
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

describe('DebtsScreen — adding a debt', () => {
  it('reveals a form when the add toggle is tapped', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    expect(wrapper.find('.debts-screen__add-form').exists()).toBe(true);
  });

  it('creates a debt with the currently active segment as its direction', async () => {
    debtsDb.createDebt.mockResolvedValue({ id: 'd4', name: 'Олег', amount: 500, comment: '', direction: 'owed_to_me' });
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-name').setValue('Олег');
    await wrapper.find('.debts-screen__add-amount').setValue('500');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    expect(debtsDb.createDebt).toHaveBeenCalledWith(expect.objectContaining({ direction: 'owed_to_me' }));
  });

  it('creates with the other direction after switching segments', async () => {
    debtsDb.createDebt.mockResolvedValue({ id: 'd5', name: 'Кредит', amount: 1000, comment: '', direction: 'i_owe' });
    const wrapper = mount(DebtsScreen);
    await wrapper.findAll('.segmented__opt')[1].trigger('click'); // switch to "Я должен"
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-name').setValue('Кредит');
    await wrapper.find('.debts-screen__add-amount').setValue('1000');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    expect(debtsDb.createDebt).toHaveBeenCalledWith(expect.objectContaining({ direction: 'i_owe' }));
  });

  it('does not submit without a name or a positive amount', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    expect(debtsDb.createDebt).not.toHaveBeenCalled();
  });

  it('rejects an amount of zero, the exact edge case that surfaced this gap', async () => {
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-name').setValue('Тест');
    await wrapper.find('.debts-screen__add-amount').setValue('0');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    expect(debtsDb.createDebt).not.toHaveBeenCalled();
  });

  it('closes the form after a successful submission', async () => {
    debtsDb.createDebt.mockResolvedValue({ id: 'd6', name: 'X', amount: 100, comment: '', direction: 'owed_to_me' });
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-name').setValue('X');
    await wrapper.find('.debts-screen__add-amount').setValue('100');
    await wrapper.find('.debts-screen__add-form').trigger('submit');
    // submitAdd -> debtsStore.create -> debtsDb.createDebt is two awaits deep
    // before addingOpen is reset — same shape as ExpenseModal's commit chain,
    // where a single trigger()-implied nextTick() doesn't reliably drain it.
    await flushPromises();
    expect(wrapper.find('.debts-screen__add-form').exists()).toBe(false);
  });

  it('reflects the add-form open/closed state via aria-expanded on the toggle', async () => {
    const wrapper = mount(DebtsScreen);
    const toggle = wrapper.find('.debts-screen__add-toggle');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
  });

  it('ignores a second submit while the first debt creation is still in flight', async () => {
    let resolveCreate;
    debtsDb.createDebt.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(DebtsScreen);
    await wrapper.find('.debts-screen__add-toggle').trigger('click');
    await wrapper.find('.debts-screen__add-name').setValue('Олег');
    await wrapper.find('.debts-screen__add-amount').setValue('500');
    const form = wrapper.find('.debts-screen__add-form');
    await form.trigger('submit');
    await form.trigger('submit');
    resolveCreate({ id: 'd7', name: 'Олег', amount: 500, comment: '', direction: 'owed_to_me' });
    await flushPromises();
    expect(debtsDb.createDebt).toHaveBeenCalledTimes(1);
  });
});

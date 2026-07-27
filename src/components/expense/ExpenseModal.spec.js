import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ExpenseModal from './ExpenseModal.vue';
import { useCategoriesStore } from '../../stores/categories.js';
import * as transactionsDb from '../../db/transactions.js';

vi.mock('../../db/transactions.js');

function findKey(wrapper, label) {
  return wrapper.findAll('.keypad__key').find((b) => b.text() === label);
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  useCategoriesStore().items = [
    { id: 'fun', name: 'Развлечения', emoji: '🎬', parentId: null, archived: false },
  ];
});

describe('ExpenseModal — adding a new expense', () => {
  it('builds the amount from keypad taps and shows it live', async () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    for (const key of ['1', '2', '4', '0']) {
      await findKey(wrapper, key).trigger('click');
    }
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('1240');
  });

  it('commits the evaluated amount when a leaf category is tapped', async () => {
    transactionsDb.createTransaction.mockResolvedValue({ id: 't1', amount: 1240, date: '2026-07-27', categoryId: 'fun' });
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    for (const key of ['1', '2', '4', '0']) await findKey(wrapper, key).trigger('click');
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1240, categoryId: 'fun' })
    );
  });

  it('does nothing when a category is tapped with no amount entered', async () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects an amount that evaluates to zero or negative, without touching the store', async () => {
    // "5−10" is ordinary keypad input (not a leading/consecutive operator) that
    // evaluates to a negative number — must be rejected before it ever reaches
    // transactionsStore.create.
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    for (const key of ['5', '−', '1', '0']) await findKey(wrapper, key).trigger('click');
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.createTransaction).not.toHaveBeenCalled();
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('5−10'); // left as typed, not silently cleared
  });

  it('resets the amount after a successful commit and stays open', async () => {
    transactionsDb.createTransaction.mockResolvedValue({ id: 't1', amount: 500, date: '2026-07-27', categoryId: 'fun' });
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    await wrapper.find('.category-picker__row').trigger('click');
    // The commit chain is two awaits deep (commit -> transactionsStore.create
    // -> transactionsDb.createTransaction) before `raw` gets reset — a single
    // $nextTick() doesn't reliably drain that; flushPromises() (a macrotask)
    // does, same as the "ignores a second tap" case below.
    await flushPromises();
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('0');
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('ignores a second tap on the same category while the first commit is still in flight', async () => {
    // The picker only resets after the store write resolves, so the exact
    // same leaf row is still on screen — and still tappable — for the
    // entire await gap. A fast double-tap there must not create the
    // transaction twice.
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    const row = wrapper.find('.category-picker__row');
    await row.trigger('click');
    await row.trigger('click');
    resolveCreate({ id: 't1', amount: 500, date: '2026-07-27', categoryId: 'fun' });
    await flushPromises();
    expect(transactionsDb.createTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('ExpenseModal — editing an existing expense', () => {
  const editingTransaction = { id: 't1', amount: 750, date: '2026-07-10', categoryId: 'fun' };

  it('pre-fills the amount from the transaction being edited', () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction } });
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('750');
  });

  it('shows a Delete button that removes the transaction and closes', async () => {
    transactionsDb.deleteTransaction.mockResolvedValue(undefined);
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction } });
    await wrapper.find('.expense-modal__delete').trigger('click');
    // onDelete -> transactionsStore.remove -> transactionsDb.deleteTransaction
    // is two awaits deep before close() fires; see flushPromises note above.
    await flushPromises();
    expect(transactionsDb.deleteTransaction).toHaveBeenCalledWith('t1');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('closes after committing an edit', async () => {
    transactionsDb.updateTransaction.mockResolvedValue(editingTransaction);
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction } });
    await wrapper.find('.category-picker__row').trigger('click');
    await flushPromises();
    expect(transactionsDb.updateTransaction).toHaveBeenCalledWith('t1', expect.objectContaining({ amount: 750 }));
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

describe('ExpenseModal — dismissing', () => {
  it('emits close when the × button is clicked', async () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await wrapper.find('.expense-modal__close').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

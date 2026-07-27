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

  it('rounds an amount that does not evaluate to a whole number', async () => {
    // Splitting a shared cost (e.g. "1000÷3") is ordinary use of a
    // calculator-style amount field — the stored/committed amount must not
    // carry raw float noise.
    transactionsDb.createTransaction.mockResolvedValue({ id: 't1', amount: 333, date: '2026-07-27', categoryId: 'fun' });
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    for (const key of ['1', '0', '0', '0', '÷', '3']) await findKey(wrapper, key).trigger('click');
    await wrapper.find('.category-picker__row').trigger('click');
    expect(transactionsDb.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ amount: 333 }));
  });

  it('replaces a pending operator when a different one is tapped, instead of ignoring the new tap', async () => {
    // Matches calculator.js's own normalize(), built specifically to
    // collapse consecutive operators to the most recent one (the "changed
    // my mind" convention) — this is the only real caller of that function.
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    await findKey(wrapper, '+').trigger('click');
    await findKey(wrapper, '×').trigger('click');
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('5×');
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

  it('ignores keypad taps while a commit is still in flight, instead of merging with the stale reset', async () => {
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    await wrapper.find('.category-picker__row').trigger('click'); // commit in flight
    await findKey(wrapper, '7').trigger('click'); // typing during the gap — must be a no-op
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('5');
    resolveCreate({ id: 't1', amount: 5, date: '2026-07-27', categoryId: 'fun' });
    await flushPromises();
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('0'); // clean reset, no leftover "7"
  });
});

describe('ExpenseModal — stale in-flight writes (App.vue keeps one persistent instance and only swaps props)', () => {
  it('does not apply a stale commit\'s reset once a different session has taken over', async () => {
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    await wrapper.find('.category-picker__row').trigger('click'); // add-mode commit in flight

    const otherTransaction = { id: 't9', amount: 300, date: '2026-07-01', categoryId: 'fun' };
    await wrapper.setProps({ editingTransaction: otherTransaction });

    resolveCreate({ id: 't1', amount: 5, date: '2026-07-27', categoryId: 'fun' });
    await flushPromises();
    // The now-active edit session's pre-filled amount must survive untouched.
    expect(wrapper.find('.expense-modal__entry-value').text()).toBe('300');
  });

  it('does not crash resolving a commit after the sheet was closed mid-write', async () => {
    // Awaits commit()'s own returned promise directly (rather than going
    // through the DOM event + flushPromises) so a thrown error surfaces as
    // this assertion failing, not as a side-channel "unhandled rejection"
    // that a plain flushPromises()-based test would silently let through.
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    const commitPromise = wrapper.vm.commit({ id: 'fun', name: 'Развлечения', emoji: '🎬' });
    await wrapper.setProps({ visible: false }); // sheet, and CategoryPicker with it, unmounts

    resolveCreate({ id: 't1', amount: 5, date: '2026-07-27', categoryId: 'fun' });
    await expect(commitPromise).resolves.toBeUndefined();
  });

  it('does not clobber a date the user already picked for the next entry while a stale commit is still resolving', async () => {
    let resolveCreate;
    transactionsDb.createTransaction.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    await findKey(wrapper, '5').trigger('click');
    const commitPromise = wrapper.vm.commit({ id: 'fun', name: 'Развлечения', emoji: '🎬' });
    // DatePicker's own change handler is blocked by nothing during this gap
    // (only the keypad is guarded) — simulate the user picking "Вчера" for
    // whatever they type next, before the stale commit resolves.
    await wrapper.findComponent({ name: 'DatePicker' }).vm.$emit('update:modelValue', '2026-07-26');

    resolveCreate({ id: 't1', amount: 5, date: '2026-07-27', categoryId: 'fun' });
    await commitPromise;
    expect(wrapper.vm.date).toBe('2026-07-26');
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

  it('still closes when the store swaps editingTransaction for a same-id, different-reference object mid-write', async () => {
    // transactionsStore.update() replaces the item in its own array with a
    // new object (`this.items[index] = updated`) — if a future App.vue ever
    // derives editingTransaction reactively from that array, the prop
    // reference changes even though it's still logically the same edit
    // session. Comparing by id (not `===`) is what keeps close() firing.
    let resolveUpdate;
    transactionsDb.updateTransaction.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction } });
    const commitPromise = wrapper.vm.commit({ id: 'fun', name: 'Развлечения', emoji: '🎬' });
    const sameIdNewReference = { id: 't1', amount: 750, date: '2026-07-10', categoryId: 'fun' };
    await wrapper.setProps({ editingTransaction: sameIdNewReference });

    resolveUpdate(sameIdNewReference);
    await commitPromise;
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

describe('ExpenseModal — accessibility', () => {
  it('carries dialog semantics for assistive tech, since it is a full-screen modal sheet', () => {
    const wrapper = mount(ExpenseModal, { props: { visible: true, editingTransaction: null } });
    const dialog = wrapper.find('.expense-modal');
    expect(dialog.attributes('role')).toBe('dialog');
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBe('expense-modal-title');
  });
});

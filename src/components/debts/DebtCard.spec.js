import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import DebtCard from './DebtCard.vue';
import { useDebtsStore } from '../../stores/debts.js';

const debt = { id: 'd1', name: 'Андрей — ремонт', amount: 15000, comment: 'занял на инструменты', direction: 'owed_to_me' };

beforeEach(() => {
  setActivePinia(createPinia());
  const store = useDebtsStore();
  store.items = [debt];
  store.payments = [{ id: 'p1', debtId: 'd1', amount: 5000, date: '02.07.2026' }];
});

describe('DebtCard', () => {
  it('shows the remaining balance, not the original amount, as the headline figure', () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    expect(wrapper.find('.debt-card__amount').text()).toBe('10 000 ₽');
  });

  it('shows the paid percentage and the original total', () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    expect(wrapper.find('.debt-card__meta').text()).toContain('33%');
    expect(wrapper.find('.debt-card__meta').text()).toContain('15 000 ₽');
  });

  it('hides payment history until the card is tapped open', () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    expect(wrapper.find('.debt-card__detail').exists()).toBe(false);
  });

  it('shows payment history after tapping the card', async () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    await wrapper.find('.debt-card__top').trigger('click');
    expect(wrapper.find('.debt-card__hist-row').text()).toContain('02.07.2026');
  });

  it('records a new payment through the pay form and updates the remaining balance', async () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    await wrapper.find('.debt-card__top').trigger('click');
    await wrapper.find('.debt-card__pay-input').setValue('2000');
    // Awaits submitPayment()'s own returned promise directly, rather than
    // DOM-triggering the submit event + flushPromises(): this is the one
    // test in this file that crosses a real, un-mocked IndexedDB round trip
    // (submitPayment -> debtsStore.pay -> debtsDb.addPayment), which settles
    // over several macrotask ticks — more on a cold db connection, since
    // getDb()'s module-level singleton is still unopened at this point in
    // the file — rather than the single tick flushPromises() drains, so
    // counting flushes here would be brittle. The @submit.prevent ->
    // submitPayment wiring itself is already covered by the trigger('submit')
    // tests elsewhere in this file.
    await wrapper.vm.submitPayment();
    expect(wrapper.find('.debt-card__amount').text()).toBe('8 000 ₽');
  });

  it('rejects a non-positive payment amount without touching the store', async () => {
    const wrapper = mount(DebtCard, { props: { debt } });
    await wrapper.find('.debt-card__top').trigger('click');
    await wrapper.find('.debt-card__pay-input').setValue('-500');
    await wrapper.find('.debt-card__pay-form').trigger('submit');
    // Remaining stays at the original 10 000 — a negative "payment" must
    // never be allowed to increase it.
    expect(wrapper.find('.debt-card__amount').text()).toBe('10 000 ₽');
  });

  it('ignores a second submit while the first payment is still in flight', async () => {
    const store = useDebtsStore();
    let resolvePay;
    vi.spyOn(store, 'pay').mockImplementation(() => new Promise((resolve) => { resolvePay = resolve; }));
    const wrapper = mount(DebtCard, { props: { debt } });
    await wrapper.find('.debt-card__top').trigger('click');
    await wrapper.find('.debt-card__pay-input').setValue('2000');
    const form = wrapper.find('.debt-card__pay-form');
    await form.trigger('submit');
    await form.trigger('submit');
    resolvePay({ id: 'p2', debtId: 'd1', amount: 2000, date: '2026-07-28' });
    await flushPromises();
    expect(store.pay).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import SettingsScreen from './SettingsScreen.vue';
import { useBudgetRatesStore } from '../../stores/budgetRates.js';
import { useCategoriesStore } from '../../stores/categories.js';
import * as ratesDb from '../../db/budgetRates.js';

vi.mock('../../db/budgetRates.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  useBudgetRatesStore().segments = [{ amount: 2500, effectiveFrom: '2026-01-01' }];
});

describe('SettingsScreen — daily budget row', () => {
  it('shows the current daily rate', () => {
    const wrapper = mount(SettingsScreen);
    expect(wrapper.find('.settings-row__value').text()).toContain('2 500 ₽');
  });

  it('reveals an editable input when the rate row is tapped', async () => {
    const wrapper = mount(SettingsScreen);
    await wrapper.find('.settings-row__value').trigger('click');
    expect(wrapper.find('.settings-row__rate-input').exists()).toBe(true);
  });

  it('saves a new rate and returns to the display state', async () => {
    ratesDb.addRate.mockResolvedValue({ id: 'r2', amount: 3000, effectiveFrom: '2026-07-27' });
    ratesDb.listRates.mockResolvedValue([{ id: 'r2', amount: 3000, effectiveFrom: '2026-07-27' }]);
    const wrapper = mount(SettingsScreen);
    await wrapper.find('.settings-row__value').trigger('click');
    await wrapper.find('.settings-row__rate-input').setValue('3000');
    await wrapper.find('.settings-row__rate-form').trigger('submit');
    // saveRate -> budgetRatesStore.setRate is two awaits deep (addRate, then
    // listRates) before editingRate resets — same shape as DebtsScreen's
    // submitAdd chain, where a single trigger()-implied nextTick() doesn't
    // reliably drain it.
    await flushPromises();
    expect(wrapper.find('.settings-row__value').text()).toContain('3 000 ₽');
    expect(wrapper.find('.settings-row__rate-input').exists()).toBe(false);
  });
});

describe('SettingsScreen — category management', () => {
  it('hosts the category tree', () => {
    useCategoriesStore().items = [{ id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false }];
    const wrapper = mount(SettingsScreen);
    expect(wrapper.find('.tree-row__name').text()).toBe('Еда');
  });
});

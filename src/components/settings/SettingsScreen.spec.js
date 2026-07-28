import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import SettingsScreen from './SettingsScreen.vue';
import { useBudgetRatesStore } from '../../stores/budgetRates.js';
import { useCategoriesStore } from '../../stores/categories.js';
import { useToastStore } from '../../stores/toast.js';
import { useBackupStore } from '../../stores/backup.js';
import * as ratesDb from '../../db/budgetRates.js';
import * as backupApi from '../../api/backup.js';

vi.mock('../../db/budgetRates.js');
vi.mock('../../api/backup.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  useBudgetRatesStore().segments = [{ amount: 2500, effectiveFrom: '2026-01-01' }];
  backupApi.status.mockResolvedValue({ loggedIn: false });
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

  it('rejects an amount of zero, showing a toast without touching the store', async () => {
    const wrapper = mount(SettingsScreen);
    await wrapper.find('.settings-row__value').trigger('click');
    await wrapper.find('.settings-row__rate-input').setValue('0');
    await wrapper.find('.settings-row__rate-form').trigger('submit');
    expect(useToastStore().message).toBe('Сумма должна быть больше нуля');
    expect(ratesDb.addRate).not.toHaveBeenCalled();
  });

  it('ignores a second submit while the first rate save is still in flight', async () => {
    let resolveAddRate;
    ratesDb.addRate.mockReturnValue(new Promise((resolve) => { resolveAddRate = resolve; }));
    ratesDb.listRates.mockResolvedValue([{ id: 'r2', amount: 3000, effectiveFrom: '2026-07-27' }]);
    const wrapper = mount(SettingsScreen);
    await wrapper.find('.settings-row__value').trigger('click');
    await wrapper.find('.settings-row__rate-input').setValue('3000');
    const form = wrapper.find('.settings-row__rate-form');
    await form.trigger('submit');
    await form.trigger('submit');
    resolveAddRate({ id: 'r2', amount: 3000, effectiveFrom: '2026-07-27' });
    await flushPromises();
    expect(ratesDb.addRate).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsScreen — category management', () => {
  it('hosts the category tree', () => {
    useCategoriesStore().items = [{ id: 'food', name: 'Еда', emoji: '🍔', parentId: null, archived: false }];
    const wrapper = mount(SettingsScreen);
    expect(wrapper.find('.tree-row__name').text()).toBe('Еда');
  });
});

describe('SettingsScreen — Резервная копия', () => {
  it('shows a login form when there is no active session', async () => {
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    expect(wrapper.find('.settings-row__backup-login').exists()).toBe(true);
  });

  it('logs in and switches to the status view on success', async () => {
    backupApi.login.mockResolvedValue({ ok: true });
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    await wrapper.find('.settings-row__backup-password').setValue('hunter2');
    await wrapper.find('.settings-row__backup-login').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.settings-row__backup-login').exists()).toBe(false);
    expect(wrapper.find('.settings-row__backup-status').exists()).toBe(true);
  });

  it('shows a toast and stays on the login form when login fails', async () => {
    backupApi.login.mockRejectedValue(new Error('Неверный пароль'));
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    await wrapper.find('.settings-row__backup-password').setValue('wrong');
    await wrapper.find('.settings-row__backup-login').trigger('submit');
    await flushPromises();
    expect(useToastStore().message).toBe('Неверный пароль');
    expect(wrapper.find('.settings-row__backup-login').exists()).toBe(true);
  });

  it('shows "not yet synced" status when already logged in but nothing has synced yet', async () => {
    backupApi.status.mockResolvedValue({ loggedIn: true });
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    expect(wrapper.find('.settings-row__backup-status').text()).toBe('Ещё не синхронизировалось');
  });

  it('shows a successful sync timestamp when logged in and synced', async () => {
    backupApi.status.mockResolvedValue({ loggedIn: true });
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    useBackupStore().lastSyncAt = '2026-07-28T10:00:00.000Z';
    useBackupStore().lastSyncOk = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.settings-row__backup-status').text()).toContain('Синхронизировано');
  });

  it('shows a sync-error status distinctly from a successful one', async () => {
    backupApi.status.mockResolvedValue({ loggedIn: true });
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    useBackupStore().lastSyncAt = '2026-07-28T10:00:00.000Z';
    useBackupStore().lastSyncOk = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.settings-row__backup-status').text()).toContain('Ошибка синхронизации');
  });

  it('ignores a second login submit while the first is still in flight', async () => {
    let resolveLogin;
    backupApi.login.mockReturnValue(new Promise((r) => { resolveLogin = r; }));
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    await wrapper.find('.settings-row__backup-password').setValue('hunter2');
    const form = wrapper.find('.settings-row__backup-login');
    await form.trigger('submit');
    await form.trigger('submit');
    resolveLogin({ ok: true });
    await flushPromises();
    expect(backupApi.login).toHaveBeenCalledTimes(1);
  });

  it('still shows the login form (not a broken state) when checking status fails, e.g. the server is unreachable', async () => {
    backupApi.status.mockRejectedValue(new Error('network error'));
    const wrapper = mount(SettingsScreen);
    await flushPromises();
    expect(wrapper.find('.settings-row__backup-login').exists()).toBe(true);
  });
});

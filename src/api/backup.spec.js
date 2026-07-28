import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as backupApi from './backup.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('backup API client', () => {
  it('login posts the password and returns the parsed body on success', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const result = await backupApi.login('hunter2');
    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ password: 'hunter2' }),
    }));
  });

  it('login throws with the server-provided message on failure', async () => {
    global.fetch.mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: 'Неверный пароль' }) });
    await expect(backupApi.login('wrong')).rejects.toThrow('Неверный пароль');
  });

  it('status returns the parsed loggedIn flag', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ loggedIn: true }) });
    expect(await backupApi.status()).toEqual({ loggedIn: true });
  });

  it('sync posts the snapshot and throws a generic error on failure (no server message expected)', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await backupApi.sync({ categories: [] });
    expect(global.fetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ categories: [] }),
    }));

    global.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(backupApi.sync({})).rejects.toThrow('Синхронизация не удалась');
  });

  it('restore GETs the snapshot and returns its parsed body', async () => {
    const snapshot = { categories: [], transactions: [], budgetRates: [], debts: [], debtPayments: [] };
    global.fetch.mockResolvedValue({ ok: true, json: async () => snapshot });
    expect(await backupApi.restore()).toEqual(snapshot);
  });
});

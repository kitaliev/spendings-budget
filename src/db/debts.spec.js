import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores, getDb } from './index.js';
import { createDebt, listDebts, addPayment, listPayments, listAllPayments, deleteDebt } from './debts.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('createDebt / listDebts', () => {
  it('persists a debt with its direction', async () => {
    await createDebt({ name: 'Андрей — ремонт', amount: 15000, comment: 'занял на инструменты', direction: 'owed_to_me' });
    const all = await listDebts();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Андрей — ремонт', amount: 15000, direction: 'owed_to_me' });
  });
});

describe('addPayment / listPayments', () => {
  it('records a dated payment against a debt', async () => {
    const debt = await createDebt({ name: 'Лиза', amount: 3000, comment: '', direction: 'owed_to_me' });
    await addPayment({ debtId: debt.id, amount: 1000, date: '2026-07-10' });
    const payments = await listPayments(debt.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ amount: 1000, date: '2026-07-10' });
  });

  it('keeps payments for different debts separate', async () => {
    const a = await createDebt({ name: 'A', amount: 1000, comment: '', direction: 'i_owe' });
    const b = await createDebt({ name: 'B', amount: 1000, comment: '', direction: 'i_owe' });
    await addPayment({ debtId: a.id, amount: 100, date: '2026-07-10' });
    expect(await listPayments(a.id)).toHaveLength(1);
    expect(await listPayments(b.id)).toHaveLength(0);
    expect(await listAllPayments()).toHaveLength(1);
  });
});

describe('deleteDebt', () => {
  it('cascades to delete the debt and its payment history', async () => {
    const debt = await createDebt({ name: 'A', amount: 1000, comment: '', direction: 'i_owe' });
    await addPayment({ debtId: debt.id, amount: 100, date: '2026-07-10' });

    await deleteDebt(debt.id);

    expect(await listDebts()).toHaveLength(0);
    const db = await getDb();
    expect(await db.getAll('debtPayments')).toHaveLength(0);
  });
});

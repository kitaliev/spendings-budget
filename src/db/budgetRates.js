import { getDb } from './index.js';
import { todayKey } from '../utils/date.js';

export async function addRate({ amount, effectiveFrom }) {
  const db = await getDb();
  const rate = { id: crypto.randomUUID(), amount, effectiveFrom };
  await db.add('budgetRates', rate);
  return rate;
}

export async function listRates() {
  const db = await getDb();
  return db.getAll('budgetRates');
}

export async function seedDefaultRateIfEmpty(defaultAmount = 2500) {
  const db = await getDb();
  const count = await db.count('budgetRates');
  if (count === 0) {
    await addRate({ amount: defaultAmount, effectiveFrom: todayKey() });
  }
}

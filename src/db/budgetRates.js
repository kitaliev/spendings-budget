import { getDb } from './index.js';
import { todayKey } from '../utils/date.js';

export async function addRate({ amount, effectiveFrom }) {
  const db = await getDb();
  // Two segments sharing an effectiveFrom (e.g. setRate called twice in the
  // same day) would make "which one wins" depend on an arbitrary tiebreak
  // instead of "the latest edit wins" — prevented by construction: a second
  // write for the same date updates that segment in place rather than
  // inserting a competing row.
  const existing = (await db.getAll('budgetRates')).find((r) => r.effectiveFrom === effectiveFrom);
  if (existing) {
    const updated = { ...existing, amount };
    await db.put('budgetRates', updated);
    return updated;
  }
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

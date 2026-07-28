import { getDb } from './index.js';
import { todayKey } from '../utils/date.js';

export async function addRate({ amount, effectiveFrom }) {
  const db = await getDb();
  // Two segments sharing an effectiveFrom (e.g. setRate called twice in the
  // same day) would make "which one wins" depend on an arbitrary tiebreak
  // instead of "the latest edit wins" — prevented by construction: a second
  // write for the same date updates that segment in place rather than
  // inserting a competing row. The lookup and the write share one
  // transaction (via the effectiveFrom index already declared in the
  // schema) rather than being two separate implicit transactions with an
  // await gap between them — closing the race instead of narrowing it, the
  // same fix already applied to categories.js's archive/delete.
  const tx = db.transaction('budgetRates', 'readwrite');
  const [existing] = await tx.store.index('effectiveFrom').getAll(effectiveFrom);
  const rate = existing ? { ...existing, amount } : { id: crypto.randomUUID(), amount, effectiveFrom };
  await tx.store.put(rate);
  await tx.done;
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

import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores } from './index.js';
import { addRate, listRates, seedDefaultRateIfEmpty } from './budgetRates.js';

beforeEach(async () => {
  await clearAllStores();
});

describe('seedDefaultRateIfEmpty', () => {
  it('creates a 2500 rate effective today when none exists', async () => {
    await seedDefaultRateIfEmpty();
    const rates = await listRates();
    expect(rates).toHaveLength(1);
    expect(rates[0].amount).toBe(2500);
  });

  it('does nothing if a rate already exists', async () => {
    await addRate({ amount: 3000, effectiveFrom: '2026-01-01' });
    await seedDefaultRateIfEmpty();
    const rates = await listRates();
    expect(rates).toHaveLength(1);
    expect(rates[0].amount).toBe(3000);
  });
});

describe('addRate', () => {
  it('appends a new segment without touching earlier ones', async () => {
    await addRate({ amount: 2500, effectiveFrom: '2026-07-01' });
    await addRate({ amount: 3500, effectiveFrom: '2026-07-20' });
    const rates = await listRates();
    expect(rates.map((r) => r.amount).sort()).toEqual([2500, 3500]);
  });

  it('updates the existing segment in place when effectiveFrom repeats, instead of creating a competing row', async () => {
    await addRate({ amount: 2500, effectiveFrom: '2026-07-01' });
    await addRate({ amount: 3000, effectiveFrom: '2026-07-01' }); // changed mind, same day
    const rates = await listRates();
    expect(rates).toHaveLength(1);
    expect(rates[0].amount).toBe(3000);
  });

  it('still collapses to one row for the same date under concurrent calls, not just sequential ones', async () => {
    // A double-tap on Save (e.g. before the button is ever disabled) fires
    // two addRate calls for the same date before either has finished — this
    // must not race past the same-date check into two competing inserts.
    await Promise.all([
      addRate({ amount: 2500, effectiveFrom: '2026-07-01' }),
      addRate({ amount: 3000, effectiveFrom: '2026-07-01' }),
    ]);
    const rates = await listRates();
    expect(rates).toHaveLength(1);
  });
});

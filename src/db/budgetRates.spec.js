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
});

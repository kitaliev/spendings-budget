import { describe, it, expect } from 'vitest';
import { calculateAccrual, calculateSpend, calculateAvailable } from './budgetMath.js';

describe('calculateAccrual', () => {
  it('multiplies a single flat rate by days elapsed', () => {
    const segments = [{ amount: 2500, effectiveFrom: '2026-07-01' }];
    expect(calculateAccrual('2026-07', 10, segments)).toBe(25000);
  });

  it('applies a mid-month rate change only from its effective date forward', () => {
    // Worked example from the design session: day 20 of the month, 2500 -> 3500.
    const segments = [
      { amount: 2500, effectiveFrom: '2026-07-01' },
      { amount: 3500, effectiveFrom: '2026-07-20' },
    ];
    // days 1-19 at 2500 (19 days) + days 20-30 at 3500 (11 days)
    expect(calculateAccrual('2026-07', 30, segments)).toBe(19 * 2500 + 11 * 3500);
  });

  it('returns 0 when no rate has ever been set', () => {
    expect(calculateAccrual('2026-07', 10, [])).toBe(0);
  });
});

describe('calculateSpend', () => {
  it('sums only transactions within the month, up to the elapsed cutoff', () => {
    const transactions = [
      { date: '2026-07-05', amount: 2000 },
      { date: '2026-06-30', amount: 9999 }, // different month, excluded
      { date: '2026-07-15', amount: 500 }, // after cutoff, excluded
    ];
    expect(calculateSpend('2026-07', 10, transactions)).toBe(2000);
  });

  it('includes a backdated transaction added after the fact', () => {
    const transactions = [
      { date: '2026-07-05', amount: 2000 },
      { date: '2026-07-03', amount: 1000 }, // logged late, dated earlier in the month
    ];
    expect(calculateSpend('2026-07', 10, transactions)).toBe(3000);
  });
});

describe('calculateAvailable', () => {
  it('reflects the exact worked example from the design session', () => {
    // Daily budget 2500, day 10, a backdated 1000 expense from day 3 plus a 2000 expense from day 5.
    const result = calculateAvailable({
      monthKey: '2026-07',
      daysElapsed: 10,
      rateSegments: [{ amount: 2500, effectiveFrom: '2026-07-01' }],
      transactions: [
        { date: '2026-07-05', amount: 2000 },
        { date: '2026-07-03', amount: 1000 },
      ],
    });
    expect(result).toBe(25000 - 3000); // 22000
  });

  it('goes negative on overspend', () => {
    const result = calculateAvailable({
      monthKey: '2026-07',
      daysElapsed: 5,
      rateSegments: [{ amount: 2500, effectiveFrom: '2026-07-01' }],
      transactions: [{ date: '2026-07-02', amount: 20000 }],
    });
    expect(result).toBe(12500 - 20000); // -7500
  });
});

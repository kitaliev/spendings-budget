import { describe, it, expect } from 'vitest';
import { toDateKey, toMonthKey, daysInMonth, daysElapsedInMonth } from './date.js';

describe('toDateKey', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 6, 26))).toBe('2026-07-26');
  });

  it('pads single-digit month and day', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('toMonthKey', () => {
  it('derives YYYY-MM from a date key', () => {
    expect(toMonthKey('2026-07-26')).toBe('2026-07');
  });
});

describe('daysInMonth', () => {
  it('returns 31 for July', () => {
    expect(daysInMonth('2026-07')).toBe(31);
  });

  it('returns 28 for February 2026 (not a leap year)', () => {
    expect(daysInMonth('2026-02')).toBe(28);
  });
});

describe('daysElapsedInMonth', () => {
  it('returns the day-of-month for the current month', () => {
    expect(daysElapsedInMonth('2026-07', '2026-07-26')).toBe(26);
  });

  it('returns the full month length for a past month', () => {
    expect(daysElapsedInMonth('2026-03', '2026-07-26')).toBe(31);
  });

  it('returns 0 for a future month', () => {
    expect(daysElapsedInMonth('2026-12', '2026-07-26')).toBe(0);
  });
});

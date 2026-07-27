import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toDateKey, toMonthKey, todayKey, yesterdayKey, daysInMonth, daysElapsedInMonth, monthNameWithYear } from './date.js';

describe('toDateKey', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 6, 26))).toBe('2026-07-26');
  });

  it('pads single-digit month and day', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('passes an already-formatted date-key string through unchanged, without a UTC round-trip', () => {
    expect(toDateKey('2026-07-26')).toBe('2026-07-26');
  });
});

describe('todayKey / yesterdayKey', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('todayKey reflects the current system date', () => {
    expect(todayKey()).toBe('2026-07-27');
  });

  it('yesterdayKey is one calendar day behind', () => {
    expect(yesterdayKey()).toBe('2026-07-26');
  });

  it('yesterdayKey crosses a month boundary correctly', () => {
    vi.setSystemTime(new Date(2026, 7, 1)); // 1 Aug 2026
    expect(yesterdayKey()).toBe('2026-07-31');
  });
});

describe('toMonthKey', () => {
  it('derives YYYY-MM from a date key', () => {
    expect(toMonthKey('2026-07-26')).toBe('2026-07');
  });
});

describe('monthNameWithYear', () => {
  it('capitalizes the Russian month name and appends the year', () => {
    expect(monthNameWithYear('2026-01')).toBe('Январь 2026');
  });

  it('works for every month, not just ones without special-casing', () => {
    expect(monthNameWithYear('2026-03')).toBe('Март 2026');
    expect(monthNameWithYear('2026-08')).toBe('Август 2026');
    expect(monthNameWithYear('2026-12')).toBe('Декабрь 2026');
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

  it('returns 1 on the first day of the current month', () => {
    expect(daysElapsedInMonth('2026-07', '2026-07-01')).toBe(1);
  });

  it('returns the full month length on the last day of the current month', () => {
    expect(daysElapsedInMonth('2026-07', '2026-07-31')).toBe(31);
  });
});

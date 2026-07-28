import { describe, it, expect } from 'vitest';
import { formatMoney, parsePositiveAmount } from './currency.js';

describe('formatMoney', () => {
  it('groups thousands with a space and appends the ruble sign', () => {
    expect(formatMoney(16800)).toBe('16 800 ₽');
  });

  it('renders negative amounts with a minus sign, not a hyphen', () => {
    expect(formatMoney(-2600)).toBe('−2 600 ₽');
  });

  it('rounds fractional amounts', () => {
    expect(formatMoney(999.6)).toBe('1 000 ₽');
  });

  it('handles zero', () => {
    expect(formatMoney(0)).toBe('0 ₽');
  });

  it('does not render "−0 ₽" for a negative amount that rounds to zero', () => {
    expect(formatMoney(-0.4)).toBe('0 ₽');
  });
});

describe('parsePositiveAmount', () => {
  it('parses and rounds a valid amount string', () => {
    expect(parsePositiveAmount('2000')).toBe(2000);
    expect(parsePositiveAmount('999.6')).toBe(1000);
  });

  it('returns null for empty or non-numeric input, not NaN', () => {
    expect(parsePositiveAmount('')).toBeNull();
    expect(parsePositiveAmount('abc')).toBeNull();
  });

  it('returns null for zero', () => {
    expect(parsePositiveAmount('0')).toBeNull();
  });

  it('returns null for a negative amount', () => {
    expect(parsePositiveAmount('-500')).toBeNull();
  });
});

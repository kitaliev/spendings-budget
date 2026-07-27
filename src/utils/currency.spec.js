import { describe, it, expect } from 'vitest';
import { formatMoney } from './currency.js';

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
});

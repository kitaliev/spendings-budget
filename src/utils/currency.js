export function formatMoney(amount) {
  const rounded = Math.round(Math.abs(amount));
  const isNegative = amount < 0 && rounded !== 0;
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (isNegative ? '−' : '') + grouped + ' ₽';
}

// Parses a raw amount-input string (a debt payment, a new debt's amount,
// ...) into a whole-ruble positive integer, or null if it isn't one.
// `null` uniformly covers NaN (empty/garbage text), zero, and negative
// values — the same three-way guard this app needs at every amount-entry
// point, previously duplicated as Math.round(parseFloat(...)) + a
// !(amount > 0) check in both DebtCard and DebtsScreen.
export function parsePositiveAmount(value) {
  const amount = Math.round(parseFloat(value));
  return amount > 0 ? amount : null;
}

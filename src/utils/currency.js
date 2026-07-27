export function formatMoney(amount) {
  const rounded = Math.round(Math.abs(amount));
  const isNegative = amount < 0 && rounded !== 0;
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (isNegative ? '−' : '') + grouped + ' ₽';
}

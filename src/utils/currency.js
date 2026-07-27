export function formatMoney(amount) {
  const isNegative = amount < 0;
  const rounded = Math.round(Math.abs(amount));
  const grouped = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (isNegative ? '−' : '') + grouped + ' ₽';
}

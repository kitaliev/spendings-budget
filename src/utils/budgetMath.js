function dateKeyForDay(monthKey, day) {
  return `${monthKey}-${String(day).padStart(2, '0')}`;
}

function rateActiveOn(dateKey, sortedSegments) {
  // No fallback to the earliest segment: a date before every known
  // effectiveFrom genuinely had no rate yet (e.g. the day the app was
  // first installed mid-month) and must accrue 0, not the first rate
  // applied retroactively.
  let active = null;
  for (const segment of sortedSegments) {
    if (segment.effectiveFrom <= dateKey) active = segment;
    else break;
  }
  return active ? active.amount : 0;
}

export function calculateAccrual(monthKey, daysElapsed, rateSegments) {
  const sorted = [...rateSegments].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  let total = 0;
  for (let day = 1; day <= daysElapsed; day += 1) {
    total += rateActiveOn(dateKeyForDay(monthKey, day), sorted);
  }
  return total;
}

export function calculateSpend(monthKey, daysElapsed, transactions) {
  if (daysElapsed === 0) return 0;
  const cutoff = dateKeyForDay(monthKey, daysElapsed);
  return transactions
    .filter((t) => t.date.startsWith(monthKey) && t.date <= cutoff)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function calculateAvailable({ monthKey, daysElapsed, rateSegments, transactions }) {
  return (
    calculateAccrual(monthKey, daysElapsed, rateSegments) -
    calculateSpend(monthKey, daysElapsed, transactions)
  );
}

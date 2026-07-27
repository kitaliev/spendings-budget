export function toDateKey(date) {
  // A string is assumed to already be a YYYY-MM-DD key (the only string shape
  // this app ever produces) and passed through as-is. Re-parsing it via
  // `new Date(string)` would read it as UTC midnight while every other
  // function here reads local getters, shifting the day by one for anyone
  // west of UTC.
  if (typeof date === 'string') return date;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toMonthKey(dateKey) {
  return dateKey.slice(0, 7);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

// "Январь 2026" — the one Russian month-name format needed in more than one
// place (MonthChart's aria-labels, BudgetDashboard's month heading). Built
// via a local-time Date + toLocaleDateString rather than a hardcoded name
// array, so there's a single source of truth instead of two independently
// maintained lists that could quietly drift apart.
export function monthNameWithYear(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const name = new Date(year, month - 1, 1).toLocaleDateString('ru-RU', { month: 'long' });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// monthKey and todayDateKey must be zero-padded (YYYY-MM / YYYY-MM-DD) — the
// comparisons below are lexicographic and silently misbehave on unpadded
// input (e.g. '2026-7' sorts after '2026-07').
export function daysElapsedInMonth(monthKey, todayDateKey = todayKey()) {
  const today = toMonthKey(todayDateKey);
  if (monthKey > today) return 0;
  if (monthKey < today) return daysInMonth(monthKey);
  return Number(todayDateKey.slice(8, 10));
}

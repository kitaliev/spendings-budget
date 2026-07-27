export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
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

export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function daysElapsedInMonth(monthKey, todayDateKey = todayKey()) {
  const today = toMonthKey(todayDateKey);
  if (monthKey > today) return 0;
  if (monthKey < today) return daysInMonth(monthKey);
  return Number(todayDateKey.slice(8, 10));
}

// Relative paths only — the client is always served from the same origin
// as the API (see the Phase 2 plan's own architecture section), so no
// server address is ever configured anywhere in this app.
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function login(password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Не удалось войти');
  return body;
}

export async function status() {
  const res = await fetch('/api/status', { credentials: 'include' });
  return res.json();
}

export async function sync(snapshot) {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(snapshot),
  });
  if (!res.ok) throw new Error('Синхронизация не удалась');
}

export async function restore() {
  const res = await fetch('/api/restore', { credentials: 'include' });
  if (!res.ok) throw new Error('Не удалось получить резервную копию');
  return res.json();
}

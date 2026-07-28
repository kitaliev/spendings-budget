import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkOrRegisterPassword, createSession, isValidSession } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
    req.on('error', reject);
  });
}

function getSessionId(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|; )sid=([^;]+)/);
  return match ? match[1] : null;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// hashPath/dbPath/backupDir are passed in (rather than read from module-level
// constants) so tests can point every file operation at throwaway paths
// instead of the real server/data directory.
export function createApp(db, { hashPath, dbPath, backupDir }) {
  return async function requestListener(req, res) {
    const sessionId = getSessionId(req);

    if (req.url === '/api/login' && req.method === 'POST') {
      const { password } = await readBody(req);
      if (!password) return sendJson(res, 400, { ok: false, error: 'Введите пароль' });
      const ok = checkOrRegisterPassword(hashPath, password);
      if (!ok) return sendJson(res, 401, { ok: false, error: 'Неверный пароль' });
      const sid = createSession();
      // No Max-Age/Expires: an infinite-lifetime cookie, matching the
      // no-expiry, process-lifetime session store in auth.js (decision #5).
      res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Secure; SameSite=Strict; Path=/`);
      return sendJson(res, 200, { ok: true });
    }

    if (req.url === '/api/status' && req.method === 'GET') {
      return sendJson(res, 200, { loggedIn: isValidSession(sessionId) });
    }

    if (req.url.startsWith('/api/')) {
      return sendJson(res, 404, { ok: false, error: 'Not found' });
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  };
}

export { __dirname };

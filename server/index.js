import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkOrRegisterPassword, createSession, isValidSession } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// maxBytes guards against unbounded memory growth from an untrusted body
// (this endpoint requires no prior auth); the try/catch around JSON.parse
// matters separately — thrown inside the 'end' listener, a JSON.parse
// SyntaxError happens after the Promise executor has already returned, so it
// can never become a promise rejection on its own. Left uncaught, it either
// crashes the process outright (see requestListener's own try/catch for the
// other half of this) or, if only this half were fixed, would surface as an
// unhandled rejection instead — still fatal by default. Both layers matter.
function readBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
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
    // Wraps the entire route dispatch: readBody's rejections (malformed JSON,
    // oversized body) are awaited below with nothing else to catch them, so
    // without this try/catch an unhandled rejection would crash the whole
    // process just as surely as an uncaught exception would (empirically
    // confirmed both ways — see readBody's own comment for the mechanism).
    try {
      const sessionId = getSessionId(req);

      if (req.url === '/api/login' && req.method === 'POST') {
        const { password } = await readBody(req);
        if (!password) return sendJson(res, 400, { ok: false, error: 'Введите пароль' });
        const ok = checkOrRegisterPassword(hashPath, password);
        if (!ok) return sendJson(res, 401, { ok: false, error: 'Неверный пароль' });
        const sid = createSession();
        // An explicit, very long Max-Age — not just an absent one. An absent
        // Max-Age creates a browser *session* cookie, whose survival across an
        // installed PWA's app relaunches is inconsistent, which would undermine
        // the actual no-expiry intent (decision #5) even though the server-side
        // session store itself has no expiry. This is what makes the cookie
        // itself outlive any realistic gap between app opens, so only a server
        // restart (which clears the in-memory session Set) ever forces a
        // re-login.
        const TEN_YEARS_IN_SECONDS = 10 * 365 * 24 * 60 * 60;
        res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TEN_YEARS_IN_SECONDS}`);
        return sendJson(res, 200, { ok: true });
      }

      if (req.url === '/api/status' && req.method === 'GET') {
        return sendJson(res, 200, { loggedIn: isValidSession(sessionId) });
      }

      if (req.url.startsWith('/api/')) {
        return sendJson(res, 404, { ok: false, error: 'Not found' });
      }

      sendJson(res, 404, { ok: false, error: 'Not found' });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: 'Некорректный запрос' });
    }
  };
}

export { __dirname };

// server/index.js
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, overwriteFromSnapshot, dumpToSnapshot } from './db.js';
import { rotateBackup } from './backup.js';
import { checkOrRegisterPassword, createSession, isValidSession } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'budget.sqlite');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const HASH_PATH = path.join(DATA_DIR, 'password.hash');
const DIST_DIR = path.join(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

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

// Every non-API GET falls back to index.html if the exact file doesn't
// exist — this app has no URL-based routing (a single tab-state-driven SPA),
// so there's no real "unknown route" case to distinguish from "the app
// itself". The stream's own 'error' listener matters for the same reason
// readBody needed one: a missing/unreadable dist/index.html (e.g. this
// server started before `npm run build` ever ran) would otherwise emit an
// unhandled 'error' event on the stream and crash the process exactly like
// the bug Task 5 fixed — writeHead has already fired by the time a stream
// error can happen, so the best available response at that point is to log
// server-side and just end the connection, not attempt a second status code.
function serveStatic(req, res) {
  const requestedPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(DIST_DIR, requestedPath);
  if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    console.error('[serveStatic]', err);
    res.end();
  });
  stream.pipe(res);
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
        const TEN_YEARS_IN_SECONDS = 10 * 365 * 24 * 60 * 60;
        res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TEN_YEARS_IN_SECONDS}`);
        return sendJson(res, 200, { ok: true });
      }

      if (req.url === '/api/status' && req.method === 'GET') {
        return sendJson(res, 200, { loggedIn: isValidSession(sessionId) });
      }

      if (req.url === '/api/sync' && req.method === 'POST') {
        if (!isValidSession(sessionId)) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const snapshot = await readBody(req);
        rotateBackup(dbPath, backupDir);
        overwriteFromSnapshot(db, snapshot);
        return sendJson(res, 200, { ok: true });
      }

      if (req.url === '/api/restore' && req.method === 'GET') {
        if (!isValidSession(sessionId)) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        return sendJson(res, 200, dumpToSnapshot(db));
      }

      if (req.url.startsWith('/api/')) {
        return sendJson(res, 404, { ok: false, error: 'Not found' });
      }

      serveStatic(req, res);
    } catch (err) {
      console.error('[requestListener]', err);
      sendJson(res, 400, { ok: false, error: 'Некорректный запрос' });
    }
  };
}

// Only actually binds a port when run directly (`node index.js`) — lets
// tests import createApp() and drive it via their own ephemeral-port server
// instead, without needing the real cert files that only exist on the VPS.
if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = openDatabase(DB_PATH);
  const app = createApp(db, { hashPath: HASH_PATH, dbPath: DB_PATH, backupDir: BACKUP_DIR });

  const CERT_DIR = path.join(__dirname, 'certs');
  const options = {
    key: fs.readFileSync(path.join(CERT_DIR, 'privkey.pem')),
    cert: fs.readFileSync(path.join(CERT_DIR, 'fullchain.pem')),
  };
  https.createServer(options, app).listen(443, () => {
    console.log('budget-server listening on https://0.0.0.0:443');
  });
}

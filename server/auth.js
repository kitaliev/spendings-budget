import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';

// In-memory, no expiry (a deliberate choice — see design decision #5):
// sessions live until the Node process restarts, which only happens on a
// cert-renewal restart or a server reboot. Re-login afterward is low
// friction via Safari's own saved-password + Face ID autofill.
const sessions = new Set();

function loadPasswordHash(hashFilePath) {
  return fs.existsSync(hashFilePath) ? fs.readFileSync(hashFilePath, 'utf8').trim() : null;
}

// Verifies the single account's password — or, if none is stored yet,
// establishes whichever password is submitted first as the permanent one.
// There is no separate signup flow anywhere in this app (decision #4); to
// reset, an operator deletes the hash file over SSH and "registers" again
// through the same login form.
export function checkOrRegisterPassword(hashFilePath, submittedPassword) {
  const storedHash = loadPasswordHash(hashFilePath);
  if (!storedHash) {
    try {
      fs.writeFileSync(hashFilePath, bcrypt.hashSync(submittedPassword, 10), {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
      });
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Another concurrent request won the race and registered first —
      // fall through and compare against whatever they actually stored,
      // rather than silently overwriting it or crashing.
      return bcrypt.compareSync(submittedPassword, loadPasswordHash(hashFilePath));
    }
  }
  return bcrypt.compareSync(submittedPassword, storedHash);
}

export function createSession() {
  const id = crypto.randomBytes(32).toString('hex');
  sessions.add(id);
  return id;
}

export function isValidSession(id) {
  return Boolean(id) && sessions.has(id);
}

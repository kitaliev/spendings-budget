import fs from 'node:fs';
import path from 'node:path';

// Copies the live db file into backupDir with a sortable timestamp name,
// then deletes rotated copies older than maxAgeDays. Called right before
// every sync overwrites the live file (see index.js) — this rotation is the
// only safety net against a bad incoming snapshot destroying a good prior
// copy, since the design spec explicitly rejects any external/offsite
// duplicate (§3, §14).
export function rotateBackup(liveDbPath, backupDir, maxAgeDays = 14) {
  if (!fs.existsSync(liveDbPath)) return;
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(liveDbPath, path.join(backupDir, `${stamp}.sqlite`));

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(backupDir)) {
    const filePath = path.join(backupDir, file);
    if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath);
  }
}

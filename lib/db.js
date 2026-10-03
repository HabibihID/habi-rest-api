import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, '..', 'data', 'habi-api.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT,
    endpoint TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

export function createKey(name = 'user') {
  const key = 'habi_' + crypto.randomBytes(24).toString('hex')
  db.prepare('INSERT INTO api_keys (key, name) VALUES (?, ?)').run(key, name)
  return key
}

export function validateKey(key) {
  if (!key) return null
  const row = db.prepare('SELECT * FROM api_keys WHERE key = ? AND revoked = 0').get(key)
  return row || null
}

export function revokeKey(key) {
  return db.prepare('UPDATE api_keys SET revoked = 1 WHERE key = ?').run(key)
}

export function listKeys() {
  return db.prepare('SELECT id, name, key, created_at, revoked FROM api_keys ORDER BY id DESC').all()
}

export function logUsage(apiKey, endpoint) {
  try {
    db.prepare('INSERT INTO usage_log (api_key, endpoint) VALUES (?, ?)').run(apiKey, endpoint)
  } catch {}
}

export default db

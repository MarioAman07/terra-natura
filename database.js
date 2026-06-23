const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'terra.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS samples (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    datetime    TEXT NOT NULL,
    location    TEXT NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('water', 'soil', 'air')),
    employee    TEXT NOT NULL,
    results     TEXT,
    status      TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('ready', 'processed')),
    created_at  TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role     TEXT NOT NULL DEFAULT 'admin'
  )
`);

const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const hashed = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashed, 'admin');
  console.log(' Default admin user created (username: admin, password: admin123)');
}

module.exports = db;
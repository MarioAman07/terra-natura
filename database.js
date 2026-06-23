const Database = require('better-sqlite3');

const db = new Database('terra.db');

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

module.exports = db;
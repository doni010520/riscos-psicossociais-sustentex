import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || path.join('/tmp', 'database.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDb(db);
  }
  return db;
}

function initDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT DEFAULT '0.0.0.0',
      answers TEXT NOT NULL,
      completion_time_seconds INTEGER DEFAULT 0,
      user_agent TEXT,
      submitted_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT DEFAULT '0.0.0.0',
      action TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at);
    CREATE INDEX IF NOT EXISTS idx_responses_ip ON responses(ip_address);
  `);

  // Criar admin padrão se não existir
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(adminEmail);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO admin_users (email, password_hash, full_name) VALUES (?, ?, ?)').run(
      adminEmail, hash, 'Administrador'
    );
  }
}

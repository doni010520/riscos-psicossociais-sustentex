import initSqlJs, { Database } from 'sql.js';
import bcryptjs from 'bcryptjs';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();

    db.run(`
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
    `);

    // Criar admin padrão se não existir
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    const existing = db.exec(`SELECT id FROM admin_users WHERE email = '${adminEmail}'`);
    if (existing.length === 0 || existing[0].values.length === 0) {
      const hash = bcryptjs.hashSync(adminPassword, 10);
      db.run('INSERT INTO admin_users (email, password_hash, full_name) VALUES (?, ?, ?)', [
        adminEmail, hash, 'Administrador',
      ]);
    }

    return db;
  })();

  return initPromise;
}

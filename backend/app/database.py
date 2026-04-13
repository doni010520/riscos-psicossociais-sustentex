import sqlite3
import os
import json
from datetime import datetime
from passlib.context import CryptContext

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "database.db"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
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
        CREATE INDEX IF NOT EXISTS idx_access_log_created_at ON access_log(created_at);
    """)

    # Criar admin padrão se não existir
    admin_email = os.getenv("ADMIN_EMAIL", "admin@admin.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "Admin@123")

    existing = cursor.execute("SELECT id FROM admin_users WHERE email = ?", (admin_email,)).fetchone()
    if not existing:
        hashed = pwd_context.hash(admin_password)
        cursor.execute(
            "INSERT INTO admin_users (email, password_hash, full_name) VALUES (?, ?, ?)",
            (admin_email, hashed, "Administrador")
        )
        print(f"✅ Admin criado: {admin_email}")

    conn.commit()
    conn.close()
    print("✅ Banco SQLite inicializado")

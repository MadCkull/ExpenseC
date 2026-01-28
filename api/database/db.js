import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

// For local development, it will look for TURSO_DATABASE_URL in environment.
// On Vercel, this will be set in the dashboard.
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:expensec.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize Database Schema
export async function initDB() {
  try {
    // We use individual executions for Schema
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        avatar TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, 
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 1, 
        total_amount REAL DEFAULT 0,
        per_head REAL DEFAULT 0,
        participants_count INTEGER DEFAULT 0,
        settlements_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived_at DATETIME
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        amount REAL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Insert default PINs if not exist
    const adminPinScan = await db.execute("SELECT value FROM settings WHERE key = 'admin_pin'");
    if (adminPinScan.rows.length === 0) {
      const hashedAdmin = await bcrypt.hash('6869', 10);
      await db.execute({
        sql: "INSERT INTO settings (key, value) VALUES ('admin_pin', ?)",
        args: [hashedAdmin]
      });
      console.log("Default Admin PIN initialized (hashed)");
    }

    const userPinScan = await db.execute("SELECT value FROM settings WHERE key = 'user_pin'");
    if (userPinScan.rows.length === 0) {
      const hashedUser = await bcrypt.hash('3595', 10);
      await db.execute({
        sql: "INSERT INTO settings (key, value) VALUES ('user_pin', ?)",
        args: [hashedUser]
      });
      console.log("Default User PIN initialized (hashed)");
    }
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

export default db;

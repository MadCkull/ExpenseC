import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

// Require Turso credentials - no fallback to local SQLite
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let isInitialized = false;

import sharp from 'sharp';

// Initialize Database Schema
export async function initDB() {
  if (isInitialized) return;
  
  try {
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
        avatar_thumb TEXT,
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
        gandu_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived_at DATETIME,
        FOREIGN KEY (gandu_id) REFERENCES users(id)
      );
    `);

    // Migration: Add gandu_id or rename if joker_id exists
    try {
      // First try to rename if old exists
      await db.execute("ALTER TABLE events RENAME COLUMN joker_id TO gandu_id");
      console.log("Migration: Renamed joker_id to gandu_id");
    } catch (e) {
      // If rename fails (maybe already renamed or doesn't exist), try adding it
      try {
        await db.execute("ALTER TABLE events ADD COLUMN gandu_id INTEGER REFERENCES users(id)");
        console.log("Migration: Added gandu_id to events table");
      } catch (ee) {
        // Already exists
      }
    }

    // Migration: Add avatar_thumb to users table
    try {
      await db.execute("ALTER TABLE users ADD COLUMN avatar_thumb TEXT");
      console.log("Migration: Added avatar_thumb to users table");
    } catch (e) {
        // Already exists
    }

    // Data Migration: Generate thumbnails for existing users
    try {
      const usersToMigrate = await db.execute("SELECT id, avatar FROM users WHERE avatar IS NOT NULL AND avatar_thumb IS NULL");
      if (usersToMigrate.rows.length > 0) {
        console.log(`Migration: Generating thumbnails for ${usersToMigrate.rows.length} users...`);
        for (const row of usersToMigrate.rows) {
          try {
            // Check if avatar is valid base64
            if (!row.avatar || !row.avatar.includes('base64,')) continue;
            
            const buffer = Buffer.from(row.avatar.split('base64,')[1], 'base64');
            const thumbBuffer = await sharp(buffer)
              .resize(64, 64, { fit: 'cover' })
              .jpeg({ quality: 60 })
              .toBuffer();
              
            const thumb = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
            
            await db.execute({
              sql: "UPDATE users SET avatar_thumb = ? WHERE id = ?",
              args: [thumb, row.id]
            });
          } catch (err) {
            console.error(`Failed to generate thumb for user ${row.id}:`, err.message);
          }
        }
        console.log("Migration: Thumbnails generated.");
      }
    } catch (e) {
      console.error("Thumbnail migration error:", e);
    }

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

    // Insert default PINs
    const adminPinScan = await db.execute("SELECT value FROM settings WHERE key = 'admin_pin'");
    if (adminPinScan.rows.length === 0) {
      const hashedAdmin = await bcrypt.hash('6869', 10);
      await db.execute({
        sql: "INSERT INTO settings (key, value) VALUES ('admin_pin', ?)",
        args: [hashedAdmin]
      });
    }

    const userPinScan = await db.execute("SELECT value FROM settings WHERE key = 'user_pin'");
    if (userPinScan.rows.length === 0) {
      const hashedUser = await bcrypt.hash('3595', 10);
      await db.execute({
        sql: "INSERT INTO settings (key, value) VALUES ('user_pin', ?)",
        args: [hashedUser]
      });
    }

    // Performance Indexes
    try {
        await db.execute("CREATE INDEX IF NOT EXISTS idx_events_archived_at ON events(archived_at)");
        await db.execute("CREATE INDEX IF NOT EXISTS idx_events_gandu_id ON events(gandu_id)");
    } catch(e) { /* ignore if already exists */ }

    isInitialized = true;
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err; // Re-throw so the caller knows it failed
  }
}

export default db;

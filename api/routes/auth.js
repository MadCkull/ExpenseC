import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN is required' });

    const settings = await db.execute("SELECT key, value FROM settings WHERE key IN ('admin_pin', 'user_pin')");
    
    let adminPinHash = '';
    let userPinHash = '';
    
    settings.rows.forEach(row => {
      if (row.key === 'admin_pin') adminPinHash = row.value;
      if (row.key === 'user_pin') userPinHash = row.value;
    });

    if (adminPinHash && await bcrypt.compare(pin, adminPinHash)) {
      return res.json({ role: 'admin' });
    } else if (userPinHash && await bcrypt.compare(pin, userPinHash)) {
      return res.json({ role: 'user' });
    } else {
      return res.status(401).json({ error: 'Invalid PIN' });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

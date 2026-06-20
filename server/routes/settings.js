import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: "Settings endpoint" });
});

router.post('/pins', async (req, res) => {
  try {
    const { admin_pin, user_pin } = req.body;
    
    if (admin_pin) {
      const hashedAdmin = await bcrypt.hash(admin_pin, 10);
      await db.execute({
        sql: "UPDATE settings SET value = ? WHERE key = 'admin_pin'",
        args: [hashedAdmin]
      });
    }
    
    if (user_pin) {
      const hashedUser = await bcrypt.hash(user_pin, 10);
      await db.execute({
        sql: "UPDATE settings SET value = ? WHERE key = 'user_pin'",
        args: [hashedUser]
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("Update PINs error:", err);
    res.status(500).json({ error: "Failed to update PINs" });
  }
});

export default router;

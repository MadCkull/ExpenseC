import express from 'express';
import db from '../database/db.js';
import { sendPushToUser } from '../utils/pushService.js';

const router = express.Router();

// Get all fines for a specific event
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await db.execute({
      sql: `
        SELECT f.*, u.name as user_name, u.avatar as user_avatar, a.name as fined_by_name 
        FROM fines f 
        JOIN users u ON f.user_id = u.id 
        JOIN users a ON f.fined_by = a.id 
        WHERE f.event_id = ? 
        ORDER BY f.created_at DESC
      `,
      args: [eventId]
    });
    res.json({ fines: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a fine to a user in the active event
router.post('/add', async (req, res) => {
  try {
    const { user_id, amount, fined_by } = req.body;

    if (!user_id || !amount || !fined_by) {
      return res.status(400).json({ error: "user_id, amount, and fined_by are required" });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Fine amount must be positive" });
    }

    const eventResult = await db.execute('SELECT id FROM events WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
    const activeEvent = eventResult.rows[0];
    if (!activeEvent) return res.status(400).json({ error: "No active event" });

    const result = await db.execute({
      sql: 'INSERT INTO fines (event_id, user_id, amount, fined_by) VALUES (?, ?, ?, ?)',
      args: [activeEvent.id, user_id, parsedAmount, fined_by]
    });

    // Notify the user
    sendPushToUser(user_id, {
        title: 'You got fined! ⚠️',
        body: `A fine of £${parsedAmount.toFixed(2)} was added to your expenses.`,
        data: { url: '/' }
    });

    res.json({ success: true, id: String(result.lastInsertRowid) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove a fine
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: 'DELETE FROM fines WHERE id = ?',
      args: [id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

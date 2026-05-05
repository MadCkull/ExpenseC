import express from 'express';
import db from '../database/db.js';
import { sendPushToUser } from '../utils/pushService.js';

const router = express.Router();

// Upsert an explicit debt for the active event
// If amount is null/0, delete the debt entry
router.post('/update', async (req, res) => {
  try {
    const { creditor_id, debtor_id, amount } = req.body;

    if (!creditor_id || !debtor_id) {
      return res.status(400).json({ error: "creditor_id and debtor_id are required" });
    }

    if (creditor_id === debtor_id) {
      return res.status(400).json({ error: "Cannot add a debt to yourself" });
    }

    const eventResult = await db.execute('SELECT id FROM events WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
    const activeEvent = eventResult.rows[0];
    if (!activeEvent) return res.status(400).json({ error: "No active event" });

    // Check if a debt already exists between these two users for this event
    const existingResult = await db.execute({
      sql: 'SELECT id FROM explicit_debts WHERE event_id = ? AND creditor_id = ? AND debtor_id = ?',
      args: [activeEvent.id, creditor_id, debtor_id]
    });
    const existing = existingResult.rows[0];

    // If amount is null, 0, or empty → delete the debt
    if (amount === null || amount === 0 || amount === '') {
      if (existing) {
        await db.execute({
          sql: 'DELETE FROM explicit_debts WHERE id = ?',
          args: [existing.id]
        });
      }
      return res.json({ success: true, action: 'deleted' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (existing) {
      await db.execute({
        sql: 'UPDATE explicit_debts SET amount = ? WHERE id = ?',
        args: [parsedAmount, existing.id]
      });
      return res.json({ success: true, action: 'updated' });
    } else {
      await db.execute({
        sql: 'INSERT INTO explicit_debts (event_id, creditor_id, debtor_id, amount) VALUES (?, ?, ?, ?)',
        args: [activeEvent.id, creditor_id, debtor_id, parsedAmount]
      });

      // Notify the debtor
      sendPushToUser(debtor_id, {
          title: '💰 Extra Debt Added',
          body: `Someone added a £${parsedAmount.toFixed(2)} debt for you.`,
          data: { url: '/' }
      });

      return res.json({ success: true, action: 'created' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

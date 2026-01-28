import express from 'express';
import db from '../database/db.js';

const router = express.Router();

// Get active event and expenses
router.get('/current', async (req, res) => {
  try {
    // Find valid active event
    const eventResult = await db.execute('SELECT * FROM events WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
    const activeEvent = eventResult.rows[0];
    
    if (!activeEvent) {
      return res.json({
        active: false,
        event: null,
        expenses: [],
        error: "No active event found."
      });
    }
    
    // Get expenses for active event, JOIN with users to get names/avatars
    const expensesResult = await db.execute({
      sql: `
        SELECT e.*, u.name as user_name, u.avatar as user_avatar
        FROM expenses e 
        JOIN users u ON e.user_id = u.id 
        WHERE e.event_id = ?
        ORDER BY u.name
      `,
      args: [activeEvent.id]
    });
    const expenses = expensesResult.rows;
    
    // Return formatted structure
    const result = expenses.map(e => ({
        user_id: e.user_id,
        user_name: e.user_name,
        user_avatar: e.user_avatar,
        amount: e.amount,
        updated_at: e.updated_at
    }));
    
    const enteredExpenses = expenses.filter(e => e.amount !== null);
    const total = enteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const userCount = expenses.length; 
    const perHead = userCount > 0 ? (total / userCount).toFixed(2) : 0;
    
    res.json({
      active: true,
      event: activeEvent,
      expenses: result,
      stats: {
        total,
        users_count: userCount,
        per_head: perHead
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update expense for ACTIVE event
router.post('/update', async (req, res) => {
  try {
    const { user_id, amount } = req.body;
    
    const eventResult = await db.execute('SELECT id FROM events WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
    const activeEvent = eventResult.rows[0];
    if (!activeEvent) return res.status(400).json({ error: "No active event" });

    const existingResult = await db.execute({
      sql: 'SELECT id FROM expenses WHERE user_id = ? AND event_id = ?',
      args: [user_id, activeEvent.id]
    });
    const existing = existingResult.rows[0];
    
    if (existing) {
      await db.execute({
        sql: 'UPDATE expenses SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [amount, existing.id]
      });
    } else {
      await db.execute({
        sql: 'INSERT INTO expenses (event_id, user_id, amount) VALUES (?, ?, ?)',
        args: [activeEvent.id, user_id, amount]
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

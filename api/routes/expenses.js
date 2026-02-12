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
    
    // Get expenses for active event, JOIN with users to get names (NO avatars - they're cached client-side)
    const expensesResult = await db.execute({
      sql: `
        SELECT e.*, u.name as user_name
        FROM expenses e 
        JOIN users u ON e.user_id = u.id 
        WHERE e.event_id = ?
        ORDER BY u.name
      `,
      args: [activeEvent.id]
    });
    const expenses = expensesResult.rows;
    
    // Return formatted structure (avatar comes from client-side userStore)
    const result = expenses.map(e => ({
        user_id: e.user_id,
        user_name: e.user_name,
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
      sql: 'SELECT id, amount FROM expenses WHERE user_id = ? AND event_id = ?',
      args: [user_id, activeEvent.id]
    });
    const existing = existingResult.rows[0];
    
    if (existing) {
      // Check if this is the FIRST time entering (was null)
      const wasNull = existing.amount === null;
      
      await db.execute({
        sql: 'UPDATE expenses SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [amount, existing.id]
      });

      // Gandu Logic: If was null, and now is NOT null, check if this completes the group
          const allExpensesResult = await db.execute({
            sql: 'SELECT user_id, amount FROM expenses WHERE event_id = ?',
            args: [activeEvent.id]
          });
          const allExpenses = allExpensesResult.rows;
          const remainingUsers = allExpenses.filter(e => e.amount === null);

          // Proactive Identification: If only 1 person is left, they are the Gandu!
          if (remainingUsers.length === 1) {
              const identifiedGanduId = remainingUsers[0].user_id;

              const eventDetail = await db.execute({
                sql: 'SELECT gandu_id FROM events WHERE id = ?',
                args: [activeEvent.id]
              });
              
              if (eventDetail.rows[0] && eventDetail.rows[0].gandu_id === null) {
                  await db.execute({
                    sql: 'UPDATE events SET gandu_id = ? WHERE id = ?',
                    args: [identifiedGanduId, activeEvent.id]
                  });
                  console.log(`Gandu identified proactive (1 left): User ${identifiedGanduId}`);
              }
          }
    } else {
      await db.execute({
        sql: 'INSERT INTO expenses (event_id, user_id, amount) VALUES (?, ?, ?)',
        args: [activeEvent.id, user_id, amount]
      });
      // For new insertion, if it's the last one (rare case since participants are usually per-invited)
      // participants_count isn't always mapping to expenses rows count if not initialized.
      // But in this app, participants are added to expenses table upon event start.
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

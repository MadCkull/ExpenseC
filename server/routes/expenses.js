import express from 'express';
import db from '../database/db.js';
import { sendPushToEvent, sendPushToUser } from '../utils/pushService.js';

const router = express.Router();

// Helper: archive an event (shared logic with events.js)
async function autoArchiveEvent(eventId) {
    const expensesResult = await db.execute({
        sql: 'SELECT e.amount, u.id as user_id FROM expenses e JOIN users u ON e.user_id = u.id WHERE e.event_id = ?',
        args: [eventId]
    });
    const expenses = expensesResult.rows;
    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const count = expenses.length;
    const perHead = count > 0 ? (total / count) : 0;

    const debtsResult = await db.execute({
        sql: 'SELECT creditor_id, debtor_id, amount FROM explicit_debts WHERE event_id = ?',
        args: [eventId]
    });

    // Settlement calculation (same as events.js archive)
    const balances = expenses.map(u => ({ user_id: u.user_id, balance: (u.amount || 0) - perHead }));
    for (const debt of debtsResult.rows) {
        const cr = balances.find(b => b.user_id == debt.creditor_id);
        const dr = balances.find(b => b.user_id == debt.debtor_id);
        if (cr && dr) { cr.balance += debt.amount; dr.balance -= debt.amount; }
    }
    const debtors = balances.filter(b => b.balance < -0.01).sort((a,b) => a.balance - b.balance);
    const creditors = balances.filter(b => b.balance > 0.01).sort((a,b) => b.balance - a.balance);
    const settlements = [];
    let d_idx = 0, c_idx = 0;
    const d_list = debtors.map(d => ({...d, balance: Math.abs(d.balance)}));
    const c_list = creditors.map(c => ({...c}));
    while (d_idx < d_list.length && c_idx < c_list.length) {
        const d = d_list[d_idx], c = c_list[c_idx], amt = Math.min(d.balance, c.balance);
        if (amt > 0.01) settlements.push({ from: { user_id: d.user_id }, to: { user_id: c.user_id }, amount: Number(amt.toFixed(2)) });
        d.balance -= amt; c.balance -= amt;
        if (d.balance <= 0.01) d_idx++;
        if (c.balance <= 0.01) c_idx++;
    }

    await db.execute({
        sql: 'UPDATE events SET is_active = 0, archived_at = CURRENT_TIMESTAMP, total_amount = ?, per_head = ?, participants_count = ?, settlements_json = ? WHERE id = ?',
        args: [total, perHead.toFixed(2), count, JSON.stringify(settlements), eventId]
    });

    return { total, perHead, count, settlements };
}

// Get active event and expenses
router.get('/current', async (req, res) => {
  try {
    const eventResult = await db.execute('SELECT * FROM events WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
    const activeEvent = eventResult.rows[0];
    
    if (!activeEvent) {
      // No active event — return the most recently archived event as lastEvent
      const lastResult = await db.execute('SELECT * FROM events WHERE is_active = 0 ORDER BY archived_at DESC LIMIT 1');
      const lastEvent = lastResult.rows[0] || null;

      let lastEventExpenses = [];
      if (lastEvent) {
          const expRes = await db.execute({
              sql: 'SELECT user_id, amount FROM expenses WHERE event_id = ?',
              args: [lastEvent.id]
          });
          lastEventExpenses = expRes.rows;
      }

      return res.json({
        active: false,
        event: null,
        expenses: [],
        explicitDebts: [],
        stats: { total: 0, users_count: 0, per_head: 0 },
        lastEvent: lastEvent ? {
          id: lastEvent.id,
          name: lastEvent.name,
          start_date: lastEvent.start_date,
          end_date: lastEvent.end_date,
          total_amount: lastEvent.total_amount,
          per_head: lastEvent.per_head,
          participants_count: lastEvent.participants_count,
          settlements_json: lastEvent.settlements_json,
          gandu_id: lastEvent.gandu_id,
          expenses: lastEventExpenses
        } : null
      });
    }
    
    // Get expenses for active event
    const expensesResult = await db.execute({
      sql: `SELECT e.*, u.name as user_name FROM expenses e JOIN users u ON e.user_id = u.id WHERE e.event_id = ? ORDER BY u.name`,
      args: [activeEvent.id]
    });
    const expenses = expensesResult.rows;
    
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

    const debtsResult = await db.execute({
      sql: 'SELECT creditor_id, debtor_id, amount FROM explicit_debts WHERE event_id = ?',
      args: [activeEvent.id]
    });
    const explicitDebts = debtsResult.rows.map(d => ({
      creditor_id: d.creditor_id,
      debtor_id: d.debtor_id,
      amount: d.amount
    }));
    
    res.json({
      active: true,
      event: activeEvent,
      expenses: result,
      explicitDebts,
      stats: { total, users_count: userCount, per_head: perHead }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update expense for ACTIVE event
router.post('/update', async (req, res) => {
  try {
    const { user_id, amount } = req.body;
    
    const eventResult = await db.execute('SELECT id, name FROM events WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
    const activeEvent = eventResult.rows[0];
    if (!activeEvent) return res.status(400).json({ error: "No active event" });

    const existingResult = await db.execute({
      sql: 'SELECT id, amount FROM expenses WHERE user_id = ? AND event_id = ?',
      args: [user_id, activeEvent.id]
    });
    const existing = existingResult.rows[0];
    
    if (existing) {
      await db.execute({
        sql: 'UPDATE expenses SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [amount, existing.id]
      });

      // Gandu + auto-archive check
      const allExpensesResult = await db.execute({
        sql: 'SELECT user_id, amount FROM expenses WHERE event_id = ?',
        args: [activeEvent.id]
      });
      const allExpenses = allExpensesResult.rows;
      const remainingUsers = allExpenses.filter(e => e.amount === null);

      // Proactive Gandu ID: If only 1 person is left, they are the Gandu
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
              
              // Notify the Gandu
              sendPushToUser(identifiedGanduId, {
                  title: 'Hey Gandu!',
                  body: 'Please add your Expenses...',
                  data: { url: '/' }
              });
          }
      }

      // AUTO-ARCHIVE: If ALL users have entered (no remaining nulls), archive the event
      if (remainingUsers.length === 0 && amount !== null) {
          await autoArchiveEvent(activeEvent.id);
          // Send push notification to all participants
          sendPushToEvent(activeEvent.id, {
              title: 'Expenses In!',
              body: `${activeEvent.name} is complete. Check your summary!`,
              data: { url: '/' }
          });
      }
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

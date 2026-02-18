import express from 'express';
import db from '../database/db.js';
import { formatToEng, parseFromEng } from '../utils/dateUtils.js';

const router = express.Router();

// Get all events (active + archived)
router.get('/history', async (req, res) => {
  try {
    // Sorting: Latest First (start_date then created_at)
    const eventsResult = await db.execute('SELECT * FROM events ORDER BY start_date DESC, created_at DESC');
    const events = eventsResult.rows;
    
    // Pre-fetch live totals for active events in a single query (avoid N+1)
    const liveTotalsResult = await db.execute(
      'SELECT event_id, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM expenses GROUP BY event_id'
    );
    const liveTotals = new Map(liveTotalsResult.rows.map(r => [r.event_id, r]));

    const history = events.map(event => {
       // If event is archived and has locked stats, use them
       if (event.is_active === 0 && event.settlements_json) {
           return {
              ...event,
              start_date: formatToEng(event.start_date),
              end_date: formatToEng(event.end_date),
              total_amount: event.total_amount,
              per_person: event.per_head,
              participants_count: event.participants_count,
              settlements: JSON.parse(event.settlements_json)
           };
       }

       // Otherwise use pre-fetched live totals
       const live = liveTotals.get(event.id) || { count: 0, total: 0 };
       const perHead = live.count > 0 ? (live.total / live.count).toFixed(2) : 0;
       
       return {
          ...event,
          start_date: formatToEng(event.start_date),
          end_date: formatToEng(event.end_date),
          total_amount: live.total,
          per_person: perHead,
          participants_count: live.count
       };
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start New Event
router.post('/start', async (req, res) => {
  const { name, participant_ids, start_date, end_date } = req.body;
  
  if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: "Name and Date Range are required." });
  }
  
  try {
    // Archive other active events
    await db.execute('UPDATE events SET is_active = 0, archived_at = CURRENT_TIMESTAMP WHERE is_active = 1');
    
    // Insert new event
    const result = await db.execute({
      sql: 'INSERT INTO events (name, start_date, end_date) VALUES (?, ?, ?)',
      args: [name, parseFromEng(start_date), parseFromEng(end_date)]
    });
    const eventId = String(result.lastInsertRowid);

    let usersToAdd = participant_ids;
    if (!usersToAdd || !Array.isArray(usersToAdd)) {
       const allUsersResult = await db.execute('SELECT id FROM users WHERE is_active = 1');
       usersToAdd = allUsersResult.rows.map(u => u.id);
    }
    
    // Using batch for expenses insertion
    const expenseStatements = usersToAdd.map(uid => ({
      sql: 'INSERT INTO expenses (event_id, user_id, amount) VALUES (?, ?, NULL)',
      args: [eventId, uid]
    }));
    
    if (expenseStatements.length > 0) {
      await db.batch(expenseStatements, "write");
    }
    
    res.json({ success: true, id: eventId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics Endpoint
router.get('/analytics', async (req, res) => {
   try {
     const { start_date, end_date } = req.query;
     
     let dateFilter = '';
     let params = [];
     
     if (start_date) {
       dateFilter += ' AND e.start_date >= ?';
       params.push(start_date);
     }
     if (end_date) {
       dateFilter += ' AND e.start_date <= ?';
       params.push(end_date);
     }
     
     // 1. Total Spending per Event
     const eventsQuery = {
        sql: `
          SELECT e.name, e.start_date, e.end_date, COALESCE(SUM(x.amount), 0) as total
          FROM events e
          JOIN expenses x ON e.id = x.event_id
          WHERE 1=1 ${dateFilter}
          GROUP BY e.id
          ORDER BY e.start_date ASC
        `,
        args: params
     };
     const eventsResult = await db.execute(eventsQuery);
     
     // 2. Spending by User (Global Aggregation for selected range)
     const usersQuery = {
        sql: `
          SELECT u.id, u.name, COALESCE(SUM(x.amount), 0) as total
          FROM expenses x
          JOIN users u ON x.user_id = u.id
          JOIN events e ON x.event_id = e.id
          WHERE 1=1 ${dateFilter}
          GROUP BY u.id
          ORDER BY total DESC
        `,
        args: params
     };
     const usersResult = await db.execute(usersQuery);
     
     res.json({
        timeline: eventsResult.rows.map(e => ({
            ...e,
            start_date: formatToEng(e.start_date),
            end_date: formatToEng(e.end_date),
            created_at: formatToEng(e.start_date)
        })),
        by_user: usersResult.rows
     });
   } catch (error) {
     res.status(500).json({ error: error.message });
   }
});

// Archive specific event (with snapshot)
router.post('/archive', async (req, res) => {
  try {
    const { id } = req.body;
    
    // 1. Find the target event
    let event;
    if (id) {
      const result = await db.execute({
        sql: 'SELECT * FROM events WHERE id = ?',
        args: [id]
      });
      event = result.rows[0];
    } else {
      const result = await db.execute('SELECT * FROM events WHERE is_active = 1 LIMIT 1');
      event = result.rows[0];
    }
    
    if (!event) return res.status(404).json({ error: "Event not found" });

    // 2. Fetch live data for snapshot
    const expensesResult = await db.execute({
      sql: `
        SELECT e.amount, u.id as user_id
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        WHERE e.event_id = ?
      `,
      args: [event.id]
    });
    const expenses = expensesResult.rows;
    
    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const count = expenses.length > 0 ? expenses.length : 0;
    const perHead = count > 0 ? (total / count) : 0;

    // 3. Simple Settlement Calculation
    const calculateSettlements = (exps, ph) => {
        const balances = exps.map(u => ({
            user_id: u.user_id,
            balance: (u.amount || 0) - ph
        }));
        const debtors = balances.filter(b => b.balance < -0.01).sort((a,b) => a.balance - b.balance);
        const creditors = balances.filter(b => b.balance > 0.01).sort((a,b) => b.balance - a.balance);
        const settlements = [];
        let d_idx = 0; let c_idx = 0;
        const d_list = debtors.map(d => ({...d, balance: Math.abs(d.balance)}));
        const c_list = creditors.map(c => ({...c}));
        while (d_idx < d_list.length && c_idx < c_list.length) {
            const d = d_list[d_idx]; const c = c_list[c_idx]; const amt = Math.min(d.balance, c.balance);
            if (amt > 0.01) {
                settlements.push({
                    from: { user_id: d.user_id },
                    to: { user_id: c.user_id },
                    amount: Number(amt.toFixed(2))
                });
            }
            d.balance -= amt; c.balance -= amt;
            if (d.balance <= 0.01) d_idx++;
            if (c.balance <= 0.01) c_idx++;
        }
        return settlements;
    };

    const settlements = calculateSettlements(expenses, perHead);

    // 4. Update Event with Locked Stats and Archive it
    await db.execute({
      sql: `
        UPDATE events 
        SET is_active = 0, 
            archived_at = CURRENT_TIMESTAMP,
            total_amount = ?,
            per_head = ?,
            participants_count = ?,
            settlements_json = ?
        WHERE id = ?
      `,
      args: [total, perHead.toFixed(2), count, JSON.stringify(settlements), event.id]
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete event
router.delete('/:id', async (req, res) => {
   try {
     const { id } = req.params;
     await db.execute({ sql: 'DELETE FROM expenses WHERE event_id = ?', args: [id] });
     await db.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [id] });
     res.json({ success: true });
   } catch (error) {
     res.status(500).json({ error: error.message });
   }
});

export default router;

import express from 'express';
import db from '../database/db.js';

const router = express.Router();

/**
 * GET /api/analytics/summary
 * Query Params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
 */
router.get('/summary', async (req, res) => {
  const { start_date, end_date } = req.query;

  // Base WHERE clause for date filtering
  // If no dates provided, we default to ALL time (as typical for specific date range logic usually implies restrictive, but if empty we show all)
  // However, user said "by default it's all time".
  let dateFilter = '1=1';
  const args = [];

  if (start_date) {
    dateFilter += ' AND (end_date >= ? OR (start_date >= ?))'; // logic: event overlaps or starts after
    // Simpler logic: Event Start Date needed. 
    // Let's assume we filter by Event Start Date for simplicity and consistency.
    dateFilter = 'date(start_date) >= ?';
    args.push(start_date);
  }
  
  if (end_date) {
      if (start_date) {
          dateFilter += ' AND date(end_date) <= ?';
      } else {
          dateFilter = 'date(end_date) <= ?';
      }
      args.push(end_date);
  }

  try {
    // 1. Overall Summary (Total Spent, Count)
    // Note: total_amount in 'events' table is what we use.
    const summaryQuery = await db.execute({
        sql: `SELECT 
                SUM(e.amount) as total_spent, 
                COUNT(DISTINCT ev.id) as total_events, 
                AVG(sub.event_total) as avg_cost 
              FROM expenses e
              JOIN events ev ON e.event_id = ev.id
              LEFT JOIN (
                  SELECT event_id, SUM(amount) as event_total 
                  FROM expenses 
                  GROUP BY event_id
              ) sub ON ev.id = sub.event_id
              WHERE ${dateFilter.replace(/start_date/g, 'ev.start_date').replace(/end_date/g, 'ev.end_date')}`,
        args: args
    });
    
    // 2. Timeline (for Line Chart)
    const timelineQuery = await db.execute({
        sql: `SELECT ev.id, ev.name, ev.start_date, SUM(e.amount) as total_amount 
              FROM events ev
              JOIN expenses e ON e.event_id = ev.id
              WHERE ${dateFilter.replace(/start_date/g, 'ev.start_date').replace(/end_date/g, 'ev.end_date')}
              GROUP BY ev.id
              ORDER BY ev.start_date ASC`,
        args: args
    });

    // 3. User Breakdown (Who paid what?)
    // This requires joining expenses.
    // We need to sum expenses per user for the filtered events.
    const userQuery = await db.execute({
        sql: `SELECT u.id, u.name, SUM(e.amount) as total_paid
              FROM expenses e
              JOIN events ev ON e.event_id = ev.id
              JOIN users u ON e.user_id = u.id
              WHERE ${dateFilter.replace(/start_date/g, 'ev.start_date').replace(/end_date/g, 'ev.end_date')}
              GROUP BY u.id
              ORDER BY total_paid DESC`,
        args: args
    });

    // 4. Highlights (Max/Min)
    // We can extract this from timelineQuery manually or SQL.
    // Let's do it in JS from timelineQuery to save a DB call if list is small, 
    // but SQL is safer for large datasets.
    // Let's allow JS to do it since we already fetched timeline.
    
    const stats = summaryQuery.rows[0];
    const timeline = timelineQuery.rows;
    const byUser = userQuery.rows;

    let maxEvent = null;
    let minEvent = null;

    if (timeline.length > 0) {
        maxEvent = timeline.reduce((prev, current) => (prev.total_amount > current.total_amount) ? prev : current);
        minEvent = timeline.reduce((prev, current) => (prev.total_amount < current.total_amount) ? prev : current);
    }

    res.json({
        summary: {
            total: stats.total_spent || 0,
            count: stats.total_events || 0,
            avg: stats.avg_cost || 0
        },
        timeline: timeline,
        by_user: byUser,
        highlights: {
            max: maxEvent,
            min: minEvent
        }
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

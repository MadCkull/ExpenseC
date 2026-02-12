import express from 'express';
import db from '../database/db.js';

const router = express.Router();

/**
 * Get Gandu Stats & History
 */
router.get('/stats', async (req, res) => {
    try {
        // 1. Get History of Gandus (last 50 events)
        const historyResult = await db.execute(`
            SELECT 
                ev.id as event_id, 
                ev.name as event_name, 
                ev.archived_at, 
                u.id as user_id, 
                u.name as user_name,
                u.avatar as user_avatar
            FROM events ev
            JOIN users u ON ev.gandu_id = u.id
            ORDER BY ev.archived_at DESC
            LIMIT 50
        `);
        const history = historyResult.rows;

        // 2. Get Leaderboard (Total Gandu counts)
        const leaderboardResult = await db.execute(`
            SELECT 
                u.id as user_id, 
                u.name as user_name, 
                u.avatar as user_avatar,
                COUNT(ev.id) as gandu_count,
                MAX(ev.archived_at) as last_gandu_at
            FROM users u
            JOIN events ev ON ev.gandu_id = u.id
            GROUP BY u.id
            ORDER BY gandu_count DESC, last_gandu_at DESC
        `);
        const leaderboard = leaderboardResult.rows;

        // 3. Identify King of Gandus
        const king = leaderboard.length > 0 ? leaderboard[0] : null;

        res.json({
            history,
            leaderboard,
            king
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

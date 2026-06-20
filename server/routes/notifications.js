import express from 'express';
import db from '../database/db.js';

const router = express.Router();

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
    try {
        const { user_id, subscription } = req.body;

        if (!user_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            return res.status(400).json({ error: 'user_id and valid subscription are required' });
        }

        // Upsert: if endpoint already exists, update keys
        const existing = await db.execute({
            sql: 'SELECT id FROM push_subscriptions WHERE endpoint = ?',
            args: [subscription.endpoint]
        });

        if (existing.rows.length > 0) {
            await db.execute({
                sql: 'UPDATE push_subscriptions SET user_id = ?, keys_p256dh = ?, keys_auth = ? WHERE endpoint = ?',
                args: [user_id, subscription.keys.p256dh, subscription.keys.auth, subscription.endpoint]
            });
        } else {
            await db.execute({
                sql: 'INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)',
                args: [user_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

        await db.execute({
            sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
            args: [endpoint]
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

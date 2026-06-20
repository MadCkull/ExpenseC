import webpush from 'web-push';
import db from '../database/db.js';

// Configure VAPID keys (only if available — silently skip in dev/test if missing)
const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@expensec.app';

if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
    console.log('✅ Web Push configured');
} else {
    console.warn('⚠️ VAPID keys not set — push notifications disabled');
}

/**
 * Send a push notification to a specific user (all their subscriptions).
 * Silently cleans up expired subscriptions (410 Gone).
 */
export async function sendPushToUser(userId, payload) {
    if (!vapidPublic || !vapidPrivate) return;

    try {
        const result = await db.execute({
            sql: 'SELECT id, endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = ?',
            args: [userId]
        });

        for (const sub of result.rows) {
            const pushSub = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
            };

            try {
                await webpush.sendNotification(pushSub, JSON.stringify(payload));
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired — clean it up
                    await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE id = ?', args: [sub.id] });
                    console.log(`Cleaned up expired subscription ${sub.id}`);
                } else {
                    console.error(`Push failed for sub ${sub.id}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error('sendPushToUser error:', err.message);
    }
}

/**
 * Send a push notification to all participants of an event.
 * @param {number} eventId - The event ID
 * @param {object} payload - { title, body, url }
 * @param {number|null} excludeUserId - Optional user to exclude (e.g. the person who triggered the action)
 */
export async function sendPushToEvent(eventId, payload, excludeUserId = null) {
    if (!vapidPublic || !vapidPrivate) return;

    try {
        const result = await db.execute({
            sql: 'SELECT DISTINCT user_id FROM expenses WHERE event_id = ?',
            args: [eventId]
        });

        const userIds = result.rows
            .map(r => r.user_id)
            .filter(id => excludeUserId === null || id != excludeUserId);

        await Promise.allSettled(userIds.map(uid => sendPushToUser(uid, payload)));
    } catch (err) {
        console.error('sendPushToEvent error:', err.message);
    }
}

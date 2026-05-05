import { api } from './api.js';

// VAPID public key — safe to expose (generated from your VAPID keypair)
const VAPID_PUBLIC_KEY = 'BAiqUMvK_Rkly4-a_K-FOj8tqQQbFzy3OAHXb6UjK0poU7KjJHbT3Y2w4-M7jJPLfv_lNELZ9OW_CT0gERjAZgE';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
    return arr;
}

export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Subscribe the current browser to push notifications for a given user.
 * Returns true if subscribed successfully, false otherwise.
 */
export async function subscribeToPush(userId) {
    if (!isPushSupported()) return false;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return false;

        const registration = await navigator.serviceWorker.ready;
        
        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        // Send subscription to backend
        await api.notifications.subscribe(userId, subscription.toJSON());
        console.log('✅ Push subscription registered');
        return true;
    } catch (err) {
        console.error('Push subscription failed:', err);
        return false;
    }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush() {
    if (!isPushSupported()) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            await api.notifications.unsubscribe(subscription.endpoint);
        }
    } catch (err) {
        console.error('Push unsubscribe failed:', err);
    }
}

/**
 * Check if already subscribed (without prompting).
 */
export async function isSubscribed() {
    if (!isPushSupported()) return false;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    } catch {
        return false;
    }
}

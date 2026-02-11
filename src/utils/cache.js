/**
 * Lightweight localStorage cache with TTL support.
 * Strategy: "Show First, Sync Later" — render from cache instantly, refresh in background.
 */

const PREFIX = 'ec_cache_';

export const CACHE_KEYS = {
  CURRENT_EXPENSES: 'current_expenses',
  EVENT_HISTORY: 'event_history',
  USERS_LIST: 'users_list',
};

// TTLs in milliseconds
export const TTL = {
  SHORT: 30 * 1000,       // 30 seconds — for active expense data
  MEDIUM: 5 * 60 * 1000,  // 5 minutes — for event history
  LONG: 60 * 60 * 1000,   // 1 hour — for user profiles/avatars
};

export const cache = {
  /**
   * Get cached data. Returns null if not found.
   */
  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.data;
    } catch {
      return null;
    }
  },

  /**
   * Store data with current timestamp.
   */
  set(key, data) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify({
        data,
        ts: Date.now()
      }));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('Cache quota exceeded, clearing old entries...');
        this.clear(); // Clear everything and try once more
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify({
            data,
            ts: Date.now()
          }));
        } catch (e2) {
          console.error('Cache write still failing after clear:', e2);
        }
      } else {
        console.warn('Cache write failed:', e);
      }
    }
  },

  /**
   * Check if cached data is older than the given TTL.
   * Returns true if stale or missing.
   */
  isStale(key, ttlMs) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return true;
      const { ts } = JSON.parse(raw);
      return (Date.now() - ts) > ttlMs;
    } catch {
      return true;
    }
  },

  /**
   * Remove a specific cache entry (forces re-fetch next time).
   */
  invalidate(key) {
    localStorage.removeItem(PREFIX + key);
  },

  /**
   * Clear all cache entries.
   */
  clear() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }
};

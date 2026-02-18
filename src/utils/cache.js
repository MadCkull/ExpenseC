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
  SHORT: 1 * 60 * 1000,   // 1 min — for active expense data
  MEDIUM: 10 * 60 * 1000, // 10 mins — for event history
  LONG: 60 * 60 * 1000,   // 1 hour — for user profiles/avatars
};

// Max sizes per key (in characters) to prevent localStorage overflow
const MAX_SIZE = {
  [CACHE_KEYS.CURRENT_EXPENSES]: 100_000,   // ~100KB
  [CACHE_KEYS.EVENT_HISTORY]: 200_000,       // ~200KB
  [CACHE_KEYS.USERS_LIST]: 50_000,           // ~50KB
};

export const cache = {
  /**
   * Get cached data. Returns null if expired or not found.
   * @param {string} key
   * @param {number} ttlMs - TTL in milliseconds. If provided, returns null for stale data.
   */
  get(key, ttlMs) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      // Enforce TTL if provided
      if (ttlMs && (Date.now() - parsed.ts) > ttlMs) {
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  },

  /**
   * Get data regardless of age (for "show stale, refresh in background" pattern).
   * Returns null only if key doesn't exist.
   */
  getSoft(key) {
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
      const payload = JSON.stringify({ data, ts: Date.now() });

      // Check size limit before storing
      const limit = MAX_SIZE[key];
      if (limit && payload.length > limit) {
        console.warn(`Cache: Skipping write for '${key}' — payload (${(payload.length / 1024).toFixed(0)}KB) exceeds limit`);
        return;
      }

      localStorage.setItem(PREFIX + key, payload);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('Cache quota exceeded, clearing old entries...');
        this.clear(); // Clear everything and try once more
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
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

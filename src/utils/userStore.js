/**
 * UserStore — Central avatar/profile cache.
 * 
 * Problem: Base64 avatars are huge (~100KB+ each). Including them in every API 
 * response causes massive network transfers and localStorage quota overflow.
 * 
 * Solution: Fetch user profiles ONCE, cache them in memory + IndexedDB,
 * and provide instant avatar lookup for all components.
 */

const DB_NAME = 'expensec_store';
const DB_VERSION = 2; // Bump version for schema change (though we just clear often)
const STORE_NAME = 'users';
const META_KEY = '__userstore_meta';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// In-memory cache for instant access
// Key: string(id), Value: { id, name, avatar_thumb }
let _users = new Map();
let _loaded = false;
let _loadPromise = null;

// --- IndexedDB helpers ---
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

/**
 * Replace all IDB entries with the given users array.
 * Clears first to remove deleted/stale users.
 */
async function idbReplaceAll(users) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Clear first
    store.clear();

    for (const u of users) {
      store.put(u);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* silently fail */ }
}

// --- Timestamp tracking ---
function getLastFetchTime() {
  try {
    return parseInt(localStorage.getItem(META_KEY) || '0');
  } catch { return 0; }
}

function setLastFetchTime() {
  try {
    localStorage.setItem(META_KEY, Date.now().toString());
  } catch { /* ignore */ }
}

// --- Public API ---

export const userStore = {
  /**
   * Get avatar THUMBNAIL URL for a user ID. Returns null if not cached.
   * This is synchronous and instant — no network call.
   */
  getAvatar(userId) {
    const user = _users.get(String(userId));
    return user?.avatar_thumb || null;
  },

  /**
   * Get user name for a user ID.
   */
  getName(userId) {
    const user = _users.get(String(userId));
    return user?.name || null;
  },

  /**
   * Get full user object { id, name, avatar_thumb, is_active }
   */
  getUser(userId) {
    return _users.get(String(userId)) || null;
  },
  
  /**
   * Get ALL users (including inactive/deleted) - useful for history rendering
   */
  getAllIncludingDeleted() {
      return Array.from(_users.values());
  },

  /**
   * Check if the store is loaded (at least from IDB cache).
   */
  get isLoaded() {
    return _loaded;
  },

  /**
   * Initialize the store — loads from IndexedDB cache instantly,
   * then fetches fresh data from API in background.
   */
  async init() {
    if (_loadPromise) return _loadPromise;
    
    _loadPromise = (async () => {
      // Step 1: Load from IndexedDB (instant)
      try {
        const cached = await idbGetAll();
        if (cached.length > 0) {
          for (const u of cached) {
            _users.set(String(u.id), u);
          }
          _loaded = true;
          this._notify();
        }
      } catch { /* ignore */ }

      // Step 2: Fetch fresh from API (skip if recently fetched)
      // We fetch ALL users (including inactive) to ensure history renders correctly
      const elapsed = Date.now() - getLastFetchTime();
      if (elapsed > REFRESH_INTERVAL || !_users.size) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL || '/api'}/users?include=all`
          );
          if (response.ok) {
            const users = await response.json();
            
            _users.clear(); // Clear memory map
            for (const u of users) {
              _users.set(String(u.id), u);
            }
            
            _loaded = true;
            setLastFetchTime();
            this._notify();
            
            // Update IDB
            idbReplaceAll(users);
          }
        } catch (e) {
          console.warn('UserStore: API fetch failed, using cached data', e);
        }
      }

      _loaded = true;
      _loadPromise = null;
    })();

    return _loadPromise;
  },

  /**
   * Force refresh user data (call after avatar change in admin).
   */
  async refresh() {
    _loadPromise = null;
    // Clear last fetch time to force API call
    try { localStorage.removeItem(META_KEY); } catch { /* ignore */ }
    return this.init();
  },

  /**
   * Internal change notification.
   */
  _notify() {
    window.dispatchEvent(new CustomEvent('userstore-changed'));
  },

  /**
   * Subscription helper.
   */
  subscribe(callback) {
    window.addEventListener('userstore-changed', callback);
    return () => window.removeEventListener('userstore-changed', callback);
  }
};

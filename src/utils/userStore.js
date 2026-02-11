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
const DB_VERSION = 1;
const STORE_NAME = 'users';

// In-memory cache for instant access
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

async function idbPutAll(users) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const u of users) {
      store.put(u);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* silently fail */ }
}

// --- Public API ---

export const userStore = {
  /**
   * Get avatar URL for a user ID. Returns null if not cached.
   * This is synchronous and instant — no network call.
   */
  getAvatar(userId) {
    const user = _users.get(String(userId));
    return user?.avatar || null;
  },

  /**
   * Get user name for a user ID.
   */
  getName(userId) {
    const user = _users.get(String(userId));
    return user?.name || null;
  },

  /**
   * Get full user data.
   */
  getUser(userId) {
    return _users.get(String(userId)) || null;
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
   * Returns a promise that resolves when at least IDB data is available.
   */
  async init() {
    if (_loadPromise) return _loadPromise;
    
    _loadPromise = (async () => {
      // Step 1: Load from IndexedDB (instant, offline-capable)
      try {
        const cached = await idbGetAll();
        if (cached.length > 0) {
          for (const u of cached) {
            _users.set(String(u.id), u);
          }
          _loaded = true;
        }
      } catch { /* ignore */ }

      // Step 2: Fetch fresh from API (background)
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || '/api'}/users`
        );
        if (response.ok) {
          const users = await response.json();
          for (const u of users) {
            _users.set(String(u.id), u);
          }
          _loaded = true;
          this._notify();
          // Persist to IndexedDB (async, non-blocking)
          idbPutAll(users);
        }
      } catch (e) {
        console.warn('UserStore: API fetch failed, using cached data', e);
      }

      _loaded = true;
    })();

    return _loadPromise;
  },

  /**
   * Force refresh user data (call after avatar change in admin).
   */
  async refresh() {
    _loadPromise = null;
    return this.init();
  },

  /**
   * Populate store from an array of user objects (from any API response).
   * This is used to opportunistically cache user data we already have.
   */
  populateFromExpenses(users) {
    let changed = false;
    for (const u of users) {
      const id = String(u.user_id || u.id);
      const name = u.user_name || u.name;
      const avatar = u.user_avatar || u.avatar;

      const existing = _users.get(id);
      // Only update if we have an avatar and it's different (or we didn't have one)
      if (avatar && (!existing || existing.avatar !== avatar)) {
        _users.set(id, { id: parseInt(id), name, avatar });
        changed = true;
      }
    }
    if (changed) {
      this._notify();
      // Update IDB in background
      idbPutAll(Array.from(_users.values()));
    }
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

// Use environment variable for local dev, fallback to relative path for production
const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function fetchJson(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    // Handle non-200
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API Error');
    }
    
    return response.json();
  } catch (error) {
    console.error(`API Call failed: ${endpoint}`, error);
    throw error;
  }
}

export const api = {
  auth: {
    login: (pin) => fetchJson('/auth/login', { method: 'POST', body: JSON.stringify({ pin }) }),
  },
  users: {
    list: () => fetchJson('/users'),
    add: (name, avatar) => fetchJson('/users', { method: 'POST', body: JSON.stringify({ name, avatar }) }),
    update: (id, data) => fetchJson(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => fetchJson(`/users/${id}`, { method: 'DELETE' }),
  },
  expenses: {
    current: () => fetchJson('/expenses/current'),
    update: (user_id, amount) => fetchJson('/expenses/update', { method: 'POST', body: JSON.stringify({ user_id, amount }) }),
  },
  events: {
    history: () => fetchJson(`/events/history?t=${Date.now()}`),
    start: (name, participant_ids, start_date, end_date) => fetchJson('/events/start', { method: 'POST', body: JSON.stringify({ name, participant_ids, start_date, end_date }) }),
    archive: (id) => fetchJson('/events/archive', { method: 'POST', body: JSON.stringify({ id }) }),
    delete: (id) => fetchJson(`/events/${id}`, { method: 'DELETE' }),
    analytics: (start, end) => fetchJson(`/events/analytics?start_date=${start || ''}&end_date=${end || ''}&t=${Date.now()}`),
  },
  analytics: {
    summary: (start, end) => fetchJson(`/analytics/summary?start_date=${start || ''}&end_date=${end || ''}&t=${Date.now()}`),
  },
  gandus: (() => {
    let _cache = null;
    let _lastFetch = 0;
    let _promise = null;
    return {
      stats: async () => {
        const now = Date.now();
        if (_cache && (now - _lastFetch < 300000)) return _cache;
        if (_promise) return _promise;
        _promise = (async () => {
          try {
            const data = await fetchJson('/gandus/stats');
            _cache = data;
            _lastFetch = Date.now();
            return data;
          } finally {
            _promise = null;
          }
        })();
        return _promise;
      },
      invalidate: () => { _cache = null; _promise = null; }
    };
  })(),
  settings: {
    updatePins: (admin_pin, user_pin) => fetchJson('/settings/pins', { method: 'POST', body: JSON.stringify({ admin_pin, user_pin }) }),
  },
  // Generic helper for direct URL fetches (like avatar)
  generic: (endpoint) => fetchJson(endpoint),
};

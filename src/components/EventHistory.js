import { api } from '../utils/api.js';
import { initPullToRefresh } from '../utils/pullToRefresh.js';
import { cache, CACHE_KEYS, TTL } from '../utils/cache.js';
import { uiDate } from '../utils/dateUtils.js';
import { showSettlementModal } from '../utils/settlements.js';
import { userStore } from '../utils/userStore.js';

export function createEventHistory({ onBack, onSelectEvent }) {
  const container = document.createElement('div');
  container.className = 'dashboard container fade-in safe-area-bottom ptr-container';
  
  const scrollWrapper = document.createElement('div');
  scrollWrapper.className = 'scrollable-content';
  container.appendChild(scrollWrapper);
  
  // Hydrate from cache for instant render
  const cached = cache.getSoft(CACHE_KEYS.EVENT_HISTORY);
  let state = {
    loading: !cached,
    history: cached || []
  };

  const render = () => {
    const currentUserId = localStorage.getItem('expensec_user_id');

    let html = `
      <header class="flex justify-between items-center mb-6 safe-area-top">
        <div class="flex items-center gap-sm">
          <button class="ios-btn secondary" id="back-btn" style="width: auto; padding: 8px 12px; display:flex; gap:6px; align-items:center;"><i class="fa-solid fa-chevron-left"></i> Back</button>
          <h1 class="text-xl">History</h1>
        </div>
      </header>
    `;

    if (state.loading) {
       html += '<div class="text-center p-8 text-secondary">Loading...</div>';
       scrollWrapper.innerHTML = html;
       container.querySelector('#back-btn').addEventListener('click', onBack);
       return;
    }

     if (state.history.length === 0) {
         html += '<div class="text-center text-secondary">No events found.</div>';
     } else {
         html += '<div class="flex flex-col gap-sm">';
         state.history.forEach(ev => {
              const range = ev.start_date ? `${uiDate(ev.start_date)} - ${uiDate(ev.end_date)}` : new Date(ev.created_at).toLocaleDateString();
              const isActive = ev.is_active === 1;
              const perHead = typeof ev.per_person === 'number' ? ev.per_person.toFixed(2) : ev.per_person;
              
              html += `
                <div class="event-card ${isActive ? 'is-active' : ''} cursor-pointer" data-id="${ev.id}">
                   <button class="analytics-icon-btn" title="View Analytics">
                      <i class="fa-solid fa-chart-line"></i>
                   </button>

                   <div class="flex flex-col gap-0.5">
                     <span class="font-bold text-[18px] tracking-tight text-white leading-tight pr-10">${ev.name}</span>
                     <span class="text-[9px] text-secondary font-medium opacity-50 uppercase tracking-widest">${range}</span>
                   </div>

                   <div class="event-stats-row">
                      <div class="stat-inline">
                         <span class="stat-inline-label"><i class="fa-solid fa-users" style="font-size: 14px;"></i></span>
                         <span class="stat-inline-value">£${(ev.total_amount || 0).toFixed(2)}</span>
                      </div>
                      <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
                      <div class="stat-inline">
                         <span class="stat-inline-label"><i class="fa-solid fa-user" style="font-size: 12px;"></i></span>
                         <span class="stat-inline-value text-blue">£${perHead}</span>
                      </div>
                   </div>
                </div>
              `;
         });
         html += '</div>';
     }
    
    scrollWrapper.innerHTML = html;
    
    container.querySelector('#back-btn').addEventListener('click', onBack);
    
    container.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', async (e) => {
             // If analytics icon clicked, don't trigger settlement
             if (e.target.closest('.analytics-icon-btn')) return;

             const id = parseInt(card.dataset.id);
             const ev = state.history.find(h => h.id === id);
             if (ev && ev.settlements_json) {
                 // Ensure userStore is ready (including deleted users for historical consistency)
                 await userStore.init();
                 
                 let settlements = ev.settlements_json;
                 if (typeof settlements === 'string') {
                     try { settlements = JSON.parse(settlements); } catch(err) { console.error(err); }
                 }
                 const currentUser = currentUserId ? { user_id: currentUserId } : null;
                 showSettlementModal({ 
                     settlements, 
                     title: `Guide: ${ev.name}`,
                     currentUser: currentUser 
                 });
             } else {
                 // Fallback to analytics if no settlements (shouldn't happen for closed events)
                 if (ev && onSelectEvent) onSelectEvent(ev);
             }
        });
    });

    container.querySelectorAll('.analytics-icon-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.event-card');
            const id = parseInt(card.dataset.id);
            const ev = state.history.find(h => h.id === id);
            if (ev && onSelectEvent) {
                onSelectEvent(ev);
            }
        });
    });
  };

  const load = async (silent = false) => {
     // Only show loading if no cached data
     if (!silent && state.history.length === 0) {
       state.loading = true;
       render();
     }
     // If we have cached data and it's first load, render immediately
     if (!silent && state.history.length > 0 && state.loading) {
       state.loading = false;
       render();
     }
     try {
         const data = await api.events.history();
         
         // Strip settlement blobs before caching to prevent localStorage overflow
         const lightHistory = data.map(h => {
             const { settlements_json, ...rest } = h;
             return rest;
         });
         
         const oldData = cache.get(CACHE_KEYS.EVENT_HISTORY);
         cache.set(CACHE_KEYS.EVENT_HISTORY, lightHistory);
         const changed = JSON.stringify(lightHistory) !== JSON.stringify(oldData);
         state.history = data;
         state.loading = false;
         if (changed || !silent) render();
     } catch(e) { 
       console.error(e);
       if (state.history.length > 0) state.loading = false;
     } finally {
       if (state.loading) { state.loading = false; render(); }
     }
  };
  
  // Render cached data immediately, then refresh
  if (cached) render();
  load(!!cached);
  initPullToRefresh(scrollWrapper, load);

  return container;
}


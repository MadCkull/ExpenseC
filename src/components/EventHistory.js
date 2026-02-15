import { api } from '../utils/api.js';
import { initPullToRefresh } from '../utils/pullToRefresh.js';
import { cache, CACHE_KEYS, TTL } from '../utils/cache.js';
import { uiDate } from '../utils/dateUtils.js';

export function createEventHistory({ onBack, onSelectEvent }) {
  const container = document.createElement('div');
  container.className = 'dashboard container fade-in safe-area-bottom ptr-container';
  
  const scrollWrapper = document.createElement('div');
  scrollWrapper.className = 'scrollable-content';
  container.appendChild(scrollWrapper);
  
  // Hydrate from cache for instant render
  const cached = cache.get(CACHE_KEYS.EVENT_HISTORY);
  let state = {
    loading: !cached,
    history: cached || []
  };

  const render = () => {
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
              const range = ev.start_date ? `${ev.start_date} - ${ev.end_date}` : new Date(ev.created_at).toLocaleDateString();
              const isActive = ev.is_active === 1;
              const perHead = typeof ev.per_person === 'number' ? ev.per_person.toFixed(2) : ev.per_person;
              
              html += `
                <div class="ios-card event-card cursor-pointer" data-id="${ev.id}" style="margin-bottom: 12px; transition: transform 0.2s;">
                   <div class="flex justify-between mb-2">
                     <span class="font-bold text-[16px] tracking-tight">${ev.name} ${isActive ? '<span class="text-[10px] uppercase font-bold text-green bg-green-900/10 px-2 py-0.5 rounded-full ml-2 border border-green/20" style="vertical-align: middle;">Active</span>' : ''}</span>
                     <span class="text-blue font-bold text-[16px]">£${perHead} <span class="text-[9px] opacity-40 uppercase font-bold">/head</span></span>
                   </div>
                   <div class="flex justify-between text-[11px] text-secondary font-medium">
                     <span class="opacity-60">${range}</span>
                     <span class="opacity-80">Total: <span class="text-white">£${(ev.total_amount || 0).toFixed(2)}</span></span>
                   </div>
                </div>
              `;
         });
         html += '</div>';
     }
    
    scrollWrapper.innerHTML = html;
    
    container.querySelector('#back-btn').addEventListener('click', onBack);
    
    container.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => {
             const id = parseInt(card.dataset.id);
             const ev = state.history.find(e => e.id === id);
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
         cache.set(CACHE_KEYS.EVENT_HISTORY, data);
         const changed = JSON.stringify(data) !== JSON.stringify(state.history);
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


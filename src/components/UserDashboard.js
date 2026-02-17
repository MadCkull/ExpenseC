import { api } from '../utils/api.js';
import { initPullToRefresh } from '../utils/pullToRefresh.js';
import { renderAvatar } from '../utils/ui.js';
import { createImageViewer } from './ImageViewer.js';
import { cache, CACHE_KEYS, TTL } from '../utils/cache.js';
import { userStore } from '../utils/userStore.js';
import { uiDate } from '../utils/dateUtils.js';
import { calculateSettlements, showSettlementModal, renderPersonalSummaryCard } from '../utils/settlements.js';

export function createUserDashboard({ role, onLogout }) {
  const container = document.createElement('div');
  container.className = 'dashboard container fade-in safe-area-bottom ptr-container';
  
  // Use scrollable-inner wrapper for content to fix overflow
  const scrollWrapper = document.createElement('div');
  scrollWrapper.className = 'scrollable-content';
  container.appendChild(scrollWrapper);
  
  // Try to hydrate from cache for instant render
  const cached = cache.get(CACHE_KEYS.CURRENT_EXPENSES);
  let state = {
    expenses: cached?.expenses || [],
    stats: cached?.stats || { total: 0, per_head: 0, users_count: 0 },
    loading: !cached,  // Only show loading spinner if no cache exists
    eventName: '',
    active: cached?.active ?? true,
    event: cached?.event || null,
    currentUserId: localStorage.getItem('expensec_user_id'),
    kingUserId: cached?.kingUserId || null
  };

  const unsubscribe = userStore.subscribe(() => {
    if (!state.loading) render();
  });

  const render = () => {
    if (state.loading) {
      scrollWrapper.innerHTML = `
        <header class="flex justify-between items-center mb-6 safe-area-top">
          <div class="flex flex-col w-1/2">
            <div class="skeleton-text w-24"></div>
            <div class="skeleton-text w-16 opacity-50"></div>
          </div>
          <div class="flex gap-2">
            <div class="skeleton-avatar" style="width: 36px; height: 36px;"></div>
            <div class="skeleton-avatar" style="width: 36px; height: 36px;"></div>
            <div class="skeleton-avatar" style="width: 36px; height: 36px;"></div>
          </div>
        </header>
        <div class="skeleton-card"></div>
        <div class="skeleton-text w-32 mb-4"></div>
        <div class="skeleton-card" style="height: 120px;"></div>
        <div class="skeleton-text w-32 mb-4"></div>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      `;
      return;
    }

    if (!state.currentUserId && role !== 'admin' && state.expenses.length > 0) {
        showIdentificationModal();
        scrollWrapper.innerHTML = '<div class="text-center p-8 text-secondary">Please select your name above.</div>';
        return;
    }

    const { expenses, active } = state;
    const currentUser = expenses.find(u => u.user_id == state.currentUserId);
    const userName = currentUser ? currentUser.user_name : 'User';
    const otherUsers = expenses.filter(u => u.user_id != state.currentUserId);
    
    // Header
    let html = `
      <header class="flex justify-between items-center mb-6 safe-area-top">
        <div class="flex flex-col" style="max-width: 60%;">
          <h1 class="text-xl font-bold cursor-pointer hover:opacity-70 flex items-center gap-1" id="current-username">
            ${userName}
          </h1>
          ${state.active && state.event ? `
             <div class="mt-1">
                <div class="text-sm font-semibold">${state.event.name}</div>
                <div class="text-xs text-secondary font-mono">${uiDate(state.event.start_date)} - ${uiDate(state.event.end_date)}</div>
             </div>
          ` : `<p class="text-secondary text-xs mt-1">No Active Event</p>`}
        </div>
        <div class="flex items-center gap-sm">
          <button id="gandu-btn" style="background: rgba(10, 132, 255, 0.1); border: 1px solid rgba(10, 132, 255, 0.3); border-radius: 30px; padding: 0 12px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
            <span style="font-size: 10px; font-weight: 800; color: var(--ios-blue); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">Gandu List</span>
          </button>
          <button class="ios-btn secondary" id="history-btn" style="width: 36px; height: 36px; padding: 0; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-clock-rotate-left"></i></button>
          <button class="ios-btn secondary" id="analytics-btn" style="width: 36px; height: 36px; padding: 0; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-chart-line"></i></button>
          ${role === 'admin' ? '<button class="ios-btn secondary" id="admin-btn" style="width: 36px; height: 36px; padding: 0; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-user-gear"></i></button>' : ''}
          <button class="ios-btn secondary text-red" id="logout-btn" style="width: 36px; height: 36px; padding: 0; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-lock"></i></button>
        </div>
      </header>

      <div id="stats-area">
        ${renderStatsCard()}
      </div>

      <div class="mb-8 mt-2">
         <h3 class="text-xs text-secondary mb-3 uppercase tracking-widest px-1 font-bold" style="margin-bottom: 12px;">Your Spending</h3>
         ${currentUser ? renderHeroInput(currentUser) : ''}
      </div>

      <div class="collaborators-section">
         <h3 class="text-xs text-secondary mb-3 uppercase tracking-widest px-1 font-bold" style="margin-bottom: 12px;">The Group</h3>
         <div class="flex flex-col gap-sm">
            ${otherUsers.length > 0 ? otherUsers.map(u => renderCollaboratorRow(u)).join('') : '<div class="text-center p-4 text-secondary text-sm">No other participants</div>'}
         </div>
      </div>
      
      <div style="height: 100px;"></div>
    `;

    scrollWrapper.innerHTML = html;
    attachListeners();
  };

  const renderStatsCard = () => {
    const { expenses, stats, active } = state;
    const allEntered = active && expenses.length > 0 && expenses.every(u => u.amount !== null);

    if (!active) {
        return `
          <div class="ios-card mb-6" style="background: rgba(255, 69, 58, 0.1); border: 1px solid rgba(255, 69, 58, 0.2);">
            <div class="text-center py-4">
               <div class="text-lg text-red mb-1 font-bold">No Event Active</div>
               <div class="text-xs text-secondary">New expenses cannot be added right now.</div>
            </div>
          </div>
        `;
    } else if (allEntered) {
        return `
          <div class="ios-card mb-6 fade-in" style="background: linear-gradient(135deg, rgba(10,132,255,0.15), rgba(0,0,0,0.4)); border: 1px solid var(--ios-blue); position: relative;">
            <button id="settlement-guide-btn" class="suggestions-pill">
               Suggestions
            </button>
            <div class="text-secondary text-xs mb-1 uppercase tracking-widest">PER PERSON TO PAY</div>
            <div class="text-xxl text-white font-bold">£${(stats?.per_head || 0)}</div>
            <div class="flex justify-between text-xs text-secondary mt-2">
              <span>Total Group: £${(stats?.total || 0).toFixed(2)}</span>
              <span>${stats?.users_count || 0} People</span>
            </div>
          </div>
        `;
    } else {
        const remaining = expenses.filter(u => u.amount === null).length;
        const isGanduWarning = remaining === 1;
        
        return `
          <div class="ios-card mb-6" style="background: ${isGanduWarning ? 'rgba(255, 69, 58, 0.08)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px dashed ${isGanduWarning ? 'rgba(255, 69, 58, 0.4)' : 'rgba(255,255,255,0.1)'}; transition: all 0.3s ease;">
             <div class="text-center py-4">
                <div class="text-lg ${isGanduWarning ? 'text-red font-bold animate-pulse' : 'text-secondary'} mb-1">
                    ${isGanduWarning ? '1 Gandu Left!' : 'Collecting Expenses...'}
                </div>
                <div class="text-xs ${isGanduWarning ? 'text-red opacity-80' : 'text-blue'}">
                    ${isGanduWarning ? '(Name has been added to Gandu List)' : `${remaining} friend${remaining > 1 ? 's' : ''} left`}
                </div>
             </div>
          </div>
        `;
    }
  };

  const renderHeroInput = (user) => {
      const hasEntered = user.amount !== null;
      const isKing = state.kingUserId && state.kingUserId == user.user_id;

      return `
        <div class="ios-card ${isKing ? 'is-king' : ''}" style="padding: 20px; background: rgba(255,255,255,0.05); border: 1px solid ${hasEntered ? 'var(--ios-blue)' : (isKing ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.1)')}; position: relative;">
           ${isKing ? `<span class="gandu-badge"><i class="fa-solid fa-crown king-crown"></i> Gandu of the Group</span>` : ''}
           <div class="flex justify-between items-center">
              <div class="flex items-center gap-md">
                 ${renderAvatar({ name: user.user_name, avatar: user.user_avatar, id: user.user_id }, 44, hasEntered ? 'hero-entered' : '')}
                 <div>
                    <div class="text-md font-bold">${user.user_name}</div>
                    <div class="text-xs text-secondary">${hasEntered ? 'Saved' : 'Enter amount spent'}</div>
                 </div>
              </div>
              <div style="position: relative;">
                 <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ios-text-secondary); font-weight: bold;">£</span>
                 <input type="number" 
                        inputmode="decimal"
                        placeholder="0.00" 
                        value="${user.amount !== null ? user.amount : ''}" 
                        class="ios-input expense-input" 
                        data-userid="${user.user_id}"
                        style="width: 120px; font-size: 24px; font-weight: bold; padding: 12px 12px 12px 28px; background: rgba(0,0,0,0.3); border-radius: 12px; text-align: right;"
                        ${!state.active ? 'disabled' : ''}
                 >
              </div>
           </div>
        </div>
      `;
  };

  const renderCollaboratorRow = (user) => {
      const hasEntered = user.amount !== null;
      const isKing = state.kingUserId && state.kingUserId == user.user_id;

      return `
        <div class="ios-card ${isKing ? 'is-king' : ''} flex justify-between items-center" style="padding: 14px 16px; margin-bottom: 0; background: rgba(255,255,255,0.02); border: ${isKing ? '1px solid rgba(255,215,0,0.2)' : 'none'}; position: relative;">
          ${isKing ? `<span class="gandu-badge"><i class="fa-solid fa-crown king-crown"></i> Gandu of the Group</span>` : ''}
          <div class="flex items-center gap-md">
             ${renderAvatar({ name: user.user_name, avatar: user.user_avatar, id: user.user_id }, 42)}
             <div class="flex flex-col">
                 <div class="flex items-center gap-xs">
                    <div class="text-md font-medium text-white">${user.user_name}</div>
                 </div>
             </div>
          </div>
          <div class="flex flex-col items-end">
             ${hasEntered 
                ? `<div class="text-md font-bold text-white">£${(user.amount || 0).toFixed(2)}</div>` 
                : `<div class="text-xs text-secondary uppercase font-bold tracking-tight">Waiting...</div>`
             }
          </div>
        </div>
      `;
  };

  const attachListeners = () => {
    // Avatar Lightbox Delegation
    container.addEventListener('click', (e) => {
        const avatar = e.target.closest('.avatar img');
        if (avatar) {
            e.stopPropagation();
            createImageViewer(avatar.src);
            return;
        }
    });

    container.querySelector('#logout-btn')?.addEventListener('click', onLogout);
    container.querySelector('#current-username')?.addEventListener('click', showIdentificationModal);
    container.querySelector('#history-btn')?.addEventListener('click', () => {
         window.dispatchEvent(new CustomEvent('navigate', { detail: 'history' }));
    });
    container.querySelector('#analytics-btn')?.addEventListener('click', () => {
         window.dispatchEvent(new CustomEvent('navigate', { detail: 'analytics' }));
    });
    container.querySelector('#gandu-btn')?.addEventListener('click', showGanduModal);

    container.querySelector('#settlement-guide-btn')?.addEventListener('click', () => {
        const { expenses, stats } = state;
        const settlements = calculateSettlements(expenses, Number(stats.per_head));
        showSettlementModal({ 
            settlements, 
            currentUser: state.expenses.find(u => u.user_id == state.currentUserId) 
        });
    });
    
    if (role === 'admin') {
       container.querySelector('#admin-btn')?.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('navigate', { detail: 'admin' }));
       });
    }

    container.querySelectorAll('.expense-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const userId = e.target.dataset.userid;
        const val = e.target.value;
        const amount = val === '' ? null : parseFloat(val); 
        
        if (amount !== null && !isNaN(amount)) {
          // Optimistic update: update state immediately, re-render, then sync
          const prevExpenses = [...state.expenses];
          const prevStats = { ...state.stats };

          // Update local state
          const idx = state.expenses.findIndex(u => u.user_id == userId);
          if (idx !== -1) {
            state.expenses[idx] = { ...state.expenses[idx], amount };
          }
          recalcStats();
          render(); // Instant UI update

          try { 
            await api.expenses.update(userId, amount);
            // Update cache with new state
            cache.set(CACHE_KEYS.CURRENT_EXPENSES, {
              expenses: state.expenses,
              stats: state.stats,
              event: state.event,
              active: state.active
            });
            // Background refresh to get server-calculated values
            loadData(true);
          } catch (err) { 
            console.error(err); 
            // Revert on failure
            state.expenses = prevExpenses;
            state.stats = prevStats;
            render();
            alert("Failed to save expense. Reverted.");
          }
        }
      });
    });
  };

  const renderDashboardSuggestions = () => {
      const { active, expenses, stats } = state;
      const allEntered = active && expenses.length > 0 && expenses.every(u => u.amount !== null);
      const currentUser = expenses.find(u => u.user_id == state.currentUserId);
      
      if (!allEntered || !currentUser) return '';

      const settlements = calculateSettlements(expenses, Number(stats.per_head));
      return `
        <h3 class="text-xs text-secondary mb-3 uppercase tracking-widest px-1 font-bold">Suggestions</h3>
        ${renderPersonalSummaryCard(currentUser, settlements)}
      `;
  };

  const showGanduModal = async () => {
      if (document.getElementById('gandu-modal-root')) return;
      
      const modal = document.createElement('div');
      modal.id = 'gandu-modal-root';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); z-index:9999; display:flex; align-items:center; justify-content:center; padding: 20px;';
      
      modal.innerHTML = `
        <div class="ios-card w-full fade-in safe-area-bottom" style="width: 100%; max-width: 420px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); padding: 0; background: var(--ios-card-bg);">
           <div class="flex items-center justify-center p-6 pb-2 relative">
               <div class="flex items-center gap-2">
               </div>
               <button id="gandu-info-btn" style="position: absolute; right: 54px; top: 22px; width: 24px; height: 24px; border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; color: var(--ios-text-secondary); font-size: 12px; display:flex; align-items:center; justify-content:center; cursor: pointer;">?</button>
               <button id="close-gandu-btn" style="position: absolute; right: 16px; top: 20px; width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.1); border: none; color: white; display:flex; align-items:center; justify-content:center; cursor: pointer;">
                  <i class="fa-solid fa-xmark"></i>
               </button>
           </div>
           
            <div id="gandu-content" style="flex: 1; overflow-y: auto; padding: 0 20px 20px; margin-top: 60px;">
               <div class="flex flex-col gap-sm mt-2">
                  <div class="skeleton-card skeleton" style="height: 140px;"></div>
                  <div class="skeleton-text skeleton w-24 mt-4"></div>
                  <div class="skeleton-row skeleton"></div>
                  <div class="skeleton-row skeleton"></div>
                  <div class="skeleton-row skeleton"></div>
                  <div class="skeleton-row skeleton"></div>
               </div>
            </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.body.classList.add('modal-open');

      const close = () => {
          modal.remove();
          document.body.classList.remove('modal-open');
      };
      modal.querySelector('#close-gandu-btn').addEventListener('click', close);
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

      modal.querySelector('#gandu-info-btn').addEventListener('click', () => {
          alert("Who's Gandu?\n\nThe legendary genius who always manages to be the last human alive to enter their expenses. Basic timing defeats him every week.\nEnjoy the emotional damage.");
      });

      try {
          const stats = await api.gandus.stats();
          const content = modal.querySelector('#gandu-content');
          
          let html = `
              <div class="flex flex-col gap-sm">
                  ${stats.king ? `
                      <div class="ios-card mt-2 mb-2" style="background: linear-gradient(135deg, rgba(255,215,0,0.15), rgba(0,0,0,0.3)); border: 1px solid #FFD700; text-align: center; padding: 24px;">
                          <div class="text-[10px] text-[#FFD700] font-bold uppercase tracking-widest mb-3" style="font-size: 21px; font-weight: 700; margin: -19px 0 23px 0;">Gandu of the Group</div>
                          <div class="flex justify-center mb-3">
                              ${renderAvatar({ name: stats.king.user_name, avatar: stats.king.user_avatar, id: stats.king.user_id }, 70)}
                          </div>
                          <div class="text-md font-bold text-white mb-1">${stats.king.user_name}</div>
                      </div>
                  ` : ''}

                  <h3 class="text-[10px] text-secondary uppercase tracking-widest font-bold mb-1 mt-4 px-1">Top Gandus</h3>
                  <div class="flex flex-col gap-2">
                       ${stats.leaderboard.length > 0 ? stats.leaderboard.slice(0, 3).map((u, idx) => `
                           <div class="ios-card flex justify-between items-center" style="padding: 12px 16px; background: rgba(255,255,255,0.03); border: none;">
                               <div class="flex items-center gap-md">
                                   <span class="text-xs text-secondary w-4">${idx + 1}</span>
                                   ${renderAvatar({ name: u.user_name, avatar: u.user_avatar, id: u.user_id }, 36)}
                                   <span class="text-sm font-semibold">${u.user_name}</span>
                               </div>
                               <div class="text-sm font-bold text-white">${u.gandu_count}</div>
                           </div>
                       `).join('') : '<p class="text-center text-secondary text-sm py-4">No gandus yet!</p>'}
                  </div>

                  <h3 class="text-[10px] text-secondary uppercase tracking-widest font-bold mb-1 mt-6 px-1">Recent Gandus</h3>
                   <div class="flex flex-col gap-2">
                       ${stats.history.length > 0 ? stats.history.slice().reverse().map(h => `
                           <div class="ios-card flex justify-between items-center" style="padding: 12px 16px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.02);">
                               <div class="flex items-center gap-md">
                                   ${renderAvatar({ name: h.user_name, avatar: h.user_avatar, id: h.user_id }, 30)}
                                   <div class="flex flex-col">
                                       <span class="text-sm font-medium">${h.user_name}</span>
                                   </div>
                               </div>
                               <span class="text-[10px] text-secondary italic">${uiDate(h.archived_at)}</span>
                           </div>
                       `).join('') : '<p class="text-center text-secondary text-sm py-4">The history is empty.</p>'}
                  </div>
              </div>
          `;
          content.innerHTML = html;
      } catch (err) {
          modal.querySelector('#gandu-content').innerHTML = `<div class="text-center text-red p-8">Failed to load stats</div>`;
      }
  };

  const showIdentificationModal = () => {
      if (document.getElementById('id-modal-root')) return;
      const modal = document.createElement('div');
      modal.id = 'id-modal-root';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(30px); -webkit-backdrop-filter:blur(30px); z-index:9999; display:flex; align-items:center; justify-content:center; padding: 20px;';
      
      modal.innerHTML = `
        <div class="ios-card w-full fade-in" style="width: 90vw; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); padding: 0;">
           <div style="padding: 24px 24px 16px; flex-shrink: 0; text-align: center;">
              <h2 class="text-xl font-bold">Who are you?</h2>
              <p class="text-secondary text-sm">Select your name to start tracking.</p>
           </div>
           
           <div class="user-select-scroll" style="flex: 1; overflow-y: auto; padding: 0 24px;">
              <div class="flex flex-col gap-sm" style="padding-bottom: 24px;">
                ${state.expenses.map(user => `
                  <button class="ios-btn secondary user-select-btn" data-id="${user.user_id}" 
                          style="text-align:left; display:flex; justify-content:space-between; align-items:center; padding: 14px 18px; border-radius: 16px; background: rgba(255,255,255,0.05); border: 1px solid transparent; transition: all 0.2s; flex-shrink: 0; margin-bottom: 2px; width: 100%;">
                     <span class="font-bold text-white">${user.user_name}</span>
                     ${renderAvatar({ name: user.user_name, avatar: user.user_avatar, id: user.user_id }, 32)}
                  </button>
                `).join('')}
              </div>
           </div>
           
           <div style="padding: 16px 24px 24px; flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.05);">
              <button class="ios-btn secondary" id="cancel-id-btn" style="background: transparent; color: var(--ios-text-secondary); border: none; width: 100%; font-weight: 600;">Cancel</button>
           </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.body.classList.add('modal-open');
      
      const closeModal = () => {
          modal.remove();
          document.body.classList.remove('modal-open');
          render();
      };

      modal.querySelector('#cancel-id-btn').addEventListener('click', closeModal);

      modal.querySelectorAll('.user-select-btn').forEach(btn => {
         btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            localStorage.setItem('expensec_user_id', id);
            state.currentUserId = id;
            closeModal();
         });
      });
  };

  const recalcStats = () => {
     const total = state.expenses.reduce((sum, u) => sum + (u.amount || 0), 0);
     const count = state.expenses.length; 
     state.stats.total = total;
     state.stats.users_count = count;
     state.stats.per_head = count > 0 ? (total / count).toFixed(2) : 0;
  };

  const loadData = async (silent = false) => {
    // If not silent and no cached data, show loading
    if (!silent && state.expenses.length === 0) {
      state.loading = true;
      render();
    }
    // If we have cached data and this is first load, render it immediately
    if (!silent && state.expenses.length > 0 && state.loading) {
      state.loading = false;
      render();
    }
    try {
        const data = await api.expenses.current();
        const ganduStats = await api.gandus.stats();
        const kingUserId = ganduStats.king ? ganduStats.king.user_id : null;

        // Cache the fresh data
        cache.set(CACHE_KEYS.CURRENT_EXPENSES, {
          expenses: data.expenses,
          stats: data.stats,
          event: data.event,
          active: data.active,
          kingUserId: kingUserId
        });
        // Check if data actually changed before re-rendering
        const changed = JSON.stringify(data.expenses) !== JSON.stringify(state.expenses)
                     || JSON.stringify(data.stats) !== JSON.stringify(state.stats)
                     || data.active !== state.active
                     || kingUserId !== state.kingUserId;
        state.expenses = data.expenses;
        state.stats = data.stats || { total: 0, users_count: 0, per_head: 0 };
        state.event = data.event;
        state.active = data.active;
        state.kingUserId = kingUserId;
        state.loading = false;
        if (changed || !silent) {
          render();
        }
    } catch (e) {
       console.error(e);
       // If we had cached data, just keep showing it (no error flash)
       if (state.expenses.length > 0) {
         state.loading = false;
       }
    } finally {
       if (state.loading) {
         state.loading = false;
         render();
       }
    }
  };

  // Render cached data immediately if available, then refresh in background
  if (cached) {
    render();
    loadData(true);
  } else {
    loadData();
  }
  // PullToRefresh on scrollWrapper, not container
  initPullToRefresh(scrollWrapper, loadData);
  return container;
}

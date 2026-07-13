import { api } from '../utils/api.js';
import { initPullToRefresh } from '../utils/pullToRefresh.js';
import { renderAvatar, escapeHtml } from '../utils/ui.js';
import { createImageViewer } from './ImageViewer.js';
import { cache, CACHE_KEYS, TTL } from '../utils/cache.js';
import { userStore } from '../utils/userStore.js';
import { uiDate } from '../utils/dateUtils.js';
import { calculateSettlements, showSettlementModal, renderPersonalSummaryCard } from '../utils/settlements.js';
import { isPushSupported, subscribeToPush, isSubscribed } from '../utils/pushManager.js';

export function createUserDashboard({ role, onLogout }) {
  const container = document.createElement('div');
  container.className = 'dashboard container fade-in safe-area-bottom ptr-container';
  
  // Use scrollable-inner wrapper for content to fix overflow
  const scrollWrapper = document.createElement('div');
  scrollWrapper.className = 'scrollable-content';
  container.appendChild(scrollWrapper);
  
  // Try to hydrate from cache for instant render (soft get — show stale data)
  const cached = cache.getSoft(CACHE_KEYS.CURRENT_EXPENSES);
  let state = {
    expenses: cached?.expenses || [],
    explicitDebts: cached?.explicitDebts || [],
    stats: cached?.stats || { total: 0, per_head: 0, users_count: 0 },
    loading: !cached,  // Only show loading spinner if no cache exists
    eventName: '',
    active: cached?.active ?? true,
    event: cached?.event || null,
    currentUserId: localStorage.getItem('expensec_user_id'),
    kingUserId: cached?.kingUserId || null,
    lastEvent: cached?.lastEvent || null
  };

  const unsubscribe = userStore.subscribe(() => {
    if (!state.loading) render();
  });

  // Proper cleanup when component is removed from DOM
  let _destroyed = false;
  const cleanup = () => {
    if (_destroyed) return;
    _destroyed = true;
    unsubscribe();
  };

  const checkNotificationStatus = () => {
      if (!isPushSupported() || !state.currentUserId) return;
      if (Notification.permission === 'default') {
          // Attempt to prompt. Will work if dashboard load was part of a user gesture (e.g. from lock screen)
          subscribeToPush(state.currentUserId);
      }
  };

  // Trigger check shortly after dashboard mounts
  setTimeout(checkNotificationStatus, 500);

  const isPwa = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');



  const render = () => {
    if (_destroyed) return;

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

    if (!state.currentUserId && role !== 'admin') {
        showIdentificationModal();
        scrollWrapper.innerHTML = '<div class="text-center p-8 text-secondary">Please select your name above to continue.</div>';
        return;
    }

    const { expenses, active } = state;
    
    // Find currentUser. Priority: 1. expenses (active event) 2. userStore (global cache)
    let currentUser = expenses.find(u => u.user_id == state.currentUserId);
    if (!currentUser && state.currentUserId) {
        const globalUser = userStore.getUser(state.currentUserId);
        if (globalUser) {
            currentUser = {
                user_id: globalUser.id,
                user_name: globalUser.name,
                user_avatar: globalUser.avatar
            };
        }
    }

    const userName = currentUser ? escapeHtml(currentUser.user_name) : escapeHtml(localStorage.getItem('expensec_user_name') || 'User');
    const otherUsers = expenses.filter(u => u.user_id != state.currentUserId);
    const isParticipant = expenses.some(u => u.user_id == state.currentUserId);
    
    // Header — adapt subtitle for summary card state
    const showSummaryCard = !state.active && state.lastEvent;
    let html = `
      <header class="flex justify-between items-center mb-6 safe-area-top">
        <div class="flex flex-col" style="max-width: 60%;">
          <h1 class="text-xl font-bold cursor-pointer hover:opacity-70 flex items-center gap-1" id="current-username">
            ${userName}
          </h1>
          ${state.active && state.event ? `
             <div class="mt-1">
                <div class="text-sm font-semibold">${escapeHtml(state.event.name)}</div>
                <div class="text-xs text-secondary font-mono">${uiDate(state.event.start_date)} - ${uiDate(state.event.end_date)}</div>
             </div>
          ` : showSummaryCard ? '' : `<p class="text-secondary text-xs mt-1">No Active Event</p>`}
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
    `;

    if (showSummaryCard) {
        // ── Summary Card ──
        html += renderSummaryCard();
    } else {
        // ── Normal Active Event UI ──
        html += `
          <div id="stats-area">
            ${renderStatsCard()}
          </div>

          ${state.active && isParticipant ? `
          <div class="mb-8 mt-2">
             <h3 class="text-xs text-secondary mb-3 uppercase tracking-widest px-1 font-bold" style="margin-bottom: 12px;">Your Spending</h3>
             ${currentUser ? renderHeroInput(currentUser) : ''}
          </div>
          ` : ''}

          <div class="collaborators-section">
             <h3 class="text-xs text-secondary mb-3 uppercase tracking-widest px-1 font-bold" style="margin-bottom: 12px;">The Group</h3>
             <div class="flex flex-col gap-sm">
                ${otherUsers.length > 0 ? otherUsers.map(u => renderCollaboratorRow(u, state.currentUserId)).join('') : '<div class="text-center p-4 text-secondary text-sm">No other participants</div>'}
             </div>
          </div>
        `;
    }

    html += `<div style="height: 100px;"></div>`;

    scrollWrapper.innerHTML = html;
    attachListeners();
  };

  const renderStatsCard = () => {
    const { expenses, stats, active } = state;
    const allEntered = active && expenses.length > 0 && expenses.every(u => u.amount !== null);

    if (!active) {
        return '';
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

  const renderSummaryCard = () => {
      const ev = state.lastEvent;
      if (!ev) return '';

      const total = Number(ev.total_amount || 0);
      const perHead = Number(ev.per_head || 0);
      const count = Number(ev.participants_count || 0);
      const ganduName = ev.gandu_id ? (userStore.getName(ev.gandu_id) || 'Unknown') : null;
      const ganduAvatar = ev.gandu_id ? userStore.getAvatar(ev.gandu_id) : null;
      
      let userSettlementsHtml = '';
      if (state.currentUserId) {
          const settlements = ev.settlements_json ? JSON.parse(ev.settlements_json) : [];
          const mySettlements = settlements.filter(s => s.from.user_id == state.currentUserId || s.to.user_id == state.currentUserId);
          
          if (mySettlements.length > 0) {
              const itemsHtml = mySettlements.map(s => {
                  const isPaying = s.from.user_id == state.currentUserId;
                  const otherUserId = isPaying ? s.to.user_id : s.from.user_id;
                  const otherUserName = userStore.getName(otherUserId) || 'Unknown';
                  const otherUserAvatar = userStore.getAvatar(otherUserId);
                  const amount = s.amount;
                  const color = isPaying ? 'var(--ios-red)' : 'var(--ios-green)';
                  const icon = isPaying ? 'fa-arrow-up' : 'fa-arrow-down';
                  const bg = isPaying ? 'rgba(255, 69, 58, 0.1)' : 'rgba(48, 209, 88, 0.1)';
                  
                  return `
                     <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 70px; background: rgba(0,0,0,0.2); padding: 10px 6px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03);">
                        <div onclick="window.openFullAvatar('${otherUserId}')" style="cursor: pointer;">
                           ${renderAvatar({ name: otherUserName, avatar: otherUserAvatar }, 36)}
                        </div>
                        <div class="text-[10px] font-bold text-white truncate w-full text-center">${escapeHtml(otherUserName.split(' ')[0])}</div>
                        <div style="background: ${bg}; color: ${color}; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 10px; white-space: nowrap; letter-spacing: 0.5px;">
                           <i class="fa-solid ${icon} text-[8px]"></i> £${amount.toFixed(2)}
                        </div>
                     </div>
                  `;
              }).join('');
              
              userSettlementsHtml = `
                 <div style="height: 1px; background: rgba(255,255,255,0.06); margin: 20px 0 16px 0;"></div>
                 <div class="text-[10px] text-secondary uppercase tracking-wider font-bold mb-3 text-center" style="opacity: 0.7;">Your Settlements</div>
                 
                     <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; justify-content: center; scrollbar-width: none; -webkit-overflow-scrolling: touch;">
                        ${itemsHtml}
                     </div>
              `;
          }
      }

      // Get current user details for the central focus
      const currentUserId = state.currentUserId;
      const currentUserName = userStore.getName(currentUserId) || localStorage.getItem('expensec_user_name') || 'Me';
      const currentUserAvatar = userStore.getAvatar(currentUserId);

      let currentUserSpent = 0;
      if (ev.expenses) {
          const cuExp = ev.expenses.find(e => e.user_id == currentUserId);
          if (cuExp) currentUserSpent = cuExp.amount || 0;
      }

      return `
        <div id="summary-card-wrapper" class="mb-4" style="background: transparent; border-radius: 0; padding: 0;">
           <div id="summary-card-capture" class="ios-card fade-in" style="background: linear-gradient(145deg, rgba(10, 132, 255, 0.08), rgba(94, 92, 230, 0.06), rgba(0,0,0,0.3)); border: 1px solid rgba(10, 132, 255, 0.2); padding: 24px 20px; position: relative; overflow: hidden; border-radius: 24px;">
              
              <div style="position: absolute; top: -40px; right: -40px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(10, 132, 255, 0.08), transparent); pointer-events: none;"></div>

           <!-- Share Button (Bottom Right) -->
           <button id="share-summary-btn" style="position: absolute; bottom: 16px; right: 16px; color: var(--ios-blue); background: rgba(10, 132, 255, 0.1); border: 1px solid rgba(10, 132, 255, 0.3); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; z-index: 20; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
              <i class="fa-solid fa-share-from-square text-[14px] text-white opacity-90" style="margin: 1px -2px 0 0;"></i>
           </button>

           <!-- Date Range (Bottom Left) -->
           <div id="summary-date-display" style="position: absolute; bottom: 26px; left: 20px; font-size: 10px; color: var(--ios-text-secondary); font-family: monospace; opacity: 0.7; z-index: 20; display: flex; align-items: center;">
              ${uiDate(ev.start_date)} - ${uiDate(ev.end_date)}
           </div>

           <!-- Top Header inside Card -->
           <div class="flex justify-between items-start mb-6">
               <!-- Gandu Info (Top Left) -->
               <div class="flex items-center gap-3" style="margin: -25px 0 0 -21px; padding: 6px 8px 6px 8px; border: 1px solid #ffd70040; border-top-right-radius: 0 !important; border-bottom-left-radius: 0 !important; border-radius: 24px; background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgb(115 114 32 / 8%));">
                  ${ganduName ? `
                     <div onclick="window.openFullAvatar('${ev.gandu_id}')" style="cursor: pointer; display: flex; flex-direction: column; align-items: center;">
                        ${renderAvatar({ name: ganduName, avatar: ganduAvatar }, 36)}
                        <span style="font-size: 10px; font-weight: 800; color: #ffffffc7; margin-top: 4px;">${escapeHtml(ganduName.split(' ')[0])}</span>
                     </div>
                     <div style="display: flex; flex-direction: column; justify-content: center;">
                        <span style="font-size: 11px; font-weight: 900; color: #ffd60ac7; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(255, 214, 10, 0.2); margin-top: -6px;">
                           Gandu of the week
                        </span>
                     </div>
                  ` : `
                     <div class="text-xs font-bold text-secondary">No Gandu</div>
                  `}
               </div>
               
               <button id="summary-settlements-btn" class="suggestions-pill" style="position: static; margin: 0; padding: 6px 12px; font-size: 10px; color: var(--ios-blue); background: rgba(10, 132, 255, 0.1); border: 1px solid rgba(10, 132, 255, 0.3);">
                  Settlements
               </button>
           </div>

           <!-- Central Focus (Current Logged In User) -->
           <div class="text-center flex flex-col items-center mb-6">
               <div onclick="window.openFullAvatar('${currentUserId}')" style="cursor: pointer;">
                  ${renderAvatar({ name: currentUserName, avatar: currentUserAvatar }, 72)}
               </div>
               <div class="text-xl font-bold mt-3 text-white">${escapeHtml(currentUserName)}</div>
               <div class="text-sm font-bold mt-1" style="color: #30D158; background: rgba(48, 209, 88, 0.1); border-radius: 10px; padding: 4px 9px 5px 9px;">Total Spent: £${currentUserSpent.toFixed(2)}</div>
           </div>

           <!-- Event Name above Stats -->
           <div class="text-center">
               <span id="summary-title-text" class="text-[14px] font-bold text-white flex justify-center items-center gap-2">
                   <span style="color: #b4b4b4c7; background: rgba(0, 0, 0, 0.2); border-radius: 10px 10px 0 0; padding: 4px 9px 5px 9px;">${escapeHtml(ev.name)}</span>
               </span>
           </div>

           <!-- Stats Row -->
           <div class="flex justify-between mb-4" style="background: rgba(0,0,0,0.2); border-radius: 14px; padding: 12px 16px;">
              <div class="text-center" style="flex: 1;">
                 <div class="text-[10px] text-secondary uppercase tracking-wider font-bold" style="opacity: 0.5;">Total</div>
                 <div class="text-sm font-bold text-white mt-1">£${total.toFixed(2)}</div>
              </div>
              <div style="width: 1px; background: rgba(255,255,255,0.06);"></div>
              <div class="text-center" style="flex: 1;">
                 <div class="text-[10px] text-secondary uppercase tracking-wider font-bold" style="opacity: 0.5;">People</div>
                 <div class="text-sm font-bold text-white mt-1">${count}</div>
              </div>
              <div style="width: 1px; background: rgba(255,255,255,0.06);"></div>
              <div class="text-center" style="flex: 1;">
                 <div class="text-[10px] text-secondary uppercase tracking-wider font-bold" style="opacity: 0.5;">Per Head</div>
                 <div class="text-sm font-bold text-blue mt-1">£${perHead.toFixed(2)}</div>
              </div>
           </div>

           ${userSettlementsHtml}
           
           <!-- Extra padding at the bottom so elements don't overlap date/share buttons -->
           <div style="height: 20px;"></div>
           </div>
        </div>
      `;
  };

  const shareSummaryCard = async () => {
      const wrapperEl = document.getElementById('summary-card-wrapper');
      const cardEl = document.getElementById('summary-card-capture');
      if (!wrapperEl || !cardEl) return;

      // Provide immediate feedback
      const shareBtn = cardEl.querySelector('#share-summary-btn');
      const originalBtnHtml = shareBtn ? shareBtn.innerHTML : '';
      if (shareBtn) shareBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[14px] text-white"></i>';

      try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(wrapperEl, {
              backgroundColor: null, // Keep outside corners transparent
              scale: 2,
              useCORS: true,
              logging: false,
              onclone: (clonedDoc) => {
                  const clonedCard = clonedDoc.getElementById('summary-card-capture');
                  if (!clonedCard) return;

                  // 1. Hide the share button in the capture
                  const clonedShareBtn = clonedCard.querySelector('#share-summary-btn');
                  if (clonedShareBtn) clonedShareBtn.style.display = 'none';

                  // 2. Remove fade-in animation state
                  clonedCard.classList.remove('fade-in');
                  clonedCard.style.opacity = '1';

                  // 3. Move Date Range to bottom right
                  const clonedDate = clonedCard.querySelector('#summary-date-display');
                  if (clonedDate) {
                      clonedDate.style.left = 'auto';
                      clonedDate.style.right = '24px';
                  }

                  // 4. Hide settlements pill for clean share
                  const clonedSettlementsBtn = clonedCard.querySelector('#summary-settlements-btn');
                  if (clonedSettlementsBtn) clonedSettlementsBtn.style.display = 'none';

                  // 5. Hide the completion tick
                  const tick = clonedCard.querySelector('.fa-circle-check');
                  if (tick) tick.style.display = 'none';

                  // 6. Fix Washed Out Colors: Apply opaque background equivalent to original transparent gradient over #1c1c1e
                  clonedCard.style.background = 'linear-gradient(145deg, #1f222e, #201e2c, #131315)';
                  clonedCard.style.borderRadius = '24px'; // Ensure radius is preserved explicitly

                  // 7. Force body to transparent so the corners don't pick up the app's dark background
                  clonedDoc.body.style.background = 'transparent';
                  clonedDoc.documentElement.style.background = 'transparent';
              }
          });

          canvas.toBlob(async (blob) => {
              if (!blob) return;

              const file = new File([blob], 'expense-summary.png', { type: 'image/png' });

              if (navigator.share && navigator.canShare?.({ files: [file] })) {
                  await navigator.share({
                      title: `${state.lastEvent?.name || 'Week'} Summary`,
                      files: [file]
                  });
              } else {
                  // Fallback: download
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'expense-summary.png';
                  a.click();
                  URL.revokeObjectURL(url);
              }
          }, 'image/png');
      } catch (err) {
          console.error('Share failed:', err);
      } finally {
          if (shareBtn) shareBtn.innerHTML = originalBtnHtml;
      }
  };

  const renderHeroInput = (user) => {
      const hasEntered = user.amount != null;
      const isKing = state.kingUserId && state.kingUserId == user.user_id;
      const safeName = escapeHtml(user.user_name);

      // Find debts where someone owes THIS user (current user is creditor)
      const debtsToMe = state.explicitDebts.filter(d => d.creditor_id == user.user_id);

      return `
        <div class="ios-card ${isKing ? 'is-king' : ''}" style="padding: 20px; background: rgba(255,255,255,0.05); border: 1px solid ${hasEntered ? 'var(--ios-blue)' : (isKing ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.1)')}; position: relative;">
           ${isKing ? `<span class="gandu-badge"><i class="fa-solid fa-crown king-crown"></i> Gandu of the Group</span>` : ''}
           <div class="flex justify-between items-center">
              <div class="flex items-center gap-md">
                 ${renderAvatar({ name: user.user_name, avatar: user.user_avatar, id: user.user_id }, 44, hasEntered ? 'hero-entered' : '')}
                 <div>
                    <div class="text-md font-bold">${safeName}</div>
                    <div class="text-xs text-secondary">${hasEntered ? 'Saved' : 'Enter amount spent'}</div>
                 </div>
              </div>
              <div class="flex items-center gap-sm">
                 <div style="position: relative; display: flex; align-items: center;">
                    <div id="expense-preview-pill" style="position: absolute; top: -35px; right: 0; background: rgba(10, 132, 255, 0.15); border: 1px solid rgba(10, 132, 255, 0.4); color: #0A84FF; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; opacity: 0; transform: translateY(10px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 10;">
                       <!-- dynamic -->
                    </div>
                    <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ios-text-secondary); font-weight: bold;">£</span>
                    <input type="number" 
                           id="current-user-expense-input"
                           inputmode="decimal"
                           placeholder="0.00" 
                           value="${hasEntered ? user.amount : ''}" 
                           data-original="${hasEntered ? user.amount : 0}"
                           class="ios-input expense-input-hero" 
                           data-userid="${user.user_id}"
                           style="width: 140px; font-size: 20px; font-weight: bold; padding: 12px 64px 12px 28px; background: rgba(0,0,0,0.3); border-radius: 12px; text-align: left;"
                           ${!state.active ? 'disabled' : ''}
                    >
                    <div style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; pointer-events: none;" id="expense-actions-overlay">
                       <button id="expense-add-btn" style="width: 26px; height: 26px; border-radius: 8px; border: none; background: #30D158; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto;" title="Add to total"><i class="fa-solid fa-plus" style="font-size: 12px;"></i></button>
                       <button id="expense-set-btn" style="width: 26px; height: 26px; border-radius: 8px; border: none; background: #0A84FF; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto;" title="Set total"><i class="fa-solid fa-check" style="font-size: 12px;"></i></button>
                    </div>
                 </div>
                 <button id="expense-history-btn" data-userid="${user.user_id}" style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--ios-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                 </button>
              </div>
           </div>
           ${debtsToMe.length > 0 ? `
           <div class="flex flex-wrap gap-xs" style="margin-top: 10px;">
              ${debtsToMe.map(d => {
                  const debtorName = userStore.getName(d.debtor_id) || 'Someone';
                  return `<span class="explicit-debt-pill debt-info-pill" data-creditor="${d.creditor_id}" data-debtor="${d.debtor_id}" data-amount="${d.amount}" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; background: rgba(48, 209, 88, 0.12); border: 1px solid rgba(48, 209, 88, 0.25); color: #30D158; cursor: pointer; transition: all 0.2s;"><i class="fa-solid fa-arrow-down" style="font-size: 8px;"></i> £${d.amount.toFixed(2)} from ${escapeHtml(debtorName)}</span>`;
              }).join('')}
           </div>
           ` : ''}
        </div>
      `;
  };

  const renderCollaboratorRow = (user, currentUserId) => {
      const hasEntered = user.amount != null;
      const isKing = state.kingUserId && state.kingUserId == user.user_id;
      const safeName = escapeHtml(user.user_name);

      // Debt where I am creditor for this user (this user owes me)
      const debtTheyOweMe = state.explicitDebts.find(d => d.creditor_id == currentUserId && d.debtor_id == user.user_id);
      // Debt where I am debtor for this user (I owe this user)
      const debtIOwe = state.explicitDebts.find(d => d.creditor_id == user.user_id && d.debtor_id == currentUserId);

      return `
        <div class="ios-card collab-row ${isKing ? 'is-king' : ''}" data-userid="${user.user_id}" style="padding: 14px 16px; margin-bottom: 0; background: rgba(255,255,255,0.02); border: ${isKing ? '1px solid rgba(255,215,0,0.2)' : 'none'}; position: relative; cursor: ${state.active ? 'pointer' : 'default'}; transition: background 0.2s;">
          ${isKing ? `<span class="gandu-badge"><i class="fa-solid fa-crown king-crown"></i> Gandu of the Group</span>` : ''}
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-md">
               ${renderAvatar({ name: user.user_name, avatar: user.user_avatar, id: user.user_id }, 42)}
               <div class="flex flex-col">
                   <div class="flex items-center gap-xs">
                      <div class="text-md font-medium text-white">${safeName}</div>
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
          ${debtTheyOweMe || debtIOwe ? `
          <div class="flex flex-wrap gap-xs" style="margin-top: 8px;">
             ${debtTheyOweMe ? `<span class="explicit-debt-pill debt-info-pill" data-creditor="${debtTheyOweMe.creditor_id}" data-debtor="${debtTheyOweMe.debtor_id}" data-amount="${debtTheyOweMe.amount}" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; background: rgba(48, 209, 88, 0.12); border: 1px solid rgba(48, 209, 88, 0.25); color: #30D158; cursor: pointer; transition: all 0.2s;"><i class="fa-solid fa-arrow-down" style="font-size: 8px;"></i> Owes you £${debtTheyOweMe.amount.toFixed(2)}</span>` : ''}
             ${debtIOwe ? `<span class="explicit-debt-pill debt-info-pill" data-creditor="${debtIOwe.creditor_id}" data-debtor="${debtIOwe.debtor_id}" data-amount="${debtIOwe.amount}" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; background: rgba(255, 69, 58, 0.12); border: 1px solid rgba(255, 69, 58, 0.25); color: #FF453A; cursor: pointer; transition: all 0.2s;"><i class="fa-solid fa-arrow-up" style="font-size: 8px;"></i> You owe £${debtIOwe.amount.toFixed(2)}</span>` : ''}
          </div>
          ` : ''}
        </div>
      `;
  };


  const attachListeners = () => {
    container.querySelector('#logout-btn')?.addEventListener('click', () => {
      cleanup();
      onLogout();
    });
    container.querySelector('#current-username')?.addEventListener('click', showIdentificationModal);
    container.querySelector('#history-btn')?.addEventListener('click', () => {
         window.dispatchEvent(new CustomEvent('navigate', { detail: 'history' }));
    });
    container.querySelector('#analytics-btn')?.addEventListener('click', () => {
         window.dispatchEvent(new CustomEvent('navigate', { detail: 'analytics' }));
    });
    container.querySelector('#gandu-btn')?.addEventListener('click', showGanduModal);

    container.querySelector('#settlement-guide-btn')?.addEventListener('click', () => {
        const { expenses, stats, explicitDebts } = state;
        const settlements = calculateSettlements(expenses, Number(stats.per_head), explicitDebts);
        showSettlementModal({ 
            settlements, 
            currentUser: state.expenses.find(u => u.user_id == state.currentUserId) 
        });
    });

    container.querySelector('#summary-settlements-btn')?.addEventListener('click', () => {
        const ev = state.lastEvent;
        if (!ev?.settlements_json) return;
        const settlements = JSON.parse(ev.settlements_json);
        showSettlementModal({ 
            settlements, 
            currentUser: null,
            title: `${ev.name} — Settlements`
        });
    });

    container.querySelector('#share-summary-btn')?.addEventListener('click', shareSummaryCard);

    // Make collaborator rows clickable to add explicit debts
    if (state.active) {
        container.querySelectorAll('.collab-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // Don't trigger if clicking on the avatar (which opens full avatar) or pills
                if (e.target.closest('.avatar') || e.target.closest('.debt-info-pill')) return;
                const targetUserId = row.dataset.userid;
                const targetUser = state.expenses.find(u => u.user_id == targetUserId);
                if (targetUser) showExplicitDebtModal(targetUser);
            });
        });
    }

    // Debt info pill click handlers
    container.querySelectorAll('.debt-info-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const creditorId = pill.dataset.creditor;
            const debtorId = pill.dataset.debtor;
            const amount = parseFloat(pill.dataset.amount);
            showDebtInfoModal(creditorId, debtorId, amount);
        });
    });
    
    if (role === 'admin') {
       container.querySelector('#admin-btn')?.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('navigate', { detail: 'admin' }));
       });
    }

    const heroInput = container.querySelector('#current-user-expense-input');
    const actionsOverlay = container.querySelector('#expense-actions-overlay');
    const addBtn = container.querySelector('#expense-add-btn');
    const setBtn = container.querySelector('#expense-set-btn');
    const historyBtn = container.querySelector('#expense-history-btn');
    const previewPill = container.querySelector('#expense-preview-pill');

    if (heroInput) {
        heroInput.addEventListener('input', (e) => {
            const val = e.target.value;
            const original = parseFloat(e.target.dataset.original) || 0;
            const typed = parseFloat(val);

            if (val !== '') {
                actionsOverlay.style.opacity = '1';
                actionsOverlay.style.pointerEvents = 'auto';
                
                if (!isNaN(typed)) {
                    previewPill.style.opacity = '1';
                    previewPill.style.transform = 'translateY(0)';
                    const future = original + typed;
                    previewPill.innerHTML = `£${original.toFixed(2)} + £${typed.toFixed(2)} = <strong>£${future.toFixed(2)}</strong>`;
                } else {
                    previewPill.style.opacity = '0';
                    previewPill.style.transform = 'translateY(10px)';
                }
            } else {
                actionsOverlay.style.opacity = '0';
                actionsOverlay.style.pointerEvents = 'none';
                previewPill.style.opacity = '0';
                previewPill.style.transform = 'translateY(10px)';
            }
        });

        heroInput.addEventListener('focus', () => {
            heroInput.select();
        });

        // Hide UI on blur if clicking outside completely (delay to allow button clicks)
        heroInput.addEventListener('blur', (e) => {
            setTimeout(() => {
                if (actionsOverlay) actionsOverlay.style.opacity = '0';
                if (actionsOverlay) actionsOverlay.style.pointerEvents = 'none';
                if (previewPill) previewPill.style.opacity = '0';
                if (previewPill) previewPill.style.transform = 'translateY(10px)';
                
                // If they typed something but blurred without clicking, we can auto-save (set)
                if (heroInput.value !== '' && parseFloat(heroInput.value) !== parseFloat(heroInput.dataset.original)) {
                   setBtn.click();
                } else {
                   heroInput.value = heroInput.dataset.original > 0 ? heroInput.dataset.original : '';
                }
            }, 200);
        });

        const saveExpense = async (isAdd) => {
            const userId = heroInput.dataset.userid;
            const val = heroInput.value;
            const amount = val === '' ? null : parseFloat(val); 
            
            if (amount === null || isNaN(amount)) {
                // If clearing
                if (!isAdd) {
                    try {
                        await api.expenses.update(userId, null);
                        loadData(true);
                    } catch(e) {}
                }
                return;
            }

            const prevExpenses = [...state.expenses];
            try {
                if (isAdd) {
                    await api.expenses.add(userId, amount);
                } else {
                    await api.expenses.update(userId, amount);
                }
                
                // Show success animation on the pill
                if (previewPill) {
                    previewPill.innerHTML = `<i class="fa-solid fa-check"></i> Saved`;
                    previewPill.style.background = 'rgba(48, 209, 88, 0.15)';
                    previewPill.style.borderColor = 'rgba(48, 209, 88, 0.4)';
                    previewPill.style.color = '#30D158';
                }
                setTimeout(() => loadData(true), 300);
            } catch (err) {
                console.error(err);
                state.expenses = prevExpenses;
                render();
                alert("Failed to save expense.");
            }
        };

        if (addBtn) addBtn.addEventListener('click', () => saveExpense(true));
        if (setBtn) setBtn.addEventListener('click', () => saveExpense(false));
    }

    if (historyBtn) {
        historyBtn.addEventListener('click', async () => {
            const userId = historyBtn.dataset.userid;
            const user = state.expenses.find(u => u.user_id == userId);
            if (user && state.event) {
                showHistoryModal(state.event.id, userId, user.user_name);
            }
        });
    }
  };

  const showHistoryModal = async (eventId, userId, userName) => {
      if (document.getElementById('history-modal-root')) return;

      const modal = document.createElement('div');
      modal.id = 'history-modal-root';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:9999; display:flex; align-items:flex-end; justify-content:center; opacity:0; transition:opacity 0.3s;';
      
      modal.innerHTML = `
        <div class="ios-card w-full safe-area-bottom" style="width: 100%; max-width: 500px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); padding: 0; background: var(--ios-card-bg); border-bottom-left-radius: 0; border-bottom-right-radius: 0; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
           <div class="flex justify-between items-center p-6 border-b border-white/5 relative">
              <h3 class="text-xl font-bold m-0" style="background: linear-gradient(135deg, #fff, #aaa); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Expense History</h3>
              <button id="close-history-btn" style="width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.1); border: none; color: white; display:flex; align-items:center; justify-content:center; cursor: pointer;">
                 <i class="fa-solid fa-xmark"></i>
              </button>
           </div>
           <div class="p-6 overflow-y-auto" style="flex: 1;" id="history-content-container">
              <div style="display:flex; justify-content:center; padding: 20px;">
                 <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--ios-text-secondary);"></i>
              </div>
           </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Trigger animations
      requestAnimationFrame(() => {
          modal.style.opacity = '1';
          modal.querySelector('.ios-card').style.transform = 'translateY(0)';
      });

      const close = () => {
          modal.style.opacity = '0';
          modal.querySelector('.ios-card').style.transform = 'translateY(100%)';
          setTimeout(() => modal.remove(), 300);
      };

      modal.querySelector('#close-history-btn').addEventListener('click', close);
      modal.addEventListener('click', (e) => { if(e.target === modal) close(); });

      try {
          const res = await api.expenses.history(eventId, userId);
          const container = modal.querySelector('#history-content-container');
          
          if (!res.history || res.history.length === 0) {
              container.innerHTML = `
                  <div style="text-align:center; padding: 40px 20px; color: var(--ios-text-secondary);">
                      <i class="fa-solid fa-clock-rotate-left" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                      <p>No expense history yet.</p>
                  </div>
              `;
              return;
          }

          const html = res.history.map(item => {
              const isAdd = item.action_type === 'add';
              const color = isAdd ? '#30D158' : '#0A84FF';
              const icon = isAdd ? 'fa-plus' : 'fa-check';
              const text = isAdd ? `Added £${item.amount_added.toFixed(2)}` : `Set to £${item.amount_added.toFixed(2)}`;
              
              const dateObj = new Date(item.created_at);
              // Use nice date formatting, e.g. "Oct 12, 10:30 AM"
              const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + 
                              dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

              return `
                  <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <div style="width: 40px; height: 40px; border-radius: 50%; background: ${color}22; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                          <i class="fa-solid ${icon}"></i>
                      </div>
                      <div style="flex: 1;">
                          <div style="font-size: 16px; font-weight: 600;">${text}</div>
                          <div style="font-size: 12px; color: var(--ios-text-secondary); margin-top: 4px;">${dateStr}</div>
                      </div>
                  </div>
              `;
          }).join('');

          container.innerHTML = `
              <div style="margin-bottom: 20px; font-size: 14px; color: var(--ios-text-secondary);">
                  Showing history for <strong>${escapeHtml(userName)}</strong>
              </div>
              ${html}
          `;
      } catch (err) {
          console.error(err);
          modal.querySelector('#history-content-container').innerHTML = `
              <div style="text-align:center; padding: 20px; color: #FF453A;">Failed to load history.</div>
          `;
      }
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
                          <div style="font-size: 21px; font-weight: 700; color: #FFD700; text-transform: uppercase; letter-spacing: 1px; margin: -19px 0 23px 0;">Gandu of the Group</div>
                          <div class="flex justify-center mb-3">
                              ${renderAvatar({ name: stats.king.user_name, avatar: stats.king.user_avatar, id: stats.king.user_id }, 70)}
                          </div>
                          <div class="text-md font-bold text-white mb-1">${escapeHtml(stats.king.user_name)}</div>
                      </div>
                  ` : ''}

                  <h3 style="font-size: 10px; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin: 16px 0 4px 4px; opacity: 0.5;">Top Gandus</h3>
                  <div class="flex flex-col gap-2">
                       ${stats.leaderboard.length > 0 ? stats.leaderboard.slice(0, 3).map((u, idx) => `
                           <div class="ios-card flex justify-between items-center" style="padding: 12px 16px; background: rgba(255,255,255,0.03); border: none;">
                               <div class="flex items-center gap-md">
                                   <span class="text-xs text-secondary w-4">${idx + 1}</span>
                                   ${renderAvatar({ name: u.user_name, avatar: u.user_avatar, id: u.user_id }, 36)}
                                   <span class="text-sm font-semibold">${escapeHtml(u.user_name)}</span>
                               </div>
                               <div class="text-sm font-bold text-white">${u.gandu_count}</div>
                           </div>
                       `).join('') : '<p class="text-center text-secondary text-sm py-4">No gandus yet!</p>'}
                  </div>

                  <h3 style="font-size: 10px; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin: 24px 0 4px 4px; opacity: 0.5;">Recent Gandus</h3>
                   <div class="flex flex-col gap-2">
                       ${stats.history.length > 0 ? stats.history.slice().reverse().map(h => `
                           <div class="ios-card flex justify-between items-center" style="padding: 12px 16px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.02);">
                               <div class="flex items-center gap-md">
                                   ${renderAvatar({ name: h.user_name, avatar: h.user_avatar, id: h.user_id }, 30)}
                                   <div class="flex flex-col">
                                       <span class="text-sm font-medium">${escapeHtml(h.user_name)}</span>
                                   </div>
                               </div>
                               <span class="text-xs text-secondary" style="font-style: italic;">${uiDate(h.archived_at)}</span>
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

  const showIdentificationModal = async () => {
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
           
           <div class="user-select-scroll" id="id-modal-content" style="flex: 1; overflow-y: auto; padding: 0 24px;">
              <div class="flex flex-col gap-sm" style="padding-bottom: 24px;">
                <div class="skeleton-row skeleton"></div>
                <div class="skeleton-row skeleton"></div>
                <div class="skeleton-row skeleton"></div>
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
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

      try {
          const allUsers = await api.users.list();
          // Update global store
          await userStore.init();
          
          const content = modal.querySelector('#id-modal-content');
          content.innerHTML = `
            <div class="flex flex-col gap-sm" style="padding-bottom: 24px;">
              ${allUsers.map(user => `
                <button class="ios-btn secondary user-select-btn" data-id="${user.id}" data-name="${escapeHtml(user.name)}"
                        style="text-align:left; display:flex; justify-content:space-between; align-items:center; padding: 14px 18px; border-radius: 16px; background: rgba(255,255,255,0.05); border: 1px solid transparent; transition: all 0.2s; flex-shrink: 0; margin-bottom: 2px; width: 100%;">
                   <span class="font-bold text-white">${escapeHtml(user.name)}</span>
                   ${renderAvatar({ name: user.name, avatar: user.avatar, id: user.id }, 32)}
                </button>
              `).join('')}
            </div>
          `;

          content.querySelectorAll('.user-select-btn').forEach(btn => {
              btn.addEventListener('click', () => {
                  const id = btn.dataset.id;
                  const name = btn.dataset.name;
                  localStorage.setItem('expensec_user_id', id);
                  localStorage.setItem('expensec_user_name', name);
                  state.currentUserId = id;
                  
                  // Trigger push subscription prompt immediately on selection
                  if (isPushSupported()) {
                      subscribeToPush(id);
                  }

                  closeModal();
              });
          });
      } catch (err) {
          console.error('Failed to load user list', err);
          modal.querySelector('#id-modal-content').innerHTML = '<div class="text-center p-8 text-red">Failed to load users</div>';
      }
  };

  const showExplicitDebtModal = (targetUser) => {
      if (document.getElementById('debt-modal-root')) return;

      const safeName = escapeHtml(targetUser.user_name);
      const currentUserId = state.currentUserId;
      const existingDebt = state.explicitDebts.find(d => d.creditor_id == currentUserId && d.debtor_id == targetUser.user_id);

      const modal = document.createElement('div');
      modal.id = 'debt-modal-root';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); z-index:9999; display:flex; align-items:center; justify-content:center; padding: 20px;';

      modal.innerHTML = `
        <div class="ios-card w-full fade-in" style="width: 100%; max-width: 380px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); padding: 0; background: var(--ios-card-bg); position: relative;">
           
           <button id="close-debt-modal-btn" style="position: absolute; top: 16px; right: 16px; width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.1); border: none; color: white; display: flex; align-items: center; justify-content: center; z-index: 100; cursor: pointer;">
              <i class="fa-solid fa-xmark" style="font-size: 14px;"></i>
           </button>

           <div style="padding: 32px 24px 16px; text-align: center;">
              <div class="flex justify-center mb-3">
                 ${renderAvatar({ name: targetUser.user_name, avatar: targetUser.user_avatar, id: targetUser.user_id }, 56)}
              </div>
              <h2 class="text-lg font-bold text-white" style="margin-bottom: 4px;">Extra Debt</h2>
              <p class="text-xs text-secondary" style="line-height: 1.5;">Does <strong style="color: white;">${safeName}</strong> owe you any extra money<br>outside of the group split?</p>
           </div>
           
           <div style="padding: 0 24px 32px;">
              <div style="position: relative;">
                 <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--ios-text-secondary); font-weight: bold; font-size: 18px;">£</span>
                 <input type="number" 
                        id="debt-amount-input"
                        inputmode="decimal"
                        placeholder="0.00" 
                        value="${existingDebt ? existingDebt.amount : ''}" 
                        class="ios-input" 
                        style="width: 100%; font-size: 28px; font-weight: bold; padding: 16px 16px 16px 36px; background: rgba(0,0,0,0.3); border-radius: 14px; text-align: right; border: 1px solid rgba(255,255,255,0.1);"
                        autofocus
                 >
              </div>
              <div id="debt-status" class="text-[10px] text-center mt-2 opacity-50 font-bold uppercase tracking-widest" style="height: 12px;">
                 ${existingDebt ? 'Saved' : ''}
              </div>
           </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.body.classList.add('modal-open');

      const input = modal.querySelector('#debt-amount-input');
      const status = modal.querySelector('#debt-status');

      setTimeout(() => input?.focus(), 100);

      const closeModal = () => {
          modal.remove();
          document.body.classList.remove('modal-open');
      };

      modal.querySelector('#close-debt-modal-btn').addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

      input.addEventListener('change', async () => {
          const val = input.value.trim();
          const amount = val === '' ? null : parseFloat(val);
          
          status.textContent = 'Saving...';
          status.style.color = 'var(--ios-blue)';

          try {
              await api.explicitDebts.update(currentUserId, targetUser.user_id, amount);
              status.textContent = 'Saved';
              status.style.color = 'var(--ios-green)';
              // Refresh background data
              loadData(true);
          } catch (err) {
              console.error('Failed to auto-save debt:', err);
              status.textContent = 'Failed to Save';
              status.style.color = 'var(--ios-red)';
          }
      });
  };

  const showDebtInfoModal = (creditorId, debtorId, amount) => {
      if (document.getElementById('debt-info-modal-root')) return;

      const creditorName = userStore.getName(creditorId) || 'Unknown';
      const debtorName = userStore.getName(debtorId) || 'Unknown';
      const isCurrentUserCreditor = creditorId == state.currentUserId;

      const modal = document.createElement('div');
      modal.id = 'debt-info-modal-root';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); backdrop-filter:blur(15px); -webkit-backdrop-filter:blur(15px); z-index:9999; display:flex; align-items:center; justify-content:center; padding: 20px;';

      modal.innerHTML = `
        <div class="ios-card w-full fade-in" style="width: 100%; max-width: 340px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); padding: 0; background: var(--ios-card-bg);">
           <div style="padding: 28px 24px 20px; text-align: center;">
              <div style="width: 48px; height: 48px; border-radius: 50%; background: ${isCurrentUserCreditor ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 69, 58, 0.15)'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                 <i class="fa-solid ${isCurrentUserCreditor ? 'fa-arrow-down' : 'fa-arrow-up'}" style="font-size: 20px; color: ${isCurrentUserCreditor ? '#30D158' : '#FF453A'};"></i>
              </div>
              <h3 class="text-md font-bold text-white" style="margin-bottom: 8px;">Extra Debt</h3>
              <p class="text-sm" style="color: var(--ios-text-secondary); line-height: 1.6;">
                 ${isCurrentUserCreditor 
                    ? `<strong style="color: white;">${escapeHtml(debtorName)}</strong> needs to pay you <strong style="color: #30D158;">£${amount.toFixed(2)}</strong> extra.`
                    : `You owe <strong style="color: white;">${escapeHtml(creditorName)}</strong> an extra <strong style="color: #FF453A;">£${amount.toFixed(2)}</strong>.`
                 }
              </p>
              <p class="text-xs text-secondary" style="margin-top: 8px; opacity: 0.6;">This is included in the settlement suggestions.</p>
           </div>
           <div style="padding: 0 24px 24px;">
              <button id="close-debt-info-btn" class="ios-btn secondary" style="width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; font-weight: 600; color: var(--ios-text-secondary);">Got it</button>
           </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.body.classList.add('modal-open');

      const close = () => {
          modal.remove();
          document.body.classList.remove('modal-open');
      };

      modal.querySelector('#close-debt-info-btn').addEventListener('click', close);
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  };

  const recalcStats = () => {
     const total = state.expenses.reduce((sum, u) => sum + (u.amount || 0), 0);
     const count = state.expenses.length; 
     state.stats.total = total;
     state.stats.users_count = count;
     state.stats.per_head = count > 0 ? (total / count).toFixed(2) : 0;
  };

  const loadData = async (silent = false) => {
    if (_destroyed) return;

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
        // Parallel fetch — expenses and gandus at the same time
        const [data, ganduStats] = await Promise.all([
          api.expenses.current(),
          api.gandus.stats()
        ]);
        const kingUserId = ganduStats.king ? ganduStats.king.user_id : null;

        // Cache the fresh data
        cache.set(CACHE_KEYS.CURRENT_EXPENSES, {
          expenses: data.expenses,
          explicitDebts: data.explicitDebts || [],
          stats: data.stats,
          event: data.event,
          active: data.active,
          kingUserId: kingUserId,
          lastEvent: data.lastEvent || null
        });

        // Simple field comparison instead of JSON.stringify
        const newDebts = data.explicitDebts || [];
        const changed = data.active !== state.active
                     || kingUserId !== state.kingUserId
                     || data.expenses.length !== state.expenses.length
                     || data.expenses.some((e, i) => e.amount !== state.expenses[i]?.amount || e.user_id !== state.expenses[i]?.user_id)
                     || newDebts.length !== state.explicitDebts.length
                     || newDebts.some((d, i) => d.amount !== state.explicitDebts[i]?.amount || d.creditor_id !== state.explicitDebts[i]?.creditor_id || d.debtor_id !== state.explicitDebts[i]?.debtor_id)
                     || (data.lastEvent?.id !== state.lastEvent?.id);

        state.expenses = data.expenses;
        state.explicitDebts = newDebts;
        state.stats = data.stats || { total: 0, users_count: 0, per_head: 0 };
        state.event = data.event;
        state.active = data.active;
        state.kingUserId = kingUserId;
        state.lastEvent = data.lastEvent || null;
        state.loading = false;
        
        // Cache current user name if found
        const currentUserInEvent = data.expenses.find(u => u.user_id == state.currentUserId);
        if (currentUserInEvent) {
            localStorage.setItem('expensec_user_name', currentUserInEvent.user_name);
        }
        
        // Silently attempt push subscription (if permission already granted)
        if (state.currentUserId && isPushSupported()) {
            isSubscribed().then(already => {
                if (!already && Notification.permission === 'granted') {
                    subscribeToPush(state.currentUserId);
                }
            });
        }
        
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

  // Expose cleanup for router to call
  container._cleanup = cleanup;
  return container;
}

import { api } from '../utils/api.js';
import { initPullToRefresh } from '../utils/pullToRefresh.js';
import { renderAvatar, escapeHtml } from '../utils/ui.js';
import { userStore } from '../utils/userStore.js';
import Chart from 'chart.js/auto';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { formatToEng, uiDate, parseFromEng } from '../utils/dateUtils.js';

export function createAnalyticsDashboard({ onBack, initialDateRange }) {
  const container = document.createElement('div');
  container.className = 'dashboard container fade-in safe-area-bottom ptr-container';
  
  const scrollWrapper = document.createElement('div');
  scrollWrapper.className = 'scrollable-content';
  container.appendChild(scrollWrapper);
  
  let state = {
    loading: true,
    data: null,
    // Strict Date Range: Default to All Time if not provided, but UI will show "All Time"
    dateRange: initialDateRange || { start: '', end: '' }
  };

  let _destroyed = false;
  let _trendChart = null;
  let _userChart = null;

  const cleanup = () => {
    if (_destroyed) return;
    _destroyed = true;
    unsubscribe();
    if (_trendChart) { _trendChart.destroy(); _trendChart = null; }
    if (_userChart) { _userChart.destroy(); _userChart = null; }
  };

  const unsubscribe = userStore.subscribe(() => {
    if (!state.loading) render();
  });

  const render = () => {
    let rangeText = (state.dateRange.start && state.dateRange.end) 
        ? `${uiDate(state.dateRange.start)} - ${uiDate(state.dateRange.end)}`
        : 'All Time';

    let html = `
      <header class="flex justify-between items-center mb-6 safe-area-top">
        <div class="flex items-center gap-sm">
          <button class="ios-btn secondary" id="back-btn" style="width: auto; padding: 8px 12px; display:flex; gap:6px; align-items:center;">
             <i class="fa-solid fa-chevron-left"></i> 
             <span class="font-semibold">Analysis</span>
          </button>
        </div>
        <div class="relative">
           <button id="date-range-picker-btn" class="ios-btn secondary" style="width: auto; padding: 6px 12px; font-size: 11px; height: 32px; font-weight: 600; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;">
              <i class="fa-solid fa-calendar-alt mr-1 text-blue"></i> ${rangeText}
           </button>
           <input type="text" id="hidden-date-picker" style="display:none;">
        </div>
      </header>
    `;

    if (state.loading && !state.data) {
       html += `
          <div class="skeleton-card" style="height: 120px;"></div>
          <div class="flex gap-4 mb-4">
            <div class="skeleton-card flex-1" style="height: 100px;"></div>
            <div class="skeleton-card flex-1" style="height: 100px;"></div>
          </div>
          <div class="skeleton-card" style="height: 200px;"></div>
          <div class="skeleton-text w-32 mb-4"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
       `;
       scrollWrapper.innerHTML = html;
       container.querySelector('#back-btn').addEventListener('click', onBack);
       return;
    }

    const { summary, timeline, by_user, highlights } = state.data || {};

    // --- 1. Top Section: Summary & Highlights (40% / 60% Grid) ---
    // Redesigned for better margins and alignment
    html += `
      <div class="flex flex-row gap-4 mb-8">
         <!-- Left Col (40%): Stats -->
         <div class="flex flex-col gap-4" style="flex: 4;" style="padding-bottom: 14px;">
             
             <!-- Total Card -->
             <div class="ios-card flex-1 shadow-md" style="
                  background: linear-gradient(135deg, rgba(10, 132, 255, 0.15), rgba(10, 132, 255, 0.05)); 
                  border: 1px solid rgba(10, 132, 255, 0.2); 
                  padding: 16px; 
                  margin-bottom: 0; 
                  display: flex; 
                  flex-direction: column; 
                  justify-content: center;
                  backdrop-filter: blur(10px);">
                 <div class="text-[10px] text-blue font-bold uppercase tracking-widest mb-1.5 opacity-90"><i class="fa-solid fa-wallet mr-1"></i> Total</div>
                 <div class="text-xl font-bold text-white tracking-tight">£${(summary?.total || 0).toFixed(2)}</div>
             </div>

             <!-- Avg Card -->
             <div class="ios-card flex-1 shadow-md" style="
                  background: rgba(255, 255, 255, 0.03); 
                  border: 1px solid rgba(255, 255, 255, 0.05); 
                  padding: 16px; 
                  margin-bottom: 0; 
                  display: flex; 
                  flex-direction: column; 
                  justify-content: center;">
                 <div class="text-[10px] text-secondary font-bold uppercase tracking-widest mb-1.5 opacity-70"><i class="fa-solid fa-layer-group mr-1"></i> Avg</div>
                 <div class="text-lg font-bold text-white tracking-tight">£${(summary?.avg || 0).toFixed(2)}</div>
             </div>
         </div>

         <!-- Right Col (60%): Highlights -->
         <div class="ios-card flex flex-col justify-center shadow-md" style="
              flex: 6; 
              margin-bottom: 0; 
              padding: 16px; 
              background: rgba(22, 22, 24, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.05);">
             ${(highlights?.max || highlights?.min) ? `
               <h3 class="text-secondary text-[10px] font-bold uppercase tracking-widest mb-4 opacity-70">Highlights</h3>
               <div class="flex flex-col gap-4">
                   ${highlights.max ? `
                       <div class="flex justify-between items-center pb-3" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                           <div style="min-width: 0; padding-right: 8px;">
                               <div class="text-[9px] text-red font-bold uppercase tracking-wider mb-1"><i class="fa-solid fa-arrow-trend-up mr-1"></i> High</div>
                               <div class="text-sm font-semibold text-white leading-tight truncate">${highlights.max.name}</div>
                           </div>
                           <div class="text-right">
                               <div class="text-red font-bold text-md whitespace-nowrap">£${highlights.max.total_amount.toFixed(2)}</div>
                               <div class="text-[9px] text-secondary opacity-60 mt-0.5">${uiDate(highlights.max.start_date)}</div>
                           </div>
                       </div>
                   ` : ''}
                   
                   ${highlights.min ? `
                       <div class="flex justify-between items-center pt-1">
                           <div style="min-width: 0; padding-right: 8px;">
                               <div class="text-[9px] text-green font-bold uppercase tracking-wider mb-1"><i class="fa-solid fa-arrow-trend-down mr-1"></i> Low</div>
                               <div class="text-sm font-semibold text-white leading-tight truncate">${highlights.min.name}</div>
                           </div>
                            <div class="text-right">
                               <div class="text-green font-bold text-md whitespace-nowrap">£${highlights.min.total_amount.toFixed(2)}</div>
                               <div class="text-[9px] text-secondary opacity-60 mt-0.5">${new Date(highlights.min.start_date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                           </div>
                       </div>
                   ` : ''}
               </div>
             ` : '<div class="text-center text-[10px] text-secondary opacity-50 py-4">Not enough data for highlights</div>'}
         </div>
      </div>
    `;

    // --- 2. Pie Chart ---
    const totalSum = summary?.total || 0;
    const colors = ['#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899'];

    html += `
       <div class="ios-card mb-4">
          <div class="flex justify-between items-center mb-6">
             <h3 class="text-md font-semibold text-white">Who Paid What?</h3>
          </div>
          
          <div class="flex flex-col items-center gap-6">
              <div style="width: 220px; height: 220px; position:relative;">
                  <canvas id="userChart" style="margin-top: -33%;"></canvas>
                  <div style="position:absolute; top:31%; left:50%; transform:translate(-50%, -50%); text-align:center;">
                     <div class="text-[10px] text-secondary uppercase tracking-wider font-bold">Total</div>
                     <div class="text-xl font-bold text-white">£${totalSum.toFixed(2)}</div>
                  </div>
              </div>
          </div>
       </div>
    `;

    // --- 3. Spending Trends Chart (Moved ABOVE Leaderboard) ---
    html += `
       <div class="ios-card mb-4">
          <div class="flex justify-between items-baseline mb-4">
             <h3 class="text-md font-semibold text-white">Spending Trend</h3>
          </div>
          <div style="height: 220px; width: 100%;">
             <canvas id="trendChart"></canvas>
          </div>
       </div>
    `;

    // --- 4. Leaderboard List (Moved to Bottom) ---
    html += `
       <div class="ios-card mb-4" style="background: transparent; padding: 0; border: none;">
          <h4 class="text-[10px] text-secondary uppercase tracking-widest font-bold mb-3 px-1">Leaderboard</h4>
          <div class="flex flex-col gap-sm">
             ${by_user && by_user.length > 0 ? by_user.map((u, index) => {
                const percentage = totalSum > 0 ? ((u.total_paid / totalSum) * 100) : 0;
                const color = colors[index % colors.length];

                return `
                   <div class="flex flex-col gap-xs p-1 rounded-2xl" style="background: rgba(255,255,255,0.02); border-radius: 16px; overflow: hidden; position: relative; padding: 2px 13px 4px 5px;">
                      <div class="flex justify-between items-center px-1 relative z-10">
                         <div class="flex items-center gap-3">
                            ${renderAvatar({ name: u.name, avatar: u.avatar, id: u.id }, 38)}
                            <span class="text-sm font-semibold text-white pt-0.5">${u.name}</span>
                         </div>
                         <span class="text-sm font-bold text-white pt-0.5">£${(u.total_paid || 0).toFixed(2)}</span>
                      </div>
                      <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${percentage}%; background: ${color}; opacity: 0.12; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);"></div>
                      <div style="position: absolute; bottom: 0; left: 0; height: 3px; width: ${percentage}%; background: ${color}; opacity: 0.8; border-radius: 0 2px 2px 0; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);"></div>
                   </div>
                `;
             }).join('') : '<div class="text-secondary text-xs text-center">No data for this period</div>'}
          </div>
       </div>
       
       <div style="height: 40px;"></div>
    `;

    scrollWrapper.innerHTML = html;
    attachListeners();
    initCharts();
  };

  const attachListeners = () => {
      container.querySelector('#back-btn').addEventListener('click', onBack);
      
      // Flatpickr
      const pickerBtn = container.querySelector('#date-range-picker-btn');
      const hiddenInput = container.querySelector('#hidden-date-picker');

      if (hiddenInput) {
          const fp = flatpickr(hiddenInput, {
              mode: "range",
              dateFormat: "d-M-Y",
              defaultDate: [state.dateRange.start, state.dateRange.end],
              theme: "dark",
              onChange: (selectedDates) => {
                  if (selectedDates.length === 2) {
                      state.dateRange.start = formatToEng(selectedDates[0]);
                      state.dateRange.end = formatToEng(selectedDates[1]);
                      loadData();
                  } else if (selectedDates.length === 0) {
                      // Clear
                      state.dateRange = { start: '', end: '' };
                      loadData();
                  }
              }
          });
          
          pickerBtn?.addEventListener('click', () => {
              fp.open();
          });
      }
  };

  const initCharts = () => {
      if (!state.data) return;
      const { timeline, by_user } = state.data;
      
      const chartDefaults = {
          color: '#8e8e93',
          borderColor: 'rgba(255,255,255,0.1)',
          font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 10 }
      };

      // 1. Trend Chart
      const trendCanvas = container.querySelector('#trendChart');
      if (trendCanvas && timeline.length > 0) {
          new Chart(trendCanvas, {
              type: 'line',
              data: {
                  labels: timeline.map(t => uiDate(t.start_date)),
                  datasets: [{
                      label: 'Spending',
                      data: timeline.map(t => t.total_amount),
                      borderColor: '#0A84FF',
                      backgroundColor: (context) => {
                          const ctx = context.chart.ctx;
                          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                          gradient.addColorStop(0, 'rgba(10, 132, 255, 0.4)');
                          gradient.addColorStop(1, 'rgba(10, 132, 255, 0)');
                          return gradient;
                      },
                      borderWidth: 2,
                      fill: true,
                      tension: 0.4,
                      pointRadius: 4,
                      pointBackgroundColor: '#0A84FF',
                      pointBorderColor: '#fff',
                      pointBorderWidth: 2
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                      legend: { display: false },
                      tooltip: {
                          backgroundColor: 'rgba(28, 28, 30, 0.9)',
                          titleColor: '#fff',
                          bodyColor: '#fff',
                          padding: 10,
                          cornerRadius: 8,
                          displayColors: false,
                          callbacks: {
                              title: (context) => {
                                  const idx = context[0].dataIndex;
                                  return timeline[idx].name; // Show Full Event Name on Hover
                              },
                              label: (context) => {
                                  return ` £${context.raw.toFixed(2)}`;
                              }
                          }
                      }
                  },
                  scales: {
                      y: {
                          border: { display: false },
                          grid: { color: 'rgba(255,255,255,0.05)' },
                          ticks: { color: '#8e8e93' }
                      },
                      x: {
                          grid: { display: false },
                          ticks: { color: '#8e8e93' }
                      }
                  }
              }
          });
      }

      // 2. User Breakdown Chart
      const userCanvas = container.querySelector('#userChart');
      if (userCanvas && by_user.length > 0) {
          new Chart(userCanvas, {
              type: 'doughnut',
              data: {
                  labels: by_user.map(u => u.name),
                  datasets: [{
                      data: by_user.map(u => u.total_paid),
                      backgroundColor: ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'],
                      borderWidth: 0,
                      hoverOffset: 4
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '75%',
                  plugins: { legend: { display: false } }
              }
          });
      }
  };

  const loadData = async () => {
    state.loading = true;
    render();
    try {
       state.data = await api.analytics.summary(state.dateRange.start, state.dateRange.end);
    } catch(e) {
       console.error("Analytics Load Error", e);
    } finally {
       state.loading = false;
       render();
    }
  };

  loadData();
  initPullToRefresh(scrollWrapper, loadData);
  container._cleanup = cleanup;
  return container;
}

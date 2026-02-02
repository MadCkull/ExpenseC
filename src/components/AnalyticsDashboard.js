import { api } from '../utils/api.js';
import { initPullToRefresh } from '../utils/pullToRefresh.js';
import { renderAvatar } from '../utils/ui.js';
import { createImageViewer } from './ImageViewer.js';

export function createAnalyticsDashboard({ onBack, initialDateRange }) {
  const container = document.createElement('div');
  container.className = 'dashboard container fade-in safe-area-bottom ptr-container';
  
  const scrollWrapper = document.createElement('div');
  scrollWrapper.className = 'scrollable-content';
  container.appendChild(scrollWrapper);
  
  let state = {
    loading: true,
    data: null,
    dateRange: initialDateRange || { start: '', end: '' }
  };

  const render = () => {
    // Header
    let html = `
      <header class="flex justify-between items-center mb-6 safe-area-top">
        <div class="flex items-center gap-sm">
          <button class="ios-btn secondary" id="back-btn" style="width: auto; padding: 8px 12px; display:flex; gap:6px; align-items:center;"><i class="fa-solid fa-chevron-left"></i> Back</button>
          <h1 class="text-xl">Analysis</h1>
        </div>
        <div class="relative">
           <input type="text" id="date-range-picker" class="ios-input text-xs" style="width: auto; font-size: 12px; text-align:center; background:var(--ios-card-bg);" placeholder="Select Date Range">
        </div>
      </header>
    `;

    if (state.loading) {
       html += '<div class="text-center p-8 text-secondary">Loading...</div>';
       scrollWrapper.innerHTML = html;
       container.querySelector('#back-btn').addEventListener('click', onBack);
       // Re-init picker even in loading state so it's visible? No, avoid flickering.
       return;
    }

    // Calculate My Total
    let myTotal = 0;
    const myId = parseInt(localStorage.getItem('expensec_user_id'));
    if (state.data && myId) {
        const me = state.data.by_user.find(u => u.id === myId);
        if (me) myTotal = me.total || 0;
    }

    // Charts
    html += `
       <div class="ios-card mb-6" style="background: linear-gradient(135deg, rgba(10,132,255,0.2), rgba(0,0,0,0.5)); border: 1px solid rgba(10,132,255,0.3);">
          <div class="text-secondary text-sm mb-1 uppercase">MY TOTAL SPENDING</div>
          <div class="text-xxl text-white font-bold">£${myTotal.toFixed(2)}</div>
          <div class="text-xs text-secondary mt-1">In selected range</div>
       </div>

         <div class="ios-card mb-6">
            <h3 class="text-md font-semibold mb-4 text-center" >Sharing</h3>
            <div class="flex flex-col items-center" style="margin-top: -10px;" style="overflow: visible;">
               <canvas id="userChart" width="300" height="300" style="max-width: 290px; margin-bottom: 10px; margin-top: 10px; padding: 10px; max-height: 290px; overflow: visible;"></canvas>
            </div>
            
            <div class="mt-2 flex flex-col gap-sm">
               <h4 class="text-[10px] text-secondary uppercase tracking-widest font-bold mb-2 px-1">Detailed Breakdown</h4>
               ${(() => {
                  const colors = ['#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899'];
                  const totalSum = state.data.by_user.reduce((sum, u) => sum + (u.total || 0), 0);
                  
                  return state.data.by_user.map((u, index) => {
                     const color = colors[index % colors.length];
                     const percentage = totalSum > 0 ? ((u.total || 0) / totalSum * 100) : 0;
                     
                     return `
                        <div class="flex flex-col gap-xs p-1 rounded-xl" style="background: rgba(255,255,255,0.02); border-radius: 15px; overflow: hidden; position: relative;">
                           <div class="flex justify-between items-center p-1 px-2 relative z-10;">
                              <div class="flex items-center gap-md">
                                 ${renderAvatar(u, 32)}
                                 <span class="text-sm font-medium pt-1">${u.name}</span>
                              </div>
                              <span class="text-sm font-bold pt-1">£${(u.total || 0).toFixed(2)}</span>
                           </div>
                           
                           <!-- Progress Bar Background -->
                           <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${percentage}%; background: ${color}; opacity: 0.08; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);"></div>
                           
                           <!-- Progress Bar Line -->
                           <div style="position: absolute; bottom: 0; left: 0; height: 2px; width: ${percentage}%; background: ${color}; opacity: 0.8; border-radius: 0 2px 2px 0; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);"></div>
                        </div>
                     `;
                  }).join('');
               })()}
            </div>
         </div>
       
       <div class="ios-card mb-6">
          <h3 class="text-md font-semibold mb-4">Spending Trend <span class="text-xs text-secondary font-normal ml-2">(Over Time)</span></h3>
          <canvas id="trendChart" width="400" height="250"></canvas>
       </div>
       
       <div style="height: 50px;"></div>
    `;

    scrollWrapper.innerHTML = html;
    
    // Listeners
    container.addEventListener('click', (e) => {
        const avatar = e.target.closest('.avatar img');
        if (avatar) {
             e.stopPropagation();
             createImageViewer(avatar.src);
             return;
        }
    });

    container.querySelector('#back-btn').addEventListener('click', onBack);
    
    // Init Flatpickr
    flatpickr(container.querySelector("#date-range-picker"), {
        mode: "range",
        dateFormat: "Y-m-d",
        defaultDate: [state.dateRange.start, state.dateRange.end],
        theme: "dark",
        onChange: (selectedDates, dateStr) => {
             if (selectedDates.length === 2) {
                 const start = selectedDates[0].toISOString().split('T')[0];
                 const end = selectedDates[1].toISOString().split('T')[0];
                 // Avoid reload loop if same
                 if (state.dateRange.start !== start || state.dateRange.end !== end) {
                     state.dateRange.start = start;
                     state.dateRange.end = end;
                     loadData();
                 }
             }
        }
    });

    initCharts();
  };

  const initCharts = () => {
     if (!state.data) return;
     
     // 1. User Pie Chart
     const userCtx = container.querySelector('#userChart').getContext('2d');
     const chart = new Chart(userCtx, {
        type: 'doughnut',
        data: {
           labels: state.data.by_user.map(u => u.name),
           datasets: [{
              data: state.data.by_user.map(u => u.total || 0),
              backgroundColor: ['#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899'],
              borderWidth: 0,
              hoverOffset: 10
           }]
        },
        options: {
           responsive: true,
           plugins: {
              legend: { display: false }
           }
        }
     });
     
     // 2. Trend Line Chart
     const trendCtx = container.querySelector('#trendChart').getContext('2d');
     new Chart(trendCtx, {
        type: 'line',
        data: {
           // Use Start Date for axis labels
           labels: state.data.timeline.map(t => new Date(t.start_date).toLocaleDateString(undefined, {month:'short', day:'numeric'})),
           datasets: [{
              label: 'Total Spending',
              data: state.data.timeline.map(t => t.total),
              borderColor: '#0A84FF',
              backgroundColor: 'rgba(10, 132, 255, 0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 4
           }]
        },
        options: {
           responsive: true,
           scales: {
              y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8e8e93', font: { size: 10 } } },
              x: { grid: { display: false }, ticks: { color: '#8e8e93', font: { size: 10 } } }
           },
           plugins: { legend: { display: false } }
        }
     });
  };

  const loadData = async () => {
    // Don't set loading = true to avoid full UI flicker, just overlay or silent refresh?
    // User requested "works perfectly", flicker is bad.
    // Chart.js can update. But let's keep it simple: re-render is safest.
    // To make it smooth, maybe just transparency overlay?
    // Let's use state.loading only for initial load.
    
    if (!state.data) {
        state.loading = true;
        render();
    }
    
    try {
       state.data = await api.events.analytics(state.dateRange.start, state.dateRange.end);
    } catch(e) {
       console.error(e);
       // alert("Failed to load analytics");
    } finally {
       state.loading = false;
       render();
    }
  };

  loadData();
  initPullToRefresh(scrollWrapper, loadData);

  return container;
}

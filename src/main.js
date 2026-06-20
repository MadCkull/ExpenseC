import { createLockScreen } from './components/LockScreen.js';
import { createUserDashboard } from './components/UserDashboard.js';
import { createAdminDashboard } from './components/AdminDashboard.js';
import { createAnalyticsDashboard } from './components/AnalyticsDashboard.js';
import { createEventHistory } from './components/EventHistory.js';
import { createImageViewer } from './components/ImageViewer.js';
import { userStore } from './utils/userStore.js';
import { api } from './utils/api.js';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './styles/main.css';

// Initialize Vercel Speed Insights
injectSpeedInsights();

const app = document.querySelector('#app');

const isPwa = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

const showForcefulInstallModal = () => {
    if (document.getElementById('forceful-install-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'forceful-install-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(30px); -webkit-backdrop-filter:blur(30px); z-index:9999; display:flex; align-items:center; justify-content:center; padding: 24px;';
    modal.innerHTML = `
      <div class="ios-card w-full fade-in" style="max-width: 360px; padding: 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
        <div style="background: linear-gradient(135deg, rgba(10,132,255,0.2), rgba(0,0,0,0)); padding: 32px 28px 24px; text-align: center;">
          <div style="width: 72px; height: 72px; border-radius: 20px; background: linear-gradient(135deg, #FF453A, #FF375F); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 8px 32px rgba(255,69,58,0.4);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; color: white;"></i>
          </div>
          <h2 style="font-size: 20px; font-weight: 800; color: white; margin-bottom: 10px; letter-spacing: -0.3px;">Action Required</h2>
          <p style="font-size: 15px; font-weight: 600; color: var(--ios-text-primary); line-height: 1.6; margin-bottom: 0;">Install the app and enable notifications. Yes, both. Stop looking for a skip button.</p>
        </div>
        <div style="padding: 8px 20px 28px; display: flex; flex-direction: column; gap: 10px;">
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px 16px; display: flex; align-items: center; gap: 14px;">
            <i class="fa-brands fa-apple" style="font-size: 22px; color: white; width: 24px; text-align: center;"></i>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: white;">iOS / iPadOS</div>
              <div style="font-size: 11px; color: var(--ios-text-secondary); margin-top: 2px;">Safari → Share → <em>Add to Home Screen</em></div>
            </div>
          </div>
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px 16px; display: flex; align-items: center; gap: 14px;">
            <i class="fa-brands fa-android" style="font-size: 22px; color: #3DDC84; width: 24px; text-align: center;"></i>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: white;">Android</div>
              <div style="font-size: 11px; color: var(--ios-text-secondary); margin-top: 2px;">Chrome → Menu → <em>Add to Home Screen</em></div>
            </div>
          </div>
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px 16px; display: flex; align-items: center; gap: 14px;">
            <i class="fa-brands fa-windows" style="font-size: 22px; color: #0078d4; width: 24px; text-align: center;"></i>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: white;">Windows</div>
              <div style="font-size: 11px; color: var(--ios-text-secondary); margin-top: 2px;">Edge / Chrome → Install button in address bar</div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
};

// Global Avatar Viewer
window.openFullAvatar = async (userId) => {
    if (!userId) return;
    
    // Check if we have a thumb to show immediately?
    // Maybe show spinner?
    // For now, just fetch.
    try {
        const res = await api.generic(`/users/${userId}/avatar`);
        if (res && res.avatar) {
             createImageViewer(res.avatar);
        } else {
             // If no avatar, maybe show name? 
             // Or just do nothing.
             console.log("No full avatar found.");
        }
    } catch (e) {
        console.error("Failed to load avatar", e);
    }
};

// Router Logic
function navigateTo(view, params = {}) {
  // Clean up previous component if it has a cleanup method
  const prevComponent = app.firstElementChild;
  if (prevComponent?._cleanup) prevComponent._cleanup();
  app.innerHTML = '';
  
  const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  if (view === 'lock') {
     // ... (lock logic matches existing)
     const lastUnlock = localStorage.getItem('last_unlock_time');
     const savedRole = localStorage.getItem('auth_role');
     
     if (lastUnlock && savedRole) {
         const elapsed = Date.now() - parseInt(lastUnlock);
         if (elapsed < LOCK_TIMEOUT) {
             console.log("Session valid, skipping lock.");
             return navigateTo('dashboard', { role: savedRole });
         }
     }
  
    app.appendChild(createLockScreen({
       onUnlock: (role) => {
          localStorage.setItem('auth_role', role);
          localStorage.setItem('last_unlock_time', Date.now().toString());
          navigateTo('dashboard', { role });
       }
    }));
  } else if (view === 'dashboard') {
    localStorage.setItem('last_unlock_time', Date.now().toString());
    const role = params.role || localStorage.getItem('auth_role') || 'user';
    
    const dashboard = createUserDashboard({
      role,
      onLogout: () => {
        localStorage.removeItem('auth_role');
        localStorage.removeItem('last_unlock_time');
        navigateTo('lock');
      },
      onAnalytics: () => navigateTo('analytics'), // Default analytics (active/all)
      onHistory: () => navigateTo('history')
    });
    
    app.appendChild(dashboard);
  } else if (view === 'admin') {
     localStorage.setItem('last_unlock_time', Date.now().toString());
     app.appendChild(createAdminDashboard({
        onBack: () => navigateTo('dashboard', { role: 'admin' })
     }));
  } else if (view === 'history') {
     localStorage.setItem('last_unlock_time', Date.now().toString());
     app.appendChild(createEventHistory({
         onBack: () => {
            const role = localStorage.getItem('auth_role') || 'user';
            navigateTo('dashboard', { role });
         },
         onSelectEvent: (event) => {
             // Navigate to analytics with this event's dates
             navigateTo('analytics', { 
                 start: event.start_date, 
                 end: event.end_date 
             });
         }
     }));
  } else if (view === 'analytics') {
     localStorage.setItem('last_unlock_time', Date.now().toString());
     
     const initialDates = params.start && params.end 
        ? { start: params.start, end: params.end }
        : null;

     app.appendChild(createAnalyticsDashboard({
        initialDateRange: initialDates,
        onBack: () => {
            // If came from history, maybe go back to history? 
            // For simplicity, go back to dashboard, or check params?
            // User flow: Dashboard -> History -> Analytics. Back -> Dashboard is fine.
            // Or Back -> History?
            // Let's go to Dashboard for now to prevent deep stack complexity.
            const role = localStorage.getItem('auth_role') || 'user';
            navigateTo('dashboard', { role });
        }
     }));
  }

  // Forceful install popup check for any page after lockscreen
  if (view !== 'lock') {
      if (!isPwa() && (!('Notification' in window) || Notification.permission !== 'granted')) {
          showForcefulInstallModal();
      }
  }
}

// Global Event Listener for Navigation
window.addEventListener('navigate', (e) => {
   if (e.detail === 'admin') navigateTo('admin');
   if (e.detail === 'analytics') navigateTo('analytics');
   if (e.detail === 'history') navigateTo('history');
});

// PWA Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  console.log('PWA Install Prompt available');
  // You can show a button here if needed
});

// Init Store
userStore.init();
// Background pre-fetch for instant popups
api.gandus.stats();

const savedRole = localStorage.getItem('auth_role');
// For security (since PIN is simple), maybe always require login on reload?
// "LockScreen (Pin)" implies lock on entry.
// So let's start with 'lock' always.
navigateTo('lock');

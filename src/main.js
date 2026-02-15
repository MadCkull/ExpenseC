import { createLockScreen } from './components/LockScreen.js';
import { createUserDashboard } from './components/UserDashboard.js';
import { createAdminDashboard } from './components/AdminDashboard.js';
import { createAnalyticsDashboard } from './components/AnalyticsDashboard.js';
import { createEventHistory } from './components/EventHistory.js';
import { userStore } from './utils/userStore.js';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './styles/main.css';

// Initialize Vercel Speed Insights
injectSpeedInsights();

const app = document.querySelector('#app');

// Router Logic
function navigateTo(view, params = {}) {
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

import { api } from './utils/api.js';

// Init Store
userStore.init();
// Background pre-fetch for instant popups
api.gandus.stats();

const savedRole = localStorage.getItem('auth_role');
// For security (since PIN is simple), maybe always require login on reload?
// "LockScreen (Pin)" implies lock on entry.
// So let's start with 'lock' always.
navigateTo('lock');

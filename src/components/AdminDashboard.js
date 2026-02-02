import { api } from '../utils/api.js';
import { initPullToRefresh } from '../utils/pullToRefresh.js';
import { renderAvatar } from '../utils/ui.js';
import { createImageViewer } from './ImageViewer.js';

export function createAdminDashboard({ onBack }) {
  const container = document.createElement('div');
  container.className = 'dashboard container fade-in safe-area-bottom ptr-container';
  
  const scrollWrapper = document.createElement('div');
  scrollWrapper.className = 'scrollable-content';
  container.appendChild(scrollWrapper);
  
  let state = {
    users: [],
    history: [],
    loading: true,
    view: 'events',
    showParticipantsModal: false,
    selectedParticipants: []
  };

  const render = () => {
    // Header
    let html = `
      <header class="flex justify-between items-center mb-6 safe-area-top">
        <div class="flex items-center gap-sm">
          <button class="ios-btn secondary" id="back-btn" style="width: auto; padding: 8px 12px; display:flex; gap:6px; align-items:center;"><i class="fa-solid fa-chevron-left"></i> Back</button>
          <h1 class="text-xl">Admin</h1>
        </div>
      </header>
      
      <div class="segmented-control mb-6">
        <button class="segment ${state.view === 'events' ? 'active' : ''}" id="view-events">Events</button>
        <button class="segment ${state.view === 'users' ? 'active' : ''}" id="view-users">Users</button>
      </div>
    `;

    if (state.loading) {
       html += '<div class="text-center p-8 text-secondary">Loading...</div>';
       scrollWrapper.innerHTML = html;
       container.querySelector('#back-btn').addEventListener('click', onBack);
       return;
    }

    if (state.view === 'users') {
      html += `
        <div class="ios-card mb-6" style="padding: 24px 20px;">
           <div class="flex items-center justify-between mb-5 px-1">
              <span style="font-size: 11px; color: var(--ios-text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.5; padding-bottom: 23px; margin: -17px 0 0 -11px;">Add New Member</span>
           </div>
           
           <div class="flex items-center gap-md" style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); justify-content: space-between;">
              <div id="new-user-avatar-preview" class="cursor-pointer" style="position:relative; flex-shrink: 0;">
                 ${renderAvatar({ name: '?' }, 54)}
                 <div style="position:absolute; bottom:0; right:0; background:var(--ios-blue); width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid var(--ios-card-bg); box-shadow: 0 2px 8px rgba(0,0,0,0.4);"><i class="fa-solid fa-camera" style="font-size: 9px; margin: auto;"></i></div>
              </div>
              
              <div class="flex-1 flex items-center gap-sm" style="width: 68vw;">
                 <input type="text" id="new-user-name" class="ios-input" placeholder="Enter name..." style="background:transparent; border:none; padding: 10px 8px; font-size: 15px; width: 100%;">
                 <button id="add-user-btn" style="background: var(--ios-blue); border:none; width: 44px; height: 44px; border-radius: 16px; color: white; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow: 0 4px 12px rgba(10, 132, 255, 0.3); transition: transform 0.2s;">
                    <i class="fa-solid fa-plus" style="font-size: 18px;"></i>
                 </button>
              </div>
              <input type="file" id="new-user-avatar-input" accept="image/*" class="hidden" style="display:none;">
           </div>
        </div>
        
        <div class="user-list flex flex-col gap-sm">
           <h3 class="text-xs text-secondary uppercase tracking-widest px-1 font-bold mb-2">Existing Users</h3>
      `;
      
      state.users.forEach(user => {
        html += `
          <div class="ios-card flex justify-between items-center user-edit-row" data-id="${user.id}" style="margin-bottom: 8px; padding: 12px 16px; cursor:pointer;">
             <div class="flex items-center gap-md">
                ${renderAvatar(user, 40)}
                <span class="text-md font-bold">${user.name}</span>
             </div>
             <div class="flex items-center gap-sm">
                <i class="fa-solid fa-chevron-right text-secondary opacity-30"></i>
             </div>
          </div>
        `;
      });
      html += `</div>`;
    } else if (state.view === 'events') {
      const activeEvent = state.history.find(w => w.is_active === 1);
      const allSelected = state.selectedParticipants.length === state.users.length;
      
      html += `
        <div class="ios-card mb-6" style="border: 1px solid var(--ios-blue); position: relative; ${!activeEvent ? 'padding-top: 48px;' : ''}">
           ${!activeEvent ? `
              <button class="ios-btn secondary" id="select-users-btn" style="position: absolute; top: 12px; left: 12px; width: auto; padding: 2px 10px; height: 26px; font-size: 11px; border-radius: 13px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 6px; z-index: 10;">
                 <i class="fa-solid fa-users" style="font-size: 10px; color: var(--ios-blue);"></i> 
                 <span style="font-weight: 700;">${allSelected ? 'All' : state.selectedParticipants.length}</span>
              </button>
           ` : ''}

           <h3 class="text-md font-semibold mb-2 text-blue text-left" style="margin: -10px 0px 10px 0;">${activeEvent ? 'Current Active Event' : 'Create New Event'}</h3>
           ${activeEvent ? `
              <div class="mb-4" style="margin-bottom: 20px;">
                 <div class="text-xl font-bold mb-1 text-center">${activeEvent.name}</div>
                 <div class="text-sm text-secondary text-center">Date: ${activeEvent.start_date} - ${activeEvent.end_date}</div>
              </div>
              <button class="ios-btn secondary text-red" id="archive-event-btn">End Event</button>
           ` : `
              <div class="flex flex-col gap-md">
                 <input type="text" id="new-event-name" class="ios-input" placeholder="Event Name" style="background:rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); text-align: center; padding: 14px 0 14px 0; border-radius: 13px;">
                 
                 <input type="text" id="new-event-dates" class="hidden" style="display:none;">
                 
                 <div class="flex gap-sm mt-2">
                     <button class="ios-btn secondary" id="trigger-dates-btn" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; font-size: 14px; background: rgba(255,255,255,0.03);">
                        <i class="fa-solid fa-calendar-alt text-blue text-sm"></i> 
                        <span id="date-btn-text">Select Dates</span>
                     </button>
                     <button class="ios-btn" id="start-event-btn" style="flex:1; font-weight: 700;">Start</button>
                 </div>
              </div>
           `}
        </div>

        <h3 class="text-md font-semibold mb-4 text-secondary">History</h3>
      `;
      
      const archived = state.history.filter(w => w.is_active !== 1);
      if (archived.length === 0) {
        html += '<div class="text-center text-secondary">No history available</div>';
      } else {
        archived.forEach(ev => {
             const range = ev.start_date ? `${ev.start_date} - ${ev.end_date}` : new Date(ev.created_at).toLocaleDateString();
             html += `
                <div class="swipe-item-container mb-3" style="border-radius: 13px;">
                   <div class="swipe-item-actions" style="background: transparent; width: 70px;">
                      <button data-action="delete-event" data-id="${ev.id}" style="background: none; border: none; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding-left: 10px;">
                         <i class="fa-solid fa-trash-can swipe-delete-icon" style="font-size: 16px; color: #8F1915; opacity: 0; transform: scale(0.6); transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);"></i>
                      </button>
                   </div>
                   <div class="swipe-item-content ios-card" data-id="${ev.id}" style="margin-bottom: 0; background: rgba(44, 44, 46, 0.45); padding: 12px 16px; border: 1px solid rgba(255,255,255,0.03); margin-bottom: 12px;">
                      <div class="flex justify-between items-center mb-7.5" style="margin-bottom: 5px;">
                         <span class="text-[14px] font-bold tracking-tight text-white opacity-90">${ev.name}</span>
                         <span class="text-blue font-bold text-[14px]">£${Number(ev.per_person || 0).toFixed(2)} <span class="text-[9px] opacity-40 uppercase font-bold tracking-wider">/head</span></span>
                      </div>
                      <div class="flex justify-between items-center text-[10px] text-secondary font-medium" style="margin-bottom: -9px;">
                         <div class="flex items-center gap-1.5 opacity-60">
                            <span style="font-size: 12px;">${range}</span>
                         </div>
                         <div class="flex items-center gap-1.5 pt-3.5">
                            <span class="text-[8px] uppercase font-bold tracking-widest opacity-20" style="font-size: 12px;">Total</span>
                            <span class="font-bold text-white opacity-60" style="font-size: 12px;">: £${Number(ev.total_amount || 0).toFixed(2)}</span>
                         </div>
                      </div>
                   </div>
                </div>
             `;
        });
      }
    }

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
    container.querySelector('#view-users').addEventListener('click', () => { state.view = 'users'; render(); });
    container.querySelector('#view-events').addEventListener('click', () => { state.view = 'events'; render(); });

    if (state.view === 'users') {
       let newAvatarBase64 = null;

       const avatarPreview = container.querySelector('#new-user-avatar-preview');
       const avatarInput = container.querySelector('#new-user-avatar-input');
       
       avatarPreview?.addEventListener('click', () => avatarInput.click());
       
       avatarInput?.addEventListener('change', (e) => {
         const file = e.target.files[0];
         if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
               newAvatarBase64 = event.target.result;
               avatarPreview.innerHTML = `
                   <div style="width:54px; height:54px; border-radius:50%; overflow:hidden; border:2px solid rgba(255,255,255,0.1);">
                       <img src="${newAvatarBase64}" style="width:100%; height:100%; object-fit:cover;">
                   </div>
                   <div style="position:absolute; bottom:0; right:0; background:var(--ios-blue); width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid var(--ios-card-bg); box-shadow: 0 2px 8px rgba(0,0,0,0.4);"><i class="fa-solid fa-camera" style="font-size: 9px; margin: auto;"></i></div>
               `;
            };
            reader.readAsDataURL(file);
         }
       });

       container.querySelector('#add-user-btn').addEventListener('click', async () => {
          const input = container.querySelector('#new-user-name');
          const name = input.value.trim();
          if (name) {
             try {
                await api.users.add(name, newAvatarBase64);
                input.value = '';
                newAvatarBase64 = null;
                await loadUsers();
             } catch(e) { alert(e.message); }
          }
       });
       
       container.querySelectorAll('.user-edit-row').forEach(row => {
          row.addEventListener('click', (e) => {
             // Avoid triggering if delete button clicked
             if (e.target.closest('[data-action="delete"]')) return;
             
             const id = row.dataset.id;
             const user = state.users.find(u => u.id == id);
             showEditUserModal(user);
          });
       });

       container.querySelectorAll('[data-action="delete"]').forEach(btn => {
         btn.addEventListener('click', async (e) => {
            const btnEl = e.target.closest('button');
            const id = btnEl.dataset.id;
            if(confirm('Are you sure you want to delete this user?')) {
               await api.users.remove(id);
               await loadUsers();
            }
         });
       });
    } else if (state.view === 'events') {
       const startBtn = container.querySelector('#start-event-btn');
       if (startBtn) {
         const dateInput = container.querySelector("#new-event-dates");
         const dateBtn = container.querySelector("#trigger-dates-btn");
         const picker = flatpickr(dateInput, {
             mode: "range",
             dateFormat: "Y-m-d",
             theme: "dark",
             onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                   const s = selectedDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                   const e = selectedDates[1].toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                   container.querySelector('#date-btn-text').textContent = `${s} - ${e}`;
                }
             }
         });
         dateBtn?.addEventListener('click', () => picker.open());
         
         startBtn.addEventListener('click', async () => {
             const name = container.querySelector('#new-event-name').value;
             const dates = picker.selectedDates;
             if (!name) return alert("Name is required");
             if (dates.length !== 2) return alert("Select Date Range");
             if (state.selectedParticipants.length === 0) return alert("Select Participants");
             
             const formatDate = (date) => {
                 const d = new Date(date);
                 const year = d.getFullYear();
                 const month = String(d.getMonth() + 1).padStart(2, '0');
                 const day = String(d.getDate()).padStart(2, '0');
                 return `${year}-${month}-${day}`;
             };

             const start_date = formatDate(dates[0]);
             const end_date = formatDate(dates[1]);

             try {
                await api.events.start(name, state.selectedParticipants, start_date, end_date);
                await loadHistory();
             } catch(e) { alert(e.message); }
         });

         container.querySelector('#select-users-btn').addEventListener('click', () => {
              const modalOverlay = document.createElement('div');
              modalOverlay.id = 'participants-modal-root';
              modalOverlay.innerHTML = renderParticipantsModal(state);
              document.body.appendChild(modalOverlay);
              document.body.classList.add('modal-open');
              
              const modalRoot = document.getElementById('participants-modal-root');
              modalRoot.querySelector('#close-participants-btn').addEventListener('click', () => {
                  modalRoot.remove();
                  document.body.classList.remove('modal-open');
                  render();
              });
              
               modalRoot.querySelectorAll('.participant-check').forEach(chk => {
                   chk.addEventListener('change', (e) => {
                       const id = parseInt(e.target.value);
                       const card = e.target.closest('.pt-selection-card');
                       const avatar = card.querySelector('.avatar');
                       const nameText = card.querySelector('span');
                       const indicator = card.querySelector('.selection-indicator');

                       if (e.target.checked) {
                           state.selectedParticipants.push(id);
                           card.classList.add('selected');
                           card.style.borderColor = 'var(--ios-blue)';
                           avatar.style.background = 'var(--ios-blue)';
                           nameText.classList.remove('text-secondary');
                           nameText.classList.add('text-white');
                           indicator.innerHTML = '<i class="fa-solid fa-circle-check text-blue text-lg"></i>';
                       } else {
                           state.selectedParticipants = state.selectedParticipants.filter(p => p !== id);
                           card.classList.remove('selected');
                           card.style.borderColor = 'transparent';
                           avatar.style.background = 'rgba(255,255,255,0.1)';
                           nameText.classList.remove('text-white');
                           nameText.classList.add('text-secondary');
                           indicator.innerHTML = '<i class="fa-regular fa-circle text-secondary opacity-20 text-lg"></i>';
                       }
                       const btn = container.querySelector('#select-users-btn');
                       if (btn) btn.innerHTML = `<i class="fa-solid fa-users" style="font-size: 10px; color: var(--ios-blue);"></i> <span style="font-weight: 700;">${state.selectedParticipants.length === state.users.length ? 'All' : state.selectedParticipants.length}</span>`;
                   });
               });
         });
       }

       const archiveBtn = container.querySelector('#archive-event-btn');
       if (archiveBtn) {
         archiveBtn.addEventListener('click', async () => {
             if (confirm("Archive this event?")) {
                await api.events.archive();
                await loadHistory();
             }
         });
       }
       
        // Global click to reset all swiped items
        const resetAllSwipes = () => {
           container.querySelectorAll('.swipe-item-content').forEach(content => {
              content.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
              content.style.transform = 'translateX(0)';
              const icon = content.parentElement.querySelector('.swipe-delete-icon');
              if (icon) {
                 icon.style.opacity = '0';
                 icon.style.transform = 'scale(0.6)';
              }
           });
        };

        document.addEventListener('click', (e) => {
           if (!e.target.closest('.swipe-item-container')) {
              resetAllSwipes();
           }
        }, { once: true });

        // Swipe to delete logic
        container.querySelectorAll('.swipe-item-container').forEach(swipeContainer => {
           let startX = 0;
           let currentX = 0;
           const content = swipeContainer.querySelector('.swipe-item-content');
           const icon = swipeContainer.querySelector('.swipe-delete-icon');
           const actionWidth = 70;

           swipeContainer.addEventListener('touchstart', (e) => {
              // Reset others before starting new swipe
              container.querySelectorAll('.swipe-item-content').forEach(c => {
                 if (c !== content && c.style.transform !== 'translateX(0px)') {
                    c.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
                    c.style.transform = 'translateX(0)';
                    const otherIcon = c.parentElement.querySelector('.swipe-delete-icon');
                    if (otherIcon) {
                       otherIcon.style.opacity = '0';
                       otherIcon.style.transform = 'scale(0.6)';
                    }
                 }
              });
              
              startX = e.touches[0].clientX;
              content.style.transition = 'none';
           }, { passive: true });

           swipeContainer.addEventListener('touchmove', (e) => {
              const x = e.touches[0].clientX - startX;
              // Only allow left swipe
              if (x < 5) {
                currentX = x;
                const overshoot = Math.max(0, -x - actionWidth);
                const rubberBandX = x + (overshoot * 0.5); // Subtle rubber band effect
                const finalX = currentX < -actionWidth ? rubberBandX : currentX;
                content.style.transform = `translateX(${finalX}px)`;
                
                // Icon feedback
                const progress = Math.min(1, Math.abs(finalX) / actionWidth);
                if (icon) {
                   icon.style.opacity = progress.toString();
                   icon.style.transform = `scale(${0.6 + (progress * 0.4)})`;
                }
              }
           }, { passive: true });

           const resetSwipe = () => {
              content.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
              if (icon) icon.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
              
              if (currentX < -actionWidth / 1.5) {
                 content.style.transform = `translateX(-${actionWidth}px)`;
                 if (icon) {
                    icon.style.opacity = '1';
                    icon.style.transform = 'scale(1)';
                 }
              } else {
                 content.style.transform = 'translateX(0)';
                 if (icon) {
                    icon.style.opacity = '0';
                    icon.style.transform = 'scale(0.6)';
                 }
              }
              currentX = 0;
           };

           swipeContainer.addEventListener('touchend', resetSwipe);
           swipeContainer.addEventListener('touchcancel', resetSwipe);
        });

        container.querySelectorAll('[data-action="delete-event"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
             const btnEl = e.target.closest('button');
             const id = btnEl.dataset.id;
             if (confirm("Permanently delete this event history?")) {
                await api.events.delete(id);
                await loadHistory();
             }
          });
        });

    }
  };

  const loadUsers = async () => {
    state.users = await api.users.list();
    if (state.selectedParticipants.length === 0) {
        state.selectedParticipants = state.users.map(u => u.id);
    }
    if(state.view === 'users') render();
  };

  const loadHistory = async () => {
    state.history = await api.events.history();
    if(state.view === 'events') render();
  };

  const init = async () => {
    state.loading = true;
    render();
    await Promise.all([loadUsers(), loadHistory()]);
    state.loading = false;
    render();
  };

  const showEditUserModal = (user) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
      modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(30px); z-index:999; display:flex; align-items:center; justify-content:center;';
      
      let currentAvatar = user.avatar;

      modal.innerHTML = `
        <div class="ios-card w-full max-w-sm safe-area-bottom fade-in" style="padding: 32px; border: 1px solid var(--ios-separator); position: relative; overflow: auto;">
           <!-- Top Header -->
           <div style="position: absolute; top: 20px; left: 24px; right: 16px; display: flex; justify-content: space-between; align-items: center; z-index: 20;">
              <span style="margin-top: -14%; margin-left: -5%; font-size: 11px; color: var(--ios-text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.5;">Edit Profile</span>
              
              <button id="close-edit-btn" style="background: rgba(255,255,255,0.08); border: none; width: 32px; height: 32px; border-radius: 50%; color: var(--ios-text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer; transition: all 0.2s;">
                 <i class="fa-solid fa-xmark"></i>
              </button>
           </div>

           <!-- Status -->
           <div id="save-status" style="position: absolute; top: 56px; left: 0; right: 0; font-size: 9px; color: var(--ios-blue); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0; transition: opacity 0.3s; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <i class="fa-solid fa-circle-notch fa-spin"></i> Saving
           </div>
           
           <!-- Content Area -->
           <div class="flex flex-col items-center mb-8" style="margin-top: 40px;">
              <div id="edit-avatar-preview" class="cursor-pointer" style="position:relative;">
                 ${renderAvatar(user, 100)}
                 <div style="position:absolute; bottom:4px; right:4px; background:var(--ios-blue); width:28px; height:28px; border-radius:50%; display:flex; items-center; justify-center; font-size:14px; border:2px solid var(--ios-card-bg); box-shadow: 0 4px 12px rgba(0,0,0,0.3);"><i class="fa-solid fa-camera" style="margin: auto;"></i></div>
              </div>
              <input type="file" id="edit-avatar-input" accept="image/*" class="hidden" style="display:none;">
           </div>

           <div class="flex flex-col gap-sm mb-10">
              <label class="text-xs text-secondary font-bold uppercase px-1 tracking-wider opacity-60">Display Name</label>
              <input type="text" id="edit-user-name" class="ios-input" value="${user.name}" placeholder="Enter name" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); text-align: center; font-size: 18px; padding: 14px;">
           </div>

           <!-- Bottom Actions -->
           <div style="display: flex; justify-content: flex-end; padding-top: 13px;">
              <button id="delete-user-modal-btn" style="background: transparent; border: none; font-size: 10px; color: #FF453A; gap: 6px; font-weight: 700; opacity: 0.4; transition: all 0.2s; display: flex; align-items: center; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; padding: 0 4px;">
                 <i class="fa-solid fa-trash-can" style="font-size: 9px;"></i> Delete User
              </button>
           </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.classList.add('modal-open');

      const avatarPreview = modal.querySelector('#edit-avatar-preview');
      const avatarInput = modal.querySelector('#edit-avatar-input');
      const nameInput = modal.querySelector('#edit-user-name');
      const saveStatus = modal.querySelector('#save-status');
      const closeBtn = modal.querySelector('#close-edit-btn');
      
      const deleteBtn = modal.querySelector('#delete-user-modal-btn');
      
      const showSaving = () => { saveStatus.style.opacity = '1'; };
      const hideSaving = () => { setTimeout(() => { saveStatus.style.opacity = '0'; }, 800); };

      const saveChanges = async () => {
          const name = nameInput.value.trim();
          if (!name) return;
          
          showSaving();
          try {
              await api.users.update(user.id, { name, avatar: currentAvatar });
              await loadUsers();
          } catch(e) { 
              console.error(e);
              saveStatus.innerHTML = '<i class="fa-solid fa-circle-exclamation text-red"></i> Error';
              saveStatus.style.opacity = '1';
          } finally {
              hideSaving();
          }
      };

      closeBtn.addEventListener('click', () => {
          modal.remove();
          document.body.classList.remove('modal-open');
      });

      deleteBtn.addEventListener('click', async () => {
          if (confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
              try {
                  await api.users.remove(user.id);
                  modal.remove();
                  document.body.classList.remove('modal-open');
                  await loadUsers();
              } catch(e) {
                  alert("Failed to delete user: " + e.message);
              }
          }
      });

      avatarPreview.addEventListener('click', () => avatarInput.click());
      
      avatarInput.addEventListener('change', (e) => {
         const file = e.target.files[0];
         if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                currentAvatar = event.target.result;
                avatarPreview.innerHTML = `
                    <div style="width:100px; height:100px; border-radius:50%; overflow:hidden; border: 2px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05);">
                        <img src="${currentAvatar}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="position:absolute; bottom:4px; right:4px; background:var(--ios-blue); width:28px; height:28px; border-radius:50%; display:flex; items-center; justify-center; font-size:14px; border:2px solid var(--ios-card-bg); box-shadow: 0 4px 12px rgba(0,0,0,0.3);"><i class="fa-solid fa-camera" style="margin: auto;"></i></div>
                `;
                await saveChanges();
            };
            reader.readAsDataURL(file);
         }
      });

      nameInput.addEventListener('blur', saveChanges);
      nameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
              nameInput.blur();
          }
      });
  };

  const renderParticipantsModal = (activeState) => {
      return `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(20px); z-index:999; display:flex; align-items:center; justify-content:center;">
           <div class="ios-card w-full max-w-sm safe-area-bottom fade-in" style="width:100%; max-width:400px; max-height:80vh; border: 1px solid var(--ios-separator); padding: 24px; display:flex; flex-direction:column; overflow:auto; margin: auto;">
              <div class="flex justify-between items-center mb-6 popup-header" style="flex-shrink: 0;">
                 <h2 class="text-xl font-bold">Participants</h2>
                 <button class="ios-btn secondary" id="close-participants-btn" style="width: auto; padding: 8px 16px; font-size: 14px;">Done</button>
              </div>
              
              <div class="flex-1 overflow-y-auto pr-1" style="min-height: 0;">
                  <div class="flex flex-col gap-md participants-scroll" style="padding-bottom: 10px;">
                      ${activeState.users.map(u => `
                         <label class="flex items-center justify-between p-4 cursor-pointer User-list-item pt-selection-card ${activeState.selectedParticipants.includes(u.id) ? 'selected' : ''}" 
                                style="background:rgba(255,255,255,0.03); border: 2px solid ${activeState.selectedParticipants.includes(u.id) ? 'var(--ios-blue)' : 'transparent'}; border-radius:20px; transition: all 0.2s ease; margin-bottom: 8px; flex-shrink: 0;">
                            <input type="checkbox" class="participant-check hidden-checkbox" value="${u.id}" ${activeState.selectedParticipants.includes(u.id) ? 'checked' : ''} style="display:none;">
                            <div class="flex items-center gap-md">
                               ${renderAvatar({ name: u.name, avatar: u.avatar }, 40, activeState.selectedParticipants.includes(u.id) ? 'avatar-selected' : '')}
                               <span class="font-bold ${activeState.selectedParticipants.includes(u.id) ? 'text-white' : 'text-secondary'}">${u.name}</span>
                            </div>
                            <div class="selection-indicator">
                               ${activeState.selectedParticipants.includes(u.id) ? '<i class="fa-solid fa-circle-check text-blue text-lg"></i>' : '<i class="fa-regular fa-circle text-secondary opacity-20 text-lg"></i>'}
                            </div>
                         </label>
                      `).join('')}
                  </div>
              </div>
           </div>
        </div>
      `;
  };

  init();
  initPullToRefresh(scrollWrapper, init);

  return container;
}

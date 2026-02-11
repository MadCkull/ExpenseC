import { userStore } from './userStore.js';

export function renderAvatar(user, size = 40, className = '') {
  const id = user.id || user.user_id || user.userId;
  const name = user.name || user.user_name || user.userName;
  
  // Try inline avatar first, then check userStore lookup
  const avatar = user.avatar || user.user_avatar || (id ? userStore.getAvatar(id) : null);
  
  if (avatar) {
    return `<div class="avatar flex items-center justify-center ${className}" 
                 style="width: ${size}px; height: ${size}px; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.1);">
              <img src="${avatar}" alt="${name || 'Avatar'}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
            </div>`;
  }
  
  const initials = name ? name.charAt(0).toUpperCase() : '?';
  return `<div class="avatar flex items-center justify-center font-bold ${className}" 
               style="width: ${size}px; height: ${size}px; background: rgba(255,255,255,0.1); border-radius: 50%; color: white;">
            ${initials}
          </div>`;
}


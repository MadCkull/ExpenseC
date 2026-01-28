export function renderAvatar(user, size = 40, className = '') {
  if (user.avatar) {
    return `<div class="avatar flex items-center justify-center ${className}" 
                 style="width: ${size}px; height: ${size}px; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.1);">
              <img src="${user.avatar}" alt="${user.name}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>`;
  }
  
  const initials = user.name ? user.name.charAt(0).toUpperCase() : '?';
  return `<div class="avatar flex items-center justify-center font-bold ${className}" 
               style="width: ${size}px; height: ${size}px; background: rgba(255,255,255,0.1); border-radius: 50%; color: white;">
            ${initials}
          </div>`;
}

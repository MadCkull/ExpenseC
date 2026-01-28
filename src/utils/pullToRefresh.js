export function initPullToRefresh(container, onRefresh) {
  let startY = 0;
  let currentY = 0;
  let isPulling = false;
  let isRefreshing = false;
  
  const threshold = 80; 
  const resistance = 0.4; 
  
  const indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
  container.prepend(indicator);

  const reset = () => {
    isPulling = false;
    container.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    container.style.transform = 'translateY(0)';
    indicator.classList.remove('active');
    setTimeout(() => {
      indicator.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
    }, 400);
  };

  // Helper to check if a modal or popup is open
  const isModalOpen = () => {
    return document.body.classList.contains('modal-open') || 
           document.querySelector('.flatpickr-calendar.open') ||
           document.querySelector('.modal-root'); // Generic fallback
  };

  container.addEventListener('touchstart', (e) => {
    if (isRefreshing || isModalOpen()) return;
    if (window.scrollY > 5) return;
    
    startY = e.touches[0].pageY;
    isPulling = false; 
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (isRefreshing || isModalOpen()) return;
    if (window.scrollY > 5) return;

    currentY = e.touches[0].pageY;
    const diff = (currentY - startY) * resistance;

    if (!isPulling && diff > 15) { // Increased dead-zone
      isPulling = true;
      container.style.transition = 'none';
      indicator.classList.add('active');
    }

    if (isPulling && diff >= 0) {
      container.style.transform = `translateY(${diff}px)`;
      
      if (diff > threshold) {
        indicator.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
      } else {
        indicator.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
        const arrow = indicator.querySelector('i');
        if (arrow) {
            const rotation = Math.min((diff / threshold) * 180, 180);
            arrow.style.transform = `rotate(${rotation}deg)`;
        }
      }
    }
  }, { passive: true });

  container.addEventListener('touchend', async () => {
    if (!isPulling || isRefreshing) {
        if (!isRefreshing) container.style.transform = 'translateY(0)'; // Safety reset
        return;
    }
    
    const diff = (currentY - startY) * resistance;
    
    if (diff > threshold) {
      isRefreshing = true;
      isPulling = false;
      
      container.style.transition = 'transform 0.3s ease-out';
      container.style.transform = 'translateY(50px)'; 
      
      indicator.innerHTML = '<i class="fa-solid fa-rotate fa-spin-ios"></i>';
      
      if (navigator.vibrate) navigator.vibrate(25);

      try {
        await onRefresh();
      } catch (err) {
        console.error("Refresh failed", err);
      } finally {
        isRefreshing = false;
        reset();
      }
    } else {
      reset();
    }
  });

  // Global reset for weird edge cases (like visibility change or app switching)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reset();
  });
}


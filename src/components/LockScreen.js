import { api } from '../utils/api.js';

export function createLockScreen({ onUnlock }) {
  const container = document.createElement('div');
  container.className = 'lock-screen flex flex-col items-center justify-center safe-area-top safe-area-bottom safe-area-x';
  container.style.height = '100vh';
  
  let currentPin = '';
  
  const template = `
    <div class="text-center fade-in">
      <div class="mb-8" style="margin-bottom: 40px;">
        <img src="/ExpenseC-192.png" alt="ExpenseC" style="width: 80px; height: 80px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 20px;">
        <!-- <h1 class="text-xl mb-2">ExpenseC</h1> -->
        <p class="text-secondary text-sm">Enter PIN to access</p>
      </div>
      
      <div class="pin-display flex justify-center gap-md mb-8" style="margin-bottom: 40px;">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
      
      <div class="pin-pad">
        <div class="row">
          <button class="pin-btn" data-val="1">1</button>
          <button class="pin-btn" data-val="2">2</button>
          <button class="pin-btn" data-val="3">3</button>
        </div>
        <div class="row">
          <button class="pin-btn" data-val="4">4</button>
          <button class="pin-btn" data-val="5">5</button>
          <button class="pin-btn" data-val="6">6</button>
        </div>
        <div class="row">
          <button class="pin-btn" data-val="7">7</button>
          <button class="pin-btn" data-val="8">8</button>
          <button class="pin-btn" data-val="9">9</button>
        </div>
        <div class="row">
          <button class="pin-btn empty"></button>
          <button class="pin-btn" data-val="0">0</button>
          <button class="pin-btn delete" data-action="delete">⌫</button>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = template;
  
  // Styles for Lock Screen specific elements
  const style = document.createElement('style');
  style.textContent = `
    .pin-display .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 1px solid var(--ios-text-secondary);
      transition: all 0.2s;
    }
    .pin-display .dot.filled {
      background: white;
      border-color: white;
    }
    .pin-pad {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .pin-pad .row {
      display: flex;
      gap: 24px;
      justify-content: center;
    }
    .pin-btn {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: white;
      font-size: 28px;
      font-weight: 400;
      backdrop-filter: blur(10px);
      transition: background 0.2s;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-btn:active {
      background: rgba(255, 255, 255, 0.3);
    }
    .pin-btn.empty {
      visibility: hidden;
      pointer-events: none;
    }
    .pin-btn.delete {
      background: transparent;
      font-size: 24px;
    }
    .shake {
      animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
    }
    @keyframes shake {
      10%, 90% { transform: translate3d(-1px, 0, 0); }
      20%, 80% { transform: translate3d(2px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
      40%, 60% { transform: translate3d(4px, 0, 0); }
    }
  `;
  container.appendChild(style);
  
  // Logic
  const updateDots = () => {
    const dots = container.querySelectorAll('.dot');
    dots.forEach((dot, i) => {
      if (i < currentPin.length) dot.classList.add('filled');
      else dot.classList.remove('filled');
    });
  };
  
  const handleInput = async (val) => {
    if (currentPin.length < 4) {
      currentPin += val;
      updateDots();
      
      if (currentPin.length === 4) {
        // Verify
        try {
          const res = await api.auth.login(currentPin);
          onUnlock(res.role);
        } catch (e) {
          // Error shake
          const display = container.querySelector('.pin-display');
          display.classList.add('shake');
          setTimeout(() => {
            display.classList.remove('shake');
            currentPin = '';
            updateDots();
          }, 500);
        }
      }
    }
  };
  
  const handleDelete = () => {
    if (currentPin.length > 0) {
      currentPin = currentPin.slice(0, -1);
      updateDots();
    }
  };
  
  container.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = btn.dataset.val;
      const action = btn.dataset.action;
      
      if (action === 'delete') handleDelete();
      else if (val !== undefined) handleInput(val);
      
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(10);
    });
  });

  return container;
}

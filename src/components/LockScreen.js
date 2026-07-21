import { api } from '../utils/api.js';

async function isBiometricAvailable() {
  if (window.PublicKeyCredential && 
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
    return true;
  }
  return false;
}

async function registerBiometrics(userPin) {
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const createOptions = {
      publicKey: {
        challenge: challenge,
        rp: { name: "ExpenseC", id: window.location.hostname },
        user: {
          id: Uint8Array.from("user", c => c.charCodeAt(0)),
          name: "user@expensec",
          displayName: "Standard User"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000
      }
    };
    const credential = await navigator.credentials.create(createOptions);
    if (credential) {
      localStorage.setItem('biometric_cred_id', btoa(String.fromCharCode(...new Uint8Array(credential.rawId))));
      localStorage.setItem('cached_user_pin', userPin);
      localStorage.setItem('biometrics_enabled', 'true');
      return true;
    }
  } catch (err) {
    console.error("Biometric registration failed:", err);
    return false;
  }
}


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
          <button class="pin-btn empty" id="biometric-trigger">
            <i class="fa-solid fa-fingerprint"></i>
          </button>
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
    .pin-btn.empty.show {
      visibility: visible;
      pointer-events: auto;
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
  
  const showBiometricSetupModal = (pin, role) => {
    const modal = document.createElement('div');
    modal.className = 'fade-in flex flex-col items-center justify-center';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); z-index:100; padding: 24px; text-align: center;';
    
    modal.innerHTML = `
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px 24px; max-width: 320px; width: 100%;">
        <div style="font-size: 48px; margin-bottom: 16px; color: white;">
          <i class="fa-solid fa-fingerprint"></i>
        </div>
        <h2 style="font-size: 20px; font-weight: 700; color: white; margin-bottom: 12px;">Fast Unlock</h2>
        <p style="font-size: 14px; color: var(--ios-text-secondary); margin-bottom: 24px; line-height: 1.5;">
          Set up Fingerprint or Face ID for faster access to ExpenseC.
        </p>
        <button id="btn-setup-bio" style="width: 100%; background: white; color: black; font-weight: 700; padding: 14px; border-radius: 12px; border: none; font-size: 16px; margin-bottom: 12px; cursor: pointer;">
          Set Up Now
        </button>
        <button id="btn-cancel-bio" style="width: 100%; background: transparent; color: var(--ios-text-secondary); font-weight: 600; padding: 14px; border-radius: 12px; border: none; font-size: 15px; cursor: pointer;">
          Not Now
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#btn-setup-bio').addEventListener('click', async () => {
      const success = await registerBiometrics(pin);
      if (success) {
        document.body.removeChild(modal);
        onUnlock(role);
      } else {
        alert("Setup failed or was cancelled. Please try again or skip.");
      }
    });
    
    modal.querySelector('#btn-cancel-bio').addEventListener('click', () => {
      document.body.removeChild(modal);
      onUnlock(role);
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
          
          if (res.role === 'user') {
            const biometricsEnabled = localStorage.getItem('biometrics_enabled') === 'true';
            if (!biometricsEnabled && await isBiometricAvailable()) {
              showBiometricSetupModal(currentPin, res.role);
            } else {
              onUnlock(res.role);
            }
          } else {
            onUnlock(res.role); // Admin skips biometrics completely
          }
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

  const initBiometrics = async () => {
    const bioBtn = container.querySelector('#biometric-trigger');
    const biometricsEnabled = localStorage.getItem('biometrics_enabled') === 'true';
    const cachedPin = localStorage.getItem('cached_user_pin');
    
    if (biometricsEnabled && cachedPin && await isBiometricAvailable()) {
      bioBtn.classList.add('show');
      
      const doUnlock = async () => {
        try {
          const credIdBase64 = localStorage.getItem('biometric_cred_id');
          if (!credIdBase64) return;
          
          const rawId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge: challenge,
              allowCredentials: [{ id: rawId, type: 'public-key' }],
              userVerification: "required",
              timeout: 60000
            }
          });
          
          if (assertion) {
            const res = await api.auth.login(cachedPin);
            if (res.role === 'user') onUnlock(res.role);
          }
        } catch (err) {
          console.error("Biometric unlock failed:", err);
        }
      };
      
      bioBtn.addEventListener('click', doUnlock);
      // Auto trigger on load with slight delay so animation finishes
      setTimeout(() => doUnlock(), 300);
    }
  };
  
  initBiometrics();

  return container;
}

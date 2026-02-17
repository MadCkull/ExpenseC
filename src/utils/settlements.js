import { renderAvatar } from './ui.js';

/**
 * Pure logic to calculate who pays who
 */
export function calculateSettlements(expenses, perHead) {
    const balances = expenses.map(u => ({
        user_id: u.user_id,
        name: u.user_name || u.name,
        avatar: u.user_avatar || u.avatar,
        balance: Number(u.amount || 0) - perHead
    }));

    const debtors = balances.filter(b => b.balance < -0.01).sort((a,b) => a.balance - b.balance);
    const creditors = balances.filter(b => b.balance > 0.01).sort((a,b) => b.balance - a.balance);
    
    const settlements = [];
    let d_idx = 0;
    let c_idx = 0;

    const d_list = debtors.map(d => ({...d, balance: Math.abs(d.balance)}));
    const c_list = creditors.map(c => ({...c}));

    while (d_idx < d_list.length && c_idx < c_list.length) {
        const d = d_list[d_idx];
        const c = c_list[c_idx];
        const amount = Math.min(d.balance, c.balance);
        
        if (amount > 0.01) {
            settlements.push({
                from: { name: d.name, avatar: d.avatar, user_id: d.user_id },
                to: { name: c.name, avatar: c.avatar, user_id: c.user_id },
                amount: amount
            });
        }
        
        d.balance -= amount;
        c.balance -= amount;
        
        if (d.balance < 0.01) d_idx++;
        if (c.balance < 0.01) c_idx++;
    }
    return settlements;
}

/**
 * Renders a personal summary card (used in the modal)
 */
export function renderPersonalSummaryCard(user, settlements, isInsideModal = false) {
    if (!user) return '';

    const myDebts = settlements.filter(s => s.from.user_id == user.user_id);
    const myCredits = settlements.filter(s => s.to.user_id == user.user_id);

    if (myDebts.length === 0 && myCredits.length === 0) {
        return `
          <div class="ios-card fade-in" style="background: rgba(48, 209, 88, 0.1); border: 1px solid rgba(48, 209, 88, 0.2); padding: 16px;">
             <div class="flex items-center gap-md">
                <div style="font-size: 24px;"><i class="fa-solid fa-circle-check text-green"></i></div>
                <div>
                   <div class="text-sm font-bold text-white">You're all squared away!</div>
                   <div class="text-[11px] text-secondary opacity-70 uppercase tracking-widest font-bold">No payments needed</div>
                </div>
             </div>
          </div>
        `;
    }

    return `
      <div class="flex flex-col gap-sm">
          ${myDebts.map(s => `
              <div class="ios-card fade-in flex items-center" style="background: rgba(255, 69, 58, 0.1); border: 1px solid rgba(255, 69, 58, 0.2); padding: 12px 16px; margin-bottom: 0;">
                  <div style="flex: 1; text-align: left;">
                       <span class="text-[11px] uppercase font-bold text-red opacity-80 tracking-wider">Pay to</span>
                  </div>
                  <div style="flex: 0 0 auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                      ${renderAvatar({ name: s.to.name, avatar: s.to.avatar, id: s.to.user_id }, 32)}
                      <span class="text-[11px] font-bold text-white leading-tight">${s.to.name}</span>
                  </div>
                  <div style="flex: 1; text-align: right;">
                      <span class="text-lg font-bold text-red">£${s.amount.toFixed(2)}</span>
                  </div>
              </div>
          `).join('')}

          ${myCredits.map(s => `
              <div class="ios-card fade-in flex items-center" style="background: rgba(48, 209, 88, 0.1); border: 1px solid rgba(48, 209, 88, 0.2); padding: 12px 16px; margin-bottom: 0;">
                  <div style="flex: 1; text-align: left;">
                       <span class="text-[11px] uppercase font-bold text-green opacity-80 tracking-wider">Receive from</span>
                  </div>
                  <div style="flex: 0 0 auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                      ${renderAvatar({ name: s.from.name, avatar: s.from.avatar, id: s.from.user_id }, 32)}
                      <span class="text-[11px] font-bold text-white leading-tight">${s.from.name}</span>
                  </div>
                  <div style="flex: 1; text-align: right;">
                      <span class="text-lg font-bold text-green">£${s.amount.toFixed(2)}</span>
                  </div>
              </div>
          `).join('')}
      </div>
    `;
}

/**
 * Displays the settlement modal
 */
export function showSettlementModal({ settlements, currentUser = null, title = "Settlement Guide" }) {
    if (document.getElementById('settlement-modal-root')) return;
    
    const modal = document.createElement('div');
    modal.id = 'settlement-modal-root';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); z-index:9999; display:flex; align-items:center; justify-content:center; padding: 20px;';
    
    modal.innerHTML = `
      <div class="ios-card w-full fade-in safe-area-bottom" style="width: 100%; max-width: 420px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); padding: 0; background: var(--ios-card-bg); position: relative;">
         
         <button id="close-settlement-btn" style="position: absolute; top: 16px; right: 16px; width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.1); border: none; color: white; display: flex; align-items: center; justify-content: center; z-index: 100; cursor: pointer;">
            <i class="fa-solid fa-xmark" style="font-size: 14px;"></i>
         </button>

         <div style="padding: 24px 24px 12px; flex-shrink: 0; text-align: center;">
            <h2 class="text-xl font-bold">${title}</h2>
         </div>
         
         <div style="flex: 1; overflow-y: auto; padding: 0 20px;">
            <div class="flex flex-col gap-md" style="padding-bottom: 24px;">
               
               ${currentUser ? `
               <h4 class="text-[10px] text-secondary uppercase tracking-widest font-bold mb-1 opacity-50 px-1">Your Personal Stake</h4>
               <div style="margin-bottom: 8px;">
                  ${renderPersonalSummaryCard(currentUser, settlements, true)}
               </div>
               ` : ''}

               <h4 class="text-[10px] text-secondary uppercase tracking-widest font-bold mb-1 opacity-50 px-1">Group Transactions</h4>
               
                ${settlements.length === 0 ? `
                      <div class="text-center py-8 opacity-40">
                         <i class="fa-solid fa-check-circle text-4xl mb-2"></i>
                         <p>Everyone is settled up!</p>
                      </div>
                   ` : settlements.map(s => `
                      <div class="ios-card flex items-center gap-md p-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 16px; justify-content: space-between; margin-bottom: 0;">
                         <div class="flex flex-col items-center gap-xs" style="width: 70px;">
                            ${renderAvatar({ name: s.from.name, avatar: s.from.avatar, id: s.from.user_id }, 42)}
                            <span class="text-[11px] font-bold text-center leading-tight mt-1 text-white">${s.from.name.split(' ')[0]}</span>
                         </div>
                         
                         <div class="flex-1 flex flex-col items-center justify-center">
                            <span class="text-[10px] text-secondary uppercase tracking-wider font-bold mb-1">Pays▹</span>
                            <span class="text-sm font-bold mt-1 text-blue">£${s.amount.toFixed(2)}</span>
                         </div>
                         
                         <div class="flex flex-col items-center gap-xs" style="width: 70px;">
                            ${renderAvatar({ name: s.to.name, avatar: s.to.avatar, id: s.to.user_id }, 42)}
                            <span class="text-[11px] font-bold text-center leading-tight mt-1 text-white">${s.to.name.split(' ')[0]}</span>
                         </div>
                      </div>
                   `).join('')}
            </div>
         </div>
         
         <div style="height: 20px; flex-shrink: 0;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    
    const closeModal = () => {
        modal.remove();
        document.body.classList.remove('modal-open');
    };

    modal.querySelector('#close-settlement-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
       if (e.target === modal) closeModal();
    });
}

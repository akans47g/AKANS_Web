// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Page specific JS
// admin-shared.js ke baad load karo
// ══════════════════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 8 — admin-referrals.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────
let allReferrals   = [];
let allWithdrawals = [];
let refTab         = 'referrals'; // 'referrals' | 'withdrawals'
let unsubRef       = null;
let unsubWith      = null;

// ── INIT ──────────────────────────────────────────────────────────
async function initReferrals() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('referrals');
  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';
  startReferralsListener();
  startWithdrawalsListener();
}

// ── REAL-TIME LISTENERS ────────────────────────────────────────────
function startReferralsListener() {
  if (unsubRef) unsubRef();
  unsubRef = db.collection('referrals')
    .orderBy('createdAt','desc')
    .onSnapshot(snap => {
      allReferrals = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      updateRefStats();
      if (refTab === 'referrals') renderReferralsTab();
    }, err => console.error('[Referrals]', err));
}

function startWithdrawalsListener() {
  if (unsubWith) unsubWith();
  unsubWith = db.collection('withdrawals')
    .orderBy('createdAt','desc')
    .onSnapshot(snap => {
      allWithdrawals = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      updateRefStats();
      if (refTab === 'withdrawals') renderWithdrawalsTab();
    }, err => console.error('[Withdrawals]', err));
}

// ── STATS ──────────────────────────────────────────────────────────
function updateRefStats() {
  const totalCodes    = allReferrals.length;
  const totalEarned   = allReferrals.reduce((s,r) => s + (r.totalEarned||0), 0);
  const pendingWith   = allWithdrawals.filter(w => w.status === 'pending').length;
  const totalPaidOut  = allWithdrawals
    .filter(w => w.status === 'approved')
    .reduce((s,w) => s + (w.amount||0), 0);

  setElR('ref-stat-codes',    totalCodes);
  setElR('ref-stat-earned',   '₹' + totalEarned.toLocaleString('en-IN'));
  setElR('ref-stat-pending',  pendingWith);
  setElR('ref-stat-paidout',  '₹' + totalPaidOut.toLocaleString('en-IN'));
  setBadge('badge-referrals', pendingWith);

  // Tab counts
  setElR('ref-count-ref',  totalCodes);
  setElR('ref-count-with', allWithdrawals.filter(w=>w.status==='pending').length);
}

function setElR(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── TAB SWITCH ─────────────────────────────────────────────────────
function switchRefTab(tab) {
  refTab = tab;
  document.querySelectorAll('.ref-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  const refGrid  = document.getElementById('referralsContent');
  const withGrid = document.getElementById('withdrawalsContent');
  if (refGrid)  refGrid.style.display  = tab === 'referrals'   ? 'block' : 'none';
  if (withGrid) withGrid.style.display = tab === 'withdrawals'  ? 'block' : 'none';
  if (tab === 'referrals')   renderReferralsTab();
  if (tab === 'withdrawals') renderWithdrawalsTab();
}

// ── RENDER REFERRALS TAB ───────────────────────────────────────────
function renderReferralsTab() {
  const grid = document.getElementById('referralsGrid');
  if (!grid) return;

  if (allReferrals.length === 0) {
    grid.innerHTML = `<div class="ref-empty">
      <div class="ref-empty-icon">🎁</div>
      <div class="ref-empty-title">Koi referral code nahi hai</div>
      <div class="ref-empty-sub">Users ke refer.html se code generate hone ke baad yahan dikhega</div>
    </div>`;
    return;
  }

  grid.innerHTML = allReferrals.map(r => buildReferralCard(r)).join('');
}

function buildReferralCard(r) {
  const date = r.createdAt?.toDate?.()
    ? r.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})
    : '—';
  const usePct = r.totalReferred > 0
    ? Math.round((r.totalSuccessful||0) / r.totalReferred * 100) : 0;

  return `<div class="ref-card">
    <div class="ref-card-top">
      <div>
        <div class="ref-code">${r.code || '—'}</div>
        <div class="ref-email">${r.email || '—'}</div>
      </div>
      <div class="ref-date">${date}</div>
    </div>

    <div class="ref-stats-row">
      <div class="ref-stat-box">
        <span class="rsb-num">${r.totalReferred||0}</span>
        <span class="rsb-lbl">Referred</span>
      </div>
      <div class="ref-stat-box">
        <span class="rsb-num" style="color:#16a34a;">${r.totalSuccessful||0}</span>
        <span class="rsb-lbl">Successful</span>
      </div>
      <div class="ref-stat-box">
        <span class="rsb-num" style="color:#7c3aed;">₹${(r.totalEarned||0).toLocaleString('en-IN')}</span>
        <span class="rsb-lbl">Earned</span>
      </div>
      <div class="ref-stat-box">
        <span class="rsb-num" style="color:#f59e0b;">₹${(r.totalPending||0).toLocaleString('en-IN')}</span>
        <span class="rsb-lbl">Pending</span>
      </div>
    </div>

    ${r.totalReferred > 0 ? `
    <div style="margin-bottom:0.8rem;">
      <div style="font-size:0.7rem;color:#94a3b8;margin-bottom:0.3rem;">${usePct}% conversion rate</div>
      <div class="ref-prog-bar"><div class="ref-prog-fill" style="width:${usePct}%"></div></div>
    </div>` : ''}

    <div class="ref-card-actions">
      <button class="ref-btn ref-btn-adjust"  onclick="openEarnAdjust('${r._id}','${r.code}',${r.totalEarned||0})">💰 Adjust Earning</button>
      <button class="ref-btn ref-btn-reset"   onclick="resetRefStats('${r._id}','${r.code}')">🔄 Reset</button>
      <button class="ref-btn ref-btn-delete"  onclick="deleteReferral('${r._id}','${r.code}')">🗑️</button>
    </div>
  </div>`;
}

// ── RENDER WITHDRAWALS TAB ─────────────────────────────────────────
function renderWithdrawalsTab() {
  const grid = document.getElementById('withdrawalsGrid');
  if (!grid) return;

  const pending   = allWithdrawals.filter(w => w.status==='pending');
  const processed = allWithdrawals.filter(w => w.status!=='pending');

  if (allWithdrawals.length === 0) {
    grid.innerHTML = `<div class="ref-empty">
      <div class="ref-empty-icon">💸</div>
      <div class="ref-empty-title">Koi withdrawal request nahi hai</div>
      <div class="ref-empty-sub">Users ke refer page se request aane ke baad yahan dikhegi</div>
    </div>`;
    return;
  }

  let html = '';
  if (pending.length > 0) {
    html += `<div class="with-section-title">⏳ Pending Requests (${pending.length})</div>`;
    html += pending.map(w => buildWithdrawalCard(w)).join('');
  }
  if (processed.length > 0) {
    html += `<div class="with-section-title" style="margin-top:1.2rem;">✅ Processed (${processed.length})</div>`;
    html += processed.map(w => buildWithdrawalCard(w)).join('');
  }
  grid.innerHTML = html;
}

function buildWithdrawalCard(w) {
  const isPending  = w.status === 'pending';
  const isApproved = w.status === 'approved';
  const date = w.createdAt?.toDate?.()
    ? w.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})
    : '—';
  const statusCfg = {
    pending:  { label:'⏳ Pending',  cls:'with-pending'  },
    approved: { label:'✅ Approved', cls:'with-approved' },
    rejected: { label:'❌ Rejected', cls:'with-rejected' },
  };
  const s = statusCfg[w.status] || statusCfg.pending;

  return `<div class="with-card ${!isPending ? 'with-processed' : ''}">
    <div class="with-top">
      <div>
        <div class="with-name">${w.userName || w.email?.split('@')[0] || 'User'}</div>
        <div class="with-email">${w.email || '—'}</div>
      </div>
      <div class="with-right">
        <div class="with-amount">₹${(w.amount||0).toLocaleString('en-IN')}</div>
        <span class="${s.cls}">${s.label}</span>
      </div>
    </div>

    <div class="with-upi-row">
      <span class="with-upi-label">UPI ID</span>
      <span class="with-upi-val">${w.upiId || '—'}</span>
      <button class="with-copy-btn" onclick="navigator.clipboard.writeText('${w.upiId||''}').then(()=>showAdminToast('📋 UPI Copied!','success'))">📋</button>
    </div>

    <div class="with-date">Requested: ${date}${w.processedAt ? ' · Processed: '+w.processedAt.toDate?.()?.toLocaleDateString('en-IN') : ''}</div>

    ${isPending ? `
    <div class="with-actions">
      <button class="with-btn with-btn-approve" onclick="approveWithdrawal('${w._id}','${w.upiId}',${w.amount||0},'${w.userId||''}')">
        ✅ Mark as Paid
      </button>
      <button class="with-btn with-btn-reject"  onclick="rejectWithdrawal('${w._id}','${w.userId||''}')">
        ❌ Reject
      </button>
      <a class="with-btn with-btn-wa"
         href="https://wa.me/91${w.whatsapp||''}"
         target="_blank" rel="noopener"
         style="${!w.whatsapp?'opacity:0.4;pointer-events:none;':''}"
         title="${w.whatsapp||'No WhatsApp'}">
        💬 WhatsApp
      </a>
    </div>` : ''}
    ${w.adminNote ? `<div class="with-note">📝 ${w.adminNote}</div>` : ''}
  </div>`;
}

// ── APPROVE WITHDRAWAL ─────────────────────────────────────────────
async function approveWithdrawal(id, upiId, amount, userId) {
  const note = prompt(`✅ Payment confirm:\nUPI: ${upiId}\nAmount: ₹${amount}\n\nTransaction ID ya note daalo (optional):`);
  if (note === null) return; // cancelled

  try {
    const batch = db.batch();
    batch.update(db.collection('withdrawals').doc(id), {
      status:      'approved',
      adminNote:   note || '',
      processedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (userId) {
      // Reset user's earned balance
      batch.update(db.collection('referrals').doc(userId), {
        totalEarned:  0,
        totalPending: 0,
        lastWithdrawAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
    showAdminToast(`✅ ₹${amount} paid to ${upiId}!`, 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── REJECT WITHDRAWAL ──────────────────────────────────────────────
async function rejectWithdrawal(id, userId) {
  const reason = prompt('❌ Rejection reason daalo:');
  if (reason === null) return;
  try {
    await db.collection('withdrawals').doc(id).update({
      status:      'rejected',
      adminNote:   reason || 'Rejected by admin',
      processedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showAdminToast('❌ Withdrawal rejected', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── EARN ADJUSTMENT MODAL ──────────────────────────────────────────
function openEarnAdjust(id, code, currentEarned) {
  const modal = document.getElementById('earnAdjustModal');
  if (!modal) return;
  document.getElementById('adj-ref-id').value      = id;
  document.getElementById('adj-code-display').textContent = code;
  document.getElementById('adj-current').textContent      = '₹' + currentEarned;
  document.getElementById('adj-amount').value      = '';
  document.getElementById('adj-type').value        = 'add';
  document.getElementById('adj-reason').value      = '';
  modal.classList.add('open');
}

function closeEarnModal() {
  document.getElementById('earnAdjustModal')?.classList.remove('open');
}

async function saveEarnAdjust() {
  const id     = document.getElementById('adj-ref-id').value;
  const type   = document.getElementById('adj-type').value;
  const amount = parseFloat(document.getElementById('adj-amount').value);
  const reason = document.getElementById('adj-reason').value.trim();

  if (!amount || amount <= 0) { showAdminToast('⚠️ Amount daalo', 'warning'); return; }

  const ref   = allReferrals.find(r => r._id === id);
  const curr  = ref?.totalEarned || 0;
  const newVal = type === 'add' ? curr + amount : Math.max(0, curr - amount);

  const btn = document.getElementById('adjSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

  try {
    await db.collection('referrals').doc(id).update({
      totalEarned: newVal,
      lastAdjustedAt: firebase.firestore.FieldValue.serverTimestamp(),
      adjustNote: reason || `Admin ${type}ed ₹${amount}`
    });
    showAdminToast(`✅ Earning ${type === 'add' ? 'added' : 'deducted'}: ₹${amount}`, 'success');
    closeEarnModal();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save'; }
  }
}

// ── RESET REFERRAL STATS ───────────────────────────────────────────
async function resetRefStats(id, code) {
  if (!confirm(`⚠️ "${code}" ka poora referral data reset karna chahte ho?`)) return;
  try {
    await db.collection('referrals').doc(id).update({
      totalReferred: 0, totalSuccessful: 0,
      totalEarned: 0,   totalPending: 0
    });
    showAdminToast('🔄 Stats reset!', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── DELETE REFERRAL ────────────────────────────────────────────────
async function deleteReferral(id, code) {
  if (!confirm(`⚠️ "${code}" referral record delete karna chahte ho?`)) return;
  try {
    await db.collection('referrals').doc(id).delete();
    showAdminToast('🗑️ Deleted', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── EXPORT CSV ─────────────────────────────────────────────────────
function exportReferralsCSV() {
  const data = refTab === 'referrals' ? allReferrals : allWithdrawals;
  if (data.length === 0) { showAdminToast('⚠️ Koi data nahi hai', 'warning'); return; }

  let headers, rows;
  if (refTab === 'referrals') {
    headers = ['Code','Email','Total Referred','Successful','Earned (₹)','Pending (₹)'];
    rows = allReferrals.map(r => [r.code||'',r.email||'',r.totalReferred||0,r.totalSuccessful||0,r.totalEarned||0,r.totalPending||0]);
  } else {
    headers = ['User','Email','UPI ID','Amount (₹)','Status','Date'];
    rows = allWithdrawals.map(w => [
      w.userName||'', w.email||'', w.upiId||'',
      w.amount||0, w.status||'pending',
      w.createdAt?.toDate?.()?.toLocaleDateString('en-IN')||''
    ]);
  }

  const csv  = [headers.join(','), ...rows.map(r=>r.map(v=>`"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`akans-${refTab}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showAdminToast('✅ CSV downloaded!', 'success');
}

// ── CLEANUP ────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (unsubRef)  unsubRef();
  if (unsubWith) unsubWith();
});

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('referralsPage')) initReferrals();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║   admin-all2.js COMPLETE — Section 9+ → admin-all3.js       ║
// ╚══════════════════════════════════════════════════════════════╝
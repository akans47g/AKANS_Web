// ══════════════════════════════════════════════════════════════════
// admin-all.js — AKANS Admin Panel
// Sab admin pages ka JS code ek file mein
// Firebase firebase-config.js se load hota hai (already initialized)
// ══════════════════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 1 — admin-login.html                        ║
// ╚══════════════════════════════════════════════════════════════╝

// ── CONSTANTS ─────────────────────────────────────────────────────
const ADMIN_EMAIL      = 'akans47g@gmail.com';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 ghante milliseconds mein
const MAX_ATTEMPTS     = 5;                    // 5 galat try ke baad lock
const LOCKOUT_MINUTES  = 30;                   // 30 minute lock


// ── GOOGLE PROVIDER ───────────────────────────────────────────────
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ── ADMIN GOOGLE LOGIN (Redirect — mobile compatible) ─────────────
async function adminGoogleLogin() {
  const btn = document.getElementById('googleAdminBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="animation:spinAnim 1s linear infinite;display:inline-block">⟳</span> Redirecting...'; }
  try {
    await auth.signInWithRedirect(googleProvider);
  } catch(e) {
    showAdminToast('❌ Google login failed: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
  }
}

// ── HANDLE GOOGLE REDIRECT RESULT (page load pe) ──────────────────
auth.getRedirectResult().then(async result => {
  if (!result || !result.user) return;
  const user = result.user;

  // Admin role check karo
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === 'admin';

    if (!isAdmin) {
      await auth.signOut();
      showAdminToast('❌ Access denied — Admin permission nahi hai', 'error');
      return;
    }

    // ✅ Admin confirmed
    localStorage.setItem('adminSession', JSON.stringify({
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL:    user.photoURL || '',
      isAdmin:     true,
      timestamp:   Date.now()
    }));

    // Log
    db.collection('adminLogs').add({
      action:     'google_login',
      adminEmail:  user.email,
      timestamp:   firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    showAdminToast('✅ Google login successful!', 'success');
    setTimeout(() => window.location.replace('admin-dashboard.html'), 800);

  } catch(e) {
    await auth.signOut();
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}).catch(e => {
  if (e.code && e.code !== 'auth/no-current-user') {
    console.error('[Admin Google]', e.code, e.message);
  }
});

// ── SESSION CHECK (page load pe) ──────────────────────────────────
function checkAdminSession() {
  try {
    const session = JSON.parse(localStorage.getItem('adminSession') || 'null');
    if (session) {
      const elapsed = Date.now() - session.timestamp;
      if (elapsed < SESSION_DURATION && session.isAdmin) {
        // Session valid hai → dashboard pe bhejo
        if (!window.location.href.includes('admin-dashboard')) {
          window.location.replace('admin-dashboard.html');
        }
        return true;
      } else {
        // Session expire → saaf karo
        localStorage.removeItem('adminSession');
        auth.signOut().catch(() => {});
      }
    }
  } catch (e) {
    localStorage.removeItem('adminSession');
  }
  return false;
}

// ── ADMIN LOGIN ────────────────────────────────────────────────────
async function adminLogin() {
  // Pehle lockout check
  const lockoutEnd = parseInt(localStorage.getItem('adminLockoutEnd') || '0');
  if (Date.now() < lockoutEnd) {
    const remaining = Math.ceil((lockoutEnd - Date.now()) / 60000);
    showAdminToast(`🔒 ${remaining} minute baad try karein`, 'error');
    return;
  }

  const email = document.getElementById('adminEmail').value.trim();
  const pass  = document.getElementById('adminPass').value;

  // Basic validation
  if (!email) { highlightField('adminEmail', '⚠️ Email daalo'); return; }
  if (!pass)  { highlightField('adminPass', '⚠️ Password daalo'); return; }

  // Only admin email allowed
  if (email !== ADMIN_EMAIL) {
    recordFailedAttempt();
    showAdminToast('❌ Yeh email admin nahi hai', 'error');
    return;
  }

  const btn = document.getElementById('loginBtn');
  setLoginLoading(true);

  try {
    // Firebase sign in
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    const user  = cred.user;

    // Firestore mein admin role verify karo
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === 'admin';

    if (!isAdmin) {
      // Role admin nahi → logout karo, block karo
      await auth.signOut();
      recordFailedAttempt();
      showAdminToast('❌ Access denied — Admin permission nahi hai', 'error');
      setLoginLoading(false);
      return;
    }

    // ✅ Admin confirmed — session save karo
    localStorage.setItem('adminSession', JSON.stringify({
      uid:       user.uid,
      email:     user.email,
      displayName: user.displayName || 'Admin',
      isAdmin:   true,
      timestamp: Date.now()
    }));

    // Failed attempts clear karo
    localStorage.removeItem('adminLoginAttempts');
    localStorage.removeItem('adminLockoutEnd');

    // Log login activity
    db.collection('adminLogs').add({
      action:    'login',
      adminEmail: user.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    }).catch(() => {});

    showAdminToast('✅ Welcome Admin! Redirecting...', 'success');
    setTimeout(() => window.location.replace('admin-dashboard.html'), 900);

  } catch (e) {
    let msg = '❌ Login failed';
    if (e.code === 'auth/wrong-password')    msg = '❌ Galat password';
    if (e.code === 'auth/user-not-found')    msg = '❌ Email registered nahi hai';
    if (e.code === 'auth/too-many-requests') msg = '❌ Bahut zyada attempts — thodi der baad try karein';
    if (e.code === 'auth/network-request-failed') msg = '❌ Internet connection check karein';

    recordFailedAttempt();
    showAdminToast(msg, 'error');
    setLoginLoading(false);
  }
}


// ── GOOGLE ADMIN LOGIN (Redirect — mobile compatible) ─────────────
async function adminGoogleLogin() {
  const btn = document.getElementById('googleAdminBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="animation:spinAnim 1s linear infinite;display:inline-block">⟳</span> Redirecting...'; }
  try {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ login_hint: ADMIN_EMAIL });
    await auth.signInWithRedirect(googleProvider);
  } catch(e) {
    showAdminToast('❌ Google login failed: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<div class="google-logo"></div> Continue with Google'; }
  }
}

// ── HANDLE GOOGLE REDIRECT RESULT ─────────────────────────────────
auth.getRedirectResult().then(async result => {
  if (!result || !result.user) return;
  const user = result.user;

  // Check admin email
  if (user.email !== ADMIN_EMAIL) {
    await auth.signOut();
    showAdminToast('❌ Ye Gmail admin nahi hai!', 'error');
    return;
  }

  // Check Firestore role
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().role === 'admin';

    if (!isAdmin) {
      await auth.signOut();
      showAdminToast('❌ Access denied — role:admin set nahi hai', 'error');
      return;
    }

    // ✅ Google Admin Login successful
    localStorage.setItem('adminSession', JSON.stringify({
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || 'Admin',
      photoURL:    user.photoURL || '',
      isAdmin:     true,
      timestamp:   Date.now()
    }));

    // Log
    db.collection('adminLogs').add({
      action:     'google_login',
      adminEmail: user.email,
      timestamp:  firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    showAdminToast('✅ Google login successful!', 'success');
    setTimeout(() => window.location.replace('admin-dashboard.html'), 800);

  } catch(e) {
    await auth.signOut();
    showAdminToast('❌ Firestore error: ' + e.message, 'error');
  }
}).catch(e => {
  if (e.code && e.code !== 'auth/no-current-user') {
    console.error('[Google Admin Redirect]', e.message);
    showAdminToast('❌ ' + e.message, 'error');
  }
});

// ── FAILED ATTEMPT TRACKER ─────────────────────────────────────────
function recordFailedAttempt() {
  const attempts = parseInt(localStorage.getItem('adminLoginAttempts') || '0') + 1;
  localStorage.setItem('adminLoginAttempts', attempts);

  const remaining = MAX_ATTEMPTS - attempts;

  if (attempts >= MAX_ATTEMPTS) {
    // Lock karo
    const lockEnd = Date.now() + (LOCKOUT_MINUTES * 60 * 1000);
    localStorage.setItem('adminLockoutEnd', lockEnd);
    localStorage.removeItem('adminLoginAttempts');
    showLockOverlay(LOCKOUT_MINUTES * 60);
    showAdminToast(`🔒 ${MAX_ATTEMPTS} galat tries — ${LOCKOUT_MINUTES} min ke liye lock`, 'error');
  } else if (remaining <= 2) {
    showAdminToast(`⚠️ Sirf ${remaining} aur moka bache hain!`, 'warning');
  }
}

// ── LOCK OVERLAY ───────────────────────────────────────────────────
function showLockOverlay(totalSeconds) {
  const overlay = document.getElementById('lockOverlay');
  const timerEl = document.getElementById('lockTimerDisplay');
  if (!overlay) return;

  overlay.classList.add('show');
  let secs = totalSeconds;
  timerEl.textContent = formatCountdown(secs);

  const interval = setInterval(() => {
    secs--;
    timerEl.textContent = formatCountdown(secs);
    if (secs <= 0) {
      clearInterval(interval);
      overlay.classList.remove('show');
      localStorage.removeItem('adminLockoutEnd');
      localStorage.removeItem('adminLoginAttempts');
    }
  }, 1000);
}

function formatCountdown(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

// ── UI HELPERS ─────────────────────────────────────────────────────
function setLoginLoading(loading) {
  const btn = document.getElementById('loginBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spin">⟳</span> Verifying...'
    : '🔐 Admin Login';
}

function highlightField(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('field-error');
  el.focus();
  showAdminToast(msg, 'warning');
  el.addEventListener('input', () => el.classList.remove('field-error'), { once: true });
}

function toggleAdminPass() {
  const inp = document.getElementById('adminPass');
  const btn = document.getElementById('togglePassBtn');
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; btn.textContent = '👁️'; }
}

// ── SHARED TOAST (sab admin pages pe kaam karega) ──────────────────
function showAdminToast(msg, type = 'info') {
  let t = document.getElementById('adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className   = `admin-toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── SESSION LOGOUT (sab admin pages pe use hoga) ───────────────────
async function adminLogout() {
  if (!confirm('Logout karna chahte hain?')) return;
  localStorage.removeItem('adminSession');
  await auth.signOut().catch(() => {});
  window.location.replace('admin-login.html');
}

// ── SESSION GUARD (dashboard + baaki pages pe use hoga) ────────────
function requireAdminSession() {
  const session = JSON.parse(localStorage.getItem('adminSession') || 'null');
  if (!session || !session.isAdmin) {
    window.location.replace('admin-login.html');
    return null;
  }
  const elapsed = Date.now() - session.timestamp;
  if (elapsed >= SESSION_DURATION) {
    localStorage.removeItem('adminSession');
    auth.signOut().catch(() => {});
    window.location.replace('admin-login.html');
    return null;
  }
  return session;
}

// ── ENTER KEY SUPPORT ──────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('adminEmail') && typeof adminLogin === 'function') {
      adminLogin();
    }
  }
});

// ── AUTO INIT on admin-login page ─────────────────────────────────
(function initLoginPage() {
  // Check if already logged in
  if (checkAdminSession()) return;

  // Check if currently locked
  const lockoutEnd = parseInt(localStorage.getItem('adminLockoutEnd') || '0');
  if (Date.now() < lockoutEnd) {
    const remaining = Math.ceil((lockoutEnd - Date.now()) / 1000);
    showLockOverlay(remaining);
  }
})();

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 2, 3, 4... aage ke pages ka JS yahan add hoga    ║
// ║   admin-dashboard.html, admin-bookings.html, etc.           ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── DASHBOARD INIT ────────────────────────────────────────────────
async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  // Admin name header mein dikhao
  const el = document.getElementById('adminNameDisplay');
  if (el) el.textContent = session.displayName || session.email?.split('@')[0] || 'Admin';

  showAdminToast('📊 Dashboard load ho raha hai...', 'info');

  try {
    await Promise.all([
      loadDashboardStats(),
      loadRecentBookings(),
      loadRecentUsers(),
      loadRevenueChart()
    ]);
    showAdminToast('✅ Dashboard ready!', 'success');
  } catch (e) {
    console.error('Dashboard error:', e);
    showAdminToast('⚠️ Kuch data load nahi hua', 'warning');
  }
}

// ── LOAD ALL STATS ────────────────────────────────────────────────
async function loadDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // All bookings
    const bookSnap     = await db.collection('bookings').get();
    const allBookings  = bookSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pending      = allBookings.filter(b => b.status === 'pending');
    const completed    = allBookings.filter(b => b.status === 'completed');
    const totalRevenue = allBookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.amountPaid || 0), 0);

    // Today's bookings
    const todayBookings = allBookings.filter(b => {
      if (!b.createdAt) return false;
      const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return d >= today;
    });

    // Users
    const usersSnap  = await db.collection('users').get();
    const totalUsers = usersSnap.size;

    // Pending reviews
    const reviewSnap    = await db.collection('reviews')
      .where('approved', '==', false).get();
    const pendingReviews = reviewSnap.size;

    // Active orders
    const orderSnap    = await db.collection('orders')
      .where('status', '==', 'active').get();
    const activeOrders = orderSnap.size;

    // Pending withdrawals
    const withdrawSnap = await db.collection('referrals')
      .where('withdrawalPending', '==', true).get();
    const pendingWithdrawals = withdrawSnap.size;

    // Update UI
    setStatCard('statTotalBookings', allBookings.length,  '📦');
    setStatCard('statRevenue',   '₹' + totalRevenue.toLocaleString('en-IN'), '💰');
    setStatCard('statPending',   pending.length,           '⏳');
    setStatCard('statCompleted', completed.length,         '✅');
    setStatCard('statTodayBook', todayBookings.length,     '📅');
    setStatCard('statUsers',     totalUsers,               '👥');
    setStatCard('statReviews',   pendingReviews,           '⭐');
    setStatCard('statWithdraw',  pendingWithdrawals,       '💳');

    // Alert badges
    setBadge('badgePending',  pending.length);
    setBadge('badgeReviews',  pendingReviews);
    setBadge('badgeWithdraw', pendingWithdrawals);

    // Store for chart
    window._dashData = { allBookings, todayBookings, totalRevenue };

  } catch (e) {
    console.error('Stats error:', e);
  }
}

// ── RECENT BOOKINGS TABLE ─────────────────────────────────────────
async function loadRecentBookings() {
  const tbody = document.getElementById('recentBookingsBody');
  if (!tbody) return;

  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt', 'desc')
      .limit(6)
      .get();

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#8890b5;">Abhi koi booking nahi hai</td></tr>`;
      return;
    }

    tbody.innerHTML = snap.docs.map(doc => {
      const b  = doc.data();
      const dt = b.createdAt?.toDate ? b.createdAt.toDate().toLocaleDateString('en-IN') : '—';
      const statusClass = { pending:'badge-pending', completed:'badge-done', cancelled:'badge-cancel', in_progress:'badge-progress' }[b.status] || 'badge-pending';
      const statusLabel = { pending:'Pending', completed:'Done', cancelled:'Cancelled', in_progress:'In Progress' }[b.status] || b.status;
      return `
        <tr onclick="window.location='admin-bookings.html?id=${doc.id}'" style="cursor:pointer;">
          <td><span class="tbl-id">#${doc.id.slice(-5).toUpperCase()}</span></td>
          <td><strong>${b.groomName || '—'} & ${b.brideName || '—'}</strong></td>
          <td>${b.template || '—'}</td>
          <td>₹${(b.amountPaid || 0).toLocaleString('en-IN')}</td>
          <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
          <td>${dt}</td>
        </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ef4444;">⚠️ Load nahi hua</td></tr>`;
  }
}

// ── RECENT USERS ──────────────────────────────────────────────────
async function loadRecentUsers() {
  const list = document.getElementById('recentUsersList');
  if (!list) return;

  try {
    const snap = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (snap.empty) {
      list.innerHTML = `<div style="text-align:center;padding:1.5rem;color:#8890b5;font-size:0.85rem;">Koi user nahi hai abhi</div>`;
      return;
    }

    list.innerHTML = snap.docs.map(doc => {
      const u  = doc.data();
      const dt = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('en-IN') : 'Recently';
      const initials = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
      return `
        <div class="user-row">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${u.displayName || u.email?.split('@')[0] || 'User'}</div>
            <div class="user-email">${u.email || '—'}</div>
          </div>
          <div class="user-date">${dt}</div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div style="color:#ef4444;text-align:center;padding:1rem;font-size:0.82rem;">⚠️ Load failed</div>`;
  }
}

// ── REVENUE CHART (last 7 days) ───────────────────────────────────
async function loadRevenueChart() {
  const ctx = document.getElementById('revenueChart');
  if (!ctx || typeof Chart === 'undefined') return;

  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    // Last 7 days ka data prepare karo
    const days   = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toDateString());
      labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    }

    const revenueByDay = {};
    const bookingsByDay = {};
    days.forEach(d => { revenueByDay[d] = 0; bookingsByDay[d] = 0; });

    snap.docs.forEach(doc => {
      const b = doc.data();
      if (!b.createdAt) return;
      const d   = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      const key = d.toDateString();
      if (revenueByDay[key] !== undefined) {
        revenueByDay[key]  += (b.amountPaid || 0);
        bookingsByDay[key] += 1;
      }
    });

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue (₹)',
            data: days.map(d => revenueByDay[d]),
            backgroundColor: 'rgba(37,99,235,0.7)',
            borderColor: '#2563eb',
            borderWidth: 1.5,
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            label: 'Bookings',
            data: days.map(d => bookingsByDay[d]),
            type: 'line',
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124,58,237,0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#7c3aed',
            pointRadius: 4,
            fill: true,
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 12 }, color: '#4b5280' } },
          tooltip: {
            backgroundColor: '#1a1f3c',
            titleFont: { family: 'DM Sans', weight: '700' },
            bodyFont:  { family: 'DM Sans' },
            callbacks: {
              label: ctx => ctx.datasetIndex === 0
                ? ' ₹' + ctx.parsed.y.toLocaleString('en-IN')
                : ' ' + ctx.parsed.y + ' bookings'
            }
          }
        },
        scales: {
          x:  { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#8890b5', font: { family: 'DM Sans', size: 11 } } },
          y:  { position: 'left',  grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#2563eb',   font: { family: 'DM Sans', size: 11 }, callback: v => '₹' + v } },
          y1: { position: 'right', grid: { display: false },            ticks: { color: '#7c3aed',   font: { family: 'DM Sans', size: 11 } } }
        }
      }
    });
  } catch (e) {
    console.warn('Chart error:', e);
  }
}

// ── HELPERS ───────────────────────────────────────────────────────
function setStatCard(id, value, icon) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.classList.add('loaded');
}

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? 'inline-flex' : 'none';
}

// ── SIDEBAR TOGGLE (mobile) ───────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 3, 4, 5... aage ke pages ka JS yahan add hoga    ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 3, 4... aage ke pages yahan add honge             ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 3 — admin-bookings.html                     ║
// ╚══════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────
let allBookings      = [];
let filteredBookings = [];
let currentFilter    = 'all';
let currentSearch    = '';
let currentDateRange = 'all';
let currentPage      = 1;
const PAGE_SIZE      = 15;
let selectedBookingId = null;
let lastDoc          = null;

const STATUS_MAP = {
  pending:    { label:'Pending',     color:'#f59e0b', bg:'#fffbeb', border:'#fde68a' },
  inprogress: { label:'In Progress', color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe' },
  completed:  { label:'Completed',   color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
  cancelled:  { label:'Cancelled',   color:'#ef4444', bg:'#fef2f2', border:'#fecaca' },
};

// ── INIT BOOKINGS PAGE ────────────────────────────────────────────
function initBookings() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('bookings');

  const adminEl = document.getElementById('adminHeaderName');
  if (adminEl) adminEl.textContent = session.displayName || session.email?.split('@')[0] || 'Admin';

  // URL params check (from dashboard quick actions)
  const params = new URLSearchParams(window.location.search);
  if (params.get('filter')) {
    currentFilter = params.get('filter');
    document.querySelectorAll('.filter-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === currentFilter);
    });
  }
  if (params.get('id')) {
    // Direct open a booking
    loadBookings().then(() => openBookingDetail(params.get('id')));
    return;
  }

  loadBookings();
}

// ── LOAD ALL BOOKINGS FROM FIRESTORE ─────────────────────────────
async function loadBookings() {
  showTableLoading(true);
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt', 'desc')
      .get();

    allBookings = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));

    // Update filter tab counts
    updateFilterCounts();
    applyFilters();

  } catch (e) {
    console.error('[Bookings] Load error:', e);
    showAdminToast('❌ Bookings load nahi hue: ' + e.message, 'error');
    showTableLoading(false);
  }
}

// ── FILTER COUNTS ─────────────────────────────────────────────────
function updateFilterCounts() {
  const counts = {
    all:        allBookings.length,
    pending:    allBookings.filter(b => b.status === 'pending').length,
    inprogress: allBookings.filter(b => b.status === 'inprogress').length,
    completed:  allBookings.filter(b => b.status === 'completed').length,
    cancelled:  allBookings.filter(b => b.status === 'cancelled').length,
  };
  Object.entries(counts).forEach(([key, val]) => {
    const el = document.getElementById('count-' + key);
    if (el) el.textContent = val;
  });
}

// ── APPLY FILTERS + SEARCH + DATE ─────────────────────────────────
function applyFilters() {
  let data = [...allBookings];

  // Status filter
  if (currentFilter !== 'all') {
    data = data.filter(b => b.status === currentFilter);
  }

  // Date range filter
  const now = new Date();
  if (currentDateRange === 'today') {
    const today = new Date(); today.setHours(0,0,0,0);
    data = data.filter(b => b.createdAt?.toDate?.() >= today);
  } else if (currentDateRange === 'week') {
    const week = new Date(now - 7*24*60*60*1000);
    data = data.filter(b => b.createdAt?.toDate?.() >= week);
  } else if (currentDateRange === 'month') {
    const month = new Date(now - 30*24*60*60*1000);
    data = data.filter(b => b.createdAt?.toDate?.() >= month);
  }

  // Search
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    data = data.filter(b =>
      (b.groomName||'').toLowerCase().includes(q) ||
      (b.brideName||'').toLowerCase().includes(q) ||
      (b.whatsapp||'').includes(q) ||
      (b.transactionId||'').toLowerCase().includes(q) ||
      (b.template||'').toLowerCase().includes(q) ||
      (b._id||'').toLowerCase().includes(q)
    );
  }

  filteredBookings = data;
  currentPage = 1;
  renderBookingsTable();
  updateResultsInfo();
}

// ── RENDER TABLE ──────────────────────────────────────────────────
function renderBookingsTable() {
  const tbody = document.getElementById('bookingsTbody');
  if (!tbody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;
  const page  = filteredBookings.slice(start, end);

  showTableLoading(false);

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">
      <div style="padding:3rem;text-align:center;">
        <div style="font-size:2.5rem;margin-bottom:0.7rem;">📭</div>
        <div style="font-weight:700;color:#475569;margin-bottom:0.3rem;">Koi booking nahi mili</div>
        <div style="font-size:0.82rem;color:#94a3b8;">Filter ya search change karke dekhein</div>
      </div>
    </td></tr>`;
    renderPagination();
    return;
  }

  tbody.innerHTML = page.map((b, i) => {
    const s    = STATUS_MAP[b.status] || STATUS_MAP.pending;
    const date = b.createdAt?.toDate?.()
      ? b.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})
      : '—';
    const orderId = 'AK' + (b._id||'').slice(-6).toUpperCase();
    const verified = b.paymentVerified ? '✅' : '⏳';

    return `<tr class="booking-row ${b.paymentVerified ? 'verified-row' : ''}"
                onclick="openBookingDetail('${b._id}')"
                style="animation-delay:${i*0.04}s">
      <td><span class="order-id-pill">${orderId}</span></td>
      <td>
        <div class="couple-name">${b.groomName||'?'} &amp; ${b.brideName||'?'}</div>
        <div class="couple-sub">📱 ${b.whatsapp||'—'}</div>
      </td>
      <td><span class="template-pill">${b.template||'—'}</span></td>
      <td class="amount-cell">₹${(b.amountPaid||0).toLocaleString('en-IN')}</td>
      <td>${verified}</td>
      <td>
        <span class="status-pill-adm" style="color:${s.color};background:${s.bg};border-color:${s.border};">
          ${s.label}
        </span>
      </td>
      <td class="txn-cell">${b.transactionId||'—'}</td>
      <td>${date}</td>
      <td onclick="event.stopPropagation()">
        <div class="row-actions">
          <button class="ra-btn ra-wa" onclick="quickWhatsApp('${b.whatsapp||''}')" title="WhatsApp">💬</button>
          <button class="ra-btn ra-edit" onclick="openBookingDetail('${b._id}')" title="Details">👁️</button>
          <button class="ra-btn ra-del" onclick="confirmDeleteBooking('${b._id}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPagination();
}

// ── PAGINATION ────────────────────────────────────────────────────
function renderPagination() {
  const total    = filteredBookings.length;
  const pages    = Math.ceil(total / PAGE_SIZE);
  const paginEl  = document.getElementById('pagination');
  if (!paginEl) return;

  if (pages <= 1) { paginEl.innerHTML = ''; return; }

  let html = `<button class="pg-btn" onclick="changePage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹ Prev</button>`;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - currentPage) <= 1) {
      html += `<button class="pg-btn ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 2) {
      html += `<span class="pg-dots">…</span>`;
    }
  }
  html += `<button class="pg-btn" onclick="changePage(${currentPage+1})" ${currentPage===pages?'disabled':''}>Next ›</button>`;
  paginEl.innerHTML = html;
}

function changePage(page) {
  const pages = Math.ceil(filteredBookings.length / PAGE_SIZE);
  if (page < 1 || page > pages) return;
  currentPage = page;
  renderBookingsTable();
  document.getElementById('bookingsTable')?.scrollIntoView({behavior:'smooth'});
}

// ── RESULTS INFO ──────────────────────────────────────────────────
function updateResultsInfo() {
  const el = document.getElementById('resultsInfo');
  if (!el) return;
  const start = Math.min((currentPage-1)*PAGE_SIZE+1, filteredBookings.length);
  const end   = Math.min(currentPage*PAGE_SIZE, filteredBookings.length);
  el.textContent = filteredBookings.length === 0
    ? 'No results'
    : `Showing ${start}–${end} of ${filteredBookings.length} bookings`;
}

// ── LOADING STATE ─────────────────────────────────────────────────
function showTableLoading(show) {
  const tbody = document.getElementById('bookingsTbody');
  if (!tbody) return;
  if (show) {
    tbody.innerHTML = Array(5).fill(0).map(() => `
      <tr class="skeleton-row">
        ${Array(9).fill('<td><div class="skeleton-cell"></div></td>').join('')}
      </tr>`).join('');
  }
}

// ── BOOKING DETAIL MODAL ──────────────────────────────────────────
function openBookingDetail(id) {
  const b = allBookings.find(x => x._id === id);
  if (!b) { showAdminToast('❌ Booking nahi mili', 'error'); return; }

  selectedBookingId = id;
  const modal  = document.getElementById('bookingDetailModal');
  const s      = STATUS_MAP[b.status] || STATUS_MAP.pending;
  const orderId = 'AK' + id.slice(-6).toUpperCase();
  const date   = b.createdAt?.toDate?.()
    ? b.createdAt.toDate().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})
    : '—';

  // Pre-wedding events
  const preEvents = [
    b.mehendi?.active ? `🌿 Mehendi: ${b.mehendi.date} ${b.mehendi.time} — ${b.mehendi.location||'—'}` : null,
    b.haldi?.active   ? `💛 Haldi: ${b.haldi.date} ${b.haldi.time} — ${b.haldi.location||'—'}` : null,
    b.sangeet?.active ? `🎶 Sangeet: ${b.sangeet.date} ${b.sangeet.time} — ${b.sangeet.location||'—'}` : null,
  ].filter(Boolean).join('<br>') || '—';

  document.getElementById('modalContent').innerHTML = `
    <!-- HEADER -->
    <div class="md-header">
      <div>
        <div class="md-order-id">${orderId}</div>
        <div class="md-couple">${b.groomName||'?'} &amp; ${b.brideName||'?'}</div>
        <div class="md-date">📅 ${date}</div>
      </div>
      <span class="status-pill-adm lg" style="color:${s.color};background:${s.bg};border-color:${s.border};">${s.label}</span>
    </div>

    <!-- STATUS CHANGE -->
    <div class="md-section">
      <div class="md-sec-title">🔄 Status Update</div>
      <div class="status-btn-row">
        ${Object.entries(STATUS_MAP).map(([key, val]) => `
          <button class="status-change-btn ${b.status===key?'active':''}"
            style="${b.status===key?`background:${val.bg};color:${val.color};border-color:${val.border};`:''}"
            onclick="updateBookingStatus('${id}','${key}')">
            ${val.label}
          </button>`).join('')}
      </div>
    </div>

    <!-- COUPLE DETAILS -->
    <div class="md-section">
      <div class="md-sec-title">💑 Couple Details</div>
      <div class="md-grid">
        <div class="md-field"><span class="md-label">Dulhe Ka Naam</span><span class="md-val">${b.groomName||'—'}</span></div>
        <div class="md-field"><span class="md-label">Dulhe Ke Walid</span><span class="md-val">${b.groomFather||'—'}</span></div>
        <div class="md-field"><span class="md-label">Dulhan Ka Naam</span><span class="md-val">${b.brideName||'—'}</span></div>
        <div class="md-field"><span class="md-label">Dulhan Ke Walid</span><span class="md-val">${b.brideFather||'—'}</span></div>
        <div class="md-field"><span class="md-label">Mangni Ki Tarikh</span><span class="md-val">${b.engagementDate||'—'}</span></div>
        <div class="md-field"><span class="md-label">Template</span><span class="md-val">${b.template||'—'}</span></div>
      </div>
    </div>

    <!-- TIMELINE -->
    <div class="md-section">
      <div class="md-sec-title">⏰ Program Timeline</div>
      <div class="timeline-list">
        <div class="tl-item">👥 <strong>Guest Arrival:</strong> ${b.guestArrival?.date||'—'} ${b.guestArrival?.time||''}</div>
        <div class="tl-item">💍 <strong>Wedding Ceremony:</strong> ${b.weddingCeremony?.date||'—'} ${b.weddingCeremony?.time||''}</div>
        ${b.cocktailHour?.date ? `<div class="tl-item">🥂 <strong>Cocktail Hour:</strong> ${b.cocktailHour.date} ${b.cocktailHour.time||''}</div>` : ''}
        ${b.dinnerReception?.date ? `<div class="tl-item">🍽️ <strong>Dinner Reception:</strong> ${b.dinnerReception.date} ${b.dinnerReception.time||''}</div>` : ''}
      </div>
    </div>

    <!-- VENUE -->
    <div class="md-section">
      <div class="md-sec-title">📍 Venue</div>
      <div class="md-grid">
        <div class="md-field"><span class="md-label">Venue Naam</span><span class="md-val">${b.venueName||'—'}</span></div>
        <div class="md-field full"><span class="md-label">Address</span><span class="md-val">${b.venueAddress||'—'}</span></div>
        ${b.venueMap ? `<div class="md-field full"><span class="md-label">Maps Link</span><a href="${b.venueMap}" target="_blank" class="md-link">🗺️ Google Maps Dekho</a></div>` : ''}
      </div>
    </div>

    <!-- PRE-WEDDING -->
    <div class="md-section">
      <div class="md-sec-title">🌿 Pre-Wedding Events</div>
      <div class="md-text">${preEvents}</div>
    </div>

    <!-- PAYMENT -->
    <div class="md-section">
      <div class="md-sec-title">💰 Payment Details</div>
      <div class="md-grid">
        <div class="md-field"><span class="md-label">Amount Paid</span><span class="md-val green">₹${(b.amountPaid||0).toLocaleString('en-IN')}</span></div>
        <div class="md-field"><span class="md-label">Coupon Used</span><span class="md-val">${b.couponCode||'None'}</span></div>
        <div class="md-field"><span class="md-label">Discount</span><span class="md-val">${b.discount ? '₹'+b.discount : '—'}</span></div>
        <div class="md-field"><span class="md-label">Transaction ID</span><span class="md-val mono">${b.transactionId||'—'}</span></div>
        <div class="md-field"><span class="md-label">WhatsApp</span>
          <a class="md-link" href="https://wa.me/91${b.whatsapp}" target="_blank">📱 ${b.whatsapp||'—'}</a>
        </div>
        <div class="md-field"><span class="md-label">Payment Verified</span>
          <span class="md-val" id="verifyStatus">${b.paymentVerified ? '✅ Verified' : '⏳ Pending'}</span>
        </div>
      </div>
      <!-- Verify Button -->
      <button class="verify-btn ${b.paymentVerified ? 'verified' : ''}" id="verifyBtn"
        onclick="togglePaymentVerify('${id}')">
        ${b.paymentVerified ? '✅ Payment Verified — Unmark karein' : '🔍 Payment Verify Karein'}
      </button>
    </div>

    <!-- SCREENSHOT -->
    ${b.screenshotB64 ? `
    <div class="md-section">
      <div class="md-sec-title">📸 Payment Screenshot</div>
      <img src="${b.screenshotB64}" alt="Payment Screenshot" class="screenshot-img"
           onclick="this.classList.toggle('expanded')"/>
      <div class="md-hint">Click karo bada karne ke liye</div>
    </div>` : ''}

    <!-- SEND CARD LINK -->
    <div class="md-section">
      <div class="md-sec-title">🔗 Card Link Bhejo Customer Ko</div>
      <div class="send-link-row">
        <input type="url" id="cardLinkInput" class="md-input"
               placeholder="https://akans47g.github.io/AKANS_Web/card/..." value="${b.cardLink||''}"/>
        <button class="md-btn blue" onclick="saveCardLink('${id}')">💾 Save</button>
      </div>
      ${b.cardLink ? `<a href="https://wa.me/91${b.whatsapp}?text=${encodeURIComponent('🎉 Aapka Digital Wedding Card Ready Hai!%0A%0A💍 '+b.groomName+' & '+b.brideName+'%0A%0A🔗 Card Link: '+b.cardLink+'%0A%0AAKANS Web Development Services')}" target="_blank" class="wa-send-btn">💬 WhatsApp Pe Card Link Bhejo</a>` : ''}
    </div>

    <!-- ADMIN NOTE -->
    <div class="md-section">
      <div class="md-sec-title">📝 Admin Note</div>
      <textarea id="adminNoteInput" class="md-textarea" placeholder="Is booking ke baare mein note daalo...">${b.adminNote||''}</textarea>
      <button class="md-btn blue" style="margin-top:0.5rem;" onclick="saveAdminNote('${id}')">💾 Note Save Karein</button>
    </div>

    <!-- DANGER ZONE -->
    <div class="md-section danger-zone">
      <div class="md-sec-title">⚠️ Danger Zone</div>
      <button class="md-btn red" onclick="confirmDeleteBooking('${id}')">🗑️ Is Booking Ko Delete Karein</button>
    </div>
  `;

  modal.classList.add('open');
}

function closeBookingDetail() {
  document.getElementById('bookingDetailModal').classList.remove('open');
  selectedBookingId = null;
}

// ── UPDATE STATUS ─────────────────────────────────────────────────
async function updateBookingStatus(id, newStatus) {
  try {
    await db.collection('bookings').doc(id).update({ status: newStatus });
    // Update local data
    const b = allBookings.find(x => x._id === id);
    if (b) b.status = newStatus;
    applyFilters();
    updateFilterCounts();
    // Update modal UI
    document.querySelectorAll('.status-change-btn').forEach(btn => {
      const isActive = btn.textContent.trim() === STATUS_MAP[newStatus]?.label;
      btn.classList.toggle('active', isActive);
      const s = Object.entries(STATUS_MAP).find(([k]) => btn.textContent.includes(STATUS_MAP[k]?.label));
      if(s && isActive) { btn.style.background = s[1].bg; btn.style.color = s[1].color; btn.style.borderColor = s[1].border; }
      else { btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    });
    showAdminToast('✅ Status updated: ' + STATUS_MAP[newStatus]?.label, 'success');
  } catch(e) { showAdminToast('❌ Update failed: ' + e.message, 'error'); }
}

// ── VERIFY PAYMENT ─────────────────────────────────────────────────
async function togglePaymentVerify(id) {
  const b = allBookings.find(x => x._id === id);
  if (!b) return;
  const newVal = !b.paymentVerified;
  try {
    await db.collection('bookings').doc(id).update({ paymentVerified: newVal });
    b.paymentVerified = newVal;
    const btn = document.getElementById('verifyBtn');
    const st  = document.getElementById('verifyStatus');
    if (btn) { btn.textContent = newVal ? '✅ Payment Verified — Unmark karein' : '🔍 Payment Verify Karein'; btn.classList.toggle('verified', newVal); }
    if (st)  st.textContent = newVal ? '✅ Verified' : '⏳ Pending';
    renderBookingsTable();
    showAdminToast(newVal ? '✅ Payment verified!' : '⏳ Payment unverified', newVal ? 'success' : 'warning');
  } catch(e) { showAdminToast('❌ Error: ' + e.message, 'error'); }
}

// ── SAVE CARD LINK ─────────────────────────────────────────────────
async function saveCardLink(id) {
  const link = document.getElementById('cardLinkInput')?.value.trim();
  try {
    await db.collection('bookings').doc(id).update({ cardLink: link });
    const b = allBookings.find(x => x._id === id);
    if (b) b.cardLink = link;
    showAdminToast('✅ Card link save ho gaya!', 'success');
    // Refresh modal
    closeBookingDetail();
    openBookingDetail(id);
  } catch(e) { showAdminToast('❌ Error: ' + e.message, 'error'); }
}

// ── SAVE ADMIN NOTE ────────────────────────────────────────────────
async function saveAdminNote(id) {
  const note = document.getElementById('adminNoteInput')?.value.trim();
  try {
    await db.collection('bookings').doc(id).update({ adminNote: note });
    const b = allBookings.find(x => x._id === id);
    if (b) b.adminNote = note;
    showAdminToast('✅ Note save ho gaya!', 'success');
  } catch(e) { showAdminToast('❌ Error: ' + e.message, 'error'); }
}

// ── DELETE BOOKING ─────────────────────────────────────────────────
function confirmDeleteBooking(id) {
  const b = allBookings.find(x => x._id === id);
  const name = b ? `${b.groomName||'?'} & ${b.brideName||'?'}` : id;
  if (!confirm(`⚠️ Kya aap sach mein "${name}" ki booking delete karna chahte hain?\n\nYeh action undo nahi hogi!`)) return;
  deleteBooking(id);
}

async function deleteBooking(id) {
  try {
    await db.collection('bookings').doc(id).delete();
    allBookings = allBookings.filter(x => x._id !== id);
    closeBookingDetail();
    applyFilters();
    updateFilterCounts();
    showAdminToast('🗑️ Booking delete ho gayi', 'warning');
  } catch(e) { showAdminToast('❌ Delete failed: ' + e.message, 'error'); }
}

// ── QUICK WHATSAPP ─────────────────────────────────────────────────
function quickWhatsApp(number) {
  if (!number) { showAdminToast('⚠️ WhatsApp number nahi hai', 'warning'); return; }
  window.open('https://wa.me/91' + number, '_blank');
}

// ── EXPORT CSV ────────────────────────────────────────────────────
function exportBookingsCSV() {
  const headers = ['Order ID','Groom','Bride','Template','Amount','Status','Payment Verified','Transaction ID','WhatsApp','Wedding Date','Booking Date'];
  const rows = filteredBookings.map(b => [
    'AK'+b._id.slice(-6).toUpperCase(),
    b.groomName||'', b.brideName||'',
    b.template||'', b.amountPaid||0,
    b.status||'', b.paymentVerified?'Yes':'No',
    b.transactionId||'', b.whatsapp||'',
    b.weddingCeremony?.date||'',
    b.createdAt?.toDate?.()?.toLocaleDateString('en-IN')||''
  ]);

  const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `AKANS_Bookings_${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showAdminToast('📥 CSV download ho raha hai!', 'success');
}

// ── SEARCH DEBOUNCE ────────────────────────────────────────────────
let searchTimer;
function onSearchInput(val) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { currentSearch = val; applyFilters(); }, 300);
}

// ── FILTER TAB CLICK ───────────────────────────────────────────────
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
  applyFilters();
}

// ── DATE RANGE ────────────────────────────────────────────────────
function setDateRange(range) {
  currentDateRange = range;
  document.querySelectorAll('.date-btn').forEach(b => b.classList.toggle('active', b.dataset.range === range));
  applyFilters();
}

// ── MANUAL BOOKING MODAL ───────────────────────────────────────────
function openManualBooking() {
  document.getElementById('manualBookingModal').classList.add('open');
}
function closeManualBooking() {
  document.getElementById('manualBookingModal').classList.remove('open');
}

async function submitManualBooking() {
  const groomName  = document.getElementById('mb-groom').value.trim();
  const brideName  = document.getElementById('mb-bride').value.trim();
  const template   = document.getElementById('mb-template').value;
  const amount     = parseInt(document.getElementById('mb-amount').value) || 1199;
  const whatsapp   = document.getElementById('mb-whatsapp').value.trim();
  const weddingDate= document.getElementById('mb-wdate').value;

  if (!groomName || !brideName || !whatsapp) {
    showAdminToast('⚠️ Naam aur WhatsApp zaroori hai', 'warning'); return;
  }

  const btn = document.getElementById('mb-submit');
  btn.disabled = true; btn.textContent = '⏳ Saving...';

  try {
    const docRef = await db.collection('bookings').add({
      groomName, brideName, template: template||'—',
      amountPaid: amount, whatsapp, status: 'pending',
      weddingCeremony: { date: weddingDate||'', time:'' },
      paymentVerified: true, // Manual = already paid
      createdBy: 'admin',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeManualBooking();
    showAdminToast('✅ Manual booking add ho gayi!', 'success');
    await loadBookings();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = '✅ Booking Add Karein';
  }
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('bookingsPage')) initBookings();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 4 — admin-templates.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── DEFAULT TEMPLATES DATA ─────────────────────────────────────────
const DEFAULT_TEMPLATES = [
  { slot:'w1', name:'Emerald Noir',    desc:'Deep green and gold with ornate corner accents',  badge:'Limited Edition', badgeType:'limited', order:1, active:true },
  { slot:'w2', name:'Crimson Royale',  desc:'Dark charcoal base with gold and deep red',       badge:'Most Liked',      badgeType:'liked',   order:2, active:true },
  { slot:'w3', name:'Royal Elegance',  desc:'Classic ivory and gold with palace motifs',        badge:'New',             badgeType:'new',     order:3, active:true },
  { slot:'w4', name:'Garden Romance',  desc:'Soft rose and blush with floral accents',          badge:'New',             badgeType:'new',     order:4, active:true },
  { slot:'w5', name:'Rose Gold Blush', desc:'Blush pink and rose gold with ornate floral door', badge:'Popular',         badgeType:'hot',     order:5, active:true },
  { slot:'w6', name:'Midnight Royal',  desc:'Deep purple and silver with celestial star motifs',badge:'Fan Fav',         badgeType:'liked',   order:6, active:true },
];

const BADGE_OPTIONS = [
  { value:'',         label:'— No Badge —' },
  { value:'New',      label:'🟠 New',            type:'new'     },
  { value:'Popular',  label:'🔴 Popular',         type:'hot'     },
  { value:'Most Liked',label:'🟣 Most Liked',     type:'liked'   },
  { value:'Fan Fav',  label:'🟣 Fan Fav',         type:'liked'   },
  { value:'Limited Edition',label:'🟢 Limited Edition',type:'limited'},
  { value:'Coming Soon',label:'⚪ Coming Soon',   type:'soon'    },
];

let allTemplates = [];

// ── INIT ───────────────────────────────────────────────────────────
async function initTemplates() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('templates');

  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';

  await loadTemplates();
}

// ── LOAD TEMPLATES FROM FIRESTORE ─────────────────────────────────
async function loadTemplates() {
  setTplLoading(true);
  try {
    const snap = await db.collection('templates').orderBy('order','asc').get();

    if (snap.empty) {
      // First time — initialize default templates
      await initDefaultTemplates();
      return;
    }

    allTemplates = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    renderTemplatesGrid();
  } catch(e) {
    // orderBy index nahi hai toh simple get
    try {
      const snap2 = await db.collection('templates').get();
      allTemplates = snap2.docs.map(doc => ({ _id: doc.id, ...doc.data() }))
        .sort((a,b) => (a.order||0) - (b.order||0));
      if (allTemplates.length === 0) await initDefaultTemplates();
      else renderTemplatesGrid();
    } catch(e2) {
      showAdminToast('❌ Templates load error: ' + e2.message, 'error');
    }
  } finally {
    setTplLoading(false);
  }
}

// ── INIT DEFAULT TEMPLATES (first time setup) ─────────────────────
async function initDefaultTemplates() {
  showAdminToast('⚙️ Default templates set ho rahe hain...', 'info');
  try {
    const batch = db.batch();
    DEFAULT_TEMPLATES.forEach(tpl => {
      const ref = db.collection('templates').doc(tpl.slot);
      batch.set(ref, {
        ...tpl,
        imgUrl:      `https://raw.githubusercontent.com/akans47g/AKANS_Web/main/${tpl.slot}.jpg`,
        previewLink: '',
        bookingLink: '',
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    showAdminToast('✅ Default templates initialized!', 'success');
    await loadTemplates();
  } catch(e) {
    showAdminToast('❌ Init error: ' + e.message, 'error');
  }
}

// ── RENDER GRID ────────────────────────────────────────────────────
function renderTemplatesGrid() {
  const grid = document.getElementById('templatesAdminGrid');
  if (!grid) return;

  const activeCount   = allTemplates.filter(t => t.active).length;
  const inactiveCount = allTemplates.filter(t => !t.active).length;
  const countEl = document.getElementById('tplCountInfo');
  if (countEl) countEl.textContent = `${activeCount} active · ${inactiveCount} hidden`;

  grid.innerHTML = allTemplates.map((t,i) => buildTplCard(t, i)).join('') + buildAddCard();
}

function buildTplCard(t, i) {
  const BADGE_COLORS = {
    limited:'#16a34a', liked:'#7c3aed', new:'#f59e0b',
    hot:'#ef4444', soon:'#94a3b8'
  };
  const badgeColor = BADGE_COLORS[t.badgeType] || '#64748b';

  return `<div class="tpl-card ${t.active ? '' : 'tpl-inactive'}" id="tplcard-${t._id}" 
               style="animation-delay:${i*0.05}s">
    <!-- Image -->
    <div class="tpl-img-wrap">
      <img src="${t.imgUrl||''}" alt="${t.name}" class="tpl-img"
           onerror="this.src='';this.parentNode.classList.add('no-img');this.style.display='none'"/>
      ${!t.imgUrl ? '<div class="tpl-no-img">📷<br>No Image</div>' : ''}
      ${t.badge ? `<span class="tpl-badge" style="background:${badgeColor};">${t.badge}</span>` : ''}
      ${!t.active ? '<div class="tpl-hidden-overlay">🔒 Hidden</div>' : ''}
      <div class="tpl-slot-tag">${t.slot||'—'}.jpg</div>
    </div>
    <!-- Info -->
    <div class="tpl-info">
      <div class="tpl-name">${t.name||'Unnamed'}</div>
      <div class="tpl-desc">${t.desc||'—'}</div>
      <div class="tpl-links">
        ${t.previewLink
          ? `<a href="${t.previewLink}" target="_blank" class="tpl-link-btn preview">👁️ Preview</a>`
          : '<span class="tpl-link-missing">⚠️ No preview link</span>'}
        ${t.bookingLink
          ? `<a href="${t.bookingLink}" target="_blank" class="tpl-link-btn booking">📦 Booking</a>`
          : ''}
      </div>
      <!-- Actions -->
      <div class="tpl-actions">
        <button class="tpl-btn tpl-edit" onclick="openTplEdit('${t._id}')">✏️ Edit</button>
        <button class="tpl-btn tpl-toggle ${t.active ? 'on' : 'off'}"
                onclick="toggleTplActive('${t._id}', ${!t.active})">
          ${t.active ? '✅ Active' : '🔴 Hidden'}
        </button>
      </div>
    </div>
  </div>`;
}

function buildAddCard() {
  return `<div class="tpl-card tpl-add-card" onclick="openAddTemplate()">
    <div class="tpl-add-icon">➕</div>
    <div class="tpl-add-text">Add New Template</div>
    <div class="tpl-add-sub">w7.jpg, w8.jpg...</div>
  </div>`;
}

function setTplLoading(loading) {
  const grid = document.getElementById('templatesAdminGrid');
  if (!grid) return;
  if (loading) {
    grid.innerHTML = `<div class="tpl-loading">
      <div class="tpl-spinner"></div>
      <div>Templates load ho rahe hain...</div>
    </div>`;
  }
}

// ── OPEN EDIT MODAL ────────────────────────────────────────────────
function openTplEdit(id) {
  const tpl = allTemplates.find(t => t._id === id);
  if (!tpl) return;

  const modal = document.getElementById('tplModal');
  const title = document.getElementById('tplModalTitle');
  if (!modal) return;

  if (title) title.textContent = `✏️ Edit — ${tpl.name}`;

  // Fill form fields
  document.getElementById('tplEditId').value          = id;
  document.getElementById('tplEditSlot').value        = tpl.slot || '';
  document.getElementById('tplEditName').value        = tpl.name || '';
  document.getElementById('tplEditDesc').value        = tpl.desc || '';
  document.getElementById('tplEditBadge').value       = tpl.badge || '';
  document.getElementById('tplEditImgUrl').value      = tpl.imgUrl || '';
  document.getElementById('tplEditPreview').value     = tpl.previewLink || '';
  document.getElementById('tplEditBooking').value     = tpl.bookingLink || '';
  document.getElementById('tplEditOrder').value       = tpl.order || 1;
  document.getElementById('tplEditActive').checked    = tpl.active !== false;

  // Image preview
  const prevImg = document.getElementById('tplCurrentImg');
  if (prevImg) {
    prevImg.src = tpl.imgUrl || '';
    prevImg.style.display = tpl.imgUrl ? 'block' : 'none';
  }

  // Reset file input
  const fileInput = document.getElementById('tplImgUpload');
  if (fileInput) fileInput.value = '';
  const uploadPreview = document.getElementById('tplUploadPreview');
  if (uploadPreview) uploadPreview.style.display = 'none';

  modal.classList.add('open');
}

// ── OPEN ADD TEMPLATE MODAL ────────────────────────────────────────
function openAddTemplate() {
  const nextSlot = 'w' + (allTemplates.length + 1);
  const modal = document.getElementById('tplModal');
  const title = document.getElementById('tplModalTitle');
  if (!modal) return;

  if (title) title.textContent = '➕ Naya Template Add Karo';

  // Clear all fields
  document.getElementById('tplEditId').value       = '';
  document.getElementById('tplEditSlot').value     = nextSlot;
  document.getElementById('tplEditName').value     = '';
  document.getElementById('tplEditDesc').value     = '';
  document.getElementById('tplEditBadge').value    = 'New';
  document.getElementById('tplEditImgUrl').value   = `https://raw.githubusercontent.com/akans47g/AKANS_Web/main/${nextSlot}.jpg`;
  document.getElementById('tplEditPreview').value  = '';
  document.getElementById('tplEditBooking').value  = '';
  document.getElementById('tplEditOrder').value    = allTemplates.length + 1;
  document.getElementById('tplEditActive').checked = true;

  const prevImg = document.getElementById('tplCurrentImg');
  if (prevImg) prevImg.style.display = 'none';

  modal.classList.add('open');
}

// ── HANDLE IMAGE FILE SELECT ───────────────────────────────────────
function onTplImgSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showAdminToast('❌ Image 5MB se zyada nahi honi chahiye', 'error'); return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('tplUploadPreview');
    if (preview) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    }
    showAdminToast('✅ Image select ho gayi — Save karo', 'success');
  };
  reader.readAsDataURL(file);
}

// ── SAVE TEMPLATE CHANGES ──────────────────────────────────────────
async function saveTplChanges() {
  const id       = document.getElementById('tplEditId').value.trim();
  const slot     = document.getElementById('tplEditSlot').value.trim();
  const name     = document.getElementById('tplEditName').value.trim();
  const desc     = document.getElementById('tplEditDesc').value.trim();
  const badge    = document.getElementById('tplEditBadge').value;
  const imgUrl   = document.getElementById('tplEditImgUrl').value.trim();
  const preview  = document.getElementById('tplEditPreview').value.trim();
  const booking  = document.getElementById('tplEditBooking').value.trim();
  const order    = parseInt(document.getElementById('tplEditOrder').value) || 1;
  const active   = document.getElementById('tplEditActive').checked;
  const fileInput = document.getElementById('tplImgUpload');

  if (!name) { showAdminToast('⚠️ Template naam zaroori hai', 'warning'); return; }
  if (!slot) { showAdminToast('⚠️ Slot naam zaroori hai (w1, w2...)', 'warning'); return; }

  const saveBtn = document.getElementById('tplSaveBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving...'; }

  try {
    let finalImgUrl = imgUrl;

    // Firebase Storage upload if file selected
    if (fileInput?.files[0] && typeof firebase.storage === 'function') {
      try {
        const file     = fileInput.files[0];
        const storRef  = firebase.storage().ref(`templates/${slot}.jpg`);
        await storRef.put(file);
        finalImgUrl    = await storRef.getDownloadURL();
        showAdminToast('☁️ Image uploaded to Storage!', 'success');
      } catch(storErr) {
        console.warn('Storage upload failed, using URL:', storErr);
        showAdminToast('⚠️ Storage unavailable — URL use ho raha hai', 'warning');
      }
    }

    const badgeType = BADGE_OPTIONS.find(b => b.value === badge)?.type || '';
    const data = {
      slot, name, desc, badge, badgeType,
      imgUrl: finalImgUrl,
      previewLink: preview,
      bookingLink: booking,
      order, active,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
      // Update existing
      await db.collection('templates').doc(id).update(data);
      showAdminToast('✅ Template updated!', 'success');
    } else {
      // Add new
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('templates').doc(slot).set(data);
      showAdminToast('✅ Naya template add ho gaya!', 'success');
    }

    closeTplModal();
    await loadTemplates();

    // Regenerate index.html templates JS (guidance)
    showAdminToast('💡 index.html pe templates auto-update ho jaayenge', 'info');

  } catch(e) {
    showAdminToast('❌ Save error: ' + e.message, 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Template'; }
  }
}

// ── TOGGLE ACTIVE ──────────────────────────────────────────────────
async function toggleTplActive(id, newState) {
  try {
    await db.collection('templates').doc(id).update({
      active: newState,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showAdminToast(newState ? '✅ Template active kar diya!' : '🔒 Template hide kar diya!', 'success');
    await loadTemplates();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── DELETE TEMPLATE ────────────────────────────────────────────────
async function deleteTpl(id) {
  const tpl = allTemplates.find(t => t._id === id);
  if (!confirm(`⚠️ "${tpl?.name||id}" template delete karna chahte ho? Yeh action undo nahi hoga.`)) return;
  try {
    await db.collection('templates').doc(id).delete();
    showAdminToast('🗑️ Template deleted!', 'success');
    closeTplModal();
    await loadTemplates();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── CLOSE MODAL ────────────────────────────────────────────────────
function closeTplModal() {
  const modal = document.getElementById('tplModal');
  if (modal) modal.classList.remove('open');
}

// ── ORDER UP/DOWN ──────────────────────────────────────────────────
async function moveTpl(id, direction) {
  const idx = allTemplates.findIndex(t => t._id === id);
  if (idx === -1) return;
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= allTemplates.length - 1) return; // -1 for add card

  const batch = db.batch();
  batch.update(db.collection('templates').doc(allTemplates[idx]._id),    { order: swapIdx + 1 });
  batch.update(db.collection('templates').doc(allTemplates[swapIdx]._id),{ order: idx + 1 });
  await batch.commit();
  await loadTemplates();
  showAdminToast('✅ Order updated!', 'success');
}

// ── PAGE INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('templatesPage')) initTemplates();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 5, 6... aage ke pages yahan add honge             ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 5, 6... admin-all2.js mein hain                   ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║   SIDEBAR RENDER — Used by ALL admin pages                   ║
// ╚══════════════════════════════════════════════════════════════╝

const ADMIN_NAV = [
  { id:'dashboard',  icon:'📊', label:'Dashboard',             url:'admin-dashboard.html'  },
  { id:'bookings',   icon:'📦', label:'Bookings',              url:'admin-bookings.html'   },
  { id:'orders',     icon:'📋', label:'Orders',                url:'admin-orders.html'     },
  { id:'users',      icon:'👥', label:'Users',                 url:'admin-users.html'      },
  { id:'reviews',    icon:'⭐', label:'Reviews',               url:'admin-reviews.html'    },
  { id:'templates',  icon:'🎨', label:'Templates',             url:'admin-templates.html'  },
  { id:'coupons',    icon:'🎟️', label:'Coupons',               url:'admin-coupons.html'    },
  { id:'referrals',  icon:'🎁', label:'Referrals & Withdraw',  url:'admin-referrals.html'  },
  { id:'whatsapp',   icon:'💬', label:'WhatsApp',              url:'admin-whatsapp.html'   },
  { id:'settings',   icon:'⚙️', label:'Settings',              url:'admin-settings.html'   },
];

function renderSidebar(activePage) {
  const sidebar = document.getElementById('adminSidebar');
  if (!sidebar) return;

  const session = JSON.parse(localStorage.getItem('adminSession') || '{}');
  const adminName  = session.displayName || session.email?.split('@')[0] || 'Admin';
  const adminEmail = session.email || '';

  const navHTML = ADMIN_NAV.map(item => `
    <a href="${item.url}" class="nav-item ${activePage === item.id ? 'active' : ''}" data-page="${item.id}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
      ${item.id === 'bookings'  ? `<span class="nav-badge" id="badge-bookings"></span>`  : ''}
      ${item.id === 'reviews'   ? `<span class="nav-badge" id="badge-reviews"></span>`   : ''}
      ${item.id === 'referrals' ? `<span class="nav-badge" id="badge-referrals"></span>` : ''}
    </a>
  `).join('');

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <div class="sb-logo-icon">🛡️</div>
      <div class="sb-logo-text">
        <div class="sb-title">AKANS Admin</div>
        <div class="sb-sub">Control Panel</div>
      </div>
    </div>
    <nav class="sidebar-nav">${navHTML}</nav>
    <div class="sidebar-user">
      <div class="sb-avatar">${adminName.charAt(0).toUpperCase()}</div>
      <div class="sb-user-info">
        <div class="sb-user-name">${adminName}</div>
        <div class="sb-user-email">${adminEmail}</div>
      </div>
      <button class="sb-logout" onclick="adminLogout()" title="Logout">⏏</button>
    </div>
  `;
}

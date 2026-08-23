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
// ║         SECTION 3 — admin-bookings.html                     ║
// ╚══════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────
let allBookings      = [];
let filteredBookings = [];
let currentFilter    = 'all';
let currentSearch    = '';
let unsubBookings    = null; // Firestore listener
let editingBookingId = null;

// ── INIT ──────────────────────────────────────────────────────────
async function initBookings() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('bookings');

  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';

  // URL filter check (?filter=pending)
  const params = new URLSearchParams(window.location.search);
  const urlFilter = params.get('filter');
  if (urlFilter) switchFilter(urlFilter);

  // Start real-time listener
  startBookingsListener();
}

// ── REAL-TIME FIRESTORE LISTENER ───────────────────────────────────
function startBookingsListener() {
  if (unsubBookings) unsubBookings(); // previous listener saaf karo

  setLoadingState(true);

  unsubBookings = db.collection('bookings')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      allBookings = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      updateBookingStats();
      applyFilterAndSearch();
      setLoadingState(false);
    }, err => {
      console.error('[Bookings]', err);
      showAdminToast('⚠️ Bookings load error: ' + err.message, 'error');
      setLoadingState(false);
    });
}

function setLoadingState(loading) {
  const grid = document.getElementById('bookingsGrid');
  if (!grid) return;
  if (loading && allBookings.length === 0) {
    grid.innerHTML = `<div class="b-loading">
      <div class="b-loading-spinner"></div>
      <div>Bookings load ho rahi hain...</div>
    </div>`;
  }
}

// ── STATS UPDATE ───────────────────────────────────────────────────
function updateBookingStats() {
  const counts = { all:0, pending:0, inprogress:0, completed:0, cancelled:0 };
  let totalRevenue = 0;
  allBookings.forEach(b => {
    counts.all++;
    counts[b.status || 'pending'] = (counts[b.status || 'pending'] || 0) + 1;
    totalRevenue += (b.amountPaid || 0);
  });

  // Update tab counts
  Object.keys(counts).forEach(k => {
    const el = document.getElementById('count-' + k);
    if (el) el.textContent = counts[k];
  });

  // Revenue
  const revEl = document.getElementById('total-revenue');
  if (revEl) revEl.textContent = '₹' + totalRevenue.toLocaleString('en-IN');
}

// ── FILTER & SEARCH ────────────────────────────────────────────────
function switchFilter(filter) {
  currentFilter = filter;
  // Update tab UI
  document.querySelectorAll('.b-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === filter);
  });
  applyFilterAndSearch();
}

function onSearch(val) {
  currentSearch = val.toLowerCase().trim();
  applyFilterAndSearch();
}

function applyFilterAndSearch() {
  filteredBookings = allBookings.filter(b => {
    // Filter
    const statusOk = currentFilter === 'all' || (b.status || 'pending') === currentFilter;
    if (!statusOk) return false;
    // Search
    if (!currentSearch) return true;
    const haystack = [
      b.groomName, b.brideName, b.template,
      b.whatsapp, b.transactionId, b._id,
      b.venueName, b.couponCode
    ].join(' ').toLowerCase();
    return haystack.includes(currentSearch);
  });
  renderBookingsGrid();
}

// ── RENDER GRID ────────────────────────────────────────────────────
function renderBookingsGrid() {
  const grid = document.getElementById('bookingsGrid');
  const countEl = document.getElementById('showing-count');
  if (!grid) return;

  if (countEl) countEl.textContent = `${filteredBookings.length} booking${filteredBookings.length !== 1 ? 's' : ''} mil ${filteredBookings.length === 1 ? 'gayi' : 'gayi'}`;

  if (filteredBookings.length === 0) {
    grid.innerHTML = `<div class="b-empty">
      <div class="b-empty-icon">📭</div>
      <div class="b-empty-title">Koi booking nahi mili</div>
      <div class="b-empty-sub">Filter ya search badlo</div>
    </div>`;
    return;
  }

  grid.innerHTML = filteredBookings.map(b => buildBookingCard(b)).join('');
}

// ── BUILD BOOKING CARD ─────────────────────────────────────────────
function buildBookingCard(b) {
  const STATUS_CFG = {
    pending:    { label:'Pending',     color:'#f59e0b', bg:'#fffbeb', border:'#fde68a' },
    inprogress: { label:'In Progress', color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe' },
    completed:  { label:'Completed',   color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
    cancelled:  { label:'Cancelled',   color:'#ef4444', bg:'#fef2f2', border:'#fecaca' },
  };
  const s = STATUS_CFG[b.status || 'pending'] || STATUS_CFG.pending;
  const shortId = '#AK' + b._id.slice(-6).toUpperCase();
  const date = b.createdAt?.toDate?.()
    ? b.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})
    : '—';
  const weddingDate = b.weddingCeremony?.date
    ? new Date(b.weddingCeremony.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
    : '—';

  return `<div class="b-card" id="card-${b._id}">
    <div class="b-card-top">
      <div class="b-order-id">${shortId}</div>
      <div class="b-card-badges">
        ${b.paymentVerified ? '<span class="verified-badge">✅ Verified</span>' : ''}
        <span class="status-pill" style="color:${s.color};background:${s.bg};border:1px solid ${s.border};">${s.label}</span>
      </div>
    </div>
    <div class="b-template">🎨 ${b.template || '—'}</div>
    <div class="b-couple">💑 <strong>${b.groomName||'?'}</strong> &amp; <strong>${b.brideName||'?'}</strong></div>
    <div class="b-meta-row">
      <span>💒 ${weddingDate}</span>
      <span>📅 ${date}</span>
    </div>
    <div class="b-payment-row">
      <span class="b-amount">💰 ₹${(b.amountPaid||0).toLocaleString('en-IN')}</span>
      ${b.couponCode ? `<span class="b-coupon">🎟️ ${b.couponCode}</span>` : ''}
      <span class="b-wa">📱 ${b.whatsapp||'—'}</span>
    </div>
    ${b.screenshotB64 ? `<div class="b-has-screenshot">📸 Payment screenshot available</div>` : ''}
    <div class="b-actions">
      <button class="b-btn b-btn-primary" onclick="openBookingDetail('${b._id}')">👁️ View Details</button>
      <a class="b-btn b-btn-wa" href="https://wa.me/91${b.whatsapp||''}" target="_blank" rel="noopener"
         onclick="if(!'${b.whatsapp}'){event.preventDefault();showAdminToast('WhatsApp number nahi hai','warning');}">
        💬 WhatsApp
      </a>
      <div class="b-status-wrap">
        <select class="b-status-select" onchange="quickStatusChange('${b._id}',this.value)" 
                style="color:${s.color};">
          <option value="pending"    ${(b.status||'pending')==='pending'?'selected':''}>⏳ Pending</option>
          <option value="inprogress" ${b.status==='inprogress'?'selected':''}>🔵 In Progress</option>
          <option value="completed"  ${b.status==='completed'?'selected':''}>✅ Completed</option>
          <option value="cancelled"  ${b.status==='cancelled'?'selected':''}>❌ Cancelled</option>
        </select>
      </div>
    </div>
  </div>`;
}

// ── QUICK STATUS CHANGE ────────────────────────────────────────────
async function quickStatusChange(id, newStatus) {
  try {
    await db.collection('bookings').doc(id).update({
      status: newStatus,
      statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showAdminToast('✅ Status updated!', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── OPEN BOOKING DETAIL MODAL ──────────────────────────────────────
async function openBookingDetail(id) {
  editingBookingId = id;
  const modal = document.getElementById('bookingModal');
  if (!modal) return;

  modal.classList.add('open');
  document.getElementById('modalContent').innerHTML = `<div style="text-align:center;padding:3rem;color:#94a3b8;">⏳ Loading details...</div>`;

  try {
    const doc = await db.collection('bookings').doc(id).get();
    if (!doc.exists) { showAdminToast('❌ Booking nahi mili', 'error'); closeModal(); return; }
    const b = { _id: doc.id, ...doc.data() };
    renderModalContent(b);
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
    closeModal();
  }
}

// ── RENDER MODAL CONTENT ───────────────────────────────────────────
function renderModalContent(b) {
  const STATUS_CFG = {
    pending:    'Pending', inprogress:'In Progress',
    completed:  'Completed', cancelled:'Cancelled'
  };
  const shortId  = '#AK' + b._id.slice(-6).toUpperCase();
  const wDate    = b.weddingCeremony?.date
    ? new Date(b.weddingCeremony.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})
    : '—';

  const formatEvent = (evt, name, emoji) => {
    if (!evt?.active) return '';
    return `<div class="detail-event">
      <span>${emoji} <strong>${name}</strong></span>
      <span>${evt.date ? new Date(evt.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : ''} ${evt.time||''}</span>
      <span>📍 ${evt.location||'—'}</span>
    </div>`;
  };

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-body-scroll">

      <!-- HEADER -->
      <div class="detail-header">
        <div>
          <div class="detail-order-id">${shortId}</div>
          <div class="detail-template">🎨 ${b.template||'—'}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;">
          <span class="status-pill" id="modalStatusPill"
            style="font-size:0.82rem;padding:0.3rem 0.8rem;">
            ${STATUS_CFG[b.status||'pending']||'Pending'}
          </span>
          ${b.paymentVerified ? '<span class="verified-badge">✅ Payment Verified</span>' : ''}
        </div>
      </div>

      <!-- COUPLE -->
      <div class="detail-section">
        <div class="detail-sec-title">💑 Couple Details</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="di-label">Dulhe Ka Naam</span><span class="di-val">${b.groomName||'—'}</span></div>
          <div class="detail-item"><span class="di-label">Dulhe Ke Walid</span><span class="di-val">${b.groomFather||'—'}</span></div>
          <div class="detail-item"><span class="di-label">Dulhan Ka Naam</span><span class="di-val">${b.brideName||'—'}</span></div>
          <div class="detail-item"><span class="di-label">Dulhan Ke Walid</span><span class="di-val">${b.brideFather||'—'}</span></div>
          ${b.engagementDate ? `<div class="detail-item"><span class="di-label">Mangni Ki Tarikh</span><span class="di-val">${new Date(b.engagementDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span></div>` : ''}
        </div>
      </div>

      <!-- TIMELINE -->
      <div class="detail-section">
        <div class="detail-sec-title">⏰ Wedding Program Timeline</div>
        <div class="detail-timeline">
          <div class="tl-row"><span class="tl-dot blue"></span><div><strong>Guest Arrival</strong><br><small>${b.guestArrival?.date||'—'} at ${b.guestArrival?.time||'—'}</small></div></div>
          <div class="tl-row"><span class="tl-dot purple"></span><div><strong>Wedding Ceremony</strong><br><small>${b.weddingCeremony?.date||'—'} at ${b.weddingCeremony?.time||'—'}</small></div></div>
          ${b.cocktailHour?.date ? `<div class="tl-row"><span class="tl-dot green"></span><div><strong>Cocktail Hour</strong><br><small>${b.cocktailHour.date} at ${b.cocktailHour.time||'—'}</small></div></div>` : ''}
          ${b.dinnerReception?.date ? `<div class="tl-row"><span class="tl-dot gold"></span><div><strong>Dinner Reception</strong><br><small>${b.dinnerReception.date} at ${b.dinnerReception.time||'—'}</small></div></div>` : ''}
        </div>
      </div>

      <!-- VENUE -->
      <div class="detail-section">
        <div class="detail-sec-title">📍 Venue Details</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="di-label">Venue</span><span class="di-val">${b.venueName||'—'}</span></div>
          <div class="detail-item full"><span class="di-label">Address</span><span class="di-val">${b.venueAddress||'—'}</span></div>
          ${b.venueMap ? `<div class="detail-item full"><span class="di-label">Maps Link</span><a href="${b.venueMap}" target="_blank" class="di-link">🗺️ Open Google Maps</a></div>` : ''}
        </div>
      </div>

      <!-- PRE-WEDDING EVENTS -->
      ${(b.mehendi?.active || b.haldi?.active || b.sangeet?.active) ? `
      <div class="detail-section">
        <div class="detail-sec-title">🌿 Pre-Wedding Rasme</div>
        ${formatEvent(b.mehendi, 'Mehendi', '🌿')}
        ${formatEvent(b.haldi,   'Haldi',   '💛')}
        ${formatEvent(b.sangeet, 'Sangeet', '🎶')}
      </div>` : ''}

      <!-- PAYMENT -->
      <div class="detail-section">
        <div class="detail-sec-title">💰 Payment Details</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="di-label">Amount Paid</span><span class="di-val strong-green">₹${(b.amountPaid||0).toLocaleString('en-IN')}</span></div>
          ${b.couponCode ? `<div class="detail-item"><span class="di-label">Coupon Used</span><span class="di-val">🎟️ ${b.couponCode} (₹${b.discount||0} off)</span></div>` : ''}
          <div class="detail-item"><span class="di-label">Transaction ID</span><span class="di-val mono">${b.transactionId||'—'}</span></div>
          <div class="detail-item"><span class="di-label">WhatsApp</span><span class="di-val">📱 ${b.whatsapp||'—'}</span></div>
          <div class="detail-item"><span class="di-label">Payment Status</span>
            <span class="di-val">${b.paymentVerified
              ? '<span style="color:#16a34a;font-weight:700;">✅ Verified</span>'
              : '<span style="color:#f59e0b;font-weight:700;">⏳ Pending Verification</span>'}</span>
          </div>
        </div>
        ${b.screenshotB64 ? `
        <div style="margin-top:0.8rem;">
          <div class="di-label" style="margin-bottom:0.5rem;">📸 Payment Screenshot</div>
          <img src="${b.screenshotB64}" alt="Payment Screenshot"
               style="max-width:100%;max-height:300px;object-fit:contain;border-radius:10px;border:1px solid #e2e8f0;cursor:pointer;"
               onclick="window.open(this.src,'_blank')"/>
        </div>` : ''}
      </div>

      <!-- ADMIN ACTIONS -->
      <div class="detail-section">
        <div class="detail-sec-title">⚙️ Admin Actions</div>

        <!-- Status Change -->
        <div class="admin-action-row">
          <label class="action-label">Status Change</label>
          <select id="modalStatusSelect" class="action-select">
            <option value="pending"    ${(b.status||'pending')==='pending'?'selected':''}>⏳ Pending</option>
            <option value="inprogress" ${b.status==='inprogress'?'selected':''}>🔵 In Progress</option>
            <option value="completed"  ${b.status==='completed'?'selected':''}>✅ Completed</option>
            <option value="cancelled"  ${b.status==='cancelled'?'selected':''}>❌ Cancelled</option>
          </select>
        </div>

        <!-- Card Link -->
        <div class="admin-action-row">
          <label class="action-label">Card Link (user ko dena hai)</label>
          <input type="url" id="modalCardLink" class="action-input"
                 value="${b.cardLink||''}" placeholder="https://akans47g.github.io/AKANS_Web/cards/..."/>
        </div>

        <!-- Admin Note -->
        <div class="admin-action-row">
          <label class="action-label">Admin Note</label>
          <textarea id="modalAdminNote" class="action-textarea"
                    placeholder="Koi note likhna ho toh...">${b.adminNote||''}</textarea>
        </div>

        <!-- Payment Verify -->
        <div class="admin-action-row" style="flex-direction:row;align-items:center;gap:0.8rem;">
          <input type="checkbox" id="modalPayVerify" ${b.paymentVerified?'checked':''}
                 style="width:18px;height:18px;accent-color:#16a34a;cursor:pointer;"/>
          <label for="modalPayVerify" style="font-size:0.85rem;font-weight:600;cursor:pointer;color:#1e293b;">
            ✅ Payment Verified Mark Karo
          </label>
        </div>

        <!-- Action Buttons -->
        <div class="modal-action-btns">
          <button class="mab-save" onclick="saveBookingChanges('${b._id}')">💾 Save Changes</button>
          <a class="mab-wa" href="https://wa.me/91${b.whatsapp||''}" target="_blank" rel="noopener">💬 WhatsApp</a>
          ${b.cardLink ? `<a class="mab-link" href="${b.cardLink}" target="_blank" rel="noopener">🔗 View Card</a>` : ''}
          <button class="mab-delete" onclick="deleteBooking('${b._id}')">🗑️ Delete</button>
        </div>
      </div>

    </div><!-- /modal-body-scroll -->
  `;
}

// ── SAVE BOOKING CHANGES ───────────────────────────────────────────
async function saveBookingChanges(id) {
  const status   = document.getElementById('modalStatusSelect')?.value;
  const note     = document.getElementById('modalAdminNote')?.value.trim();
  const verified = document.getElementById('modalPayVerify')?.checked;
  const cardLink = document.getElementById('modalCardLink')?.value.trim();

  const saveBtn = document.querySelector('.mab-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving...'; }

  try {
    const updateData = {
      status,
      adminNote:       note,
      paymentVerified: verified,
      cardLink:        cardLink || '',
      updatedAt:       firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('bookings').doc(id).update(updateData);

    // orders collection bhi update karo
    const ordSnap = await db.collection('orders').where('userId','==', allBookings.find(b=>b._id===id)?.userId||'').get();
    if (!ordSnap.empty) {
      await db.collection('orders').doc(ordSnap.docs[0].id).update({
        status: status,
        link:   cardLink || '#'
      });
    }

    showAdminToast('✅ Booking updated!', 'success');
    closeModal();

    // Send WhatsApp notification if completed
    if (status === 'completed' && cardLink) {
      const b = allBookings.find(x => x._id === id);
      if (b?.whatsapp) {
        const msg = encodeURIComponent(
          `🎉 *AKANS Web Development Services*\n\nAssalamu Alaikum! Aapka digital wedding card ready ho gaya hai! 💍\n\n` +
          `👫 *${b.groomName} & ${b.brideName}*\n` +
          `🔗 Card Link: ${cardLink}\n\n` +
          `Mubarakbaad! 🎊`
        );
        window.open(`https://wa.me/91${b.whatsapp}?text=${msg}`, '_blank');
      }
    }

  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Changes'; }
  }
}

// ── DELETE BOOKING ─────────────────────────────────────────────────
async function deleteBooking(id) {
  if (!confirm('⚠️ Yeh booking permanently delete ho jaayegi. Sure ho?')) return;
  try {
    await db.collection('bookings').doc(id).delete();
    showAdminToast('🗑️ Booking deleted', 'success');
    closeModal();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── CLOSE MODAL ────────────────────────────────────────────────────
function closeModal() {
  const modal = document.getElementById('bookingModal');
  if (modal) modal.classList.remove('open');
  editingBookingId = null;
}

// ── EXPORT CSV ─────────────────────────────────────────────────────
function exportBookingsCSV() {
  if (filteredBookings.length === 0) {
    showAdminToast('⚠️ Export karne ke liye pehle bookings load honi chahiye', 'warning');
    return;
  }

  const headers = ['Order ID','Template','Groom Name','Bride Name','Wedding Date',
    'Amount Paid','Coupon','Transaction ID','WhatsApp','Status','Created At'];

  const rows = filteredBookings.map(b => [
    '#AK' + b._id.slice(-6).toUpperCase(),
    b.template||'',
    b.groomName||'',
    b.brideName||'',
    b.weddingCeremony?.date||'',
    b.amountPaid||0,
    b.couponCode||'',
    b.transactionId||'',
    b.whatsapp||'',
    b.status||'pending',
    b.createdAt?.toDate?.()?.toLocaleDateString('en-IN')||''
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `akans-bookings-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showAdminToast('✅ CSV downloaded!', 'success');
}

// ── CLEANUP ────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (unsubBookings) unsubBookings();
});

// ── PAGE INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('bookingsPage')) initBookings();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 4, 5... aage ke pages yahan add honge             ║
// ╚══════════════════════════════════════════════════════════════╝

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
// ║         SECTION 4 — admin-templates.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────
let allTemplates   = [];
let editingTplId   = null;
let uploadedImgUrl = '';
let storage        = null;

// Default templates (Firestore khali ho toh ye show honge)
const DEFAULT_TEMPLATES = [
  { name:'Emerald Noir',    desc:'Deep green and gold with ornate corner accents',         badge:'Limited Edition', badgeClass:'badge-limited', imgFile:'w1.jpg', previewLink:'', active:true, order:1 },
  { name:'Crimson Royale',  desc:'Dark charcoal base with gold and deep red accents',      badge:'Most Liked',     badgeClass:'badge-liked',   imgFile:'w2.jpg', previewLink:'', active:true, order:2 },
  { name:'Royal Elegance',  desc:'Classic ivory and gold with palace motifs',              badge:'New',            badgeClass:'badge-new',     imgFile:'w3.jpg', previewLink:'', active:true, order:3 },
  { name:'Garden Romance',  desc:'Soft rose and blush with floral accents',                badge:'New',            badgeClass:'badge-new',     imgFile:'w4.jpg', previewLink:'', active:true, order:4 },
  { name:'Rose Gold Blush', desc:'Blush pink and rose gold with ornate floral door',       badge:'Popular',        badgeClass:'badge-hot',     imgFile:'w5.jpg', previewLink:'', active:true, order:5 },
  { name:'Midnight Royal',  desc:'Deep purple and silver with celestial star motifs',      badge:'Fan Fav',        badgeClass:'badge-liked',   imgFile:'w6.jpg', previewLink:'', active:true, order:6 },
];

const GITHUB_BASE = 'https://raw.githubusercontent.com/akans47g/AKANS_Web/main/';
const BADGE_OPTIONS = [
  { value:'badge-new',     label:'🟠 New'           },
  { value:'badge-hot',     label:'🔴 Popular / Hot'  },
  { value:'badge-liked',   label:'🟣 Most Liked'     },
  { value:'badge-limited', label:'🟢 Limited Edition' },
  { value:'badge-fav',     label:'⭐ Fan Fav'         },
];

// ── INIT ──────────────────────────────────────────────────────────
async function initTemplates() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('templates');

  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';

  // Firebase Storage init
  try {
    storage = firebase.storage();
  } catch(e) {
    console.warn('[Templates] Storage not available:', e.message);
  }

  await loadTemplates();
}

// ── LOAD TEMPLATES ─────────────────────────────────────────────────
async function loadTemplates() {
  setTplLoading(true);
  try {
    const snap = await db.collection('templates').orderBy('order','asc').get();

    if (snap.empty) {
      // Firestore khali hai → default templates seed karo
      await seedDefaultTemplates();
    } else {
      allTemplates = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    }
    renderTemplatesGrid();
  } catch(e) {
    console.error('[Templates]', e);
    // Fallback to defaults without seeding
    allTemplates = DEFAULT_TEMPLATES.map((t,i) => ({ _id: 'default-'+i, ...t }));
    renderTemplatesGrid();
    showAdminToast('⚠️ Firestore error — showing defaults', 'warning');
  }
  setTplLoading(false);
}

// ── SEED DEFAULT TEMPLATES ─────────────────────────────────────────
async function seedDefaultTemplates() {
  const batch = db.batch();
  DEFAULT_TEMPLATES.forEach(tpl => {
    const ref = db.collection('templates').doc();
    batch.set(ref, {
      ...tpl,
      imageUrl: GITHUB_BASE + tpl.imgFile,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  // Reload after seeding
  const snap = await db.collection('templates').orderBy('order','asc').get();
  allTemplates = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
}

function setTplLoading(loading) {
  const grid = document.getElementById('templatesGrid');
  if (!grid) return;
  if (loading) {
    grid.innerHTML = `<div class="tpl-loading">
      <div class="tpl-spinner"></div>
      <span>Templates load ho rahe hain...</span>
    </div>`;
  }
}

// ── RENDER TEMPLATES GRID ──────────────────────────────────────────
function renderTemplatesGrid() {
  const grid = document.getElementById('templatesGrid');
  if (!grid) return;

  const countEl = document.getElementById('tpl-count');
  if (countEl) countEl.textContent = `${allTemplates.length} templates`;

  grid.innerHTML = allTemplates.map((t,i) => buildTplCard(t,i)).join('') +
    `<div class="tpl-add-card" onclick="openAddTemplate()">
      <div class="tpl-add-icon">+</div>
      <div class="tpl-add-label">Naya Template Add Karo</div>
    </div>`;
}

// ── BUILD TEMPLATE CARD ────────────────────────────────────────────
function buildTplCard(t, i) {
  const imgSrc = t.imageUrl || (GITHUB_BASE + (t.imgFile || 'w'+(i+1)+'.jpg'));
  const badgeLabel = BADGE_OPTIONS.find(b => b.value === t.badgeClass)?.label || t.badge || '';

  return `<div class="tpl-card ${t.active ? '' : 'tpl-inactive'}" id="tpl-card-${t._id}">

    <!-- IMAGE -->
    <div class="tpl-img-wrap">
      <img src="${imgSrc}" alt="${t.name}"
           onerror="this.src='';this.parentElement.style.background='#e2e8f0';"
           class="tpl-img"/>
      <div class="tpl-img-overlay">
        <button class="tpl-img-btn" onclick="triggerImgUpload('${t._id}')">📷 Change Image</button>
      </div>
      <input type="file" id="img-input-${t._id}" accept="image/*" style="display:none;"
             onchange="handleImageUpload(this,'${t._id}')"/>
      ${t.badge ? `<span class="tpl-badge-pill ${t.badgeClass||''}">${t.badge}</span>` : ''}
      ${!t.active ? `<div class="tpl-inactive-overlay">INACTIVE</div>` : ''}
    </div>

    <!-- INFO -->
    <div class="tpl-info">
      <div class="tpl-name">${t.name||'Untitled'}</div>
      <div class="tpl-desc">${t.desc||'—'}</div>
      ${t.previewLink
        ? `<a href="${t.previewLink}" target="_blank" class="tpl-preview-link">🔗 Preview Link</a>`
        : `<span class="tpl-no-link">⚠️ No preview link</span>`}
    </div>

    <!-- TOGGLE + ACTIONS -->
    <div class="tpl-footer">
      <div class="tpl-toggle-row" onclick="toggleTemplateActive('${t._id}',${!t.active})">
        <div class="mini-toggle ${t.active ? 'on' : ''}"></div>
        <span class="tpl-toggle-label">${t.active ? '✅ Active' : '⭕ Inactive'}</span>
      </div>
      <div class="tpl-btns">
        <button class="tpl-btn tpl-btn-edit" onclick="openEditTemplate('${t._id}')">✏️ Edit</button>
        <button class="tpl-btn tpl-btn-del"  onclick="deleteTemplate('${t._id}','${t.name}')">🗑️</button>
      </div>
    </div>

  </div>`;
}

// ── OPEN EDIT MODAL ────────────────────────────────────────────────
function openEditTemplate(id) {
  const t = allTemplates.find(x => x._id === id);
  if (!t) return;
  editingTplId   = id;
  uploadedImgUrl = '';

  const modal = document.getElementById('tplModal');
  document.getElementById('tplModalTitle').textContent = '✏️ Template Edit Karo';
  document.getElementById('tpl-edit-name').value        = t.name || '';
  document.getElementById('tpl-edit-desc').value        = t.desc || '';
  document.getElementById('tpl-edit-link').value        = t.previewLink || '';
  document.getElementById('tpl-edit-badge-text').value  = t.badge || '';
  document.getElementById('tpl-edit-badge-class').value = t.badgeClass || 'badge-new';
  document.getElementById('tpl-edit-order').value       = t.order || 1;
  document.getElementById('tpl-edit-active').checked    = t.active !== false;

  const prevImg = document.getElementById('tpl-modal-preview');
  prevImg.src   = t.imageUrl || (GITHUB_BASE + (t.imgFile||'w1.jpg'));
  prevImg.style.display = 'block';

  modal.classList.add('open');
}

// ── OPEN ADD TEMPLATE ──────────────────────────────────────────────
function openAddTemplate() {
  editingTplId   = null;
  uploadedImgUrl = '';

  document.getElementById('tplModalTitle').textContent  = '➕ Naya Template Add Karo';
  document.getElementById('tpl-edit-name').value        = '';
  document.getElementById('tpl-edit-desc').value        = '';
  document.getElementById('tpl-edit-link').value        = '';
  document.getElementById('tpl-edit-badge-text').value  = 'New';
  document.getElementById('tpl-edit-badge-class').value = 'badge-new';
  document.getElementById('tpl-edit-order').value       = allTemplates.length + 1;
  document.getElementById('tpl-edit-active').checked    = true;
  document.getElementById('tpl-modal-preview').style.display = 'none';

  document.getElementById('tplModal').classList.add('open');
}

function closeTplModal() {
  document.getElementById('tplModal').classList.remove('open');
  editingTplId = null;
  uploadedImgUrl = '';
}

// ── IMAGE UPLOAD ───────────────────────────────────────────────────
function triggerImgUpload(id) {
  document.getElementById('img-input-' + id)?.click();
}

function triggerModalImgUpload() {
  document.getElementById('tpl-modal-img-input')?.click();
}

async function handleImageUpload(input, tplId) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showAdminToast('❌ Image bahut badi hai (max 5MB)', 'error');
    return;
  }

  showAdminToast('⏳ Image upload ho rahi hai...', 'info');

  try {
    if (storage) {
      // Firebase Storage mein upload karo
      const fileName = `templates/${tplId || 'new'}_${Date.now()}.${file.name.split('.').pop()}`;
      const ref      = storage.ref(fileName);
      const snap     = await ref.put(file);
      uploadedImgUrl = await snap.ref.getDownloadURL();
    } else {
      // Storage nahi hai → base64 fallback
      uploadedImgUrl = await fileToBase64(file);
    }

    // Preview update karo
    if (tplId && document.getElementById('tpl-card-' + tplId)) {
      // Direct card image update (quick visual feedback)
      const cardImg = document.querySelector(`#tpl-card-${tplId} .tpl-img`);
      if (cardImg) cardImg.src = uploadedImgUrl;
      // Firestore update
      await db.collection('templates').doc(tplId).update({ imageUrl: uploadedImgUrl });
      showAdminToast('✅ Image update ho gayi!', 'success');
      await loadTemplates();
    } else {
      // Modal ke andar preview
      const prev = document.getElementById('tpl-modal-preview');
      if (prev) { prev.src = uploadedImgUrl; prev.style.display = 'block'; }
      showAdminToast('✅ Image ready hai — Save karo', 'success');
    }
  } catch(e) {
    console.error('[Image Upload]', e);
    showAdminToast('❌ Upload error: ' + e.message, 'error');
  }
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = () => rej(new Error('File read failed'));
    r.readAsDataURL(file);
  });
}

// ── SAVE TEMPLATE (Edit ya Add) ────────────────────────────────────
async function saveTplChanges() {
  const name      = document.getElementById('tpl-edit-name').value.trim();
  const desc      = document.getElementById('tpl-edit-desc').value.trim();
  const link      = document.getElementById('tpl-edit-link').value.trim();
  const badge     = document.getElementById('tpl-edit-badge-text').value.trim();
  const badgeCls  = document.getElementById('tpl-edit-badge-class').value;
  const order     = parseInt(document.getElementById('tpl-edit-order').value) || 1;
  const active    = document.getElementById('tpl-edit-active').checked;

  if (!name) { showAdminToast('⚠️ Template ka naam daalo', 'warning'); return; }

  const saveBtn = document.getElementById('tplSaveBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving...'; }

  const data = {
    name, desc, previewLink: link,
    badge, badgeClass: badgeCls,
    order, active,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (uploadedImgUrl) data.imageUrl = uploadedImgUrl;

  try {
    if (editingTplId) {
      await db.collection('templates').doc(editingTplId).update(data);
      showAdminToast('✅ Template updated!', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.imgFile   = 'w' + (allTemplates.length + 1) + '.jpg';
      if (!data.imageUrl) data.imageUrl = GITHUB_BASE + data.imgFile;
      await db.collection('templates').add(data);
      showAdminToast('✅ Naya template add ho gaya!', 'success');
    }
    closeTplModal();
    await loadTemplates();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Karo'; }
  }
}

// ── TOGGLE ACTIVE ──────────────────────────────────────────────────
async function toggleTemplateActive(id, newActive) {
  try {
    await db.collection('templates').doc(id).update({ active: newActive });
    showAdminToast(newActive ? '✅ Template active kiya' : '⭕ Template inactive kiya', 'success');
    await loadTemplates();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── DELETE TEMPLATE ────────────────────────────────────────────────
async function deleteTemplate(id, name) {
  if (!confirm(`⚠️ "${name}" template delete karna chahte ho? Yeh undo nahi hoga.`)) return;
  try {
    await db.collection('templates').doc(id).delete();
    showAdminToast('🗑️ Template deleted', 'success');
    await loadTemplates();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── PAGE INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('templatesPage')) initTemplates();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 5, 6... aage ke pages yahan add honge             ║
// ╚══════════════════════════════════════════════════════════════╝

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
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── SIDEBAR TOGGLE (mobile) ────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}
function closeSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
}

// ── DASHBOARD INIT ────────────────────────────────────────────────
async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  // Admin name set karo
  const nameEl = document.getElementById('adminDisplayName');
  if (nameEl) nameEl.textContent = session.displayName || session.email;

  // Sab data load karo
  await Promise.all([
    loadDashboardStats(),
    loadRecentBookings(),
    loadRecentUsers(),
  ]);

  // Charts
  loadRevenueChart();
  loadTemplateChart();
}

// ── DASHBOARD STATS ────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    // Parallel queries
    const [bookingsSnap, usersSnap, reviewsSnap, ordersSnap] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved','==',false).get(),
      db.collection('orders').where('status','==','active').get(),
    ]);

    const bookings = bookingsSnap.docs.map(d => d.data());
    const pending  = bookings.filter(b => b.status === 'pending').length;

    // Today's bookings
    const today    = new Date(); today.setHours(0,0,0,0);
    const todayBks = bookings.filter(b => {
      const ts = b.createdAt?.toDate?.();
      return ts && ts >= today;
    }).length;

    // Total revenue
    const revenue  = bookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.amountPaid || 0), 0);

    // Pending withdrawals
    const withdrawSnap = await db.collection('referrals')
      .where('pendingWithdrawal','==',true).get().catch(() => ({size:0}));

    // Update UI
    setStatCard('statTotalBookings',  bookings.length, todayBks > 0 ? `+${todayBks} aaj` : 'Koi nahi aaj');
    setStatCard('statRevenue',        '₹' + revenue.toLocaleString('en-IN'), 'Total collected');
    setStatCard('statPendingBookings',pending, pending > 0 ? '⚠️ Action needed' : '✅ Sab clear');
    setStatCard('statTotalUsers',     usersSnap.size, 'Registered users');
    setStatCard('statPendingReviews', reviewsSnap.size, reviewsSnap.size > 0 ? 'Approve karo' : '✅ Sab clear');
    setStatCard('statActiveOrders',   ordersSnap.size, 'In progress');

  } catch (e) {
    console.error('Stats error:', e);
    showAdminToast('❌ Stats load nahi hue', 'error');
  }
}

function setStatCard(id, value, sub) {
  const card = document.getElementById(id);
  if (!card) return;
  const valEl = card.querySelector('.stat-val');
  const subEl = card.querySelector('.stat-sub');
  if (valEl) { valEl.textContent = value; valEl.style.animation = 'countUp 0.5s ease both'; }
  if (subEl) subEl.textContent = sub;
}

// ── RECENT BOOKINGS ────────────────────────────────────────────────
async function loadRecentBookings() {
  const container = document.getElementById('recentBookings');
  if (!container) return;
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt', 'desc').limit(5).get();

    if (snap.empty) {
      container.innerHTML = `<div class="empty-row">📭 Abhi koi booking nahi</div>`;
      return;
    }

    container.innerHTML = snap.docs.map(doc => {
      const b   = doc.data();
      const date = b.createdAt?.toDate?.()?.toLocaleDateString('en-IN',
        {day:'numeric',month:'short'}) || '—';
      const statusColor = {
        pending:    '#f59e0b',
        active:     '#2563eb',
        completed:  '#16a34a',
        cancelled:  '#ef4444'
      }[b.status] || '#8890b5';

      return `
        <div class="recent-row" onclick="window.location.href='admin-bookings.html?id=${doc.id}'">
          <div class="recent-avatar" style="background:linear-gradient(135deg,#1e3a8a,#3730a3)">
            ${(b.groomName||'?').charAt(0)}
          </div>
          <div class="recent-info">
            <div class="recent-name">${b.groomName||'—'} & ${b.brideName||'—'}</div>
            <div class="recent-sub">${b.template||'—'} · ${date}</div>
          </div>
          <div class="recent-right">
            <div class="recent-amount">₹${(b.amountPaid||0).toLocaleString('en-IN')}</div>
            <div class="recent-badge" style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44">
              ${b.status||'pending'}
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty-row">⚠️ Load failed</div>`;
  }
}

// ── RECENT USERS ───────────────────────────────────────────────────
async function loadRecentUsers() {
  const container = document.getElementById('recentUsers');
  if (!container) return;
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt','desc').limit(5).get();

    if (snap.empty) {
      container.innerHTML = `<div class="empty-row">📭 Koi user nahi</div>`;
      return;
    }

    container.innerHTML = snap.docs.map(doc => {
      const u    = doc.data();
      const date = u.createdAt?.toDate?.()?.toLocaleDateString('en-IN',
        {day:'numeric',month:'short'}) || '—';
      const init = (u.displayName||u.email||'U').charAt(0).toUpperCase();

      return `
        <div class="recent-row">
          <div class="recent-avatar" style="background:linear-gradient(135deg,#166534,#15803d)">
            ${init}
          </div>
          <div class="recent-info">
            <div class="recent-name">${u.displayName||u.email?.split('@')[0]||'User'}</div>
            <div class="recent-sub">${u.email||'—'} · Joined ${date}</div>
          </div>
          <div class="recent-right">
            ${u.whatsapp ? `<div class="recent-amount">📱 ${u.whatsapp}</div>` : ''}
            ${u.referredBy ? `<div class="recent-badge" style="background:#7c3aed22;color:#7c3aed;border:1px solid #7c3aed44">Referred</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty-row">⚠️ Load failed</div>`;
  }
}

// ── REVENUE CHART (last 7 days) ────────────────────────────────────
async function loadRevenueChart() {
  const ctx = document.getElementById('revenueChart');
  if (!ctx || typeof Chart === 'undefined') return;
  try {
    // Last 7 days labels
    const days   = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      days.push(d);
      labels.push(d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric'}));
    }

    const snap    = await db.collection('bookings')
      .where('createdAt','>=', days[0]).get();
    const amounts = new Array(7).fill(0);

    snap.docs.forEach(doc => {
      const b   = doc.data();
      const ts  = b.createdAt?.toDate?.();
      if (!ts) return;
      for (let i = 0; i < 7; i++) {
        const d = days[i];
        const next = new Date(d); next.setDate(d.getDate() + 1);
        if (ts >= d && ts < next) {
          amounts[i] += (b.amountPaid || 0);
        }
      }
    });

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue (₹)',
          data:  amounts,
          borderColor:     '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color:'rgba(255,255,255,0.05)' }, ticks: { color:'#8890b5', font:{size:11} } },
          y: { grid: { color:'rgba(255,255,255,0.05)' }, ticks: { color:'#8890b5', font:{size:11},
               callback: v => '₹' + v.toLocaleString('en-IN') } }
        }
      }
    });
  } catch(e) { console.warn('Revenue chart:', e); }
}

// ── TEMPLATE POPULARITY CHART ──────────────────────────────────────
async function loadTemplateChart() {
  const ctx = document.getElementById('templateChart');
  if (!ctx || typeof Chart === 'undefined') return;
  try {
    const snap     = await db.collection('bookings').get();
    const tplCount = {};
    snap.docs.forEach(doc => {
      const t = doc.data().template || 'Unknown';
      tplCount[t] = (tplCount[t] || 0) + 1;
    });

    const sorted = Object.entries(tplCount).sort((a,b) => b[1]-a[1]);
    const labels = sorted.map(([k]) => k);
    const data   = sorted.map(([,v]) => v);
    const colors = ['#3b82f6','#7c3aed','#16a34a','#f59e0b','#ec4899','#06b6d4'];

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 0, hoverOffset: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position:'bottom', labels:{ color:'#c9d1d9', font:{size:11}, padding:12 } }
        }
      }
    });
  } catch(e) { console.warn('Template chart:', e); }
}

// ── REALTIME UPDATES (optional) ───────────────────────────────────
function startRealtimeUpdates() {
  // Pending bookings badge realtime
  db.collection('bookings').where('status','==','pending')
    .onSnapshot(snap => {
      const badge = document.getElementById('pendingBadge');
      if (badge) badge.textContent = snap.size;
    });
  // Pending reviews badge
  db.collection('reviews').where('approved','==',false)
    .onSnapshot(snap => {
      const badge = document.getElementById('reviewBadge');
      if (badge) badge.textContent = snap.size;
    });
}

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 3, 4, 5... aage ke pages ka JS yahan add hoga    ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── DASHBOARD INIT ────────────────────────────────────────────────
async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  // Admin name show karo
  const nameEl = document.getElementById('adminName');
  if (nameEl) nameEl.textContent = session.displayName || session.email.split('@')[0];

  // Current time
  updateClock();
  setInterval(updateClock, 1000);

  // Sab data load karo
  showDashboardLoading(true);
  await Promise.all([
    loadDashboardStats(),
    loadRecentBookings(),
    loadRecentUsers(),
    loadRecentActivity()
  ]);
  showDashboardLoading(false);
}

function updateClock() {
  const el = document.getElementById('adminClock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-IN', {
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true
  });
}

function showDashboardLoading(show) {
  document.querySelectorAll('.stat-num').forEach(el => {
    if (show) { el.dataset.final = el.textContent; el.textContent = '...'; }
  });
}

// ── LOAD ALL STATS ─────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const weekAgo = new Date(Date.now() - 7*24*60*60*1000);

    // Parallel fetch karo
    const [bookSnap, userSnap, reviewSnap, referSnap, orderSnap] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved','==',false).get(),
      db.collection('referrals').get(),
      db.collection('orders').get()
    ]);

    const bookings = bookSnap.docs.map(d => ({id:d.id,...d.data()}));

    // Calculate stats
    const totalRevenue    = bookings.reduce((s,b) => s + (b.amountPaid||0), 0);
    const totalBookings   = bookings.length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const todayBookings   = bookings.filter(b => {
      const t = b.createdAt?.toDate?.();
      return t && t >= today;
    }).length;
    const weekBookings    = bookings.filter(b => {
      const t = b.createdAt?.toDate?.();
      return t && t >= weekAgo;
    }).length;
    const totalUsers      = userSnap.size;
    const pendingReviews  = reviewSnap.size;
    const totalReferrals  = referSnap.size;
    const activeOrders    = orderSnap.docs.filter(d => d.data().status==='active').length;

    // Pending withdrawals
    let pendingWithdrawals = 0;
    referSnap.docs.forEach(d => {
      if ((d.data().pendingWithdrawal||0) > 0) pendingWithdrawals++;
    });

    // Update UI
    setStatNum('statRevenue',    '₹' + totalRevenue.toLocaleString('en-IN'));
    setStatNum('statBookings',   totalBookings);
    setStatNum('statPending',    pendingBookings);
    setStatNum('statUsers',      totalUsers);
    setStatNum('statReviews',    pendingReviews);
    setStatNum('statReferrals',  totalReferrals);
    setStatNum('statWithdraw',   pendingWithdrawals);
    setStatNum('statOrders',     activeOrders);
    setStatNum('statToday',      todayBookings);
    setStatNum('statWeek',       weekBookings);

    // Alert badges
    if (pendingBookings > 0) showAlertBadge('navBookings', pendingBookings);
    if (pendingReviews > 0)  showAlertBadge('navReviews', pendingReviews);
    if (pendingWithdrawals > 0) showAlertBadge('navReferrals', pendingWithdrawals);

    // Draw charts
    drawBookingChart(bookings);
    drawTemplateChart(bookings);

  } catch(e) {
    console.error('Stats load error:', e);
    showAdminToast('⚠️ Stats load nahi hua — ' + e.message, 'error');
  }
}

function setStatNum(id, val) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = val;
    el.parentElement?.classList.add('loaded');
  }
}

function showAlertBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  const badge = el.querySelector('.nav-badge') || document.createElement('span');
  badge.className = 'nav-badge';
  badge.textContent = count > 9 ? '9+' : count;
  if (!el.querySelector('.nav-badge')) el.appendChild(badge);
}

// ── RECENT BOOKINGS ───────────────────────────────────────────────
async function loadRecentBookings() {
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(5).get();

    const tbody = document.getElementById('recentBookingsTbody');
    if (!tbody) return;

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:#8890b5;">Abhi koi booking nahi hai</td></tr>';
      return;
    }

    tbody.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const date = d.createdAt?.toDate?.()?.toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) || '—';
      const statusCls = { pending:'st-pending', 'in-progress':'st-progress', completed:'st-done', cancelled:'st-cancel' };
      const statusLbl = { pending:'⏳ Pending', 'in-progress':'🔧 In Progress', completed:'✅ Done', cancelled:'❌ Cancelled' };
      return `
        <tr onclick="window.location='admin-bookings.html?id=${doc.id}'" style="cursor:pointer;">
          <td><span class="table-id">${d.orderId||doc.id.slice(-6).toUpperCase()}</span></td>
          <td><div class="table-couple">${d.groomName||'—'} & ${d.brideName||'—'}</div></td>
          <td><span class="table-template">${d.template||'—'}</span></td>
          <td><span class="table-amount">₹${(d.amountPaid||0).toLocaleString('en-IN')}</span></td>
          <td><span class="status-badge ${statusCls[d.status]||'st-pending'}">${statusLbl[d.status]||'⏳ Pending'}</span></td>
          <td><span class="table-date">${date}</span></td>
        </tr>`;
    }).join('');

  } catch(e) {
    console.error('Recent bookings error:', e);
  }
}

// ── RECENT USERS ───────────────────────────────────────────────────
async function loadRecentUsers() {
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt','desc').limit(4).get();

    const container = document.getElementById('recentUsersGrid');
    if (!container) return;

    if (snap.empty) {
      container.innerHTML = '<div style="color:#8890b5;font-size:0.85rem;text-align:center;padding:1rem;">Abhi koi user registered nahi</div>';
      return;
    }

    container.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const initial = (d.displayName||d.email||'U').charAt(0).toUpperCase();
      const name    = d.displayName || d.email?.split('@')[0] || 'User';
      const date    = d.createdAt?.toDate?.()?.toLocaleDateString('en-IN',{day:'numeric',month:'short'}) || '—';
      return `
        <div class="user-chip">
          <div class="user-chip-avatar">${d.photoURL
            ? `<img src="${d.photoURL}" alt="${initial}"/>`
            : initial}</div>
          <div class="user-chip-info">
            <div class="user-chip-name">${name}</div>
            <div class="user-chip-date">${date}</div>
          </div>
          <span class="user-chip-badge">New</span>
        </div>`;
    }).join('');

  } catch(e) { console.error('Users error:', e); }
}

// ── RECENT ACTIVITY ────────────────────────────────────────────────
async function loadRecentActivity() {
  try {
    const [bSnap, rSnap] = await Promise.all([
      db.collection('bookings').orderBy('createdAt','desc').limit(3).get(),
      db.collection('reviews').where('approved','==',false).orderBy('createdAt','desc').limit(3).get()
    ]);

    const items = [];

    bSnap.docs.forEach(doc => {
      const d = doc.data();
      const t = d.createdAt?.toDate?.();
      items.push({ type:'booking', text:`${d.groomName||'Someone'} ne ${d.template||'card'} book kiya`, time:t, icon:'📦', id:doc.id });
    });

    rSnap.docs.forEach(doc => {
      const d = doc.data();
      const t = d.createdAt?.toDate?.();
      items.push({ type:'review', text:`${d.name||'User'} ka review pending hai (${d.rating}⭐)`, time:t, icon:'⭐', id:doc.id });
    });

    items.sort((a,b) => (b.time||0) - (a.time||0));

    const feed = document.getElementById('activityFeed');
    if (!feed) return;

    if (items.length === 0) {
      feed.innerHTML = '<div style="color:#8890b5;font-size:0.85rem;text-align:center;padding:1.5rem;">Koi activity nahi hai abhi</div>';
      return;
    }

    feed.innerHTML = items.slice(0,6).map(item => {
      const timeStr = item.time
        ? item.time.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})
        : '';
      return `
        <div class="activity-item">
          <div class="activity-icon">${item.icon}</div>
          <div class="activity-text">${item.text}</div>
          <div class="activity-time">${timeStr}</div>
        </div>`;
    }).join('');

  } catch(e) { console.error('Activity error:', e); }
}

// ── CHARTS ─────────────────────────────────────────────────────────
function drawBookingChart(bookings) {
  const canvas = document.getElementById('bookingChart');
  if (!canvas || !window.Chart) return;

  const days = [];
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    days.push(d.toLocaleDateString('en-IN',{weekday:'short'}));
    counts.push(bookings.filter(b => {
      const t = b.createdAt?.toDate?.();
      return t && t >= d && t < next;
    }).length);
  }

  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        label: 'Bookings',
        data: counts,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#2563eb',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ display:false } },
      scales: {
        y: { beginAtZero:true, ticks:{stepSize:1,color:'#8890b5'}, grid:{color:'rgba(0,0,0,0.05)'} },
        x: { ticks:{color:'#8890b5'}, grid:{display:false} }
      }
    }
  });
}

function drawTemplateChart(bookings) {
  const canvas = document.getElementById('templateChart');
  if (!canvas || !window.Chart) return;

  const templateMap = {};
  bookings.forEach(b => {
    const t = b.template||'Unknown';
    templateMap[t] = (templateMap[t]||0) + 1;
  });

  const labels = Object.keys(templateMap);
  const data   = Object.values(templateMap);
  const colors = ['#2563eb','#7c3aed','#0891b2','#16a34a','#d97706','#dc2626'];

  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0, hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position:'bottom', labels:{ color:'#4b5280', font:{size:11}, padding:12 } }
      },
      cutout: '65%'
    }
  });
}

// ── SIDEBAR TOGGLE ─────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('adminSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── QUICK ACTIONS ──────────────────────────────────────────────────
function goTo(page) { window.location.href = page; }

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ║         (+ Shared sidebar/topbar for ALL admin pages)       ║
// ╚══════════════════════════════════════════════════════════════╝

// ── ADMIN NAV PAGES (sidebar mein sab pages) ──────────────────────
const ADMIN_PAGES = [
  { id:'dashboard',  icon:'📊', label:'Dashboard',      href:'admin-dashboard.html'  },
  { id:'bookings',   icon:'📦', label:'Bookings',       href:'admin-bookings.html',  badge:'bookingsPending' },
  { id:'orders',     icon:'📋', label:'Orders',         href:'admin-orders.html'     },
  { id:'templates',  icon:'🎨', label:'Templates',      href:'admin-templates.html'  },
  { id:'reviews',    icon:'⭐', label:'Reviews',        href:'admin-reviews.html',   badge:'reviewsPending'  },
  { id:'coupons',    icon:'🎟️', label:'Coupons',        href:'admin-coupons.html'    },
  { id:'users',      icon:'👥', label:'Users',          href:'admin-users.html'      },
  { id:'referrals',  icon:'🎁', label:'Referrals',      href:'admin-referrals.html', badge:'withdrawalsPending' },
  { id:'settings',   icon:'⚙️', label:'Settings',       href:'admin-settings.html'   },
  { id:'whatsapp',   icon:'💬', label:'WhatsApp',       href:'admin-whatsapp.html'   },
];

// Sidebar badges (pending counts) — globally updated
const sidebarBadges = {
  bookingsPending:    0,
  reviewsPending:     0,
  withdrawalsPending: 0,
};

// ── RENDER SHARED SIDEBAR ─────────────────────────────────────────
function renderAdminSidebar(activePage) {
  const sidebar = document.getElementById('adminSidebar');
  if (!sidebar) return;

  const session = JSON.parse(localStorage.getItem('adminSession') || '{}');

  sidebar.innerHTML = `
    <!-- Logo -->
    <div class="sb-brand">
      <div class="sb-logo">🛡️</div>
      <div class="sb-brand-text">
        <div class="sb-name">AKANS Admin</div>
        <div class="sb-role">Web Dev Services</div>
      </div>
    </div>

    <!-- Nav Links -->
    <nav class="sb-nav">
      ${ADMIN_PAGES.map(p => `
        <a href="${p.href}" class="sb-link ${p.id === activePage ? 'active' : ''}" id="sbLink-${p.id}">
          <span class="sb-icon">${p.icon}</span>
          <span class="sb-label">${p.label}</span>
          ${p.badge ? `<span class="sb-badge" id="badge-${p.badge}" style="display:none;">0</span>` : ''}
        </a>
      `).join('')}
    </nav>

    <!-- Logout -->
    <div class="sb-footer">
      <div class="sb-admin-info">
        <div class="sb-admin-avatar">${(session.email || 'A').charAt(0).toUpperCase()}</div>
        <div class="sb-admin-detail">
          <div class="sb-admin-name">${session.displayName || 'Admin'}</div>
          <div class="sb-admin-email">${session.email || ''}</div>
        </div>
      </div>
      <button class="sb-logout" onclick="adminLogout()">🚪 Logout</button>
    </div>
  `;

  // Load pending counts for badges
  loadSidebarBadges();
}

// ── RENDER TOP BAR ────────────────────────────────────────────────
function renderAdminTopbar(pageTitle) {
  const topbar = document.getElementById('adminTopbar');
  if (!topbar) return;

  topbar.innerHTML = `
    <button class="topbar-hamburger" onclick="toggleSidebar()">☰</button>
    <div class="topbar-title">${pageTitle}</div>
    <div class="topbar-right">
      <div class="topbar-time" id="topbarTime"></div>
      <a href="../index.html" target="_blank" class="topbar-site-btn">🌐 View Site</a>
    </div>
  `;

  // Live clock
  function updateClock() {
    const el = document.getElementById('topbarTime');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  }
  updateClock();
  setInterval(updateClock, 60000);
}

// ── SIDEBAR TOGGLE (mobile) ───────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('show');
}

// ── LOAD SIDEBAR BADGES (pending counts) ─────────────────────────
async function loadSidebarBadges() {
  try {
    // Pending bookings
    const bSnap = await db.collection('bookings').where('status','==','pending').get();
    sidebarBadges.bookingsPending = bSnap.size;

    // Pending reviews
    const rSnap = await db.collection('reviews').where('approved','==',false).get();
    sidebarBadges.reviewsPending = rSnap.size;

    // Pending withdrawals (future)
    sidebarBadges.withdrawalsPending = 0;

    // Update DOM badges
    Object.entries(sidebarBadges).forEach(([key, val]) => {
      const el = document.getElementById('badge-' + key);
      if (!el) return;
      el.textContent = val;
      el.style.display = val > 0 ? 'flex' : 'none';
    });
  } catch(e) { console.warn('Badge load error:', e); }
}

// ── DASHBOARD INIT ────────────────────────────────────────────────
async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  renderAdminSidebar('dashboard');
  renderAdminTopbar('📊 Dashboard');

  // Load all stats in parallel
  await Promise.all([
    loadDashboardStats(),
    loadRecentBookings(),
    loadRecentUsers(),
    loadRevenueChart(),
  ]);
}

// ── DASHBOARD STATS ───────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    // Run all queries in parallel
    const [bookSnap, usersSnap, reviewSnap, ordersSnap] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved','==',false).get(),
      db.collection('orders').where('status','==','active').get(),
    ]);

    const allBookings  = bookSnap.docs.map(d => d.data());
    const pending      = allBookings.filter(b => b.status === 'pending').length;
    const totalRevenue = allBookings.reduce((s, b) => s + (b.amountPaid || 0), 0);

    // Today's bookings
    const today    = new Date(); today.setHours(0,0,0,0);
    const todayBk  = allBookings.filter(b => {
      if (!b.createdAt) return false;
      const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return d >= today;
    }).length;

    // Update stat cards
    setStatCard('statTotalBookings', allBookings.length, todayBk > 0 ? `+${todayBk} aaj` : 'Sab bookings');
    setStatCard('statRevenue',       '₹' + totalRevenue.toLocaleString('en-IN'), 'Total collected');
    setStatCard('statPending',       pending, pending > 0 ? `${pending} process baaki` : 'Sab clear!');
    setStatCard('statPendingReviews',reviewSnap.size, 'Approve karne hain');
    setStatCard('statUsers',         usersSnap.size, 'Registered users');
    setStatCard('statActiveOrders',  ordersSnap.size, 'Active orders');

  } catch(e) {
    console.error('Dashboard stats error:', e);
    showAdminToast('⚠️ Stats load nahi hue: ' + e.message, 'warning');
  }
}

function setStatCard(id, value, sub) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.stat-value').textContent = value;
  el.querySelector('.stat-sub').textContent   = sub;
  el.classList.add('loaded');
}

// ── RECENT BOOKINGS ───────────────────────────────────────────────
async function loadRecentBookings() {
  const tbody = document.getElementById('recentBookingsTbody');
  if (!tbody) return;
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(6).get();

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">📭 Koi booking nahi abhi tak</td></tr>`;
      return;
    }

    tbody.innerHTML = snap.docs.map(doc => {
      const b = doc.data();
      const statusBadge = {
        pending:     '<span class="rbadge pending">⏳ Pending</span>',
        in_progress: '<span class="rbadge inprog">🔧 In Progress</span>',
        completed:   '<span class="rbadge done">✅ Done</span>',
        cancelled:   '<span class="rbadge cancel">❌ Cancelled</span>',
      }[b.status] || '<span class="rbadge pending">⏳ Pending</span>';

      const date = b.createdAt
        ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt))
            .toLocaleDateString('en-IN', { day:'numeric', month:'short' })
        : '—';

      return `<tr onclick="window.location='admin-bookings.html?id=${doc.id}'" style="cursor:pointer;">
        <td class="td-couple">
          <div class="couple-name">${b.groomName || '—'} & ${b.brideName || '—'}</div>
          <div class="couple-template">${b.template || '—'}</div>
        </td>
        <td class="td-amount">₹${(b.amountPaid || 0).toLocaleString('en-IN')}</td>
        <td>${statusBadge}</td>
        <td class="td-date">${date}</td>
        <td>
          <a href="https://wa.me/91${b.whatsapp || ''}" target="_blank" class="wa-btn" onclick="event.stopPropagation()">💬</a>
        </td>
      </tr>`;
    }).join('');

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">⚠️ Load error</td></tr>`;
    console.error(e);
  }
}

// ── RECENT USERS ──────────────────────────────────────────────────
async function loadRecentUsers() {
  const list = document.getElementById('recentUsersList');
  if (!list) return;
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt','desc').limit(5).get();

    if (snap.empty) {
      list.innerHTML = `<div class="empty-row">👤 Koi user nahi abhi tak</div>`;
      return;
    }

    list.innerHTML = snap.docs.map(doc => {
      const u = doc.data();
      const initials = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
      const date = u.createdAt
        ? (u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt))
            .toLocaleDateString('en-IN', { day:'numeric', month:'short' })
        : '—';
      return `
        <div class="user-row">
          <div class="user-avatar" ${u.photoURL ? `style="background:url('${u.photoURL}') center/cover"` : ''}>${u.photoURL ? '' : initials}</div>
          <div class="user-info">
            <div class="user-name">${u.displayName || u.email?.split('@')[0] || 'User'}</div>
            <div class="user-email">${u.email || '—'}</div>
          </div>
          <div class="user-date">${date}</div>
        </div>`;
    }).join('');

  } catch(e) {
    list.innerHTML = `<div class="empty-row">⚠️ Load error</div>`;
    console.error(e);
  }
}

// ── REVENUE CHART (last 7 days) ───────────────────────────────────
async function loadRevenueChart() {
  const chartWrap = document.getElementById('revenueChart');
  if (!chartWrap) return;
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(50).get();

    // Group by day (last 7 days)
    const days = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
      days[key] = 0;
    }

    snap.docs.forEach(doc => {
      const b = doc.data();
      if (!b.createdAt || !b.amountPaid) return;
      const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      const key = d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
      if (days[key] !== undefined) days[key] += b.amountPaid;
    });

    const maxVal = Math.max(...Object.values(days), 1);
    chartWrap.innerHTML = Object.entries(days).map(([label, val]) => {
      const pct = Math.round((val / maxVal) * 100);
      return `
        <div class="chart-col">
          <div class="chart-bar-wrap">
            <div class="chart-val">₹${val > 0 ? val.toLocaleString('en-IN') : '0'}</div>
            <div class="chart-bar" style="height:${Math.max(pct, 2)}%"></div>
          </div>
          <div class="chart-label">${label}</div>
        </div>`;
    }).join('');

  } catch(e) {
    chartWrap.innerHTML = `<div style="color:#8890b5;text-align:center;padding:2rem;">⚠️ Chart load error</div>`;
    console.error(e);
  }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 3, 4, 5... aage ke pages ka JS yahan add hoga    ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── DASHBOARD INIT ────────────────────────────────────────────────
async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  // Admin name set karo
  const nameEl = document.getElementById('adminName');
  const avatarEl = document.getElementById('adminAvatar');
  if (nameEl) nameEl.textContent = session.displayName || 'Admin';
  if (avatarEl) avatarEl.textContent = (session.displayName || 'A').charAt(0).toUpperCase();

  // Live clock
  updateClock();
  setInterval(updateClock, 1000);

  // Sab stats load karo
  await Promise.all([
    loadDashboardStats(),
    loadRecentBookings(),
    loadRecentUsers(),
    loadChartData()
  ]);
}

// ── LIVE CLOCK ────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString('en-IN', {
    weekday:'short', day:'numeric', month:'short',
    hour:'2-digit', minute:'2-digit'
  });
}

// ── LOAD STATS ────────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    // Parallel mein sab fetch karo
    const [bookingsSnap, usersSnap, reviewsSnap, ordersSnap, referralsSnap] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved','==',false).get(),
      db.collection('orders').where('status','==','active').get(),
      db.collection('referrals').get()
    ]);

    const bookings = bookingsSnap.docs.map(d => d.data());

    // Calculate stats
    const totalBookings  = bookings.length;
    const pendingBookings= bookings.filter(b => b.status === 'pending').length;
    const totalRevenue   = bookings.filter(b => b.status !== 'cancelled')
                                   .reduce((sum,b) => sum + (b.amountPaid || 0), 0);
    const todayBookings  = bookings.filter(b => {
      if (!b.createdAt) return false;
      const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return d.toDateString() === new Date().toDateString();
    }).length;

    // Pending withdrawals
    let pendingWithdrawals = 0;
    referralsSnap.docs.forEach(d => {
      if((d.data().pendingWithdrawal || 0) > 0) pendingWithdrawals++;
    });

    // Update DOM
    setStatCard('statTotalBookings', totalBookings, todayBookings > 0 ? `+${todayBookings} aaj` : '');
    setStatCard('statRevenue',       '₹' + totalRevenue.toLocaleString('en-IN'), 'Total collected');
    setStatCard('statPending',       pendingBookings,  'Process karne hain', pendingBookings > 0 ? 'warn' : '');
    setStatCard('statReviews',       reviewsSnap.size,  'Approve karne hain', reviewsSnap.size > 0 ? 'warn' : '');
    setStatCard('statUsers',         usersSnap.size,    'Registered users');
    setStatCard('statActiveOrders',  ordersSnap.size,   'Active cards');
    setStatCard('statWithdrawals',   pendingWithdrawals,'Pending requests', pendingWithdrawals > 0 ? 'warn' : '');

  } catch(e) {
    console.error('Stats load error:', e);
    showAdminToast('⚠️ Stats load nahi hue: ' + e.message, 'warning');
  }
}

function setStatCard(id, value, sub, type='') {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.stat-val').textContent  = value;
  if (sub) el.querySelector('.stat-sub').textContent = sub;
  if (type === 'warn') el.classList.add('warn');
}

// ── RECENT BOOKINGS ───────────────────────────────────────────────
async function loadRecentBookings() {
  const list = document.getElementById('recentBookingsList');
  if (!list) return;
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(6).get();

    if (snap.empty) {
      list.innerHTML = `<div class="empty-row">📭 Koi booking nahi abhi tak</div>`;
      return;
    }

    list.innerHTML = snap.docs.map(doc => {
      const b   = doc.data();
      const id  = doc.id.slice(-6).toUpperCase();
      const date = b.createdAt?.toDate
        ? b.createdAt.toDate().toLocaleDateString('en-IN',{day:'numeric',month:'short'})
        : '—';
      const statusClass = b.status === 'pending' ? 'badge-warn' :
                          b.status === 'completed' ? 'badge-ok' : 'badge-grey';
      return `
        <div class="table-row" onclick="window.location='admin-bookings.html?id=${doc.id}'">
          <span class="row-id">#${id}</span>
          <span class="row-main">${b.groomName || '—'} & ${b.brideName || '—'}</span>
          <span class="row-sub">${b.template || '—'}</span>
          <span class="row-amount">₹${b.amountPaid || 0}</span>
          <span class="badge ${statusClass}">${b.status || 'pending'}</span>
          <span class="row-date">${date}</span>
        </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<div class="empty-row">⚠️ Load failed: ${e.message}</div>`;
  }
}

// ── RECENT USERS ──────────────────────────────────────────────────
async function loadRecentUsers() {
  const list = document.getElementById('recentUsersList');
  if (!list) return;
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt','desc').limit(5).get();

    if (snap.empty) {
      list.innerHTML = `<div class="empty-row">📭 Koi user nahi abhi tak</div>`;
      return;
    }

    list.innerHTML = snap.docs.map(doc => {
      const u    = doc.data();
      const init = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
      const date = u.createdAt?.toDate
        ? u.createdAt.toDate().toLocaleDateString('en-IN',{day:'numeric',month:'short'})
        : '—';
      return `
        <div class="user-row" onclick="window.location='admin-users.html?id=${doc.id}'">
          <div class="user-avatar">${init}</div>
          <div class="user-info">
            <div class="user-name">${u.displayName || 'User'}</div>
            <div class="user-email">${u.email || '—'}</div>
          </div>
          <div class="user-date">${date}</div>
        </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<div class="empty-row">⚠️ Load failed</div>`;
  }
}

// ── CHART DATA ────────────────────────────────────────────────────
async function loadChartData() {
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(50).get();

    const bookings = snap.docs.map(d => d.data());

    // Last 7 days revenue chart
    const days = [];
    const revenues = [];
    for(let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-IN',{weekday:'short'});
      const dayRev = bookings.filter(b => {
        if(!b.createdAt) return false;
        const bd = b.createdAt.toDate ? b.createdAt.toDate() : new Date();
        return bd.toDateString() === d.toDateString();
      }).reduce((sum,b) => sum + (b.amountPaid||0), 0);
      days.push(label);
      revenues.push(dayRev);
    }
    drawRevenueChart(days, revenues);

    // Template distribution
    const templateCount = {};
    bookings.forEach(b => {
      const t = b.template || 'Unknown';
      templateCount[t] = (templateCount[t] || 0) + 1;
    });
    drawTemplateChart(Object.keys(templateCount), Object.values(templateCount));

  } catch(e) {
    console.warn('Chart data error:', e);
  }
}

// ── CHARTS (Chart.js) ─────────────────────────────────────────────
function drawRevenueChart(labels, data) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx || !window.Chart) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (₹)',
        data,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.08)',
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#2563eb',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero:true, grid:{color:'rgba(0,0,0,0.04)'},
             ticks:{callback: v => '₹'+v} },
        x: { grid:{display:false} }
      }
    }
  });
}

function drawTemplateChart(labels, data) {
  const ctx = document.getElementById('templateChart');
  if (!ctx || !window.Chart) return;
  const colors = ['#2563eb','#7c3aed','#16a34a','#f59e0b','#ef4444','#0891b2'];
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0,data.length),
                   borderWidth:2, borderColor:'#fff' }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend:{ position:'bottom', labels:{font:{size:11},padding:12} }
      },
      cutout: '65%'
    }
  });
}

// ── SIDEBAR TOGGLE ────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('adminSidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('adminSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ── AUTO REFRESH ───────────────────────────────────────────────────
// Har 2 minute mein stats refresh karo
setInterval(() => {
  if (document.getElementById('statTotalBookings')) loadDashboardStats();
}, 120000);

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── SIDEBAR TOGGLE (mobile) ────────────────────────────────────────
function toggleSidebar() {
  const sidebar  = document.getElementById('adminSidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const isOpen   = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('show', !isOpen);
}

function closeSidebar() {
  document.getElementById('adminSidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}

// ── INIT DASHBOARD ────────────────────────────────────────────────
async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  // Admin name set
  const nameEl = document.getElementById('adminName');
  const avatarEl = document.getElementById('adminAvatar');
  if (nameEl)   nameEl.textContent  = session.displayName || 'Admin';
  if (avatarEl) avatarEl.textContent = (session.displayName || 'A').charAt(0).toUpperCase();

  // Greeting
  const greetEl = document.getElementById('dashGreeting');
  if (greetEl) {
    const h = new Date().getHours();
    const g = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
    greetEl.textContent = `${g}, Admin 👋`;
  }

  // Load all stats parallel
  await Promise.allSettled([
    loadBookingStats(),
    loadUserStats(),
    loadReviewStats(),
    loadRevenueStats(),
    loadRecentBookings(),
    loadRecentUsers(),
  ]);
}

// ── BOOKING STATS ─────────────────────────────────────────────────
async function loadBookingStats() {
  try {
    const allSnap     = await db.collection('bookings').get();
    const pendingSnap = await db.collection('bookings').where('status','==','pending').get();
    const inProgSnap  = await db.collection('bookings').where('status','==','in_progress').get();
    const doneSnap    = await db.collection('bookings').where('status','==','completed').get();

    setStatCard('statTotalBookings', allSnap.size);
    setStatCard('statPendingBookings', pendingSnap.size);
    setStatCard('statInProgress', inProgSnap.size);
    setStatCard('statCompleted', doneSnap.size);
  } catch(e) { console.warn('Booking stats error:', e.message); }
}

// ── USER STATS ────────────────────────────────────────────────────
async function loadUserStats() {
  try {
    const snap = await db.collection('users').get();
    setStatCard('statTotalUsers', snap.size);
    // Today's users
    const today = new Date(); today.setHours(0,0,0,0);
    const todaySnap = await db.collection('users')
      .where('createdAt','>=', firebase.firestore.Timestamp.fromDate(today))
      .get();
    setStatCard('statTodayUsers', todaySnap.size);
  } catch(e) { console.warn('User stats error:', e.message); }
}

// ── REVIEW STATS ──────────────────────────────────────────────────
async function loadReviewStats() {
  try {
    const pendingSnap = await db.collection('reviews').where('approved','==',false).get();
    setStatCard('statPendingReviews', pendingSnap.size);
  } catch(e) { console.warn('Review stats error:', e.message); }
}

// ── REVENUE STATS ─────────────────────────────────────────────────
async function loadRevenueStats() {
  try {
    const snap = await db.collection('bookings').get();
    let total = 0, todayRev = 0;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    snap.forEach(doc => {
      const d = doc.data();
      const amt = d.amountPaid || 0;
      total += amt;
      if (d.createdAt && d.createdAt.toDate() >= todayStart) todayRev += amt;
    });

    setStatCard('statRevenue',      '₹' + total.toLocaleString('en-IN'));
    setStatCard('statTodayRevenue', '₹' + todayRev.toLocaleString('en-IN'));

    // Pending withdrawals
    const refSnap = await db.collection('referrals').get();
    let pendingWd = 0;
    refSnap.forEach(doc => { pendingWd += doc.data().totalPending || 0; });
    setStatCard('statPendingWd', '₹' + pendingWd.toLocaleString('en-IN'));
  } catch(e) { console.warn('Revenue stats error:', e.message); }
}

// ── RECENT BOOKINGS ───────────────────────────────────────────────
async function loadRecentBookings() {
  const el = document.getElementById('recentBookingsList');
  if (!el) return;
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(5).get();

    if (snap.empty) {
      el.innerHTML = '<div class="no-data">📭 Abhi koi booking nahi hai</div>';
      return;
    }

    el.innerHTML = snap.docs.map(doc => {
      const d   = doc.data();
      const id  = doc.id.slice(-6).toUpperCase();
      const dt  = d.createdAt ? d.createdAt.toDate().toLocaleDateString('en-IN') : '—';
      const st  = d.status || 'pending';
      const stMap = {
        pending:     {cls:'badge-warn',  lbl:'Pending'},
        in_progress: {cls:'badge-info',  lbl:'In Progress'},
        completed:   {cls:'badge-ok',    lbl:'Completed'},
        cancelled:   {cls:'badge-err',   lbl:'Cancelled'}
      };
      const badge = stMap[st] || stMap.pending;
      return `
        <div class="list-row">
          <div class="lr-icon">💍</div>
          <div class="lr-info">
            <div class="lr-title">${d.groomName || '—'} & ${d.brideName || '—'}</div>
            <div class="lr-sub">#AK${id} · ${d.template || '—'} · ${dt}</div>
          </div>
          <div class="lr-right">
            <span class="badge ${badge.cls}">${badge.lbl}</span>
            <div class="lr-amt">₹${(d.amountPaid||0).toLocaleString('en-IN')}</div>
          </div>
          <a href="admin-bookings.html?id=${doc.id}" class="lr-action-btn">View →</a>
        </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="no-data">⚠️ Load karne mein error</div>';
    console.warn('Recent bookings error:', e.message);
  }
}

// ── RECENT USERS ──────────────────────────────────────────────────
async function loadRecentUsers() {
  const el = document.getElementById('recentUsersList');
  if (!el) return;
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt','desc').limit(5).get();

    if (snap.empty) {
      el.innerHTML = '<div class="no-data">📭 Koi user registered nahi</div>';
      return;
    }

    el.innerHTML = snap.docs.map(doc => {
      const d  = doc.data();
      const dt = d.createdAt ? d.createdAt.toDate().toLocaleDateString('en-IN') : '—';
      const av = (d.displayName || d.email || 'U').charAt(0).toUpperCase();
      return `
        <div class="list-row">
          <div class="lr-avatar">${av}</div>
          <div class="lr-info">
            <div class="lr-title">${d.displayName || d.email?.split('@')[0] || 'User'}</div>
            <div class="lr-sub">${d.email || '—'} · ${dt}</div>
          </div>
          <div class="lr-right">
            ${d.whatsapp ? `<div class="lr-sub">📱 ${d.whatsapp}</div>` : ''}
          </div>
          <a href="admin-users.html?id=${doc.id}" class="lr-action-btn">View →</a>
        </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="no-data">⚠️ Load karne mein error</div>';
    console.warn('Recent users error:', e.message);
  }
}

// ── STAT CARD HELPER ──────────────────────────────────────────────
function setStatCard(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.classList.add('loaded');
}

// ── SHARED ADMIN SIDEBAR ACTIVE LINK ─────────────────────────────
function setActiveSidebarLink() {
  const page = window.location.pathname.split('/').pop() || 'admin-dashboard.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && page.includes(href.replace('.html',''))) {
      link.classList.add('active');
    }
  });
}


// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── DASHBOARD INIT ────────────────────────────────────────────────
function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  // Admin name show karo
  const nameEl = document.getElementById('adminName');
  const emailEl = document.getElementById('adminEmail');
  if (nameEl) nameEl.textContent = session.displayName || 'Admin';
  if (emailEl) emailEl.textContent = session.email || '';

  // Sab data load karo
  loadDashboardStats();
  loadRecentBookings();
  loadRecentUsers();
  loadPendingReviews();
  loadRevenueChart();
  startRealtimeListeners();
}

// ── LOAD ALL STATS ─────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parallel queries
    const [bookingsSnap, usersSnap, reviewsSnap, referralsSnap] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved', '==', false).get(),
      db.collection('referrals').get()
    ]);

    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Calculate stats
    const totalBookings   = bookings.length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const completedOrders = bookings.filter(b => b.status === 'completed').length;
    const totalRevenue    = bookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
    const todayBookings   = bookings.filter(b => {
      if (!b.createdAt) return false;
      const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return d >= today;
    }).length;
    const totalUsers      = usersSnap.size;
    const pendingReviews  = reviewsSnap.size;

    // Pending withdrawals
    let pendingWithdrawals = 0;
    referralsSnap.docs.forEach(d => {
      if ((d.data().pendingWithdrawal || 0) > 0) pendingWithdrawals++;
    });

    // Update UI
    setStatCard('statTotalBookings',   totalBookings);
    setStatCard('statRevenue',         '₹' + totalRevenue.toLocaleString('en-IN'));
    setStatCard('statPending',         pendingBookings);
    setStatCard('statCompleted',       completedOrders);
    setStatCard('statUsers',           totalUsers);
    setStatCard('statPendingReviews',  pendingReviews);
    setStatCard('statWithdrawals',     pendingWithdrawals);
    setStatCard('statToday',           todayBookings);

    // Badges
    if (pendingBookings > 0)  setBadge('navBadgeBookings', pendingBookings);
    if (pendingReviews > 0)   setBadge('navBadgeReviews', pendingReviews);
    if (pendingWithdrawals > 0) setBadge('navBadgeReferrals', pendingWithdrawals);

  } catch (e) {
    console.error('[Dashboard] Stats error:', e);
    showAdminToast('⚠️ Stats load nahi hue: ' + e.message, 'warning');
  }
}

// ── LOAD RECENT BOOKINGS (last 5) ─────────────────────────────────
async function loadRecentBookings() {
  const container = document.getElementById('recentBookings');
  if (!container) return;

  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (snap.empty) {
      container.innerHTML = emptyState('📦', 'Abhi koi booking nahi', 'Pehli booking aane par yahan dikhega');
      return;
    }

    container.innerHTML = snap.docs.map(doc => {
      const b   = doc.data();
      const id  = doc.id;
      const dt  = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
      const ago = timeAgo(dt);
      const statusColors = {
        pending:    { bg:'#fef9c3', color:'#92400e', dot:'#f59e0b' },
        'in-progress':{ bg:'#dbeafe', color:'#1e40af', dot:'#3b82f6' },
        completed:  { bg:'#dcfce7', color:'#166534', dot:'#22c55e' },
        cancelled:  { bg:'#fee2e2', color:'#991b1b', dot:'#ef4444' }
      };
      const sc = statusColors[b.status] || statusColors.pending;

      return `
      <div class="recent-row" onclick="window.location.href='admin-bookings.html?id=${id}'" style="cursor:pointer;">
        <div class="rr-avatar">${(b.groomName || 'N')[0]}${(b.brideName || 'A')[0]}</div>
        <div class="rr-info">
          <div class="rr-name">${b.groomName || '—'} &amp; ${b.brideName || '—'}</div>
          <div class="rr-sub">${b.template || 'Template'} · ${ago}</div>
        </div>
        <div class="rr-right">
          <div class="rr-amount">₹${(b.amountPaid || 0).toLocaleString('en-IN')}</div>
          <div class="rr-status" style="background:${sc.bg};color:${sc.color};">
            <span style="width:6px;height:6px;border-radius:50%;background:${sc.dot};display:inline-block;flex-shrink:0;"></span>
            ${capitalize(b.status || 'pending')}
          </div>
        </div>
      </div>`;
    }).join('');

  } catch (e) {
    console.error('[Dashboard] Recent bookings error:', e);
    container.innerHTML = errorState('Bookings load nahi hue');
  }
}

// ── LOAD RECENT USERS (last 5) ────────────────────────────────────
async function loadRecentUsers() {
  const container = document.getElementById('recentUsers');
  if (!container) return;

  try {
    const snap = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (snap.empty) {
      container.innerHTML = emptyState('👥', 'Abhi koi user nahi', 'Pehle signup par yahan dikhega');
      return;
    }

    container.innerHTML = snap.docs.map(doc => {
      const u   = doc.data();
      const dt  = u.createdAt?.toDate ? u.createdAt.toDate() : new Date();
      const ago = timeAgo(dt);
      const initials = (u.displayName || u.email || 'U').charAt(0).toUpperCase();

      return `
      <div class="recent-row">
        <div class="rr-avatar" style="background:linear-gradient(135deg,#7c3aed,#2563eb);">
          ${u.photoURL
            ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
            : initials}
        </div>
        <div class="rr-info">
          <div class="rr-name">${u.displayName || 'User'}</div>
          <div class="rr-sub">${u.email || '—'} · ${ago}</div>
        </div>
        <div class="rr-right">
          ${u.whatsapp ? `<div class="rr-wa">📱 ${u.whatsapp}</div>` : ''}
          ${u.referredBy ? `<div class="rr-ref">🎁 ${u.referredBy}</div>` : ''}
        </div>
      </div>`;
    }).join('');

  } catch (e) {
    console.error('[Dashboard] Users error:', e);
    container.innerHTML = errorState('Users load nahi hue');
  }
}

// ── LOAD PENDING REVIEWS ───────────────────────────────────────────
async function loadPendingReviews() {
  const container = document.getElementById('pendingReviewsList');
  if (!container) return;

  try {
    const snap = await db.collection('reviews')
      .where('approved', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(4)
      .get();

    if (snap.empty) {
      container.innerHTML = emptyState('⭐', 'Koi pending review nahi', 'Sab reviews approve ho gaye!');
      return;
    }

    container.innerHTML = snap.docs.map(doc => {
      const r   = doc.data();
      const id  = doc.id;
      const stars = '⭐'.repeat(r.rating || 5);

      return `
      <div class="review-pending-row">
        <div class="rpr-header">
          <div class="rr-avatar" style="width:34px;height:34px;font-size:0.75rem;background:linear-gradient(135deg,#f59e0b,#ef4444);">${r.avatar || 'U'}</div>
          <div>
            <div style="font-size:0.85rem;font-weight:700;color:var(--ad-text);">${r.name || 'User'}</div>
            <div style="font-size:0.7rem;color:var(--ad-text3);">${r.template || ''} · ${stars}</div>
          </div>
          <div class="rpr-actions" style="margin-left:auto;display:flex;gap:0.4rem;">
            <button onclick="quickApproveReview('${id}')" class="quick-approve">✅ Approve</button>
            <button onclick="quickRejectReview('${id}')" class="quick-reject">❌ Reject</button>
          </div>
        </div>
        <div class="rpr-text">"${(r.text || '').slice(0, 100)}${r.text?.length > 100 ? '...' : ''}"</div>
      </div>`;
    }).join('');

  } catch (e) {
    console.error('[Dashboard] Reviews error:', e);
    container.innerHTML = errorState('Reviews load nahi hue');
  }
}

// ── QUICK APPROVE/REJECT REVIEW ───────────────────────────────────
async function quickApproveReview(id) {
  try {
    await db.collection('reviews').doc(id).update({ approved: true });
    showAdminToast('✅ Review approved!', 'success');
    loadPendingReviews();
    loadDashboardStats();
  } catch (e) { showAdminToast('❌ Error: ' + e.message, 'error'); }
}

async function quickRejectReview(id) {
  if (!confirm('Is review ko delete karna chahte hain?')) return;
  try {
    await db.collection('reviews').doc(id).delete();
    showAdminToast('🗑️ Review deleted', 'info');
    loadPendingReviews();
    loadDashboardStats();
  } catch (e) { showAdminToast('❌ Error: ' + e.message, 'error'); }
}

// ── REVENUE CHART (last 7 days) ───────────────────────────────────
async function loadRevenueChart() {
  const container = document.getElementById('revenueChart');
  if (!container) return;

  try {
    const days   = 7;
    const labels = [];
    const data   = new Array(days).fill(0);

    // Last 7 days labels
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));
    }

    // Get bookings last 7 days
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromDate.setHours(0, 0, 0, 0);

    const snap = await db.collection('bookings')
      .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(fromDate))
      .get();

    snap.docs.forEach(doc => {
      const b  = doc.data();
      const dt = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
      const daysAgo = Math.floor((new Date() - dt) / (1000 * 60 * 60 * 24));
      const idx = days - 1 - daysAgo;
      if (idx >= 0 && idx < days) data[idx] += (b.amountPaid || 0);
    });

    const maxVal = Math.max(...data, 1);

    container.innerHTML = `
      <div class="chart-wrap">
        ${data.map((val, i) => `
          <div class="chart-col">
            <div class="chart-val">${val > 0 ? '₹' + (val/1000).toFixed(1) + 'k' : ''}</div>
            <div class="chart-bar-wrap">
              <div class="chart-bar" style="height:${Math.max((val/maxVal)*100, 2)}%;"
                   title="${labels[i]}: ₹${val.toLocaleString('en-IN')}"></div>
            </div>
            <div class="chart-label">${labels[i].split(' ')[0]}</div>
          </div>`).join('')}
      </div>`;

  } catch (e) {
    console.error('[Dashboard] Chart error:', e);
    if (container) container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--ad-text3);font-size:0.85rem;">📊 Chart load nahi hua</div>`;
  }
}

// ── REALTIME LISTENERS ────────────────────────────────────────────
function startRealtimeListeners() {
  // New booking aaye toh badge update karo
  db.collection('bookings')
    .where('status', '==', 'pending')
    .onSnapshot(snap => {
      setBadge('navBadgeBookings', snap.size);
      setStatCard('statPending', snap.size);
    });

  // Pending reviews
  db.collection('reviews')
    .where('approved', '==', false)
    .onSnapshot(snap => {
      setBadge('navBadgeReviews', snap.size);
      setStatCard('statPendingReviews', snap.size);
    });
}

// ── SIDEBAR TOGGLE (mobile) ───────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('adminSidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}

// ── HELPER FUNCTIONS ──────────────────────────────────────────────
function setStatCard(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
    el.classList.add('updated');
    setTimeout(() => el.classList.remove('updated'), 600);
  }
}

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) {
    el.textContent = count > 99 ? '99+' : count;
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

function timeAgo(date) {
  const secs = Math.floor((new Date() - date) / 1000);
  if (secs < 60)   return 'Abhi abhi';
  if (secs < 3600) return Math.floor(secs/60) + ' min pehle';
  if (secs < 86400) return Math.floor(secs/3600) + ' ghante pehle';
  return Math.floor(secs/86400) + ' din pehle';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function emptyState(icon, title, sub) {
  return `<div style="text-align:center;padding:2rem 1rem;">
    <div style="font-size:2.5rem;margin-bottom:0.5rem;opacity:0.4;">${icon}</div>
    <div style="font-size:0.9rem;font-weight:700;color:var(--ad-text);margin-bottom:0.2rem;">${title}</div>
    <div style="font-size:0.78rem;color:var(--ad-text3);">${sub}</div>
  </div>`;
}

function errorState(msg) {
  return `<div style="text-align:center;padding:1.5rem;color:#ef4444;font-size:0.82rem;">⚠️ ${msg}</div>`;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── SIDEBAR TOGGLE (sab admin pages pe kaam karega) ────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isOpen  = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('show', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

function closeSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

// Active nav link highlight
function setActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

// ── DASHBOARD INIT ─────────────────────────────────────────────────
async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  // Admin name header mein
  const nameEl = document.getElementById('adminNameHeader');
  if (nameEl) nameEl.textContent = session.displayName || 'Admin';

  setActiveNav('dashboard');

  // Parallel mein sab load karo
  await Promise.allSettled([
    loadDashboardStats(),
    loadRecentBookings(),
    loadRecentActivity()
  ]);
}

// ── LOAD ALL STATS ─────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    // Today ki date
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Parallel queries
    const [
      allBookings,
      todayBookings,
      pendingBookings,
      allUsers,
      allOrders,
      pendingReviews,
      allReferrals
    ] = await Promise.allSettled([
      db.collection('bookings').get(),
      db.collection('bookings').where('createdAt', '>=', todayStart).get(),
      db.collection('bookings').where('status', '==', 'pending').get(),
      db.collection('users').get(),
      db.collection('orders').where('status', '==', 'active').get(),
      db.collection('reviews').where('approved', '==', false).get(),
      db.collection('referrals').get()
    ]);

    // Total bookings
    const totalBookings = allBookings.value?.size || 0;
    setStatCard('statTotalBookings', totalBookings);

    // Today bookings
    const todayCount = todayBookings.value?.size || 0;
    setStatCard('statTodayBookings', todayCount);

    // Total Revenue
    let totalRevenue = 0;
    allBookings.value?.docs.forEach(doc => {
      totalRevenue += (doc.data().amountPaid || 0);
    });
    setStatCard('statRevenue', '₹' + totalRevenue.toLocaleString('en-IN'));

    // Pending bookings (needs attention)
    const pendingCount = pendingBookings.value?.size || 0;
    setStatCard('statPending', pendingCount, pendingCount > 0 ? 'alert' : '');

    // Total users
    const usersCount = allUsers.value?.size || 0;
    setStatCard('statUsers', usersCount);

    // Active orders
    const activeOrders = allOrders.value?.size || 0;
    setStatCard('statActiveOrders', activeOrders);

    // Pending reviews
    const pendingRev = pendingReviews.value?.size || 0;
    setStatCard('statPendingReviews', pendingRev, pendingRev > 0 ? 'alert' : '');

    // Today's revenue
    let todayRevenue = 0;
    todayBookings.value?.docs.forEach(doc => {
      todayRevenue += (doc.data().amountPaid || 0);
    });
    setStatCard('statTodayRevenue', '₹' + todayRevenue.toLocaleString('en-IN'));

    // Template popularity chart
    const templateCounts = {};
    allBookings.value?.docs.forEach(doc => {
      const t = doc.data().template || 'Unknown';
      templateCounts[t] = (templateCounts[t] || 0) + 1;
    });
    renderTemplateChart(templateCounts, totalBookings);

  } catch (e) {
    console.error('[Dashboard] Stats error:', e);
    showAdminToast('⚠️ Stats load mein error', 'error');
  }
}

function setStatCard(id, value, modifier = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  if (modifier === 'alert') {
    el.closest('.stat-card')?.classList.add('stat-alert');
  }
}

// ── TEMPLATE POPULARITY CHART ─────────────────────────────────────
function renderTemplateChart(counts, total) {
  const container = document.getElementById('templateChart');
  if (!container) return;

  if (total === 0) {
    container.innerHTML = '<div class="no-data">Abhi koi booking nahi hai</div>';
    return;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const colors = ['#2563eb','#7c3aed','#0891b2','#16a34a','#d97706','#dc2626'];

  container.innerHTML = sorted.map(([name, count], i) => {
    const pct = Math.round((count / total) * 100);
    return `
      <div class="chart-row">
        <div class="chart-label" title="${name}">${name.replace(' ', '\n')}</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="width:${pct}%;background:${colors[i % colors.length]};
            transition:width 1s ease ${i * 0.1}s;"></div>
        </div>
        <div class="chart-val">${count} <span>(${pct}%)</span></div>
      </div>`;
  }).join('');
}

// ── RECENT BOOKINGS TABLE ──────────────────────────────────────────
async function loadRecentBookings() {
  const tbody = document.getElementById('recentBookingsBody');
  if (!tbody) return;

  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt', 'desc')
      .limit(6)
      .get();

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" class="no-data-cell">Abhi koi booking nahi hai</td></tr>`;
      return;
    }

    tbody.innerHTML = snap.docs.map(doc => {
      const d   = doc.data();
      const id  = 'AK' + doc.id.slice(-6).toUpperCase();
      const couple = `${d.groomName || '—'} & ${d.brideName || '—'}`;
      const status = d.status || 'pending';
      const amt  = d.amountPaid ? '₹' + d.amountPaid : '—';
      const date = d.createdAt?.toDate
        ? d.createdAt.toDate().toLocaleDateString('en-IN', {day:'numeric',month:'short'})
        : '—';
      const statusClass = {pending:'badge-yellow', completed:'badge-green',
        'in-progress':'badge-blue', cancelled:'badge-red'}[status] || 'badge-gray';

      return `
        <tr onclick="window.location.href='admin-bookings.html?id=${doc.id}'" style="cursor:pointer;">
          <td><span class="order-id-badge">${id}</span></td>
          <td><div class="couple-name">${couple}</div>
              <div class="template-name-small">${d.template || '—'}</div></td>
          <td><span class="wa-link" onclick="event.stopPropagation();window.open('https://wa.me/91${d.whatsapp}','_blank')">
            📱 ${d.whatsapp || '—'}</span></td>
          <td>${amt}</td>
          <td>${date}</td>
          <td><span class="status-badge ${statusClass}">${status}</span></td>
        </tr>`;
    }).join('');

  } catch (e) {
    console.error('[Dashboard] Bookings error:', e);
    tbody.innerHTML = `<tr><td colspan="6" class="no-data-cell">⚠️ Load nahi ho saka</td></tr>`;
  }
}

// ── RECENT ACTIVITY FEED ───────────────────────────────────────────
async function loadRecentActivity() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  try {
    const [bookSnap, userSnap, revSnap] = await Promise.allSettled([
      db.collection('bookings').orderBy('createdAt','desc').limit(3).get(),
      db.collection('users').orderBy('createdAt','desc').limit(3).get(),
      db.collection('reviews').where('approved','==',false).orderBy('createdAt','desc').limit(2).get()
    ]);

    const activities = [];

    bookSnap.value?.docs.forEach(doc => {
      const d = doc.data();
      activities.push({
        icon: '📦', color: '#2563eb',
        text: `New booking — <strong>${d.groomName || 'Unknown'} & ${d.brideName || 'Unknown'}</strong>`,
        sub:  `${d.template || '—'} · ₹${d.amountPaid || 0}`,
        time: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(),
        link: 'admin-bookings.html'
      });
    });

    userSnap.value?.docs.forEach(doc => {
      const d = doc.data();
      activities.push({
        icon: '👤', color: '#16a34a',
        text: `New user — <strong>${d.displayName || d.email || 'Unknown'}</strong>`,
        sub:  d.email || '',
        time: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(),
        link: 'admin-users.html'
      });
    });

    revSnap.value?.docs.forEach(doc => {
      const d = doc.data();
      activities.push({
        icon: '⭐', color: '#d97706',
        text: `Review pending — <strong>${d.name || 'Unknown'}</strong>`,
        sub:  `${'⭐'.repeat(d.rating || 0)} · ${d.template || '—'}`,
        time: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(),
        link: 'admin-reviews.html'
      });
    });

    // Sort by time newest first
    activities.sort((a, b) => b.time - a.time);

    if (activities.length === 0) {
      feed.innerHTML = '<div class="no-data">Abhi koi activity nahi hai</div>';
      return;
    }

    feed.innerHTML = activities.slice(0, 8).map(a => `
      <div class="activity-item" onclick="window.location.href='${a.link}'" style="cursor:pointer;">
        <div class="activity-icon" style="background:${a.color}20;color:${a.color}">${a.icon}</div>
        <div class="activity-body">
          <div class="activity-text">${a.text}</div>
          <div class="activity-sub">${a.sub}</div>
        </div>
        <div class="activity-time">${timeAgo(a.time)}</div>
      </div>`).join('');

  } catch (e) {
    console.error('[Dashboard] Activity error:', e);
    feed.innerHTML = '<div class="no-data">⚠️ Load nahi ho saka</div>';
  }
}

// ── TIME AGO HELPER ────────────────────────────────────────────────
function timeAgo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)     return 'abhi';
  if (diff < 3600)   return Math.floor(diff/60) + 'm ago';
  if (diff < 86400)  return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

// ── AUTO REFRESH every 60 seconds ─────────────────────────────────
function startDashboardAutoRefresh() {
  setInterval(async () => {
    await Promise.allSettled([
      loadDashboardStats(),
      loadRecentBookings(),
      loadRecentActivity()
    ]);
    console.log('[Dashboard] Auto-refreshed');
  }, 60000);
}

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── DASHBOARD INIT ────────────────────────────────────────────────
async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  // Admin naam show karo
  const nameEl = document.getElementById('adminUserName');
  if (nameEl) nameEl.textContent = session.displayName || session.email.split('@')[0];

  // Sab data ek saath load karo
  showDashboardSkeleton(true);
  await Promise.all([
    loadDashboardStats(),
    loadRecentBookings(),
    loadRecentUsers(),
    loadRevenueChart(),
    loadTemplateStats()
  ]);
  showDashboardSkeleton(false);

  // Live clock
  startLiveClock();

  // Auto refresh har 5 minute
  setInterval(() => {
    loadDashboardStats();
    loadRecentBookings();
  }, 5 * 60 * 1000);
}

// ── LOAD STATS ────────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    const [bookSnap, userSnap, reviewSnap, orderSnap] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved','==',false).get(),
      db.collection('orders').get()
    ]);

    const bookings  = bookSnap.docs.map(d => ({ id:d.id, ...d.data() }));
    const pending   = bookings.filter(b => b.status === 'pending');
    const revenue   = bookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
    const today     = new Date(); today.setHours(0,0,0,0);
    const todayBkgs = bookings.filter(b => {
      if (!b.createdAt) return false;
      const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return d >= today;
    });

    // Withdrawals pending
    const wdSnap = await db.collection('referrals')
      .where('withdrawalPending','==',true).get().catch(() => ({ docs:[] }));

    setStatCard('statTotalBookings', bookings.length, todayBkgs.length > 0 ? `+${todayBkgs.length} aaj` : 'Total');
    setStatCard('statRevenue',       '₹' + revenue.toLocaleString('en-IN'), `${bookings.filter(b=>b.status==='completed').length} completed`);
    setStatCard('statPending',       pending.length, pending.length > 0 ? '⚠️ Attention needed' : '✅ Sab clear');
    setStatCard('statReviews',       reviewSnap.docs.length, 'Approve karne hain');
    setStatCard('statUsers',         userSnap.docs.length, 'Registered users');
    setStatCard('statOrders',        orderSnap.docs.filter(d=>d.data().status==='active').length, 'Active orders');
    setStatCard('statWithdrawals',   wdSnap.docs.length, wdSnap.docs.length > 0 ? '⚠️ Pending UPI' : '✅ Clear');

    // Store for chart
    window._dashBookings = bookings;

  } catch (e) {
    console.error('Stats load error:', e);
    showAdminToast('⚠️ Stats load nahi hue: ' + e.message, 'error');
  }
}

function setStatCard(id, value, sub) {
  const card = document.getElementById(id);
  if (!card) return;
  const valEl = card.querySelector('.stat-value');
  const subEl = card.querySelector('.stat-sub');
  if (valEl) { valEl.textContent = value; valEl.classList.add('counted'); }
  if (subEl) subEl.textContent = sub || '';
}

// ── RECENT BOOKINGS TABLE ─────────────────────────────────────────
async function loadRecentBookings() {
  const tbody = document.getElementById('recentBookingsTbody');
  if (!tbody) return;

  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(8).get();

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#8890b5;padding:2rem;">Abhi koi booking nahi hai</td></tr>`;
      return;
    }

    tbody.innerHTML = snap.docs.map(doc => {
      const d  = doc.data();
      const dt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
      const dateStr = dt.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
      const statusConfig = {
        pending:     { label:'Pending',     cls:'badge-warning' },
        in_progress: { label:'In Progress', cls:'badge-info'    },
        completed:   { label:'Completed',   cls:'badge-success' },
        cancelled:   { label:'Cancelled',   cls:'badge-danger'  },
      };
      const sc = statusConfig[d.status] || statusConfig.pending;
      return `
        <tr onclick="window.location='admin-bookings.html?id=${doc.id}'" style="cursor:pointer;">
          <td><span class="tbl-id">#${doc.id.slice(-5).toUpperCase()}</span></td>
          <td>${escHtml(d.groomName||'—')} & ${escHtml(d.brideName||'—')}</td>
          <td><span class="tbl-template">${escHtml(d.template||'—')}</span></td>
          <td class="tbl-amt">₹${(d.amountPaid||0).toLocaleString('en-IN')}</td>
          <td><span class="badge ${sc.cls}">${sc.label}</span></td>
          <td class="tbl-date">${dateStr}</td>
        </tr>`;
    }).join('');

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:1.5rem;">Error: ${e.message}</td></tr>`;
  }
}

// ── RECENT USERS ──────────────────────────────────────────────────
async function loadRecentUsers() {
  const list = document.getElementById('recentUsersList');
  if (!list) return;

  try {
    const snap = await db.collection('users')
      .orderBy('createdAt','desc').limit(6).get();

    if (snap.empty) {
      list.innerHTML = `<div style="text-align:center;color:#8890b5;padding:1.5rem;font-size:0.85rem;">Koi user nahi hai abhi</div>`;
      return;
    }

    list.innerHTML = snap.docs.map(doc => {
      const d  = doc.data();
      const dt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
      const dateStr = dt.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
      const initials = (d.displayName || d.email || 'U').charAt(0).toUpperCase();
      const hasPhoto = d.photoURL;
      return `
        <div class="user-item">
          <div class="user-avatar" ${hasPhoto ? `style="background:transparent;"` : ''}>
            ${hasPhoto
              ? `<img src="${d.photoURL}" alt="${initials}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>`
              : initials}
          </div>
          <div class="user-info">
            <div class="user-name">${escHtml(d.displayName || d.email?.split('@')[0] || 'User')}</div>
            <div class="user-email">${escHtml(d.email || '—')}</div>
          </div>
          <div class="user-date">${dateStr}</div>
        </div>`;
    }).join('');

  } catch (e) {
    list.innerHTML = `<div style="color:#ef4444;padding:1rem;font-size:0.82rem;">Error: ${e.message}</div>`;
  }
}

// ── REVENUE CHART (last 7 days) ────────────────────────────────────
async function loadRevenueChart() {
  const canvas = document.getElementById('revenueChart');
  if (!canvas) return;

  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(50).get();

    // Last 7 days ka data
    const days = [];
    const revenues = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      const nextD = new Date(d); nextD.setDate(nextD.getDate() + 1);
      const label = d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric'});
      const dayRevenue = snap.docs.reduce((sum, doc) => {
        const b = doc.data();
        if (!b.createdAt) return sum;
        const bDate = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return (bDate >= d && bDate < nextD) ? sum + (b.amountPaid || 0) : sum;
      }, 0);
      days.push(label);
      revenues.push(dayRevenue);
    }

    drawBarChart(canvas, days, revenues, '₹');

  } catch (e) {
    console.warn('Revenue chart error:', e);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#8890b5';
      ctx.font = '14px DM Sans';
      ctx.fillText('Chart load nahi hua', 20, 80);
    }
  }
}

// ── TEMPLATE POPULARITY ───────────────────────────────────────────
async function loadTemplateStats() {
  const container = document.getElementById('templateStats');
  if (!container) return;

  try {
    const snap = await db.collection('bookings').get();
    const counts = {};
    snap.docs.forEach(doc => {
      const t = doc.data().template || 'Unknown';
      counts[t] = (counts[t] || 0) + 1;
    });

    const total = snap.docs.length || 1;
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);

    const colors = ['#2563eb','#7c3aed','#16a34a','#f59e0b','#ef4444','#0891b2'];
    container.innerHTML = sorted.slice(0,6).map(([name, count], i) => {
      const pct = Math.round((count/total)*100);
      return `
        <div class="tmpl-row">
          <div class="tmpl-name">${escHtml(name)}</div>
          <div class="tmpl-bar-wrap">
            <div class="tmpl-bar" style="width:${pct}%;background:${colors[i%colors.length]};"></div>
          </div>
          <div class="tmpl-count">${count}</div>
        </div>`;
    }).join('') || '<div style="color:#8890b5;font-size:0.85rem;padding:1rem;">Data nahi hai abhi</div>';

  } catch (e) {
    if (container) container.innerHTML = `<div style="color:#ef4444;font-size:0.82rem;">Error: ${e.message}</div>`;
  }
}

// ── SIMPLE BAR CHART ──────────────────────────────────────────────
function drawBarChart(canvas, labels, values, prefix = '') {
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = canvas.offsetWidth  || 400;
  const H = canvas.height = canvas.offsetHeight || 160;
  const pad = { top:20, right:16, bottom:36, left:56 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top  - pad.bottom;

  ctx.clearRect(0,0,W,H);
  const max = Math.max(...values, 1);
  const barW  = chartW / labels.length;
  const barGap = barW * 0.25;

  // Grid lines
  for (let i=0; i<=4; i++) {
    const y = pad.top + chartH - (i/4) * chartH;
    ctx.strokeStyle = 'rgba(37,99,235,0.08)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+chartW, y); ctx.stroke();
    ctx.fillStyle   = '#8890b5';
    ctx.font        = '10px DM Sans';
    ctx.textAlign   = 'right';
    ctx.fillText(prefix + Math.round((i/4)*max).toLocaleString('en-IN'), pad.left-6, y+3);
  }

  // Bars
  values.forEach((val, i) => {
    const x   = pad.left + i*barW + barGap/2;
    const bW  = barW - barGap;
    const bH  = (val/max) * chartH;
    const y   = pad.top + chartH - bH;

    const grad = ctx.createLinearGradient(0, y, 0, pad.top+chartH);
    grad.addColorStop(0, '#2563eb');
    grad.addColorStop(1, '#7c3aed');
    ctx.fillStyle   = val > 0 ? grad : 'rgba(37,99,235,0.1)';
    ctx.beginPath();
    ctx.roundRect(x, y, bW, bH, [4,4,0,0]);
    ctx.fill();

    // Label
    ctx.fillStyle  = '#8890b5';
    ctx.font       = '9px DM Sans';
    ctx.textAlign  = 'center';
    ctx.fillText(labels[i], x + bW/2, H - pad.bottom + 14);

    // Value on top
    if (val > 0) {
      ctx.fillStyle = '#4b5280';
      ctx.font      = '10px DM Sans';
      ctx.fillText(prefix + val.toLocaleString('en-IN'), x + bW/2, y - 4);
    }
  });
}

// ── SIDEBAR TOGGLE (mobile) ────────────────────────────────────────
function toggleSidebar() {
  const sidebar  = document.getElementById('adminSidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const isOpen   = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('show', !isOpen);
}

function closeSidebar() {
  document.getElementById('adminSidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}

// ── SKELETON LOADER ───────────────────────────────────────────────
function showDashboardSkeleton(show) {
  document.querySelectorAll('.stat-card').forEach(card => {
    card.classList.toggle('skeleton-loading', show);
  });
}

// ── LIVE CLOCK ────────────────────────────────────────────────────
function startLiveClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  function tick() {
    el.textContent = new Date().toLocaleTimeString('en-IN',
      { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
  }
  tick();
  setInterval(tick, 1000);
}

// ── HTML ESCAPE ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── QUICK ACTIONS ─────────────────────────────────────────────────
function quickNav(page) {
  window.location.href = page;
}

// ── AUTO INIT ─────────────────────────────────────────────────────
if (document.getElementById('dashboardPage')) {
  document.addEventListener('DOMContentLoaded', initDashboard);
}

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── SIDEBAR TOGGLE (mobile) ───────────────────────────────────────
function toggleSidebar() {
  const sb  = document.getElementById('sidebar');
  const ov  = document.getElementById('sidebarOverlay');
  if (!sb) return;
  sb.classList.toggle('open');
  ov.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// ── CHART INSTANCES ───────────────────────────────────────────────
let revenueChartInst  = null;
let templateChartInst = null;

// ── DASHBOARD INIT ────────────────────────────────────────────────
(async function initDashboard() {
  // Check if we are on dashboard page
  if (!document.getElementById('statBookings')) return;

  // Session guard
  const session = requireAdminSession();
  if (!session) return;

  // Show admin info in sidebar
  const el = document.getElementById('sbAdminName');
  if (el) el.textContent = session.displayName || session.email?.split('@')[0] || 'Admin';

  // Set avatar
  const avatarEl = document.getElementById('sbAvatar');
  if (avatarEl) {
    if (auth.currentUser?.photoURL) {
      avatarEl.innerHTML = `<img src="${auth.currentUser.photoURL}" alt="Admin"/>`;
    } else {
      avatarEl.textContent = (session.displayName || 'A').charAt(0).toUpperCase();
    }
  }

  // Load all stats in parallel
  await Promise.all([
    loadDashboardStats(),
    loadRecentBookings(),
    loadRecentUsers(),
  ]);

})();

// ── LOAD STATS ────────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    // Run all queries in parallel
    const [bookSnap, userSnap, reviewSnap, withdrawSnap] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved', '==', false).get(),
      db.collection('referrals').where('withdrawalPending', '==', true).get(),
    ]);

    // ── Bookings stats ─────────────────────────────────────────
    const allBookings = bookSnap.docs.map(d => d.data());
    const totalBookings = allBookings.length;
    const pendingBookings = allBookings.filter(b => b.status === 'pending').length;

    // Revenue — sum of amountPaid
    const totalRevenue = allBookings.reduce((sum, b) => sum + (parseInt(b.amountPaid) || 0), 0);

    // Today's bookings
    const today = new Date(); today.setHours(0,0,0,0);
    const todayBookings = allBookings.filter(b => {
      if (!b.createdAt) return false;
      const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return d >= today;
    }).length;

    // ── Set stat values ────────────────────────────────────────
    setText('statBookings', totalBookings);
    setText('statPending', pendingBookings);
    setText('statRevenue', '₹' + totalRevenue.toLocaleString('en-IN'));
    setText('statUsers', userSnap.size);
    setText('statReviews', reviewSnap.size);
    setText('statWithdrawals', withdrawSnap.size);

    // Change notes
    if (todayBookings > 0) setText('statBookingsChange', `↑ +${todayBookings} aaj`);
    if (pendingBookings > 0) setText('statPendingNote', `⚠️ ${pendingBookings} action chahiye`);
    if (reviewSnap.size > 0) setText('statReviewsNote', `${reviewSnap.size} approve karne hain`);
    if (withdrawSnap.size > 0) setText('statWithdrawNote', `${withdrawSnap.size} requests pending`);

    // Sidebar badges
    setText('sb-pending-count', pendingBookings);
    setText('sb-review-count', reviewSnap.size);
    setText('sb-withdraw-count', withdrawSnap.size);

    // Show notification dot if anything pending
    const notifDot = document.getElementById('notifDot');
    if (notifDot && (pendingBookings > 0 || reviewSnap.size > 0)) {
      notifDot.style.display = 'block';
    }

    // ── Build revenue + template charts ───────────────────────
    buildRevenueChart(allBookings, 7);
    buildTemplateChart(allBookings);

  } catch(e) {
    console.error('Stats load error:', e);
    showAdminToast('⚠️ Stats load mein error: ' + e.message, 'error');
  }
}

// ── REVENUE CHART ─────────────────────────────────────────────────
function buildRevenueChart(bookings, days = 7) {
  const canvas = document.getElementById('revenueChart');
  if (!canvas) return;

  // Generate last N days labels + data
  const labels = [];
  const data   = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);

    const dayRevenue = bookings
      .filter(b => {
        if (!b.createdAt) return false;
        const bd = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bd >= d && bd < nextD;
      })
      .reduce((sum, b) => sum + (parseInt(b.amountPaid) || 0), 0);

    labels.push(d.toLocaleDateString('en-IN', { month:'short', day:'numeric' }));
    data.push(dayRevenue);
  }

  if (revenueChartInst) revenueChartInst.destroy();

  revenueChartInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (₹)',
        data,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.08)',
        borderWidth: 2.5,
        pointBackgroundColor: '#2563eb',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => '₹' + ctx.parsed.y.toLocaleString('en-IN')
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { size: 10, family: 'DM Sans' },
            color: '#94a3b8',
            callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v)
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 10, family:'DM Sans' }, color:'#94a3b8' }
        }
      }
    }
  });
}

function refreshRevenueChart() {
  const days = parseInt(document.getElementById('chartRange')?.value || 7);
  db.collection('bookings').get().then(snap => {
    buildRevenueChart(snap.docs.map(d => d.data()), days);
  });
}

// ── TEMPLATE CHART ────────────────────────────────────────────────
function buildTemplateChart(bookings) {
  const canvas = document.getElementById('templateChart');
  if (!canvas) return;

  // Count bookings per template
  const counts = {};
  bookings.forEach(b => {
    const t = b.template || 'Unknown';
    counts[t] = (counts[t] || 0) + 1;
  });

  // Short names for display
  const shortName = name => name.split(' ').slice(0,2).join(' ');

  const labels = Object.keys(counts).map(shortName);
  const data   = Object.values(counts);
  const colors = ['#2563eb','#7c3aed','#16a34a','#d97706','#dc2626','#0891b2'];

  if (templateChartInst) templateChartInst.destroy();

  templateChartInst = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 10, family: 'DM Sans' }, color: '#64748b', padding: 10, boxWidth: 12 }
        }
      },
      cutout: '65%'
    }
  });
}

// ── RECENT BOOKINGS TABLE ─────────────────────────────────────────
async function loadRecentBookings() {
  const tbody = document.getElementById('recentBookingsBody');
  if (!tbody) return;

  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:1.5rem;font-size:0.8rem;">Abhi koi booking nahi hai</td></tr>';
      return;
    }

    tbody.innerHTML = snap.docs.map(doc => {
      const b = doc.data();
      const couple  = (b.groomName || '?') + ' & ' + (b.brideName || '?');
      const tmpl    = (b.template || '—').split(' ').slice(0,2).join(' ');
      const amount  = '₹' + (b.amountPaid || 0).toLocaleString('en-IN');
      const status  = b.status || 'pending';
      const badgeCls = { pending:'badge-pending', active:'badge-active', completed:'badge-completed', cancelled:'badge-cancelled' }[status] || 'badge-pending';
      return `<tr>
        <td><strong>${couple.length > 22 ? couple.slice(0,22)+'...' : couple}</strong></td>
        <td style="color:#64748b;">${tmpl}</td>
        <td style="font-weight:700;color:#16a34a;">${amount}</td>
        <td><span class="badge ${badgeCls}">${status}</span></td>
      </tr>`;
    }).join('');

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#dc2626;padding:1rem;font-size:0.78rem;">⚠️ Load error: ${e.message}</td></tr>`;
  }
}

// ── RECENT USERS LIST ─────────────────────────────────────────────
async function loadRecentUsers() {
  const list = document.getElementById('recentUsersList');
  if (!list) return;

  try {
    const snap = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(6)
      .get();

    if (snap.empty) {
      list.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:1.5rem;font-size:0.8rem;">Abhi koi user register nahi hai</div>';
      return;
    }

    list.innerHTML = snap.docs.map(doc => {
      const u    = doc.data();
      const name = u.displayName || u.email?.split('@')[0] || 'User';
      const initials = name.charAt(0).toUpperCase();
      const date = u.createdAt?.toDate
        ? u.createdAt.toDate().toLocaleDateString('en-IN', {day:'numeric',month:'short'})
        : 'Recently';
      const photoHTML = u.photoURL
        ? `<img src="${u.photoURL}" alt="${name}"/>`
        : initials;
      return `<div class="user-item">
        <div class="u-avatar">${photoHTML}</div>
        <div class="u-info">
          <div class="u-name">${name}</div>
          <div class="u-email">${u.email || '—'}</div>
        </div>
        <div class="u-date">${date}</div>
      </div>`;
    }).join('');

  } catch(e) {
    list.innerHTML = `<div style="text-align:center;color:#dc2626;padding:1rem;font-size:0.78rem;">⚠️ ${e.message}</div>`;
  }
}

// ── HELPER ────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── GLOBAL SEARCH (basic) ─────────────────────────────────────────
const searchInput = document.getElementById('globalSearch');
if (searchInput) {
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) window.location.href = `admin-bookings.html?search=${encodeURIComponent(q)}`;
    }
  });
}

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 3, 4... aage ke pages ka JS yahan add hoga       ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── DASHBOARD INIT ────────────────────────────────────────────────
(function initDashboard() {
  if (!window.location.href.includes('admin-dashboard')) return;

  // Session check
  const session = requireAdminSession();
  if (!session) return;

  // Set admin info in UI
  document.getElementById('sbAdminEmail').textContent  = session.email || 'Admin';
  document.getElementById('adminInitial').textContent  = (session.displayName || session.email || 'A').charAt(0).toUpperCase();
  document.getElementById('topbarDate').textContent    = new Date().toLocaleDateString('en-IN', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  // Load all dashboard data
  loadDashboardStats();
  loadRecentBookings();
  loadRecentUsers();
  loadActivityFeed();
  loadRevenueChart('7d');
})();

// ── SIDEBAR MOBILE TOGGLE ─────────────────────────────────────────
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sbOverlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}

// ── STATS LOADER ──────────────────────────────────────────────────
async function loadDashboardStats() {
  const grid = document.getElementById('statsGrid');
  if (!grid) return;

  try {
    // Parallel Firestore queries
    const [
      bookingsSnap,
      usersSnap,
      reviewsSnap,
      referralsSnap
    ] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved','==',false).get(),
      db.collection('referrals').where('totalPending','>',0).get()
    ]);

    const bookings    = bookingsSnap.docs.map(d => d.data());
    const todayStr    = new Date().toDateString();

    const totalBookings   = bookings.length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const todayBookings   = bookings.filter(b => {
      const d = b.createdAt?.toDate?.() || new Date(0);
      return d.toDateString() === todayStr;
    }).length;
    const totalRevenue    = bookings.reduce((s,b) => s + (b.amountPaid || 0), 0);
    const couponsUsed     = bookings.filter(b => b.couponCode).length;
    const pendingReviews  = reviewsSnap.size;
    const totalUsers      = usersSnap.size;
    const pendingWithdraw = referralsSnap.size;

    // Update badges in sidebar
    if (pendingBookings > 0) {
      const bb = document.getElementById('pendingBookingsBadge');
      if (bb) { bb.textContent = pendingBookings; bb.style.display = 'inline'; }
    }
    if (pendingReviews > 0) {
      const rb = document.getElementById('pendingReviewsBadge');
      if (rb) { rb.textContent = pendingReviews; rb.style.display = 'inline'; }
    }

    // Render stats grid
    grid.innerHTML = `
      ${statCard('sc-blue',    '📦', totalBookings,    'Total Bookings',    pendingBookings > 0 ? `${pendingBookings} pending` : 'Sab clear', pendingBookings > 0 ? 'change-down' : 'change-up')}
      ${statCard('sc-green',   '💰', '₹'+totalRevenue.toLocaleString('en-IN'), 'Total Revenue', 'Sab payments mila ke', 'change-up')}
      ${statCard('sc-orange',  '⏳', pendingBookings,  'Pending Bookings',  'Process karne hain', pendingBookings > 0 ? 'change-down' : 'change-neutral')}
      ${statCard('sc-cyan',    '📅', todayBookings,    'Aaj Ki Bookings',   new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short'}), 'change-neutral')}
      ${statCard('sc-purple',  '⭐', pendingReviews,   'Pending Reviews',   'Approve karne hain', pendingReviews > 0 ? 'change-down' : 'change-up')}
      ${statCard('sc-blue',    '👥', totalUsers,       'Total Users',       'Registered users', 'change-up')}
      ${statCard('sc-red',     '💸', pendingWithdraw,  'Pending Withdrawals','UPI withdraw', pendingWithdraw > 0 ? 'change-down' : 'change-neutral')}
      ${statCard('sc-gold',    '🎟️', couponsUsed,     'Coupons Used',      'Total applied', 'change-neutral')}
    `;

    // Notification dot
    const hasAlerts = pendingBookings > 0 || pendingReviews > 0 || pendingWithdraw > 0;
    const notifDot = document.getElementById('notifDot');
    if (notifDot) notifDot.style.display = hasAlerts ? 'block' : 'none';

  } catch(e) {
    console.error('[Dashboard] Stats error:', e);
    showAdminToast('⚠️ Stats load nahi ho sakin: ' + e.message, 'error');
  }
}

function statCard(cls, icon, value, label, sub, changeCls) {
  return `
    <div class="stat-card ${cls} fade-in">
      <div class="stat-top">
        <div class="stat-icon">${icon}</div>
        <span class="badge ${changeCls}">${sub}</span>
      </div>
      <span class="stat-num">${value}</span>
      <div class="stat-label">${label}</div>
    </div>`;
}

// ── RECENT BOOKINGS ────────────────────────────────────────────────
async function loadRecentBookings() {
  const tbody = document.getElementById('recentBookingsBody');
  if (!tbody) return;
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(6).get();

    if (snap.empty) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">📭 Abhi koi booking nahi</td></tr>';
      return;
    }

    tbody.innerHTML = snap.docs.map(doc => {
      const b = doc.data();
      const couple = (b.groomName || '?') + ' & ' + (b.brideName || '?');
      const status = b.status || 'pending';
      const badgeCls = status === 'pending' ? 'badge-pending'
                     : status === 'completed' ? 'badge-done'
                     : status === 'cancelled' ? 'badge-cancelled'
                     : 'badge-active';
      return `
        <tr onclick="window.location='admin-bookings.html'" style="cursor:pointer;">
          <td><strong>${couple}</strong></td>
          <td>${b.template || '—'}</td>
          <td><strong>₹${(b.amountPaid||0).toLocaleString('en-IN')}</strong></td>
          <td><span class="badge ${badgeCls}">${status}</span></td>
        </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">⚠️ Load nahi hua</td></tr>';
    console.error('[Dashboard] Bookings error:', e);
  }
}

// ── RECENT USERS ──────────────────────────────────────────────────
async function loadRecentUsers() {
  const container = document.getElementById('recentUsersList');
  if (!container) return;
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt','desc').limit(5).get();

    if (snap.empty) {
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-3);font-size:0.82rem;">📭 Koi user nahi</div>';
      return;
    }

    container.innerHTML = snap.docs.map(doc => {
      const u = doc.data();
      const name    = u.displayName || u.email?.split('@')[0] || 'User';
      const initial = name.charAt(0).toUpperCase();
      const date    = u.createdAt?.toDate?.()
        ? u.createdAt.toDate().toLocaleDateString('en-IN',{day:'numeric',month:'short'})
        : 'Recently';
      return `
        <div class="user-item">
          <div class="user-av">${initial}</div>
          <div class="user-info">
            <strong>${name}</strong>
            <span>${u.email || '—'}</span>
          </div>
          <span class="user-tag">Joined ${date}</span>
        </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-3);font-size:0.82rem;">⚠️ Load nahi hua</div>';
  }
}

// ── ACTIVITY FEED ─────────────────────────────────────────────────
async function loadActivityFeed() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  try {
    const [bookSnap, reviewSnap, userSnap] = await Promise.all([
      db.collection('bookings').orderBy('createdAt','desc').limit(3).get(),
      db.collection('reviews').orderBy('createdAt','desc').limit(2).get(),
      db.collection('users').orderBy('createdAt','desc').limit(2).get(),
    ]);

    let activities = [];

    bookSnap.docs.forEach(doc => {
      const b = doc.data();
      activities.push({
        icon:'📦', bgColor:'#eff6ff',
        text: `<strong>${(b.groomName||'?')} & ${(b.brideName||'?')}</strong> ne booking ki`,
        sub: b.template || '—',
        time: b.createdAt?.toDate?.() || new Date()
      });
    });
    reviewSnap.docs.forEach(doc => {
      const r = doc.data();
      activities.push({
        icon:'⭐', bgColor:'#fffbeb',
        text: `<strong>${r.name||'Someone'}</strong> ne review diya`,
        sub: `${'⭐'.repeat(r.rating||5)} — Pending approval`,
        time: r.createdAt?.toDate?.() || new Date()
      });
    });
    userSnap.docs.forEach(doc => {
      const u = doc.data();
      activities.push({
        icon:'👤', bgColor:'#f0fdf4',
        text: `<strong>${u.displayName||u.email?.split('@')[0]||'User'}</strong> joined`,
        sub: u.email || '—',
        time: u.createdAt?.toDate?.() || new Date()
      });
    });

    // Sort by time
    activities.sort((a,b) => b.time - a.time);

    feed.innerHTML = activities.slice(0,6).map(a => `
      <div class="activity-item">
        <div class="act-icon" style="background:${a.bgColor}">${a.icon}</div>
        <div class="act-text">
          <strong>${a.text}</strong>
          <span>${a.sub}</span>
        </div>
        <div class="act-time">${timeAgo(a.time)}</div>
      </div>`).join('') || '<div style="text-align:center;padding:2rem;color:var(--text-3);font-size:0.82rem;">📭 Koi activity nahi</div>';

  } catch(e) {
    feed.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-3);">⚠️ Load nahi hua</div>';
  }
}

function timeAgo(date) {
  const secs = Math.floor((Date.now() - date) / 1000);
  if (secs < 60)   return 'Abhi';
  if (secs < 3600) return Math.floor(secs/60) + ' min pehle';
  if (secs < 86400) return Math.floor(secs/3600) + ' ghante pehle';
  return Math.floor(secs/86400) + ' din pehle';
}

// ── REVENUE CHART ─────────────────────────────────────────────────
async function loadRevenueChart(period) {
  const chartDiv = document.getElementById('revenueChart');
  if (!chartDiv) return;
  chartDiv.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-3);font-size:0.82rem;">📊 Loading...</div>';

  try {
    const now  = new Date();
    let startDate = new Date();
    if (period === '7d')  startDate.setDate(now.getDate() - 7);
    if (period === '30d') startDate.setDate(now.getDate() - 30);
    if (period === 'all') startDate = new Date(2024,0,1);

    const snap = await db.collection('bookings')
      .where('createdAt','>=', firebase.firestore.Timestamp.fromDate(startDate))
      .orderBy('createdAt','asc').get();

    const bookings = snap.docs.map(d => d.data());

    if (bookings.length === 0) {
      chartDiv.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-3);font-size:0.85rem;">📭 Is period mein koi booking nahi</div>';
      return;
    }

    // Group by date
    const groups = {};
    bookings.forEach(b => {
      const d = b.createdAt?.toDate?.() || new Date();
      const key = d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
      groups[key] = (groups[key] || 0) + (b.amountPaid || 0);
    });

    const labels = Object.keys(groups);
    const values = Object.values(groups);
    const maxVal = Math.max(...values, 1);

    // Simple CSS bar chart
    chartDiv.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:4px;height:160px;padding:0 4px;">
        ${labels.map((label,i) => {
          const pct = Math.max((values[i]/maxVal)*100, 4);
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
              <div style="font-size:0.6rem;color:var(--text-3);">₹${values[i]}</div>
              <div style="width:100%;height:${pct}%;background:linear-gradient(180deg,#60a5fa,#2563eb);border-radius:4px 4px 0 0;min-height:4px;transition:height 0.5s ease;" title="${label}: ₹${values[i]}"></div>
              <div style="font-size:0.58rem;color:var(--text-3);text-align:center;writing-mode:vertical-rl;transform:rotate(180deg);max-height:40px;overflow:hidden;">${label}</div>
            </div>`;
        }).join('')}
      </div>
      <div style="text-align:center;font-size:0.72rem;color:var(--text-3);margin-top:8px;">
        Total: <strong style="color:var(--blue);">₹${values.reduce((a,b)=>a+b,0).toLocaleString('en-IN')}</strong>
      </div>`;
  } catch(e) {
    chartDiv.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-3);font-size:0.82rem;">⚠️ ${e.message}</div>`;
  }
}

function switchChart(period, btn) {
  document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadRevenueChart(period);
}

// ── REFRESH ───────────────────────────────────────────────────────
function refreshDashboard() {
  showAdminToast('🔄 Refresh ho raha hai...', 'info');
  loadDashboardStats();
  loadRecentBookings();
  loadRecentUsers();
  loadActivityFeed();
}

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 3, 4... aage ke pages yahan add honge             ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 2 — admin-dashboard.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── SIDEBAR NAV ITEMS (sab admin pages pe same rahega) ────────────
const ADMIN_NAV = [
  { id:'dashboard',  icon:'📊', label:'Dashboard',           url:'admin-dashboard.html'  },
  { id:'bookings',   icon:'📦', label:'Bookings',            url:'admin-bookings.html'   },
  { id:'orders',     icon:'📋', label:'Orders',              url:'admin-orders.html'     },
  { id:'users',      icon:'👥', label:'Users',               url:'admin-users.html'      },
  { id:'reviews',    icon:'⭐', label:'Reviews',             url:'admin-reviews.html'    },
  { id:'templates',  icon:'🎨', label:'Templates',           url:'admin-templates.html'  },
  { id:'coupons',    icon:'🎟️', label:'Coupons',             url:'admin-coupons.html'    },
  { id:'referrals',  icon:'🎁', label:'Referrals & Withdraw',url:'admin-referrals.html'  },
  { id:'whatsapp',   icon:'💬', label:'WhatsApp',            url:'admin-whatsapp.html'   },
  { id:'settings',   icon:'⚙️', label:'Settings',            url:'admin-settings.html'   },
];

// ── RENDER SIDEBAR (sabhi admin pages call karenge) ───────────────
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

// ── SIDEBAR TOGGLE (mobile) ────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('adminSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ── DASHBOARD INIT ─────────────────────────────────────────────────
async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;

  renderSidebar('dashboard');

  // Header mein admin name
  const el = document.getElementById('adminHeaderName');
  if (el) el.textContent = session.displayName || session.email?.split('@')[0] || 'Admin';

  // Sab parallel load karo
  await Promise.all([
    loadDashboardStats(),
    loadRecentBookings(),
    loadRecentUsers(),
  ]);

  // Charts thodi der baad (Chart.js load hone ke baad)
  setTimeout(() => {
    loadRevenueChart();
    loadTemplateChart();
  }, 500);
}

// ── DASHBOARD STATS ────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    const today = new Date(); today.setHours(0,0,0,0);

    // Firestore se parallel fetch
    const [bookSnap, userSnap, revSnap, refSnap] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved','==',false).get(),
      db.collection('referrals').get(),
    ]);

    const bookings   = bookSnap.docs.map(d => ({id:d.id, ...d.data()}));
    const pending    = bookings.filter(b => b.status === 'pending').length;
    const revenue    = bookings.reduce((s,b) => s + (b.amountPaid||0), 0);
    const todayCount = bookings.filter(b => {
      const t = b.createdAt?.toDate?.();
      return t && t >= today;
    }).length;

    // Pending withdrawals count
    const refData = refSnap.docs.map(d => d.data());
    const pendingWith = refData.filter(r => (r.totalEarned||0) > 0).length;

    // Badges update (sidebar mein)
    setBadge('badge-bookings',  pending);
    setBadge('badge-reviews',   revSnap.size);
    setBadge('badge-referrals', pendingWith);

    // Stats cards update
    animateCount('stat-total-bookings', bookings.length);
    animateCount('stat-revenue',        revenue, '₹');
    animateCount('stat-pending',        pending);
    animateCount('stat-reviews',        revSnap.size);
    animateCount('stat-users',          userSnap.size);
    animateCount('stat-withdrawals',    pendingWith);

    // Today strip
    const todayEl = document.getElementById('stat-today');
    if (todayEl) todayEl.textContent = todayCount;

    // Remove loading skeletons
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('loading'));

  } catch(e) {
    console.error('[Dashboard Stats]', e);
    showAdminToast('⚠️ Stats load error: ' + e.message, 'warning');
  }
}

// Number animate (0 se value tak)
function animateCount(id, target, prefix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 900;
  const steps    = 40;
  const step     = target / steps;
  let current    = 0;
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = prefix + Math.floor(current).toLocaleString('en-IN');
    if (current >= target) clearInterval(interval);
  }, duration / steps);
}

// Sidebar badge set karo
function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) {
    el.textContent = count > 99 ? '99+' : count;
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

// ── RECENT BOOKINGS TABLE ──────────────────────────────────────────
async function loadRecentBookings() {
  const tbody = document.getElementById('recentBookingsTbody');
  if (!tbody) return;
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(6).get();

    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">📭 Abhi koi booking nahi</td></tr>`;
      return;
    }

    const STATUS = {
      pending:    { label:'Pending',     color:'#f59e0b', bg:'#fffbeb' },
      inprogress: { label:'In Progress', color:'#3b82f6', bg:'#eff6ff' },
      completed:  { label:'Completed',   color:'#16a34a', bg:'#f0fdf4' },
      cancelled:  { label:'Cancelled',   color:'#ef4444', bg:'#fef2f2' },
    };

    tbody.innerHTML = snap.docs.map(doc => {
      const b = doc.data();
      const s = STATUS[b.status] || STATUS.pending;
      const date = b.createdAt?.toDate?.()
        ? b.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})
        : '—';
      return `<tr onclick="window.location='admin-bookings.html?id=${doc.id}'" style="cursor:pointer;">
        <td class="td-couple">${b.groomName||'?'} &amp; ${b.brideName||'?'}</td>
        <td>${b.template||'—'}</td>
        <td class="td-amount">₹${(b.amountPaid||0).toLocaleString('en-IN')}</td>
        <td><span class="status-pill" style="color:${s.color};background:${s.bg};">${s.label}</span></td>
        <td>${b.whatsapp||'—'}</td>
        <td>${date}</td>
      </tr>`;
    }).join('');

  } catch(e) {
    console.error('[Recent Bookings]', e);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">⚠️ Load error</td></tr>`;
  }
}

// ── RECENT USERS ───────────────────────────────────────────────────
async function loadRecentUsers() {
  const list = document.getElementById('recentUsersList');
  if (!list) return;
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt','desc').limit(5).get();

    if (snap.empty) {
      list.innerHTML = `<div class="empty-small">📭 Koi user nahi</div>`;
      return;
    }

    list.innerHTML = snap.docs.map(doc => {
      const u = doc.data();
      const name    = u.displayName || u.email?.split('@')[0] || 'User';
      const initial = name.charAt(0).toUpperCase();
      const date    = u.createdAt?.toDate?.()
        ? u.createdAt.toDate().toLocaleDateString('en-IN',{day:'numeric',month:'short'})
        : 'Recently';
      return `<div class="user-row">
        <div class="user-av">${initial}</div>
        <div class="user-info">
          <div class="user-name">${name}</div>
          <div class="user-email">${u.email||'—'}</div>
        </div>
        <div class="user-date">${date}</div>
      </div>`;
    }).join('');

  } catch(e) {
    console.error('[Recent Users]', e);
  }
}

// ── REVENUE CHART (last 7 days) ────────────────────────────────────
async function loadRevenueChart() {
  const canvas = document.getElementById('revenueChart');
  if (!canvas || typeof Chart === 'undefined') return;
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(100).get();
    const bookings = snap.docs.map(d => d.data());

    const days = [], revenues = [], counts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(next.getDate()+1);
      const dayData = bookings.filter(b => {
        const t = b.createdAt?.toDate?.();
        return t && t >= d && t < next;
      });
      days.push(d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}));
      revenues.push(dayData.reduce((s,b) => s+(b.amountPaid||0), 0));
      counts.push(dayData.length);
    }

    new Chart(canvas.getContext('2d'), {
      type:'line',
      data:{
        labels: days,
        datasets:[
          { label:'Revenue (₹)', data:revenues, borderColor:'#2563eb',
            backgroundColor:'rgba(37,99,235,0.08)', fill:true,
            borderWidth:2.5, tension:0.4,
            pointBackgroundColor:'#fff', pointBorderColor:'#2563eb',
            pointBorderWidth:2, pointRadius:5, pointHoverRadius:7,
            yAxisID:'y' },
          { label:'Bookings', data:counts, borderColor:'#7c3aed',
            backgroundColor:'transparent', borderWidth:2,
            borderDash:[5,4], tension:0.4,
            pointRadius:3, yAxisID:'y1' }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false, interaction:{mode:'index'},
        plugins:{ legend:{position:'top', labels:{font:{size:11},usePointStyle:true}},
          tooltip:{callbacks:{label: c => c.dataset.label==='Revenue (₹)'
            ? '₹'+c.raw.toLocaleString('en-IN') : c.raw+' bookings'}} },
        scales:{
          y:{ position:'left', beginAtZero:true, grid:{color:'rgba(0,0,0,0.04)'},
            ticks:{callback:v=>'₹'+v.toLocaleString('en-IN'), font:{size:10}} },
          y1:{ position:'right', beginAtZero:true, grid:{display:false},
            ticks:{font:{size:10}} },
          x:{ grid:{display:false}, ticks:{font:{size:10}} }
        }
      }
    });
  } catch(e) { console.error('[Revenue Chart]',e); }
}

// ── TEMPLATE CHART (doughnut) ──────────────────────────────────────
async function loadTemplateChart() {
  const canvas = document.getElementById('templateChart');
  if (!canvas || typeof Chart === 'undefined') return;
  try {
    const snap = await db.collection('bookings').get();
    const counts = {};
    snap.docs.forEach(d => {
      const t = d.data().template || 'Unknown';
      counts[t] = (counts[t]||0) + 1;
    });

    if (Object.keys(counts).length === 0) {
      canvas.parentElement.innerHTML = `<div class="empty-small" style="height:200px;display:flex;align-items:center;justify-content:center;">📭 Data nahi hai abhi</div>`;
      return;
    }

    const COLORS = ['#2563eb','#7c3aed','#16a34a','#f59e0b','#ef4444','#0891b2','#ec4899'];
    new Chart(canvas.getContext('2d'), {
      type:'doughnut',
      data:{
        labels: Object.keys(counts),
        datasets:[{ data:Object.values(counts),
          backgroundColor:COLORS.slice(0,Object.keys(counts).length),
          borderWidth:2, borderColor:'#fff', hoverOffset:8 }]
      },
      options:{
        responsive:true, maintainAspectRatio:false, cutout:'68%',
        plugins:{
          legend:{position:'bottom', labels:{font:{size:10},padding:10,usePointStyle:true}},
          tooltip:{callbacks:{label: c => `${c.label}: ${c.raw} bookings`}}
        }
      }
    });
  } catch(e) { console.error('[Template Chart]',e); }
}

// ── QUICK ACTION SHORTCUTS ─────────────────────────────────────────
function goTo(url) { window.location.href = url; }

// ── INIT (dashboard page load pe) ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboardPage')) initDashboard();
});

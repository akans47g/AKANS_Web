// ══════════════════════════════════════════════════════════════════
// admin-dashboard.js — AKANS Admin Panel
// Dashboard page ka JS — admin-all.js ke baad load karo
// ══════════════════════════════════════════════════════════════════

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
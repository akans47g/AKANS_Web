// ══════════════════════════════════════════════════════════════════
// admin-dashboard.js — AKANS Admin Panel
// Sirf admin-dashboard.html ke liye
// admin-all.js ke BAAD load karo
// ══════════════════════════════════════════════════════════════════

async function initDashboard() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('dashboard');

  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';

  await Promise.all([
    loadDashboardStats(),
    loadRecentBookings(),
    loadRecentUsers(),
  ]);

  setTimeout(() => {
    loadRevenueChart();
    loadTemplateChart();
  }, 600);
}

async function loadDashboardStats() {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [bookSnap, userSnap, revSnap] = await Promise.all([
      db.collection('bookings').get(),
      db.collection('users').get(),
      db.collection('reviews').where('approved','==',false).get(),
    ]);

    const bookings    = bookSnap.docs.map(d => ({id:d.id,...d.data()}));
    const pending     = bookings.filter(b => b.status==='pending').length;
    const revenue     = bookings.reduce((s,b) => s+(b.amountPaid||0), 0);
    const todayCount  = bookings.filter(b => {
      const t = b.createdAt?.toDate?.();
      return t && t >= today;
    }).length;

    // Update stats
    animateCount('stat-total-bookings', bookings.length);
    animateCount('stat-revenue', revenue, '₹');
    animateCount('stat-pending', pending);
    animateCount('stat-reviews', revSnap.size);
    animateCount('stat-users',   userSnap.size);

    // Today
    const todayEl = document.getElementById('stat-today');
    if (todayEl) todayEl.textContent = todayCount;

    // Badges
    setBadge('badge-bookings', pending);
    setBadge('badge-reviews',  revSnap.size);

    // Remove loading
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('loading'));

  } catch(e) {
    console.error('[Dashboard Stats]', e);
    showAdminToast('⚠️ Stats load error', 'warning');
  }
}

async function loadRecentBookings() {
  const tbody = document.getElementById('recentBookingsTbody');
  if (!tbody) return;
  try {
    const snap = await db.collection('bookings').orderBy('createdAt','desc').limit(6).get();
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">📭 Koi booking nahi</td></tr>`;
      return;
    }
    const STATUS = {
      pending:    {label:'Pending',    color:'#f59e0b', bg:'#fffbeb'},
      inprogress: {label:'In Progress',color:'#3b82f6', bg:'#eff6ff'},
      completed:  {label:'Completed',  color:'#16a34a', bg:'#f0fdf4'},
      cancelled:  {label:'Cancelled',  color:'#ef4444', bg:'#fef2f2'},
    };
    tbody.innerHTML = snap.docs.map(doc => {
      const b = doc.data();
      const s = STATUS[b.status||'pending'] || STATUS.pending;
      const date = b.createdAt?.toDate?.()
        ? b.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})
        : '—';
      return `<tr onclick="window.location='admin-bookings.html'" style="cursor:pointer;">
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

async function loadRecentUsers() {
  const list = document.getElementById('recentUsersList');
  if (!list) return;
  try {
    const snap = await db.collection('users').orderBy('createdAt','desc').limit(5).get();
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

async function loadRevenueChart() {
  const canvas = document.getElementById('revenueChart');
  if (!canvas || typeof Chart === 'undefined') return;
  try {
    const snap = await db.collection('bookings').orderBy('createdAt','desc').limit(100).get();
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
      data:{labels:days,datasets:[
        {label:'Revenue (₹)',data:revenues,borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,0.08)',fill:true,borderWidth:2.5,tension:0.4,pointBackgroundColor:'#fff',pointBorderColor:'#2563eb',pointBorderWidth:2,pointRadius:5,yAxisID:'y'},
        {label:'Bookings',data:counts,borderColor:'#7c3aed',backgroundColor:'transparent',borderWidth:2,borderDash:[5,4],tension:0.4,pointRadius:3,yAxisID:'y1'}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'top',labels:{font:{size:11},usePointStyle:true}},
          tooltip:{callbacks:{label:c=>c.dataset.label==='Revenue (₹)'?'₹'+c.raw.toLocaleString('en-IN'):c.raw+' bookings'}}},
        scales:{
          y:{position:'left',beginAtZero:true,grid:{color:'rgba(0,0,0,0.04)'},ticks:{callback:v=>'₹'+v.toLocaleString('en-IN'),font:{size:10}}},
          y1:{position:'right',beginAtZero:true,grid:{display:false},ticks:{font:{size:10}}},
          x:{grid:{display:false},ticks:{font:{size:10}}}
        }
      }
    });
  } catch(e) { console.error('[Revenue Chart]', e); }
}

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
    if (!Object.keys(counts).length) {
      canvas.parentElement.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:#94a3b8;font-size:0.85rem;">📭 Data nahi hai</div>`;
      return;
    }
    const COLORS = ['#2563eb','#7c3aed','#16a34a','#f59e0b','#ef4444','#0891b2','#ec4899'];
    new Chart(canvas.getContext('2d'), {
      type:'doughnut',
      data:{labels:Object.keys(counts),datasets:[{data:Object.values(counts),backgroundColor:COLORS.slice(0,Object.keys(counts).length),borderWidth:2,borderColor:'#fff',hoverOffset:8}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',
        plugins:{legend:{position:'bottom',labels:{font:{size:10},padding:10,usePointStyle:true}},
          tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw} bookings`}}}
      }
    });
  } catch(e) { console.error('[Template Chart]', e); }
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboardPage')) initDashboard();
});

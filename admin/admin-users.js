// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Page specific JS
// admin-shared.js ke baad load karo
// ══════════════════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 7 — admin-users.html                        ║
// ╚══════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────
let allUsers      = [];
let filteredUsers = [];
let userFilter    = 'all';
let userSearch    = '';
let userSort      = 'newest';
let viewingUserId = null;
let unsubUsers    = null;

// ── INIT ──────────────────────────────────────────────────────────
async function initUsers() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('users');
  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';
  startUsersListener();
}

// ── REAL-TIME LISTENER ─────────────────────────────────────────────
function startUsersListener() {
  if (unsubUsers) unsubUsers();
  setUsersLoading(true);

  unsubUsers = db.collection('users')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      allUsers = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      updateUserStats();
      applyUserFilter();
      setUsersLoading(false);
    }, err => {
      console.error('[Users]', err);
      showAdminToast('⚠️ Users load error', 'error');
      setUsersLoading(false);
    });
}

function setUsersLoading(loading) {
  const grid = document.getElementById('usersGrid');
  if (!grid || !loading) return;
  grid.innerHTML = `<div class="usr-loading">
    <div class="usr-spinner"></div>
    <span>Users load ho rahe hain...</span>
  </div>`;
}

// ── STATS ──────────────────────────────────────────────────────────
function updateUserStats() {
  const today   = new Date(); today.setHours(0,0,0,0);
  const total   = allUsers.length;
  const newToday = allUsers.filter(u => {
    const t = u.createdAt?.toDate?.();
    return t && t >= today;
  }).length;
  const admins  = allUsers.filter(u => u.role === 'admin').length;
  const blocked = allUsers.filter(u => u.blocked === true).length;

  setElU('usr-stat-total',    total);
  setElU('usr-stat-today',    newToday);
  setElU('usr-stat-admins',   admins);
  setElU('usr-stat-blocked',  blocked);
}

function setElU(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── FILTER + SEARCH + SORT ─────────────────────────────────────────
function switchUserFilter(filter) {
  userFilter = filter;
  document.querySelectorAll('.usr-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.filter === filter));
  applyUserFilter();
}

function onUserSearch(val) {
  userSearch = val.toLowerCase().trim();
  applyUserFilter();
}

function onUserSort(val) {
  userSort = val;
  applyUserFilter();
}

function applyUserFilter() {
  filteredUsers = allUsers.filter(u => {
    if (userFilter === 'admin')   return u.role === 'admin';
    if (userFilter === 'blocked') return u.blocked === true;
    if (userFilter === 'new') {
      const today = new Date(); today.setHours(0,0,0,0);
      const t = u.createdAt?.toDate?.();
      return t && t >= today;
    }
    return true;
  }).filter(u => {
    if (!userSearch) return true;
    return [u.displayName, u.email, u.whatsapp, u.uid, u._id]
      .join(' ').toLowerCase().includes(userSearch);
  });

  // Sort
  if (userSort === 'newest') filteredUsers.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  if (userSort === 'oldest') filteredUsers.sort((a,b) => (a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
  if (userSort === 'name')   filteredUsers.sort((a,b) => (a.displayName||'').localeCompare(b.displayName||''));

  renderUsersGrid();
  const cEl = document.getElementById('usr-showing');
  if (cEl) cEl.textContent = `${filteredUsers.length} user${filteredUsers.length!==1?'s':''} mil ${filteredUsers.length!==1?'gaye':'gaya'}`;
}

// ── RENDER GRID ────────────────────────────────────────────────────
function renderUsersGrid() {
  const grid = document.getElementById('usersGrid');
  if (!grid) return;

  if (filteredUsers.length === 0) {
    grid.innerHTML = `<div class="usr-empty">
      <div class="usr-empty-icon">👥</div>
      <div class="usr-empty-title">Koi user nahi mila</div>
      <div class="usr-empty-sub">Filter ya search badlo</div>
    </div>`;
    return;
  }

  grid.innerHTML = filteredUsers.map(u => buildUserCard(u)).join('');
}

// ── BUILD USER CARD ────────────────────────────────────────────────
function buildUserCard(u) {
  const name    = u.displayName || u.email?.split('@')[0] || 'User';
  const initial = name.charAt(0).toUpperCase();
  const date    = u.createdAt?.toDate?.()
    ? u.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})
    : '—';
  const isAdmin   = u.role === 'admin';
  const isBlocked = u.blocked === true;

  return `<div class="usr-card ${isBlocked ? 'usr-blocked' : ''}" id="usr-card-${u._id}">

    <div class="usr-card-top">
      <div class="usr-avatar-wrap">
        ${u.photoURL
          ? `<img src="${u.photoURL}" class="usr-avatar-img" alt="${name}" onerror="this.style.display='none';this.nextSibling.style.display='flex'"/>
             <div class="usr-avatar" style="display:none;">${initial}</div>`
          : `<div class="usr-avatar">${initial}</div>`}
        ${isBlocked ? `<div class="usr-blocked-dot" title="Blocked">🚫</div>` : ''}
      </div>
      <div class="usr-info">
        <div class="usr-name">${name}
          ${isAdmin ? `<span class="usr-admin-badge">👑 Admin</span>` : ''}
        </div>
        <div class="usr-email">${u.email || '—'}</div>
        ${u.whatsapp ? `<div class="usr-wa">📱 ${u.whatsapp}</div>` : ''}
      </div>
    </div>

    <div class="usr-meta-row">
      <div class="usr-meta-item">
        <span class="usr-meta-label">Joined</span>
        <span class="usr-meta-val">${date}</span>
      </div>
      <div class="usr-meta-item">
        <span class="usr-meta-label">Ref Code</span>
        <span class="usr-meta-val">${u.referralCode || '—'}</span>
      </div>
      <div class="usr-meta-item">
        <span class="usr-meta-label">Referred By</span>
        <span class="usr-meta-val">${u.referredBy || '—'}</span>
      </div>
    </div>

    <div class="usr-actions">
      <button class="usr-btn usr-btn-view"  onclick="openUserDetail('${u._id}')">👁️ View</button>
      ${u.whatsapp
        ? `<a class="usr-btn usr-btn-wa" href="https://wa.me/91${u.whatsapp}" target="_blank" rel="noopener">💬 Chat</a>`
        : `<button class="usr-btn usr-btn-wa" disabled style="opacity:0.4;">💬 Chat</button>`}
      ${isBlocked
        ? `<button class="usr-btn usr-btn-unblock" onclick="unblockUser('${u._id}')">✅ Unblock</button>`
        : `<button class="usr-btn usr-btn-block"   onclick="blockUser('${u._id}','${name}')">🚫 Block</button>`}
      <button class="usr-btn usr-btn-delete" onclick="deleteUser('${u._id}','${name}')">🗑️</button>
    </div>
  </div>`;
}

// ── VIEW USER DETAIL MODAL ─────────────────────────────────────────
async function openUserDetail(id) {
  viewingUserId = id;
  const modal = document.getElementById('userModal');
  if (!modal) return;
  modal.classList.add('open');
  document.getElementById('userModalContent').innerHTML =
    `<div style="text-align:center;padding:3rem;color:#94a3b8;">⏳ Loading...</div>`;

  try {
    const [userDoc, ordersSnap, refSnap] = await Promise.all([
      db.collection('users').doc(id).get(),
      db.collection('bookings').where('userId','==',id).get(),
      db.collection('referrals').doc(id).get()
    ]);

    if (!userDoc.exists) { showAdminToast('❌ User nahi mila','error'); closeUserModal(); return; }
    const u    = { _id: userDoc.id, ...userDoc.data() };
    const name = u.displayName || u.email?.split('@')[0] || 'User';
    const initial = name.charAt(0).toUpperCase();
    const orders = ordersSnap.docs.map(d => d.data());
    const totalSpent = orders.reduce((s,o) => s + (o.amountPaid||0), 0);
    const refData = refSnap.exists ? refSnap.data() : {};
    const joinDate = u.createdAt?.toDate?.()
      ? u.createdAt.toDate().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})
      : '—';

    document.getElementById('userModalContent').innerHTML = `
      <div class="umd-body">

        <!-- Profile -->
        <div class="umd-profile">
          ${u.photoURL
            ? `<img src="${u.photoURL}" class="umd-avatar-img" alt="${name}"/>`
            : `<div class="umd-avatar">${initial}</div>`}
          <div>
            <div class="umd-name">${name}
              ${u.role==='admin' ? '<span class="usr-admin-badge">👑 Admin</span>' : ''}
              ${u.blocked ? '<span style="color:#ef4444;font-size:0.75rem;font-weight:700;">🚫 Blocked</span>' : ''}
            </div>
            <div class="umd-email">${u.email||'—'}</div>
            <div class="umd-joined">📅 Joined: ${joinDate}</div>
          </div>
        </div>

        <!-- Stats -->
        <div class="umd-stats">
          <div class="umd-stat"><span>${orders.length}</span>Total Orders</div>
          <div class="umd-stat"><span>₹${totalSpent.toLocaleString('en-IN')}</span>Total Spent</div>
          <div class="umd-stat"><span>${refData.totalReferred||0}</span>Referred</div>
          <div class="umd-stat"><span>₹${refData.totalEarned||0}</span>Earned</div>
        </div>

        <!-- Details -->
        <div class="umd-detail-grid">
          <div class="umd-detail"><span class="umd-dl">WhatsApp</span><span class="umd-dv">${u.whatsapp||'—'}</span></div>
          <div class="umd-detail"><span class="umd-dl">Referral Code</span><span class="umd-dv">${refData.code||'—'}</span></div>
          <div class="umd-detail"><span class="umd-dl">Referred By</span><span class="umd-dv">${u.referredBy||'None'}</span></div>
          <div class="umd-detail"><span class="umd-dl">User ID</span><span class="umd-dv" style="font-family:monospace;font-size:0.72rem;">${u.uid||u._id}</span></div>
        </div>

        <!-- Role Change -->
        <div class="umd-section">
          <div class="umd-sec-title">⚙️ Admin Actions</div>
          <div class="umd-action-row">
            ${u.role==='admin'
              ? `<button class="umd-btn umd-btn-remove-admin" onclick="setAdminRole('${u._id}',false)">👤 Remove Admin Role</button>`
              : `<button class="umd-btn umd-btn-make-admin"  onclick="setAdminRole('${u._id}',true)">👑 Make Admin</button>`}
            ${u.blocked
              ? `<button class="umd-btn umd-btn-unblock" onclick="unblockUser('${u._id}');closeUserModal()">✅ Unblock User</button>`
              : `<button class="umd-btn umd-btn-block"   onclick="blockUser('${u._id}','${name}')">🚫 Block User</button>`}
            ${u.whatsapp
              ? `<a class="umd-btn umd-btn-wa" href="https://wa.me/91${u.whatsapp}" target="_blank" rel="noopener">💬 WhatsApp</a>`
              : ''}
          </div>
        </div>

        <!-- Recent Orders -->
        ${orders.length > 0 ? `
        <div class="umd-section">
          <div class="umd-sec-title">📦 Recent Bookings (${orders.length})</div>
          ${orders.slice(0,3).map(o => `
            <div class="umd-order-row">
              <span>🎨 ${o.template||'—'}</span>
              <span style="color:#16a34a;font-weight:700;">₹${(o.amountPaid||0).toLocaleString('en-IN')}</span>
              <span style="color:#94a3b8;font-size:0.75rem;">${o.status||'pending'}</span>
            </div>`).join('')}
        </div>` : ''}

      </div>
    `;
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
    closeUserModal();
  }
}

function closeUserModal() {
  document.getElementById('userModal')?.classList.remove('open');
  viewingUserId = null;
}

// ── BLOCK / UNBLOCK ────────────────────────────────────────────────
async function blockUser(id, name) {
  if (!confirm(`⚠️ "${name}" ko block karna chahte ho? Woh login nahi kar payega.`)) return;
  try {
    await db.collection('users').doc(id).update({ blocked: true, blockedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showAdminToast('🚫 User blocked', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

async function unblockUser(id) {
  try {
    await db.collection('users').doc(id).update({ blocked: false });
    showAdminToast('✅ User unblocked', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── ADMIN ROLE ─────────────────────────────────────────────────────
async function setAdminRole(id, makeAdmin) {
  if (!confirm(makeAdmin ? '👑 Is user ko admin banana chahte ho?' : '👤 Admin role remove karna chahte ho?')) return;
  try {
    await db.collection('users').doc(id).update({ role: makeAdmin ? 'admin' : 'user' });
    showAdminToast(makeAdmin ? '👑 Admin role diya!' : '👤 Admin role hata diya', 'success');
    closeUserModal();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── DELETE USER ────────────────────────────────────────────────────
async function deleteUser(id, name) {
  if (!confirm(`⚠️ "${name}" ko permanently delete karna chahte ho?`)) return;
  try {
    await db.collection('users').doc(id).delete();
    showAdminToast('🗑️ User deleted', 'success');
    closeUserModal();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── EXPORT CSV ─────────────────────────────────────────────────────
function exportUsersCSV() {
  if (filteredUsers.length === 0) { showAdminToast('⚠️ Koi user nahi hai', 'warning'); return; }
  const headers = ['Name','Email','WhatsApp','Role','Status','Referred By','Joined'];
  const rows = filteredUsers.map(u => [
    u.displayName||'', u.email||'', u.whatsapp||'',
    u.role||'user', u.blocked ? 'Blocked' : 'Active',
    u.referredBy||'',
    u.createdAt?.toDate?.()?.toLocaleDateString('en-IN')||''
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));
  const csv  = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`akans-users-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showAdminToast('✅ CSV downloaded!', 'success');
}

// ── CLEANUP ────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => { if(unsubUsers) unsubUsers(); });

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('usersPage')) initUsers();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 8, 9... admin-all2.js mein aage add honge         ║
// ╚══════════════════════════════════════════════════════════════╝
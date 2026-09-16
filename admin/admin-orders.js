// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Page specific JS
// admin-shared.js ke baad load karo
// ══════════════════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 10 — admin-orders.html                      ║
// ╚══════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────
let allOrders      = [];
let filteredOrders = [];
let ordFilter      = 'all';
let ordSearch      = '';
let editingOrdId   = null;
let unsubOrders    = null;

// ── INIT ──────────────────────────────────────────────────────────
async function initOrders() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('orders');
  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';
  startOrdersListener();
}

// ── REAL-TIME LISTENER ─────────────────────────────────────────────
function startOrdersListener() {
  if (unsubOrders) unsubOrders();
  setOrdLoading(true);

  unsubOrders = db.collection('orders')
    .orderBy('createdAt','desc')
    .onSnapshot(snap => {
      allOrders = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      updateOrderStats();
      applyOrdFilter();
      setOrdLoading(false);
    }, err => {
      console.error('[Orders]', err);
      showAdminToast('⚠️ Orders load error', 'error');
      setOrdLoading(false);
    });
}

function setOrdLoading(loading) {
  const grid = document.getElementById('ordersGrid');
  if (!grid || !loading) return;
  grid.innerHTML = `<div class="ord-loading">
    <div class="ord-spinner"></div>
    <span>Orders load ho rahe hain...</span>
  </div>`;
}

// ── STATS ──────────────────────────────────────────────────────────
function updateOrderStats() {
  const total     = allOrders.length;
  const active    = allOrders.filter(o => o.status === 'active').length;
  const delivered = allOrders.filter(o => o.status === 'delivered').length;
  const expired   = allOrders.filter(o => o.status === 'expired').length;
  const revenue   = allOrders.reduce((s,o) => s + (o.amount||0), 0);

  setElO('ord-stat-total',     total);
  setElO('ord-stat-active',    active);
  setElO('ord-stat-delivered', delivered);
  setElO('ord-stat-expired',   expired);
  setElO('ord-stat-revenue',   '₹' + revenue.toLocaleString('en-IN'));

  // Tab counts
  setElO('ord-count-all',       total);
  setElO('ord-count-active',    active);
  setElO('ord-count-delivered', delivered);
  setElO('ord-count-expired',   expired);
}

function setElO(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── FILTER + SEARCH ────────────────────────────────────────────────
function switchOrdFilter(filter) {
  ordFilter = filter;
  document.querySelectorAll('.ord-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.filter === filter));
  applyOrdFilter();
}

function onOrdSearch(val) {
  ordSearch = val.toLowerCase().trim();
  applyOrdFilter();
}

function applyOrdFilter() {
  filteredOrders = allOrders.filter(o => {
    if (ordFilter !== 'all' && o.status !== ordFilter) return false;
    if (!ordSearch) return true;
    return [o.couple, o.template, o.orderId, o._id, o.link]
      .join(' ').toLowerCase().includes(ordSearch);
  });
  renderOrdersGrid();

  const cEl = document.getElementById('ord-showing');
  if (cEl) cEl.textContent = `${filteredOrders.length} order${filteredOrders.length !== 1 ? 's' : ''}`;
}

// ── RENDER GRID ────────────────────────────────────────────────────
function renderOrdersGrid() {
  const grid = document.getElementById('ordersGrid');
  if (!grid) return;

  if (filteredOrders.length === 0) {
    grid.innerHTML = `<div class="ord-empty">
      <div class="ord-empty-icon">📋</div>
      <div class="ord-empty-title">Koi order nahi mila</div>
      <div class="ord-empty-sub">Filter badlo ya booking submit karo</div>
    </div>`;
    return;
  }

  grid.innerHTML = filteredOrders.map(o => buildOrderCard(o)).join('');
}

// ── BUILD ORDER CARD ───────────────────────────────────────────────
function buildOrderCard(o) {
  const STATUS = {
    active:    { label:'🟢 Active',    cls:'ost-active'    },
    delivered: { label:'✅ Delivered', cls:'ost-delivered' },
    expired:   { label:'🔴 Expired',   cls:'ost-expired'   },
  };
  const s      = STATUS[o.status] || STATUS.active;
  const shortId = o.orderId || ('#AK' + o._id.slice(-6).toUpperCase());
  const date    = o.createdAt?.toDate?.()
    ? o.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})
    : o.orderDate || '—';
  const hasLink = !!o.link && o.link !== '#';

  return `<div class="ord-card" id="ord-card-${o._id}">

    <div class="ord-card-top">
      <div class="ord-id">${shortId}</div>
      <span class="${s.cls} ord-status-pill">${s.label}</span>
    </div>

    <div class="ord-template">🎨 ${o.template || '—'}</div>
    <div class="ord-couple">💑 ${o.couple || '—'}</div>

    <div class="ord-meta-row">
      <span>💒 ${o.weddingDate || '—'}</span>
      <span>📅 ${date}</span>
      <span class="ord-amount">₹${(o.amount||0).toLocaleString('en-IN')}</span>
    </div>

    ${hasLink ? `
    <div class="ord-link-row">
      <span class="ord-link-label">🔗 Card Link:</span>
      <a href="${o.link}" target="_blank" class="ord-link-val">${o.link}</a>
    </div>` : `
    <div class="ord-no-link">⚠️ Card link abhi add nahi hua</div>`}

    <div class="ord-actions">
      <button class="ord-btn ord-btn-edit" onclick="openOrdEdit('${o._id}')">✏️ Edit</button>
      ${hasLink
        ? `<a class="ord-btn ord-btn-link" href="${o.link}" target="_blank" rel="noopener">🔗 View Card</a>`
        : `<button class="ord-btn ord-btn-addlink" onclick="openOrdEdit('${o._id}')">🔗 Add Link</button>`}
      <button class="ord-btn ord-btn-wa"
        onclick="sendOrdWhatsApp('${o._id}')"
        title="Send WhatsApp">💬</button>
      <button class="ord-btn ord-btn-delete" onclick="deleteOrder('${o._id}')">🗑️</button>
    </div>
  </div>`;
}

// ── OPEN EDIT MODAL ────────────────────────────────────────────────
function openOrdEdit(id) {
  const o = allOrders.find(x => x._id === id);
  if (!o) return;
  editingOrdId = id;

  document.getElementById('ord-edit-id').textContent    = o.orderId || ('#AK' + id.slice(-6).toUpperCase());
  document.getElementById('ord-edit-couple').textContent = o.couple || '—';
  document.getElementById('ord-edit-template').textContent = o.template || '—';
  document.getElementById('ord-edit-status').value      = o.status || 'active';
  document.getElementById('ord-edit-link').value        = o.link && o.link !== '#' ? o.link : '';
  document.getElementById('ord-edit-note').value        = o.adminNote || '';

  document.getElementById('ordEditModal').classList.add('open');
}

function closeOrdModal() {
  document.getElementById('ordEditModal').classList.remove('open');
  editingOrdId = null;
}

// ── SAVE ORDER ─────────────────────────────────────────────────────
async function saveOrdChanges() {
  if (!editingOrdId) return;
  const status    = document.getElementById('ord-edit-status').value;
  const link      = document.getElementById('ord-edit-link').value.trim();
  const adminNote = document.getElementById('ord-edit-note').value.trim();

  const btn = document.getElementById('ordSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

  try {
    await db.collection('orders').doc(editingOrdId).update({
      status, link: link || '#', adminNote,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // bookings collection bhi update karo (status sync)
    const o = allOrders.find(x => x._id === editingOrdId);
    if (o?.userId) {
      const bSnap = await db.collection('bookings')
        .where('userId','==', o.userId).limit(1).get();
      if (!bSnap.empty) {
        await db.collection('bookings').doc(bSnap.docs[0].id).update({
          status, cardLink: link || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    showAdminToast('✅ Order updated!', 'success');
    closeOrdModal();

    // Auto WhatsApp if delivered + link
    if (status === 'delivered' && link) {
      const ord = allOrders.find(x => x._id === editingOrdId);
      if (ord) sendOrdWhatsApp(editingOrdId, ord, link);
    }
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Changes'; }
  }
}

// ── SEND WHATSAPP ──────────────────────────────────────────────────
async function sendOrdWhatsApp(id, ordData, cardLink) {
  const o = ordData || allOrders.find(x => x._id === id);
  if (!o) return;

  // Get WhatsApp from bookings
  let wa = '';
  try {
    if (o.userId) {
      const bSnap = await db.collection('bookings')
        .where('userId','==', o.userId).limit(1).get();
      if (!bSnap.empty) wa = bSnap.docs[0].data().whatsapp || '';
    }
  } catch(e) {}

  if (!wa) { showAdminToast('⚠️ WhatsApp number nahi mila', 'warning'); return; }

  const link  = cardLink || o.link || '';
  const msg   = link
    ? `🎉 *AKANS Web Development Services*\n\nAssalamu Alaikum! Aapka digital wedding card ready ho gaya hai! 💍\n\n💑 *${o.couple || ''}*\n🎨 Template: ${o.template || ''}\n\n🔗 *Card Link:*\n${link}\n\nMubarakbaad! 🎊`
    : `🎉 *AKANS Web Development Services*\n\nAssalamu Alaikum! Aapka order (${o.orderId || ''}) process ho raha hai. Jald hi card bheja jayega. 💍`;

  window.open(`https://wa.me/91${wa}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── DELETE ORDER ───────────────────────────────────────────────────
async function deleteOrder(id) {
  if (!confirm('⚠️ Yeh order permanently delete karna chahte ho?')) return;
  try {
    await db.collection('orders').doc(id).delete();
    showAdminToast('🗑️ Order deleted', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── EXPORT CSV ─────────────────────────────────────────────────────
function exportOrdersCSV() {
  if (filteredOrders.length === 0) { showAdminToast('⚠️ Koi order nahi hai', 'warning'); return; }
  const headers = ['Order ID','Template','Couple','Wedding Date','Amount','Status','Card Link','Order Date'];
  const rows = filteredOrders.map(o => [
    o.orderId || '#AK'+o._id.slice(-6).toUpperCase(),
    o.template||'', o.couple||'', o.weddingDate||'',
    o.amount||0, o.status||'active',
    o.link && o.link!=='#' ? o.link : '',
    o.orderDate||''
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));

  const csv  = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`akans-orders-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showAdminToast('✅ CSV downloaded!', 'success');
}

// ── CLEANUP ────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => { if(unsubOrders) unsubOrders(); });

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('ordersPage')) initOrders();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 11 — Admin-whatsapp.html yahan add hoga           ║
// ╚══════════════════════════════════════════════════════════════╝
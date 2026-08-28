// ══════════════════════════════════════════════════════════════════
// admin-all2.js — AKANS Admin Panel (Part 2)
// Sections 5+ ka JS code (admin-all.js se alag)
// Firebase firebase-config.js se load hota hai
// ══════════════════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 5 — admin-reviews.html                      ║
// ╚══════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────
let allReviews      = [];
let filteredReviews = [];
let revFilter       = 'all';
let revSearch       = '';
let revSort         = 'newest';
let editingRevId    = null;
let selectedRevIds  = new Set();
let unsubReviews    = null;

// ── INIT ──────────────────────────────────────────────────────────
async function initReviews() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('reviews');

  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';

  startReviewsListener();
}

// ── REAL-TIME LISTENER ─────────────────────────────────────────────
function startReviewsListener() {
  if (unsubReviews) unsubReviews();
  setRevLoading(true);

  unsubReviews = db.collection('reviews')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      allReviews = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      updateRevStats();
      applyRevFilter();
      setRevLoading(false);
    }, err => {
      console.error('[Reviews]', err);
      showAdminToast('⚠️ Reviews load error', 'error');
      setRevLoading(false);
    });
}

function setRevLoading(loading) {
  const grid = document.getElementById('reviewsGrid');
  if (!grid || !loading) return;
  grid.innerHTML = `<div class="rev-loading">
    <div class="rev-spinner"></div>
    <span>Reviews load ho rahi hain...</span>
  </div>`;
}

// ── STATS ──────────────────────────────────────────────────────────
function updateRevStats() {
  const total    = allReviews.length;
  const pending  = allReviews.filter(r => !r.approved && r.approved !== false ? false : !r.approved).length;
  const approved = allReviews.filter(r => r.approved === true).length;
  const avg      = total > 0
    ? (allReviews.reduce((s,r) => s + (r.rating||0), 0) / total).toFixed(1)
    : '—';

  setEl('rev-stat-total',    total);
  setEl('rev-stat-pending',  pending);
  setEl('rev-stat-approved', approved);
  setEl('rev-stat-avg',      avg + (total > 0 ? '⭐' : ''));
  setBadge('badge-reviews', pending);

  // Tab counts
  setEl('rev-count-all',      total);
  setEl('rev-count-pending',  pending);
  setEl('rev-count-approved', approved);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── FILTER + SEARCH + SORT ─────────────────────────────────────────
function switchRevFilter(filter) {
  revFilter = filter;
  document.querySelectorAll('.rev-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.filter === filter));
  applyRevFilter();
}

function onRevSearch(val) {
  revSearch = val.toLowerCase().trim();
  applyRevFilter();
}

function onRevSort(val) {
  revSort = val;
  applyRevFilter();
}

function applyRevFilter() {
  filteredReviews = allReviews.filter(r => {
    // Filter
    if (revFilter === 'pending')  return !r.approved;
    if (revFilter === 'approved') return r.approved === true;
    return true;
  }).filter(r => {
    if (!revSearch) return true;
    return [r.name, r.template, r.text, r._id]
      .join(' ').toLowerCase().includes(revSearch);
  });

  // Sort
  if (revSort === 'newest')  filteredReviews.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  if (revSort === 'oldest')  filteredReviews.sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
  if (revSort === 'highest') filteredReviews.sort((a,b) => (b.rating||0) - (a.rating||0));
  if (revSort === 'lowest')  filteredReviews.sort((a,b) => (a.rating||0) - (b.rating||0));

  renderReviewsGrid();

  const cEl = document.getElementById('rev-showing');
  if (cEl) cEl.textContent = `${filteredReviews.length} review${filteredReviews.length!==1?'s':''} dikh rahi hain`;
}

// ── RENDER GRID ────────────────────────────────────────────────────
function renderReviewsGrid() {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;

  if (filteredReviews.length === 0) {
    grid.innerHTML = `<div class="rev-empty">
      <div class="rev-empty-icon">📭</div>
      <div class="rev-empty-title">Koi review nahi mili</div>
      <div class="rev-empty-sub">Filter ya search badlo</div>
    </div>`;
    return;
  }

  grid.innerHTML = filteredReviews.map(r => buildRevCard(r)).join('');
}

// ── BUILD REVIEW CARD ──────────────────────────────────────────────
function buildRevCard(r) {
  const stars = '⭐'.repeat(r.rating||0) + '☆'.repeat(5-(r.rating||0));
  const date  = r.createdAt?.toDate?.()
    ? r.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})
    : r.date || '—';
  const isApproved = r.approved === true;
  const initials   = (r.avatar || (r.name||'U').slice(0,2).toUpperCase());

  return `<div class="rev-card ${isApproved ? 'rev-approved' : 'rev-pending'}" id="rev-card-${r._id}">

    <div class="rev-card-top">
      <!-- Select checkbox -->
      <input type="checkbox" class="rev-checkbox"
             onchange="toggleRevSelect('${r._id}',this.checked)"
             title="Select"/>
      <!-- Avatar -->
      <div class="rev-avatar">${initials}</div>
      <div class="rev-meta">
        <div class="rev-name">${r.name || 'Anonymous'}</div>
        <div class="rev-template">🎨 ${r.template || '—'}</div>
      </div>
      <div class="rev-right">
        <div class="rev-stars">${stars}</div>
        <div class="rev-date">${date}</div>
      </div>
    </div>

    <div class="rev-text">"${r.text || '—'}"</div>

    <div class="rev-footer">
      <span class="rev-status-badge ${isApproved ? 'badge-approved' : 'badge-pending'}">
        ${isApproved ? '✅ Approved' : '⏳ Pending'}
      </span>
      <div class="rev-actions">
        ${!isApproved
          ? `<button class="rev-btn rev-btn-approve" onclick="approveReview('${r._id}')">✅ Approve</button>`
          : `<button class="rev-btn rev-btn-unapprove" onclick="unapproveReview('${r._id}')">↩️ Unapprove</button>`}
        <button class="rev-btn rev-btn-edit"   onclick="openEditReview('${r._id}')">✏️ Edit</button>
        <button class="rev-btn rev-btn-delete" onclick="deleteReview('${r._id}')">🗑️</button>
      </div>
    </div>
  </div>`;
}

// ── SELECT / BULK ACTIONS ──────────────────────────────────────────
function toggleRevSelect(id, checked) {
  checked ? selectedRevIds.add(id) : selectedRevIds.delete(id);
  updateBulkBar();
}

function selectAllPending() {
  selectedRevIds = new Set(allReviews.filter(r => !r.approved).map(r => r._id));
  document.querySelectorAll('.rev-checkbox').forEach(cb => {
    const cardId = cb.closest('.rev-card')?.id?.replace('rev-card-','');
    cb.checked = selectedRevIds.has(cardId);
  });
  updateBulkBar();
}

function clearSelection() {
  selectedRevIds.clear();
  document.querySelectorAll('.rev-checkbox').forEach(cb => cb.checked = false);
  updateBulkBar();
}

function updateBulkBar() {
  const bar   = document.getElementById('bulkBar');
  const count = document.getElementById('bulkCount');
  if (!bar) return;
  if (selectedRevIds.size > 0) {
    bar.classList.add('show');
    if (count) count.textContent = selectedRevIds.size;
  } else {
    bar.classList.remove('show');
  }
}

async function bulkApprove() {
  if (selectedRevIds.size === 0) return;
  if (!confirm(`${selectedRevIds.size} reviews approve karna chahte ho?`)) return;

  const btn = document.getElementById('bulkApproveBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Approving...'; }

  try {
    const batch = db.batch();
    selectedRevIds.forEach(id => {
      batch.update(db.collection('reviews').doc(id), {
        approved: true,
        approvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    showAdminToast(`✅ ${selectedRevIds.size} reviews approved!`, 'success');
    clearSelection();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Approve Selected'; }
  }
}

async function bulkDelete() {
  if (selectedRevIds.size === 0) return;
  if (!confirm(`⚠️ ${selectedRevIds.size} reviews permanently delete karna chahte ho?`)) return;
  try {
    const batch = db.batch();
    selectedRevIds.forEach(id => batch.delete(db.collection('reviews').doc(id)));
    await batch.commit();
    showAdminToast(`🗑️ ${selectedRevIds.size} reviews deleted`, 'success');
    clearSelection();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── SINGLE ACTIONS ─────────────────────────────────────────────────
async function approveReview(id) {
  try {
    await db.collection('reviews').doc(id).update({
      approved:   true,
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showAdminToast('✅ Review approved!', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

async function unapproveReview(id) {
  try {
    await db.collection('reviews').doc(id).update({ approved: false });
    showAdminToast('↩️ Review unapproved', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

async function deleteReview(id) {
  if (!confirm('⚠️ Yeh review permanently delete ho jaayegi?')) return;
  try {
    await db.collection('reviews').doc(id).delete();
    showAdminToast('🗑️ Review deleted', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── EDIT REVIEW ────────────────────────────────────────────────────
function openEditReview(id) {
  const r = allReviews.find(x => x._id === id);
  if (!r) return;
  editingRevId = id;

  document.getElementById('rev-edit-name').value     = r.name || '';
  document.getElementById('rev-edit-template').value = r.template || '';
  document.getElementById('rev-edit-text').value     = r.text || '';
  document.getElementById('rev-edit-rating').value   = r.rating || 5;
  document.getElementById('rev-edit-approved').checked = r.approved === true;
  updateStarPreview(r.rating || 5);

  document.getElementById('revEditModal').classList.add('open');
}

function closeRevModal() {
  document.getElementById('revEditModal').classList.remove('open');
  editingRevId = null;
}

function updateStarPreview(val) {
  const el = document.getElementById('rev-star-preview');
  if (el) el.textContent = '⭐'.repeat(parseInt(val)) + '☆'.repeat(5-parseInt(val));
}

async function saveRevEdit() {
  if (!editingRevId) return;
  const name     = document.getElementById('rev-edit-name').value.trim();
  const template = document.getElementById('rev-edit-template').value.trim();
  const text     = document.getElementById('rev-edit-text').value.trim();
  const rating   = parseInt(document.getElementById('rev-edit-rating').value);
  const approved = document.getElementById('rev-edit-approved').checked;

  if (!name) { showAdminToast('⚠️ Naam daalo', 'warning'); return; }
  if (!text)  { showAdminToast('⚠️ Review text daalo', 'warning'); return; }

  const btn = document.getElementById('revSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

  const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

  try {
    await db.collection('reviews').doc(editingRevId).update({
      name, template, text, rating, approved,
      avatar:    initials,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showAdminToast('✅ Review updated!', 'success');
    closeRevModal();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Karo'; }
  }
}

// ── EXPORT CSV ─────────────────────────────────────────────────────
function exportReviewsCSV() {
  if (filteredReviews.length === 0) {
    showAdminToast('⚠️ Koi review nahi hai export karne ke liye', 'warning');
    return;
  }
  const headers = ['Name','Template','Rating','Review Text','Status','Date'];
  const rows = filteredReviews.map(r => [
    r.name||'', r.template||'', r.rating||'',
    (r.text||'').replace(/"/g,'""'),
    r.approved ? 'Approved' : 'Pending',
    r.date || ''
  ].map(v => `"${v}"`));

  const csv  = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `akans-reviews-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showAdminToast('✅ CSV downloaded!', 'success');
}

// ── CLEANUP ────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (unsubReviews) unsubReviews();
});

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('reviewsPage')) initReviews();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 6, 7... admin-all2.js mein aage add honge         ║
// ╚══════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 6 — admin-coupons.html                      ║
// ╚══════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────
let allCoupons   = [];
let editingCpnId = null;

// ── INIT ──────────────────────────────────────────────────────────
async function initCoupons() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('coupons');
  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';
  await loadCoupons();
}

// ── LOAD COUPONS ───────────────────────────────────────────────────
async function loadCoupons() {
  setCpnLoading(true);
  try {
    const snap = await db.collection('coupons').orderBy('createdAt','desc').get();

    if (snap.empty) {
      // Seed default coupon (AKANS_100)
      await db.collection('coupons').add({
        code:          'AKANS_100',
        discountType:  'fixed',
        discountValue: 100,
        description:   'Welcome offer — ₹100 off',
        minOrder:      0,
        maxUses:       999,
        usedCount:     0,
        active:        true,
        expiryDate:    null,
        createdAt:     firebase.firestore.FieldValue.serverTimestamp()
      });
      await loadCoupons();
      return;
    }

    allCoupons = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    updateCpnStats();
    renderCouponsGrid();
  } catch(e) {
    console.error('[Coupons]', e);
    showAdminToast('⚠️ Coupons load error: ' + e.message, 'error');
  }
  setCpnLoading(false);
}

function setCpnLoading(loading) {
  const grid = document.getElementById('couponsGrid');
  if (!grid || !loading) return;
  grid.innerHTML = `<div class="cpn-loading">
    <div class="cpn-spinner"></div><span>Coupons load ho rahe hain...</span>
  </div>`;
}

// ── STATS ──────────────────────────────────────────────────────────
function updateCpnStats() {
  const now        = new Date();
  const total      = allCoupons.length;
  const active     = allCoupons.filter(c => c.active && (!c.expiryDate || c.expiryDate.toDate?.() > now)).length;
  const totalUses  = allCoupons.reduce((s,c) => s + (c.usedCount||0), 0);
  const totalSaved = allCoupons.reduce((s,c) => {
    if (c.discountType === 'fixed') return s + ((c.usedCount||0) * (c.discountValue||0));
    return s;
  }, 0);

  setElC('cpn-stat-total',  total);
  setElC('cpn-stat-active', active);
  setElC('cpn-stat-uses',   totalUses);
  setElC('cpn-stat-saved',  '₹' + totalSaved.toLocaleString('en-IN'));
}

function setElC(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── RENDER GRID ────────────────────────────────────────────────────
function renderCouponsGrid() {
  const grid = document.getElementById('couponsGrid');
  if (!grid) return;

  if (allCoupons.length === 0) {
    grid.innerHTML = `<div class="cpn-empty">
      <div class="cpn-empty-icon">🎟️</div>
      <div class="cpn-empty-title">Koi coupon nahi hai</div>
      <div class="cpn-empty-sub">Pehla coupon banao!</div>
    </div>`;
    return;
  }

  grid.innerHTML = allCoupons.map(c => buildCpnCard(c)).join('') +
    `<div class="cpn-add-card" onclick="openAddCoupon()">
      <div class="cpn-add-icon">+</div>
      <div class="cpn-add-label">Naya Coupon Banao</div>
    </div>`;
}

// ── BUILD COUPON CARD ──────────────────────────────────────────────
function buildCpnCard(c) {
  const now     = new Date();
  const expired = c.expiryDate && c.expiryDate.toDate?.() < now;
  const maxed   = c.maxUses > 0 && (c.usedCount||0) >= c.maxUses;
  const isActive = c.active && !expired && !maxed;

  const statusLabel = expired ? '🔴 Expired' : maxed ? '🔴 Maxed Out' : c.active ? '🟢 Active' : '⭕ Inactive';
  const statusCls   = isActive ? 'cpn-status-active' : 'cpn-status-inactive';

  const discountLabel = c.discountType === 'percent'
    ? `${c.discountValue}% OFF`
    : `₹${(c.discountValue||0).toLocaleString('en-IN')} OFF`;

  const expiryStr = c.expiryDate
    ? c.expiryDate.toDate?.()?.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
    : 'No Expiry';

  const usesPct = c.maxUses > 0
    ? Math.min(100, Math.round(((c.usedCount||0) / c.maxUses) * 100))
    : 0;

  return `<div class="cpn-card ${isActive ? '' : 'cpn-inactive'}" id="cpn-card-${c._id}">

    <!-- TOP -->
    <div class="cpn-card-top">
      <div class="cpn-code-wrap">
        <div class="cpn-code">${c.code || '—'}</div>
        <button class="cpn-copy-btn" onclick="copyCouponCode('${c.code}')" title="Code copy karo">📋</button>
      </div>
      <span class="${statusCls}">${statusLabel}</span>
    </div>

    <!-- DISCOUNT BADGE -->
    <div class="cpn-discount">${discountLabel}</div>
    ${c.description ? `<div class="cpn-desc">${c.description}</div>` : ''}

    <!-- DETAILS -->
    <div class="cpn-details">
      <div class="cpn-detail-item">
        <span class="cpn-detail-label">Min Order</span>
        <span class="cpn-detail-val">${c.minOrder > 0 ? '₹' + c.minOrder : 'None'}</span>
      </div>
      <div class="cpn-detail-item">
        <span class="cpn-detail-label">Max Uses</span>
        <span class="cpn-detail-val">${c.maxUses > 0 ? c.maxUses : 'Unlimited'}</span>
      </div>
      <div class="cpn-detail-item">
        <span class="cpn-detail-label">Used</span>
        <span class="cpn-detail-val">${c.usedCount||0}</span>
      </div>
      <div class="cpn-detail-item">
        <span class="cpn-detail-label">Expires</span>
        <span class="cpn-detail-val">${expiryStr}</span>
      </div>
    </div>

    <!-- USAGE BAR -->
    ${c.maxUses > 0 ? `
    <div class="cpn-usage-wrap">
      <div class="cpn-usage-label">${c.usedCount||0} / ${c.maxUses} uses</div>
      <div class="cpn-usage-bar">
        <div class="cpn-usage-fill ${usesPct >= 90 ? 'fill-red' : usesPct >= 60 ? 'fill-orange' : 'fill-green'}"
             style="width:${usesPct}%"></div>
      </div>
    </div>` : ''}

    <!-- TOGGLE + ACTIONS -->
    <div class="cpn-footer">
      <div class="cpn-toggle-row" onclick="toggleCouponActive('${c._id}',${!c.active})">
        <div class="mini-toggle ${c.active ? 'on' : ''}"></div>
        <span class="cpn-toggle-lbl">${c.active ? 'Active' : 'Inactive'}</span>
      </div>
      <div class="cpn-btns">
        <button class="cpn-btn cpn-btn-edit"   onclick="openEditCoupon('${c._id}')">✏️ Edit</button>
        <button class="cpn-btn cpn-btn-delete" onclick="deleteCoupon('${c._id}','${c.code}')">🗑️</button>
      </div>
    </div>

  </div>`;
}

// ── COPY CODE ──────────────────────────────────────────────────────
function copyCouponCode(code) {
  navigator.clipboard.writeText(code).then(() =>
    showAdminToast('📋 Code copied: ' + code, 'success')
  ).catch(() =>
    showAdminToast('❌ Copy failed', 'error')
  );
}

// ── OPEN ADD / EDIT ────────────────────────────────────────────────
function openAddCoupon() {
  editingCpnId = null;
  document.getElementById('cpnModalTitle').textContent = '➕ Naya Coupon Banao';
  clearCpnForm();
  document.getElementById('cpnModal').classList.add('open');
}

function openEditCoupon(id) {
  const c = allCoupons.find(x => x._id === id);
  if (!c) return;
  editingCpnId = id;
  document.getElementById('cpnModalTitle').textContent = '✏️ Coupon Edit Karo';

  document.getElementById('cpn-edit-code').value     = c.code || '';
  document.getElementById('cpn-edit-type').value     = c.discountType || 'fixed';
  document.getElementById('cpn-edit-value').value    = c.discountValue || '';
  document.getElementById('cpn-edit-desc').value     = c.description || '';
  document.getElementById('cpn-edit-minorder').value = c.minOrder || 0;
  document.getElementById('cpn-edit-maxuses').value  = c.maxUses || '';
  document.getElementById('cpn-edit-active').checked = c.active !== false;

  if (c.expiryDate) {
    const d = c.expiryDate.toDate?.();
    if (d) {
      document.getElementById('cpn-edit-expiry').value =
        d.toISOString().split('T')[0];
    }
  } else {
    document.getElementById('cpn-edit-expiry').value = '';
  }

  onDiscountTypeChange();
  document.getElementById('cpnModal').classList.add('open');
}

function closeCpnModal() {
  document.getElementById('cpnModal').classList.remove('open');
  editingCpnId = null;
}

function clearCpnForm() {
  document.getElementById('cpn-edit-code').value     = '';
  document.getElementById('cpn-edit-type').value     = 'fixed';
  document.getElementById('cpn-edit-value').value    = '';
  document.getElementById('cpn-edit-desc').value     = '';
  document.getElementById('cpn-edit-minorder').value = 0;
  document.getElementById('cpn-edit-maxuses').value  = '';
  document.getElementById('cpn-edit-expiry').value   = '';
  document.getElementById('cpn-edit-active').checked = true;
  onDiscountTypeChange();
}

function onDiscountTypeChange() {
  const type   = document.getElementById('cpn-edit-type')?.value;
  const label  = document.getElementById('cpn-value-label');
  const hint   = document.getElementById('cpn-value-hint');
  if (!label || !hint) return;
  if (type === 'percent') {
    label.textContent = 'Discount Percentage (%)';
    hint.textContent  = 'Jaise: 10 = 10% off. Max 100.';
  } else {
    label.textContent = 'Discount Amount (₹)';
    hint.textContent  = 'Jaise: 100 = ₹100 off';
  }
}

// ── SAVE COUPON ────────────────────────────────────────────────────
async function saveCoupon() {
  const code    = document.getElementById('cpn-edit-code').value.trim().toUpperCase();
  const type    = document.getElementById('cpn-edit-type').value;
  const value   = parseFloat(document.getElementById('cpn-edit-value').value);
  const desc    = document.getElementById('cpn-edit-desc').value.trim();
  const minOrd  = parseFloat(document.getElementById('cpn-edit-minorder').value) || 0;
  const maxUses = parseInt(document.getElementById('cpn-edit-maxuses').value) || 0;
  const expiry  = document.getElementById('cpn-edit-expiry').value;
  const active  = document.getElementById('cpn-edit-active').checked;

  // Validation
  if (!code)          { showAdminToast('⚠️ Coupon code daalo', 'warning'); return; }
  if (!/^[A-Z0-9_]+$/.test(code)) { showAdminToast('⚠️ Code mein sirf A-Z, 0-9 aur _ use karo', 'warning'); return; }
  if (!value || value <= 0) { showAdminToast('⚠️ Discount amount daalo', 'warning'); return; }
  if (type === 'percent' && value > 100) { showAdminToast('⚠️ Percentage 100 se zyada nahi ho sakta', 'warning'); return; }

  // Check duplicate code
  if (!editingCpnId) {
    const existing = allCoupons.find(c => c.code === code);
    if (existing) { showAdminToast('⚠️ Yeh code pehle se exist karta hai', 'warning'); return; }
  }

  const btn = document.getElementById('cpnSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

  const data = {
    code, discountType: type, discountValue: value,
    description: desc, minOrder: minOrd,
    maxUses: maxUses || 0, active,
    expiryDate: expiry ? firebase.firestore.Timestamp.fromDate(new Date(expiry)) : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (editingCpnId) {
      await db.collection('coupons').doc(editingCpnId).update(data);
      showAdminToast('✅ Coupon updated!', 'success');
    } else {
      data.usedCount = 0;
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('coupons').add(data);
      showAdminToast('✅ Naya coupon bana!', 'success');
    }
    closeCpnModal();
    await loadCoupons();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Karo'; }
  }
}

// ── TOGGLE ACTIVE ──────────────────────────────────────────────────
async function toggleCouponActive(id, newActive) {
  try {
    await db.collection('coupons').doc(id).update({ active: newActive });
    showAdminToast(newActive ? '✅ Coupon active' : '⭕ Coupon inactive', 'success');
    await loadCoupons();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── DELETE COUPON ──────────────────────────────────────────────────
async function deleteCoupon(id, code) {
  if (!confirm(`⚠️ "${code}" coupon delete karna chahte ho?`)) return;
  try {
    await db.collection('coupons').doc(id).delete();
    showAdminToast('🗑️ Coupon deleted', 'success');
    await loadCoupons();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── RESET USED COUNT ───────────────────────────────────────────────
async function resetUsedCount(id) {
  if (!confirm('Yeh coupon ka used count 0 par reset karna chahte ho?')) return;
  try {
    await db.collection('coupons').doc(id).update({ usedCount: 0 });
    showAdminToast('✅ Used count reset!', 'success');
    await loadCoupons();
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── EXPORT CSV ─────────────────────────────────────────────────────
function exportCouponsCSV() {
  if (allCoupons.length === 0) {
    showAdminToast('⚠️ Koi coupon nahi hai', 'warning');
    return;
  }
  const headers = ['Code','Type','Discount','Description','Min Order','Max Uses','Used','Active','Expiry'];
  const rows = allCoupons.map(c => [
    c.code||'',
    c.discountType||'',
    c.discountType==='percent' ? c.discountValue+'%' : '₹'+c.discountValue,
    (c.description||'').replace(/"/g,'""'),
    c.minOrder||0, c.maxUses||'Unlimited', c.usedCount||0,
    c.active ? 'Yes' : 'No',
    c.expiryDate ? c.expiryDate.toDate?.()?.toLocaleDateString('en-IN') : 'No Expiry'
  ].map(v => `"${v}"`));

  const csv  = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `akans-coupons-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showAdminToast('✅ CSV downloaded!', 'success');
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('couponsPage')) initCoupons();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 7, 8... admin-all2.js mein aage add honge         ║
// ╚══════════════════════════════════════════════════════════════╝

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

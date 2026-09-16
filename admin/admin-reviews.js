// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Page specific JS
// admin-shared.js ke baad load karo
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
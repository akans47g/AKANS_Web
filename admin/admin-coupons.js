// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Page specific JS
// admin-shared.js ke baad load karo
// ══════════════════════════════════════════════════════════════════

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
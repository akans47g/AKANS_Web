// ══════════════════════════════════════════════════════════════════
// admin-all3.js — AKANS Admin Panel (Part 3)
// Sections 9+ ka JS code
// Firebase firebase-config.js se load hota hai
// ══════════════════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 9 — admin-settings.html                     ║
// ╚══════════════════════════════════════════════════════════════╝

// ── STATE ─────────────────────────────────────────────────────────
let siteSettings  = {};
const SETTINGS_DOC = 'site-settings';

// ── DEFAULT SETTINGS ───────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  // Contact
  whatsapp:     '9673840137',
  telegram:     'AKANS_M7',
  email:        'akans47g@gmail.com',
  supportHours: 'Mon-Sat, 10AM - 8PM',
  // Payment
  phonePeUPI:   '9021958286@ybl',
  gPayUPI:      'moinkhanmanyar@okhdfcbank',
  paytmUPI:     'akans.m7@ptaxis',
  upiNumber:    '9021958286',
  templatePrice: 1199,
  qrCodeUrl:    'Qr.jpg',
  // Site Info
  siteName:     'AKANS Web Development Services',
  tagline:      'Premium Digital Wedding Cards',
  aboutText:    'AKANS Web Development Services provides premium digital wedding cards.',
  // Social
  instagram:    '',
  facebook:     '',
  youtube:      '',
  // Admin
  adminEmail:   'akans47g@gmail.com',
  // GitHub
  githubRepo:   'https://akans47g.github.io/AKANS_Web/',
};

// ── INIT ──────────────────────────────────────────────────────────
async function initSettings() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('settings');
  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';
  await loadSettings();
}

// ── LOAD SETTINGS ──────────────────────────────────────────────────
async function loadSettings() {
  try {
    const doc = await db.collection('settings').doc(SETTINGS_DOC).get();
    siteSettings = doc.exists
      ? { ...DEFAULT_SETTINGS, ...doc.data() }
      : { ...DEFAULT_SETTINGS };

    if (!doc.exists) {
      // First time — save defaults
      await db.collection('settings').doc(SETTINGS_DOC).set({
        ...DEFAULT_SETTINGS,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    populateAllForms();
    showAdminToast('✅ Settings loaded!', 'success');
  } catch(e) {
    console.error('[Settings]', e);
    siteSettings = { ...DEFAULT_SETTINGS };
    populateAllForms();
    showAdminToast('⚠️ Firestore error — default settings shown', 'warning');
  }
}

// ── POPULATE FORMS ─────────────────────────────────────────────────
function populateAllForms() {
  // Contact
  setField('set-whatsapp',     siteSettings.whatsapp);
  setField('set-telegram',     siteSettings.telegram);
  setField('set-email',        siteSettings.email);
  setField('set-support-hrs',  siteSettings.supportHours);
  // Payment
  setField('set-phonepe',      siteSettings.phonePeUPI);
  setField('set-gpay',         siteSettings.gPayUPI);
  setField('set-paytm',        siteSettings.paytmUPI);
  setField('set-upi-num',      siteSettings.upiNumber);
  setField('set-price',        siteSettings.templatePrice);
  // QR Code preview
  const qrPrev = document.getElementById('qr-preview');
  if (qrPrev) qrPrev.src = siteSettings.qrCodeUrl || 'Qr.jpg';
  // Site Info
  setField('set-sitename',     siteSettings.siteName);
  setField('set-tagline',      siteSettings.tagline);
  setField('set-about',        siteSettings.aboutText);
  // Social
  setField('set-instagram',    siteSettings.instagram);
  setField('set-facebook',     siteSettings.facebook);
  setField('set-youtube',      siteSettings.youtube);
  // GitHub
  setField('set-github',       siteSettings.githubRepo);
  // Admin info
  setField('set-admin-email',  siteSettings.adminEmail);
}

function setField(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

// ── SAVE SECTIONS ──────────────────────────────────────────────────
async function saveSection(sectionId, fields, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

  const updates = {};
  fields.forEach(({ id, key, type }) => {
    const el = document.getElementById(id);
    if (!el) return;
    updates[key] = type === 'number' ? (parseFloat(el.value) || 0) : el.value.trim();
  });
  updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

  try {
    await db.collection('settings').doc(SETTINGS_DOC).set(updates, { merge: true });
    Object.assign(siteSettings, updates);
    showAdminToast('✅ Saved!', 'success');

    // Visual feedback
    const card = document.getElementById(sectionId);
    if (card) {
      card.style.borderColor = '#bbf7d0';
      setTimeout(() => card.style.borderColor = '', 2000);
    }
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save'; }
  }
}

// ── CONTACT SETTINGS ───────────────────────────────────────────────
function saveContactSettings() {
  saveSection('card-contact', [
    { id:'set-whatsapp',    key:'whatsapp'     },
    { id:'set-telegram',    key:'telegram'     },
    { id:'set-email',       key:'email'        },
    { id:'set-support-hrs', key:'supportHours' },
  ], 'btn-contact');
}

// ── PAYMENT SETTINGS ───────────────────────────────────────────────
function savePaymentSettings() {
  saveSection('card-payment', [
    { id:'set-phonepe',  key:'phonePeUPI'   },
    { id:'set-gpay',     key:'gPayUPI'      },
    { id:'set-paytm',    key:'paytmUPI'     },
    { id:'set-upi-num',  key:'upiNumber'    },
    { id:'set-price',    key:'templatePrice', type:'number' },
  ], 'btn-payment');
}

// ── QR CODE UPLOAD ─────────────────────────────────────────────────
async function uploadQRCode(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { showAdminToast('❌ Max 3MB', 'error'); return; }

  const btn = document.getElementById('btn-qr-upload');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Uploading...'; }

  try {
    let url = '';
    const storage = firebase.storage?.();
    if (storage) {
      const ref  = storage.ref('qr/Qr_' + Date.now() + '.' + file.name.split('.').pop());
      const snap = await ref.put(file);
      url = await snap.ref.getDownloadURL();
    } else {
      // Fallback base64
      url = await new Promise((res,rej) => {
        const r = new FileReader();
        r.onload = ()=>res(r.result);
        r.onerror = ()=>rej(new Error('Read failed'));
        r.readAsDataURL(file);
      });
    }

    await db.collection('settings').doc(SETTINGS_DOC).set(
      { qrCodeUrl: url, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    siteSettings.qrCodeUrl = url;
    const prev = document.getElementById('qr-preview');
    if (prev) prev.src = url;
    showAdminToast('✅ QR Code updated!', 'success');
  } catch(e) {
    showAdminToast('❌ Upload error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📷 Change QR'; }
  }
}

// ── SITE INFO ──────────────────────────────────────────────────────
function saveSiteInfo() {
  saveSection('card-siteinfo', [
    { id:'set-sitename', key:'siteName'  },
    { id:'set-tagline',  key:'tagline'   },
    { id:'set-about',    key:'aboutText' },
    { id:'set-github',   key:'githubRepo'},
  ], 'btn-siteinfo');
}

// ── SOCIAL LINKS ───────────────────────────────────────────────────
function saveSocialLinks() {
  saveSection('card-social', [
    { id:'set-instagram', key:'instagram' },
    { id:'set-facebook',  key:'facebook'  },
    { id:'set-youtube',   key:'youtube'   },
  ], 'btn-social');
}

// ── RESET ALL SETTINGS ─────────────────────────────────────────────
async function resetAllSettings() {
  if (!confirm('⚠️ Sab settings default par reset karna chahte ho? Yeh undo nahi hoga.')) return;
  try {
    await db.collection('settings').doc(SETTINGS_DOC).set({
      ...DEFAULT_SETTINGS,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    siteSettings = { ...DEFAULT_SETTINGS };
    populateAllForms();
    showAdminToast('🔄 Settings reset ho gayi!', 'success');
  } catch(e) {
    showAdminToast('❌ Error: ' + e.message, 'error');
  }
}

// ── TEST WHATSAPP ──────────────────────────────────────────────────
function testWhatsApp() {
  const num = document.getElementById('set-whatsapp')?.value.trim();
  if (!num) { showAdminToast('⚠️ WhatsApp number daalo pehle', 'warning'); return; }
  window.open(`https://wa.me/91${num}?text=Test+message+from+AKANS+Admin`, '_blank');
}

// ── COPY FIELD ─────────────────────────────────────────────────────
function copyField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() =>
    showAdminToast('📋 Copied!', 'success')
  ).catch(() =>
    showAdminToast('❌ Copy failed', 'error')
  );
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('settingsPage')) initSettings();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║   SECTION 10, 11... admin-all3.js mein aage add honge       ║
// ╚══════════════════════════════════════════════════════════════╝

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

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 11 — admin-whatsapp.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── MESSAGE TEMPLATES ──────────────────────────────────────────────
const WA_TEMPLATES = [
  {
    id:    'booking_confirm',
    label: '🎉 Booking Confirm',
    icon:  '📦',
    text:  `🎉 *AKANS Web Development Services*

Assalamu Alaikum {name} Ji! 🙏

Aapki wedding card booking **receive ho gayi hai**! ✅

📋 *Order Details:*
💑 Couple: {couple}
🎨 Template: {template}
💰 Amount: ₹{amount}

Hamare team 24 ghante mein kaam shuru kar dega. Koi sawaal ho toh yahan message karein.

Shukriya! 🌸`
  },
  {
    id:    'payment_received',
    label: '💰 Payment Received',
    icon:  '✅',
    text:  `✅ *AKANS Web Development Services*

Assalamu Alaikum {name} Ji! 🙏

Aapki **payment receive ho gayi hai**! 💰

💳 Amount: ₹{amount}
🎨 Template: {template}

Ab hamare team aapka digital wedding card banana shuru kar dega. Jald hi card link bheja jayega! 💍

Shukriya! 🌸`
  },
  {
    id:    'card_ready',
    label: '💍 Card Ready',
    icon:  '🔗',
    text:  `💍 *AKANS Web Development Services*

Assalamu Alaikum {name} Ji! 🙏

Aapka **digital wedding card ready ho gaya hai**! 🎉

💑 Couple: {couple}
🎨 Template: {template}

🔗 *Card Link:*
{link}

Is link ko share karke apne tamam mehmanon ko invite karein! ✨

Mubarakbaad! 🎊 Aapki shaadi bahut mubarak ho! 💕`
  },
  {
    id:    'in_progress',
    label: '⏳ Work in Progress',
    icon:  '🔄',
    text:  `⏳ *AKANS Web Development Services*

Assalamu Alaikum {name} Ji! 🙏

Aapke wedding card par kaam **chal raha hai**! 🎨

🎨 Template: {template}
📅 Expected: 24-48 ghante

Jald hi aapka card link bheja jayega. Koi khaas preference ho toh batayein!

Shukriya aapki patience ke liye! 🌸`
  },
  {
    id:    'reminder',
    label: '🔔 Payment Reminder',
    icon:  '⚠️',
    text:  `🔔 *AKANS Web Development Services*

Assalamu Alaikum {name} Ji! 🙏

Aapne wedding card ke liye booking ki thi lekin **payment pending hai**.

💰 Amount: ₹{amount}
🎨 Template: {template}

Please payment complete karein taaki kaam shuru ho sake. Koi masla ho toh batayein!

UPI: 9021958286@ybl

Shukriya! 🌸`
  },
  {
    id:    'custom',
    label: '✏️ Custom Message',
    icon:  '💬',
    text:  `*AKANS Web Development Services*

Assalamu Alaikum {name} Ji! 🙏

`
  }
];

// ── STATE ──────────────────────────────────────────────────────────
let waBookings     = [];
let selectedWaTemplate = WA_TEMPLATES[0];
let selectedBooking    = null;

// ── INIT ──────────────────────────────────────────────────────────
async function initWhatsApp() {
  const session = requireAdminSession();
  if (!session) return;
  renderSidebar('whatsapp');
  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';

  renderTemplateButtons();
  await loadWaBookings();
  selectWaTemplate('booking_confirm');
}

// ── LOAD BOOKINGS ──────────────────────────────────────────────────
async function loadWaBookings() {
  try {
    const snap = await db.collection('bookings')
      .orderBy('createdAt','desc').limit(50).get();
    waBookings = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    renderCustomerList();
  } catch(e) {
    console.error('[WhatsApp]', e);
    showAdminToast('⚠️ Bookings load error', 'error');
  }
}

// ── RENDER TEMPLATE BUTTONS ────────────────────────────────────────
function renderTemplateButtons() {
  const wrap = document.getElementById('waTemplateButtons');
  if (!wrap) return;
  wrap.innerHTML = WA_TEMPLATES.map(t => `
    <button class="wa-tpl-btn" data-id="${t.id}" onclick="selectWaTemplate('${t.id}')">
      <span>${t.icon}</span> ${t.label}
    </button>
  `).join('');
}

// ── SELECT TEMPLATE ────────────────────────────────────────────────
function selectWaTemplate(id) {
  selectedWaTemplate = WA_TEMPLATES.find(t => t.id === id) || WA_TEMPLATES[0];

  // Update button UI
  document.querySelectorAll('.wa-tpl-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.id === id));

  // Update preview
  updateWaPreview();
}

// ── RENDER CUSTOMER LIST ───────────────────────────────────────────
function renderCustomerList() {
  const list = document.getElementById('waCustomerList');
  if (!list) return;

  if (waBookings.length === 0) {
    list.innerHTML = `<div class="wa-empty-list">📭 Koi booking nahi mili</div>`;
    return;
  }

  list.innerHTML = waBookings.map(b => {
    const name = b.groomName || 'Customer';
    const initial = name.charAt(0).toUpperCase();
    return `<div class="wa-customer-item" onclick="selectCustomer('${b._id}')" id="wac-${b._id}">
      <div class="wac-avatar">${initial}</div>
      <div class="wac-info">
        <div class="wac-name">${b.groomName||'?'} &amp; ${b.brideName||'?'}</div>
        <div class="wac-wa">📱 ${b.whatsapp||'No number'}</div>
      </div>
      <div class="wac-template">${b.template||'—'}</div>
    </div>`;
  }).join('');
}

// ── SELECT CUSTOMER ────────────────────────────────────────────────
function selectCustomer(id) {
  selectedBooking = waBookings.find(b => b._id === id);
  if (!selectedBooking) return;

  // Update UI
  document.querySelectorAll('.wa-customer-item').forEach(el =>
    el.classList.toggle('selected', el.id === 'wac-' + id));

  // Fill fields
  const waInput = document.getElementById('wa-number-input');
  if (waInput) waInput.value = selectedBooking.whatsapp || '';

  // Update preview
  updateWaPreview();

  // Scroll preview into view on mobile
  document.getElementById('wa-preview-section')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ── UPDATE PREVIEW ─────────────────────────────────────────────────
function updateWaPreview() {
  const msgArea = document.getElementById('wa-message-area');
  const preview = document.getElementById('wa-preview-text');
  if (!msgArea || !selectedWaTemplate) return;

  // Fill variables
  const b = selectedBooking;
  let msg = selectedWaTemplate.text;
  if (b) {
    msg = msg
      .replace(/{name}/g,     b.groomName || 'Customer')
      .replace(/{couple}/g,   `${b.groomName||'?'} & ${b.brideName||'?'}`)
      .replace(/{template}/g, b.template || '—')
      .replace(/{amount}/g,   (b.amountPaid||0).toLocaleString('en-IN'))
      .replace(/{link}/g,     b.cardLink || '[Card link yahan ayega]');
  }

  msgArea.value = msg;
  if (preview) {
    preview.innerHTML = msg
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}

// ── SEND WHATSAPP ──────────────────────────────────────────────────
function sendWhatsAppMsg() {
  const number  = document.getElementById('wa-number-input')?.value.trim();
  const message = document.getElementById('wa-message-area')?.value.trim();

  if (!number) { showAdminToast('⚠️ WhatsApp number daalo', 'warning'); return; }
  if (number.length !== 10) { showAdminToast('⚠️ 10 digit number daalo', 'warning'); return; }
  if (!message) { showAdminToast('⚠️ Message khali hai', 'warning'); return; }

  const url = `https://wa.me/91${number}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');

  // Log
  logWaMessage(number, message);
  showAdminToast('✅ WhatsApp open ho gaya!', 'success');
}

// ── LOG MESSAGE ────────────────────────────────────────────────────
async function logWaMessage(number, message) {
  try {
    await db.collection('adminLogs').add({
      action:    'whatsapp_sent',
      to:        number,
      template:  selectedWaTemplate?.id || 'custom',
      preview:   message.slice(0, 100),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(e) { /* silently fail */ }
}

// ── COPY MESSAGE ───────────────────────────────────────────────────
function copyWaMessage() {
  const msg = document.getElementById('wa-message-area')?.value;
  if (!msg) return;
  navigator.clipboard.writeText(msg)
    .then(() => showAdminToast('📋 Message copied!', 'success'))
    .catch(() => showAdminToast('❌ Copy failed', 'error'));
}

// ── SEARCH CUSTOMERS ───────────────────────────────────────────────
function searchWaCustomers(val) {
  const q = val.toLowerCase();
  document.querySelectorAll('.wa-customer-item').forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(q) ? '' : 'none';
  });
}

// ── SEND BULK (all pending) ────────────────────────────────────────
function sendBulkReminder() {
  const pending = waBookings.filter(b => b.status === 'pending' && b.whatsapp);
  if (pending.length === 0) {
    showAdminToast('⚠️ Koi pending booking nahi hai', 'warning');
    return;
  }
  if (!confirm(`${pending.length} pending customers ko reminder bhejna chahte ho? WhatsApp ek ek karke khulega.`)) return;

  pending.forEach((b, i) => {
    setTimeout(() => {
      const msg = WA_TEMPLATES.find(t=>t.id==='reminder').text
        .replace(/{name}/g,     b.groomName||'Customer')
        .replace(/{couple}/g,   `${b.groomName||'?'} & ${b.brideName||'?'}`)
        .replace(/{template}/g, b.template||'—')
        .replace(/{amount}/g,   (b.amountPaid||0).toLocaleString('en-IN'));
      window.open(`https://wa.me/91${b.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
    }, i * 1500);
  });

  showAdminToast(`✅ ${pending.length} WhatsApp windows open ho rahe hain...`, 'info');
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('whatsappPage')) initWhatsApp();
});

// ╔══════════════════════════════════════════════════════════════╗
// ║         admin-all3.js COMPLETE ✅                            ║
// ║         Admin Panel JS — Sections 9, 10, 11                  ║
// ╚══════════════════════════════════════════════════════════════╝

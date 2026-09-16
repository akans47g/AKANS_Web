// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Page specific JS
// admin-shared.js ke baad load karo
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
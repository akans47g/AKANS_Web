// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Page specific JS
// admin-shared.js ke baad load karo
// ══════════════════════════════════════════════════════════════════

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
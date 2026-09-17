// ══════════════════════════════════════════════════════════════════
// admin-all.js — AKANS Admin Panel (Shared)
// Ye file SABHI admin pages load karti hain
// Shared: session, sidebar, toast, utilities + Sections 3 & 4
// ══════════════════════════════════════════════════════════════════

// ── SHARED CONSTANTS ───────────────────────────────────────────────
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// ── SESSION CHECK ──────────────────────────────────────────────────
function checkAdminSession() {
  try {
    const session = JSON.parse(localStorage.getItem('adminSession') || 'null');
    if (session) {
      const elapsed = Date.now() - session.timestamp;
      if (elapsed < SESSION_DURATION && session.isAdmin) {
        if (!window.location.href.includes('admin-dashboard')) {
          window.location.replace('admin-dashboard.html');
        }
        return true;
      } else {
        localStorage.removeItem('adminSession');
        auth.signOut().catch(() => {});
      }
    }
  } catch (e) {
    localStorage.removeItem('adminSession');
  }
  return false;
}

// ── SESSION GUARD (all admin pages use this) ───────────────────────
function requireAdminSession() {
  const session = JSON.parse(localStorage.getItem('adminSession') || 'null');
  if (!session || !session.isAdmin) {
    window.location.replace('admin-login.html');
    return null;
  }
  const elapsed = Date.now() - session.timestamp;
  if (elapsed >= SESSION_DURATION) {
    localStorage.removeItem('adminSession');
    auth.signOut().catch(() => {});
    window.location.replace('admin-login.html');
    return null;
  }
  return session;
}

// ── LOGOUT ────────────────────────────────────────────────────────
async function adminLogout() {
  if (!confirm('Logout karna chahte hain?')) return;
  localStorage.removeItem('adminSession');
  await auth.signOut().catch(() => {});
  window.location.replace('admin-login.html');
}

// ── SHARED TOAST ──────────────────────────────────────────────────
function showAdminToast(msg, type = 'info') {
  let t = document.getElementById('adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    document.body.appendChild(t);
  }
  t.textContent   = msg;
  t.className     = `admin-toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── SIDEBAR TOGGLE ────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('adminSidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('adminSidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}

// ── BADGE ─────────────────────────────────────────────────────────
function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) {
    el.textContent  = count > 99 ? '99+' : count;
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

// ── ANIMATE COUNT ─────────────────────────────────────────────────
function animateCount(id, target, prefix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  const steps = 40, duration = 900;
  const step  = target / steps;
  let current = 0;
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = prefix + Math.floor(current).toLocaleString('en-IN');
    if (current >= target) clearInterval(interval);
  }, duration / steps);
}

function setStatCard(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
    el.closest?.('.stat-card')?.classList.remove('loading');
  }
}

function goTo(url) { window.location.href = url; }

// ── ADMIN NAV ─────────────────────────────────────────────────────
const ADMIN_NAV = [
  { id:'dashboard',  icon:'📊', label:'Dashboard',            url:'admin-dashboard.html'  },
  { id:'bookings',   icon:'📦', label:'Bookings',             url:'admin-bookings.html'   },
  { id:'orders',     icon:'📋', label:'Orders',               url:'admin-orders.html'     },
  { id:'users',      icon:'👥', label:'Users',                url:'admin-users.html'      },
  { id:'reviews',    icon:'⭐', label:'Reviews',              url:'admin-reviews.html'    },
  { id:'templates',  icon:'🎨', label:'Templates',            url:'admin-templates.html'  },
  { id:'coupons',    icon:'🎟️', label:'Coupons',              url:'admin-coupons.html'    },
  { id:'referrals',  icon:'🎁', label:'Referrals & Withdraw', url:'admin-referrals.html'  },
  { id:'whatsapp',   icon:'💬', label:'WhatsApp',             url:'admin-whatsapp.html'   },
  { id:'settings',   icon:'⚙️', label:'Settings',             url:'admin-settings.html'   },
];

// ── RENDER SIDEBAR ────────────────────────────────────────────────
function renderSidebar(activePage) {
  const sidebar = document.getElementById('adminSidebar');
  if (!sidebar) return;
  const session    = JSON.parse(localStorage.getItem('adminSession') || '{}');
  const adminName  = session.displayName || session.email?.split('@')[0] || 'Admin';
  const adminEmail = session.email || '';

  const navHTML = ADMIN_NAV.map(item => `
    <a href="${item.url}" class="nav-item ${activePage === item.id ? 'active' : ''}" data-page="${item.id}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
      ${item.id === 'bookings'  ? `<span class="nav-badge" id="badge-bookings"></span>`  : ''}
      ${item.id === 'reviews'   ? `<span class="nav-badge" id="badge-reviews"></span>`   : ''}
      ${item.id === 'referrals' ? `<span class="nav-badge" id="badge-referrals"></span>` : ''}
    </a>
  `).join('');

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <div class="sb-logo-icon">🛡️</div>
      <div class="sb-logo-text">
        <div class="sb-title">AKANS Admin</div>
        <div class="sb-sub">Control Panel</div>
      </div>
    </div>
    <nav class="sidebar-nav">${navHTML}</nav>
    <div class="sidebar-user">
      <div class="sb-avatar">${adminName.charAt(0).toUpperCase()}</div>
      <div class="sb-user-info">
        <div class="sb-user-name">${adminName}</div>
        <div class="sb-user-email">${adminEmail}</div>
      </div>
      <button class="sb-logout" onclick="adminLogout()" title="Logout">⏏</button>
    </div>
  `;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 3 — admin-bookings.html                     ║
// ╚══════════════════════════════════════════════════════════════╝

let allBookings = [], filteredBookings = [], currentFilter = 'all',
    currentSearch = '', unsubBookings = null, editingBookingId = null;

async function initBookings() {
  const session = requireAdminSession(); if (!session) return;
  renderSidebar('bookings');
  const hName = document.getElementById('adminHeaderName');
  if (hName) hName.textContent = session.displayName || 'Admin';
  startBookingsListener();
}

function startBookingsListener() {
  if (unsubBookings) unsubBookings();
  const grid = document.getElementById('bookingsGrid');
  if (grid) grid.innerHTML = `<div class="b-loading"><div class="b-loading-spinner"></div><div>Loading...</div></div>`;
  unsubBookings = db.collection('bookings').orderBy('createdAt','desc')
    .onSnapshot(snap => {
      allBookings = snap.docs.map(d => ({ _id:d.id, ...d.data() }));
      updateBookingStats(); applyFilterAndSearch();
    }, err => showAdminToast('⚠️ ' + err.message, 'error'));
}

function updateBookingStats() {
  const counts = {all:0,pending:0,inprogress:0,completed:0,cancelled:0};
  let rev = 0;
  allBookings.forEach(b => {
    counts.all++; counts[b.status||'pending'] = (counts[b.status||'pending']||0)+1;
    rev += (b.amountPaid||0);
  });
  Object.keys(counts).forEach(k => { const e=document.getElementById('count-'+k); if(e) e.textContent=counts[k]; });
  const re=document.getElementById('total-revenue'); if(re) re.textContent='₹'+rev.toLocaleString('en-IN');
  setBadge('badge-bookings', counts.pending);
}

function switchFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.b-tab').forEach(t => t.classList.toggle('active', t.dataset.filter===filter));
  applyFilterAndSearch();
}

function onSearch(val) { currentSearch = val.toLowerCase().trim(); applyFilterAndSearch(); }

function applyFilterAndSearch() {
  filteredBookings = allBookings.filter(b => {
    const ok = currentFilter==='all' || (b.status||'pending')===currentFilter;
    if (!ok) return false;
    if (!currentSearch) return true;
    return [b.groomName,b.brideName,b.template,b.whatsapp,b.transactionId,b._id].join(' ').toLowerCase().includes(currentSearch);
  });
  renderBookingsGrid();
  const c=document.getElementById('showing-count'); if(c) c.textContent=filteredBookings.length+' bookings';
}

function renderBookingsGrid() {
  const grid = document.getElementById('bookingsGrid'); if (!grid) return;
  if (!filteredBookings.length) { grid.innerHTML=`<div class="b-empty"><div class="b-empty-icon">📭</div><div class="b-empty-title">Koi booking nahi</div></div>`; return; }
  grid.innerHTML = filteredBookings.map(b => buildBookingCard(b)).join('');
}

function buildBookingCard(b) {
  const S={pending:{label:'Pending',color:'#f59e0b',bg:'#fffbeb',border:'#fde68a'},inprogress:{label:'In Progress',color:'#3b82f6',bg:'#eff6ff',border:'#bfdbfe'},completed:{label:'Completed',color:'#16a34a',bg:'#f0fdf4',border:'#bbf7d0'},cancelled:{label:'Cancelled',color:'#ef4444',bg:'#fef2f2',border:'#fecaca'}};
  const s=S[b.status||'pending']||S.pending;
  const shortId='#AK'+b._id.slice(-6).toUpperCase();
  const date=b.createdAt?.toDate?.() ? b.createdAt.toDate().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : '—';
  const weddingDate=b.weddingCeremony?.date ? new Date(b.weddingCeremony.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
  return `<div class="b-card" id="card-${b._id}">
    <div class="b-card-top"><div class="b-order-id">${shortId}</div><div class="b-card-badges">${b.paymentVerified?'<span class="verified-badge">✅ Verified</span>':''}<span class="status-pill" style="color:${s.color};background:${s.bg};border:1px solid ${s.border};">${s.label}</span></div></div>
    <div class="b-template">🎨 ${b.template||'—'}</div>
    <div class="b-couple">💑 <strong>${b.groomName||'?'}</strong> &amp; <strong>${b.brideName||'?'}</strong></div>
    <div class="b-meta-row"><span>💒 ${weddingDate}</span><span>📅 ${date}</span></div>
    <div class="b-payment-row"><span class="b-amount">💰 ₹${(b.amountPaid||0).toLocaleString('en-IN')}</span>${b.couponCode?`<span class="b-coupon">🎟️ ${b.couponCode}</span>`:''}<span class="b-wa">📱 ${b.whatsapp||'—'}</span></div>
    ${b.screenshotB64?`<div class="b-has-screenshot">📸 Screenshot available</div>`:''}
    <div class="b-actions">
      <button class="b-btn b-btn-primary" onclick="openBookingDetail('${b._id}')">👁️ View</button>
      <a class="b-btn b-btn-wa" href="https://wa.me/91${b.whatsapp||''}" target="_blank">💬 WhatsApp</a>
      <select class="b-status-select" onchange="quickStatusChange('${b._id}',this.value)" style="color:${s.color};">
        <option value="pending" ${(b.status||'pending')==='pending'?'selected':''}>⏳ Pending</option>
        <option value="inprogress" ${b.status==='inprogress'?'selected':''}>🔵 In Progress</option>
        <option value="completed" ${b.status==='completed'?'selected':''}>✅ Completed</option>
        <option value="cancelled" ${b.status==='cancelled'?'selected':''}>❌ Cancelled</option>
      </select>
    </div></div>`;
}

async function quickStatusChange(id, newStatus) {
  try { await db.collection('bookings').doc(id).update({status:newStatus,statusUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()}); showAdminToast('✅ Status updated!','success'); }
  catch(e) { showAdminToast('❌ '+e.message,'error'); }
}

async function openBookingDetail(id) {
  editingBookingId = id;
  const modal = document.getElementById('bookingModal'); if (!modal) return;
  modal.classList.add('open');
  document.getElementById('modalContent').innerHTML = `<div style="text-align:center;padding:3rem;color:#94a3b8;">⏳ Loading...</div>`;
  try {
    const doc = await db.collection('bookings').doc(id).get();
    if (!doc.exists) { showAdminToast('❌ Not found','error'); closeModal(); return; }
    renderModalContent({_id:doc.id,...doc.data()});
  } catch(e) { showAdminToast('❌ '+e.message,'error'); closeModal(); }
}

function renderModalContent(b) {
  const S={pending:'Pending',inprogress:'In Progress',completed:'Completed',cancelled:'Cancelled'};
  document.getElementById('modalContent').innerHTML = `<div class="modal-body-scroll">
    <div class="detail-header"><div><div class="detail-order-id">#AK${b._id.slice(-6).toUpperCase()}</div><div class="detail-template">🎨 ${b.template||'—'}</div></div><span class="status-pill">${S[b.status||'pending']||'Pending'}</span></div>
    <div class="detail-section"><div class="detail-sec-title">💑 Couple Details</div>
      <div class="detail-grid">
        <div class="detail-item"><span class="di-label">Dulhe Ka Naam</span><span class="di-val">${b.groomName||'—'}</span></div>
        <div class="detail-item"><span class="di-label">Dulhe Ke Walid</span><span class="di-val">${b.groomFather||'—'}</span></div>
        <div class="detail-item"><span class="di-label">Dulhan Ka Naam</span><span class="di-val">${b.brideName||'—'}</span></div>
        <div class="detail-item"><span class="di-label">Dulhan Ke Walid</span><span class="di-val">${b.brideFather||'—'}</span></div>
      </div></div>
    <div class="detail-section"><div class="detail-sec-title">💰 Payment</div>
      <div class="detail-grid">
        <div class="detail-item"><span class="di-label">Amount</span><span class="di-val strong-green">₹${(b.amountPaid||0).toLocaleString('en-IN')}</span></div>
        <div class="detail-item"><span class="di-label">Transaction ID</span><span class="di-val mono">${b.transactionId||'—'}</span></div>
        <div class="detail-item"><span class="di-label">WhatsApp</span><span class="di-val">📱 ${b.whatsapp||'—'}</span></div>
        <div class="detail-item"><span class="di-label">Payment</span><span class="di-val">${b.paymentVerified?'✅ Verified':'⏳ Pending'}</span></div>
      </div>
      ${b.screenshotB64?`<div style="margin-top:0.8rem;"><img src="${b.screenshotB64}" style="max-width:100%;max-height:250px;border-radius:10px;object-fit:contain;" onclick="window.open(this.src,'_blank')"/></div>`:''}
    </div>
    <div class="detail-section"><div class="detail-sec-title">⚙️ Admin Actions</div>
      <div class="admin-action-row"><label class="action-label">Status</label>
        <select id="modalStatusSelect" class="action-select">
          <option value="pending" ${(b.status||'pending')==='pending'?'selected':''}>⏳ Pending</option>
          <option value="inprogress" ${b.status==='inprogress'?'selected':''}>🔵 In Progress</option>
          <option value="completed" ${b.status==='completed'?'selected':''}>✅ Completed</option>
          <option value="cancelled" ${b.status==='cancelled'?'selected':''}>❌ Cancelled</option>
        </select></div>
      <div class="admin-action-row"><label class="action-label">Card Link</label>
        <input type="url" id="modalCardLink" class="action-input" value="${b.cardLink||''}" placeholder="https://..."/></div>
      <div class="admin-action-row"><label class="action-label">Admin Note</label>
        <textarea id="modalAdminNote" class="action-textarea">${b.adminNote||''}</textarea></div>
      <div class="admin-action-row" style="flex-direction:row;align-items:center;gap:0.8rem;">
        <input type="checkbox" id="modalPayVerify" ${b.paymentVerified?'checked':''} style="width:18px;height:18px;accent-color:#16a34a;"/>
        <label for="modalPayVerify" style="font-size:0.85rem;font-weight:600;">✅ Payment Verified</label></div>
      <div class="modal-action-btns">
        <button class="mab-save" onclick="saveBookingChanges('${b._id}')">💾 Save</button>
        <a class="mab-wa" href="https://wa.me/91${b.whatsapp||''}" target="_blank">💬 WhatsApp</a>
        <button class="mab-delete" onclick="deleteBooking('${b._id}')">🗑️ Delete</button>
      </div></div></div>`;
}

async function saveBookingChanges(id) {
  const status=document.getElementById('modalStatusSelect')?.value;
  const note=document.getElementById('modalAdminNote')?.value.trim();
  const verified=document.getElementById('modalPayVerify')?.checked;
  const cardLink=document.getElementById('modalCardLink')?.value.trim();
  const btn=document.querySelector('.mab-save');
  if(btn){btn.disabled=true;btn.textContent='⏳ Saving...';}
  try {
    await db.collection('bookings').doc(id).update({status,adminNote:note,paymentVerified:verified,cardLink:cardLink||'',updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    showAdminToast('✅ Updated!','success'); closeModal();
    if(status==='completed'&&cardLink){
      const b=allBookings.find(x=>x._id===id);
      if(b?.whatsapp){const msg=encodeURIComponent(`🎉 *AKANS Web*\n\nAapka wedding card ready hai! 💍\n💑 ${b.groomName} & ${b.brideName}\n🔗 ${cardLink}\n\nMubarakbaad! 🎊`);window.open(`https://wa.me/91${b.whatsapp}?text=${msg}`,'_blank');}
    }
  } catch(e){showAdminToast('❌ '+e.message,'error');if(btn){btn.disabled=false;btn.textContent='💾 Save';}}
}

async function deleteBooking(id) {
  if(!confirm('Delete karna chahte ho?')) return;
  try{await db.collection('bookings').doc(id).delete();showAdminToast('🗑️ Deleted','success');closeModal();}
  catch(e){showAdminToast('❌ '+e.message,'error');}
}

function closeModal() { document.getElementById('bookingModal')?.classList.remove('open'); editingBookingId=null; }

function exportBookingsCSV() {
  if(!filteredBookings.length){showAdminToast('⚠️ No data','warning');return;}
  const headers=['Order ID','Template','Groom','Bride','Amount','Status','WhatsApp','Date'];
  const rows=filteredBookings.map(b=>['#AK'+b._id.slice(-6).toUpperCase(),b.template||'',b.groomName||'',b.brideName||'',b.amountPaid||0,b.status||'pending',b.whatsapp||'',b.createdAt?.toDate?.()?.toLocaleDateString('en-IN')||''].map(v=>`"${v}"`));
  const csv=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`bookings-${new Date().toISOString().split('T')[0]}.csv`;a.click();
  showAdminToast('✅ CSV downloaded!','success');
}

window.addEventListener('beforeunload',()=>{if(unsubBookings)unsubBookings();});
document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('bookingsPage'))initBookings();});

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 4 — admin-templates.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

let allTemplates=[],editingTplId=null,uploadedImgUrl='',storage=null;
const GITHUB_BASE='https://raw.githubusercontent.com/akans47g/AKANS_Web/main/';
const DEFAULT_TEMPLATES=[
  {name:'Emerald Noir',desc:'Deep green and gold with ornate corner accents',badge:'Limited Edition',badgeClass:'badge-limited',imgFile:'w1.jpg',previewLink:'',active:true,order:1},
  {name:'Crimson Royale',desc:'Dark charcoal base with gold and deep red accents',badge:'Most Liked',badgeClass:'badge-liked',imgFile:'w2.jpg',previewLink:'',active:true,order:2},
  {name:'Royal Elegance',desc:'Classic ivory and gold with palace motifs',badge:'New',badgeClass:'badge-new',imgFile:'w3.jpg',previewLink:'',active:true,order:3},
  {name:'Garden Romance',desc:'Soft rose and blush with floral accents',badge:'New',badgeClass:'badge-new',imgFile:'w4.jpg',previewLink:'',active:true,order:4},
  {name:'Rose Gold Blush',desc:'Blush pink and rose gold with ornate floral door',badge:'Popular',badgeClass:'badge-hot',imgFile:'w5.jpg',previewLink:'',active:true,order:5},
  {name:'Midnight Royal',desc:'Deep purple and silver with celestial star motifs',badge:'Fan Fav',badgeClass:'badge-liked',imgFile:'w6.jpg',previewLink:'',active:true,order:6},
];
const BADGE_OPTIONS=[{value:'badge-new',label:'🟠 New'},{value:'badge-hot',label:'🔴 Popular'},{value:'badge-liked',label:'🟣 Most Liked'},{value:'badge-limited',label:'🟢 Limited'},{value:'badge-fav',label:'⭐ Fan Fav'}];

async function initTemplates() {
  const session=requireAdminSession();if(!session)return;
  renderSidebar('templates');
  const hName=document.getElementById('adminHeaderName');if(hName)hName.textContent=session.displayName||'Admin';
  try{storage=firebase.storage();}catch(e){}
  await loadTemplates();
}

async function loadTemplates() {
  const grid=document.getElementById('templatesGrid');if(grid)grid.innerHTML=`<div class="tpl-loading"><div class="tpl-spinner"></div><span>Loading...</span></div>`;
  try {
    const snap=await db.collection('templates').orderBy('order','asc').get();
    if(snap.empty){await seedDefaultTemplates();}
    else{allTemplates=snap.docs.map(d=>({_id:d.id,...d.data()}));}
    renderTemplatesGrid();
  } catch(e){allTemplates=DEFAULT_TEMPLATES.map((t,i)=>({_id:'default-'+i,...t}));renderTemplatesGrid();}
}

async function seedDefaultTemplates() {
  const batch=db.batch();
  DEFAULT_TEMPLATES.forEach(t=>{const ref=db.collection('templates').doc();batch.set(ref,{...t,imageUrl:GITHUB_BASE+t.imgFile,createdAt:firebase.firestore.FieldValue.serverTimestamp()});});
  await batch.commit();
  const snap=await db.collection('templates').orderBy('order','asc').get();
  allTemplates=snap.docs.map(d=>({_id:d.id,...d.data()}));
}

function renderTemplatesGrid() {
  const grid=document.getElementById('templatesGrid');if(!grid)return;
  const cEl=document.getElementById('tpl-count');if(cEl)cEl.textContent=allTemplates.length+' templates';
  grid.innerHTML=allTemplates.map((t,i)=>buildTplCard(t,i)).join('')+`<div class="tpl-add-card" onclick="openAddTemplate()"><div class="tpl-add-icon">+</div><div class="tpl-add-label">Naya Template</div></div>`;
}

function buildTplCard(t,i) {
  const imgSrc=t.imageUrl||(GITHUB_BASE+(t.imgFile||'w'+(i+1)+'.jpg'));
  return `<div class="tpl-card ${t.active?'':'tpl-inactive'}" id="tpl-card-${t._id}">
    <div class="tpl-img-wrap"><img src="${imgSrc}" alt="${t.name}" class="tpl-img" onerror="this.parentElement.style.background='#e2e8f0'"/>
      <div class="tpl-img-overlay"><button class="tpl-img-btn" onclick="triggerImgUpload('${t._id}')">📷 Change</button></div>
      <input type="file" id="img-input-${t._id}" accept="image/*" style="display:none;" onchange="handleImageUpload(this,'${t._id}')"/>
      ${t.badge?`<span class="tpl-badge-pill ${t.badgeClass||''}">${t.badge}</span>`:''}
      ${!t.active?`<div class="tpl-inactive-overlay">INACTIVE</div>`:''}
    </div>
    <div class="tpl-info"><div class="tpl-name">${t.name||'Untitled'}</div><div class="tpl-desc">${t.desc||'—'}</div>
      ${t.previewLink?`<a href="${t.previewLink}" target="_blank" class="tpl-preview-link">🔗 Preview</a>`:`<span class="tpl-no-link">⚠️ No link</span>`}
    </div>
    <div class="tpl-footer">
      <div class="tpl-toggle-row" onclick="toggleTemplateActive('${t._id}',${!t.active})"><div class="mini-toggle ${t.active?'on':''}"></div><span class="tpl-toggle-label">${t.active?'Active':'Inactive'}</span></div>
      <div class="tpl-btns"><button class="tpl-btn tpl-btn-edit" onclick="openEditTemplate('${t._id}')">✏️ Edit</button><button class="tpl-btn tpl-btn-del" onclick="deleteTemplate('${t._id}','${t.name}')">🗑️</button></div>
    </div></div>`;
}

function openEditTemplate(id){const t=allTemplates.find(x=>x._id===id);if(!t)return;editingTplId=id;uploadedImgUrl='';document.getElementById('tplModalTitle').textContent='✏️ Edit Template';document.getElementById('tpl-edit-name').value=t.name||'';document.getElementById('tpl-edit-desc').value=t.desc||'';document.getElementById('tpl-edit-link').value=t.previewLink||'';document.getElementById('tpl-edit-badge-text').value=t.badge||'';document.getElementById('tpl-edit-badge-class').value=t.badgeClass||'badge-new';document.getElementById('tpl-edit-order').value=t.order||1;document.getElementById('tpl-edit-active').checked=t.active!==false;const prev=document.getElementById('tpl-modal-preview');if(prev){prev.src=t.imageUrl||(GITHUB_BASE+(t.imgFile||'w1.jpg'));prev.style.display='block';}document.getElementById('tplModal').classList.add('open');}
function openAddTemplate(){editingTplId=null;uploadedImgUrl='';document.getElementById('tplModalTitle').textContent='➕ Add Template';['tpl-edit-name','tpl-edit-desc','tpl-edit-link','tpl-edit-badge-text'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});document.getElementById('tpl-edit-badge-text').value='New';document.getElementById('tpl-edit-badge-class').value='badge-new';document.getElementById('tpl-edit-order').value=allTemplates.length+1;document.getElementById('tpl-edit-active').checked=true;const p=document.getElementById('tpl-modal-preview');if(p)p.style.display='none';document.getElementById('tplModal').classList.add('open');}
function closeTplModal(){document.getElementById('tplModal')?.classList.remove('open');editingTplId=null;uploadedImgUrl='';}
function triggerImgUpload(id){document.getElementById('img-input-'+id)?.click();}
function triggerModalImgUpload(){document.getElementById('tpl-modal-img-input')?.click();}

async function handleImageUpload(input,tplId) {
  const file=input.files?.[0];if(!file)return;
  if(file.size>5*1024*1024){showAdminToast('❌ Max 5MB','error');return;}
  showAdminToast('⏳ Uploading...','info');
  try{
    if(storage){const ref=storage.ref(`templates/${tplId||'new'}_${Date.now()}.${file.name.split('.').pop()}`);const snap=await ref.put(file);uploadedImgUrl=await snap.ref.getDownloadURL();}
    else{uploadedImgUrl=await new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r(rd.result);rd.onerror=()=>j(new Error('fail'));rd.readAsDataURL(file);});}
    if(tplId&&document.getElementById('tpl-card-'+tplId)){const img=document.querySelector(`#tpl-card-${tplId} .tpl-img`);if(img)img.src=uploadedImgUrl;await db.collection('templates').doc(tplId).update({imageUrl:uploadedImgUrl});showAdminToast('✅ Image updated!','success');await loadTemplates();}
    else{const p=document.getElementById('tpl-modal-preview');if(p){p.src=uploadedImgUrl;p.style.display='block';}showAdminToast('✅ Ready — Save karo','success');}
  }catch(e){showAdminToast('❌ '+e.message,'error');}
}

async function saveTplChanges() {
  const name=document.getElementById('tpl-edit-name').value.trim();if(!name){showAdminToast('⚠️ Naam daalo','warning');return;}
  const data={name,desc:document.getElementById('tpl-edit-desc').value.trim(),previewLink:document.getElementById('tpl-edit-link').value.trim(),badge:document.getElementById('tpl-edit-badge-text').value.trim(),badgeClass:document.getElementById('tpl-edit-badge-class').value,order:parseInt(document.getElementById('tpl-edit-order').value)||1,active:document.getElementById('tpl-edit-active').checked,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  if(uploadedImgUrl)data.imageUrl=uploadedImgUrl;
  const btn=document.getElementById('tplSaveBtn');if(btn){btn.disabled=true;btn.textContent='⏳ Saving...';}
  try{
    if(editingTplId){await db.collection('templates').doc(editingTplId).update(data);showAdminToast('✅ Updated!','success');}
    else{data.createdAt=firebase.firestore.FieldValue.serverTimestamp();data.imgFile='w'+(allTemplates.length+1)+'.jpg';if(!data.imageUrl)data.imageUrl=GITHUB_BASE+data.imgFile;await db.collection('templates').add(data);showAdminToast('✅ Added!','success');}
    closeTplModal();await loadTemplates();
  }catch(e){showAdminToast('❌ '+e.message,'error');if(btn){btn.disabled=false;btn.textContent='💾 Save';}}
}

async function toggleTemplateActive(id,newActive){try{await db.collection('templates').doc(id).update({active:newActive});showAdminToast(newActive?'✅ Active':'⭕ Inactive','success');await loadTemplates();}catch(e){showAdminToast('❌ '+e.message,'error');}}
async function deleteTemplate(id,name){if(!confirm(`"${name}" delete karna chahte ho?`))return;try{await db.collection('templates').doc(id).delete();showAdminToast('🗑️ Deleted','success');await loadTemplates();}catch(e){showAdminToast('❌ '+e.message,'error');}}

document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('templatesPage'))initTemplates();});

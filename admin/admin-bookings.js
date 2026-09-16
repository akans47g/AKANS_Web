// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Page specific JS
// admin-shared.js ke baad load karo
// ══════════════════════════════════════════════════════════════════

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
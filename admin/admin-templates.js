// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Templates JS (v2 — Advanced)
// admin-shared.js ke baad load karo
// Features: Analytics, Drag-Reorder, Pricing, Filter/Search, Tags
// ══════════════════════════════════════════════════════════════════

let allTemplates=[],editingTplId=null,uploadedImgUrl='',storage=null,doorsManifest=[];
// Filter / Search state
let _searchQ='', _filterStatus='all', _filterBadge='all';
// Drag & drop state
let _dragId=null;

const GITHUB_BASE='https://raw.githubusercontent.com/akans47g/AKANS_Web/main/';
const DEFAULT_TEMPLATES=[
  {name:'Emerald Noir',desc:'Deep green and gold with ornate corner accents',badge:'Limited Edition',badgeClass:'badge-limited',previewLink:'',active:true,order:1},
  {name:'Crimson Royale',desc:'Dark charcoal base with gold and deep red accents',badge:'Most Liked',badgeClass:'badge-liked',previewLink:'',active:true,order:2},
  {name:'Royal Elegance',desc:'Classic ivory and gold with palace motifs',badge:'New',badgeClass:'badge-new',previewLink:'',active:true,order:3},
  {name:'Garden Romance',desc:'Soft rose and blush with floral accents',badge:'New',badgeClass:'badge-new',previewLink:'',active:true,order:4},
  {name:'Rose Gold Blush',desc:'Blush pink and rose gold with ornate floral door',badge:'Popular',badgeClass:'badge-hot',previewLink:'',active:true,order:5},
  {name:'Midnight Royal',desc:'Deep purple and silver with celestial star motifs',badge:'Fan Fav',badgeClass:'badge-liked',previewLink:'',active:true,order:6},
];

function wrapDoorCode(code) {
  const t = code.trim();
  if (/^<!doctype\s+html/i.test(t) || /^<html/i.test(t)) return t;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;overflow:hidden;background:transparent;}</style></head><body>${t}</body></html>`;
}

async function initTemplates() {
  const session=requireAdminSession();if(!session)return;
  renderSidebar('templates');
  const hName=document.getElementById('adminHeaderName');if(hName)hName.textContent=session.displayName||'Admin';
  try{storage=firebase.storage();}catch(e){}
  await loadDoorsManifest();
  await loadTemplates();
}

async function loadDoorsManifest() {
  try {
    const r = await fetch('../doors/manifest.json');
    if(r.ok) { const j=await r.json(); doorsManifest=j.doors||[]; }
  } catch(e) { doorsManifest=[]; }
}

async function loadTemplates() {
  const grid=document.getElementById('templatesGrid');if(grid)grid.innerHTML=`<div class="tpl-loading"><div class="tpl-spinner"></div><span>Loading...</span></div>`;
  try {
    const snap=await db.collection('templates').get();
    if(snap.empty){await seedDefaultTemplates();}
    else{
      allTemplates=snap.docs.map(d=>({_id:d.id,...d.data()}));
      allTemplates.sort((a,b)=>(a.order||0)-(b.order||0));
    }
    renderTemplatesGrid();
    updateAnalyticsBar();
  } catch(e){allTemplates=DEFAULT_TEMPLATES.map((t,i)=>({_id:'default-'+i,...t}));renderTemplatesGrid();}
}

async function seedDefaultTemplates() {
  const batch=db.batch();
  DEFAULT_TEMPLATES.forEach(t=>{const ref=db.collection('templates').doc();batch.set(ref,{...t,createdAt:firebase.firestore.FieldValue.serverTimestamp()});});
  await batch.commit();
  const snap=await db.collection('templates').get();
  allTemplates=snap.docs.map(d=>({_id:d.id,...d.data()}));
  allTemplates.sort((a,b)=>(a.order||0)-(b.order||0));
}

// ════════════════════════════════════════════════════════════════
// 📊 ANALYTICS BAR
// ════════════════════════════════════════════════════════════════
function updateAnalyticsBar() {
  const total = allTemplates.length;
  const active = allTemplates.filter(t=>t.active!==false).length;
  const inactive = total - active;
  const totalViews = allTemplates.reduce((s,t)=>s+(t.viewCount||0),0);
  const totalBookings = allTemplates.reduce((s,t)=>s+(t.bookingCount||0),0);
  const withPrice = allTemplates.filter(t=>t.price&&t.price>0).length;
  const withDoor = allTemplates.filter(t=>t.doorFile||t.doorCode).length;

  const el=id=>document.getElementById(id);
  if(el('tpl-count'))el('tpl-count').textContent=total;
  if(el('tpl-active-count'))el('tpl-active-count').textContent=active;
  if(el('tpl-inactive-count'))el('tpl-inactive-count').textContent=inactive;
  if(el('an-total-views'))el('an-total-views').textContent=totalViews.toLocaleString();
  if(el('an-total-bookings'))el('an-total-bookings').textContent=totalBookings.toLocaleString();
  if(el('an-with-price'))el('an-with-price').textContent=withPrice+'/'+total;
  if(el('an-with-door'))el('an-with-door').textContent=withDoor+'/'+total;

  // Top template (most views)
  const top = allTemplates.slice().sort((a,b)=>(b.viewCount||0)-(a.viewCount||0))[0];
  if(el('an-top-tpl'))el('an-top-tpl').textContent=top?(top.name||'—'):'—';
}

// ════════════════════════════════════════════════════════════════
// 🔍 FILTER & SEARCH
// ════════════════════════════════════════════════════════════════
function setSearch(val){ _searchQ=val.toLowerCase(); renderTemplatesGrid(); }
function setFilter(status){ _filterStatus=status; renderTemplatesGrid(); updateFilterChips(); }
function setBadgeFilter(badge){ _filterBadge=badge; renderTemplatesGrid(); updateBadgeChips(); }

function updateFilterChips() {
  document.querySelectorAll('.filter-chip[data-status]').forEach(c=>{
    c.classList.toggle('active', c.dataset.status===_filterStatus);
  });
}
function updateBadgeChips() {
  document.querySelectorAll('.filter-chip[data-badge]').forEach(c=>{
    c.classList.toggle('active', c.dataset.badge===_filterBadge);
  });
}

function getFilteredTemplates() {
  return allTemplates.filter(t=>{
    // Status filter
    if(_filterStatus==='active' && t.active===false) return false;
    if(_filterStatus==='inactive' && t.active!==false) return false;
    if(_filterStatus==='premium' && !t.isPremium) return false;
    if(_filterStatus==='door' && !t.doorFile && !t.doorCode) return false;
    // Badge filter
    if(_filterBadge!=='all' && t.badgeClass!==_filterBadge) return false;
    // Search
    if(_searchQ) {
      const hay = ((t.name||'')+' '+(t.desc||'')+' '+(t.tags||'')).toLowerCase();
      if(!hay.includes(_searchQ)) return false;
    }
    return true;
  });
}

// ════════════════════════════════════════════════════════════════
// 🃏 RENDER GRID
// ════════════════════════════════════════════════════════════════
function renderTemplatesGrid() {
  const grid=document.getElementById('templatesGrid');if(!grid)return;
  const filtered = getFilteredTemplates();

  // Stats update
  const cEl=document.getElementById('tpl-count');if(cEl)cEl.textContent=allTemplates.length;
  const acEl=document.getElementById('tpl-active-count');if(acEl)acEl.textContent=allTemplates.filter(t=>t.active!==false).length;
  const inEl=document.getElementById('tpl-inactive-count');if(inEl)inEl.textContent=allTemplates.filter(t=>t.active===false).length;

  const emptyMsg = filtered.length===0 && allTemplates.length>0
    ? `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--fg3);">
        <div style="font-size:2rem;margin-bottom:0.5rem;">🔍</div>
        Koi template nahi mila. Filter clear karo.
        <br><button onclick="clearFilters()" style="margin-top:0.8rem;padding:0.4rem 1rem;border-radius:8px;border:1.5px solid var(--accent);background:var(--accent-lt);color:var(--accent);font-size:0.78rem;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">Clear Filters</button>
      </div>`
    : '';

  grid.innerHTML = filtered.map((t,i)=>buildTplCard(t,i)).join('') + emptyMsg +
    `<div class="tpl-add-card" onclick="openAddTemplate()">
      <div class="tpl-add-icon">+</div>
      <div class="tpl-add-label">Naya Template</div>
    </div>`;

  // Drag & drop listeners
  grid.querySelectorAll('.tpl-card[draggable]').forEach(card=>{
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragover',  onDragOver);
    card.addEventListener('dragleave', onDragLeave);
    card.addEventListener('drop',      onDrop);
    card.addEventListener('dragend',   onDragEnd);
  });
}

function clearFilters(){
  _searchQ=''; _filterStatus='all'; _filterBadge='all';
  const si=document.getElementById('tpl-search-input');if(si)si.value='';
  updateFilterChips(); updateBadgeChips(); renderTemplatesGrid();
}

// ════════════════════════════════════════════════════════════════
// 🃏 BUILD TEMPLATE CARD (enhanced)
// ════════════════════════════════════════════════════════════════
function buildTplCard(t,i) {
  const dc1=t.doorC1||'#8a3540', dc2=t.doorC2||'#5c1620';
  const dc3=t.doorC3||'#3A0710', dc4=t.doorC4||'#0d0203';
  const dseam=t.doorSeam||'#C9A45C';
  const hasDoorFile=!!(t.doorFile&&t.doorFile.trim());
  const hasDoorCode=!!(t.doorCode&&t.doorCode.trim());
  const hasDoor=hasDoorFile||hasDoorCode;
  const doorBadgeText=hasDoorFile?'🚪 '+(_getDoorName(t.doorFile)||'Door ✓'):(hasDoorCode?'🖥️ Code ✓':'');
  const orderNum=t.order||i+1;

  // Price display
  const priceHtml = t.price
    ? `<div class="tpl-price-tag">
        ${t.isPremium?'<span class="tpl-premium-pill">⭐ Premium</span>':'' }
        <span class="tpl-price">₹${Number(t.price).toLocaleString()}</span>
        ${t.origPrice&&t.origPrice>t.price?`<span class="tpl-orig-price">₹${Number(t.origPrice).toLocaleString()}</span>`:''}
       </div>`
    : `<div class="tpl-no-price">💰 Price set nahi</div>`;

  // Tags display
  const tagsArr = (t.tags||'').split(',').map(s=>s.trim()).filter(Boolean);
  const tagsHtml = tagsArr.length
    ? `<div class="tpl-tags">${tagsArr.map(tag=>`<span class="tpl-tag">#${tag}</span>`).join('')}</div>`
    : '';

  // Analytics badges
  const views = t.viewCount||0;
  const bookings = t.bookingCount||0;
  const analyticsHtml = `<div class="tpl-analytics-row">
    <span class="tpl-an-badge">👁 ${views}</span>
    <span class="tpl-an-badge">📋 ${bookings} Bookings</span>
  </div>`;

  return `<div class="tpl-card ${t.active===false?'tpl-inactive':''}" id="tpl-card-${t._id}"
    draggable="true" data-id="${t._id}">
    <!-- Drag handle -->
    <div class="tpl-drag-handle" title="Drag to reorder">⠿</div>
    <div class="tpl-img-wrap">
      <div class="tpl-door-mini" style="--dc1:${dc1};--dc2:${dc2};--dc3:${dc3};--dc4:${dc4};--dseam:${dseam};">
        <div class="tdm-left"></div><div class="tdm-right"></div>
        <div class="tdm-seam"></div><div class="tdm-beam"></div>
        <div class="tdm-btn">♥</div>
        <div class="tdm-corner tdm-tl"></div><div class="tdm-corner tdm-tr"></div>
        <div class="tdm-corner tdm-bl"></div><div class="tdm-corner tdm-br"></div>
      </div>
      <div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.6);color:#e2c77a;font-size:0.62rem;font-weight:800;padding:0.18rem 0.5rem;border-radius:20px;border:1px solid rgba(201,164,92,0.4);">#${orderNum}</div>
      ${hasDoor?`<div class="tpl-code-badge" style="background:${hasDoorFile?'#1a5c2a':'#2a3a1a'};">${doorBadgeText}</div>`:''}
      ${t.badge?`<span class="tpl-badge-pill ${t.badgeClass||''}" style="top:10px;right:8px;left:auto;">${t.badge}</span>`:''}
      ${t.active===false?`<div class="tpl-inactive-overlay">INACTIVE</div>`:''}
    </div>
    <div class="tpl-info">
      <div class="tpl-name">${t.name||'Untitled'}</div>
      <div class="tpl-desc">${t.desc||'—'}</div>
      ${priceHtml}
      ${tagsHtml}
      ${t.previewLink?`<a href="${t.previewLink}" target="_blank" class="tpl-preview-link">🔗 Preview</a>`:`<span class="tpl-no-link">⚠️ No preview link</span>`}
    </div>
    ${analyticsHtml}
    <div class="tpl-footer">
      <div class="tpl-toggle-row" onclick="toggleTemplateActive('${t._id}',${t.active===false})">
        <div class="mini-toggle ${t.active!==false?'on':''}"></div>
        <span class="tpl-toggle-label">${t.active!==false?'Active':'Inactive'}</span>
      </div>
      <div class="tpl-btns">
        <button class="tpl-btn tpl-btn-code ${hasDoor?'code-set':''}" onclick="openDoorSelectModal('${t._id}')" title="Door design select karo">🚪</button>
        <button class="tpl-btn tpl-btn-dup" onclick="duplicateTemplate('${t._id}')" title="Duplicate">⧉</button>
        <button class="tpl-btn tpl-btn-edit" onclick="openEditTemplate('${t._id}')">✏️</button>
        <button class="tpl-btn tpl-btn-del" onclick="deleteTemplate('${t._id}','${t.name}')">🗑️</button>
      </div>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════
// ⧉ DUPLICATE TEMPLATE
// ════════════════════════════════════════════════════════════════
async function duplicateTemplate(id) {
  const t = allTemplates.find(x=>x._id===id); if(!t) return;
  const newOrder = Math.max(...allTemplates.map(x=>x.order||0)) + 1;
  const copy = {
    name: t.name + ' (Copy)',
    desc: t.desc||'',
    previewLink: t.previewLink||'',
    badge: t.badge||'',
    badgeClass: t.badgeClass||'badge-new',
    order: newOrder,
    active: false, // copy starts inactive
    doorC1: t.doorC1||'#8a3540', doorC2: t.doorC2||'#5c1620',
    doorC3: t.doorC3||'#3A0710', doorC4: t.doorC4||'#0d0203',
    doorSeam: t.doorSeam||'#C9A45C',
    doorFile: t.doorFile||'',
    price: t.price||'',
    origPrice: t.origPrice||'',
    isPremium: t.isPremium||false,
    tags: t.tags||'',
    viewCount: 0, bookingCount: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await db.collection('templates').add(copy);
    showAdminToast('⧉ Copy ban gayi! (Inactive)','success');
    await loadTemplates();
  } catch(e) {
    showAdminToast('❌ '+e.message,'error');
  }
}

// ════════════════════════════════════════════════════════════════
// ↕ DRAG & DROP REORDER
// ════════════════════════════════════════════════════════════════
function onDragStart(e) {
  _dragId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  if(card.dataset.id !== _dragId) card.classList.add('drag-over');
}
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onDragEnd(e)   { e.currentTarget.classList.remove('dragging'); }

async function onDrop(e) {
  e.preventDefault();
  const targetCard = e.currentTarget;
  targetCard.classList.remove('drag-over');
  const targetId = targetCard.dataset.id;
  if(!_dragId || _dragId===targetId) return;

  const fromT = allTemplates.find(x=>x._id===_dragId);
  const toT   = allTemplates.find(x=>x._id===targetId);
  if(!fromT||!toT) return;

  // Swap order numbers
  const fromOrder = fromT.order;
  const toOrder   = toT.order;
  fromT.order = toOrder;
  toT.order   = fromOrder;
  allTemplates.sort((a,b)=>(a.order||0)-(b.order||0));
  renderTemplatesGrid();

  // Save to Firestore (background)
  try {
    const batch = db.batch();
    batch.update(db.collection('templates').doc(_dragId), {order: toOrder});
    batch.update(db.collection('templates').doc(targetId), {order: fromOrder});
    await batch.commit();
    showAdminToast('↕️ Order save ho gaya','success');
  } catch(e) {
    showAdminToast('⚠️ Order local save hua, Firestore fail','warning');
  }
  _dragId = null;
}

// ════════════════════════════════════════════════════════════════
// 🚪 DOOR SELECT MODAL
// ════════════════════════════════════════════════════════════════
function _getDoorName(filePath) {
  if(!filePath) return '';
  const d = doorsManifest.find(x=>x.file===filePath);
  return d ? d.name : filePath.split('/').pop().replace('.html','');
}

function openDoorSelectModal(id) {
  const t = allTemplates.find(x=>x._id===id); if(!t) return;
  editingTplId = id;
  const nameEl = document.getElementById('doorSelTplName');
  if(nameEl) nameEl.textContent = `${t.name||'Template'} (Order #${t.order||'?'})`;
  const curEl = document.getElementById('doorSelCurrent');
  if(curEl) curEl.textContent = t.doorFile ? ('✅ '+_getDoorName(t.doorFile)) : (t.doorCode ? '🖥️ Custom Code' : '—  Koi door nahi');
  renderDoorSelectGrid(t.doorFile||'');
  document.getElementById('doorSelModal')?.classList.add('open');
}

function closeDoorSelectModal() {
  document.getElementById('doorSelModal')?.classList.remove('open');
}

function renderDoorSelectGrid(currentFile) {
  const grid = document.getElementById('doorSelGrid'); if(!grid) return;
  if(!doorsManifest.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#999;">
      <div style="font-size:2rem;margin-bottom:0.5rem;">📂</div>
      doors/manifest.json load nahi hua.<br>
      <small>GitHub pe doors/ folder upload karo pehle.</small>
    </div>`;
    return;
  }
  grid.innerHTML = doorsManifest.map(d => {
    const isSelected = d.file === currentFile;
    return `
    <div class="door-sel-card ${isSelected?'door-sel-selected':''}" onclick="selectDoorFile('${d.file}')">
      <div class="door-sel-preview">
        <iframe src="../${d.file}" scrolling="no" frameborder="0"
          style="width:100%;height:100%;border:none;pointer-events:none;"></iframe>
      </div>
      <div class="door-sel-info">
        <div class="door-sel-name">${d.name}</div>
        <div class="door-sel-desc">${d.desc||''}</div>
      </div>
      ${isSelected?`<div class="door-sel-tick">✓ Selected</div>`:`<button class="door-sel-btn" onclick="event.stopPropagation();selectDoorFile('${d.file}')">Select</button>`}
    </div>`;
  }).join('');
}

async function selectDoorFile(filePath) {
  if(!editingTplId){showAdminToast('❌ Template nahi mila','error');return;}
  const t = allTemplates.find(x=>x._id===editingTplId); if(!t) return;
  const btn = document.getElementById('doorSelSaveStatus');
  if(btn) btn.textContent = '⏳ Saving...';
  try {
    await db.collection('templates').doc(editingTplId).update({ doorFile: filePath });
    t.doorFile = filePath;
    renderTemplatesGrid();
    showAdminToast('✅ Door select ho gaya! — ' + _getDoorName(filePath),'success');
    closeDoorSelectModal();
  } catch(e) {
    showAdminToast('❌ Save nahi hua: '+e.message,'error');
    if(btn) btn.textContent = '';
  }
}

async function clearDoorSelection() {
  if(!editingTplId) return;
  if(!confirm('Is template se door hata dena chahte ho?')) return;
  const t = allTemplates.find(x=>x._id===editingTplId);
  try {
    await db.collection('templates').doc(editingTplId).update({ doorFile: '', doorCode: '' });
    if(t) { t.doorFile=''; t.doorCode=''; }
    renderTemplatesGrid();
    showAdminToast('🗑️ Door hata diya','success');
    closeDoorSelectModal();
  } catch(e) {
    showAdminToast('❌ '+e.message,'error');
  }
}

function openDoorCodeModal(id) { openDoorSelectModal(id); }
function closeDoorCodeModal(){ closeDoorSelectModal(); }

function fallbackCopy(text){
  const ta=document.createElement('textarea');
  ta.value=text;ta.style.cssText='position:fixed;top:-9999px;left:-9999px;';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');showAdminToast('📋 Copied!','success');}
  catch(e){prompt('Yeh copy karo:',text);}
  document.body.removeChild(ta);
}
function clearDoorCode() { if(!confirm('Door hata dena chahte ho?'))return; clearDoorSelection(); }
function clearEditDoorCode() { const st=document.getElementById('tpl-edit-code-status');if(st)st.textContent=''; }

// ════════════════════════════════════════════════════════════════
// ✏️ EDIT / ADD MODAL
// ════════════════════════════════════════════════════════════════
function openEditTemplate(id){
  const t=allTemplates.find(x=>x._id===id);if(!t)return;
  editingTplId=id; uploadedImgUrl='';
  document.getElementById('tplModalTitle').textContent='✏️ Edit Template';
  document.getElementById('tpl-edit-name').value=t.name||'';
  document.getElementById('tpl-edit-desc').value=t.desc||'';
  document.getElementById('tpl-edit-link').value=t.previewLink||'';
  document.getElementById('tpl-edit-badge-text').value=t.badge||'';
  document.getElementById('tpl-edit-badge-class').value=t.badgeClass||'badge-new';
  document.getElementById('tpl-edit-order').value=t.order||1;
  document.getElementById('tpl-edit-active').checked=t.active!==false;
  // Pricing
  const _sv=(eid,val)=>{const e=document.getElementById(eid);if(e)e.value=val||'';};
  _sv('tpl-edit-price', t.price||'');
  _sv('tpl-edit-orig-price', t.origPrice||'');
  const premEl=document.getElementById('tpl-edit-premium');if(premEl)premEl.checked=t.isPremium||false;
  // Tags
  _sv('tpl-edit-tags', t.tags||'');
  updateDescCount();
  // Door colors
  const _sc=(eid,val,def)=>{const el=document.getElementById(eid);if(el)el.value=val||def;};
  _sc('door-c1',t.doorC1,'#8a3540'); _sc('door-c2',t.doorC2,'#5c1620');
  _sc('door-c3',t.doorC3,'#3A0710'); _sc('door-c4',t.doorC4,'#0d0203');
  _sc('door-seam',t.doorSeam,'#C9A45C');
  const stEl=document.getElementById('tpl-edit-code-status');
  if(stEl)stEl.textContent=t.doorFile?('🚪 '+_getDoorName(t.doorFile)):(t.doorCode?'🖥️ Custom Code':'');
  setTimeout(()=>{ if(window.updateDoorPreview)updateDoorPreview(); },60);
  document.getElementById('tplModal').classList.add('open');
}

function openAddTemplate(){
  editingTplId=null; uploadedImgUrl='';
  document.getElementById('tplModalTitle').textContent='➕ Add Template';
  ['tpl-edit-name','tpl-edit-desc','tpl-edit-link','tpl-edit-badge-text',
   'tpl-edit-price','tpl-edit-orig-price','tpl-edit-tags'].forEach(id=>{
    const e=document.getElementById(id);if(e)e.value='';
  });
  document.getElementById('tpl-edit-badge-text').value='New';
  document.getElementById('tpl-edit-badge-class').value='badge-new';
  document.getElementById('tpl-edit-order').value=allTemplates.length+1;
  document.getElementById('tpl-edit-active').checked=true;
  const premEl=document.getElementById('tpl-edit-premium');if(premEl)premEl.checked=false;
  const _sd=(eid,val)=>{const el=document.getElementById(eid);if(el)el.value=val;};
  _sd('door-c1','#8a3540');_sd('door-c2','#5c1620');_sd('door-c3','#3A0710');_sd('door-c4','#0d0203');_sd('door-seam','#C9A45C');
  const stEl2=document.getElementById('tpl-edit-code-status');if(stEl2)stEl2.textContent='';
  updateDescCount();
  setTimeout(()=>{ if(window.updateDoorPreview)updateDoorPreview(); },60);
  document.getElementById('tplModal').classList.add('open');
}

function closeTplModal(){document.getElementById('tplModal')?.classList.remove('open');editingTplId=null;uploadedImgUrl='';}

function updateDescCount() {
  const ta=document.getElementById('tpl-edit-desc');
  const ct=document.getElementById('desc-char-count');
  if(ta&&ct) ct.textContent=ta.value.length+'/200';
}

async function saveTplChanges() {
  const name=document.getElementById('tpl-edit-name').value.trim();
  if(!name){showAdminToast('⚠️ Naam daalo','warning');return;}
  const _dc=id=>document.getElementById(id)?.value||'';
  const orderVal=parseInt(document.getElementById('tpl-edit-order').value)||1;
  const priceVal=parseFloat(document.getElementById('tpl-edit-price')?.value||0)||0;
  const origPriceVal=parseFloat(document.getElementById('tpl-edit-orig-price')?.value||0)||0;
  const isPremium=document.getElementById('tpl-edit-premium')?.checked||false;
  const tagsVal=(document.getElementById('tpl-edit-tags')?.value||'').trim();

  const mainData={
    name,
    desc:document.getElementById('tpl-edit-desc').value.trim(),
    previewLink:document.getElementById('tpl-edit-link').value.trim(),
    badge:document.getElementById('tpl-edit-badge-text').value.trim(),
    badgeClass:document.getElementById('tpl-edit-badge-class').value,
    order:orderVal,
    active:document.getElementById('tpl-edit-active').checked,
    doorC1:_dc('door-c1')||'#8a3540',
    doorC2:_dc('door-c2')||'#5c1620',
    doorC3:_dc('door-c3')||'#3A0710',
    doorC4:_dc('door-c4')||'#0d0203',
    doorSeam:_dc('door-seam')||'#C9A45C',
    price: priceVal,
    origPrice: origPriceVal,
    isPremium: isPremium,
    tags: tagsVal,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };

  const btn=document.getElementById('tplSaveBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Saving...';}
  const _to=ms=>new Promise((_,rej)=>setTimeout(()=>rej(new Error('Network slow — local save hua hai ✓')),ms));

  try{
    if(editingTplId){
      await Promise.race([db.collection('templates').doc(editingTplId).update(mainData),_to(10000)]);
    }else{
      mainData.createdAt=firebase.firestore.FieldValue.serverTimestamp();
      mainData.viewCount=0; mainData.bookingCount=0;
      await Promise.race([db.collection('templates').add(mainData),_to(10000)]);
    }
    showAdminToast('✅ Saved!','success');
    closeTplModal();
    await loadTemplates();
  }catch(e){
    showAdminToast('⚠️ '+e.message,'warning');
    const t=allTemplates.find(x=>x._id===editingTplId);
    if(t){ Object.assign(t,{...mainData}); renderTemplatesGrid(); }
    if(btn){btn.disabled=false;btn.textContent='💾 Save Karo';}
    closeTplModal();
  }
}

async function toggleTemplateActive(id,newActive){
  try{
    await db.collection('templates').doc(id).update({active:newActive});
    const t=allTemplates.find(x=>x._id===id);if(t)t.active=newActive;
    renderTemplatesGrid(); updateAnalyticsBar();
    showAdminToast(newActive?'✅ Active':'⭕ Inactive','success');
  }catch(e){showAdminToast('❌ '+e.message,'error');}
}

async function deleteTemplate(id,name){
  if(!confirm(`"${name}" delete karna chahte ho?`))return;
  try{
    await db.collection('templates').doc(id).delete();
    allTemplates=allTemplates.filter(x=>x._id!==id);
    renderTemplatesGrid(); updateAnalyticsBar();
    showAdminToast('🗑️ Deleted','success');
  }catch(e){showAdminToast('❌ '+e.message,'error');}
}

document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('templatesPage'))initWithAuth(initTemplates);});

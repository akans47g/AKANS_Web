// ══════════════════════════════════════════════════════════════════
// AKANS Admin Panel — Page specific JS
// admin-shared.js ke baad load karo
// ══════════════════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════════╗
// ║         SECTION 4 — admin-templates.html                    ║
// ╚══════════════════════════════════════════════════════════════╝

let allTemplates=[],editingTplId=null,uploadedImgUrl='',storage=null;
const GITHUB_BASE='https://raw.githubusercontent.com/akans47g/AKANS_Web/main/';
const DEFAULT_TEMPLATES=[
  {name:'Emerald Noir',desc:'Deep green and gold with ornate corner accents',badge:'Limited Edition',badgeClass:'badge-limited',previewLink:'',active:true,order:1},
  {name:'Crimson Royale',desc:'Dark charcoal base with gold and deep red accents',badge:'Most Liked',badgeClass:'badge-liked',previewLink:'',active:true,order:2},
  {name:'Royal Elegance',desc:'Classic ivory and gold with palace motifs',badge:'New',badgeClass:'badge-new',previewLink:'',active:true,order:3},
  {name:'Garden Romance',desc:'Soft rose and blush with floral accents',badge:'New',badgeClass:'badge-new',previewLink:'',active:true,order:4},
  {name:'Rose Gold Blush',desc:'Blush pink and rose gold with ornate floral door',badge:'Popular',badgeClass:'badge-hot',previewLink:'',active:true,order:5},
  {name:'Midnight Royal',desc:'Deep purple and silver with celestial star motifs',badge:'Fan Fav',badgeClass:'badge-liked',previewLink:'',active:true,order:6},
];
const BADGE_OPTIONS=[{value:'badge-new',label:'🟠 New'},{value:'badge-hot',label:'🔴 Popular'},{value:'badge-liked',label:'🟣 Most Liked'},{value:'badge-limited',label:'🟢 Limited'},{value:'badge-fav',label:'⭐ Fan Fav'}];

// ── Door code ko iframe ke liye prepare karo ──
// Full HTML document ho to as-is use karo; snippet ho to wrap karo
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
  await loadTemplates();
}

async function loadTemplates() {
  const grid=document.getElementById('templatesGrid');if(grid)grid.innerHTML=`<div class="tpl-loading"><div class="tpl-spinner"></div><span>Loading...</span></div>`;
  try {
    // orderBy nahi — client-side sort
    const snap=await db.collection('templates').get();
    if(snap.empty){await seedDefaultTemplates();}
    else{
      allTemplates=snap.docs.map(d=>({_id:d.id,...d.data()}));
      allTemplates.sort((a,b)=>(a.order||0)-(b.order||0));
    }
    renderTemplatesGrid();
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

function renderTemplatesGrid() {
  const grid=document.getElementById('templatesGrid');if(!grid)return;
  const cEl=document.getElementById('tpl-count');if(cEl)cEl.textContent=allTemplates.length+' templates';
  grid.innerHTML=allTemplates.map((t,i)=>buildTplCard(t,i)).join('')+`<div class="tpl-add-card" onclick="openAddTemplate()"><div class="tpl-add-icon">+</div><div class="tpl-add-label">Naya Template</div></div>`;
}

// ── Template card — image nahi, door mini preview dikhata hai ──
function buildTplCard(t,i) {
  const dc1=t.doorC1||'#8a3540', dc2=t.doorC2||'#5c1620';
  const dc3=t.doorC3||'#3A0710', dc4=t.doorC4||'#0d0203';
  const dseam=t.doorSeam||'#C9A45C';
  const hasCode=!!(t.doorCode&&t.doorCode.trim());

  return `<div class="tpl-card ${t.active?'':'tpl-inactive'}" id="tpl-card-${t._id}">
    <div class="tpl-img-wrap">
      <div class="tpl-door-mini" style="--dc1:${dc1};--dc2:${dc2};--dc3:${dc3};--dc4:${dc4};--dseam:${dseam};">
        <div class="tdm-left"></div><div class="tdm-right"></div>
        <div class="tdm-seam"></div><div class="tdm-beam"></div>
        <div class="tdm-btn">♥</div>
        <div class="tdm-corner tdm-tl"></div><div class="tdm-corner tdm-tr"></div>
        <div class="tdm-corner tdm-bl"></div><div class="tdm-corner tdm-br"></div>
      </div>
      ${hasCode?`<div class="tpl-code-badge">🖥️ Code Added ✓</div>`:''}
      ${t.badge?`<span class="tpl-badge-pill ${t.badgeClass||''}">${t.badge}</span>`:''}
      ${!t.active?`<div class="tpl-inactive-overlay">INACTIVE</div>`:''}
    </div>
    <div class="tpl-info">
      <div class="tpl-name">${t.name||'Untitled'}</div>
      <div class="tpl-desc">${t.desc||'—'}</div>
      ${t.previewLink?`<a href="${t.previewLink}" target="_blank" class="tpl-preview-link">🔗 Preview</a>`:`<span class="tpl-no-link">⚠️ No link</span>`}
    </div>
    <div class="tpl-footer">
      <div class="tpl-toggle-row" onclick="toggleTemplateActive('${t._id}',${!t.active})">
        <div class="mini-toggle ${t.active?'on':''}"></div>
        <span class="tpl-toggle-label">${t.active?'Active':'Inactive'}</span>
      </div>
      <div class="tpl-btns">
        <button class="tpl-btn tpl-btn-code ${hasCode?'code-set':''}" onclick="openDoorCodeModal('${t._id}')" title="Door HTML code add/edit karo">🖥️</button>
        <button class="tpl-btn tpl-btn-edit" onclick="openEditTemplate('${t._id}')">✏️ Edit</button>
        <button class="tpl-btn tpl-btn-del" onclick="deleteTemplate('${t._id}','${t.name}')">🗑️</button>
      </div>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════
// DOOR CODE MODAL — paste karo, preview dekho, save karo
// ════════════════════════════════════════════════════════════════

function openDoorCodeModal(id) {
  const t=allTemplates.find(x=>x._id===id);if(!t)return;
  editingTplId=id;
  const nameEl=document.getElementById('codeModalTplName');
  if(nameEl)nameEl.textContent=t.name||'Template';
  const ta=document.getElementById('door-code-textarea');
  if(ta)ta.value=t.doorCode||'';
  setTimeout(()=>updateCodePreview(),80);
  document.getElementById('codeModal').classList.add('open');
}

function closeDoorCodeModal(){
  document.getElementById('codeModal')?.classList.remove('open');
}

function updateCodePreview() {
  const ta=document.getElementById('door-code-textarea');
  const fr=document.getElementById('door-code-preview-iframe');
  if(!ta||!fr)return;
  const code=ta.value.trim();
  if(!code){
    fr.srcdoc='<html><body style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-family:sans-serif;font-size:0.8rem;background:#111;">Code paste karo →</body></html>';
    return;
  }
  fr.srcdoc=wrapDoorCode(code);
}

async function saveDoorCode() {
  if(!editingTplId){showAdminToast('❌ Template select nahi hai','error');return;}
  const ta=document.getElementById('door-code-textarea');
  const code=(ta?.value||'').trim();
  const btn=document.getElementById('codeSaveBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Saving...';}
  const _timeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error('Internet slow hai — dobara try karo')),30000));
  try{
    await Promise.race([db.collection('templates').doc(editingTplId).update({doorCode:code}),_timeout]);
    const t=allTemplates.find(x=>x._id===editingTplId);
    if(t)t.doorCode=code;
    showAdminToast('✅ Door code save ho gaya!','success');
    renderTemplatesGrid();
    closeDoorCodeModal();
  }catch(e){showAdminToast('❌ '+e.message,'error');}
  if(btn){btn.disabled=false;btn.textContent='💾 Save Code';}
}

function clearDoorCode() {
  if(!confirm('Is template ka door code hata dena chahte ho?'))return;
  const ta=document.getElementById('door-code-textarea');
  if(ta)ta.value='';
  updateCodePreview();
}

function clearEditDoorCode() {
  const ta=document.getElementById('tpl-edit-door-code');
  if(ta)ta.value='';
  const st=document.getElementById('tpl-edit-code-status');
  if(st)st.textContent='';
}

// ════════════════════════════════════════════════════════════════
// EDIT / ADD MODAL
// ════════════════════════════════════════════════════════════════

function openEditTemplate(id){
  const t=allTemplates.find(x=>x._id===id);if(!t)return;
  editingTplId=id;uploadedImgUrl='';
  document.getElementById('tplModalTitle').textContent='✏️ Edit Template';
  document.getElementById('tpl-edit-name').value=t.name||'';
  document.getElementById('tpl-edit-desc').value=t.desc||'';
  document.getElementById('tpl-edit-link').value=t.previewLink||'';
  document.getElementById('tpl-edit-badge-text').value=t.badge||'';
  document.getElementById('tpl-edit-badge-class').value=t.badgeClass||'badge-new';
  document.getElementById('tpl-edit-order').value=t.order||1;
  document.getElementById('tpl-edit-active').checked=t.active!==false;
  // Door colors load karo
  const _sc=(eid,val,def)=>{const el=document.getElementById(eid);if(el)el.value=val||def;};
  _sc('door-c1',t.doorC1,'#8a3540'); _sc('door-c2',t.doorC2,'#5c1620');
  _sc('door-c3',t.doorC3,'#3A0710'); _sc('door-c4',t.doorC4,'#0d0203');
  _sc('door-seam',t.doorSeam,'#C9A45C');
  // Door code load karo
  const dcEl=document.getElementById('tpl-edit-door-code');
  if(dcEl)dcEl.value=t.doorCode||'';
  const stEl=document.getElementById('tpl-edit-code-status');
  if(stEl)stEl.textContent=(t.doorCode&&t.doorCode.trim())?'✅ Code saved':'';
  setTimeout(()=>{ if(window.updateDoorPreview)updateDoorPreview(); },60);
  document.getElementById('tplModal').classList.add('open');
}

function openAddTemplate(){
  editingTplId=null;uploadedImgUrl='';
  document.getElementById('tplModalTitle').textContent='➕ Add Template';
  ['tpl-edit-name','tpl-edit-desc','tpl-edit-link','tpl-edit-badge-text'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('tpl-edit-badge-text').value='New';
  document.getElementById('tpl-edit-badge-class').value='badge-new';
  document.getElementById('tpl-edit-order').value=allTemplates.length+1;
  document.getElementById('tpl-edit-active').checked=true;
  // Default door colors reset
  const _sd=(eid,val)=>{const el=document.getElementById(eid);if(el)el.value=val;};
  _sd('door-c1','#8a3540');_sd('door-c2','#5c1620');_sd('door-c3','#3A0710');_sd('door-c4','#0d0203');_sd('door-seam','#C9A45C');
  // Door code clear karo
  const dcEl2=document.getElementById('tpl-edit-door-code');if(dcEl2)dcEl2.value='';
  const stEl2=document.getElementById('tpl-edit-code-status');if(stEl2)stEl2.textContent='';
  setTimeout(()=>{ if(window.updateDoorPreview)updateDoorPreview(); },60);
  document.getElementById('tplModal').classList.add('open');
}

function closeTplModal(){document.getElementById('tplModal')?.classList.remove('open');editingTplId=null;uploadedImgUrl='';}

async function saveTplChanges() {
  const name=document.getElementById('tpl-edit-name').value.trim();if(!name){showAdminToast('⚠️ Naam daalo','warning');return;}
  const _dc=id=>document.getElementById(id)?.value||'';
  const doorCodeValue=(document.getElementById('tpl-edit-door-code')?.value||'').trim();
  // Main data — doorCode alag save hoga (large file slow network pe hang karta tha)
  const mainData={
    name,
    desc:document.getElementById('tpl-edit-desc').value.trim(),
    previewLink:document.getElementById('tpl-edit-link').value.trim(),
    badge:document.getElementById('tpl-edit-badge-text').value.trim(),
    badgeClass:document.getElementById('tpl-edit-badge-class').value,
    order:parseInt(document.getElementById('tpl-edit-order').value)||1,
    active:document.getElementById('tpl-edit-active').checked,
    doorC1:_dc('door-c1')||'#8a3540',
    doorC2:_dc('door-c2')||'#5c1620',
    doorC3:_dc('door-c3')||'#3A0710',
    doorC4:_dc('door-c4')||'#0d0203',
    doorSeam:_dc('door-seam')||'#C9A45C',
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  const btn=document.getElementById('tplSaveBtn');if(btn){btn.disabled=true;btn.textContent='⏳ Saving...';}
  const _to=ms=>new Promise((_,rej)=>setTimeout(()=>rej(new Error('Network slow hai — retry karo')),ms));
  try{
    let docId=editingTplId;
    if(editingTplId){
      await Promise.race([db.collection('templates').doc(editingTplId).update(mainData),_to(12000)]);
    }else{
      mainData.createdAt=firebase.firestore.FieldValue.serverTimestamp();
      const ref=await Promise.race([db.collection('templates').add(mainData),_to(12000)]);
      docId=ref.id;
    }
    showAdminToast('✅ Saved!','success');
    closeTplModal();
    await loadTemplates();
    // Step 2: Door code alag save karo (bada data, zyada time)
    if(docId){
      try{
        await Promise.race([db.collection('templates').doc(docId).update({doorCode:doorCodeValue}),_to(30000)]);
        const t2=allTemplates.find(x=>x._id===docId);
        if(t2)t2.doorCode=doorCodeValue;
        renderTemplatesGrid();
      }catch(cErr){showAdminToast('⚠️ Door code save nahi hua — 🖥️ button se dobara try karo','warning');}
    }
  }catch(e){showAdminToast('❌ '+e.message,'error');if(btn){btn.disabled=false;btn.textContent='💾 Save Karo';}}
}

async function toggleTemplateActive(id,newActive){try{await db.collection('templates').doc(id).update({active:newActive});showAdminToast(newActive?'✅ Active':'⭕ Inactive','success');await loadTemplates();}catch(e){showAdminToast('❌ '+e.message,'error');}}
async function deleteTemplate(id,name){if(!confirm(`"${name}" delete karna chahte ho?`))return;try{await db.collection('templates').doc(id).delete();showAdminToast('🗑️ Deleted','success');await loadTemplates();}catch(e){showAdminToast('❌ '+e.message,'error');}}

document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('templatesPage'))initWithAuth(initTemplates);});

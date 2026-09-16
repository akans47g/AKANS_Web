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
/* modules/settings.js — Settings — exportData, importData, openSettings, renderQuickLinks
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
  // ══ EXPORT / IMPORT ══
  exportData(){
    const keys=['props','tenants','payments','reminders','patients','visits','trips','buckets'];
    const data={};keys.forEach(k=>data[k]=S.get(k));data.persons=this.persons;
    const exp={_meta:{exportedAt:new Date().toISOString(),exportedDate:todayDMY(),version:'4',app:'Raman Kumar Dashboard'},data};
    const blob=new Blob([JSON.stringify(exp,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    const ds=new Date().toISOString().slice(0,10).replace(/-/g,'');
    a.href=url;a.download=`RamanDashboard_v4_${ds}.json`;a.click();URL.revokeObjectURL(url);
    document.getElementById('eiMT').textContent='✅ Export Successful';
    document.getElementById('eiMB').innerHTML=`<div style="background:#f0faf5;border:1px solid #90c8a0;border-radius:9px;padding:14px;font-size:.83rem;line-height:1.8;">
      <b>File downloaded:</b> RamanDashboard_v4_${ds}.json<br>
      🏢 Properties: ${this.props.length} | 👥 Tenants: ${this.tenants.length} | 💰 Payments: ${this.payments.length}<br>
      🔔 Reminders: ${this.reminders.length} | 🏥 Patients: ${this.patients.length} | 💊 Visits: ${this.visits.length}<br>
      ✈️ Trips: ${this.trips.length} | 🌟 Bucket: ${this.buckets.length}<br><br>
      <b>📌 To send to Claude for update:</b><br>
      1. Find the .json file in Downloads<br>2. Attach it in Claude chat (📎 icon)<br>3. Say "Update my website with this data"
    </div>`;
    M.open('eiM');
  },
  importData(event){
    const file=event.target.files[0];if(!file)return;
    if(!file.name.endsWith('.json')){alert('Please select a .json file');return;}
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const obj=JSON.parse(e.target.result);
        const data=obj.data||obj;
        if(!data.props&&!data.tenants&&!data.reminders){alert('Invalid file — not a Raman Dashboard backup');return;}
        this._impBuf={persons:data.persons||['Raman'],props:data.props||[],tenants:data.tenants||[],payments:data.payments||[],reminders:data.reminders||[],patients:data.patients||[],visits:data.visits||[],trips:data.trips||[],buckets:data.buckets||[]};
        const b=this._impBuf;const meta=obj._meta||{};
        document.getElementById('eiMT').textContent='⬆️ Import Preview';
        document.getElementById('eiMB').innerHTML=`<div style="background:#e3f2fd;border:1px solid #90b8e8;border-radius:9px;padding:13px;font-size:.83rem;margin-bottom:12px;line-height:1.8;">
          <b>File:</b> ${file.name}${meta.exportedDate?`<br><b>Exported:</b> ${meta.exportedDate}`:''}<br>
          🏢 ${b.props.length} props | 👥 ${b.tenants.length} tenants | 💰 ${b.payments.length} payments<br>
          🔔 ${b.reminders.length} reminders | 🏥 ${b.patients.length} patients | 💊 ${b.visits.length} visits<br>
          ✈️ ${b.trips.length} trips | 🌟 ${b.buckets.length} bucket
        </div>
        <div style="background:#fff8ee;border:1px solid #f0c060;border-radius:9px;padding:12px;font-size:.82rem;color:#5a4000;margin-bottom:14px;">
          ⚠️ This will replace ALL current data. Export first if needed!
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn b-out" onclick="M.close('eiM')">Cancel</button>
          <button class="btn b-gold" onclick="APP.doImport()">✅ Yes, Import Now</button>
        </div>`;
        M.open('eiM');
      }catch(err){alert('Could not read file: '+err.message);}
    };
    reader.readAsText(file);event.target.value='';
  },
  doImport(){
    const b=this._impBuf;if(!b)return;
    ['persons','props','tenants','payments','reminders','patients','visits','trips','buckets'].forEach(k=>S.set(k,b[k]));
    this._impBuf=null;M.close('eiM');
    setTimeout(()=>{this.curPerson=(b.persons&&b.persons[0])||'Raman';this.refreshPersons();this.renderPills();this.renderTab(this.curTab);alert(`✅ Import done!\n${b.props.length} properties, ${b.tenants.length} tenants, ${b.visits.length} medical records loaded.`);},100);
  },

  confirmDel(){if(this.delCb){this.delCb();this.delCb=null;}M.close('delM');},

  // ── FIREBASE SAVE ALL ──
  // fbSaveAll removed — sync is now fully automatic via S.set → fbSave → Firestore → onSnapshot
  doLogin(){
    const pwd=document.getElementById('loginPwd').value;
    const saved=localStorage.getItem('rk_password')||'raman123';
    if(pwd===saved){
      localStorage.setItem('rk_loggedIn','1');
      document.getElementById('loginM').style.display='none';
      document.getElementById('loginErr').style.display='none';
      // Trigger daily reminder check after login
      setTimeout(function(){ if(localStorage.getItem('rk_push_enabled')==='1') _pushCheckTodayReminders(); }, 2000);
    } else {
      document.getElementById('loginErr').style.display='block';
      document.getElementById('loginPwd').value='';
    }
  },
  _showForgotPwd(show){
    const main=document.getElementById('_loginMain');
    const forgot=document.getElementById('_loginForgot');
    if(main) main.style.display=(show===false?'block':'none');
    if(forgot) forgot.style.display=(show===false?'none':'block');
    const err=document.getElementById('_forgotErr');
    if(err) err.style.display='none';
  },
  _doForgotPwd(){
    const ans=(document.getElementById('_forgotAns')||{}).value||'';
    const newP=(document.getElementById('_forgotNew')||{}).value||'';
    const err=document.getElementById('_forgotErr');
    // Secret answer — your father's name
    const SECRET='pawan'; // case-insensitive match
    if(ans.trim().toLowerCase()!==SECRET){
      if(err){err.textContent='❌ Wrong answer! Try again.';err.style.display='block';}
      return;
    }
    if(newP.length<4){
      if(err){err.textContent='❌ Password must be at least 4 characters.';err.style.display='block';}
      return;
    }
    localStorage.setItem('rk_password',newP);
    localStorage.setItem('rk_loggedIn','1');
    document.getElementById('loginM').style.display='none';
    this.showToastMsg('✅ Password reset successfully! New password saved.');
  },
  checkLogin(){
    if(!localStorage.getItem('rk_loggedIn')){
      document.getElementById('loginM').style.display='flex';
    }
  },
  logout(){
    localStorage.removeItem('rk_loggedIn');
    location.reload();
  },
  changePwd(){
    const oldP=document.getElementById('pwd_old').value;
    const newP=document.getElementById('pwd_new').value;
    const saved=localStorage.getItem('rk_password')||'raman123';
    const msg=document.getElementById('pwdMsg');
    msg.style.display='block';
    if(oldP!==saved){msg.style.color='var(--red)';msg.textContent='❌ Current password galat hai!';return;}
    if(newP.length<4){msg.style.color='var(--red)';msg.textContent='❌ New password kam se kam 4 characters ka hona chahiye!';return;}
    localStorage.setItem('rk_password',newP);
    msg.style.color='var(--grn)';msg.textContent='✅ Password saved!';
    document.getElementById('pwd_old').value='';document.getElementById('pwd_new').value='';
  },

  // ── SETTINGS ──
  openSettings(){
    // Render quick links manager
    let links; try{ links=JSON.parse(localStorage.getItem('rk_quicklinks')||'[]'); }catch{ links=[]; }
    const linksEl=document.getElementById('settingsLinks');
    if(links.length){
      linksEl.innerHTML=links.map((l,i)=>`
        <div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:7px;padding:7px 10px;">
          <img src="https://www.google.com/s2/favicons?domain=${l.url}&sz=16" onerror="this.style.display='none'" style="width:14px;height:14px;">
          <span style="flex:1;font-size:.82rem;font-weight:600;">${l.name}</span>
          <span style="font-size:.72rem;color:var(--mut);">${l.url}</span>
          <button class="btn b-red b-sm" onclick="APP.delQuickLink(${i});APP.openSettings()">🗑 Remove</button>
        </div>`).join('');
    } else {
      linksEl.innerHTML='<div style="color:var(--mut);font-size:.82rem;padding:6px;">No quick links added yet.</div>';
    }

    // Render delete list — all records grouped by section
    const dlEl=document.getElementById('settingsDeleteList');
    let html='';

    // Properties
    if(this.props.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:4px 0 2px;">🏢 Properties</div>`;
      html+=this.props.map(p=>`<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:7px;padding:6px 10px;">
        <span style="flex:1;font-size:.82rem;">🏢 ${p.name} ${p.city?'— '+p.city:''}</span>
        <button class="btn b-red b-sm" onclick="APP._settingsDelProp('${p.id}')">🗑 Delete</button>
      </div>`).join('');
    }

    // Tenants
    if(this.tenants.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">👥 Tenants</div>`;
      html+=this.tenants.map(t=>{const p=this.props.find(x=>x.id===t.propId);return`<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:7px;padding:6px 10px;">
        <span style="flex:1;font-size:.82rem;">👤 ${t.name} ${p?'— '+p.name:''}</span>
        <button class="btn b-red b-sm" onclick="APP._settingsDelTenant('${t.id}')">🗑 Delete</button>
      </div>`;}).join('');
    }

    // Payments
    if(this.payments.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">💰 Payments (${this.payments.length} records)</div>`;
      html+=[...this.payments].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10).map(p=>{const t=this.tenants.find(x=>x.id===p.tenantId);return`<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:7px;padding:6px 10px;">
        <span style="flex:1;font-size:.82rem;">💰 ${fD(p.date)} — ${t?t.name:'?'} — ${fmt(p.amount)}</span>
        <button class="btn b-red b-sm" onclick="APP._settingsDelPayment('${p.id}')">🗑 Delete</button>
      </div>`;}).join('');
    }

    // Reminders
    if(this.reminders.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">🔔 Reminders</div>`;
      html+=this.reminders.map(r=>`<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:7px;padding:6px 10px;">
        <span style="flex:1;font-size:.82rem;">🔔 ${r.name} — ${r.type} — ${fD(r.exp)}</span>
        <button class="btn b-red b-sm" onclick="APP._settingsDelReminder('${r.id}')">🗑 Delete</button>
      </div>`).join('');
    }

    // Medical
    if(this.visits.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">🏥 Medical Visits</div>`;
      html+=this.visits.map(r=>{const p=this.patients.find(x=>x.id===r.patId);return`<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:7px;padding:6px 10px;">
        <span style="flex:1;font-size:.82rem;">🏥 ${fD(r.date)} — ${p?p.name:'?'} — Dr.${r.doctor||'—'}</span>
        <button class="btn b-red b-sm" onclick="APP._settingsDelVisit('${r.id}')">🗑 Delete</button>
      </div>`;}).join('');
    }

    // Trips
    if(this.trips.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">✈️ Trips</div>`;
      html+=this.trips.map(t=>`<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:7px;padding:6px 10px;">
        <span style="flex:1;font-size:.82rem;">✈️ ${t.dest} — ${fD(t.dep)}</span>
        <button class="btn b-red b-sm" onclick="APP._settingsDelTrip('${t.id}')">🗑 Delete</button>
      </div>`).join('');
    }

    // Diary
    let diary; try{ diary=JSON.parse(localStorage.getItem('rk_diary')||'[]'); }catch{ diary=[]; }
    if(diary.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">📖 Diary Entries</div>`;
      html+=diary.slice(0,10).map(e=>`<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--bdr);border-radius:7px;padding:6px 10px;">
        <span style="flex:1;font-size:.82rem;">📖 ${fD(e.date)} — ${e.title||'Untitled'}</span>
        <button class="btn b-red b-sm" onclick="APP._settingsDelDiary('${e.id}')">🗑 Delete</button>
      </div>`).join('');
    }

    if(!html) html='<div style="color:var(--mut);font-size:.82rem;padding:8px;">No records to delete.</div>';
    dlEl.innerHTML=html;
    M.open('settingsM');
  },

  // ── Settings delete helpers — show confirm FIRST, then delete, then reopen settings ──
  _settingsDelProp(id){
    this.delCb=()=>{
      S.set('props',this.props.filter(p=>p.id!==id));
      S.set('tenants',this.tenants.filter(t=>t.propId!==id));
      if(this.curProp===id)this.curProp=null;
      this.renderProperty();this.renderPills();
      M.close('settingsM');
      setTimeout(()=>this.openSettings(),100);
    };
    document.getElementById('delMsg').textContent='Delete property aur uske sab tenants?';
    M.close('settingsM');
    setTimeout(()=>M.open('delM'),100);
  },
  _settingsDelTenant(id){
    this.delCb=()=>{
      S.set('tenants',this.tenants.filter(t=>t.id!==id));
      S.set('payments',this.payments.filter(p=>p.tenantId!==id));
      this.renderTab(this.curTab);this.renderPills();
      M.close('settingsM');
      setTimeout(()=>this.openSettings(),100);
    };
    document.getElementById('delMsg').textContent='Delete tenant aur uski sab payments?';
    M.close('settingsM');
    setTimeout(()=>M.open('delM'),100);
  },
  _settingsDelPayment(id){
    this.delCb=()=>{
      S.set('payments',this.payments.filter(p=>p.id!==id));
      this.renderTab(this.curTab);this.renderPills();
      M.close('settingsM');
      setTimeout(()=>this.openSettings(),100);
    };
    document.getElementById('delMsg').textContent='Delete this payment record?';
    M.close('settingsM');
    setTimeout(()=>M.open('delM'),100);
  },
  _settingsDelReminder(id){
    this.delCb=()=>{
      S.set('reminders',this.reminders.filter(r=>r.id!==id));
      this.renderReminders();this.renderPills();
      M.close('settingsM');
      setTimeout(()=>this.openSettings(),100);
    };
    document.getElementById('delMsg').textContent='Delete this reminder?';
    M.close('settingsM');
    setTimeout(()=>M.open('delM'),100);
  },
  _settingsDelVisit(id){
    this.delCb=()=>{
      S.set('visits',this.visits.filter(r=>r.id!==id));
      this.renderMedical();
      M.close('settingsM');
      setTimeout(()=>this.openSettings(),100);
    };
    document.getElementById('delMsg').textContent='Delete this medical record?';
    M.close('settingsM');
    setTimeout(()=>M.open('delM'),100);
  },
  _settingsDelTrip(id){
    this.delCb=()=>{
      S.set('trips',this.trips.filter(t=>t.id!==id));
      this.renderTravel();this.renderPills();
      M.close('settingsM');
      setTimeout(()=>this.openSettings(),100);
    };
    document.getElementById('delMsg').textContent='Delete this trip?';
    M.close('settingsM');
    setTimeout(()=>M.open('delM'),100);
  },
  _settingsDelDiary(id){
    this.delCb=()=>{
      this.saveDiaryEntries(this.getDiaryEntries().filter(e=>e.id!==id));
      this.renderDiary();
      M.close('settingsM');
      setTimeout(()=>this.openSettings(),100);
    };
    document.getElementById('delMsg').textContent='Delete this diary entry?';
    M.close('settingsM');
    setTimeout(()=>M.open('delM'),100);
  },

  // ── PDF ORIENTATION TOGGLE ──
  _setPdfOrientation(ori){
    this._pdfOrientation = ori;
    // Update all toggle buttons in the page
    document.querySelectorAll('.pdf-ori-btn').forEach(btn=>{
      const isActive = btn.dataset.ori === ori;
      btn.style.background = isActive ? '#e53935' : '#fff';
      btn.style.color = isActive ? '#fff' : '#e53935';
      btn.style.borderColor = '#e53935';
    });
    this.showToastMsg(ori==='landscape' ? '🖨️ PDF: Landscape (wide)' : '🖨️ PDF: Portrait (vertical)');
  },

  // Renders the portrait/landscape toggle — call inline wherever a PDF button exists
  _pdfOriHtml(){
    const p = this._pdfOrientation||'portrait';
    return `<span style="display:inline-flex;border:1.5px solid #e53935;border-radius:6px;overflow:hidden;vertical-align:middle;margin-left:4px;">` +
      `<button class="pdf-ori-btn" data-ori="portrait"  onclick="APP._setPdfOrientation('portrait')"  style="padding:4px 8px;font-size:.68rem;font-weight:800;cursor:pointer;border:none;font-family:Nunito,sans-serif;background:${p==='portrait'?'#e53935':'#fff'};color:${p==='portrait'?'#fff':'#e53935'};">⬛ P</button>` +
      `<button class="pdf-ori-btn" data-ori="landscape" onclick="APP._setPdfOrientation('landscape')" style="padding:4px 8px;font-size:.68rem;font-weight:800;cursor:pointer;border:none;border-left:1.5px solid #e53935;font-family:Nunito,sans-serif;background:${p==='landscape'?'#e53935':'#fff'};color:${p==='landscape'?'#fff':'#e53935'};">⬜ L</button>` +
    `</span>`;
  },

  showToastMsg(msg,dur=2500){
    let t=document.getElementById('appToast');
    if(!t){
      t=document.createElement('div');
      t.id='appToast';
      t.style.cssText='position:fixed;bottom:20px;right:20px;background:#1e7a45;color:#fff;padding:10px 18px;border-radius:10px;font-family:Nunito,sans-serif;font-size:.84rem;font-weight:700;z-index:600;opacity:0;pointer-events:none;transition:opacity .3s;box-shadow:0 4px 14px rgba(0,0,0,.2);max-width:80vw;';
      document.body.appendChild(t);
    }
    t.textContent=msg;
    t.style.opacity='1';
    t.style.pointerEvents='none'; // never block clicks — toast is info only
    clearTimeout(t._timer);
    t._timer=setTimeout(()=>{t.style.opacity='0';},dur);
  },

  // ══ QUICK LINKS ══
  renderQuickLinks(){
    let links; try{ links=JSON.parse(localStorage.getItem('rk_quicklinks')||'[]'); }catch{ links=[]; }
    const container=document.getElementById('qlLinks');
    if(!container)return;
    container.innerHTML=links.map((l,i)=>`
      <span class="ql-link" title="${l.url}">
        <img src="https://www.google.com/s2/favicons?domain=${l.url}&sz=16" onerror="this.style.display='none'" style="width:14px;height:14px;">
        <a href="${l.url.startsWith('http')?l.url:'https://'+l.url}" target="_blank" style="text-decoration:none;color:inherit;">${l.name}</a>

      </span>`).join('');
  },
  addQuickLink(){
    const name=prompt('Website ka naam? (e.g. ICICI, Court, Google)');
    if(!name)return;
    const url=prompt('Website ka link? (e.g. icicibank.com)');
    if(!url)return;
    let links; try{ links=JSON.parse(localStorage.getItem('rk_quicklinks')||'[]'); }catch{ links=[]; }
    links.push({name:name.trim(),url:url.trim(),id:uid()});
    localStorage.setItem('rk_quicklinks',JSON.stringify(links));
    if(window.fbSave)window.fbSave('quicklinks',links).catch(()=>{});
    this.renderQuickLinks();
    this.showToastMsg('✅ Link add hua — sab devices pe sync ho jaayega!');
  },
  delQuickLink(i){
    let links; try{ links=JSON.parse(localStorage.getItem('rk_quicklinks')||'[]'); }catch{ links=[]; }
    links.splice(i,1);
    localStorage.setItem('rk_quicklinks',JSON.stringify(links));
    if(window.fbSave)window.fbSave('quicklinks',links).catch(()=>{});
    this.renderQuickLinks();
  },


});

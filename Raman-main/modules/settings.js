/* modules/settings.js — Settings, quick links, login, and delete tools
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
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
    const settingsRow = (mainHtml, actionHtml, extraClass='') => `
      <div class="settings-list-row ${extraClass}">
        <div class="settings-list-main">${mainHtml}</div>
        ${actionHtml}
      </div>`;

    // Render quick links manager
    let links; try{ links=JSON.parse(localStorage.getItem('rk_quicklinks')||'[]'); }catch{ links=[]; }
    const linksEl=document.getElementById('settingsLinks');
    if(links.length){
      linksEl.innerHTML=links.map((l,i)=>`
        ${settingsRow(
          `<img src="https://www.google.com/s2/favicons?domain=${l.url}&sz=16" onerror="this.style.display='none'" style="width:14px;height:14px;flex:0 0 auto;">
           <div class="settings-link-copy">
             <span class="settings-link-name">${l.name}</span>
             <span class="settings-link-url">${l.url}</span>
           </div>`,
          `<button class="btn b-red b-sm" onclick="APP.delQuickLink(${i});APP.openSettings()">🗑 Remove</button>`,
          'settings-link-row'
        )}`).join('');
    } else {
      linksEl.innerHTML='<div style="color:var(--mut);font-size:.82rem;padding:6px;">No quick links added yet.</div>';
    }

    // Render delete list — all records grouped by section
    const dlEl=document.getElementById('settingsDeleteList');
    let html='';

    // Properties
    if(this.props.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:4px 0 2px;">🏢 Properties</div>`;
      html+=this.props.map(p=>settingsRow(
        `<span class="settings-list-text">🏢 ${p.name} ${p.city?'— '+p.city:''}</span>`,
        `<button class="btn b-red b-sm" onclick="APP._settingsDelProp('${p.id}')">🗑 Delete</button>`
      )).join('');
    }

    // Tenants
    if(this.tenants.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">👥 Tenants</div>`;
      html+=this.tenants.map(t=>{const p=this.props.find(x=>x.id===t.propId);return settingsRow(
        `<span class="settings-list-text">👤 ${t.name} ${p?'— '+p.name:''}</span>`,
        `<button class="btn b-red b-sm" onclick="APP._settingsDelTenant('${t.id}')">🗑 Delete</button>`
      );}).join('');
    }

    // Payments
    if(this.payments.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">💰 Payments (${this.payments.length} records)</div>`;
      html+=[...this.payments].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10).map(p=>{const t=this.tenants.find(x=>x.id===p.tenantId);return settingsRow(
        `<span class="settings-list-text">💰 ${fD(p.date)} — ${t?t.name:'?'} — ${fmt(p.amount)}</span>`,
        `<button class="btn b-red b-sm" onclick="APP._settingsDelPayment('${p.id}')">🗑 Delete</button>`
      );}).join('');
    }

    // Reminders
    if(this.reminders.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">🔔 Reminders</div>`;
      html+=this.reminders.map(r=>settingsRow(
        `<span class="settings-list-text">🔔 ${r.name} — ${r.type} — ${fD(r.exp)}</span>`,
        `<button class="btn b-red b-sm" onclick="APP._settingsDelReminder('${r.id}')">🗑 Delete</button>`
      )).join('');
    }

    // Medical
    if(this.visits.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">🏥 Medical Visits</div>`;
      html+=this.visits.map(r=>{const p=this.patients.find(x=>x.id===r.patId);return settingsRow(
        `<span class="settings-list-text">🏥 ${fD(r.date)} — ${p?p.name:'?'} — Dr.${r.doctor||'—'}</span>`,
        `<button class="btn b-red b-sm" onclick="APP._settingsDelVisit('${r.id}')">🗑 Delete</button>`
      );}).join('');
    }

    // Trips
    if(this.trips.length){
      html+=`<div style="font-size:.72rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:6px 0 2px;">✈️ Trips</div>`;
      html+=this.trips.map(t=>settingsRow(
        `<span class="settings-list-text">✈️ ${t.dest} — ${fD(t.dep)}</span>`,
        `<button class="btn b-red b-sm" onclick="APP._settingsDelTrip('${t.id}')">🗑 Delete</button>`
      )).join('');
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
  // ── PDF ORIENTATION TOGGLE ──
  _setPdfOrientation(ori){
    this._pdfOrientation = ori;
    document.querySelectorAll('.pdf-ori-btn').forEach(btn=>{
      const isActive = btn.dataset.ori === ori;
      btn.classList.toggle('is-active', isActive);
    });
    this.showToastMsg(ori==='landscape' ? '🖨️ PDF: Landscape (wide)' : '🖨️ PDF: Portrait (vertical)');
  },

  // Renders the portrait/landscape toggle — call inline wherever a PDF button exists
  _pdfOriHtml(){
    const p = this._pdfOrientation||'portrait';
    return `<span class="pdf-ori-group" role="group" aria-label="PDF orientation">` +
      `<span class="pdf-ori-label">Orientation</span>` +
      `<span class="pdf-ori-toggle">` +
        `<button class="pdf-ori-btn ${p==='portrait'?'is-active':''}" data-ori="portrait" onclick="APP._setPdfOrientation('portrait')">Portrait</button>` +
        `<button class="pdf-ori-btn ${p==='landscape'?'is-active':''}" data-ori="landscape" onclick="APP._setPdfOrientation('landscape')">Landscape</button>` +
      `</span>` +
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
    const iconMeta=function(link){
      const name=(link.name||'').toLowerCase();
      const url=(link.url||'').toLowerCase();
      if(name.includes('icici')||url.includes('icici')) return {icon:'account_balance',cls:'is-bank'};
      if(name.includes('rera')||url.includes('rera')) return {icon:'real_estate_agent',cls:'is-rera'};
      if(name.includes('obpas')||url.includes('obpas')) return {icon:'domain',cls:'is-obpas'};
      if(name.includes('maint')||name.includes('shop')||url.includes('maintenance')) return {icon:'home_repair_service',cls:'is-maintenance'};
      if(name.includes('court')||url.includes('court')) return {icon:'gavel',cls:'is-legal'};
      if(name.includes('google')||url.includes('google')) return {icon:'language',cls:'is-default'};
      return {icon:'link',cls:'is-default'};
    };
    container.innerHTML=links.map((l,i)=>`
      <a class="ql-link ql-link-item" href="${l.url.startsWith('http')?l.url:'https://'+l.url}" target="_blank" title="${l.url}">
        <span class="material-symbols-outlined ql-link-icon ${iconMeta(l).cls}" aria-hidden="true">${iconMeta(l).icon}</span>
        <span>${l.name}</span>
      </a>`).join('');
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

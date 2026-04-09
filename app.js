// ═══════════════════════════════════════════════════════════════
// FUM — File Upload Manager (Firebase Storage, dynamic multi-file)
// ═══════════════════════════════════════════════════════════════
const FUM = {
  sessions: {},

  _icon(type, name) {
    const ext = (name||'').split('.').pop().toLowerCase();
    if (!type) {
      if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
      if (ext === 'pdf') return '📄';
      if (['doc','docx'].includes(ext)) return '📝';
      if (['xls','xlsx'].includes(ext)) return '📊';
      return '📎';
    }
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    return '📎';
  },

  _sz(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1024/1024).toFixed(1) + ' MB';
  },

  // Initialize an upload zone inside given container element
  // existingFiles: [{url, path, name, size, type}] — from saved data
  init(containerId, folder, existingFiles) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!this.sessions[containerId]) this.sessions[containerId] = [];
    // Load existing saved files
    if (existingFiles) {
      existingFiles.forEach(f => {
        if (f && f.url && !this.sessions[containerId].find(x => x.url === f.url)) {
          this.sessions[containerId].push({
            id: uid(), url: f.url, path: f.path||'',
            name: f.name||'Attached File', size: f.size||0,
            type: f.type||'', status: 'done'
          });
        }
      });
    }
    el.innerHTML = this._html(containerId, folder);
    this._renderList(containerId);
  },

  _html(containerId, folder) {
    return `<div class="fu-zone" id="fuz_${containerId}">
      <label for="fui_${containerId}" class="fu-upload-btn">
        📎 File Upload Karo
      </label>
      <input type="file" id="fui_${containerId}" multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx"
        style="opacity:0;position:absolute;width:1px;height:1px;overflow:hidden;"
        onchange="FUM.handleFiles('${containerId}','${folder||'general'}',this.files);this.value='';">
      <span class="fu-hint">PDF, JPG, PNG, Word, Excel • Max 10MB per file</span>
    </div>
    <div id="ful_${containerId}" class="fu-files-list"></div>`;
  },

  _renderList(containerId) {
    const el = document.getElementById('ful_' + containerId);
    if (!el) return;
    const files = this.sessions[containerId] || [];
    el.innerHTML = files.map(f => this._itemHtml(containerId, f)).join('');
  },

  _itemHtml(containerId, f) {
    const isImg = f.type && f.type.startsWith('image/');
    const thumb = (isImg && f.url)
      ? `<img src="${f.url}" class="fu-file-preview" onclick="window.open('${f.url}','_blank')" title="Preview">`
      : `<span class="fu-file-icon">${this._icon(f.type, f.name)}</span>`;
    const stat = f.status === 'uploading'
      ? `<span class="fu-status-up">⏳ ${f.pct||0}%</span>`
      : f.status === 'done'
        ? `<a href="${f.url}" target="_blank" class="fu-open-link">🔗 Open</a>`
        : `<span class="fu-status-err" title="${f.errorMsg||'Upload failed'}">❌ ${f.errorMsg?f.errorMsg.slice(0,40)+'…':'Failed'}</span>`;
    const prog = f.status === 'uploading'
      ? `<div class="fu-progress"><div class="fu-progress-bar" id="fpb_${f.id}" style="width:${f.pct||0}%"></div></div>` : '';
    const nm = f.name.length > 32 ? f.name.slice(0,29)+'…' : f.name;
    return `<div class="fu-file-item ${f.status}" id="ffi_${f.id}">
      ${thumb}
      <div style="flex:1;min-width:0;">
        <div class="fu-file-name" title="${f.name}">${nm}</div>
        ${f.size ? `<div class="fu-file-size">${this._sz(f.size)}</div>` : ''}
        ${prog}
      </div>
      ${stat}
      <button class="fu-file-del" onclick="FUM.removeFile('${containerId}','${f.id}')" title="Hatao">🗑</button>
    </div>`;
  },

  async handleFiles(containerId, folder, fileList) {
    if (!this.sessions[containerId]) this.sessions[containerId] = [];
    const ses = this.sessions[containerId];

    // Create all entries immediately — user sees ALL files in list at once
    const validEntries = [];
    for (const file of fileList) {
      if (file.size > 10*1024*1024) {
        APP.showToastMsg('❌ "' + file.name + '" — Max 10MB allowed!');
        continue;
      }
      const entry = {
        id: uid(), file, name: file.name, size: file.size,
        type: file.type, status: 'uploading', pct: 0, url: '', path: ''
      };
      ses.push(entry);
      validEntries.push(entry);
    }
    this._renderList(containerId); // Show all files at once

    // Upload ALL files in PARALLEL — no waiting for previous
    await Promise.all(validEntries.map(async (entry) => {
      try {
        if (window.fbUploadFile) {
          const res = await window.fbUploadFile(entry.file, folder, pct => {
            entry.pct = pct;
            entry.status = 'uploading';
            const bar = document.getElementById('fpb_' + entry.id);
            if (bar) bar.style.width = pct + '%';
            const st = document.querySelector('#ffi_' + entry.id + ' .fu-status-up');
            if (st) st.textContent = '⏳ ' + pct + '%';
          });
          entry.url = res.url;
          entry.path = res.path;
          entry.status = 'done';
          APP.showToastMsg('✅ "' + entry.name + '" upload ho gaya!');
        } else {
          entry.url = URL.createObjectURL(entry.file);
          entry.path = '';
          entry.status = 'done';
          APP.showToastMsg('⚠️ Firebase ready nahi — local preview mein hai');
        }
      } catch(e) {
        console.warn('[FUM] Upload fail, local fallback:', e.message);
        entry.url = URL.createObjectURL(entry.file);
        entry.path = '';
        entry.status = 'done';
        entry._localOnly = true;
        APP.showToastMsg('⚠️ "' + entry.name + '" — Local preview (Firebase: ' + e.message.slice(0,40) + ')');
        console.error('[FUM] Upload error:', e);
      }
      this._renderList(containerId);
    }));

    // Reset input so same file can be re-selected
    const inp = document.getElementById('fui_' + containerId);
    if (inp) inp.value = '';
  },

  removeFile(containerId, fileId) {
    const ses = this.sessions[containerId] || [];
    const f = ses.find(x => x.id === fileId);
    if (f && f.path && window.fbDeleteFile) window.fbDeleteFile(f.path);
    this.sessions[containerId] = ses.filter(x => x.id !== fileId);
    this._renderList(containerId);
  },

  // Return array of {url,path,name,size,type} for saving to data store
  getFiles(containerId) {
    return (this.sessions[containerId] || [])
      .filter(f => f.status === 'done' && f.url)
      .map(({ url, path, name, size, type }) => ({ url, path, name, size, type }));
  },

  // Clear session (call when modal closes)
  clear(containerId) {
    this.sessions[containerId] = [];
    this._renderList(containerId);
  },

  // Load existing Drive links as legacy entries (backward compat)
  loadLegacyLinks(containerId, links) {
    if (!links || !links.length) return;
    if (!this.sessions[containerId]) this.sessions[containerId] = [];
    links.forEach(url => {
      if (url && !this.sessions[containerId].find(x => x.url === url)) {
        this.sessions[containerId].push({
          id: uid(), url, path: '', name: 'Existing Link', size: 0, type: '', status: 'done'
        });
      }
    });
    this._renderList(containerId);
  }
};
window.FUM = FUM;

// Safe init: wait for DOM ready and Firebase scripts
(function(){
  // ── Auto-cleanup: Remove old per-month rent reminders ──
  try {
    var _r0 = JSON.parse(localStorage.getItem('rk_reminders')||'[]');
    var _r0c = _r0.filter(function(r){
      if(!r._autoKey) return true;
      if(r._autoKey.match(/^auto_rent_[^_]+_\d{4}_\d{1,2}$/)) return false;
      if(r._isAutoRent && !r._autoKey.startsWith('auto_rent_v2_')) return false;
      return true;
    });
    if(_r0c.length!==_r0.length){
      localStorage.setItem('rk_reminders',JSON.stringify(_r0c));
    }
  } catch(e){}
  function _safeInit(){
    if(typeof APP === 'undefined') { setTimeout(_safeInit, 50); return; }
    if(typeof APP.init === 'function') APP.init();
    if(typeof APP.checkLogin === 'function') APP.checkLogin();
    // Sync loan reminders on startup
    // _syncLoanReminders disabled — loans moved to Khata Book
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _safeInit);
  } else {
    _safeInit();
  }
})();

// Ctrl+F or Ctrl+K = open search bar
document.addEventListener('keydown', function(e){
  if((e.ctrlKey||e.metaKey) && (e.key==='f'||e.key==='k')){
    e.preventDefault();
    APP.openSearchBar();
  }
});

// ── Show date ──
(function(){ const el=document.getElementById('hdrDate'); if(el){ el.style.display=''; el.textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}); }})();

// ── PWA Install Prompt (Android Chrome "Add to Home Screen") ──
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'inline-flex';
});
document.getElementById('installBtn') && document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) {
    APP.showToastMsg('💡 Chrome mein: Menu (⋮) → "Add to Home screen" click karo');
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') APP.showToastMsg('✅ App install ho gaya! Home screen check karo.');
  deferredPrompt = null;
  document.getElementById('installBtn').style.display = 'none';
});
window.addEventListener('appinstalled', () => {
  APP.showToastMsg('🎉 Dashboard installed! Home screen par shortcut ban gaya.');
  const btn = document.getElementById('installBtn'); if(btn) btn.style.display='none';
});

// Enter key on login
document.getElementById('loginPwd').addEventListener('keydown',function(e){if(e.keyCode===13)APP.doLogin();});
setTimeout(function(){if(typeof APP!=='undefined'&&APP.renderQuickLinks)APP.renderQuickLinks();},300);

// ── PRE-LOAD BACKUP DATA — only if localStorage is empty ──
(function preloadBackup(){
  if(localStorage.getItem('rk_props')) return; // already has data
  const backup = {"props":[{"name":"1012 Desire Residency","city":"Ghaziabad","type":"Residential","cost":"4000000","date":"2012-03-20","area":"1595","mkt":"","loan":"","notes":"Raman kumar","id":"mmvxcktp83lc"},{"name":"svdasdvdfv","city":"gsdfgsdfg","type":"Residential","cost":"","date":"","area":"","mkt":"","loan":"","notes":"","id":"mmvxcu3k7jd1"},{"name":"G 1103","city":"g 1103","type":"Residential","cost":"","date":"","area":"","mkt":"","loan":"","notes":"","id":"mmvxfjv5w6e8"}],"tenants":[{"name":"Anuj Choudhary","contact":"","propId":"mmvxcktp83lc","rent":19065,"sec":50000,"adv":0,"start":"2026-03-01","end":"2026-10-29","due":7,"mode":"NEFT","status":"active","doc":"","notes":"","id":"mmvxdzih2onw","ph":"","email":"","idtype":"","idno":"","maint":0,"late":0,"photo":"","emg":"","ph2":"","email2":"","addr":"","recurring":"yes","invdate":"2026-03-07"},{"name":"sdcvSCscSDCSDC","ph":"","email":"","idtype":"","idno":"","propId":"mmvxfjv5w6e8","rent":20000,"sec":50000,"adv":0,"maint":0,"start":"2025-12-01","end":"","due":5,"late":0,"mode":"NEFT","status":"active","doc":"","photo":"","emg":"","notes":"","id":"mmwca4vn3za"}],"payments":[{"id":"mmztdq8qb3r","tenantId":"mmvxdzih2onw","amount":19065,"date":"2026-03-05","mode":"NEFT","ref":"","note":"","incRent":true,"incMaint":false}],"reminders":[{"name":"rrrrrr","type":"Driving Licence","person":"Raman","issue":"","exp":"2025-12-18","before":"30","doc":"","notes":"","id":"mmvxglboe6mk"},{"name":"ffqwfqef","type":"Tax Filing","person":"Raman","issue":"","exp":"2026-03-20","before":"365","doc":"","notes":"","id":"mmvxgux2t853"},{"name":"wfqwf","type":"Passport","person":"Raman","issue":"","exp":"2026-12-17","before":"30","doc":"","notes":"","id":"mmvxhbbiyv6a"},{"name":"3rfr34","type":"Tax Filing","person":"Raman","issue":"","exp":"2026-03-28","before":"30","doc":"","notes":"","id":"mmwdxwsj33n"},{"name":"v rg rg rg","type":"Loan/EMI","person":"Raman","issue":"","exp":"2026-04-01","before":"30","doc":"","notes":"","id":"mmwdyfkzr1d"},{"name":"uhubibhbhbhbh","type":"Loan/EMI","person":"Raman","issue":"","exp":"2026-04-29","before":"180","doc":"https://drive.google.com/file/d/11aNlw_dQayfu3xve7xg92UfmDKdfm-vn/view?usp=drive_link","notes":"","id":"mmwefzmy17o"},{"name":"Advik Agarwal s/o Bhavik Garg","type":"Passport","person":"Raman","issue":"","exp":"2026-03-28","before":"30","doc":"","notes":"","autorenew":"no","period":"365","id":"mmy9ft6611t"},{"name":"avishka agarwal","type":"Passport","person":"Raman","issue":"","exp":"2026-03-27","before":"30","doc":"","notes":"","autorenew":"no","period":"365","id":"mmya2nfyw7g"}],"patients":[{"id":"mmwcsopwa1e","name":"Raman Kumar","relation":"Self","dob":"1968-09-29","blood":"","cond":"","emg":"","ins":""},{"id":"mmwcsu30ats","name":"Madhu Agarwal","relation":"Wife","dob":"1971-07-05","blood":"","cond":"","emg":"","ins":""},{"id":"mmwct1pwoff","name":"BHAVIK","relation":"","dob":"","blood":"","cond":"","emg":"","ins":""}],"visits":[{"patId":"mmwcsopwa1e","type":"General Checkup","doctor":"","spec":"","hospital":"","city":"","date":"2026-03-18","next":"2026-03-31","next2":"","next3":"","purpose":"","diagnosis":"","meds":"","vitals":"","labname":"","labdate":"","labres":"","link":"","lablink":"","notes":"","id":"mmwe5e1uwpq","lablink2":"","lablink3":""},{"patId":"mmwcsopwa1e","type":"General Checkup","doctor":"laab","spec":"","hospital":"","city":"","date":"2026-03-18","next":"","next2":"","next3":"","purpose":"","diagnosis":"","meds":"","vitals":"","labname":"","labdate":"","labres":"","link":"","lablink":"","notes":"","id":"mmwe5v63lnq"},{"patId":"mmwcsopwa1e","type":"General Checkup","doctor":"lab","spec":"","hospital":"","city":"","date":"2026-03-18","next":"","next2":"","next3":"","purpose":"","diagnosis":"","meds":"","vitals":"","labname":"","labdate":"","labres":"cdd","link":"","lablink":"","notes":"","id":"mmwe6deq9b5"},{"patId":"mmwcsu30ats","type":"General Checkup","doctor":"","spec":"","hospital":"","city":"","date":"2026-03-18","next":"2026-03-31","next2":"","next3":"","purpose":"","diagnosis":"","meds":"","vitals":"","labname":"cbc","labdate":"2026-03-19","labres":"sdsdsdf","link":"","lablink":"https://drive.google.com/file/d/1D87MIanCINNN1zGjWmgkfXeQ156IgXRK/view?usp=drive_link","notes":"","id":"mmx7g40a5oj","lablink2":"","lablink3":""},{"patId":"mmwct1pwoff","type":"General Checkup","doctor":"","spec":"","hospital":"","city":"","date":"2026-03-24","next":"2026-03-28","purpose":"","meds":"","vitals":"","labname":"","labdate":"","labres":"","notes":"","presFiles":[],"labFiles":[],"link":"","lablink":"","lablink2":"","lablink3":"","id":"mn1qbm7qwjf"},{"patId":"mmwcsu30ats","type":"Specialist Consultation","doctor":"Pankaj Kumar","spec":"Orthopedic","hospital":"","city":"Noida","date":"2026-03-22","next":"2026-04-02","purpose":"Foot pain","meds":"signoflam, Pan 40 Limcee","vitals":"","labname":"","labdate":"","labres":"","notes":"","presFiles":[],"labFiles":[],"link":"","lablink":"","lablink2":"","lablink3":"","id":"mn1r2mzxgnb"}],"trips":[{"dest":"goa","city":"","type":"Family","dom":"Domestic","dep":"2026-03-28","ret":"2026-04-04","trans":"Train","ticket":"","hotel":"","hcity":"","budget":0,"spent":0,"members":"","photo":"","notes":"","id":"mmwem26izlj"},{"dest":"amrit","city":"","type":"Family","dom":"International","dep":"2026-03-26","ret":"2026-03-28","trans":"Flight","ticket":"","hotel":"","hcity":"","budget":0,"spent":0,"members":"","photo":"","notes":"","id":"mmwemwreib8"},{"dest":"JAIPUR","city":"","type":"Family","dom":"Domestic","dep":"2026-03-26","ret":"","trans":"Flight","ticket":"","hotel":"","hcity":"","budget":0,"spent":0,"members":"","photo":"","notes":"","id":"mmydv009s0h"}],"buckets":[],"persons":["Raman","Madhu Agarwal"]};
  ['props','tenants','payments','reminders','patients','visits','trips','buckets','persons'].forEach(k=>{
    if(backup[k]) localStorage.setItem('rk_'+k, JSON.stringify(backup[k]));
  });
  console.log('✅ Backup data loaded');
  if(typeof APP !== 'undefined' && typeof APP.init === 'function') APP.init();
})();
// ── Close PDF dropdown on outside click ──
document.addEventListener('click', function(e){
  var menu = document.getElementById('_pdfDropMenu');
  var wrap = document.getElementById('_pdfDropWrap');
  if(menu && wrap && !wrap.contains(e.target)){
    menu.style.display = 'none';
  }
});

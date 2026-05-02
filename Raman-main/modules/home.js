/* modules/home.js — APP Core Object + Dashboard Home
 * Defines the main APP object with all shared state, data getters,
 * core navigation (goTab, renderTab), pills, and the Home tab renderer.
 * All other modules extend APP via Object.assign() after this loads.
 */

'use strict';

const APP = {
  curTab:'home',curProp:null,curPatient:'all',medFilter30:false,
  rentSub:'overview',travelSub:'upcoming',
  editId:null,payTId:null,payEditId:null,delCb:null,
  calY:new Date().getFullYear(),calM:new Date().getMonth(),
  viewLedgerTid:null,
  _tabIds:['home','property','rent','expense','khata','reminder','medical','travel','calendar','todo','notepad','search'],
  _routeBound:false,
  _routeApplying:false,
  _busyActions:{},
  _ledgerCache:{}, // Bug5 fix: cache getTenantLedger results per render cycle
  _pdfOrientation:'portrait', // Global PDF orientation: 'portrait' | 'landscape'

  get props(){return S.get('props');},
  get tenants(){return S.get('tenants');},
  get payments(){return S.get('payments');},
  get reminders(){return S.get('reminders');},
  get patients(){return S.get('patients');},
  get visits(){return S.get('visits');}, // doctor visits
  get trips(){return S.get('trips');},
  get buckets(){return S.get('buckets');},
  get expenses(){return S.get('expenses');}, // existing transactions
  get finAccounts(){try{return JSON.parse(localStorage.getItem('rk_fin_accounts')||'[]');}catch{return[];}},
  set finAccounts(d){localStorage.setItem('rk_fin_accounts',JSON.stringify(d));if(window.fbSave)window.fbSave('fin_accounts',d).catch(()=>{});},
  get finBudgets(){try{return JSON.parse(localStorage.getItem('rk_fin_budgets')||'[]');}catch{return[];}},
  set finBudgets(d){localStorage.setItem('rk_fin_budgets',JSON.stringify(d));if(window.fbSave)window.fbSave('fin_budgets',d).catch(()=>{});},
  get kbParties(){
    const next=S.get('kbParties');
    if(Array.isArray(next) && next.length) return next;
    const legacy=S.get('kb_parties');
    return Array.isArray(legacy)?legacy:[];
  },
  set kbParties(d){S.set('kbParties',d);},
  get kbEntries(){
    const next=S.get('kbEntries');
    if(Array.isArray(next) && next.length) return next;
    const legacy=S.get('kb_entries');
    return Array.isArray(legacy)?legacy:[];
  },
  set kbEntries(d){S.set('kbEntries',d);},
  get kbCash(){
    const next=S.get('kbCash');
    if(Array.isArray(next) && next.length) return next;
    const legacy=S.get('kb_cash');
    return Array.isArray(legacy)?legacy:[];
  },
  set kbCash(d){S.set('kbCash',d);},

  _syncShellState(tab){
    try{
      const nextTab=tab || this.curTab || 'home';
      const isHome=nextTab==='home';
      document.body.setAttribute('data-tab', nextTab);
      document.querySelectorAll('.dashboard-shell').forEach(function(el){
        if(!el.dataset.shellDisplay) el.dataset.shellDisplay=el.style.display||'';
        el.style.display=isHome ? el.dataset.shellDisplay : 'none';
      });
    }catch(e){}
  },

  init(){
    this._migrateReminderBeforeData();
    this._migrateKhataStorage();
    this._purgeDiaryModuleData();
    this._bindRouteState();
    const route=this._getRouteInfo();
    const startTab=this._isValidTab(route.tab)?route.tab:(this.curTab||'home');
    this._applyRouteContext(startTab, route.params);
    this.curTab=startTab;
    this._syncShellState(startTab);
    this._syncRouteState(startTab, true);
    document.getElementById('hdrDate').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
    try{ this.renderPills(); }catch(e){ console.error('[APP] renderPills failed during init:', e); }
    try{ this.goTab(startTab, { skipHistory:true }); }
    catch(e){
      console.error('[APP] Initial tab render failed:', e);
      if(startTab === 'home') this.ensureHomeRendered(8);
    }
    this.injectDateWidgets();
    this._bindCoreModalActions();
    this._wirePaymentModal();
    try{ if(typeof normalizeRequiredLabels === 'function') normalizeRequiredLabels(document); }catch(e){}
    this.ensureHomeRendered(8);
  },

  _runGuardedAction(key, fn, holdMs){
    if(this._busyActions[key]) return false;
    this._busyActions[key] = true;
    let released = false;
    const release = ()=>{
      if(released) return;
      released = true;
      delete this._busyActions[key];
    };
    const timer = setTimeout(release, holdMs || 1200);
    const releaseNow = ()=>{
      clearTimeout(timer);
      release();
    };
    try{
      return fn(releaseNow);
    }catch(e){
      releaseNow();
      throw e;
    }
  },

  _bindCoreModalActions(){
    if(this._coreModalActionsBound) return;
    this._coreModalActionsBound = true;
    const handleAction = (e)=>{
      const btn = e.target && e.target.closest ? e.target.closest('[data-app-action]') : null;
      if(!btn) return;
      const action = btn.dataset.appAction;
      if(!action || typeof this[action] !== 'function') return;
      const now = Date.now();
      if(btn._lastActionTs && (now - btn._lastActionTs) < 420){
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      btn._lastActionTs = now;
      e.preventDefault();
      e.stopPropagation();
      this[action]();
    };
    document.addEventListener('pointerup', handleAction, true);
    document.addEventListener('click', handleAction, true);
  },

  _isValidTab(tab){
    return this._tabIds.indexOf(tab)>=0;
  },

  _getRouteInfo(){
    try{
      const raw=(window.location.hash||'').replace(/^#/,'').trim();
      if(!raw) return { tab:null, params:new URLSearchParams() };
      const qIdx=raw.indexOf('?');
      const path=qIdx>=0 ? raw.slice(0,qIdx) : raw;
      const query=qIdx>=0 ? raw.slice(qIdx+1) : '';
      const tab=path.split('/')[0];
      return {
        tab:this._isValidTab(tab)?tab:null,
        params:new URLSearchParams(query)
      };
    }catch(e){
      return { tab:null, params:new URLSearchParams() };
    }
  },

  _buildRouteHash(tab){
    const params=new URLSearchParams();
    if(tab==='expense' && this.finSub && this.finSub!=='overview') params.set('sub', this.finSub);
    if(tab==='rent' && this.rentSub && this.rentSub!=='overview') params.set('sub', this.rentSub);
    if(tab==='property' && this.curProp && this.curProp!=='__all__') params.set('prop', this.curProp);
    if(tab==='travel' && this.travelSub && this.travelSub!=='upcoming') params.set('sub', this.travelSub);
    if(tab==='medical' && this.medFilter30) params.set('filter', '30');
    const query=params.toString();
    return '#'+tab+(query?('?'+query):'');
  },

  _syncRouteState(tab, replace){
    if(this._routeApplying) return;
    try{
      const target=this._buildRouteHash(tab);
      if(window.location.hash===target) return;
      const fn=replace?'replaceState':'pushState';
      if(window.history && typeof window.history[fn]==='function'){
        window.history[fn]({tab:tab},'',target);
      }else{
        window.location.hash=target;
      }
    }catch(e){}
  },

  syncCurrentRoute(replace){
    this._syncRouteState(this.curTab||'home', !!replace);
  },

  _applyRouteContext(tab, params){
    if(tab==='expense'){
      const sub=params.get('sub');
      const allowed=['overview','accounts','txn','networth','budget','charts','reports'];
      this.finSub=allowed.includes(sub)?sub:'overview';
    }
    if(tab==='rent'){
      const sub=params.get('sub');
      const allowed=['overview','tenants','ledger','history','templates'];
      this.rentSub=allowed.includes(sub)?sub:'overview';
    }
    if(tab==='property'){
      const prop=params.get('prop');
      this.curProp=prop||'__all__';
    }
    if(tab==='travel'){
      const sub=params.get('sub');
      const allowed=['upcoming','past','bucket'];
      this.travelSub=allowed.includes(sub)?sub:'upcoming';
    }
    if(tab==='medical'){
      this.medFilter30=params.get('filter')==='30';
    }
  },

  _applyRouteState(){
    const route=this._getRouteInfo();
    const tab=route.tab;
    if(!this._isValidTab(tab)) return;
    this._routeApplying=true;
    try{
      this._applyRouteContext(tab, route.params);
      this.goTab(tab, { skipHistory:true });
    }finally{
      this._routeApplying=false;
    }
  },

  _bindRouteState(){
    if(this._routeBound) return;
    this._routeBound=true;
    window.addEventListener('hashchange', ()=>this._applyRouteState());
    window.addEventListener('popstate', ()=>this._applyRouteState());
  },

  _migrateReminderBeforeData(){
    const reminders=S.get('reminders');
    if(!Array.isArray(reminders)||!reminders.length) return;
    let changed=false;
    const migrated=reminders.map(r=>{
      if(!r||typeof r!=='object') return r;
      const next={...r};
      const isRecurring=r.mode==='recurring';
      const dueIso=r.dueDate||r.trigDate||r.exp||r.reminderDate||r.alertDate||'';
      const triggerIso=isRecurring
        ? (r.nextTrigger||r.start||r.reminderDate||r.alertDate||r.trigDate||'')
        : (r.reminderDate||r.alertDate||r.trigDate||dueIso||'');

      ['before','beforeDays','beforeLabel','recurBeforeVal','recurBeforeUnit'].forEach(function(key){
        if(Object.prototype.hasOwnProperty.call(next,key)){
          delete next[key];
          changed=true;
        }
      });

      if(!isRecurring){
        if(dueIso && next.dueDate!==dueIso){ next.dueDate=dueIso; changed=true; }
        if(dueIso && next.trigDate!==dueIso){ next.trigDate=dueIso; changed=true; }
        if(dueIso && next.reminderDate!==dueIso){ next.reminderDate=dueIso; changed=true; }
        if(dueIso && next.alertDate!==dueIso){ next.alertDate=dueIso; changed=true; }
        if(dueIso && next.start!==dueIso){ next.start=dueIso; changed=true; }
      } else {
        if(triggerIso && next.reminderDate!==triggerIso){ next.reminderDate=triggerIso; changed=true; }
        if(triggerIso && next.alertDate!==triggerIso){ next.alertDate=triggerIso; changed=true; }
      }

      return next;
    });
    if(changed) S.set('reminders',migrated);
  },

  _purgeDiaryModuleData(){
    try{
      localStorage.removeItem('rk_diary');
      delete this.diaryEditId;
      delete this.diaryQuery;
      delete this._diaryExpanded;
      delete this._diaryMoodFilter;
      if(window.fbSave) window.fbSave('diary',[]).catch(()=>{});
    }catch(e){}
  },

  _migrateKhataStorage(){
    try{
      const pairs=[
        ['kb_parties','kbParties'],
        ['kb_entries','kbEntries'],
        ['kb_cash','kbCash']
      ];
      pairs.forEach(function(pair){
        const legacyKey='rk_'+pair[0];
        const nextKey='rk_'+pair[1];
        const legacyRaw=localStorage.getItem(legacyKey);
        const nextRaw=localStorage.getItem(nextKey);
        if(nextRaw) return;
        if(!legacyRaw) return;
        localStorage.setItem(nextKey, legacyRaw);
      });
    }catch(e){}
  },

  ensureHomeRendered(tries){
    tries = typeof tries === 'number' ? tries : 4;
    setTimeout(()=>{
      const home=document.getElementById('pan-home');
      if(this.curTab==='home' && home && !home.innerHTML.trim()){
        console.warn('[APP] Home was empty after startup; repainting dashboard.');
        try{ this.renderPills(); }catch(e){ console.error('[APP] renderPills retry failed:', e); }
        try{ this.renderHome(); }catch(e){ console.error('[APP] Home repaint failed:', e); }
        if(tries>1) this.ensureHomeRendered(tries-1);
      }
    }, tries>6 ? 50 : 250);
  },

  // Wire Save Payment button via addEventListener (backup to inline onclick)
  // Prevents silent failure if onclick="APP.savePayment()" misfires
  _wirePaymentModal(){
    try {
      const btn = document.getElementById('pym_save_btn');
      if(btn && !btn._wired && !btn.dataset.appAction){
        btn._wired = true;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('[pym_save_btn] click via addEventListener');
          if(typeof APP !== 'undefined' && typeof APP.savePayment === 'function'){
            APP.savePayment();
          } else {
            console.error('[pym_save_btn] APP.savePayment not found!');
            alert('Error: APP not ready. Please refresh the page.');
          }
        });
        console.log('[_wirePaymentModal] pym_save_btn wired successfully');
      }
    } catch(e){ console.error('[_wirePaymentModal] error:', e); }
  },

  injectDateWidgets(){
    // Map of wrap-div-id → initial ISO value
    const today=(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    const pairs=[
      ['prm_date_wrap','prm_date',''],
      ['tnm_start_wrap','tnm_start',''],
      ['tnm_end_wrap','tnm_end',''],
      ['tnm_invdate_wrap','tnm_invdate',''],
      ['pym_date_wrap','pym_date',today],
      ['rmm_issue_wrap','rmm_issue',''],
      ['rmm_exp_wrap','rmm_exp',''],
      ['ptm_dob_wrap','ptm_dob',''],
      ['mdm_date_wrap','mdm_date',today],
      ['mdm_next_wrap','mdm_next',''],
      ['mdm_labdate_wrap','mdm_labdate',''],
      ['mdm_labdate_wrap','mdm_labdate',''],
      ['tvm_dep_wrap','tvm_dep',''],
      ['tvm_ret_wrap','tvm_ret',''],
    ];
    pairs.forEach(([wrapId,logicId,initVal])=>{
      const wrap=document.getElementById(wrapId);
      if(wrap) wrap.innerHTML=makeDateInput(logicId,initVal);
    });
  },

  // TAB NAVIGATION
  goTab(t, opts){
    const nextTab=this._isValidTab(t)?t:'home';
    const options=opts||{};
    this.curTab=nextTab;
    this._syncShellState(nextTab);
    if(!options.skipHistory) this._syncRouteState(nextTab, !!options.replaceHistory);
    try{ window.scrollTo({top:0,behavior:'auto'}); }catch(e){}
    document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('on',el.dataset.t===nextTab));
    this._tabIds.forEach(id=>{
      const el=document.getElementById('pan-'+id);
      if(el) el.style.display=id===nextTab?'':'none';
    });
    this.renderTab(nextTab);
  },
  renderTab(t){
    this._ledgerCache={}; // Bug5 fix: clear cache at start of each render cycle
    this._inRenderTab=true;
    try{ this.renderPills(); }catch(e){ console.error('[APP] renderPills failed:', e); }
    this._inRenderTab=false;
    const renderers={
      home:'renderHome',property:'renderProperty',rent:'renderRent',expense:'renderExpense',
      reminder:'renderReminders',medical:'renderMedical',travel:'renderTravel',calendar:'renderCalendar',
      todo:'renderTodo',notepad:'renderNotepadTab',khata:'renderKhata',search:'renderSearchTab'
    };
    const fn=renderers[t];
    if(fn && typeof this[fn]==='function'){
      try{ this[fn](); }catch(e){ console.error('[APP] '+fn+' failed:', e); }
    }
    try{ if(typeof normalizeRequiredLabels === 'function') normalizeRequiredLabels(document.getElementById('pan-'+t)||document); }catch(e){}
  },

  setCurProp(propId, replaceHistory){
    this.curProp=propId||'__all__';
    if(this.curTab==='property'){
      this.syncCurrentRoute(!!replaceHistory);
      this.renderProperty();
    }
  },

  // PILLS

  // ══════════════════════════════════════════════════════════════════
  // SHARED DATA ENGINE — Single source of truth for all modules
  // All dashboard/pills/reminders/home use THESE functions only
  // ══════════════════════════════════════════════════════════════════

  // ── 1. Outstanding: Rent (all tenants) + Loans ──
  _calcOutstanding(){
    let rentTotal=0;
    this.tenants.filter(t=>t.status==='active').forEach(t=>{
      rentTotal+=this.getTenantLedger(t).totalBalance;
    });
    // Loans moved to Khata Book — outstanding = rent only
    return {
      rentTotal,
      loanOutstanding: 0,
      total: rentTotal
    };
  },

  // ── 2. Reminder trigger date (unified — same as renderReminders) ──
  _getTrigDate(r){
    if(!r) return null;
    if(r.mode==='recurring') return r.nextTrigger||r.start||r.reminderDate||r.alertDate||r.trigDate||null;
    if(r.mode==='rent'||r.mode==='loan') return r._trigDate||r.trigDate||null;
    return r.reminderDate||r.alertDate||r.trigDate||r.dueDate||r.exp||null;
  },

  // ── 3. Days from today to a date (negative = past) ──
  _dFromNow(iso){
    // Use global daysFrom which uses safe parseIso (no UTC shift)
    return daysFrom(iso);
  },

  // ── Format time as 12-hour AM/PM ──
  _fmt12hr(hh,mm){
    try{
      const h=parseInt(hh)||0; const m=String(mm||'00').padStart(2,'0');
      const ampm=h>=12?'PM':'AM';
      const h12=h%12||12;
      return h12+':'+m+' '+ampm;
    }catch(e){ return hh+':'+mm; }
  },

  // ── Sort value including time (for reminders on same day) ──
  _trigSortVal(r){
    const trig=this._getTrigDate(r);
    if(!trig) return 99999;
    const base=this._dFromNow(trig);
    if(base===null) return 99999;
    // Add fractional part from time (HH:MM → 0.0 to 0.999)
    const hh=parseInt(r.alertHour||'10')||10;
    const mm=parseInt(r.alertMin||'00')||0;
    const timeFrac=(hh*60+mm)/(24*60); // 0.0 to 1.0
    return base + timeFrac;
  },

  // ── 4. Reminder state: categorized counts + arrays ──
  // Returns: {overdue, today, thisWeek, thisMonth, upcoming, safe, total, urgentCount}
  _calcRemindersState(){
    const now=new Date();now.setHours(0,0,0,0);
    const cats={overdue:[],today:[],thisWeek:[],thisMonth:[],upcoming:[],safe:[]};
    const _doneIds=this._getDoneIds(); // exclude done items from counts

    this.reminders.filter(r=>!r._isAutoLoan && !r._isAutoRent && r.mode!=='rent' && !_doneIds.has(r.id) && !r.completed).forEach(r=>{
      const trig=this._getTrigDate(r);
      // For rent/loan: always recalculate live
      let dTrig;
      if((r.mode==='rent'||r.mode==='loan')&&r._trigDate){
        dTrig=this._dFromNow(r._trigDate);
      } else {
        dTrig=this._dFromNow(trig);
      }
      const _dueDate=r.dueDate||r.exp||trig; const entry={...r,_trig:trig,_dTrig:dTrig,_dDue:this._dFromNow(_dueDate)};
      if(dTrig===null)             cats.upcoming.push(entry);
      else if(dTrig<0)             cats.overdue.push(entry);
      else if(dTrig===0)           cats.today.push(entry);
      else if(dTrig<=7)            cats.thisWeek.push(entry);
      else if(dTrig<=30)           cats.thisMonth.push(entry);
      else if(dTrig<=365)          cats.upcoming.push(entry);
      else                         cats.safe.push(entry);
    });

    // Also add medical follow-ups (skip done ones)
    this.visits.filter(v=>!_doneIds.has('med_'+v.id) && !v.completed).forEach(v=>{
      const ni=(v.next&&v.next.includes('-'))?v.next:(v.next?dmyToIso(v.next)||null:null);
      if(!ni) return;
      const dTrig=this._dFromNow(ni);
      const pat=this.patients.find(p=>p.id===v.patId);
      const entry={
        id:'med_'+v.id,_src:'medical',mode:'expiry',
        name:(pat?pat.name+' — ':'')+( v.doctor?'Dr. '+v.doctor+' Follow-up':'Medical Follow-up'),
        type:'🏥 Medical',_trig:ni,_dTrig:dTrig,person:pat?pat.name:'',notes:v.purpose||v.meds||'',
        exp:ni
      };
      if(dTrig===null)           cats.upcoming.push(entry);
      else if(dTrig<0)           cats.overdue.push(entry);
      else if(dTrig===0)         cats.today.push(entry);
      else if(dTrig<=7)          cats.thisWeek.push(entry);
      else if(dTrig<=30)         cats.thisMonth.push(entry);
      else if(dTrig<=365)        cats.upcoming.push(entry);
      else                       cats.safe.push(entry);
    });

    const sortByTrig=(a,b)=>APP._trigSortVal(a)-APP._trigSortVal(b);
    Object.values(cats).forEach(g=>g.sort(sortByTrig));

    // Add rent overdue count (from ledger, skip done ones)
    const rentOverdueCount=this.tenants.filter(t=>{
      if(t.status!=='active') return false;
      if(_doneIds.has('rent_'+t.id)) return false;
      const ledger=this.getTenantLedger(t);
      return ledger.totalBalance>0&&ledger.months.some(mo=>mo.status==='overdue');
    }).length;

    const urgentCount=cats.overdue.length+cats.today.length+rentOverdueCount;
    // Total = all visible (including rent overdue)
    const total=cats.overdue.length+cats.today.length+cats.thisWeek.length+cats.thisMonth.length+cats.upcoming.length+cats.safe.length+rentOverdueCount;

    return{...cats,rentOverdueCount,urgentCount,total,
      expiredCount:cats.overdue.length,
      dueCount:cats.today.length+cats.thisWeek.length};
  },

  // ── 5. Finance summary (DEPRECATED - replaced by Khata Book) ──
  // _calcFinance(){
  //   const now=new Date();
  //   const curMoStr=now.toISOString().slice(0,7);
  //   const allExps=this.expenses;
  //   const thisMonthExp=allExps.filter(e=>e.type==='expense'&&e.date&&e.date.startsWith(curMoStr)).reduce((s,e)=>s+Number(e.amount),0);
  //   const thisMonthInc=allExps.filter(e=>e.type==='income'&&e.date&&e.date.startsWith(curMoStr)).reduce((s,e)=>s+Number(e.amount),0);
  //   return{thisMonthExp,thisMonthInc,loanOutstanding:0,loanGiven:0,loanReceived:0};
  // },

  renderPills(){
    const pillsHost=document.getElementById('pillsBar');
    if(this.curTab!=='home'){
      if(pillsHost) pillsHost.innerHTML='';
      return;
    }
    if(!pillsHost) return;
    // Bug5 fix: clear ledger cache so getTenantLedger recalculates fresh this cycle
    // (renderTab already clears it, but renderPills can be called standalone too)
    if(!this._inRenderTab) this._ledgerCache={};
    // ── Use shared engine — single source of truth ──
    const now=new Date();
    const outstanding=this._calcOutstanding();
    const pend=outstanding.total;
    const _loanOutstanding=outstanding.loanOutstanding;
    const remState=this._calcRemindersState();
    const renewTotal=remState.urgentCount;
    const renewExp=remState.expiredCount;
    const renewDue=remState.dueCount;
    const upTrips=this.trips.filter(t=>new Date(t.dep)>=now).length;
    const todayIso=new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString().split('T')[0];
    const todayEventItems=[];
    const pushTodayEvent=(label,type)=>{
      if(!label) return;
      todayEventItems.push({label:String(label).trim(),type:type||''});
    };
    const getReminderDate=(r)=>r.mode==='recurring'
      ? (r.nextTrigger||r.start||r.reminderDate||r.alertDate||r.trigDate||null)
      : (r.reminderDate||r.alertDate||r.trigDate||r.dueDate||r.exp||null);
    this.reminders.forEach(r=>{
      const rd=getReminderDate(r);
      if(rd===todayIso) pushTodayEvent(r.name, r.type||'Reminder');
    });
    this.getCalEvents?.().forEach(ev=>{
      if(ev.date===todayIso) pushTodayEvent(ev.title, ev.type||'Event');
    });
    this.trips.forEach(t=>{
      if(t.dep===todayIso) pushTodayEvent(`Depart: ${t.dest}`, 'Travel');
      if(t.ret===todayIso) pushTodayEvent(`Return: ${t.dest}`, 'Travel');
    });
    this.visits.forEach(v=>{
      ['date','next','next2','next3'].forEach(k=>{
        if(v[k]===todayIso){
          const p=this.patients.find(x=>x.id===v.patId);
          pushTodayEvent(`${p?p.name:'Patient'}${v.doctor?` — Dr. ${v.doctor}`:''}`, k==='date'?'Visit':'Follow-up');
        }
      });
    });
    const todayEventCount=todayEventItems.length;
    const todayEventDetails=todayEventItems.slice(0,3).map(ev=>`
      <div class="pill-note-row">
        <b class="pill-note-title pill-note-title-info">${toTitleCase(ev.label)}</b>
        ${ev.type?`<span class="pill-note-meta">${ev.type}</span>`:''}
      </div>`).join('');
    
    // Overdue Rent Details
    let ovdRentDetails='';
    this.tenants.filter(t=>t.status==='active').forEach(t=>{
      const ledger=this.getTenantLedger(t);
      const bal=ledger.totalBalance;
      if(bal>0){
        const hasOverdue=ledger.months.some(mo=>mo.status==='overdue');
        if(hasOverdue){
          const prop=this.props.find(p=>p.id===t.propId);
          const dueDay = t.due || 1;
          ovdRentDetails+=`<div class="pill-note-row">
            <b class="pill-note-title pill-note-title-danger">${toTitleCase(t.name)}</b>
            <span class="pill-note-muted"><span class="pill-note-amount pill-note-amount-danger">${fmt(bal)}</span> · ${toTitleCase(prop?prop.name:'Property')}</span>
            <span class="pill-note-meta">Due: ${dueDay}th Of Month</span>
          </div>`;
        }
      }
    });
    
    // Medical Follow-ups Details
    let medDetails='';
    this.visits.filter(r=>r.next).slice(0,4).forEach(r=>{
      const nd=r.next.includes('-')?r.next:dmyToIso(r.next);
      const p=this.patients.find(x=>x.id===r.patId);
      medDetails+=`<div class="pill-note-row">
        <b class="pill-note-title pill-note-title-info">${toTitleCase(p?p.name:'Unknown')}</b>
        <span class="pill-note-meta pill-note-title-info">${fD(nd)}</span>
      </div>`;
    });
    
    // To-do Details
    let _rawTodos; try{ _rawTodos=JSON.parse(localStorage.getItem('rk_todos')||'[]'); }catch{ _rawTodos=[]; }
    const pendTodos=_rawTodos.filter(t=>!t.done);
    let todoDetails='';
    pendTodos.slice(0,4).forEach(t=>{
      todoDetails+=`<div class="pill-note-row pill-note-row-success"><span class="pill-note-inline">• ${toTitleCase(t.text)}</span></div>`;
    });
    
    pillsHost.innerHTML=`
            <div class="pill" onclick="APP.goTab('rent')" style="background:#fff;border-color:#c3c6d7;border-left:4px solid ${pend<=0?'#10b981':'#f43f5e'};"><div class="pill-lbl" style="color:${pend<=0?'#10b981':'#f43f5e'}"><b><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;">notifications_active</span>OVERDUE RENT</b></div>
        <div class="pill-val" style="color:${pend<=0?'#10b981':'#dc2626'};font-size:20px;font-weight:900;">${pend<=0?'Clear':fmt(pend)}</div>
        ${ovdRentDetails?`<div class="pill-details pill-scroll">${ovdRentDetails}</div>`:`<div class="pill-sub" style="color:${pend<=0?'var(--grn)':'#b92d2d'};font-weight:700;">${pend<=0?'No Dues':'All Due'}</div>`}
      </div>
      <div class="pill" onclick="APP.goTab('khata')" style="background:#fff;border-color:#c3c6d7;border-left:4px solid #a855f7;">
        <div class="pill-lbl" style="color:#9333ea"><b><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;">book</span>KHATA BOOK</b></div>
        ${(()=>{
          const parties = APP.kbParties || [];
          const entries = APP.kbEntries || [];
          // Calculate net balance per party
          const balMap = {};
          entries.forEach(e=>{
            if(!balMap[e.partyId]) balMap[e.partyId]={lena:0,dena:0};
            if(e.type==='lena') balMap[e.partyId].lena+=Number(e.amount||0);
            else if(e.type==='dena') balMap[e.partyId].dena+=Number(e.amount||0);
          });
          // Lena = others owe me (net positive), Dena = I owe them (net negative)
          let lenaTotal=0, denaTotal=0;
          parties.forEach(p=>{
            const b=balMap[p.id]||{lena:0,dena:0};
            const net=b.lena-b.dena;
            if(net>0){ lenaTotal+=net; }
            else if(net<0){ denaTotal+=Math.abs(net); }
          });
          return `
            <div class="pill-split pill-split--compact" style="margin-top:8px;">
              <div class="pill-split-col">
                <div class="pill-mini-label" style="color:#166534;">🤲 Liya Hai</div>
                <div class="pill-mini-value" style="color:#166534;">${Number(lenaTotal)>=100000?(Number(lenaTotal)/100000).toFixed(1)+'L':fmt(lenaTotal)}</div>
              </div>
              <div class="pill-split-col">
                <div class="pill-mini-label" style="color:#c0392b;">💸 Diya Hai</div>
                <div class="pill-mini-value" style="color:#c0392b;">${Number(denaTotal)>=100000?(Number(denaTotal)/100000).toFixed(1)+'L':fmt(denaTotal)}</div>
              </div>
            </div>
          `;
        })()}
      </div>
      <div class="pill" style="background:#fff;border-color:#c3c6d7;border-left:4px solid #f97316;cursor:default;">
        <div onclick="APP.goTab('reminder')" style="cursor:pointer;">
          <div class="pill-lbl" style="color:#ea580c"><b><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;">alarm</span>REMINDERS</b></div>
          <div class="pill-val" style="color:#0f172a;font-size:20px;font-weight:900;">${remState.total}</div>
        </div>
        ${(()=>{
          const s=APP._calcRemindersState();
          const expiredCnt=s.overdue.length;
          const todayCnt=s.today.length;
          const weekCnt=s.thisWeek.length;
          const monthCnt=s.thisMonth.length;
      const doneCnt=(()=>{try{return JSON.parse(localStorage.getItem('rk_done_ids')||'[]').length;}catch{return 0;}})();
          return `<div class="pill-kpi-grid pill-kpi-grid--two-up" onclick="APP.goTab('reminder')">
            <div class="pill-kpi-item is-alert">
              <div class="pill-kpi-value">${expiredCnt}</div>
              <div class="pill-kpi-label">Overdue</div>
            </div>
            <div class="pill-kpi-item">
              <div class="pill-kpi-value">${todayCnt}</div>
              <div class="pill-kpi-label">Today</div>
            </div>
            <div class="pill-kpi-item">
              <div class="pill-kpi-value">${weekCnt}</div>
              <div class="pill-kpi-label">This Week</div>
            </div>
            <div class="pill-kpi-item">
              <div class="pill-kpi-value">${monthCnt}</div>
              <div class="pill-kpi-label">This Month</div>
            </div>
          </div>
          `;
        })()}
      </div>
      <div class="pill" onclick="APP.medFilter30=true;APP.goTab('medical')" style="background:#fff;border-color:#c3c6d7;border-left:4px solid #2563eb;">
        <div class="pill-lbl" style="color:#2563eb"><b><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;">medical_services</span>MEDICAL FOLLOW-UP</b></div>
        <div class="pill-val" style="color:#2563eb;font-size:20px;font-weight:900;">${this.visits.filter(r=>{if(!r.next)return false;const ni=r.next.includes('-')?r.next:dmyToIso(r.next);if(!ni)return false;const d=this._dFromNow(ni);return d!==null&&d<=30;}).length}</div>
        ${medDetails?`<div class="pill-details pill-scroll">${medDetails}</div>`:`<div class="pill-sub" style="color:var(--blu);font-weight:700;">No Follow-Ups</div>`}
      </div>
      <div class="pill" onclick="APP.goTab('travel')" style="background:#fff;border-color:#c3c6d7;border-left:4px solid #14b8a6;">
        <div class="pill-lbl" style="color:#0f9488"><b><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;">flight_takeoff</span>TRIPS</b></div>
        <div class="pill-val" style="color:#0f172a;font-size:20px;font-weight:900;">${upTrips}</div>
        <div class="pill-sub" style="color:var(--tel);font-weight:700;">Upcoming</div>
      </div>
      <div class="pill" onclick="APP.goTab('calendar')" style="background:#fff;border-color:#c3c6d7;border-left:4px solid #6366f1;">
        <div class="pill-lbl" style="color:#4f46e5"><b><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;">calendar_month</span>CALENDAR</b></div>
        <div class="pill-val" style="color:#0f172a;font-size:20px;font-weight:900;">${todayEventCount}</div>
        ${todayEventDetails?`<div class="pill-details pill-scroll">${todayEventDetails}</div>`:`<div class="pill-sub" style="color:#1050a0;font-weight:700;">No events today</div>`}
      </div>
      <div class="pill" onclick="APP.goTab('todo')" style="background:#fff;border-color:#c3c6d7;border-left:4px solid #10b981;">
        <div class="pill-lbl" style="color:#059669"><b><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;">check_circle</span>TO DO LIST</b></div>
        <div class="pill-val" style="color:#059669;font-size:20px;font-weight:900;">${pendTodos.length}</div>
        ${todoDetails?`<div class="pill-details pill-scroll">${todoDetails}</div>`:`<div class="pill-sub" style="color:#1a6a38;font-weight:700;">All done!</div>`}
      </div>`;
  },

  // ══ HOME ══
  renderHome(){
    const now=new Date(),m=now.getMonth(),y=now.getFullYear();
    now.setHours(0,0,0,0);

    // ══════════════════════════════════════════════════════════════
    // ── Use shared engine — same data as pills + reminders tab ──
    const outstanding=this._calcOutstanding();
    const remState=this._calcRemindersState();

    // Alias for local use (same objects as renderReminders uses)
    const catOverdue=remState.overdue;
    const catToday=remState.today;
    const catThisWeek=remState.thisWeek;
    const catThisMonth=remState.thisMonth;
    const allReminderEntries=[...catOverdue,...catToday,...catThisWeek,...catThisMonth,...remState.upcoming];
    // Priority sort: Overdue (negative) → Due Today (0) → Upcoming (positive/null)
    const sortByTrig=(a,b)=>{
      const va=a._dTrig===null?99999:a._dTrig;
      const vb=b._dTrig===null?99999:b._dTrig;
      return va-vb;
    };

    // ── RENT overdue/pending (from ledger) ──
    let ovdRent=[],pendRent=[];
    this.tenants.filter(t=>t.status==='active').forEach(t=>{
      const ledger=this.getTenantLedger(t);
      const bal=ledger.totalBalance;
      if(bal>0){
        const hasOverdue=ledger.months.some(mo=>mo.status==='overdue');
        if(hasOverdue) ovdRent.push({name:t.name,bal,id:t.id});
        else pendRent.push({name:t.name,bal,id:t.id});
      }
    });

    // ── Rent due TODAY ──
    const todayDate = now.getDate();
    const rentDueTodayRows = this.tenants.filter(t=>{
      if(t.status!=='active') return false;
      const lg2=this.getTenantLedger(t);
      const cm2=lg2.months.find(mo=>mo.year===y&&mo.month===m);
      return cm2&&(cm2.status==='due'||cm2.status==='overdue')&&Number(t.due)===todayDate;
    }).map(t=>{
      const lg3=this.getTenantLedger(t);
      return{_src:'rent',name:t.name+' — Due Today',type:'💰 Rent',_trig:0,_dTrig:0,_dExp:null,bal:lg3.totalBalance,id:t.id};
    });

    // ── Alerts = overdue + today + this week, sorted by priority ──
    const alertEntries=[...catOverdue,...catToday,...catThisWeek]
      .sort((a,b)=>APP._trigSortVal(a)-APP._trigSortVal(b));

    // ── Rent alert rows: read directly from syncRentReminders() output ──
    // syncRentReminders() already computed correct _daysOv (max across all overdue months)
    // and stored it on each _isAutoRent reminder. Do NOT recompute from current month only.
    const _doneIdsAlert=this._getDoneIds();
    const rentAlertRows=this.reminders
      .filter(r=>r._isAutoRent && !_doneIdsAlert.has(r.id) && !r.completed && r._dTrig<0)
      .map(r=>{
        const _rt=this.tenants.find(t=>t.id===r._tenantId);
        let _invDisp='—';
        if(_rt&&_rt.invdate){const _id=parseIso(_rt.invdate);if(_id&&!isNaN(_id))_invDisp=fD(_rt.invdate);}
        else if(_rt){const _n=new Date(now.getFullYear(),now.getMonth(),1);_invDisp=fD(_n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-01');}
        return{
          _src:'rent',
          name:_rt?_rt.name:r.person||r.name,
          type:'💰 Rent',
          _trig:null,
          _trigDate:_rt?.invdate||null,
          _invDisp,
          // Use pre-computed _dTrig and _daysOv — same values shown in Reminders tab
          _dTrig:r._dTrig,
          _daysOv:r._daysOv||0,
          _dExp:null,
          bal:r._balanceAmt||0,
          id:r.id,
          _tenantId:r._tenantId
        };
      });
    const allAlertRows=[...rentAlertRows,...rentDueTodayRows,...alertEntries]
      .filter(e=>!_doneIdsAlert.has(e.id)&&!e.completed)
      .sort((a,b)=>{
        // Priority: 0=Overdue (dTrig<0), 1=Due Today (dTrig===0), 2=Upcoming (dTrig>0)
        // Within each priority, sort by urgency (most overdue first, soonest upcoming first)
        const getPri=(d)=>d===null?2:d<0?0:d===0?1:2;
        const pa=getPri(a._dTrig), pb=getPri(b._dTrig);
        if(pa!==pb) return pa-pb;
        // Same priority: for overdue sort most-overdue first (most negative first)
        // for upcoming sort soonest first (smallest positive first)
        const va=a._dTrig===null?99999:a._dTrig;
        const vb=b._dTrig===null?99999:b._dTrig;
        return va-vb;
      });

    // ── STATUS BADGE & COLORS — based on TASK DATE (dDue), not alert date ──
    // dDue = days until task/due date; negative = overdue
    function statusInfo(dDue, completed){
      if(completed)       return{label:'✅ Completed',bg:'#dcfce7',tc:'#166534',rowBg:'#f0fdf4'};
      if(dDue===null||dDue===undefined) return{label:'Upcoming',bg:'#e8f5e9',tc:'#1e7a45',rowBg:'#f0fdf4'};
      var n=Math.abs(dDue);
      if(dDue<0)  return{label:'🔴 Overdue '+n+' day'+(n>1?'s':''),bg:'#fee2e2',tc:'#991b1b',rowBg:'#fff5f5'};
      if(dDue===0)return{label:'🔔 Due Today',bg:'#fef9c3',tc:'#854d0e',rowBg:'#fffaee'};
      if(dDue<=7) return{label:'⏰ Due in '+dDue+' day'+(dDue>1?'s':''),bg:'#fef9c3',tc:'#854d0e',rowBg:'#fffcf5'};
      return              {label:'🟢 Due in '+dDue+' days',bg:'#dcfce7',tc:'#166534',rowBg:''};
    }

    const typeIconMap={'🛂 Passport':'🛂','🚗 Driving Licence':'🚗','🛡️ Insurance':'🛡️','📋 Rent Agreement':'📋',
      '📊 Tax Filing':'📊','💳 Loan/EMI':'💳','💻 Laptop/Device':'💻','🔁 Subscription':'🔁',
      '📔 Visa':'📔','🚘 Vehicle RC':'🚘','🪪 PAN Card':'🪪','🪪 Aadhaar':'🪪',
      '🏥 Medical':'🏥','💰 Rent':'💰','📌 Other':'📌',
      'Passport':'🛂','Driving Licence':'🚗','Insurance':'🛡️','Rent Agreement':'📋',
      'Tax Filing':'📊','Loan/EMI':'💳','Laptop/Device':'💻','Subscription':'🔁',
      'Visa':'📔','Vehicle RC':'🚘','PAN Card':'🪪','Aadhaar':'🪪','Other':'📌',
      '📌 To Do':'📌','🎂 Birthday':'🎂','💍 Anniversary':'💍','💳 Bills/Payment':'💳','📞 Call/Follow-up':'📞'};

    // ── ALERTS TABLE (new design: full columns) ──
    let alerts='';
    if(allAlertRows.length){
      const borderColorFn=(d)=>d===null||d<0?'#e05050':d===0?'#e09050':d<=7?'#d4b840':'#90c8a0';
      const blLabelA={'1':'1d','3':'3d','7':'1wk','15':'15d','30':'1mo','60':'2mo','90':'3mo','180':'6mo','365':'1yr'};
      const rows=allAlertRows.map(e=>{
        // Use task date (_dDue) for status; fall back to _dTrig for legacy entries
        const _eDue = (e._dDue!==undefined&&e._dDue!==null) ? e._dDue : e._dTrig;
        const si=statusInfo(_eDue, !!(e.completed));
        const icon=typeIconMap[e.type]||'📌';
        const isRent=e._src==='rent'||e.mode==='rent';
        const isLoan=e.mode==='loan';
        const isMedical=e._src==='medical';
        const borderC=borderColorFn(e._dTrig);

        // 1. CATEGORY
        const catLabel=isRent?'Rent':isLoan?'Loan':isMedical?'Medical':(e.type||'Other').replace(/^[^\s]*\s/,'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,'');
        const catCell=`<td class="home-alerts-cell home-alerts-cell-cat" style="white-space:nowrap;"><span class="home-alerts-cat-icon">${icon}</span><div class="home-alerts-cat-label">${catLabel}</div></td>`;

        // 2. NAME + PERSON
        const nameCell=`<td class="home-alerts-cell home-alerts-cell-name" style="max-width:180px;"><div class="home-alerts-name">${e.name}</div>${e.person?`<div class="home-alerts-person">👤 ${e.person}</div>`:''}</td>`;

        // 3. REMINDER DATE (trigger date)
        // Rent: always show invoice generation date (never blank)
        let trigDisp;
        if(isRent){
          if(e._invDisp&&e._invDisp!=='—') trigDisp=e._invDisp;
          else if(e._trigDate) trigDisp=fD(e._trigDate);
          else {
            // Auto-compute from tenant due day
            const _rentT=this.tenants.find(t=>t.id===e.id||t.id===(e._tenantId||e.id));
            if(_rentT&&_rentT.invdate) trigDisp=fD(_rentT.invdate);
            else if(_rentT&&_rentT.due){
              const _nd=new Date();
              const _iday=Number(_rentT.due)||1;
              const _id=new Date(_nd.getFullYear(),_nd.getMonth(),_iday);
              trigDisp=fD(_id.getFullYear()+'-'+String(_id.getMonth()+1).padStart(2,'0')+'-'+String(_id.getDate()).padStart(2,'0'));
            } else {
              const _nd2=new Date();
              trigDisp=fD(_nd2.getFullYear()+'-'+String(_nd2.getMonth()+1).padStart(2,'0')+'-01');
            }
          }
        } else if(isLoan){
          trigDisp=e._trigDate?fD(e._trigDate):'—';
        } else {
          trigDisp=fD(e._trig)||'—';
        }
        var _entryDueDate = e.dueDate||e.trigDate||'';
        var _entryRemDate = e._remDate||e.reminderDate||e._trig||'';
        const remDateCell=`<td class="home-alerts-cell home-alerts-cell-date" style="font-family:'JetBrains Mono',monospace;white-space:nowrap;">
          <span class="home-alerts-date" style="color:#1565c0;">${(function(){
            var _r=_entryRemDate||'';
            if(_r&&_r!==_entryDueDate) return fD(_r);
            return trigDisp||(_r?fD(_r):'—');
          }())}</span>
        </td>`;

        // 4. TASK DATE (for reminder) or AMOUNT (for rent/loan)
        // Due Date = actual task/due date (dark), or Amount for rent/loan
        var _taskDateStr = e.dueDate||e.trigDate||e.taskDate||'';
        const expVal=isRent?fmt(e.bal||0):isLoan?fmt(e._outstanding||e.bal||0):(_taskDateStr?fD(_taskDateStr):'—');
        const expLabel=isRent||isLoan?'Amt':'Due Date';
        const expColor=isRent||isLoan?'#e05050':'var(--txt)';
        const expDateCell=`<td class="home-alerts-cell home-alerts-cell-date" style="font-family:'JetBrains Mono',monospace;white-space:nowrap;">
          <span class="home-alerts-date" style="color:${expColor};">${expVal}</span>
        </td>`;

        // 5. DAYS INFO — based on task date (_dDue), not alert date
        const _dueD=_eDue; // already resolved above
        const _isCompleted=!!(e.completed||_doneIdsAlert.has(e.id));
        const n_days=_dueD!==null?Math.abs(_dueD):0;
        const daysInfo=_isCompleted?'✅ Done':_dueD===null?'—':_dueD<0?'Overdue '+n_days+' day'+(n_days>1?'s':''):_dueD===0?'Due Today':_dueD+' day'+(_dueD>1?'s':'')+' left';
        const daysColor=_isCompleted?'#166534':_dueD===null?'var(--mut)':_dueD<0?'#e05050':_dueD===0?'#e09050':'#1a7a45';
        const daysCell=`<td style="padding:7px 8px;font-size:.72rem;font-weight:700;color:${daysColor};white-space:nowrap;">${daysInfo}</td>`;

        // 6. REMINDER TYPE
        const rType=isRent?'Auto-Rent':isLoan?'Auto-Loan':isMedical?'Follow-up':e.mode==='recurring'?'Recurring':'One-time';
        const typeCell=`<td class="home-alerts-cell home-alerts-meta" style="white-space:nowrap;">${rType}</td>`;

        // 7. FREQUENCY — use full repeatLabel if available, else fallback
        let freq='Once';
        if(isRent)freq='Monthly';
        else if(isLoan)freq='Once';
        else if(e.mode==='recurring'){
          freq=e.repeatLabel||(e.recurPeriod?({'1':'Daily','7':'Weekly','15':'15d','30':'Monthly','90':'Quarterly','180':'HalfYrly','365':'Yearly'}[e.recurPeriod]||e.recurPeriod+'d'):'Recurring');
        }
        const freqCell=`<td class="home-alerts-cell home-alerts-meta" style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${freq}">${freq}</td>`;

        // 8. STATUS
        const statusCell=`<td class="home-alerts-cell" style="white-space:nowrap;"><span class="home-alerts-status" style="background:${si.bg};color:${si.tc};">${si.label}</span></td>`;

        const doneCell=`<td class="home-alerts-cell" style="white-space:nowrap;"><button class="home-alerts-done" onclick="event.stopPropagation();APP.markReminderDone('${e.id}')" title="Mark as done">✅</button></td>`;
        return `<tr style="background:${si.rowBg};border-left:3px solid ${borderC};"
          onmouseover="this.style.background='var(--dim)'" onmouseout="this.style.background='${si.rowBg||''}'">
          ${catCell}${nameCell}${expDateCell}${remDateCell}${typeCell}${freqCell}${statusCell}${doneCell}
        </tr>`;
      }).join('');

      const urgCount=allAlertRows.length;
      const expCount=allAlertRows.filter(e=>e._dTrig!==null&&e._dTrig<0).length;
      const todayCount=allAlertRows.filter(e=>e._dTrig===0).length;

      alerts=`<div class="home-alerts-panel" style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.04);margin-bottom:14px;">
        <div class="home-alerts-headbar" style="background:#fff;padding:18px 22px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div class="home-alerts-titlewrap" style="display:flex;align-items:center;gap:8px;">
            <span class="home-alerts-title"><span class="material-symbols-outlined home-alerts-title-icon">notifications_active</span>Alerts Today</span>
            ${expCount>0?`<span class="home-alerts-chip is-overdue">${expCount} OVERDUE</span>`:''}
            ${todayCount>0?`<span class="home-alerts-chip is-today">${todayCount} DUE TODAY</span>`:''}
          </div>
          <div class="home-alerts-actions" style="display:flex;gap:6px;align-items:center;">
            <span class="home-alerts-count">${urgCount} items</span>
            <button class="btn b-out b-sm home-alerts-cta" onclick="APP.goTab('reminder')">View All →</button>
          </div>
        </div>
        <div class="home-alerts-table-wrap" style="overflow-x:auto;">
          <table class="home-alerts-table" style="width:100%;border-collapse:collapse;min-width:480px;">
            <thead>
              <tr class="home-alerts-headrow" style="background:var(--card2);border-bottom:1.5px solid var(--bdr2);">
                <th class="home-alerts-head">Category</th>
                <th class="home-alerts-head">Name</th>
                <th class="home-alerts-head">Due Date / Amt</th>
                <th class="home-alerts-head">Reminder Date</th>
                <th class="home-alerts-head">Type</th>
                <th class="home-alerts-head">Freq</th>
                <th class="home-alerts-head">Status</th>
                <th class="home-alerts-head">Done</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    } else {
            alerts=`<div style="background:#f0faf5;border:1.5px solid #90c8a0;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:.84rem;">
        <span style="font-size:1.4rem;">✅</span>
        <div><b style="color:#1e7a45;">All clear — No urgent alerts!</b><div style="font-size:.75rem;color:var(--mut);margin-top:2px;">No overdue or due-today reminders. 🎉</div></div>
      </div><div style="margin-bottom:14px"></div>`;
    }

    // ── Quick summary fu-cards removed (user request) ──
    const fuSection = '';

    // ── Reminder Due mini-cards (dashboard card) ──
    const ti2={'Passport':'🛂','Driving Licence':'🚗','Insurance':'🛡️','Rent Agreement':'📋','Tax Filing':'📊',
      'Loan/EMI':'💳','Laptop/Device':'💻','Subscription':'🔁','Visa':'📔','Vehicle RC':'🚘',
      'PAN Card':'🪪','Aadhaar':'🪪','Other':'📌','🏥 Medical':'🏥'};
    const allDueRem=[...catOverdue,...catToday,...catThisWeek,...catThisMonth]
      .filter(e=>e._src==='reminder')
      .sort(sortByTrig);
    const remW=allDueRem.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:7px;">` +
      allDueRem.slice(0,6).map(r=>{
        const d=r._dTrig;
        const bg=d<0?'#fff0f0':d===0?'#fff8cc':d<=7?'#fff8ee':'#f0faf5';
        const bc=d<0?'#f0a0a0':d===0?'#e0c000':d<=7?'#f0c060':'#90c8a0';
        const tc=d<0?'#a32d2d':d===0?'#7a5f00':d<=7?'#854f0b':'#1e7a45';
        const label=d<0?`Exp ${Math.abs(d)}d ago`:d===0?'TODAY':d+'d left';
        const icon=typeIconMap[r.type]||'📌';
        return`<div style="background:${bg};border:1.5px solid ${bc};border-radius:10px;padding:8px 10px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:4px;">
            <div onclick="APP.goTab('reminder')" style="cursor:pointer;flex:1;min-width:0;">
              <div style="font-size:1.1rem;margin-bottom:4px;">${icon}</div>
              <div style="font-size:.78rem;font-weight:700;color:${tc};word-break:break-word;line-height:1.3;margin-bottom:4px;">${APP.displayText(r.name)}</div>
              <div style="font-size:.68rem;color:${tc};background:${bc};padding:2px 6px;border-radius:10px;display:inline-block;font-weight:700;">${label}</div>
              <div style="font-size:.66rem;color:var(--mut);margin-top:3px;">${fD(r._trig)}</div>
            </div>
            <button onclick="APP.markReminderDone('${r.id}')" style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;border-radius:6px;padding:3px 6px;font-size:.68rem;font-weight:800;cursor:pointer;flex-shrink:0;margin-top:2px;" title="Mark done">✅</button>
          </div>
        </div>`;
      }).join('') + `</div>` :
      `<div class="empty" style="padding:12px">✅ All reminders clear</div>`;

    // ── Rent / Medical / Travel mini-widgets ──
    const rentW=this.tenants.filter(t=>t.status==='active').slice(0,5).map(t=>{
      const ledger=this.getTenantLedger(t);const bal=ledger.totalBalance;
      return`<div class="fr"><span class="fl">${t.name}</span><span><span class="badge ${bal<=0?'bg':ledger.totalReceived>0?'by':'br'}">${bal<=0?'✓ Clear':ledger.totalReceived>0?'Part.':'Unpaid'}</span>${bal>0?`<span style="color:var(--red);font-size:.74rem;font-family:'JetBrains Mono',monospace;margin-left:4px">${fmt(bal)}</span>`:''}</span></div>`;
    }).join('')||'<div class="empty" style="padding:12px">No active tenants</div>';

    const medW=this.visits.filter(r=>{
      if(!r.next) return false;
      const nd=r.next.includes('-')?r.next:dmyToIso(r.next);
      const _d=this._dFromNow(nd); return nd&&_d!==null&&_d>=0;
    }).sort((a,b)=>{
      const na=a.next.includes('-')?a.next:dmyToIso(a.next);
      const nb=b.next.includes('-')?b.next:dmyToIso(b.next);
      return new Date(na)-new Date(nb);
    }).slice(0,3).map(r=>{
      const nd=r.next.includes('-')?r.next:dmyToIso(r.next);
      const p=this.patients.find(x=>x.id===r.patId);
      return`<div class="fr"><span class="fl">${p?p.name:'?'}<br><span style="opacity:.6">Dr.${r.doctor||'—'}</span></span><span class="mono" style="font-size:.76rem">${fD(nd)}</span></div>`;
    }).join('')||'<div class="empty" style="padding:12px">No upcoming</div>';

    const tvW=this.trips.filter(t=>new Date(t.dep)>=now).sort((a,b)=>new Date(a.dep)-new Date(b.dep)).slice(0,3)
      .map(t=>`<div class="fr"><span class="fl">${t.dest}</span><span class="mono" style="font-size:.76rem">${fD(t.dep)}</span></div>`).join('')||'<div class="empty" style="padding:12px">No trips</div>';

    document.getElementById('pan-home').innerHTML=`${fuSection}${alerts}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:11px;margin-top:11px;">
        <div class="card" style="border-color:#e2e8f0;">
          <div class="card-hdr" style="background:#fff;"><div class="card-title" style="color:#111827;display:flex;align-items:center;gap:8px;"><span class="material-symbols-outlined" style="font-size:24px;color:#2563eb;">calendar_month</span>Calendar</div><button class="btn b-sm" style="background:#2563eb;color:#fff;border:none;" onclick="APP.goTab('calendar')">Open Full</button></div>
          <div class="card-body" style="font-size:.82rem;">
            ${(()=>{const evs=[];const now2=new Date();
              allReminderEntries.filter(r=>r._dTrig!==null&&r._dTrig>=0&&r._dTrig<=7&&r._src==='reminder').slice(0,2).forEach(r=>evs.push(`<div style="padding:4px 0;border-bottom:1px solid var(--bdr);"><span class="badge br" style="font-size:.62rem">Rem</span> ${r.name} — ${fD(r._trig)}</div>`));
              this.visits.filter(r=>r.next&&this._dFromNow(r.next.includes('-')?r.next:dmyToIso(r.next))>=0&&this._dFromNow(r.next.includes('-')?r.next:dmyToIso(r.next))<=14).slice(0,2).forEach(r=>{const p=this.patients.find(x=>x.id===r.patId);evs.push(`<div style="padding:4px 0;border-bottom:1px solid var(--bdr);"><span class="badge bb" style="font-size:.62rem">Dr</span> ${p?p.name:'?'} — ${fD(r.next)}</div>`);});
              this.trips.filter(t=>new Date(t.dep)>=now2).slice(0,2).forEach(t=>evs.push(`<div style="padding:4px 0;border-bottom:1px solid var(--bdr);"><span class="badge bt" style="font-size:.62rem">Trip</span> ${t.dest} — ${fD(t.dep)}</div>`));
              return evs.length?evs.join(''):'<div style="color:var(--mut);padding:8px 0;">No upcoming events</div>';
            })()}
          </div>
        </div>
        <div class="card" style="border-color:#e2e8f0;">
          <div class="card-hdr" style="background:#fff;"><div class="card-title" style="color:#111827;display:flex;align-items:center;gap:8px;"><span class="material-symbols-outlined" style="font-size:24px;color:#059669;">done_all</span>To Do List</div><button class="btn b-sm" style="background:#059669;color:#fff;border:none;" onclick="APP.goTab('todo')">Open Full</button></div>
          <div class="card-body" style="padding:10px 12px;">
            ${_renderTodoWidget()}
          </div>
        </div>
        <div>${this.renderNotepad()}</div>
      </div>`;
  },
}; // end APP core

// Store reference to real APP object BEFORE window.APP proxy can wrap it
// init.js uses window._REAL_APP to flush the guard proxy safely
window._REAL_APP = APP;

// Note: _APP_FLUSH is called in js/init.js after all modules load

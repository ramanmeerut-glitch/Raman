/* modules/home.js — APP Core + Dashboard Home
 * Defines the main APP object with all shared state, getters, core navigation,
 * pills, and the Home tab renderer.
 * Loaded FIRST among all modules — other modules extend APP via Object.assign().
 */

'use strict';

const APP = {
  curTab:'home',curPerson:'Raman',curProp:null,curPatient:'all',medFilter30:false,
  rentSub:'overview',travelSub:'upcoming',
  editId:null,payTId:null,payEditId:null,delCb:null,
  calY:new Date().getFullYear(),calM:new Date().getMonth(),
  _impBuf:null,viewLedgerTid:null,
  _ledgerCache:{}, // Bug5 fix: cache getTenantLedger results per render cycle
  _pdfOrientation:'portrait', // Global PDF orientation: 'portrait' | 'landscape'

  get persons(){return S.obj('persons',['Raman']);},
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

  init(){
    document.getElementById('hdrDate').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
    this.refreshPersons();
    this.renderPills();
    this.renderTab('home');
    this.injectDateWidgets();
    this._wirePaymentModal();
  },

  // Wire Save Payment button via addEventListener (backup to inline onclick)
  // Prevents silent failure if onclick="APP.savePayment()" misfires
  _wirePaymentModal(){
    try {
      const btn = document.getElementById('pym_save_btn');
      if(btn && !btn._wired){
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

  // PERSONS
  refreshPersons(){
    const ps=this.persons;
    const sel=document.getElementById('personSel');
    sel.innerHTML=ps.map(p=>`<option value="${p}">${p}</option>`).join('');
    sel.value=this.curPerson;
    ['rmm_person'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=ps.map(p=>`<option>${p}</option>`).join('');});
  },
  addPerson(){
    const n=v('pm_name');if(!n){alert('Enter name');return;}
    const ps=this.persons;if(!ps.includes(n)){ps.push(n);S.set('persons',ps);}
    sv('pm_name','');sv('pm_rel','');M.close('personM');this.refreshPersons();
  },

  // TAB NAVIGATION
  goTab(t){
    this.curTab=t;
    document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('on',el.dataset.t===t));
    ['home','property','rent','expense','khata','reminder','medical','travel','calendar','todo','diary','notepad','search'].forEach(id=>{
      const el=document.getElementById('pan-'+id);
      if(el) el.style.display=id===t?'':'none';
    });
    this.renderTab(t);
  },
  renderTab(t){
    this._ledgerCache={}; // Bug5 fix: clear cache at start of each render cycle
    this._inRenderTab=true;
    this.renderPills();
    this._inRenderTab=false;
    if(t==='home')this.renderHome();
    if(t==='property')this.renderProperty();
    if(t==='rent')this.renderRent();
    if(t==='expense')this.renderExpense();
    if(t==='reminder')this.renderReminders();
    if(t==='medical')this.renderMedical();
    if(t==='travel')this.renderTravel();
    if(t==='calendar')this.renderCalendar();
    if(t==='todo')this.renderTodo();
    if(t==='diary')this.renderDiary();
    if(t==='notepad')this.renderNotepadTab();
    if(t==='khata')this.renderKhata();
    if(t==='search')this.renderSearchTab();
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
    if(r.mode==='recurring') return r.nextTrigger||r.start||null;
    if(r.mode==='rent'||r.mode==='loan') return r._trigDate||null;
    // ✅ Prefer reminderDate (= dueDate − before) when available
    if(r.reminderDate && r.reminderDate !== r.trigDate) return r.reminderDate;
    // Fallback: trigDate − beforeDays
    if(r.trigDate) {
      var bDays = parseInt(r.beforeDays||0);
      if(!bDays && r.before) bDays = Math.round(parseInt(r.before)/1440);
      if(bDays > 0) {
        var dp = r.trigDate.split('-');
        if(dp.length===3) {
          var d = new Date(parseInt(dp[0]),parseInt(dp[1])-1,parseInt(dp[2]),0,0,0,0);
          d.setDate(d.getDate()-bDays);
          return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        }
      }
      return r.trigDate;
    }
    if(!r.exp) return null;
    return getReminderTriggerDate(r.exp, r.before||0);
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
      const entry={...r,_trig:trig,_dTrig:dTrig};
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
        exp:ni,before:'0'
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
          ovdRentDetails+=`<div style="font-size:.65rem;padding:3px 0;border-bottom:1px solid #ffe0e0;">
            <b style="color:#b92d2d;">${toTitleCase(t.name)}</b><br>
            <span style="color:#b92d2d;font-weight:900;">₹${fmt(bal)}</span> · ${toTitleCase(prop?prop.name:'Property')}<br>
            <span style="color:#999;">Due: ${dueDay}th Of Month</span>
          </div>`;
        }
      }
    });
    
    // Medical Follow-ups Details
    let medDetails='';
    this.visits.filter(r=>r.next).slice(0,4).forEach(r=>{
      const nd=r.next.includes('-')?r.next:dmyToIso(r.next);
      const p=this.patients.find(x=>x.id===r.patId);
      medDetails+=`<div style="font-size:.65rem;padding:3px 0;border-bottom:1px solid #e0e8f0;">
        <b style="color:#1760a0;">${toTitleCase(p?p.name:'Unknown')}</b><br>
        <span style="color:#1760a0;">${fD(nd)}</span>
      </div>`;
    });
    
    // To-do Details
    let _rawTodos; try{ _rawTodos=JSON.parse(localStorage.getItem('rk_todos')||'[]'); }catch{ _rawTodos=[]; }
    const pendTodos=_rawTodos.filter(t=>!t.done);
    let todoDetails='';
    pendTodos.slice(0,4).forEach(t=>{
      todoDetails+=`<div style="font-size:.65rem;padding:3px 0;border-bottom:1px solid #e0f0e8;color:#1a6a38;">• ${toTitleCase(t.text)}</div>`;
    });
    
    document.getElementById('pillsBar').innerHTML=`
            <div class="pill" onclick="APP.goTab('rent')" style="background:linear-gradient(135deg,${pend<=0?'#f0faf4,#dcf5e8':'#fff0f0,#ffe0e0'});border-color:${pend<=0?'#90c8a0':'#f0a0a0'};"><div class="pill-lbl" style="color:${pend<=0?'var(--grn)':'#b92d2d'}"><b>💰 OVERDUE RENT</b></div>
        <div class="pill-val" style="color:${pend<=0?'var(--grn)':'#b92d2d'};font-size:0.95rem;font-weight:900;">${pend<=0?'✅ Clear':fmt(pend)}</div>
        ${ovdRentDetails?`<div style="margin-top:6px;max-height:90px;overflow-y:auto;">${ovdRentDetails}</div>`:`<div class="pill-sub" style="color:${pend<=0?'var(--grn)':'#b92d2d'};font-weight:700;">${pend<=0?'No Dues':'All Due'}</div>`}
      </div>
      <div class="pill" onclick="APP.goTab('khata')" style="background:linear-gradient(135deg,#f5f0ff,#ede0ff);border-color:#c0a0f0;">
        <div class="pill-lbl" style="color:var(--pur)"><b>📒 KHATA BOOK</b></div>
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
          const lenaList=[], denaList=[];
          let lenaTotal=0, denaTotal=0;
          parties.forEach(p=>{
            const b=balMap[p.id]||{lena:0,dena:0};
            const net=b.lena-b.dena;
            if(net>0){ lenaList.push({name:p.name,net}); lenaTotal+=net; }
            else if(net<0){ denaList.push({name:p.name,net:Math.abs(net)}); denaTotal+=Math.abs(net); }
          });
          lenaList.sort((a,b)=>b.net-a.net);
          denaList.sort((a,b)=>b.net-a.net);
          const nameRow=(name,amt,color)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:1px 0;gap:3px;overflow:hidden;"><span style="font-size:.58rem;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">${name}</span><span style="font-size:.56rem;font-weight:800;color:${color};white-space:nowrap;font-family:'JetBrains Mono',monospace;flex-shrink:0;">₹${Number(amt)>=100000?(Number(amt)/100000).toFixed(1)+'L':fmt(amt)}</span></div>`;
          return `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:4px;width:100%;overflow:hidden;">
              <div style="overflow:hidden;min-width:0;">
                <div style="font-size:.55rem;color:#166534;font-weight:800;margin-bottom:2px;">🤲 Liya Hai</div>
                <div style="font-size:.72rem;font-weight:900;color:#166534;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Number(lenaTotal)>=100000?(Number(lenaTotal)/100000).toFixed(1)+'L':fmt(lenaTotal)}</div>
                ${lenaList.slice(0,2).map(p=>nameRow(p.name,p.net,'#166534')).join('')}
                ${lenaList.length>2?`<div style="font-size:.52rem;color:#166534;opacity:.7;">+${lenaList.length-2} more</div>`:''}
              </div>
              <div style="overflow:hidden;min-width:0;">
                <div style="font-size:.55rem;color:#c0392b;font-weight:800;margin-bottom:2px;">💸 Diya Hai</div>
                <div style="font-size:.72rem;font-weight:900;color:#c0392b;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Number(denaTotal)>=100000?(Number(denaTotal)/100000).toFixed(1)+'L':fmt(denaTotal)}</div>
                ${denaList.slice(0,2).map(p=>nameRow(p.name,p.net,'#c0392b')).join('')}
                ${denaList.length>2?`<div style="font-size:.52rem;color:#c0392b;opacity:.7;">+${denaList.length-2} more</div>`:''}
              </div>
            </div>
          `;
        })()}
      </div>
      <div class="pill" style="background:linear-gradient(135deg,${renewTotal>0?'#fff8ee,#ffeedd':'#f0faf5,#e0f5e8'});border-color:${renewTotal>0?'#e8a060':'#90c8a0'};cursor:default;">
        <div onclick="APP.goTab('reminder')" style="cursor:pointer;">
          <div class="pill-lbl" style="color:${renewTotal>0?'var(--org)':'var(--grn)'}"><b>🔔 REMINDERS</b></div>
          <div class="pill-val" style="color:${renewTotal>0?'var(--org)':'var(--grn)'};font-size:1.1rem;font-weight:900;">${remState.total}</div>
        </div>
        ${(()=>{
          const s=APP._calcRemindersState();
          const expiredCnt=s.overdue.length;
          const todayCnt=s.today.length;
          const weekCnt=s.thisWeek.length;
          const monthCnt=s.thisMonth.length;
      const doneCnt=(()=>{try{return JSON.parse(localStorage.getItem('rk_done_ids')||'[]').length;}catch{return 0;}})();
          return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-top:6px;font-size:.62rem;text-align:center;" onclick="APP.goTab('reminder')">
            <div style="border-right:1px solid rgba(0,0,0,0.1);padding:2px 0;">
              <div style="font-weight:900;font-size:.9rem;color:#e05050;">${expiredCnt}</div>
              <div style="color:#e05050;font-weight:700;font-size:.6rem;">Overdue</div>
            </div>
            <div style="border-right:1px solid rgba(0,0,0,0.1);padding:2px 0;">
              <div style="font-weight:900;font-size:.9rem;color:#e09050;">${todayCnt}</div>
              <div style="color:#e09050;font-weight:700;font-size:.6rem;">Today</div>
            </div>
            <div style="border-right:1px solid rgba(0,0,0,0.1);padding:2px 0;">
              <div style="font-weight:900;font-size:.9rem;color:#b89000;">${weekCnt}</div>
              <div style="color:#b89000;font-weight:700;font-size:.6rem;">This Week</div>
            </div>
            <div style="padding:2px 0;">
              <div style="font-weight:900;font-size:.9rem;color:#1e7a45;">${monthCnt}</div>
              <div style="color:#1e7a45;font-weight:700;font-size:.6rem;">This Month</div>
            </div>
          </div>
          ${doneCnt>0?`<div onclick="event.stopPropagation();APP.showCompletedPopup()" style="margin-top:7px;background:#dcfce7;color:#166534;border:1px solid #90c8a0;border-radius:7px;padding:4px 8px;font-size:.64rem;font-weight:800;text-align:center;cursor:pointer;">✅ ${doneCnt} Completed →</div>`:''}`;
        })()}
      </div>
      <div class="pill" onclick="APP.medFilter30=true;APP.goTab('medical')" style="background:linear-gradient(135deg,#f0f7ff,#deeeff);border-color:#90b8e8;">
        <div class="pill-lbl" style="color:var(--blu)"><b>🏥 MEDICAL FOLLOW-UP</b></div>
        <div class="pill-val" style="color:var(--blu);font-size:1.1rem;font-weight:900;">${this.visits.filter(r=>{if(!r.next)return false;const ni=r.next.includes('-')?r.next:dmyToIso(r.next);if(!ni)return false;const d=this._dFromNow(ni);return d!==null&&d<=30;}).length}</div>
        ${medDetails?`<div style="margin-top:6px;max-height:90px;overflow-y:auto;">${medDetails}</div>`:`<div class="pill-sub" style="color:var(--blu);font-weight:700;">No Follow-Ups</div>`}
      </div>
      <div class="pill" onclick="APP.goTab('travel')" style="background:linear-gradient(135deg,#f0faf8,#dcf5f0);border-color:#80c8b8;">
        <div class="pill-lbl" style="color:var(--tel)"><b>✈️ TRIPS</b></div>
        <div class="pill-val" style="color:var(--tel);font-size:1.1rem;font-weight:900;">${upTrips}</div>
        <div class="pill-sub" style="color:var(--tel);font-weight:700;">Upcoming</div>
      </div>
      <div class="pill" onclick="APP.goTab('calendar')" style="background:linear-gradient(135deg,#e8f4ff,#d0e8ff);border-color:#6090d8;">
        <div class="pill-lbl" style="color:#1050a0"><b>📅 CALENDAR</b></div>
        <div class="pill-val" style="color:#1050a0;font-size:.78rem;font-weight:900;">Open</div>
        <div class="pill-sub" style="color:#1050a0;font-weight:700;">Events View</div>
      </div>
      <div class="pill" onclick="APP.goTab('todo')" style="background:linear-gradient(135deg,#e8fff0,#d0f0e0);border-color:#60b880;">
        <div class="pill-lbl" style="color:#1a6a38"><b>✅ TO DO LIST</b></div>
        <div class="pill-val" style="color:#1a6a38;font-size:1.1rem;font-weight:900;">${pendTodos.length}</div>
        ${todoDetails?`<div style="margin-top:6px;max-height:90px;overflow-y:auto;">${todoDetails}</div>`:`<div class="pill-sub" style="color:#1a6a38;font-weight:700;">All done!</div>`}
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

    // ── STATUS BADGE & COLORS (same as renderReminders) ──
    function statusInfo(dTrig,completed){
      if(completed)       return{label:'✅ Completed',bg:'#dcfce7',tc:'#166534',rowBg:'#f0fdf4'};
      if(dTrig===null)    return{label:'Upcoming',bg:'#e8f5e9',tc:'#1e7a45',rowBg:'#f0fdf4'};
      if(dTrig<0)         return{label:Math.abs(dTrig)+'d Overdue',bg:'#fcebeb',tc:'#a32d2d',rowBg:'#fff5f5'};
      if(dTrig===0)       return{label:'Due Today',bg:'#fff0cc',tc:'#854f0b',rowBg:'#fffaee'};
      if(dTrig<=7)        return{label:'Due in '+dTrig+'d',bg:'#fff8ee',tc:'#854f0b',rowBg:'#fffcf5'};
      return               {label:'Upcoming '+dTrig+'d',bg:'#e8f5e9',tc:'#1e7a45',rowBg:''};
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
        const si=statusInfo(e._dTrig, !!(e.completed));
        const icon=typeIconMap[e.type]||'📌';
        const isRent=e._src==='rent'||e.mode==='rent';
        const isLoan=e.mode==='loan';
        const isMedical=e._src==='medical';
        const borderC=borderColorFn(e._dTrig);

        // 1. CATEGORY
        const catLabel=isRent?'Rent':isLoan?'Loan':isMedical?'Medical':(e.type||'Other').replace(/^[^\s]*\s/,'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,'');
        const catCell=`<td style="padding:7px 8px;white-space:nowrap;"><span style="font-size:.85rem;">${icon}</span><div style="font-size:.62rem;font-weight:700;color:var(--mut);margin-top:1px;">${catLabel}</div></td>`;

        // 2. NAME + PERSON
        const nameCell=`<td style="padding:7px 8px;max-width:150px;"><div style="font-size:.8rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.name}</div>${e.person?`<div style="font-size:.65rem;color:var(--mut);">👤 ${e.person}</div>`:''}</td>`;

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
        const remDateCell=`<td style="padding:7px 8px;font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--acc);white-space:nowrap;">${trigDisp||'—'}</td>`;

        // 4. EXPIRY / AMOUNT
        const expVal=isRent?fmt(e.bal||0):isLoan?fmt(e._outstanding||e.bal||0):e.exp?fD(e.exp):'—';
        const expLabel=isRent||isLoan?'Amt':'Expiry';
        const expDateCell=`<td style="padding:7px 8px;font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--mut);white-space:nowrap;">${expVal}<div style="font-size:.58rem;opacity:.7;">${expLabel}</div></td>`;

        // 5. DAYS INFO
        const d=e._dTrig;
        const _isCompleted=!!(e.completed||_doneIdsAlert.has(e.id));
        const daysInfo=_isCompleted?'✅ Done':d===null?'—':d<0?`Overdue ${Math.abs(d)}d`:d===0?'Due Today':`${d}d left`;
        const daysColor=_isCompleted?'#166534':d===null||d<0?'var(--red)':d===0?'#e09050':'var(--grn)';
        const daysCell=`<td style="padding:7px 8px;font-size:.72rem;font-weight:700;color:${daysColor};white-space:nowrap;">${daysInfo}</td>`;

        // 6. REMINDER TYPE
        const rType=isRent?'Auto-Rent':isLoan?'Auto-Loan':isMedical?'Follow-up':e.mode==='recurring'?'Recurring':'One-time';
        const typeCell=`<td style="padding:7px 8px;font-size:.65rem;color:var(--mut);white-space:nowrap;">${rType}</td>`;

        // 7. FREQUENCY — use full repeatLabel if available, else fallback
        let freq='Once';
        if(isRent)freq='Monthly';
        else if(isLoan)freq='Once';
        else if(e.mode==='recurring'){
          freq=e.repeatLabel||(e.recurPeriod?({'1':'Daily','7':'Weekly','15':'15d','30':'Monthly','90':'Quarterly','180':'HalfYrly','365':'Yearly'}[e.recurPeriod]||e.recurPeriod+'d'):'Recurring');
        }
        const freqCell=`<td style="padding:7px 8px;font-size:.65rem;color:var(--mut);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${freq}">${freq}</td>`;

        // 8. ALERT BEFORE
        const beforeLabel=isRent||isLoan?'On invoice':e.before?blLabelA[e.before]||e.before+'d':'—';
        const beforeCell=`<td style="padding:7px 8px;font-size:.65rem;color:var(--mut);white-space:nowrap;">${beforeLabel}</td>`;

        // 9. STATUS
        const statusCell=`<td style="padding:7px 8px;white-space:nowrap;"><span style="background:${si.bg};color:${si.tc};padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;">${si.label}</span></td>`;

        const doneCell=`<td style="padding:7px 8px;white-space:nowrap;"><button onclick="event.stopPropagation();APP.markReminderDone('${e.id}')" style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;border-radius:6px;padding:3px 9px;font-size:.68rem;font-weight:800;cursor:pointer;" title="Mark as done">✅</button></td>`;
        return `<tr style="background:${si.rowBg};border-left:3px solid ${borderC};"
          onmouseover="this.style.background='var(--dim)'" onmouseout="this.style.background='${si.rowBg||''}'">
          ${catCell}${nameCell}${remDateCell}${expDateCell}${daysCell}${typeCell}${freqCell}${beforeCell}${statusCell}${doneCell}
        </tr>`;
      }).join('');

      const urgCount=allAlertRows.length;
      const expCount=allAlertRows.filter(e=>e._dTrig!==null&&e._dTrig<0).length;
      const todayCount=allAlertRows.filter(e=>e._dTrig===0).length;

      alerts=`<div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;overflow:hidden;box-shadow:var(--sh);margin-bottom:14px;">
        <div style="background:var(--card2);padding:10px 14px;border-bottom:1.5px solid var(--bdr2);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-family:'Playfair Display',serif;font-size:1rem;font-weight:700;color:var(--acc);">🔔 Alerts Today</span>
            ${expCount>0?`<span style="background:#fcebeb;color:#a32d2d;padding:2px 9px;border-radius:10px;font-size:.7rem;font-weight:700;">🔴 ${expCount} overdue</span>`:''}
            ${todayCount>0?`<span style="background:#fff0cc;color:#854f0b;padding:2px 9px;border-radius:10px;font-size:.7rem;font-weight:700;">🔔 ${todayCount} due today</span>`:''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:.7rem;color:var(--mut);">${urgCount} items</span>
            <button class="btn b-out b-sm" onclick="APP.goTab('reminder')" style="font-size:.7rem;padding:3px 9px;">View All →</button>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;min-width:480px;">
            <thead>
              <tr style="background:var(--card2);border-bottom:1.5px solid var(--bdr2);">
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Category</th>
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Name</th>
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Reminder Date</th>
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Expiry/Amt</th>
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Days</th>
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Type</th>
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Freq</th>
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Before</th>
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Status</th>
                <th style="padding:6px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">Done</th>
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
        <div class="card" style="border-color:#90b8e8;">
          <div class="card-hdr" style="background:#f0f7ff;"><div class="card-title" style="color:var(--blu)">📅 Calendar</div><button class="btn b-sm" style="background:#1760a0;color:#fff;border:none;" onclick="APP.goTab('calendar')">Open Full</button></div>
          <div class="card-body" style="font-size:.82rem;">
            ${(()=>{const evs=[];const now2=new Date();
              allReminderEntries.filter(r=>r._dTrig!==null&&r._dTrig>=0&&r._dTrig<=7&&r._src==='reminder').slice(0,2).forEach(r=>evs.push(`<div style="padding:4px 0;border-bottom:1px solid var(--bdr);"><span class="badge br" style="font-size:.62rem">Rem</span> ${r.name} — ${fD(r._trig)}</div>`));
              this.visits.filter(r=>r.next&&this._dFromNow(r.next.includes('-')?r.next:dmyToIso(r.next))>=0&&this._dFromNow(r.next.includes('-')?r.next:dmyToIso(r.next))<=14).slice(0,2).forEach(r=>{const p=this.patients.find(x=>x.id===r.patId);evs.push(`<div style="padding:4px 0;border-bottom:1px solid var(--bdr);"><span class="badge bb" style="font-size:.62rem">Dr</span> ${p?p.name:'?'} — ${fD(r.next)}</div>`);});
              this.trips.filter(t=>new Date(t.dep)>=now2).slice(0,2).forEach(t=>evs.push(`<div style="padding:4px 0;border-bottom:1px solid var(--bdr);"><span class="badge bt" style="font-size:.62rem">Trip</span> ${t.dest} — ${fD(t.dep)}</div>`));
              return evs.length?evs.join(''):'<div style="color:var(--mut);padding:8px 0;">No upcoming events</div>';
            })()}
          </div>
        </div>
        <div class="card" style="border-color:#90c8a0;">
          <div class="card-hdr" style="background:#f0faf5;"><div class="card-title" style="color:var(--grn)">✅ To Do List</div><button class="btn b-sm" style="background:#1e7a45;color:#fff;border:none;" onclick="APP.goTab('todo')">Open Full</button></div>
          <div class="card-body" style="padding:10px 12px;">
            ${_renderTodoWidget()}
          </div>
        </div>
        <div>${this.renderNotepad()}</div>
      </div>`;
  },


// ── Flush the guard proxy once real APP is ready ──────────────────
if (typeof window._APP_FLUSH === 'function') {
  window._APP_FLUSH(APP);
}

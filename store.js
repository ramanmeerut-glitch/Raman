const APP={
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
      var bDays = parseInt(r.beforeDays||0) || 0;
      if(!bDays && r.before) bDays = Math.max(0, Math.round(parseInt(r.before||0)/1440));
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
      // For overdue check: use dueDate (trigDate), not alertDate
      const _dueDateStr = r.trigDate || r.exp || '';
      const dDue = _dueDateStr ? this._dFromNow(_dueDateStr) : dTrig;
      const entry={...r,_trig:trig,_dTrig:dTrig,_dDue:dDue};
      if(dTrig===null)             cats.upcoming.push(entry);
      // Overdue = alert date passed AND due date also passed
      else if(dTrig<0 && (dDue===null||dDue<0)) cats.overdue.push(entry);
      else if(dTrig<0 && dDue!==null&&dDue>=0)  cats.today.push(entry); // alert fired, not yet due
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
          // Show Due date (trigDate) in table; alert date shown separately
          var _tDue = e.trigDate || e.exp || '';
          var _tAlert = e._trig || '';
          var _tBDays = parseInt(e.beforeDays||0) || (e.before?Math.round(parseInt(e.before||0)/1440):0);
          if(_tDue && _tAlert && _tAlert !== _tDue && _tBDays > 0){
            trigDisp = fD(_tDue)+'<div style="font-size:.58rem;color:#1565c0;">🔔 '+fD(_tAlert)+'</div>';
          } else {
            trigDisp = fD(_tDue || _tAlert) || '—';
          }
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
        // beforeDays = days before (int); before = minutes (legacy)
        var _bDaysDisp = parseInt(e.beforeDays||0) || (e.before?Math.round(parseInt(e.before||0)/1440):0);
        const beforeLabel=isRent||isLoan?'On invoice':_bDaysDisp>0?(_bDaysDisp===1?'1 day before':_bDaysDisp+' days before'):(e.beforeLabel||'—');
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
  openPropModal(id){
    // Use DEDICATED prop state vars — never share with this.editId (used by tenant/other modals)
    this._propEditId  = id || null;
    this._propDraftId = null;

    if(!id){
      // NEW property: create draft in storage immediately so entries have a place to save
      this._propDraftId = uid();
      const draft = {
        id:this._propDraftId, _draft:true,
        name:'', city:'', type:'', purchaseFrom:'', cost:'0',
        date:'', area:'', mkt:'', loan:'', notes:'',
        propFiles:[], ledger:[]
      };
      const ps = this.props; ps.push(draft); S.set('props', ps);
    }

    document.getElementById('propMT').textContent = id ? '✏️ Edit Property' : '🏢 Add Property';

    // Init date pickers
    const dw = document.getElementById('prm_date_wrap');
    if(dw) dw.innerHTML = makeDateInput('prm_date','');
    const ldw = document.getElementById('prm_led_date_wrap');
    if(ldw) ldw.innerHTML = makeDateInput('prm_led_date','');

    // Clear validation errors
    ['prm_name_err','prm_type_err'].forEach(eid=>{const el=document.getElementById(eid);if(el)el.style.display='none';});
    ['prm_name','prm_type'].forEach(eid=>{const el=document.getElementById(eid);if(el)el.style.borderColor='var(--bdr2)';});

    const workingId = id || this._propDraftId;
    const p = this.props.find(x=>x.id===workingId);

    if(id && p){
      ['name','city','area','mkt','loan','notes'].forEach(f=>{try{sv('prm_'+f,p[f]||'');}catch(e){}});
      const typeEl=document.getElementById('prm_type'); if(typeEl) typeEl.value=p.type||'';
      const fromEl=document.getElementById('prm_from'); if(fromEl) fromEl.value=p.purchaseFrom||'';
      if(p.date) svDate('prm_date',p.date);
      const ledger = Array.isArray(p.ledger) ? p.ledger : [];
      const ledgerTotal = ledger.reduce((s,e)=>s+Number(e.amount||0),0);
      const costEl=document.getElementById('prm_cost');
      if(costEl) costEl.value = ledgerTotal>0 ? ledgerTotal : (p.cost||'');
    } else {
      ['name','city','area','mkt','loan','notes'].forEach(f=>{try{sv('prm_'+f,'');}catch(e){}});
      const typeEl=document.getElementById('prm_type'); if(typeEl) typeEl.value='';
      const fromEl=document.getElementById('prm_from'); if(fromEl) fromEl.value='';
      const costEl=document.getElementById('prm_cost'); if(costEl) costEl.value='';
    }

    // Reset ledger entry form
    ['prm_led_amount','prm_led_ref','prm_led_purpose','prm_led_notes'].forEach(fid=>{
      const el=document.getElementById(fid); if(el) el.value='';
    });
    const modeEl=document.getElementById('prm_led_mode'); if(modeEl) modeEl.value='Cheque';
    const paidEl=document.getElementById('prm_led_paidto'); if(paidEl) paidEl.value='Builder';
    const srcEl=document.getElementById('prm_led_source'); if(srcEl) srcEl.value='Own';

    this._renderLedgerList();

    if(window.FUM){
      FUM.clear('fu_prop_doc_wrap');
      FUM.init('fu_prop_doc_wrap','property-docs',[]);
      if(id && p && p.propFiles && p.propFiles.length) FUM.init('fu_prop_doc_wrap','property-docs',p.propFiles);
    }
    M.open('propM');
  },
    saveProp(){
    const name = v('prm_name');
    const type = v('prm_type');

    let hasErr = false;
    const nameErr=document.getElementById('prm_name_err'), nameEl=document.getElementById('prm_name');
    const typeErr=document.getElementById('prm_type_err'), typeEl=document.getElementById('prm_type');
    if(!name.trim()){ if(nameErr)nameErr.style.display='block'; if(nameEl)nameEl.style.borderColor='#e53935'; hasErr=true; }
    else { if(nameErr)nameErr.style.display='none'; if(nameEl)nameEl.style.borderColor='var(--bdr2)'; }
    if(!type){ if(typeErr)typeErr.style.display='block'; if(typeEl)typeEl.style.borderColor='#e53935'; hasErr=true; }
    else { if(typeErr)typeErr.style.display='none'; if(typeEl)typeEl.style.borderColor='var(--bdr2)'; }
    if(hasErr){ this.showToastMsg('⚠️ Required fields fill karein!'); return; }

    // Use DEDICATED prop state (not shared this.editId)
    const workingId = this._propEditId || this._propDraftId;
    const existingProp = this.props.find(p=>p.id===workingId) || {};

    // Preserve ledger from storage (already saved by each Add click)
    const _ledger = Array.isArray(existingProp.ledger) ? existingProp.ledger : [];
    const _ledgerTotal = _ledger.reduce((s,e)=>s+Number(e.amount||0),0);
    const _computedCost = _ledgerTotal>0 ? String(_ledgerTotal) : (v('prm_cost')||'');

    const _propFiles=(window.FUM&&FUM.getFiles)?FUM.getFiles('fu_prop_doc_wrap'):[];
    const _finalPropFiles = _propFiles.length>0 ? _propFiles : (existingProp.propFiles||[]);

    const formData = {
      name,
      city:         v('prm_city')||'',
      type,
      purchaseFrom: (()=>{const el=document.getElementById('prm_from');return el?el.value:''})(),
      cost:         _computedCost,
      date:         vDate('prm_date')||'',
      area:         v('prm_area')||'',
      mkt:          v('prm_mkt')||'',
      loan:         v('prm_loan')||'',
      notes:        v('prm_notes')||'',
      propFiles:    _finalPropFiles,
      ledger:       _ledger,
      _draft:       false
    };

    let ps = this.props;
    const isEdit = !!this._propEditId;
    if(isEdit){
      ps = ps.map(p => p.id===this._propEditId ? {...p, ...formData} : p);
    } else {
      const draftId = this._propDraftId;
      ps = ps.map(p => p.id===draftId ? {...p, ...formData} : p);
      this.curProp = draftId;
      this._propDraftId = null;
    }
    S.set('props', ps);
    M.close('propM');
    this.renderProperty();
    this.renderPills();
    this.showToastMsg(isEdit ? '✅ Property updated!' : '✅ Property added!');
  },

  // ══════════════════════════════════════════════════════
  // BUILDER PAYMENT LEDGER — ENTRY HELPERS
  // ══════════════════════════════════════════════════════
  _addLedgerEntry(){
    // Use dedicated prop state — never this.editId (shared with other modals)
    const workingId = this._propEditId || this._propDraftId;
    if(!workingId){ this.showToastMsg('⚠️ Property ID missing — reopen modal'); return; }

    const amtEl = document.getElementById('prm_led_amount');
    const amt = parseFloat(amtEl ? amtEl.value : 0) || 0;
    const purposeEl = document.getElementById('prm_led_purpose');
    const purpose = (purposeEl ? purposeEl.value : '').trim();
    if(!amt){
      if(amtEl){amtEl.style.borderColor='#e53935';amtEl.focus();}
      this.showToastMsg('⚠️ Amount required!'); return;
    }

    // Parse date DD/MM/YYYY → YYYY-MM-DD
    const dateEl = document.getElementById('prm_led_date');
    const rawDate = dateEl ? dateEl.value.trim() : '';
    let isoDate = '';
    if(rawDate){
      if(/^\d{4}-\d{2}-\d{2}$/.test(rawDate)){
        isoDate = rawDate;
      } else {
        const pts = rawDate.split(/[\/\-]/);
        if(pts.length===3){
          isoDate = pts[2].length===4 ? pts[2]+'-'+pts[1]+'-'+pts[0] : rawDate;
        }
      }
    }

    const gv = id => { const el=document.getElementById(id); return el ? el.value.trim() : ''; };
    const entry = {
      id: uid(),
      date: isoDate,
      amount: amt,
      paidTo: gv('prm_led_paidto') || 'Builder',
      purpose: purpose,
      mode: gv('prm_led_mode') || 'Cheque',
      reference: gv('prm_led_ref'),
      source: gv('prm_led_source') || 'Own',
      notes: gv('prm_led_notes')
    };

    // Save DIRECTLY to props in storage — no temp buffer
    let ps = this.props;
    let found = false;
    ps = ps.map(p => {
      if(p.id !== workingId) return p;
      found = true;
      const existing = Array.isArray(p.ledger) ? p.ledger : [];
      const newLedger = [...existing, entry];
      const newCost = newLedger.reduce((s,e) => s + Number(e.amount||0), 0);
      return {...p, ledger: newLedger, cost: String(newCost)};
    });
    if(!found){ this.showToastMsg('⚠️ Property not found in storage!'); return; }
    S.set('props', ps);

    // Clear form
    ['prm_led_amount','prm_led_ref','prm_led_purpose','prm_led_notes'].forEach(fid=>{
      const el=document.getElementById(fid); if(el) el.value='';
    });
    const ldw=document.getElementById('prm_led_date_wrap');
    if(ldw) ldw.innerHTML=makeDateInput('prm_led_date','');

    // Update cost display
    const saved = this.props.find(p=>p.id===workingId);
    const newTotal = saved ? (saved.ledger||[]).reduce((s,e)=>s+Number(e.amount||0),0) : 0;
    const costEl = document.getElementById('prm_cost');
    if(costEl) costEl.value = newTotal || '';

    this._renderLedgerList();
    this.showToastMsg('✅ Payment saved! ('+((saved&&saved.ledger)||[]).length+' entries total)');
  },

    _renderLedgerList(){
    const list = document.getElementById('prm_ledger_list');
    const totEl = document.getElementById('prm_ledger_total');
    if(!list) return;

    // Read from storage using dedicated prop state
    const workingId = this._propEditId || this._propDraftId;
    const prop = workingId ? this.props.find(p=>p.id===workingId) : null;
    const entries = (prop && Array.isArray(prop.ledger)) ? prop.ledger : [];

    if(!entries.length){
      list.innerHTML = '<div style="color:var(--mut);font-size:.75rem;text-align:center;padding:12px 0;">No entries yet — fill form above and click Add</div>';
      if(totEl) totEl.style.display='none';
      return;
    }
    const fmt2 = window.fmt || (n=>Number(n).toLocaleString('en-IN'));
    const total = entries.reduce((s,e)=>s+Number(e.amount||0),0);

    list.innerHTML = entries.map((e,i) => {
      const bg = i%2===0 ? 'var(--surf)' : 'var(--bg)';
      const srcClr = e.source==='Loan' ? '#c0392b' : '#1a7a45';
      const dateStr = e.date ? fD(e.date) : '—';
      const refStr = e.reference ? ' · '+e.reference : '';
      const notesStr = e.notes ? '<br><span style="color:var(--mut);">'+e.notes+'</span>' : '';
      return '<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 9px;background:'+bg+';border-radius:7px;margin-bottom:4px;border:1px solid var(--bdr);">'
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:.78rem;font-weight:800;color:var(--txt);">'+e.purpose+'</div>'
        +'<div style="font-size:.68rem;color:var(--mut);margin-top:1px;">'+dateStr+' · '+e.paidTo+' · '+e.mode+refStr+' · <span style="color:'+srcClr+';font-weight:700;">'+e.source+'</span>'+notesStr+'</div>'
        +'</div>'
        +'<div style="text-align:right;flex-shrink:0;">'
        +'<div style="font-size:.82rem;font-weight:900;color:var(--acc);font-family:JetBrains Mono,monospace;">'+fmt2(e.amount)+'</div>'
        +'<button onclick="APP._deleteLedgerEntry(\''+e.id+'\')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.7rem;margin-top:2px;font-family:Nunito,sans-serif;padding:0;">Delete</button>'
        +'</div>'
        +'</div>';
    }).join('');

    if(totEl){
      totEl.style.display='block';
      totEl.innerHTML = 'Total Investment: <b style="color:var(--grn);font-family:JetBrains Mono,monospace;">'+fmt2(total)+'</b> ('+entries.length+' entries)';
    }
  },

    _deleteLedgerEntry(entryId){
    const workingId = this._propEditId || this._propDraftId;
    if(!workingId) return;
    let ps = this.props;
    ps = ps.map(p => {
      if(p.id !== workingId) return p;
      const newLedger = (Array.isArray(p.ledger)?p.ledger:[]).filter(e=>e.id!==entryId);
      const newCost = newLedger.reduce((s,e)=>s+Number(e.amount||0),0);
      return {...p, ledger:newLedger, cost:String(newCost)};
    });
    S.set('props', ps);
    const saved = this.props.find(p=>p.id===workingId);
    const newTotal = saved ? (saved.ledger||[]).reduce((s,e)=>s+Number(e.amount||0),0) : 0;
    const costEl = document.getElementById('prm_cost');
    if(costEl) costEl.value = newTotal || '';
    this._renderLedgerList();
    this.showToastMsg('Entry deleted');
  },

    _getPropLedger(p){
    // Returns ledger array; backward compat: if no ledger but cost exists, synthesise one entry
    if(p.ledger && Array.isArray(p.ledger) && p.ledger.length) return p.ledger;
    if(p.cost && Number(p.cost)>0) return [{id:'legacy',date:p.date||'',amount:Number(p.cost)||0,paidTo:'Builder',purpose:'Purchase Cost',mode:'—',reference:'',source:'Own',notes:'Migrated from old record'}];
    return [];
  },

  openPropLedgerModal(propId){
    try {
    const p=this.props.find(x=>x.id===propId);
    if(!p){ console.warn('[openPropLedgerModal] Property not found:', propId); return; }
    const entries=this._getPropLedger(p);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const total=entries.reduce((s,e)=>s+Number(e.amount||0),0);
    const ownTotal=entries.filter(e=>e.source==='Own').reduce((s,e)=>s+Number(e.amount||0),0);
    const loanTotal=entries.filter(e=>e.source==='Loan').reduce((s,e)=>s+Number(e.amount||0),0);

    const rows=entries.map((e,i)=>`
      <tr style="background:${i%2===0?'#fff':'#f8f9fa'};">
        <td style="padding:6px 8px;font-size:.75rem;color:#555;">${e.date?fD(e.date):'—'}</td>
        <td style="padding:6px 8px;font-size:.78rem;font-weight:700;">${e.purpose}</td>
        <td style="padding:6px 8px;font-size:.75rem;">${e.paidTo}</td>
        <td style="padding:6px 8px;font-size:.75rem;font-family:monospace;font-weight:800;color:#1a7a45;">₹${fmt2(e.amount)}</td>
        <td style="padding:6px 8px;font-size:.72rem;">${e.mode}</td>
        <td style="padding:6px 8px;font-size:.72rem;color:${e.source==='Loan'?'#c0392b':'#1a7a45'};font-weight:700;">${e.source}</td>
        <td style="padding:6px 8px;font-size:.68rem;color:#666;">${e.reference||'—'}</td>
        <td style="padding:6px 8px;font-size:.68rem;color:#888;">${e.notes||'—'}</td>
      </tr>`).join('');

    const html=`<div style="font-size:.75rem;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <div style="background:#f0faf5;border:1.5px solid #90c8a0;border-radius:8px;padding:8px 14px;text-align:center;"><div style="font-size:.62rem;font-weight:800;color:#1a7a45;text-transform:uppercase;">Total Invested</div><div style="font-size:1rem;font-weight:900;color:#1a7a45;font-family:JetBrains Mono,monospace;">₹${fmt2(total)}</div></div>
      <div style="background:#f0f7ff;border:1.5px solid #90b8e8;border-radius:8px;padding:8px 14px;text-align:center;"><div style="font-size:.62rem;font-weight:800;color:#1565c0;text-transform:uppercase;">Own Funds</div><div style="font-size:1rem;font-weight:900;color:#1565c0;font-family:JetBrains Mono,monospace;">₹${fmt2(ownTotal)}</div></div>
      <div style="background:#fff3f3;border:1.5px solid #f4c2b8;border-radius:8px;padding:8px 14px;text-align:center;"><div style="font-size:.62rem;font-weight:800;color:#c0392b;text-transform:uppercase;">Loan</div><div style="font-size:1rem;font-weight:900;color:#c0392b;font-family:JetBrains Mono,monospace;">₹${fmt2(loanTotal)}</div></div>
      <div style="background:#fff8ee;border:1.5px solid #ffcc80;border-radius:8px;padding:8px 14px;text-align:center;"><div style="font-size:.62rem;font-weight:800;color:#b56a00;text-transform:uppercase;">Entries</div><div style="font-size:1rem;font-weight:900;color:#b56a00;">${entries.length}</div></div>
    </div>
    <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.78rem;">
      <thead><tr style="background:#2c6fad;color:#fff;">
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;white-space:nowrap;">Date</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Purpose</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Paid To</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Amount</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Mode</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Source</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Reference</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Notes</th>
      </tr></thead>
      <tbody>${rows||'<tr><td colspan="8" style="text-align:center;padding:12px;color:#888;">No ledger entries</td></tr>'}</tbody>
    </table></div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
      <button onclick="APP._propLedgerPDF('${propId}')" style="background:#e53935;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-family:Nunito,sans-serif;font-size:.78rem;font-weight:800;cursor:pointer;">📄 PDF</button>${APP._pdfOriHtml()}
      <button onclick="APP._propLedgerWord('${propId}')" style="background:#1565c0;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-family:Nunito,sans-serif;font-size:.78rem;font-weight:800;cursor:pointer;">📝 Word</button>
      <button onclick="APP._propLedgerCSV('${propId}')" style="background:#2e7d32;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-family:Nunito,sans-serif;font-size:.78rem;font-weight:800;cursor:pointer;">📊 Excel/CSV</button>
      <button onclick="document.getElementById('propLedgerM').remove();APP.openAddPaymentModal('${propId}')" style="background:#1a7a45;color:#fff;border:none;border-radius:7px;padding:7px 14px;font-family:Nunito,sans-serif;font-size:.78rem;font-weight:800;cursor:pointer;">💰 + Add Payment</button>
    </div>`;

    // Reuse existing generic modal (eiM or create inline)
    const existing=document.getElementById('propLedgerM');
    if(existing) existing.remove();
    const overlay=document.createElement('div');
    overlay.className='overlay';overlay.id='propLedgerM';overlay.style.cssText='display:flex;';
    overlay.innerHTML=`<div class="modal" style="max-width:760px;max-height:90vh;overflow-y:auto;">
      <h2 style="margin-bottom:12px;">🏗️ Builder Payment Ledger — ${p.name}</h2>
      ${html}
      <div class="modal-foot" style="margin-top:12px;"><button class="btn b-out" onclick="document.getElementById('propLedgerM').remove()">Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
    } catch(err){ console.error('[openPropLedgerModal] Error:', err); alert('Error opening ledger: '+err.message); }
  },

  // ── EXPORT: Builder Ledger PDF ──
  _propLedgerPDF(propId){
    const p=this.props.find(x=>x.id===propId);if(!p)return;
    const entries=this._getPropLedger(p);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const total=entries.reduce((s,e)=>s+Number(e.amount||0),0);
    const ownTotal=entries.filter(e=>e.source==='Own').reduce((s,e)=>s+Number(e.amount||0),0);
    const loanTotal=entries.filter(e=>e.source==='Loan').reduce((s,e)=>s+Number(e.amount||0),0);
    const title=p.name+' — Builder Payment Ledger';
    const cols=['Date','Purpose','Paid To','Amount (₹)','Mode','Source','Reference','Notes'];
    const pdfRows=entries.map(e=>[
      e.date?fD(e.date):'—', e.purpose, e.paidTo,
      'Rs.'+fmt2(e.amount), e.mode, e.source,
      e.reference||'—', e.notes||'—'
    ]);
    if(typeof _makePDF==='function'){
      _makePDF({
        filename:'Builder_Ledger_'+p.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf',
        title, subtitle:'Property: '+p.name+(p.purchaseFrom?' | Purchased From: '+p.purchaseFrom:'')+' | Generated: '+fD(new Date().toISOString().slice(0,10)),
        summaryRows:[
          ['Total Invested','Rs.'+fmt2(total),[26,122,69]],
          ['Own Funds','Rs.'+fmt2(ownTotal),[21,101,192]],
          ['Loan','Rs.'+fmt2(loanTotal),[192,57,43]],
          ['Entries',String(entries.length),[44,111,173]],
        ],
        entriesLabel:'Entries: '+entries.length,
        columns:cols, rows:pdfRows, colStyles:{3:{halign:'right'}},
        headerColor:[44,111,173],
      });
    } else {
      // Fallback: HTML print
      const tableRows=entries.map(e=>`<tr><td>${e.date?fD(e.date):'—'}</td><td><b>${e.purpose}</b></td><td>${e.paidTo}</td><td style="font-family:monospace;color:#1a7a45;font-weight:bold;">₹${fmt2(e.amount)}</td><td>${e.mode}</td><td style="color:${e.source==='Loan'?'#c0392b':'#1a7a45'};font-weight:bold;">${e.source}</td><td>${e.reference||'—'}</td><td>${e.notes||'—'}</td></tr>`).join('');
      const html2=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:16mm 14mm;}h1{color:#2c6fad;}table{width:100%;border-collapse:collapse;}th{background:#2c6fad;color:#fff;padding:5px 7px;text-align:left;}td{padding:4px 7px;border-bottom:1px solid #eee;}tr:nth-child(even){background:#fafafa;}</style></head><body><h1>${title}</h1><p>Generated: ${todayDMY()}</p><p><b>Total: ₹${fmt2(total)}</b> | Own: ₹${fmt2(ownTotal)} | Loan: ₹${fmt2(loanTotal)} | Entries: ${entries.length}</p><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
      const w=window.open('','_blank','width=900,height=650');if(w){w.document.write(html2);w.document.close();setTimeout(()=>w.print(),600);}
    }
    this.showToastMsg('✅ PDF generating...');
  },

  // ── EXPORT: Builder Ledger Word ──
  _propLedgerWord(propId){
    const p=this.props.find(x=>x.id===propId);if(!p)return;
    const entries=this._getPropLedger(p);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const total=entries.reduce((s,e)=>s+Number(e.amount||0),0);
    const ownTotal=entries.filter(e=>e.source==='Own').reduce((s,e)=>s+Number(e.amount||0),0);
    const loanTotal=entries.filter(e=>e.source==='Loan').reduce((s,e)=>s+Number(e.amount||0),0);
    const title=p.name+' — Builder Payment Ledger';
    const tableRows=entries.map(e=>`<w:tr><w:tc><w:p><w:r><w:t>${e.date?fD(e.date):'—'}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${(e.purpose||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${e.paidTo}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:color w:val="1a7a45"/><w:b/></w:rPr><w:t>Rs.${fmt2(e.amount)}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${e.mode}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:color w:val="${e.source==='Loan'?'c0392b':'1a7a45'}"/></w:rPr><w:t>${e.source}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${(e.reference||'—').replace(/&/g,'&amp;')}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${(e.notes||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</w:t></w:r></w:p></w:tc></w:tr>`).join('');
    const hdrCells=['Date','Purpose','Paid To','Amount','Mode','Source','Reference','Notes'].map(h=>`<w:tc><w:tcPr><w:shd w:fill="2C6FAD" w:color="2C6FAD"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="18"/></w:rPr><w:t>${h}</w:t></w:r></w:p></w:tc>`).join('');
    const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><?mso-application progid="Word.Document"?><w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2C6FAD"/></w:rPr><w:t>🏗️ ${title}</w:t></w:r></w:p><w:p><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} | Total: Rs.${fmt2(total)} | Own: Rs.${fmt2(ownTotal)} | Loan: Rs.${fmt2(loanTotal)} | Entries: ${entries.length}</w:t></w:r></w:p><w:p></w:p><w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tr>${hdrCells}</w:tr>${tableRows}</w:tbl><w:p></w:p><w:p><w:r><w:rPr><w:b/><w:color w:val="1a7a45"/></w:rPr><w:t>Total Investment: Rs.${fmt2(total)}</w:t></w:r></w:p></w:body></w:wordDocument>`;
    const blob=new Blob([xml],{type:'application/msword'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='Builder_Ledger_'+p.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ Word document downloaded!');
  },

  // ── EXPORT: Builder Ledger CSV/Excel ──
  _propLedgerCSV(propId){
    const p=this.props.find(x=>x.id===propId);if(!p)return;
    const entries=this._getPropLedger(p);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const total=entries.reduce((s,e)=>s+Number(e.amount||0),0);
    const headers=['Date','Purpose','Paid To','Amount','Mode','Source','Reference','Notes'];
    const rows=entries.map(e=>[
      e.date?fD(e.date):'',
      '"'+(e.purpose||'').replace(/"/g,"'")+'"',
      e.paidTo, e.amount, e.mode, e.source,
      '"'+(e.reference||'').replace(/"/g,"'")+'"',
      '"'+(e.notes||'').replace(/"/g,"'")+'"'
    ]);
    rows.push(['','TOTAL','',''+total,'','','','']);
    rows.push(['Property',p.name,'Purchase From',p.purchaseFrom||'—','City',p.city||'—','','']);
    const csv=[headers, ...rows].map(r=>r.join(',')).join('\n');
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='Builder_Ledger_'+p.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ CSV/Excel downloaded!');
  },

  // ══ DEDICATED ADD PAYMENT MODAL ══
  // Opens a focused modal JUST for adding builder payments — no property form distraction
  openAddPaymentModal(propId){
    const self = this;
    const p = self.props.find(x=>x.id===propId);
    if(!p){ self.showToastMsg('Property not found!'); return; }

    // Remove any existing modal
    const old = document.getElementById('addPayM');
    if(old) old.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'addPayM';
    overlay.style.cssText = 'display:flex;z-index:1000;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);align-items:center;justify-content:center;';

    // Create modal box
    const box = document.createElement('div');
    box.className = 'modal';
    box.style.cssText = 'max-width:600px;width:95%;max-height:92vh;overflow-y:auto;background:#fff;border-radius:14px;padding:20px;position:relative;';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Close on backdrop
    overlay.addEventListener('click', function(ev){ if(ev.target===overlay) overlay.remove(); });

    // Render function — called on open and after every save/delete
    function render(){
      const prop = self.props.find(x=>x.id===propId);
      if(!prop){ overlay.remove(); return; }
      const fmt2 = window.fmt || (n=>Number(n).toLocaleString('en-IN'));
      const ledger = Array.isArray(prop.ledger) ? prop.ledger : [];
      const total  = ledger.reduce((s,e)=>s+Number(e.amount||0),0);
      const ownT   = ledger.filter(e=>e.source==='Own').reduce((s,e)=>s+Number(e.amount||0),0);
      const loanT  = ledger.filter(e=>e.source==='Loan').reduce((s,e)=>s+Number(e.amount||0),0);

      box.innerHTML =
        '<h2 style="margin:0 0 4px;font-size:1.05rem;">&#128176; Builder Payments</h2>'
        +'<div style="font-size:.75rem;color:var(--mut);margin-bottom:12px;">Property: <b>'+prop.name+'</b></div>'

        // Summary
        +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px;background:#f0f7ff;border-radius:9px;border:1.5px solid #90b8e8;">'
        +'<div style="flex:1;text-align:center;"><div style="font-size:.6rem;font-weight:800;color:#2c6fad;text-transform:uppercase;">Total Paid</div>'
        +'<div style="font-size:1.1rem;font-weight:900;color:#1a7a45;font-family:monospace;">'+fmt2(total)+'</div></div>'
        +'<div style="flex:1;text-align:center;"><div style="font-size:.6rem;font-weight:800;color:#1a7a45;text-transform:uppercase;">Own Funds</div>'
        +'<div style="font-size:1.1rem;font-weight:900;color:#1a7a45;font-family:monospace;">'+fmt2(ownT)+'</div></div>'
        +'<div style="flex:1;text-align:center;"><div style="font-size:.6rem;font-weight:800;color:#c0392b;text-transform:uppercase;">Loan</div>'
        +'<div style="font-size:1.1rem;font-weight:900;color:#c0392b;font-family:monospace;">'+fmt2(loanT)+'</div></div>'
        +'<div style="flex:1;text-align:center;"><div style="font-size:.6rem;font-weight:800;color:#b56a00;text-transform:uppercase;">Entries</div>'
        +'<div style="font-size:1.1rem;font-weight:900;color:#b56a00;">'+ledger.length+'</div></div>'
        +'</div>'

        // Form
        +'<div style="background:var(--bg);border:1.5px solid var(--bdr2);border-radius:9px;padding:12px;margin-bottom:14px;">'
        +'<div style="font-size:.78rem;font-weight:800;color:var(--acc);margin-bottom:8px;">&#10133; Add New Payment</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
        +'<div><div style="font-size:.68rem;font-weight:700;color:var(--mut);margin-bottom:2px;">&#128197; Date</div><div id="apm_date_wrap"></div></div>'
        +'<div><div style="font-size:.68rem;font-weight:700;color:var(--mut);margin-bottom:2px;">&#128181; Amount (&#8377;) *</div>'
        +'<input id="apm_amount" type="number" placeholder="e.g. 500000" style="width:100%;padding:7px 9px;border:1.5px solid var(--bdr2);border-radius:7px;font-family:Nunito,sans-serif;font-size:.85rem;outline:none;"></div>'
        +'<div><div style="font-size:.68rem;font-weight:700;color:var(--mut);margin-bottom:2px;">&#127963;&#65039; Paid To</div>'
        +'<select id="apm_paidto" style="width:100%;padding:7px 9px;border:1.5px solid var(--bdr2);border-radius:7px;font-family:Nunito,sans-serif;font-size:.83rem;outline:none;">'
        +'<option value="Builder">Builder</option>'
        +'<option value="Govt / Registry">Govt / Registry</option>'
        +'<option value="Lawyer">Lawyer</option>'
        +'<option value="Bank">Bank</option>'
        +'<option value="Broker">Broker</option>'
        +'<option value="RWA">RWA</option>'
        +'<option value="Other">Other</option>'
        +'</select></div>'
        +'<div><div style="font-size:.68rem;font-weight:700;color:var(--mut);margin-bottom:2px;">&#128179; Mode</div>'
        +'<select id="apm_mode" style="width:100%;padding:7px 9px;border:1.5px solid var(--bdr2);border-radius:7px;font-family:Nunito,sans-serif;font-size:.83rem;outline:none;">'
        +'<option value="Cheque">Cheque</option>'
        +'<option value="NEFT / RTGS">NEFT / RTGS</option>'
        +'<option value="UPI">UPI</option>'
        +'<option value="Cash">Cash</option>'
        +'<option value="DD">Demand Draft</option>'
        +'<option value="Bank Transfer">Bank Transfer</option>'
        +'</select></div>'
        +'<div><div style="font-size:.68rem;font-weight:700;color:var(--mut);margin-bottom:2px;">&#128176; Source</div>'
        +'<select id="apm_source" style="width:100%;padding:7px 9px;border:1.5px solid var(--bdr2);border-radius:7px;font-family:Nunito,sans-serif;font-size:.83rem;outline:none;">'
        +'<option value="Own">Own Funds</option>'
        +'<option value="Loan">Home Loan</option>'
        +'<option value="Mixed">Mixed</option>'
        +'</select></div>'
        +'<div><div style="font-size:.68rem;font-weight:700;color:var(--mut);margin-bottom:2px;">&#128278; Ref No</div>'
        +'<input id="apm_ref" placeholder="Cheque / Txn No (optional)" style="width:100%;padding:7px 9px;border:1.5px solid var(--bdr2);border-radius:7px;font-family:Nunito,sans-serif;font-size:.83rem;outline:none;"></div>'
        +'</div>'
        +'<div style="margin-top:8px;"><div style="font-size:.68rem;font-weight:700;color:var(--mut);margin-bottom:2px;">&#128221; Purpose / Description *</div>'
        +'<input id="apm_purpose" placeholder="e.g. Down Payment, Installment-2, Stamp Duty, Registry" style="width:100%;padding:7px 9px;border:1.5px solid var(--bdr2);border-radius:7px;font-family:Nunito,sans-serif;font-size:.85rem;outline:none;"></div>'
        +'<div style="margin-top:6px;"><div style="font-size:.68rem;font-weight:700;color:var(--mut);margin-bottom:2px;">&#128221; Notes</div>'
        +'<input id="apm_notes" placeholder="Optional extra info" style="width:100%;padding:7px 9px;border:1.5px solid var(--bdr2);border-radius:7px;font-family:Nunito,sans-serif;font-size:.83rem;outline:none;"></div>'
        +'<button id="apm_save_btn" style="margin-top:10px;width:100%;background:#1a7a45;color:#fff;border:none;border-radius:8px;padding:10px 14px;font-family:Nunito,sans-serif;font-size:.9rem;font-weight:800;cursor:pointer;touch-action:manipulation;letter-spacing:.01em;">'
        +'&#128190; Save Payment Entry</button>'
        +'</div>'

        // Entries table
        +'<div style="font-size:.78rem;font-weight:800;color:var(--txt);margin-bottom:6px;">&#128203; Payment History</div>'
        +'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.78rem;">'
        +'<thead><tr style="background:#2c6fad;color:#fff;">'
        +'<th style="padding:6px 8px;text-align:left;font-size:.68rem;">Date</th>'
        +'<th style="padding:6px 8px;text-align:left;font-size:.68rem;">Purpose</th>'
        +'<th style="padding:6px 8px;text-align:left;font-size:.68rem;">Paid To</th>'
        +'<th style="padding:6px 8px;text-align:right;font-size:.68rem;">Amount</th>'
        +'<th style="padding:6px 8px;text-align:left;font-size:.68rem;">Mode</th>'
        +'<th style="padding:6px 8px;text-align:left;font-size:.68rem;">Source</th>'
        +'<th style="padding:6px 8px;font-size:.68rem;"></th>'
        +'</tr></thead><tbody id="apm_tbody">'
        +(ledger.length
          ? ledger.map(function(e,i){
              return '<tr style="background:'+(i%2===0?'#fff':'#f8f9fa')+'">'
                +'<td style="padding:5px 8px;font-size:.72rem;color:#555">'+(e.date?fD(e.date):'—')+'</td>'
                +'<td style="padding:5px 8px;font-size:.74rem;font-weight:700">'+(e.purpose||'—')+'</td>'
                +'<td style="padding:5px 8px;font-size:.72rem">'+(e.paidTo||'—')+'</td>'
                +'<td style="padding:5px 8px;font-size:.74rem;font-weight:800;color:#1a7a45;font-family:monospace;text-align:right">'+fmt2(e.amount)+'</td>'
                +'<td style="padding:5px 8px;font-size:.72rem">'+(e.mode||'—')+'</td>'
                +'<td style="padding:5px 8px;font-size:.72rem;color:'+(e.source==='Loan'?'#c0392b':'#1a7a45')+';font-weight:700">'+(e.source||'—')+'</td>'
                +'<td style="padding:5px 8px;"><button data-del="'+e.id+'" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:.8rem;padding:2px 4px;">&#128465;</button></td>'
                +'</tr>';
            }).join('')
          : '<tr><td colspan="7" style="text-align:center;padding:12px;color:#888;font-size:.75rem;">No payments recorded yet</td></tr>'
        )
        +'</tbody></table></div>'

        // Export buttons
        +'<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">'
        +'<button id="apm_pdf" style="background:#e53935;color:#fff;border:none;border-radius:7px;padding:6px 12px;font-family:Nunito,sans-serif;font-size:.75rem;font-weight:800;cursor:pointer;">&#128196; PDF</button>'+APP._pdfOriHtml()
        +'<button id="apm_word" style="background:#1565c0;color:#fff;border:none;border-radius:7px;padding:6px 12px;font-family:Nunito,sans-serif;font-size:.75rem;font-weight:800;cursor:pointer;">&#128221; Word</button>'
        +'<button id="apm_csv" style="background:#2e7d32;color:#fff;border:none;border-radius:7px;padding:6px 12px;font-family:Nunito,sans-serif;font-size:.75rem;font-weight:800;cursor:pointer;">&#128202; Excel/CSV</button>'
        +'</div>'
        +'<div class="modal-foot" style="margin-top:12px;">'
        +'<button id="apm_close" class="btn b-out">Close</button>'
        +'</div>';

      // Init date picker
      var dw = document.getElementById('apm_date_wrap');
      if(dw && typeof makeDateInput==='function') dw.innerHTML = makeDateInput('apm_date','');

      // Wire Save button — addEventListener (no inline onclick)
      var saveBtn = document.getElementById('apm_save_btn');
      if(saveBtn){
        saveBtn.addEventListener('click', function(ev){
          ev.preventDefault(); ev.stopPropagation();
          doSave();
        });
      }

      // Wire delete buttons
      var tbody = document.getElementById('apm_tbody');
      if(tbody){
        tbody.addEventListener('click', function(ev){
          var btn = ev.target.closest('[data-del]');
          if(btn){ doDelete(btn.getAttribute('data-del')); }
        });
      }

      // Wire close
      var closeBtn = document.getElementById('apm_close');
      if(closeBtn) closeBtn.addEventListener('click', function(){ overlay.remove(); });

      // Wire export
      var pdfBtn  = document.getElementById('apm_pdf');
      var wordBtn = document.getElementById('apm_word');
      var csvBtn  = document.getElementById('apm_csv');
      if(pdfBtn)  pdfBtn.addEventListener('click',  function(){ self._propLedgerPDF(propId); });
      if(wordBtn) wordBtn.addEventListener('click',  function(){ self._propLedgerWord(propId); });
      if(csvBtn)  csvBtn.addEventListener('click',   function(){ self._propLedgerCSV(propId); });
    }

    // Save handler
    function doSave(){
      var amtEl     = document.getElementById('apm_amount');
      var purposeEl = document.getElementById('apm_purpose');
      var amt     = parseFloat(amtEl ? amtEl.value : 0) || 0;
      var purpose = (purposeEl ? purposeEl.value : '').trim();
      if(!amt){ self.showToastMsg('Amount required!'); return; }
      if(!purpose){ self.showToastMsg('Purpose required!'); return; }

      // Parse date
      var dateEl = document.getElementById('apm_date');
      var rawDate = dateEl ? dateEl.value.trim() : '';
      var isoDate = '';
      if(rawDate){
        if(/^\d{4}-\d{2}-\d{2}$/.test(rawDate)){
          isoDate = rawDate;
        } else {
          var pts = rawDate.split(/[\/\-]/);
          if(pts.length===3) isoDate = pts[2].length===4 ? pts[2]+'-'+pts[1]+'-'+pts[0] : rawDate;
        }
      }

      var gv = function(id){ var el=document.getElementById(id); return el?el.value.trim():''; };
      var entry = {
        id: uid(),
        date: isoDate,
        amount: amt,
        paidTo: gv('apm_paidto') || 'Builder',
        purpose: purpose,
        mode: gv('apm_mode') || 'Cheque',
        reference: gv('apm_ref'),
        source: gv('apm_source') || 'Own',
        notes: gv('apm_notes')
      };

      // Save directly to props storage
      var ps = self.props;
      var found = false;
      ps = ps.map(function(px){
        if(px.id !== propId) return px;
        found = true;
        var existing = Array.isArray(px.ledger) ? px.ledger : [];
        var newLedger = existing.concat([entry]);
        var newCost = newLedger.reduce(function(s,e){ return s+Number(e.amount||0); }, 0);
        return Object.assign({}, px, { ledger: newLedger, cost: String(newCost) });
      });
      if(!found){ self.showToastMsg('Property not found!'); return; }
      S.set('props', ps);

      var saved = self.props.find(function(px){ return px.id===propId; });
      var newTotal = saved ? (saved.ledger||[]).reduce(function(s,e){ return s+Number(e.amount||0); },0) : 0;
      self.showToastMsg('Payment saved! Total: '+(window.fmt||(function(n){return Number(n).toLocaleString('en-IN');}))(newTotal));

      // Re-render modal with updated data
      render();
      // Update property tab in background
      if(self.curTab==='property') self.renderProperty();
    }

    // Delete handler
    function doDelete(entryId){
      var ps = self.props;
      ps = ps.map(function(p){
        if(p.id !== propId) return p;
        var newLedger = (Array.isArray(p.ledger)?p.ledger:[]).filter(function(e){ return e.id!==entryId; });
        var newCost = newLedger.reduce(function(s,e){ return s+Number(e.amount||0); },0);
        return Object.assign({}, p, { ledger: newLedger, cost: String(newCost) });
      });
      S.set('props', ps);
      self.showToastMsg('Entry deleted');
      render();
      if(self.curTab==='property') self.renderProperty();
    }

    // Initial render
    render();
  },


    _cancelPropModal(){
    if(!this._propEditId && this._propDraftId){
      const draftId = this._propDraftId;
      S.set('props', this.props.filter(p=>p.id!==draftId));
      this._propDraftId = null;
    }
    this._propEditId = null;
    M.close('propM');
  },

  deleteProp(id){
    this.delCb=()=>{S.set('props',this.props.filter(p=>p.id!==id));S.set('tenants',this.tenants.filter(t=>t.propId!==id));if(this.curProp===id)this.curProp=null;this.renderProperty();this.renderPills();};
    document.getElementById('delMsg').textContent='Delete property and all its tenants?';M.open('delM');
  },


  // ══ PROPERTY VALUATION TRACKER ══
  getPropValuations(propId){ try{ return JSON.parse(localStorage.getItem('rk_valuation_'+propId)||'[]'); }catch{ return []; } },
  savePropValuations(propId,arr){ localStorage.setItem('rk_valuation_'+propId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('valuation_'+propId,arr).catch(()=>{}); },
  // ══════════════════════════════════════════════════
  // PROPERTY PORTFOLIO REPORT
  // ══════════════════════════════════════════════════
  _propReportData(){
    // Build per-property stats for report
    const ps = this.props.filter(p=>!p._draft);
    const rows = ps.map(p=>{
      const vals = this.getPropValuations(p.id);
      const latestMkt = vals.length ? Number(vals[vals.length-1].value)||0 : 0;
      const mktVal = latestMkt>0 ? latestMkt : Number(p.mkt||0);
      const led = p.ledger&&Array.isArray(p.ledger)&&p.ledger.length ? p.ledger : null;
      const invested = led ? led.reduce((s,e)=>s+Number(e.amount||0),0) : Number(p.cost||0);
      const ownFunds = led ? led.filter(e=>e.source==='Own').reduce((s,e)=>s+Number(e.amount||0),0) : invested;
      const loanPaid = led ? led.filter(e=>e.source==='Loan').reduce((s,e)=>s+Number(e.amount||0),0) : 0;
      const loan = Number(p.loan||0);
      const effVal = mktVal>0 ? mktVal : invested;
      const gain = mktVal>0&&invested>0 ? mktVal-invested : 0;
      const gainPct = invested>0&&mktVal>0 ? (gain/invested*100).toFixed(1) : '—';
      const netAsset = effVal - loan;
      return {
        name: p.name||'—', type: p.type||'—', city: p.city||'—',
        purchaseDate: p.date ? fD(p.date) : '—',
        invested, ownFunds, loanPaid, mktVal, loan, effVal, gain, gainPct, netAsset,
        hasMkt: mktVal>0
      };
    });
    const totals = {
      invested: rows.reduce((s,r)=>s+r.invested,0),
      ownFunds: rows.reduce((s,r)=>s+r.ownFunds,0),
      loanPaid: rows.reduce((s,r)=>s+r.loanPaid,0),
      mktVal:   rows.filter(r=>r.hasMkt).reduce((s,r)=>s+r.mktVal,0),
      loan:     rows.reduce((s,r)=>s+r.loan,0),
      effVal:   rows.reduce((s,r)=>s+r.effVal,0),
      gain:     rows.reduce((s,r)=>s+r.gain,0),
      netAsset: rows.reduce((s,r)=>s+r.netAsset,0),
    };
    return {rows, totals};
  },

  _showPropReport(){
    const {rows, totals} = this._propReportData();
    const f = n => fmt(n);
    const dateStr = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});

    // Build modal HTML with inline table
    const tblRows = rows.map((r,i)=>`
      <tr style="background:${i%2===0?'#fff':'#f8f9ff'};">
        <td style="padding:7px 10px;font-weight:700;font-size:.78rem;">${r.name}</td>
        <td style="padding:7px 10px;font-size:.72rem;color:var(--mut);">${r.type}</td>
        <td style="padding:7px 10px;font-size:.72rem;color:var(--mut);">${r.city}</td>
        <td style="padding:7px 10px;font-size:.72rem;color:var(--mut);">${r.purchaseDate}</td>
        <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:.76rem;color:var(--acc);font-weight:700;">${f(r.invested)}</td>
        <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:.76rem;color:var(--grn);">${f(r.ownFunds)}</td>
        <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:.76rem;color:var(--red);">${r.loan?f(r.loan):'—'}</td>
        <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:.76rem;color:${r.hasMkt?'var(--grn)':'var(--mut)'};">${r.hasMkt?f(r.mktVal):'—'}</td>
        <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:.76rem;color:${r.gain>=0?'var(--grn)':'var(--red)'};">${r.hasMkt?(r.gain>=0?'+':'')+f(Math.abs(r.gain))+' ('+r.gainPct+'%)':'—'}</td>
        <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:.8rem;color:var(--pur);font-weight:900;">${f(r.netAsset)}</td>
      </tr>`).join('');

    const thS = 'padding:8px 10px;text-align:right;font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#fff;font-family:"JetBrains Mono",monospace;white-space:nowrap;border-bottom:2px solid #1a3a6e;';
    const thL = 'padding:8px 10px;text-align:left;font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#fff;font-family:"JetBrains Mono",monospace;white-space:nowrap;border-bottom:2px solid #1a3a6e;';

    const html = `<div class="overlay open" id="propReportModal" onclick="if(event.target===this)APP._closePropReport()" style="z-index:600;">
      <div class="modal" style="max-width:98vw;width:1100px;padding:0;display:flex;flex-direction:column;max-height:92vh;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1e3a6e,#2c6fad);padding:16px 20px;border-radius:12px 12px 0 0;flex-shrink:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-size:1.1rem;font-weight:900;color:#fff;">📊 Property Portfolio Report</div>
              <div style="font-size:.72rem;color:#a0c4f0;margin-top:2px;">Raman Kumar | Generated: ${dateStr}</div>
            </div>
            <button onclick="APP._closePropReport()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:.82rem;font-weight:700;">✕ Close</button>
          </div>
        </div>

        <!-- Summary Pills -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;padding:12px 16px;background:#f8faff;border-bottom:1px solid var(--bdr);flex-shrink:0;">
          <div style="background:#fff;border:1.5px solid #90b8e8;border-radius:9px;padding:9px 11px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#2c6fad;text-transform:uppercase;margin-bottom:3px;">Total Invested</div>
            <div style="font-size:.95rem;font-weight:900;color:#1a3a6e;font-family:'JetBrains Mono',monospace;">${f(totals.invested)}</div>
          </div>
          <div style="background:#fff;border:1.5px solid #90c8a0;border-radius:9px;padding:9px 11px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#1a7a45;text-transform:uppercase;margin-bottom:3px;">Own Funds</div>
            <div style="font-size:.95rem;font-weight:900;color:#1a7a45;font-family:'JetBrains Mono',monospace;">${f(totals.ownFunds)}</div>
          </div>
          <div style="background:#fff;border:1.5px solid #fecaca;border-radius:9px;padding:9px 11px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#c0392b;text-transform:uppercase;margin-bottom:3px;">Total Loan</div>
            <div style="font-size:.95rem;font-weight:900;color:#c0392b;font-family:'JetBrains Mono',monospace;">${totals.loan?f(totals.loan):'—'}</div>
          </div>
          <div style="background:#fff;border:1.5px solid #86efac;border-radius:9px;padding:9px 11px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#1a7a45;text-transform:uppercase;margin-bottom:3px;">Market Value</div>
            <div style="font-size:.95rem;font-weight:900;color:#1a7a45;font-family:'JetBrains Mono',monospace;">${totals.mktVal?f(totals.mktVal):'Partial'}</div>
          </div>
          <div style="background:#fff;border:1.5px solid #c0a0f0;border-radius:9px;padding:9px 11px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#5c3496;text-transform:uppercase;margin-bottom:3px;">Total Gain</div>
            <div style="font-size:.95rem;font-weight:900;color:${totals.gain>=0?'#1a7a45':'#c0392b'};font-family:'JetBrains Mono',monospace;">${totals.gain?(totals.gain>=0?'+':'')+f(Math.abs(totals.gain)):'—'}</div>
          </div>
          <div style="background:linear-gradient(135deg,#f5f0ff,#ede0ff);border:1.5px solid #c0a0f0;border-radius:9px;padding:9px 11px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#5c3496;text-transform:uppercase;margin-bottom:3px;">Net Asset Value</div>
            <div style="font-size:.95rem;font-weight:900;color:#5c3496;font-family:'JetBrains Mono',monospace;">${f(totals.netAsset)}</div>
          </div>
        </div>

        <!-- Table -->
        <div style="overflow:auto;flex:1;">
          <table style="width:100%;border-collapse:collapse;min-width:900px;">
            <thead>
              <tr style="background:linear-gradient(135deg,#1e3a6e,#2c6fad);">
                <th style="${thL}">Property</th>
                <th style="${thL}">Type</th>
                <th style="${thL}">City</th>
                <th style="${thL}">Purchase</th>
                <th style="${thS}">Invested</th>
                <th style="${thS}">Own Funds</th>
                <th style="${thS}">Loan</th>
                <th style="${thS}">Mkt Value</th>
                <th style="${thS}">Gain / Loss</th>
                <th style="${thS}">Net Asset</th>
              </tr>
            </thead>
            <tbody>
              ${tblRows}
            </tbody>
            <tfoot>
              <tr style="background:linear-gradient(135deg,#1e3a6e,#2c6fad);">
                <td colspan="4" style="padding:9px 10px;font-weight:900;color:#fff;font-size:.82rem;">TOTAL (${rows.length} Properties)</td>
                <td style="padding:9px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:900;color:#fff;font-size:.82rem;">${f(totals.invested)}</td>
                <td style="padding:9px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:900;color:#90f0b0;font-size:.82rem;">${f(totals.ownFunds)}</td>
                <td style="padding:9px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:900;color:#fca5a5;font-size:.82rem;">${totals.loan?f(totals.loan):'—'}</td>
                <td style="padding:9px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:900;color:#90f0b0;font-size:.82rem;">${totals.mktVal?f(totals.mktVal):'Partial'}</td>
                <td style="padding:9px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:900;color:${totals.gain>=0?'#90f0b0':'#fca5a5'};font-size:.82rem;">${totals.gain?(totals.gain>=0?'+':'')+f(Math.abs(totals.gain)):'—'}</td>
                <td style="padding:9px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:900;color:#e0d0ff;font-size:.9rem;">${f(totals.netAsset)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Download buttons -->
        <div style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--bdr);background:#f8faff;flex-shrink:0;flex-wrap:wrap;border-radius:0 0 12px 12px;">
          <span style="font-size:.72rem;font-weight:700;color:var(--mut);align-self:center;">Download:</span>
          <button onclick="APP._propReportPDF()" class="btn" style="background:#e53935;color:#fff;border:none;font-weight:800;">📄 PDF</button>${APP._pdfOriHtml()}
          <button onclick="APP._propReportCSV()" class="btn" style="background:#1a7a45;color:#fff;border:none;font-weight:800;">📊 Excel / CSV</button>
          <button onclick="APP._propReportWord()" class="btn" style="background:#1565c0;color:#fff;border:none;font-weight:800;">📝 Word</button>
        </div>
      </div>
    </div>`;

    // Remove existing if open
    const ex = document.getElementById('propReportModal');
    if(ex) ex.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  },

  _closePropReport(){
    const el = document.getElementById('propReportModal');
    if(el) el.remove();
  },

  _propReportPDF(){
    const {rows, totals} = this._propReportData();
    const f = n => 'Rs.'+Number(n||0).toLocaleString('en-IN');
    const dateStr = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    _makePDF({
      filename: 'Property_Portfolio_Report_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: 'Property Portfolio Report',
      subtitle: 'Raman Kumar | '+dateStr,
      orientation: 'landscape',
      headerColor: [30,58,110],
      accentColor: [44,111,173],
      summaryRows: [
        ['Total Invested',    f(totals.invested),  '#2c6fad'],
        ['Own Funds',         f(totals.ownFunds),  '#1a7a45'],
        ['Total Loan',        totals.loan?f(totals.loan):'—', '#c0392b'],
        ['Market Value',      totals.mktVal?f(totals.mktVal):'Partial', '#1a7a45'],
        ['Total Gain',        totals.gain?(totals.gain>=0?'+':'')+f(Math.abs(totals.gain)):'—', totals.gain>=0?'#1a7a45':'#c0392b'],
        ['Net Asset Value',   f(totals.netAsset),  '#5c3496'],
      ],
      columns: ['Property','Type','City','Purchase','Invested','Own Funds','Loan','Mkt Value','Gain/Loss','Net Asset'],
      rows: rows.map(r=>[
        r.name, r.type, r.city, r.purchaseDate,
        f(r.invested), f(r.ownFunds),
        r.loan?f(r.loan):'—',
        r.hasMkt?f(r.mktVal):'—',
        r.hasMkt?(r.gain>=0?'+':'')+f(Math.abs(r.gain))+' ('+r.gainPct+'%)':'—',
        f(r.netAsset)
      ]),
      totalsRow: ['TOTAL ('+rows.length+' properties)','','','',
        f(totals.invested), f(totals.ownFunds),
        totals.loan?f(totals.loan):'—',
        totals.mktVal?f(totals.mktVal):'Partial',
        totals.gain?(totals.gain>=0?'+':'')+f(Math.abs(totals.gain)):'—',
        f(totals.netAsset)
      ],
      colStyles:{
        4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'},
        7:{halign:'right'}, 8:{halign:'right'},
        9:{halign:'right', textColor:[92,52,150], fontStyle:'bold'}
      },
    });
  },

  _propReportCSV(){
    const {rows, totals} = this._propReportData();
    const f = n => Number(n||0);
    const esc = s => '"'+(String(s||'').replace(/"/g,'""'))+'"';
    const lines = [
      ['Property Portfolio Report — Raman Kumar'],
      ['Generated: '+todayDMY()],
      [],
      ['Property','Type','City','Purchase Date','Invested (Rs)','Own Funds (Rs)','Loan (Rs)','Market Value (Rs)','Gain/Loss (Rs)','Gain %','Net Asset (Rs)'],
      ...rows.map(r=>[
        esc(r.name), esc(r.type), esc(r.city), esc(r.purchaseDate),
        f(r.invested), f(r.ownFunds), f(r.loan),
        r.hasMkt?f(r.mktVal):'',
        r.hasMkt?f(r.gain):'', r.hasMkt?r.gainPct:'',
        f(r.netAsset)
      ]),
      [],
      ['TOTAL','','','',f(totals.invested),f(totals.ownFunds),f(totals.loan),
       totals.mktVal?f(totals.mktVal):'Partial','','',f(totals.netAsset)],
    ];
    const csv = lines.map(r=>Array.isArray(r)?r.join(','):r).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Property_Portfolio_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
    this.showToastMsg('📊 Excel/CSV downloaded!');
  },

  _propReportWord(){
    const {rows, totals} = this._propReportData();
    const f = n => 'Rs.'+Number(n||0).toLocaleString('en-IN');
    const dateStr = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});

    const thS = `<w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="1E3A6E"/><w:left w:val="single" w:sz="4" w:color="1E3A6E"/><w:bottom w:val="single" w:sz="4" w:color="1E3A6E"/><w:right w:val="single" w:sz="4" w:color="1E3A6E"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="2C6FAD"/></w:tcPr>`;
    const th = t => `<w:tc>${thS}<w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>${t}</w:t></w:r></w:p></w:tc>`;

    const wRows = rows.map((r,i)=>{
      const bg = i%2===0?'FFFFFF':'F0F4FF';
      const tc = (t,col,bold)=>`<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr><w:p><w:r><w:rPr>${bold?'<w:b/>':''}<w:color w:val="${(col||'111111').replace('#','')}"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>${String(t||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</w:t></w:r></w:p></w:tc>`;
      return `<w:tr>
        ${tc(r.name,'1A1D23',true)}${tc(r.type,'6C757D')}${tc(r.city,'6C757D')}${tc(r.purchaseDate,'6C757D')}
        ${tc(f(r.invested),'2C6FAD',true)}${tc(f(r.ownFunds),'1A7A45')}${tc(r.loan?f(r.loan):'—','C0392B')}
        ${tc(r.hasMkt?f(r.mktVal):'—',r.hasMkt?'1A7A45':'6C757D')}
        ${tc(r.hasMkt?(r.gain>=0?'+':'')+f(Math.abs(r.gain)):'—',r.gain>=0?'1A7A45':'C0392B')}
        ${tc(f(r.netAsset),'5C3496',true)}
      </w:tr>`;
    }).join('');

    const totRow = (t,col,bold)=>`<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="1E3A6E"/><w:left w:val="single" w:sz="4" w:color="1E3A6E"/><w:bottom w:val="single" w:sz="6" w:color="1E3A6E"/><w:right w:val="single" w:sz="4" w:color="1E3A6E"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="1E3A6E"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="${(col||'FFFFFF').replace('#','')}"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${String(t||'').replace(/&/g,'&amp;')}</w:t></w:r></w:p></w:tc>`;

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"
  xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  w:macrosPresent="no" w:embeddedObjPresent="no" w:ocxPresent="no">
<w:body>
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:b/><w:color w:val="1E3A6E"/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr><w:t>Property Portfolio Report</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:color w:val="3A6FA0"/><w:sz w:val="22"/></w:rPr><w:t>Raman Kumar | ${dateStr}</w:t></w:r>
  </w:p>
  <w:p><w:r><w:t> </w:t></w:r></w:p>
  <!-- Summary -->
  <w:p><w:r><w:rPr><w:b/><w:color w:val="1E3A6E"/><w:sz w:val="24"/></w:rPr><w:t>Portfolio Summary</w:t></w:r></w:p>
  <w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="BFDBFE"/><w:insideV w:val="single" w:sz="4" w:color="BFDBFE"/></w:tblBorders></w:tblPr>
    <w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Total Invested</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:b/><w:color w:val="2C6FAD"/></w:rPr><w:t>${f(totals.invested)}</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>Own Funds</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:color w:val="1A7A45"/></w:rPr><w:t>${f(totals.ownFunds)}</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>Total Loan (Outstanding)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:color w:val="C0392B"/></w:rPr><w:t>${totals.loan?f(totals.loan):'—'}</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>Market Value (where known)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:color w:val="1A7A45"/></w:rPr><w:t>${totals.mktVal?f(totals.mktVal):'Partial'}</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>Total Gain (mkt props)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:color w:val="${totals.gain>=0?'1A7A45':'C0392B'}"/></w:rPr><w:t>${totals.gain?(totals.gain>=0?'+':'')+f(Math.abs(totals.gain)):'—'}</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>NET ASSET VALUE</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:b/><w:color w:val="5C3496"/></w:rPr><w:t>${f(totals.netAsset)}</w:t></w:r></w:p></w:tc></w:tr>
  </w:tbl>
  <w:p><w:r><w:t> </w:t></w:r></w:p>
  <!-- Detail Table -->
  <w:p><w:r><w:rPr><w:b/><w:color w:val="1E3A6E"/><w:sz w:val="24"/></w:rPr><w:t>Property-wise Detail</w:t></w:r></w:p>
  <w:tbl><w:tblPr><w:tblW w:w="10000" w:type="pct"/><w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="BFDBFE"/><w:insideV w:val="single" w:sz="4" w:color="BFDBFE"/></w:tblBorders></w:tblPr>
    <w:tr>${th('Property')}${th('Type')}${th('City')}${th('Purchase')}${th('Invested')}${th('Own Funds')}${th('Loan')}${th('Mkt Value')}${th('Gain/Loss')}${th('Net Asset')}</w:tr>
    ${wRows}
    <w:tr>${totRow('TOTAL ('+rows.length+' props)')}${totRow('')}${totRow('')}${totRow('')}${totRow(f(totals.invested),'90F0B0')}${totRow(f(totals.ownFunds),'90F0B0')}${totRow(totals.loan?f(totals.loan):'—','FCA5A5')}${totRow(totals.mktVal?f(totals.mktVal):'Partial','90F0B0')}${totRow(totals.gain?(totals.gain>=0?'+':'')+f(Math.abs(totals.gain)):'—',totals.gain>=0?'90F0B0':'FCA5A5')}${totRow(f(totals.netAsset),'E0D0FF')}</w:tr>
  </w:tbl>
  <w:p><w:r><w:t> </w:t></w:r></w:p>
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:color w:val="9CA3AF"/><w:sz w:val="16"/></w:rPr><w:t>Generated by Raman Kumar Personal Dashboard | ${dateStr}</w:t></w:r>
  </w:p>
</w:body>
</w:wordDocument>`;

    const blob = new Blob([docXml], {type:'application/msword'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Property_Portfolio_'+new Date().toISOString().slice(0,10)+'.doc';
    a.click();
    this.showToastMsg('📝 Word document downloaded!');
  },


  openValuationModal(propId){
    const p=this.props.find(x=>x.id===propId);
    if(!p) return;
    const today=new Date().toISOString().split('T')[0];
    const cost=Number(p.cost)||0;

    const render=()=>{
      const vs=this.getPropValuations(propId).sort((a,b)=>a.date.localeCompare(b.date));
      const latest=vs.length?vs[vs.length-1]:null;
      const latestVal=latest?Number(latest.value):(Number(p.mkt)||0);
      const gain=cost&&latestVal?latestVal-cost:0;
      const gainPct=cost&&latestVal?(((latestVal-cost)/cost)*100).toFixed(1):null;
      const purchDate=p.date||'';
      const yrs=purchDate&&latest?((new Date(latest.date)-new Date(purchDate))/31557600000):0;
      const cagr=cost&&latestVal&&yrs>0.1?(((latestVal/cost)**(1/yrs)-1)*100).toFixed(1)+'%':'—';

      // SVG chart — show even with 1 valuation (use cost as base point)
      let chart='';
      const chartPts=[];
      if(cost&&purchDate) chartPts.push({date:purchDate,value:cost,label:'Purchase'});
      vs.forEach(v=>chartPts.push({date:v.date,value:Number(v.value),label:fD(v.date)}));
      if(chartPts.length>=1){
        const allVals=chartPts.map(pt=>pt.value).filter(Boolean);
        const mn=Math.min(...allVals)*0.92, mx=Math.max(...allVals)*1.05;
        const W=340,H=90;
        const N=chartPts.length;
        const sx=i=>N<2?W/2:Math.round(i*(W-30)/(N-1))+15;
        const sy=v=>mx===mn?H/2:Math.round(H-((v-mn)/(mx-mn))*(H-12)-6);
        const linePoints=chartPts.map((pt,i)=>sx(i)+','+sy(pt.value)).join(' ');
        const areaPath=chartPts.map((pt,i)=>(i===0?'M':'L')+sx(i)+','+sy(pt.value)).join(' ')
          +' L'+sx(N-1)+','+H+' L'+sx(0)+','+H+' Z';
        chart=`<div style="background:linear-gradient(135deg,#f0f7ff,#e8f5ff);border:1.5px solid #90b8e8;border-radius:12px;padding:14px;margin-bottom:14px;">
          <div style="font-weight:800;font-size:.82rem;color:#1a3a6e;margin-bottom:8px;">📈 Value Growth Chart</div>
          <svg viewBox="0 0 ${W} ${H+30}" style="width:100%;height:110px;overflow:visible;">
            <defs><linearGradient id="vGrad${propId.slice(-4)}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2c6fad" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="#2c6fad" stop-opacity="0.02"/>
            </linearGradient></defs>
            <path d="${areaPath}" fill="url(#vGrad${propId.slice(-4)})"/>
            <polyline points="${linePoints}" fill="none" stroke="#2c6fad" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            ${chartPts.map((pt,i)=>`
              <circle cx="${sx(i)}" cy="${sy(pt.value)}" r="5" fill="${i===0?'#e09050':'#2c6fad'}" stroke="#fff" stroke-width="2"/>
              <text x="${sx(i)}" y="${H+22}" text-anchor="middle" font-size="9" fill="#6c757d" font-family="Nunito,sans-serif">${pt.label.slice(0,6)}</text>
              <text x="${sx(i)}" y="${sy(pt.value)-8}" text-anchor="middle" font-size="9" fill="#1a3a6e" font-weight="700" font-family="Nunito,sans-serif">${pt.value>=10000000?(pt.value/10000000).toFixed(1)+'Cr':pt.value>=100000?(pt.value/100000).toFixed(1)+'L':pt.value>=1000?Math.round(pt.value/1000)+'k':pt.value}</text>
            `).join('')}
          </svg>
        </div>`;
      }

      const body=document.getElementById('_valBody');
      if(!body) return;
      body.innerHTML=`
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;">
          <div style="background:#f0f7ff;border:1.5px solid #90b8e8;border-radius:10px;padding:11px 13px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#2c6fad;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">🏷️ Purchase Price</div>
            <div style="font-size:1.05rem;font-weight:900;color:var(--txt);">${cost?fmt(cost):'Not set'}</div>
            ${purchDate?`<div style="font-size:.6rem;color:var(--mut);margin-top:2px;">${fD(purchDate)}</div>`:''}
          </div>
          <div style="background:#f0faf5;border:1.5px solid #90c8a0;border-radius:10px;padding:11px 13px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#1a7a45;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">💰 Current Value</div>
            <div style="font-size:1.05rem;font-weight:900;color:var(--txt);">${latestVal?fmt(latestVal):'Not set'}</div>
            ${latest?`<div style="font-size:.6rem;color:var(--mut);margin-top:2px;">As of ${fD(latest.date)}</div>`:''}
          </div>
          <div style="background:${gain>=0?'#f0faf5':'#fff5f5'};border:1.5px solid ${gain>=0?'#90c8a0':'#f09090'};border-radius:10px;padding:11px 13px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:${gain>=0?'#1a7a45':'#c0392b'};text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">📊 Total Gain</div>
            <div style="font-size:1.05rem;font-weight:900;color:${gain>=0?'#1a7a45':'#c0392b'};">${gain?fmt(Math.abs(gain)):'—'}</div>
            ${gainPct!==null?`<div style="font-size:.7rem;font-weight:800;color:${gain>=0?'#1a7a45':'#c0392b'};margin-top:2px;">${gain>=0?'▲ +':'▼ −'}${Math.abs(gainPct)}%</div>`:''}
          </div>
          <div style="background:#fff8ee;border:1.5px solid #e8a060;border-radius:10px;padding:11px 13px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#b56a00;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">📈 CAGR / Year</div>
            <div style="font-size:1.05rem;font-weight:900;color:#b56a00;">${cagr}</div>
            ${yrs>0?`<div style="font-size:.6rem;color:var(--mut);margin-top:2px;">${yrs.toFixed(1)} yrs held</div>`:''}
          </div>
        </div>
        ${chart}
        <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="font-weight:800;font-size:.88rem;margin-bottom:8px;">➕ Add Valuation</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <div style="flex:1;min-width:120px;"><label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Date</label>
              <input type="date" id="_val_date" value="${today}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div style="flex:1;min-width:140px;"><label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💰 Market Value (₹)</label>
              <input type="number" id="_val_val" placeholder="e.g. 8500000" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div style="flex:1;min-width:140px;"><label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📝 Source / Note</label>
              <input type="text" id="_val_note" placeholder="e.g. Broker estimate" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
          </div>
          <button onclick="APP._saveValuation('${propId}')" style="background:#2c6fad;color:#fff;border:none;border-radius:8px;padding:7px 18px;font-family:Nunito,sans-serif;font-size:.83rem;font-weight:800;cursor:pointer;width:100%;margin-top:8px;">💾 Save Valuation</button>
        </div>
        ${vs.length?`<div style="font-weight:700;font-size:.82rem;margin-bottom:6px;">📋 Valuation History</div>
        <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.78rem;">
          <thead><tr style="background:var(--card2);"><th style="padding:6px 8px;text-align:left;">Date</th><th style="padding:6px 8px;">Value</th><th style="padding:6px 8px;">Change</th><th style="padding:6px 8px;">Note</th><th></th></tr></thead>
          <tbody>${vs.slice().reverse().map((v,i,arr)=>{
            const prev=arr[i+1];const chg=prev?Number(v.value)-Number(prev.value):null;
            const pct=prev&&chg?(chg/Number(prev.value)*100).toFixed(1):null;
            return `<tr><td style="font-size:.72rem;">${fD(v.date)}</td><td class="mono" style="font-weight:700;">₹${fmt(v.value)}</td>
              <td style="font-size:.7rem;color:${chg===null?'var(--mut)':chg>=0?'#1a7a45':'#c0392b'};font-weight:700;">${chg===null?'Base':chg>=0?'▲+'+fmt(chg)+' (+'+pct+'%)':'▼'+fmt(Math.abs(chg))+' ('+pct+'%)'}</td>
              <td style="font-size:.7rem;color:var(--mut);">${v.note||'—'}</td>
              <td><button onclick="(function(){var a=APP.getPropValuations('${propId}').filter(x=>x.id!=='${v.id}');APP.savePropValuations('${propId}',a);APP.openValuationModal('${propId}');})()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;">🗑</button></td>
            </tr>`;
          }).join('')}</tbody></table></div>`:''}
      `;
    };

    // Always recreate modal so title and content are fresh
    const _oldVal=document.getElementById('_valModal');
    if(_oldVal) _oldVal.remove();
    const modal=document.createElement('div');
    modal.id='_valModal';
    modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML=`<div style="width:100%;max-width:640px;background:#fff;border-radius:20px 20px 0 0;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid #e9ecef;flex-shrink:0;background:linear-gradient(135deg,#f0f7ff,#fff);">
        <div>
          <div style="font-weight:800;font-size:1rem;color:#1a3a6e;">🏠 ${p.name}</div>
          <div style="font-size:.68rem;color:var(--mut);">Property Valuation Tracker</div>
        </div>
        <button onclick="document.getElementById('_valModal').remove()" style="background:#f0f2f5;border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:#6c757d;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <div id="_valBody" style="overflow-y:auto;padding:14px 16px;flex:1;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
    render();
    modal.style.display='flex';
  },

  _saveValuation(propId){
    const date=document.getElementById('_val_date')?.value;
    const val=document.getElementById('_val_val')?.value;
    const note=document.getElementById('_val_note')?.value||'';
    if(!date||!val){ this.showToastMsg('⚠️ Date and value required!'); return; }
    const arr=this.getPropValuations(propId);
    arr.push({id:'val'+Date.now(),date,value:Number(val),note});
    arr.sort((a,b)=>a.date.localeCompare(b.date));
    this.savePropValuations(propId,arr);
    // Also update the property mkt value
    const ps=this.props.map(p=>p.id===propId?{...p,mkt:val}:p);
    S.set('props',ps);
    this.showToastMsg('✅ Valuation saved!');
    this.openValuationModal(propId);
    this.renderProperty();
  },

  // ════════════════════════════════════════════════════════
  // FEATURE 1 — MAINTENANCE TRACKER
  // localStorage key: rk_maint_{propId}
  // ════════════════════════════════════════════════════════
  _getMaint(propId){ try{ return JSON.parse(localStorage.getItem('rk_maint_'+propId)||'[]'); }catch{ return []; } },
  _saveMaint(propId,arr){ localStorage.setItem('rk_maint_'+propId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('maint_'+propId,arr).catch(()=>{}); },

  openMaintenanceModal(propId){
    const p=this.props.find(x=>x.id===propId);
    if(!p) return;
    const today=new Date().toISOString().split('T')[0];

    const render=()=>{
      const items=this._getMaint(propId).sort((a,b)=>b.date.localeCompare(a.date));
      const totalCost=items.reduce((s,x)=>s+Number(x.cost||0),0);
      const pending=items.filter(x=>x.status==='Pending').length;
      const done=items.filter(x=>x.status==='Done').length;
      const body=document.getElementById('_maintBody');
      if(!body) return;

      // Category colours
      const catColor={Plumbing:'#1565c0',Electrical:'#b56a00',Painting:'#7b1fa2',Carpentry:'#2e7d32',Cleaning:'#0f6e56',Civil:'#e65100',AC:'#00838f',Other:'#455a64'};
      const statusColor={Pending:'#b56a00',Done:'#1a7a45',Cancelled:'#c0392b'};
      const statusBg={Pending:'#fff8ee',Done:'#e8f5e9',Cancelled:'#fff0f0'};

      body.innerHTML=`
        <!-- Summary KPIs -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
          <div style="background:#fff8ee;border:1.5px solid #e8a060;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:#b56a00;text-transform:uppercase;margin-bottom:3px;">Total Cost</div>
            <div style="font-size:.95rem;font-weight:900;color:#b56a00;">${fmt(totalCost)}</div>
          </div>
          <div style="background:#fff8ee;border:1.5px solid #ffcc80;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:#b56a00;text-transform:uppercase;margin-bottom:3px;">Pending</div>
            <div style="font-size:.95rem;font-weight:900;color:#b56a00;">${pending}</div>
          </div>
          <div style="background:#e8f5e9;border:1.5px solid #90c8a0;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:#1a7a45;text-transform:uppercase;margin-bottom:3px;">Completed</div>
            <div style="font-size:.95rem;font-weight:900;color:#1a7a45;">${done}</div>
          </div>
        </div>

        <!-- Add form -->
        <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:12px;margin-bottom:14px;">
          <div style="font-weight:800;font-size:.85rem;margin-bottom:10px;">➕ Log Maintenance Work</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📋 Work Description *</label>
              <input id="_mnt_desc" placeholder="e.g. Bathroom pipe leak repair" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🏷️ Category</label>
              <select id="_mnt_cat" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);">
                <option>Plumbing</option><option>Electrical</option><option>Painting</option>
                <option>Carpentry</option><option>Cleaning</option><option>Civil</option>
                <option>AC</option><option>Other</option>
              </select>
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💰 Cost (₹)</label>
              <input id="_mnt_cost" type="number" placeholder="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Date</label>
              <input id="_mnt_date" type="date" value="${today}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🔧 Vendor / Person</label>
              <input id="_mnt_vendor" placeholder="e.g. Raju Plumber" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">✅ Status</label>
              <select id="_mnt_status" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);">
                <option>Pending</option><option>Done</option><option>Cancelled</option>
              </select>
            </div>
          </div>
          <input id="_mnt_note" placeholder="📝 Notes (optional)" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);margin-bottom:8px;">
          <button onclick="APP._saveMaintEntry('${propId}')" style="width:100%;background:#1a7a45;color:#fff;border:none;border-radius:8px;padding:9px;font-family:Nunito,sans-serif;font-size:.85rem;font-weight:800;cursor:pointer;">💾 Save Maintenance Record</button>
        </div>

        <!-- Records list -->
        ${items.length?`<div style="font-weight:700;font-size:.82rem;margin-bottom:8px;">📋 Maintenance History (${items.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${items.map(x=>`
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:10px;padding:10px 12px;display:flex;align-items:flex-start;gap:10px;">
              <div style="background:${(catColor[x.cat]||'#455a64')}15;color:${catColor[x.cat]||'#455a64'};border-radius:7px;padding:4px 8px;font-size:.6rem;font-weight:800;text-align:center;min-width:52px;flex-shrink:0;">${x.cat}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:.84rem;margin-bottom:2px;">${x.desc}</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:.7rem;color:var(--mut);">
                  <span>📅 ${fD(x.date)}</span>
                  ${x.vendor?`<span>🔧 ${x.vendor}</span>`:''}
                  ${x.cost?`<span style="color:#b56a00;font-weight:700;">💰 ${fmt(x.cost)}</span>`:''}
                  ${x.note?`<span>📝 ${x.note}</span>`:''}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
                <span style="background:${statusBg[x.status]||'var(--dim)'};color:${statusColor[x.status]||'var(--mut)'};font-size:.6rem;font-weight:800;padding:2px 8px;border-radius:5px;">${x.status}</span>
                <button onclick="(function(){var a=APP._getMaint('${propId}').filter(m=>m.id!=='${x.id}');APP._saveMaint('${propId}',a);APP.openMaintenanceModal('${propId}');})()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;padding:0;">🗑</button>
              </div>
            </div>`).join('')}
        </div>`:'<div style="text-align:center;padding:24px;color:var(--mut);font-size:.85rem;">No maintenance records yet.<br>Log your first repair above.</div>'}
      `;
    };

    const old=document.getElementById('_maintModal'); if(old) old.remove();
    const modal=document.createElement('div');
    modal.id='_maintModal';
    modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML=`<div style="width:100%;max-width:640px;background:var(--card);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div>
          <div style="font-weight:800;font-size:1rem;color:var(--txt);">🔧 ${p.name}</div>
          <div style="font-size:.68rem;color:var(--mut);">Maintenance Tracker</div>
        </div>
        <button onclick="document.getElementById('_maintModal').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
      </div>
      <div id="_maintBody" style="overflow-y:auto;padding:14px 16px;flex:1;-webkit-overflow-scrolling:touch;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
    render();
  },

  _saveMaintEntry(propId){
    const desc=(document.getElementById('_mnt_desc')||{}).value||'';
    const cat =(document.getElementById('_mnt_cat')||{}).value||'Other';
    const cost=(document.getElementById('_mnt_cost')||{}).value||'0';
    const date=(document.getElementById('_mnt_date')||{}).value||new Date().toISOString().split('T')[0];
    const vendor=(document.getElementById('_mnt_vendor')||{}).value||'';
    const status=(document.getElementById('_mnt_status')||{}).value||'Pending';
    const note=(document.getElementById('_mnt_note')||{}).value||'';
    if(!desc.trim()){ this.showToastMsg('⚠️ Work description required!'); return; }
    const arr=this._getMaint(propId);
    arr.push({id:'mnt'+Date.now(),desc,cat,cost:Number(cost),date,vendor,status,note,createdAt:new Date().toISOString()});
    arr.sort((a,b)=>b.date.localeCompare(a.date));
    this._saveMaint(propId,arr);
    this.showToastMsg('✅ Maintenance record saved!');
    this.openMaintenanceModal(propId);
  },

  // ════════════════════════════════════════════════════════
  // FEATURE 2 — EMI / LOAN AMORTISATION CALCULATOR
  // Standalone calculator — no data saved, just calc on the fly
  // ════════════════════════════════════════════════════════
  openEMIModal(propId){
    const p=this.props.find(x=>x.id===propId);
    if(!p) return;
    const loanAmt=Number(p.loan||0);

    const old=document.getElementById('_emiModal'); if(old) old.remove();
    const modal=document.createElement('div');
    modal.id='_emiModal';
    modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML=`<div style="width:100%;max-width:640px;background:var(--card);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div>
          <div style="font-weight:800;font-size:1rem;color:var(--txt);">🏦 ${p.name}</div>
          <div style="font-size:.68rem;color:var(--mut);">EMI / Loan Amortisation Calculator</div>
        </div>
        <button onclick="document.getElementById('_emiModal').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
      </div>
      <div id="_emiBody" style="overflow-y:auto;padding:14px 16px;flex:1;-webkit-overflow-scrolling:touch;">
        <!-- Input form -->
        <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:12px;margin-bottom:14px;">
          <div style="font-weight:800;font-size:.85rem;margin-bottom:10px;">📊 Loan Details</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💰 Loan Amount (₹)</label>
              <input id="_emi_principal" type="number" value="${loanAmt||''}" placeholder="e.g. 5000000"
                style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:7px 9px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);"
                oninput="APP._calcEMI()">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📈 Interest Rate (% per year)</label>
              <input id="_emi_rate" type="number" value="8.5" step="0.1" placeholder="e.g. 8.5"
                style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:7px 9px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);"
                oninput="APP._calcEMI()">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Tenure (Years)</label>
              <input id="_emi_years" type="number" value="20" min="1" max="30" placeholder="e.g. 20"
                style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:7px 9px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);"
                oninput="APP._calcEMI()">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 EMI Start Month</label>
              <input id="_emi_start" type="month" value="${new Date().toISOString().slice(0,7)}"
                style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:7px 9px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);"
                oninput="APP._calcEMI()">
            </div>
          </div>
        </div>
        <!-- Results injected here by _calcEMI -->
        <div id="_emi_result"></div>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
    // Auto-calculate on open
    setTimeout(()=>this._calcEMI(), 100);
  },

  _calcEMI(){
    const P=Number((document.getElementById('_emi_principal')||{}).value||0);
    const rAnn=Number((document.getElementById('_emi_rate')||{}).value||8.5);
    const years=Number((document.getElementById('_emi_years')||{}).value||20);
    const startVal=(document.getElementById('_emi_start')||{}).value||new Date().toISOString().slice(0,7);
    const res=document.getElementById('_emi_result');
    if(!res) return;
    if(!P||!rAnn||!years){ res.innerHTML='<div style="color:var(--mut);font-size:.82rem;text-align:center;padding:12px;">Enter loan details above to calculate.</div>'; return; }

    const r=rAnn/12/100;
    const n=years*12;
    const emi=P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
    const totalPayment=emi*n;
    const totalInterest=totalPayment-P;

    // SVG bar — principal vs interest
    const pct=Math.round((P/totalPayment)*100);
    const intPct=100-pct;

    // Generate amortisation table (yearly summary)
    let balance=P;
    const yearRows=[];
    const [startY,startM]=startVal.split('-').map(Number);
    for(let yr=1;yr<=years;yr++){
      let princPaid=0,intPaid=0;
      for(let mo=0;mo<12&&balance>0.01;mo++){
        const intForMonth=balance*r;
        const princForMonth=Math.min(emi-intForMonth,balance);
        intPaid+=intForMonth;
        princPaid+=princForMonth;
        balance-=princForMonth;
      }
      const calYear=startY+yr-1;
      yearRows.push({yr,calYear,princPaid,intPaid,balance:Math.max(0,balance)});
    }

    // SVG donut — principal vs interest
    const R=50,cx=65,cy=65,stroke=18;
    const circumference=2*Math.PI*R;
    const intArc=circumference*(intPct/100);
    const princArc=circumference*(pct/100);

    res.innerHTML=`
      <!-- KPI strip -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
        <div style="background:#e3f2fd;border:1.5px solid #90b8e8;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:.55rem;font-weight:800;color:#1565c0;text-transform:uppercase;margin-bottom:3px;">Monthly EMI</div>
          <div style="font-size:.95rem;font-weight:900;color:#1565c0;">${fmt(Math.round(emi))}</div>
        </div>
        <div style="background:#fff8ee;border:1.5px solid #e8a060;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:.55rem;font-weight:800;color:#b56a00;text-transform:uppercase;margin-bottom:3px;">Total Interest</div>
          <div style="font-size:.95rem;font-weight:900;color:#b56a00;">${fmt(Math.round(totalInterest))}</div>
          <div style="font-size:.6rem;color:#b56a00;margin-top:2px;">${intPct}% of total</div>
        </div>
        <div style="background:#f5f0ff;border:1.5px solid #c0a0f0;border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:.55rem;font-weight:800;color:#5c3496;text-transform:uppercase;margin-bottom:3px;">Total Payment</div>
          <div style="font-size:.95rem;font-weight:900;color:#5c3496;">${fmt(Math.round(totalPayment))}</div>
        </div>
      </div>

      <!-- Donut chart + bar -->
      <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:12px;padding:14px;margin-bottom:14px;display:flex;align-items:center;gap:16px;">
        <svg width="130" height="130" viewBox="0 0 130 130" style="flex-shrink:0;">
          <!-- Background circle -->
          <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--dim)" stroke-width="${stroke}"/>
          <!-- Interest arc (red) -->
          <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#e53935" stroke-width="${stroke}"
            stroke-dasharray="${intArc} ${circumference}" stroke-dashoffset="0"
            transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
          <!-- Principal arc (blue) -->
          <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#1565c0" stroke-width="${stroke}"
            stroke-dasharray="${princArc} ${circumference}" stroke-dashoffset="${-intArc}"
            transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
          <text x="${cx}" y="${cy-6}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--txt)" font-family="Nunito,sans-serif">EMI</text>
          <text x="${cx}" y="${cy+10}" text-anchor="middle" font-size="10" fill="var(--mut)" font-family="Nunito,sans-serif">${fmt(Math.round(emi))}</text>
        </svg>
        <div style="flex:1;">
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:3px;"><span style="color:#1565c0;font-weight:700;">🔵 Principal</span><span style="font-weight:700;">${fmt(Math.round(P))} (${pct}%)</span></div>
            <div style="height:7px;background:var(--dim);border-radius:4px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:#1565c0;border-radius:4px;"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:3px;"><span style="color:#e53935;font-weight:700;">🔴 Interest</span><span style="font-weight:700;">${fmt(Math.round(totalInterest))} (${intPct}%)</span></div>
            <div style="height:7px;background:var(--dim);border-radius:4px;overflow:hidden;"><div style="width:${intPct}%;height:100%;background:#e53935;border-radius:4px;"></div></div>
          </div>
          <div style="margin-top:10px;font-size:.68rem;color:var(--mut);">
            Loan ends: <b>${new Date(startY,startM-1+n).toLocaleString('en-IN',{month:'short',year:'numeric'})}</b>
          </div>
        </div>
      </div>

      <!-- Yearly amortisation table -->
      <div style="font-weight:700;font-size:.82rem;margin-bottom:8px;">📋 Year-wise Schedule</div>
      <div style="overflow-x:auto;border:1.5px solid var(--bdr);border-radius:10px;">
        <table style="width:100%;border-collapse:collapse;font-size:.75rem;min-width:400px;">
          <thead><tr style="background:var(--card2);">
            <th style="padding:8px 10px;text-align:left;font-weight:700;">Year</th>
            <th style="padding:8px 10px;text-align:right;font-weight:700;">Principal Paid</th>
            <th style="padding:8px 10px;text-align:right;font-weight:700;">Interest Paid</th>
            <th style="padding:8px 10px;text-align:right;font-weight:700;">Balance</th>
          </tr></thead>
          <tbody>
            ${yearRows.map((r,i)=>`<tr style="background:${i%2===0?'var(--card)':'var(--dim)'};">
              <td style="padding:6px 10px;font-weight:600;">Year ${r.yr} (${r.calYear})</td>
              <td style="padding:6px 10px;text-align:right;color:#1565c0;font-weight:600;">${fmt(Math.round(r.princPaid))}</td>
              <td style="padding:6px 10px;text-align:right;color:#e53935;">${fmt(Math.round(r.intPaid))}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:700;color:${r.balance<P*0.1?'#1a7a45':'var(--txt)'};">${r.balance<0.01?'✓ Paid off':fmt(Math.round(r.balance))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ════════════════════════════════════════════════════════
  // FEATURE 3 — ROI CHART (Return on Investment)
  // Shows: Invested vs Market Value + Rental Income over time
  // ════════════════════════════════════════════════════════
  openROIModal(propId){
    const p=this.props.find(x=>x.id===propId);
    if(!p) return;

    const led=p.ledger&&Array.isArray(p.ledger)&&p.ledger.length?p.ledger:null;
    const invested=led?led.reduce((s,e)=>s+Number(e.amount||0),0):Number(p.cost||0);
    const vals=this.getPropValuations(propId).sort((a,b)=>a.date.localeCompare(b.date));
    const latestMkt=vals.length?Number(vals[vals.length-1].value):Number(p.mkt||0);

    // Rental income: all payments for all tenants of this property
    const tenantIds=this.tenants.filter(t=>t.propId===propId).map(t=>t.id);
    const rentPayments=this.payments.filter(pm=>tenantIds.includes(pm.tenantId)&&pm.ptype!=='refund');
    const totalRentCollected=rentPayments.reduce((s,pm)=>s+Number(pm.amount||0),0);

    // Capital gain
    const capitalGain=latestMkt&&invested?latestMkt-invested:0;
    const totalReturn=capitalGain+totalRentCollected;
    const roiPct=invested>0?((totalReturn/invested)*100).toFixed(1):null;
    const capitalROI=invested>0&&capitalGain?((capitalGain/invested)*100).toFixed(1):null;
    const rentalROI=invested>0&&totalRentCollected?((totalRentCollected/invested)*100).toFixed(1):null;

    // Holding years
    const purchDate=p.date||'';
    const heldYrs=purchDate?((Date.now()-new Date(purchDate))/31557600000):0;
    const annualRentalROI=invested>0&&heldYrs>0?((totalRentCollected/invested/heldYrs)*100).toFixed(1):null;

    // Rental income by year — for bar chart
    const incomeByYear={};
    rentPayments.forEach(pm=>{
      if(!pm.date) return;
      const yr=pm.date.slice(0,4);
      incomeByYear[yr]=(incomeByYear[yr]||0)+Number(pm.amount||0);
    });
    const years=Object.keys(incomeByYear).sort();
    const maxIncome=Math.max(...Object.values(incomeByYear),1);

    // SVG bar chart for rental income
    const BW=34,GAP=8,SH=90,padL=14,padB=24;
    const chartW=Math.max(280,years.length*(BW+GAP)+padL+20);
    const bars=years.map((yr,i)=>{
      const val=incomeByYear[yr];
      const barH=Math.max(4,Math.round((val/maxIncome)*(SH-8)));
      const x=padL+i*(BW+GAP);
      const y=SH-barH;
      const label=val>=100000?(val/100000).toFixed(1)+'L':val>=1000?Math.round(val/1000)+'k':val;
      return `<rect x="${x}" y="${y}" width="${BW}" height="${barH}" rx="4" fill="#1565c0" opacity="0.85"/>
        <text x="${x+BW/2}" y="${SH+14}" text-anchor="middle" font-size="9" fill="#6c757d" font-family="Nunito">${yr.slice(2)}</text>
        <text x="${x+BW/2}" y="${y-4}" text-anchor="middle" font-size="8" font-weight="700" fill="#1a3a6e" font-family="Nunito">${label}</text>`;
    }).join('');

    const old=document.getElementById('_roiModal'); if(old) old.remove();
    const modal=document.createElement('div');
    modal.id='_roiModal';
    modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML=`<div style="width:100%;max-width:640px;background:var(--card);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div>
          <div style="font-weight:800;font-size:1rem;color:var(--txt);">📊 ${p.name}</div>
          <div style="font-size:.68rem;color:var(--mut);">Return on Investment (ROI) Analysis</div>
        </div>
        <button onclick="document.getElementById('_roiModal').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
      </div>
      <div style="overflow-y:auto;padding:14px 16px;flex:1;-webkit-overflow-scrolling:touch;">

        <!-- Total ROI headline -->
        <div style="background:${totalReturn>=0?'#e8f5e9':'#fff0f0'};border:2px solid ${totalReturn>=0?'#90c8a0':'#f09090'};border-radius:14px;padding:16px;text-align:center;margin-bottom:14px;">
          <div style="font-size:.65rem;font-weight:800;color:${totalReturn>=0?'#1a7a45':'#c0392b'};text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Total Return on Investment</div>
          <div style="font-size:2rem;font-weight:900;color:${totalReturn>=0?'#1a7a45':'#c0392b'};">${roiPct!==null?(totalReturn>=0?'+':'')+roiPct+'%':'—'}</div>
          <div style="font-size:.72rem;color:${totalReturn>=0?'#1a7a45':'#c0392b'};margin-top:4px;">
            ${totalReturn?fmt(Math.abs(Math.round(totalReturn)))+' '+(totalReturn>=0?'profit':'loss'):''}
            ${heldYrs>0.1?' · '+heldYrs.toFixed(1)+' years held':''}
          </div>
        </div>

        <!-- KPI breakdown -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:12px;">
            <div style="font-size:.6rem;font-weight:800;color:var(--mut);text-transform:uppercase;margin-bottom:4px;">💰 Total Invested</div>
            <div style="font-size:1rem;font-weight:900;color:var(--acc);">${invested?fmt(invested):'—'}</div>
            ${purchDate?`<div style="font-size:.6rem;color:var(--mut);margin-top:2px;">Since ${fD(purchDate)}</div>`:''}
          </div>
          <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:12px;">
            <div style="font-size:.6rem;font-weight:800;color:var(--mut);text-transform:uppercase;margin-bottom:4px;">📈 Current Market Value</div>
            <div style="font-size:1rem;font-weight:900;color:${latestMkt?'var(--grn)':'var(--mut)'};">${latestMkt?fmt(latestMkt):'Not set'}</div>
            ${vals.length?`<div style="font-size:.6rem;color:var(--mut);margin-top:2px;">As of ${fD(vals[vals.length-1].date)}</div>`:''}
          </div>
          <div style="background:${capitalGain>=0?'#e8f5e9':'#fff0f0'};border:1.5px solid ${capitalGain>=0?'#90c8a0':'#f09090'};border-radius:10px;padding:12px;">
            <div style="font-size:.6rem;font-weight:800;color:${capitalGain>=0?'#1a7a45':'#c0392b'};text-transform:uppercase;margin-bottom:4px;">🏠 Capital Gain</div>
            <div style="font-size:1rem;font-weight:900;color:${capitalGain>=0?'#1a7a45':'#c0392b'};">${capitalGain?(capitalGain>=0?'+':'')+fmt(Math.round(capitalGain)):'—'}</div>
            ${capitalROI?`<div style="font-size:.65rem;font-weight:700;color:${capitalGain>=0?'#1a7a45':'#c0392b'};margin-top:2px;">${capitalGain>=0?'+':''}${capitalROI}% on investment</div>`:''}
          </div>
          <div style="background:#e3f2fd;border:1.5px solid #90b8e8;border-radius:10px;padding:12px;">
            <div style="font-size:.6rem;font-weight:800;color:#1565c0;text-transform:uppercase;margin-bottom:4px;">🏠 Rental Income</div>
            <div style="font-size:1rem;font-weight:900;color:#1565c0;">${totalRentCollected?fmt(Math.round(totalRentCollected)):'—'}</div>
            ${annualRentalROI?`<div style="font-size:.65rem;font-weight:700;color:#1565c0;margin-top:2px;">${annualRentalROI}% p.a. rental yield</div>`:''}
          </div>
        </div>

        <!-- Rental income bar chart -->
        ${years.length>0?`<div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:12px;padding:14px;margin-bottom:14px;">
          <div style="font-weight:700;font-size:.82rem;margin-bottom:10px;">📊 Rental Income by Year</div>
          <div style="overflow-x:auto;">
            <svg viewBox="0 0 ${chartW} ${SH+padB+10}" style="width:100%;min-width:${Math.min(chartW,280)}px;height:${SH+padB+10}px;display:block;">
              ${bars}
              <line x1="${padL-4}" y1="0" x2="${padL-4}" y2="${SH}" stroke="var(--bdr)" stroke-width="1"/>
              <line x1="${padL-4}" y1="${SH}" x2="${chartW-10}" y2="${SH}" stroke="var(--bdr)" stroke-width="1"/>
            </svg>
          </div>
        </div>`:'<div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:16px;text-align:center;color:var(--mut);font-size:.82rem;margin-bottom:14px;">No rent payments recorded yet.</div>'}

        <!-- ROI breakdown bar -->
        ${invested>0&&(capitalGain||totalRentCollected)?`<div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:12px;padding:14px;">
          <div style="font-weight:700;font-size:.82rem;margin-bottom:10px;">📊 Return Breakdown</div>
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:4px;">
              <span style="color:#1a7a45;font-weight:700;">🏠 Capital Gain</span>
              <span>${capitalROI?capitalROI+'%':fmt(Math.round(capitalGain))}</span>
            </div>
            <div style="height:8px;background:var(--dim);border-radius:4px;overflow:hidden;">
              <div style="width:${totalReturn>0?Math.round(Math.max(0,capitalGain)/totalReturn*100):0}%;height:100%;background:#1a7a45;border-radius:4px;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:4px;">
              <span style="color:#1565c0;font-weight:700;">💰 Rental Income</span>
              <span>${rentalROI?rentalROI+'%':fmt(Math.round(totalRentCollected))}</span>
            </div>
            <div style="height:8px;background:var(--dim);border-radius:4px;overflow:hidden;">
              <div style="width:${totalReturn>0?Math.round(totalRentCollected/totalReturn*100):0}%;height:100%;background:#1565c0;border-radius:4px;"></div>
            </div>
          </div>
        </div>`:''}
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
  },

  renderProperty(){
    // ── Backward compat ──────────────────────────────────────────────────────
    let ps=this.props.filter(p=>!p._draft).map(p=>({...p,ledger:Array.isArray(p.ledger)?p.ledger:[]}));
    if(!this.curProp&&ps.length) this.curProp='__all__';

    // ── Top nav ───────────────────────────────────────────────────────────────
    const nav=`<button class="pnav-btn ${'__all__'===this.curProp?'on':''}"
        onclick="APP.curProp='__all__';APP.renderProperty()">All (${ps.length})</button>`
      +ps.map(p=>`<button class="pnav-btn ${p.id===this.curProp?'on':''}"
        onclick="APP.curProp='${p.id}';APP.renderProperty()"
        style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
        title="${p.name}">${p.name.slice(0,18)}</button>`).join('')
      +`<button class="pnav-btn pnav-add" onclick="APP.openPropModal()">+ Add</button>`;

    // ── Helper: property financials ───────────────────────────────────────────
    const _pStats=(p)=>{
      const vals=this.getPropValuations(p.id);
      const latestMkt=vals.length?Number(vals[vals.length-1].value)||0:0;
      const mkt=latestMkt>0?latestMkt:Number(p.mkt||0);
      const led=p.ledger&&p.ledger.length?p.ledger:null;
      const invested=led?led.reduce((s,e)=>s+Number(e.amount||0),0):Number(p.cost||0);
      const ownFunds=led?led.filter(e=>e.source==='Own').reduce((s,e)=>s+Number(e.amount||0),0):invested;
      const loanFunds=led?led.filter(e=>e.source==='Loan').reduce((s,e)=>s+Number(e.amount||0),0):0;
      const loan=Number(p.loan||0);
      const effVal=mkt>0?mkt:invested;
      const gain=mkt>0&&invested>0?mkt-invested:0;
      const gainPct=invested>0&&mkt>0?((mkt-invested)/invested*100).toFixed(1):null;
      const equity=effVal-loan;
      return {mkt,invested,ownFunds,loanFunds,loan,effVal,gain,gainPct,equity,hasMkt:mkt>0};
    };

    // ── Helper: tenant rent status ────────────────────────────────────────────
    const _tRent=(t)=>{
      const now=new Date(),m=now.getMonth(),y=now.getFullYear();
      const ledger=this.getTenantLedger(t);
      // Use ledger's curMo.received so advance payments (rentForMonth) are correctly counted
      const curMo=ledger.months.find(mo=>mo.year===y&&mo.month===m);
      const got=curMo?curMo.received:0;
      const total=this.payments.filter(pm=>pm.tenantId===t.id).reduce((s,pm)=>s+Number(pm.amount),0);
      const bal=ledger.totalBalance;
      return {got,total,bal,ledger};
    };

    let detail='<div class="empty"><div class="ei">🏢</div>Add a property above</div>';

    // ════════════════════════════════════════════════════════════════════════
    // VIEW A — ALL PROPERTIES PORTFOLIO OVERVIEW
    // ════════════════════════════════════════════════════════════════════════
    if(this.curProp==='__all__'){
      const allStats=ps.map(p=>({p,..._pStats(p)}));
      const totalPortfolio=allStats.reduce((s,x)=>s+x.effVal,0);
      const totalInvested =allStats.reduce((s,x)=>s+x.invested,0);
      const totalGain     =allStats.reduce((s,x)=>s+x.gain,0);
      const totalLoan     =allStats.reduce((s,x)=>s+x.loan,0);
      const totalEquity   =allStats.reduce((s,x)=>s+x.equity,0);
      const totalRent     =this.tenants.filter(t=>t.status==='active').reduce((s,t)=>s+Number(t.rent||0)+Number(t.maint||0),0);
      const totalProp     =ps.length;
      const totalTenants  =this.tenants.filter(t=>t.status==='active').length;



      // Gain % on properties where market value is known
      const mktProps=allStats.filter(x=>x.hasMkt);
      const gainPctAll=totalInvested>0&&mktProps.length?((totalGain/totalInvested)*100).toFixed(1):null;

      // ── Portfolio KPI strip ───────────────────────────────────────────────
      const kpi=(label,val,sub,color,bg,icon)=>`
        <div style="background:${bg};border:1.5px solid ${color}22;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;">
          <div style="font-size:.6rem;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:5px;">${icon} ${label}</div>
          <div style="font-size:1.15rem;font-weight:900;color:${color};font-family:'JetBrains Mono',monospace;">${val}</div>
          ${sub?`<div style="font-size:.62rem;color:${color};opacity:.75;font-weight:700;">${sub}</div>`:''}
        </div>`;

      // ── Property cards ────────────────────────────────────────────────────
      const propCards=allStats.map(({p,invested,mkt,gain,gainPct,equity,loan,hasMkt,effVal})=>{
        const pts=this.tenants.filter(t=>t.propId===p.id);
        const active=pts.filter(t=>t.status==='active');
        const monthlyRent=active.reduce((s,t)=>s+Number(t.rent||0)+Number(t.maint||0),0);
        const allColl=pts.reduce((s,t)=>s+this.payments.filter(pm=>pm.tenantId===t.id).reduce((a,b)=>a+Number(b.amount),0),0);
        const occupancyPct=pts.length?Math.round(active.length/pts.length*100):0;
        const typeColor={'Residential':'#1565c0','Commercial':'#7b1fa2','Agricultural':'#2e7d32','Plot':'#e65100','Other':'#455a64'}[p.type]||'#455a64';
        const typeBg   ={'Residential':'#e3f2fd','Commercial':'#f3e5f5','Agricultural':'#e8f5e9','Plot':'#fff3e0','Other':'#eceff1'}[p.type]||'#eceff1';

        return `<div class="card" style="cursor:pointer;border-top:3px solid ${typeColor};transition:box-shadow .2s;"
            onmouseover="this.style.boxShadow='0 4px 18px rgba(0,0,0,.12)'"
            onmouseout="this.style.boxShadow=''"
            onclick="APP.curProp='${p.id}';APP.renderProperty()">
          <!-- Card header -->
          <div style="padding:12px 14px 10px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div>
              <div style="font-weight:800;font-size:.9rem;color:var(--txt);margin-bottom:3px;">${p.name}</div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="background:${typeBg};color:${typeColor};font-size:.62rem;font-weight:800;padding:2px 8px;border-radius:5px;">${p.type}</span>
                ${p.city?`<span style="font-size:.65rem;color:var(--mut);">📍 ${p.city}</span>`:''}
                ${p.area?`<span style="font-size:.65rem;color:var(--mut);">📐 ${p.area} sq ft</span>`:''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Net Asset</div>
              <div style="font-size:.92rem;font-weight:900;color:#5c3496;font-family:'JetBrains Mono',monospace;">${equity?fmt(equity):'—'}</div>
            </div>
          </div>

          <!-- Financial row -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--bdr);border-bottom:1px solid var(--bdr);">
            <div style="padding:8px 10px;text-align:center;border-right:1px solid var(--bdr);">
              <div style="font-size:.55rem;color:var(--mut);text-transform:uppercase;font-weight:700;margin-bottom:3px;">Invested</div>
              <div style="font-size:.8rem;font-weight:800;color:var(--acc);font-family:'JetBrains Mono',monospace;">${fmt(invested)}</div>
            </div>
            <div style="padding:8px 10px;text-align:center;border-right:1px solid var(--bdr);">
              <div style="font-size:.55rem;color:var(--mut);text-transform:uppercase;font-weight:700;margin-bottom:3px;">Mkt Value</div>
              <div style="font-size:.8rem;font-weight:800;color:${hasMkt?'var(--grn)':'var(--mut)'};font-family:'JetBrains Mono',monospace;">${hasMkt?fmt(mkt):'—'}</div>
              ${gainPct!==null?`<div style="font-size:.58rem;font-weight:700;color:${gain>=0?'var(--grn)':'var(--red)'};">${gain>=0?'▲':'▼'}${Math.abs(gainPct)}%</div>`:''}
            </div>
            <div style="padding:8px 10px;text-align:center;">
              <div style="font-size:.55rem;color:var(--mut);text-transform:uppercase;font-weight:700;margin-bottom:3px;">Monthly Rent</div>
              <div style="font-size:.8rem;font-weight:800;color:var(--grn);font-family:'JetBrains Mono',monospace;">${monthlyRent?fmt(monthlyRent):'—'}</div>
            </div>
          </div>

          <!-- Tenant + collection row -->
          <div style="padding:8px 14px;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:.72rem;color:var(--mut);">
                👥 <b>${active.length}</b>/${pts.length} active
              </span>
              ${monthlyRent>0?`<div style="width:60px;height:5px;background:var(--dim);border-radius:3px;overflow:hidden;">
                <div style="width:${Math.min(100,Math.round(allColl/Math.max(1,monthlyRent*12)*100))}%;height:100%;background:var(--grn);border-radius:3px;"></div>
              </div>`:''}
            </div>
            <div style="font-size:.65rem;color:var(--mut);">Total collected: <b style="color:var(--grn);">${fmt(allColl)}</b></div>
          </div>

          <!-- Action buttons -->
          <div style="padding:8px 10px 10px;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--bdr);">
            <button class="btn b-sm" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:700;font-size:.68rem;"
              onclick="event.stopPropagation();APP.openValuationModal('${p.id}')">📈 Value</button>
            <button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;font-weight:700;font-size:.68rem;"
              onclick="event.stopPropagation();APP.openPropLedgerModal('${p.id}')">📒 Ledger</button>
            <button class="btn b-sm" style="background:#fff3e0;color:#b56a00;border:1.5px solid #ffcc80;font-weight:700;font-size:.68rem;"
              onclick="event.stopPropagation();APP._showPropDocs('${p.id}')">📎 Docs${p.propFiles&&p.propFiles.length?' ('+p.propFiles.length+')':''}</button>
            <button class="btn b-out b-sm" style="font-size:.68rem;margin-left:auto;"
              onclick="event.stopPropagation();APP.openPropModal('${p.id}')">✏️ Edit</button>
          </div>
        </div>`;
      }).join('');

      detail=`
        <!-- Portfolio KPI strip -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:20px;">
          ${kpi('Portfolio Value', totalPortfolio?fmt(totalPortfolio):'—', totalInvested?'Invested: '+fmt(totalInvested):null, '#1565c0','#e3f2fd','🏢')}
          ${kpi('Total Gain', totalGain?fmt(Math.abs(totalGain)):'—', gainPctAll?(totalGain>=0?'▲+':'▼')+gainPctAll+'% on market props':null, totalGain>=0?'#1a7a45':'#c0392b', totalGain>=0?'#f0faf5':'#fff5f5','📈')}
          ${kpi('Monthly Rent', fmt(totalRent), totalTenants+' active tenant'+(totalTenants!==1?'s':''), '#b56a00','#fff8ee','💰')}
          ${kpi('Net Asset Value', totalEquity?fmt(totalEquity):'—', totalLoan>0?'− Loan '+fmt(totalLoan):null,'#5c3496','#f5f0ff','🏦')}
          ${kpi('Properties', String(totalProp), ps.filter(p=>this.tenants.some(t=>t.propId===p.id&&t.status==='active')).length+' occupied','#0f6e56','#e1f5ee','🔑')}
        </div>

        <!-- Section header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="font-size:.88rem;font-weight:800;color:var(--txt);">All Properties</div>
          <div style="display:flex;gap:6px;">
            <button class="btn b-out b-sm" onclick="APP._showPropReport()" style="border-color:#5c3496;color:#5c3496;font-size:.72rem;">📊 Report</button>
            <button class="btn b-gold b-sm" onclick="APP.openPropModal()">+ Add Property</button>
          </div>
        </div>

        <!-- Property cards grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
          ${propCards||'<div class="empty" style="grid-column:1/-1;"><div class="ei">🏢</div>No properties yet<br><button class="btn b-gold" style="margin-top:8px" onclick="APP.openPropModal()">+ Add First Property</button></div>'}
        </div>`;

    // ════════════════════════════════════════════════════════════════════════
    // VIEW B — SINGLE PROPERTY DETAIL
    // ════════════════════════════════════════════════════════════════════════
    } else if(this.curProp){
      const p=ps.find(x=>x.id===this.curProp);
      if(p){
        const pts=this.tenants.filter(t=>t.propId===p.id);
        const activeTens=pts.filter(t=>t.status==='active');
        const st=_pStats(p);
        const now=new Date(),m=now.getMonth(),y=now.getFullYear();

        // Monthly collection — use ledger curMo.received so advance payments (rentForMonth) are counted correctly
        const monthColl=activeTens.reduce((s,t)=>{
          const lg=this.getTenantLedger(t);
          const curMoT=lg.months.find(mo=>mo.year===y&&mo.month===m);
          return s+(curMoT?curMoT.received:0);
        },0);
        const monthExp=activeTens.reduce((s,t)=>s+Number(t.rent||0)+Number(t.maint||0),0);
        const allColl=pts.reduce((s,t)=>s+this.payments.filter(pm=>pm.tenantId===t.id).reduce((a,b)=>a+Number(b.amount),0),0);
        const collectPct=monthExp>0?Math.min(100,Math.round(monthColl/monthExp*100)):0;

        const typeColor={'Residential':'#1565c0','Commercial':'#7b1fa2','Agricultural':'#2e7d32','Plot':'#e65100','Other':'#455a64'}[p.type]||'#455a64';
        const typeBg={'Residential':'#e3f2fd','Commercial':'#f3e5f5','Agricultural':'#e8f5e9','Plot':'#fff3e0','Other':'#eceff1'}[p.type]||'#eceff1';

        // ── Tenant cards ─────────────────────────────────────────────────────
        const tenCards=pts.map(t=>{
          const {got,total,bal,ledger}=_tRent(t);
          const daysUntilEnd=daysFrom(t.end);
          const statusColor={active:'#1a7a45',notice:'#b56a00',vacated:'#888',expired:'#c0392b'}[t.status]||'#888';
          const statusBg={active:'#e8f5e9',notice:'#fff8ee',vacated:'var(--dim)',expired:'#fee2e2'}[t.status]||'var(--dim)';
          const collectPctT=Number(t.rent)>0?Math.min(100,Math.round(got/Number(t.rent)*100)):0;

          return `<div class="card" style="border-top:3px solid ${statusColor};">
            <!-- Tenant header -->
            <div style="padding:11px 14px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div>
                <div style="font-weight:800;font-size:.88rem;margin-bottom:4px;">👤 ${t.name}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                  <span style="background:${statusBg};color:${statusColor};font-size:.6rem;font-weight:800;padding:2px 8px;border-radius:5px;">${t.status}</span>
                  ${t.ph?`<span style="font-size:.65rem;color:var(--mut);">📱 ${t.ph}</span>`:''}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Outstanding</div>
                <div style="font-size:.92rem;font-weight:900;color:${bal>0?'var(--red)':'var(--grn)'};font-family:'JetBrains Mono',monospace;">${bal>0?fmt(bal):'✓ Clear'}</div>
              </div>
            </div>

            <!-- Rent financial strip -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--bdr);border-bottom:1px solid var(--bdr);">
              <div style="padding:7px 10px;text-align:center;border-right:1px solid var(--bdr);">
                <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase;font-weight:700;margin-bottom:2px;">Rent</div>
                <div style="font-size:.8rem;font-weight:800;color:var(--acc);font-family:'JetBrains Mono',monospace;">${fmt(t.rent)}</div>
              </div>
              <div style="padding:7px 10px;text-align:center;border-right:1px solid var(--bdr);">
                <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase;font-weight:700;margin-bottom:2px;">This Month</div>
                <div style="font-size:.8rem;font-weight:800;color:${got>=Number(t.rent)?'var(--grn)':'var(--red)'};font-family:'JetBrains Mono',monospace;">${fmt(got)}</div>
              </div>
              <div style="padding:7px 10px;text-align:center;">
                <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase;font-weight:700;margin-bottom:2px;">Security</div>
                <div style="font-size:.8rem;font-weight:800;color:var(--txt);font-family:'JetBrains Mono',monospace;">${fmt(t.sec)}</div>
              </div>
            </div>

            <!-- Collection progress bar -->
            <div style="padding:8px 14px 4px;">
              <div style="display:flex;justify-content:space-between;font-size:.62rem;color:var(--mut);margin-bottom:4px;">
                <span>This month: ${collectPctT}% collected</span>
                <span style="color:${got>=Number(t.rent)?'var(--grn)':'var(--red)'};">${got>=Number(t.rent)?'✓ Full':'Due: '+fmt(Number(t.rent)-got)}</span>
              </div>
              <div style="height:5px;background:var(--dim);border-radius:3px;overflow:hidden;">
                <div style="width:${collectPctT}%;height:100%;background:${collectPctT>=100?'var(--grn)':'var(--org)'};border-radius:3px;transition:width .4s;"></div>
              </div>
            </div>

            <!-- Lease details -->
            <div style="padding:6px 14px 8px;font-size:.72rem;color:var(--mut);display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              ${t.start?`<span>📅 ${fD(t.start)} → ${t.end?fD(t.end):'ongoing'}</span>`:''}
              <span>🗓 Due: <b>${t.due}th</b></span>
              ${t.end&&daysUntilEnd!==null&&daysUntilEnd<=60?`<span style="background:${daysUntilEnd<=0?'#fee2e2':'#fef9c3'};color:${daysUntilEnd<=0?'#991b1b':'#854d0e'};padding:2px 7px;border-radius:4px;font-weight:700;font-size:.6rem;">⚠️ ${daysUntilEnd<=0?'Agreement expired':'Expires in '+daysUntilEnd+'d'}</span>`:''}
              <span style="margin-left:auto;">All-time: <b style="color:var(--grn);">${fmt(total)}</b></span>
            </div>

            <!-- Action buttons -->
            <div style="padding:8px 10px 10px;display:flex;gap:5px;flex-wrap:wrap;border-top:1px solid var(--bdr);">
              <button class="btn b-grn b-sm" style="font-size:.7rem;" onclick="APP.openPayModal('${t.id}')">💰 Pay</button>
              <button class="btn b-blu b-sm" style="font-size:.7rem;" onclick="APP.goTab('rent');APP.viewLedgerTid='${t.id}';APP.setRentSub('ledger')">📒 Ledger</button>
              <button class="btn b-out b-sm" style="font-size:.7rem;" onclick="APP.openTenModal('${t.id}')">✏️ Edit</button>
              <button style="background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;border-radius:7px;padding:4px 9px;font-size:.7rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;" onclick="APP._tenWA('${t.id}')">📲 WA</button>
              <button style="background:#fff0f0;color:#c5221f;border:1.5px solid #f4c2b8;border-radius:7px;padding:4px 9px;font-size:.7rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;" onclick="APP._tenEmail('${t.id}')">📧 Email</button>
              ${t.docFiles&&t.docFiles.length?`<button style="background:#fff8ee;color:#b56a00;border:1.5px solid #ffcc80;border-radius:7px;padding:4px 9px;font-size:.7rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;" onclick="APP._showTenDocs('${t.id}')">📎 ${t.docFiles.length}</button>`:''}
            </div>
          </div>`;
        }).join('')||`<div class="empty"><div class="ei">👥</div>No tenants yet<br>
          <button class="btn b-gold" style="margin-top:8px" onclick="APP.openTenModal(null,'${p.id}')">+ Add Tenant</button></div>`;

        // ── Property detail panel ────────────────────────────────────────────
        detail=`
          <!-- Property title bar -->
          <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                <span style="font-size:1.05rem;font-weight:900;color:var(--txt);">${p.name}</span>
                <span style="background:${typeBg};color:${typeColor};font-size:.65rem;font-weight:800;padding:2px 10px;border-radius:6px;">${p.type}</span>
                ${p.city?`<span style="font-size:.72rem;color:var(--mut);">📍 ${p.city}</span>`:''}
                ${p.area?`<span style="font-size:.72rem;color:var(--mut);">📐 ${p.area} sq ft</span>`:''}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${p.date?`<span style="font-size:.68rem;color:var(--mut);">🗓 Purchased ${fD(p.date)}</span>`:''}
                ${p.purchaseFrom?`<span style="font-size:.68rem;color:var(--mut);">🏗 From: ${p.purchaseFrom}</span>`:''}
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn b-sm" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:700;font-size:.72rem;" onclick="APP.openValuationModal('${p.id}')">📈 Value</button>
              <button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;font-weight:700;font-size:.72rem;" onclick="APP.openPropLedgerModal('${p.id}')">📒 Ledger</button>
              <button class="btn b-sm" style="background:#fce4ec;color:#c62828;border:1.5px solid #f48fb1;font-weight:700;font-size:.72rem;" onclick="APP.openMaintenanceModal('${p.id}')">🔧 Maint</button>
              <button class="btn b-sm" style="background:#e8eaf6;color:#283593;border:1.5px solid #9fa8da;font-weight:700;font-size:.72rem;" onclick="APP.openEMIModal('${p.id}')">🏦 EMI</button>
              <button class="btn b-sm" style="background:#e0f2f1;color:#00695c;border:1.5px solid #80cbc4;font-weight:700;font-size:.72rem;" onclick="APP.openROIModal('${p.id}')">📊 ROI</button>
              <button class="btn b-sm" style="background:#fff3e0;color:#b56a00;border:1.5px solid #ffcc80;font-weight:700;font-size:.72rem;" onclick="APP.openAddPaymentModal('${p.id}')">💰 Payment</button>
              ${p.propFiles&&p.propFiles.length?`<button class="btn b-sm" style="background:#fff8ee;color:#b56a00;border:1.5px solid #ffcc80;font-weight:700;font-size:.72rem;" onclick="APP._showPropDocs('${p.id}')">📎 Docs (${p.propFiles.length})</button>`:''}
              <button class="btn b-out b-sm" style="font-size:.72rem;" onclick="APP.openPropModal('${p.id}')">✏️ Edit</button>
            </div>
          </div>

          <!-- KPI row -->
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px;">
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:12px 14px;">
              <div style="font-size:.58rem;font-weight:800;color:var(--acc);text-transform:uppercase;margin-bottom:5px;">💰 Invested</div>
              <div style="font-size:1rem;font-weight:900;color:var(--acc);font-family:'JetBrains Mono',monospace;">${fmt(st.invested)}</div>
              ${st.ownFunds!==st.invested?`<div style="font-size:.6rem;color:var(--mut);margin-top:2px;">Own ${fmt(st.ownFunds)} · Loan ${fmt(st.loanFunds)}</div>`:''}
            </div>
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:12px 14px;">
              <div style="font-size:.58rem;font-weight:800;color:${st.hasMkt?'var(--grn)':'var(--mut)'};text-transform:uppercase;margin-bottom:5px;">📈 Market Value</div>
              <div style="font-size:1rem;font-weight:900;color:${st.hasMkt?'var(--grn)':'var(--mut)'};font-family:'JetBrains Mono',monospace;">${st.hasMkt?fmt(st.mkt):'Not set'}</div>
              ${st.gainPct!==null?`<div style="font-size:.6rem;font-weight:700;color:${st.gain>=0?'var(--grn)':'var(--red)'};">${st.gain>=0?'▲+':'▼'}${Math.abs(st.gainPct)}% · ${st.gain>=0?'+':''}${fmt(st.gain)}</div>`:''}
            </div>
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:12px 14px;">
              <div style="font-size:.58rem;font-weight:800;color:#5c3496;text-transform:uppercase;margin-bottom:5px;">🏦 Net Asset</div>
              <div style="font-size:1rem;font-weight:900;color:#5c3496;font-family:'JetBrains Mono',monospace;">${fmt(st.equity)}</div>
              ${st.loan>0?`<div style="font-size:.6rem;color:var(--red);margin-top:2px;">Loan: ${fmt(st.loan)}</div>`:''}
            </div>
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:12px 14px;">
              <div style="font-size:.58rem;font-weight:800;color:var(--org);text-transform:uppercase;margin-bottom:5px;">💵 This Month</div>
              <div style="font-size:1rem;font-weight:900;color:${monthColl>=monthExp?'var(--grn)':'var(--org)'};font-family:'JetBrains Mono',monospace;">${fmt(monthColl)}</div>
              <div style="font-size:.6rem;color:var(--mut);margin-top:2px;">of ${fmt(monthExp)} expected · ${collectPct}%</div>
            </div>
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:12px 14px;">
              <div style="font-size:.58rem;font-weight:800;color:var(--grn);text-transform:uppercase;margin-bottom:5px;">📊 All-time</div>
              <div style="font-size:1rem;font-weight:900;color:var(--grn);font-family:'JetBrains Mono',monospace;">${fmt(allColl)}</div>
              <div style="font-size:.6rem;color:var(--mut);margin-top:2px;">${pts.length} tenant${pts.length!==1?'s':''} · ${activeTens.length} active</div>
            </div>
          </div>

          <!-- Monthly collection bar -->
          ${monthExp>0?`<div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;font-size:.72rem;font-weight:700;margin-bottom:6px;">
              <span>This Month Collection</span>
              <span style="color:${collectPct>=100?'var(--grn)':'var(--org)'};">${fmt(monthColl)} / ${fmt(monthExp)} (${collectPct}%)</span>
            </div>
            <div style="height:8px;background:var(--dim);border-radius:4px;overflow:hidden;">
              <div style="width:${collectPct}%;height:100%;background:${collectPct>=100?'var(--grn)':collectPct>=50?'var(--org)':'var(--red)'};border-radius:4px;transition:width .5s;"></div>
            </div>
          </div>`:''}

          <!-- Tenants section -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="font-size:.88rem;font-weight:800;color:var(--txt);">Tenants <span style="font-family:'JetBrains Mono',monospace;font-size:.65rem;background:var(--acc);color:#fff;padding:1px 7px;border-radius:10px;">${pts.length}</span></div>
            <button class="btn b-gold b-sm" onclick="APP.openTenModal(null,'${p.id}')">+ Add Tenant</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
            ${tenCards}
          </div>`;
      }
    }

    document.getElementById('pan-property').innerHTML=`
      <div class="sec-hdr">
        <div class="sec-title">Properties <span class="ct">${ps.length}</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn b-gold" onclick="APP.openPropModal()">+ Add Property</button>
          <button class="btn b-out" onclick="APP._showPropReport()" style="border-color:#5c3496;color:#5c3496;font-weight:800;">📊 Report</button>
        </div>
      </div>
      <div class="prop-nav">${nav}</div>
      ${detail}`;
  },


  openTenModal(id,propId){
    this.editId=id||null;
    document.getElementById('tenMT').textContent=id?'✏️ Edit Tenant':'👤 Add Tenant';
    const ps=document.getElementById('tnm_prop');
    ps.innerHTML=this.props.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    if(propId)ps.value=propId;
    if(id){
      const t=this.tenants.find(x=>x.id===id);
      ['name','ph','ph2','email','email2','idtype','idno','addr','rent','sec','adv','maint','mode','status','doc','notes'].forEach(f=>sv('tnm_'+f,t[f]||''));
      ps.value=t.propId;
      document.getElementById('tnm_due').value=t.due||5;
      document.getElementById('tnm_recurring').value=t.recurring||'no';
      document.getElementById('tnm_invdate_row').style.display=t.recurring==='yes'?'':'none';
      svDate('tnm_start',t.start);svDate('tnm_end',t.end);
      svDate('tnm_invdate',t.invdate||'');
    }else{
      ['name','ph','ph2','email','email2','idno','addr','rent','sec','adv','maint','doc','notes'].forEach(f=>sv('tnm_'+f,''));
      document.getElementById('tnm_due').value='5';
      document.getElementById('tnm_status').value='active';
      document.getElementById('tnm_recurring').value='no';
      document.getElementById('tnm_invdate_row').style.display='none';
      svDate('tnm_start','');svDate('tnm_end','');svDate('tnm_invdate','');
    }
    // Init tenant doc upload zone
    FUM.clear('fu_ten_doc_wrap');
    FUM.init('fu_ten_doc_wrap','tenant-docs',[]);
    if(id){
      const t=this.tenants.find(x=>x.id===id);
      if(t){
        if(t.docFiles&&t.docFiles.length){
          FUM.init('fu_ten_doc_wrap','tenant-docs',t.docFiles);
        } else if(t.doc){
          FUM.loadLegacyLinks('fu_ten_doc_wrap',[t.doc]);
        }
      }
    }
    // Load rent history in modal
    APP._tnmLoadHistory(id?((APP.tenants||[]).find(x=>x.id===id)||{}).rentHistory||[]:[],'tnm_rent_history_wrap');
    M.open('tenM');
  },
  saveTenant(){
    // Debounce: prevent double/triple tap on mobile from firing multiple times
    if (this._saveTenantBusy) return;
    this._saveTenantBusy = true;
    setTimeout(() => { this._saveTenantBusy = false; }, 1500);

    try {
      const name=v('tnm_name'),rent=v('tnm_rent');
      if(!name){ alert('Tenant name required!'); return; }
      if(!rent){ alert('Monthly rent required!'); return; }

      const _tenDocFiles = (window.FUM && FUM.getFiles) ? FUM.getFiles('fu_ten_doc_wrap') : [];
      // If FUM has files use them; if FUM is empty keep existing docFiles (don't wipe them)
      const _existingDocs = this.editId ? (this.tenants.find(t=>t.id===this.editId)||{}).docFiles||[] : [];
      const _finalDocFiles = _tenDocFiles.length > 0 ? _tenDocFiles : _existingDocs;
            const _existingRH=this.editId?((this.tenants.find(t=>t.id===this.editId)||{}).rentHistory||[]):[];
      const _uiRH=(window._tnmRentHistory&&window._tnmRentHistory.length)?window._tnmRentHistory:_existingRH;
      const data={name,ph:v('tnm_ph'),ph2:v('tnm_ph2'),email:v('tnm_email'),email2:v('tnm_email2'),idtype:v('tnm_idtype'),idno:v('tnm_idno'),addr:v('tnm_addr'),propId:v('tnm_prop'),rent:Number(rent),sec:Number(v('tnm_sec')),adv:Number(v('tnm_adv')),maint:Number(v('tnm_maint'))||0,start:vDate('tnm_start'),end:vDate('tnm_end'),due:Number(v('tnm_due')),mode:v('tnm_mode'),status:v('tnm_status'),doc:v('tnm_doc'),notes:v('tnm_notes'),recurring:v('tnm_recurring'),invdate:vDate('tnm_invdate'),docFiles:_finalDocFiles,rentHistory:_uiRH};

      let ts=this.tenants;
      if(this.editId){
        ts=ts.map(t=>t.id===this.editId?{...t,...data}:t);
      } else {
        data.id=uid();
        ts.push(data);
      }
      S.set('tenants',ts);
      M.close('tenM');
      try{ this.syncRentReminders(); }catch(e){ console.error('[saveTenant] Sync error:',e); }
      this.renderTab(this.curTab);
      this.renderPills();

    } catch(error) {
      console.error('[saveTenant] Error:', error);
      alert('Error saving tenant: ' + error.message);
    }
  },
  // ── Rent History helpers ──────────────────────────────────────────────
  _tnmLoadHistory(history, wrapId){
    window._tnmRentHistory = history ? [...history] : [];
    APP._tnmRenderHistory(wrapId||'tnm_rent_history_wrap');
  },
  _tnmRenderHistory(wrapId){
    const wrap=document.getElementById(wrapId||'tnm_rent_history_wrap');
    if(!wrap) return;
    const h=window._tnmRentHistory||[];
    const empty=document.getElementById('tnm_rh_empty');
    if(!h.length){
      if(empty) empty.style.display='';
      wrap.querySelectorAll('.rh-row').forEach(x=>x.remove());
      return;
    }
    if(empty) empty.style.display='none';
    wrap.querySelectorAll('.rh-row').forEach(x=>x.remove());
    [...h].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach((row,i)=>{
      const pct=row.from>0?((row.to-row.from)/row.from*100).toFixed(1):null;
      const el=document.createElement('div');
      el.className='rh-row';
      el.style.cssText='display:flex;align-items:center;gap:8px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 11px;font-size:.78rem;';
      el.innerHTML=`<span style="font-size:1rem;">📈</span>
        <div style="flex:1;">
          <div style="font-weight:700;color:#1e40af;">₹${row.from.toLocaleString('en-IN')} → ₹${row.to.toLocaleString('en-IN')}${pct?' <span style="color:#1a7a45;font-size:.7rem;">(+'+pct+'%)</span>':''}</div>
          <div style="color:var(--mut);font-size:.7rem;">${row.date||'—'}${row.reason?' · '+row.reason:''}</div>
        </div>
        <button onclick="APP._tnmDeleteHike('+i+')" style="background:#fee2e2;color:#c0392b;border:none;border-radius:5px;padding:2px 7px;font-size:.7rem;cursor:pointer;font-family:&apos;Nunito&apos;,sans-serif;">✕</button>`;
      wrap.appendChild(el);
    });
  },
  _tnmAddRentHike(){
    // Pre-fill from current rent field
    const rentVal=document.getElementById('tnm_rent')?document.getElementById('tnm_rent').value:'';
    const fromEl=document.getElementById('tnm_hk_from');
    const toEl=document.getElementById('tnm_hk_to');
    const dateEl=document.getElementById('tnm_hk_date');
    const reasonEl=document.getElementById('tnm_hk_reason');
    if(fromEl && rentVal) fromEl.value=rentVal;
    if(toEl) toEl.value='';
    if(dateEl) dateEl.value='';
    if(reasonEl) reasonEl.value='';
    const form=document.getElementById('tnm_hike_form');
    if(form) form.style.display='';
  },
  _tnmSaveHike(){
    const from=Number(document.getElementById('tnm_hk_from')?document.getElementById('tnm_hk_from').value:0);
    const to=Number(document.getElementById('tnm_hk_to')?document.getElementById('tnm_hk_to').value:0);
    const dateRaw=document.getElementById('tnm_hk_date')?document.getElementById('tnm_hk_date').value.trim():'';
    const reason=document.getElementById('tnm_hk_reason')?document.getElementById('tnm_hk_reason').value.trim():'';
    if(!to){ alert('New rent amount required'); return; }
    // Accept DD/MM/YYYY or YYYY-MM-DD
    let dateIso='';
    if(dateRaw){
      if(/^\d{2}\/\d{2}\/\d{4}$/.test(dateRaw)){
        const [dd,mm,yyyy]=dateRaw.split('/');
        dateIso=yyyy+'-'+mm+'-'+dd;
      } else if(/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)){
        dateIso=dateRaw;
      }
    }
    if(!window._tnmRentHistory) window._tnmRentHistory=[];
    window._tnmRentHistory.push({from,to,date:dateIso||dateRaw,reason,id:'rh_'+Date.now()});
    // Update current rent field to new value
    const rentEl=document.getElementById('tnm_rent');
    if(rentEl && to) rentEl.value=to;
    APP._tnmRenderHistory('tnm_rent_history_wrap');
    const form=document.getElementById('tnm_hike_form');
    if(form) form.style.display='none';
  },
  _tnmDeleteHike(idx){
    if(!window._tnmRentHistory) return;
    const sorted=[...window._tnmRentHistory].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const item=sorted[idx];
    if(item) window._tnmRentHistory=window._tnmRentHistory.filter(x=>x.id!==item.id);
    APP._tnmRenderHistory('tnm_rent_history_wrap');
  },

  _showTenDocs(id){
    const t = this.tenants.find(x=>x.id===id);
    if(!t) return;
    // Check all possible storage locations for docs
    const docs = (t.docFiles&&t.docFiles.length) ? t.docFiles
               : (t.doc ? [{url:t.doc,name:'Document',type:'',size:0}] : []);
    // Also check FUM session if Edit modal was recently used
    const fumDocs = (window.FUM && FUM.sessions && FUM.sessions['fu_ten_doc_wrap'])
      ? FUM.sessions['fu_ten_doc_wrap'].filter(f=>f.status==='done'&&f.url)
        .map(({url,path,name,size,type})=>({url,path,name,size,type}))
      : [];
    const allDocs = docs.length ? docs : fumDocs;

    const icon = f => f.type&&f.type.startsWith('image/') ? '🖼️' : f.name&&f.name.toLowerCase().endsWith('.pdf') ? '📄' : f.name&&(f.name.toLowerCase().endsWith('.doc')||f.name.toLowerCase().endsWith('.docx')) ? '📝' : '📎';
    const sz = b => !b ? '' : b>1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';

    let html;
    if(!allDocs.length){
      html = `<div style="padding:8px 0;text-align:center;">
        <div style="font-size:2rem;margin-bottom:10px;">📭</div>
        <div style="font-size:.9rem;font-weight:800;color:var(--txt);margin-bottom:6px;">${t.name}</div>
        <div style="font-size:.82rem;color:var(--mut);margin-bottom:8px;">Koi document is tenant ke record mein save nahi hai</div>
        <div style="background:#fff8ee;border:1.5px solid #ffcc80;border-radius:9px;padding:10px 14px;font-size:.78rem;color:#7a4400;margin-bottom:14px;text-align:left;line-height:1.6;">
          <b>📋 Files save karne ke steps:</b><br>
          1. ✏️ Edit button dabao<br>
          2. 📎 File Upload Karo button se files attach karo<br>
          3. 💾 Save Tenant dabao<br>
          4. Wapas aao — Files button mein files dikhenge
        </div>
        <button onclick="M.close('eiM');setTimeout(()=>APP.openTenModal('${id}'),100);"
          style="background:var(--acc);color:#fff;border:none;border-radius:9px;padding:10px 22px;font-size:.85rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;width:100%;">
          ✏️ Edit Tenant → Attach Files
        </button>
      </div>`;
    } else {
      html = `<div style="padding:4px 0;">
        <div style="background:#fff8ee;border:1.5px solid #ffcc80;border-radius:9px;padding:9px 13px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.1rem;">👤</span>
          <div>
            <div style="font-size:.85rem;font-weight:800;color:var(--txt);">${t.name}</div>
            <div style="font-size:.72rem;color:var(--mut);">${allDocs.length} document${allDocs.length>1?'s':''} attached</div>
          </div>
        </div>
        ${allDocs.map(f=>`
          <div style="background:var(--dim);border-radius:10px;border:1.5px solid var(--bdr2);padding:11px 13px;margin-bottom:9px;">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:9px;">
              <span style="font-size:1.5rem;flex-shrink:0;">${icon(f)}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:.82rem;font-weight:700;color:var(--txt);word-break:break-all;line-height:1.3;">${f.name||'Document'}</div>
                ${f.size?`<div style="font-size:.7rem;color:var(--mut);margin-top:2px;">${sz(f.size)}</div>`:''}
              </div>
            </div>
            <div style="display:flex;gap:7px;">
              <a href="${f.url}" target="_blank"
                style="flex:1;text-align:center;padding:9px 6px;background:var(--acc);color:#fff;border-radius:8px;font-size:.82rem;font-weight:800;text-decoration:none;touch-action:manipulation;">
                👁 View / Open
              </a>
              <button onclick="APP.downloadFile('${f.url}', '${f.name||'document'}'); event.stopPropagation();"
                style="flex:1;text-align:center;padding:9px 6px;background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;border-radius:8px;font-size:.82rem;font-weight:800;cursor:pointer;touch-action:manipulation;font-family:'Nunito',sans-serif;">
                ⬇️ Download
              </button>
            </div>
          </div>`).join('')}
        <button onclick="M.close('eiM');setTimeout(()=>APP.openTenModal('${id}'),100);"
          style="width:100%;background:var(--dim);color:var(--mut);border:1.5px dashed var(--bdr2);border-radius:9px;padding:9px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;margin-top:4px;touch-action:manipulation;">
          + Add More Files (Edit Tenant)
        </button>
      </div>`;
    }
    document.getElementById('eiMT').textContent = '📎 Documents — ' + t.name;
    document.getElementById('eiMB').innerHTML = html;
    M.open('eiM');
  },

  _showPropDocs(id){
    const p = this.props.find(x=>x.id===id);
    if(!p) return;
    const docs = (p.propFiles&&p.propFiles.length) ? p.propFiles : [];
    const icon = f => f.type&&f.type.startsWith('image/') ? '🖼️' : f.name&&f.name.toLowerCase().endsWith('.pdf') ? '📄' : f.name&&(f.name.toLowerCase().endsWith('.doc')||f.name.toLowerCase().endsWith('.docx')) ? '📝' : '📎';
    const sz = b => !b ? '' : b>1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';

    let html;
    if(!docs.length){
      html = `<div style="padding:8px 0;text-align:center;">
        <div style="font-size:2rem;margin-bottom:10px;">📭</div>
        <div style="font-size:.9rem;font-weight:800;color:var(--txt);margin-bottom:6px;">${p.name}</div>
        <div style="font-size:.82rem;color:var(--mut);margin-bottom:8px;">Koi document is property ke record mein save nahi hai</div>
        <div style="background:#fff8ee;border:1.5px solid #ffcc80;border-radius:9px;padding:10px 14px;font-size:.78rem;color:#7a4400;margin-bottom:14px;text-align:left;line-height:1.6;">
          <b>📋 Files save karne ke steps:</b><br>
          1. ✏️ Edit button dabao<br>
          2. 📎 File Upload section mein files attach karo<br>
          3. 💾 Save Property dabao<br>
          4. Wapas aao — Docs button mein files dikhenge
        </div>
        <button onclick="M.close('eiM');setTimeout(()=>APP.openPropModal('${id}'),100);"
          style="background:var(--acc);color:#fff;border:none;border-radius:9px;padding:10px 22px;font-size:.85rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;width:100%;">
          ✏️ Edit Property → Attach Files
        </button>
      </div>`;
    } else {
      html = `<div style="padding:4px 0;">
        <div style="background:#fff8ee;border:1.5px solid #ffcc80;border-radius:9px;padding:9px 13px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.1rem;">🏢</span>
          <div>
            <div style="font-size:.85rem;font-weight:800;color:var(--txt);">${p.name}</div>
            <div style="font-size:.72rem;color:var(--mut);">${docs.length} document${docs.length>1?'s':''} attached</div>
          </div>
        </div>
        ${docs.map(f=>`
          <div style="background:var(--dim);border-radius:10px;border:1.5px solid var(--bdr2);padding:11px 13px;margin-bottom:9px;">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:9px;">
              <span style="font-size:1.5rem;flex-shrink:0;">${icon(f)}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:.82rem;font-weight:700;color:var(--txt);word-break:break-all;line-height:1.3;">${f.name||'Document'}</div>
                ${f.size?`<div style="font-size:.7rem;color:var(--mut);margin-top:2px;">${sz(f.size)}</div>`:''}
              </div>
            </div>
            <div style="display:flex;gap:7px;">
              <a href="${f.url}" target="_blank"
                style="flex:1;text-align:center;padding:9px 6px;background:var(--acc);color:#fff;border-radius:8px;font-size:.82rem;font-weight:800;text-decoration:none;touch-action:manipulation;">
                👁 View / Open
              </a>
              <button onclick="APP.downloadFile('${f.url}', '${(f.name||'document').replace(/'/g,'')}'); event.stopPropagation();"
                style="flex:1;text-align:center;padding:9px 6px;background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;border-radius:8px;font-size:.82rem;font-weight:800;cursor:pointer;touch-action:manipulation;font-family:'Nunito',sans-serif;">
                ⬇️ Download
              </button>
            </div>
          </div>`).join('')}
        <button onclick="M.close('eiM');setTimeout(()=>APP.openPropModal('${id}'),100);"
          style="width:100%;background:var(--dim);color:var(--mut);border:1.5px dashed var(--bdr2);border-radius:9px;padding:9px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;margin-top:4px;touch-action:manipulation;">
          + Add More Files (Edit Property)
        </button>
      </div>`;
    }
    document.getElementById('eiMT').textContent = '📎 Documents — ' + p.name;
    document.getElementById('eiMB').innerHTML = html;
    M.open('eiM');
  },

  // ── Safe WA handler — always shows button, alerts if no phone ──
  _tenWA(id){
    const t = this.tenants.find(x=>x.id===id);
    if(!t) return;
    if(!t.ph){
      alert('📵 Phone number not available for ' + t.name + '.\n\nPlease edit the tenant and add a phone number to enable WhatsApp.');
      return;
    }
    const fmt = window.fmt||(n=>n.toLocaleString('en-IN'));
    const now = new Date();
    const ledger = this.getTenantLedger(t);
    const prop = this.props.find(p=>p.id===t.propId);
    const msg = encodeURIComponent(
      '💰 *Rent Due Notice*\n\nDear ' + t.name + ',\n\n' +
      'Property: ' + (prop?prop.name:'—') + '\n' +
      'Monthly Rent: ₹' + fmt(t.rent) + '\n' +
      'Due Date: ' + t.due + 'th of every month\n' +
      'Total Outstanding: ₹' + fmt(ledger.totalBalance) + '\n\n' +
      'Please pay at the earliest.\n\nThank you,\nRaman Kumar'
    );
    window.open('https://wa.me/' + t.ph.replace(/\D/g,'') + '?text=' + msg, '_blank');
  },

  // ── Safe Email handler — always shows button, alerts if no email ──
  _tenEmail(id){
    const t = this.tenants.find(x=>x.id===id);
    if(!t) return;
    if(!t.email){
      alert('📭 Email address not available for ' + t.name + '.\n\nPlease edit the tenant and add an email address to enable email.');
      return;
    }
    const fmt = window.fmt||(n=>n.toLocaleString('en-IN'));
    const ledger = this.getTenantLedger(t);
    const subj = encodeURIComponent('Rent Due — ' + t.name);
    const body = encodeURIComponent(
      'Dear ' + t.name + ',\n\n' +
      'Your rent is due.\n\n' +
      'Monthly Rent: ₹' + fmt(t.rent) + '\n' +
      'Outstanding: ₹' + fmt(ledger.totalBalance) + '\n\n' +
      'Please pay at the earliest.\n\nRegards,\nRaman Kumar'
    );
    window.open('mailto:' + t.email + '?subject=' + subj + '&body=' + body);
  },

  delTenant(id){
    this.delCb=()=>{S.set('tenants',this.tenants.filter(t=>t.id!==id));S.set('payments',this.payments.filter(p=>p.tenantId!==id));this.renderTab(this.curTab);this.renderPills();};
    document.getElementById('delMsg').textContent='Delete tenant and all payment history?';M.open('delM');
  },

  // ══ RENT ══
  _setPayType(t){
    const hid=document.getElementById('pym_type');
    if(hid) hid.value=t;

    const btnPay=document.getElementById('pym_btn_pay');
    const btnRef=document.getElementById('pym_btn_ref');
    const refNote=document.getElementById('pym_refund_note');
    const amtLbl=document.getElementById('pym_amt_label');
    const saveBtn=document.getElementById('pym_save_btn');

    if(t==='payment'){
      if(btnPay){btnPay.style.background='#f0fdf4';btnPay.style.color='#16a34a';btnPay.style.borderBottom='3px solid #16a34a';btnPay.style.fontWeight='800';}
      if(btnRef){btnRef.style.background='var(--dim)';btnRef.style.color='var(--mut)';btnRef.style.borderBottom='3px solid transparent';btnRef.style.fontWeight='700';}
      if(refNote) refNote.style.display='none';
      if(amtLbl) amtLbl.textContent='AMOUNT (₹) — Payment Received *';
      if(saveBtn){saveBtn.textContent='✓ Save Payment';saveBtn.className='btn b-grn';saveBtn.style.flex='2';}
      const amt=document.getElementById('pym_amt');
      if(amt){amt.style.color='#16a34a';amt.style.borderColor='var(--bdr2)';}
    } else {
      if(btnRef){btnRef.style.background='#fff0f0';btnRef.style.color='#c0392b';btnRef.style.borderBottom='3px solid #c0392b';btnRef.style.fontWeight='800';}
      if(btnPay){btnPay.style.background='var(--dim)';btnPay.style.color='var(--mut)';btnPay.style.borderBottom='3px solid transparent';btnPay.style.fontWeight='700';}
      if(refNote) refNote.style.display='block';
      if(amtLbl) amtLbl.textContent='AMOUNT (₹) — Refund to Tenant *';
      if(saveBtn){saveBtn.textContent='↩️ Save Refund';saveBtn.className='btn b-red';saveBtn.style.flex='2';}
      const amt=document.getElementById('pym_amt');
      if(amt){amt.style.color='#c0392b';amt.style.borderColor='#fecaca';}
    }
  },

  // ── Populate "Rent For Month" dropdown ──
  _populateRentMonthSel(defaultVal, payDateStr){
    const sel = document.getElementById('pym_rent_month');
    if(!sel) return;
    const now = new Date();
    // If no explicit defaultVal given, derive from payment date + tenant due day
    let curVal = defaultVal;
    if(!curVal && payDateStr){
      const _t2 = this.payTId ? this.tenants.find(x=>x.id===this.payTId) : null;
      const dueDay = _t2 ? Number(_t2.due)||7 : 7;
      const _rm2 = getRentMonth(payDateStr, dueDay);
      curVal = _rm2.key;
      // Clamp to tenant start month
      if(_t2 && _t2.start && curVal < _t2.start.slice(0,7)){
        curVal = _t2.start.slice(0,7);
      }
      console.log('[_populateRentMonthSel] auto-selected rent month:', curVal, 'for payDate:', payDateStr, 'dueDay:', dueDay);
    }
    if(!curVal) curVal = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    let opts = '';
    for(let i = -6; i <= 2; i++){
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const val = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      const label = MONTHS[d.getMonth()] + ' ' + d.getFullYear()
        + (i===0?' (Current)':i<0?' (Past)':' (Advance)');
      opts += `<option value="${val}"${val===curVal?' selected':''}>${label}</option>`;
    }
    sel.innerHTML = opts;
    // If curVal not in range, prepend it
    if(!sel.value || sel.value !== curVal){
      const [cy,cm] = curVal.split('-');
      const d2 = new Date(parseInt(cy), parseInt(cm)-1, 1);
      const extraLabel = MONTHS[d2.getMonth()] + ' ' + d2.getFullYear() + ' (Selected)';
      sel.innerHTML = `<option value="${curVal}" selected>${extraLabel}</option>` + sel.innerHTML;
      sel.value = curVal;
    }
  },

  openPayModal(tid){
    this.payTId=tid;
    this.payEditId=null;
    const t=this.tenants.find(x=>x.id===tid);
    if(!t){ console.warn('openPayModal: tenant not found',tid); return; }
    const prop=this.props.find(p=>p.id===t.propId);
    const _pmtEl=document.getElementById('payMT');if(_pmtEl)_pmtEl.textContent='💰 New Payment — '+t.name;
    this._setPayType('payment'); // reset to payment mode
    const _delBtn=document.getElementById('pym_del_btn');if(_delBtn)_delBtn.style.display='none';
    const now=new Date(),m=now.getMonth(),y=now.getFullYear();
    const ledger=this.getTenantLedger(t);
    const curMo=ledger.months.find(mo=>mo.year===y&&mo.month===m);
    const curMonthDue=curMo?Math.max(0,curMo.monthlyTotal-curMo.received):Number(t.rent);
    const totalOutstanding=ledger.totalBalance;
    const _maintAmt=Number(t.maint)||0;
    document.getElementById('payM_info').innerHTML=
      '<b>'+t.name+'</b> | '+(prop?prop.name:'')+'<br>'
      +'Rent: <b>'+fmt(t.rent)+'</b>'
      +(_maintAmt?' + Maint: <b>'+fmt(_maintAmt)+'</b>':'')
      +' | Due: <b>'+t.due+'th</b>';
    document.getElementById('payM_bal').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.82rem;">
        <div style="background:#fff8ee;border-radius:7px;padding:8px 10px;">
          <div style="font-size:.65rem;color:var(--mut);text-transform:uppercase;font-weight:700;">This Month Due</div>
          <div style="font-weight:700;color:${curMonthDue>0?'var(--red)':'var(--grn)'};font-size:1rem">${curMonthDue>0?fmt(curMonthDue):'✓ Paid'}</div>
        </div>
        <div style="background:#fff0f0;border-radius:7px;padding:8px 10px;">
          <div style="font-size:.65rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Total Outstanding</div>
          <div style="font-weight:700;color:${totalOutstanding>0?'var(--red)':'var(--grn)'};font-size:1rem">${totalOutstanding>0?fmt(totalOutstanding):'✓ Clear'}</div>
        </div>
      </div>`;
    sv('pym_amt',totalOutstanding>0?totalOutstanding:t.rent);
    svDate('pym_date',now.toISOString().split('T')[0]);
    sv('pym_ref','');sv('pym_note','');sv('pym_mode','NEFT');
    sc('pym_chkRent',true);sc('pym_chkMaint',false);sc('pym_chkOther',false);
    // Init date picker — rebuild every time modal opens so date is fresh
    const _pdw = document.getElementById('pym_date_wrap');
    const _todayForDate = (function(){const _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    if(_pdw && typeof makeDateInput==='function'){ _pdw.innerHTML = makeDateInput('pym_date', _todayForDate); }
    // Also set hidden date input directly as backup
    const _pdh = document.getElementById('pym_date_h');
    if(_pdh) _pdh.value = _todayForDate;
    // When user picks a different date, auto-update the Rent For Month dropdown
    const _pdh2 = document.getElementById('pym_date_h');
    if(_pdh2){
      _pdh2.addEventListener('change', ()=>{
        const iso = _pdh2.value;
        if(iso) this._populateRentMonthSel(null, iso);
      });
    }
    try{ FUM.clear('fu_pay_receipt_wrap'); FUM.init('fu_pay_receipt_wrap','payments',[]); }catch(e){ console.warn('FUM init error:',e); }
    // Auto-pick rent cycle month based on today's date + tenant's due day
    const _todayIso = (function(){const _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    this._populateRentMonthSel(null, _todayIso);
    M.open('payM');
    console.log('[openPayModal] opened for tenant:', tid, 'payTId set to:', this.payTId);
  },

  openEditPayModal(pid){
    const p=this.payments.find(x=>x.id===pid);
    if(!p)return;
    const t=this.tenants.find(x=>x.id===p.tenantId);
    const prop=t&&this.props.find(x=>x.id===t.propId);
    this.payTId=p.tenantId;
    this.payEditId=pid;
    const _pmtEl2=document.getElementById('payMT');if(_pmtEl2)_pmtEl2.textContent='✏️ Edit Payment — '+(t?t.name:'');
    document.getElementById('pym_del_btn').style.display='inline-flex';
    document.getElementById('payM_info').innerHTML=`
      <b>Editing Payment</b> — ${t?t.name:''} | ${prop?prop.name:''}
      <div style="margin-top:4px;background:#fff0f0;border-radius:6px;padding:4px 8px;font-size:.76rem;color:var(--red);">
        ⚠️ Edit karein ya 🗑 Delete karein — Delete button andar hai
      </div>`;
    document.getElementById('payM_bal').innerHTML='';
    sv('pym_amt',p.amount);
    svDate('pym_date',p.date);
    sv('pym_ref',p.ref||'');
    sv('pym_note',p.note||'');
    sc('pym_chkRent',p.incRent!==false);
    sc('pym_chkMaint',!!p.incMaint);
    sc('pym_chkOther',false);
    try{ FUM.clear('fu_pay_receipt_wrap'); FUM.init('fu_pay_receipt_wrap','payments',p.receiptFiles||[]); }catch(e){ console.warn('FUM init (edit) error:',e); }
    // Rebuild date picker with payment's date
    const _pdwE = document.getElementById('pym_date_wrap');
    if(_pdwE){ _pdwE.innerHTML = makeDateInput('pym_date', p.date||''); }
    svDate('pym_date', p.date||'');
    // For edit: use stored rentForMonth. If missing, derive from payment date + due day
    let _editRfm = p.rentForMonth || '';
    if(!_editRfm && p.date){
      const _et = this.tenants.find(x=>x.id===p.tenantId);
      const _eDue = _et ? Number(_et.due)||7 : 7;
      _editRfm = getRentMonth(p.date, _eDue).key;
    }
    this._populateRentMonthSel(_editRfm || (p.date ? p.date.slice(0,7) : null));
    M.open('payM');
    console.log('[openEditPayModal] editing payment:', p.id, 'rentForMonth:', _editRfm);
  },

  // Open pay modal in refund mode
  _openRefundModal(tid){
    this.openPayModal(tid);
    // Switch to refund mode after modal opens
    setTimeout(()=>this._setPayType('refund'),100);
  },

  // Open refund from ledger row — pre-fill date to that month
  _openRefundFromLedger(tid,year,month){
    this.openPayModal(tid);
    setTimeout(()=>{
      this._setPayType('refund');
      // Pre-fill note
      const noteEl=document.getElementById('pym_note');
      const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
      if(noteEl) noteEl.value='Refund for '+MONTHS[parseInt(month)]+' '+year;
    },100);
  },

  deleteCurrentPayment(){
    if(!this.payEditId)return;
    if(!confirm('Yeh payment delete karein? Yeh action undo nahi hoga!'))return;
    S.set('payments',this.payments.filter(p=>p.id!==this.payEditId));
    this.payEditId=null;
    try{ this.syncRentReminders(); }catch(e){}
    M.close('payM');
    this.renderTab(this.curTab);
    this.renderPills();
    this.showToastMsg('✅ Payment delete ho gaya!');
  },

  savePayment(){
    console.log('[savePayment] called. payTId:', this.payTId, 'payEditId:', this.payEditId);
    // Guard: must have a tenant ID
    if(!this.payTId && !this.payEditId){
      alert('Error: No tenant selected. Please close and re-open the payment form.');
      console.error('[savePayment] payTId is missing!');
      return;
    }

    // Disable save button to prevent double-submit
    const _saveBtn = document.getElementById('pym_save_btn');
    if(_saveBtn){ _saveBtn.disabled = true; _saveBtn.textContent = '⏳ Saving...'; }

    const _restoreBtn = () => {
      if(_saveBtn){
        _saveBtn.disabled = false;
        const ptype2 = document.getElementById('pym_type') ? document.getElementById('pym_type').value : 'payment';
        _saveBtn.textContent = ptype2 === 'refund' ? '↩️ Save Refund' : '✓ Save Payment';
      }
    };

    try {
      // ── Validation ──
      const amt = v('pym_amt').replace(/,/g,'');
      if(!amt || isNaN(Number(amt)) || Number(amt) <= 0){
        alert('Valid amount daalo! (0 se zyada hona chahiye)');
        _restoreBtn(); return;
      }
      const date = vDate('pym_date') || (function(){
        const _n=new Date();
        return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');
      })();
      if(!date){ alert('Date required! DD/MM/YYYY format mein bharo.'); _restoreBtn(); return; }

      const ptype = document.getElementById('pym_type') ? document.getElementById('pym_type').value : 'payment';

      // Determine rentForMonth: dropdown value → getRentMonth fallback
      let rentForMonth = v('pym_rent_month') || '';
      if(!rentForMonth){
        const _t = this.payTId ? this.tenants.find(x=>x.id===this.payTId) : null;
        const _dueDay = _t ? Number(_t.due)||7 : 7;
        const _rm = getRentMonth(date, _dueDay);
        rentForMonth = _rm.key;
        // Clamp: never assign to a month before tenant's agreement start
        if(_t && _t.start){
          const _startKey = _t.start.slice(0,7); // YYYY-MM
          if(rentForMonth < _startKey){
            rentForMonth = _startKey;
            console.log('[savePayment] rentForMonth clamped to tenant start:', rentForMonth);
          }
        }
        console.log('[savePayment] rentForMonth auto-derived:', rentForMonth, 'from date:', date, 'dueDay:', _dueDay);
      }

      // Safe FUM access
      let receiptFiles = [];
      try { receiptFiles = (window.FUM && FUM.getFiles) ? FUM.getFiles('fu_pay_receipt_wrap') || [] : []; }
      catch(e){ console.warn('[savePayment] FUM.getFiles error:', e); }

      let ps = [...this.payments];

      const payData = {
        amount: Number(amt),
        date,
        rentForMonth,
        mode: v('pym_mode') || 'Cash',
        ref: v('pym_ref') || '',
        note: v('pym_note') || '',
        ptype,
        incRent: true,
      };
      console.log('[savePayment] payData:', JSON.stringify(payData));

      if(this.payEditId){
        // ── EDIT: update existing entry ──
        const existing = ps.find(p=>p.id===this.payEditId);
        if(!existing){ alert('Error: Payment record not found!'); _restoreBtn(); return; }
        ps = ps.map(p => p.id===this.payEditId ? {
          ...p, ...payData,
          ptype: ptype || p.ptype || 'payment',
          receiptFiles: receiptFiles.length ? receiptFiles : (p.receiptFiles||[])
        } : p);
        this.payEditId = null;
        console.log('[savePayment] updated existing record:', this.payEditId);
        this.showToastMsg(ptype==='refund' ? '✅ Refund updated!' : '✅ Payment updated!');
      } else {
        // ── NEW ENTRY ──
        const newEntry = {
          id: uid(),
          tenantId: this.payTId,
          ...payData,
          receiptFiles,
          createdAt: new Date().toISOString()
        };
        ps.push(newEntry);
        console.log('[savePayment] new entry saved:', JSON.stringify(newEntry));
        this.showToastMsg(ptype==='refund' ? '↩️ Refund recorded!' : '💰 Payment of ₹'+Number(amt).toLocaleString('en-IN')+' saved!');
      }

      // Persist to localStorage + Firebase
      S.set('payments', ps);
      console.log('[savePayment] S.set payments done. Total records:', ps.length);

      // Clear cache so ledger recalculates
      this._ledgerCache = {};

      M.close('payM');
      try{ this.syncRentReminders(); }catch(e){ console.warn('syncRentReminders error:',e); }
      this.renderTab(this.curTab);
      this.renderPills();
    } catch(err){
      console.error('[savePayment] CRITICAL ERROR:', err);
      alert('Error saving payment: ' + err.message + '\n\nPlease check console for details.');
      _restoreBtn();
    }
  },

  delPayment(id){
    this.delCb=()=>{S.set('payments',this.payments.filter(p=>p.id!==id));try{this.syncRentReminders();}catch(e){};this.renderTab(this.curTab);this.renderPills();};
    document.getElementById('delMsg').textContent='Delete this payment record?';M.open('delM');
  },

  // ══ RENT RECEIPT GENERATOR ══
  generateReceipt(payId){
    // Find payment
    const p=this.payments.find(x=>x.id===payId);
    if(!p) return;
    const t=this.tenants.find(x=>x.id===p.tenantId);
    if(!t) return;
    const prop=this.props.find(x=>x.id===t.propId);
    const now=new Date();
    const receiptNo='RCP-'+now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+payId.slice(-4).toUpperCase();
    const rentPeriod=p.rentMonth?p.rentMonth:(new Date(p.date).toLocaleString('en-IN',{month:'long',year:'numeric'}));

    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Rent Receipt — ${receiptNo}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Georgia,serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}
      .receipt{background:#fff;width:680px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.12);border-radius:4px;position:relative;}
      .receipt::before{content:'';position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#1a3a6e,#2c6fad,#1a7a45);}
      .logo-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #e9ecef;}
      .landlord{font-size:22px;font-weight:700;color:#1a3a6e;letter-spacing:-.02em;}
      .sub{font-size:12px;color:#6c757d;margin-top:3px;}
      .receipt-title{text-align:right;}
      .receipt-title h2{font-size:28px;color:#2c6fad;font-weight:700;letter-spacing:.02em;text-transform:uppercase;}
      .receipt-no{font-size:11px;color:#6c757d;margin-top:4px;font-family:monospace;}
      .section{margin-bottom:20px;}
      .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#6c757d;font-weight:700;margin-bottom:10px;border-bottom:1px solid #e9ecef;padding-bottom:5px;}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
      .field label{font-size:11px;color:#6c757d;display:block;margin-bottom:3px;font-weight:600;}
      .field span{font-size:14px;color:#1a1d23;font-weight:600;}
      .amount-box{background:linear-gradient(135deg,#f0f7ff,#e8f5e9);border:2px solid #2c6fad;border-radius:8px;padding:20px 24px;text-align:center;margin:20px 0;}
      .amount-label{font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}
      .amount-value{font-size:36px;font-weight:700;color:#1a3a6e;margin:6px 0;font-family:'Courier New',monospace;}
      .amount-words{font-size:13px;color:#2c6fad;font-style:italic;}
      .sig-row{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:36px;padding-top:20px;border-top:1px solid #e9ecef;}
      .sig-box{text-align:center;}
      .sig-line{border-top:2px solid #1a3a6e;margin-bottom:8px;margin-top:50px;}
      .sig-label{font-size:11px;color:#6c757d;font-weight:600;}
      .footer{margin-top:24px;padding-top:16px;border-top:1px dashed #dee2e6;text-align:center;font-size:11px;color:#6c757d;}
      .badge{display:inline-block;background:#e8f5e9;color:#1a7a45;border:1px solid #90c8a0;border-radius:4px;padding:2px 10px;font-size:12px;font-weight:700;}
      @media print{body{background:#fff;padding:0;}  .receipt{box-shadow:none;} @page{margin:16mm 14mm;}}
    </style></head><body>
    <div class="receipt">
      <div class="logo-row">
        <div>
          <div class="landlord">Raman Kumar</div>
          <div class="sub">Property Owner / Landlord</div>
          <div class="sub" style="margin-top:6px;">📍 ${prop?prop.city||prop.name:''}</div>
        </div>
        <div class="receipt-title">
          <h2>Rent Receipt</h2>
          <div class="receipt-no"># ${receiptNo}</div>
          <div class="receipt-no" style="margin-top:4px;">Date: ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>
          <div style="margin-top:8px;"><span class="badge">✓ PAYMENT RECEIVED</span></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Property & Tenant Details</div>
        <div class="grid2">
          <div class="field"><label>Property Name</label><span>${prop?prop.name:'—'}</span></div>
          <div class="field"><label>Property Type</label><span>${prop?prop.type:'—'}</span></div>
          <div class="field"><label>Tenant Name</label><span>${t.name}</span></div>
          <div class="field"><label>Rent Period</label><span>${rentPeriod}</span></div>
          <div class="field"><label>Payment Date</label><span>${fD(p.date)}</span></div>
          <div class="field"><label>Payment Mode <span style="color:var(--mut);font-size:.65rem;">(optional)</span></label><span>${p.mode||'Cash'}</span></div>
          ${p.ref?`<div class="field"><label>Reference / UTR</label><span style="font-family:monospace;">${p.ref}</span></div>`:''}
          ${t.ph?`<div class="field"><label>Tenant Phone</label><span>${t.ph}</span></div>`:''}
        </div>
      </div>

      <div class="amount-box">
        <div class="amount-label">Amount Received</div>
        <div class="amount-value">₹${Number(p.amount).toLocaleString('en-IN')}</div>
        <div class="amount-words">${(function(){
          const n=Math.floor(Number(p.amount));
          const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
          const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
          const convert=n=>{if(n<20)return ones[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');if(n<1000)return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+convert(n%100):'');if(n<100000)return convert(Math.floor(n/1000))+' Thousand'+(n%1000?' '+convert(n%1000):'');if(n<10000000)return convert(Math.floor(n/100000))+' Lakh'+(n%100000?' '+convert(n%100000):'');return convert(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+convert(n%10000000):'');};
          return convert(n)+' Rupees Only';
        })()}</div>
      </div>

      ${p.note?`<div style="background:#fff8ee;border:1px solid #ffe0b2;border-radius:6px;padding:10px 14px;font-size:13px;color:#7a4400;margin-bottom:16px;"><b>Note:</b> ${p.note}</div>`:''}

      <div class="sig-row">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Tenant's Signature</div>
          <div style="font-size:12px;color:#6c757d;margin-top:4px;">${t.name}</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Landlord's Signature</div>
          <div style="font-size:12px;color:#6c757d;margin-top:4px;">Raman Kumar</div>
        </div>
      </div>

      <div class="footer">
        This is a computer-generated receipt and is valid without a physical signature. · Raman Kumar Property Management
      </div>
    </div>
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;

    const _rcptBlob=new Blob([html],{type:'text/html;charset=utf-8'});
    const _rcptA=document.createElement('a');
    _rcptA.href=URL.createObjectURL(_rcptBlob);
    _rcptA.download='Rent_Receipt_'+receiptNo+'_'+new Date().toISOString().slice(0,10)+'.html';
    document.body.appendChild(_rcptA);_rcptA.click();document.body.removeChild(_rcptA);
    URL.revokeObjectURL(_rcptA.href);
    this.showToastMsg('✅ Receipt downloaded! Open the file → press Ctrl+P → Save as PDF to get PDF');
  },

  setRentSub(s){this.rentSub=s;this.renderRent();},

  // ─── RENT LEDGER ENGINE (v17 — Correct invoice/due logic) ─────────────────
  //
  // KEY FORMULA:
  //   invoiceDate = tenant.invdate day of month  (OR 1st if not set)
  //   dueDate     = tenant.due day of month
  //
  // RULES:
  //   today < invoiceDate  → "Upcoming"  — NOT charged, excluded from outstanding
  //   today >= invoiceDate → "Due"       — charge it, include in outstanding
  //   today > dueDate AND unpaid → "Overdue"
  //
  // Outstanding = SUM of all months where invoiceDate has passed AND balance>0
  // ─────────────────────────────────────────────────────────────────────────────
  getTenantLedger(t){
    // Bug5 fix: memoize per render cycle — cache key = tenantId + payment count
    const cacheKey = (t.id||'') + ':' + (this.payments||[]).length;
    if(this._ledgerCache[cacheKey]) return this._ledgerCache[cacheKey];
    if(!t.start){ const empty={months:[],totalExpected:0,totalReceived:0,totalBalance:0}; this._ledgerCache[cacheKey]=empty; return empty; }
    const now=new Date(); now.setHours(0,0,0,0);
    // Use parseIso (not new Date) to avoid UTC timezone shift on YYYY-MM-DD strings
    const start = parseIso(t.start) || new Date();
    start.setHours(0,0,0,0);
    const rent=Number(t.rent);
    const maint=Number(t.maint)||0;
    const monthlyTotal=rent+maint;

    // Invoice day = invdate day field OR 1st of month
    // invdate stored as ISO date — extract just the day number
    // Use parseIso (not new Date) to avoid UTC timezone shift on date-only strings
    const invDay=(()=>{
      if(t.invdate){
        const d = parseIso(t.invdate);
        if(d && !isNaN(d)) return d.getDate();
      }
      return 1; // default: invoice on 1st of month
    })();
    const dueDay=Number(t.due)||1;

    // Build list of months from agreement start month to current month
    const months=[];
    let cur=new Date(start.getFullYear(),start.getMonth(),1);
    const endBound=new Date(now.getFullYear(),now.getMonth(),1);
    while(cur<=endBound){
      months.push({year:cur.getFullYear(),month:cur.getMonth()});
      cur=new Date(cur.getFullYear(),cur.getMonth()+1,1);
    }

    const allPayments=[...this.payments]
      .filter(p=>p.tenantId===t.id)
      .sort((a,b)=>(a.date||'').localeCompare(b.date||''));

    let runningBalance=0;
    let totalExpected=0; // only counts months whose invoiceDate has passed

    const ledger=months.map(({year,month})=>{
      // Invoice date: when this month's rent is generated/charged
      const invoiceDate=new Date(year,month,invDay);
      invoiceDate.setHours(0,0,0,0);

      // Due date: last date to pay without being overdue
      const dueDate=new Date(year,month,dueDay);
      dueDate.setHours(0,0,0,0);

      // Rent period: 1st to last day of month
      const periodStart=new Date(year,month,1);
      const periodEnd=new Date(year,month+1,0);

      const isPast=year<now.getFullYear()||(year===now.getFullYear()&&month<now.getMonth());
      const isCurrent=year===now.getFullYear()&&month===now.getMonth();

      // Payments in this month — use rentForMonth if present (set by getRentMonth at save time)
      // else fall back to payment date's calendar month
      const monthKey=year+'-'+String(month+1).padStart(2,'0');
      const monthPays=allPayments.filter(p=>{
        // Prefer rentForMonth (rent-cycle based) over raw payment date
        if(p.rentForMonth) return p.rentForMonth === monthKey;
        // Legacy fallback: no rentForMonth stored → use calendar month of payment date
        if(p.date) return p.date.slice(0,7) === monthKey;
        return false;
      });
      // Net received = payments - refunds (refunds have ptype='refund')
      const received=monthPays.reduce((s,p)=>{
        return p.ptype==='refund' ? s-Number(p.amount) : s+Number(p.amount);
      },0);

      // Has invoice been generated yet?
      const invoiceGenerated=now>=invoiceDate;

      let status='upcoming'; // before invoice date
      let charged=false;

      if(invoiceGenerated){
        charged=true;
        totalExpected+=monthlyTotal;
        runningBalance+=monthlyTotal;
        runningBalance-=received;
        if(runningBalance<=0)           status='clear';
        else if(now>dueDate)            status='overdue';
        else                            status='due';
      } else {
        // Invoice not yet generated — don't charge, don't add to outstanding
        runningBalance-=received; // still credit any advance payments
        status='upcoming';
      }

      const daysUntilInv=Math.ceil((invoiceDate-now)/86400000);
      const daysUntilDue=Math.ceil((dueDate-now)/86400000);
      const daysOverdue=status==='overdue'?Math.ceil((now-dueDate)/86400000):0;

      return{
        year,month,monthlyTotal,received,
        balance:Math.max(0,runningBalance),
        payments:monthPays,
        invoiceDate,dueDate,periodStart,periodEnd,
        status,charged,isPast,isCurrent,runningBalance,
        daysUntilInv,daysUntilDue,daysOverdue
      };
    });

    // Total received = all payments minus refunds
    const totalReceived=allPayments.reduce((s,p)=>{
      return p.ptype==='refund' ? s-Number(p.amount) : s+Number(p.amount);
    },0);
    // Outstanding = only charged months with positive balance
    const totalBalance=Math.max(0,runningBalance);
    const billedMonths=ledger.filter(m=>m.charged).length;

    const result={months:ledger,totalExpected,totalReceived,totalBalance,monthCount:billedMonths,allMonths:months.length};
    this._ledgerCache[cacheKey]=result; // Bug5 fix: store in cache
    return result;
  },
  // ── AUTO RENT REMINDER: creates/updates reminder when invoice is generated ──
  // Called from renderRent and init to keep reminders in sync
  // ═══════════════════════════════════════════════════════════════
  // RENT REMINDER ENGINE (v18)
  //
  // ONE reminder per tenant per month (not multiple)
  // No expiry — reminder stays ACTIVE until rent is paid
  // On payment → reminder auto-deleted
  // Trigger = invoice date
  // Status = Due | Overdue Xd (calculated live, not from expiry)
  // ═══════════════════════════════════════════════════════════════
  syncRentReminders(){
    // ONE reminder per tenant (not per month) — shows total outstanding
    // No expiry date — stays until rent is fully paid
    const now=new Date();now.setHours(0,0,0,0);
    let reminders=[...this.reminders];
    let changed=false;

    // Remove ALL old-style per-month rent reminders first
    const before=reminders.length;
    reminders=reminders.filter(r=>!r._isAutoRent);
    if(reminders.length!==before) changed=true;

    this.tenants.filter(t=>t.status==='active').forEach(t=>{
      const ledger=this.getTenantLedger(t);
      const prop=this.props.find(p=>p.id===t.propId);
      const totalBal=ledger.totalBalance;

      // Only create reminder if there is outstanding rent
      if(totalBal<=0) return;

      const overdueMonths=ledger.months.filter(mo=>mo.status==='overdue');
      const dueMonths=ledger.months.filter(mo=>mo.status==='due');
      const daysOv=overdueMonths.length>0?Math.max(...overdueMonths.map(mo=>mo.daysOverdue||0)):0;

      // Single reminder key per tenant
      const remKey='auto_rent_v2_'+t.id;

      // dTrig: negative = overdue, 0 = due today, positive = due in future
      const dTrig = daysOv > 0 ? -daysOv : (dueMonths.length>0 ? 0 : -1);

      const statusLabel=overdueMonths.length>0
        ? daysOv+'d Overdue'
        : dueMonths.length>0 ? 'Due Now' : 'Due';

      const reminderData={
        _autoKey:remKey,
        _isAutoRent:true,
        _tenantId:t.id,
        name:'💰 Rent Due — '+t.name+(prop?' ('+prop.name+')':''),
        type:'💰 Rent',
        person:t.name,
        mode:'rent',
        exp:'',        // NO expiry date — rent never expires
        before:'0',
        _trigDate:'',  // no trigger date needed
        _dTrig:dTrig,
        _invoiceAmt:ledger.totalExpected,
        _receivedAmt:ledger.totalReceived,
        _balanceAmt:totalBal,
        _daysOv:daysOv,
        _statusLabel:statusLabel,
        notes:'Monthly Rent: ₹'+fmt(t.rent)+
              ' | Due: '+t.due+'th of month'+
              ' | Outstanding: ₹'+fmt(totalBal)+
              (overdueMonths.length>0?' | Overdue: '+daysOv+'d':''),
        autorenew:'no'
      };

      const existIdx=reminders.findIndex(r=>r._autoKey===remKey);
      if(existIdx!==-1){
        // Only mark changed if data actually differs
        const existing = reminders[existIdx];
        const hasChange = existing._balanceAmt !== reminderData._balanceAmt ||
                          existing._daysOv !== reminderData._daysOv ||
                          existing._statusLabel !== reminderData._statusLabel;
        if(hasChange) {
          reminders[existIdx]={...reminders[existIdx],...reminderData};
          changed=true;
        }
      } else {
        // Use deterministic ID based on autoKey to prevent duplicates across devices
        reminders.push({id:remKey,...reminderData});
        changed=true;
      }
    });

    // Remove reminders for tenants who have cleared dues
    const activeIds=this.tenants.filter(t=>t.status==='active').map(t=>t.id);
    const before2=reminders.length;
    reminders=reminders.filter(r=>{
      if(!r._isAutoRent) return true;
      const t=this.tenants.find(x=>x.id===r._tenantId);
      if(!t) return false;
      return this.getTenantLedger(t).totalBalance>0;
    });
    if(reminders.length!==before2) changed=true;

    if(changed){ S.set('reminders',reminders); }
  },



  renderRent(){
    // Sync auto rent reminders whenever rent tab is opened
    try{ this.syncRentReminders(); }catch(e){}
    const s=this.rentSub;
    const now=new Date(),m=now.getMonth(),y=now.getFullYear();
    const tabs=[['overview','📊 Overview'],['tenants','👥 Tenants'],['ledger','📒 Full Ledger'],['history','📜 Payments'],['hikes','📈 Rent Hikes'],['templates','✉️ Message Templates']];
    let html='';

    // ── Template helpers ──
    const getTpl=(key,def)=>localStorage.getItem('rk_tpl_'+key)||def;
    const fillTpl=(tpl,vars)=>tpl.replace(/\{(\w+)\}/g,(_,k)=>vars[k]||'');

    if(s==='overview'){
      // Summary using full ledger engine
      let totExp=0,totRec=0,totBal=0;

      // ── Loan outstanding rows ──
      // Loans removed — use Khata Book tab
      const loanRows=''; const _skipLoans=(()=>{
        const loans=[];
        if(!loans.length) return '';
        return loans.map(loan=>{
          const isGiven=loan.type==='loan';
          const outstanding=isGiven?Math.max(0,loan.amount-(loan.loanReceived||0)):loan.amount-(loan.loanReceived||0);
          if(!isGiven) totBal+=Math.max(0,outstanding); // liability
          else totBal+=Math.max(0,outstanding);          // asset owed to us
          const statusLabel=loan.loanStatus==='received'?'✅ Received':loan.loanStatus==='partial'?'⚠️ Partial':'📌 Receivable';
          const statusBg=loan.loanStatus==='received'?'#e8f5e9':loan.loanStatus==='partial'?'#fff8ee':'#fff0e0';
          const statusColor=loan.loanStatus==='received'?'#1e7a45':loan.loanStatus==='partial'?'#854f0b':'#7a4000';
          const waMsg=encodeURIComponent('\uD83E\uDD1D *Loan Recovery*\nBorrower: '+loan.loanBorrower+'\nAmount: '+fmt(loan.amount)+(loan.loanReceived>0?'\nReceived: '+fmt(loan.loanReceived):'')+' \nOutstanding: '+fmt(outstanding)+'\n\nPlease return the loan amount.\nRaman Kumar');
          return`<div style="background:var(--card);border:1.5px solid #e8a060;border-left:4px solid #c4700a;border-radius:11px;padding:13px 14px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div style="flex:1;min-width:180px;">
                <div style="font-weight:800;font-size:.92rem;">🤝 ${loan.loanBorrower||'—'}</div>
                <div style="font-size:.72rem;color:var(--mut);margin-top:2px;">${isGiven?'Loan Given':'Loan Taken'} · ${fD(loan.date)}</div>
                ${loan.loanDueDate?`<div style="font-size:.72rem;color:var(--mut);">Due: ${fD(loan.loanDueDate)}</div>`:''}
              </div>
              <span style="background:${statusBg};color:${statusColor};padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700;flex-shrink:0;">${statusLabel}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:10px 0;">
              <div style="background:var(--dim);border-radius:7px;padding:7px 9px;text-align:center;">
                <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Given</div>
                <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;">${fmt(loan.amount)}</div>
              </div>
              <div style="background:var(--dim);border-radius:7px;padding:7px 9px;text-align:center;">
                <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Received</div>
                <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--grn);">${fmt(loan.loanReceived||0)}</div>
              </div>
              <div style="background:${outstanding>0?'#fff5f5':'#f0faf5'};border-radius:7px;padding:7px 9px;text-align:center;">
                <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Outstanding</div>
                <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${outstanding>0?'var(--red)':'var(--grn)'};">${outstanding>0?fmt(outstanding):'✓'}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--bdr);padding-top:10px;">
              <button class="btn b-grn b-sm" onclick="APP._markLoanReceived('${loan.id}')">✅ Mark Received</button>
              <button class="btn b-sm" style="background:#fff8ee;color:#854f0b;border:1px solid #e8a060;" onclick="APP._markLoanPartial('${loan.id}')">⚠️ Partial</button>
              ${(loan.loanBorrower&&loan.loanPhone)?`<button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1px solid #90c8a0;" onclick="APP.sendWhatsApp('${loan.loanBorrower}','${fmt(Math.max(0,loan.amount-(loan.loanReceived||0)))}','${loan.loanPhone||''}','loan')">📲 WhatsApp</button>`:(loan.loanBorrower?`<button class="btn b-sm" style="background:#f0f2f5;color:#adb5bd;border:1px solid #e9ecef;cursor:not-allowed;" disabled title="Add phone in loan record to enable WhatsApp">📵 No Phone</button>`:'')}
              <button class="btn b-out b-sm" onclick="APP.openExpModal('${loan.id}')">✏️ Edit</button>
            </div>
          </div>`;
        }).join('');
      })();

      const rows=this.tenants.filter(t=>t.status==='active').map(t=>{
        const prop=this.props.find(p=>p.id===t.propId);
        const ledger=this.getTenantLedger(t);
        totExp+=ledger.totalExpected; totRec+=ledger.totalReceived; totBal+=ledger.totalBalance;
        const curMo=ledger.months.find(mo=>mo.year===y&&mo.month===m);
        const curRec=curMo?curMo.received:0;
        // Only show current month balance if it's been invoiced (not upcoming)
        const curBal=curMo&&curMo.charged?Math.max(0,curMo.monthlyTotal-curMo.received):0;
        const isOvd=curMo&&curMo.status==='overdue';

        // Build message from template
        const vars={
          tenant_name:t.name,
          property:prop?prop.name:'—',
          monthly_rent:fmt(t.rent),
          due_day:t.due+'th',
          this_month_due:fmt(curBal),
          total_outstanding:fmt(ledger.totalBalance),
          months_unpaid:ledger.monthCount,
          phone:t.ph||'—',
          landlord:'Raman Kumar'
        };
        const waTpl=getTpl('wa_rent',`💰 *Rent Due Notice*\nTenant: {tenant_name}\nProperty: {property}\nMonthly Rent: {monthly_rent}\nDue: {due_day} of month\nThis Month Due: {this_month_due}\nTotal Outstanding: {total_outstanding}\n\nHave you deposited the rent? If yes, please share the payment screenshot.\n\nThank you,\n{landlord}`);
        const mailTpl=getTpl('mail_rent_body',`Dear {tenant_name},\n\nYour rent is due.\nProperty: {property}\nMonthly Rent: {monthly_rent}\nDue Day: {due_day}\nThis Month Due: {this_month_due}\nTotal Outstanding: {total_outstanding}\n\nPlease pay at the earliest.\n\nRegards,\n{landlord}`);
        const mailSubjTpl=getTpl('mail_rent_subj','Rent Due — {tenant_name} — {this_month_due}');

        // ── QUICK SEND: pre-filled default message (no template) ──
        const quickWaMsg=encodeURIComponent(`💰 *Rent Due Notice*\n\nDear ${t.name},\n\nProperty: ${prop?prop.name:'—'}\nMonthly Rent: ${fmt(t.rent)}\nDue Date: ${t.due}th of every month\nThis Month Due: ${fmt(curBal)}\nTotal Outstanding: ${fmt(ledger.totalBalance)}\n\nHave you deposited the rent? If yes, please share the payment screenshot.\n\nThank you,\n{landlord}`);
        const quickMailSubj=encodeURIComponent(`Rent Due — ${t.name} — ${fmt(curBal>0?curBal:ledger.totalBalance)}`);
        const quickMailBody=encodeURIComponent(`Dear ${t.name},\n\nYour rent is due. Details below:\n\nProperty    : ${prop?prop.name:'—'}\nMonthly Rent: ${fmt(t.rent)}\nDue Day     : ${t.due}th of every month\nThis Month  : ${fmt(curBal)}\nOutstanding : ${fmt(ledger.totalBalance)}\nMonths Due  : ${ledger.monthCount}\n\nPlease pay at the earliest to avoid late charges.\n\nWith regards,\nRaman Kumar\nPhone: +91 XXXXX XXXXX`);

        // ── TEMPLATE SEND: uses saved/custom template ──
        const waRentMsg=encodeURIComponent(fillTpl(waTpl,vars));
        const mailRentSubj=encodeURIComponent(fillTpl(mailSubjTpl,vars));
        const mailRentBody=encodeURIComponent(fillTpl(mailTpl,vars));

        // ── Punctuality Score ──────────────────────────────────────
        const _allPays=this.payments.filter(p=>p.tenantId===t.id&&p.ptype!=='refund');
        let _onTime=0,_late=0,_adv=0;
        ledger.months.filter(mo=>mo.charged&&mo.payments.length>0).forEach(mo=>{
          mo.payments.forEach(p=>{
            const pd=p.date?parseIso(p.date):null;
            if(!pd) return;
            if(pd<mo.invoiceDate) _adv++;
            else if(pd<=mo.dueDate) _onTime++;
            else _late++;
          });
        });
        const _totalPay=_onTime+_late+_adv;
        const _punctScore=_totalPay>0?Math.round((_onTime+_adv)/_totalPay*100):null;
        const _punctLabel=_punctScore===null?'—':_punctScore>=90?'🟢 Excellent':_punctScore>=70?'🟡 Good':_punctScore>=50?'🟠 Fair':'🔴 Late Payer';
        const _punctBg=_punctScore===null?'var(--dim)':_punctScore>=90?'#dcfce7':_punctScore>=70?'#fef9c3':_punctScore>=50?'#ffedd5':'#fee2e2';
        const _punctClr=_punctScore===null?'var(--mut)':_punctScore>=90?'#166534':_punctScore>=70?'#854d0e':_punctScore>=50?'#9a3412':'#991b1b';
        // ─────────────────────────────────────────────────────────────
        const statusColor=ledger.totalBalance<=0?'#1e7a45':isOvd?'#a32d2d':'#854f0b';
        const statusBg=ledger.totalBalance<=0?'#e8f5e9':isOvd?'#fcebeb':'#fff8ee';
        const statusLabel=ledger.totalBalance<=0?'\u2713 Clear':isOvd?'Overdue':curMo&&curMo.status==='upcoming'?'Upcoming':'Due';
        return`<div style="background:var(--card);border:1.5px solid ${isOvd?'#f0a0a0':'var(--bdr)'};border-left:4px solid ${isOvd?'#e05050':curBal>0?'#e09050':'#90c8a0'};border-radius:11px;padding:13px 14px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="flex:1;min-width:180px;">
              <div style="font-weight:800;font-size:.92rem;">${t.name}</div>
              <div style="font-size:.72rem;color:var(--mut);margin-top:2px;">${prop?prop.name:'\u2014'} \u00b7 ${t.ph||'No phone'}</div>
              <div style="font-size:.72rem;color:var(--mut);margin-top:1px;">Invoice: ${t.invdate?new Date(t.invdate).getDate():1}st \u00b7 Due: ${t.due}th \u00b7 ${fmt(t.rent)}/mo${t.sec>0?' \uD83D\uDD12 Sec: '+fmt(t.sec):''}</div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;">
                <span style="background:${_punctBg};color:${_punctClr};font-size:.66rem;font-weight:700;padding:2px 7px;border-radius:5px;">${_punctLabel}${_punctScore!==null?' ('+_punctScore+'%)':''}</span>
                ${(t.rentHistory&&t.rentHistory.length)?'<span style="background:#eff6ff;color:#1e40af;font-size:.66rem;font-weight:700;padding:2px 7px;border-radius:5px;">📈 '+t.rentHistory.length+' hike'+(t.rentHistory.length>1?'s':'')+'</span>':''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <span style="background:${statusBg};color:${statusColor};padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700;">${statusLabel}</span>
              ${curMo&&curMo.status==='upcoming'?`<div style="font-size:.68rem;color:var(--blu);margin-top:3px;">Invoice in ${curMo.daysUntilInv}d</div>`:''}
              ${isOvd?`<div style="font-size:.68rem;color:var(--red);margin-top:3px;">${curMo?curMo.daysOverdue:0}d overdue</div>`:''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:10px 0 10px;">
            <div style="background:var(--dim);border-radius:7px;padding:7px 9px;text-align:center;">
              <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">This Month</div>
              <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${curBal>0?'var(--red)':'var(--grn)'};">${curMo&&curMo.status==='upcoming'?'\u2014':(curBal>0?fmt(curBal):'\u2713 Paid')}</div>
            </div>
            <div style="background:var(--dim);border-radius:7px;padding:7px 9px;text-align:center;">
              <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Received</div>
              <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--grn);">${fmt(ledger.totalReceived)}</div>
            </div>
            <div style="background:${ledger.totalBalance>0?'#fff5f5':'#f0faf5'};border-radius:7px;padding:7px 9px;text-align:center;">
              <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Outstanding</div>
              <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${ledger.totalBalance>0?'var(--red)':'var(--grn)'};">${ledger.totalBalance>0?fmt(ledger.totalBalance):'\u2713'}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--bdr);padding-top:10px;">
            ${curBal>0?`<button class="btn b-grn b-sm" onclick="APP.openPayModal('${t.id}')" style="min-height:36px;">\uD83D\uDCB0 Pay</button>`:''}
            <button class="btn b-out b-sm" onclick="APP.openTenModal('${t.id}')">\u270F\uFE0F Edit</button>
            <button class="btn b-out b-sm" onclick="APP.goTab('rent');APP.viewLedgerTid='${t.id}';APP.setRentSub('ledger')">\uD83D\uDCD2 Ledger</button>
            <div style="border:1px solid #b7e0b7;border-radius:7px;overflow:hidden;background:#f0faf0;">
              <div style="font-size:.6rem;font-weight:700;color:#1e7a45;padding:3px 8px;background:#d8f5d8;text-transform:uppercase;letter-spacing:.04em;">📱 WhatsApp</div>
              <div style="display:flex;">
                ${t.ph
                  ? `<a href="https://wa.me/${t.ph.replace(/\D/g,'')}?text=${quickWaMsg}" target="_blank" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#1e7a45;text-decoration:none;border-right:1px solid #b7e0b7;background:#fff;" title="Quick WA">⚡ Quick</a><a href="https://wa.me/${t.ph.replace(/\D/g,'')}?text=${waRentMsg}" target="_blank" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#1e7a45;text-decoration:none;background:#fff;" title="Template WA">✏️ Template</a>`
                  : `<button onclick="APP._tenWA('${t.id}')" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#999;background:#fff;border:none;cursor:pointer;font-family:'Nunito',sans-serif;">📵 No Phone — Add</button>`}
              </div>
            </div>
            <div style="border:1px solid #f4c2b8;border-radius:7px;overflow:hidden;background:#fff3f0;">
              <div style="font-size:.6rem;font-weight:700;color:#c5221f;padding:3px 8px;background:#fde0db;text-transform:uppercase;letter-spacing:.04em;">📧 Email</div>
              <div style="display:flex;">
                ${t.email
                  ? `<a href="mailto:${t.email}?subject=${quickMailSubj}&body=${quickMailBody}" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#c5221f;text-decoration:none;border-right:1px solid #f4c2b8;background:#fff;">⚡ Quick</a><a href="mailto:${t.email}?subject=${mailRentSubj}&body=${mailRentBody}" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#c5221f;text-decoration:none;background:#fff;">✏️ Template</a>`
                  : `<button onclick="APP._tenEmail('${t.id}')" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#999;background:#fff;border:none;cursor:pointer;font-family:'Nunito',sans-serif;">📭 No Email — Add</button>`}
              </div>
            </div>
            <button onclick="APP._showTenDocs('${t.id}')" style="background:#fff8ee;color:#b56a00;border:2px solid #ffcc80;border-radius:7px;padding:5px 10px;font-size:.76rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;display:inline-flex;align-items:center;gap:4px;min-height:36px;touch-action:manipulation;">📎 Files${t.docFiles&&t.docFiles.length?' ('+t.docFiles.length+')':''}</button>
            ${(t.rentHistory&&t.rentHistory.length)?`<span style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;padding:3px 8px;font-size:.68rem;font-weight:700;cursor:pointer;" onclick="APP.goTab('rent');APP.setRentSub('hikes');" title="Rent Hike History">📈 ${t.rentHistory.length} hike${t.rentHistory.length>1?'s':''}</span>`:''}
          </div>
        </div>`;
      }).join('');

      html=`
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
          <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:10px;padding:11px 13px;">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);font-weight:700;">Total Expected</div>
            <div style="font-size:1.1rem;font-weight:900;font-family:'JetBrains Mono',monospace;margin-top:3px;">${fmt(totExp)}</div>
          </div>
          <div style="background:linear-gradient(135deg,#f0faf4,#dcf5e8);border:1.5px solid #90c8a0;border-radius:10px;padding:11px 13px;">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--grn);font-weight:700;">Total Received</div>
            <div style="font-size:1.1rem;font-weight:900;font-family:'JetBrains Mono',monospace;color:var(--grn);margin-top:3px;">${fmt(totRec)}</div>
          </div>
          <div style="background:${totBal>0?'linear-gradient(135deg,#fff5f5,#ffe0e0)':'linear-gradient(135deg,#f0faf4,#dcf5e8)'};border:1.5px solid ${totBal>0?'#f0a0a0':'#90c8a0'};border-radius:10px;padding:11px 13px;">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:${totBal>0?'var(--red)':'var(--grn)'};font-weight:700;">Total Outstanding</div>
            <div style="font-size:1.1rem;font-weight:900;font-family:'JetBrains Mono',monospace;color:${totBal>0?'var(--red)':'var(--grn)'};margin-top:3px;">${totBal>0?fmt(totBal):'✅ Clear'}</div>
            <div style="font-size:.62rem;color:var(--mut);margin-top:2px;">Rent + Loans</div>
          </div>
        </div>
        <!-- Loans section removed — use Khata Book tab -->
        ${rows?`<div style="margin:8px 0 4px;padding:6px 12px;background:#f0f7ff18;border-radius:8px;border-left:3px solid #90b8e8;font-size:.78rem;font-weight:700;color:#1760a0;">🏠 Rent Outstanding</div>`:''}
        <div style="display:flex;flex-direction:column;gap:8px;">${rows||'<div class="empty"><div class="ei">👥</div>No active tenants</div>'}</div>`;
    }
    if(s==='tenants'){
      const cards=this.tenants.map(t=>{
        const prop=this.props.find(p=>p.id===t.propId);
        const ledger=this.getTenantLedger(t);
        const curMo=ledger.months.find(mo=>mo.year===y&&mo.month===m);
        const curBal=curMo&&curMo.charged?Math.max(0,curMo.monthlyTotal-curMo.received):0;
        const statusClr=t.status==='active'?'bg':t.status==='notice'?'by':'bm';
        return`<div class="card">
          <div class="card-hdr">
            <div class="card-title">👤 ${t.name}</div>
            <span class="badge ${statusClr}">${t.status}</span>
          </div>
          <div class="card-body">
            <div class="fr"><span class="fl">Property</span><span class="fv" style="font-size:.78rem">${prop?prop.name:'—'}</span></div>
            <div class="fr"><span class="fl">Monthly Rent</span><span class="fv mono">${fmt(t.rent)}</span></div>
            <div class="fr"><span class="fl">Security Deposit</span><span class="fv mono">${fmt(t.sec)}</span></div>
            <div class="fr"><span class="fl">Advance</span><span class="fv mono">${fmt(t.adv)}</span></div>
            <div class="fr"><span class="fl">Agreement</span><span class="fv mono" style="font-size:.74rem">${fD(t.start)} → ${fD(t.end)||'Open'}</span></div>
            <div class="fr"><span class="fl">Due Day</span><span class="fv">${t.due}th of month</span></div>
            <div class="fr"><span class="fl">Months Since Start</span><span class="fv">${ledger.monthCount} months</span></div>
            <div class="fr"><span class="fl">Total Expected</span><span class="fv mono">${fmt(ledger.totalExpected)}</span></div>
            <div class="fr"><span class="fl">Total Received</span><span class="fv mono" style="color:var(--grn)">${fmt(ledger.totalReceived)}</span></div>
            <div class="fr"><span class="fl">Total Outstanding</span><span class="fv mono" style="color:${ledger.totalBalance>0?'var(--red)':'var(--grn)'};font-weight:700">${ledger.totalBalance>0?fmt(ledger.totalBalance):'✓ Clear'}</span></div>
            <div class="fr"><span class="fl">This Month Balance</span><span class="fv mono" style="color:${curBal>0?'var(--red)':'var(--grn)'}; font-weight:700">${curMo&&curMo.status==='upcoming'?'⏳ Upcoming':(curBal>0?fmt(curBal):'✓ Paid')}</span></div>

          </div>
          <div class="card-foot" style="flex-wrap:wrap;gap:5px;">
            <button class="btn b-grn b-sm" onclick="APP.openPayModal('${t.id}')" style="min-height:36px;">💰 Payment</button>
            <button class="btn b-out b-sm" onclick="APP._openRefundModal('${t.id}')" style="color:#c0392b;border-color:#fecaca;">↩️ Refund</button>
            <button class="btn b-blu b-sm" onclick="APP.goTab('rent');APP.viewLedgerTid='${t.id}';APP.setRentSub('ledger')">📒 Ledger</button>
            <button class="btn b-out b-sm" onclick="APP.openTenModal('${t.id}')">✏️ Edit</button>
            <button onclick="APP._tenWA('${t.id}')" style="background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;border-radius:7px;padding:5px 9px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;min-height:36px;touch-action:manipulation;">📲 WA</button>
            <button onclick="APP._tenEmail('${t.id}')" style="background:#fff0f0;color:#c5221f;border:1.5px solid #f4c2b8;border-radius:7px;padding:5px 9px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;min-height:36px;touch-action:manipulation;">📧 Email</button>
            <button onclick="APP._showTenDocs('${t.id}')" style="background:#fff8ee;color:#b56a00;border:1.5px solid #ffcc80;border-radius:7px;padding:5px 9px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;min-height:36px;touch-action:manipulation;">📎 Files${t.docFiles&&t.docFiles.length?' ('+t.docFiles.length+')':''}</button>
            ${(t.rentHistory&&t.rentHistory.length)?`<button onclick="APP.goTab('rent');APP.setRentSub('hikes');" style="background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;border-radius:7px;padding:5px 9px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;min-height:36px;">📈 ${t.rentHistory.length} Hikes</button>`:''}
          </div>
        </div>`;
      }).join('');
      html=`<div class="sec-hdr"><div class="sec-title">All Tenants <span class="ct">${this.tenants.length}</span></div><button class="btn b-gold" onclick="APP.openTenModal()">+ Add Tenant</button></div><div class="grid">${cards||'<div class="empty"><div class="ei">👥</div>No tenants</div>'}</div>`;
    }


    if(s==='ledger'){
      // ── INIT state vars ──
      if(!this._ledgerFilter)    this._ledgerFilter    = 'all';
      if(!this._ledgerCustomFrom)this._ledgerCustomFrom= '';
      if(!this._ledgerCustomTo)  this._ledgerCustomTo  = '';

      const now     = new Date();
      const curY    = now.getFullYear();
      const curM    = now.getMonth();
      const lFilter = this._ledgerFilter;
      const allTens = this.tenants;
      const selTenId= this.viewLedgerTid||'all';

      // ── Filter dropdown ──
      const monthOpts = MONTHS.map((m,i)=>`<option value="month_${i}">${m}</option>`).join('');
      const yearOpts  = [curY,curY-1,curY-2,curY-3].map(y=>`<option value="year_${y}">${y}</option>`).join('');
      const fyOpts    = [curY,curY-1,curY-2].map(y=>`<option value="fy_${y}">FY ${y}-${String(y+1).slice(2)} (Apr–Mar)</option>`).join('');

      const filterBar = `
        <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
          <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:.72rem;color:var(--mut);font-weight:600;">From</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rlf" value="${this._ledgerCustomFrom||''?isoToDmy(this._ledgerCustomFrom||''):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rlf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._ledgerFilter='custom';APP._ledgerCustomFrom=iso;APP.renderRent();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rlf').showPicker&&document.getElementById('dfh_rlf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rlf" value="${this._ledgerCustomFrom||''||''} " onchange="(function(iso){var el=document.getElementById('df_rlf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._ledgerFilter='custom';APP._ledgerCustomFrom=iso;APP.renderRent();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            <span style="font-size:.72rem;color:var(--mut);font-weight:600;">To</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rlt" value="${this._ledgerCustomTo||''?isoToDmy(this._ledgerCustomTo||''):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rlt');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._ledgerFilter='custom';APP._ledgerCustomTo=iso;APP.renderRent();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rlt').showPicker&&document.getElementById('dfh_rlt').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rlt" value="${this._ledgerCustomTo||''||''} " onchange="(function(iso){var el=document.getElementById('df_rlt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._ledgerFilter='custom';APP._ledgerCustomTo=iso;APP.renderRent();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            ${(this._ledgerCustomFrom||this._ledgerCustomTo)?'<button onclick="APP._ledgerFilter=\'all\';APP._ledgerCustomFrom=\'\';APP._ledgerCustomTo=\'\';APP.renderRent();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 7px;">✕ Clear</button>':''}
          </div>
        </div>`;

      // ── Tenant selector ──
      const tenSel = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <button class="stab ${selTenId==='all'?'on':''}" onclick="APP.viewLedgerTid='all';APP.renderRent()">👥 All Tenants</button>
          ${allTens.map(t=>`<button class="stab ${selTenId===t.id?'on':''}" onclick="APP.viewLedgerTid='${t.id}';APP.renderRent()">${t.name}</button>`).join('')}
        </div>`;

      // ── Date range helper ──
      const getDateRange = () => {
        const f = lFilter;
        let from = null, to = null;
        if(f==='thisMonth'){ from=new Date(curY,curM,1); to=new Date(curY,curM+1,0); }
        else if(f==='lastMonth'){ from=new Date(curY,curM-1,1); to=new Date(curY,curM,0); }
        else if(f.startsWith('month_')){ const mi=parseInt(f.split('_')[1]); from=new Date(curY,mi,1); to=new Date(curY,mi+1,0); }
        else if(f.startsWith('year_')){ const yi=parseInt(f.split('_')[1]); from=new Date(yi,0,1); to=new Date(yi,11,31); }
        else if(f.startsWith('fy_')){ const yi=parseInt(f.split('_')[1]); from=new Date(yi,3,1); to=new Date(yi+1,2,31); }
        else if(f==='custom'){ from=this._ledgerCustomFrom?new Date(this._ledgerCustomFrom):null; to=this._ledgerCustomTo?new Date(this._ledgerCustomTo):null; }
        return{from,to};
      };

      const {from:drFrom,to:drTo} = getDateRange();
      const inRange = (dateStr) => {
        if(!dateStr) return false;
        const d = new Date(dateStr); d.setHours(0,0,0,0);
        if(drFrom && d<drFrom) return false;
        if(drTo){ const t2=new Date(drTo); t2.setHours(23,59,59,999); if(d>t2) return false; }
        return true;
      };

      // ══ COMBINED LEDGER (All Tenants) ══
      if(selTenId==='all'){
        // Collect ALL payments across all tenants, filter by date range
        const allPays = [...this.payments]
          .filter(p => lFilter==='all' || inRange(p.date))
          .sort((a,b)=>(b.date||'').localeCompare(a.date||''));

        // Summary stats
        const totalPay = allPays.filter(p=>p.ptype!=='refund').reduce((s,p)=>s+Number(p.amount),0);
        const totalRef = allPays.filter(p=>p.ptype==='refund').reduce((s,p)=>s+Number(p.amount),0);
        const netAmt   = totalPay - totalRef;

        const summaryBar = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px;">
            <div style="background:#f0fdf4;border-radius:9px;padding:9px 12px;border:1.5px solid #bbf7d0;">
              <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#16a34a;margin-bottom:3px;">Total Received</div>
              <div style="font-size:.95rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:#16a34a;">₹${fmt(totalPay)}</div>
            </div>
            <div style="background:#fff5f5;border-radius:9px;padding:9px 12px;border:1.5px solid #fecaca;">
              <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#c0392b;margin-bottom:3px;">Total Refunds</div>
              <div style="font-size:.95rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:#c0392b;">₹${fmt(totalRef)}</div>
            </div>
            <div style="background:#eff6ff;border-radius:9px;padding:9px 12px;border:1.5px solid #bfdbfe;">
              <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#1e40af;margin-bottom:3px;">Net Amount</div>
              <div style="font-size:.95rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:#1e40af;">₹${fmt(netAmt)}</div>
            </div>
            <div style="background:var(--dim);border-radius:9px;padding:9px 12px;">
              <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:var(--mut);margin-bottom:3px;">Transactions</div>
              <div style="font-size:.95rem;font-weight:800;">${allPays.length}</div>
            </div>
          </div>`;

        const rows = allPays.map(p=>{
          const ten  = allTens.find(t=>t.id===p.tenantId);
          const prop = ten&&this.props.find(x=>x.id===ten.propId);
          const isRef= p.ptype==='refund';
          const col  = isRef?'#c0392b':'#16a34a';
          const sign = isRef?'− ':'+ ';
          return`<tr style="${isRef?'background:#fff9f9':''}">
            <td class="mono" style="font-size:.74rem;">${fD(p.date)}</td>
            <td><span onclick="APP.viewLedgerTid='${ten?ten.id:''}';APP.renderRent();"
                style="color:var(--acc);font-weight:700;cursor:pointer;text-decoration:underline dotted;"
                title="Click to open ${ten?ten.name:''} ledger">${ten?ten.name:'—'}</span></td>
            <td style="font-size:.72rem;color:var(--mut);">${prop?prop.name:'—'}</td>
            <td><span style="font-size:.7rem;background:${isRef?'#fff0f0':'#f0fdf4'};color:${col};padding:1px 7px;border-radius:8px;font-weight:700;">${isRef?'↩️ Refund':'💰 Payment'}</span></td>
            <td class="mono tr" style="color:${col};font-weight:700;">${sign}₹${fmt(p.amount)}</td>
            <td style="font-size:.72rem;color:var(--mut);">${p.mode||'—'}${p.note?' · '+p.note.slice(0,25):''}</td>
            <td><button class="btn b-out b-sm" style="font-size:.62rem;padding:2px 7px;" onclick="APP.openEditPayModal('${p.id}')">✏️</button></td>
          </tr>`;
        }).join('');

        html = `${filterBar}${tenSel}
          <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <button onclick="APP._downloadLedgerPDF('all')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#e53935;color:#e53935;">📄 PDF</button>${APP._pdfOriHtml()}
            <button onclick="APP._downloadLedgerWord('all')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#1565c0;color:#1565c0;">📝 Word</button>
            <button onclick="APP._downloadLedgerCSV('all')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#2e7d32;color:#2e7d32;">📊 CSV</button>
          </div>
          <div class="card" style="margin-bottom:12px;">
            <div class="card-hdr">
              <div class="card-title">📒 Combined Ledger — All Tenants</div>
              <span class="ct">${allPays.length} entries</span>
            </div>
            <div class="card-body">${summaryBar}</div>
          </div>
          <div class="tbl-wrap"><table>
            <thead><tr><th>Date</th><th>Tenant</th><th>Property</th><th>Type</th><th class="tr">Amount</th><th>Details</th><th>Edit</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="7"><div class="empty">No transactions found</div></td></tr>'}</tbody>
          </table></div>`;

      } else {
        // ══ INDIVIDUAL TENANT LEDGER ══
        const selTen = this.tenants.find(t=>t.id===selTenId);
        if(!selTen){ html=tenSel+'<div class="empty"><div class="ei">👥</div>Select a tenant</div>'; }
        else{
          const prop   = this.props.find(p=>p.id===selTen.propId);
          const ledger = this.getTenantLedger(selTen);

          // Filter months by date range
          const filteredMonths = ledger.months.filter(mo=>{
            if(lFilter==='all') return true;
            const moDate = new Date(mo.year, mo.month, 1);
            if(drFrom && moDate < new Date(drFrom.getFullYear(), drFrom.getMonth(), 1)) return false;
            if(drTo   && moDate > new Date(drTo.getFullYear(),   drTo.getMonth(),   1)) return false;
            return true;
          });

          // Build flat payment rows — each payment = one row, grouped by rent month
          const fmt2=(d)=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear())}`;

          // Collect all payment rows across filtered months
          const allPayRows = [];
          filteredMonths.slice().reverse().forEach(mo=>{
            const mLabel = MONTHS[mo.month].slice(0,3)+' '+mo.year;
            const rentMonthKey = mo.year+'-'+String(mo.month+1).padStart(2,'0');

            let mStatusBadge='',mRowBg='';
            if(mo.status==='upcoming'){mStatusBadge='<span class="badge ba" style="font-size:.65rem">⏳ Upcoming</span>';mRowBg='background:#f5f5ff';}
            else if(mo.status==='clear'){mStatusBadge='<span class="badge bg" style="font-size:.65rem">✓ Clear</span>';mRowBg='';}
            else if(mo.status==='due'){mStatusBadge=mo.received>0?'<span class="badge bo" style="font-size:.65rem">Partial</span>':'<span class="badge by" style="font-size:.65rem">Due</span>';mRowBg='background:#fffbee';}
            else if(mo.status==='overdue'){mStatusBadge=mo.received>0?'<span class="badge bo" style="font-size:.65rem">⚠️ Part</span>':'<span class="badge br" style="font-size:.65rem">🔴 Overdue</span>';mRowBg='background:#fff5f5';}

            // Month header row — shows charge + balance
            allPayRows.push(`<tr style="border-top:2px solid var(--bdr2);${mRowBg}">
              <td style="font-weight:800;font-size:.82rem;white-space:nowrap;">
                ${mLabel}${mo.isCurrent?' <span class="badge ba" style="font-size:.58rem">Now</span>':''}
              </td>
              <td class="mono" style="font-size:.72rem;color:var(--mut);">${fmt2(mo.invoiceDate)}<br><span style="font-size:.58rem">Invoice</span></td>
              <td class="mono" style="font-size:.72rem;color:var(--mut);">${fmt2(mo.dueDate)}<br><span style="font-size:.58rem">Due</span></td>
              <td class="mono" style="font-weight:700;">${mo.charged?'₹'+fmt(mo.monthlyTotal):'<span style="color:var(--mut)">—</span>'}</td>
              <td class="mono" style="font-weight:700;color:var(--grn);">${mo.received>0?'₹'+fmt(mo.received):'<span style="color:var(--mut)">—</span>'}</td>
              <td class="mono" style="font-weight:700;color:${mo.runningBalance>0?'var(--red)':'var(--grn)'};">
                ${mo.charged?(mo.runningBalance>0?'₹'+fmt(mo.runningBalance):'<span style="color:var(--grn)">✓</span>'):'<span style="color:var(--mut)">—</span>'}
              </td>
              <td>${mStatusBadge}</td>
              <td><div style="display:flex;gap:3px;flex-wrap:wrap;">
                ${mo.charged&&mo.received<mo.monthlyTotal?`<button class="btn b-grn b-sm" onclick="APP.openPayModal('${selTen.id}')" style="font-size:.6rem;padding:2px 6px;">💰 Pay</button>`:''}
                ${mo.payments.length>0?`<button class="btn b-out b-sm" onclick="APP._openRefundFromLedger('${selTen.id}','${mo.year}','${mo.month}')" style="font-size:.6rem;padding:2px 6px;color:#c0392b;border-color:#fecaca;">↩️</button>`:''}
              </div></td>
            </tr>`);

            // Individual payment rows — one per payment entry
            if(mo.payments.length===0 && mo.charged){
              allPayRows.push(`<tr style="${mRowBg}">
                <td colspan="8" style="padding:4px 14px;font-size:.72rem;color:var(--mut);font-style:italic;">No payments recorded for this month</td>
              </tr>`);
            }
            mo.payments.forEach(p=>{
              const isRef=p.ptype==='refund';
              const payDate=p.date?fD(p.date):'—';
              const col=isRef?'#c0392b':'#16a34a';
              const bg=isRef?'rgba(192,57,43,.06)':'rgba(22,163,74,.04)';
              // Payment timing status
              const pDateObj=p.date?parseIso(p.date):null;
              let timingBadge='';
              if(pDateObj&&mo.invoiceDate){
                if(pDateObj<mo.invoiceDate) timingBadge='<span style="background:#e3f2fd;color:#1565c0;border-radius:4px;padding:1px 5px;font-size:.6rem;font-weight:700;">Advance</span>';
                else if(pDateObj<=mo.dueDate) timingBadge='<span style="background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 5px;font-size:.6rem;font-weight:700;">On-time</span>';
                else timingBadge='<span style="background:#fff3e0;color:#e65100;border-radius:4px;padding:1px 5px;font-size:.6rem;font-weight:700;">Late</span>';
              }
              allPayRows.push(`<tr style="background:${bg};">
                <td style="padding-left:20px;font-size:.72rem;color:var(--mut);">↳ ${isRef?'↩️ Refund':'💰 Payment'}</td>
                <td class="mono" style="font-size:.72rem;">${payDate}<br><span style="font-size:.58rem;color:var(--mut);">Pay Date</span></td>
                <td class="mono" style="font-size:.72rem;color:var(--mut);">${mLabel}<br><span style="font-size:.58rem;">Rent Month</span></td>
                <td></td>
                <td class="mono" style="font-weight:700;color:${col};">${isRef?'− ':'+ '}₹${fmt(p.amount)}</td>
                <td style="font-size:.72rem;color:var(--mut);">${p.mode||'Cash'}${p.ref?' · '+p.ref.slice(0,15):''}${p.note?'<br><span style="font-size:.65rem;">'+p.note.slice(0,30)+'</span>':''}</td>
                <td>${timingBadge}</td>
                <td style="white-space:nowrap;"><button onclick="APP.openEditPayModal('${p.id}')" style="background:none;border:1px solid var(--bdr2);color:var(--mut);cursor:pointer;font-size:.7rem;padding:2px 6px;border-radius:5px;">✏️</button>${!isRef?`<button onclick="APP.generateReceipt('${p.id}')" style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;cursor:pointer;font-size:.68rem;padding:2px 6px;border-radius:5px;margin-left:3px;font-weight:700;" title="Generate Receipt">🧾</button>`:''}</td>
              </tr>`);
            });
          });

          // Download buttons — same style as Finance tab
          const tenDlBtns = `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <button onclick="APP._downloadLedgerPDF('${selTen.id}')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#e53935;color:#e53935;">📄 PDF</button>${APP._pdfOriHtml()}
            <button onclick="APP._downloadLedgerWord('${selTen.id}')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#1565c0;color:#1565c0;">📝 Word</button>
            <button onclick="APP._downloadLedgerCSV('${selTen.id}')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#2e7d32;color:#2e7d32;">📊 CSV</button>
          </div>`;

          // Rent History card for this tenant
          const _rhItems = (selTen.rentHistory||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
          const _rhCard = (function(){
            if(!_rhItems.length) return '';
            const _hikeRows = _rhItems.map(function(h){
              const pct=h.from>0?'+'+((h.to-h.from)/h.from*100).toFixed(1)+'%':'';
              var hd='';
              if(h.date){try{var d=new Date(h.date);hd=String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}catch(e){hd=h.date;}}
              return '<div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:7px 11px;min-width:160px;">'
                +'<div style="font-weight:700;font-size:.82rem;color:#1e40af;">₹'+(h.from||0).toLocaleString('en-IN')+' → ₹'+(h.to||0).toLocaleString('en-IN')+(pct?' <span style="color:#16a34a;font-size:.72rem;">'+pct+'</span>':'')+'</div>'
                +'<div style="font-size:.7rem;color:var(--mut);">'+hd+(h.reason?' · '+h.reason:'')+'</div>'
                +'</div>';
            }).join('');
            var _escalDiv='';
            if(selTen.escalation){
              var _nextDue='';
              if(_rhItems[0]&&_rhItems[0].date){try{var ld=new Date(_rhItems[0].date);ld.setFullYear(ld.getFullYear()+1);_nextDue='<div style="font-size:.7rem;color:var(--mut);">Next due: '+String(ld.getDate()).padStart(2,'0')+'/'+String(ld.getMonth()+1).padStart(2,'0')+'/'+ld.getFullYear()+'</div>';}catch(e){}}
              _escalDiv='<div style="background:#f5f0ff;border:1px solid #c4b5fd;border-radius:8px;padding:7px 11px;min-width:160px;"><div style="font-weight:700;font-size:.78rem;color:#5b21b6;">📅 Annual Escalation: '+selTen.escalation+'%</div>'+_nextDue+'</div>';
            }
            return '<div style="background:var(--card);border:1.5px solid #bfdbfe;border-radius:10px;margin-bottom:12px;overflow:hidden;">'
              +'<div style="background:#eff6ff;padding:9px 14px;display:flex;align-items:center;justify-content:space-between;">'
              +'📈 Rent Increase History'
              +'<span style="font-size:.72rem;color:#1e40af;">'+_rhItems.length+' hike'+(_rhItems.length>1?'s':'')+'</span>'
              +'</div>'
              +'<div style="padding:10px 14px;display:flex;flex-wrap:wrap;gap:8px;">'+_hikeRows+_escalDiv+'</div>'
              +'</div>';
          })();

          html=`${filterBar}${tenSel}${tenDlBtns}${_rhCard}
            <div class="card" style="margin-bottom:14px;">
              <div class="card-hdr">
                <div class="card-title">📒 ${selTen.name} — Ledger</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                  ${selTen.sec>0?`<span class="badge bb" style="font-size:.72rem;">🔒 Sec: ₹${fmt(selTen.sec)}</span>`:''}
                  <span class="badge bg">Recd: ₹${fmt(ledger.totalReceived)}</span>
                  <span class="badge ${ledger.totalBalance>0?'br':'bg'}">Due: ${ledger.totalBalance>0?'₹'+fmt(ledger.totalBalance):'✓ Clear'}</span>
                </div>
              </div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;">
                  <div style="background:var(--dim);border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Property</div><div style="font-size:.8rem;font-weight:600">${prop?prop.name:'—'}</div></div>
                  <div style="background:var(--dim);border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Monthly Rent</div><div style="font-size:.8rem;font-weight:600;font-family:'JetBrains Mono',monospace">₹${fmt(selTen.rent)}</div></div>
                  <div style="background:#f0faf5;border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Total Expected</div><div style="font-size:.8rem;font-weight:600;font-family:'JetBrains Mono',monospace">₹${fmt(ledger.totalExpected)}</div></div>
                  <div style="background:#f0faf5;border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Total Received</div><div style="font-size:.8rem;font-weight:600;font-family:'JetBrains Mono',monospace;color:var(--grn)">₹${fmt(ledger.totalReceived)}</div></div>
                  <div style="background:${ledger.totalBalance>0?'#fff5f5':'#f0faf5'};border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Outstanding</div><div style="font-size:.82rem;font-weight:700;font-family:'JetBrains Mono',monospace;color:${ledger.totalBalance>0?'var(--red)':'var(--grn)'}">₹${ledger.totalBalance>0?fmt(ledger.totalBalance):'✓ Clear'}</div></div>
                </div>
              </div>
            </div>
            <div class="tbl-wrap"><table>
              <thead><tr><th>Month / Entry</th><th>Invoice Date</th><th>Rent Month / Pay Date</th><th>Charged</th><th>Amount</th><th>Mode / Note</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>${allPayRows.join('')||'<tr><td colspan="8"><div class="empty">No data in range</div></td></tr>'}</tbody>
            </table></div>`;
        }
      }
    }

    if(s==='history'){
      const histFrom=this._histFrom||'';
      const histTo=this._histTo||'';
      let histPays=[...this.payments].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      if(histFrom) histPays=histPays.filter(p=>p.date&&p.date>=histFrom);
      if(histTo)   histPays=histPays.filter(p=>p.date&&p.date<=histTo);
      const histTotal=histPays.filter(p=>p.ptype!=='refund').reduce((s,p)=>s+Number(p.amount),0);
      const rows=histPays.map(p=>{
        const t=this.tenants.find(x=>x.id===p.tenantId);
        const prop=t&&this.props.find(x=>x.id===t.propId);
        return`<tr>
          <td class="mono">${fD(p.date)}</td>
          <td>${prop?prop.name:'—'}</td>
          <td>${t?t.name:'—'}</td>
          <td class="mono tr" style="color:var(--grn);font-weight:700">${fmt(p.amount)}</td>
          <td>${p.mode||'—'}</td>
          <td style="font-size:.76rem">${p.ref||p.note||'—'}</td>
          <td><button class="btn b-out b-sm" onclick="APP.openEditPayModal('${p.id}')">✏️ Edit / Delete</button></td>
        </tr>`;
      }).join('');
      html=`
        <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
          <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:.72rem;color:var(--mut);font-weight:600;">From</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rhf" value="${histFrom?isoToDmy(histFrom):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rhf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._histFrom=iso;APP.renderRent();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rhf').showPicker&&document.getElementById('dfh_rhf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rhf" value="${histFrom||''} " onchange="(function(iso){var el=document.getElementById('df_rhf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._histFrom=iso;APP.renderRent();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            <span style="font-size:.72rem;color:var(--mut);font-weight:600;">To</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rht" value="${histTo?isoToDmy(histTo):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rht');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._histTo=iso;APP.renderRent();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rht').showPicker&&document.getElementById('dfh_rht').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rht" value="${histTo||''} " onchange="(function(iso){var el=document.getElementById('df_rht');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._histTo=iso;APP.renderRent();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            ${histFrom||histTo?'<button onclick="APP._histFrom=\'\';APP._histTo=\'\';APP.renderRent();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 7px;">✕ Clear</button>':''}
            <span style="font-size:.68rem;color:var(--acc);font-weight:700;margin-left:4px;">${histPays.length} entries · ₹${fmt(histTotal)}</span>
          </div>
        </div>
        <div class="sec-hdr"><div class="sec-title">Payments <span class="ct">${histPays.length}</span></div></div>
        <div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Property</th><th>Tenant</th><th class="tr">Amount</th><th>Mode</th><th>Note</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="7"><div class="empty">No payments for selected range</div></td></tr>'}</tbody></table></div>`;
    }

    if(s==='hikes'){
      // ══ RENT INCREASE HISTORY — all tenants ══
      const allHikeTens = this.tenants.filter(t=>(t.rentHistory||[]).length>0);
      const allHikeRows = [];
      let grandTotalHikes=0;
      this.tenants.forEach(t=>{
        const prop=this.props.find(p=>p.id===t.propId);
        const hist=(t.rentHistory||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
        hist.forEach(h=>{
          grandTotalHikes++;
          const pct=h.from>0?'+'+((h.to-h.from)/h.from*100).toFixed(1)+'%':'—';
          const hDate=h.date?(()=>{try{const d=new Date(h.date);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}catch(e){return h.date;}})():'—';
          allHikeRows.push({tenant:t.name,prop:prop?prop.name:'—',from:h.from,to:h.to,pct,date:hDate,reason:h.reason||'—'});
        });
        // Next hike projection: if escalation % set
        if(t.escalation && hist.length){
          const lastHike=hist[0];
          if(lastHike.date){
            try{
              const ld=new Date(lastHike.date);
              ld.setFullYear(ld.getFullYear()+1);
              const nextHikeDue=String(ld.getDate()).padStart(2,'0')+'/'+String(ld.getMonth()+1).padStart(2,'0')+'/'+ld.getFullYear();
              const projRent=Math.round(lastHike.to*(1+Number(t.escalation)/100));
              allHikeRows.push({tenant:t.name,prop:prop?prop.name:'—',from:lastHike.to,to:projRent,pct:'+'+t.escalation+'% (proj.)',date:nextHikeDue,reason:'📅 Projected (Annual @'+t.escalation+'%)',isProjected:true});
            }catch(e){}
          }
        }
      });

      // Summary KPIs
      const avgIncrease = allHikeRows.filter(r=>!r.isProjected&&r.from>0).length
        ? (allHikeRows.filter(r=>!r.isProjected&&r.from>0).reduce((s,r)=>s+(r.to-r.from)/r.from*100,0)/allHikeRows.filter(r=>!r.isProjected&&r.from>0).length).toFixed(1)
        : 0;

      const rows = allHikeRows.map(r=>`<tr style="${r.isProjected?'background:#f5f0ff;opacity:.85;':''}">
        <td style="font-weight:700;font-size:.82rem;">${r.tenant}</td>
        <td style="font-size:.78rem;color:var(--mut);">${r.prop}</td>
        <td class="mono">₹${(r.from||0).toLocaleString('en-IN')}</td>
        <td class="mono" style="font-weight:800;color:var(--grn);">₹${(r.to||0).toLocaleString('en-IN')}</td>
        <td><span style="background:${r.isProjected?'#ede9fe':'#dcfce7'};color:${r.isProjected?'#5b21b6':'#166534'};padding:2px 8px;border-radius:5px;font-size:.72rem;font-weight:700;">${r.pct}</span></td>
        <td class="mono" style="font-size:.76rem;">${r.date}</td>
        <td style="font-size:.76rem;color:var(--mut);">${r.reason}</td>
      </tr>`).join('');

      html=`
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px;">
          <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:11px 14px;">
            <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#16a34a;">Total Hikes</div>
            <div style="font-size:1.4rem;font-weight:900;color:#16a34a;">${grandTotalHikes}</div>
          </div>
          <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:11px 14px;">
            <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#1e40af;">Tenants With Hikes</div>
            <div style="font-size:1.4rem;font-weight:900;color:#1e40af;">${allHikeTens.length}</div>
          </div>
          <div style="background:#fff8ee;border:1.5px solid #fed7aa;border-radius:10px;padding:11px 14px;">
            <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#c05a00;">Avg Increase</div>
            <div style="font-size:1.4rem;font-weight:900;color:#c05a00;">${avgIncrease}%</div>
          </div>
        </div>
        ${allHikeRows.length ? '' : '<div class="empty"><div class="ei">📈</div><p>Koi rent hike record nahi hai abhi.</p><p style="font-size:.8rem;margin-top:8px;color:var(--mut);">Tenant Edit karein → Rent Increase History → + Add Hike</p></div>'}
        ${allHikeRows.length ? `
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Tenant</th><th>Property</th><th>From Rent</th><th>To Rent</th><th>Increase</th><th>Effective Date</th><th>Reason</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="margin-top:10px;background:#f5f0ff;border:1px solid #c4b5fd;border-radius:9px;padding:9px 13px;font-size:.76rem;color:#5b21b6;">
          💡 <b>Projected rows</b> (purple) = next hike based on Annual Escalation % set in tenant profile
        </div>` : ''}`;
    }

    if(s==='templates'){
      const getTpl=(key,def)=>localStorage.getItem('rk_tpl_'+key)||def;
      const vars_help=`<div style="background:#f0f7ff;border:1px solid #90b8e8;border-radius:9px;padding:12px 15px;font-size:.8rem;color:var(--blu);margin-bottom:16px;">
        <b>📌 Available Variables</b> — copy-paste these in your message:<br>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
          ${['{tenant_name}','{property}','{monthly_rent}','{due_day}','{this_month_due}','{total_outstanding}','{months_unpaid}','{phone}','{landlord}'].map(v=>`<span style="background:#fff;border:1px solid #90b8e8;border-radius:5px;padding:2px 8px;font-family:'JetBrains Mono',monospace;font-size:.76rem;cursor:pointer;" onclick="navigator.clipboard&&navigator.clipboard.writeText('${v}')" title="Click to copy">${v}</span>`).join('')}
        </div>
        <div style="margin-top:6px;font-size:.75rem;opacity:.8;">💡 Tip: Click any variable to copy it. Then paste in the template below.</div>
      </div>`;

      html=`
        <div class="sec-hdr"><div class="sec-title">✉️ Message Templates</div></div>
        <div style="background:#fff8ee;border:1px solid #f0c060;border-radius:9px;padding:10px 14px;font-size:.82rem;color:#5a4000;margin-bottom:16px;">
          ✏️ Yahan apna message likho — jab bhi Rent Overview mein WA ya 📧 dabao, yahi message jayega.
        </div>
        ${vars_help}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

          <!-- WhatsApp Template -->
          <div class="card">
            <div class="card-hdr" style="background:#e8f5e9;">
              <div class="card-title" style="color:#1e7a45;">
                <svg width="16" height="16" viewBox="0 0 48 48" style="vertical-align:middle"><circle cx="24" cy="24" r="22" fill="#25D366"/><path fill="#fff" d="M34.5 13.5C32 11 28.2 9.5 24 9.5c-8.6 0-15.5 6.9-15.5 15.5 0 2.7.7 5.4 2 7.7L9 39l6.5-1.7c2.2 1.2 4.7 1.8 7.2 1.8h.1c8.6 0 15.5-6.9 15.5-15.5 0-4.1-1.6-8-4.8-11.1z"/></svg>
                WhatsApp — Rent Due
              </div>
              <button class="btn b-sm b-out" onclick="localStorage.removeItem('rk_tpl_wa_rent');APP.setRentSub('templates')">↺ Reset</button>
            </div>
            <div class="card-body">
              <textarea id="tpl_wa_rent" style="width:100%;min-height:200px;background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:10px 12px;font-family:'Nunito',sans-serif;font-size:.83rem;color:var(--txt);resize:vertical;outline:none;line-height:1.7;">${getTpl('wa_rent',`💰 *Rent Due Notice*\nTenant: {tenant_name}\nProperty: {property}\nMonthly Rent: {monthly_rent}\nDue: {due_day} of month\nThis Month Due: {this_month_due}\nTotal Outstanding: {total_outstanding}\n\nHave you deposited the rent? If yes, please share the payment screenshot.\n\nThank you,\n{landlord}`)}</textarea>
              <div style="margin-top:8px;display:flex;gap:8px;">
                <button class="btn b-gold" style="flex:1" onclick="localStorage.setItem('rk_tpl_wa_rent',document.getElementById('tpl_wa_rent').value);APP.showToastMsg('✅ WhatsApp template saved!')">💾 Save Template</button>
              </div>
              <div style="margin-top:10px;font-size:.76rem;color:var(--mut);">Preview (with sample data):</div>
              <div id="wa_preview" style="background:#e8f5e9;border-radius:8px;padding:10px 12px;margin-top:5px;font-size:.8rem;white-space:pre-wrap;color:#1a3a24;font-family:'Nunito',sans-serif;line-height:1.7;max-height:160px;overflow-y:auto;"></div>
            </div>
          </div>

          <!-- Email Template -->
          <div class="card">
            <div class="card-hdr" style="background:#fff3f0;">
              <div class="card-title" style="color:#c5221f;">📧 Email — Rent Due</div>
              <button class="btn b-sm b-out" onclick="localStorage.removeItem('rk_tpl_mail_rent_body');localStorage.removeItem('rk_tpl_mail_rent_subj');APP.setRentSub('templates')">↺ Reset</button>
            </div>
            <div class="card-body">
              <div class="fg" style="margin-bottom:8px;"><label>Subject Line</label>
                <input id="tpl_mail_subj" value="${getTpl('mail_rent_subj','Rent Due — {tenant_name} — {this_month_due}')}" style="background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:8px 11px;font-family:'Nunito',sans-serif;font-size:.83rem;color:var(--txt);outline:none;width:100%;">
              </div>
              <div class="fg"><label>Email Body</label>
                <textarea id="tpl_mail_body" style="width:100%;min-height:170px;background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:10px 12px;font-family:'Nunito',sans-serif;font-size:.83rem;color:var(--txt);resize:vertical;outline:none;line-height:1.7;">${getTpl('mail_rent_body',`Dear {tenant_name},\n\nYour rent is due.\nProperty: {property}\nMonthly Rent: {monthly_rent}\nDue Day: {due_day}\nThis Month Due: {this_month_due}\nTotal Outstanding: {total_outstanding}\n\nPlease pay at the earliest.\n\nRegards,\n{landlord}`)}</textarea>
              </div>
              <div style="margin-top:8px;display:flex;gap:8px;">
                <button class="btn b-gold" style="flex:1" onclick="localStorage.setItem('rk_tpl_mail_rent_body',document.getElementById('tpl_mail_body').value);localStorage.setItem('rk_tpl_mail_rent_subj',document.getElementById('tpl_mail_subj').value);APP.showToastMsg('✅ Email template saved!')">💾 Save Template</button>
              </div>
              <div style="margin-top:10px;font-size:.76rem;color:var(--mut);">Preview (with sample data):</div>
              <div id="mail_preview" style="background:#fff3f0;border-radius:8px;padding:10px 12px;margin-top:5px;font-size:.8rem;white-space:pre-wrap;color:#3a0a0a;font-family:'Nunito',sans-serif;line-height:1.7;max-height:160px;overflow-y:auto;"></div>
            </div>
          </div>

        </div>`;

      // Render previews after HTML is set
      setTimeout(()=>{
        const sample={tenant_name:'Rahul Sharma',property:'Flat 4B Green Park',monthly_rent:'₹25,000',due_day:'5th',this_month_due:'₹25,000',total_outstanding:'₹50,000',months_unpaid:'2',phone:'+91 99999 88888',landlord:'Raman Kumar'};
        const fillP=(tpl)=>tpl.replace(/\{(\w+)\}/g,(_,k)=>sample[k]||'{'+k+'}');
        const waTxt=document.getElementById('tpl_wa_rent');
        const mailTxt=document.getElementById('tpl_mail_body');
        const waPrev=document.getElementById('wa_preview');
        const mailPrev=document.getElementById('mail_preview');
        if(waTxt&&waPrev) waPrev.textContent=fillP(waTxt.value);
        if(mailTxt&&mailPrev) mailPrev.textContent=fillP(mailTxt.value);
        if(waTxt) waTxt.addEventListener('input',()=>{if(waPrev)waPrev.textContent=fillP(waTxt.value);});
        if(mailTxt) mailTxt.addEventListener('input',()=>{if(mailPrev)mailPrev.textContent=fillP(mailTxt.value);});
      },100);
    }

    document.getElementById('pan-rent').innerHTML=`<div class="stabs">${tabs.map(([k,l])=>`<button class="stab ${s===k?'on':''}" onclick="APP.setRentSub('${k}')">${l}</button>`).join('')}</div>${html}`;
  },

  // ══ REMINDERS ══
  // ── Toggle reminder mode (expiry vs recurring) ──
  // Called from old references (backward compat)
  _toggleRemMode(){
    const mode=document.getElementById('rmm_mode')?document.getElementById('rmm_mode').value:'expiry';
    this._setRmmMode(mode);
  },

  _setRmmMode(mode){
    // Update hidden input
    const modeInp=document.getElementById('rmm_mode');
    if(modeInp) modeInp.value=mode;

    // Style toggle buttons
    const btnExp=document.getElementById('rmm_mode_btn_expiry');
    const btnRec=document.getElementById('rmm_mode_btn_recurring');
    if(btnExp){
      if(mode==='expiry'){
        btnExp.style.cssText='padding:9px 6px;border:2px solid #e53935;background:#fff5f5;color:#e53935;border-radius:9px;font-size:.8rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;';
        btnRec.style.cssText='padding:9px 6px;border:2px solid var(--bdr2);background:var(--card);color:var(--mut);border-radius:9px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;';
      } else {
        btnRec.style.cssText='padding:9px 6px;border:2px solid #1565c0;background:#e8eeff;color:#1565c0;border-radius:9px;font-size:.8rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;';
        btnExp.style.cssText='padding:9px 6px;border:2px solid var(--bdr2);background:var(--card);color:var(--mut);border-radius:9px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;';
      }
    }

    const ef=document.getElementById('rmm_expiry_fields');
    const rf=document.getElementById('rmm_recurring_fields');
    if(ef) ef.style.display=mode==='expiry'?'contents':'none';
    if(rf) rf.style.display=mode==='recurring'?'block':'none';
  },

  openReminderModal(id){
    if(window.REM){ window.REM.open(id||null); return; }
    // Fallback if REM not loaded
    console.warn('REM module not loaded');
  },

  _computeNextRecurTrigger(startIso,periodDays){
    const now=new Date();now.setHours(0,0,0,0);
    const start=new Date(startIso);start.setHours(0,0,0,0);
    let t=new Date(start);
    while(t<now) t.setDate(t.getDate()+periodDays);
    return t.toISOString().split('T')[0];
  },
  saveReminder(){
    const name=v('rmm_name');if(!name){alert('Title zaroori hai!');return;}
    const mode=document.getElementById('rmm_mode')?document.getElementById('rmm_mode').value:'expiry';
    let data={name,type:v('rmm_type'),person:v('rmm_person'),notes:v('rmm_notes'),mode,files:FUM.getFiles('fu_rem_doc_wrap'),doc:(FUM.getFiles('fu_rem_doc_wrap')[0]||{}).url||''};
    if(mode==='recurring'){
      const start=vDate('rmm_start');if(!start){alert('Start date zaroori hai!');return;}
      // Read period from hidden input (set by _rmmUpdatePeriod)
      const rp=document.getElementById('rmm_recur_period').value||'7';
      const rbv=parseInt(document.getElementById('rmm_recur_bval').value)||0;
      const rbu=document.getElementById('rmm_recur_bunit').value||'days';
      const nextT=this._computeNextRecurTrigger(start,parseInt(rp)||7);
      // Custom time
      const recHour=document.getElementById('rmm_rec_hour')?document.getElementById('rmm_rec_hour').value||'10':'10';
      const recMin=document.getElementById('rmm_rec_min')?document.getElementById('rmm_rec_min').value||'00':'00';
      // Day/month selections
      const selDays=this._rmmGetSelectedDays();
      const selMonths=this._rmmGetSelectedMonths();
      data={...data,start,end:vDate('rmm_end')||'',recurPeriod:rp,recurBeforeVal:rbv,recurBeforeUnit:rbu,nextTrigger:nextT,
        alertHour:recHour,alertMin:recMin,
        daysOfWeek:selDays,monthsOfYear:selMonths};
    } else {
      // ── Reminder date = actual trigger date (NOT expiry) ──
      const trigDate = vDate('rmm_trigdate') || vDate('rmm_exp') || '';
      if(!trigDate){ alert('Reminder date zaroori hai! Kab remind karna hai?'); return; }

      const alertHour = document.getElementById('rmm_alert_hour') ? document.getElementById('rmm_alert_hour').value||'10' : '10';
      const alertMin  = document.getElementById('rmm_alert_min')  ? document.getElementById('rmm_alert_min').value||'00'  : '00';

      // ── Validate: past time check ──
      const now = new Date();
      var _sd=trigDate.split('-'); const selectedDT=_sd.length===3?new Date(parseInt(_sd[0]),parseInt(_sd[1])-1,parseInt(_sd[2]),parseInt(alertHour),parseInt(alertMin),0,0):null;
      const warn = document.getElementById('rmm_past_warn');
      if(selectedDT < now){
        if(warn) warn.style.display = 'block';
        // Only block if date is today and time is past
        const todayStr = now.toISOString().slice(0,10);
        if(trigDate === todayStr){
          alert('⚠️ Please select a future time! Abhi ka time past ho gaya hai.');
          return;
        }
        // Past date — warn but allow (for records like expired docs)
        if(warn) warn.textContent = '⚠️ Yeh date/time past mein hai. Save karein?';
      } else {
        if(warn) warn.style.display = 'none';
      }

      // expiry is optional
      const exp = vDate('rmm_exp') || '';
      // If exp is set AND trigDate was auto-calculated from exp, compute beforeDays
      let beforeDays = '0';
      if(exp && trigDate && exp !== trigDate){
        try{
          const ep=exp.split('-'),tp=trigDate.split('-');
          if(ep.length===3&&tp.length===3){
            const expD=new Date(parseInt(ep[0]),parseInt(ep[1])-1,parseInt(ep[2]),0,0,0,0);
            const trigD=new Date(parseInt(tp[0]),parseInt(tp[1])-1,parseInt(tp[2]),0,0,0,0);
            const diff=Math.round((expD-trigD)/86400000);
            if(diff>0) beforeDays=String(diff);
          }
        }catch(e){}
      }
      data = {...data,
        trigDate,            // PRIMARY: actual reminder date
        exp,                 // OPTIONAL: document expiry date
        issue:   vDate('rmm_issue')||'',
        before:  beforeDays, // days before expiry (0 = on trigDate)
        autorenew: v('rmm_autorenew')||'no',
        period:  v('rmm_period')||'365',
        alertHour,
        alertMin
      };
    }
    let rs=this.reminders;
    if(this.editId)rs=rs.map(r=>r.id===this.editId?{...r,...data}:r);
    else{data.id=uid();rs.push(data);}
    S.set('reminders',rs);
    // ── AUTO SYNC TO TO-DO LIST if category is "To Do" ──
    try {
      const remType=(data.type||'').toLowerCase();
      if(remType.includes('to do')||remType.includes('todo')){
        const todos=this.todos;
        const remId=data.id||this.editId;
        const existing=todos.find(t=>t.remId===remId);
        if(!existing){
          const newTodo={id:uid(),remId,text:data.name+(data.notes?' — '+data.notes.slice(0,40):''),done:false,created:new Date().toISOString(),fromReminder:true};
          todos.push(newTodo);
          this.saveTodos(todos);
        } else {
          // Update text if name changed
          const updated=todos.map(t=>t.remId===remId?{...t,text:data.name+(data.notes?' — '+data.notes.slice(0,40):'')}:t);
          this.saveTodos(updated);
        }
      }
    } catch(e){ console.warn('Todo sync error:',e); }
    M.close('remM');this.renderReminders();this.renderPills();
    if(this.curTab==='todo') this.renderTodo();
    // Schedule time-based alerts for new/updated reminders
    try { this._remScheduleTimeAlerts(); } catch(e){}
  },
  // ── Reminder repeat preview update ──
  _rmmUpdatePeriod(){
    try {
      const n=parseInt(document.getElementById('rmm_custom_n').value)||1;
      const unit=document.getElementById('rmm_custom_unit').value||'days';
      // Store encoded value in hidden field
      const encoded=n+'_'+unit;
      const hidden=document.getElementById('rmm_recur_period');
      if(hidden) hidden.value=encoded;
      // Update preview
      const prev=document.getElementById('rmm_repeat_preview');
      if(prev) prev.textContent='🔄 Repeats every '+n+' '+unit;
    } catch(e){}
  },

  _rmmApplyPreset(val){
    if(!val) return;
    const parts=val.split('_');
    const n=parts[0];
    const unit=parts.slice(1).join('_');
    const nEl=document.getElementById('rmm_custom_n');
    const uEl=document.getElementById('rmm_custom_unit');
    if(nEl) nEl.value=n;
    if(uEl) uEl.value=unit;
    this._rmmUpdatePeriod();
    // Reset preset selector
    const sel=document.getElementById('rmm_recur_preset');
    if(sel) sel.value='';
  },

  _rmmToggleDay(btn){
    const active=btn.style.background.includes('1565c0')||btn.getAttribute('data-active')==='1';
    if(active){
      btn.style.background='var(--card)';
      btn.style.color='var(--txt)';
      btn.style.borderColor='var(--bdr2)';
      btn.setAttribute('data-active','0');
    } else {
      btn.style.background='#1565c0';
      btn.style.color='#fff';
      btn.style.borderColor='#1565c0';
      btn.setAttribute('data-active','1');
    }
  },

  _rmmToggleMon(btn){
    const active=btn.getAttribute('data-active')==='1';
    if(active){
      btn.style.background='var(--card)';
      btn.style.color='var(--txt)';
      btn.style.borderColor='var(--bdr2)';
      btn.setAttribute('data-active','0');
    } else {
      btn.style.background='#7c3aed';
      btn.style.color='#fff';
      btn.style.borderColor='#7c3aed';
      btn.setAttribute('data-active','1');
    }
  },

  _rmmGetSelectedDays(){
    const btns=document.querySelectorAll('#rmm_dow_wrap button[data-active="1"]');
    return Array.from(btns).map(b=>parseInt(b.getAttribute('data-day')));
  },

  _rmmGetSelectedMonths(){
    const btns=document.querySelectorAll('#rmm_month_wrap button[data-active="1"]');
    return Array.from(btns).map(b=>parseInt(b.getAttribute('data-mon')));
  },

  // ── Quick reminder: after X min/hr/days ──
  _rmmApplyQuick(val){
    if(!val) return;
    const now = new Date();
    let target = new Date(now);

    if(val.endsWith('m'))      target.setMinutes(target.getMinutes()+parseInt(val));
    else if(val.endsWith('h')) target.setHours(target.getHours()+parseInt(val));
    else if(val.endsWith('d')) target.setDate(target.getDate()+parseInt(val));

    const dateStr = target.toISOString().slice(0,10);
    const hh = String(target.getHours()).padStart(2,'0');
    const mm = String(target.getMinutes()).padStart(2,'0');

    // Set date
    const tw = document.getElementById('rmm_trigdate_wrap');
    if(tw) tw.innerHTML = makeDateInput('rmm_trigdate', dateStr);

    // Set time
    const hourEl = document.getElementById('rmm_alert_hour');
    const minEl  = document.getElementById('rmm_alert_min');
    if(hourEl) hourEl.value = hh;
    if(minEl){
      // Find closest minute option
      const mNum = parseInt(mm);
      const opts = Array.from(minEl.options).map(o=>parseInt(o.value));
      const closest = opts.reduce((a,b)=>Math.abs(b-mNum)<Math.abs(a-mNum)?b:a,opts[0]);
      minEl.value = String(closest).padStart(2,'0');
    }

    // Reset quick select
    const sel = document.getElementById('rmm_quick_after');
    if(sel) sel.value = '';

    this._rmmUpdateTimePreview();
    this.showToastMsg('⏰ Reminder set: '+target.toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}));
  },

  // ── Live time preview + past validation ──
  _rmmUpdateTimePreview(){
    try {
      const dateEl = document.querySelector('#rmm_trigdate_wrap input');
      const hourEl = document.getElementById('rmm_alert_hour');
      const minEl  = document.getElementById('rmm_alert_min');
      const prev   = document.getElementById('rmm_time_preview');
      const warn   = document.getElementById('rmm_past_warn');
      if(!dateEl||!hourEl||!minEl) return;

      const dateStr = dateEl.value;
      const hh = hourEl.value||'10';
      const mm = minEl.value||'00';
      if(!dateStr){ if(prev) prev.textContent=''; return; }

      const dt = (function(){var _p=dateStr.split('-');return _p.length===3?new Date(parseInt(_p[0]),parseInt(_p[1])-1,parseInt(_p[2]),parseInt(hh),parseInt(mm),0,0):null;})();
      const now = new Date();
      const isPast = dt < now;

      if(prev){
        prev.textContent = dt.toLocaleString('en-IN',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
        prev.style.background = isPast ? '#fff0f0' : '#eff6ff';
        prev.style.color = isPast ? '#e53935' : 'var(--acc)';
      }
      if(warn){
        if(isPast && dateStr===now.toISOString().slice(0,10)){
          warn.style.display='block';
          warn.textContent='⚠️ Please select a future time!';
        } else if(isPast){
          warn.style.display='block';
          warn.textContent='⚠️ This date is in the past.';
        } else {
          warn.style.display='none';
        }
      }
    } catch(e){}
  },

  _rmmAddCat(){
    const name=prompt('Naya category naam daalo:\n(e.g. 🏥 Health, 🏠 Property, 💼 Work)','');
    if(!name||!name.trim()) return;
    const sel=document.getElementById('rmm_type');
    if(!sel) return;
    const opt=document.createElement('option');
    opt.value=name.trim(); opt.text=name.trim(); opt.selected=true;
    // Insert before last option
    sel.insertBefore(opt, sel.lastElementChild);
    sel.value=name.trim();
    this._rmmSyncTodoHint(name.trim());
    this.showToastMsg('✅ Category "'+name.trim()+'" added!');
  },

  _rmmSyncTodoHint(val){
    const hint=document.getElementById('rmm_todo_hint');
    if(!hint) return;
    const isTodo=(val||'').toLowerCase().includes('to do')||(val||'').toLowerCase().includes('todo');
    hint.style.display=isTodo?'block':'none';
  },

  delReminder(id){
    this.delCb=()=>{S.set('reminders',this.reminders.filter(r=>r.id!==id));this.renderReminders();this.renderPills();};
    document.getElementById('delMsg').textContent='Delete this reminder?';M.open('delM');
  },

  // ══ DONE-IDS STORE — works for ALL types: reminder / med_xxx / rent_xxx ══
  _getDoneIds(){ try{ return new Set(JSON.parse(localStorage.getItem('rk_done_ids'))||[]); }catch{ return new Set(); } },
  _saveDoneIds(s){
    const arr=[...s];
    localStorage.setItem('rk_done_ids', JSON.stringify(arr));
    // Sync to Firebase so done-state is preserved across devices
    if(window.fbSave) window.fbSave('done_ids', arr).catch(()=>{});
  },
  _isIdDone(id){ return this._getDoneIds().has(id); },

  // ══ MARK DONE — works for ALL reminder types ══
  markReminderDone(id){
    if(!id) return;
    const doneIds = this._getDoneIds();
    const wasDone = doneIds.has(id);
    // Toggle
    if(wasDone){ doneIds.delete(id); } else { doneIds.add(id); }
    this._saveDoneIds(doneIds);
    // Also sync completed flag on regular reminder objects
    const r = this.reminders.find(x=>x.id===id);
    if(r){ r.completed = !wasDone; r.completedAt = r.completed ? new Date().toISOString() : null; S.set('reminders', this.reminders); }
    // Re-render everything
    this.renderReminders();
    this.renderPills();
    if(this.curTab==='home') this.renderHome();
    this.showToastMsg(!wasDone ? '✅ Done! Moved to Completed.' : '↩️ Restored to active.');
  },

  // ══ SHOW COMPLETED POPUP ══
  showCompletedPopup(){
    const doneIds = this._getDoneIds();
    if(doneIds.size===0){ this.showToastMsg('No completed reminders yet.'); return; }
    // Build list of completed entries
    const fD2=iso=>{
      if(!iso) return '—';
      // Handle full ISO datetime (completedAt) — extract just the date part
      const datePart = iso.includes('T') ? iso.split('T')[0] : iso;
      const p=datePart.split('-');
      if(p.length!==3) return iso;
      return p[2]+'/'+p[1]+'/'+p[0].slice(2);
    };
    const rows=[];
    // Regular reminders
    this.reminders.filter(r=>doneIds.has(r.id)).forEach(r=>{
      const icon={'🛂 Passport':'🛂','🚗 Driving Licence':'🚗','🛡️ Insurance':'🛡️','📋 Rent Agreement':'📋','📊 Tax Filing':'📊','💳 Loan/EMI':'💳','💻 Laptop/Device':'💻','🔁 Subscription':'🔁','📔 Visa':'📔','🚘 Vehicle RC':'🚘','🪪 PAN Card':'🪪','🪪 Aadhaar':'🪪','📌 Other':'📌','🏥 Medical':'🏥','💰 Rent':'💰'}[r.type]||'📌';
      rows.push({id:r.id,icon,name:r.name,type:r.type||'Other',date:r.exp||r.trigDate||'',completedAt:r.completedAt||''});
    });
    // Medical entries
    this.visits.filter(v=>doneIds.has('med_'+v.id)).forEach(v=>{
      const pat=this.patients.find(p=>p.id===v.patId);
      rows.push({id:'med_'+v.id,icon:'🏥',name:(pat?pat.name+' — ':'')+( v.doctor?'Dr.'+v.doctor+' Follow-up':'Medical Follow-up'),type:'Medical',date:v.next||'',completedAt:''});
    });
    // Rent entries
    this.tenants.filter(t=>doneIds.has('rent_'+t.id)).forEach(t=>{
      rows.push({id:'rent_'+t.id,icon:'💰',name:'Rent — '+t.name,type:'Rent',date:'',completedAt:''});
    });
    if(!rows.length){ this.showToastMsg('No completed reminders yet.'); return; }

    const buildRows = ()=> rows.map(r=>`
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:#f4fdf8;border:1.5px solid #a8dfc0;border-radius:10px;margin-bottom:8px;">
        <div style="width:38px;height:38px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">${r.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1a1d23;">${r.name}</div>
          <div style="font-size:.67rem;color:#6c757d;margin-top:2px;display:flex;gap:8px;flex-wrap:wrap;">
            <span>${r.type}</span>
            ${r.date?`<span>📅 Due: ${fD2(r.date)}</span>`:''}
            ${r.completedAt?`<span style="color:#1a7a45;font-weight:700;">✅ Done: ${fD2(r.completedAt)}</span>`:''}
          </div>
        </div>
        <button onclick="APP.markReminderDone('${r.id}');APP._refreshDonePopup();" 
          style="background:#fff0f0;color:#c0392b;border:1.5px solid #f09090;border-radius:7px;padding:5px 11px;font-size:.72rem;cursor:pointer;font-weight:700;white-space:nowrap;font-family:'Nunito',sans-serif;flex-shrink:0;">↩️ Restore</button>
      </div>`).join('');

    // Remove old popup if exists, always rebuild fresh
    const old = document.getElementById('_donePopup');
    if(old) old.remove();

    const modal = document.createElement('div');
    modal.id = '_donePopup';
    // Desktop-friendly: centered modal (not bottom sheet)
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;width:100%;max-width:540px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,.25);overflow:hidden;">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1.5px solid #e9ecef;flex-shrink:0;">
          <div>
            <div style="font-weight:800;font-size:1.05rem;color:#1a1d23;">✅ Completed Reminders</div>
            <div style="font-size:.72rem;color:#6c757d;margin-top:2px;">${rows.length} item${rows.length>1?'s':''} marked done</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="_donePopupClearAll"
              onclick="APP._clearAllCompleted()"
              style="background:#fff0f0;color:#c0392b;border:1.5px solid #fecaca;border-radius:8px;padding:6px 13px;font-size:.76rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">
              🗑 Clear All
            </button>
            <button onclick="document.getElementById('_donePopup').remove()"
              style="background:#f0f2f5;border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6c757d;">✕</button>
          </div>
        </div>
        <!-- Scrollable body -->
        <div id="_donePopupBody" style="overflow-y:auto;padding:14px 16px;flex:1;">
          ${buildRows()}
        </div>
        <!-- Footer hint -->
        <div style="padding:10px 16px;border-top:1px solid #e9ecef;background:#f8f9fa;font-size:.72rem;color:#6c757d;text-align:center;flex-shrink:0;">
          Tap ↩️ Restore to move back to active reminders
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  },

  // Refresh completed popup in place (after restore)
  _refreshDonePopup(){
    const doneIds = this._getDoneIds();
    if(doneIds.size===0){
      const m = document.getElementById('_donePopup');
      if(m) m.remove();
      this.showToastMsg('All reminders restored!');
      return;
    }
    this.showCompletedPopup();
    this.renderReminders();
    this.renderPills();
  },

  // Clear all completed reminders
  _clearAllCompleted(){
    if(!confirm('Saari completed reminders clear karein?\n(Ye permanently done-list se hataega, reminder data delete nahi hoga)')) return;
    const doneIds = this._getDoneIds();
    // Remove completed flag from reminder objects
    const updated = this.reminders.map(r=>{
      if(doneIds.has(r.id)) return {...r, completed:false, completedAt:null};
      return r;
    });
    S.set('reminders', updated);
    this._saveDoneIds(new Set());
    const m = document.getElementById('_donePopup');
    if(m) m.remove();
    this.renderReminders();
    this.renderPills();
    this.showToastMsg('✅ Completed list cleared!');
  },

  markAsRenewed(id){
    const r=this.reminders.find(x=>x.id===id);if(!r)return;
    if(r.mode==='recurring'){
      // For recurring: advance nextTrigger by period
      const rp=r.recurPeriod||'7';
      if(rp.startsWith('minutes_')||rp.startsWith('hours_')){
        this.showToastMsg('✅ Recurring reminder — triggers automatically');
        return;
      }
      const pd=parseInt(rp)||7;
      const base=r.nextTrigger?new Date(r.nextTrigger):new Date();
      base.setHours(0,0,0,0);
      base.setDate(base.getDate()+pd);
      const nextT=base.toISOString().split('T')[0];
      let rs=this.reminders;
      rs=rs.map(x=>x.id===id?{...x,nextTrigger:nextT}:x);
      S.set('reminders',rs);
      this.showToastMsg(`✅ ${r.name} — Next reminder: ${fD(nextT)}`);
      this.renderReminders();this.renderPills();
      return;
    }
    // Expiry-based: ask for new expiry date
    const inp=prompt(`✅ ${r.name}\n\nNavy Expiry Date daalo (DD/MM/YYYY):\n(Reminder auto-calculate hoga)\n\nExample: 19/03/2027`,'');
    if(!inp) return;
    const isoExp=dmyToIso(inp.trim());
    if(!isoExp){alert('Date format galat hai! DD/MM/YYYY mein likhein.');return;}
    // NEW: compute new trigger date
    const before=parseInt(r.before||30);
    const newExp=new Date(isoExp);newExp.setDate(newExp.getDate()-before);
    const newTrigStr=newExp.toISOString().split('T')[0];
    let rs=this.reminders;
    rs=rs.map(x=>x.id===id?{...x,exp:isoExp,issue:(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})()}:x);
    S.set('reminders',rs);
    this.showToastMsg(`✅ ${r.name} — Updated! Reminder on: ${fD(newTrigStr)} (Expiry: ${inp.trim()})`);
    this.renderReminders();this.renderPills();
  },

  renderReminders(){
    // ══════════════════════════════════════════════════════
    // REMINDER ENGINE — All calculations based on TRIGGER DATE
    // Formula: triggerDate = expiryDate - beforeDays
    // Status based ONLY on: today vs triggerDate
    // ══════════════════════════════════════════════════════
    const now=new Date();now.setHours(0,0,0,0);

    const blLabel={'1':'1 Day','3':'3 Days','7':'1 Week','15':'15 Days','30':'1 Month',
      '60':'2 Months','90':'3 Months','180':'6 Months','365':'1 Year'};
    const prdLabel={'1':'Daily','7':'Weekly','15':'Every 15 Days','30':'Monthly',
      '90':'Quarterly','180':'Half-Yearly','365':'Yearly',
      'minutes_5':'Every 5 Min','minutes_15':'Every 15 Min','hours_1':'1 Hr','hours_6':'6 Hrs'};
    const typeIcon={
      '📌 To Do':'📌','🎂 Birthday':'🎂','💍 Anniversary':'💍','💳 Bills/Payment':'💳',
      '📞 Call/Follow-up':'📞','🛂 Passport':'🛂','🚗 Driving Licence':'🚗','🛡️ Insurance':'🛡️',
      '📋 Rent Agreement':'📋','📊 Tax Filing':'📊','💳 Loan/EMI':'💳','💻 Laptop/Device':'💻',
      '🔁 Subscription':'🔁','📔 Visa':'📔','🚘 Vehicle RC':'🚘','🪪 PAN Card':'🪪',
      '🪪 Aadhaar':'🪪','📌 Other':'📌',
      'Passport':'🛂','Driving Licence':'🚗','Insurance':'🛡️','Rent Agreement':'📋',
      'Tax Filing':'📊','Loan/EMI':'💳','Laptop/Device':'💻','Subscription':'🔁',
      'Visa':'📔','Vehicle RC':'🚘','PAN Card':'🪪','Aadhaar':'🪪','Other':'📌'
    };

    // ── CORE: Get trigger date for any reminder type ──
    // ✅ Uses reminderDate (= dueDate − before) when set; otherwise trigDate
    function getTrig(r){
      if(!r) return null;
      if(r.mode==='recurring'){
        if(r.nextTrigger) return r.nextTrigger;
        if(r.start) return r.start;
        return null;
      }
      // ✅ Prefer reminderDate — this is the actual alert date (dueDate - before)
      if(r.reminderDate && r.reminderDate !== r.trigDate) return r.reminderDate;
      // If trigDate already saved — subtract before to get real trigger
      if(r.trigDate) {
        var bDays = parseInt(r.beforeDays || 0) || 0;
        // Also try r.before (stored in minutes) → convert to days
        if(!bDays && r.before) bDays = Math.max(0, Math.round(parseInt(r.before||0) / 1440));
        if(bDays > 0) {
          var dp2 = r.trigDate.split('-');
          if(dp2.length === 3) {
            var d2 = new Date(parseInt(dp2[0]), parseInt(dp2[1])-1, parseInt(dp2[2]), 0,0,0,0);
            d2.setDate(d2.getDate() - bDays);
            return d2.getFullYear()+'-'+String(d2.getMonth()+1).padStart(2,'0')+'-'+String(d2.getDate()).padStart(2,'0');
          }
        }
        return r.trigDate;
      }
      // Expiry-based (legacy): triggerDate = expiryDate - beforeDays
      if(!r.exp) return null;
      var ep=r.exp.split('-');
      if(ep.length!==3) return null;
      var ey=parseInt(ep[0]),em=parseInt(ep[1])-1,ed=parseInt(ep[2]);
      if(isNaN(ey)||isNaN(em)||isNaN(ed)) return null;
      var exp=new Date(ey,em,ed,0,0,0,0);
      var before=parseInt(r.before||0);
      // r.before stored as minutes in new reminders, as days in old ones
      var beforeD = before > 1440 ? Math.round(before/1440) : before;
      if(beforeD>0) exp.setDate(exp.getDate()-beforeD);
      return exp.getFullYear()+'-'+String(exp.getMonth()+1).padStart(2,'0')+'-'+String(exp.getDate()).padStart(2,'0');
    }

    // ── Days from today to a date (negative = past) ──
    function dFromNow(iso){
      if(!iso||typeof iso!=='string') return null;
      // ✅ Manual parse — no UTC midnight bug
      var dp=iso.split('-');
      if(dp.length!==3) return null;
      var y=parseInt(dp[0]),m=parseInt(dp[1])-1,d=parseInt(dp[2]);
      if(isNaN(y)||isNaN(m)||isNaN(d)) return null;
      var dt=new Date(y,m,d,0,0,0,0);
      if(isNaN(dt.getTime())) return null;
      var diff=Math.round((dt.getTime()-now.getTime())/86400000);
      if(isNaN(diff)) return null;
      return diff;
    }

    // ── Status badge — ONLY based on trigger date ──
    function statusBadge(dTrig,hasExpiry,completed){
      if(completed) return `<span class="badge bg" style="background:#dcfce7;color:#166534;border-color:#90c8a0;">✅ Completed</span>`;
      if(dTrig===null) return `<span class="badge bg" style="background:#e8f5e9;color:#1e7a45;">📅 Upcoming</span>`;
      // ✅ Only show "Expired" if expiry date was actually set; otherwise show "Overdue"
      if(dTrig<0)   return hasExpiry ? `<span class="badge br">❌ Expired ${Math.abs(dTrig)}d ago</span>` : `<span class="badge br">⏳ Overdue ${Math.abs(dTrig)}d</span>`;
      if(dTrig===0) return `<span class="badge br">🔔 Due Today</span>`;
      if(dTrig<=7)  return `<span class="badge by">⏰ In ${dTrig} day${dTrig>1?"s":""}</span>`;
      if(dTrig<=30) return `<span class="badge bg">📅 In ${dTrig} days</span>`;
      return `<span class="badge bg">✅ Upcoming — ${dTrig}d</span>`;
    }

    // ── Border colour ──
    function borderColor(dTrig,hasExpiry){
      // ✅ Red border only if expiry is set and past
      if(dTrig===null) return 'var(--bdr)';
      if(dTrig<0)  return hasExpiry ? '#e05050' : 'var(--bdr)';
      if(dTrig===0) return '#e09050';
      if(dTrig<=7)  return '#d4b840';
      return 'var(--bdr)';
    }

    // ── Compute all categorized entries ──
    // UNIFIED: user reminders + medical follow-ups + rent due
    const allEntries=[];
    const _doneIds=this._getDoneIds(); // load done-ids once

    // User-defined reminders (exclude rent auto & loan auto — shown in their own sections)
    this.reminders.filter(r=>!r._isAutoRent && !r._isAutoLoan && r.mode!=='rent').forEach(r=>{
      const trig=getTrig(r);
      const dTrig=dFromNow(trig);
      const dExp=(r.mode!=='recurring'&&r.exp)?dFromNow(r.exp):null;
      const completed=_doneIds.has(r.id)||!!r.completed;
      allEntries.push({...r,_trig:trig,_dTrig:dTrig,_dExp:dExp,_src:'reminder',_category:'Other',completed});
    });

    // ── AUTO ADD: Medical follow-ups → allEntries ──
    this.visits.forEach(v=>{
      const ni=(v.next&&v.next.includes('-'))?v.next:(v.next?dmyToIso(v.next)||null:null);
      if(!ni) return;
      const dTrig=this._dFromNow(ni);
      const pat=this.patients.find(p=>p.id===v.patId);
      const medId='med_'+v.id;
      allEntries.push({
        id:medId,
        name:(pat?pat.name+' — ':'')+( v.doctor?'Dr.'+v.doctor+' Follow-up':'Medical Follow-up'),
        type:'🏥 Medical',
        _trig:ni,_dTrig:dTrig,_dExp:null,_src:'medical',_category:'Medical',
        mode:'expiry',
        person:pat?pat.name:'',
        notes:v.purpose||v.meds||'',
        completed:_doneIds.has(medId)
      });
    });

    // ── AUTO ADD: Rent due → allEntries (Unified!) ──
    const rentCards=[];
    this.tenants.filter(t=>t.status==='active').forEach(t=>{
      const prop=this.props.find(p=>p.id===t.propId);
      const ledger=this.getTenantLedger(t);
      if(ledger.totalBalance<=0) return;
      const hasOverdueMonth=ledger.months.some(mo=>mo.status==='overdue');
      if(!hasOverdueMonth) return;
      const overdueMonths=ledger.months.filter(mo=>mo.status==='overdue');
      const daysOv=overdueMonths.length>0?Math.max(...overdueMonths.map(mo=>mo.daysOverdue||0)):0;
      // Add to allEntries for unified counting
      const rentId='rent_'+t.id;
      const rentDone=_doneIds.has(rentId);
      allEntries.push({
        id:rentId,
        name:'RENT OVERDUE — '+t.name,
        type:'💰 Rent',
        _trig:null,_dTrig:-daysOv,_dExp:null,_src:'rent',_category:'Rent',
        mode:'rent',_isAutoRent:true,
        _tenantId:t.id,_daysOv:daysOv,
        _balanceAmt:ledger.totalBalance,
        _receivedAmt:0,_invoiceAmt:ledger.totalBalance,
        _propName:prop?prop.name:'—',
        _tenantObj:t,
        completed:rentDone
      });
      if(rentDone) return; // hide from active list if marked done
      // Render card separately too
      const waMsg=encodeURIComponent('💰 *Rent Due*\nTenant: '+t.name+'\nDue: ₹'+fmt(ledger.totalBalance)+'\n\nPlease pay.\nRaman Kumar');
      rentCards.push(`<div style="background:var(--card);border:2px solid #e05050;border-left:4px solid #e05050;border-radius:11px;padding:13px 14px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:50%;background:rgba(224,80,80,.1);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">💰</div>
          <div style="flex:1;">
            <div style="font-weight:800;font-size:.9rem;">RENT OVERDUE — ${t.name}
              <span style="font-size:.6rem;background:#e05050;color:#fff;padding:1px 6px;border-radius:8px;margin-left:4px;">Rent</span>
              <span style="font-size:.6rem;background:#e05050;color:#fff;padding:1px 6px;border-radius:8px;">AUTO</span>
            </div>
            <div style="font-size:.73rem;color:var(--mut);margin-top:2px;">${prop?prop.name:'—'} · ${daysOv} days overdue · Due: ₹${fmt(ledger.totalBalance)}</div>
          </div>
          <span style="font-size:.7rem;background:#fff0f0;color:#e05050;border:1px solid #f09090;padding:2px 8px;border-radius:8px;white-space:nowrap;">${daysOv}d</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;border-top:1px solid var(--bdr);padding-top:8px;">
          <button class="btn b-grn b-sm" onclick="APP.openPayModal('${t.id}')">+ Payment</button>
          ${t.ph?`<button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1px solid #90c8a0;" onclick="APP.sendWhatsApp('${t.name}','${fmt(ledger.totalBalance)}','${t.ph}','rent')">📲 WA</button>`:`<button class="btn b-sm" style="background:#f0f2f5;color:#adb5bd;border:1px solid #e9ecef;cursor:not-allowed;" disabled title="Add phone">📵</button>`}
          ${t.email?`<a class="btn b-sm" style="background:#fff0f0;color:#c0392b;border:1px solid #fecaca;text-decoration:none;" href="mailto:${t.email}?subject=${encodeURIComponent('Rent Due — '+t.name)}&body=${encodeURIComponent('Hello '+t.name+',\n\nYour rent of ₹'+fmt(ledger.totalBalance)+' is pending.\n\nThank you,\nRaman Kumar')}">📧 Email</a>`:`<button class="btn b-sm" style="background:#f0f2f5;color:#adb5bd;border:1px solid #e9ecef;cursor:not-allowed;" disabled>📧</button>`}
          <button class="btn b-sm" style="background:#e3f2fd;color:#1760a0;border:1px solid #90b8e8;" onclick="APP.goTab('rent')">📒 Ledger</button>
          <button class="btn b-sm mark-done-btn" style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;font-weight:800;" onclick="APP.markReminderDone('${rentId}')">✅ Mark Done</button>
        </div>
      </div>`);
    });

    // ── Use shared engine — same data as Dashboard ──
    const remState=this._calcRemindersState();
    const catOverdue=remState.overdue;
    const catToday=remState.today;
    const catThisWeek=remState.thisWeek;
    const catThisMonth=remState.thisMonth;
    const catUpcoming=remState.upcoming;
    const catSafe=remState.safe;

    // ── UNIFIED counts (all types: reminders + medical + rent) ──
    const medEntries   = allEntries.filter(e=>e._src==='medical');
    const rentEntries  = allEntries.filter(e=>e._src==='rent');
    const otherEntries = allEntries.filter(e=>e._src==='reminder');
    // Overdue/Due count = catOverdue + catToday + rent overdue
    const due1w   = allEntries.filter(e=>e._dTrig!==null && e._dTrig>=0 && e._dTrig<=7 && e._src!=='rent').length;
    const due30d  = allEntries.filter(e=>e._dTrig!==null && e._dTrig>7 && e._dTrig<=30 && e._src!=='rent').length;
    const laterCnt= allEntries.filter(e=>e._dTrig!==null && e._dTrig>30 && e._src!=='rent').length;
    const totalAll = allEntries.length;
    const urgCnt   = catOverdue.length + catToday.length + rentCards.length;

    // ── COMPACT GRID CARD ──
    function buildCard(e){
      const isRecurring=e.mode==='recurring';
      const isMedical=e._src==='medical';
      const isRentAuto=e._src==='rent';
      const isLoanAuto=e.mode==='loan'&&e._isAutoLoan;
      const icon=isRentAuto?'💰':isLoanAuto?'🤝':isMedical?'🏥':(typeIcon[e.type]||'📌');

      // Type label badge
      const typeLabel=isRentAuto?'<span style="font-size:.55rem;background:#e05050;color:#fff;padding:1px 5px;border-radius:5px;font-weight:700;margin-left:4px;">Rent</span>':
                      isMedical?'<span style="font-size:.55rem;background:#1e7a45;color:#fff;padding:1px 5px;border-radius:5px;font-weight:700;margin-left:4px;">Medical</span>':
                      '<span style="font-size:.55rem;background:#2c6fad;color:#fff;padding:1px 5px;border-radius:5px;font-weight:700;margin-left:4px;">Other</span>';

      const dTrig=e._dTrig;
      const dExp=isRentAuto?null:e._dExp;

      // Rent-specific status and badge
      let bc,badge;
      if(isRentAuto){
        const dO=e._daysOv||0;
        const bal=e._balanceAmt||0;
        if(dO>0){bc='#e05050';badge=`<span class="badge br">🔴 ${dO}d Overdue</span>`;}
        else if((e._dTrig||0)===0){bc='#e09050';badge=`<span class="badge by">📋 Due Today</span>`;}
        else if((e._dTrig||0)>0){bc='var(--bdr)';badge=`<span class="badge ba">⏳ Upcoming</span>`;}
        else{bc='#e05050';badge=`<span class="badge br">🔴 Rent Pending</span>`;}
      } else if(isLoanAuto){
        const dI=e._dTrig||0;
        const outstanding=e._outstanding||0;
        if(outstanding<=0){bc='#90c8a0';badge=`<span class="badge bg">✅ Received</span>`;}
        else if(dI>0){bc='#e8a060';badge=`<span class="badge by">🤝 Due in ${dI}d</span>`;}
        else if(dI===0){bc='#e09050';badge=`<span class="badge by">🤝 Due Today</span>`;}
        else{bc='#e05050';badge=`<span class="badge br">⚠️ Overdue ${Math.abs(dI)}d</span>`;}
      } else {
        bc=e.completed?'#90c8a0':borderColor(dTrig, !!(e.exp));
        badge=statusBadge(dTrig, !!(e.exp), e.completed);
      }

      // Recurring: next 3 occurrences
      let nextOcc='';
      if(isRecurring&&e.nextTrigger){
        const rp=e.recurPeriod||'7';
        if(!rp.startsWith('minutes_')&&!rp.startsWith('hours_')){
          const pd=parseInt(rp)||7;
          let t=new Date(e.nextTrigger);t.setHours(0,0,0,0);
          while(Math.ceil((t-now)/86400000)<0) t.setDate(t.getDate()+pd);
          const pts=[];
          for(let i=0;i<3;i++){
            const dd=Math.ceil((t-now)/86400000);
            pts.push(`<span style="background:var(--dim);border-radius:4px;padding:1px 5px;font-size:.6rem;">${fD(t.toISOString().split('T')[0])} (${dd}d)</span>`);
            t=new Date(t);t.setDate(t.getDate()+pd);
          }
          nextOcc=`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px;">Next: ${pts.join('')}</div>`;
        }
      }

      // Detail section (hidden by default, toggled on click)
      const detailId='rdet_'+e.id.replace(/[^a-z0-9]/gi,'_');
      const detailHtml=`
        <div id="${detailId}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--bdr);font-size:.73rem;color:var(--mut);">
          ${e.person?`<div>👤 <b>${e.person}</b></div>`:''}
          ${!isRecurring&&!isRentAuto&&!isLoanAuto&&e.exp?(function(){
            var _dE=e._dExp;
            var _ok=(_dE!==null&&_dE!==undefined&&!isNaN(_dE));
            var _col=_ok&&_dE<=30?'var(--red)':'var(--txt)';
            var _lbl=_ok?(_dE>=0?'('+_dE+'d left)':'('+Math.abs(_dE)+'d ago)'):'';
            return '<div>📆 Expiry: <b style="color:'+_col+'">'+fD(e.exp)+'</b> '+_lbl+'</div>';
          })():''}
          ${isRentAuto?`<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:.72rem;">
            <span style="color:var(--mut)">💰 Monthly Rent</span><span><b>₹${fmt(e._invoiceAmt||0)}</b></span>
            ${e._receivedAmt>0?`<span style="color:var(--mut)">✅ Received</span><span style="color:var(--grn)"><b>₹${fmt(e._receivedAmt)}</b></span>`:''}
            <span style="color:var(--mut)">⚡ Outstanding</span><span style="color:var(--red);font-weight:700">₹${fmt(e._balanceAmt||0)}</span>
            ${e._daysOv>0?`<span style="color:var(--mut)">⏰ Overdue</span><span style="color:var(--red);font-weight:700">${e._daysOv} days</span>`:''}
          </div>`:''}
          ${isLoanAuto?`<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:.72rem;">
            <span style="color:var(--mut)">🤝 Borrower</span><span><b>${e.person||'—'}</b></span>
            <span style="color:var(--mut)">⚡ Outstanding</span><span style="color:var(--red);font-weight:700">${fmt(e._outstanding||0)}</span>
            ${e._trigDate?`<span style="color:var(--mut)">📅 Due Date</span><span>${fD(e._trigDate)}</span>`:''}
          </div>`:''}
          ${isRecurring?`<div>🔁 ${prdLabel[e.recurPeriod]||e.recurPeriod} · Before: ${e.recurBeforeVal||0} ${e.recurBeforeUnit||'days'}</div>`:''}
          ${e.notes?`<div>📝 ${APP.autoLink(e.notes)}</div>`:''}
          ${(e.alertHour||e.alertMin)?`<div style="font-size:.72rem;color:#1565c0;margin-top:2px;">🔔 Reminder at ${APP._fmt12hr(e.alertHour||'10',e.alertMin||'00')}</div>`:''}
          ${(e.daysOfWeek&&e.daysOfWeek.length)?`<div style="font-size:.7rem;color:var(--mut);margin-top:2px;">📆 On: ${e.daysOfWeek.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</div>`:''}
          ${(e.monthsOfYear&&e.monthsOfYear.length)?`<div style="font-size:.7rem;color:var(--mut);margin-top:1px;">📅 In: ${e.monthsOfYear.map(m=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]).join(', ')}</div>`:''}
          ${nextOcc}
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
            <button class="btn b-sm mark-done-btn" onclick="event.stopPropagation();APP.markReminderDone('${e.id}')" style="${e.completed?'background:#dcfce7;color:#166534;border:1.5px solid #90c8a0;font-weight:800;':'background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;font-weight:800;'}">
              ${e.completed?'↩️ Undo Done':'✅ Mark Done'}
            </button>
            ${!e.completed&&!isRentAuto&&!isLoanAuto?`<button class="btn b-sm" onclick="event.stopPropagation();APP.openSnooze('${e.id}')" style="background:#fff8ee;color:#b06000;border:1.5px solid #e0a040;font-weight:700;">⏰ Snooze</button>`:''}
            <button class="btn b-sm" onclick="event.stopPropagation();APP._remPlayTestSound()" title="Test sound" style="background:#f0f4ff;color:#2c6fad;border:1px solid #bfdbfe;font-weight:700;">🔔</button>
            ${isRentAuto?`
              <button class="btn b-grn b-sm" onclick="APP.openPayModal('${e._tenantId||''}')">💰 Pay Now</button>
              <button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1px solid #90c8a0;" onclick="APP.goTab('rent')">📒 Ledger</button>
            `:''}
            ${isLoanAuto?`<button class="btn b-out b-sm" onclick="APP.goTab('expense')">📒 View</button>`:''}
            ${!isRecurring&&!isMedical&&!isRentAuto&&!isLoanAuto?`<button class="btn b-grn b-sm" onclick="APP.markAsRenewed('${e.id}')">✅ Renew</button>`:isRentAuto?'':''}
            ${!isMedical&&!isRentAuto?`<button class="btn b-out b-sm" onclick="APP.openReminderModal('${e.id}')">✏️ Edit</button>`:''}
            ${!isMedical&&!isRentAuto?`<button class="btn b-red b-sm" onclick="APP.delReminder('${e.id}')">🗑</button>`:''}
            ${isMedical?`<button class="btn b-blu b-sm" onclick="APP.goTab('medical')">🏥 View</button>`:''}
          </div>
        </div>`;

      // Add completed class and badge if marked as done
      const completedClass = e.completed ? ' rem-completed' : '';
      const completedBadge = e.completed ? `<span class="rem-completed-badge" style="margin-left:4px;">✓ Done</span>` : '';

      return`<div class="${completedClass}" style="background:var(--card);border:1.5px solid ${bc};border-left:4px solid ${bc};border-radius:11px;padding:12px 13px;cursor:pointer;" onclick="(function(el){el.style.display=el.style.display==='none'?'block':'none';})(document.getElementById('${detailId}'))">
        <div style="display:flex;align-items:center;gap:9px;">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--dim);display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex-shrink:0;">${icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${toTitleCase(e.name)}${typeLabel}${completedBadge}${e.snoozedUntil?`<span style="font-size:.55rem;background:#fff8ee;color:#b06000;border:1px solid #e0a040;padding:1px 5px;border-radius:5px;margin-left:4px;font-weight:700;">⏰ Snoozed</span>`:''}</div>
            <div style="font-size:.68rem;color:var(--mut);">
              ${e.type||'—'} ${isRecurring?'· 🔁 '+(prdLabel[e.recurPeriod]||'Recurring'):''}
              ${!isRentAuto&&!isRecurring&&e.beforeLabel?'<span style="color:#2196f3;font-weight:700;margin-left:4px;">🔔 '+e.beforeLabel+'</span>':''}
            </div>
            ${!isRentAuto&&!isRecurring&&e.beforeLabel&&e.trigDate&&e._trig&&e._trig!==e.trigDate?
              `<div style="font-size:.62rem;color:var(--mut);margin-top:1px;">Alert: ${fD(e._trig)} · Due: ${fD(e.trigDate)}</div>` :
              (!isRentAuto&&e._trig?`<div style="font-size:.62rem;color:var(--mut);margin-top:1px;">${fD(e._trig)}</div>`:'')}
            ${e.snoozedUntil?`<div style="font-size:.6rem;color:#b06000;margin-top:1px;">⏰ Snoozed until ${(function(){var d=new Date(e.snoozedUntil);return d.toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});})()}</div>`:''}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            ${badge}
            <div style="font-size:.63rem;color:var(--mut);margin-top:2px;">${isRentAuto?(e._daysOv>0?e._daysOv+'d overdue':'Pending'):''}</div>
          </div>
        </div>
        ${detailHtml}
      </div>`;
    }

    // ── Section builder (with category filter chips) ──
    function section(title,color,items){
      if(!items.length) return '';
      // Sub-filter by type labels
      const rentI  = items.filter(e=>e._src==='rent');
      const medI   = items.filter(e=>e._src==='medical');
      const otherI = items.filter(e=>e._src==='reminder');
      const chips = [
        rentI.length  ? `<span style="font-size:.58rem;background:#e05050;color:#fff;padding:1px 6px;border-radius:5px;">💰 Rent: ${rentI.length}</span>` : '',
        medI.length   ? `<span style="font-size:.58rem;background:#1e7a45;color:#fff;padding:1px 6px;border-radius:5px;">🏥 Medical: ${medI.length}</span>` : '',
        otherI.length ? `<span style="font-size:.58rem;background:#2c6fad;color:#fff;padding:1px 6px;border-radius:5px;">📌 Other: ${otherI.length}</span>` : ''
      ].filter(Boolean).join(' ');
      return`<div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;padding:6px 12px;background:${color}18;border-radius:8px;border-left:3px solid ${color};flex-wrap:wrap;">
          <span style="font-size:.78rem;font-weight:800;color:${color};">${title}</span>
          <span style="font-size:.68rem;background:${color};color:#fff;padding:1px 9px;border-radius:10px;">${items.length}</span>
          <span style="flex:1;"></span>
          ${chips}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;">
          ${items.map(buildCard).join('')}
        </div>
      </div>`;
    }

    // Compute allEntries for due-in categories (non-rent only for 3d/30d stats)
    const nonRentEntries = allEntries.filter(e=>e._src!=='rent');
    
    // Separate completed and active reminders
    const completedReminders = allEntries.filter(e=>e.completed); // ALL types: medical, rent, other
    const activeAllEntries = allEntries.filter(e=>!e.completed);
    
    // Recalculate counts for active only
    const activeCatOverdue = catOverdue.filter(e=>!e.completed);
    const activeCatToday = catToday.filter(e=>!e.completed);
    const activeCatThisWeek = catThisWeek.filter(e=>!e.completed);
    const activeCatThisMonth = catThisMonth.filter(e=>!e.completed);
    const activeCatUpcoming = catUpcoming.filter(e=>!e.completed);
    const activeCatSafe = catSafe.filter(e=>!e.completed);

    document.getElementById('pan-reminder').innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:1.05rem;font-weight:800;">🔔 All Reminders
          ${urgCnt>0?`<span style="font-size:.72rem;background:#e05050;color:#fff;padding:2px 9px;border-radius:12px;margin-left:6px;">${urgCnt} urgent</span>`:''}
          <span style="font-size:.68rem;color:var(--mut);margin-left:8px;">Rent · Medical · Other</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn b-sm" onclick="APP._remBulkDoneAll()" style="background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;font-weight:700;font-size:.72rem;" title="Mark all urgent as done">⚡ Mark Urgent Done</button>
          <button class="btn b-sm" onclick="APP._remBulkDeleteCompleted()" style="background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;font-weight:700;font-size:.72rem;" title="Delete all completed">🗑 Clear Done</button>
          <button class="btn b-sm" onclick="APP._showAllRemindersPopup()" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:800;font-size:.72rem;">📋 All Reminders</button>
          <button class="btn b-sm" onclick="APP._remExportCSV()" style="background:#f0fdf4;color:#166534;border:1.5px solid #bbf7d0;font-weight:700;font-size:.72rem;">⬇️ CSV</button>
          <div style="position:relative;display:inline-block;" id="_pdfDropWrap">
            <button class="btn b-sm" onclick="(function(){var m=document.getElementById('_pdfDropMenu');m.style.display=m.style.display==='block'?'none':'block';})()" style="background:#fff0f0;color:#c0392b;border:1.5px solid #f09090;font-weight:700;font-size:.72rem;">📄 PDF ▾</button>
            <div id="_pdfDropMenu" style="display:none;position:absolute;top:110%;right:0;background:var(--card);border:1.5px solid var(--bdr2);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);z-index:200;min-width:180px;overflow:hidden;">
              <div onclick="APP._remDownloadPDF('overdue');document.getElementById('_pdfDropMenu').style.display='none';" style="padding:10px 14px;cursor:pointer;font-size:.78rem;font-weight:700;color:#991b1b;border-bottom:1px solid var(--bdr);" onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background=''">🔴 Overdue Reminders</div>
              <div onclick="APP._remDownloadPDF('upcoming');document.getElementById('_pdfDropMenu').style.display='none';" style="padding:10px 14px;cursor:pointer;font-size:.78rem;font-weight:700;color:#1a7a45;border-bottom:1px solid var(--bdr);" onmouseover="this.style.background='#f0faf5'" onmouseout="this.style.background=''">📅 Upcoming Reminders</div>
              <div onclick="APP._remDownloadPDF('all');document.getElementById('_pdfDropMenu').style.display='none';" style="padding:10px 14px;cursor:pointer;font-size:.78rem;font-weight:700;color:#1565c0;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">📋 All Reminders</div>
            </div>
          </div>
          <button class="btn b-sm" onclick="APP._remDownloadWord()" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:700;font-size:.72rem;">📝 Word</button>
          <button class="btn b-sm" onclick="APP.showCompletedPopup()" style="background:#dcfce7;color:#166534;border:1.5px solid #90c8a0;font-weight:700;font-size:.72rem;">
            ✅ Completed${completedReminders.length>0?' ('+completedReminders.length+')':''}
          </button>
          <button class="btn b-gold" onclick="APP.openReminderModal()" style="border-radius:20px;padding:7px 16px;">＋ Add Reminder</button>
        </div>
      </div>

      <!-- Quick Filter Bar -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:9px;box-shadow:var(--sh);align-items:center;">
        <span style="font-size:.65rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.07em;">Filter:</span>
        <button onclick="APP._remSetFilter('all')" id="remf_all" class="btn b-sm" style="background:var(--acc);color:#fff;border-color:var(--acc);">All (${totalAll})</button>
        <button onclick="APP._remSetFilter('urgent')" id="remf_urgent" class="btn b-sm b-out">🔴 Urgent (${urgCnt})</button>
        <button onclick="APP._remSetFilter('week')" id="remf_week" class="btn b-sm b-out">⏰ This Week (${due1w})</button>
        <button onclick="APP._remSetFilter('month')" id="remf_month" class="btn b-sm b-out">📅 This Month (${due30d})</button>
        <button onclick="APP._remSetFilter('medical')" id="remf_medical" class="btn b-sm b-out">🏥 Medical (${medEntries.filter(e=>!e.completed).length})</button>
        <button onclick="APP._remSetFilter('rent')" id="remf_rent" class="btn b-sm b-out">💰 Rent (${rentCards.length})</button>
        <span style="flex:1;"></span>
        <button onclick="APP._remPlayTestSound()" title="Test notification sound" style="background:transparent;border:none;cursor:pointer;font-size:1rem;padding:2px 6px;" title="Test sound">🔔</button>
        <button onclick="APP._pushToggleFromPanel()" id="remPushBtn" style="font-size:.7rem;padding:4px 9px;border-radius:6px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;border:1.5px solid #fca5a5;background:#fee2e2;color:#991b1b;" title="Enable browser push notifications">🔕 Push OFF</button>
      </div>

      <!-- Stats Bar — Unified counts -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:14px;">
        <div style="background:linear-gradient(135deg,#fff0f0,#ffe0e0);border:1.5px solid #f09090;border-radius:10px;padding:9px 10px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:900;color:#e05050;">${urgCnt}</div>
          <div style="font-size:.58rem;color:#e05050;font-weight:700;text-transform:uppercase;">Overdue / Today</div>
          <div style="font-size:.52rem;color:#e05050;opacity:0.7;margin-top:2px;">Urgent</div>
        </div>
        <div style="background:linear-gradient(135deg,#fffbee,#fff3cc);border:1.5px solid #d4b840;border-radius:10px;padding:9px 10px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:900;color:#b89000;">${due1w}</div>
          <div style="font-size:.58rem;color:#b89000;font-weight:700;text-transform:uppercase;">In 1 Week</div>
          <div style="font-size:.52rem;color:#b89000;opacity:0.7;margin-top:2px;">This Week</div>
        </div>
        <div style="background:linear-gradient(135deg,#f0faf4,#dcf5e8);border:1.5px solid #90c8a0;border-radius:10px;padding:9px 10px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:900;color:var(--grn);">${due30d}</div>
          <div style="font-size:.58rem;color:var(--grn);font-weight:700;text-transform:uppercase;">In 30 Days</div>
          <div style="font-size:.52rem;color:var(--grn);opacity:0.7;margin-top:2px;">This Month (30 Days)</div>
        </div>
        <div style="background:var(--card);border:1.5px solid var(--bdr2);border-radius:10px;padding:9px 10px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:900;color:var(--acc);">${totalAll}</div>
          <div style="font-size:.58rem;color:var(--mut);font-weight:700;text-transform:uppercase;">Total</div>
          <div style="font-size:.52rem;color:var(--mut);opacity:0.7;margin-top:2px;">All Reminders</div>
        </div>
      </div>

      <!-- Category legend -->
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
        <span style="font-size:.68rem;color:var(--mut);font-weight:700;">Types:</span>
        <span style="font-size:.7rem;background:#e05050;color:#fff;padding:2px 8px;border-radius:6px;font-weight:700;">💰 Rent (${rentCards.filter(x=>x).length})</span>
        <span style="font-size:.7rem;background:#1e7a45;color:#fff;padding:2px 8px;border-radius:6px;font-weight:700;">🏥 Medical (${medEntries.filter(e=>!e.completed).length})</span>
        <span style="font-size:.7rem;background:#2c6fad;color:#fff;padding:2px 8px;border-radius:6px;font-weight:700;">📌 Other (${otherEntries.filter(e=>!e.completed).length})</span>
        ${completedReminders.length>0?`<span onclick="APP.showCompletedPopup()" style="font-size:.7rem;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:6px;font-weight:700;cursor:pointer;border:1px solid #90c8a0;">✓ Done (${completedReminders.length}) →</span>`:''}
      </div>

      <div style="font-size:.68rem;color:var(--mut);margin-bottom:10px;">💡 Tap any card to expand · Click <b>✅ Mark Done</b> to complete · Done reminders move to Completed popup</div>

      ${allEntries.length===0?'<div class="empty"><div class="ei">🔔</div>No reminders yet — click + Add Reminder!</div>':''}

      ${rentCards.length?`<div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;padding:6px 12px;background:#e0505018;border-radius:8px;border-left:3px solid #e05050;">
          <span style="font-size:.78rem;font-weight:800;color:#e05050;">💰 Rent Overdue</span>
          <span style="font-size:.68rem;background:#e05050;color:#fff;padding:1px 9px;border-radius:10px;">${rentCards.length}</span>
        </div>
        ${rentCards.join('')}
      </div>`:''}

      ${section('🔴 Overdue / Expired','#e05050',activeCatOverdue)}
      ${section('🔔 Due Today','#e09050',activeCatToday)}
      ${section('⏰ Due in 1 Week','#c4900a',activeCatThisWeek.filter(e=>e._dTrig<=7))}
      ${section('📅 Due in 30 Days','#1e7a45',activeCatThisWeek.filter(e=>e._dTrig>7).concat(activeCatThisMonth))}
      ${section('🔮 Due in 1 Year','#1760a0',activeCatUpcoming)}
      ${section('✅ Safe (Beyond 1yr)','#2e7d32',activeCatSafe)}
      
    `;
    // Update live badge on tab
    this._remUpdateTabBadge(urgCnt);
    // Update push button state
    this._remUpdatePushBtn();
    // Apply active filter if set
    if(this._remActiveFilter && this._remActiveFilter !== 'all') this._remApplyFilterDOM(this._remActiveFilter);
  },

  // ── LIVE BADGE ON TAB ──
  _remUpdateTabBadge(cnt){
    const badge = document.getElementById('remTabBadge');
    if(!badge) return;
    if(cnt > 0){ badge.textContent = cnt > 99 ? '99+' : cnt; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  },

  // ── SNOOZE OPEN ──
  openSnooze(id){
    this._snoozeRId = id;
    const r = this.reminders.find(x => x.id === id);
    const nameEl = document.getElementById('snoozeRemName');
    if(nameEl) nameEl.textContent = r ? (r.name || 'Reminder') : 'Reminder';
    M.open('snoozeM');
  },

  // ── SNOOZE DO ──
  _doSnooze(val, unit){
    const id = this._snoozeRId;
    if(!id) return;
    const now = new Date();
    if(unit === 'minutes') now.setMinutes(now.getMinutes() + val);
    else if(unit === 'hours') now.setHours(now.getHours() + val);
    else if(unit === 'days') now.setDate(now.getDate() + val);
    const rs = this.reminders.map(r => r.id === id ? {...r, snoozedUntil: now.toISOString()} : r);
    S.set('reminders', rs);
    M.close('snoozeM');
    this.renderReminders();
    const unitLabel = unit === 'minutes' ? val + ' min' : unit === 'hours' ? val + ' hr' : val + ' day(s)';
    this.showToastMsg('⏰ Snoozed for ' + unitLabel + '!');
    // Schedule browser notification at snooze end
    this._scheduleSnoozeNotif(id, now);
  },

  _doSnoozeCustom(){
    const val = parseInt((document.getElementById('snoozeCustomVal')||{}).value) || 1;
    const unit = (document.getElementById('snoozeCustomUnit')||{}).value || 'days';
    this._doSnooze(val, unit);
  },

  // Schedule a JS setTimeout to fire a local browser notification when snooze ends
  _scheduleSnoozeNotif(id, fireAt){
    const ms = fireAt.getTime() - Date.now();
    if(ms <= 0 || ms > 24*60*60*1000) return; // max 24h window only
    if(this._snoozeTimers) clearTimeout(this._snoozeTimers[id]);
    if(!this._snoozeTimers) this._snoozeTimers = {};
    this._snoozeTimers[id] = setTimeout(() => {
      const r = this.reminders.find(x => x.id === id);
      if(!r) return;
      this._remPlaySound();
      if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
        try { new Notification('⏰ Snooze Over — ' + (r.name||'Reminder'), {body:'Your snoozed reminder is now due!',tag:'snooze-'+id}); } catch(e){}
      }
      // Clear snooze flag
      const rs = this.reminders.map(x => x.id === id ? {...x, snoozedUntil: null} : x);
      S.set('reminders', rs);
      if(this.curTab === 'reminder') this.renderReminders();
    }, ms);
  },

  // ── SOUND ALERT ──
  _remPlaySound(){
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch(e){}
  },

  _remPlayTestSound(){
    this._remPlaySound();
    this.showToastMsg('🔔 Sound test!');
  },

  // ── QUICK FILTER (DOM-based — no re-render) ──
  _remActiveFilter: 'all',

  _remSetFilter(f){
    this._remActiveFilter = f;
    // Update button styles
    ['all','urgent','week','month','medical','rent'].forEach(k => {
      const btn = document.getElementById('remf_' + k);
      if(!btn) return;
      if(k === f){ btn.style.background = 'var(--acc)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--acc)'; }
      else { btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; btn.className = 'btn b-sm b-out'; }
    });
    this._remApplyFilterDOM(f);
  },

  _remApplyFilterDOM(f){
    // Find all reminder cards (they have a specific class set in buildCard)
    const pan = document.getElementById('pan-reminder');
    if(!f || f === 'all') return; // all already visible
    // We can't easily filter DOM cards post-render without IDs; instead we re-render filtered
    // Just show a toast explaining active filter; full re-render would be expensive
    const labels = {urgent:'Urgent/Overdue',week:'This Week',month:'This Month',medical:'Medical',rent:'Rent'};
    // Actually scroll to the right section
    const sectionMap = {
      urgent: '🔴 Overdue', week: '⏰ Due in 1 Week', month: '📅 Due in 30', medical: '🏥', rent: '💰 Rent'
    };
    // Scroll to section header that contains the filter text
    const headers = pan ? pan.querySelectorAll('span[style*="font-weight:800"]') : [];
    for(const h of headers){
      const txt = sectionMap[f] || '';
      if(txt && h.textContent.includes(txt.substring(0,8))){
        h.scrollIntoView({behavior:'smooth', block:'start'});
        break;
      }
    }
  },

  // ── PUSH BTN UPDATE (from panel) ──
  _remUpdatePushBtn(){
    const btn = document.getElementById('remPushBtn');
    if(!btn) return;
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
    const enabled = localStorage.getItem('rk_push_enabled') === '1' && perm === 'granted';
    btn.textContent = enabled ? '🔔 Push ON' : '🔕 Push OFF';
    btn.style.background = enabled ? '#dcfce7' : '#fee2e2';
    btn.style.color = enabled ? '#166534' : '#991b1b';
    btn.style.borderColor = enabled ? '#90c8a0' : '#fca5a5';
  },

  _pushToggleFromPanel(){
    if(typeof _pushToggle === 'function') _pushToggle();
    setTimeout(() => this._remUpdatePushBtn(), 500);
  },

  // ── BULK ACTIONS ──
  _remBulkDoneAll(){
    const now = new Date();
    const urgent = this.reminders.filter(r => {
      if(r.completed) return false;
      const trig = r.trigDate || r.exp || r.nextTrigger;
      if(!trig) return false;
      const dp = trig.split('-');
      if(dp.length !== 3) return false;
      const d = new Date(parseInt(dp[0]), parseInt(dp[1])-1, parseInt(dp[2]));
      const diff = Math.round((d - now) / 86400000);
      return diff <= 0;
    });
    if(!urgent.length){ this.showToastMsg('✅ No urgent reminders to mark!'); return; }
    if(!confirm(`Mark ${urgent.length} overdue/due-today reminder(s) as done?`)) return;
    const ids = new Set(urgent.map(r => r.id));
    const rs = this.reminders.map(r => ids.has(r.id) ? {...r, completed: true} : r);
    S.set('reminders', rs);
    this.renderReminders(); this.renderPills();
    this.showToastMsg('✅ ' + urgent.length + ' reminder(s) marked as done!');
  },

  _remBulkDeleteCompleted(){
    const done = this.reminders.filter(r => r.completed);
    if(!done.length){ this.showToastMsg('No completed reminders to delete.'); return; }
    if(!confirm(`Delete ${done.length} completed reminder(s)? This cannot be undone.`)) return;
    S.set('reminders', this.reminders.filter(r => !r.completed));
    this.renderReminders(); this.renderPills();
    this.showToastMsg('🗑 ' + done.length + ' completed reminder(s) deleted!');
  },

  // ── EXPORT TO CSV ──
  // ── All Reminders Summary Popup ──────────────────────────────────
  _showAllRemindersPopup(){
    const now = new Date(); now.setHours(0,0,0,0);
    const allRems = this.reminders;
    const completed = allRems.filter(r=>r.completed);
    const rems = allRems.filter(r=>!r.completed); // active only

    // ── Compute invoice date for rent reminders ──
    const _getRentInvoiceDate = (r) => {
      if(!r._isAutoRent && r.mode!=='rent') return null;
      const t = this.tenants.find(t=>t.id===r._tenantId||t.id===r.id);
      if(!t) return null;
      if(t.invdate) return t.invdate; // stored invoice date
      // Compute: due day of current month
      const dueDay = Number(t.due||1);
      const n = new Date();
      const d = new Date(n.getFullYear(), n.getMonth(), dueDay);
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    };

    // ── Status function: handles rent overdue specially ──
    const getStatus = (r)=>{
      if(r.completed) return {label:'Completed',color:'#166534',bg:'#dcfce7',days:99999,isRent:false};

      const isRent = r._isAutoRent || r.mode==='rent';

      if(isRent){
        // Use _dTrig (pre-calculated overdue days) or _daysOv
        const dTrig = (typeof r._dTrig==='number') ? r._dTrig : null;
        const daysOv = r._daysOv || 0;
        if(daysOv>0 || (dTrig!==null&&dTrig<0)){
          const ovDays = daysOv>0 ? daysOv : Math.abs(dTrig);
          return {label:ovDays+'d Overdue',color:'#991b1b',bg:'#fee2e2',days:-ovDays,isRent:true};
        }
        if(dTrig===0) return {label:'Due Today',color:'#854d0e',bg:'#fef9c3',days:0,isRent:true};
        return {label:'Rent Due',color:'#854d0e',bg:'#fff8ee',days:0,isRent:true};
      }

      // Use alertDate (reminderDate) for status if set, else trigDate
      const alertTrig = r.reminderDate || r.trigDate || r.exp || r.nextTrigger || '';
      if(!alertTrig) return {label:'No Date',color:'#6c757d',bg:'var(--dim)',days:null,isRent:false};
      const dp = alertTrig.split('-');
      if(dp.length!==3) return {label:'No Date',color:'#6c757d',bg:'var(--dim)',days:null,isRent:false};
      const d = new Date(parseInt(dp[0]),parseInt(dp[1])-1,parseInt(dp[2]));
      const diff = Math.round((d-now)/86400000);
      if(diff<0)  return {label:Math.abs(diff)+'d Overdue',color:'#991b1b',bg:'#fee2e2',days:diff,isRent:false};
      if(diff===0)return {label:'Due Today',color:'#854d0e',bg:'#fef9c3',days:0,isRent:false};
      if(diff<=7) return {label:'In '+diff+'d',color:'#854d0e',bg:'#fff8ee',days:diff,isRent:false};
      if(diff<=30)return {label:'In '+diff+'d',color:'#1a7a45',bg:'#e8f5e9',days:diff,isRent:false};
      return {label:'In '+diff+'d',color:'#555',bg:'var(--dim)',days:diff,isRent:false};
    };

    // ── Categorize ──
    // Rent overdue/due → always in overdueList or todayList (NEVER in noDateList)
    const overdueList  = rems.filter(r=>{ const s=getStatus(r); return s.days!==null&&s.days<0; })
                             .sort((a,b)=>{ // Rent overdue first, then most overdue
                               const ar=a._isAutoRent||a.mode==='rent'?1:0;
                               const br=b._isAutoRent||b.mode==='rent'?1:0;
                               if(ar!==br) return br-ar; // rent first
                               return getStatus(a).days-getStatus(b).days;
                             });
    const todayList    = rems.filter(r=>{ const s=getStatus(r); return s.days===0; })
                             .sort((a,b)=>{ // Rent due today first
                               const ar=a._isAutoRent||a.mode==='rent'?0:1;
                               const br=b._isAutoRent||b.mode==='rent'?0:1;
                               return ar-br;
                             });
    const thisWeekList = rems.filter(r=>{ const s=getStatus(r); return s.days!==null&&s.days>0&&s.days<=7&&!s.isRent; })
                             .sort((a,b)=>getStatus(a).days-getStatus(b).days);
    const thisMonthList= rems.filter(r=>{ const s=getStatus(r); return s.days!==null&&s.days>7&&s.days<=30&&!s.isRent; })
                             .sort((a,b)=>getStatus(a).days-getStatus(b).days);
    const upcomingList = rems.filter(r=>{ const s=getStatus(r); return s.days!==null&&s.days>30&&!s.isRent; })
                             .sort((a,b)=>getStatus(a).days-getStatus(b).days);
    // No Date: only non-rent reminders with no trigger date
    const noDateList   = rems.filter(r=>{ const s=getStatus(r); return s.days===null&&!s.isRent; });

    // ── Make row ──
    const makeRow = (r, forceCompleted)=>{
      const isRent = r._isAutoRent||r.mode==='rent';
      const st = forceCompleted
        ? {label:'✅ Completed',color:'#166534',bg:'#dcfce7'}
        : getStatus(r);
      // Date display: for rent use invoice date
      let dateDisp = '';
      if(isRent){
        const invD = _getRentInvoiceDate(r);
        dateDisp = invD ? '· Invoice: '+fD(invD) : '· Rent';
      } else {
        // Show Due date (trigDate); if alertDate differs, show both
        var _dueD2 = r.trigDate || r.exp || r.nextTrigger || '';
        var _alertD2 = r.reminderDate || _dueD2;
        var _bDays2 = parseInt(r.beforeDays||0) || (r.before?Math.round(parseInt(r.before||0)/1440):0);
        if(_dueD2 && _alertD2 && _alertD2 !== _dueD2 && _bDays2 > 0){
          dateDisp = '· Due: '+fD(_dueD2)+' 🔔 '+fD(_alertD2)+'('+_bDays2+'d before)';
        } else {
          dateDisp = _dueD2 ? '· '+fD(_dueD2) : '';
        }
      }
      const typeLabel = isRent ? 'Rent' : (r.type||'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,'').trim()||'Other';
      // Rent: show balance
      const extraInfo = isRent && r._balanceAmt>0
        ? `<span style="color:#991b1b;font-weight:800;margin-left:6px;">₹${Number(r._balanceAmt).toLocaleString('en-IN')}</span>`
        : '';
      const nameStyle = forceCompleted
        ? 'font-size:.82rem;font-weight:700;word-break:break-word;text-decoration:line-through;opacity:.7;'
        : 'font-size:.82rem;font-weight:700;word-break:break-word;';
      const rowBg = isRent&&!forceCompleted ? 'background:#fffaf0;' : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--bdr);${rowBg}">
        <div style="flex:1;min-width:0;">
          <div style="${nameStyle}">${r.name||''}${extraInfo}</div>
          <div style="font-size:.68rem;color:var(--mut);">${typeLabel} ${dateDisp}</div>
        </div>
        <span style="background:${st.bg};color:${st.color};font-size:.65rem;font-weight:800;padding:2px 8px;border-radius:6px;white-space:nowrap;flex-shrink:0;">${st.label}</span>
      </div>`;
    };

    const section = (title, list, color, forceCompleted)=> list.length ? `
      <div style="background:${color};padding:6px 14px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-left:3px solid ${color==='#fff5f5'?'#e05050':color==='#fffbee'?'#e09050':color==='#dcfce7'?'#166534':'#adb5bd'};">${title} (${list.length})</div>
      ${list.map(r=>makeRow(r,!!forceCompleted)).join('')}` : '';

    // Active filter state for popup
    let _popFilter = 'all';

    const renderPopup = () => {
      const listEl = document.getElementById('_allRemList');
      if(!listEl) return;

      // Update filter button active states
      ['all','overdue','today','upcoming'].forEach(f=>{
        const btn = document.getElementById('_arp_f_'+f);
        if(btn){
          btn.style.background = _popFilter===f ? 'var(--acc)' : 'var(--dim)';
          btn.style.color = _popFilter===f ? '#fff' : 'var(--txt)';
          btn.style.borderColor = _popFilter===f ? 'var(--acc)' : 'var(--bdr2)';
        }
      });

      if(_popFilter==='overdue'){
        listEl.innerHTML = overdueList.length
          ? section('🔴 OVERDUE', overdueList, '#fff5f5')
          : '<div style="text-align:center;padding:40px;color:var(--mut);font-size:.88rem;">No overdue reminders 🎉</div>';
      } else if(_popFilter==='today'){
        listEl.innerHTML = todayList.length
          ? section('📅 DUE TODAY', todayList, '#fffbee')
          : '<div style="text-align:center;padding:40px;color:var(--mut);font-size:.88rem;">Nothing due today!</div>';
      } else if(_popFilter==='upcoming'){
        listEl.innerHTML =
          section('⏰ THIS WEEK', thisWeekList, '#fff8ee') +
          section('📅 THIS MONTH', thisMonthList, '#f0faf5') +
          section('🔮 UPCOMING', upcomingList, '#f0f4ff') +
          section('📌 NO DATE', noDateList, 'var(--dim)') ||
          '<div style="text-align:center;padding:40px;color:var(--mut);font-size:.88rem;">No upcoming reminders</div>';
      } else {
        // ALL — correct order: Rent Overdue → General Overdue → Today → This Week → This Month → Upcoming → No Date → Completed
        listEl.innerHTML =
          (overdueList.length   ? section('🔴 OVERDUE', overdueList, '#fff5f5') : '') +
          (todayList.length     ? section('📅 DUE TODAY', todayList, '#fffbee') : '') +
          (thisWeekList.length  ? section('⏰ THIS WEEK (1-7d)', thisWeekList, '#fff8ee') : '') +
          (thisMonthList.length ? section('📅 THIS MONTH (8-30d)', thisMonthList, '#f0faf5') : '') +
          (upcomingList.length  ? section('🔮 UPCOMING (30d+)', upcomingList, '#f0f4ff') : '') +
          (noDateList.length    ? section('📌 NO DATE', noDateList, 'var(--dim)') : '') +
          (completed.length     ? section('✓ COMPLETED', completed.slice(0,30), '#dcfce7', true) : '') +
          (!rems.length && !completed.length ? '<div style="text-align:center;padding:40px;color:var(--mut);">No reminders yet</div>' : '');
      }
    };

    const old = document.getElementById('_allRemPopup'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_allRemPopup';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `<div style="width:100%;max-width:640px;background:var(--card);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <!-- Header -->
      <div style="padding:14px 18px 12px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div>
            <div style="font-weight:800;font-size:1rem;">📋 All Reminders</div>
            <div style="font-size:.68rem;color:var(--mut);">Total: ${this.reminders.length} · Active: ${rems.length} · Completed: ${completed.length}</div>
          </div>
          <button onclick="document.getElementById('_allRemPopup').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
        </div>

        <!-- 4 clickable KPI cards -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px;">
          <button id="_arp_f_all" onclick="window._arpF='all';(()=>{window._arpF='all';APP._arpSetFilter('all');})()"
            style="background:var(--acc);color:#fff;border:1.5px solid var(--acc);border-radius:10px;padding:9px 6px;text-align:center;cursor:pointer;font-family:Nunito,sans-serif;transition:all .15s;">
            <div style="font-size:1.3rem;font-weight:900;">${rems.length}</div>
            <div style="font-size:.58rem;font-weight:800;text-transform:uppercase;opacity:.9;">All Active</div>
          </button>
          <button id="_arp_f_overdue" onclick="APP._arpSetFilter('overdue')"
            style="background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:10px;padding:9px 6px;text-align:center;cursor:pointer;font-family:Nunito,sans-serif;transition:all .15s;">
            <div style="font-size:1.3rem;font-weight:900;color:#991b1b;">${overdueList.length}</div>
            <div style="font-size:.58rem;font-weight:800;text-transform:uppercase;color:#991b1b;">⚠️ Overdue</div>
          </button>
          <button id="_arp_f_today" onclick="APP._arpSetFilter('today')"
            style="background:#fef9c3;color:#854d0e;border:1.5px solid #fde68a;border-radius:10px;padding:9px 6px;text-align:center;cursor:pointer;font-family:Nunito,sans-serif;transition:all .15s;">
            <div style="font-size:1.3rem;font-weight:900;color:#854d0e;">${todayList.length}</div>
            <div style="font-size:.58rem;font-weight:800;text-transform:uppercase;color:#854d0e;">📅 Today</div>
          </button>
          <button id="_arp_f_upcoming" onclick="APP._arpSetFilter('upcoming')"
            style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;border-radius:10px;padding:9px 6px;text-align:center;cursor:pointer;font-family:Nunito,sans-serif;transition:all .15s;">
            <div style="font-size:1.3rem;font-weight:900;color:#1a7a45;">${thisWeekList.length+thisMonthList.length+upcomingList.length+noDateList.length}</div>
            <div style="font-size:.58rem;font-weight:800;text-transform:uppercase;color:#1a7a45;">✅ Upcoming</div>
          </button>
        </div>

        <!-- Download buttons -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button onclick="APP._remDownloadPDF('overdue');"
            style="flex:1;min-width:120px;background:#e53935;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">🔴 Overdue PDF</button>
          <button onclick="APP._remDownloadPDF('upcoming');"
            style="flex:1;min-width:120px;background:#1a7a45;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">📅 Upcoming PDF</button>
          <button onclick="APP._remDownloadPDF('all');"
            style="flex:1;min-width:100px;background:#1565c0;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">📋 All PDF</button>
          <button onclick="APP._remDownloadWord();"
            style="flex:1;min-width:80px;background:#455a64;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">📝 Word</button>
          <button onclick="APP._remExportCSV();"
            style="flex:1;min-width:80px;background:#2e7d32;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">📊 CSV</button>
        </div>
      </div>
      <!-- List area -->
      <div id="_allRemList" style="overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });

    // Wire filter function
    APP._arpSetFilter = (f)=>{
      _popFilter = f;
      renderPopup();
    };
    renderPopup();
  },

  // ── Reminder PDF Download — filter: 'overdue' | 'upcoming' | 'all' ──
  _remDownloadPDF(filter){
    filter = filter || 'all';
    const now = new Date(); now.setHours(0,0,0,0);
    const allRems = this.reminders;

    // Strip emojis completely
    const stripE = s=>(s||'').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,'')
      .replace(/[\u{1F000}-\u{1FFFF}]/gu,'').replace(/[\u2600-\u27BF]/g,'')
      .replace(/[\u20D0-\u20FF\uFE00-\uFE0F]/g,'').trim();

    // Status calculator
    const getStatus = (r)=>{
      if(r.completed) return {label:'Completed',pri:99,days:null};
      const isRent = r._isAutoRent||r.mode==='rent';
      if(isRent){
        const daysOv = r._daysOv||0;
        const dTrig = typeof r._dTrig==='number'?r._dTrig:null;
        if(daysOv>0||(dTrig!==null&&dTrig<0)){
          const ov = daysOv>0?daysOv:Math.abs(dTrig||0);
          return {label:ov+'d Overdue',pri:0,days:-ov};
        }
        return {label:'Rent Due',pri:1,days:0};
      }
      const trig = r.trigDate||r.reminderDate||r.exp||r.nextTrigger||'';
      if(!trig) return {label:'No Date',pri:5,days:null};
      const dp=trig.split('-');
      if(dp.length!==3) return {label:'No Date',pri:5,days:null};
      const d=new Date(parseInt(dp[0]),parseInt(dp[1])-1,parseInt(dp[2]));
      const diff=Math.round((d-now)/86400000);
      if(diff<0)  return {label:Math.abs(diff)+'d Overdue',pri:0,days:diff};
      if(diff===0)return {label:'Due Today',pri:1,days:0};
      if(diff<=7) return {label:'This Week ('+diff+'d)',pri:2,days:diff};
      if(diff<=30)return {label:'This Month ('+diff+'d)',pri:3,days:diff};
      return {label:'In '+diff+'d',pri:4,days:diff};
    };

    // Get invoice/alert date
    const getDate = (r)=>{
      const isRent = r._isAutoRent||r.mode==='rent';
      if(isRent){
        const t=this.tenants&&this.tenants.find(x=>x.id===r._tenantId||x.id===r.id);
        if(!t) return '—';
        if(t.invdate) return fD(t.invdate);
        const n=new Date();
        const dd=new Date(n.getFullYear(),n.getMonth(),Number(t.due||1));
        return fD(dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0')+'-'+String(dd.getDate()).padStart(2,'0'));
      }
      const trig=r.trigDate||r.reminderDate||r.exp||r.nextTrigger||'';
      return trig?fD(trig):'—';
    };

    // Filter reminders based on chosen filter
    let filtered, titleSuffix, fileTag;
    if(filter==='overdue'){
      filtered = allRems.filter(r=>{ const s=getStatus(r); return s.pri===0 && !r.completed; });
      titleSuffix = 'Overdue Reminders';
      fileTag = 'Overdue';
    } else if(filter==='upcoming'){
      filtered = allRems.filter(r=>{ const s=getStatus(r); return s.pri>=1 && s.pri<=4 && !r.completed; });
      titleSuffix = 'Upcoming Reminders';
      fileTag = 'Upcoming';
    } else {
      filtered = allRems;
      titleSuffix = 'All Reminders';
      fileTag = 'All';
    }

    if(!filtered.length){
      this.showToastMsg('⚠️ No reminders in this category!');
      return;
    }

    // Sort: Rent overdue first → overdue → today → week → month → upcoming → no date → completed
    const sorted = [...filtered].sort((a,b)=>{
      const sa=getStatus(a), sb=getStatus(b);
      if(sa.pri!==sb.pri) return sa.pri-sb.pri;
      const ar=a._isAutoRent||a.mode==='rent'?0:1;
      const br=b._isAutoRent||b.mode==='rent'?0:1;
      if(ar!==br) return ar-br;
      const da=sa.days!=null?sa.days:9999;
      const db=sb.days!=null?sb.days:9999;
      return da-db;
    });

    const overdueCount = filtered.filter(r=>getStatus(r).pri===0).length;
    const todayCount   = filtered.filter(r=>getStatus(r).pri===1&&!r.completed).length;
    const upcomingCount= filtered.filter(r=>getStatus(r).pri>=2&&getStatus(r).pri<=4).length;

    // Build rows — Notes max 60 chars to prevent overflow
    const rows = sorted.map(r=>{
      const isRent = r._isAutoRent||r.mode==='rent';
      const name = stripE(r.name||'').slice(0,45)+(stripE(r.name||'').length>45?'…':'');
      const type = isRent?'Rent':stripE((r.type||'Other').replace(/^[^\w\s]+\s*/,''));
      const date = getDate(r);
      const st   = getStatus(r);
      const amt  = isRent&&r._balanceAmt?'Rs.'+Number(r._balanceAmt).toLocaleString('en-IN'):(r.exp&&!isRent?fD(r.exp):'—');
      const rawNotes = stripE(r.notes||'');
      const notes = rawNotes.slice(0,80)+(rawNotes.length>80?'...':'');
      return [name, type, date, amt, st.label, notes];
    });

    _makePDF({
      filename: 'Reminders_'+fileTag+'_'+todayISO()+'.pdf',
      title: titleSuffix,
      subtitle: 'Total: '+filtered.length+' | Overdue: '+overdueCount+' | Due Today: '+todayCount+' | Upcoming: '+upcomingCount+' | '+todayDMY(),
      orientation: 'landscape',
      columns: ['Name','Type','Alert Date','Expiry/Amt','Status','Notes'],
      rows,
      headerColor: [44,111,173],
      // A4 landscape: 297mm - (14mm × 2) margins = 269mm usable
      // Column widths: 60+20+25+25+30+109 = 269mm exactly
      entriesLabel: filter==='overdue'?'Showing: Overdue & Rent Due reminders only':
                    filter==='upcoming'?'Showing: Upcoming (Today + This Week + Month + Future)':
                    'All reminders | Sorted: Overdue first -> Today -> Upcoming -> Completed',
      colStyles: {
        0:{cellWidth:60, overflow:'linebreak', valign:'top'},
        1:{cellWidth:20, halign:'center', valign:'top'},
        2:{cellWidth:25, halign:'center', valign:'top'},
        3:{cellWidth:25, halign:'center', valign:'top'},
        4:{cellWidth:30, halign:'center', fontStyle:'bold', valign:'top'},
        5:{cellWidth:109, overflow:'linebreak', valign:'top'}
      }
    });
    const msg = filter==='overdue'?'🔴 Overdue PDF ready!':filter==='upcoming'?'📅 Upcoming PDF ready!':'📋 All Reminders PDF ready!';
    this.showToastMsg(msg);
  },

  // ── Reminder Word Download ────────────────────────────────────
  _remDownloadWord(){
    const now = new Date(); now.setHours(0,0,0,0);
    const rems = this.reminders;
    // Strip emojis fully for Word compatibility
    const stripE = s=>(s||'').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]/gu,'').replace(/[^\x00-\x7F\u0900-\u097F\u20B9 ]/g,'').trim();

    const getStatus = (r)=>{
      if(r.completed) return {label:'Completed',color:'#166534',pri:99};
      const trig = r.trigDate||r.exp||r.nextTrigger||'';
      if(!trig) return {label:'No Date',color:'#6c757d',pri:5};
      const dp = trig.split('-');
      if(dp.length!==3) return {label:'No Date',color:'#6c757d',pri:5};
      const d = new Date(parseInt(dp[0]),parseInt(dp[1])-1,parseInt(dp[2]));
      const diff = Math.round((d-now)/86400000);
      if(diff<0)  return {label:Math.abs(diff)+'d Overdue',color:'#991b1b',pri:0};
      if(diff===0)return {label:'Due Today',color:'#854d0e',pri:1};
      if(diff<=7) return {label:'In '+diff+'d (This Week)',color:'#854d0e',pri:2};
      if(diff<=30)return {label:'In '+diff+'d (This Month)',color:'#b45309',pri:3};
      return {label:'In '+diff+'d',color:'#166534',pri:4};
    };

    // Sort: Overdue first → Today → This Week → This Month → Upcoming → No Date → Completed
    const sorted = [...rems].sort((a,b)=>{
      const sa=getStatus(a), sb=getStatus(b);
      if(sa.pri!==sb.pri) return sa.pri-sb.pri;
      // Within same priority, sort by date
      const ta=a.trigDate||a.exp||a.nextTrigger||'9999';
      const tb=b.trigDate||b.exp||b.nextTrigger||'9999';
      return ta.localeCompare(tb);
    });

    const overdueCount = rems.filter(r=>!r.completed&&getStatus(r).pri===0).length;
    const todayCount   = rems.filter(r=>!r.completed&&getStatus(r).pri===1).length;
    const completedCount = rems.filter(r=>r.completed).length;
    const genDate = todayDMY();

    // Build clean HTML table — Word opens .doc HTML perfectly, no letter breaks
    const tableRows = sorted.map(r=>{
      const st = getStatus(r);
      const trig = r.trigDate||r.exp||r.nextTrigger||'';
      const name = stripE(r.name||'');
      const type = stripE((r.type||'Other').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,''));
      const date = trig ? fD(trig) : '—';
      const notes = stripE(r.notes||'');
      const rowBg = r.completed?'#f0fdf4':st.pri===0?'#fff5f5':st.pri===1?'#fffbee':'';
      return `<tr style="background:${rowBg};">
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10pt;word-break:break-word;max-width:160px;">${name}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:9pt;white-space:nowrap;">${type}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:9pt;white-space:nowrap;font-family:monospace;">${date}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:9pt;color:${st.color};font-weight:bold;white-space:nowrap;">${st.label}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:9pt;word-break:break-word;max-width:160px;">${notes}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;font-size:10pt;margin:20mm 15mm;}
  h1{color:#1e3a6e;font-size:16pt;margin-bottom:4px;}
  .sub{font-size:9pt;color:#666;margin-bottom:12px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#1e3a6e;color:#fff;padding:6px 8px;text-align:left;font-size:9pt;border:1px solid #1e3a6e;}
  td{vertical-align:top;}
  tr:nth-child(even){background:#fafafa;}
  .legend{font-size:8pt;color:#888;margin-top:12px;}
</style></head><body>
<h1>Reminders Report</h1>
<div class="sub">Generated: ${genDate} | Total: ${rems.length} | Overdue: ${overdueCount} | Due Today: ${todayCount} | Completed: ${completedCount}</div>
<table>
  <thead><tr>
    <th style="width:28%">Name</th>
    <th style="width:14%">Type</th>
    <th style="width:14%">Date</th>
    <th style="width:18%">Status</th>
    <th style="width:26%">Notes</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="legend">Sort order: Overdue → Due Today → This Week → This Month → Upcoming → No Date → Completed</div>
</body></html>`;

    const blob = new Blob([html],{type:'application/msword;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url;
    a.download='Reminders_'+todayISO()+'.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToastMsg('📝 Word file downloaded!');
  },

  _remExportCSV(){
    // Strip emojis fully — keep letters, numbers, Indian chars, ₹, spaces, punctuation
    const _ce = s=>{
      if(!s) return '';
      return String(s)
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // surrogate pairs (emoji)
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')          // extended emoji
        .replace(/[\u2600-\u27BF]/g, '')                  // misc symbols/dingbats
        .replace(/[\uFE00-\uFE0F]/g, '')                  // variation selectors
        .replace(/\u200D/g, '')                           // zero width joiner
        .replace(/\uFEFF/g, '')                           // BOM
        .trim();
    };
    // Wrap cell safely for CSV — handle commas, quotes, newlines
    const csvCell = s => '"' + String(s||'').replace(/"/g,'""').replace(/\n/g,' ') + '"';

    const now = new Date(); now.setHours(0,0,0,0);
    const getStatusLabel = (r) => {
      if(r.completed) return 'Completed';
      const trig = r.trigDate || r.exp || r.nextTrigger || '';
      if(!trig) return 'No Date';
      const dp = trig.split('-');
      if(dp.length !== 3) return 'No Date';
      const d = new Date(parseInt(dp[0]), parseInt(dp[1])-1, parseInt(dp[2]));
      const diff = Math.round((d - now) / 86400000);
      if(diff < 0) return Math.abs(diff)+'d Overdue';
      if(diff === 0) return 'Due Today';
      if(diff <= 7) return 'This Week';
      if(diff <= 30) return 'This Month';
      return 'Upcoming';
    };
    const getStatusPri = (r) => {
      if(r.completed) return 99;
      const lbl = getStatusLabel(r);
      if(lbl.includes('Overdue')) return 0;
      if(lbl==='Due Today') return 1;
      if(lbl==='This Week') return 2;
      if(lbl==='This Month') return 3;
      if(lbl==='No Date') return 5;
      return 4;
    };

    // Sort: Overdue → Today → This Week → This Month → Upcoming → No Date → Completed
    const sorted = [...this.reminders].sort((a,b)=>{
      const pa=getStatusPri(a), pb=getStatusPri(b);
      if(pa!==pb) return pa-pb;
      const ta=a.trigDate||a.exp||a.nextTrigger||'9999';
      const tb=b.trigDate||b.exp||b.nextTrigger||'9999';
      return ta.localeCompare(tb);
    });

    const header = ['Sr.','Name','Person','Type','Alert Date (DD/MM/YYYY)','Expiry Date','Status','Mode','Frequency','Notes'];
    const rows = sorted.map((r, i) => {
      const trig = r.trigDate || r.exp || r.nextTrigger || '';
      const freq = r.mode==='recurring'
        ? (_ce(r.repeatLabel||'')||({'1':'Daily','7':'Weekly','30':'Monthly','365':'Yearly'}[r.recurPeriod]||'Recurring'))
        : 'Once';
      return [
        i+1,
        csvCell(_ce(r.name||'')),
        csvCell(_ce(r.person||'')),
        csvCell(_ce((r.type||'Other').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,''))),
        trig ? fD(trig) : '',
        r.exp ? fD(r.exp) : '',
        getStatusLabel(r),
        _ce(r.mode||'expiry'),
        csvCell(_ce(freq)),
        csvCell(_ce(r.notes||''))
      ].join(',');
    });

    // BOM + header + rows
    const csv = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Reminders_' + todayISO() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToastMsg('✅ CSV downloaded — Excel mein open karein!');
  },

  // ── SMART TIME-BASED ALERT ENGINE ──
  // Fires browser notification at exact alertHour:alertMin for due-today reminders
  _remScheduleTimeAlerts(){
    if(typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if(!this._timeAlertTimers) this._timeAlertTimers = {};
    // Clear old timers
    Object.values(this._timeAlertTimers).forEach(t => clearTimeout(t));
    this._timeAlertTimers = {};
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    this.reminders.filter(r => !r.completed).forEach(r => {
      const trig = r.trigDate || r.exp || r.nextTrigger;
      if(!trig) return;
      const h = parseInt(r.alertHour || 10);
      const m = parseInt(r.alertMin || 0);
      // Only schedule for today or overdue
      const dp = trig.split('-');
      if(dp.length !== 3) return;
      const trigDay = new Date(parseInt(dp[0]), parseInt(dp[1])-1, parseInt(dp[2]));
      trigDay.setHours(0,0,0,0);
      const daysDiff = Math.round((trigDay - now) / 86400000);
      if(daysDiff > 1) return; // only today/overdue/tomorrow alerts
      // Fire time = today at alertHour:alertMin (or now + 1s if past)
      const fireAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      if(fireAt <= now) return; // already past
      const ms = fireAt.getTime() - now.getTime();
      if(ms > 24*60*60*1000) return;
      this._timeAlertTimers[r.id] = setTimeout(() => {
        this._remPlaySound();
        try {
          new Notification('🔔 ' + (r.name||'Reminder'), {
            body: (r.type||'') + (r.notes ? ' — ' + r.notes.slice(0,60) : ''),
            tag: 'rem-time-' + r.id,
            requireInteraction: true
          });
        } catch(e){}
      }, ms);
    });
  },

  openExpModal(id){
    this.editExpId=id||null;
    const el=document.getElementById('expM');
    if(!el)return;
    document.getElementById('expMT') && (document.getElementById('expMT').textContent=id?'✏️ Edit Transaction':'➕ Add Transaction');
    const delBtn=document.getElementById('exm_del_btn');
    if(delBtn) delBtn.style.display=id?'inline-flex':'none';
    // Init date picker
    const dWrap=document.getElementById('exm_date_wrap');
    if(dWrap) dWrap.innerHTML=makeDateInput('exm_date',(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})());
    if(id){
      const e=this.expenses.find(x=>x.id===id);
      if(e){
        sv('exm_type',e.type||'expense');
        sv('exm_cat',e.cat||'');
        sv('exm_amt',e.amount||'');
        sv('exm_note',e.note||'');
        sv('exm_paymode',e.paymode||'Cash');
        // For editing, set account in dropdown
        setTimeout(()=>{
          APP._populateAccountDropdown(e.account||'');
          if(e.type==='transfer'){
            APP._populateTransferDropdowns(e.fromAcc||e.account||'',e.toAcc||'');
          }
        },50);
        svDate('exm_date',e.date||'');
        this._setExpType(e.type||'expense');
        sv('exm_cat',e.cat||'');
        this._renderCatGrid(e.type||'expense');
        // Loan fields
        if(e.type==='loan'){
          const lf=document.getElementById('exm_loan_fields');
          if(lf) lf.style.display='block';
          const bEl=document.getElementById('exm_borrower');
          if(bEl) bEl.value=e.loanBorrower||'';
          const lpEl2=document.getElementById('exm_loan_phone');
          if(lpEl2) lpEl2.value=e.loanPhone||'';
          const dw=document.getElementById('exm_loan_due_wrap');
          if(dw&&!dw.querySelector('input[id]')) dw.innerHTML=makeDateInput('exm_loan_due',e.loanDueDate||'');
          else svDate('exm_loan_due',e.loanDueDate||'');
          const ls=document.getElementById('exm_loan_status');
          if(ls) ls.value=e.loanStatus||'receivable';
          const pr=document.getElementById('exm_loan_partial_row');
          if(pr) pr.style.display=e.loanStatus==='partial'?'block':'none';
          const lr=document.getElementById('exm_loan_received');
          if(lr) lr.value=e.loanReceived||0;
        }
      }
    } else {
      this._setExpType('expense');
      sv('exm_amt','');sv('exm_note','');sv('exm_account','');
      sv('exm_paymode','Cash');
      svDate('exm_date',(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})());
      // Focus amount after open
      setTimeout(()=>{const a=document.getElementById('exm_amt');if(a)a.focus();},200);
      // Reset loan fields
      const lf=document.getElementById('exm_loan_fields');
      if(lf) lf.style.display='none';
      const bEl=document.getElementById('exm_borrower');
      if(bEl) bEl.value='';
    }
    // Populate account dropdown from saved accounts
    this._populateAccountDropdown(id?null:(this.expenses.find(x=>x.id===id)||{}).account||'');
    M.open('expM');
  },

  // ── File attachment for transactions ──
  _exmFiles: [],

  _exmHandleFiles(fileList){
    if(!fileList||!fileList.length) return;
    Array.from(fileList).forEach(file=>{
      const reader=new FileReader();
      reader.onload=ev=>{
        this._exmFiles.push({name:file.name,type:file.type,dataUrl:ev.target.result,size:file.size});
        this._exmRenderPreviews();
      };
      reader.readAsDataURL(file);
    });
    // reset input so same file can be re-selected
    const inp=document.getElementById('exm_file_input');
    if(inp) inp.value='';
  },

  _exmRenderPreviews(){
    const wrap=document.getElementById('exm_file_previews');
    if(!wrap) return;
    if(!this._exmFiles.length){wrap.innerHTML='';return;}
    wrap.innerHTML=this._exmFiles.map((f,i)=>{
      const isImg=f.type&&f.type.startsWith('image/');
      const ext=(f.name||'').split('.').pop().toUpperCase();
      const extIcon={'PDF':'📄','DOC':'📝','DOCX':'📝','XLS':'📊','XLSX':'📊'}[ext]||'📎';
      return `<div style="position:relative;display:inline-flex;align-items:center;gap:3px;background:var(--card);border:1px solid var(--bdr);border-radius:6px;padding:3px 6px;cursor:pointer;"
        onclick="APP._exmViewFile(${i})" title="${f.name}">
        ${isImg
          ? `<img src="${f.dataUrl}" style="height:36px;width:36px;object-fit:cover;border-radius:4px;display:block;">`
          : `<span style="font-size:1.2rem;">${extIcon}</span>`}
        <span style="font-size:.6rem;color:var(--mut);max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name.slice(0,10)}</span>
        <button onclick="event.stopPropagation();APP._exmRemoveFile(${i})"
          style="position:absolute;top:-4px;right:-4px;background:#e53935;color:#fff;border:none;border-radius:50%;width:14px;height:14px;font-size:.55rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
      </div>`;
    }).join('');
  },

  _exmViewFile(i){
    const f=this._exmFiles[i];
    if(!f) return;
    const isImg=f.type&&f.type.startsWith('image/');
    if(isImg){
      const win=window.open('','_blank','width=800,height=600');
      if(win) win.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${f.dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;">`);
    } else {
      // For docs, create download link
      const a=document.createElement('a');
      a.href=f.dataUrl; a.download=f.name; a.click();
    }
  },

  _exmRemoveFile(i){
    this._exmFiles.splice(i,1);
    this._exmRenderPreviews();
  },

  _exmGetFiles(){
    return this._exmFiles.map(f=>({name:f.name,type:f.type,dataUrl:f.dataUrl}));
  },

  _exmClearFiles(){
    this._exmFiles=[];
    this._exmRenderPreviews();
  },

  // Populate From/To dropdowns for Transfer
  _populateTransferDropdowns(fromVal,toVal){
    const accs=this.finAccounts;
    const opts='<option value="">— Select —</option>'
      +accs.map(a=>`<option value="${a.name}">${a.name}${a.bank?' ('+a.bank+')':''}</option>`).join('')
      +'<option value="__other__">Other…</option>';
    const fromSel=document.getElementById('exm_from_acc');
    const toSel=document.getElementById('exm_to_acc');
    if(fromSel){fromSel.innerHTML=opts;if(fromVal)fromSel.value=fromVal;}
    if(toSel){toSel.innerHTML=opts;if(toVal)toSel.value=toVal;}
    // Live preview
    const updatePreview=()=>{
      const f=fromSel?fromSel.value:'';
      const t=toSel?toSel.value:'';
      const prev=document.getElementById('exm_transfer_preview');
      if(prev) prev.textContent=(f&&t&&f!=='__other__'&&t!=='__other__')?f+' → '+t:'';
    };
    if(fromSel) fromSel.onchange=function(){if(this.value==='__other__'){const n=prompt('Account:','');if(n)this.value=n;}updatePreview();};
    if(toSel) toSel.onchange=function(){if(this.value==='__other__'){const n=prompt('Account:','');if(n)this.value=n;}updatePreview();};
    updatePreview();
  },

  // Populate account select from finAccounts
  _populateAccountDropdown(selectedName){
    const sel = document.getElementById('exm_account');
    if(!sel) return;
    const accs = this.finAccounts;
    const curVal = selectedName !== undefined ? selectedName : sel.value;
    sel.innerHTML = '<option value="">— Select Account —</option>'
      + accs.map(a=>`<option value="${a.name}" ${a.name===curVal?'selected':''}>${a.name}${a.bank?' ('+a.bank+')':''}</option>`).join('')
      + '<option value="__other__">Other / Manual…</option>';
    // If current value not in list, add it
    if(curVal && curVal!=='__other__' && !accs.find(a=>a.name===curVal)){
      sel.innerHTML += `<option value="${curVal}" selected>${curVal}</option>`;
    }
    sel.value = curVal||'';
    // Listen for "Other" selection
    sel.onchange = function(){
      if(this.value==='__other__'){
        const manual=prompt('Account name daalo (e.g. SBI Current, HDFC Savings):','');
        if(manual&&manual.trim()){this.value=manual.trim();}
        else this.value='';
      }
    };
  },

  // Add new account quick from transaction modal
  _exmAddAccount(){
    const name=prompt('Naya account naam daalo:\n(e.g. SBI Savings, HDFC Current, PhonePe, Cash)','');
    if(!name||!name.trim()) return;
    const accs=this.finAccounts;
    if(accs.find(a=>a.name===name.trim())){
      this.showToastMsg('Account already exists!');
      const sel=document.getElementById('exm_account');
      if(sel) sel.value=name.trim();
      return;
    }
    accs.push({id:uid(),name:name.trim(),atype:'payment',balance:0,bank:'',created:new Date().toISOString()});
    this.finAccounts=accs;
    this._populateAccountDropdown(name.trim());
    this.showToastMsg('✅ Account "'+name.trim()+'" added!');
  },

  _getCustomCats(type){
    let all; try{ all=JSON.parse(localStorage.getItem('rk_custom_cats')||'[]'); }catch{ all=[]; }
    return all.filter(c=>c.type===type).map(c=>c.name);
  },
  // Helper: set transaction type, highlight btn, show/hide loan fields
  _setExpType(type){
    document.getElementById('exm_type').value=type;
    // Update tab bar styling
    const typeConfig={
      expense:{color:'#e53935',tabId:'exm_tab_expense'},
      income:{color:'#22c55e',tabId:'exm_tab_income'},
      transfer:{color:'#3b82f6',tabId:'exm_tab_transfer'}
    };
    ['expense','income','transfer'].forEach(t=>{
      const btn=document.getElementById('exm_tab_'+t);
      if(!btn) return;
      if(t===type){
        btn.style.borderBottomColor=typeConfig[t].color;
        btn.style.color=typeConfig[t].color;
        btn.style.background='var(--card)';
        btn.style.fontWeight='800';
      } else {
        btn.style.borderBottomColor='transparent';
        btn.style.color='var(--mut)';
        btn.style.background='var(--dim)';
        btn.style.fontWeight='700';
      }
    });
    this._renderCatGrid(type);
    // Show/hide transfer vs regular account rows
    const accRow=document.getElementById('exm_account_row');
    const tfrRow=document.getElementById('exm_transfer_row');
    if(accRow) accRow.style.display=type==='transfer'?'none':'';
    if(tfrRow) tfrRow.style.display=type==='transfer'?'block':'none';
    if(type==='transfer'){
      this._populateTransferDropdowns();
    }
  },

  // Render category as compact dropdown (replaces old grid)
  _renderCatGrid(type){
    const builtIn={
      expense:['🍽 Food','🛒 Groceries','🚗 Transport','⛽ Fuel','💊 Medical','🏠 House Rent','🔌 Electricity','📱 Mobile','📺 Entertainment','👕 Shopping','📚 Education','✈️ Travel','🏋 Fitness','💇 Personal Care','💳 EMI','🎁 Gifts','🔧 Repair','💼 Business','📌 Other'],
      income:['💼 Salary','🏠 Rent Income','📈 Business','💰 Investment','🎁 Gift','💵 Freelance','🏦 Interest','🔄 Refund','📌 Other Income'],
      transfer:['🏦 Bank Transfer','💳 Credit Card Pay','💰 Cash Withdrawal','🔄 Self Transfer','📌 Other Transfer']
    };
    const custom=this._getCustomCats(type);
    const allCats=[...(builtIn[type]||builtIn.expense)];
    if(custom.length) allCats.splice(allCats.length-1,0,...custom);
    const curSel=document.getElementById('exm_cat').value;
    // Populate the visible dropdown
    const dropSel=document.getElementById('exm_cat_sel');
    if(dropSel){
      dropSel.innerHTML=allCats.map(c=>`<option value="${c}" ${c===curSel?'selected':''}>${c}</option>`).join('');
      // Sync to hidden input
      dropSel.onchange=()=>{document.getElementById('exm_cat').value=dropSel.value;};
      if(curSel) dropSel.value=curSel;
      if(!curSel&&allCats.length) document.getElementById('exm_cat').value=allCats[0];
    }
    // keep hidden select in sync
    const sel=document.getElementById('exm_cat');
    if(sel){sel.innerHTML=allCats.map(c=>`<option value="${c}" ${c===curSel?'selected':''}>${c}</option>`).join('');}
    // Update account label based on type
    const accLbl=document.getElementById('exm_account_label');
    if(accLbl){
      if(type==='income') accLbl.textContent='🏦 Account — Credit (Liya Hai)';
      else if(type==='expense') accLbl.textContent='🏦 Account — Debit (Diya Hai)';
      else accLbl.textContent='🏦 Account';
    }
  },

  _selectCat(cat,type){
    const sel=document.getElementById('exm_cat');
    if(sel) sel.value=cat;
    this._renderCatGrid(type||document.getElementById('exm_type').value||'expense');
    // Auto-focus amount if empty
    const amt=document.getElementById('exm_amt');
    if(amt&&!amt.value) setTimeout(()=>amt.focus(),50);
  },
  _updateExpCats(){
    const type=v('exm_type')||'expense';
    this._renderCatGrid(type);
  },
  _addCustomCat(){
    const row=document.getElementById('exm_custom_cat_row');
    if(row) row.style.display='block';
    const type=v('exm_type')||'expense';
    const typeSel=document.getElementById('exm_new_cat_type');
    if(typeSel) typeSel.value=type;
    const inp=document.getElementById('exm_new_cat_name');
    if(inp) setTimeout(()=>inp.focus(),50);
  },
  _cancelCustomCat(){
    const row=document.getElementById('exm_custom_cat_row');
    if(row) row.style.display='none';
    ['exm_new_cat_name','exm_new_cat_emoji'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  },
  _saveCustomCat(){
    const emoji=(document.getElementById('exm_new_cat_emoji')||{}).value.trim()||'📌';
    const name=(document.getElementById('exm_new_cat_name')||{}).value.trim();
    const type=(document.getElementById('exm_new_cat_type')||{}).value||'expense';
    if(!name){alert('Category name required!');return;}
    const fullName=emoji+' '+name;
    let all; try{ all=JSON.parse(localStorage.getItem('rk_custom_cats')||'[]'); }catch{ all=[]; }
    if(all.find(c=>c.name===fullName&&c.type===type)){alert('Category already exists!');return;}
    all.push({id:uid(),name:fullName,type});
    localStorage.setItem('rk_custom_cats',JSON.stringify(all));
    const typeHid=document.getElementById('exm_type');
    if(typeHid) typeHid.value=type;
    const sel=document.getElementById('exm_cat');
    if(sel) sel.value=fullName;
    this._setExpType(type);
    // Update dropdown too
    const ds=document.getElementById('exm_cat_sel');
    if(ds) ds.value=fullName;
    this._cancelCustomCat();
    this.showToastMsg('✅ Category "'+fullName+'" saved!');
  },
  _showManageCats(){
    let all; try{ all=JSON.parse(localStorage.getItem('rk_custom_cats')||'[]'); }catch{ all=[]; }
    if(!all.length){alert('No custom categories yet.');return;}
    const msg=all.map((c,i)=>`${i+1}. [${c.type}] ${c.name}`).join('\n');
    const delIdx=prompt('Custom Categories:\n\n'+msg+'\n\nType NUMBER to delete (or Cancel):');
    if(delIdx===null) return;
    const n=parseInt(delIdx)-1;
    if(isNaN(n)||n<0||n>=all.length){alert('Invalid number');return;}
    if(confirm('Delete "'+all[n].name+'"?')){
      all.splice(n,1);
      localStorage.setItem('rk_custom_cats',JSON.stringify(all));
      this._updateExpCats();
      this.showToastMsg('🗑 Category deleted');
    }
  },
  saveExpense(){
    const amt=v('exm_amt').replace(/,/g,''),date=vDate('exm_date')||(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    if(!amt||isNaN(Number(amt))){alert('Amount daalo!');return;}
    const type=v('exm_type')||'expense';

    // account: read from select; if __other__ use blank
    const rawAcct = document.getElementById('exm_account')?document.getElementById('exm_account').value:'';
    const acctVal = rawAcct==='__other__'?'':rawAcct;

    // Transfer: read From/To accounts
    const fromAcc = type==='transfer'?(document.getElementById('exm_from_acc')?document.getElementById('exm_from_acc').value:''):'';
    const toAcc   = type==='transfer'?(document.getElementById('exm_to_acc')?document.getElementById('exm_to_acc').value:''):'';

    // ── FIX 1: MANDATORY ACCOUNT VALIDATION ──
    if(type==='transfer'){
      if(!fromAcc){ this._showFieldError('exm_from_acc','Please select FROM account!'); return; }
      if(!toAcc)  { this._showFieldError('exm_to_acc',  'Please select TO account!');   return; }
      if(fromAcc===toAcc){ alert('From and To account same nahi ho sakta!'); return; }
    } else if(type!=='loan'){
      // For expense / income — account is mandatory
      if(!acctVal || acctVal===''){
        this._showFieldError('exm_account','⚠️ Please select an account!');
        return;
      }
    }

    // For transfer, build cat as "From → To" for clear display
    const catVal = type==='transfer'&&fromAcc&&toAcc ? fromAcc+' → '+toAcc : v('exm_cat');
    const amount = Number(amt);
    const data={type,cat:catVal,amount,date,note:v('exm_note'),paymode:v('exm_paymode'),
      account:type==='transfer'?(fromAcc||acctVal):acctVal,
      fromAcc:type==='transfer'?fromAcc:'',
      toAcc:type==='transfer'?toAcc:'',
      files:this._exmGetFiles()};

    // Clear files after save
    this._exmClearFiles();

    // Loan Given: extra fields
    if(type==='loan'){
      const borrower=document.getElementById('exm_borrower')?document.getElementById('exm_borrower').value.trim():'';
      if(!borrower){alert('Borrower name required for Loan Given!');return;}
      data.loanBorrower=borrower;
      const lpEl=document.getElementById('exm_loan_phone');
      if(lpEl&&lpEl.value.trim()) data.loanPhone=lpEl.value.trim();
      data.loanDueDate=vDate('exm_loan_due')||'';
      data.loanStatus=document.getElementById('exm_loan_status')?document.getElementById('exm_loan_status').value:'receivable';
      data.loanReceived=data.loanStatus==='partial'?Number(document.getElementById('exm_loan_received')?document.getElementById('exm_loan_received').value:0):0;
      if(data.loanStatus==='received') data.loanReceived=data.amount;
    }

    // Save expense
    const isEdit = !!this.editExpId;
    let es=this.expenses;
    let oldData = isEdit ? es.find(e=>e.id===this.editExpId) : null;
    if(isEdit){es=es.map(e=>e.id===this.editExpId?{...e,...data}:e);this.editExpId=null;}
    else{data.id=uid();es.push(data);}
    S.set('expenses',es);

    // ── FIX 2: UPDATE ACCOUNT BALANCE ──
    this._updateAccountBalance(data, isEdit, oldData);

    // Auto-create loan reminder if new loan given and not yet received
    if(type==='loan'&&!isEdit&&data.loanStatus!=='received'){
      this._syncLoanReminders();
    }
    // If loan marked received, remove its reminder
    if(type==='loan'&&data.loanStatus==='received'){
      this._syncLoanReminders();
    }
    M.close('expM');this.renderExpense();this.renderPills();
  },

  // ── Show error on account select field ──
  _showFieldError(fieldId, msg){
    const el = document.getElementById(fieldId);
    if(el){
      el.style.borderColor = '#e53935';
      el.style.boxShadow   = '0 0 0 2px rgba(229,57,53,.2)';
      el.focus();
      // Reset style after 3 seconds
      setTimeout(()=>{ el.style.borderColor=''; el.style.boxShadow=''; }, 3000);
    }
    this.showToastMsg(msg);
    alert(msg);
  },

  // ── Update account balance after expense/income/transfer saved ──
  _updateAccountBalance(data, isEdit, oldData){
    let accs = this.finAccounts;
    if(!accs || !accs.length) return; // no accounts defined — skip

    const amount = Number(data.amount) || 0;

    // Helper: apply delta to one account by name
    const adjustBalance = (accName, delta) => {
      if(!accName) return false;
      const idx = accs.findIndex(a => a.name === accName || a.id === accName);
      if(idx < 0) return false;
      accs[idx] = {...accs[idx], balance: (Number(accs[idx].balance)||0) + delta};
      return true;
    };

    // If editing: first REVERSE the old transaction effect
    if(isEdit && oldData){
      const oldAmt = Number(oldData.amount) || 0;
      if(oldData.type === 'expense')  adjustBalance(oldData.account,  +oldAmt); // undo debit
      if(oldData.type === 'income')   adjustBalance(oldData.account,  -oldAmt); // undo credit
      if(oldData.type === 'transfer'){
        adjustBalance(oldData.fromAcc, +oldAmt); // undo from-debit
        adjustBalance(oldData.toAcc,   -oldAmt); // undo to-credit
      }
    }

    // Apply NEW transaction effect
    if(data.type === 'expense'){
      // Debit from account (balance decreases)
      adjustBalance(data.account, -amount);
    } else if(data.type === 'income'){
      // Credit to account (balance increases)
      adjustBalance(data.account, +amount);
    } else if(data.type === 'transfer'){
      // Debit from source, credit to destination
      adjustBalance(data.fromAcc, -amount);
      adjustBalance(data.toAcc,   +amount);
    }
    // loan type: no immediate balance change (tracked separately)

    this.finAccounts = accs;
    this.showToastMsg('✅ Transaction saved! Account balance updated.');
  },

  // Mark loan as fully received → updates expense, removes reminder
  _markLoanReceived(loanId){
    if(!loanId){alert('Loan not found');return;}
    let exps=this.expenses;
    exps=exps.map(e=>e.id===loanId?{...e,loanStatus:'received',loanReceived:e.amount}:e);
    S.set('expenses',exps);
    this._syncLoanReminders();
    this.showToastMsg('✅ Loan marked as Received! Reminder removed.');
    this.renderPills();
    if(this.curTab==='expense') this.renderExpense();
    if(this.curTab==='reminder') this.renderReminders();
  },

  // Mark loan as partially received
  _markLoanPartial(loanId){
    if(!loanId){alert('Loan not found');return;}
    const loan=this.expenses.find(e=>e.id===loanId);
    if(!loan) return;
    const amtStr=prompt('Partial received for '+loan.loanBorrower+'\nTotal: '+fmt(loan.amount)+'\nAlready: '+fmt(loan.loanReceived||0)+'\n\nEnter total received so far:', loan.loanReceived||0);
    if(amtStr===null) return;
    const amt=Number(amtStr);
    if(isNaN(amt)||amt<0){alert('Invalid amount');return;}
    const status=amt>=loan.amount?'received':'partial';
    let exps=this.expenses;
    exps=exps.map(e=>e.id===loanId?{...e,loanStatus:status,loanReceived:amt}:e);
    S.set('expenses',exps);
    this._syncLoanReminders();
    this.showToastMsg(status==='received'?'✅ Loan fully received! Reminder removed.':('⚠️ Partial: ₹'+amt.toLocaleString('en-IN')+' received. Reminder updated.'));
    this.renderPills();
    if(this.curTab==='expense') this.renderExpense();
    if(this.curTab==='reminder') this.renderReminders();
  },

  // ═══════════════════════════════════════════════════════════════
  // LOAN REMINDER ENGINE
  // - Creates ONE reminder per outstanding loan
  // - Reminder stays ACTIVE until loan status = 'received'
  // - On received → auto-remove reminder
  // ═══════════════════════════════════════════════════════════════
  _syncLoanReminders(){
    const now=new Date();now.setHours(0,0,0,0);
    let reminders=[...this.reminders];
    let changed=false;
    const loans=this.expenses.filter(e=>e.type==='loan'||e.type==='loan_taken');

    loans.forEach(loan=>{
      const remKey='auto_loan_'+loan.id;
      const existIdx=reminders.findIndex(r=>r._autoKey===remKey);

      if(loan.loanStatus==='received'){
        // Remove reminder if loan is received
        if(existIdx!==-1){reminders.splice(existIdx,1);changed=true;}
        return;
      }

      // Outstanding loan — create/update reminder
      const trigDate=loan.loanDueDate||loan.date||now.toISOString().split('T')[0];
      const dTrig=Math.ceil((new Date(trigDate)-now)/86400000);
      const outstanding=loan.amount-(loan.loanReceived||0);

      const reminderData={
        _autoKey:remKey,
        _isAutoLoan:true,
        _loanId:loan.id,
        name:'💼 Loan Recovery — '+(loan.loanBorrower||'Unknown'),
        type:'💰 Loan Given',
        person:loan.loanBorrower||'',
        mode:'loan',
        exp:trigDate,
        before:'0',
        _trigDate:trigDate,
        _dTrig:dTrig,
        _loanAmt:loan.amount,
        _loanReceived:loan.loanReceived||0,
        _outstanding:outstanding,
        notes:'Given: '+fmt(loan.amount)+
              (loan.loanReceived>0?' | Received: '+fmt(loan.loanReceived):'')+ 
              ' | Outstanding: '+fmt(outstanding)+
              (loan.loanDueDate?' | Due: '+fD(loan.loanDueDate):''),
        autorenew:'no'
      };

      if(existIdx!==-1){
        // Only mark changed if data actually differs
        const existing = reminders[existIdx];
        const hasChange = existing._outstanding !== reminderData._outstanding ||
                          existing._loanReceived !== reminderData._loanReceived ||
                          existing._dTrig !== reminderData._dTrig;
        if(hasChange) {
          reminders[existIdx]={...reminders[existIdx],...reminderData};
          changed=true;
        }
      } else {
        // Use deterministic ID based on autoKey to prevent duplicates across devices
        reminders.push({id:remKey,...reminderData});
        changed=true;
      }
    });

    if(changed){S.set('reminders',reminders);}
  },


  deleteCurrentExpense(){
    if(this.editExpId) this.delExpense(this.editExpId);
    M.close('expM');
  },

  delExpense(id){
    this.delCb=()=>{
      // Reverse account balance before deleting
      const exp = this.expenses.find(e=>e.id===id);
      if(exp) this._updateAccountBalance(exp, true, exp); // treat as edit-undo (reverses old)
      S.set('expenses',this.expenses.filter(e=>e.id!==id));
      this.renderExpense();this.renderPills();
    };
    document.getElementById('delMsg').textContent='Delete this transaction?';M.open('delM');
  },
  // ═══════════════════════════════════════════════════════
  // FINANCE MODULE — MyMoney Pro Style
  // Sub-tabs: Overview | Accounts | Transactions | Budget | Charts | Reports
  // ═══════════════════════════════════════════════════════

  // ── Sub-tab router ──

  _finChartsExtra(){
    const allExp=this.expenses||[];
    const now=new Date();
    const curMon=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    // Category spending — current month
    const catMap={};
    allExp.filter(e=>e.type==='expense'&&e.date&&e.date.startsWith(curMon)).forEach(e=>{
      const cat=(e.cat||'Other').replace(/^[^\s]*\s/,'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,'').trim()||'Other';
      catMap[cat]=(catMap[cat]||0)+Number(e.amount||0);
    });
    const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const total=cats.reduce((s,c)=>s+c[1],0);
    const colors=['#2c6fad','#1a7a45','#c47c00','#e05050','#5c3496','#12766a'];
    // Monthly income vs expense for last 6 months
    const months=[];
    for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({y:d.getFullYear(),m:d.getMonth(),label:d.toLocaleString('en-IN',{month:'short'})});}
    const monthData=months.map(({y,m,label})=>{
      const key=y+'-'+String(m+1).padStart(2,'0');
      const inc=allExp.filter(e=>e.type==='income'&&e.date&&e.date.startsWith(key)).reduce((s,e)=>s+Number(e.amount||0),0);
      const exp=allExp.filter(e=>e.type==='expense'&&e.date&&e.date.startsWith(key)).reduce((s,e)=>s+Number(e.amount||0),0);
      return{label,inc,exp,key};
    });
    const maxVal=Math.max(...monthData.map(m=>Math.max(m.inc,m.exp)),1);
    const barW=44,barGap=12,chartH=110,startX=40;
    let bars='',xLabels='',yLines='';
    for(let yi=0;yi<=4;yi++){const yv=Math.round(maxVal*yi/4);const yy=chartH+10-Math.round(yi*chartH/4);yLines+=`<line x1="${startX}" y1="${yy}" x2="${startX+6*(barW+barGap)-barGap}" y2="${yy}" stroke="var(--bdr)" stroke-width="0.5"/><text x="${startX-4}" y="${yy+4}" text-anchor="end" fill="var(--mut)" font-size="9" font-family="Nunito,sans-serif">${yv>=100000?Math.round(yv/1000)+'k':yv}</text>`;}
    monthData.forEach(({label,inc,exp},i)=>{
      const x=startX+i*(barW+barGap);
      const incH=inc>0?Math.round((inc/maxVal)*chartH):1;
      const expH=exp>0?Math.round((exp/maxVal)*chartH):1;
      bars+=`<rect x="${x}" y="${chartH-incH+10}" width="${barW*0.46}" height="${incH}" fill="#22c55e" opacity="0.85" rx="2"/>`;
      bars+=`<rect x="${x+barW*0.5}" y="${chartH-expH+10}" width="${barW*0.46}" height="${expH}" fill="#ef4444" opacity="0.85" rx="2"/>`;
      xLabels+=`<text x="${x+barW/2}" y="${chartH+26}" text-anchor="middle" fill="var(--mut)" font-size="10" font-family="Nunito,sans-serif">${label}</text>`;
    });

    const pan=document.getElementById('pan-expense');
    if(!pan) return;
    pan.innerHTML=`
      ${this._finHeader('charts')}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">

        <!-- Category Pie / Bar -->
        <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:16px;box-shadow:var(--sh);">
          <div style="font-weight:800;font-size:.92rem;margin-bottom:12px;">🍕 This Month — By Category</div>
          ${cats.length?`
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${cats.map(([cat,amt],i)=>{
              const pct=total?Math.round(amt/total*100):0;
              return `<div>
                <div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:2px;">
                  <span style="font-weight:700;">${cat}</span>
                  <span style="font-family:'JetBrains Mono',monospace;font-weight:700;">₹${fmt(amt)} <span style="color:var(--mut);font-weight:400;">(${pct}%)</span></span>
                </div>
                <div style="background:var(--dim);border-radius:4px;height:8px;overflow:hidden;">
                  <div style="background:${colors[i]};width:${pct}%;height:100%;border-radius:4px;transition:width .4s;"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--bdr);display:flex;justify-content:space-between;font-size:.78rem;font-weight:700;">
            <span>Total Expenses</span><span style="font-family:'JetBrains Mono',monospace;color:var(--red);">₹${fmt(total)}</span>
          </div>`:'<div style="text-align:center;padding:20px;color:var(--mut);font-size:.83rem;">No expense data for this month</div>'}
        </div>

        <!-- Monthly trend -->
        <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:16px;box-shadow:var(--sh);">
          <div style="font-weight:800;font-size:.92rem;margin-bottom:4px;">📊 6-Month Income vs Expense</div>
          <div style="display:flex;gap:12px;font-size:.7rem;margin-bottom:10px;">
            <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#22c55e;border-radius:2px;display:inline-block;"></span>Income</span>
            <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#ef4444;border-radius:2px;display:inline-block;"></span>Expense</span>
          </div>
          <svg width="100%" viewBox="0 0 ${startX*2+6*(barW+barGap)-barGap} ${chartH+40}" style="overflow:visible;">
            ${yLines}${bars}${xLabels}
            <line x1="${startX}" y1="10" x2="${startX}" y2="${chartH+10}" stroke="var(--bdr)" stroke-width="1"/>
          </svg>
          <div style="margin-top:6px;display:grid;grid-template-columns:repeat(${monthData.length},1fr);gap:4px;font-size:.62rem;text-align:center;color:var(--mut);">
            ${monthData.map(m=>`<div><div style="color:#22c55e;font-weight:700;">+${m.inc>=1000?Math.round(m.inc/1000)+'k':m.inc||0}</div><div style="color:#ef4444;">-${m.exp>=1000?Math.round(m.exp/1000)+'k':m.exp||0}</div></div>`).join('')}
          </div>
        </div>
      </div>`;
  },

  renderExpense(){
    const sub = this.finSub || 'overview';
    if(sub === 'overview') this._finOverview();
    else if(sub === 'accounts') this._finAccounts();
    else if(sub === 'txn') this._finTransactions();
    else if(sub === 'networth') this._finNetWorth();
    else if(sub === 'budget') this._finBudget();
    else if(sub === 'charts') this._finChartsExtra();
    else if(sub === 'reports') this._finReports();
    else this._finOverview();
  },

  renderExpenseOverview(){ this._finOverview(); },

  _finNav(sub){
    this.finSub=sub;
    this.renderExpense();
  },

  // ── Finance date filter helpers ──
  _finDateFilter(){return{from:this._finFrom||'',to:this._finTo||'',period:this._finPeriod||'all'};},
  _finApplyFilter(exps){
    const {from,to,period}=this._finDateFilter();
    const now=new Date();
    let f=exps;
    if(period==='this_month'){const m=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');f=f.filter(e=>e.date&&e.date.startsWith(m));}
    else if(period==='last_month'){const d=new Date(now.getFullYear(),now.getMonth()-1,1);const m=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');f=f.filter(e=>e.date&&e.date.startsWith(m));}
    else if(period==='this_year'){const y=String(now.getFullYear());f=f.filter(e=>e.date&&e.date.startsWith(y));}
    else if(period==='custom'){
      if(from) f=f.filter(e=>e.date&&e.date>=from);
      if(to)   f=f.filter(e=>e.date&&e.date<=to);
    }
    return f;
  },
  _finFilterBar(){
    const from=this._finFrom||'';
    const to=this._finTo||'';
    const periodLabel=from||to?((from||'Start')+' → '+(to||'Today')):'All Time';
    return `<div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
      <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:.72rem;color:var(--mut);font-weight:600;">From</span>
        <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_ftf" value="${from?isoToDmy(from):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_ftf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._finFrom=iso;APP.renderExpense();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_ftf').showPicker&&document.getElementById('dfh_ftf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_ftf" value="${from||''} " onchange="(function(iso){var el=document.getElementById('df_ftf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._finFrom=iso;APP.renderExpense();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
        <span style="font-size:.72rem;color:var(--mut);font-weight:600;">To</span>
        <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_ftt" value="${to?isoToDmy(to):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_ftt');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._finTo=iso;APP.renderExpense();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_ftt').showPicker&&document.getElementById('dfh_ftt').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_ftt" value="${to||''} " onchange="(function(iso){var el=document.getElementById('df_ftt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._finTo=iso;APP.renderExpense();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
        ${from||to?`<button onclick="APP._finFrom='';APP._finTo='';APP.renderExpense();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 7px;">✕ Clear</button>`:''}
        <span style="font-size:.68rem;color:var(--acc);font-weight:700;margin-left:4px;">${periodLabel}</span>
      </div>
    </div>`;
  },

  _finHeader(active){
    const tabs=[
      {k:'overview',icon:'🏠',lbl:'Overview'},
      {k:'networth',icon:'🏛️',lbl:'Net Worth'},
      {k:'accounts',icon:'🏦',lbl:'Accounts'},
      {k:'txn',icon:'💳',lbl:'Transactions'},
      {k:'budget',icon:'🎯',lbl:'Budget'},
      {k:'charts',icon:'📊',lbl:'Charts'},
      {k:'reports',icon:'📋',lbl:'Reports'},
    ];
    return `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px;background:var(--dim);border-radius:12px;padding:5px;">
      ${tabs.map(t=>`<button onclick="APP._finNav('${t.k}')"
        style="flex:1;min-width:60px;padding:7px 4px;border:none;border-radius:8px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;transition:all .15s;
        background:${active===t.k?'var(--card)':'transparent'};
        color:${active===t.k?'var(--acc)':'var(--mut)'};
        box-shadow:${active===t.k?'0 1px 4px rgba(0,0,0,.08)':''};
        ">${t.icon}<br>${t.lbl}</button>`).join('')}
    </div>`;
  },

  // ── Helper: format month ──
  _finFmtMon(iso){ // iso = "2026-03"
    try{ return new Date(iso+'-01').toLocaleString('en-IN',{month:'short',year:'numeric'}); }
    catch(e){ return iso; }
  },

  // ═══════════ NET WORTH DASHBOARD ═══════════
  _finNetWorth(){
    const fmt = window.fmt||(n=>n.toLocaleString('en-IN'));
    const now = new Date();

    // ── Property Assets ──
    const props = this.props || [];
    let totalPropertyValue = 0, totalPropertyInvested = 0, totalPropertyLoan = 0;
    props.filter(p=>!p._draft).forEach(p=>{
      const vals = this.getPropValuations ? this.getPropValuations(p.id) : [];
      const latestMkt = vals.length ? Number(vals[vals.length-1].value)||0 : 0;
      const mkt = latestMkt > 0 ? latestMkt : Number(p.mkt||0);
      const led = p.ledger&&Array.isArray(p.ledger)&&p.ledger.length ? p.ledger : null;
      const invested = led ? led.reduce((s,e)=>s+Number(e.amount||0),0) : Number(p.cost||0);
      const effVal = mkt > 0 ? mkt : invested;
      totalPropertyValue += effVal;
      totalPropertyInvested += invested;
      totalPropertyLoan += Number(p.loan||0);
    });
    const propGain = totalPropertyValue - totalPropertyInvested;
    const propGainPct = totalPropertyInvested > 0 ? ((propGain/totalPropertyInvested)*100).toFixed(1) : null;

    // ── Bank / Account Assets ──
    const accs = this.finAccounts || [];
    const cashAssets = accs.filter(a=>a.atype!=='liability'&&a.atype!=='credit').reduce((s,a)=>s+Number(a.balance||0),0);
    const investAssets = accs.filter(a=>a.atype==='investment').reduce((s,a)=>s+Number(a.balance||0),0);
    const liabilities = accs.filter(a=>a.atype==='liability'||a.atype==='credit').reduce((s,a)=>s+Number(a.balance||0),0);

    // ── Rental Income (all-time) ──
    const tenantIds = (this.tenants||[]).map(t=>t.id);
    const totalRentalIncome = (this.payments||[]).filter(pm=>tenantIds.includes(pm.tenantId)&&pm.ptype!=='refund').reduce((s,pm)=>s+Number(pm.amount||0),0);
    const activeRent = (this.tenants||[]).filter(t=>t.status==='active').reduce((s,t)=>s+Number(t.rent||0)+Number(t.maint||0),0);

    // ── Khata Book balances ──
    let kbLena = 0, kbDena = 0;
    (this.kbEntries||[]).forEach(e=>{
      if(e.type==='lena') kbLena += Number(e.amount||0);
      else if(e.type==='dena') kbDena += Number(e.amount||0);
    });
    const kbNet = kbLena - kbDena;

    // ── Net Worth Calculation ──
    const totalAssets = totalPropertyValue + cashAssets + (kbNet > 0 ? kbNet : 0);
    const totalLiabilities = totalPropertyLoan + liabilities + (kbNet < 0 ? Math.abs(kbNet) : 0);
    const netWorth = totalAssets - totalLiabilities;

    // ── Monthly cash flow ──
    const curMon = now.toISOString().slice(0,7);
    const allExps = this.expenses||[];
    const monthInc = allExps.filter(e=>e.type==='income'&&e.date&&e.date.startsWith(curMon)).reduce((s,e)=>s+Number(e.amount||0),0);
    const monthExp = allExps.filter(e=>e.type==='expense'&&e.date&&e.date.startsWith(curMon)).reduce((s,e)=>s+Number(e.amount||0),0);
    const monthlyCashFlow = monthInc + activeRent - monthExp;

    // ── Asset allocation bar widths ──
    const assetBreakdown = [
      { label:'🏢 Properties', value:totalPropertyValue, color:'#1565c0' },
      { label:'🏦 Cash & Bank', value:cashAssets - investAssets, color:'#1a7a45' },
      { label:'📈 Investments', value:investAssets, color:'#7b1fa2' },
      { label:'🤝 Khata Lena', value:kbNet > 0 ? kbNet : 0, color:'#b56a00' },
    ].filter(a=>a.value>0);
    const totalAssetSum = assetBreakdown.reduce((s,a)=>s+a.value,0)||1;

    const kpi = (icon,label,val,sub,bg,color,border)=>`
      <div style="background:${bg};border:1.5px solid ${border};border-radius:14px;padding:14px 16px;">
        <div style="font-size:.58rem;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">${icon} ${label}</div>
        <div style="font-size:1.1rem;font-weight:900;color:${color};font-family:'JetBrains Mono',monospace;">${val}</div>
        ${sub?`<div style="font-size:.65rem;color:${color};opacity:.75;margin-top:3px;font-weight:600;">${sub}</div>`:''}
      </div>`;

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('networth')}

      <!-- NET WORTH HEADLINE -->
      <div style="background:${netWorth>=0?'linear-gradient(135deg,#e8f5e9,#f0faf5)':'linear-gradient(135deg,#fff0f0,#fff5f5)'};border:2px solid ${netWorth>=0?'#90c8a0':'#f09090'};border-radius:16px;padding:20px;text-align:center;margin-bottom:16px;">
        <div style="font-size:.7rem;font-weight:800;color:${netWorth>=0?'#1a7a45':'#c0392b'};text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">🏛️ Net Worth (Total Assets − Liabilities)</div>
        <div style="font-size:2.2rem;font-weight:900;color:${netWorth>=0?'#1a7a45':'#c0392b'};font-family:'JetBrains Mono',monospace;">${netWorth>=0?'':'−'}₹${fmt(Math.abs(netWorth))}</div>
        <div style="font-size:.78rem;color:${netWorth>=0?'#1a7a45':'#c0392b'};margin-top:6px;">
          Assets ₹${fmt(totalAssets)} − Liabilities ₹${fmt(totalLiabilities)}
        </div>
        <div style="margin-top:10px;font-size:.72rem;color:var(--mut);">
          🗓 Monthly cash flow: <b style="color:${monthlyCashFlow>=0?'#1a7a45':'#c0392b'}">${monthlyCashFlow>=0?'+':'−'}₹${fmt(Math.abs(monthlyCashFlow))}</b>
          &nbsp;·&nbsp; 🏠 Active rent: <b style="color:#1565c0">₹${fmt(activeRent)}/mo</b>
        </div>
      </div>

      <!-- KPI GRID -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px;">
        ${kpi('🏢','Property Value','₹'+fmt(totalPropertyValue), propGainPct?(propGain>=0?'▲+':'▼')+propGainPct+'% gain':'—','#e3f2fd','#1565c0','#90b8e8')}
        ${kpi('🏦','Cash & Bank','₹'+fmt(cashAssets), accs.filter(a=>a.atype!=='liability'&&a.atype!=='credit').length+' accounts','#e8f5e9','#1a7a45','#90c8a0')}
        ${kpi('📋','Total Liabilities','₹'+fmt(totalLiabilities), 'Property loans + others','#fff0f0','#c0392b','#f09090')}
        ${kpi('💵','Monthly Rent In','₹'+fmt(activeRent), totalRentalIncome>0?'All-time: ₹'+fmt(totalRentalIncome):'No active tenants','#fff8ee','#b56a00','#ffcc80')}
        ${kpi('🤝','Khata Net','₹'+fmt(Math.abs(kbNet)), kbNet>0?'Others owe you':kbNet<0?'You owe others':'All clear','#f5f0ff','#5c3496','#c0a0f0')}
        ${kpi('🏗️','Property Gain','₹'+fmt(propGain>0?propGain:0), propGainPct?'Return: '+propGainPct+'%':'Market value not set','#e8f5e9','#1a7a45','#90c8a0')}
      </div>

      <!-- ASSET BREAKDOWN -->
      ${assetBreakdown.length>0?`
      <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:var(--sh);">
        <div style="font-weight:800;font-size:.88rem;margin-bottom:12px;">📊 Asset Allocation</div>
        ${assetBreakdown.map(a=>{
          const pct = Math.round((a.value/totalAssetSum)*100);
          return `<div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px;">
              <span style="font-weight:700;">${a.label}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;">₹${fmt(a.value)} <span style="color:var(--mut);font-weight:400;">(${pct}%)</span></span>
            </div>
            <div style="height:9px;background:var(--dim);border-radius:5px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${a.color};border-radius:5px;transition:width .5s;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>`:``}

      <!-- PROPERTY LIST -->
      ${props.filter(p=>!p._draft).length>0?`
      <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:var(--sh);">
        <div style="font-weight:800;font-size:.88rem;margin-bottom:12px;">🏢 Properties Breakdown</div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:.76rem;min-width:400px;">
            <thead><tr style="background:var(--dim);">
              <th style="padding:7px 10px;text-align:left;font-weight:700;">Property</th>
              <th style="padding:7px 10px;text-align:right;font-weight:700;">Invested</th>
              <th style="padding:7px 10px;text-align:right;font-weight:700;">Mkt Value</th>
              <th style="padding:7px 10px;text-align:right;font-weight:700;">Gain</th>
              <th style="padding:7px 10px;text-align:right;font-weight:700;">Loan</th>
              <th style="padding:7px 10px;text-align:right;font-weight:700;">Equity</th>
            </tr></thead>
            <tbody>
              ${props.filter(p=>!p._draft).map((p,i)=>{
                const vals = this.getPropValuations ? this.getPropValuations(p.id) : [];
                const latestMkt = vals.length ? Number(vals[vals.length-1].value)||0 : 0;
                const mkt = latestMkt > 0 ? latestMkt : Number(p.mkt||0);
                const led = p.ledger&&Array.isArray(p.ledger)&&p.ledger.length ? p.ledger : null;
                const invested = led ? led.reduce((s,e)=>s+Number(e.amount||0),0) : Number(p.cost||0);
                const effVal = mkt > 0 ? mkt : invested;
                const gain = mkt > 0 && invested > 0 ? mkt - invested : 0;
                const loan = Number(p.loan||0);
                const equity = effVal - loan;
                return `<tr style="background:${i%2===0?'var(--card)':'var(--dim)'};">
                  <td style="padding:6px 10px;font-weight:600;">${p.name.slice(0,22)}</td>
                  <td style="padding:6px 10px;text-align:right;font-family:'JetBrains Mono',monospace;">${fmt(invested)||'—'}</td>
                  <td style="padding:6px 10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${mkt>0?'var(--grn)':'var(--mut)'};">${mkt?fmt(mkt):'—'}</td>
                  <td style="padding:6px 10px;text-align:right;font-weight:700;color:${gain>=0?'var(--grn)':'var(--red)'};">${gain?fmt(gain):'—'}</td>
                  <td style="padding:6px 10px;text-align:right;color:var(--red);">${loan?fmt(loan):'—'}</td>
                  <td style="padding:6px 10px;text-align:right;font-weight:800;color:${equity>=0?'#5c3496':'var(--red)'};">${fmt(equity)}</td>
                </tr>`;
              }).join('')}
              <tr style="background:var(--dim);font-weight:800;">
                <td style="padding:7px 10px;">TOTAL</td>
                <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;">${fmt(totalPropertyInvested)}</td>
                <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;color:var(--grn);">${fmt(totalPropertyValue)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:800;color:${propGain>=0?'var(--grn)':'var(--red)'};">${fmt(propGain)}</td>
                <td style="padding:7px 10px;text-align:right;color:var(--red);">${fmt(totalPropertyLoan)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:800;color:#5c3496;">${fmt(totalPropertyValue-totalPropertyLoan)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>`:``}

      <!-- QUICK LINKS -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn b-sm b-out" onclick="APP._finNav('accounts')" style="font-size:.75rem;">🏦 Manage Accounts</button>
        <button class="btn b-sm b-out" onclick="APP.goTab('property')" style="font-size:.75rem;">🏢 Property Module</button>
        <button class="btn b-sm b-out" onclick="APP._finNav('budget')" style="font-size:.75rem;">🎯 Budget Tracker</button>
        <button class="btn b-sm b-out" onclick="APP._finNav('charts')" style="font-size:.75rem;">📊 Expense Charts</button>
      </div>
    `;
  },

  // ═══════════ OVERVIEW ═══════════
  _finOverview(){
    const fmt = window.fmt||(n=>n.toLocaleString('en-IN'));
    const now = new Date();
    const allExps = this.expenses || [];

    // Date filter (same as Khata Book style)
    const finFrom = this._finOvFrom || '';
    const finTo   = this._finOvTo   || '';
    const filteredExps = allExps.filter(e=>{
      if(!e.date) return true;
      if(finFrom && e.date < finFrom) return false;
      if(finTo   && e.date > finTo)   return false;
      return true;
    });

    // All-time (or filtered) totals
    const totalExp = filteredExps.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount||0),0);
    const totalInc = filteredExps.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount||0),0);
    const balance = totalInc - totalExp;
    const periodLabel = finFrom||finTo ? ((finFrom||'Start')+' to '+(finTo||'Today')) : 'All Time';

    // Recent transactions (last 10 from filtered)
    const recent = [...filteredExps].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10);

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('overview')}
      
      <div style="margin-bottom:14px;">
        <h2 style="font-size:1.3rem;font-weight:800;color:var(--txt);margin-bottom:4px;">💼 Finance Overview</h2>
        <!-- Date filter bar — same style as Khata Book -->
        <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:9px 14px;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div style="font-size:.72rem;font-weight:800;color:var(--mut);">📅 Date Range: <span style="color:var(--acc);">${periodLabel}</span></div>
            <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
              <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_fof" value="${finFrom?isoToDmy(finFrom):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_fof');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._finOvFrom=iso;APP.renderExpenseOverview();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_fof').showPicker&&document.getElementById('dfh_fof').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_fof" value="${finFrom||''} " onchange="(function(iso){var el=document.getElementById('df_fof');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._finOvFrom=iso;APP.renderExpenseOverview();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
              <span style="font-size:.72rem;color:var(--mut)">to</span>
              <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_fot" value="${finTo?isoToDmy(finTo):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_fot');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._finOvTo=iso;APP.renderExpenseOverview();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_fot').showPicker&&document.getElementById('dfh_fot').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_fot" value="${finTo||''} " onchange="(function(iso){var el=document.getElementById('df_fot');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._finOvTo=iso;APP.renderExpenseOverview();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
              ${finFrom||finTo?`<button onclick="APP._finOvFrom='';APP._finOvTo='';APP.renderExpenseOverview();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 6px;">✕ Clear</button>`:''}
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
        <!-- Income -->
        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:14px;padding:16px 18px;box-shadow:var(--sh);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:38px;height:38px;border-radius:50%;background:#16a34a;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;flex-shrink:0;">💰</div>
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#15803d;font-weight:800;">INCOME</div>
          </div>
          <div style="font-size:1.6rem;font-weight:900;color:#15803d;font-family:'JetBrains Mono',monospace;margin-bottom:6px;">₹${fmt(totalInc)}</div>
          <div style="font-size:.78rem;color:#16a34a;font-weight:600;">${periodLabel}</div>
        </div>

        <!-- Expense -->
        <div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1.5px solid #fca5a5;border-radius:14px;padding:16px 18px;box-shadow:var(--sh);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:38px;height:38px;border-radius:50%;background:#dc2626;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;flex-shrink:0;">💸</div>
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#b91c1c;font-weight:800;">EXPENSE</div>
          </div>
          <div style="font-size:1.6rem;font-weight:900;color:#b91c1c;font-family:'JetBrains Mono',monospace;margin-bottom:6px;">₹${fmt(totalExp)}</div>
          <div style="font-size:.78rem;color:#dc2626;font-weight:600;">${periodLabel}</div>
        </div>

        <!-- Balance -->
        <div style="background:linear-gradient(135deg,${balance>=0?'#f0f9ff,#e0f2fe':'#fff7ed,#ffedd5'});border:1.5px solid ${balance>=0?'#7dd3fc':'#fdba74'};border-radius:14px;padding:16px 18px;box-shadow:var(--sh);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:38px;height:38px;border-radius:50%;background:${balance>=0?'#0284c7':'#ea580c'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;flex-shrink:0;">${balance>=0?'✅':'⚠️'}</div>
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:${balance>=0?'#0369a1':'#c2410c'};font-weight:800;">BALANCE</div>
          </div>
          <div style="font-size:1.6rem;font-weight:900;color:${balance>=0?'#0369a1':'#c2410c'};font-family:'JetBrains Mono',monospace;margin-bottom:6px;">₹${fmt(Math.abs(balance))}</div>
          <div style="font-size:.78rem;color:${balance>=0?'#0284c7':'#ea580c'};font-weight:600;">${balance>=0?'Surplus':'Deficit'}</div>
        </div>
      </div>

      <!-- 6-Month Income vs Expense Bar Chart -->
      ${(()=>{
        const now2=new Date();
        const months=[];
        for(let i=5;i>=0;i--){
          const d=new Date(now2.getFullYear(),now2.getMonth()-i,1);
          const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
          const label=d.toLocaleString('en-IN',{month:'short'});
          const inc=allExps.filter(e=>e.type==='income'&&e.date&&e.date.startsWith(key)).reduce((s,e)=>s+Number(e.amount||0),0);
          const exp=allExps.filter(e=>e.type==='expense'&&e.date&&e.date.startsWith(key)).reduce((s,e)=>s+Number(e.amount||0),0);
          months.push({key,label,inc,exp});
        }
        const maxVal=Math.max(...months.map(m=>Math.max(m.inc,m.exp)),1);
        const BH=80,BW=32,GAP=12,PAD=28;
        const chartW=months.length*(BW*2+GAP+8)+PAD;
        const bars=months.map((m,i)=>{
          const incH=Math.max(2,Math.round((m.inc/maxVal)*BH));
          const expH=Math.max(2,Math.round((m.exp/maxVal)*BH));
          const x=PAD+i*(BW*2+GAP+8);
          const incLbl=m.inc>=100000?(m.inc/100000).toFixed(1)+'L':m.inc>=1000?Math.round(m.inc/1000)+'k':'';
          const expLbl=m.exp>=100000?(m.exp/100000).toFixed(1)+'L':m.exp>=1000?Math.round(m.exp/1000)+'k':'';
          return '<rect x="'+x+'" y="'+(BH-incH)+'" width="'+BW+'" height="'+incH+'" rx="4" fill="#22c55e" opacity="0.85"/>'
            +'<rect x="'+(x+BW+2)+'" y="'+(BH-expH)+'" width="'+BW+'" height="'+expH+'" rx="4" fill="#ef4444" opacity="0.85"/>'
            +(incLbl?'<text x="'+(x+BW/2)+'" y="'+(BH-incH-4)+'" text-anchor="middle" font-size="8" font-weight="700" fill="#15803d" font-family="Nunito">'+incLbl+'</text>':'')
            +(expLbl?'<text x="'+(x+BW+2+BW/2)+'" y="'+(BH-expH-4)+'" text-anchor="middle" font-size="8" font-weight="700" fill="#dc2626" font-family="Nunito">'+expLbl+'</text>':'')
            +'<text x="'+(x+BW)+'" y="'+(BH+14)+'" text-anchor="middle" font-size="9" fill="var(--mut)" font-family="Nunito">'+m.label+'</text>';
        }).join('');
        return '<div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:14px;padding:14px 16px;margin-bottom:16px;box-shadow:var(--sh);">'
          +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
          +'<div style="font-weight:800;font-size:.88rem;">📊 Last 6 Months</div>'
          +'<div style="display:flex;gap:12px;font-size:.7rem;">'
          +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:#22c55e;display:inline-block;"></span>Income</span>'
          +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:#ef4444;display:inline-block;"></span>Expense</span>'
          +'</div></div>'
          +'<div style="overflow-x:auto;">'
          +'<svg viewBox="0 0 '+chartW+' '+(BH+24)+'" style="width:100%;min-width:'+Math.min(chartW,280)+'px;height:'+(BH+24)+'px;display:block;">'
          +bars
          +'<line x1="'+(PAD-6)+'" y1="0" x2="'+(PAD-6)+'" y2="'+BH+'" stroke="var(--bdr)" stroke-width="1"/>'
          +'<line x1="'+(PAD-6)+'" y1="'+BH+'" x2="'+(chartW-4)+'" y2="'+BH+'" stroke="var(--bdr)" stroke-width="1"/>'
          +'</svg></div></div>';
      })()}

      <!-- Recent Transactions -->
      <div class="card">
        <div class="card-hdr">
          <div class="card-title">📋 Recent Transactions</div>
          <button class="btn b-sm b-gold" onclick="APP._finNav('txn')">View All</button>
        </div>
        <div class="card-body">
          ${recent.length ? recent.map(e=>{
            const isInc = e.type==='income';
            const cleanCat = (e.cat||'Other').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim();
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr);">
              <div style="width:32px;height:32px;border-radius:50%;background:${isInc?'#dcfce7':'#fee2e2'};display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0;">${isInc?'💰':'💸'}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:.82rem;font-weight:700;">${cleanCat}</div>
                <div style="font-size:.68rem;color:var(--mut);">${fD(e.date)} ${e.note?' • '+e.note:''}</div>
              </div>
              <div style="font-size:.88rem;font-weight:900;font-family:'JetBrains Mono',monospace;color:${isInc?'var(--grn)':'var(--red)'};white-space:nowrap;">${isInc?'+':'−'}₹${fmt(e.amount||0)}</div>
            </div>`;
          }).join('') : '<div class="empty">No transactions yet</div>'}
        </div>
        <div class="card-foot">
          <button class="btn b-grn b-sm" onclick="APP.openExpModal()">➕ Add Transaction</button>
        </div>
      </div>
    `;
  },


  // ═══════════ ACCOUNTS ═══════════
  _finAccounts(){
    const accs = this.finAccounts;
    const fmt = window.fmt||(n=>n.toLocaleString('en-IN'));
    const typeLabel={'payment':'Payment','savings':'Savings','credit':'Credit Card','liability':'Liability','investment':'Investment'};
    const typeIcon ={'payment':'💵','savings':'🏦','credit':'💳','liability':'📋','investment':'📈'};
    const totalAssets=accs.filter(a=>a.atype!=='liability'&&a.atype!=='credit').reduce((s,a)=>s+Number(a.balance||0),0);
    const totalLiab  =accs.filter(a=>a.atype==='liability'||a.atype==='credit').reduce((s,a)=>s+Number(a.balance||0),0);

    // Active ledger account (for drill-down)
    const activeAccId = this._accLedgerId || null;
    const accLedgFrom = this._accLedgFrom || '';
    const accLedgTo   = this._accLedgTo   || '';

    // Build per-account ledger if selected
    let ledgerHtml = '';
    if(activeAccId){
      const acc = accs.find(a=>a.id===activeAccId);
      if(acc){
        const allExp = this.expenses||[];
        let txns = allExp.filter(e=>
          e.type!=='loan'&&e.type!=='loan_taken'&&
          (e.account===acc.name||e.fromAcc===acc.name||e.toAcc===acc.name)
        );
        if(accLedgFrom) txns=txns.filter(e=>e.date&&e.date>=accLedgFrom);
        if(accLedgTo)   txns=txns.filter(e=>e.date&&e.date<=accLedgTo);
        txns=[...txns].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
        const totIn  = txns.filter(e=>e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name)).reduce((s,e)=>s+Number(e.amount),0);
        const totOut = txns.filter(e=>e.type==='expense'||(e.type==='transfer'&&e.fromAcc===acc.name)).reduce((s,e)=>s+Number(e.amount),0);
        const netBal = totIn - totOut;
        const periodLabel = accLedgFrom||accLedgTo ? ((accLedgFrom||'Start')+' → '+(accLedgTo||'Today')) : 'All Time';

        const rowsHtml = txns.length ? txns.map((e,i)=>{
          const isIn = e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
          const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
          const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:cat):cat;
          const amtColor=isIn?'#1a7a45':'#c0392b';
          const amtSign=isIn?'+':'−';
          return `<tr style="${i%2===0?'background:#fff':'background:#f8faff'}">
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;white-space:nowrap;">${fD(e.date)}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;">${desc}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;color:var(--mut);">${e.paymode||'Cash'}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;color:var(--mut);word-break:break-word;">${e.note||'—'}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:'JetBrains Mono',monospace;color:#1a7a45;font-weight:700;">${isIn?fmt(Number(e.amount)):'—'}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:'JetBrains Mono',monospace;color:#c0392b;font-weight:700;">${!isIn?fmt(Number(e.amount)):'—'}</td>
          </tr>`;
        }).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--mut);font-size:.8rem;">No transactions found for this account</td></tr>`;

        ledgerHtml = `
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;overflow:hidden;margin-bottom:14px;">
          <!-- Ledger header -->
          <div style="background:linear-gradient(135deg,var(--acc),var(--acc2));padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.75);">Account Ledger</div>
              <div style="font-size:.95rem;font-weight:800;color:#fff;">${typeIcon[acc.atype]||'🏦'} ${acc.name}</div>
              ${acc.bank?`<div style="font-size:.65rem;color:rgba(255,255,255,.8);">${acc.bank}</div>`:''}
            </div>
            <button onclick="APP._accLedgerId=null;APP._finAccounts();" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">✕ Close</button>
          </div>

          <!-- Summary strip -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--bdr);">
            <div style="padding:10px 14px;text-align:center;border-right:1px solid var(--bdr);background:#f0fdf4;">
              <div style="font-size:.58rem;text-transform:uppercase;color:#1a7a45;font-weight:800;">Total In (+)</div>
              <div style="font-size:.95rem;font-weight:900;color:#1a7a45;font-family:'JetBrains Mono',monospace;">₹${fmt(totIn)}</div>
            </div>
            <div style="padding:10px 14px;text-align:center;border-right:1px solid var(--bdr);background:#fff0f0;">
              <div style="font-size:.58rem;text-transform:uppercase;color:#c0392b;font-weight:800;">Total Out (−)</div>
              <div style="font-size:.95rem;font-weight:900;color:#c0392b;font-family:'JetBrains Mono',monospace;">₹${fmt(totOut)}</div>
            </div>
            <div style="padding:10px 14px;text-align:center;background:${netBal>=0?'#f0fdf4':'#fff0f0'};">
              <div style="font-size:.58rem;text-transform:uppercase;color:${netBal>=0?'#1a7a45':'#c0392b'};font-weight:800;">Net Balance</div>
              <div style="font-size:.95rem;font-weight:900;color:${netBal>=0?'#1a7a45':'#c0392b'};font-family:'JetBrains Mono',monospace;">${netBal>=0?'+':'−'}₹${fmt(Math.abs(netBal))}</div>
            </div>
          </div>

          <!-- Date filter + Download buttons -->
          <div style="background:var(--card2);padding:9px 14px;border-bottom:1px solid var(--bdr);display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;">
            <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
              <span style="font-size:.68rem;color:var(--mut);font-weight:700;">📅</span>
              <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_alf" value="${accLedgFrom?isoToDmy(accLedgFrom):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_alf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._accLedgFrom=iso;APP._finAccounts();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_alf').showPicker&&document.getElementById('dfh_alf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_alf" value="${accLedgFrom||''} " onchange="(function(iso){var el=document.getElementById('df_alf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._accLedgFrom=iso;APP._finAccounts();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
              <span style="font-size:.72rem;color:var(--mut)">to</span>
              <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_alt" value="${accLedgTo?isoToDmy(accLedgTo):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_alt');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._accLedgTo=iso;APP._finAccounts();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_alt').showPicker&&document.getElementById('dfh_alt').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_alt" value="${accLedgTo||''} " onchange="(function(iso){var el=document.getElementById('df_alt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._accLedgTo=iso;APP._finAccounts();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
              ${accLedgFrom||accLedgTo?`<button onclick="APP._accLedgFrom='';APP._accLedgTo='';APP._finAccounts();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 7px;">✕ Clear</button>`:''}
              <span style="font-size:.65rem;color:var(--acc);font-weight:700;">${periodLabel} · ${txns.length} entries</span>
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
              <button onclick="APP._accLedgerPDF('${acc.id}')" class="btn b-sm b-out" style="border-color:#e53935;color:#e53935;font-size:.68rem;">📄 PDF</button>${APP._pdfOriHtml()}
              <button onclick="APP._accLedgerWord('${acc.id}')" class="btn b-sm b-out" style="border-color:#1565c0;color:#1565c0;font-size:.68rem;">📝 Word</button>
              <button onclick="APP._accLedgerCSV('${acc.id}')" class="btn b-sm b-out" style="border-color:#2e7d32;color:#2e7d32;font-size:.68rem;">📊 Excel/CSV</button>
            </div>
          </div>

          <!-- Transaction table -->
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:520px;">
              <thead>
                <tr style="background:#2c6fad;">
                  <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);">Date</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);">Description</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);">Mode</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);">Note</th>
                  <th style="padding:9px 10px;text-align:right;font-size:11px;font-weight:800;background:#1a7a45;color:#fff;border:1px solid rgba(255,255,255,.2);">In (+)</th>
                  <th style="padding:9px 10px;text-align:right;font-size:11px;font-weight:800;background:#c0392b;color:#fff;border:1px solid rgba(255,255,255,.2);">Out (−)</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr style="background:#dbeafe;font-weight:800;">
                  <td colspan="4" style="padding:9px 10px;border:1px solid #bfdbfe;font-size:12px;color:#1e3a5f;">Grand Total — ${txns.length} transactions</td>
                  <td style="padding:9px 10px;border:1px solid #bfdbfe;text-align:right;font-family:'JetBrains Mono',monospace;font-size:13px;color:#1a7a45;">₹${fmt(totIn)}</td>
                  <td style="padding:9px 10px;border:1px solid #bfdbfe;text-align:right;font-family:'JetBrains Mono',monospace;font-size:13px;color:#c0392b;">₹${fmt(totOut)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>`;
      }
    }

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('accounts')}

      <!-- ══ NET WORTH BANNER + Add Account at top ══ -->
      <div style="background:linear-gradient(135deg,var(--acc),var(--acc2));border-radius:14px;padding:14px 16px;margin-bottom:14px;color:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;opacity:.75;margin-bottom:2px;">NET WORTH</div>
            <div style="font-size:1.5rem;font-weight:900;font-family:'JetBrains Mono',monospace;">₹${fmt(totalAssets-totalLiab)}</div>
            <div style="font-size:.68rem;opacity:.82;margin-top:4px;">Assets ₹${fmt(totalAssets)} · Liabilities ₹${fmt(totalLiab)}</div>
          </div>
          <button onclick="APP._openAccModal()"
            style="background:rgba(255,255,255,.2);color:#fff;border:1.5px solid rgba(255,255,255,.4);border-radius:18px;padding:8px 13px;font-size:.76rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;white-space:nowrap;flex-shrink:0;">
            ➕ Add Account
          </button>
        </div>
      </div>

      <!-- Ledger drill-down (shows when account selected) -->
      ${ledgerHtml}

      <!-- ══ ACCOUNT TYPE SECTIONS ══ -->
      ${['payment','savings','investment','credit','liability'].map(atype=>{
        const list=accs.filter(a=>a.atype===atype);
        if(!list.length) return '';
        const isDebt=atype==='credit'||atype==='liability';
        const sTotal=list.reduce((s,a)=>s+Number(a.balance||0),0);
        return `<div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <span style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">${typeIcon[atype]} ${typeLabel[atype]}</span>
            <span style="font-size:.7rem;font-weight:700;color:${isDebt?'var(--red)':'var(--grn)'};">${isDebt?'−':''}₹${fmt(sTotal)}</span>
          </div>
          ${list.map(a=>`<div style="background:var(--card);border:1px solid ${activeAccId===a.id?'var(--acc)':'var(--bdr)'};border-radius:11px;padding:11px 13px;margin-bottom:5px;display:flex;align-items:center;gap:10px;${activeAccId===a.id?'box-shadow:0 0 0 2px rgba(44,111,173,.2);':''}">
            <div style="width:38px;height:38px;border-radius:50%;background:${isDebt?'#fff5f5':'#f0faf5'};display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex-shrink:0;">${typeIcon[atype]}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:.84rem;font-weight:700;">${a.name}</div>
              <div style="font-size:.66rem;color:var(--mut);">${a.bank||''}${a.note?' · '+a.note:''}</div>
              ${atype==='credit'&&a.limit?`<div style="font-size:.62rem;color:var(--mut);margin-top:1px;">Limit ₹${fmt(a.limit)} · Available ₹${fmt(Math.max(0,Number(a.limit)-Number(a.balance||0)))}</div>`:''}
            </div>
            <div style="text-align:right;">
              <div style="font-size:.9rem;font-weight:900;font-family:'JetBrains Mono',monospace;color:${isDebt?'var(--red)':'var(--grn)'};">${isDebt?'−':''}₹${fmt(Math.abs(Number(a.balance||0)))}</div>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
              <button onclick="APP._accLedgerId='${a.id}';APP._accLedgFrom='';APP._accLedgTo='';APP._finAccounts();document.getElementById('pan-expense').scrollTo({top:0,behavior:'smooth'});" style="background:${activeAccId===a.id?'var(--acc)':'#eff6ff'};border:1px solid var(--acc);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:${activeAccId===a.id?'#fff':'var(--acc)'};font-weight:700;font-family:'Nunito',sans-serif;">📋 Ledger</button>
              <button onclick="APP._openAccModal('${a.id}')" style="background:none;border:1px solid var(--bdr2);border-radius:5px;padding:3px 7px;font-size:.62rem;cursor:pointer;color:var(--mut);">✏️</button>
              <button onclick="APP._delAcc('${a.id}')" style="background:none;border:1px solid rgba(229,57,53,.3);border-radius:5px;padding:3px 7px;font-size:.62rem;cursor:pointer;color:#e53935;">🗑</button>
            </div>
          </div>`).join('')}
        </div>`;
      }).join('')}

      ${!accs.length?`<div style="text-align:center;padding:40px 20px;color:var(--mut);">
        <div style="font-size:2.5rem;margin-bottom:10px;">🏦</div>
        <div style="font-size:.9rem;margin-bottom:5px;">No accounts yet</div>
        <div style="font-size:.76rem;">Add Cash, Bank, UPI, Credit Card accounts</div>
      </div>`:''}
    `;
  },

  // ── Per-Account Ledger Downloads ─────────────────────────────
  _accLedgerGetData(accId){
    const acc=(this.finAccounts||[]).find(a=>a.id===accId);
    if(!acc) return null;
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const allExp=this.expenses||[];
    const from=this._accLedgFrom||'';
    const to=this._accLedgTo||'';
    let txns=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken'&&(e.account===acc.name||e.fromAcc===acc.name||e.toAcc===acc.name));
    if(from) txns=txns.filter(e=>e.date&&e.date>=from);
    if(to)   txns=txns.filter(e=>e.date&&e.date<=to);
    txns=[...txns].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    const totIn=txns.filter(e=>e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name)).reduce((s,e)=>s+Number(e.amount),0);
    const totOut=txns.filter(e=>e.type==='expense'||(e.type==='transfer'&&e.fromAcc===acc.name)).reduce((s,e)=>s+Number(e.amount),0);
    const periodLabel=from||to?((from||'Start')+' to '+(to||'Today')):'All Time';
    return{acc,txns,totIn,totOut,netBal:totIn-totOut,fmt,fD,periodLabel,from,to};
  },

  _accLedgerPDF(accId){
    const d=this._accLedgerGetData(accId); if(!d) return;
    const {acc,txns,totIn,totOut,netBal,fmt,fD,periodLabel}=d;
    const rows=txns.map((e,i)=>{
      const isIn=e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
      const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
      const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:cat):cat;
      return `<tr style="background:${i%2===0?'#fff':'#f8faff'}">
        <td>${fD(e.date)}</td><td>${desc}</td><td>${e.paymode||'Cash'}</td><td>${e.note||'—'}</td>
        <td style="text-align:right;color:#1a7a45;font-weight:700;">${isIn?fmt(Number(e.amount)):'—'}</td>
        <td style="text-align:right;color:#c0392b;font-weight:700;">${!isIn?fmt(Number(e.amount)):'—'}</td>
      </tr>`;
    }).join('');
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Account Ledger — ${acc.name}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;color:#1a1d23;background:#f0f2f5;padding:16mm 14mm;}
    .header{background:linear-gradient(135deg,#dbeafe,#eff6ff);border:1.5px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:16px;text-align:center;}
    .header h1{font-size:22px;font-weight:900;color:#1e3a5f;margin-bottom:4px;}
    .header .sub{font-size:13px;color:#3a6fa0;}
    .header .acc{font-size:14px;color:#1e3a5f;margin-top:6px;background:rgba(44,111,173,.1);display:inline-block;padding:4px 14px;border-radius:20px;font-weight:800;border:1px solid #bfdbfe;}
    .summary{display:flex;border:1.5px solid #bfdbfe;border-radius:8px;overflow:hidden;margin-bottom:16px;}
    .sc{flex:1;padding:12px 14px;text-align:center;border-right:1px solid #bfdbfe;}
    .sc:last-child{border-right:none;}
    .sc-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:5px;}
    .sc-val{font-size:18px;font-weight:900;}
    table{width:100%;border-collapse:collapse;border:1.5px solid #bfdbfe;}
    thead tr{background:#2c6fad;}
    th{padding:10px;font-size:11px;font-weight:800;color:#fff;text-align:left;border:1px solid rgba(255,255,255,.2);text-transform:uppercase;}
    th.r{text-align:right;}
    td{font-size:12px;border:1px solid #e2e8f0;padding:8px 10px;}
    tfoot td{background:#dbeafe;font-weight:800;font-size:13px;color:#1e3a5f;}
    @media print{body{padding:0;background:#fff;}@page{margin:16mm 14mm;}}</style></head><body>
    <div class="header">
      <div style="font-size:24px;margin-bottom:6px;">🏦</div>
      <h1>Account Ledger Report</h1>
      <div class="sub">${periodLabel}</div>
      <div class="acc">${acc.name}${acc.bank?' · '+acc.bank:''}</div>
    </div>
    <div class="summary">
      <div class="sc" style="background:#f0fdf4;border-left:4px solid #1a7a45;"><div class="sc-lbl" style="color:#1a7a45;">Total In (+)</div><div class="sc-val" style="color:#1a7a45;">₹${fmt(totIn)}</div></div>
      <div class="sc" style="background:#fff0f0;border-left:4px solid #c0392b;"><div class="sc-lbl" style="color:#c0392b;">Total Out (−)</div><div class="sc-val" style="color:#c0392b;">₹${fmt(totOut)}</div></div>
      <div class="sc" style="background:#eff6ff;border-left:4px solid #2c6fad;"><div class="sc-lbl" style="color:#2c6fad;">Net Balance</div><div class="sc-val" style="color:${netBal>=0?'#1a7a45':'#c0392b'};">${netBal>=0?'+':'−'}₹${fmt(Math.abs(netBal))}</div></div>
    </div>
    <p style="font-size:11px;color:#888;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #bfdbfe;">Entries: ${txns.length} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Mode</th><th>Note</th><th class="r" style="background:#1a7a45;">In (+)</th><th class="r" style="background:#c0392b;">Out (−)</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">No transactions</td></tr>'}</tbody>
      <tfoot><tr><td colspan="4" style="padding:9px 10px;border:1px solid #bfdbfe;">Grand Total</td><td style="padding:9px 10px;border:1px solid #bfdbfe;text-align:right;color:#1a7a45;">₹${fmt(totIn)}</td><td style="padding:9px 10px;border:1px solid #bfdbfe;text-align:right;color:#c0392b;">₹${fmt(totOut)}</td></tr></tfoot>
    </table></body></html>`;
    const aclRows = txns.map(e=>{
      const isIn=e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
      const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
      const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:cat):cat;
      return [fD(e.date), desc, e.paymode||'Cash', e.note||'—',
              isIn?'Rs.'+fmt(Number(e.amount)):'—',
              !isIn?'Rs.'+fmt(Number(e.amount)):'—'];
    });
    _makePDF({
      filename: 'Account_Ledger_'+acc.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: 'Account Ledger Report',
      subtitle: periodLabel,
      badge: acc.name+(acc.bank?' · '+acc.bank:''),
      summaryRows: [
        ['Total In (+)', 'Rs.'+fmt(totIn), [26,122,69]],
        ['Total Out (−)', 'Rs.'+fmt(totOut), [192,57,43]],
        ['Net Balance', (netBal>=0?'+':'-')+'Rs.'+fmt(Math.abs(netBal)), netBal>=0?[26,122,69]:[192,57,43]],
      ],
      entriesLabel: 'Entries: '+txns.length+' | Generated: '+fD(new Date().toISOString().slice(0,10)),
      columns: ['Date','Description','Mode','Note','In (+)','Out (−)'],
      rows: aclRows,
      totalsRow: ['Grand Total','','','','Rs.'+fmt(totIn),'Rs.'+fmt(totOut)],
      colStyles: {4:{halign:'right',textColor:[26,122,69],fontStyle:'bold'}, 5:{halign:'right',textColor:[192,57,43],fontStyle:'bold'}},
      headerColor: [44,111,173],
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  _accLedgerWord(accId){
    const d=this._accLedgerGetData(accId); if(!d) return;
    const {acc,txns,totIn,totOut,netBal,fmt,fD,periodLabel}=d;
    const rows=txns.map(e=>{
      const isIn=e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
      const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
      const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:cat):cat;
      return `<tr><td>${fD(e.date)}</td><td>${desc}</td><td>${e.paymode||'Cash'}</td><td>${e.note||'—'}</td><td style="text-align:right;color:#1a7a45;font-weight:bold;">${isIn?'₹'+fmt(Number(e.amount)):'—'}</td><td style="text-align:right;color:#c0392b;font-weight:bold;">${!isIn?'₹'+fmt(Number(e.amount)):'—'}</td></tr>`;
    }).join('');
    const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><title>Account Ledger — ${acc.name}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
    <style>body{font-family:Arial;font-size:11pt;} h1{color:#1e3a5f;font-size:16pt;} h2{color:#2c6fad;font-size:12pt;} table{border-collapse:collapse;width:100%;font-size:10pt;} th{background:#2C6FAD;color:white;padding:7px;text-align:left;} th.ri{background:#1a7a45;} th.ro{background:#c0392b;} td{padding:6px 8px;border:1px solid #ddd;} tr:nth-child(even){background:#f8faff;} tfoot td{background:#dbeafe;font-weight:bold;}</style>
    </head><body>
    <h1>🏦 Account Ledger — ${acc.name}</h1>
    <h2>${acc.bank||''} &nbsp;|&nbsp; ${periodLabel}</h2>
    <table style="margin-bottom:14px;width:auto;"><tr>
      <td style="background:#f0fdf4;color:#1a7a45;font-weight:bold;">Total In (+)</td><td style="color:#1a7a45;font-weight:bold;">₹${fmt(totIn)}</td>
      <td style="background:#fff0f0;color:#c0392b;font-weight:bold;">Total Out (−)</td><td style="color:#c0392b;font-weight:bold;">₹${fmt(totOut)}</td>
      <td style="background:#eff6ff;color:#2c6fad;font-weight:bold;">Net Balance</td><td style="color:${netBal>=0?'#1a7a45':'#c0392b'};font-weight:bold;">${netBal>=0?'+':'−'}₹${fmt(Math.abs(netBal))}</td>
    </tr></table>
    <p style="font-size:9pt;color:#666;">Entries: ${txns.length} | Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Mode</th><th>Note</th><th class="ri">In (+)</th><th class="ro">Out (−)</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="6">No transactions</td></tr>'}</tbody>
      <tfoot><tr><td colspan="4"><b>Grand Total</b></td><td style="text-align:right;color:#1a7a45;">₹${fmt(totIn)}</td><td style="text-align:right;color:#c0392b;">₹${fmt(totOut)}</td></tr></tfoot>
    </table></body></html>`;
    const _awBlob=new Blob([html],{type:'application/msword'});
    const _awA=document.createElement('a');_awA.href=URL.createObjectURL(_awBlob);
    _awA.download='Account_Ledger_'+acc.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(_awA);_awA.click();document.body.removeChild(_awA);
    URL.revokeObjectURL(_awA.href);
    this.showToastMsg('✅ Word downloaded!');
  },

  _accLedgerCSV(accId){
    const d=this._accLedgerGetData(accId); if(!d) return;
    const {acc,txns,totIn,totOut,netBal,fmt,fD,periodLabel}=d;
    const rows=[['Date','Description','Mode','Note','In (+)','Out (−)']];
    txns.forEach(e=>{
      const isIn=e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
      const cat=(e.cat||'').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'';
      const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' -> '+e.toAcc:cat):cat;
      rows.push([fD(e.date),desc,e.paymode||'Cash',(e.note||'').replace(/,/g,' '),isIn?Number(e.amount):'',!isIn?Number(e.amount):'']);
    });
    rows.push(['','','','Grand Total',totIn,totOut]);
    const csv=rows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='Account_Ledger_'+acc.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.csv';
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ CSV/Excel downloaded!');
  },


  _openAccModal(id){
    const accs=this.finAccounts;
    const a=id?accs.find(x=>x.id===id):null;
    this._editAccId=id||null;
    const html=`<div class="overlay" id="finAccM" data-noclose="1" style=""><div class="modal" style="max-width:420px;">
      <h2>${id?'✏️ Edit Account':'🏦 Add Account'}</h2>
      <div class="fgrid">
        <div class="fg"><label>Account Name *</label><input id="fac_name" value="${a?a.name:''}" placeholder="e.g. SBI Savings, HDFC Credit"></div>
        <div class="fg"><label>Type *</label>
          <select id="fac_type" style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:8px 11px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.85rem;outline:none;width:100%;">
            <option value="payment" ${a&&a.atype==='payment'?'selected':''}>💵 Payment (Cash/UPI/Debit)</option>
            <option value="savings" ${a&&a.atype==='savings'?'selected':''}>🏦 Savings / Bank Account</option>
            <option value="credit" ${a&&a.atype==='credit'?'selected':''}>💳 Credit Card</option>
            <option value="liability" ${a&&a.atype==='liability'?'selected':''}>📋 Liability / Loan</option>
            <option value="investment" ${a&&a.atype==='investment'?'selected':''}>📈 Investment / FD</option>
          </select>
        </div>
        <div class="fg"><label>Current Balance (₹) *</label><input id="fac_bal" type="number" value="${a?a.balance:''}" placeholder="0"></div>
        <div class="fg"><label>Bank / Institution</label><input id="fac_bank" value="${a?a.bank||'':''}" placeholder="SBI, HDFC, PhonePe..."></div>
        <div id="fac_limit_row" class="fg" style="${a&&a.atype==='credit'?'':'display:none'}"><label>Credit Limit (₹)</label><input id="fac_limit" type="number" value="${a?a.limit||'':''}" placeholder="e.g. 100000"></div>
        <div class="full fg"><label>Note</label><input id="fac_note" value="${a?a.note||'':''}" placeholder="Optional"></div>
      </div>
      <div class="modal-foot">
        <button class="btn b-out" onclick="M.close('finAccM')">Cancel</button>
        <button class="btn b-gold" onclick="APP._saveAcc()">💾 Save</button>
      </div>
    </div></div>`;
    const existing=document.getElementById('finAccM');
    if(existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend',html);
    document.getElementById('fac_type').addEventListener('change',function(){
      document.getElementById('fac_limit_row').style.display=this.value==='credit'?'':'none';
    });
    M.open('finAccM');
  },

  _saveAcc(){
    const name=document.getElementById('fac_name').value.trim();
    if(!name){alert('Account name required!');return;}
    const data={
      name,
      atype:document.getElementById('fac_type').value,
      balance:Number(document.getElementById('fac_bal').value)||0,
      bank:document.getElementById('fac_bank').value.trim(),
      limit:Number(document.getElementById('fac_limit').value)||0,
      note:document.getElementById('fac_note').value.trim()
    };
    let accs=this.finAccounts;
    if(this._editAccId){
      accs=accs.map(a=>a.id===this._editAccId?{...a,...data}:a);
    } else {
      data.id=uid(); data.created=new Date().toISOString();
      accs.push(data);
    }
    this.finAccounts=accs;
    M.close('finAccM');
    this._finAccounts();
    this.showToastMsg('✅ Account saved!');
  },

  _delAcc(id){
    this.delCb=()=>{
      this.finAccounts=this.finAccounts.filter(a=>a.id!==id);
      this._finAccounts();
    };
    document.getElementById('delMsg').textContent='Delete this account?';
    M.open('delM');
  },

  // ═══════════ TRANSACTIONS ═══════════
  _finTransactions(){
    const allExp=this.expenses||[];
    const expSearch=(this.expSearch||'').toLowerCase().trim();
    const expTypeFilter=this.expTypeFilter||'all';
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const txnFrom=this._finFrom||'';
    const txnTo=this._finTo||'';

    let filtered=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(txnFrom) filtered=filtered.filter(e=>e.date&&e.date>=txnFrom);
    if(txnTo)   filtered=filtered.filter(e=>e.date&&e.date<=txnTo);
    if(expTypeFilter!=='all') filtered=filtered.filter(e=>e.type===expTypeFilter);
    if(expSearch) filtered=filtered.filter(e=>(e.cat||'').toLowerCase().includes(expSearch)||(e.note||'').toLowerCase().includes(expSearch)||(e.paymode||'').toLowerCase().includes(expSearch)||(e.account||'').toLowerCase().includes(expSearch)||(e.fromAcc||'').toLowerCase().includes(expSearch)||(e.toAcc||'').toLowerCase().includes(expSearch)||String(e.amount).includes(expSearch));
    const sorted=[...filtered].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

    const totalInc=filtered.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
    const totalExp=filtered.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
    const totalTrf=filtered.filter(e=>e.type==='transfer').reduce((s,e)=>s+Number(e.amount),0);
    const balance=totalInc-totalExp;

    const typeColor={expense:'#e53935',income:'#2e7d32',transfer:'#1565c0'};
    const typeBg={expense:'rgba(229,57,53,.08)',income:'rgba(46,125,50,.08)',transfer:'rgba(21,101,192,.08)'};

    const grouped={};
    sorted.forEach(e=>{const dk=e.date||'Unknown';if(!grouped[dk])grouped[dk]=[];grouped[dk].push(e);});

    // ── Build transaction rows ──
    let txHtml='';
    if(!sorted.length){
      txHtml=`<div style="text-align:center;padding:50px 20px;color:var(--mut);">
        <div style="font-size:2.8rem;margin-bottom:12px;">💸</div>
        <div style="font-size:.92rem;font-weight:700;">No transactions yet</div>
        <div style="font-size:.76rem;margin-top:5px;">Tap "+ Add Transaction" to get started</div>
      </div>`;
    } else {
      Object.keys(grouped).sort().reverse().forEach(dk=>{
        const dayExp=grouped[dk];
        const dayDate=dk!=='Unknown'?new Date(dk):null;
        const dayLabel=dayDate?(()=>{const _w=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];return _w[dayDate.getDay()]+', '+String(dayDate.getDate()).padStart(2,'0')+'/'+String(dayDate.getMonth()+1).padStart(2,'0')+'/'+String(dayDate.getFullYear());})():'Unknown Date';
        const dayNet=dayExp.reduce((s,e)=>e.type==='income'?s+Number(e.amount):e.type==='expense'?s-Number(e.amount):s,0);
        txHtml+=`
        <div style="margin-bottom:1px;">
          <!-- Date header -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 14px;background:var(--dim);border-radius:8px 8px 0 0;">
            <span style="font-size:.7rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;">${dayLabel}</span>
            <span style="font-size:.72rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${dayNet>=0?'#2e7d32':'#e53935'};">${dayNet>=0?'+':'-'}₹${fmt(Math.abs(dayNet))}</span>
          </div>`;

        dayExp.forEach(e=>{
          const raw=e.cat||'—';
          const cleanCat=raw.replace(/^[^\w\u0900-\u097F\u00C0-\u024F]+/,'').trim()||raw;
          const isTransfer=e.type==='transfer';

          // Transfer label: "ICICI → HDFC" or category
          const mainLabelRaw = isTransfer
            ? (e.fromAcc&&e.toAcc ? e.fromAcc+' → '+e.toAcc : (e.account||cleanCat||'Transfer'))
            : cleanCat;
          const mainLabel = expSearch ? APP._finHighlight(mainLabelRaw,expSearch) : mainLabelRaw;

          // Sub-label: note (full, expandable) + mode
          const noteTextRaw = e.note||'';
          const noteText = expSearch ? APP._finHighlight(noteTextRaw,expSearch) : noteTextRaw;
          const modeText = e.paymode||'Cash';
          const accText = isTransfer
            ? (e.fromAcc&&e.toAcc ? `₹${fmt(Number(e.amount))} transferred` : (e.account||''))
            : (expSearch ? APP._finHighlight(e.account||'',expSearch) : (e.account||''));

          const typeIcon = isTransfer ? '🔄' : e.type==='income' ? '💰' : '💸';
          const amtColor = e.type==='expense'?'#e53935':e.type==='income'?'#2e7d32':'#1565c0';
          const amtPrefix = e.type==='expense'?'− ₹':e.type==='income'?'+ ₹':'⇄ ₹';

          txHtml+=`
          <div style="display:flex;align-items:flex-start;gap:11px;padding:11px 14px;background:var(--card);border-bottom:1px solid var(--bdr);transition:background .15s;"
            onmouseover="this.style.background='var(--dim)'" onmouseout="this.style.background='var(--card)'">

            <!-- Icon circle -->
            <div style="width:38px;height:38px;border-radius:50%;background:${typeBg[e.type]||'var(--dim)'};display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex-shrink:0;margin-top:1px;">${typeIcon}</div>

            <!-- Main content -->
            <div style="flex:1;min-width:0;">
              <!-- Title -->
              <div style="font-size:.84rem;font-weight:700;color:var(--txt);margin-bottom:2px;word-break:break-word;">${mainLabel}</div>
              <!-- Sub-line: mode · account -->
              <div style="font-size:.68rem;color:var(--mut);line-height:1.4;">
                ${modeText}${accText?' · '+accText:''}
              </div>
              <!-- Note — full text, no cut -->
              ${noteText?`<div style="font-size:.68rem;color:var(--mut);margin-top:3px;line-height:1.5;word-break:break-word;white-space:pre-wrap;">${noteText}</div>`:''}
              <!-- File thumbnails — compact 36px -->
              ${(e.files&&e.files.length)?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                ${e.files.slice(0,4).map((f,fi)=>{
                  const isImg=f.type&&f.type.startsWith('image/');
                  const ext=(f.name||'').split('.').pop().toUpperCase();
                  const extIcon={'PDF':'📄','DOC':'📝','DOCX':'📝','XLS':'📊','XLSX':'📊'}[ext]||'📎';
                  return isImg
                    ? `<img src="${f.dataUrl||f.url||''}" style="height:36px;width:36px;object-fit:cover;border-radius:5px;cursor:pointer;border:1px solid var(--bdr);" onerror="this.style.display='none'" onclick="event.stopPropagation();window.open('${f.url||f.dataUrl||''}','_blank')" title="${f.name||'image'}">`
                    : `<span style="font-size:1.1rem;cursor:pointer;" title="${f.name||'file'}">${extIcon}</span>`;
                }).join('')}
                ${e.files.length>4?`<span style="font-size:.65rem;color:var(--mut);align-self:center;">+${e.files.length-4} more</span>`:''}
              </div>`:''}
            </div>

            <!-- Amount + actions — right aligned -->
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
              <div style="font-size:.9rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${amtColor};white-space:nowrap;">${amtPrefix}${fmt(Number(e.amount))}</div>
              <div style="display:flex;gap:4px;">
                <button style="background:none;border:1.5px solid var(--bdr2);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:var(--mut);" onclick="APP.openExpModal('${e.id}')">✏️</button>
                <button style="background:none;border:1.5px solid rgba(229,57,53,.3);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:#e53935;" onclick="APP.delExpense('${e.id}')">🗑</button>
              </div>
            </div>
          </div>`;
        });
        txHtml+=`<div style="height:4px;background:var(--bg);"></div></div>`;
      });
    }

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('txn')}
      ${this._finFilterBar()}

      <!-- ── Add Transaction + Search ── -->
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;">
        <!-- 🔍 Search icon button -->
        <button id="fin_search_btn" onclick="APP._finToggleSearch()"
          style="background:var(--card);border:1.5px solid var(--bdr2);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:.85rem;color:var(--mut);flex-shrink:0;"
          title="Search transactions">🔍</button>
        <div style="flex:1;"></div>
        <!-- ➕ Add Transaction -->
        <button onclick="APP.openExpModal()"
          style="background:var(--acc);color:#fff;border:none;border-radius:22px;padding:8px 16px;font-size:.8rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;white-space:nowrap;flex-shrink:0;box-shadow:0 2px 8px rgba(44,111,173,.3);">
          ➕ Add Transaction
        </button>
      </div>

      <!-- ── Search bar — hidden by default, shown on icon click ── -->
      <div id="fin_search_row" style="display:${expSearch?'flex':'none'};align-items:center;gap:6px;margin-bottom:10px;background:var(--dim);border:1.5px solid var(--acc);border-radius:10px;padding:6px 10px;">
        <span style="font-size:.82rem;color:var(--acc);">🔍</span>
        <input id="exm_search_inp" type="text" value="${this.expSearch||''}"
          autocomplete="off" autocorrect="off" spellcheck="false"
          oninput="APP._finSearchInput(this.value)"
          onkeydown="if(event.key==='Escape'){APP._finClearSearch();}"
          style="flex:1;border:none;background:transparent;font-size:.84rem;font-family:'Nunito',sans-serif;color:var(--txt);outline:none;min-width:0;"
          placeholder="Type to search transactions…">
        ${expSearch?`<span style="font-size:.7rem;color:var(--acc);font-weight:700;white-space:nowrap;">${sorted.length} found</span>`:''}
        <button onclick="APP._finClearSearch()"
          style="background:none;border:none;cursor:pointer;font-size:.85rem;color:var(--mut);padding:0 2px;flex-shrink:0;">✕</button>
      </div>

      <!-- ── Summary cards: full labels ── -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;">
        <div onclick="APP.expTypeFilter=(APP.expTypeFilter==='income'?'all':'income');APP._finTransactions();"
          style="background:${expTypeFilter==='income'?'#1b5e20':'#f0faf4'};border:2px solid ${expTypeFilter==='income'?'#1b5e20':'#90c8a0'};border-radius:11px;padding:9px 6px;cursor:pointer;text-align:center;transition:all .15s;">
          <div style="font-size:.58rem;text-transform:uppercase;color:${expTypeFilter==='income'?'#c8e6c9':'#2e7d32'};font-weight:800;letter-spacing:.04em;">Income</div>
          <div style="font-size:.8rem;font-weight:900;color:${expTypeFilter==='income'?'#fff':'#2e7d32'};font-family:'JetBrains Mono',monospace;margin-top:2px;">₹${fmt(totalInc)}</div>
        </div>
        <div onclick="APP.expTypeFilter=(APP.expTypeFilter==='expense'?'all':'expense');APP._finTransactions();"
          style="background:${expTypeFilter==='expense'?'#b71c1c':'#fff5f5'};border:2px solid ${expTypeFilter==='expense'?'#b71c1c':'#f0a0a0'};border-radius:11px;padding:9px 6px;cursor:pointer;text-align:center;transition:all .15s;">
          <div style="font-size:.58rem;text-transform:uppercase;color:${expTypeFilter==='expense'?'#ffcdd2':'#e53935'};font-weight:800;letter-spacing:.04em;">Expense</div>
          <div style="font-size:.8rem;font-weight:900;color:${expTypeFilter==='expense'?'#fff':'#e53935'};font-family:'JetBrains Mono',monospace;margin-top:2px;">₹${fmt(totalExp)}</div>
        </div>
        <div onclick="APP.expTypeFilter='all';APP._finTransactions();"
          style="background:${balance>=0?'#f0faf4':'#fff8e1'};border:2px solid ${balance>=0?'#66bb6a':'#ffa726'};border-radius:11px;padding:9px 6px;cursor:pointer;text-align:center;transition:all .15s;">
          <div style="font-size:.58rem;text-transform:uppercase;color:${balance>=0?'#2e7d32':'#e65100'};font-weight:800;letter-spacing:.04em;">Balance</div>
          <div style="font-size:.8rem;font-weight:900;color:${balance>=0?'#1b5e20':'#e65100'};font-family:'JetBrains Mono',monospace;margin-top:2px;overflow:hidden;text-overflow:ellipsis;">₹${fmt(Math.abs(balance))}</div>
        </div>
        <div onclick="APP.expTypeFilter=(APP.expTypeFilter==='transfer'?'all':'transfer');APP._finTransactions();"
          style="background:${expTypeFilter==='transfer'?'#0d47a1':'#e8eeff'};border:2px solid ${expTypeFilter==='transfer'?'#0d47a1':'#90b8e8'};border-radius:11px;padding:9px 6px;cursor:pointer;text-align:center;transition:all .15s;">
          <div style="font-size:.58rem;text-transform:uppercase;color:${expTypeFilter==='transfer'?'#bbdefb':'#1565c0'};font-weight:800;letter-spacing:.04em;">Transfer</div>
          <div style="font-size:.8rem;font-weight:900;color:${expTypeFilter==='transfer'?'#fff':'#1565c0'};font-family:'JetBrains Mono',monospace;margin-top:2px;">₹${fmt(totalTrf)}</div>
        </div>
      </div>

      <!-- Transaction count + search pill -->
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:.7rem;color:var(--mut);font-weight:600;">${sorted.length} transaction${sorted.length!==1?'s':''}</span>
        ${expTypeFilter!=='all'?`<span style="font-size:.65rem;background:var(--dim);border:1px solid var(--bdr);border-radius:10px;padding:1px 7px;color:var(--mut);">${expTypeFilter}</span>`:''}
        ${expSearch?`<span style="font-size:.65rem;background:#ffe066;border-radius:10px;padding:1px 8px;color:#333;font-weight:700;cursor:pointer;" onclick="APP._finClearSearch()">🔍 "${expSearch}" ✕</span>`:''}
      </div>

      <!-- Transaction list -->
      <div style="border-radius:12px;overflow:hidden;border:1.5px solid var(--bdr);">${txHtml}</div>
    `;
  },

  // ═══════════ BUDGET ═══════════
  _finBudget(){
    const budgets=this.finBudgets;
    const allExp=this.expenses||[];
    const now=new Date();
    const curMon=now.toISOString().slice(0,7);
    const base=allExp.filter(e=>e.date&&e.date.startsWith(curMon)&&e.type==='expense');
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const totalBudget=budgets.reduce((s,b)=>s+Number(b.limit||0),0);
    const totalSpent=budgets.reduce((s,b)=>{
      const spent=base.filter(e=>(e.cat||'').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()===b.cat||(e.cat||'')===b.cat).reduce((ss,e)=>ss+Number(e.amount),0);
      return s+spent;
    },0);

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('budget')}
      <!-- Month header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:.78rem;font-weight:700;color:var(--txt);">🎯 Budget — ${this._finFmtMon(curMon)}</div>
        <button onclick="APP._openBudgetModal()" class="btn b-gold" style="font-size:.78rem;padding:6px 14px;border-radius:20px;">＋ Add Budget</button>
      </div>

      ${budgets.length?`<!-- Overall Progress -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:13px 14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:.78rem;font-weight:700;">Overall Budget</span>
          <span style="font-size:.72rem;color:var(--mut);">₹${fmt(totalSpent)} / ₹${fmt(totalBudget)}</span>
        </div>
        <div style="background:var(--dim);border-radius:6px;height:10px;overflow:hidden;margin-bottom:4px;">
          <div style="background:${totalSpent>totalBudget?'#ef4444':totalSpent/totalBudget>0.8?'#f59e0b':'#22c55e'};width:${totalBudget>0?Math.min(100,Math.round((totalSpent/totalBudget)*100)):0}%;height:100%;border-radius:6px;transition:width .3s;"></div>
        </div>
        <div style="font-size:.68rem;color:var(--mut);">Remaining: ₹${fmt(Math.max(0,totalBudget-totalSpent))}</div>
      </div>`:''}

      <!-- Per Category Budget cards -->
      ${budgets.length?budgets.map(b=>{
        const spent=base.filter(e=>(e.cat||'').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()===b.cat||(e.cat||'')===b.cat).reduce((s,e)=>s+Number(e.amount),0);
        const pct=b.limit>0?Math.min(100,Math.round((spent/b.limit)*100)):0;
        const rem=Math.max(0,b.limit-spent);
        const barCol=pct>=100?'#ef4444':pct>=80?'#f59e0b':'#22c55e';
        const bgCol=pct>=100?'#fff5f5':pct>=80?'#fffbee':'var(--card)';
        const bdCol=pct>=100?'#fca5a5':pct>=80?'#fcd34d':'var(--bdr)';
        return `<div style="background:${bgCol};border:1.5px solid ${bdCol};border-radius:12px;padding:13px 14px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <div style="font-size:.85rem;font-weight:700;">${b.cat}</div>
              <div style="font-size:.68rem;color:var(--mut);">₹${fmt(spent)} spent of ₹${fmt(b.limit)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-size:.72rem;font-weight:800;color:${pct>=100?'#ef4444':pct>=80?'#f59e0b':'#22c55e'};">${pct}%</span>
              <button onclick="APP._openBudgetModal('${b.id}')" style="background:none;border:1px solid var(--bdr2);border-radius:4px;padding:2px 5px;font-size:.6rem;cursor:pointer;color:var(--mut);">✏️</button>
              <button onclick="APP._delBudget('${b.id}')" style="background:none;border:1px solid rgba(229,57,53,.3);border-radius:4px;padding:2px 5px;font-size:.6rem;cursor:pointer;color:#e53935;">🗑</button>
            </div>
          </div>
          <div style="background:var(--dim);border-radius:5px;height:8px;overflow:hidden;margin-bottom:5px;">
            <div style="background:${barCol};width:${pct}%;height:100%;border-radius:5px;transition:width .3s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--mut);">
            <span>${pct>=100?'⚠️ Exceeded by ₹'+fmt(spent-b.limit):'Remaining: ₹'+fmt(rem)}</span>
            <span>Limit: ₹${fmt(b.limit)}</span>
          </div>
        </div>`;
      }).join(''):`<div style="text-align:center;padding:40px 20px;color:var(--mut);">
        <div style="font-size:2.5rem;margin-bottom:10px;">🎯</div>
        <div style="font-size:.9rem;margin-bottom:6px;">Koi budget set nahi hai</div>
        <div style="font-size:.78rem;">Category-wise monthly limits set karo</div>
      </div>`}
    `;
  },

  _openBudgetModal(id){
    const budgets=this.finBudgets;
    const b=id?budgets.find(x=>x.id===id):null;
    this._editBudgetId=id||null;
    const allExp=this.expenses||[];
    const cats=[...new Set(allExp.filter(e=>e.type==='expense').map(e=>(e.cat||'').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()||e.cat||'Other'))];
    const html=`<div class="overlay" id="finBudM" data-noclose="1"><div class="modal" style="max-width:400px;">
      <h2>${id?'✏️ Edit Budget':'🎯 Set Budget'}</h2>
      <div class="fgrid">
        <div class="full fg"><label>Category *</label>
          <input id="fbud_cat" value="${b?b.cat:''}" placeholder="e.g. Food, Transport, Utilities" list="fbud_cat_list" style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:8px 11px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.85rem;outline:none;width:100%;box-sizing:border-box;">
          <datalist id="fbud_cat_list">${cats.map(c=>`<option value="${c}">`).join('')}</datalist>
        </div>
        <div class="fg"><label>Monthly Limit (₹) *</label><input id="fbud_limit" type="number" value="${b?b.limit:''}" placeholder="e.g. 5000"></div>
        <div class="fg"><label>Alert at (%)</label>
          <select id="fbud_alert" style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:8px 11px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.85rem;outline:none;width:100%;">
            <option value="80" ${!b||b.alert==80?'selected':''}>80%</option>
            <option value="90" ${b&&b.alert==90?'selected':''}>90%</option>
            <option value="100" ${b&&b.alert==100?'selected':''}>100%</option>
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn b-out" onclick="M.close('finBudM')">Cancel</button>
        <button class="btn b-gold" onclick="APP._saveBudget()">💾 Save</button>
      </div>
    </div></div>`;
    const existing=document.getElementById('finBudM');
    if(existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend',html);
    M.open('finBudM');
  },

  _saveBudget(){
    const cat=document.getElementById('fbud_cat').value.trim();
    const limit=Number(document.getElementById('fbud_limit').value);
    if(!cat||!limit){alert('Category aur limit required!');return;}
    const data={cat,limit,alert:Number(document.getElementById('fbud_alert').value)||80};
    let budgets=this.finBudgets;
    if(this._editBudgetId){
      budgets=budgets.map(b=>b.id===this._editBudgetId?{...b,...data}:b);
    } else {
      data.id=uid(); budgets.push(data);
    }
    this.finBudgets=budgets;
    M.close('finBudM');
    this._finBudget();
    this.showToastMsg('✅ Budget saved!');
  },

  _delBudget(id){
    this.delCb=()=>{this.finBudgets=this.finBudgets.filter(b=>b.id!==id);this._finBudget();};
    document.getElementById('delMsg').textContent='Delete this budget?';
    M.open('delM');
  },

  // ═══════════ CHARTS ═══════════
  _finCharts(){
    const allExp=this.expenses||[];
    const now=new Date();
    const curMon=now.toISOString().slice(0,7);
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const base=allExp.filter(e=>e.date&&e.date.startsWith(curMon)&&e.type!=='loan'&&e.type!=='loan_taken');

    // Category pie data
    const catTotals={};
    base.filter(e=>e.type==='expense').forEach(e=>{
      const c=(e.cat||'Other').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()||'Other';
      catTotals[c]=(catTotals[c]||0)+Number(e.amount);
    });
    const catData=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
    const totalExp=catData.reduce((s,[,v])=>s+v,0);

    // Monthly 6-month trend
    const months6=[];
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const m=d.toISOString().slice(0,7);
      const mInc=allExp.filter(e=>e.date&&e.date.startsWith(m)&&e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
      const mExp=allExp.filter(e=>e.date&&e.date.startsWith(m)&&e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
      months6.push({m,label:d.toLocaleString('en-IN',{month:'short'}),inc:mInc,exp:mExp});
    }
    const maxVal=Math.max(...months6.map(x=>Math.max(x.inc,x.exp)),1);

    const COLORS=['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#06b6d4','#ec4899','#14b8a6'];

    // Pie chart SVG
    let pie='';
    let startAngle=-Math.PI/2;
    if(catData.length){
      catData.forEach(([cat,val],i)=>{
        const angle=(val/totalExp)*2*Math.PI;
        const endAngle=startAngle+angle;
        const x1=100+90*Math.cos(startAngle);
        const y1=100+90*Math.sin(startAngle);
        const x2=100+90*Math.cos(endAngle);
        const y2=100+90*Math.sin(endAngle);
        const largeArc=angle>Math.PI?1:0;
        pie+=`<path d="M100,100 L${x1.toFixed(1)},${y1.toFixed(1)} A90,90 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${COLORS[i%COLORS.length]}" opacity="0.9" stroke="var(--bg)" stroke-width="1.5"/>`;
        startAngle=endAngle;
      });
    } else {
      pie='<circle cx="100" cy="100" r="90" fill="var(--dim)"/><text x="100" y="105" text-anchor="middle" fill="var(--mut)" font-size="12" font-family="Nunito,sans-serif">No data</text>';
    }

    // Bar chart SVG
    const barW=52, barGap=14, chartH=120, startX=30;
    let bars='';
    months6.forEach((mo,i)=>{
      const x=startX+i*(barW+barGap);
      const incH=mo.inc>0?Math.round((mo.inc/maxVal)*chartH):0;
      const expH=mo.exp>0?Math.round((mo.exp/maxVal)*chartH):0;
      bars+=`<rect x="${x}" y="${chartH-incH+10}" width="${barW*0.45}" height="${incH}" fill="#22c55e" opacity="0.85" rx="2"/>`;
      bars+=`<rect x="${x+barW*0.5}" y="${chartH-expH+10}" width="${barW*0.45}" height="${expH}" fill="#ef4444" opacity="0.85" rx="2"/>`;
      bars+=`<text x="${x+barW/2}" y="${chartH+26}" text-anchor="middle" fill="var(--color-text-secondary,#888)" font-size="11" font-family="Nunito,sans-serif">${mo.label}</text>`;
    });

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('charts')}
      <div style="font-size:.78rem;font-weight:700;color:var(--txt);margin-bottom:10px;">📊 ${this._finFmtMon(curMon)} — Expense Breakdown</div>

      <!-- Pie chart -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;padding:14px;margin-bottom:14px;">
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
          <svg width="200" height="200" viewBox="0 0 200 200" style="flex-shrink:0;">${pie}</svg>
          <div style="flex:1;min-width:140px;">
            ${catData.slice(0,7).map(([cat,val],i)=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <div style="width:10px;height:10px;border-radius:2px;background:${COLORS[i%COLORS.length]};flex-shrink:0;"></div>
              <div style="font-size:.72rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat}</div>
              <div style="font-size:.68rem;color:var(--mut);font-family:'JetBrains Mono',monospace;">₹${fmt(val)}</div>
            </div>`).join('')}
            ${catData.length>7?`<div style="font-size:.65rem;color:var(--mut);">+${catData.length-7} more</div>`:''}
          </div>
        </div>
      </div>

      <!-- Monthly trend bar chart -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;padding:14px;">
        <div style="font-size:.78rem;font-weight:700;margin-bottom:10px;">📈 6-Month Trend</div>
        <div style="display:flex;gap:8px;font-size:.65rem;margin-bottom:6px;">
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;background:#22c55e;border-radius:2px;display:inline-block;"></span>Income</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;background:#ef4444;border-radius:2px;display:inline-block;"></span>Expense</span>
        </div>
        <svg width="100%" viewBox="0 0 ${startX*2+6*(barW+barGap)-barGap} ${chartH+40}" style="overflow:visible;">
          <line x1="${startX}" y1="10" x2="${startX}" y2="${chartH+10}" stroke="var(--bdr)" stroke-width="0.5"/>
          <line x1="${startX}" y1="${chartH+10}" x2="${startX*2+6*(barW+barGap)-barGap}" y2="${chartH+10}" stroke="var(--bdr)" stroke-width="0.5"/>
          ${bars}
        </svg>
        <!-- Monthly summary -->
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:10px;border-top:1px solid var(--bdr);padding-top:8px;">
          ${months6.map(mo=>`<div style="display:flex;justify-content:space-between;font-size:.7rem;">
            <span style="color:var(--mut);min-width:40px;">${mo.label}</span>
            <span style="color:#22c55e;">+₹${fmt(mo.inc)}</span>
            <span style="color:#ef4444;">-₹${fmt(mo.exp)}</span>
            <span style="color:${mo.inc-mo.exp>=0?'#22c55e':'#ef4444'};font-weight:700;">₹${fmt(Math.abs(mo.inc-mo.exp))}</span>
          </div>`).join('')}
        </div>
      </div>
    `;
  },

  // ═══════════ REPORTS ═══════════
  _finReports(){
    const allExp=this.expenses||[];
    const now=new Date();
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const yr=now.getFullYear();

    // Date filter (From-To, same as Khata Book style)
    const repFrom = this._repFrom || '';
    const repTo   = this._repTo   || '';

    // Yearly summary (always full year)
    const yearData=[];
    for(let m=0;m<12;m++){
      const mStr=yr+'-'+String(m+1).padStart(2,'0');
      const base=allExp.filter(e=>e.date&&e.date.startsWith(mStr)&&e.type!=='loan'&&e.type!=='loan_taken');
      const inc=base.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
      const exp=base.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
      yearData.push({m:mStr,label:new Date(yr,m,1).toLocaleString('en-IN',{month:'short'}),inc,exp,bal:inc-exp});
    }
    const yrInc=yearData.reduce((s,x)=>s+x.inc,0);
    const yrExp=yearData.reduce((s,x)=>s+x.exp,0);
    const yrBal=yrInc-yrExp;

    // Filtered transactions for detail list
    let filtered = allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(repFrom) filtered=filtered.filter(e=>e.date&&e.date>=repFrom);
    if(repTo)   filtered=filtered.filter(e=>e.date&&e.date<=repTo);
    const sorted=[...filtered].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

    const filtInc=filtered.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
    const filtExp=filtered.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
    const filtBal=filtInc-filtExp;
    const periodLabel=repFrom||repTo?((repFrom||'Start')+' to '+(repTo||'Today')):'All Time';

    // Top categories (filtered)
    const catAll={};
    filtered.filter(e=>e.type==='expense').forEach(e=>{
      const c=(e.cat||'Other').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()||'Other';
      catAll[c]=(catAll[c]||0)+Number(e.amount);
    });
    const topCatsAll=Object.entries(catAll).sort((a,b)=>b[1]-a[1]).slice(0,8);

    // Build detail transaction rows (grouped by date)
    const typeColor={expense:'#e53935',income:'#2e7d32',transfer:'#1565c0'};
    const typeBg={expense:'rgba(229,57,53,.08)',income:'rgba(46,125,50,.08)',transfer:'rgba(21,101,192,.08)'};
    const grouped={};
    sorted.forEach(e=>{const dk=e.date||'Unknown';if(!grouped[dk])grouped[dk]=[];grouped[dk].push(e);});

    let txHtml='';
    if(!sorted.length){
      txHtml=`<div style="text-align:center;padding:40px 20px;color:var(--mut);">
        <div style="font-size:2.5rem;margin-bottom:10px;">📋</div>
        <div style="font-size:.9rem;font-weight:700;">No transactions found</div>
      </div>`;
    } else {
      Object.keys(grouped).sort().reverse().forEach(dk=>{
        const dayExp=grouped[dk];
        const dayDate=dk!=='Unknown'?new Date(dk):null;
        const dayLabel=dayDate?(()=>{const _w=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];return _w[dayDate.getDay()]+', '+String(dayDate.getDate()).padStart(2,'0')+'/'+String(dayDate.getMonth()+1).padStart(2,'0')+'/'+String(dayDate.getFullYear());})():'Unknown Date';
        const dayNet=dayExp.reduce((s,e)=>e.type==='income'?s+Number(e.amount):e.type==='expense'?s-Number(e.amount):s,0);
        txHtml+=`<div style="margin-bottom:1px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 14px;background:var(--dim);border-radius:8px 8px 0 0;">
            <span style="font-size:.7rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;">${dayLabel}</span>
            <span style="font-size:.72rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${dayNet>=0?'#2e7d32':'#e53935'};">${dayNet>=0?'+':'−'}₹${fmt(Math.abs(dayNet))}</span>
          </div>`;
        dayExp.forEach(e=>{
          const raw=e.cat||'—';
          const cleanCat=raw.replace(/^[^\w\u0900-\u097F\u00C0-\u024F]+/,'').trim()||raw;
          const isTransfer=e.type==='transfer';
          const mainLabel=isTransfer?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:(e.account||cleanCat||'Transfer')):cleanCat;
          const modeText=e.paymode||'Cash';
          const accText=isTransfer?(e.fromAcc&&e.toAcc?`₹${fmt(Number(e.amount))} transferred`:(e.account||'')):(e.account||'');
          const typeIcon=isTransfer?'🔄':e.type==='income'?'💰':'💸';
          const amtColor=e.type==='expense'?'#e53935':e.type==='income'?'#2e7d32':'#1565c0';
          const amtPrefix=e.type==='expense'?'− ₹':e.type==='income'?'+ ₹':'⇄ ₹';
          txHtml+=`<div style="display:flex;align-items:flex-start;gap:11px;padding:11px 14px;background:var(--card);border-bottom:1px solid var(--bdr);"
            onmouseover="this.style.background='var(--dim)'" onmouseout="this.style.background='var(--card)'">
            <div style="width:36px;height:36px;border-radius:50%;background:${typeBg[e.type]||'var(--dim)'};display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;margin-top:1px;">${typeIcon}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:.84rem;font-weight:700;color:var(--txt);margin-bottom:2px;">${mainLabel}</div>
              <div style="font-size:.68rem;color:var(--mut);">${modeText}${accText?' · '+accText:''}</div>
              ${e.note?`<div style="font-size:.68rem;color:var(--mut);margin-top:2px;word-break:break-word;">${e.note}</div>`:''}
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
              <div style="font-size:.9rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${amtColor};white-space:nowrap;">${amtPrefix}${fmt(Number(e.amount))}</div>
              <div style="display:flex;gap:4px;">
                <button style="background:none;border:1.5px solid var(--bdr2);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:var(--mut);" onclick="APP.openExpModal('${e.id}')">✏️</button>
                <button style="background:none;border:1.5px solid rgba(229,57,53,.3);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:#e53935;" onclick="APP.delExpense('${e.id}')">🗑</button>
              </div>
            </div>
          </div>`;
        });
        txHtml+=`<div style="height:4px;background:var(--bg);"></div></div>`;
      });
    }

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('reports')}

      <!-- Download buttons -->
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <button onclick="APP._downloadFinancePDF()" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#e53935;color:#e53935;">📄 Download PDF</button>${APP._pdfOriHtml()}
        <button onclick="APP._downloadFinanceWord()" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#1565c0;color:#1565c0;">📝 Download Word</button>
        <button onclick="APP._downloadFinanceCSV()" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#2e7d32;color:#2e7d32;">📊 Download CSV</button>
      </div>



      <!-- Transaction Details — with date filter -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;overflow:hidden;margin-bottom:14px;">
        <!-- Header + filter -->
        <div style="background:var(--card2);padding:10px 14px;border-bottom:1px solid var(--bdr);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div style="font-size:.82rem;font-weight:800;">📋 Transaction Details
              <span style="background:var(--acc);color:#fff;padding:1px 8px;border-radius:10px;font-size:.65rem;margin-left:4px;">${sorted.length}</span>
            </div>
            <div style="display:flex;gap:8px;font-size:.76rem;">
              <span style="color:#2e7d32;font-weight:700;">In: ₹${fmt(filtInc)}</span>
              <span style="color:#e53935;font-weight:700;">Out: ₹${fmt(filtExp)}</span>
              <span style="color:${filtBal>=0?'#2e7d32':'#e53935'};font-weight:800;">Bal: ${filtBal>=0?'+':'−'}₹${fmt(Math.abs(filtBal))}</span>
            </div>
          </div>
          <!-- Date filter — same Khata Book style -->
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:.68rem;color:var(--mut);font-weight:700;">📅</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rrf" value="${repFrom?isoToDmy(repFrom):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rrf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._repFrom=iso;APP._finReports();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rrf').showPicker&&document.getElementById('dfh_rrf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rrf" value="${repFrom||''} " onchange="(function(iso){var el=document.getElementById('df_rrf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._repFrom=iso;APP._finReports();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            <span style="font-size:.72rem;color:var(--mut)">to</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rrt" value="${repTo?isoToDmy(repTo):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rrt');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._repTo=iso;APP._finReports();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rrt').showPicker&&document.getElementById('dfh_rrt').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rrt" value="${repTo||''} " onchange="(function(iso){var el=document.getElementById('df_rrt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._repTo=iso;APP._finReports();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            ${repFrom||repTo?`<button onclick="APP._repFrom='';APP._repTo='';APP._finReports();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 7px;">✕ Clear</button>`:''}
            <span style="font-size:.65rem;color:var(--acc);font-weight:700;margin-left:4px;">${periodLabel}</span>
          </div>
        </div>
        <!-- Transaction rows -->
        ${txHtml}
        <!-- Add button footer -->
        <div style="padding:9px 14px;border-top:1px solid var(--bdr);background:var(--card2);">
          <button class="btn b-grn b-sm" onclick="APP.openExpModal()">➕ Add Transaction</button>
        </div>
      </div>

      <!-- Top Categories -->
      ${topCatsAll.length?`<div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;padding:14px;margin-bottom:14px;">
        <div style="font-size:.78rem;font-weight:800;margin-bottom:10px;">📊 Top Expense Categories — ${periodLabel}</div>
        ${topCatsAll.map(([cat,amt])=>{
          const pct=filtExp>0?Math.round((amt/filtExp)*100):0;
          return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
            <div style="font-size:.72rem;min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat}</div>
            <div style="flex:1;background:var(--dim);border-radius:3px;height:6px;overflow:hidden;">
              <div style="background:var(--acc);width:${pct}%;height:100%;border-radius:3px;"></div>
            </div>
            <div style="font-size:.68rem;color:var(--mut);min-width:90px;text-align:right;">₹${fmt(amt)} (${pct}%)</div>
          </div>`;
        }).join('')}
      </div>`:''}
    `;
  },

  // ── Finance search helpers ──
  _finToggleSearch(){
    const row=document.getElementById('fin_search_row');
    const inp=document.getElementById('exm_search_inp');
    if(!row) return;
    const isVisible=row.style.display!=='none';
    if(isVisible){
      // If search active, clear it; else hide
      if(this.expSearch){this._finClearSearch();return;}
      row.style.display='none';
    } else {
      row.style.display='flex';
      setTimeout(()=>{if(inp)inp.focus();},50);
    }
  },

  _finSearchInput(val){
    // Directly update without re-render — keep focus
    this.expSearch=val;
    clearTimeout(this._expSrchT);
    this._expSrchT=setTimeout(()=>{
      const curVal=val;
      this._finTransactions();
      // Restore focus after re-render
      requestAnimationFrame(()=>{
        const s=document.getElementById('exm_search_inp');
        if(s){s.value=curVal;s.focus();s.setSelectionRange(curVal.length,curVal.length);}
        // Show/expand search bar
        const row=document.getElementById('fin_search_row');
        if(row) row.style.display='flex';
      });
    },150);
  },

  _finClearSearch(){
    this.expSearch='';
    const row=document.getElementById('fin_search_row');
    if(row) row.style.display='none';
    this._finTransactions();
  },

  // Highlight matching text in transaction rows
  _finHighlight(text,query){
    if(!query||!text) return text||'';
    const safe=String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    try{
      const esc=query.replace(/[-[\]/{}()*+?.\\^$|]/g,'\\$&');
      return safe.replace(new RegExp('('+esc+')','gi'),
        '<mark style="background:#ffe066;color:#333;border-radius:2px;padding:0 1px;">$1</mark>');
    }catch(e){return safe;}
  },

  // ── Overview helpers ──
  _ovFilterChange(val){
    if(val==='custom'){
      const from=prompt('From date (YYYY-MM-DD):',new Date().toISOString().slice(0,8)+'01');
      if(!from){document.getElementById('ov_filter_sel').value=this.ovFilter||'thisMonth';return;}
      const to=prompt('To date (YYYY-MM-DD):',new Date().toISOString().slice(0,10));
      if(!to){document.getElementById('ov_filter_sel').value=this.ovFilter||'thisMonth';return;}
      this.ovCustomFrom=from.trim();
      this.ovCustomTo=to.trim();
    }
    this.ovFilter=val;
    this._finOverview();
  },

  _ovToggleSearch(){
    const row=document.getElementById('ov_search_row');
    const inp=document.getElementById('ov_search_inp');
    if(!row) return;
    if(row.style.display!=='none'&&!(this.ovSearch)){
      row.style.display='none';
    } else {
      row.style.display='flex';
      setTimeout(()=>{if(inp)inp.focus();},60);
    }
  },

  _ovSearchInput(val){
    this.ovSearch=val;
    clearTimeout(this._ovSrchT);
    this._ovSrchT=setTimeout(()=>{
      const cur=val;
      this._finOverview();
      requestAnimationFrame(()=>{
        const s=document.getElementById('ov_search_inp');
        if(s){s.value=cur;s.focus();s.setSelectionRange(cur.length,cur.length);}
        const r=document.getElementById('ov_search_row');
        if(r) r.style.display='flex';
      });
    },150);
  },

  _ovClearSearch(){
    this.ovSearch='';
    const row=document.getElementById('ov_search_row');
    if(row) row.style.display='none';
    this._finOverview();
  },

  // ── Transaction Preview Modal ──
  _finPreview(id){
    const e=(this.expenses||[]).find(x=>x.id===id);
    if(!e) return;
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const fDL=fD;
    const raw=e.cat||'—';
    const cleanCat=raw.replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()||raw;
    const isTransfer=e.type==='transfer';
    const typeCol  =e.type==='income'?'#2e7d32':e.type==='expense'?'#e53935':'#1565c0';
    const typeLbl  =e.type==='income'?'💰 Income':e.type==='expense'?'💸 Expense':'🔄 Transfer';
    const amtPfx   =e.type==='expense'?'−':e.type==='transfer'?'⇄':'+';
    const accLine  =isTransfer&&e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:(e.account||'—');

    const filesHtml=(e.files&&e.files.length)?`
      <div style="margin-top:12px;">
        <div style="font-size:.6rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:6px;">📎 Attachments</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;">
          ${e.files.map(f=>{
            const isImg=f.type&&f.type.startsWith('image/');
            const ext=(f.name||'').split('.').pop().toUpperCase();
            const extIco={'PDF':'📄','DOC':'📝','DOCX':'📝','XLS':'📊','XLSX':'📊'}[ext]||'📎';
            return isImg
              ? `<img src="${f.dataUrl||f.url||''}" style="height:60px;width:60px;object-fit:cover;border-radius:8px;cursor:pointer;border:1.5px solid var(--bdr);" onclick="window.open('${f.dataUrl||f.url||''}','_blank')" title="${f.name||''}">`
              : `<span style="font-size:2rem;cursor:pointer;" title="${f.name||''}">${extIco}</span>`;
          }).join('')}
        </div>
      </div>`:'';

    const existing=document.getElementById('finPreviewM');
    if(existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend',`
      <div id="finPreviewM"
        style="position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:700;display:flex;align-items:flex-end;justify-content:center;padding:0;animation:fpFadeIn .18s ease;"
        onclick="if(event.target===this)this.remove()">
        <div style="background:var(--card);border-radius:18px 18px 0 0;width:100%;max-width:480px;box-shadow:0 -4px 30px rgba(0,0,0,.2);animation:fpSlideUp .22s ease;overflow:hidden;">
          <!-- Colour header -->
          <div style="background:${typeCol};padding:16px 18px 14px;display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:.62rem;color:rgba(255,255,255,.78);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">${typeLbl}</div>
              <div style="font-size:1.7rem;font-weight:900;color:#fff;font-family:'JetBrains Mono',monospace;">${amtPfx}₹${fmt(Number(e.amount))}</div>
            </div>
            <button onclick="document.getElementById('finPreviewM').remove()"
              style="background:rgba(255,255,255,.2);border:none;border-radius:50%;width:30px;height:30px;color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
          </div>
          <!-- Details -->
          <div style="padding:16px 18px 20px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:3px;">Category</div>
                <div style="font-size:.9rem;font-weight:700;">${cleanCat}</div>
              </div>
              <div>
                <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:3px;">Date</div>
                <div style="font-size:.9rem;font-weight:700;">${fDL(e.date)}</div>
              </div>
              <div>
                <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:3px;">${isTransfer?'From → To':'Account'}</div>
                <div style="font-size:.86rem;font-weight:600;">${accLine}</div>
              </div>
              <div>
                <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:3px;">Payment Mode</div>
                <div style="font-size:.86rem;font-weight:600;">${e.paymode||'Cash'}</div>
              </div>
            </div>
            ${e.note?`<div style="margin-bottom:10px;">
              <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:4px;">Note</div>
              <div style="font-size:.86rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;">${e.note}</div>
            </div>`:''}
            ${filesHtml}
            <!-- Actions -->
            <div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--bdr);">
              <button onclick="APP.openExpModal('${e.id}');document.getElementById('finPreviewM').remove();"
                class="btn b-out" style="flex:1;padding:9px;">✏️ Edit</button>
              <button onclick="APP.delExpense('${e.id}');document.getElementById('finPreviewM').remove();"
                class="btn b-red" style="flex:1;padding:9px;">🗑 Delete</button>
            </div>
          </div>
        </div>
      </div>`);
  },

  // ── Finance Export functions ──
  _downloadFinancePDF(){
    const allExp=this.expenses||[];
    const now=new Date();
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const fDLocal=fD;
    const repFrom=this._repFrom||'';
    const repTo=this._repTo||'';
    let data=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(repFrom) data=data.filter(e=>e.date&&e.date>=repFrom);
    if(repTo)   data=data.filter(e=>e.date&&e.date<=repTo);
    data=data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const totalInc=data.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
    const totalExp=data.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
    const bal=totalInc-totalExp;
    const periodLabel=repFrom||repTo?((repFrom||'Start')+' to '+(repTo||'Today')):'All Time';

    const rows=data.map((e,i)=>{
      const cat=(e.cat||'—').replace(/^[^\wऀ-ॿ]+/,'').trim()||e.cat||'—';
      const isInc=e.type==='income';
      const isExp=e.type==='expense';
      const col=isExp?'#c0392b':isInc?'#1a7a45':'#1565c0';
      return `<tr style="background:${i%2===0?'#fff':'#f8faff'}">
        <td style="padding:7px 10px;border:1px solid #e2e8f0;white-space:nowrap;">${fDLocal(e.date)}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;color:${col};font-weight:700;">${e.type.toUpperCase()}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;">${cat}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:right;font-family:monospace;color:${col};font-weight:700;">${isExp?'−':'+'}₹${fmt(Number(e.amount))}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;">${e.account||'—'}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;">${e.paymode||'Cash'}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;">${e.note||''}</td>
      </tr>`;
    }).join('');

    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Finance Report — Raman Kumar</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;font-size:13px;color:#1a1d23;background:#fffdf7;padding:16mm 14mm;}
      .header{background:linear-gradient(135deg,#dbeafe,#eff6ff);border:1.5px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:16px;text-align:center;}
      .header h1{font-size:22px;font-weight:900;color:#1e3a5f;margin-bottom:4px;}
      .header .sub{font-size:12px;color:#3a6fa0;}
      .summary{display:flex;border:1.5px solid #bfdbfe;border-radius:8px;overflow:hidden;margin-bottom:16px;}
      .sc{flex:1;padding:12px 14px;text-align:center;border-right:1px solid #bfdbfe;}
      .sc:last-child{border-right:none;}
      .sc-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:5px;}
      .sc-val{font-size:18px;font-weight:900;}
      .info{font-size:11px;color:#888;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #bfdbfe;}
      table{width:100%;border-collapse:collapse;border:1.5px solid #bfdbfe;}
      thead tr{background:#2c6fad;}
      th{padding:10px;font-size:11px;font-weight:800;color:#fff;text-align:left;border:1px solid rgba(255,255,255,.2);text-transform:uppercase;}
      tfoot td{background:#dbeafe;font-weight:800;font-size:13px;color:#1e3a5f;border:1px solid #bfdbfe;}
      @media print{body{padding:0;background:#fff;}@page{margin:16mm 14mm;size:A4 landscape;}}
    </style></head><body>
    <div class="header">
      <div style="font-size:24px;margin-bottom:6px;">💰</div>
      <h1>Finance Report — Raman Kumar</h1>
      <div class="sub">${periodLabel} &nbsp;|&nbsp; Generated: ${fDLocal(now.toISOString().slice(0,10))}</div>
    </div>
    <div class="summary">
      <div class="sc" style="background:#f0fdf4;border-left:4px solid #1a7a45;"><div class="sc-lbl" style="color:#1a7a45;">Total Income</div><div class="sc-val" style="color:#1a7a45;">₹${fmt(totalInc)}</div></div>
      <div class="sc" style="background:#fff0f0;border-left:4px solid #c0392b;"><div class="sc-lbl" style="color:#c0392b;">Total Expense</div><div class="sc-val" style="color:#c0392b;">₹${fmt(totalExp)}</div></div>
      <div class="sc" style="background:#eff6ff;border-left:4px solid #2c6fad;"><div class="sc-lbl" style="color:#2c6fad;">Balance</div><div class="sc-val" style="color:${bal>=0?'#1a7a45':'#c0392b'};">${bal>=0?'+':'−'}₹${fmt(Math.abs(bal))}</div></div>
      <div class="sc" style="background:#f8f9fa;"><div class="sc-lbl" style="color:#6c757d;">Entries</div><div class="sc-val" style="color:#1a1d23;">${data.length}</div></div>
    </div>
    <p class="info">Transactions: ${data.length} &nbsp;|&nbsp; Period: ${periodLabel}</p>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Category</th><th style="text-align:right;">Amount</th><th>Account</th><th>Mode</th><th>Note</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="7" style="text-align:center;padding:20px;color:#999;">No transactions</td></tr>'}</tbody>
      <tfoot><tr>
        <td colspan="3" style="padding:9px 10px;">Grand Total</td>
        <td style="padding:9px 10px;text-align:right;font-family:monospace;color:${bal>=0?'#1a7a45':'#c0392b'};">${bal>=0?'+':'−'}₹${fmt(Math.abs(bal))}</td>
        <td colspan="3" style="padding:9px 10px;">In: ₹${fmt(totalInc)} &nbsp; Out: ₹${fmt(totalExp)}</td>
      </tr></tfoot>
    </table>
    </body></html>`;

    const finRows = data.map(e=>{
      const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
      const isExp=e.type==='expense', isInc=e.type==='income';
      return [fDLocal(e.date), e.type.toUpperCase(), cat, (isExp?'-':isInc?'+':'=')+'Rs.'+fmt(Number(e.amount)), e.account||'—', e.paymode||'Cash', e.note||''];
    });
    _makePDF({
      filename: 'Finance_Report_RamanKumar_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: 'Finance Report - Raman Kumar',
      subtitle: periodLabel + ' | Generated: '+fDLocal(new Date().toISOString().slice(0,10)),
      summaryRows: [
        ['Total Income', 'Rs.'+fmt(totalInc), [26,122,69]],
        ['Total Expense', 'Rs.'+fmt(totalExp), [192,57,43]],
        ['Balance', (bal>=0?'+':'-')+'Rs.'+fmt(Math.abs(bal)), bal>=0?[26,122,69]:[192,57,43]],
        ['Entries', String(data.length), [44,111,173]],
      ],
      entriesLabel: 'Transactions: '+data.length+' | Period: '+periodLabel,
      columns: ['Date','Type','Category','Amount','Account','Mode','Note'],
      rows: finRows,
      totalsRow: ['Grand Total','','', (bal>=0?'+':'-')+'Rs.'+fmt(Math.abs(bal)),'In:Rs.'+fmt(totalInc),'Out:Rs.'+fmt(totalExp),''],
      colStyles: {3:{halign:'right',fontStyle:'bold'}, 0:{cellWidth:20}},
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  _downloadFinanceCSV(){
    const allExp=this.expenses||[];
    const fDLocal=fD;
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const repFrom=this._repFrom||'';
    const repTo=this._repTo||'';
    let data=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(repFrom) data=data.filter(e=>e.date&&e.date>=repFrom);
    if(repTo)   data=data.filter(e=>e.date&&e.date<=repTo);
    data=data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const rows=[['Date','Type','Category','Amount','Account','Mode','Note']];
    data.forEach(e=>{
      const cat=(e.cat||'').replace(/^[^\wऀ-ॿ]+/,'').trim()||e.cat||'';
      rows.push([
        fDLocal(e.date),
        e.type,
        cat,
        e.type==='expense'?'-'+e.amount:'+'+e.amount,
        e.account||'',
        e.paymode||'Cash',
        (e.note||'').replace(/,/g,' ')
      ]);
    });
    const csv=rows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='Finance_Report_RamanKumar_'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a);
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ CSV downloaded! Open in Excel.');
  },

  _downloadFinanceWord(){
    const allExp=this.expenses||[];
    const now=new Date();
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const fDLocal=fD;
    const repFrom=this._repFrom||'';
    const repTo=this._repTo||'';
    let data=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(repFrom) data=data.filter(e=>e.date&&e.date>=repFrom);
    if(repTo)   data=data.filter(e=>e.date&&e.date<=repTo);
    data=data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const totalInc=data.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
    const totalExp=data.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
    const bal=totalInc-totalExp;
    const periodLabel=repFrom||repTo?((repFrom||'Start')+' to '+(repTo||'Today')):'All Time';

    const rows=data.map((e,i)=>{
      const cat=(e.cat||'—').replace(/^[^\wऀ-ॿ]+/,'').trim()||e.cat||'—';
      const isExp=e.type==='expense';
      const isInc=e.type==='income';
      const col=isExp?'#C62828':isInc?'#1A7A45':'#1565C0';
      const bg=i%2===0?'#FFFFFF':'#F8FAFF';
      return `<w:tr>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:rPr><w:sz><w:szCs/></w:sz></w:rPr><w:t>${fDLocal(e.date)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="${col.slice(1)}"/></w:rPr><w:t>${e.type.toUpperCase()}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:t>${cat}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/><w:jc w:val="right"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${col.slice(1)}"/></w:rPr><w:t>${isExp?'-':'+'}Rs.${fmt(Number(e.amount))}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:t>${e.account||'—'}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:t>${e.paymode||'Cash'}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:t>${(e.note||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</w:t></w:r></w:p></w:tc>
      </w:tr>`;
    }).join('');

    const thStyle=`<w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="1E3A5F"/><w:left w:val="single" w:sz="4" w:color="1E3A5F"/><w:bottom w:val="single" w:sz="4" w:color="1E3A5F"/><w:right w:val="single" w:sz="4" w:color="1E3A5F"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="2C6FAD"/></w:tcPr>`;
    const th=(t)=>`<w:tc>${thStyle}<w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${t}</w:t></w:r></w:p></w:tc>`;

    const docXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"
  xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  w:macrosPresent="no" w:embeddedObjPresent="no" w:ocxPresent="no">
<w:body>

  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:b/><w:color w:val="1E3A5F"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr><w:t>Finance Report — Raman Kumar</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:color w:val="3A6FA0"/><w:sz w:val="22"/></w:rPr><w:t>${periodLabel} | Generated: ${fDLocal(now.toISOString().slice(0,10))}</w:t></w:r>
  </w:p>
  <w:p><w:r><w:t> </w:t></w:r></w:p>

  <w:tbl>
    <w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="BFDBFE"/><w:insideV w:val="single" w:sz="4" w:color="BFDBFE"/></w:tblBorders></w:tblPr>
    <w:tr>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="1A7A45"/><w:left w:val="single" w:sz="6" w:color="1A7A45"/><w:bottom w:val="single" w:sz="6" w:color="1A7A45"/><w:right w:val="single" w:sz="6" w:color="1A7A45"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="F0FDF4"/></w:tcPr>
        <w:p><w:r><w:rPr><w:color w:val="1A7A45"/><w:sz w:val="18"/></w:rPr><w:t>Total Income</w:t></w:r></w:p>
        <w:p><w:r><w:rPr><w:b/><w:color w:val="1A7A45"/><w:sz w:val="28"/></w:rPr><w:t>Rs.${fmt(totalInc)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="C0392B"/><w:left w:val="single" w:sz="6" w:color="C0392B"/><w:bottom w:val="single" w:sz="6" w:color="C0392B"/><w:right w:val="single" w:sz="6" w:color="C0392B"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="FFF0F0"/></w:tcPr>
        <w:p><w:r><w:rPr><w:color w:val="C0392B"/><w:sz w:val="18"/></w:rPr><w:t>Total Expense</w:t></w:r></w:p>
        <w:p><w:r><w:rPr><w:b/><w:color w:val="C0392B"/><w:sz w:val="28"/></w:rPr><w:t>Rs.${fmt(totalExp)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/><w:left w:val="single" w:sz="6" w:color="2C6FAD"/><w:bottom w:val="single" w:sz="6" w:color="2C6FAD"/><w:right w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="EFF6FF"/></w:tcPr>
        <w:p><w:r><w:rPr><w:color w:val="2C6FAD"/><w:sz w:val="18"/></w:rPr><w:t>Balance</w:t></w:r></w:p>
        <w:p><w:r><w:rPr><w:b/><w:color w:val="${bal>=0?'1A7A45':'C0392B'}"/><w:sz w:val="28"/></w:rPr><w:t>${bal>=0?'+':'-'}Rs.${fmt(Math.abs(bal))}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  </w:tbl>
  <w:p><w:r><w:t> </w:t></w:r></w:p>

  <w:tbl>
    <w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>
    <w:tr>${th('Date')}${th('Type')}${th('Category')}${th('Amount')}${th('Account')}${th('Mode')}${th('Note')}</w:tr>
    ${rows}
    <w:tr>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="1E3A5F"/></w:rPr><w:t>Grand Total</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:t> </w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:t> </w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/><w:jc w:val="right"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${bal>=0?'1A7A45':'C0392B'}"/></w:rPr><w:t>${bal>=0?'+':'-'}Rs.${fmt(Math.abs(bal))}</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:rPr><w:color w:val="1E3A5F"/></w:rPr><w:t>In:Rs.${fmt(totalInc)}</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:rPr><w:color w:val="C0392B"/></w:rPr><w:t>Out:Rs.${fmt(totalExp)}</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:t>${data.length} entries</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl>

</w:body>
</w:wordDocument>`;

    const blob=new Blob([docXml],{type:'application/msword'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='Finance_Report_RamanKumar_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(a);
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ Word document downloaded!');
  },

  // ══ LEDGER DOWNLOAD FUNCTIONS (PDF / Word / CSV) ══
  _getLedgerData(tenantId){
    const MONTHS_L=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const fDL=fD;
    const now=new Date();
    const isSingle=tenantId&&tenantId!=='all';
    const tenants=isSingle?[this.tenants.find(t=>t.id===tenantId)].filter(Boolean):this.tenants;

    const rows=[];
    const _toLocalIso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

    tenants.forEach(t=>{
      if(!t) return;
      const prop=this.props.find(p=>p.id===t.propId);
      const ledger=this.getTenantLedger(t);

      // Track which payment IDs have been included via ledger months
      const includedPayIds = new Set();

      // Include ALL months that are either:
      //   (a) charged (invoice generated) — normal case
      //   (b) NOT charged but have payments — advance payments for upcoming months
      const moToShow = ledger.months.filter(mo => mo.charged || mo.payments.length > 0);

      moToShow.forEach(mo=>{
        const mLabel=MONTHS_L[mo.month]+' '+mo.year;
        const _iD=mo.invoiceDate, _dD=mo.dueDate;
        const invoiceLbl=fDL(_toLocalIso(_iD));
        const dueLbl=fDL(_toLocalIso(_dD));
        // charged amount: 0 if invoice not yet generated (upcoming advance)
        const chargedAmt = mo.charged ? mo.monthlyTotal : 0;

        if(mo.payments.length===0){
          // Only show empty rows for charged months (not upcoming)
          if(mo.charged){
            rows.push({tenant:t.name,property:prop?prop.name:'—',rentMonth:mLabel,payDate:'—',charged:chargedAmt,amount:0,mode:'—',note:'—',timing:'—',status:mo.status,balance:mo.runningBalance,invoiceDate:invoiceLbl,dueDate:dueLbl});
          }
        } else {
          mo.payments.forEach(p=>{
            includedPayIds.add(p.id);
            const pDateObj = p.date ? parseIso(p.date) : null;
            let timing = 'Advance'; // default for pre-invoice payments
            if(pDateObj && !isNaN(pDateObj) && mo.charged){
              if(pDateObj < mo.invoiceDate) timing = 'Advance';
              else if(pDateObj <= mo.dueDate) timing = 'On-time';
              else timing = 'Late';
            }
            console.log('[ledgerData] payment:', p.date, 'rentForMonth:', p.rentForMonth, 'charged:', mo.charged, 'timing:', timing);
            rows.push({tenant:t.name,property:prop?prop.name:'—',rentMonth:mLabel,payDate:fDL(p.date),charged:chargedAmt,amount:(p.ptype==='refund'?-1:1)*Number(p.amount),mode:p.mode||'Cash',note:p.note||p.ref||'',timing,status:p.ptype==='refund'?'Refund':timing,balance:mo.runningBalance,invoiceDate:invoiceLbl,dueDate:dueLbl});
          });
        }
      });

      // Catch orphan payments: payments whose rentForMonth doesn't match any ledger month
      // (e.g. future months not yet in ledger window, or data saved before fix)
      const allTenantPays = (this.payments||[]).filter(p=>p.tenantId===t.id);
      allTenantPays.forEach(p=>{
        if(includedPayIds.has(p.id)) return; // already shown
        // This payment wasn't matched to any ledger month — show it anyway
        const rfm = p.rentForMonth || (p.date ? p.date.slice(0,7) : '');
        const [ry,rm] = rfm.split('-').map(Number);
        const mLabel = (MONTHS_L[rm-1]||'Month') + ' ' + (ry||'');
        const pDateObj = p.date ? parseIso(p.date) : null;
        console.log('[ledgerData] orphan payment:', p.date, 'rentForMonth:', rfm);
        rows.push({
          tenant:t.name, property:prop?prop.name:'—',
          rentMonth:mLabel, payDate:fDL(p.date),
          charged:0, amount:(p.ptype==='refund'?-1:1)*Number(p.amount),
          mode:p.mode||'Cash', note:p.note||p.ref||'',
          timing:'Advance', status:'Advance',
          balance:0, invoiceDate:'—', dueDate:'—'
        });
      });
    });

    // Sort rows: by rentMonth year+month descending, then by payDate
    rows.sort((a,b)=>{
      // Extract YYYY-MM from rentMonth label for sorting
      const toKey = label => {
        const m = label.match(/(\w+)\s+(\d{4})/);
        if(!m) return '0000-00';
        const mi = MONTHS_L.indexOf(m[1]);
        return m[2]+'-'+String(mi+1).padStart(2,'0');
      };
      const ka=toKey(a.rentMonth), kb=toKey(b.rentMonth);
      return kb.localeCompare(ka); // newest first
    });

    return{rows,tenants};
  },

  _downloadLedgerPDF(tenantId){
    const {rows,tenants}=this._getLedgerData(tenantId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=tenantId&&tenantId!=='all';
    const title=isSingle&&tenants[0]?tenants[0].name+' — Rent Ledger':'Combined Rent Ledger — All Tenants';
    const now=new Date();
    const totalRecd=rows.filter(r=>r.amount>0).reduce((s,r)=>s+r.amount,0);
    const totalBal=isSingle&&tenants[0]?this.getTenantLedger(tenants[0]).totalBalance:this.tenants.reduce((s,t)=>s+this.getTenantLedger(t).totalBalance,0);

    const tableRows=rows.map(r=>{
      const col=r.amount<0?'#c62828':r.amount===0?'#888':'#2e7d32';
      const amtStr=r.amount===0?'—':(r.amount<0?'− ':'+ ')+'₹'+fmt2(Math.abs(r.amount));
      const tCol=r.timing==='Advance'?'#1565c0':r.timing==='Late'?'#e65100':'#2e7d32';
      return`<tr>
        ${!isSingle?`<td>${r.tenant}</td>`:''}
        <td>${r.rentMonth}</td>
        <td style="color:#555">${r.invoiceDate}</td>
        <td style="color:#555">${r.dueDate}</td>
        <td style="font-family:monospace">₹${fmt2(r.charged)}</td>
        <td>${r.payDate}</td>
        <td style="color:${col};font-weight:700;font-family:monospace">${amtStr}</td>
        <td>${r.mode}</td>
        <td style="color:${tCol};font-weight:700">${r.timing}</td>
        <td style="color:${r.balance>0?'#c62828':'#2e7d32'};font-weight:700;font-family:monospace">${r.balance>0?'₹'+fmt2(r.balance):'✓ Clear'}</td>
        <td style="font-size:10px;color:#666">${r.note}</td>
      </tr>`;
    }).join('');

    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;margin:16mm 14mm;}h1{font-size:16px;color:#b5701c;margin-bottom:3px;}
    .sub{color:#666;font-size:10px;margin-bottom:12px;}.summary{display:flex;gap:16px;margin-bottom:14px;background:#f5f5f5;padding:9px;border-radius:5px;}
    .s-card{text-align:center;}.s-label{font-size:9px;text-transform:uppercase;color:#666;}.s-val{font-size:14px;font-weight:bold;}
    table{width:100%;border-collapse:collapse;font-size:10px;}th{background:#b5701c;color:#fff;padding:5px 6px;text-align:left;white-space:nowrap;}
    td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top;}tr:nth-child(even){background:#fafafa;}
    @media print{body{margin:0;}@page{margin:16mm 14mm;}}</style></head><body>
    <h1>📒 ${title}</h1>
    <div class="sub">Generated: ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} | Period: All Time</div>
    <div class="summary">
      <div class="s-card"><div class="s-label">Total Received</div><div class="s-val" style="color:#2e7d32">₹${fmt2(totalRecd)}</div></div>
      <div class="s-card"><div class="s-label">Outstanding</div><div class="s-val" style="color:${totalBal>0?'#c62828':'#2e7d32'}">${totalBal>0?'₹'+fmt2(totalBal):'✓ Clear'}</div></div>
      <div class="s-card"><div class="s-label">Entries</div><div class="s-val">${rows.length}</div></div>
    </div>
    <table><thead><tr>${!isSingle?'<th>Tenant</th>':''}<th>Rent Month</th><th>Invoice Date</th><th>Due Date</th><th>Charged</th><th>Pay Date</th><th>Amount</th><th>Mode</th><th>Timing</th><th>Balance</th><th>Note</th></tr></thead>
    <tbody>${tableRows||'<tr><td colspan="11">No data</td></tr>'}</tbody></table>
    </body></html>`;

    const fname2=(isSingle&&tenants[0]?tenants[0].name.replace(/\s+/g,'_'):'All_Tenants');
    const cols = isSingle
      ? ['Rent Month','Invoice','Due Date','Charged','Pay Date','Amount','Mode','Timing','Balance','Note']
      : ['Tenant','Rent Month','Invoice','Due Date','Charged','Pay Date','Amount','Mode','Timing','Balance','Note'];
    const pdfRows = rows.map(r=>{
      const amtStr=r.amount===0?'—':(r.amount<0?'- ':'+ ')+'Rs.'+fmt2(Math.abs(r.amount));
      const balStr=r.balance>0?'Rs.'+fmt2(r.balance):'Clear';
      return isSingle
        ? [r.rentMonth,r.invoiceDate,r.dueDate,'Rs.'+fmt2(r.charged),r.payDate,amtStr,r.mode,r.timing,balStr,r.note]
        : [r.tenant,r.rentMonth,r.invoiceDate,r.dueDate,'Rs.'+fmt2(r.charged),r.payDate,amtStr,r.mode,r.timing,balStr,r.note];
    });
    // ── Rent Ledger: explicit column widths so no word ever breaks ──
    // Portrait usable = 182mm (A4 210 - 2×14), Landscape = 269mm (A4 297 - 2×14)
    // All-Tenants (11 cols) → always landscape for readability
    // Single Tenant (10 cols) → portrait with explicit widths
    const _rlOri = isSingle ? (APP._pdfOrientation||'portrait') : 'landscape';
    const _rlW   = _rlOri === 'landscape' ? 269 : 182;

    // Column widths (mm) — sized to fit longest realistic value without breaking
    // All-Tenants cols: Tenant | Rent Month | Invoice | Due Date | Charged | Pay Date | Amount | Mode | Timing | Balance | Note
    // Single-Tenant cols: Rent Month | Invoice | Due Date | Charged | Pay Date | Amount | Mode | Timing | Balance | Note
    const _rlColW_all    = [42, 20, 18, 18, 22, 18, 22, 14, 18, 20, 57]; // total=269
    const _rlColW_single = [22, 18, 18, 22, 18, 22, 16, 18, 20, 28];     // total=202 (fits 182 with some flex)

    // Build colStyles with explicit cellWidth + alignment
    const _rlColStyles = {};
    const _rlWidths = isSingle ? _rlColW_single : _rlColW_all;
    // Scale widths proportionally to actual usable width
    const _rlRawTotal = _rlWidths.reduce((a,b)=>a+b,0);
    _rlWidths.forEach((w,i)=>{
      _rlColStyles[i] = { cellWidth: parseFloat((w/_rlRawTotal*_rlW).toFixed(2)) };
    });
    // Right-align amount/charged/balance cols
    if(isSingle){
      Object.assign(_rlColStyles[3],{halign:'right'});  // Charged
      Object.assign(_rlColStyles[5],{halign:'right'});  // Amount
      Object.assign(_rlColStyles[8],{halign:'right'});  // Balance
    } else {
      Object.assign(_rlColStyles[4],{halign:'right'});  // Charged
      Object.assign(_rlColStyles[6],{halign:'right'});  // Amount
      Object.assign(_rlColStyles[9],{halign:'right'});  // Balance
    }

    _makePDF({
      filename: 'Rent_Ledger_'+fname2+'_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: title,
      subtitle: 'Generated: '+fD(now.toISOString().slice(0,10))+' | All Time',
      orientation: _rlOri,
      summaryRows: [
        ['Total Received','Rs.'+fmt2(totalRecd),[26,122,69]],
        ['Outstanding', totalBal>0?'Rs.'+fmt2(totalBal):'Clear', totalBal>0?[192,57,43]:[26,122,69]],
        ['Entries', String(rows.length), [44,111,173]],
      ],
      entriesLabel: 'Entries: '+rows.length,
      columns: cols,
      rows: pdfRows,
      colStyles: _rlColStyles,
      headerColor: [181,112,28],
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  _downloadLedgerCSV(tenantId){
    const {rows,tenants}=this._getLedgerData(tenantId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=tenantId&&tenantId!=='all';
    const headers=isSingle
      ?['Rent Month','Invoice Date','Due Date','Charged','Payment Date','Amount','Mode','Timing','Balance','Note']
      :['Tenant','Property','Rent Month','Invoice Date','Due Date','Charged','Payment Date','Amount','Mode','Timing','Balance','Note'];
    const csvRows=[headers];
    rows.forEach(r=>{
      const amtStr=r.amount===0?'0':(r.amount<0?'-':'')+Math.abs(r.amount);
      if(isSingle){
        csvRows.push([r.rentMonth,r.invoiceDate,r.dueDate,r.charged,r.payDate,amtStr,r.mode,r.timing,r.balance,'"'+(r.note||'').replace(/"/g,"'")+'"']);
      } else {
        csvRows.push(['"'+r.tenant+'"','"'+r.property+'"',r.rentMonth,r.invoiceDate,r.dueDate,r.charged,r.payDate,amtStr,r.mode,r.timing,r.balance,'"'+(r.note||'').replace(/"/g,"'")+'"']);
      }
    });
    const csv=csvRows.map(r=>r.join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const fname=isSingle&&tenants[0]?tenants[0].name.replace(/\s+/g,'_'):'All_Tenants';
    a.download='Rent_Ledger_'+fname+'_'+new Date().toISOString().slice(0,10)+'.csv';
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ CSV downloaded!');
  },

  _downloadLedgerWord(tenantId){
    const {rows,tenants}=this._getLedgerData(tenantId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=tenantId&&tenantId!=='all';
    const title=isSingle&&tenants[0]?tenants[0].name+' — Rent Ledger':'Combined Rent Ledger — All Tenants';
    const now=new Date();
    const totalRecd=rows.filter(r=>r.amount>0).reduce((s,r)=>s+r.amount,0);
    const totalBal=isSingle&&tenants[0]?this.getTenantLedger(tenants[0]).totalBalance:this.tenants.reduce((s,t)=>s+this.getTenantLedger(t).totalBalance,0);

    const tableRows=rows.map(r=>{
      const col=r.amount<0?'#C62828':r.amount===0?'#888':'#2E7D32';
      const amtStr=r.amount===0?'—':(r.amount<0?'− ':'+ ')+'₹'+fmt2(Math.abs(r.amount));
      const tCol=r.timing==='Advance'?'#1565C0':r.timing==='Late'?'#E65100':'#2E7D32';
      return`<tr>${!isSingle?`<td>${r.tenant}</td>`:''}
        <td>${r.rentMonth}</td><td>${r.invoiceDate}</td><td>${r.dueDate}</td>
        <td style="font-family:Courier">₹${fmt2(r.charged)}</td><td>${r.payDate}</td>
        <td style="color:${col};font-weight:bold">${amtStr}</td>
        <td>${r.mode}</td>
        <td style="color:${tCol};font-weight:bold">${r.timing}</td>
        <td style="color:${r.balance>0?'#C62828':'#2E7D32'};font-weight:bold">${r.balance>0?'₹'+fmt2(r.balance):'Clear'}</td>
        <td style="font-size:9pt">${r.note}</td>
      </tr>`;
    }).join('');

    const docHtml=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><title>${title}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
    <style>body{font-family:Arial;font-size:10pt;}h1{color:#B5701C;font-size:14pt;}
    table{border-collapse:collapse;width:100%;font-size:9pt;}
    th{background:#B5701C;color:white;padding:5px;border:1px solid #999;}
    td{padding:4px 6px;border:1px solid #ddd;vertical-align:top;}</style></head><body>
    <h1>📒 ${title}</h1>
    <p><b>Generated:</b> ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
    <table><tr><td><b>Total Received:</b></td><td style="color:#2E7D32">₹${fmt2(totalRecd)}</td>
    <td><b>Outstanding:</b></td><td style="color:${totalBal>0?'#C62828':'#2E7D32'}">${totalBal>0?'₹'+fmt2(totalBal):'✓ Clear'}</td>
    <td><b>Entries:</b></td><td>${rows.length}</td></tr></table><br>
    <table><thead><tr>${!isSingle?'<th>Tenant</th>':''}<th>Rent Month</th><th>Invoice</th><th>Due</th><th>Charged</th><th>Pay Date</th><th>Amount</th><th>Mode</th><th>Timing</th><th>Balance</th><th>Note</th></tr></thead>
    <tbody>${tableRows||'<tr><td colspan="11">No data</td></tr>'}</tbody></table>
    </body></html>`;

    // Word XML format — avoids parsing error
    const wDoc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<?mso-application progid="Word.Document"?>'
      +'<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">'
      +'<w:body>'+docHtml.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
      +'</w:body></w:wordDocument>';
    // Simpler: just use the HTML directly with proper mime
    const blob=new Blob([docHtml],{type:'application/vnd.ms-word'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const fname=isSingle&&tenants[0]?tenants[0].name.replace(/\s+/g,'_'):'All_Tenants';
    a.download='Rent_Ledger_'+fname+'_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(a);
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(a.href);},200);
    this.showToastMsg('✅ Word file downloaded!');
  },

  // ══ KHATA BOOK DOWNLOAD FUNCTIONS ══
  _kbGetData(partyId){
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const fDL=fD;
    const isSingle=partyId&&partyId!=='all';
    const parties=isSingle?[this.kbParties.find(p=>p.id===partyId)].filter(Boolean):this.kbParties;
    const kbFrom=this._kbFromDate||'';
    const kbTo=this._kbToDate||'';
    const rows=[];
    parties.forEach(p=>{
      if(!p) return;
      const bal=this._kbPartyBalance(p.id);
      let entries=bal.entries.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      // Apply date filter
      if(kbFrom||kbTo){
        entries=entries.filter(e=>{
          const d=e.date?new Date(e.date):null;
          if(!d) return true;
          if(kbFrom&&d<new Date(kbFrom)) return false;
          if(kbTo){const t2=new Date(kbTo);t2.setHours(23,59,59,999);if(d>t2)return false;}
          return true;
        });
      }
      entries.forEach(e=>{
        rows.push({party:p.name,phone:p.phone||'—',cat:p.cat||'other',date:fDL(e.date),type:e.type==='lena'?'Liya (Received)':'Diya (Paid)',amount:Number(e.amount||0),note:e.note||'—',balance:bal.net});
      });
    });
    return{rows,parties};
  },

  _kbDownloadPDF(partyId){
    const {rows,parties}=this._kbGetData(partyId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=partyId&&partyId!=='all';
    const partyName=isSingle&&parties[0]?parties[0].name:'All Parties';
    const now=new Date();
    const fromStr=this._kbFromDate?this._kbFromDate.split('-').reverse().join(' ').replace(/(\d+) (\d+) (\d+)/,(_,d,m,y)=>d+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]+' '+y):'';
    const toStr=this._kbToDate?this._kbToDate.split('-').reverse().join(' ').replace(/(\d+) (\d+) (\d+)/,(_,d,m,y)=>d+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]+' '+y):'';
    const periodStr=fromStr||toStr?'('+( fromStr||'Start')+' - '+(toStr||'Today')+')':'(All Time)';
    // Debit = Diya (you paid/gave), Credit = Liya (you received/got)
    const totalDebit=rows.filter(r=>r.type.startsWith('Diya')).reduce((s,r)=>s+r.amount,0);
    const totalCredit=rows.filter(r=>r.type.startsWith('Liya')).reduce((s,r)=>s+r.amount,0);
    const net=totalCredit-totalDebit;

    const tableRows=rows.map(r=>{
      const isCredit=r.type.startsWith('Liya');
      return`<tr>
        ${!isSingle?`<td style="padding:8px 10px;border:1px solid #e8dcc8;">${r.party}</td>`:''}
        <td style="padding:8px 10px;border:1px solid #e8dcc8;white-space:nowrap;">${r.date}</td>
        <td style="padding:8px 10px;border:1px solid #e8dcc8;">${r.note||'—'}</td>
        <td style="padding:8px 10px;border:1px solid #e8dcc8;text-align:right;font-family:monospace;font-size:14px;color:${isCredit?'#ccc':'#c0392b'};font-weight:${isCredit?'400':'700'};">${isCredit?'—':fmt2(r.amount)}</td>
        <td style="padding:8px 10px;border:1px solid #e8dcc8;text-align:right;font-family:monospace;font-size:14px;color:${isCredit?'#1a7a45':'#ccc'};font-weight:${isCredit?'700':'400'};">${isCredit?fmt2(r.amount):'—'}</td>
      </tr>`;
    }).join('');

    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Account Statement</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1d23;background:#f0f2f5;padding:16mm 14mm;}
      .header{text-align:center;margin-bottom:20px;padding:18px 20px 16px;background:linear-gradient(135deg,#dbeafe,#eff6ff);border-radius:10px;border:1.5px solid #bfdbfe;}
      .header h1{font-size:24px;font-weight:900;color:#1e3a5f;margin-bottom:4px;letter-spacing:.02em;}
      .header .period{font-size:13px;color:#3a6fa0;}
      .summary-box{border:1.5px solid #bfdbfe;border-radius:8px;display:flex;margin-bottom:20px;overflow:hidden;box-shadow:0 2px 8px rgba(44,111,173,.10);}
      .sum-cell{flex:1;padding:15px 16px;text-align:center;border-right:1px solid #bfdbfe;}
      .sum-cell:last-child{border-right:none;}
      .sum-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;font-weight:800;}
      .sum-val{font-size:21px;font-weight:900;}
      .entries-label{font-size:12px;color:#6c757d;margin-bottom:8px;padding:4px 0;border-bottom:1px dashed #bfdbfe;}
      table{width:100%;border-collapse:collapse;border:1.5px solid #bfdbfe;}
      thead tr{background:#2c6fad;}
      th{padding:11px 12px;text-align:left;font-size:12px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);text-transform:uppercase;letter-spacing:.04em;}
      th.num{text-align:right;}
      td{font-size:13px;color:#1a1d23;border:1px solid #e2e8f0;padding:9px 12px;}
      tr:nth-child(even) td{background:#f8faff;}
      tr:nth-child(odd) td{background:#fff;}
      .grand-total td{background:#dbeafe!important;font-weight:800;border-top:2px solid #2c6fad;color:#1e3a5f;}
      @media print{body{padding:0;background:#fff;}@page{margin:16mm 14mm;}}
    </style></head><body>
    <div class="header">
      <div style="font-size:26px;margin-bottom:6px;">📒</div>
      <h1>Khata Book — Hisab Kitab</h1>
      <div class="period">${periodStr}</div>
      ${isSingle?`<div style="font-size:14px;color:#1e3a5f;margin-top:6px;background:rgba(44,111,173,.12);display:inline-block;padding:4px 16px;border-radius:20px;font-weight:800;border:1px solid #bfdbfe;">👤 ${partyName}</div>`:'<div style="font-size:12px;color:#3a6fa0;margin-top:4px;">Sabhi Parties — All Parties</div>'}
    </div>
    <div class="summary-box">
      <div class="sum-cell" style="background:#fff0f0;border-left:4px solid #c0392b;"><div class="sum-label" style="color:#c0392b;">Total Ko Diya (−)</div><div class="sum-val" style="color:#c0392b;">${fmt2(totalDebit)}</div></div>
      <div class="sum-cell" style="background:#f0fdf4;border-left:4px solid #1a7a45;"><div class="sum-label" style="color:#1a7a45;">Total Se Liya (+)</div><div class="sum-val" style="color:#1a7a45;">${fmt2(totalCredit)}</div></div>
      <div class="sum-cell" style="background:#eff6ff;border-left:4px solid #2c6fad;"><div class="sum-label" style="color:#2c6fad;">Net Balance</div><div class="sum-val" style="color:${net>=0?'#166534':'#991b1b'};">${fmt2(Math.abs(net))} ${net>=0?'Cr':'Dr'}</div></div>
    </div>
    <div class="entries-label">No. of Entries: ${rows.length}</div>
    <table>
      <thead><tr>
        ${!isSingle?'<th>Party Name</th>':''}
        <th>Date</th><th>Details</th>
        <th class="num" style="background:#c0392b;color:#fff;">Ko Diya (−)</th><th class="num" style="background:#1a7a45;color:#fff;">Se Liya (+)</th>
      </tr></thead>
      <tbody>${tableRows||'<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">No entries</td></tr>'}</tbody>
      <tr class="grand-total">
        ${!isSingle?'<td></td>':''}
        <td colspan="2" style="padding:10px 12px;border:1px solid #bfdbfe;font-size:14px;">Grand Total / Kul Jama</td>
        <td style="padding:10px 12px;border:1px solid #bfdbfe;text-align:right;font-family:monospace;font-size:15px;font-weight:900;color:#c0392b;">${fmt2(totalDebit)}</td>
        <td style="padding:10px 12px;border:1px solid #bfdbfe;text-align:right;font-family:monospace;font-size:15px;font-weight:900;color:#1a7a45;">${fmt2(totalCredit)}</td>
      </tr>
    </table>
    </body></html>`;
    // TRUE download — data URI forces browser to save file, no popup
    const fname3=(isSingle&&parties[0]?parties[0].name.replace(/\s+/g,'_'):'All_Parties');
    // Build columns and rows for jsPDF
    const kbCols = isSingle
      ? ['Date','Details','Ko Diya (−)','Se Liya (+)']
      : ['Party','Date','Details','Ko Diya (−)','Se Liya (+)'];
    const kbRows = rows.map(r=>{
      const isCredit=r.type.startsWith('Liya');
      const debitStr = isCredit ? '—' : fmt2(r.amount);
      const creditStr = isCredit ? fmt2(r.amount) : '—';
      return isSingle
        ? [r.date, r.note||'—', debitStr, creditStr]
        : [r.party, r.date, r.note||'—', debitStr, creditStr];
    });
    const lastIdx = kbCols.length - 1;
    const prevIdx = lastIdx - 1;
    const kbColStyles = {
      [prevIdx]: {halign:'right', textColor:[192,57,43], fontStyle:'bold'},
      [lastIdx]: {halign:'right', textColor:[26,122,69], fontStyle:'bold'},
    };
    if(!isSingle) kbColStyles[0]={fontStyle:'bold'};
    const kbTotals = isSingle
      ? ['Grand Total / Kul Jama','', fmt2(totalDebit), fmt2(totalCredit)]
      : ['','Grand Total / Kul Jama','', fmt2(totalDebit), fmt2(totalCredit)];

    _makePDF({
      filename: 'Khata_'+fname3+'_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: 'Khata Book - Hisab Kitab',
      subtitle: periodStr,
      badge: isSingle ? 'Party: '+partyName : 'Sabhi Parties (All)',
      summaryRows: [
        ['Total Ko Diya (−)', fmt2(totalDebit), [192,57,43]],
        ['Total Se Liya (+)', fmt2(totalCredit), [26,122,69]],
        ['Net Balance', fmt2(Math.abs(net))+(net>=0?' Cr':' Dr'), net>=0?[26,122,69]:[192,57,43]],
      ],
      entriesLabel: 'Entries: '+rows.length,
      columns: kbCols,
      rows: kbRows,
      totalsRow: kbTotals,
      colStyles: kbColStyles,
      headerColor: [44,111,173],
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  _kbDownloadCSV(partyId){
    const {rows,parties}=this._kbGetData(partyId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=partyId&&partyId!=='all';
    const headers=isSingle?['Date','Type','Amount','Note']:['Party','Phone','Category','Date','Type','Amount','Note'];
    const csvRows=[headers];
    rows.forEach(r=>{
      const amtStr=(r.type.startsWith('Liya')?'':'-')+r.amount;
      if(isSingle) csvRows.push([r.date,r.type,amtStr,'"'+(r.note||'').replace(/"/g,"'")+'"']);
      else csvRows.push(['"'+r.party+'"',r.phone,r.cat,r.date,r.type,amtStr,'"'+(r.note||'').replace(/"/g,"'")+'"']);
    });
    const csv=csvRows.map(r=>r.join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const fname=isSingle&&parties[0]?parties[0].name.replace(/\s+/g,'_'):'All_Parties';
    a.download='Khata_'+fname+'_'+new Date().toISOString().slice(0,10)+'.csv';
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ CSV downloaded!');
  },

  _kbDownloadWord(partyId){
    const {rows,parties}=this._kbGetData(partyId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=partyId&&partyId!=='all';
    const title=isSingle&&parties[0]?parties[0].name+' — Khata Ledger':'Khata Book — All Parties';
    const now=new Date();
    const totalLena=rows.filter(r=>r.type.startsWith('Liya')).reduce((s,r)=>s+r.amount,0);
    const totalDena=rows.filter(r=>r.type.startsWith('Diya')).reduce((s,r)=>s+r.amount,0);

    const tableRows=rows.map(r=>{
      const isLena=r.type.startsWith('Liya');
      const col=isLena?'#166534':'#991b1b';
      return`<tr>${!isSingle?`<td>${r.party}</td><td>${r.phone}</td>`:''}
        <td>${r.date}</td><td style="color:${col};font-weight:bold">${r.type}</td>
        <td style="color:${col};font-weight:bold;text-align:right">${isLena?'+':'-'}₹${fmt2(r.amount)}</td>
        <td>${r.note}</td></tr>`;
    }).join('');

    const periodStr=this._kbFromDate||this._kbToDate
      ?' | Period: '+(this._kbFromDate||'start')+' to '+(this._kbToDate||'today')
      :' | All Time';
    // Proper Word XML format — avoids "error in parsing" on all Word versions
    const docHtml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<?mso-application progid="Word.Document"?>'
      +'<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"'
      +' xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint">'
      +'<w:body>'
      +'<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="B5701C"/></w:rPr>'
      +'<w:t>Khata Book — '+title+'</w:t></w:r></w:p>'
      +'<w:p><w:r><w:t>Generated: '+now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})+periodStr+'</w:t></w:r></w:p>'
      +'<w:p><w:r><w:t>Total Liya (Received): Rs.'+fmt2(totalLena)+'   |   Total Diya (Paid): Rs.'+fmt2(totalDena)+'   |   Net: '+(totalLena-totalDena>=0?'+':'-')+'Rs.'+fmt2(Math.abs(totalLena-totalDena))+'</w:t></w:r></w:p>'
      +'<w:p><w:r><w:t> </w:t></w:r></w:p>'
      +'<w:tbl>'
      +'<w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>'
      +'<w:top w:val="single" w:sz="4" w:color="999999"/>'
      +'<w:left w:val="single" w:sz="4" w:color="999999"/>'
      +'<w:bottom w:val="single" w:sz="4" w:color="999999"/>'
      +'<w:right w:val="single" w:sz="4" w:color="999999"/>'
      +'<w:insideH w:val="single" w:sz="4" w:color="dddddd"/>'
      +'<w:insideV w:val="single" w:sz="4" w:color="dddddd"/>'
      +'</w:tblBorders></w:tblPr>'
      // header row
      +'<w:tr>'+((!isSingle)?'<w:tc><w:p><w:r><w:rPr><w:b/><w:shd w:val="clear" w:color="auto" w:fill="B5701C"/></w:rPr><w:t>Party</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Phone</w:t></w:r></w:p></w:tc>':'')
      +'<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Date</w:t></w:r></w:p></w:tc>'
      +'<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Type</w:t></w:r></w:p></w:tc>'
      +'<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Amount</w:t></w:r></w:p></w:tc>'
      +'<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Note</w:t></w:r></w:p></w:tc>'
      +'</w:tr>'
      // data rows
      +(rows.length?rows.map(r=>{
        const isLena=r.type.startsWith('Liya');
        const sign=isLena?'+':'-';
        return '<w:tr>'
          +((!isSingle)?'<w:tc><w:p><w:r><w:t>'+r.party+'</w:t></w:r></w:p></w:tc>'
            +'<w:tc><w:p><w:r><w:t>'+r.phone+'</w:t></w:r></w:p></w:tc>':'')
          +'<w:tc><w:p><w:r><w:t>'+r.date+'</w:t></w:r></w:p></w:tc>'
          +'<w:tc><w:p><w:r><w:t>'+r.type+'</w:t></w:r></w:p></w:tc>'
          +'<w:tc><w:p><w:r><w:t>'+sign+'Rs.'+fmt2(r.amount)+'</w:t></w:r></w:p></w:tc>'
          +'<w:tc><w:p><w:r><w:t>'+(r.note||'')+'</w:t></w:r></w:p></w:tc>'
          +'</w:tr>';
      }).join(''):'<w:tr><w:tc><w:p><w:r><w:t>No entries</w:t></w:r></w:p></w:tc></w:tr>')
      +'</w:tbl>'
      +'</w:body></w:wordDocument>';
    const _kbwBlob=new Blob(['\uFEFF'+docHtml],{type:'application/msword'});
    const _kbwA=document.createElement('a');
    _kbwA.href=URL.createObjectURL(_kbwBlob);
    const fname=isSingle&&parties[0]?parties[0].name.replace(/\s+/g,'_'):'All_Parties';
    _kbwA.download='Khata_'+fname+'_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(_kbwA);
    _kbwA.click();
    document.body.removeChild(_kbwA);URL.revokeObjectURL(_kbwA.href);
    this.showToastMsg('✅ Word file downloaded!');
  },

  _expPrevMon(){
    const d=new Date((this.expMonth||new Date().toISOString().slice(0,7))+'-01');
    d.setMonth(d.getMonth()-1);
    this.expSub='month';
    this.expMonth=d.toISOString().slice(0,7);
    this.renderExpense();
  },
  _expNextMon(){
    const d=new Date((this.expMonth||new Date().toISOString().slice(0,7))+'-01');
    d.setMonth(d.getMonth()+1);
    this.expSub='month';
    this.expMonth=d.toISOString().slice(0,7);
    this.renderExpense();
  },

  // ── Medical Files popup — View + Download all Rx and Lab files ──
  _medShowFiles(visitId){
    const r = this.visits.find(x=>x.id===visitId);
    if(!r) return;
    const pat = this.patients.find(p=>p.id===r.patId);

    // Collect prescription files
    const presFiles = (r.presFiles&&r.presFiles.length) ? r.presFiles
      : (r.link ? [{url:r.link, name:'Prescription', type:''}] : []);

    // Collect lab files
    const labLinks = [r.lablink,r.lablink2,r.lablink3].filter(Boolean);
    const labFiles = (r.labFiles&&r.labFiles.length) ? r.labFiles
      : labLinks.map((u,i)=>({url:u, name:'Lab Report'+(labLinks.length>1?' '+(i+1):''), type:''}));

    const allFiles = [
      ...presFiles.map((f,i)=>({...f, label:'📄 Rx'+(presFiles.length>1?' '+(i+1):''), section:'Prescription'})),
      ...labFiles.map((f,i)=>({...f, label:'🧪 Lab'+(labFiles.length>1?' '+(i+1):''), section:'Lab Report'}))
    ];

    if(!allFiles.length){ this.showToastMsg('⚠️ No files attached'); return; }

    const existing = document.getElementById('medFilesOverlay');
    if(existing) existing.remove();

    const icon = f => {
      const ext=(f.name||'').split('.').pop().toLowerCase();
      if(['jpg','jpeg','png','webp','gif'].includes(ext)||f.type?.startsWith('image/')) return '🖼️';
      if(ext==='pdf') return '📄';
      return '📎';
    };
    const sz = b => !b?'':b>1048576?(b/1048576).toFixed(1)+' MB':Math.round(b/1024)+' KB';

    const fileRows = allFiles.map(f => `
      <div style="background:var(--dim);border-radius:10px;border:1.5px solid var(--bdr2);padding:11px 13px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:9px;">
          <span style="font-size:1.4rem;flex-shrink:0;">${icon(f)}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:.72rem;font-weight:700;color:#b56a00;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">${f.label}</div>
            <div style="font-size:.82rem;font-weight:700;color:var(--txt);word-break:break-all;line-height:1.3;">${f.name||'File'}</div>
            ${f.size?`<div style="font-size:.7rem;color:var(--mut);">${sz(f.size)}</div>`:''}
          </div>
        </div>
        <div style="display:flex;gap:7px;">
          <a href="${f.url}" target="_blank"
            style="flex:1;text-align:center;padding:9px 6px;background:var(--acc);color:#fff;border-radius:8px;font-size:.82rem;font-weight:800;text-decoration:none;touch-action:manipulation;display:block;">
            👁 View / Open
          </a>
          <button onclick="APP.downloadFile('${f.url}', '${f.name||'file'}'); event.stopPropagation();"
            style="flex:1;text-align:center;padding:9px 6px;background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;border-radius:8px;font-size:.82rem;font-weight:800;cursor:pointer;touch-action:manipulation;display:block;font-family:'Nunito',sans-serif;">
            ⬇️ Download
          </button>
        </div>
      </div>`).join('');

    const el = document.createElement('div');
    el.id = 'medFilesOverlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
    el.innerHTML = `
      <div style="background:var(--card);border-radius:14px;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.25);overflow:hidden;">
        <!-- Header -->
        <div style="padding:12px 16px;border-bottom:1px solid var(--bdr);background:var(--card2);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div>
            <div style="font-weight:800;font-size:.9rem;">📎 Medical Files</div>
            <div style="font-size:.72rem;color:var(--mut);margin-top:2px;">${r.doctor?'Dr. '+r.doctor:r.type||'Visit'} · ${pat?pat.name:''} · ${allFiles.length} file${allFiles.length>1?'s':''}</div>
          </div>
          <button onclick="document.getElementById('medFilesOverlay').remove()"
            style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--mut);padding:4px;line-height:1;">✕</button>
        </div>
        <!-- Scrollable file list -->
        <div style="flex:1;overflow-y:auto;padding:12px 14px;">
          ${fileRows}
        </div>
        <!-- Footer note -->
        <div style="padding:8px 14px;border-top:1px solid var(--bdr);background:var(--card2);font-size:.7rem;color:var(--mut);flex-shrink:0;">
          💡 Tap View to open in browser · Download saves to your device
        </div>
      </div>`;

    document.body.appendChild(el);
    el.addEventListener('click', e => { if(e.target===el) el.remove(); });
  },

  // ══ MEDICAL ══
  savePatient(){
    const name=v('ptm_name');if(!name){alert('Name required!');return;}
    const data={name,relation:v('ptm_rel'),dob:vDate('ptm_dob')||v('ptm_dob'),blood:v('ptm_blood'),cond:v('ptm_cond'),emg:v('ptm_emg'),ins:v('ptm_ins')};
    let ps=this.patients;
    if(this.editPatId){
      ps=ps.map(p=>p.id===this.editPatId?{...p,...data}:p);
      this.editPatId=null;
    } else {
      data.id=uid();ps.push(data);
    }
    S.set('patients',ps);M.close('patM');
    ['ptm_name','ptm_rel','ptm_cond','ptm_emg','ptm_ins'].forEach(f=>sv(f,''));
    sv('ptm_blood','');svDate('ptm_dob','');
    this.renderMedical();
  },
  openPatientModal(id){
    this.editPatId=id||null;
    document.getElementById('patMT').textContent=id?'✏️ Edit Patient':'👤 Add Patient / Family Member';
    if(id){
      const p=this.patients.find(x=>x.id===id);
      if(p){
        sv('ptm_name',p.name);sv('ptm_rel',p.relation||'');sv('ptm_blood',p.blood||'');
        sv('ptm_cond',p.cond||'');sv('ptm_emg',p.emg||'');sv('ptm_ins',p.ins||'');
        // handle dob — it might be text or ISO
        const dobIso=p.dob?(p.dob.includes('-')?p.dob:dmyToIso(p.dob)||''):'';
        svDate('ptm_dob',dobIso);
      }
    } else {
      ['ptm_name','ptm_rel','ptm_cond','ptm_emg','ptm_ins'].forEach(f=>sv(f,''));
      sv('ptm_blood','');svDate('ptm_dob','');
    }
    M.open('patM');
  },
  delPatient(id){
    this.delCb=()=>{S.set('patients',this.patients.filter(p=>p.id!==id));S.set('visits',this.visits.filter(r=>r.patId!==id));this.curPatient='all';this.renderMedical();};
    document.getElementById('delMsg').textContent='Delete patient and all records?';M.open('delM');
  },

  // Custom medical visit types
  _addCustomVisitType(){
    const name=prompt('Enter custom visit type name:','');
    if(!name||!name.trim()) return;
    let types; try{ types=JSON.parse(localStorage.getItem('rk_visit_types')||'[]'); }catch{ types=[]; }
    if(types.includes(name.trim())){alert('Already exists!');return;}
    types.push(name.trim());
    localStorage.setItem('rk_visit_types',JSON.stringify(types));
    this._loadVisitTypes(name.trim());
    this.showToastMsg('✅ Visit type "'+name.trim()+'" added!');
  },
  _loadVisitTypes(selectVal){
    const sel=document.getElementById('mdm_type');
    if(!sel) return;
    let custom; try{ custom=JSON.parse(localStorage.getItem('rk_visit_types')||'[]'); }catch{ custom=[]; }
    // Add custom types not already in list
    custom.forEach(t=>{
      if(!Array.from(sel.options).find(o=>o.value===t)){
        const opt=document.createElement('option');
        opt.value=t;opt.textContent=t;
        sel.appendChild(opt);
      }
    });
    if(selectVal) sel.value=selectVal;
  },

  openMedModal(id,patientId){
    this.editId=id||null;
    document.getElementById('medMT').textContent=id?'✏️ Edit Visit':'🏥 Add Doctor Visit';
    const ps=this.patients;
    document.getElementById('mdm_pat').innerHTML=ps.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    if(!ps.length){alert('Please add a patient first!');return;}
    if(id){
      const r=this.visits.find(x=>x.id===id);
      // Auto-fill patient
      document.getElementById('mdm_pat').value=r.patId||'';
      // Safe fill — try both field name variants (doctor / doc)
      ['type','spec','hosp','city','purpose','meds','vitals','labname','labdate','labres','notes'].forEach(f=>{
        try{sv('mdm_'+f,r[f]||'');}catch(e){}
      });
      // Doctor field: check both 'doc' and 'doctor'
      try{ sv('mdm_doc', r.doc||r.doctor||''); }catch(e){}
      svDate('mdm_date',r.date);
      // Fix: handle next date in both ISO and DD/MM/YYYY format
      if(r.next){
        const nd=r.next.includes('-')?r.next:dmyToIso(r.next);
        svDate('mdm_next',nd||r.next);
      } else { svDate('mdm_next',''); }
    } else {
      ['doc','spec','hosp','city','purpose','meds','vitals','labname','labdate','labres','notes'].forEach(f=>sv('mdm_'+f,''));
      svDate('mdm_date',(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})());
      svDate('mdm_next','');
      // Pre-select patient if coming from patient card
      if(patientId) document.getElementById('mdm_pat').value=patientId;
      else if(this.curPatient&&this.curPatient!=='all') document.getElementById('mdm_pat').value=this.curPatient;
    }
    // Init Firebase upload zones
    FUM.clear('fu_med_pres_wrap'); FUM.clear('fu_med_lab_wrap');
    FUM.init('fu_med_pres_wrap','medical',[]);
    FUM.init('fu_med_lab_wrap','medical',[]);
    if(id){
      const r=this.visits.find(x=>x.id===id);
      if(r.presFiles&&r.presFiles.length) FUM.init('fu_med_pres_wrap','medical',r.presFiles);
      else if(r.link) FUM.loadLegacyLinks('fu_med_pres_wrap',[r.link]);
      if(r.labFiles&&r.labFiles.length) FUM.init('fu_med_lab_wrap','medical',r.labFiles);
      else { const lls=[r.lablink,r.lablink2,r.lablink3].filter(Boolean); if(lls.length) FUM.loadLegacyLinks('fu_med_lab_wrap',lls); }
    }
    this._loadVisitTypes();
    M.open('medM');
  },
  saveMedRecord(){
    try {
      const pat=v('mdm_pat'),date=vDate('mdm_date')||v('mdm_date');
      if(!pat||!date){alert('Patient aur date zaroori hai!');return;}
      const nextRaw=vDate('mdm_next')||v('mdm_next');
      const nextIso=nextRaw?(nextRaw.includes('-')?nextRaw:(dmyToIso&&dmyToIso(nextRaw))||nextRaw):'';
      const presFiles=FUM.getFiles('fu_med_pres_wrap')||[];
      const labFiles=FUM.getFiles('fu_med_lab_wrap')||[];

      // Safe field read with fallback — fix doctor name disappearing
      const safeV=(id)=>{try{const el=document.getElementById(id);return el?el.value.trim():'';}catch(e){return '';}};

      const data={
        patId:pat,
        type:safeV('mdm_type'),
        doctor:safeV('mdm_doc'),      // ← explicit field name 'doctor'
        doc:safeV('mdm_doc'),         // ← keep both for legacy compat
        spec:safeV('mdm_spec'),
        hospital:safeV('mdm_hosp'),
        city:safeV('mdm_city'),
        date,
        next:nextIso,
        purpose:safeV('mdm_purpose'),
        meds:safeV('mdm_meds'),
        vitals:safeV('mdm_vitals'),
        labname:safeV('mdm_labname'),
        labdate:safeV('mdm_labdate'),
        labres:safeV('mdm_labres'),
        notes:safeV('mdm_notes'),
        presFiles,
        labFiles,
        link:(presFiles[0]||{}).url||'',
        lablink:(labFiles[0]||{}).url||'',
        lablink2:(labFiles[1]||{}).url||'',
        lablink3:(labFiles[2]||{}).url||''
      };

      // Safe merge: do NOT lose fields not in form
      let vs=this.visits;
      if(this.editId){
        vs=vs.map(r=>{
          if(r.id!==this.editId) return r;
          // Merge: existing fields preserved, new fields overwrite
          const merged={...r,...data};
          // Ensure doctor not lost — pick non-empty value
          if(!data.doctor&&r.doctor) merged.doctor=r.doctor;
          if(!data.doc&&r.doc) merged.doc=r.doc;
          return merged;
        });
      } else {
        data.id=uid();
        vs.push(data);
      }
      S.set('visits',vs);
      M.close('medM');
      this.renderMedical();
      this.renderPills();
      this.showToastMsg(this.editId?'✅ Medical record updated!':'✅ Medical record saved!');
    } catch(err) {
      console.error('saveMedRecord error:',err);
      alert('Save error: '+err.message);
    }
  },
  delVisit(id){
    this.delCb=()=>{S.set('visits',this.visits.filter(r=>r.id!==id));this.renderMedical();};
    document.getElementById('delMsg').textContent='Delete this medical record?';M.open('delM');
  },

  // ── Mark follow-up as complete — clears next date, keeps visit record ──
  _medCompleteFollowup(visitId){
    const v=this.visits.find(x=>x.id===visitId);
    if(!v) return;
    const patName=(this.patients.find(p=>p.id===v.patId)||{}).name||'Patient';
    const nextDate=v.next?` (${fD(v.next)})`:'';
    // Confirm
    if(!confirm(`Mark follow-up${nextDate} as DONE for ${patName}?\n\nThis will clear the follow-up date. The visit record stays.`)) return;
    const updated=this.visits.map(x=>x.id===visitId?{...x,next:'',next2:'',next3:'',followupDone:true,followupDoneAt:new Date().toISOString()}:x);
    S.set('visits',updated);
    this.renderMedical();
    this.renderPills();
    this.showToastMsg('✅ Follow-up marked done for '+patName+'!');
  },


  // ══ VITALS TRACKER ══
  getVitals(patId){ try{ return JSON.parse(localStorage.getItem('rk_vitals_'+patId)||'[]'); }catch{ return []; } },
  saveVitals(patId,arr){ localStorage.setItem('rk_vitals_'+patId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('vitals_'+patId,arr).catch(()=>{}); },

  openVitalsModal(patId){
    const pat=this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const vitals=this.getVitals(patId);
    const today=new Date().toISOString().split('T')[0];

    const renderModal=()=>{
      const vs=this.getVitals(patId);
      // Build mini SVG sparkline for each metric
      const metric=(label,key,unit,color)=>{
        const pts=vs.filter(v=>v[key]!==undefined&&v[key]!=='').map(v=>({d:v.date,v:parseFloat(v[key])})).filter(v=>!isNaN(v.v)).slice(-10);
        if(!pts.length) return '';
        const vals=pts.map(p=>p.v);
        const mn=Math.min(...vals),mx=Math.max(...vals);
        const W=160,H=40;
        const sx=i=>pts.length<2?W/2:Math.round(i*(W-10)/(pts.length-1))+5;
        const sy=v=>mx===mn?H/2:Math.round(H-((v-mn)/(mx-mn))*(H-8)-4);
        const path=pts.map((p,i)=>(i===0?'M':'L')+sx(i)+','+sy(p.v)).join(' ');
        const last=vals[vals.length-1];
        return `<div style="background:var(--card);border:1.5px solid ${color}30;border-radius:10px;padding:10px 12px;flex:1;min-width:140px;">
          <div style="font-size:.68rem;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${label}</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--txt);margin-bottom:4px;">${last} <span style="font-size:.65rem;font-weight:600;color:var(--mut);">${unit}</span></div>
          <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:36px;overflow:visible;">
            <polyline points="${pts.map((p,i)=>sx(i)+','+sy(p.v)).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${pts.map((p,i)=>`<circle cx="${sx(i)}" cy="${sy(p.v)}" r="3" fill="${color}"/>`).join('')}
          </svg>
          <div style="font-size:.58rem;color:var(--mut);margin-top:2px;">${pts.length} readings · Last: ${fD(pts[pts.length-1].d)}</div>
        </div>`;
      };

      const charts=[
        metric('BP (Systolic)','bp_sys','mmHg','#e05050'),
        metric('BP (Diastolic)','bp_dia','mmHg','#e09050'),
        metric('Sugar — Fasting','sugar_fast','mg/dL','#e09050'),
        metric('Sugar — After Meal','sugar_post','mg/dL','#c47c00'),
        metric('Weight','weight','kg','#2c6fad'),
        metric('Pulse','pulse','bpm','#1a7a45'),
        metric('SpO2','spo2','%','#5c3496'),
      ].filter(Boolean).join('');

      const rows=vs.slice().reverse().slice(0,20).map(v=>{
        const sugarDisp=v.sugar_fast||v.sugar_pre||v.sugar_post
          ?[v.sugar_fast?'F:'+v.sugar_fast:'',v.sugar_pre?'Bf:'+v.sugar_pre:'',v.sugar_post?'Af:'+v.sugar_post:''].filter(Boolean).join(' ')
          :(v.sugar||'—');
        const sugarColor=v.sugar_post&&Number(v.sugar_post)>200?'#c0392b':v.sugar_post&&Number(v.sugar_post)>140?'#c47c00':'inherit';
        return `<tr>
          <td style="font-size:.72rem;white-space:nowrap;">${fD(v.date)}${v.time?'<br><span style="font-size:.6rem;color:var(--mut);">⏰ '+v.time+'</span>':''}</td>
          <td class="mono" style="font-size:.72rem;">${v.bp_sys&&v.bp_dia?`<span style="color:${Number(v.bp_sys)>140?'#c0392b':'inherit'}">${v.bp_sys}/${v.bp_dia}</span>`:'—'}</td>
          <td class="mono" style="font-size:.7rem;color:${sugarColor};">${sugarDisp}</td>
          <td class="mono" style="font-size:.72rem;">${v.weight||'—'}</td>
          <td class="mono" style="font-size:.72rem;">${v.pulse||'—'}</td>
          <td class="mono" style="font-size:.72rem;">${v.spo2||'—'}</td>
          <td><button onclick="(function(){var arr=APP.getVitals('${patId}').filter(x=>x.id!=='${v.id}');APP.saveVitals('${patId}',arr);APP.openVitalsModal('${patId}');})()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;">🗑</button></td>
        </tr>`;}).join('');

      const body=document.getElementById('_vitBody');
      if(!body) return;
      body.innerHTML=`
        ${charts?`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">${charts}</div>`:''}
        <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
          <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">➕ Add New Reading</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:10px;">
            <div><label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Date</label>
              <input type="date" id="_vit_date" value="${today}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">⏰ Time</label>
              <input type="time" id="_vit_time" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:#e05050;display:block;margin-bottom:3px;">❤️ BP Systolic</label>
              <input type="number" id="_vit_bps" placeholder="120" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:#e09050;display:block;margin-bottom:3px;">❤️ BP Diastolic</label>
              <input type="number" id="_vit_bpd" placeholder="80" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div style="grid-column:span 2;background:#fff8ee;border:1.5px solid #e8a060;border-radius:8px;padding:8px 10px;">
              <label style="font-size:.68rem;font-weight:800;color:#b56a00;display:block;margin-bottom:6px;">🩸 Blood Sugar (mg/dL)</label>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
                <div><label style="font-size:.6rem;font-weight:700;color:#b56a00;display:block;margin-bottom:2px;">Fasting</label>
                  <input type="number" id="_vit_sug_fast" placeholder="90" style="width:100%;border:1.5px solid #e8a060;border-radius:5px;padding:4px 6px;font-family:Nunito,sans-serif;font-size:.78rem;background:#fff;"></div>
                <div><label style="font-size:.6rem;font-weight:700;color:#c47c00;display:block;margin-bottom:2px;">Before Meal</label>
                  <input type="number" id="_vit_sug_pre" placeholder="110" style="width:100%;border:1.5px solid #e8a060;border-radius:5px;padding:4px 6px;font-family:Nunito,sans-serif;font-size:.78rem;background:#fff;"></div>
                <div><label style="font-size:.6rem;font-weight:700;color:#e09050;display:block;margin-bottom:2px;">After Meal (2hr)</label>
                  <input type="number" id="_vit_sug_post" placeholder="140" style="width:100%;border:1.5px solid #e8a060;border-radius:5px;padding:4px 6px;font-family:Nunito,sans-serif;font-size:.78rem;background:#fff;"></div>
              </div>
            </div>
            <div><label style="font-size:.68rem;font-weight:700;color:#2c6fad;display:block;margin-bottom:3px;">⚖️ Weight (kg)</label>
              <input type="number" id="_vit_wt" placeholder="70" step="0.1" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:#1a7a45;display:block;margin-bottom:3px;">💓 Pulse (bpm)</label>
              <input type="number" id="_vit_pul" placeholder="72" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:#5c3496;display:block;margin-bottom:3px;">💨 SpO2 (%)</label>
              <input type="number" id="_vit_spo" placeholder="98" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
          </div>
          <button onclick="APP._saveVitalEntry('${patId}')" style="background:linear-gradient(135deg,#1a7a45,#2c6fad);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-family:Nunito,sans-serif;font-size:.85rem;font-weight:800;cursor:pointer;width:100%;letter-spacing:.01em;">💾 Save Reading</button>
        </div>
        ${vs.length?`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.78rem;">
          <thead><tr style="background:var(--card2);"><th style="padding:6px 8px;text-align:left;font-size:.62rem;color:var(--mut);text-transform:uppercase;">Date</th><th style="padding:6px 8px;font-size:.62rem;color:var(--mut);">BP</th><th style="padding:6px 8px;font-size:.62rem;color:#c47c00;">🩸 Sugar (F/Bf/Af)</th><th style="padding:6px 8px;font-size:.62rem;color:var(--mut);">Weight</th><th style="padding:6px 8px;font-size:.62rem;color:var(--mut);">Pulse</th><th style="padding:6px 8px;font-size:.62rem;color:var(--mut);">SpO2</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>`:'<div style="text-align:center;padding:20px;color:var(--mut);font-size:.83rem;">No readings yet — add your first reading above</div>'}
      `;
    };

    let modal=document.getElementById('_vitModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='_vitModal';
      modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
      modal.innerHTML=`<div style="width:100%;max-width:720px;background:#fff;border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;border-bottom:1px solid #e9ecef;flex-shrink:0;flex-wrap:wrap;gap:8px;">
          <div style="font-weight:800;font-size:1rem;">📊 Vitals — ${pat.name}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <button onclick="APP._vitDownloadPDF('${patId}')" style="background:#fff0f0;color:#c0392b;border:1.5px solid #f09090;border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;">📄 PDF</button>${APP._pdfOriHtml()}
            <button onclick="APP._vitDownloadWord('${patId}')" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;">📝 Word</button>
            <button onclick="APP._vitDownloadExcel('${patId}')" style="background:#e8f5e9;color:#2e7d32;border:1.5px solid #90c8a0;border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;">📊 Excel</button>
            <button onclick="document.getElementById('_vitModal').remove()" style="background:#f0f2f5;border:none;width:30px;height:30px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:#6c757d;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
        </div>
        <div id="_vitBody" style="overflow-y:auto;padding:14px 16px;flex:1;"></div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
    }
    renderModal();
    modal.style.display='flex';
  },

  _saveVitalEntry(patId){
    const get=id=>{ const el=document.getElementById(id); return el?el.value.trim():''; };
    const date=get('_vit_date');
    if(!date){ this.showToastMsg('⚠️ Date required!'); return; }
    const entry={
      id:'v'+Date.now(), date,
      time:get('_vit_time'),
      bp_sys:get('_vit_bps'), bp_dia:get('_vit_bpd'),
      sugar_fast:get('_vit_sug_fast'),
      sugar_pre:get('_vit_sug_pre'),
      sugar_post:get('_vit_sug_post'),
      // Legacy field — use first non-empty sugar value
      sugar:get('_vit_sug_fast')||get('_vit_sug_pre')||get('_vit_sug_post')||'',
      weight:get('_vit_wt'), pulse:get('_vit_pul'), spo2:get('_vit_spo')
    };
    if(!entry.bp_sys&&!entry.bp_dia&&!entry.sugar_fast&&!entry.sugar_pre&&!entry.sugar_post&&!entry.weight&&!entry.pulse&&!entry.spo2){
      this.showToastMsg('⚠️ Enter at least one value!'); return;
    }
    const arr=this.getVitals(patId);
    arr.push(entry);
    arr.sort((a,b)=>a.date.localeCompare(b.date));
    this.saveVitals(patId,arr);
    this.showToastMsg('✅ Vitals saved!');
    this.openVitalsModal(patId);
  },

  // ══ VITALS REPORT — PDF (Print) ══
  _vitDownloadPDF(patId){
    const pat=this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const vs=this.getVitals(patId).sort((a,b)=>a.date.localeCompare(b.date));
    if(!vs.length){ this.showToastMsg('⚠️ No vitals data to export!'); return; }

    // Build inline SVG charts for each metric
    const mkChart=(label,key1,key2,color1,color2,unit)=>{
      const pts1=vs.filter(v=>v[key1]!==undefined&&v[key1]!=='').map(v=>({d:v.date,v:parseFloat(v[key1])})).filter(v=>!isNaN(v.v));
      const pts2=key2?vs.filter(v=>v[key2]!==undefined&&v[key2]!=='').map(v=>({d:v.date,v:parseFloat(v[key2])})).filter(v=>!isNaN(v.v)):[];
      if(!pts1.length&&!pts2.length) return '';
      const allPts=[...pts1,...pts2];
      const allVals=allPts.map(p=>p.v);
      const mn=Math.min(...allVals)-5, mx=Math.max(...allVals)+5;
      const W=500,H=100,PAD=10;
      const allDates=[...new Set(vs.map(v=>v.date))].sort();
      const sx=d=>allDates.length<2?W/2:Math.round((allDates.indexOf(d))*(W-PAD*2)/(allDates.length-1))+PAD;
      const sy=v=>Math.round(H-((v-mn)/(mx-mn||1))*(H-PAD*2)-PAD);
      const line=(pts,col)=>pts.length<1?'':
        `<polyline points="${pts.map(p=>sx(p.d)+','+sy(p.v)).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
         ${pts.map(p=>`<circle cx="${sx(p.d)}" cy="${sy(p.v)}" r="4" fill="${col}" stroke="white" stroke-width="1.5"/>
           <text x="${sx(p.d)}" y="${sy(p.v)-8}" text-anchor="middle" font-size="10" fill="${col}" font-family="Arial">${p.v}</text>`).join('')}`;
      // x-axis date labels (show every nth)
      const step=Math.max(1,Math.floor(allDates.length/6));
      const xLabels=allDates.filter((_,i)=>i%step===0||i===allDates.length-1)
        .map(d=>`<text x="${sx(d)}" y="${H+18}" text-anchor="middle" font-size="9" fill="#888" font-family="Arial">${fD(d)}</text>`).join('');
      return `<div style="margin-bottom:18px;">
        <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:4px;">${label} (${unit})</div>
        <svg viewBox="0 0 ${W} ${H+25}" style="width:100%;max-width:600px;height:120px;border:1px solid #e9ecef;border-radius:6px;background:#fafafa;overflow:visible;">
          <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#e9ecef" stroke-width="1"/>
          ${line(pts1,color1)}${line(pts2,color2||'')}${xLabels}
        </svg>
        ${key2?`<div style="display:flex;gap:14px;font-size:11px;margin-top:3px;"><span style="color:${color1};">● ${key1.replace('_',' ').replace('bp sys','Systolic').replace('sugar fast','Fasting')}</span><span style="color:${color2};">● ${key2.replace('_',' ').replace('bp dia','Diastolic').replace('sugar post','After Meal')}</span></div>`:''}
      </div>`;
    };

    const tableRows=vs.slice().reverse().map(v=>{
      const sugarDisp=[v.sugar_fast?'F:'+v.sugar_fast:'',v.sugar_pre?'Bf:'+v.sugar_pre:'',v.sugar_post?'Af:'+v.sugar_post:''].filter(Boolean).join(' ')||(v.sugar||'—');
      const bpColor=v.bp_sys&&Number(v.bp_sys)>140?'color:#c0392b':'';
      const sgColor=v.sugar_post&&Number(v.sugar_post)>140?'color:#c47c00':'';
      return `<tr>
        <td style="padding:6px 8px;font-size:12px;white-space:nowrap;border-bottom:1px solid #f0f0f0;">${fD(v.date)}${v.time?'<br><span style="font-size:10px;color:#888;">'+v.time+'</span>':''}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;${bpColor};border-bottom:1px solid #f0f0f0;">${v.bp_sys&&v.bp_dia?v.bp_sys+'/'+v.bp_dia:'—'}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;${sgColor};border-bottom:1px solid #f0f0f0;">${sugarDisp}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;border-bottom:1px solid #f0f0f0;">${v.weight||'—'}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;border-bottom:1px solid #f0f0f0;">${v.pulse||'—'}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;border-bottom:1px solid #f0f0f0;">${v.spo2||'—'}</td>
      </tr>`;
    }).join('');

    // Latest reading summary
    const latest=vs[vs.length-1]||{};
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Vitals Report — ${pat.name}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;background:#fff;color:#1a1d23;padding:16mm 14mm;max-width:800px;margin:0 auto;}
      .header{border-bottom:3px solid #2c6fad;padding-bottom:16px;margin-bottom:20px;}
      .title{font-size:24px;font-weight:700;color:#1a3a6e;}
      .sub{font-size:13px;color:#6c757d;margin-top:4px;}
      .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;}
      .info-box{background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:10px 12px;}
      .info-box .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6c757d;font-weight:700;}
      .info-box .val{font-size:16px;font-weight:700;color:#1a1d23;margin-top:3px;}
      .section-title{font-size:15px;font-weight:700;color:#1a3a6e;margin:20px 0 10px;padding-bottom:6px;border-bottom:1.5px solid #e9ecef;}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      thead tr{background:#f0f7ff;}
      th{padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#2c6fad;font-weight:700;}
      td{padding:6px 10px;font-size:12px;}
      .footer{margin-top:30px;padding-top:14px;border-top:1px dashed #dee2e6;font-size:11px;color:#888;text-align:center;}
      @media print{@page{margin:16mm 14mm;}body{padding:0;}}
    </style></head><body>
    <div class="header">
      <div class="title">🏥 Vitals Health Report</div>
      <div class="sub">Patient: <b>${pat.name}</b> | Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} | Total Readings: ${vs.length}</div>
      ${pat.blood||pat.cond?`<div class="sub" style="margin-top:4px;">Blood Group: <b>${pat.blood||'—'}</b>${pat.cond?' | Condition: <b>'+pat.cond+'</b>':''}</div>`:''}
    </div>

    <div class="info-grid">
      <div class="info-box"><div class="lbl">Latest BP</div><div class="val" style="color:${latest.bp_sys&&Number(latest.bp_sys)>140?'#c0392b':'#1a7a45'};">${latest.bp_sys&&latest.bp_dia?latest.bp_sys+'/'+latest.bp_dia+' mmHg':'—'}</div></div>
      <div class="info-box"><div class="lbl">Latest Sugar (Fasting)</div><div class="val" style="color:#c47c00;">${latest.sugar_fast?latest.sugar_fast+' mg/dL':(latest.sugar?latest.sugar+' mg/dL':'—')}</div></div>
      <div class="info-box"><div class="lbl">Latest Weight</div><div class="val">${latest.weight?latest.weight+' kg':'—'}</div></div>
      <div class="info-box"><div class="lbl">Latest Pulse</div><div class="val">${latest.pulse?latest.pulse+' bpm':'—'}</div></div>
      <div class="info-box"><div class="lbl">Latest SpO2</div><div class="val" style="color:#5c3496;">${latest.spo2?latest.spo2+'%':'—'}</div></div>
      <div class="info-box"><div class="lbl">Last Recorded</div><div class="val" style="font-size:13px;">${fD(latest.date)||'—'}</div></div>
    </div>

    <div class="section-title">📈 Trend Charts</div>
    ${mkChart('Blood Pressure','bp_sys','bp_dia','#e05050','#e09050','mmHg')}
    ${mkChart('Blood Sugar','sugar_fast','sugar_post','#c47c00','#e09050','mg/dL')}
    ${mkChart('Weight','weight',null,'#2c6fad',null,'kg')}
    ${mkChart('Pulse','pulse',null,'#1a7a45',null,'bpm')}

    <div class="section-title">📋 All Readings</div>
    <table>
      <thead><tr><th>Date / Time</th><th>BP (Sys/Dia)</th><th>Sugar (F/Bf/Af)</th><th>Weight</th><th>Pulse</th><th>SpO2</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <div style="background:#fff8ee;border:1px solid #e8a060;border-radius:8px;padding:12px 14px;font-size:11px;color:#7a4400;margin-bottom:20px;">
      <b>Reference Ranges:</b> BP Normal: &lt;120/80 mmHg · High: &gt;140/90 mmHg | Sugar Fasting: 70-100 mg/dL · After Meal: &lt;140 mg/dL | SpO2 Normal: 95-100%
    </div>

    <div class="footer">Raman Kumar — Personal Health Dashboard · Report generated on ${new Date().toLocaleString('en-IN')}</div>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>`;

    // Build PDF using jsPDF
    const vitCols=['Date / Time','BP (Sys/Dia)','Sugar (F/Bf/Af)','Weight','Pulse','SpO2'];
    const vitRows=vs.slice().reverse().map(v=>{
      const sugarDisp=[v.sugar_fast?'F:'+v.sugar_fast:'',v.sugar_pre?'Bf:'+v.sugar_pre:'',v.sugar_post?'Af:'+v.sugar_post:''].filter(Boolean).join(' ')||(v.sugar||'—');
      return [fD(v.date)+(v.time?' '+v.time:''), v.bp_sys&&v.bp_dia?v.bp_sys+'/'+v.bp_dia+' mmHg':'—', sugarDisp, v.weight?v.weight+' kg':'—', v.pulse?v.pulse+' bpm':'—', v.spo2?v.spo2+'%':'—'];
    });
    const vitLatest=vs[vs.length-1]||{};
    _makePDF({
      filename: 'Health_Report_'+pat.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: 'Vitals Health Report',
      subtitle: 'Patient: '+pat.name+' | Total Readings: '+vs.length,
      badge: pat.name+(pat.blood?' | Blood: '+pat.blood:'')+(pat.cond?' | '+pat.cond:''),
      summaryRows: [
        ['BP', vitLatest.bp_sys&&vitLatest.bp_dia?vitLatest.bp_sys+'/'+vitLatest.bp_dia:' — ', [44,111,173]],
        ['Sugar (F)', vitLatest.sugar_fast?vitLatest.sugar_fast+' mg/dL':'—', [181,112,28]],
        ['Weight', vitLatest.weight?vitLatest.weight+' kg':'—', [26,122,69]],
        ['Pulse', vitLatest.pulse?vitLatest.pulse+' bpm':'—', [192,57,43]],
      ],
      entriesLabel: 'Total Readings: '+vs.length+' | Generated: '+fD(new Date().toISOString().slice(0,10)),
      columns: vitCols,
      rows: vitRows,
      colStyles: {0:{cellWidth:28}},
      headerColor: [44,111,173],
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  // ══ VITALS REPORT — Word (.doc) ══
  _vitDownloadWord(patId){
    const pat=this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const vs=this.getVitals(patId).sort((a,b)=>a.date.localeCompare(b.date));
    if(!vs.length){ this.showToastMsg('⚠️ No vitals data to export!'); return; }
    const latest=vs[vs.length-1]||{};
    const rows=vs.slice().reverse().map(v=>{
      const sugarDisp=[v.sugar_fast?'F:'+v.sugar_fast:'',v.sugar_pre?'Bf:'+v.sugar_pre:'',v.sugar_post?'Af:'+v.sugar_post:''].filter(Boolean).join(' ')||(v.sugar||'—');
      return `<tr>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${fD(v.date)}${v.time?' '+v.time:''}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${v.bp_sys&&v.bp_dia?v.bp_sys+'/'+v.bp_dia:'—'}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${sugarDisp}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${v.weight||'—'}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${v.pulse||'—'}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${v.spo2||'—'}</td>
      </tr>`;
    }).join('');

    const html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
    <head><meta charset="UTF-8"><title>Vitals Report</title>
    <style>
      body{font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:2cm;}
      h1{color:#1a3a6e;font-size:18pt;border-bottom:2pt solid #2c6fad;padding-bottom:6pt;}
      h2{color:#2c6fad;font-size:13pt;margin-top:14pt;}
      table{border-collapse:collapse;width:100%;margin:10pt 0;}
      th{background:#2c6fad;color:white;padding:6pt 8pt;font-size:10pt;text-align:left;}
      td{border:1pt solid #dee2e6;padding:5pt 8pt;font-size:10pt;}
      tr:nth-child(even) td{background:#f8f9fa;}
      .summary{background:#f0f7ff;border:1pt solid #90b8e8;padding:8pt;border-radius:4pt;margin:10pt 0;}
    </style></head><body>
    <h1>🏥 Vitals Health Report — ${pat.name}</h1>
    <p style="color:#6c757d;font-size:10pt;">Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} | Total Readings: ${vs.length}</p>
    ${pat.blood||pat.cond?`<p style="font-size:10pt;"><b>Blood Group:</b> ${pat.blood||'—'} ${pat.cond?'| <b>Condition:</b> '+pat.cond:''}</p>`:''}

    <h2>📊 Latest Reading Summary</h2>
    <div class="summary">
      <table><tr>
        <td><b>BP:</b> ${latest.bp_sys&&latest.bp_dia?latest.bp_sys+'/'+latest.bp_dia+' mmHg':'—'}</td>
        <td><b>Sugar (Fasting):</b> ${latest.sugar_fast?latest.sugar_fast+' mg/dL':'—'}</td>
        <td><b>After Meal:</b> ${latest.sugar_post?latest.sugar_post+' mg/dL':'—'}</td>
        <td><b>Weight:</b> ${latest.weight?latest.weight+' kg':'—'}</td>
        <td><b>Pulse:</b> ${latest.pulse?latest.pulse+' bpm':'—'}</td>
        <td><b>SpO2:</b> ${latest.spo2?latest.spo2+'%':'—'}</td>
      </tr></table>
    </div>

    <h2>📋 Complete Vitals History</h2>
    <table>
      <thead><tr><th>Date / Time</th><th>BP (Sys/Dia)</th><th>Sugar (F/Bf/Af)</th><th>Weight (kg)</th><th>Pulse (bpm)</th><th>SpO2 (%)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="font-size:9pt;color:#888;border-top:1pt solid #dee2e6;padding-top:8pt;margin-top:16pt;">
      Reference: BP Normal &lt;120/80 | Fasting Sugar 70-100 mg/dL | After Meal &lt;140 mg/dL | SpO2 95-100%<br>
      Raman Kumar — Personal Health Dashboard
    </p>
    </body></html>`;

    const _vitBlob=new Blob(['\uFEFF'+html],{type:'application/msword'});
    const _vitA=document.createElement('a');
    _vitA.href=URL.createObjectURL(_vitBlob);
    _vitA.download='Vitals_'+pat.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(_vitA);_vitA.click();document.body.removeChild(_vitA);
    URL.revokeObjectURL(_vitA.href);
    this.showToastMsg('✅ Word file downloaded!');
  },

  // ══ VITALS REPORT — Excel (.xlsx via CSV) ══
  _vitDownloadExcel(patId){
    const pat=this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const vs=this.getVitals(patId).sort((a,b)=>a.date.localeCompare(b.date));
    if(!vs.length){ this.showToastMsg('⚠️ No vitals data to export!'); return; }

    // Build multi-sheet CSV (simulate with one sheet + blank separator)
    const esc=v=>`"${String(v||'').replace(/"/g,'""')}"`;
    const hdr=['Date','Time','BP Systolic (mmHg)','BP Diastolic (mmHg)','Sugar Fasting (mg/dL)','Sugar Before Meal (mg/dL)','Sugar After Meal (mg/dL)','Weight (kg)','Pulse (bpm)','SpO2 (%)'];
    const dataRows=vs.map(v=>[
      fD(v.date), v.time||'',
      v.bp_sys||'', v.bp_dia||'',
      v.sugar_fast||'', v.sugar_pre||'', v.sugar_post||'',
      v.weight||'', v.pulse||'', v.spo2||''
    ].map(esc).join(','));

    // Summary section at top
    const latest=vs[vs.length-1]||{};
    const summary=[
      `"VITALS REPORT — ${pat.name}"`,
      `"Generated: ${todayDMY()}"`,
      `"Total Readings: ${vs.length}"`,
      `"Blood Group: ${pat.blood||'—'}"`,
      '',
      '"LATEST READING"',
      `"BP: ${latest.bp_sys&&latest.bp_dia?latest.bp_sys+'/'+latest.bp_dia+' mmHg':'—'}","Sugar Fasting: ${latest.sugar_fast||'—'} mg/dL","After Meal: ${latest.sugar_post||'—'} mg/dL","Weight: ${latest.weight||'—'} kg","Pulse: ${latest.pulse||'—'} bpm","SpO2: ${latest.spo2||'—'}%"`,
      '',
      '"ALL READINGS"',
      hdr.map(h=>`"${h}"`).join(','),
      ...dataRows,
      '',
      '"Reference Ranges:"',
      '"BP Normal","<120/80 mmHg"',
      '"Sugar Fasting","70-100 mg/dL"',
      '"Sugar After Meal","<140 mg/dL"',
      '"SpO2","95-100%"',
    ].join('\n');

    const blob=new Blob(['\ufeff'+summary],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`Vitals_${pat.name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ Excel/CSV downloaded! Open with Excel.');
  },

  // ════════════════════════════════════════════════════════════════
  // MEDICINE DAILY SCHEDULE
  // localStorage: rk_medschedule_{patId}
  // Each medicine: {id, name, dose, times:['morning','afternoon','night'],
  //                 startDate, endDate, notes, active}
  // ════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════
  // MEDICINE REMINDER — PROFESSIONAL SYSTEM
  // Storage:
  //   rk_medsched_{patId}  → medicine list with exact times
  //   rk_medlog_{patId}    → daily taken/skipped/snoozed log
  // ════════════════════════════════════════════════════════════════
  _getMedSchedule(patId){ try{ return JSON.parse(localStorage.getItem('rk_medsched_'+patId)||'[]'); }catch{ return []; } },
  _saveMedSchedule(patId,arr){ localStorage.setItem('rk_medsched_'+patId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('medsched_'+patId,arr).catch(()=>{}); },
  _getMedLog(patId){ try{ return JSON.parse(localStorage.getItem('rk_medlog_'+patId)||'{}'); }catch{ return {}; } },
  _saveMedLog(patId,obj){ localStorage.setItem('rk_medlog_'+patId,JSON.stringify(obj)); if(window.fbSave) window.fbSave('medlog_'+patId,obj).catch(()=>{}); },

  // Log key: "YYYY-MM-DD_medId_slotTime" → {status:'taken'|'skipped'|'snoozed', ts, snoozeUntil}
  _medLogKey(date, medId, slot){ return date+'_'+medId+'_'+slot; },

  _markMedStatus(patId, medId, slot, status, snoozeMin){
    const today = new Date().toISOString().split('T')[0];
    const log = this._getMedLog(patId);
    const key = this._medLogKey(today, medId, slot);
    const entry = { status, ts: new Date().toISOString() };
    if(status==='snoozed' && snoozeMin){
      entry.snoozeUntil = new Date(Date.now() + snoozeMin*60000).toISOString();
      entry.snoozeMin = snoozeMin;
      // Schedule browser notification after snooze
      this._schedMedSnoozeNotif(patId, medId, slot, snoozeMin);
    }
    log[key] = entry;
    this._saveMedLog(patId, log);
    this.openMedSchedule(patId);
    // Refresh snooze popup if open
    const sp = document.getElementById('_medSnoozePopup');
    if(sp) sp.remove();
  },

  _getMedStatusToday(patId, medId, slot){
    const today = new Date().toISOString().split('T')[0];
    const log = this._getMedLog(patId);
    return log[this._medLogKey(today, medId, slot)] || null;
  },

  _schedMedSnoozeNotif(patId, medId, slot, mins){
    if(typeof Notification === 'undefined') return;
    const med = this._getMedSchedule(patId).find(m=>m.id===medId);
    if(!med) return;
    if(!this._medSnoozeTimers) this._medSnoozeTimers = {};
    const key = patId+'_'+medId+'_'+slot;
    clearTimeout(this._medSnoozeTimers[key]);
    this._medSnoozeTimers[key] = setTimeout(()=>{
      // Check if still snoozed (not taken since)
      const entry = this._getMedStatusToday(patId, medId, slot);
      if(entry && entry.status==='snoozed'){
        // Show popup
        this._showMedReminderPopup(patId, medId, slot);
        // Browser notification if permission granted
        if(Notification.permission==='granted'){
          try{
            new Notification('💊 Medicine Reminder', {
              body: med.name + (med.dose?' — '+med.dose:'') + '\nTime to take your medicine!',
              tag:'med-'+key
            });
          }catch(e){}
        }
      }
    }, mins*60000);
  },

  _showMedReminderPopup(patId, medId, slot){
    const med = this._getMedSchedule(patId).find(m=>m.id===medId);
    if(!med) return;
    const pat = this.patients.find(p=>p.id===patId);
    const old = document.getElementById('_medSnoozePopup'); if(old) old.remove();
    const popup = document.createElement('div');
    popup.id = '_medSnoozePopup';
    popup.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:19999;width:calc(100% - 32px);max-width:380px;';
    popup.innerHTML = `<div style="background:var(--card);border:2px solid #1565c0;border-radius:16px;padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:42px;height:42px;background:#e3f2fd;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">💊</div>
        <div style="flex:1;">
          <div style="font-weight:800;font-size:.95rem;color:var(--txt);">${med.name}</div>
          <div style="font-size:.72rem;color:var(--mut);">${med.dose||''} · ${slot} · ${pat?pat.name:''}</div>
          ${med.note?`<div style="font-size:.7rem;color:#1565c0;margin-top:2px;">📝 ${med.note}</div>`:''}
        </div>
        <button onclick="document.getElementById('_medSnoozePopup').remove()" style="background:var(--dim);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:.9rem;color:var(--mut);flex-shrink:0;">✕</button>
      </div>
      <div style="font-size:.78rem;font-weight:700;color:var(--mut);margin-bottom:8px;">⏰ What would you like to do?</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px;">
        <button onclick="APP._markMedStatus('${patId}','${medId}','${slot}','taken');document.getElementById('_medSnoozePopup').remove();" 
          style="flex:1;background:#1a7a45;color:#fff;border:none;border-radius:10px;padding:10px 8px;font-size:.82rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">
          ✅ Taken
        </button>
        <button onclick="APP._markMedStatus('${patId}','${medId}','${slot}','skipped');document.getElementById('_medSnoozePopup').remove();" 
          style="flex:1;background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:10px;padding:10px 8px;font-size:.82rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">
          ✗ Skip
        </button>
      </div>
      <div style="font-size:.72rem;font-weight:700;color:var(--mut);margin-bottom:6px;">⏱ Snooze for:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${[5,10,15,30,60].map(m=>`
          <button onclick="APP._markMedStatus('${patId}','${medId}','${slot}','snoozed',${m});" 
            style="flex:1;min-width:40px;background:var(--dim);border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 4px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;color:var(--txt);">
            ${m}m
          </button>`).join('')}
        <button onclick="APP._showCustomSnooze('${patId}','${medId}','${slot}')" 
          style="flex:1;min-width:40px;background:var(--dim);border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 4px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;color:var(--acc);">
          Custom
        </button>
      </div>
    </div>`;
    document.body.appendChild(popup);
  },

  _showCustomSnooze(patId, medId, slot){
    const inp = prompt('Snooze for how many minutes?', '20');
    const mins = parseInt(inp);
    if(!mins||mins<1||mins>480){ this.showToastMsg('⚠️ 1–480 minutes only'); return; }
    this._markMedStatus(patId, medId, slot, 'snoozed', mins);
  },

  // ── Med adherence stats (last 7 days) ──
  _medAdherence(patId, medId){
    const log = this._getMedLog(patId);
    const med = this._getMedSchedule(patId).find(m=>m.id===medId);
    if(!med) return null;
    let taken=0, total=0;
    for(let i=0;i<7;i++){
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.toISOString().split('T')[0];
      (med.times||[]).forEach(slot=>{
        total++;
        const e = log[this._medLogKey(ds, medId, slot)];
        if(e && e.status==='taken') taken++;
      });
    }
    return total>0 ? Math.round((taken/total)*100) : null;
  },

  openMedSchedule(patId){
    const pat = this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const TIMES = ['Morning','Afternoon','Evening','Night'];
    const TIME_ICONS = {Morning:'🌅',Afternoon:'☀️',Evening:'🌆',Night:'🌙'};
    // Default clock times for each slot
    const SLOT_TIMES = {Morning:'08:00',Afternoon:'13:00',Evening:'17:00',Night:'21:00'};

    const render = () => {
      const meds = this._getMedSchedule(patId);
      const active = meds.filter(m=>m.active!==false);
      const inactive = meds.filter(m=>m.active===false);
      const body = document.getElementById('_medSchedBody');
      if(!body) return;

      // ── Today's schedule with taken/skip/snooze status ──
      const todaySched = TIMES.map(t=>({
        time:t, icon:TIME_ICONS[t], clockTime:SLOT_TIMES[t],
        meds: active.filter(m=>m.times&&m.times.includes(t))
      })).filter(s=>s.meds.length>0);

      // ── Adherence summary (last 7 days) ──
      const totalSlots = active.reduce((s,m)=>s+(m.times||[]).length,0);
      const allTaken = active.reduce((s,m)=>{
        (m.times||[]).forEach(slot=>{
          const e=this._getMedStatusToday(patId,m.id,slot);
          if(e&&e.status==='taken') s++;
        });
        return s;
      },0);
      const totalToday = active.reduce((s,m)=>s+(m.times||[]).length,0);
      const takenPct = totalToday>0?Math.round((allTaken/totalToday)*100):0;

      body.innerHTML = `
        <!-- Today Summary Bar -->
        ${active.length ? `
        <div style="background:${takenPct===100?'#e8f5e9':takenPct>50?'#fff8ee':'#fff0f0'};border:1.5px solid ${takenPct===100?'#90c8a0':takenPct>50?'#e8a060':'#f09090'};border-radius:12px;padding:12px 14px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div style="font-weight:800;font-size:.85rem;">📅 Today's Progress</div>
            <div style="font-size:.85rem;font-weight:900;color:${takenPct===100?'#1a7a45':takenPct>50?'#b56a00':'#991b1b'};">${allTaken}/${totalToday} taken</div>
          </div>
          <div style="height:8px;background:var(--dim);border-radius:4px;overflow:hidden;">
            <div style="width:${takenPct}%;height:100%;background:${takenPct===100?'#1a7a45':takenPct>50?'#e8a060':'#ef4444'};border-radius:4px;transition:width .4s;"></div>
          </div>
          ${takenPct===100?`<div style="font-size:.72rem;color:#1a7a45;margin-top:4px;font-weight:700;">🎉 All medicines taken today!</div>`:
            `<div style="font-size:.72rem;color:var(--mut);margin-top:4px;">${totalToday-allTaken} remaining for today</div>`}
        </div>` : ''}

        <!-- Today's schedule slot-wise with action buttons -->
        ${todaySched.length ? `
        <div style="margin-bottom:14px;">
          <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">⏰ Today's Schedule</div>
          ${todaySched.map(s=>`
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;margin-bottom:10px;overflow:hidden;">
              <!-- Slot header -->
              <div style="background:var(--card2);padding:8px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bdr);">
                <div style="font-size:.78rem;font-weight:800;color:var(--txt);">${s.icon} ${s.time}</div>
                <div style="font-size:.7rem;color:var(--mut);">🕐 ${s.clockTime}</div>
              </div>
              <!-- Medicines in this slot -->
              ${s.meds.map(m=>{
                const st = this._getMedStatusToday(patId, m.id, s.time);
                const status = st ? st.status : 'pending';
                const isSnoozed = status==='snoozed' && st.snoozeUntil && new Date(st.snoozeUntil)>now;
                const snoozeLeft = isSnoozed ? Math.ceil((new Date(st.snoozeUntil)-now)/60000) : 0;
                const adh = this._medAdherence(patId, m.id);

                return `<div style="padding:10px 14px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:10px;">
                  <!-- Medicine info -->
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <div style="background:${m.color||'#e3f2fd'};border:1.5px solid ${m.borderColor||'#90b8e8'};border-radius:6px;padding:3px 8px;font-size:.78rem;font-weight:700;">${m.name}</div>
                      ${m.dose?`<span style="font-size:.7rem;color:var(--mut);">${m.dose}</span>`:''}
                    </div>
                    ${m.note?`<div style="font-size:.68rem;color:var(--mut);margin-top:2px;">📝 ${m.note}</div>`:''}
                    ${adh!==null?`<div style="font-size:.65rem;color:${adh>=80?'#1a7a45':adh>=50?'#b56a00':'#991b1b'};margin-top:2px;">📊 7d adherence: ${adh}%</div>`:''}
                    ${isSnoozed?`<div style="font-size:.65rem;color:#1565c0;font-weight:700;margin-top:2px;">⏱ Snoozed — rings in ${snoozeLeft} min</div>`:''}
                  </div>
                  <!-- Action buttons -->
                  <div style="display:flex;gap:5px;flex-shrink:0;">
                    ${status==='taken' ? `
                      <div style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;border-radius:8px;padding:6px 10px;font-size:.72rem;font-weight:800;">✅ Taken</div>
                      <button onclick="APP._markMedStatus('${patId}','${m.id}','${s.time}','pending')" style="background:var(--dim);border:none;border-radius:6px;padding:5px 8px;font-size:.68rem;cursor:pointer;color:var(--mut);" title="Undo">↩</button>
                    ` : status==='skipped' ? `
                      <div style="background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:8px;padding:6px 10px;font-size:.72rem;font-weight:800;">✗ Skipped</div>
                      <button onclick="APP._markMedStatus('${patId}','${m.id}','${s.time}','pending')" style="background:var(--dim);border:none;border-radius:6px;padding:5px 8px;font-size:.68rem;cursor:pointer;color:var(--mut);" title="Undo">↩</button>
                    ` : `
                      <button onclick="APP._markMedStatus('${patId}','${m.id}','${s.time}','taken')"
                        style="background:#1a7a45;color:#fff;border:none;border-radius:8px;padding:7px 10px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">✅ Taken</button>
                      <button onclick="APP._showMedReminderPopup('${patId}','${m.id}','${s.time}')"
                        style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;border-radius:8px;padding:7px 10px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">⏰ Snooze</button>
                      <button onclick="APP._markMedStatus('${patId}','${m.id}','${s.time}','skipped')"
                        style="background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:8px;padding:7px 8px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">✗ Skip</button>
                    `}
                  </div>
                </div>`;
              }).join('')}
            </div>`).join('')}
        </div>` : ''}

        <!-- Add medicine form -->
        <details ${active.length?'':'open'}>
          <summary style="font-weight:800;font-size:.88rem;cursor:pointer;padding:8px 0;display:flex;align-items:center;gap:6px;list-style:none;">
            <span style="background:var(--acc);color:#fff;border-radius:6px;padding:2px 8px;font-size:.7rem;">＋</span>
            Add New Medicine
          </summary>
          <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:12px;padding:12px 14px;margin-top:8px;margin-bottom:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💊 Medicine Name *</label>
                <input id="_ms_name" placeholder="e.g. Amlodipine 5mg" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📏 Dose</label>
                <input id="_ms_dose" placeholder="e.g. 1 tablet, 5ml" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Start Date</label>
                <input id="_ms_start" type="date" value="${today}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 End Date <span style="font-size:.6rem;">(optional)</span></label>
                <input id="_ms_end" type="date" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
            </div>
            <!-- Time slots with clock input -->
            <div style="margin-bottom:8px;">
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:6px;">⏰ When to Take — select time slot + set clock time</label>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${TIMES.map(t=>`
                  <div style="display:flex;align-items:center;gap:8px;background:var(--dim);border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;">
                    <input type="checkbox" id="_ms_t_${t.toLowerCase()}" value="${t}" style="width:15px;height:15px;accent-color:var(--acc);flex-shrink:0;"
                      onchange="(function(el){var tr=document.getElementById('_ms_time_${t.toLowerCase()}');if(tr)tr.style.opacity=el.checked?'1':'0.4';})(this)">
                    <span style="font-size:.82rem;font-weight:700;flex:1;">${TIME_ICONS[t]} ${t}</span>
                    <input type="time" id="_ms_time_${t.toLowerCase()}" value="${SLOT_TIMES[t]}" 
                      style="border:1.5px solid var(--bdr2);border-radius:6px;padding:4px 7px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);opacity:0.4;width:100px;">
                  </div>`).join('')}
              </div>
            </div>
            <!-- Refill alert -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💊 Total Tablets/Units</label>
                <input id="_ms_stock" type="number" placeholder="e.g. 30" min="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🔔 Refill Alert at</label>
                <input id="_ms_refill" type="number" placeholder="e.g. 5 (when 5 left)" min="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
            </div>
            <input id="_ms_note" placeholder="📝 Notes (e.g. After food, With water, etc.)" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);margin-bottom:8px;">
            <button onclick="APP._saveMedEntry('${patId}')" style="width:100%;background:#1565c0;color:#fff;border:none;border-radius:8px;padding:10px;font-family:Nunito,sans-serif;font-size:.88rem;font-weight:800;cursor:pointer;">💾 Add to Schedule</button>
          </div>
        </details>

        <!-- Active medicines list with adherence + refill -->
        ${active.length ? `
        <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">💊 All Medicines (${active.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
          ${active.map(m=>{
            const adh = this._medAdherence(patId, m.id);
            const stock = Number(m.stock||0);
            const refill = Number(m.refill||0);
            const needsRefill = stock>0 && refill>0 && stock<=refill;
            return `<div style="background:var(--card);border:1.5px solid ${needsRefill?'#f48fb1':'var(--bdr)'};border-radius:10px;padding:10px 12px;">
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="background:${m.color||'#e3f2fd'};border-radius:8px;padding:6px 8px;font-size:.7rem;font-weight:800;color:#1565c0;text-align:center;flex-shrink:0;">💊</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:800;font-size:.88rem;">${m.name} ${needsRefill?'<span style="background:#fce4ec;color:#c62828;font-size:.62rem;padding:1px 7px;border-radius:4px;font-weight:800;">⚠️ Refill Needed</span>':''}</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:.7rem;color:var(--mut);margin-top:3px;">
                    ${m.dose?`<span>📏 ${m.dose}</span>`:''}
                    ${m.times&&m.times.length?`<span>⏰ ${m.times.map(t=>TIME_ICONS[t]+' '+t+(m.slotTimes&&m.slotTimes[t]?' at '+m.slotTimes[t]:'')).join(' · ')}</span>`:''}
                    ${m.startDate?`<span>📅 From ${fD(m.startDate)}</span>`:''}
                    ${m.endDate?`<span>Until ${fD(m.endDate)}</span>`:''}
                    ${stock>0?`<span style="color:${needsRefill?'#c62828':'var(--mut)'};">💊 ${stock} left</span>`:''}
                  </div>
                  ${m.note?`<div style="font-size:.7rem;color:var(--mut);margin-top:2px;">📝 ${m.note}</div>`:''}
                  ${adh!==null?`
                  <div style="margin-top:5px;">
                    <div style="font-size:.62rem;color:var(--mut);margin-bottom:2px;">7-day adherence: ${adh}%</div>
                    <div style="height:4px;background:var(--dim);border-radius:2px;overflow:hidden;width:100px;">
                      <div style="width:${adh}%;height:100%;background:${adh>=80?'#1a7a45':adh>=50?'#e8a060':'#ef4444'};border-radius:2px;"></div>
                    </div>
                  </div>`:''}
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0;">
                  <button onclick="(function(){var arr=APP._getMedSchedule('${patId}');var i=arr.findIndex(x=>x.id==='${m.id}');if(i>=0)arr[i].active=false;APP._saveMedSchedule('${patId}',arr);APP.openMedSchedule('${patId}');})()" 
                    style="background:#fff8ee;border:1px solid #e8a060;color:#b56a00;border-radius:5px;padding:3px 8px;font-size:.68rem;cursor:pointer;font-family:Nunito,sans-serif;">⏸</button>
                  <button onclick="(function(){var arr=APP._getMedSchedule('${patId}').filter(x=>x.id!=='${m.id}');APP._saveMedSchedule('${patId}',arr);APP.openMedSchedule('${patId}');})()" 
                    style="background:#fee2e2;border:none;color:#991b1b;border-radius:5px;padding:3px 8px;font-size:.68rem;cursor:pointer;">🗑</button>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}

        <!-- Stopped medicines -->
        ${inactive.length ? `
        <details style="margin-bottom:8px;">
          <summary style="font-weight:700;font-size:.8rem;cursor:pointer;color:var(--mut);padding:6px 0;">⏸ Stopped Medicines (${inactive.length})</summary>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
            ${inactive.map(m=>`
              <div style="background:var(--dim);border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:10px;opacity:.7;">
                <div style="flex:1;font-size:.78rem;color:var(--mut);">${m.name}${m.dose?' — '+m.dose:''}</div>
                <button onclick="(function(){var arr=APP._getMedSchedule('${patId}');var i=arr.findIndex(x=>x.id==='${m.id}');if(i>=0)arr[i].active=true;APP._saveMedSchedule('${patId}',arr);APP.openMedSchedule('${patId}');})()" 
                  style="background:#e8f5e9;border:1px solid #90c8a0;color:#166634;border-radius:5px;padding:3px 8px;font-size:.7rem;cursor:pointer;font-family:Nunito,sans-serif;flex-shrink:0;">▶ Resume</button>
              </div>`).join('')}
          </div>
        </details>` : ''}

        ${!meds.length ? '<div style="text-align:center;padding:20px;color:var(--mut);font-size:.83rem;">No medicines added yet.<br>Expand the form above to add your first medicine.</div>' : ''}
      `;
    };

    const old = document.getElementById('_medSchedModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_medSchedModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `<div style="width:100%;max-width:640px;background:var(--card);border-radius:20px 20px 0 0;max-height:94vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div>
          <div style="font-weight:800;font-size:1rem;">💊 ${pat.name}</div>
          <div style="font-size:.68rem;color:var(--mut);">Medicine Daily Schedule & Tracker</div>
        </div>
        <div style="display:flex;gap:7px;align-items:center;">
          ${typeof Notification!=='undefined'&&Notification.permission!=='granted'?`
          <button onclick="Notification.requestPermission().then(p=>APP.showToastMsg(p==='granted'?'✅ Notifications enabled!':'❌ Permission denied'))" 
            style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;border-radius:8px;padding:5px 10px;font-size:.7rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">🔔 Enable Alerts</button>`:''}
          <button onclick="document.getElementById('_medSchedModal').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
        </div>
      </div>
      <div id="_medSchedBody" style="overflow-y:auto;padding:14px 16px;flex:1;-webkit-overflow-scrolling:touch;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    render();
  },

  _saveMedEntry(patId){
    const name = (document.getElementById('_ms_name')||{}).value?.trim();
    if(!name){ this.showToastMsg('⚠️ Medicine name required!'); return; }
    const dose  = (document.getElementById('_ms_dose')||{}).value?.trim()||'';
    const start = (document.getElementById('_ms_start')||{}).value||'';
    const end   = (document.getElementById('_ms_end')||{}).value||'';
    const note  = (document.getElementById('_ms_note')||{}).value?.trim()||'';
    const stock = Number((document.getElementById('_ms_stock')||{}).value||0);
    const refill= Number((document.getElementById('_ms_refill')||{}).value||0);
    const TIMES = ['Morning','Afternoon','Evening','Night'];
    const times = TIMES.filter(t=>{ const el=document.getElementById('_ms_t_'+t.toLowerCase()); return el&&el.checked; });
    if(!times.length){ this.showToastMsg('⚠️ Select at least one time!'); return; }
    // Collect custom clock times
    const slotTimes = {};
    times.forEach(t=>{
      const el = document.getElementById('_ms_time_'+t.toLowerCase());
      if(el&&el.value) slotTimes[t] = el.value;
    });
    const colors = ['#e3f2fd','#e8f5e9','#fff8ee','#f3e5f5','#fce4ec','#e0f7fa'];
    const borders= ['#90b8e8','#90c8a0','#e8a060','#c4b0f0','#f48fb1','#80deea'];
    const idx = this._getMedSchedule(patId).length % colors.length;
    const arr = this._getMedSchedule(patId);
    arr.push({id:'ms'+Date.now(),name,dose,times,slotTimes,startDate:start,endDate:end,note,stock,refill,active:true,color:colors[idx],borderColor:borders[idx],created:new Date().toISOString()});
    this._saveMedSchedule(patId,arr);
    this.showToastMsg('✅ '+name+' added to schedule!');
    this.openMedSchedule(patId);
  },

  // ════════════════════════════════════════════════════════════════
  // HOSPITAL BILLS TRACKER
  // localStorage: rk_hosbills_{patId}
  // ════════════════════════════════════════════════════════════════
  _getHosBills(patId){ try{ return JSON.parse(localStorage.getItem('rk_hosbills_'+patId)||'[]'); }catch{ return []; } },
  _saveHosBills(patId,arr){ localStorage.setItem('rk_hosbills_'+patId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('hosbills_'+patId,arr).catch(()=>{}); },

  openHospitalBills(patId){
    const pat = this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const today = new Date().toISOString().split('T')[0];

    const render = () => {
      const bills = this._getHosBills(patId).sort((a,b)=>b.date.localeCompare(a.date));
      const totalBilled = bills.reduce((s,b)=>s+Number(b.amount||0),0);
      const totalPaid   = bills.reduce((s,b)=>s+Number(b.paid||0),0);
      const totalIns    = bills.reduce((s,b)=>s+Number(b.insurance||0),0);
      const totalDue    = totalBilled - totalPaid - totalIns;
      const body = document.getElementById('_hosBillBody');
      if(!body) return;

      body.innerHTML = `
        <!-- Summary -->
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;">
          <div style="background:#fff8ee;border:1.5px solid #e8a060;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:#b56a00;text-transform:uppercase;margin-bottom:3px;">Total Billed</div>
            <div style="font-size:.95rem;font-weight:900;color:#b56a00;">${fmt(totalBilled)}</div>
          </div>
          <div style="background:#e8f5e9;border:1.5px solid #90c8a0;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:#1a7a45;text-transform:uppercase;margin-bottom:3px;">Paid</div>
            <div style="font-size:.95rem;font-weight:900;color:#1a7a45;">${fmt(totalPaid)}</div>
          </div>
          <div style="background:#e3f2fd;border:1.5px solid #90b8e8;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:#1565c0;text-transform:uppercase;margin-bottom:3px;">Insurance Claimed</div>
            <div style="font-size:.95rem;font-weight:900;color:#1565c0;">${fmt(totalIns)}</div>
          </div>
          <div style="background:${totalDue>0?'#fee2e2':'#e8f5e9'};border:1.5px solid ${totalDue>0?'#f09090':'#90c8a0'};border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:${totalDue>0?'#991b1b':'#1a7a45'};text-transform:uppercase;margin-bottom:3px;">Outstanding</div>
            <div style="font-size:.95rem;font-weight:900;color:${totalDue>0?'#991b1b':'#1a7a45'};">${totalDue>0?fmt(totalDue):'✓ Clear'}</div>
          </div>
        </div>

        <!-- Add bill form -->
        <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:12px;margin-bottom:14px;">
          <div style="font-weight:800;font-size:.85rem;margin-bottom:10px;">➕ Add Bill / Receipt</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🏥 Hospital / Clinic *</label>
              <input id="_hb_hosp" placeholder="e.g. Apollo Hospital" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📋 Bill Type</label>
              <select id="_hb_type" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
                <option>Consultation</option><option>Lab Test</option><option>Medicine</option>
                <option>Surgery</option><option>Hospitalization</option><option>Physiotherapy</option>
                <option>Dental</option><option>Eye</option><option>Other</option>
              </select>
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💰 Total Amount (₹) *</label>
              <input id="_hb_amt" type="number" placeholder="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💳 Amount Paid (₹)</label>
              <input id="_hb_paid" type="number" placeholder="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🛡️ Insurance Claim (₹)</label>
              <input id="_hb_ins" type="number" placeholder="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Date</label>
              <input id="_hb_date" type="date" value="${today}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
          </div>
          <input id="_hb_note" placeholder="📝 Notes, bill number, doctor name…" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);margin-bottom:8px;">
          <button onclick="APP._saveHosBill('${patId}')" style="width:100%;background:#7b1fa2;color:#fff;border:none;border-radius:8px;padding:9px;font-family:Nunito,sans-serif;font-size:.85rem;font-weight:800;cursor:pointer;">💾 Save Bill</button>
        </div>

        <!-- Bills list -->
        ${bills.length ? `
        <div style="font-weight:700;font-size:.82rem;margin-bottom:8px;">🧾 Bill History (${bills.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${bills.map(b=>{
            const due = Number(b.amount||0)-Number(b.paid||0)-Number(b.insurance||0);
            return `<div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:10px;padding:10px 12px;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
                <div>
                  <div style="font-weight:800;font-size:.85rem;">${b.hospital}</div>
                  <div style="font-size:.7rem;color:var(--mut);">📋 ${b.type||'Bill'} · 📅 ${fD(b.date)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:.9rem;font-weight:900;color:#b56a00;">${fmt(b.amount)}</div>
                  ${due>0?`<div style="font-size:.65rem;color:#991b1b;font-weight:700;">Due: ${fmt(due)}</div>`:
                          `<div style="font-size:.65rem;color:#1a7a45;font-weight:700;">✓ Cleared</div>`}
                </div>
              </div>
              <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.7rem;color:var(--mut);">
                ${b.paid?`<span style="color:#1a7a45;font-weight:700;">✓ Paid ${fmt(b.paid)}</span>`:''}
                ${b.insurance?`<span style="color:#1565c0;font-weight:700;">🛡️ Ins ${fmt(b.insurance)}</span>`:''}
                ${b.note?`<span>📝 ${b.note}</span>`:''}
              </div>
              <button onclick="(function(){var arr=APP._getHosBills('${patId}').filter(x=>x.id!=='${b.id}');APP._saveHosBills('${patId}',arr);APP.openHospitalBills('${patId}');})()" style="margin-top:6px;background:none;border:none;color:var(--red);cursor:pointer;font-size:.75rem;padding:0;">🗑 Delete</button>
            </div>`;
          }).join('')}
        </div>` : '<div style="text-align:center;padding:24px;color:var(--mut);font-size:.83rem;">No bills recorded yet.</div>'}
      `;
    };

    const old = document.getElementById('_hosBillModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_hosBillModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `<div style="width:100%;max-width:600px;background:var(--card);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div>
          <div style="font-weight:800;font-size:1rem;">🧾 ${pat.name}</div>
          <div style="font-size:.68rem;color:var(--mut);">Hospital Bills &amp; Medical Expenses</div>
        </div>
        <button onclick="document.getElementById('_hosBillModal').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
      </div>
      <div id="_hosBillBody" style="overflow-y:auto;padding:14px 16px;flex:1;-webkit-overflow-scrolling:touch;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    render();
  },

  _saveHosBill(patId){
    const hosp = (document.getElementById('_hb_hosp')||{}).value?.trim();
    const amt  = Number((document.getElementById('_hb_amt')||{}).value||0);
    if(!hosp||!amt){ this.showToastMsg('⚠️ Hospital name and amount required!'); return; }
    const arr = this._getHosBills(patId);
    arr.push({
      id:'hb'+Date.now(),
      hospital:hosp,
      type:(document.getElementById('_hb_type')||{}).value||'Bill',
      amount:amt,
      paid:Number((document.getElementById('_hb_paid')||{}).value||0),
      insurance:Number((document.getElementById('_hb_ins')||{}).value||0),
      date:(document.getElementById('_hb_date')||{}).value||new Date().toISOString().split('T')[0],
      note:(document.getElementById('_hb_note')||{}).value?.trim()||'',
      created:new Date().toISOString()
    });
    this._saveHosBills(patId,arr);
    this.showToastMsg('✅ Bill saved!');
    this.openHospitalBills(patId);
  },

  // ════════════════════════════════════════════════════════════════
  // TRAVEL DAY-WISE ITINERARY
  // localStorage: rk_itinerary_{tripId}
  // ════════════════════════════════════════════════════════════════
  _getItinerary(tripId){ try{ return JSON.parse(localStorage.getItem('rk_itin_'+tripId)||'[]'); }catch{ return []; } },
  _saveItinerary(tripId,arr){ localStorage.setItem('rk_itin_'+tripId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('itin_'+tripId,arr).catch(()=>{}); },

  openItinerary(tripId){
    const t = this.trips.find(x=>x.id===tripId);
    if(!t) return;

    // Build day list from dep to ret
    const days = [];
    if(t.dep){
      const dep = new Date(t.dep);
      const ret = t.ret ? new Date(t.ret) : new Date(t.dep);
      for(let d=new Date(dep); d<=ret; d.setDate(d.getDate()+1)){
        days.push(new Date(d));
      }
    }

    const render = () => {
      const itin = this._getItinerary(tripId);
      const body = document.getElementById('_itinBody');
      if(!body) return;

      const dayLabels = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const slots = ['Morning','Afternoon','Evening','Night'];
      const slotIcons = {Morning:'🌅',Afternoon:'☀️',Evening:'🌆',Night:'🌙'};
      const slotColors = {Morning:'#e3f2fd',Afternoon:'#fff8ee',Evening:'#f3e5f5',Night:'#e8eaf6'};

      // Build day-wise structure
      const dayData = days.length ? days : [null]; // fallback if no dates

      body.innerHTML = `
        <!-- Day selector tabs if multi-day -->
        ${days.length > 1 ? `
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:12px;-webkit-overflow-scrolling:touch;">
          ${days.map((d,i)=>{
            const key = d.toISOString().split('T')[0];
            const active = (this._itinDay||days[0].toISOString().split('T')[0])===key;
            return `<button onclick="APP._itinDay='${key}';APP.openItinerary('${tripId}')"
              style="flex-shrink:0;padding:6px 12px;border-radius:8px;border:1.5px solid ${active?'var(--acc)':'var(--bdr2)'};background:${active?'var(--acc)':'var(--card)'};color:${active?'#fff':'var(--txt)'};font-size:.75rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;white-space:nowrap;">
              Day ${i+1}<br><span style="font-size:.6rem;opacity:.8;">${d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>
            </button>`;
          }).join('')}
        </div>` : ''}

        ${(()=>{
          const curDayKey = this._itinDay || (days.length?days[0].toISOString().split('T')[0]:'');
          const curDay = days.find(d=>d.toISOString().split('T')[0]===curDayKey) || days[0];
          const dayLabel = curDay ? `Day ${days.indexOf(curDay)+1} — ${curDay.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}` : 'Itinerary';
          const dayItems = itin.filter(x=>x.day===curDayKey);

          return `
          <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">📅 ${dayLabel}</div>

          <!-- Slot-wise activities -->
          ${slots.map(slot=>{
            const slotItems = dayItems.filter(x=>x.slot===slot);
            return `
            <div style="margin-bottom:12px;">
              <div style="font-size:.68rem;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${slotIcons[slot]} ${slot}</div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${slotItems.map(item=>`
                  <div style="background:${slotColors[slot]};border:1.5px solid var(--bdr);border-radius:8px;padding:8px 10px;display:flex;align-items:flex-start;gap:8px;">
                    <div style="flex:1;">
                      <div style="font-weight:700;font-size:.82rem;">${item.title}</div>
                      ${item.place?`<div style="font-size:.7rem;color:var(--mut);">📍 ${item.place}</div>`:''}
                      ${item.time?`<div style="font-size:.7rem;color:var(--mut);">⏰ ${item.time}</div>`:''}
                      ${item.note?`<div style="font-size:.7rem;color:var(--mut);">📝 ${item.note}</div>`:''}
                    </div>
                    <button onclick="(function(){var arr=APP._getItinerary('${tripId}').filter(x=>x.id!=='${item.id}');APP._saveItinerary('${tripId}',arr);APP.openItinerary('${tripId}');})()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;padding:2px;flex-shrink:0;">🗑</button>
                  </div>`).join('')}

                <!-- Add item to this slot -->
                <div style="display:flex;gap:6px;align-items:center;">
                  <input id="_itin_${slot}_title" placeholder="+ Add ${slot} activity…"
                    style="flex:1;border:1.5px solid var(--bdr2);border-radius:7px;padding:5px 9px;font-family:Nunito,sans-serif;font-size:.78rem;background:var(--bg);color:var(--txt);"
                    onkeydown="if(event.key==='Enter')APP._addItinItem('${tripId}','${curDayKey}','${slot}')">
                  <button onclick="APP._addItinItem('${tripId}','${curDayKey}','${slot}')"
                    style="background:var(--acc);color:#fff;border:none;border-radius:7px;padding:5px 12px;font-size:.78rem;font-weight:700;cursor:pointer;flex-shrink:0;">+</button>
                </div>
              </div>
            </div>`;
          }).join('')}`;
        })()}
      `;
    };

    if(!this._itinDay && days.length) this._itinDay = days[0].toISOString().split('T')[0];

    const old = document.getElementById('_itinModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_itinModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `<div style="width:100%;max-width:600px;background:var(--card);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div>
          <div style="font-weight:800;font-size:1rem;">🗺️ ${t.dest}</div>
          <div style="font-size:.68rem;color:var(--mut);">Day-wise Itinerary · ${days.length} day${days.length!==1?'s':''}</div>
        </div>
        <button onclick="document.getElementById('_itinModal').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
      </div>
      <div id="_itinBody" style="overflow-y:auto;padding:14px 16px;flex:1;-webkit-overflow-scrolling:touch;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    render();
  },

  _addItinItem(tripId, dayKey, slot){
    const el = document.getElementById('_itin_'+slot+'_title');
    const title = el ? el.value.trim() : '';
    if(!title) return;
    const arr = this._getItinerary(tripId);
    arr.push({id:'it'+Date.now(),day:dayKey,slot,title,place:'',time:'',note:'',created:new Date().toISOString()});
    this._saveItinerary(tripId,arr);
    if(el) el.value='';
    this.openItinerary(tripId);
  },

  renderMedical(){
    const tI={'General Checkup':'🩺','Follow-up':'🔄','Lab Test':'🧪','Specialist Consultation':'👨‍⚕️','Emergency':'🚨','Vaccination':'💉','Surgery/Procedure':'🔬','Dental':'🦷','Eye Checkup':'👁️'};

    // filter30: show visits with follow-up overdue OR due in next 30 days
    const filter30=this.medFilter30||false;
    this.medFilter30=false; // reset after use

    const normNext=(d)=>{
      if(!d) return null;
      if(d.includes('-')) return d;
      return dmyToIso(d)||null;
    };

    const patTabs=`<button class="stab ${this.curPatient==='all'?'on':''}" onclick="APP.medFilter30=false;APP.curPatient='all';APP.renderMedical()">All</button>`
      +this.patients.map(p=>`<button class="stab ${this.curPatient===p.id?'on':''}" onclick="APP.medFilter30=false;APP.curPatient='${p.id}';APP.renderMedical()">${p.name}</button>`).join('');

    const patCards=this.patients.map(p=>{
      const age=p.dob?Math.floor((new Date()-new Date(p.dob))/31557600000):'?';
      const vCount=this.visits.filter(r=>r.patId===p.id).length;
      return`<div class="card" style="display:inline-flex;flex-direction:column;gap:6px;padding:12px 15px;min-width:180px;cursor:pointer;${this.curPatient===p.id?'border-color:var(--acc);':''}" onclick="APP.medFilter30=false;APP.curPatient='${p.id}';APP.renderMedical()">
        <div style="font-weight:700;font-size:.9rem">👤 ${p.name}</div>
        <div style="font-size:.74rem;color:var(--mut)">${p.relation||'Family'} | Age: ${age} | 🩸 ${p.blood||'?'}</div>
        ${p.cond?`<div style="font-size:.72rem;color:var(--acc)">⚠️ ${p.cond}</div>`:''}
        <div style="font-size:.72rem;color:var(--blu)">🏥 ${vCount} visit${vCount!==1?'s':''} recorded</div>
        ${p.ins?`<div style="font-size:.72rem;color:var(--mut)">📋 ${p.ins}</div>`:''}
        <div style="display:flex;gap:5px;margin-top:4px;flex-wrap:wrap;">
          <button class="btn b-grn b-sm" onclick="event.stopPropagation();APP.openMedModal(null,'${p.id}')">+ Visit</button>
          <button class="btn b-sm" style="background:#f4f0ff;color:#5c3496;border:1.5px solid #c4b0f0;font-weight:700;" onclick="event.stopPropagation();APP.openVitalsModal('${p.id}')">📊 Vitals</button>
          <button class="btn b-sm" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:700;" onclick="event.stopPropagation();APP.openMedSchedule('${p.id}')">💊 Medicines</button>
          <button class="btn b-sm" style="background:#f3e5f5;color:#7b1fa2;border:1.5px solid #c4b0f0;font-weight:700;" onclick="event.stopPropagation();APP.openHospitalBills('${p.id}')">🧾 Bills</button>
          <button class="btn b-blu b-sm" onclick="event.stopPropagation();APP.openPatientModal('${p.id}')">✏️ Edit</button>
          <button class="btn b-red b-sm" onclick="event.stopPropagation();APP.delPatient('${p.id}')">🗑</button>
        </div>
      </div>`;
    }).join('');

    // Filter: patient + optional follow-up view (overdue + next 30 days)
    let recs=[...this.visits].filter(r=>this.curPatient==='all'||r.patId===this.curPatient);
    if(filter30){
      // ✅ FIX: include OVERDUE (d<0) AND upcoming within 30 days (d<=30)
      // Previously was d>=0 which wrongly excluded overdue follow-ups
      recs=recs.filter(r=>{
        const ni=normNext(r.next);
        if(!ni) return false;
        const d=daysFrom(ni);
        return d!==null && d<=30; // negative=overdue, 0=today, positive=upcoming
      });
      // Sort: overdue first (most overdue at top), then upcoming by date
      recs.sort((a,b)=>{
        const da=daysFrom(normNext(a.next)||'9999');
        const db=daysFrom(normNext(b.next)||'9999');
        return (da??999)-(db??999); // most overdue (most negative) first
      });
    } else {
      recs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    }

    // Date filter for Medical visits
    const medFrom=this._medFrom||'';
    const medTo=this._medTo||'';
    if(!filter30){
      if(medFrom) recs=recs.filter(r=>r.date&&r.date>=medFrom);
      if(medTo)   recs=recs.filter(r=>r.date&&r.date<=medTo);
    }
    const medFilterBar=filter30?'':`
      <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
        <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:.72rem;color:var(--mut);font-weight:600;">From</span>
          <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_mdf" value="${medFrom?isoToDmy(medFrom):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_mdf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._medFrom=iso;APP.renderMedical();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_mdf').showPicker&&document.getElementById('dfh_mdf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_mdf" value="${medFrom||''} " onchange="(function(iso){var el=document.getElementById('df_mdf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._medFrom=iso;APP.renderMedical();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
          <span style="font-size:.72rem;color:var(--mut);font-weight:600;">To</span>
          <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_mdt" value="${medTo?isoToDmy(medTo):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_mdt');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._medTo=iso;APP.renderMedical();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_mdt').showPicker&&document.getElementById('dfh_mdt').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_mdt" value="${medTo||''} " onchange="(function(iso){var el=document.getElementById('df_mdt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._medTo=iso;APP.renderMedical();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
          ${(medFrom||medTo)?'<button onclick="APP._medFrom=\'\';APP._medTo=\'\';APP.renderMedical();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 7px;">✕ Clear</button>':''}
          <span style="font-size:.68rem;color:var(--acc);font-weight:700;margin-left:4px;">${recs.length} record${recs.length!==1?'s':''}</span>
        </div>
      </div>`;

    const cards=recs.map(r=>{
      const pat=this.patients.find(p=>p.id===r.patId);
      const nextIso=normNext(r.next);
      const nd=nextIso?daysFrom(nextIso):null;
      const typeIcon=tI[r.type]||'🏥';
      return`<div class="card">
        <div class="card-hdr">
          <div class="card-title">${typeIcon} ${r.doctor?'Dr. '+r.doctor:r.type}</div>
          <span class="badge bb">${pat?pat.name:'?'}</span>
        </div>
        <div class="card-body">
          <div class="fr"><span class="fl">📅 Visit Date</span><span class="mono" style="font-weight:700;color:var(--acc)">${fD(r.date)}</span></div>
          <div class="fr"><span class="fl">Visit Type</span><span class="badge ba">${r.type}</span></div>
          ${r.spec?`<div class="fr"><span class="fl">Specialization</span><span class="fv">${r.spec}</span></div>`:''}
          ${r.hospital?`<div class="fr"><span class="fl">Hospital</span><span class="fv">${r.hospital}${r.city?', '+r.city:''}</span></div>`:''}
          ${r.purpose?`<div style="background:#f0f7ff;border-radius:6px;padding:6px 9px;font-size:.8rem;border-left:3px solid var(--blu);margin:3px 0"><b>Purpose:</b> ${APP.autoLink(r.purpose)}</div>`:''}
          ${r.meds?`<div style="background:#fff8f0;border-radius:6px;padding:6px 9px;font-size:.78rem;border-left:3px solid var(--org);margin:3px 0;word-break:break-word;">💊 <b>Rx:</b> ${APP.autoLink(r.meds)}</div>`:''}
          ${r.vitals?`<div style="background:#f4f0ff;border-radius:6px;padding:6px 9px;font-size:.78rem;border-left:3px solid var(--pur);margin:3px 0;word-break:break-word;">🔬 <b>Vitals:</b> ${APP.autoLink(r.vitals)}</div>`:''}
          ${r.labname?`<div style="background:#f0fff4;border-radius:6px;padding:6px 9px;font-size:.78rem;border-left:3px solid var(--tel);margin:3px 0;word-break:break-word;">🧪 <b>${r.labname}</b>${r.labdate?` (${fD(r.labdate)})`:''}: ${APP.autoLink(r.labres||'—')}</div>`:''}
          ${nextIso?`<div class="fr"><span class="fl">📅 Next Follow-up</span><span>${remBadge(nd)} <span class="mono" style="font-size:.74rem">${fD(nextIso)}</span></span></div>`:''}
          ${(()=>{
            const pf=(r.presFiles&&r.presFiles.length)||r.link?1:0;
            const lf=(r.labFiles&&r.labFiles.length)||(r.lablink||r.lablink2||r.lablink3)?1:0;
            const tot=(r.presFiles&&r.presFiles.length?r.presFiles.length:r.link?1:0)+(r.labFiles&&r.labFiles.length?r.labFiles.length:[r.lablink,r.lablink2,r.lablink3].filter(Boolean).length);
            if(!tot) return '';
            return `<div class="fr"><span class="fl">📎 Files</span><span style="font-size:.72rem;color:var(--mut);">${pf?'📄 Rx'+(r.presFiles&&r.presFiles.length>1?' ×'+r.presFiles.length:''):''}${pf&&lf?' · ':''}${lf?'🧪 Lab'+(r.labFiles&&r.labFiles.length>1?' ×'+r.labFiles.length:[r.lablink,r.lablink2,r.lablink3].filter(Boolean).length>1?' ×'+[r.lablink,r.lablink2,r.lablink3].filter(Boolean).length:''):''}  <b>${tot} file${tot>1?'s':''} attached</b></span></div>`;
          })()}
          ${r.notes?`<div style="font-size:.76rem;color:var(--mut);margin-top:4px;word-break:break-word;">📝 ${APP.autoLink(r.notes)}</div>`:''}
        </div>
        <div class="card-foot" style="flex-wrap:wrap;gap:6px;">
          <button class="btn b-out b-sm" onclick="APP.openMedModal('${r.id}')">✏️ Edit</button>
          ${nextIso?`<button onclick="APP._medCompleteFollowup('${r.id}')"
            style="display:inline-flex;align-items:center;gap:5px;background:#e8f5e9;color:#166534;border:1.5px solid #90c8a0;border-radius:8px;padding:5px 12px;font-size:.76rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;min-height:32px;">
            ✅ Follow-up Done
          </button>`:''}
          ${(()=>{
            const tot=(r.presFiles&&r.presFiles.length?r.presFiles.length:r.link?1:0)+(r.labFiles&&r.labFiles.length?r.labFiles.length:[r.lablink,r.lablink2,r.lablink3].filter(Boolean).length);
            if(!tot) return '';
            return `<button onclick="APP._medShowFiles('${r.id}')"
              style="display:inline-flex;align-items:center;gap:5px;background:#fff8ee;color:#b56a00;border:1.5px solid #ffcc80;border-radius:8px;padding:5px 12px;font-size:.76rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;min-height:32px;">
              📎 Files (${tot})
            </button>`;
          })()}
        </div>
      </div>`;
    }).join('');

    const overdueCount=filter30?recs.filter(r=>{const d=daysFrom(normNext(r.next)||'');return d!==null&&d<0;}).length:0;
    const upcomingCount=filter30?recs.filter(r=>{const d=daysFrom(normNext(r.next)||'');return d!==null&&d>=0;}).length:0;
    const filter30Banner=filter30?`<div style="background:#e8f4ff;border:1.5px solid #90b8e8;border-radius:9px;padding:9px 14px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span style="font-size:.82rem;color:#1050a0;font-weight:700;">📅 Follow-ups — ${recs.length} found</span>
        <button class="btn b-out b-sm" onclick="APP.medFilter30=false;APP.renderMedical()">&#10006; Show All Records</button>
      </div>
      <div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap;">
        ${overdueCount>0?`<span style="font-size:.74rem;background:#fee2e2;color:#991b1b;border-radius:6px;padding:3px 9px;font-weight:700;">⚠️ ${overdueCount} Overdue</span>`:''}
        ${upcomingCount>0?`<span style="font-size:.74rem;background:#dcfce7;color:#166534;border-radius:6px;padding:3px 9px;font-weight:700;">📅 ${upcomingCount} Upcoming (next 30d)</span>`:''}
      </div>
    </div>`:'';
    document.getElementById('pan-medical').innerHTML=`
      <div class="sec-hdr"><div class="sec-title">🏥 Medical Records</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn b-out b-sm" onclick="APP.openPatientModal()">+ Add Patient</button><button class="btn b-gold" onclick="APP.openMedModal()">+ Add Visit</button></div></div>
      ${filter30Banner}
      ${filter30?'':(`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">${patCards||'<div style="color:var(--mut);font-size:.85rem;padding:10px">No patients — Add Patient first.</div>'}</div><div class="stabs">${patTabs}</div>`)}
      ${medFilterBar}
      <div class="grid">${cards||`<div class="empty"><div class="ei">🏥</div>${filter30?'No overdue or upcoming follow-ups ✅':this.patients.length?'No records yet — click + Add Visit':'Add a patient first'}</div>`}</div>`;
  },

  // ══ TRAVEL ══
  openTravelModal(id,dest){
    this.editId=id||null;document.getElementById('tvMT').textContent=id?'✏️ Edit Trip':'✈️ Add Trip';
    if(id){const t=this.trips.find(x=>x.id===id);['dest','city','type','dom','trans','ticket','hotel','hcity','budget','spent','members','photo','notes'].forEach(f=>sv('tvm_'+f,t[f]));svDate('tvm_dep',t.dep);svDate('tvm_ret',t.ret);}
    else{['city','ticket','hotel','hcity','budget','spent','members','photo','notes'].forEach(f=>sv('tvm_'+f,''));sv('tvm_dest',dest||'');svDate('tvm_dep','');svDate('tvm_ret','');}
    FUM.clear('fu_travel_doc_wrap');
    FUM.init('fu_travel_doc_wrap','travel',[]);
    if(id){const t=this.trips.find(x=>x.id===id);if(t){if(t.docFiles&&t.docFiles.length)FUM.init('fu_travel_doc_wrap','travel',t.docFiles);else if(t.photo)FUM.loadLegacyLinks('fu_travel_doc_wrap',[t.photo]);}}
    M.open('tvM');
  },
  saveTrip(){
    const dest=v('tvm_dest');if(!dest){alert('Destination required!');return;}
    const tvDocFiles=FUM.getFiles('fu_travel_doc_wrap');
    const data={dest,city:v('tvm_city'),type:v('tvm_type'),dom:v('tvm_dom'),dep:vDate('tvm_dep'),ret:vDate('tvm_ret'),trans:v('tvm_trans'),ticket:v('tvm_ticket'),hotel:v('tvm_hotel'),hcity:v('tvm_hcity'),budget:Number(v('tvm_budget')),spent:Number(v('tvm_spent')),members:v('tvm_members'),photo:(tvDocFiles[0]||{}).url||'',docFiles:tvDocFiles,notes:v('tvm_notes')};
    let ts=this.trips;
    if(this.editId)ts=ts.map(t=>t.id===this.editId?{...t,...data}:t);
    else{data.id=uid();ts.push(data);}
    S.set('trips',ts);M.close('tvM');this.renderTravel();this.renderPills();
  },
  delTrip(id){this.delCb=()=>{S.set('trips',this.trips.filter(t=>t.id!==id));this.renderTravel();this.renderPills();};document.getElementById('delMsg').textContent='Delete trip?';M.open('delM');},
  saveBucket(){const dest=v('bkm_dest');if(!dest){alert('Destination required!');return;}const bs=this.buckets;bs.push({id:uid(),dest,pri:v('bkm_pri'),year:v('bkm_year'),notes:v('bkm_notes')});S.set('buckets',bs);M.close('bkM');this.renderTravel();},
  delBucket(id){this.delCb=()=>{S.set('buckets',this.buckets.filter(b=>b.id!==id));this.renderTravel();};document.getElementById('delMsg').textContent='Remove from bucket list?';M.open('delM');},
  setTravelSub(s){this.travelSub=s;this.renderTravel();},

  _packTemplates:{
    Business:['👔 Formal shirts (3)','👖 Trousers (2)','👞 Formal shoes','💼 Laptop & charger','📁 Documents & ID','🪥 Toiletries','💊 Medicines','📱 Phone charger','🔌 Power bank','💳 Cards & cash','🧣 Belt & tie','📓 Notebook & pen'],
    Vacation:['👕 T-shirts (4)','🩳 Shorts/casuals (3)','👟 Comfortable shoes','🩴 Slippers','🧴 Sunscreen','🩱 Swimwear','📷 Camera','🕶️ Sunglasses','🎒 Daypack','💊 Medicines','🪥 Toiletries','💳 Cards & cash','📱 Charger & power bank','🧢 Cap/hat','🌂 Umbrella'],
    Weekend:['👕 T-shirts (2)','👖 Jeans/casual pants','👟 Shoes','🪥 Toiletries','💊 Medicines','📱 Charger','💳 Cards & cash','🕶️ Sunglasses'],
    Family:['👕 Clothes for all','👶 Kids essentials','💊 Medicines & first aid','🧸 Kids toys/games','🪥 Toiletries','📱 Chargers','💳 Cards & cash','📋 ID & documents','🍼 Baby food/snacks','🌂 Umbrella','🎒 Bags'],
    International:['🛂 Passport & visa','✈️ Flight tickets','💳 Cards & forex','💊 Medicines','🪥 Toiletries','👔 Formal + casual clothes','🔌 Universal adapter','📱 Charger & power bank','📁 Travel insurance','💱 Currency','📓 Emergency contacts','🏥 Travel docs']
  },

  openPackingList(tripId){
    const t=this.trips.find(x=>x.id===tripId);
    if(!t) return;
    const KEY='rk_pack_'+tripId;
    let items=[];
    try{ items=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ items=[]; }

    const templates=this._packTemplates;
    const tplNames=Object.keys(templates);

    const render=()=>{
      const checked=items.filter(i=>i.done).length;
      const total=items.length;
      const pct=total?Math.round(checked/total*100):0;
      document.getElementById('_packBody').innerHTML=`
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--mut);margin-bottom:4px;">
            <span>${checked}/${total} packed</span><span>${pct}%</span>
          </div>
          <div style="background:var(--bdr);border-radius:4px;height:6px;overflow:hidden;">
            <div style="background:${pct===100?'#1a7a45':'#2c6fad'};width:${pct}%;height:100%;border-radius:4px;transition:width .3s;"></div>
          </div>
          ${pct===100?'<div style="text-align:center;margin-top:6px;font-size:.82rem;color:#1a7a45;font-weight:800;">🎉 All packed! Ready to go!</div>':''}
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
          <input id="_packNewItem" placeholder="Add item…" style="flex:1;min-width:120px;border:1.5px solid var(--bdr2);border-radius:7px;padding:5px 9px;font-family:'Nunito',sans-serif;font-size:.8rem;background:var(--bg);">
          <button onclick="(function(){var el=document.getElementById('_packNewItem');var txt=el?el.value.trim():'';if(!txt)return;var arr=JSON.parse(localStorage.getItem('${KEY}')||'[]');arr.push({id:'p'+Date.now(),label:txt,done:false});localStorage.setItem('${KEY}',JSON.stringify(arr));APP.openPackingList('${tripId}');})()" style="background:#2c6fad;color:#fff;border:none;border-radius:7px;padding:5px 12px;font-size:.8rem;font-weight:700;cursor:pointer;">＋ Add</button>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">
          ${tplNames.map(tp=>`<button onclick="APP._applyPackTemplate('${tripId}','${tp}')" style="font-size:.65rem;padding:3px 9px;border-radius:10px;border:1.5px solid var(--acc);background:var(--card);color:var(--acc);font-weight:700;cursor:pointer;">📋 ${tp}</button>`).join('')}
          <button onclick="(function(){if(!confirm('Clear all items?'))return;localStorage.setItem('${KEY}','[]');APP.openPackingList('${tripId}');})()" style="font-size:.65rem;padding:3px 9px;border-radius:10px;border:1.5px solid #e05050;background:var(--card);color:#e05050;font-weight:700;cursor:pointer;margin-left:auto;">🗑 Clear</button>
        </div>
        ${items.length?items.map(i=>`
          <div class="pack-item ${i.done?'packed':''}" style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid var(--bdr);">
            <input type="checkbox" class="pack-check" ${i.done?'checked':''} onchange="(function(){var arr=JSON.parse(localStorage.getItem('${KEY}')||'[]');var idx=arr.findIndex(x=>x.id==='${i.id}');if(idx>=0)arr[idx].done=!arr[idx].done;localStorage.setItem('${KEY}',JSON.stringify(arr));APP.openPackingList('${tripId}');})()" >
            <span class="pack-text" style="flex:1;font-size:.83rem;${i.done?'text-decoration:line-through;color:var(--mut);':''}">${i.label}</span>
            <button onclick="(function(){var arr=JSON.parse(localStorage.getItem('${KEY}')||'[]').filter(x=>x.id!=='${i.id}');localStorage.setItem('${KEY}',JSON.stringify(arr));APP.openPackingList('${tripId}');})()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;padding:2px 5px;">🗑</button>
          </div>`).join(''):'<div style="text-align:center;padding:20px;color:var(--mut);font-size:.83rem;">📦 No items yet — tap a template or add items above</div>'}
      `;
    };

    // Create or reuse modal
    let modal=document.getElementById('_packModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='_packModal';
      modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
      modal.innerHTML=`<div style="width:100%;max-width:500px;background:#fff;border-radius:20px 20px 0 0;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid #e9ecef;">
          <div style="font-weight:800;font-size:1rem;">🎒 Packing List — ${t.dest}</div>
          <button onclick="document.getElementById('_packModal').remove()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#6c757d;">✕</button>
        </div>
        <div id="_packBody" style="overflow-y:auto;padding:14px 16px;flex:1;"></div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
    } else {
      document.querySelector('#_packModal > div > div:first-child > div').textContent='🎒 Packing List — '+t.dest;
    }
    render();
    modal.style.display='flex';
  },

  _applyPackTemplate(tripId, tplName){
    const KEY='rk_pack_'+tripId;
    const tpl=this._packTemplates[tplName]||[];
    let items=[];
    try{ items=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ items=[]; }
    const existing=new Set(items.map(i=>i.label.toLowerCase()));
    tpl.forEach(label=>{
      if(!existing.has(label.toLowerCase())) items.push({id:'p'+Date.now()+Math.random().toString(36).slice(2),label,done:false});
    });
    localStorage.setItem(KEY,JSON.stringify(items));
    this.openPackingList(tripId);
  },

  renderTravel(){
    const s=this.travelSub;const now=new Date();
    const tI={Flight:'✈️',Train:'🚆',Car:'🚗',Bus:'🚌',Cruise:'🛳️'};
    const searchBar=`
      <div class="sbar" style="margin-bottom:8px;">
        <input type="text" id="tvQ" placeholder="🔍 Destination, city, hotel…" oninput="APP.filterTravel()" style="min-width:180px">
        <select id="tvTF" onchange="APP.filterTravel()"><option value="">All Transport</option><option>Flight</option><option>Train</option><option>Car</option><option>Bus</option><option>Cruise</option></select>
        <select id="tvDF" onchange="APP.filterTravel()"><option value="">All</option><option value="Domestic">Domestic</option><option value="International">International</option></select>
      </div>
      <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
        <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:.72rem;color:var(--mut);font-weight:600;">From</span>
          <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="tvD1_txt" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('tvD1');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}APP.filterTravel();})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;"><span onclick="document.getElementById('tvD1').showPicker&&document.getElementById('tvD1').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="tvD1" onchange="(function(iso){var el=document.getElementById('tvD1_txt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}APP.filterTravel();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
          <span style="font-size:.72rem;color:var(--mut);font-weight:600;">To</span>
          <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="tvD2_txt" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('tvD2');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}APP.filterTravel();})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;"><span onclick="document.getElementById('tvD2').showPicker&&document.getElementById('tvD2').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="tvD2" onchange="(function(iso){var el=document.getElementById('tvD2_txt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}APP.filterTravel();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
        </div>
      </div>`;

    const tripCard=t=>{
      const d=daysFrom(t.dep);const isPast=t.ret&&new Date(t.ret)<now;
      return`<div class="card">
        <div class="card-hdr"><div class="card-title">${tI[t.trans]||'🌍'} ${t.dest}</div>
          <span class="badge ${isPast?'bm':d!==null&&d<=7?'by':'bb'}">${isPast?'Completed':d!==null?d+'d away':'Upcoming'}</span></div>
        <div class="card-body">
          <div class="fr"><span class="fl">Type</span><span class="badge bt">${t.type}</span> <span class="badge ${t.dom==='International'?'bp':'bb'}">${t.dom||'Domestic'}</span></div>
          <div class="fr"><span class="fl">City</span><span class="fv">${t.city||t.dest}</span></div>
          <div class="fr"><span class="fl">Dates</span><span class="mono" style="font-size:.78rem">${fD(t.dep)} → ${fD(t.ret)}</span></div>
          <div class="fr"><span class="fl">Transport</span><span class="fv">${tI[t.trans]||''} ${t.trans}</span></div>
          ${t.ticket?`<div class="fr"><span class="fl">Ticket/PNR</span><span class="mono" style="font-size:.78rem">${t.ticket}</span></div>`:''}
          <div class="fr"><span class="fl">Stay</span><span class="fv">${t.hotel||'—'}${t.hcity?' ('+t.hcity+')':''}</span></div>
          <div class="fr"><span class="fl">Members</span><span class="fv" style="font-size:.78rem">${t.members||'—'}</span></div>
          <div class="fr"><span class="fl">Budget</span><span class="mono">${fmt(t.budget)}</span></div>
          ${t.spent?`<div class="fr"><span class="fl">Spent</span><span class="mono" style="color:${t.spent>t.budget?'var(--red)':'var(--grn)'}">${fmt(t.spent)}</span></div>`:''}
          ${(t.docFiles&&t.docFiles.length)?t.docFiles.map(f=>`<div class="fr"><span class="fl">📎 Doc</span><a href="${f.url}" target="_blank" style="color:var(--acc);font-size:.76rem">${f.name||'Open'}</a></div>`).join(''):(t.photo?`<div class="fr"><span class="fl">📎 Doc/Photo</span><a href="${t.photo}" target="_blank" style="color:var(--acc);font-size:.76rem">Open</a></div>`:''  )}
          ${t.notes?`<div style="font-size:.76rem;color:var(--mut);margin-top:3px;word-break:break-word;">${APP.autoLink(t.notes)}</div>`:''}
        </div>
        <div class="card-foot">
          <button class="btn b-out b-sm" onclick="APP.openTravelModal('${t.id}')">✏️ Edit</button>
          <button class="btn b-sm" style="background:#f0faf5;color:#1a7a45;border:1.5px solid #90c8a0;font-weight:700;" onclick="APP.openPackingList('${t.id}')">🎒 Packing</button>
          <button class="btn b-sm" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:700;" onclick="APP._itinDay=null;APP.openItinerary('${t.id}')">🗺️ Itinerary</button>
        </div>
      </div>`;
    };

    const upcoming=this.trips.filter(t=>!t.ret||new Date(t.ret)>=now).sort((a,b)=>new Date(a.dep)-new Date(b.dep));
    const past=this.trips.filter(t=>t.ret&&new Date(t.ret)<now).sort((a,b)=>new Date(b.dep)-new Date(a.dep));
    const priL={high:'🔴 High',medium:'🟡 Medium',low:'🟢 Low'};
    const bkCards=this.buckets.map(b=>`<div class="card"><div class="card-hdr"><div class="card-title">🌟 ${b.dest}</div><span class="badge ${b.pri==='high'?'br':b.pri==='medium'?'by':'bg'}">${priL[b.pri]}</span></div>
      <div class="card-body">${b.year?`<div class="fr"><span class="fl">Target</span><span class="mono">${b.year}</span></div>`:''}${b.notes?`<div style="font-size:.78rem;color:var(--mut);word-break:break-word;">${APP.autoLink(b.notes)}</div>`:''}</div>
      <div class="card-foot"><button class="btn b-gold b-sm" onclick="APP.openTravelModal(null,'${b.dest}')">Plan Trip</button></div>
    </div>`).join('');

    let main='';
    if(s==='upcoming')main=searchBar+`<div class="grid" id="tvGrid">${upcoming.map(tripCard).join('')||'<div class="empty"><div class="ei">✈️</div>No upcoming trips</div>'}</div>`;
    if(s==='past')main=searchBar+`<div class="grid" id="tvGrid">${past.map(tripCard).join('')||'<div class="empty"><div class="ei">🌏</div>No past trips</div>'}</div>`;
    if(s==='bucket')main=`<div class="sec-hdr" style="margin-bottom:10px"><div></div><button class="btn b-out b-sm" onclick="M.open('bkM')">+ Add Destination</button></div><div class="grid">${bkCards||'<div class="empty"><div class="ei">🗺️</div>Add dream destinations!</div>'}</div>`;

    document.getElementById('pan-travel').innerHTML=`
      <div class="sec-hdr"><div class="sec-title">Travel Planner <span class="ct">${this.trips.length}</span></div><button class="btn b-gold" onclick="APP.openTravelModal()">+ Add Trip</button></div>
      <div class="stabs">
        <button class="stab ${s==='upcoming'?'on':''}" onclick="APP.setTravelSub('upcoming')">✈️ Upcoming (${upcoming.length})</button>
        <button class="stab ${s==='past'?'on':''}" onclick="APP.setTravelSub('past')">🌏 Past (${past.length})</button>
        <button class="stab ${s==='bucket'?'on':''}" onclick="APP.setTravelSub('bucket')">🌟 Bucket List (${this.buckets.length})</button>
      </div>${main}`;
  },

  filterTravel(){
    const q=(document.getElementById('tvQ')?.value||'').toLowerCase();
    const tf=document.getElementById('tvTF')?.value||'';
    const df=document.getElementById('tvDF')?.value||'';
    const d1=document.getElementById('tvD1')?.value||'';
    const d2=document.getElementById('tvD2')?.value||'';
    const now=new Date();
    const s=this.travelSub;
    let list=s==='upcoming'?this.trips.filter(t=>!t.ret||new Date(t.ret)>=now):this.trips.filter(t=>t.ret&&new Date(t.ret)<now);
    list=list.filter(t=>{
      const mq=!q||(t.dest+t.city+t.hotel+t.hcity+t.trans+t.members+t.ticket).toLowerCase().includes(q);
      return mq&&(!tf||t.trans===tf)&&(!df||t.dom===df)&&(!d1||t.dep>=d1)&&(!d2||t.dep<=d2);
    });
    const tI={Flight:'✈️',Train:'🚆',Car:'🚗',Bus:'🚌',Cruise:'🛳️'};
    const g=document.getElementById('tvGrid');
    if(!g)return;
    g.innerHTML=list.map(t=>{const d=daysFrom(t.dep);const isPast=t.ret&&new Date(t.ret)<now;
      return`<div class="card"><div class="card-hdr"><div class="card-title">${tI[t.trans]||'🌍'} ${t.dest}</div><span class="badge ${isPast?'bm':d!==null&&d<=7?'by':'bb'}">${isPast?'Completed':d!==null?d+'d away':'Upcoming'}</span></div>
        <div class="card-body">
          <div class="fr"><span class="fl">City</span><span class="fv">${t.city||t.dest}</span></div>
          <div class="fr"><span class="fl">Dates</span><span class="mono" style="font-size:.78rem">${fD(t.dep)} → ${fD(t.ret)}</span></div>
          <div class="fr"><span class="fl">Transport</span><span class="fv">${tI[t.trans]||''} ${t.trans}</span></div>
          ${t.ticket?`<div class="fr"><span class="fl">Ticket</span><span class="mono">${t.ticket}</span></div>`:''}
          <div class="fr"><span class="fl">Hotel</span><span class="fv">${t.hotel||'—'}${t.hcity?' ('+t.hcity+')':''}</span></div>
          ${t.photo?`<div class="fr"><span class="fl">📎 File</span><a href="${t.photo}" target="_blank" style="color:var(--acc);font-size:.76rem">Open</a></div>`:''}
        </div>
        <div class="card-foot"><button class="btn b-out b-sm" onclick="APP.openTravelModal('${t.id}')">✏️ Edit</button></div>
      </div>`;
    }).join('')||'<div class="empty"><div class="ei">🔍</div>No results</div>';
  },

  // ══ CALENDAR ══
  // ════════════════════════════════════════════════════════════════
  // CUSTOM CALENDAR EVENTS
  // localStorage: rk_cal_events  [{id,date,title,time,type,color,note}]
  // ════════════════════════════════════════════════════════════════
  getCalEvents(){ try{ return JSON.parse(localStorage.getItem('rk_cal_events')||'[]'); }catch{ return []; } },
  saveCalEvents(arr){ localStorage.setItem('rk_cal_events',JSON.stringify(arr)); if(window.fbSave) window.fbSave('cal_events',arr).catch(()=>{}); },

  openCalEventModal(dateStr, editId){
    const today = dateStr || new Date().toISOString().split('T')[0];
    const existing = editId ? this.getCalEvents().find(e=>e.id===editId) : null;
    const TYPES = ['📅 Personal','🎂 Birthday','💍 Anniversary','💼 Work','🏥 Medical','💰 Finance','✈️ Travel','🎉 Celebration','⚠️ Important','📋 Other'];
    const COLORS = ['#1565c0','#1a7a45','#b56a00','#7b1fa2','#c0392b','#0f6e56','#e65100','#2196f3'];

    const old = document.getElementById('_calEvModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_calEvModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `<div style="width:100%;max-width:480px;background:var(--card);border-radius:16px;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,.3);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-weight:800;font-size:1rem;">${editId?'✏️ Edit Event':'📅 Add Event'}</div>
        <button onclick="document.getElementById('_calEvModal').remove()" style="background:var(--dim);border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;color:var(--mut);">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📝 Title *</label>
          <input id="_cev_title" value="${existing?existing.title.replace(/"/g,'&quot;'):''}" placeholder="e.g. Raman's Birthday, Court date, EMI due…"
            style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:8px 11px;font-family:Nunito,sans-serif;font-size:.88rem;background:var(--bg);color:var(--txt);">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Date *</label>
            <input id="_cev_date" type="date" value="${existing?existing.date:today}"
              style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);">
          </div>
          <div>
            <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">⏰ Time (optional)</label>
            <input id="_cev_time" type="time" value="${existing?existing.time||'':''}"
              style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);">
          </div>
        </div>
        <div>
          <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🏷️ Type</label>
          <select id="_cev_type" style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);">
            ${TYPES.map(t=>`<option value="${t}" ${existing&&existing.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:5px;">🎨 Colour</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${COLORS.map(c=>`<div onclick="document.querySelectorAll('._cev_col').forEach(x=>x.style.outline='none');this.style.outline='3px solid #000';document.getElementById('_cev_col_val').value='${c}'" class="_cev_col" style="width:28px;height:28px;border-radius:7px;background:${c};cursor:pointer;outline:${existing&&existing.color===c?'3px solid #000':'none'};"></div>`).join('')}
          </div>
          <input type="hidden" id="_cev_col_val" value="${existing?existing.color:COLORS[0]}">
        </div>
        <div>
          <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📝 Notes</label>
          <input id="_cev_note" value="${existing?existing.note||'':''}" placeholder="Optional notes…"
            style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);">
        </div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button onclick="document.getElementById('_calEvModal').remove()" style="flex:1;padding:10px;border:1.5px solid var(--bdr2);border-radius:9px;background:var(--card);font-family:Nunito,sans-serif;font-size:.88rem;cursor:pointer;">Cancel</button>
          <button onclick="APP._saveCalEvent('${editId||''}')" style="flex:2;padding:10px;background:var(--acc);color:#fff;border:none;border-radius:9px;font-family:Nunito,sans-serif;font-size:.88rem;font-weight:800;cursor:pointer;">💾 Save Event</button>
        </div>
        ${editId?`<button onclick="APP._delCalEvent('${editId}')" style="width:100%;padding:8px;background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:9px;font-family:Nunito,sans-serif;font-size:.82rem;cursor:pointer;margin-top:4px;">🗑 Delete Event</button>`:''}
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    setTimeout(()=>document.getElementById('_cev_title')?.focus(),100);
  },

  _saveCalEvent(editId){
    const title = (document.getElementById('_cev_title')||{}).value?.trim();
    const date  = (document.getElementById('_cev_date')||{}).value;
    if(!title||!date){ this.showToastMsg('⚠️ Title and date required!'); return; }
    const data = {
      title,
      date,
      time:  (document.getElementById('_cev_time')||{}).value||'',
      type:  (document.getElementById('_cev_type')||{}).value||'📅 Personal',
      color: (document.getElementById('_cev_col_val')||{}).value||'#1565c0',
      note:  (document.getElementById('_cev_note')||{}).value?.trim()||'',
    };
    const arr = this.getCalEvents();
    if(editId){
      const idx = arr.findIndex(e=>e.id===editId);
      if(idx>=0) arr[idx]={...arr[idx],...data};
    } else {
      data.id = uid(); data.created = new Date().toISOString();
      arr.push(data);
    }
    this.saveCalEvents(arr);
    document.getElementById('_calEvModal')?.remove();
    this.renderCalendar();
    this.showToastMsg('✅ Event saved!');
  },

  _delCalEvent(id){
    this.saveCalEvents(this.getCalEvents().filter(e=>e.id!==id));
    document.getElementById('_calEvModal')?.remove();
    this.renderCalendar();
    this.showToastMsg('🗑 Event deleted');
  },

  renderCalendar(){
    const yr=this.calY,mo=this.calM;
    const fd=new Date(yr,mo,1).getDay();
    const dim=new Date(yr,mo+1,0).getDate();
    const today=new Date();
    const evts={};
    const ae=(ds,c,l)=>{if(!ds)return;const d=new Date(ds);if(d.getFullYear()===yr&&d.getMonth()===mo){const k=d.getDate();if(!evts[k])evts[k]=[];evts[k].push({c,l});}};
    this.reminders.forEach(r=>{
      // Use trigDate (actual reminder date) first, fallback to exp for legacy
      const rTrigDate = r.trigDate || (()=>{
        if(r.mode==='recurring') return r.nextTrigger||r.start||null;
        if(!r.exp) return null;
        try{ const d=new Date(r.exp); d.setDate(d.getDate()-parseInt(r.before||0)); return d.toISOString().split('T')[0]; }catch(e){return r.exp;}
      })();
      if(rTrigDate) ae(rTrigDate,'#1a73e8','🔔'); // blue dot on reminder date
      if(r.exp && r.exp!==rTrigDate) ae(r.exp,'#b92d2d','⚠️');  // red dot on expiry
      if(r.issue) ae(r.issue,'#1760a0','📋');
    });
    this.visits.forEach(r=>{ae(r.date,'#1e7a45','💊');ae(r.next,'#5c3496','🏥');ae(r.next2,'#5c3496','🏥');ae(r.next3,'#5c3496','🏥');});
    this.trips.forEach(t=>{ae(t.dep,'#1a6e62','✈️');ae(t.ret,'#8a6500','🏁');});
    this.tenants.forEach(t=>{ae(t.start,'#b5701c','📝');ae(t.end,'#b92d2d','📄');});
    // Custom calendar events
    this.getCalEvents().forEach(ev=>{ae(ev.date, ev.color||'#1565c0', ev.title.slice(0,1)||'📅');});
    const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let cg=DOW.map(d=>`<div class="cal-dow">${d}</div>`).join('');
    for(let i=0;i<fd;i++)cg+=`<div class="cal-day other"></div>`;
    for(let day=1;day<=dim;day++){
      const iT=today.getDate()===day&&today.getMonth()===mo&&today.getFullYear()===yr;
      const evs=evts[day]||[];const hasOvd=evs.some(e=>e.c==='#b92d2d');
      const cls=`cal-day${iT?' today':''}${evs.length&&!iT&&!hasOvd?' has-event':''}${hasOvd?' has-overdue':''}`;
      cg+=`<div class="${cls}" onclick="APP.showCalendarDayPopup(${yr},${mo},${day})" style="cursor:pointer;" title="Click to see events"><div class="cal-day-num">${day}</div><div class="cal-dots">${evs.slice(0,4).map(e=>`<div class="cal-dot" style="background:${e.c}" title="${e.l}"></div>`).join('')}</div></div>`;
    }
    // Events list
    const allEvs=[];
    this.reminders.forEach(r=>{
      // Use trigDate for reminder event, expiry separately
      const rTrigDate = r.trigDate || (()=>{
        if(r.mode==='recurring') return r.nextTrigger||r.start||null;
        if(!r.exp) return null;
        try{ const d=new Date(r.exp); d.setDate(d.getDate()-parseInt(r.before||0)); return d.toISOString().split('T')[0]; }catch(e){return r.exp;}
      })();
      if(rTrigDate){
        const d=new Date(rTrigDate);
        if(d.getFullYear()===yr&&d.getMonth()===mo){
          const hh=r.alertHour||'10'; const mm2=r.alertMin||'00';
          allEvs.push({date:rTrigDate,label:r.name+(r.type?' — '+r.type:''),
            type:'🔔 Reminder'+(hh&&mm2?' at '+hh+':'+mm2:''),icon:'🔔',
            c:daysFrom(rTrigDate)!==null&&daysFrom(rTrigDate)<0?'var(--red)':'#1a73e8',_remId:r.id});
        }
      }
      // Also show expiry if different from trigger date
      if(r.exp && r.exp!==rTrigDate){
        const d=new Date(r.exp);
        if(d.getFullYear()===yr&&d.getMonth()===mo)
          allEvs.push({date:r.exp,label:r.name+' (Expires)',type:'⚠️ Expiry',icon:'⚠️',c:'var(--red)',_remId:r.id});
      }
      if(r.issue){const d=new Date(r.issue);if(d.getFullYear()===yr&&d.getMonth()===mo)allEvs.push({date:r.issue,label:r.name+' (Issue Date)',type:'📋 Issue',icon:'📋',c:'var(--blu)',_remId:r.id});}
    });
    this.visits.forEach(r=>{['date','next','next2','next3'].forEach(f=>{if(r[f]){const d=new Date(r[f]);if(d.getFullYear()===yr&&d.getMonth()===mo){const p=this.patients.find(x=>x.id===r.patId);allEvs.push({date:r[f],label:`${p?p.name:'?'} — Dr.${r.doctor}`,type:f==='date'?'Visit':'Follow-up',icon:f==='date'?'💊':'🏥',c:'var(--grn)',_visitId:r.id});}}});});
    this.trips.forEach(t=>{if(t.dep){const d=new Date(t.dep);if(d.getFullYear()===yr&&d.getMonth()===mo)allEvs.push({date:t.dep,label:`Depart: ${t.dest}`,type:'Travel',icon:'✈️',c:'var(--tel)',_tripId:t.id});}if(t.ret){const d=new Date(t.ret);if(d.getFullYear()===yr&&d.getMonth()===mo)allEvs.push({date:t.ret,label:`Return: ${t.dest}`,type:'Travel',icon:'🏁',c:'var(--ylw)',_tripId:t.id});}});
    // Add custom calendar events
    this.getCalEvents().forEach(ev=>{
      const d=new Date(ev.date);
      if(d.getFullYear()===yr&&d.getMonth()===mo){
        allEvs.push({date:ev.date,label:ev.title+(ev.time?' at '+ev.time:'')+(ev.note?' — '+ev.note:''),type:ev.type||'📅 Personal',icon:ev.type?ev.type.split(' ')[0]:'📅',c:ev.color||'#1565c0',_calEvId:ev.id});
      }
    });
    allEvs.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    const evList=allEvs.map(e=>{
      // Build delete action based on event type
      let delAction='';
      if(e._remId) delAction=`<button class="btn b-red b-sm" style="padding:3px 8px;font-size:.7rem;" onclick="APP.delReminder('${e._remId}')" title="Delete this reminder">🗑</button>`;
      else if(e._visitId) delAction=`<button class="btn b-red b-sm" style="padding:3px 8px;font-size:.7rem;" onclick="APP.delVisit('${e._visitId}')" title="Delete this visit">🗑</button>`;
      else if(e._tripId) delAction=`<button class="btn b-red b-sm" style="padding:3px 8px;font-size:.7rem;" onclick="APP.delTrip('${e._tripId}')" title="Delete this trip">🗑</button>`;
      else if(e._calEvId) delAction=`<button class="btn b-sm" style="padding:3px 8px;font-size:.7rem;background:#e3f2fd;color:#1565c0;border:1px solid #90b8e8;" onclick="APP.openCalEventModal('${e.date}','${e._calEvId}')" title="Edit event">✏️</button><button class="btn b-red b-sm" style="padding:3px 8px;font-size:.7rem;margin-left:3px;" onclick="APP._delCalEvent('${e._calEvId}')" title="Delete event">🗑</button>`;
      return`<div style="display:flex;align-items:center;gap:9px;padding:7px 12px;border-bottom:1px solid var(--bdr)">
        <span>${e.icon}</span>
        <div style="flex:1">
          <div style="font-size:.8rem;font-weight:600">${e.label}</div>
          <div style="font-size:.68rem;color:var(--mut)">${fD(e.date)} · ${e.type}</div>
        </div>
        <span class="badge" style="background:rgba(0,0,0,.05);color:${e.c}">${fD(e.date)}</span>
        ${delAction}
      </div>`;
    }).join('');

    document.getElementById('pan-calendar').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start;">
        <div>
          <div class="cal-wrap">
            <div class="cal-hdr">
              <div class="cal-title">📅 ${MONTHS[mo]} ${yr}</div>
              <div class="cal-nav">
                <button onclick="APP.calM--;if(APP.calM<0){APP.calM=11;APP.calY--;}APP.renderCalendar()">‹ Prev</button>
                <button onclick="APP.calY=new Date().getFullYear();APP.calM=new Date().getMonth();APP.renderCalendar()" style="background:var(--acc);color:#fff;border-color:var(--acc)">Today</button>
                <button onclick="APP.calM++;if(APP.calM>11){APP.calM=0;APP.calY++;}APP.renderCalendar()">Next ›</button>
                <button onclick="APP.openCalEventModal('${new Date(yr,mo,today.getDate()).toISOString().split('T')[0]}')" style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;border-radius:7px;padding:5px 10px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">+ Add Event</button>
              </div>
            </div>
            <div class="cal-grid">${cg}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:.72rem;">
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1a73e8;display:inline-block"></span>Reminder</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#b92d2d;display:inline-block"></span>Expiry</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1760a0;display:inline-block"></span>Issue</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1e7a45;display:inline-block"></span>Dr Visit</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#5c3496;display:inline-block"></span>Follow-up</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1a6e62;display:inline-block"></span>Travel</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1565c0;display:inline-block"></span>Personal Events</span>
          </div>
        </div>
        <div class="card" style="max-height:580px;overflow-y:auto;">
          <div class="card-hdr"><div class="card-title">📋 ${MONTHS[mo]} Events</div><span class="ct">${allEvs.length}</span></div>
          ${evList||'<div class="empty" style="padding:24px">No events</div>'}
        </div>
      </div>`;
  },

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

  // ══ TO DO LIST ══
  get todos(){try{return JSON.parse(localStorage.getItem('rk_todos')||'[]');}catch{return[];}},
  saveTodos(t){localStorage.setItem('rk_todos',JSON.stringify(t));if(window.fbSave)window.fbSave('todos',t).catch(()=>{});},
  _todoFilter:'all',
  addTodo(){
    const inp=document.getElementById('todoInp');
    const txt=inp?inp.value.trim():'';
    if(!txt)return;
    const pri=document.getElementById('todoPri')?document.getElementById('todoPri').value:'medium';
    const due=document.getElementById('todoDue')?document.getElementById('todoDue').value:'';
    const rec=document.getElementById('todoRec')?document.getElementById('todoRec').value:'none';
    const todos=this.todos;
    todos.push({id:uid(),text:txt,done:false,priority:pri,dueDate:due,recurring:rec,created:new Date().toISOString()});
    this.saveTodos(todos);inp.value='';
    if(document.getElementById('todoDue')) document.getElementById('todoDue').value='';
    this.renderTodo();this.renderPills();
  },
  toggleTodo(id){
    const todos=this.todos.map(t=>{
      if(t.id!==id) return t;
      const done=!t.done;
      // If recurring and marking done — auto-create next occurrence
      if(done && t.recurring && t.recurring!=='none' && t.dueDate){
        const d=new Date(t.dueDate);
        if(t.recurring==='daily') d.setDate(d.getDate()+1);
        else if(t.recurring==='weekly') d.setDate(d.getDate()+7);
        else if(t.recurring==='monthly') d.setMonth(d.getMonth()+1);
        const nextDate=d.toISOString().split('T')[0];
        setTimeout(()=>{
          const ts=this.todos;
          ts.push({id:uid(),text:t.text,done:false,priority:t.priority,dueDate:nextDate,recurring:t.recurring,created:new Date().toISOString()});
          this.saveTodos(ts);this.renderTodo();this.renderPills();
        },300);
      }
      return {...t,done,completedAt:done?new Date().toISOString():null};
    });
    this.saveTodos(todos);this.renderTodo();this.renderPills();
  },
  delTodo(id){
    this.saveTodos(this.todos.filter(t=>t.id!==id));
    this.renderTodo();this.renderPills();
  },
  setTodoFilter(f){this._todoFilter=f;this.renderTodo();},

  _clearDoneTodos(){
    if(!confirm('Sab completed tasks delete karen?')) return;
    this.saveTodos(this.todos.filter(t=>!t.done));
    this.renderTodo();this.renderPills();
    this.showToastMsg('✅ Completed tasks cleared!');
  },

  // ── Edit todo ──
  editTodo(id){
    const t=this.todos.find(x=>x.id===id);
    if(!t) return;
    // Build inline edit modal
    let modal=document.getElementById('_todoEditModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='_todoEditModal';
      modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
    }
    modal.innerHTML=`<div style="background:#fff;border-radius:14px;padding:20px;width:100%;max-width:480px;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="font-weight:800;font-size:1rem;margin-bottom:14px;">✏️ Edit Task</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div><label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Task</label>
          <input id="_te_text" value="${(t.text||'').replace(/"/g,'&quot;')}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:7px 10px;font-family:'Nunito',sans-serif;font-size:.9rem;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Priority</label>
            <select id="_te_pri" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.82rem;">
              <option value="high" ${t.priority==='high'?'selected':''}>🔴 High</option>
              <option value="medium" ${t.priority==='medium'?'selected':''}>🟡 Medium</option>
              <option value="low" ${t.priority==='low'?'selected':''}>🟢 Low</option>
            </select></div>
          <div><label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Due Date</label>
            <input type="date" id="_te_due" value="${t.dueDate||''}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.82rem;"></div>
        </div>
        <div><label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Repeat</label>
          <select id="_te_rec" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.82rem;">
            <option value="none" ${(!t.recurring||t.recurring==='none')?'selected':''}>No Repeat</option>
            <option value="daily" ${t.recurring==='daily'?'selected':''}>🔁 Daily</option>
            <option value="weekly" ${t.recurring==='weekly'?'selected':''}>🔁 Weekly</option>
            <option value="monthly" ${t.recurring==='monthly'?'selected':''}>🔁 Monthly</option>
          </select></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button onclick="document.getElementById('_todoEditModal').remove()" style="flex:1;padding:9px;border:1.5px solid var(--bdr2);border-radius:8px;background:var(--card);font-family:'Nunito',sans-serif;font-size:.85rem;cursor:pointer;">Cancel</button>
        <button onclick="APP._saveTodoEdit('${id}')" style="flex:2;padding:9px;background:#2c6fad;color:#fff;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-size:.85rem;font-weight:800;cursor:pointer;">💾 Save</button>
      </div>
    </div>`;
    modal.style.display='flex';
    setTimeout(()=>document.getElementById('_te_text')?.focus(),50);
  },

  _saveTodoEdit(id){
    const text=document.getElementById('_te_text')?.value.trim();
    if(!text){ this.showToastMsg('⚠️ Task text required!'); return; }
    const todos=this.todos.map(t=>t.id===id?{...t,
      text,
      priority:document.getElementById('_te_pri')?.value||t.priority,
      dueDate:document.getElementById('_te_due')?.value||'',
      recurring:document.getElementById('_te_rec')?.value||'none',
      updated:new Date().toISOString()
    }:t);
    this.saveTodos(todos);
    document.getElementById('_todoEditModal')?.remove();
    this.renderTodo();this.renderPills();
    this.showToastMsg('✅ Task updated!');
  },

  // ── Delete recurring task with options ──
  _delTodoConfirm(id){
    const t=this.todos.find(x=>x.id===id);
    if(!t) return;
    if(!t.recurring||t.recurring==='none'){ this.delTodo(id); return; }
    let modal=document.getElementById('_todoDelModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='_todoDelModal';
      modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
      document.body.appendChild(modal);
    }
    modal.innerHTML=`<div style="background:#fff;border-radius:14px;padding:20px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="font-weight:800;font-size:.95rem;margin-bottom:6px;">🗑 Delete Recurring Task</div>
      <div style="font-size:.82rem;color:var(--mut);margin-bottom:16px;">"${t.text}"</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button onclick="APP.delTodo('${id}');document.getElementById('_todoDelModal').remove()" style="padding:10px;background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:8px;font-family:'Nunito',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;text-align:left;">🗑 Delete this task only</button>
        <button onclick="APP._delAllRecurring('${id}');document.getElementById('_todoDelModal').remove()" style="padding:10px;background:#fff0f0;color:#c0392b;border:1.5px solid #f09090;border-radius:8px;font-family:'Nunito',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;text-align:left;">🗑🗑 Delete ALL recurring tasks with same name</button>
        <button onclick="document.getElementById('_todoDelModal').remove()" style="padding:8px;background:var(--card);border:1.5px solid var(--bdr2);border-radius:8px;font-family:'Nunito',sans-serif;font-size:.82rem;cursor:pointer;">Cancel</button>
      </div>
    </div>`;
    modal.style.display='flex';
  },

  _delAllRecurring(id){
    const t=this.todos.find(x=>x.id===id);
    if(!t) return;
    const remaining=this.todos.filter(x=>!(x.recurring===t.recurring&&x.text===t.text));
    this.saveTodos(remaining);
    this.renderTodo();this.renderPills();
    this.showToastMsg('✅ All recurring instances deleted!');
  },

  // ── Drag and drop reorder ──
  _todoDragStart(e){
    e.dataTransfer.setData('text/plain',e.currentTarget.dataset.id);
    e.dataTransfer.effectAllowed='move';
    e.currentTarget.style.opacity='0.4';
    e.currentTarget.style.transform='scale(0.98)';
  },
  _todoDragOver(e){
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    // Only highlight the closest todo-item ancestor
    const el=e.currentTarget;
    el.style.background='#e8f5e9';
    el.style.borderTop='2px solid #1a7a45';
  },
  _todoDragLeave(e){
    e.currentTarget.style.background='';
    e.currentTarget.style.borderTop='';
  },
  _todoDragEnd(e){
    // Reset all items in case drop target didn't clean up
    document.querySelectorAll('.todo-item').forEach(el=>{
      el.style.opacity='';
      el.style.transform='';
      el.style.background='';
      el.style.borderTop='';
    });
  },
  _todoDrop(e){
    e.preventDefault();
    e.stopPropagation();
    const fromId=e.dataTransfer.getData('text/plain');
    const dropEl=e.currentTarget;
    const toId=dropEl.dataset.id;
    dropEl.style.background='';
    dropEl.style.borderTop='';
    if(!fromId||!toId||fromId===toId) return;
    const todos=[...this.todos];
    const fromIdx=todos.findIndex(t=>t.id===fromId);
    const toIdx=todos.findIndex(t=>t.id===toId);
    if(fromIdx<0||toIdx<0) return;
    const [moved]=todos.splice(fromIdx,1);
    todos.splice(toIdx,0,moved);
    this.saveTodos(todos);
    this.renderTodo();
  },


  // ════════════════════════════════════════════════════════════════
  // SUBTASKS — stored inside each todo as todo.subtasks = [{id,text,done}]
  // ════════════════════════════════════════════════════════════════
  _getSubtasks(todoId){
    const t=this.todos.find(x=>x.id===todoId);
    return (t&&Array.isArray(t.subtasks))?t.subtasks:[];
  },
  _saveSubtasks(todoId,subtasks){
    const todos=this.todos.map(t=>t.id===todoId?{...t,subtasks}:t);
    this.saveTodos(todos);
  },
  addSubtask(todoId){
    const inp=document.getElementById('_sub_inp_'+todoId);
    const text=inp?inp.value.trim():'';
    if(!text)return;
    const subs=this._getSubtasks(todoId);
    subs.push({id:'s'+Date.now(),text,done:false});
    this._saveSubtasks(todoId,subs);
    this.renderTodo();
    // Re-expand
    setTimeout(()=>{ const el=document.getElementById('_subs_'+todoId); if(el)el.style.display=''; },10);
  },
  toggleSubtask(todoId,subId){
    const subs=this._getSubtasks(todoId).map(s=>s.id===subId?{...s,done:!s.done}:s);
    this._saveSubtasks(todoId,subs);
    this.renderTodo();
    setTimeout(()=>{ const el=document.getElementById('_subs_'+todoId); if(el)el.style.display=''; },10);
  },
  delSubtask(todoId,subId){
    const subs=this._getSubtasks(todoId).filter(s=>s.id!==subId);
    this._saveSubtasks(todoId,subs);
    this.renderTodo();
    setTimeout(()=>{ const el=document.getElementById('_subs_'+todoId); if(el)el.style.display=''; },10);
  },

  // ════════════════════════════════════════════════════════════════
  // HABIT TRACKER
  // localStorage: rk_habits  →  [{id,name,emoji,color,targetDays,createdAt}]
  // localStorage: rk_habit_logs  →  {habitId: ['2026-04-01','2026-04-02',...]}
  // ════════════════════════════════════════════════════════════════
  get habits(){ try{ return JSON.parse(localStorage.getItem('rk_habits')||'[]'); }catch{ return []; } },
  saveHabits(arr){ localStorage.setItem('rk_habits',JSON.stringify(arr)); if(window.fbSave) window.fbSave('habits',arr).catch(()=>{}); },
  getHabitLogs(habitId){ try{ return JSON.parse(localStorage.getItem('rk_hlog_'+habitId)||'[]'); }catch{ return []; } },
  saveHabitLogs(habitId,arr){ localStorage.setItem('rk_hlog_'+habitId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('hlog_'+habitId,arr).catch(()=>{}); },

  toggleHabitDay(habitId, dateStr){
    const logs=this.getHabitLogs(habitId);
    const idx=logs.indexOf(dateStr);
    if(idx>=0) logs.splice(idx,1);
    else logs.push(dateStr);
    this.saveHabitLogs(habitId,logs);
    this.renderTodo();
  },

  _habitStreak(habitId){
    const logs=new Set(this.getHabitLogs(habitId));
    const today=new Date(); today.setHours(0,0,0,0);
    let streak=0;
    let d=new Date(today);
    // Check today first; if not done, start from yesterday
    const todayStr=d.toISOString().split('T')[0];
    if(!logs.has(todayStr)) d.setDate(d.getDate()-1);
    while(true){
      const ds=d.toISOString().split('T')[0];
      if(!logs.has(ds)) break;
      streak++;
      d.setDate(d.getDate()-1);
      if(streak>365) break;
    }
    return streak;
  },

  _habitCompletionRate(habitId, days=30){
    const logs=new Set(this.getHabitLogs(habitId));
    const today=new Date(); today.setHours(0,0,0,0);
    let done=0;
    for(let i=0;i<days;i++){
      const d=new Date(today); d.setDate(d.getDate()-i);
      if(logs.has(d.toISOString().split('T')[0])) done++;
    }
    return Math.round((done/days)*100);
  },

  addHabit(){
    const name=(document.getElementById('_hab_name')||{}).value?.trim();
    if(!name){ this.showToastMsg('⚠️ Habit name required!'); return; }
    const emoji=(document.getElementById('_hab_emoji')||{}).value||'⭐';
    const color=(document.getElementById('_hab_color')||{}).value||'#1a7a45';
    const habits=this.habits;
    habits.push({id:'h'+Date.now(),name,emoji,color,createdAt:new Date().toISOString()});
    this.saveHabits(habits);
    this.showToastMsg('✅ Habit "'+name+'" added!');
    this.renderTodo();
  },

  delHabit(id){
    this.saveHabits(this.habits.filter(h=>h.id!==id));
    localStorage.removeItem('rk_hlog_'+id);
    this.renderTodo();
    this.showToastMsg('🗑 Habit deleted');
  },

  renderHabits(){
    const today=new Date(); today.setHours(0,0,0,0);
    const todayStr=today.toISOString().split('T')[0];
    const DOW=['S','M','T','W','T','F','S'];
    const habits=this.habits;

    // Build 4-week grid (28 days) ending today
    const buildGrid=(habitId,color)=>{
      const logs=new Set(this.getHabitLogs(habitId));
      const days=[];
      for(let i=27;i>=0;i--){
        const d=new Date(today); d.setDate(d.getDate()-i);
        days.push(d);
      }
      const startDow=days[0].getDay();
      // DOW header row
      let html='<div class="habit-grid">';
      DOW.forEach(d=>{ html+=`<div class="habit-dow">${d}</div>`; });
      // Blank cells for alignment
      for(let i=0;i<startDow;i++) html+='<div></div>';
      days.forEach(d=>{
        const ds=d.toISOString().split('T')[0];
        const isFuture=d>today;
        const isToday=ds===todayStr;
        const isDone=logs.has(ds);
        const dayNum=d.getDate();
        let cls='habit-cell';
        if(isFuture) cls+=' future';
        else if(isDone) cls+=' done';
        else if(ds<todayStr) cls+=' missed';
        if(isToday) cls+=' today';
        const style=isDone?`background:${color};border-color:${color};`:'';
        html+=isFuture
          ?`<div class="${cls}" style="${style}">${dayNum}</div>`
          :`<div class="${cls}" style="${style}" onclick="APP.toggleHabitDay('${habitId}','${ds}')" title="${ds}">${dayNum}</div>`;
      });
      html+='</div>';
      return html;
    };

    const habitCards=habits.map(h=>{
      const streak=this._habitStreak(h.id);
      const rate=this._habitCompletionRate(h.id,28);
      const logs=this.getHabitLogs(h.id);
      const doneToday=logs.includes(todayStr);
      return `<div class="habit-card">
        <div class="habit-head">
          <div class="habit-emoji" style="background:${h.color}22;">${h.emoji}</div>
          <div style="flex:1;min-width:0;">
            <div class="habit-name">${h.name}</div>
            <div style="font-size:.68rem;color:var(--mut);">${rate}% last 28 days · ${logs.length} total days</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            <div class="habit-streak">${streak>0?'🔥 '+streak+' day streak':'—'}</div>
            <button onclick="APP.delHabit('${h.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.72rem;padding:0;">🗑</button>
          </div>
        </div>
        <!-- Today quick-check -->
        <div style="padding:8px 14px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:.78rem;font-weight:700;">Today</span>
          <button onclick="APP.toggleHabitDay('${h.id}','${todayStr}')"
            style="padding:5px 16px;border-radius:20px;border:2px solid ${doneToday?h.color:'var(--bdr2)'};background:${doneToday?h.color+'22':'transparent'};color:${doneToday?h.color:'var(--mut)'};font-weight:800;font-size:.78rem;cursor:pointer;font-family:'Nunito',sans-serif;transition:all .2s;">
            ${doneToday?'✅ Done!':'○ Mark Done'}
          </button>
        </div>
        ${buildGrid(h.id,h.color)}
      </div>`;
    }).join('');

    return `
      <!-- Add habit form -->
      <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:14px;padding:14px;margin-bottom:14px;box-shadow:var(--sh);">
        <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">➕ Add New Habit</div>
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:end;">
          <div>
            <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Habit Name</label>
            <input id="_hab_name" placeholder="e.g. Morning Walk, Read 30min, Meditate…"
              style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:7px 10px;font-family:'Nunito',sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);"
              onkeydown="if(event.key==='Enter')APP.addHabit()">
          </div>
          <div>
            <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Icon</label>
            <input id="_hab_emoji" value="⭐" maxlength="2"
              style="width:52px;border:1.5px solid var(--bdr2);border-radius:7px;padding:7px 8px;font-size:1.1rem;text-align:center;background:var(--bg);color:var(--txt);">
          </div>
          <div>
            <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Colour</label>
            <input id="_hab_color" type="color" value="#1a7a45"
              style="width:40px;height:36px;border:1.5px solid var(--bdr2);border-radius:7px;padding:2px;cursor:pointer;background:var(--bg);">
          </div>
        </div>
        <button onclick="APP.addHabit()" style="width:100%;margin-top:10px;background:var(--acc);color:#fff;border:none;border-radius:9px;padding:9px;font-family:'Nunito',sans-serif;font-size:.88rem;font-weight:800;cursor:pointer;">✅ Add Habit</button>
      </div>

      ${habits.length
        ? habitCards
        : `<div class="empty" style="padding:40px;"><div class="ei">🌱</div>No habits yet.<br>Add your first habit above to start tracking!</div>`
      }`;
  },

  renderTodo(){
    const now=new Date(); now.setHours(0,0,0,0);
    const todayStr=now.toISOString().split('T')[0];
    const tomorrowStr=new Date(now.getTime()+86400000).toISOString().split('T')[0];
    const in7Str=new Date(now.getTime()+7*86400000).toISOString().split('T')[0];

    const priLabel={high:'🔴 High',medium:'🟡 Medium',low:'🟢 Low'};
    const priClass={high:'todo-pri-high',medium:'todo-pri-med',low:'todo-pri-low'};
    const recLabel={none:'',daily:'🔁 Daily',weekly:'🔁 Weekly',monthly:'🔁 Monthly'};

    function dueInfo(d){
      if(!d) return {label:'',cls:'todo-due-ok'};
      if(d<todayStr) return {label:'⚠️ Overdue',cls:'todo-due-over'};
      if(d===todayStr) return {label:'📅 Today',cls:'todo-due-today'};
      if(d===tomorrowStr) return {label:'📅 Tomorrow',cls:'todo-due-soon'};
      if(d<=in7Str) return {label:'📅 This week',cls:'todo-due-soon'};
      return {label:'📅 '+fD(d),cls:'todo-due-ok'};
    }

    const f=this._todoFilter||'all';
    let todos=this.todos;
    // Filter
    let filtered=todos.filter(t=>!t.done);
    if(f==='high') filtered=filtered.filter(t=>t.priority==='high');
    else if(f==='medium') filtered=filtered.filter(t=>t.priority==='medium');
    else if(f==='low') filtered=filtered.filter(t=>t.priority==='low');
    else if(f==='overdue') filtered=filtered.filter(t=>t.dueDate&&t.dueDate<todayStr);
    else if(f==='today') filtered=filtered.filter(t=>t.dueDate===todayStr);
    else if(f==='recurring') filtered=filtered.filter(t=>t.recurring&&t.recurring!=='none');
    // Sort: high first, then by due date
    filtered.sort((a,b)=>{
      const po={high:0,medium:1,low:2};
      if((po[a.priority]||1)!==(po[b.priority]||1)) return (po[a.priority]||1)-(po[b.priority]||1);
      if(a.dueDate&&b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if(a.dueDate) return -1; if(b.dueDate) return 1;
      return 0;
    });
    const done=todos.filter(t=>t.done);

    // Counts for filter bar
    const overdueCount=todos.filter(t=>!t.done&&t.dueDate&&t.dueDate<todayStr).length;
    const todayCount=todos.filter(t=>!t.done&&t.dueDate===todayStr).length;
    const highCount=todos.filter(t=>!t.done&&t.priority==='high').length;

    const makeRow=(x)=>{
      const du=dueInfo(x.dueDate);
      const pc=priClass[x.priority]||'todo-pri-med';
      const pl=priLabel[x.priority]||'🟡 Medium';
      const rl=recLabel[x.recurring]||'';
      const isRec=x.recurring&&x.recurring!=='none';
      const subs=Array.isArray(x.subtasks)?x.subtasks:[];
      const subsDone=subs.filter(s=>s.done).length;
      const hasSubs=subs.length>0;
      const subsPct=hasSubs?Math.round(subsDone/subs.length*100):0;
      const subBar=hasSubs?`<div style="display:flex;align-items:center;gap:6px;margin-top:4px;cursor:pointer;" onclick="(function(){var el=document.getElementById('_subs_${x.id}');if(el)el.style.display=el.style.display==='none'?'':'none';})()">
        <div style="flex:1;height:4px;background:var(--dim);border-radius:2px;overflow:hidden;"><div style="width:${subsPct}%;height:100%;background:var(--grn);border-radius:2px;"></div></div>
        <span style="font-size:.62rem;color:var(--mut);white-space:nowrap;">${subsDone}/${subs.length} subtasks</span>
      </div>`:'';
      const subList=`<div id="_subs_${x.id}" style="${hasSubs?'':'display:none'}">
        ${hasSubs?`<div class="subtask-list">${subs.map(s=>`
          <div class="subtask-row">
            <input type="checkbox" ${s.done?'checked':''} onchange="APP.toggleSubtask('${x.id}','${s.id}')">
            <span class="${s.done?'subtask-done':''}" style="flex:1;">${s.text}</span>
            <button onclick="APP.delSubtask('${x.id}','${s.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.7rem;padding:0 2px;">✕</button>
          </div>`).join('')}</div>`:''}
        <div class="subtask-add">
          <input id="_sub_inp_${x.id}" placeholder="+ Add subtask…" onkeydown="if(event.key==='Enter')APP.addSubtask('${x.id}')"
            style="flex:1;background:var(--bg);border:1.5px solid var(--bdr2);border-radius:6px;padding:4px 8px;font-family:'Nunito',sans-serif;font-size:.76rem;color:var(--txt);">
          <button onclick="APP.addSubtask('${x.id}')" style="background:var(--acc);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:.76rem;font-weight:700;cursor:pointer;">+</button>
        </div>
      </div>`;
      return `<div class="todo-item ${x.done?'done':''}" style="display:block;padding:0;${x.priority==='high'&&!x.done?'border-left:3px solid #e05050;':''}" draggable="true" data-id="${x.id}" ondragstart="APP._todoDragStart(event)" ondragover="APP._todoDragOver(event)" ondragleave="APP._todoDragLeave(event)" ondragend="APP._todoDragEnd(event)" ondrop="APP._todoDrop(event)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:9px 14px;">
          <div style="display:flex;align-items:flex-start;gap:8px;flex:1;min-width:0;padding-top:1px;">
            <span style="cursor:grab;color:var(--mut);font-size:.9rem;margin-top:3px;flex-shrink:0;" title="Drag to reorder">⠿</span>
            <input type="checkbox" class="todo-check" ${x.done?'checked':''} onchange="APP.toggleTodo('${x.id}')" style="margin-top:3px;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
              <span class="todo-text" style="word-break:break-word;display:block;margin-bottom:3px;">${APP.displayText(APP.cleanText(x.text))}${x.fromReminder?'<span style="font-size:.58rem;background:var(--dim);border-radius:4px;padding:1px 5px;margin-left:4px;color:var(--mut);">🔔</span>':''}</span>
              <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
                <span class="${pc}">${pl}</span>
                ${du.label?`<span class="${du.cls}">${du.label}</span>`:''}
                ${rl?`<span style="font-size:.6rem;color:var(--acc);font-weight:700;">${rl}</span>`:''}
              </div>
              ${subBar}
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;margin-top:1px;">
            <button onclick="(function(){var el=document.getElementById('_subs_${x.id}');if(el)el.style.display=el.style.display==='none'?'':'none';})()" title="Subtasks" style="background:${hasSubs?'#e3f2fd':'var(--dim)'};border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.72rem;color:${hasSubs?'#1565c0':'var(--mut)'};">☰</button>
            <button onclick="APP.editTodo('${x.id}')" title="Edit" style="background:var(--dim);border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.75rem;">✏️</button>
            <button class="todo-del" onclick="${isRec?`APP._delTodoConfirm('${x.id}')`:`APP.delTodo('${x.id}')`}" title="Delete" style="flex-shrink:0;">🗑</button>
          </div>
        </div>
        ${subList}
      </div>`;
    };

    const pendingRows=filtered.length
      ? filtered.map(makeRow).join('')
      : '<div style="padding:18px;text-align:center;color:var(--mut);font-size:.84rem;">'+(f==='all'?'🎉 Sab kaam ho gaya!':'No tasks in this filter')+'</div>';

    const doneSection=done.length?`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 14px;font-size:.72rem;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-top:1px solid var(--bdr);">
        <span>✅ Completed (${done.length})</span>
        <button onclick="APP._clearDoneTodos()" style="background:none;border:1px solid rgba(229,57,53,.3);border-radius:5px;padding:2px 8px;font-size:.68rem;color:#e53935;cursor:pointer;">🗑 Clear All</button>
      </div>
      <div class="todo-list" style="max-height:none;">${done.slice(0,5).map(makeRow).join('')}${done.length>5?`<div style="text-align:center;padding:6px;font-size:.72rem;color:var(--mut);">+${done.length-5} more completed</div>`:''}</div>`:'';

    const filterBtns=[
      {k:'all',label:'All ('+todos.filter(t=>!t.done).length+')'},
      {k:'high',label:'🔴 High'+(highCount?` (${highCount})`:'')},
      {k:'medium',label:'🟡 Medium'},
      {k:'low',label:'🟢 Low'},
      {k:'overdue',label:'⚠️ Overdue'+(overdueCount?` (${overdueCount})`:'')},
      {k:'today',label:'📅 Today'+(todayCount?` (${todayCount})`:'')},
      {k:'recurring',label:'🔁 Recurring'},
    ].map(b=>`<button class="todo-filter-btn ${f===b.k?'on':''}" onclick="APP.setTodoFilter('${b.k}')">${b.label}</button>`).join('');

    const _todoSub = this._todoSub || 'tasks';
    document.getElementById('pan-todo').innerHTML=`
      <div class="sec-hdr">
        <div class="sec-title">✅ Tasks &amp; Habits</div>
      </div>
      <!-- Sub-tabs -->
      <div class="stabs" style="margin-bottom:14px;">
        <button class="stab ${_todoSub==='tasks'?'on':''}" onclick="APP._todoSub='tasks';APP.renderTodo()">
          ✅ To-Do <span class="ct" style="margin-left:4px;">${todos.filter(t=>!t.done).length}</span>
        </button>
        <button class="stab ${_todoSub==='habits'?'on':''}" onclick="APP._todoSub='habits';APP.renderTodo()">
          🔥 Habits <span class="ct" style="margin-left:4px;">${this.habits.length}</span>
        </button>
      </div>

      ${_todoSub==='tasks'?`
      <!-- TASKS TAB -->
      <div class="todo-wrap" style="max-width:720px;">
        <div class="todo-hdr"><div style="font-weight:700;font-size:.9rem;">📝 Add New Task</div></div>
        <div style="padding:10px 14px;border-bottom:1px solid var(--bdr);display:flex;flex-direction:column;gap:8px;background:var(--card2);">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <input class="todo-input" id="todoInp" placeholder="Kya karna hai? e.g. Rent collect karo…" onkeydown="if(event.keyCode===13)APP.addTodo()" style="flex:1;min-width:160px;">
            <select id="todoPri" style="background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.8rem;cursor:pointer;">
              <option value="high">🔴 High</option>
              <option value="medium" selected>🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <input type="date" id="todoDue" title="Due date" style="background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:5px 8px;font-family:'Nunito',sans-serif;font-size:.79rem;flex:1;min-width:130px;">
            <select id="todoRec" style="background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:5px 8px;font-family:'Nunito',sans-serif;font-size:.79rem;flex:1;min-width:110px;">
              <option value="none">No Repeat</option>
              <option value="daily">🔁 Daily</option>
              <option value="weekly">🔁 Weekly</option>
              <option value="monthly">🔁 Monthly</option>
            </select>
            <button class="btn b-gold b-sm" onclick="APP.addTodo()" style="padding:7px 16px;white-space:nowrap;">＋ Add Task</button>
          </div>
        </div>
        <div class="todo-filter-bar">${filterBtns}</div>
        <div class="todo-list" style="max-height:none;">${pendingRows}</div>
        ${doneSection}
      </div>
      `:/* HABITS TAB */`
      <div style="max-width:720px;">${this.renderHabits()}</div>
      `}`;
  },

  // ══ AUTO-LINK: Universal URL → clickable link (XSS-safe) ══
  // ══ AUTO-LINK v2 — Universal URL detector, XSS-safe, double-parse proof ══
  autoLink(text){
    if(!text) return '';
    // Step 1: If input already has HTML tags (already processed), skip re-parsing
    // Only process plain text — if contains <a href it's already linked
    const str = String(text);
    if(str.includes('<a ') && str.includes('href=')) return str; // already linked

    // Step 2: Escape HTML to prevent XSS
    const safe = str
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');

    // Step 3: Detect URLs (https / http / www)
    const urlRx = /((https?:\/\/|www\.)[^\s<>"'(){}\[\]]{2,}[^\s<>"'(){}\[\].,!?;:'"\)])/gi;
    return safe.replace(urlRx,(match)=>{
      const href = match.startsWith('www.') ? 'https://'+match : match;
      const display = match.length > 50 ? match.slice(0,47)+'…' : match;
      return '<a href="'+href+'" target="_blank" rel="noopener noreferrer" '
        +'class="auto-link" '
        +'style="color:#2c6fad;font-weight:600;text-decoration:underline;cursor:pointer;word-break:break-all;'
        +'display:inline-flex;align-items:center;gap:2px;" '
        +'title="'+href+'" '
        +'onclick="event.stopPropagation()">🔗 '+display+'</a>';
    });
  },
  // autoLinkBr: autoLink + newlines → <br> (for multi-line content)
  autoLinkBr(text){
    if(!text) return '';
    return this.autoLink(text).replace(/\n/g,'<br>');
  },
  // autoLinkSafe: for when text may already contain HTML (highlight marks etc.)
  autoLinkSafe(html_text){
    if(!html_text) return '';
    if(!html_text.includes('http') && !html_text.includes('www.')) return html_text;
    return html_text.replace(/(<a[^>]*>.*?<\/a>)|([^<]+)/gi, (match, linked, plain)=>{
      if(linked) return linked;
      if(plain) return this.autoLink(plain);
      return match;
    });
  },

  // ══ CLEAN TEXT: Remove unwanted wrapping quotes from stored text ══
  cleanText(text){
    if(!text && text !== 0) return '';
    let s = String(text).trim();
    // Remove wrapping double-quotes: "hello" → hello
    if(s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1,-1);
    // Remove wrapping single-quotes: 'hello' → hello
    if(s.length >= 2 && s.startsWith("'") && s.endsWith("'")) s = s.slice(1,-1);
    return s;
  },

  // ══ DISPLAY TEXT: cleanText + autoLink combined (use in all text rendering) ══
  displayText(text, multiline){
    const cleaned = this.cleanText(text);
    if(multiline) return this.autoLinkBr(cleaned);
    return this.autoLink(cleaned);
  },

  // ══ NOTEPAD (Home Dashboard Widget) ══
  // AIC Notepad widget — compact, tabs only, no preview
  renderNotepad(){
    const cats = this._getNoteCategories();
    const tabBtns = cats.map(cat => {
      const hasContent = !!this._getNoteContent(cat).trim();
      return `<button class="np-cat-btn" onclick="APP._npOpenEditor('${cat}')"
        title="${hasContent ? 'Has notes' : 'Empty'}">
        ${hasContent ? '📝' : '📄'} ${cat}
      </button>`;
    }).join('');
    return `<div class="np-widget">
      <div style="padding:10px 14px 4px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <div style="font-weight:800;font-size:.88rem;">📝 Notepad</div>
        <div style="display:flex;gap:5px;align-items:center;">
          <button onclick="APP._npOpenSearch()" style="background:#eff6ff;color:#1760a0;border:1.5px solid #90b8e8;border-radius:8px;padding:4px 10px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;" title="Search in all notes">🔍 Search</button>
          <button onclick="APP._npOpenImport()" style="background:#f0fdf4;color:#1e7a45;border:1.5px solid #86efac;border-radius:8px;padding:4px 10px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;" title="Import text, QR, link">📥 Import</button>
          <button class="btn b-sm b-out" onclick="APP.goTab('notepad')" style="font-size:.68rem;padding:3px 9px;">All ↗</button>
        </div>
      </div>
      <div class="np-cat-tabs">${tabBtns}</div>
    </div>`;
  },

  // ══ DIARY ══
  getDiaryEntries(){try{return JSON.parse(localStorage.getItem('rk_diary')||'[]');}catch{return[];}},
  saveDiaryEntries(e){localStorage.setItem('rk_diary',JSON.stringify(e));if(window.fbSave)window.fbSave('diary',e).catch(()=>{});},

  saveDiaryEntry(){
    const date=vDate('diary_date')||(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    const title=document.getElementById('diary_title').value.trim();
    const body=document.getElementById('diary_body').value.trim();
    const tags=document.getElementById('diary_tags').value.trim();
    if(!body){alert('Kuch likhein!');return;}
    const mood = document.getElementById('diary_mood')?.value||'';
    const photo = document.getElementById('diary_photo')?.value?.trim()||'';
    const entries=this.getDiaryEntries();
    const id=this.diaryEditId||uid();
    if(this.diaryEditId){
      const idx=entries.findIndex(e=>e.id===id);
      if(idx>=0)entries[idx]={...entries[idx],date,title,body,tags,mood,photo,updated:new Date().toISOString()};
    } else {
      entries.unshift({id,date,title,body,tags,mood,photo,created:new Date().toISOString()});
    }
    this.saveDiaryEntries(entries);
    this.diaryEditId=null;
    this.renderDiary();
  },

  delDiaryEntry(id){
    if(!confirm('Delete this diary entry?'))return;
    this.saveDiaryEntries(this.getDiaryEntries().filter(e=>e.id!==id));
    this.renderDiary();
  },

  editDiaryEntry(id){
    const e=this.getDiaryEntries().find(x=>x.id===id);if(!e)return;
    this.diaryEditId=id;
    svDate('diary_date',e.date);
    document.getElementById('diary_title').value=e.title||'';
    document.getElementById('diary_body').value=e.body||'';
    document.getElementById('diary_tags').value=e.tags||'';
    if(document.getElementById('diary_mood')) document.getElementById('diary_mood').value=e.mood||'';
    if(document.getElementById('diary_photo')) document.getElementById('diary_photo').value=e.photo||'';
    document.getElementById('diary_form_area').scrollIntoView({behavior:'smooth'});
  },

  searchDiary(){
    const q=(document.getElementById('diary_search').value||'').toLowerCase().trim();
    this.diaryQuery=q;
    this.renderDiaryList();
  },

  highlightText(text,query){
    if(!query)return text;
    // Highlight every match — numbers, letters, words all
    const escaped=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return text.replace(new RegExp('('+escaped+')','gi'),'<mark style="background:#ffe066;border-radius:2px;padding:0 1px">$1</mark>');
  },

  renderDiaryList(){
    const entries=this.getDiaryEntries();
    const q=this.diaryQuery||'';
    const moodF=this._diaryMoodFilter||'';
    let filtered=entries;
    if(q) filtered=filtered.filter(e=>(e.body+e.title+e.tags+e.date).toLowerCase().includes(q));
    if(moodF) filtered=filtered.filter(e=>(e.mood||'')=== moodF);
    const container=document.getElementById('diary_list');
    if(!container)return;
    if(!filtered.length){
      container.innerHTML=`<div class="empty" style="padding:24px">${q?'🔍 No results for "'+q+'"':'📖 No entries yet. Write your first diary entry!'}</div>`;
      return;
    }
    // Track expanded state
    if(!this._diaryExpanded) this._diaryExpanded = {};
    container.innerHTML=filtered.map(e=>{
      const isExpanded = this._diaryExpanded[e.id] || false;
      const bodyPreview = e.body.substring(0,180)+(e.body.length>180?'...':'');
      const bodyFull = e.body;
      const displayBody = isExpanded ? bodyFull : bodyPreview;
      const bodyHl=this.autoLinkSafe(this.highlightText(this.cleanText(displayBody),q));
      const titleHl=this.highlightText(e.title||'',q);
      const tagsArr=(e.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
      const needsExpand = e.body.length > 180;
      return`<div class="card" style="margin-bottom:10px;">
        <div class="card-hdr" style="padding:9px 14px;cursor:pointer;" onclick="APP._diaryExpanded['${e.id}']=!APP._diaryExpanded['${e.id}'];APP.renderDiaryList()">
          <div style="flex:1;">
            <div style="font-weight:800;font-size:.9rem">${titleHl||'<span style="color:var(--mut);font-style:italic">No title</span>'}</div>
            <div style="font-size:.7rem;color:var(--mut);font-family:\'JetBrains Mono\',monospace;margin-top:2px">${fD(e.date)} ${e.updated?'· edited':''} ${needsExpand?'· <span style="color:var(--acc);">'+(isExpanded?'▲ Collapse':'▼ Expand')+'</span>':''}</div>
          </div>
          <div style="display:flex;gap:5px;" onclick="event.stopPropagation()">
            <button class="btn b-out b-sm" onclick="APP.editDiaryEntry('${e.id}')">✏️</button>
            <button class="btn b-red b-sm" onclick="APP.delDiaryEntry('${e.id}')">🗑</button>
          </div>
        </div>
        ${e.mood?`<div style="padding:6px 14px 0;"><span style="background:var(--dim);border-radius:8px;padding:3px 10px;font-size:.76rem;font-weight:700;">${e.mood}</span></div>`:''}
        ${e.photo?`<div style="padding:8px 14px 0;"><img src="${e.photo}" alt="Memory" style="width:100%;max-height:200px;object-fit:cover;border-radius:9px;border:1px solid var(--bdr);" onerror="this.style.display='none'"></div>`:''}
        <div style="padding:10px 14px;font-size:.84rem;line-height:1.7;white-space:pre-wrap;word-break:break-word;">${bodyHl}</div>
        ${needsExpand?`<div style="padding:4px 14px 10px;text-align:center;"><button style="background:transparent;border:1px solid var(--bdr2);border-radius:6px;padding:3px 12px;font-size:.72rem;color:var(--acc);cursor:pointer;" onclick="APP._diaryExpanded['${e.id}']=!APP._diaryExpanded['${e.id}'];APP.renderDiaryList()">${isExpanded?'▲ Show Less':'▼ Read More'}</button></div>`:''}
        ${tagsArr.length?`<div style="padding:5px 14px 10px;display:flex;flex-wrap:wrap;gap:4px">${tagsArr.map(t=>`<span style="background:var(--dim);color:var(--mut);padding:2px 8px;border-radius:10px;font-size:.7rem;">#${this.highlightText(t,q)}</span>`).join('')}</div>`:''}
      </div>`;
    }).join('');
  },

  renderDiary(){
    this.diaryQuery=this.diaryQuery||'';
    const today=(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    document.getElementById('pan-diary').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:16px;align-items:start;">

        <!-- LEFT: Write Entry -->
        <div>
          <div class="sec-hdr"><div class="sec-title">📖 Diary <span class="ct">${this.getDiaryEntries().length} entries</span></div></div>
          <div id="diary_form_area" class="card">
            <div class="card-hdr"><div class="card-title">${this.diaryEditId?'✏️ Edit Entry':'✍️ New Entry'}</div>
              ${this.diaryEditId?`<button class="btn b-out b-sm" onclick="APP.diaryEditId=null;APP.renderDiary()">Cancel</button>`:''}
            </div>
            <div class="card-body" style="gap:8px;">
              <div class="fg"><label>📅 Date (DD/MM/YYYY)</label><div id="diary_date_wrap"></div></div>
              <div class="fg"><label>Title / Subject</label><input id="diary_title" placeholder="e.g. Court hearing, Property visit, Family..." style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:7px 10px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.84rem;outline:none;width:100%;"></div>
              <div class="fg"><label>Entry *</label><textarea id="diary_body" placeholder="Aaj kya hua? Notes, meetings, thoughts, numbers, contacts..." style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:8px 10px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.84rem;outline:none;width:100%;min-height:140px;resize:vertical;line-height:1.7;"></textarea></div>
              <div class="fg"><label>Tags (comma separated)</label><input id="diary_tags" placeholder="court, property, family, urgent..." style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:7px 10px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.84rem;outline:none;width:100%;"></div>
              <div class="fg">
                <label>📷 Photo / Image URL <span style="font-size:.65rem;color:var(--mut);">(optional — paste any image link)</span></label>
                <input id="diary_photo" placeholder="https://... or leave blank"
                  style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:7px 10px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.84rem;outline:none;width:100%;">
              </div>
              <div class="fg">
                <label>😊 Mood</label>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                  ${['😊 Happy','😐 Neutral','😔 Sad','😤 Frustrated','😴 Tired','🤩 Excited','😰 Anxious','🙏 Grateful'].map(m=>`
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:.78rem;">
                      <input type="radio" name="diary_mood_radio" id="diary_mood" value="${m}" onclick="document.getElementById('diary_mood').value='${m}'" style="display:none;">
                      <span id="diary_mood_btn_${m.split(' ')[0]}" onclick="document.getElementById('diary_mood').value='${m}';document.querySelectorAll('.mood-opt').forEach(x=>x.style.background='var(--dim)');this.style.background='var(--acc)22';this.style.border='1.5px solid var(--acc)';"
                        class="mood-opt" style="background:var(--dim);border:1.5px solid var(--bdr2);border-radius:8px;padding:4px 8px;font-size:.82rem;transition:all .15s;">${m}</span>
                    </label>`).join('')}
                  <input type="hidden" id="diary_mood" value="">
                </div>
              </div>
              <button class="btn b-gold" onclick="APP.saveDiaryEntry()" style="width:100%">${this.diaryEditId?'💾 Update Entry':'📝 Save Entry'}</button>
            </div>
          </div>
        </div>

        <!-- RIGHT: Search + List -->
        <div>
          <div class="sec-hdr">
            <div class="sec-title">🔍 Search Entries <span class="ct">${this.getDiaryEntries().length}</span></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${['All','😊 Happy','😐 Neutral','😔 Sad','😤 Frustrated','😴 Tired','🤩 Excited','😰 Anxious','🙏 Grateful'].map(m=>`<button onclick="APP._diaryMoodFilter='${m==='All'?'':m}';APP.renderDiaryList()" style="font-size:.62rem;padding:2px 7px;border-radius:10px;border:1.5px solid ${(APP._diaryMoodFilter||'')===(m==='All'?'':m)?'var(--acc)':'var(--bdr2)'};background:${(APP._diaryMoodFilter||'')===(m==='All'?'':m)?'var(--acc)':'var(--card)'};color:${(APP._diaryMoodFilter||'')===(m==='All'?'':m)?'#fff':'var(--mut)'};cursor:pointer;font-family:Nunito,sans-serif;font-weight:700;">${m}</button>`).join('')}
            </div>
          </div>

          <!-- SEARCH BAR -->
          <div style="display:flex;gap:6px;margin-bottom:12px;">
            <input id="diary_search" placeholder="Search word, number, name, date... (highlights all matches)"
              style="flex:1;background:var(--bg);border:2px solid var(--bdr2);color:var(--txt);padding:9px 13px;border-radius:9px;font-family:'Nunito',sans-serif;font-size:.86rem;outline:none;"
              oninput="APP.searchDiary()"
              value="${this.diaryQuery}">
            <button class="btn b-out" onclick="document.getElementById('diary_search').value='';APP.diaryQuery='';APP.renderDiaryList()">✕ Clear</button>
          </div>

          <div style="background:#f0f7ff;border:1px solid #90b8e8;border-radius:8px;padding:8px 12px;font-size:.78rem;color:var(--blu);margin-bottom:10px;">
            🔍 <b>Smart Search:</b> Numbers, words, names, dates — type anything and all matches will be <mark style="background:#ffe066;border-radius:2px;padding:0 2px">highlighted in yellow</mark>
          </div>

          <div id="diary_list"></div>
        </div>
      </div>`;

    // Inject date picker
    const wrap=document.getElementById('diary_date_wrap');
    if(wrap) wrap.innerHTML=makeDateInput('diary_date', today);
    if(this.diaryEditId){
      const e=this.getDiaryEntries().find(x=>x.id===this.diaryEditId);
      if(e){ svDate('diary_date',e.date);document.getElementById('diary_title').value=e.title||'';document.getElementById('diary_body').value=e.body||'';document.getElementById('diary_tags').value=e.tags||''; }
    }
    this.renderDiaryList();
  },


  // ╔══════════════════════════════════════════════════════════════╗
  // ║           📒 KHATA BOOK MODULE                              ║
  // ║   Party Ledger (Lena/Dena) + Cash Register                  ║
  // ╚══════════════════════════════════════════════════════════════╝

  // ── Data accessors ──
  get kbParties(){ try{ return JSON.parse(localStorage.getItem('rk_kb_parties')||'[]'); }catch{ return []; } },
  get kbEntries(){ try{ return JSON.parse(localStorage.getItem('rk_kb_entries')||'[]'); }catch{ return []; } },
  get kbCash(){ try{ return JSON.parse(localStorage.getItem('rk_kb_cash')||'[]'); }catch{ return []; } },

  _kbSaveParties(d){ localStorage.setItem('rk_kb_parties',JSON.stringify(d)); if(window.fbSave)window.fbSave('kb_parties',d).catch(()=>{}); },
  _kbSaveEntries(d){ localStorage.setItem('rk_kb_entries',JSON.stringify(d)); if(window.fbSave)window.fbSave('kb_entries',d).catch(()=>{}); },
  _kbSaveCash(d){ localStorage.setItem('rk_kb_cash',JSON.stringify(d)); if(window.fbSave)window.fbSave('kb_cash',d).catch(()=>{}); },

  // ── Balance calculator for a party ──
  _kbPartyBalance(partyId){
    const entries = this.kbEntries.filter(e=>e.partyId===partyId);
    // lena = others owe us (positive = we get), dena = we owe them (positive = we give)
    let lena=0, dena=0;
    entries.forEach(e=>{
      if(e.type==='lena') lena += Number(e.amount||0);
      else dena += Number(e.amount||0);
    });
    const net = lena - dena; // positive = party owes us, negative = we owe party
    return { lena, dena, net, entries };
  },

  // ── Cash register totals ──
  _kbCashTotals(){
    const all = this.kbCash;
    const totalIn = all.filter(e=>e.type==='in').reduce((s,e)=>s+Number(e.amount||0),0);
    const totalOut = all.filter(e=>e.type==='out').reduce((s,e)=>s+Number(e.amount||0),0);
    return { totalIn, totalOut, balance: totalIn - totalOut };
  },

  // ── Open Add Party Modal ──
  // ── Add custom party category ──
  // Render file attachments for a Khata entry (avoids nested template literals)
  _kbRenderEntryFiles(files){
    if(!files||!files.length) return '';
    var chips = files.map(function(f){
      var isImg = f.type && f.type.startsWith('image/');
      var name = (f.name||'file').slice(0,18);
      return '<a href="'+f.url+'" target="_blank" title="'+(f.name||'File')+'" '
        +'style="display:inline-flex;align-items:center;gap:3px;background:#eff6ff;'
        +'border:1px solid #bfdbfe;border-radius:5px;padding:2px 7px;font-size:.67rem;'
        +'color:#2c6fad;text-decoration:none;">'
        +(isImg?'🖼️':'📎')+' '+name+'</a>';
    }).join('');
    return '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'+chips+'</div>';
  },

  _kbAddCategory(){
    const name = prompt('Naya category name daalo\n(e.g. Friend, Vendor, Tenant, Loan, Partner):', '');
    if(!name || !name.trim()) return;
    const cat = name.trim().toLowerCase().replace(/\s+/g,'_');
    const sel = document.getElementById('kbp_cat');
    if(!sel) return;
    // Check if already exists
    const exists = Array.from(sel.options).some(o=>o.value===cat||o.text===name.trim());
    if(exists){ sel.value=cat; this.showToastMsg('✅ Category already exists!'); return; }
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = '✨ '+name.trim();
    sel.appendChild(opt);
    sel.value = cat;
    // Save to localStorage for persistence
    try{
      let cats; try{ cats=JSON.parse(localStorage.getItem('rk_kb_custom_cats')||'[]'); }catch{ cats=[]; }
      cats.push({value:cat, label:'✨ '+name.trim()});
      localStorage.setItem('rk_kb_custom_cats', JSON.stringify(cats));
    }catch(e){}
    this.showToastMsg('✅ Category "'+name.trim()+'" added!');
  },

  // Load custom categories into a select element
  _kbLoadCustomCats(selId){
    const sel = document.getElementById(selId);
    if(!sel) return;
    try{
      let cats; try{ cats=JSON.parse(localStorage.getItem('rk_kb_custom_cats')||'[]'); }catch{ cats=[]; }
      cats.forEach(c=>{
        if(!Array.from(sel.options).some(o=>o.value===c.value)){
          const opt = document.createElement('option');
          opt.value = c.value; opt.textContent = c.label;
          sel.appendChild(opt);
        }
      });
    }catch(e){}
  },

  kbOpenPartyModal(id){
    this._kbEditPartyId = id||null;
    document.getElementById('kbPartyMT').textContent = id ? '✏️ Edit Party' : '👤 Add Party / Contact';
    if(id){
      const p = this.kbParties.find(x=>x.id===id);
      if(p){
        document.getElementById('kbp_name').value = p.name||'';
        document.getElementById('kbp_phone').value = p.phone||'';
        this._kbLoadCustomCats('kbp_cat');
    document.getElementById('kbp_cat').value = p.cat||'personal';
        document.getElementById('kbp_notes').value = p.notes||'';
      }
    } else {
      ['kbp_name','kbp_phone','kbp_notes'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
      this._kbLoadCustomCats('kbp_cat');
      document.getElementById('kbp_cat').value = 'personal';
    }
    M.open('kbPartyM');
  },

  kbSaveParty(){
    const name = document.getElementById('kbp_name').value.trim();
    if(!name){ alert('Name zaroori hai!'); return; }
    const data = {
      name, phone: document.getElementById('kbp_phone').value.trim(),
      cat: document.getElementById('kbp_cat').value,
      notes: document.getElementById('kbp_notes').value.trim()
    };
    let parties = this.kbParties;
    if(this._kbEditPartyId){
      parties = parties.map(p=>p.id===this._kbEditPartyId ? {...p,...data} : p);
    } else {
      data.id = uid(); data.created = new Date().toISOString();
      parties.push(data);
    }
    this._kbSaveParties(parties);
    M.close('kbPartyM');
    this.renderKhata();
    this.showToastMsg('✅ Party saved!');
  },

  kbDeleteParty(id){
    this.delCb = ()=>{
      this._kbSaveParties(this.kbParties.filter(p=>p.id!==id));
      this._kbSaveEntries(this.kbEntries.filter(e=>e.partyId!==id));
      this._kbActiveParty = null;
      this.renderKhata();
    };
    document.getElementById('delMsg').textContent = 'Delete this party and all their entries?';
    M.open('delM');
  },

  // ── Open Add Entry Modal ──
  kbOpenEntryModal(partyId, entryId){
    this._kbEditEntryId = entryId||null;
    this._kbEntryPartyId = partyId;
    const party = this.kbParties.find(p=>p.id===partyId);
    document.getElementById('kbEntryMT').textContent = entryId ? '✏️ Edit Entry' : '➕ New Entry';
    document.getElementById('kbEntryPartyInfo').textContent = '👤 Party: ' + (party?party.name:'?');
    // Date picker
    const dw = document.getElementById('kbe_date_wrap');
    if(dw) dw.innerHTML = makeDateInput('kbe_date', (function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})());
    if(entryId){
      const e = this.kbEntries.find(x=>x.id===entryId);
      if(e){
        this.kbSetEntryType(e.type||'lena');
        document.getElementById('kbe_amount').value = e.amount||'';
        svDate('kbe_date', e.date||'');
        document.getElementById('kbe_note').value = e.note||'';
        document.getElementById('kbe_mode').value = e.mode||'Cash';
      }
    } else {
      this.kbSetEntryType('lena');
      document.getElementById('kbe_amount').value = '';
      document.getElementById('kbe_note').value = '';
      document.getElementById('kbe_mode').value = 'Cash';
    }
    // Init file upload zone
    FUM.clear('fu_kb_entry_wrap');
    FUM.init('fu_kb_entry_wrap', 'khata', []);
    // Load existing files if editing
    if(entryId){
      const ex = this.kbEntries.find(x=>x.id===entryId);
      if(ex && ex.files && ex.files.length) FUM.init('fu_kb_entry_wrap','khata',ex.files);
    }
    M.open('kbEntryM');
  },

  kbSetEntryType(t){
    document.getElementById('kbe_type').value = t;
    const btnL = document.getElementById('kbe_btn_lena');
    const btnD = document.getElementById('kbe_btn_dena');
    if(t==='lena'){
      if(btnL){ btnL.style.background='#16a34a'; btnL.style.color='#fff'; btnL.style.borderColor='#16a34a'; }
      if(btnD){ btnD.style.background='#fee2e2'; btnD.style.color='#991b1b'; btnD.style.borderColor='#fecaca'; }
    } else {
      if(btnD){ btnD.style.background='#dc2626'; btnD.style.color='#fff'; btnD.style.borderColor='#dc2626'; }
      if(btnL){ btnL.style.background='#dcfce7'; btnL.style.color='#166534'; btnL.style.borderColor='#bbf7d0'; }
    }
  },

  kbSaveEntry(){
    try {
      const amt = Number(String(document.getElementById('kbe_amount').value).replace(/,/g,''));
      if(!amt||amt<=0){ alert('Amount daalo!'); return; }

      const _kbeFiles = FUM.getFiles('fu_kb_entry_wrap');
      const data = {
        partyId: this._kbEntryPartyId,
        type: document.getElementById('kbe_type').value,
        amount: amt,
        date: vDate('kbe_date') || (function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})(),
        note: document.getElementById('kbe_note').value.trim(),
        mode: document.getElementById('kbe_mode').value,
        files: _kbeFiles
      };

      let entries = this.kbEntries;
      if(this._kbEditEntryId){
        entries = entries.map(e=>e.id===this._kbEditEntryId ? {...e,...data} : e);
      } else {
        data.id = uid();
        data.created = new Date().toISOString();
        entries.push(data);
      }
      this._kbSaveEntries(entries);
      M.close('kbEntryM');
      this.renderKhata();
      this.showToastMsg('✅ Entry saved!');
    } catch(error) {
      console.error('[kbSaveEntry] Error:', error);
      alert('Error saving entry: ' + error.message);
    }
  },

  kbDeleteEntry(id){
    this.delCb = ()=>{
      this._kbSaveEntries(this.kbEntries.filter(e=>e.id!==id));
      this.renderKhata();
    };
    document.getElementById('delMsg').textContent = 'Delete this entry?';
    M.open('delM');
  },

  // ── Cash Register ──
  kbOpenCashModal(entryId){
    this._kbEditCashId = entryId||null;
    document.getElementById('kbCashMT').textContent = entryId ? '✏️ Edit Cash Entry' : '💵 Cash Register Entry';
    const dw = document.getElementById('kbc_date_wrap');
    if(dw) dw.innerHTML = makeDateInput('kbc_date', (function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})());
    if(entryId){
      const e = this.kbCash.find(x=>x.id===entryId);
      if(e){
        this.kbSetCashType(e.type||'in');
        document.getElementById('kbc_amount').value = e.amount||'';
        svDate('kbc_date', e.date||'');
        document.getElementById('kbc_cat').value = e.cat||'General';
        document.getElementById('kbc_note').value = e.note||'';
      }
    } else {
      this.kbSetCashType('in');
      document.getElementById('kbc_amount').value = '';
      document.getElementById('kbc_note').value = '';
      document.getElementById('kbc_cat').value = 'General';
    }
    M.open('kbCashM');
  },

  kbSetCashType(t){
    document.getElementById('kbc_type').value = t;
    const btnI = document.getElementById('kbc_btn_in');
    const btnO = document.getElementById('kbc_btn_out');
    if(t==='in'){
      if(btnI){ btnI.style.background='#16a34a'; btnI.style.color='#fff'; btnI.style.borderColor='#16a34a'; }
      if(btnO){ btnO.style.background='#fee2e2'; btnO.style.color='#991b1b'; btnO.style.borderColor='#fecaca'; }
    } else {
      if(btnO){ btnO.style.background='#dc2626'; btnO.style.color='#fff'; btnO.style.borderColor='#dc2626'; }
      if(btnI){ btnI.style.background='#dcfce7'; btnI.style.color='#166534'; btnI.style.borderColor='#bbf7d0'; }
    }
  },

  kbSaveCash(){
    const amt = Number(document.getElementById('kbc_amount').value);
    if(!amt||amt<=0){ alert('Amount daalo!'); return; }
    const data = {
      type: document.getElementById('kbc_type').value,
      amount: amt,
      date: vDate('kbc_date') || (function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})(),
      cat: document.getElementById('kbc_cat').value,
      note: document.getElementById('kbc_note').value.trim()
    };
    let cash = this.kbCash;
    if(this._kbEditCashId){
      cash = cash.map(e=>e.id===this._kbEditCashId ? {...e,...data} : e);
    } else {
      data.id = uid(); data.created = new Date().toISOString();
      cash.push(data);
    }
    this._kbSaveCash(cash);
    M.close('kbCashM');
    this.renderKhata();
    this.showToastMsg('✅ Cash entry saved!');
  },

  kbDeleteCash(id){
    this.delCb = ()=>{ this._kbSaveCash(this.kbCash.filter(e=>e.id!==id)); this.renderKhata(); };
    document.getElementById('delMsg').textContent = 'Delete this cash entry?';
    M.open('delM');
  },

  // ── WhatsApp reminder for party ──
  kbSendWA(partyId){
    const party = this.kbParties.find(p=>p.id===partyId);
    if(!party){ alert('Party not found'); return; }
    if(!party.phone){ alert('Phone number add karo pehle (Edit party)'); return; }
    const bal = this._kbPartyBalance(partyId);
    let msg = '';
    if(bal.net > 0){
      msg = `Namaste ${party.name} ji,\n\nAapne mujhe ₹${fmt(bal.net)} DENA hai (Maine aapko diya tha).\nKripya jald se jald wapas karein.\n\nDhanyavaad,\nRaman Kumar`;
    } else if(bal.net < 0){
      msg = `Namaste ${party.name} ji,\n\nMainne aapko ₹${fmt(Math.abs(bal.net))} DIYA HAI.\nKripya confirmation karein.\n\nDhanyavaad,\nRaman Kumar`;
    } else {
      msg = `Namaste ${party.name} ji,\n\nAapka account clear hai. Koi baaki nahi.\n\nDhanyavaad,\nRaman Kumar`;
    }
    this.sendWhatsApp(party.name, fmt(Math.abs(bal.net)), party.phone, 'reminder', msg);
  },

  // ── MAIN RENDER ──

  // ── WhatsApp: Full Party Account Statement ─────────────────────────────
  // Sends complete transaction-by-transaction ledger as a formatted WA message
  kbShareStatement(partyId){
    const party = this.kbParties.find(p=>p.id===partyId);
    if(!party){ alert('Party not found'); return; }
    if(!party.phone){
      alert('📵 Phone number not added for ' + party.name + '.\nEdit party and add phone number.');
      return;
    }
    const bal = this._kbPartyBalance(partyId);
    const entries = bal.entries.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    if(!entries.length){
      alert('No entries found for ' + party.name);
      return;
    }
    const today = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    const ownerName = (this.persons && this.persons[0]) || 'Raman Kumar';

    const lines = [];
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('📒 *KHATA STATEMENT*');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('*Party:* ' + party.name);
    if(party.phone) lines.push('*Phone:* ' + party.phone);
    if(party.cat)   lines.push('*Category:* ' + party.cat);
    lines.push('*Date:* ' + today);
    lines.push('');
    lines.push('📋 *TRANSACTION DETAILS*');
    lines.push('──────────────────────');

    entries.forEach((e, i) => {
      const isLena = e.type === 'lena';
      const amt = Number(e.amount || 0);
      const dateStr = e.date ? fD(e.date) : '—';
      const note = e.note || (isLena ? 'Lena' : 'Dena');
      const sign = isLena ? '+' : '-';
      const typeLabel = isLena ? '⬇️ Liya' : '⬆️ Diya';
      lines.push((i+1) + '. ' + typeLabel + '  *' + sign + '₹' + fmt(amt) + '*');
      lines.push('   📅 ' + dateStr + ' | ' + (e.mode||'Cash'));
      lines.push('   📝 ' + note);
      if(i < entries.length - 1) lines.push('');
    });

    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('📊 *ACCOUNT SUMMARY*');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('⬇️ Total Liya (Received): *₹' + fmt(bal.lena) + '*');
    lines.push('⬆️ Total Diya (Paid):     *₹' + fmt(bal.dena) + '*');
    lines.push('');
    if(bal.net > 0){
      lines.push('✅ *' + party.name + ' DENA HAI: ₹' + fmt(bal.net) + '*');
    } else if(bal.net < 0){
      lines.push('🔵 *Aapne DIYA HAI: ₹' + fmt(Math.abs(bal.net)) + '*');
    } else {
      lines.push('✅ *CLEAR — Koi baaki nahi*');
    }
    lines.push('');
    lines.push('_Statement by ' + ownerName + ' | ' + today + '_');

    const phone = party.phone.replace(/\D/g,'').replace(/^91/,'');
    const waUrl = 'https://api.whatsapp.com/send?phone=91' + phone + '&text=' + encodeURIComponent(lines.join('\n'));
    window.open(waUrl, '_blank');
    this.showToastMsg('📲 WhatsApp mein full statement bheja ja raha hai...');
  },

  renderKhata(){
    if(!this._kbSub) this._kbSub = 'parties';
    const sub = this._kbSub;
    const parties = this.kbParties;
    const cashTotals = this._kbCashTotals();

    // ── Sub-tabs ──
    const subTabs = [
      ['parties','👥 Party Ledger'],
      ['cash','💵 Cash Register'],
      ['summary','📊 Summary']
    ];

    // ── Overall summary numbers — raw totals (matches dashboard pill) ──
    let totalLena=0, totalDena=0;
    const allKbEntries = this.kbEntries;
    allKbEntries.forEach(e=>{
      if(e.type==='lena') totalLena += Number(e.amount||0);
      else if(e.type==='dena') totalDena += Number(e.amount||0);
    });
    const lenaPartiesCount = new Set(allKbEntries.filter(e=>e.type==='lena').map(e=>e.partyId)).size;
    const denaPartiesCount = new Set(allKbEntries.filter(e=>e.type==='dena').map(e=>e.partyId)).size;


    const summaryBar = `
      <div class="kb-summary-bar">
        <div class="kb-sum-card" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;">
          <div style="font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#166534;margin-bottom:4px;">🤲 LIYA HAI (Aapne Liya)</div>
          <div style="font-size:1.1rem;font-weight:900;color:#166534;font-family:'JetBrains Mono',monospace;">${fmt(totalLena)}</div>
          <div style="font-size:.65rem;color:#16a34a;margin-top:2px;">${lenaPartiesCount} parties</div>
        </div>
        <div class="kb-sum-card" style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1.5px solid #fca5a5;">
          <div style="font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#991b1b;margin-bottom:4px;">💸 DIYA HAI (Aapne Diya)</div>
          <div style="font-size:1.1rem;font-weight:900;color:#c0392b;font-family:'JetBrains Mono',monospace;">${fmt(totalDena)}</div>
          <div style="font-size:.65rem;color:#dc2626;margin-top:2px;">${denaPartiesCount} parties</div>
        </div>
        <div class="kb-sum-card" style="background:linear-gradient(135deg,#f0f7ff,#dbeafe);border:1.5px solid #93c5fd;">
          <div style="font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#1e40af;margin-bottom:4px;">💵 CASH BALANCE</div>
          <div style="font-size:1.1rem;font-weight:900;color:${cashTotals.balance>=0?'#1e7a45':'#c0392b'};font-family:'JetBrains Mono',monospace;">${fmt(cashTotals.balance)}</div>
          <div style="font-size:.65rem;color:var(--mut);margin-top:2px;">In: ${fmt(cashTotals.totalIn)} · Out: ${fmt(cashTotals.totalOut)}</div>
        </div>
      </div>`;

    let content = '';

    // ══════════════════════════════════
    // SUB: PARTY LEDGER
    // ══════════════════════════════════
    if(sub==='parties'){
      const activeId = this._kbActiveParty;
      const activeParty = activeId ? parties.find(p=>p.id===activeId) : null;

      if(activeParty){
        // ── Party Detail View ──
        const bal = this._kbPartyBalance(activeId);
        // ── Date filter for Khata entries ──
        if(!this._kbFromDate) this._kbFromDate='';
        if(!this._kbToDate)   this._kbToDate='';
        const kbFrom=this._kbFromDate, kbTo=this._kbToDate;
        const allEntries = bal.entries.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
        const entries = allEntries.filter(e=>{
          const kbQ=(APP._kbSearch||'').toLowerCase().trim();
          if(kbQ){
            const hay=(e.note||'').toLowerCase()+(e.type||'').toLowerCase()+String(e.amount||'');
            if(!hay.includes(kbQ)) return false;
          }
          if(!kbFrom&&!kbTo) return true;
          const d=e.date?new Date(e.date):null;
          if(!d) return true;
          if(kbFrom&&d<new Date(kbFrom)) return false;
          if(kbTo){const t2=new Date(kbTo);t2.setHours(23,59,59,999);if(d>t2)return false;}
          return true;
        });
        const catColors = {personal:'#8b5cf6',business:'#2563eb',property:'#d97706',other:'#6b7280'};
        const netColor = bal.net>0?'#166534':bal.net<0?'#991b1b':'#6c757d';
        const netBg = bal.net>0?'#dcfce7':bal.net<0?'#fee2e2':'#f1f5f9';
        const netLabel = bal.net>0?`${activeParty.name} ne aapko ₹${fmt(bal.net)} DENA hai (Aapne Liya Hai)`:
                         bal.net<0?`Aapne ${activeParty.name} ko ₹${fmt(Math.abs(bal.net))} DIYA HAI`:
                         'Barabar — Koi baaki nahi';

        const entryRows = entries.map(e=>{
          const isLena = e.type==='lena';
          // Safe note display — escape for HTML attribute, use textContent approach
          const safeNote = (e.note||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          // Use data-* attributes to avoid quote/ID escaping issues in onclick
          return `<div class="kb-entry">
            <div style="width:36px;height:36px;border-radius:50%;background:${isLena?'#dcfce7':'#fee2e2'};display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">${isLena?'⬇️':'⬆️'}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:.82rem;font-weight:700;word-break:break-word;">${safeNote}</div>
              <div style="font-size:.68rem;color:var(--mut);">${fD(e.date)} · ${e.mode||'Cash'}</div>
              ${APP._kbRenderEntryFiles(e.files)}
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div class="${isLena?'kb-lena':'kb-dena'}" style="font-size:.9rem;font-family:'JetBrains Mono',monospace;">
                ${isLena?'+':'-'}₹${fmt(e.amount)}
              </div>
              <span class="kb-tag ${isLena?'kb-tag-lena':'kb-tag-dena'}">${isLena?'🤲 Liya Hai':'💸 Diya Hai'}</span>
            </div>
            <div style="display:flex;gap:4px;margin-left:8px;">
              <button class="kb-entry-edit" data-pid="${activeId}" data-eid="${e.id}"
                style="background:var(--dim);border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.72rem;">✏️</button>
              <button class="kb-entry-del" data-eid="${e.id}"
                style="background:#fee2e2;color:#991b1b;border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.72rem;">🗑</button>
            </div>
          </div>`;
        }).join('');

        content = `
          <!-- Back button + Party header -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
            <button onclick="APP._kbActiveParty=null;APP.renderKhata()" class="btn b-out b-sm">← Back</button>
            <div style="flex:1;min-width:0;">
              <div style="font-size:.95rem;font-weight:800;word-break:break-word;line-height:1.3;">${activeParty.name}</div>
              <div style="font-size:.70rem;color:var(--mut);margin-top:2px;">${activeParty.phone||'No phone'} · ${activeParty.cat||'personal'}</div>
            </div>
            <button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1px solid #90c8a0;" onclick="APP.kbOpenEntryModal('${activeId}')">＋ Entry</button>
            <button class="btn b-sm b-out" onclick="APP.kbOpenPartyModal('${activeId}')">✏️ Edit</button>
            <button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1px solid #90c8a0;" onclick="APP.kbSendWA('${activeId}')">
              <svg width="12" height="12" viewBox="0 0 48 48" style="vertical-align:middle"><circle cx="24" cy="24" r="22" fill="#25D366"/><path fill="#fff" d="M34.5 13.5C32 11 28.2 9.5 24 9.5c-8.6 0-15.5 6.9-15.5 15.5 0 2.7.7 5.4 2 7.7L9 39l6.5-1.7c2.2 1.2 4.7 1.8 7.2 1.8h.1c8.6 0 15.5-6.9 15.5-15.5 0-4.1-1.6-8-4.8-11.1z"/></svg>
              WA
            </button>
            <button class="btn b-sm" style="background:#dcfce7;color:#166534;border:1.5px solid #86efac;font-weight:800;" onclick="APP.kbShareStatement('${activeId}')" title="Send full transaction statement on WhatsApp">
              <svg width="12" height="12" viewBox="0 0 48 48" style="vertical-align:middle"><circle cx="24" cy="24" r="22" fill="#25D366"/><path fill="#fff" d="M34.5 13.5C32 11 28.2 9.5 24 9.5c-8.6 0-15.5 6.9-15.5 15.5 0 2.7.7 5.4 2 7.7L9 39l6.5-1.7c2.2 1.2 4.7 1.8 7.2 1.8h.1c8.6 0 15.5-6.9 15.5-15.5 0-4.1-1.6-8-4.8-11.1z"/></svg>
              📋 Statement
            </button>
          </div>

          <!-- Download buttons — individual party -->
          <div style="display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap;">
            <button onclick="APP._kbDownloadPDF(APP._kbActiveParty)" class="btn b-out b-sm" style="flex:1;border-color:#e53935;color:#e53935;">📄 PDF</button>${APP._pdfOriHtml()}
            <button onclick="APP._kbDownloadWord(APP._kbActiveParty)" class="btn b-out b-sm" style="flex:1;border-color:#1565c0;color:#1565c0;">📝 Word</button>
            <button onclick="APP._kbDownloadCSV(APP._kbActiveParty)" class="btn b-out b-sm" style="flex:1;border-color:#2e7d32;color:#2e7d32;">📊 CSV</button>
          </div>

          <!-- Entries list -->
          <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;overflow:hidden;box-shadow:var(--sh);">
            <div style="background:var(--card2);padding:9px 14px;border-bottom:1px solid var(--bdr);">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:7px;">
                <div style="font-size:.8rem;font-weight:800;">📋 All Entries <span style="background:var(--acc);color:#fff;padding:1px 8px;border-radius:10px;font-size:.65rem;">${entries.length}</span>${allEntries.length!==entries.length?`<span style="font-size:.65rem;color:var(--mut);margin-left:4px;">(filtered from ${allEntries.length})</span>`:''}</div>
                <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
                  <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_kbpf" value="${kbFrom?isoToDmy(kbFrom):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_kbpf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._kbFromDate=iso;APP.renderKhata();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_kbpf').showPicker&&document.getElementById('dfh_kbpf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_kbpf" value="${kbFrom||''} " onchange="(function(iso){var el=document.getElementById('df_kbpf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._kbFromDate=iso;APP.renderKhata();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
                  <span style="font-size:.72rem;color:var(--mut)">to</span>
                  <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_kbpt" value="${kbTo?isoToDmy(kbTo):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_kbpt');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._kbToDate=iso;APP.renderKhata();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_kbpt').showPicker&&document.getElementById('dfh_kbpt').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_kbpt" value="${kbTo||''} " onchange="(function(iso){var el=document.getElementById('df_kbpt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._kbToDate=iso;APP.renderKhata();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
                  ${kbFrom||kbTo?`<button onclick="APP._kbFromDate='';APP._kbToDate='';APP.renderKhata();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 6px;">✕ Clear</button>`:''}
                </div>
              </div>
              <!-- Search bar -->
              <div style="display:flex;align-items:center;gap:6px;background:var(--bg);border:1.5px solid var(--bdr2);border-radius:8px;padding:5px 10px;">
                <span style="color:var(--mut);font-size:.85rem;flex-shrink:0;">🔍</span>
                <input type="text" id="_kbSearchInp" value="${this._kbSearch||''}"
                  oninput="APP._kbSearch=this.value;APP.renderKhata();"
                  placeholder="Search by note, amount, type…"
                  style="flex:1;border:none;background:transparent;outline:none;font-family:'Nunito',sans-serif;font-size:.8rem;color:var(--txt);">
                ${this._kbSearch?`<button onclick="APP._kbSearch='';APP.renderKhata();" style="background:none;border:none;color:var(--mut);cursor:pointer;font-size:.8rem;padding:0 2px;">✕</button>`:''}
              </div>
              <!-- Balance Card — shown below search row -->
              <div style="background:${netBg};border:2px solid ${netColor}30;border-radius:13px;padding:14px 16px;margin-top:9px;text-align:center;">
                <div style="font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${netColor};margin-bottom:6px;">NET BALANCE</div>
                <div style="font-size:1.6rem;font-weight:900;color:${netColor};font-family:'JetBrains Mono',monospace;">₹${fmt(Math.abs(bal.net))}</div>
                <div style="font-size:.78rem;font-weight:700;color:${netColor};margin-top:4px;">${netLabel}</div>
                <div style="display:flex;justify-content:center;gap:20px;margin-top:10px;font-size:.72rem;">
                  <span style="color:#166534;">🤲 Liya Hai: <b>₹${fmt(bal.lena)}</b></span>
                  <span style="color:#991b1b;">💸 Diya Hai: <b>₹${fmt(bal.dena)}</b></span>
                </div>
              </div>
            </div>
            ${entryRows || '<div class="empty" style="padding:24px">No entries yet. Click + Entry to add.</div>'}
          </div>`;

      } else {
        // ── Party List View ──
        const catIcon = {personal:'👨‍👩‍👧',business:'💼',property:'🏠',other:'📌'};
        const partyCards = parties.map(p=>{
          const bal = this._kbPartyBalance(p.id);
          const netColor = bal.net>0?'#166534':bal.net<0?'#991b1b':'#6c757d';
          const netBg = bal.net>0?'#dcfce7':bal.net<0?'#fee2e2':'#f1f5f9';
          const initials = p.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          const avatarBg = bal.net>0?'#16a34a':bal.net<0?'#dc2626':'#6c757d';
          const entryCount = bal.entries.length;
          return `<div class="kb-party-card" onclick="APP._kbActiveParty='${p.id}';APP.renderKhata()">
            <div class="kb-party-hdr" style="flex-wrap:nowrap;gap:10px;">
              <div class="kb-avatar" style="background:${avatarBg};font-size:.82rem;flex-shrink:0;">${initials}</div>
              <div style="flex:1;min-width:0;overflow:hidden;">
                <div style="font-weight:800;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${p.name}">${p.name}</div>
                <div style="font-size:.65rem;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.cat||'other'} · ${p.phone||'No phone'}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="background:${netBg};color:${netColor};padding:3px 9px;border-radius:20px;font-size:.74rem;font-weight:800;font-family:'JetBrains Mono',monospace;white-space:nowrap;">
                  ${bal.net===0?'✓ Clear':bal.net>0?'+'+fmt(bal.net):'-'+fmt(Math.abs(bal.net))}
                </div>
                <div style="font-size:.6rem;color:var(--mut);margin-top:3px;text-align:right;">${entryCount} entr${entryCount===1?'y':'ies'}</div>
              </div>
            </div>
            <div style="padding:7px 14px;background:var(--card2);border-top:1px solid var(--bdr);display:flex;gap:6px;flex-wrap:nowrap;align-items:center;" onclick="event.stopPropagation()">
              <button class="btn b-sm kb-party-addentry" data-pid="${p.id}" style="flex:1;background:#e8f5e9;color:#166534;border:1px solid #86efac;white-space:nowrap;">＋ Entry</button>
              <button class="btn b-sm b-out kb-party-edit" data-pid="${p.id}" style="flex-shrink:0;">✏️</button>
              <button class="btn b-sm b-red kb-party-del" data-pid="${p.id}" style="flex-shrink:0;">🗑</button>
              ${p.phone?`<button class="btn b-sm kb-party-wa" data-pid="${p.id}" style="background:#e8f5e9;color:#1e7a45;border:1px solid #90c8a0;flex-shrink:0;white-space:nowrap;"><svg width="12" height="12" viewBox="0 0 48 48" style="vertical-align:middle"><circle cx="24" cy="24" r="22" fill="#25D366"/><path fill="#fff" d="M34.5 13.5C32 11 28.2 9.5 24 9.5c-8.6 0-15.5 6.9-15.5 15.5 0 2.7.7 5.4 2 7.7L9 39l6.5-1.7c2.2 1.2 4.7 1.8 7.2 1.8h.1c8.6 0 15.5-6.9 15.5-15.5 0-4.1-1.6-8-4.8-11.1z"/></svg> WA</button><button class="btn b-sm" onclick="event.stopPropagation();APP.kbShareStatement('${p.id}')" style="background:#dcfce7;color:#166534;border:1.5px solid #86efac;flex-shrink:0;white-space:nowrap;font-weight:800;" title="Share full statement on WhatsApp"><svg width="10" height="10" viewBox="0 0 48 48" style="vertical-align:middle"><circle cx="24" cy="24" r="22" fill="#25D366"/><path fill="#fff" d="M34.5 13.5C32 11 28.2 9.5 24 9.5c-8.6 0-15.5 6.9-15.5 15.5 0 2.7.7 5.4 2 7.7L9 39l6.5-1.7c2.2 1.2 4.7 1.8 7.2 1.8h.1c8.6 0 15.5-6.9 15.5-15.5 0-4.1-1.6-8-4.8-11.1z"/></svg> 📋</button>`:''}
            </div>
          </div>`;
        }).join('');

        const pending = parties.filter(p=>this._kbPartyBalance(p.id).net!==0);
        const cleared = parties.filter(p=>this._kbPartyBalance(p.id).net===0);
        // ── declare here so All Parties filter bar can use them ──
        const kbFrom=this._kbFromDate||'';
        const kbTo=this._kbToDate||'';

        content = `
          <!-- All Parties: date filter (mirrors individual party view) -->
          <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:10px;">
            <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
            <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:5px;">
                <span style="font-size:.7rem;color:var(--mut);font-weight:700;">From</span>
<span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_kbaf" value="${kbFrom?isoToDmy(kbFrom):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_kbaf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._kbFromDate=iso;APP.renderKhata();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_kbaf').showPicker&&document.getElementById('dfh_kbaf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_kbaf" value="${kbFrom||''} " onchange="(function(iso){var el=document.getElementById('df_kbaf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._kbFromDate=iso;APP.renderKhata();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
              </div>
              <div style="display:flex;align-items:center;gap:5px;">
                <span style="font-size:.7rem;color:var(--mut);font-weight:700;">To</span>
                <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_kbat" value="${kbTo?isoToDmy(kbTo):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_kbat');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._kbToDate=iso;APP.renderKhata();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_kbat').showPicker&&document.getElementById('dfh_kbat').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_kbat" value="${kbTo||''} " onchange="(function(iso){var el=document.getElementById('df_kbat');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._kbToDate=iso;APP.renderKhata();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
              </div>
              ${kbFrom||kbTo?`<button onclick="APP._kbFromDate='';APP._kbToDate='';APP.renderKhata();"
                class="btn b-sm b-out" style="font-size:.68rem;padding:4px 10px;border-color:#e53935;color:#e53935;">✕ Clear Filter</button>`:''}
              ${kbFrom||kbTo?`<span style="font-size:.66rem;color:var(--acc);font-weight:700;padding:3px 8px;background:#e8f5e9;border-radius:10px;">
                📊 Filtered entries shown below</span>`:''}
            </div>
          </div>
          <!-- All parties download buttons -->
          <div style="display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap;">
            <button onclick="APP._kbDownloadPDF('all')" class="btn b-out b-sm" style="flex:1;border-color:#e53935;color:#e53935;">📄 All Parties PDF</button>${APP._pdfOriHtml()}
            <button onclick="APP._kbDownloadWord('all')" class="btn b-out b-sm" style="flex:1;border-color:#1565c0;color:#1565c0;">📝 Word</button>
            <button onclick="APP._kbDownloadCSV('all')" class="btn b-out b-sm" style="flex:1;border-color:#2e7d32;color:#2e7d32;">📊 CSV</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">${partyCards||'<div class="empty" style="padding:32px;grid-column:1/-1"><div class="ei">👥</div>No parties yet. Click + Add Party!</div>'}</div>
          ${cleared.length&&parties.length>3?`<div style="text-align:center;font-size:.72rem;color:var(--mut);margin-top:8px;">✅ ${cleared.length} parties cleared</div>`:''}`;
      }
    }

    // ══════════════════════════════════
    // SUB: CASH REGISTER
    // ══════════════════════════════════
    if(sub==='cash'){
      const cash = [...this.kbCash].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      const rows = cash.map(e=>{
        const isIn = e.type==='in';
        return `<div class="kb-entry">
          <div style="width:36px;height:36px;border-radius:50%;background:${isIn?'#dcfce7':'#fee2e2'};display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">${isIn?'⬇️':'⬆️'}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:.82rem;font-weight:700;word-break:break-word;">${(e.note||e.cat||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
            <div style="font-size:.68rem;color:var(--mut);">${fD(e.date)} · ${e.cat||'General'}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div class="${isIn?'kb-lena':'kb-dena'}" style="font-size:.9rem;font-family:'JetBrains Mono',monospace;">${isIn?'+':'-'}₹${fmt(e.amount)}</div>
          </div>
          <div style="display:flex;gap:4px;margin-left:8px;">
            <button class="kb-cash-edit" data-eid="${e.id}" style="background:var(--dim);border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.72rem;">✏️</button>
            <button class="kb-cash-del" data-eid="${e.id}" style="background:#fee2e2;color:#991b1b;border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.72rem;">🗑</button>
          </div>
        </div>`;
      }).join('');

      content = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:11px;padding:12px 14px;text-align:center;">
            <div style="font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#166534;">⬇️ LIYA HAI (Cash In)</div>
            <div style="font-size:1.2rem;font-weight:900;color:#166534;font-family:'JetBrains Mono',monospace;margin-top:4px;">₹${fmt(cashTotals.totalIn)}</div>
          </div>
          <div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1.5px solid #fca5a5;border-radius:11px;padding:12px 14px;text-align:center;">
            <div style="font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#991b1b;">⬆️ DIYA HAI (Cash Out)</div>
            <div style="font-size:1.2rem;font-weight:900;color:#c0392b;font-family:'JetBrains Mono',monospace;margin-top:4px;">₹${fmt(cashTotals.totalOut)}</div>
          </div>
        </div>
        <div style="background:${cashTotals.balance>=0?'linear-gradient(135deg,#f0f7ff,#dbeafe)':'linear-gradient(135deg,#fff5f5,#fee2e2)'};border:2px solid ${cashTotals.balance>=0?'#93c5fd':'#fca5a5'};border-radius:12px;padding:12px 16px;text-align:center;margin-bottom:14px;">
          <div style="font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:${cashTotals.balance>=0?'#1e40af':'#991b1b'};">CASH BALANCE</div>
          <div style="font-size:1.8rem;font-weight:900;color:${cashTotals.balance>=0?'#1e40af':'#991b1b'};font-family:'JetBrains Mono',monospace;margin-top:6px;">₹${fmt(cashTotals.balance)}</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;overflow:hidden;box-shadow:var(--sh);">
          <div style="background:var(--card2);padding:9px 14px;border-bottom:1px solid var(--bdr);">
            <div style="font-size:.8rem;font-weight:800;">📋 All Cash Entries <span style="background:var(--acc);color:#fff;padding:1px 8px;border-radius:10px;font-size:.65rem;">${cash.length}</span></div>
          </div>
          ${rows||'<div class="empty" style="padding:24px">No entries. Click + Cash Entry to add.</div>'}
        </div>`;
    }

    // ══════════════════════════════════
    // SUB: SUMMARY
    // ══════════════════════════════════
    if(sub==='summary'){
      const catIcon = {personal:'👨‍👩‍👧',business:'💼',property:'🏠',other:'📌'};
      const partyRows = [...parties].sort((a,b)=>{
        const ba=this._kbPartyBalance(a.id).net, bb=this._kbPartyBalance(b.id).net;
        return Math.abs(bb)-Math.abs(ba);
      }).map(p=>{
        const bal = this._kbPartyBalance(p.id);
        const netColor = bal.net>0?'#166534':bal.net<0?'#991b1b':'#6c757d';
        return `<tr>
          <td style="font-weight:700;">${catIcon[p.cat]||'📌'} ${p.name}</td>
          <td style="color:var(--mut);font-size:.75rem;">${p.phone||'—'}</td>
          <td style="color:#166534;font-family:'JetBrains Mono',monospace;text-align:right;">₹${fmt(bal.lena)}</td>
          <td style="color:#991b1b;font-family:'JetBrains Mono',monospace;text-align:right;">₹${fmt(bal.dena)}</td>
          <td style="color:${netColor};font-weight:800;font-family:'JetBrains Mono',monospace;text-align:right;">
            ${bal.net===0?'✓':bal.net>0?'+'+fmt(bal.net):'-'+fmt(Math.abs(bal.net))}
          </td>
          <td><button class="btn b-sm b-out" onclick="APP._kbActiveParty='${p.id}';APP._kbSub='parties';APP.renderKhata()">View</button></td>
        </tr>`;
      }).join('');

      content = `
        <div class="tbl-wrap" style="margin-bottom:14px;">
          <table>
            <thead><tr><th>Party</th><th>Phone</th><th class="tr">Liya Hai</th><th class="tr">Diya Hai</th><th class="tr">Net Balance</th><th></th></tr></thead>
            <tbody>${partyRows||'<tr><td colspan="6"><div class="empty">No parties</div></td></tr>'}</tbody>
          </table>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:12px 14px;">
            <div style="font-size:.7rem;font-weight:800;text-transform:uppercase;color:var(--mut);margin-bottom:8px;">💵 Cash Summary</div>
            <div class="fr"><span class="fl">Total In</span><span class="mono kb-lena">₹${fmt(cashTotals.totalIn)}</span></div>
            <div class="fr"><span class="fl">Total Out</span><span class="mono kb-dena">₹${fmt(cashTotals.totalOut)}</span></div>
            <div class="fr"><span class="fl">Balance</span><span class="mono" style="color:${cashTotals.balance>=0?'var(--grn)':'var(--red)'};">₹${fmt(cashTotals.balance)}</span></div>
          </div>
          <div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:12px 14px;">
            <div style="font-size:.7rem;font-weight:800;text-transform:uppercase;color:var(--mut);margin-bottom:8px;">👥 Party Summary</div>
            <div class="fr"><span class="fl">Total Parties</span><span class="fv">${parties.length}</span></div>
            <div class="fr"><span class="fl">Liya Hai (Aapne Liya)</span><span class="mono kb-lena">₹${fmt(totalLena)}</span></div>
            <div class="fr"><span class="fl">Diya Hai (Aapne Diya)</span><span class="mono kb-dena">₹${fmt(totalDena)}</span></div>
          </div>
        </div>`;
    }

    // ── Attach delegated event handlers after render ──
    // (called after innerHTML is set — see bottom of renderKhata)
    const _attachKbHandlers = ()=>{
      const pan = document.getElementById('pan-khata');
      if(!pan) return;
      // Entry edit
      pan.querySelectorAll('.kb-entry-edit').forEach(btn=>{
        btn.onclick = ()=>{ APP.kbOpenEntryModal(btn.dataset.pid, btn.dataset.eid); };
      });
      // Entry delete
      pan.querySelectorAll('.kb-entry-del').forEach(btn=>{
        btn.onclick = ()=>{ APP.kbDeleteEntry(btn.dataset.eid); };
      });
      // Cash edit
      pan.querySelectorAll('.kb-cash-edit').forEach(btn=>{
        btn.onclick = ()=>{ APP.kbOpenCashModal(btn.dataset.eid); };
      });
      // Cash delete
      pan.querySelectorAll('.kb-cash-del').forEach(btn=>{
        btn.onclick = ()=>{ APP.kbDeleteCash(btn.dataset.eid); };
      });
      // Party add entry
      pan.querySelectorAll('.kb-party-addentry').forEach(btn=>{
        btn.onclick = ()=>{ APP._kbActiveParty=btn.dataset.pid; APP.kbOpenEntryModal(btn.dataset.pid); };
      });
      // Party edit
      pan.querySelectorAll('.kb-party-edit').forEach(btn=>{
        btn.onclick = ()=>{ APP.kbOpenPartyModal(btn.dataset.pid); };
      });
      // Party delete
      pan.querySelectorAll('.kb-party-del').forEach(btn=>{
        btn.onclick = ()=>{ APP.kbDeleteParty(btn.dataset.pid); };
      });
      // Party WA
      pan.querySelectorAll('.kb-party-wa').forEach(btn=>{
        btn.onclick = ()=>{ APP.kbSendWA(btn.dataset.pid); };
      });
    };

    document.getElementById('pan-khata').innerHTML = `
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:1.05rem;font-weight:800;display:flex;align-items:center;gap:8px;">
          📒 Khata Book
          ${totalLena>0||totalDena>0?`<span style="font-size:.72rem;background:#fee2e2;color:#991b1b;padding:2px 9px;border-radius:10px;">Pending: ${parties.filter(p=>this._kbPartyBalance(p.id).net!==0).length}</span>`:''}
        </div>
        <div style="display:flex;gap:6px;">
          ${sub==='parties'&&!this._kbActiveParty?`<button class="btn b-gold" onclick="APP.kbOpenPartyModal()">＋ Add Party</button>`:''}
          ${sub==='cash'?`<button class="btn b-gold" onclick="APP.kbOpenCashModal()">＋ Cash Entry</button>`:''}
        </div>
      </div>

      <!-- Summary bar -->
      ${summaryBar}

      <!-- Sub tabs -->
      <div class="stabs" style="margin-bottom:14px;">
        ${subTabs.map(([k,l])=>`<button class="stab ${sub===k?'on':''}" onclick="APP._kbActiveParty=null;APP._kbSub='${k}';APP.renderKhata()">${l}</button>`).join('')}
      </div>

      ${content}
    `;
    // Attach event handlers AFTER innerHTML set (safe, no inline onclick ID issues)
    setTimeout(_attachKbHandlers, 0);
  },

  // ══ NOTEPAD — Multi-Category with File Attachments ══
  _getNoteCategories(){
    // Try Firebase-synced key first (note_categories), then legacy
    const raw = localStorage.getItem('rk_note_categories');
    if(raw) try{const p=JSON.parse(raw);if(Array.isArray(p)&&p.length)return p;}catch(e){}
    return ['Personal','Work','Legal','Finance','Medical'];
  },
  _saveNoteCategories(cats){
    localStorage.setItem('rk_note_categories',JSON.stringify(cats));
    if(window.fbSave) window.fbSave('note_categories',cats).catch(()=>{});
  },
  _noteCatKey(cat){ return cat.toLowerCase().replace(/\s+/g,'_'); },
  _getNoteContent(cat){
    const k=this._noteCatKey(cat);
    return localStorage.getItem('rk_note_'+k)||'';
  },
  _saveNoteContent(cat,text){
    const k=this._noteCatKey(cat);
    localStorage.setItem('rk_note_'+k,text);
    // Firebase key matches: fbSave('note_'+k) → stored as rk_note_+k by applyCloudData
    if(window.fbSave) window.fbSave('note_'+k,text).catch(()=>{});
    if(cat==='Personal'){ localStorage.setItem('rk_notepad',text); if(window.fbSave)window.fbSave('notepad',text).catch(()=>{}); }
  },
  // File attachments per category: stored as JSON array in localStorage
  _getNoteFiles(cat){
    const k=this._noteCatKey(cat);
    const raw=localStorage.getItem('rk_note_files_'+k);
    if(raw) try{return JSON.parse(raw);}catch(e){} return [];
  },
  _saveNoteFiles(cat,files){
    const k=this._noteCatKey(cat);
    localStorage.setItem('rk_note_files_'+k,JSON.stringify(files));
    if(window.fbSave) window.fbSave('note_files_'+k,files).catch(()=>{});
  },
  _noteFileIcon(name,type){
    const ext=(name||'').split('.').pop().toLowerCase();
    if(type&&type.startsWith('image/')) return '🖼️';
    if(ext==='pdf') return '📄';
    if(['doc','docx'].includes(ext)) return '📝';
    if(['xls','xlsx'].includes(ext)) return '📊';
    if(['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️';
    return '📎';
  },
  _noteFileSize(bytes){
    if(!bytes) return '';
    if(bytes<1024) return bytes+'B';
    if(bytes<1024*1024) return (bytes/1024).toFixed(1)+'KB';
    return (bytes/1024/1024).toFixed(1)+'MB';
  },

  noteUploadFile(cat, inputEl){
    const file = inputEl.files[0];
    if(!file) return;
    if(file.size > 10*1024*1024){ this.showToastMsg('❌ File too large! Max 10MB'); return; }
    if(!window.fbUploadFile){ this.showToastMsg('❌ Firebase Storage not ready'); return; }
    const statusEl = document.getElementById('noteUploadStatus_'+cat.replace(/\s+/g,'_'));
    if(statusEl){ statusEl.textContent='⏳ Uploading...'; statusEl.style.color='#854f0b'; }
    window.fbUploadFile(file,'notepad',pct=>{
      if(statusEl) statusEl.textContent=`⏳ ${pct}%`;
    }).then(result=>{
      const files = this._getNoteFiles(cat);
      files.push({
        id: uid(), url:result.url, path:result.path,
        name:file.name, size:file.size, type:file.type,
        date: (function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})()
      });
      this._saveNoteFiles(cat,files);
      if(statusEl){ statusEl.textContent='✅ Uploaded!'; statusEl.style.color='#1e7a45'; }
      this.showToastMsg('✅ File uploaded: '+file.name);
      inputEl.value='';
      // Refresh file list only
      this._renderNoteFileList(cat);
      setTimeout(()=>{ if(statusEl) statusEl.textContent=''; },3000);
    }).catch(err=>{
      if(statusEl){ statusEl.textContent='❌ Error'; statusEl.style.color='#c0392b'; }
      this.showToastMsg('❌ Upload failed: '+err.message);
      inputEl.value='';
    });
  },

  noteDeleteFile(cat, fileId){
    if(!confirm('Delete this file?')) return;
    const files = this._getNoteFiles(cat);
    const f = files.find(x=>x.id===fileId);
    if(f && f.path && window.fbDeleteFile) window.fbDeleteFile(f.path);
    this._saveNoteFiles(cat, files.filter(x=>x.id!==fileId));
    this._renderNoteFileList(cat);
    this.showToastMsg('🗑 File deleted');
  },

  _renderNoteFileList(cat){
    const listEl = document.getElementById('noteFileList_'+cat.replace(/\s+/g,'_'));
    if(!listEl) return;
    const files = this._getNoteFiles(cat);
    if(!files.length){ listEl.innerHTML='<div style="font-size:.74rem;color:var(--mut);padding:8px 0;">No attachments yet</div>'; return; }
    listEl.innerHTML = files.map(f=>{
      const icon = this._noteFileIcon(f.name,f.type);
      const isImg = f.type&&f.type.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes((f.name||'').split('.').pop().toLowerCase());
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--dim);border-radius:8px;margin-bottom:6px;">
        ${isImg
          ? `<img src="${f.url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="this.style.display='none'">`
          : `<span style="font-size:1.6rem;flex-shrink:0;">${icon}</span>`
        }
        <div style="flex:1;min-width:0;">
          <div style="font-size:.78rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name||'File'}</div>
          <div style="font-size:.65rem;color:var(--mut);">${this._noteFileSize(f.size)}${f.date?' · '+fD(f.date):''}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <a href="${f.url}" target="_blank" title="View" style="background:#eff6ff;color:var(--acc);border:1px solid #bfdbfe;border-radius:5px;padding:3px 7px;font-size:.7rem;text-decoration:none;font-weight:700;">👁 View</a>
          <button onclick="APP.downloadFile('${f.url}', '${f.name}'); event.stopPropagation();" title="Download" style="background:#f0fdf4;color:var(--grn);border:1px solid #bbf7d0;border-radius:5px;padding:3px 7px;font-size:.7rem;cursor:pointer;font-weight:700;font-family:'Nunito',sans-serif;">⬇</button>
          <button onclick="APP.noteDeleteFile('${cat}','${f.id}')" title="Delete" style="background:#fef2f2;color:#c0392b;border:1px solid #fecaca;border-radius:5px;padding:3px 7px;font-size:.7rem;cursor:pointer;font-weight:700;">🗑</button>
        </div>
      </div>`;
    }).join('');
  },

  // AIC Notepad — tab view: shows category grid, opens fullscreen editor
  renderNotepadTab(){
    if(!this._noteActiveCat) this._noteActiveCat = this._getNoteCategories()[0]||'Personal';
    const cats = this._getNoteCategories();
    const catKey = c => c.replace(/\s+/g,'_');

    // Sort: pinned first
    const _notePins = JSON.parse(localStorage.getItem('rk_note_pins')||'[]');
    cats.sort((a,b)=>{
      const pa = _notePins.includes(a)?0:1;
      const pb = _notePins.includes(b)?0:1;
      return pa-pb;
    });
    const catCards = cats.map(cat => {
      const content = this._getNoteContent(cat);
      const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
      const hasContent = content.trim().length > 0;
      return `<div onclick="APP._npOpenEditor('${cat}')"
        style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:16px;cursor:pointer;transition:all .15s;box-shadow:var(--sh);"
        onmouseover="this.style.borderColor='var(--acc)';this.style.transform='translateY(-2px)'"
        onmouseout="this.style.borderColor='var(--bdr)';this.style.transform=''">
        <div style="font-size:1.4rem;margin-bottom:8px;">${cat==='Personal'?'👤':cat==='Work'?'💼':cat==='Legal'?'⚖️':cat==='Finance'?'💰':'📝'}</div>
        <div style="font-weight:800;font-size:.9rem;margin-bottom:4px;">${cat}</div>
        <div style="font-size:.72rem;color:var(--mut);">${hasContent ? wordCount+' words' : 'Empty — tap to write'}</div>
        ${hasContent ? '<div style="width:100%;height:3px;background:var(--acc);border-radius:2px;margin-top:10px;opacity:.4;"></div>' : ''}
      </div>`;
    }).join('');

    document.getElementById('pan-notepad').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:1rem;font-weight:800;">📝 Notepad</div>
        <div style="display:flex;gap:6px;">
          <button class="btn b-out b-sm" onclick="APP._npAddCategory()">+ Add Category</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;">
        ${catCards||'<div class="empty">No categories</div>'}
      </div>`;
  },

  // AIC Notepad — fullscreen editor (opens on top of everything)
  _npOpenEditor(cat){
    this._noteActiveCat = cat;
    const saved = this._getNoteContent(cat);
    const catKey = cat.replace(/\s+/g,'_');
    const icon = cat==='Personal'?'👤':cat==='Work'?'💼':cat==='Legal'?'⚖️':cat==='Finance'?'💰':'📝';
    const cats = this._getNoteCategories();

    // Remove existing editor if open
    const existing = document.getElementById('npEditorOverlay');
    if(existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'npEditorOverlay';
    el.className = 'np-editor';
    el.innerHTML = `
      <!-- Top bar -->
      <div class="np-editor-bar">
        <button class="np-editor-back" onclick="APP._npCloseEditor()">← Back</button>
        <div class="np-editor-cat">${icon} ${cat}</div>
        <div id="npEditorStatus" class="np-editor-status" style="color:var(--grn);">✔ Auto Saved</div>
      </div>

      <!-- Category switcher tabs -->
      <div style="display:flex;gap:5px;flex-wrap:wrap;padding:8px 16px;background:var(--card2);border-bottom:1px solid var(--bdr);">
        ${cats.map(c=>`<button onclick="APP._npOpenEditor('${c}')"
          style="padding:4px 12px;border-radius:14px;border:1.5px solid ${c===cat?'var(--acc)':'var(--bdr2)'};background:${c===cat?'var(--acc)':'transparent'};color:${c===cat?'#fff':'var(--mut)'};cursor:pointer;font-size:.74rem;font-weight:700;font-family:'Nunito',sans-serif;transition:all .12s;">${c}</button>`).join('')}
      </div>

      <!-- Main textarea -->
      <textarea class="np-editor-area" id="npEditorArea"
        placeholder="Write your ${cat} notes here…\n\nSuggested format:\nTitle:\nGoal:\nNotes:\n"
        >${saved}</textarea>

      <!-- Attached files panel — shows Firebase-uploaded files as clickable links -->
      <div id="npEditorFiles" style="flex-shrink:0;padding:0 16px 6px;"></div>

      <!-- Bottom bar -->
      <div class="np-editor-foot">
        <div style="display:flex;gap:8px;align-items:center;">
          <span id="npEditorWordCount" style="font-size:.72rem;color:var(--mut);"></span>
          ${cats.length>1?`<button onclick="APP._npDeleteCat('${cat}')" style="background:none;border:none;color:var(--mut);cursor:pointer;font-size:.72rem;padding:0;font-family:'Nunito',sans-serif;opacity:.6;">🗑 Delete</button>`:''}
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button onclick="APP._npOpenSearch('${cat}')" style="background:#eff6ff;color:#1760a0;border:1.5px solid #90b8e8;border-radius:7px;padding:4px 10px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;">🔍 Search</button>
          <button onclick="APP._npOpenImport('${cat}')" style="background:#f0fdf4;color:#1e7a45;border:1.5px solid #86efac;border-radius:7px;padding:4px 10px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;">📥 Import</button>
          <span style="font-size:.72rem;color:var(--mut);">💾 Sync</span>
        </div>
      </div>`;

    document.body.appendChild(el);

    // Focus textarea
    const ta = document.getElementById('npEditorArea');
    if(ta){
      // If a search term is pending, scroll to it instead of going to end
      const _pendingSearch = this._npLastSearchTerm || null;
      if(_pendingSearch){
        // Apply highlight first (don't move to end)
        ta.focus();
        try {
          const _rx = new RegExp(_pendingSearch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
          const _idx = ta.value.search(_rx);
          if(_idx >= 0){
            ta.setSelectionRange(_idx, _idx + (ta.value.match(_rx)||[''])[0].length);
            const _lines = ta.value.substring(0, _idx).split('\n');
            const _lh = parseInt(getComputedStyle(ta).lineHeight) || 24;
            ta.scrollTop = Math.max(0, (_lines.length - 3)) * _lh;
          } else {
            ta.setSelectionRange(ta.value.length, ta.value.length);
          }
        } catch(e){ ta.setSelectionRange(ta.value.length, ta.value.length); }
        // Show persistent highlight banner in status bar
        setTimeout(()=>{
          const _bar = document.getElementById('npEditorStatus');
          if(_bar){
            const _cnt = (ta.value.match(new RegExp(_pendingSearch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length;
            _bar.innerHTML = '<span style="background:#FFE600;color:#000;padding:1px 7px;border-radius:5px;font-weight:700;cursor:pointer;" title="Click to find next" onclick="APP._npFindNext(\''+_pendingSearch.replace(/'/g,"\\'")+'\')">'
              +'🔍 &quot;'+_pendingSearch+'&quot; — '+_cnt+' match'+ (_cnt!==1?'es':'')+' | Click→Next</span>';
          }
          // Clear so next open doesn't re-apply
          this._npLastSearchTerm = null;
        }, 150);
      } else {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
      // Update word count + file panel
      const updateWc = () => {
        const wc = ta.value.trim() ? ta.value.trim().split(/\s+/).filter(Boolean).length : 0;
        const wcel = document.getElementById('npEditorWordCount');
        if(wcel) wcel.textContent = wc + ' words';
        APP._npRenderFilePanel(ta.value);
      };
      updateWc();

      // Auto-save with debounce
      let _saveTimer;
      ta.addEventListener('input', () => {
        updateWc();
        const st = document.getElementById('npEditorStatus');
        if(st){ st.textContent='💾 Saving…'; st.style.color='var(--mut)'; }
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => {
          APP._saveNoteContent(cat, ta.value);
          const st2 = document.getElementById('npEditorStatus');
          if(st2){ st2.textContent='✔ Auto Saved'; st2.style.color='var(--grn)'; }
        }, 800);
      });
    }
  },

  // Render images as full photos + file links as chips — from note content
  _npRenderFilePanel(noteText){
    const panel = document.getElementById('npEditorFiles');
    if(!panel) return;

    // Match image embeds: ![name](url)
    const imgRx = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    // Match file links: icon [name | size](url)
    const fileRx = /([📄📝📊📋📃🎬🎵🗜️📎])\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

    const imgs = [], files = [];
    let m;
    while((m = imgRx.exec(noteText)) !== null) imgs.push({name:m[1], url:m[2]});
    while((m = fileRx.exec(noteText)) !== null) files.push({icon:m[1], label:m[2], url:m[3]});

    if(!imgs.length && !files.length){ panel.innerHTML=''; return; }

    let html = '<div style="padding:6px 0 4px;">';

    // Full-width images — visible photos
    if(imgs.length){
      html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;">';
      imgs.forEach(img => {
        html += `<div style="border-radius:10px;overflow:hidden;border:1.5px solid var(--bdr);background:var(--dim);">
          <img src="${img.url}" alt="${img.name}"
            style="width:100%;max-height:260px;object-fit:contain;display:block;cursor:pointer;"
            onclick="window.open('${img.url}','_blank')"
            onerror="this.parentElement.innerHTML='<div style=\\'padding:12px;font-size:.78rem;color:var(--mut);text-align:center;\\'>🖼️ ${img.name} (image not loading)</div>'">
          <div style="padding:4px 8px;font-size:.68rem;color:var(--mut);border-top:1px solid var(--bdr);">🖼️ ${img.name||'Image'} — tap to open full size</div>
        </div>`;
      });
      html += '</div>';
    }

    // File link chips
    if(files.length){
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
      files.forEach(f => {
        html += `<a href="${f.url}" target="_blank"
          style="display:inline-flex;align-items:center;gap:5px;background:#eff6ff;border:1.5px solid #90b8e8;border-radius:20px;padding:4px 12px;font-size:.74rem;font-weight:700;color:#1760a0;text-decoration:none;touch-action:manipulation;"
          title="Open: ${f.label}">
          ${f.icon} ${f.label}
        </a>`;
      });
      html += '</div>';
    }

    html += '</div>';
    panel.innerHTML = html;
  },

  _npCloseEditor(){
    const el = document.getElementById('npEditorOverlay');
    if(el){
      el.style.animation='npFadeIn .15s ease reverse';
      setTimeout(()=>el.remove(), 140);
    }
    // Refresh notepad tab if open
    if(this.curTab==='notepad') this.renderNotepadTab();
  },

  _npAddCategory(){
    const existing = document.getElementById('npAddCatOverlay');
    if(existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'npAddCatOverlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    el.innerHTML = `
      <div style="background:var(--card);border-radius:14px;width:100%;max-width:360px;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,.25);">
        <div style="font-weight:800;font-size:.95rem;margin-bottom:14px;">📂 Add New Category</div>
        <input id="npNewCatInp" type="text" placeholder="e.g. Medical, Travel, Legal, Ideas…"
          maxlength="30"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--bdr2);border-radius:9px;background:var(--bg);color:var(--txt);font-family:'Nunito',sans-serif;font-size:.9rem;outline:none;box-sizing:border-box;margin-bottom:10px;"
          onkeydown="if(event.key==='Enter') APP._npSaveNewCategory()">
        <div style="font-size:.72rem;color:var(--mut);margin-bottom:14px;">Max 30 characters. This will appear as a tab in your Notepad.</div>
        <div style="display:flex;gap:8px;">
          <button onclick="document.getElementById('npAddCatOverlay').remove()"
            style="flex:1;padding:9px;background:var(--dim);border:1.5px solid var(--bdr2);border-radius:8px;font-size:.84rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">
            Cancel
          </button>
          <button onclick="APP._npSaveNewCategory()"
            style="flex:2;padding:9px;background:var(--acc);color:#fff;border:none;border-radius:8px;font-size:.84rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;">
            ✅ Add Category
          </button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if(e.target===el) el.remove(); });
    setTimeout(() => { document.getElementById('npNewCatInp')?.focus(); }, 100);
  },

  _npSaveNewCategory(){
    const inp = document.getElementById('npNewCatInp');
    const name = inp ? inp.value.trim() : '';
    if(!name){ inp?.focus(); return; }
    const cats = this._getNoteCategories();
    if(cats.includes(name)){ this.showToastMsg('⚠️ "'+name+'" already exists!'); return; }
    cats.push(name);
    this._saveNoteCategories(cats);
    if(window.fbSave) window.fbSave('note_categories', cats).catch(()=>{});
    this._noteActiveCat = name;
    document.getElementById('npAddCatOverlay')?.remove();
    this.renderNotepadTab();
    this.showToastMsg('✅ Category "'+name+'" added!');
  },

  _npDeleteCat(cat){
    const cats = this._getNoteCategories();
    if(cats.length <= 1){ alert('Last category delete nahi kar sakte!'); return; }
    const catKey = cat.replace(/\s+/g,'_');
    const savedNote = localStorage.getItem('rk_note_'+catKey);
    const savedFiles = localStorage.getItem('rk_note_files_'+catKey);
    safeDelete(cat, ()=>{
      const c2 = this._getNoteCategories().filter(x=>x!==cat);
      this._saveNoteCategories(c2);
      if(window.fbSave) window.fbSave('note_categories',c2).catch(()=>{});
      localStorage.removeItem('rk_note_'+catKey);
      localStorage.removeItem('rk_note_files_'+catKey);
      this._noteActiveCat = c2[0]||'Personal';
      this._npCloseEditor();
      return true;
    }, ()=>{
      this._saveNoteCategories(cats);
      if(savedNote) localStorage.setItem('rk_note_'+catKey, savedNote);
      if(savedFiles) localStorage.setItem('rk_note_files_'+catKey, savedFiles);
      this.showToastMsg('✅ Category restored');
    });
  },

  // ── Notepad Search — searches all categories, highlights in yellow ──
  _npOpenSearch(activeCat){
    const existing = document.getElementById('npSearchOverlay');
    if(existing) existing.remove();
    const cats = this._getNoteCategories();
    const el = document.createElement('div');
    el.id = 'npSearchOverlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding:20px 14px;box-sizing:border-box;';
    el.innerHTML = `
      <div style="background:var(--card);border-radius:14px;width:100%;max-width:560px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.25);overflow:hidden;">
        <!-- Search bar -->
        <div style="padding:14px 16px;border-bottom:1px solid var(--bdr);display:flex;gap:8px;align-items:center;background:var(--card2);">
          <span style="font-size:1.1rem;">🔍</span>
          <input id="npSearchInp" type="text" placeholder="Search all notes — Hindi, English, numbers, anything…"
            style="flex:1;border:none;background:transparent;font-family:'Nunito',sans-serif;font-size:.9rem;outline:none;color:var(--txt);"
            oninput="APP._npDoSearch(this.value)">
          <button onclick="document.getElementById('npSearchOverlay').remove()"
            style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--mut);padding:0 4px;line-height:1;">✕</button>
        </div>
        <!-- Results -->
        <div id="npSearchResults" style="flex:1;overflow-y:auto;padding:10px 14px;">
          <div style="text-align:center;padding:30px;color:var(--mut);font-size:.85rem;">Type to search across all notes…</div>
        </div>
      </div>`;
    document.body.appendChild(el);
    // Close on backdrop click
    el.addEventListener('click', e => { if(e.target===el) el.remove(); });
    setTimeout(() => { const inp = document.getElementById('npSearchInp'); if(inp) inp.focus(); }, 100);
  },

  _npDoSearch(q){
    const res = document.getElementById('npSearchResults');
    if(!res) return;
    const query = q.trim();
    if(!query){ res.innerHTML = '<div style="text-align:center;padding:30px;color:var(--mut);font-size:.85rem;">Type to search across all notes…</div>'; return; }
    const cats = this._getNoteCategories();
    // Escape regex special chars
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'gi');
    let html = '';
    let totalMatches = 0;
    cats.forEach(cat => {
      const content = this._getNoteContent(cat);
      if(!content) return;
      const matches = [...content.matchAll(rx)];
      if(!matches.length) return;
      totalMatches += matches.length;
      // Build highlighted snippets — show each match with context
      const snippets = matches.slice(0,8).map(m => {
        const start = Math.max(0, m.index - 40);
        const end = Math.min(content.length, m.index + query.length + 40);
        const pre = content.slice(start, m.index).replace(/</g,'&lt;');
        const match = content.slice(m.index, m.index + m[0].length).replace(/</g,'&lt;');
        const post = content.slice(m.index + m[0].length, end).replace(/</g,'&lt;');
        return `<div style="font-size:.78rem;color:var(--txt);line-height:1.5;padding:4px 0;border-bottom:1px solid var(--bdr);">
          …${pre}<mark style="background:#FFE600;color:#000;border-radius:3px;padding:0 2px;font-weight:700;">${match}</mark>${post}…
        </div>`;
      }).join('');
      const icon = cat==='Personal'?'👤':cat==='Work'?'💼':cat==='Legal'?'⚖️':cat==='Finance'?'💰':'📝';
      html += `<div style="margin-bottom:12px;background:var(--dim);border-radius:10px;overflow:hidden;">
        <div style="padding:8px 12px;background:var(--card2);display:flex;align-items:center;justify-content:space-between;cursor:pointer;"
          onclick="document.getElementById('npSearchOverlay').remove();APP._npOpenEditorWithHighlight('${cat}','${escaped}')">
          <div style="font-weight:800;font-size:.82rem;">${icon} ${cat} <span style="font-size:.72rem;font-weight:400;color:var(--mut);">${matches.length} match${matches.length>1?'es':''}</span></div>
          <span style="font-size:.76rem;color:var(--acc);font-weight:700;">Open ↗</span>
        </div>
        <div style="padding:6px 12px;">${snippets}</div>
      </div>`;
    });
    if(!html) html = `<div style="text-align:center;padding:30px;color:var(--mut);font-size:.85rem;">No matches found for "<b>${query.replace(/</g,'&lt;')}</b>"</div>`;
    else html = `<div style="font-size:.72rem;color:var(--mut);margin-bottom:8px;padding:2px 0;">${totalMatches} match${totalMatches>1?'es':''} found</div>` + html;
    res.innerHTML = html;
  },

  // Open editor with yellow highlights on the search term
  _npOpenEditorWithHighlight(cat, searchTerm){
    // Set search term BEFORE opening editor — _npOpenEditor will apply it
    this._npLastSearchTerm = searchTerm;
    this._npOpenEditor(cat);
    // Fallback: if highlight wasn't applied by _npOpenEditor (e.g. async timing), retry
    const _applyHighlightFallback = () => {
      const ta = document.getElementById('npEditorArea');
      if(!ta || !searchTerm) return;
      // Only apply if status bar doesn't already show the search banner
      const bar = document.getElementById('npEditorStatus');
      if(bar && bar.querySelector('span[style*="FFE600"]')) return; // already applied
      try {
        const rx = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
        const idx = ta.value.search(rx);
        if(idx >= 0){
          ta.focus();
          ta.setSelectionRange(idx, idx + (ta.value.match(rx)||[''])[0].length);
          const lines = ta.value.substring(0, idx).split('\n');
          const lineH = parseInt(getComputedStyle(ta).lineHeight) || 24;
          ta.scrollTop = Math.max(0, (lines.length - 3)) * lineH;
          if(bar){
            const cnt=(ta.value.match(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length;
            bar.innerHTML = '<span style="background:#FFE600;color:#000;padding:1px 7px;border-radius:5px;font-weight:700;cursor:pointer;" title="Click to find next" onclick="APP._npFindNext(\'' + searchTerm.replace(/'/g,"\\'") + '\')">'
              +'🔍 &quot;' + searchTerm + '&quot; — ' + cnt + ' match'+(cnt!==1?'es':'')+' | Click→Next</span>';
          }
        } else {
          if(bar) bar.innerHTML = '<span style="color:#e05050;font-weight:700;">🔍 No match for &quot;' + searchTerm + '&quot;</span>';
        }
      } catch(e) {}
    };
    setTimeout(_applyHighlightFallback, 400);
  },

  // Find next occurrence in notepad
  _npFindNext(searchTerm){
    const ta = document.getElementById('npEditorArea');
    if(!ta || !searchTerm) return;
    try {
      const rx = new RegExp(searchTerm, 'gi');
      const matches = [...ta.value.matchAll(rx)];
      if(!matches.length) return;
      const curStart = ta.selectionStart;
      // Find next match after current cursor
      const next = matches.find(m => m.index > curStart) || matches[0];
      if(next){
        ta.focus();
        ta.setSelectionRange(next.index, next.index + next[0].length);
        const lines = ta.value.substring(0, next.index).split('\n');
        const lineH = parseInt(getComputedStyle(ta).lineHeight) || 24;
        ta.scrollTop = Math.max(0, (lines.length - 3)) * lineH;
      }
    } catch(e) {}
  },

  // ── Notepad Import — text, QR image, link ──
  _npOpenImport(defaultCat){
    const existing = document.getElementById('npImportOverlay');
    if(existing) existing.remove();
    const cats = this._getNoteCategories();
    const catOpts = cats.map(c => `<option value="${c}"${c===defaultCat?' selected':''}>${c}</option>`).join('');
    const el = document.createElement('div');
    el.id = 'npImportOverlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:0;box-sizing:border-box;';
    el.innerHTML = `
      <div style="background:var(--card);border-radius:14px 14px 0 0;width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -4px 30px rgba(0,0,0,.25);overflow:hidden;">
        <!-- Header — fixed -->
        <div style="padding:10px 14px;border-bottom:1px solid var(--bdr);background:var(--card2);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="font-weight:800;font-size:.88rem;">📥 Import to Notepad</div>
          <button onclick="document.getElementById('npImportOverlay').remove()"
            style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
        </div>
        <!-- Scrollable content -->
        <div style="padding:12px 14px;overflow-y:auto;flex:1;">

          <!-- Step 1: Choose category -->
          <div style="margin-bottom:10px;">
            <label style="font-size:.74rem;font-weight:700;color:var(--mut);display:block;margin-bottom:4px;">📂 Category</label>
            <select id="npImportCat" style="width:100%;padding:9px 11px;border:1.5px solid var(--bdr2);border-radius:8px;background:var(--bg);color:var(--txt);font-family:'Nunito',sans-serif;font-size:.85rem;outline:none;">
              ${catOpts}
            </select>
          </div>

          <!-- Step 2: Where to paste -->
          <div style="margin-bottom:10px;">
            <label style="font-size:.74rem;font-weight:700;color:var(--mut);display:block;margin-bottom:4px;">📌 Where to Paste</label>
            <div style="display:flex;gap:6px;">
              <label style="flex:1;text-align:center;padding:8px;border:1.5px solid var(--bdr2);border-radius:8px;cursor:pointer;font-size:.78rem;font-weight:700;transition:all .12s;" id="npPos_start">
                <input type="radio" name="npImportPos" value="start" style="margin-right:4px;">⬆️ Beginning
              </label>
              <label style="flex:1;text-align:center;padding:8px;border:1.5px solid var(--acc);background:#fff8ee;border-radius:8px;cursor:pointer;font-size:.78rem;font-weight:700;" id="npPos_end">
                <input type="radio" name="npImportPos" value="end" checked style="margin-right:4px;">⬇️ End
              </label>
              <label style="flex:1;text-align:center;padding:8px;border:1.5px solid var(--bdr2);border-radius:8px;cursor:pointer;font-size:.78rem;font-weight:700;" id="npPos_cursor">
                <input type="radio" name="npImportPos" value="cursor" style="margin-right:4px;">✏️ Cursor
              </label>
            </div>
          </div>

          <!-- Step 3: What to import -->
          <div style="margin-bottom:10px;">
            <label style="font-size:.74rem;font-weight:700;color:var(--mut);display:block;margin-bottom:6px;">📄 Import What</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <!-- Text / Link paste -->
              <textarea id="npImportText" placeholder="Paste text, link, or any content here…"
                style="width:100%;min-height:54px;padding:9px 11px;border:1.5px solid var(--bdr2);border-radius:8px;background:var(--bg);color:var(--txt);font-family:'Nunito',sans-serif;font-size:.84rem;outline:none;resize:vertical;box-sizing:border-box;line-height:1.6;"></textarea>
              <!-- OR -->
              <div style="text-align:center;font-size:.72rem;color:var(--mut);font-weight:700;">— OR — Import from your phone</div>

              <!-- Three separate file access buttons -->
              <div style="display:flex;flex-direction:column;gap:8px;">

                <!-- Button 1: Downloads / Files folder — NO accept restriction = full file browser -->
                <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1.5px solid var(--bdr2);border-radius:9px;cursor:pointer;background:var(--bg);transition:all .15s;touch-action:manipulation;"
                  onmouseover="this.style.borderColor='var(--acc)';this.style.background='#f0f7ff'" onmouseout="this.style.borderColor='var(--bdr2)';this.style.background='var(--bg)'">
                  <span style="font-size:1.1rem;flex-shrink:0;">📁</span>
                  <div style="flex:1;">
                    <div style="font-size:.78rem;font-weight:800;color:var(--txt);">Browse Files / Downloads</div>
                    <div style="font-size:.7rem;color:var(--mut);">Opens your Download folder, Documents, all files</div>
                  </div>
                  <input type="file" id="npImportFileInp"
                    style="display:none;position:absolute;left:-9999px;"
                    onchange="APP._npHandleImageImport(this)">
                </label>

                <!-- Button 2: Gallery — images only -->
                <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1.5px solid var(--bdr2);border-radius:9px;cursor:pointer;background:var(--bg);transition:all .15s;touch-action:manipulation;"
                  onmouseover="this.style.borderColor='var(--acc)';this.style.background='#f0f7ff'" onmouseout="this.style.borderColor='var(--bdr2)';this.style.background='var(--bg)'">
                  <span style="font-size:1.1rem;flex-shrink:0;">🖼️</span>
                  <div style="flex:1;">
                    <div style="font-size:.78rem;font-weight:800;color:var(--txt);">Gallery / Photos</div>
                    <div style="font-size:.7rem;color:var(--mut);">Select QR code image or screenshot from gallery</div>
                  </div>
                  <input type="file" id="npImportGalleryInp" accept="image/*"
                    style="display:none;position:absolute;left:-9999px;"
                    onchange="APP._npHandleImageImport(this)">
                </label>

                <!-- Button 3: Camera — take photo of QR -->
                <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1.5px solid var(--bdr2);border-radius:9px;cursor:pointer;background:var(--bg);transition:all .15s;touch-action:manipulation;"
                  onmouseover="this.style.borderColor='var(--acc)';this.style.background='#f0f7ff'" onmouseout="this.style.borderColor='var(--bdr2)';this.style.background='var(--bg)'">
                  <span style="font-size:1.1rem;flex-shrink:0;">📷</span>
                  <div style="flex:1;">
                    <div style="font-size:.78rem;font-weight:800;color:var(--txt);">Camera — Scan QR</div>
                    <div style="font-size:.7rem;color:var(--mut);">Take photo of QR code to decode and import text</div>
                  </div>
                  <input type="file" id="npImportCameraInp" accept="image/*" capture="environment"
                    style="display:none;position:absolute;left:-9999px;"
                    onchange="APP._npHandleImageImport(this)">
                </label>

              </div>

              <div id="npImportQrResult" style="display:none;background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:9px 12px;font-size:.8rem;color:#1e7a45;font-weight:600;word-break:break-all;"></div>
            </div>
          </div>

        </div>
        <!-- Import button — STICKY at bottom, always visible -->
        <div style="padding:10px 14px;border-top:1px solid var(--bdr);background:var(--card);flex-shrink:0;">
          <button onclick="APP._npDoImport()"
            style="width:100%;padding:10px;background:var(--acc);color:#fff;border:none;border-radius:9px;font-size:.88rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;">
            📥 Import Now
          </button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if(e.target===el) el.remove(); });
    // Radio highlight style
    el.querySelectorAll('input[name="npImportPos"]').forEach(r => {
      r.addEventListener('change', () => {
        el.querySelectorAll('label[id^="npPos_"]').forEach(l => {
          l.style.borderColor='var(--bdr2)'; l.style.background='';
        });
        const lbl = el.querySelector(`label[id="npPos_${r.value}"]`);
        if(lbl){ lbl.style.borderColor='var(--acc)'; lbl.style.background='#fff8ee'; }
      });
    });
  },

  // Handle QR image import — reads image, tries to decode QR using browser
  // ── File selected: upload to Firebase Storage, store permanent link ──
  _npHandleImageImport(inp){
    if(!inp.files||!inp.files[0]) return;
    const file = inp.files[0];
    const resultEl = document.getElementById('npImportQrResult');
    const ta = document.getElementById('npImportText');
    const ext = file.name.split('.').pop().toLowerCase();
    const icon = {pdf:'📄',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',webp:'🖼️',gif:'🖼️',heic:'🖼️',
      doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📋',pptx:'📋',
      txt:'📃',csv:'📃',mp4:'🎬',mp3:'🎵',zip:'🗜️',rar:'🗜️'}[ext]||'📎';
    const sizeTxt = file.size>1048576?(file.size/1048576).toFixed(1)+' MB':Math.round(file.size/1024)+' KB';

    // Store file reference for upload during Import Now
    this._npPendingFile = file;
    this._npPendingIcon = icon;
    this._npPendingSizeTxt = sizeTxt;

    if(resultEl){
      resultEl.style.display='block';
      resultEl.style.color='#1760a0';
      resultEl.innerHTML = icon+' <b>'+file.name+'</b> ('+sizeTxt+')<br>'
        +'<span style="font-size:.72rem;color:var(--mut);">✅ File selected — tap Import Now to upload to Firebase & save link in note</span>';
    }

    // For QR images — also try to decode
    if(file.type.startsWith('image/') && window.BarcodeDetector){
      const img = new Image();
      img.onload = async () => {
        try{
          const bd = new BarcodeDetector({formats:['qr_code','ean_13','code_128','data_matrix']});
          const codes = await bd.detect(img);
          if(codes.length){
            const decoded = codes.map(c=>c.rawValue).join(' | ');
            this._npPendingQrText = decoded;
            if(resultEl) resultEl.innerHTML += '<br><span style="background:#FFE600;color:#000;padding:1px 6px;border-radius:4px;font-size:.75rem;font-weight:700;">🔍 QR decoded: '+decoded.slice(0,80)+'</span>';
          }
        }catch(e){}
      };
      img.src = URL.createObjectURL(file);
    } else {
      this._npPendingQrText = null;
    }
  },

  // ── Import Now: upload file to Firebase, paste clickable link into note ──
  async _npDoImport(){
    const cat = document.getElementById('npImportCat')?.value;
    const pos = document.querySelector('input[name="npImportPos"]:checked')?.value||'end';
    const manualText = (document.getElementById('npImportText')?.value||'').trim();
    const pendingFile = this._npPendingFile;
    if(!cat){ this.showToastMsg('⚠️ Category choose karo!'); return; }
    if(!manualText && !pendingFile){ this.showToastMsg('⚠️ Text daalo ya file select karo!'); return; }

    const overlay = document.getElementById('npImportOverlay');
    const btn = overlay?.querySelector('button[onclick="APP._npDoImport()"]');
    if(btn){ btn.textContent='⏳ Uploading…'; btn.disabled=true; }

    let importLine = '';

    if(pendingFile){
      const icon = this._npPendingIcon||'📎';
      const sizeTxt = this._npPendingSizeTxt||'';
      // Upload to Firebase Storage
      const isImg = pendingFile.type.startsWith('image/');
      if(window.fbUploadFile){
        try{
          this.showToastMsg('⏳ Firebase pe upload ho raha hai…');
          const res = await window.fbUploadFile(pendingFile, 'notepad-files', pct=>{
            if(btn) btn.textContent='⏳ '+pct+'%…';
          });
          if(isImg){
            // Image: embed as visible photo using ![](url) syntax
            importLine = '!['+pendingFile.name+']('+res.url+')';
            if(this._npPendingQrText) importLine += '\n🔍 QR: '+this._npPendingQrText;
          } else {
            // Non-image: clickable file link
            importLine = icon+' ['+pendingFile.name+' | '+sizeTxt+']('+res.url+')';
          }
          this.showToastMsg('✅ Upload complete!');
        }catch(e){
          if(isImg){
            // Firebase failed for image — try local blob URL (temporary, works now)
            const blobUrl = URL.createObjectURL(pendingFile);
            importLine = '!['+pendingFile.name+']('+blobUrl+')';
            this.showToastMsg('⚠️ Firebase fail — image shown locally (may not persist)');
          } else {
            importLine = icon+' '+pendingFile.name+' ('+sizeTxt+') — upload failed, save manually';
            this.showToastMsg('⚠️ Upload fail — filename saved');
          }
        }
      } else {
        if(isImg){
          const blobUrl = URL.createObjectURL(pendingFile);
          importLine = '!['+pendingFile.name+']('+blobUrl+')';
          this.showToastMsg('⚠️ Firebase not ready — image shown locally');
        } else {
          importLine = icon+' '+pendingFile.name+' ('+sizeTxt+')';
          if(this._npPendingQrText) importLine += '\n🔍 QR: '+this._npPendingQrText;
          this.showToastMsg('⚠️ Firebase not ready — filename saved');
        }
      }
    }

    // Combine file link + any manual text
    const finalText = [importLine, manualText].filter(Boolean).join('\n');
    if(!finalText){ this.showToastMsg('⚠️ Kuch import karne ke liye content nahi hai!'); return; }

    // Paste at chosen position
    let current = this._getNoteContent(cat);
    let newContent;
    if(pos==='start'){
      newContent = finalText+(current?'\n\n'+current:'');
    } else if(pos==='end'){
      newContent = (current?current+'\n\n':'')+finalText;
    } else {
      // cursor
      const ta2 = document.getElementById('npEditorArea');
      if(ta2 && this._noteActiveCat===cat){
        const cp = ta2.selectionStart||ta2.value.length;
        newContent = ta2.value.substring(0,cp)+'\n'+finalText+'\n'+ta2.value.substring(cp);
        ta2.value = newContent;
        ta2.setSelectionRange(cp+finalText.length+2, cp+finalText.length+2);
        ta2.focus();
      } else {
        newContent = (current?current+'\n\n':'')+finalText;
      }
    }

    if(newContent!==undefined) this._saveNoteContent(cat, newContent);

    // Clear pending
    this._npPendingFile = null;
    this._npPendingIcon = null;
    this._npPendingSizeTxt = null;
    this._npPendingQrText = null;

    if(overlay) overlay.remove();
    this._npOpenEditor(cat);
    this.showToastMsg('✅ Import ho gaya — '+cat+' mein!');
  },


  // GLOBAL SEARCH — Header button + overlay modal
  // ══════════════════════════════════════════════
  _searchFilter: 'all',

  openSearchBar(){
    M.open('searchOverlay');
    // Reset
    var inp = document.getElementById('globalSearchInp');
    if(inp){ inp.value = ''; inp.focus(); }
    document.getElementById('searchResultsWrap').innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--mut);"><div style="font-size:2.5rem;margin-bottom:8px;">🔍</div><div style="font-size:.9rem;font-weight:600;">Kuch bhi type karo</div><div style="font-size:.78rem;margin-top:4px;line-height:1.6;">Property · Tenant · Rent · Reminder · Medical · Travel<br>Expense · To Do · Diary · Notepad · <b style="color:#854f0b;">📒 Khata Book</b><br><span style="color:#1e7a45;font-weight:700;">— Poora dashboard ek jagah search hoga —</span></div></div>';
    // Reset filter to All
    this._searchFilter = 'all';
    document.querySelectorAll('.sf-btn').forEach(function(b){
      var isAll = b.getAttribute('data-f') === 'all';
      b.style.background = isAll ? 'var(--acc)' : '';
      b.style.color = isAll ? '#fff' : '';
      b.style.borderColor = isAll ? 'var(--acc)' : '';
    });
  },

  setSearchFilter(btn){
    this._searchFilter = btn.getAttribute('data-f') || 'all';
    document.querySelectorAll('.sf-btn').forEach(function(b){
      var active = b === btn;
      b.style.background = active ? 'var(--acc)' : '';
      b.style.color = active ? '#fff' : '';
      b.style.borderColor = active ? 'var(--acc)' : '';
    });
    var inp = document.getElementById('globalSearchInp');
    this.doSearch(inp ? inp.value : '');
  },

  // renderSearchTab — for tab-based search (same logic, uses tab-scoped IDs)
  renderSearchTab(){
    var pan = document.getElementById('pan-search');
    if(!pan) return;
    var h = '<div class="sec-hdr"><div class="sec-title">\u{1F50D} Smart Search</div></div>';
    h += '<div style="background:var(--card);border:2px solid var(--acc);border-radius:12px;padding:8px 16px;display:flex;align-items:center;gap:10px;margin-bottom:16px;box-shadow:0 2px 12px rgba(181,112,28,.15);">';
    h += '<span style="font-size:1.3rem;color:var(--acc);">\u{1F50D}</span>';
    // Bug2 fix: use tab-scoped IDs (tabSearchInp / tabSearchResultsWrap) to avoid duplicate IDs
    // with the static #searchOverlay modal which owns globalSearchInp / searchResultsWrap
    h += '<input id="tabSearchInp" type="text" placeholder="Kuch bhi likhao \u2014 naam, date, amount, doctor, property..." style="flex:1;background:transparent;border:none;font-size:.95rem;padding:8px 0;outline:none;color:var(--txt);" oninput="APP._tabDoSearch(this.value)">';
    h += '<button onclick="document.getElementById(\x27tabSearchInp\x27).value=\x27\x27;APP._tabDoSearch(\x27\x27)" style="background:transparent;border:none;color:var(--mut);cursor:pointer;font-size:1.1rem;padding:4px 8px;">\u2715</button>';
    h += '</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">';
    h += '<button class="sf-btn-tab btn b-sm" data-f="all" onclick="APP._tabSetFilter(this)" style="background:var(--acc);color:#fff;border-color:var(--acc);">All</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="property" onclick="APP._tabSetFilter(this)">\u{1F3E2} Property</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="tenant" onclick="APP._tabSetFilter(this)">\u{1F464} Tenant</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="rent" onclick="APP._tabSetFilter(this)">\u{1F4B0} Rent</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="reminder" onclick="APP._tabSetFilter(this)">\u{1F514} Reminder</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="medical" onclick="APP._tabSetFilter(this)">\u{1F3E5} Medical</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="travel" onclick="APP._tabSetFilter(this)">\u2708\uFE0F Travel</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="expense" onclick="APP._tabSetFilter(this)">\u{1F4B8} Expense</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="todo" onclick="APP._tabSetFilter(this)">\u2705 To Do</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="diary" onclick="APP._tabSetFilter(this)">\u{1F4D6} Diary</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="notepad" onclick="APP._tabSetFilter(this)">\u{1F4DD} Notepad</button>';
    h += '<button class="sf-btn-tab btn b-sm b-out" data-f="khata" onclick="APP._tabSetFilter(this)" style="background:#fff8ee;border-color:#e8a060;color:#854f0b;">\u{1F4D2} Khata Book</button>';
    h += '</div>';
    h += '<div id="tabSearchResultsWrap" style="max-height:65vh;overflow-y:auto;"><div style="text-align:center;padding:40px;color:var(--mut);">\u{1F50D} Upar kuch type karo</div></div>';
    pan.innerHTML = h;
    setTimeout(function(){var el=document.getElementById('tabSearchInp');if(el)el.focus();},100);
  },

  // Tab search helpers — mirror the overlay search but use tab-scoped elements
  _tabSetFilter(btn){
    this._tabSearchFilter = btn.getAttribute('data-f') || 'all';
    document.querySelectorAll('.sf-btn-tab').forEach(function(b){
      var active = b === btn;
      b.style.background = active ? 'var(--acc)' : '';
      b.style.color = active ? '#fff' : '';
      b.style.borderColor = active ? 'var(--acc)' : '';
    });
    var inp = document.getElementById('tabSearchInp');
    this._tabDoSearch(inp ? inp.value : '');
  },

  _tabDoSearch(q){
    // Runs doSearch logic but writes results to tabSearchResultsWrap
    const wrap = document.getElementById('tabSearchResultsWrap');
    if(!wrap) return;
    // Temporarily swap _searchFilter with _tabSearchFilter
    const savedFilter = this._searchFilter;
    this._searchFilter = this._tabSearchFilter || 'all';
    // Run the full search, then redirect output to the tab wrap
    q = (q||'').trim().toLowerCase();
    if(!q){
      wrap.innerHTML = '<div style="text-align:center;padding:40px;color:var(--mut);">🔍 Kuch type karo...</div>';
      this._searchFilter = savedFilter;
      return;
    }
    // Temporarily point doSearch output to the tab wrap by swapping getElementById
    const _orig = document.getElementById.bind(document);
    const _patchedGet = function(id){ return id==='searchResultsWrap'?wrap:_orig(id); };
    document.getElementById = _patchedGet;
    try{ this.doSearch(q); } catch(e){}
    document.getElementById = _orig;
    this._searchFilter = savedFilter;
  },

  // ══════════════════════════════════════════════════════════════════
  // DEEP SEARCH ENGINE v2 — Google-like exact navigation + highlight
  // ══════════════════════════════════════════════════════════════════
  _hl(text, q){
    if(!text||!q) return text||'';
    try {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return String(text).replace(new RegExp('('+escaped+')', 'gi'),
        '<mark style="background:#fff176;color:#333;border-radius:2px;padding:0 2px;font-weight:700;">$1</mark>');
    } catch(e){ return String(text); }
  },
  _snippet(text, q, before=50, after=100){
    if(!text) return '';
    const idx = text.toLowerCase().indexOf((q||'').toLowerCase());
    if(idx<0) return this._hl(text.slice(0,120)+'…', q);
    const start = Math.max(0,idx-before);
    const end = Math.min(text.length, idx+q.length+after);
    return (start>0?'…':'')+this._hl(text.slice(start,end),q)+(end<text.length?'…':'');
  },

  doSearch(q){
    const wrap = document.getElementById('searchResultsWrap');
    if(!wrap) return;
    q = (q||'').trim().toLowerCase();
    if(!q){
      wrap.innerHTML = '<div style="text-align:center;padding:40px;color:var(--mut);">🔍 Kuch type karo...</div>';
      return;
    }
    const results = [];
    const self    = this;
    
    // ── FLEXIBLE MATCH: Support special characters in search ──
    const flexMatch = str => {
      const s = String(str||'').toLowerCase();
      // Direct match (exact substring)
      if (s.includes(q)) return true;
      // Normalized match (remove special chars: - / . space)
      const normalized = s.replace(/[-\/\.\s]/g, '');
      const qNormalized = q.replace(/[-\/\.\s]/g, '');
      if (normalized.includes(qNormalized)) return true;
      return false;
    };
    
    const match   = flexMatch;  // Use flexible match
    const matchObj= obj => {
      const jsonStr = JSON.stringify(obj||{}).toLowerCase();
      // Try direct match first
      if (jsonStr.includes(q)) return true;
      // Try normalized match
      const normalized = jsonStr.replace(/[-\/\.\s]/g, '');
      const qNormalized = q.replace(/[-\/\.\s]/g, '');
      return normalized.includes(qNormalized);
    };
    const f       = this._searchFilter || 'all';
    
    // ── Smart Date Search: Try to normalize query as date ──
    const normalizedDate = normalizeSearchDate(q);
    const matchDate = normalizedDate ? (dateStr => {
      if(!dateStr) return false;
      // Normalize the date string being checked
      const normalized = normalizeSearchDate(dateStr);
      return normalized === normalizedDate;
    }) : () => false;

    // ── NAVIGATION ITEMS — tabs, pages, buttons ──
    if(f==='all'||f==='nav'){
      const navItems = [
        {label:'🏠 Home',         tab:'home',     desc:'Dashboard home — summary, reminders, rent'},
        {label:'🏢 Properties',   tab:'property', desc:'Property management — add/edit properties'},
        {label:'🏠 Rent',         tab:'rent',     desc:'Tenant management, payments, ledger'},
        {label:'🔔 Reminders',    tab:'reminder', desc:'Document reminders, expiry alerts'},
        {label:'💸 Finance',      tab:'expense',  desc:'Transactions, accounts, budget, charts'},
        {label:'🏥 Medical',      tab:'medical',  desc:'Doctor visits, prescriptions, lab reports'},
        {label:'✈️ Travel',       tab:'travel',   desc:'Trips, bookings, bucket list'},
        {label:'📅 Calendar',     tab:'calendar', desc:'Monthly calendar view'},
        {label:'📖 Diary',        tab:'diary',    desc:'Personal diary entries'},
        {label:'📝 Notepad',      tab:'notepad',  desc:'Notes, URLs, categories'},
        {label:'✅ To Do',         tab:'todo',     desc:'Task list, pending items'},
        {label:'📒 Khata Book',   tab:'khata',    desc:'Party ledger, cash register, debts'},
        {label:'👤 Persons',      tab:'persons',  desc:'Family members, person-wise filter'},
        {label:'🔍 Search',       tab:'search',   desc:'Global search across all data'},
      ];
      navItems.forEach(n=>{
        const hay = n.label.toLowerCase()+' '+n.desc.toLowerCase()+' '+n.tab.toLowerCase();
        if(hay.includes(q)) results.push({
          sec:'📌 Page / Tab', breadcrumb:'Navigation',
          title: self._hl(n.label,q),
          preview: self._hl(n.desc,q),
          go: n.tab, itemId:'', itemType:'nav',
          _raw: n.label+' — '+n.desc
        });
      });
    }

    // ── Property ──
    if(f==='all'||f==='property')
      this.props.forEach(p=>{
        if(matchObj(p)) results.push({
          sec:'🏢 Property', breadcrumb:'Property',
          title: self._hl(p.name||'',q),
          preview: self._snippet((p.city||'')+' '+(p.type||'')+' '+(p.area||'')+' sq.ft '+(p.notes||''),q),
          go:'property', itemId:p.id, itemType:'property',
          _raw: JSON.stringify(p)
        });
      });

    // ── Tenant ──
    if(f==='all'||f==='tenant')
      this.tenants.forEach(t=>{
        if(matchObj(t)){
          const pr = self.props.find(p=>p.id===t.propId);
          results.push({
            sec:'👤 Tenant', breadcrumb:'Rent › Tenants',
            title: self._hl(t.name||'',q),
            preview: self._snippet((pr?pr.name:'')+' ₹'+fmt(t.rent)+'/mo '+(t.status||'')+' ph:'+(t.ph||'')+' '+(t.notes||''),q),
            go:'rent', itemId:t.id, itemType:'tenant', rentSub:'tenants',
            _raw: JSON.stringify(t)
          });
        }
      });

    // ── Payment ──
    if(f==='all'||f==='rent')
      this.payments.forEach(p=>{
        if(matchObj(p)){
          const t = self.tenants.find(x=>x.id===p.tenantId);
          results.push({
            sec:'💰 Payment', breadcrumb:'Rent › Payments',
            title: self._hl('₹'+fmt(p.amount)+' — '+(t?t.name:'Unknown'),q),
            preview: self._snippet(fD(p.date)+' '+(p.mode||'')+' '+(p.ref||'')+' '+(p.note||'')+' '+(p.ptype||'payment'),q),
            go:'rent', itemId:p.id, itemType:'payment', rentSub:'history',
            _raw: JSON.stringify(p)
          });
        }
      });

    // ── Reminder ──
    if(f==='all'||f==='reminder')
      this.reminders.forEach(r=>{
        const hasTextMatch = matchObj(r);
        const hasDateMatch = normalizedDate && (matchDate(r.exp) || matchDate(r.start) || matchDate(r.issue));
        if(hasTextMatch || hasDateMatch){
          const dateInfo = r.exp ? 'Expiry: '+fD(r.exp) : (r.start ? 'Start: '+fD(r.start) : '');
          results.push({
            sec:'🔔 Reminder', breadcrumb:'Reminders › '+(r.type||''),
            title: self._hl((r.name||'')+(r.type?' — '+r.type:''),q),
            preview: self._snippet(dateInfo+' '+(r.person||'')+' '+(r.notes||'')+' before:'+(r.before||'')+'d',q),
            go:'reminder', itemId:r.id, itemType:'reminder',
            _raw: JSON.stringify(r)
          });
        }
      });

    // ── Medical ──
    if(f==='all'||f==='medical'){
      this.patients.forEach(p=>{
        if(matchObj(p)) results.push({
          sec:'👤 Patient', breadcrumb:'Medical › '+p.name,
          title: self._hl(p.name||'',q),
          preview: self._snippet((p.relation||'')+' DOB:'+fD(p.dob)+' '+(p.cond||'')+' '+(p.ins||''),q),
          go:'medical', itemId:p.id, itemType:'patient',
          _raw: JSON.stringify(p)
        });
      });
      this.visits.forEach(v=>{
        if(matchObj(v)){
          const p = self.patients.find(x=>x.id===v.patId);
          results.push({
            sec:'🏥 Visit', breadcrumb:'Medical › '+(p?p.name:'?'),
            title: self._hl('Dr.'+(v.doctor||v.doc||'?')+' — '+(p?p.name:'?'),q),
            preview: self._snippet((v.spec||'')+' '+(v.type||'')+' '+fD(v.date)+' '+(v.purpose||'')+' '+(v.meds||'')+' '+(v.notes||'')+' '+(v.labname||''),q),
            go:'medical', itemId:v.id, itemType:'visit', patId:v.patId,
            _raw: JSON.stringify(v)
          });
        }
      });
    }

    // ── Travel ──
    if(f==='all'||f==='travel')
      this.trips.forEach(t=>{
        if(matchObj(t)) results.push({
          sec:'✈️ Travel', breadcrumb:'Travel',
          title: self._hl(String(t.dest||'').toUpperCase()+(t.city?' · '+t.city:''),q),
          preview: self._snippet((t.dom||'')+' '+fD(t.dep)+' → '+fD(t.ret)+' '+(t.trans||'')+' '+(t.hotel||'')+' '+(t.notes||'')+' budget:₹'+fmt(t.budget||0),q),
          go:'travel', itemId:t.id, itemType:'trip',
          _raw: JSON.stringify(t)
        });
      });

    // ── Finance / Expense ──
    if(f==='all'||f==='expense'){
      const exps = this.expenses||JSON.parse(localStorage.getItem('rk_expenses')||'[]');
      exps.forEach(e=>{
        const fileNames = (e.files||[]).map(f=>f.name||'').join(' ');
        const haystack  = JSON.stringify(e)+' '+fileNames;
        if(haystack.toLowerCase().includes(q)) results.push({
          sec:'💸 Finance', breadcrumb:'Finance › Transactions',
          title: self._hl((e.type==='income'?'+ ':'− ')+'₹'+fmt(e.amount)+' — '+(e.cat||''),q),
          preview: self._snippet(fD(e.date)+' '+(e.note||'')+' '+(e.paymode||'')+' '+(e.account||'')+' '+(fileNames||''),q),
          go:'expense', itemId:e.id, itemType:'expense', finSub:'txn',
          _raw: JSON.stringify(e)
        });
      });
      // Finance section keyword match
      if('finance transactions accounts budget charts reports'.includes(q.toLowerCase())||
         q.toLowerCase().includes('finance')||q.toLowerCase().includes('expense')||
         q.toLowerCase().includes('income')||q.toLowerCase().includes('budget')){
        results.unshift({
          sec:'📌 Page / Tab', breadcrumb:'Navigation',
          title: self._hl('💸 Finance Module',q),
          preview: 'Transactions · Accounts · Budget · Charts · Reports',
          go:'expense', itemId:'', itemType:'nav',
          _raw:'Finance Module'
        });
      }
    }

    // ── Notepad ──
    if(f==='all'||f==='notepad'){
      const cats = this._getNoteCategories();
      cats.forEach(cat=>{
        const np = this._getNoteContent(cat)||'';
        const files = (this._getNoteFiles?this._getNoteFiles(cat):[]);
        const fileNames = files.map(f=>f.name||'').join(' ');
        const hay = np.toLowerCase()+' '+cat.toLowerCase()+' '+fileNames.toLowerCase();
        if(hay.includes(q)){
          results.push({
            sec:'📝 Notepad', breadcrumb:'Notepad › '+cat,
            title: self._hl(cat+' Notes',q),
            preview: self._snippet(np+(fileNames?' [Files: '+fileNames+']':''),q,60,120),
            go:'notepad', itemId:cat, itemType:'notepad_cat', noteCat:cat,
            _raw:np
          });
        }
      });
    }

    // ── To Do ──
    if(f==='all'||f==='todo'){
      let todos; try{ todos=this.todos||JSON.parse(localStorage.getItem('rk_todos')||'[]'); }catch{ todos=[]; }
      todos.forEach(t=>{
        if(match(t.text)) results.push({
          sec:'✅ To Do', breadcrumb:'To Do',
          title: self._hl(t.text||'',q),
          preview: (t.done?'✅ Completed':'⏳ Pending')+' · '+fD(t.created||''),
          go:'todo', itemId:t.id, itemType:'todo',
          _raw:t.text
        });
      });
    }

    // ── Diary ──
    if(f==='all'||f==='diary'){
      let diary; try{ diary=JSON.parse(localStorage.getItem('rk_diary')||'[]'); }catch{ diary=[]; }
      diary.forEach(e=>{
        const hay = (e.body||'')+(e.title||'')+(e.tags||'')+(e.date||'');
        if(hay.toLowerCase().includes(q)) results.push({
          sec:'📖 Diary', breadcrumb:'Diary › '+fD(e.date),
          title: self._hl(e.title||'(No Title)',q),
          preview: self._snippet(e.body||'',q,60,120),
          go:'diary', itemId:e.id, itemType:'diary',
          _raw:e.body||''
        });
      });
    }

    // ── Khata Book ──
    if(f==='all'||f==='khata'){
      const parties = this.kbParties||[];
      const entries = this.kbEntries||[];
      const cash    = this.kbCash||[];

      parties.forEach(p=>{
        if(matchObj(p)){
          const bal = this._kbPartyBalance(p.id);
          results.push({
            sec:'📒 Khata Book', breadcrumb:'Khata › Party',
            title: self._hl(p.name||'',q),
            preview: self._snippet((p.phone||'')+' '+(p.cat||'')+' '+(p.notes||'')+
              ' Dena:₹'+fmt(bal.dena)+' Lena:₹'+fmt(bal.lena),q,50,100),
            go:'khata', itemId:p.id, itemType:'kb_party',
            _raw:JSON.stringify(p)
          });
        }
      });
      entries.forEach(e=>{
        if(matchObj(e)){
          const party = parties.find(p=>p.id===e.partyId);
          const fileNames=(e.files||[]).map(f=>f.name||'').join(' ');
          results.push({
            sec:'📒 Khata Book', breadcrumb:'Khata › '+(party?party.name:'Entry'),
            title: self._hl((e.type==='lena'?'🤲 Liya':'💸 Diya')+' ₹'+fmt(e.amount)+(party?' — '+party.name:''),q),
            preview: self._snippet(fD(e.date)+' '+(e.note||'')+' '+(e.mode||'')+' '+fileNames,q,40,80),
            go:'khata', itemId:e.partyId, itemType:'kb_party',
            _raw:JSON.stringify(e)
          });
        }
      });
      cash.forEach(e=>{
        if(matchObj(e)) results.push({
          sec:'📒 Khata Book', breadcrumb:'Khata › Cash',
          title: self._hl((e.type==='in'?'⬇️ Cash In':'⬆️ Cash Out')+' ₹'+fmt(e.amount),q),
          preview: self._snippet(fD(e.date)+' '+(e.cat||'')+' '+(e.note||''),q,40,80),
          go:'khata', itemId:'cash', itemType:'kb_cash',
          _raw:JSON.stringify(e)
        });
      });
    }

    // ── Empty state ──
    if(!results.length){
      wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--mut);font-size:.9rem;">
        <div style="font-size:2rem;margin-bottom:8px;">😕</div>
        "<b>${q}</b>" kaheen nahi mila<br>
        <span style="font-size:.78rem;color:var(--mut);">Try karo: property name, tenant, amount, doctor, category...</span>
      </div>`;
      return;
    }

    // ── Render results ──
    wrap.innerHTML = `<div style="font-size:.78rem;color:var(--mut);margin-bottom:10px;padding:4px 2px;">
      <b>${results.length}</b> result${results.length>1?'s':''} — "<b>${q}</b>"
    </div>`
    + results.map((r,i)=>{
        const nav = JSON.stringify({
          q, itemId:r.itemId||'', itemType:r.itemType||'',
          patId:r.patId||'', rentSub:r.rentSub||'',
          noteCat:r.noteCat||'', finSub:r.finSub||''
        }).replace(/'/g,"\\'");
        const navSafe = nav.replace(/"/g,"'");

        return `<div
          style="background:var(--card);border:1.5px solid var(--bdr);border-radius:11px;padding:11px 14px;margin-bottom:7px;cursor:pointer;transition:all .15s;position:relative;"
          onmouseover="this.style.borderColor='var(--acc)';this.style.background='#f7fbff';this.style.boxShadow='0 3px 12px rgba(44,111,173,.12)'"
          onmouseout="this.style.borderColor='var(--bdr)';this.style.background='var(--card)';this.style.boxShadow='none'"
          onclick="APP._deepNavigate('${r.go}',${navSafe})">

          <!-- Section badge + breadcrumb -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:6px;flex-wrap:wrap;">
            <span style="font-size:.62rem;font-weight:700;color:var(--acc);text-transform:uppercase;letter-spacing:.07em;background:#eff6ff;padding:2px 8px;border-radius:8px;">${r.sec}</span>
            <span style="font-size:.62rem;color:var(--mut);font-family:'JetBrains Mono',monospace;">${r.breadcrumb}</span>
          </div>

          <!-- Title -->
          <div style="font-size:.86rem;font-weight:700;color:var(--txt);margin-bottom:3px;line-height:1.4;">${r.title}</div>

          <!-- Preview with highlighted match -->
          <div style="font-size:.74rem;color:var(--mut);line-height:1.55;border-left:2px solid #dbeafe;padding-left:8px;">${r.preview}</div>

          <!-- Go arrow -->
          <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:.9rem;color:var(--bdr2);">›</div>
        </div>`;
      }).join('');
  },


  // ── Deep Navigation: go to exact item, highlight, scroll ──
  _deepNavigate(tab, nav){
    const {q, itemId, itemType, patId, rentSub, noteCat} = nav;
    // Store pending highlight
    this._pendingHighlight = q;
    this._pendingItemId = itemId;
    this._pendingItemType = itemType;
    this._pendingPatId = patId;

    M.close('searchOverlay');

    if(itemType==='notepad_cat' && noteCat){
      // Switch to exact notepad category
      this._noteActiveCat = noteCat;
      this.goTab('notepad');
      setTimeout(()=>{
        const ta = document.getElementById('notepadMain');
        if(ta && q){
          // Scroll textarea to match position
          const txt = ta.value.toLowerCase();
          const idx = txt.indexOf(q.toLowerCase());
          if(idx>=0){
            // Create a temporary overlay highlight over textarea
            this._highlightNotepadText(ta, q);
          }
        }
        const panel = document.getElementById('pan-notepad');
        if(panel && q) this._highlightInPanel(panel, q);
      }, 400);
      return;
    }

    if(itemType==='diary' && itemId){
      this.diaryQuery = q;
      if(!this._diaryExpanded) this._diaryExpanded={};
      this._diaryExpanded[itemId] = true;
      this.goTab('diary');
      setTimeout(()=>{
        const panel = document.getElementById('pan-diary');
        if(panel && q) this._highlightInPanel(panel, q);
      }, 500);
      return;
    }

    if(itemType==='visit' && patId){
      this.medFilter30 = false;
      this.curPatient = patId;
      this.goTab('medical');
      setTimeout(()=>{
        const panel = document.getElementById('pan-medical');
        if(panel && q) this._highlightInPanel(panel, q);
      }, 400);
      return;
    }

    if(itemType==='patient' && itemId){
      this.curPatient = itemId;
      this.goTab('medical');
      setTimeout(()=>{
        const panel = document.getElementById('pan-medical');
        if(panel && q) this._highlightInPanel(panel, q);
      }, 400);
      return;
    }

    if(itemType==='reminder' && itemId){
      this.goTab('reminder');
      setTimeout(()=>{
        // Expand the card
        const det = document.getElementById('rdet_'+itemId.replace(/[^a-z0-9]/gi,'_'));
        if(det) det.style.display='block';
        const panel = document.getElementById('pan-reminder');
        if(panel && q){
          this._highlightInPanel(panel, q);
          // Also glow the card
          setTimeout(()=>{
            const first = panel.querySelector('mark.search-hl');
            if(first){
              const card = first.closest('[style*="border-radius:11px"]')||first.parentElement;
              if(card){
                card.style.outline='3px solid var(--acc)';
                card.style.boxShadow='0 0 0 4px rgba(44,111,173,.18)';
                setTimeout(()=>{card.style.outline='';card.style.boxShadow='';},3000);
              }
            }
          },200);
        }
      }, 400);
      return;
    }

    if(itemType==='tenant' && rentSub){
      this.rentSub = rentSub;
      this.goTab('rent');
      setTimeout(()=>{
        const panel = document.getElementById('pan-rent');
        if(panel && q) this._highlightInPanel(panel, q);
      }, 400);
      return;
    }

    if(itemType==='payment'){
      this.rentSub = 'history';
      this.goTab('rent');
      setTimeout(()=>{
        const panel = document.getElementById('pan-rent');
        if(panel && q) this._highlightInPanel(panel, q);
      }, 400);
      return;
    }

    // Khata Book — navigate to specific party or cash
    if(itemType==='kb_party' && itemId){
      this._kbSub = 'parties';
      this._kbActiveParty = itemId === 'cash' ? null : itemId;
      this.goTab('khata');
      setTimeout(()=>{
        const panel = document.getElementById('pan-khata');
        if(panel && q) this._highlightInPanel(panel, q);
      }, 450);
      return;
    }

    if(itemType==='kb_cash'){
      this._kbSub = 'cash';
      this._kbActiveParty = null;
      this.goTab('khata');
      setTimeout(()=>{
        const panel = document.getElementById('pan-khata');
        if(panel && q) this._highlightInPanel(panel, q);
      }, 450);
      return;
    }

    // Default: just go to tab and highlight
    this.goTab(tab);
    setTimeout(()=>{
      const panel = document.getElementById('pan-'+tab);
      if(panel && q) this._highlightInPanel(panel, q);
    }, 450);
  },

  // Highlight text inside a textarea via overlay marker (visual only)
  // ── Notepad live Find-in-Note ──
  _npFindInNote(q, cat){
    const countEl = document.getElementById('npFindCount');
    // Always clear old overlay first
    const old = document.getElementById('npHighlightOverlay');
    if(old) old.remove();
    const ta = document.getElementById('notepadMain');
    if(ta) ta.style.display = '';

    if(!q || !q.trim()){
      if(countEl) countEl.textContent = '';
      return;
    }
    q = q.trim();
    const ta2 = document.getElementById('notepadMain');
    if(!ta2) return;
    this._highlightNotepadText(ta2, q);
    // Update count display
    const txt = ta2.value || '';
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const matches = [...txt.matchAll(new RegExp(esc,'gi'))];
    if(countEl) countEl.textContent = matches.length ? `${matches.length} found` : '0 found';
  },

  _npClearFind(){
    const old = document.getElementById('npHighlightOverlay');
    if(old) old.remove();
    const ta = document.getElementById('notepadMain');
    if(ta){ ta.style.display = ''; ta.style.outline=''; ta.style.boxShadow=''; }
    const countEl = document.getElementById('npFindCount');
    if(countEl) countEl.textContent = '';
  },

  _highlightNotepadText(ta, q){
    if(!ta||!q) return;
    const txt = ta.value;
    if(!txt.toLowerCase().includes(q.toLowerCase())) return;

    // Count all occurrences
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const rx = new RegExp('('+esc+')','gi');
    const matches = [...txt.matchAll(rx)];
    const count = matches.length;

    // Build highlighted HTML — replace \n with <br>, escape HTML, mark all
    const safe = txt
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(new RegExp('('+esc+')','gi'),
        '<mark class="np-hl" style="background:#ffe066;border-radius:3px;padding:1px 3px;font-weight:700;color:#1a1d23;box-shadow:0 0 0 1px rgba(200,160,0,.4);">$1</mark>')
      .replace(/\n/g,'<br>');

    // Create overlay div to replace textarea
    const wrap = ta.parentElement;
    const existOverlay = document.getElementById('npHighlightOverlay');
    if(existOverlay) existOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'npHighlightOverlay';
    overlay.style.cssText = `
      position:relative; background:#fff; border:2px solid #ffe066;
      border-radius:9px; padding:12px 14px; min-height:360px;
      font-family:'Nunito',sans-serif; font-size:.86rem; line-height:1.8;
      color:#1a1d23; white-space:pre-wrap; word-break:break-word;
      overflow-y:auto; max-height:520px; box-shadow:0 0 0 4px rgba(255,224,102,.2);
    `;
    overlay.innerHTML = `
      <div style="position:sticky;top:0;background:#fff8e0;border-radius:7px;padding:7px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;border:1px solid #e8c040;z-index:2;">
        <span style="font-size:.78rem;font-weight:700;color:#7a4000;">
          🔍 "<b>${q}</b>" — <span style="color:#1e7a45;">${count} occurrence${count>1?'s':''} found</span>
        </span>
        <button onclick="document.getElementById('npHighlightOverlay').remove();document.getElementById('notepadMain').style.display='';"
          style="background:#2c6fad;color:#fff;border:none;border-radius:6px;padding:4px 11px;font-size:.74rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">
          ✏️ Back to Edit
        </button>
      </div>
      <div id="npHighlightContent">${safe}</div>
    `;

    // Hide textarea, show overlay
    ta.style.display = 'none';
    wrap.appendChild(overlay);

    // Scroll to first match
    setTimeout(()=>{
      const first = overlay.querySelector('mark.np-hl');
      if(first){
        first.scrollIntoView({behavior:'smooth', block:'center'});
        first.style.boxShadow = '0 0 0 3px rgba(255,160,0,.6)';
        setTimeout(()=>{ try{first.style.boxShadow='0 0 0 1px rgba(200,160,0,.4)';}catch(e){} }, 2000);
      }
    }, 150);
  },

  // ── Legacy alias ──
  _focusSearchResult(){
    if(this._pendingHighlight){
      this._deepNavigate(this.curTab,{
        q:this._pendingHighlight, itemId:this._pendingItemId||'',
        itemType:this._pendingItemType||'', patId:this._pendingPatId||'',
        rentSub:'', noteCat:''
      });
      this._pendingHighlight=null; this._pendingItemId=null;
      this._pendingItemType=null; this._pendingPatId=null;
    }
  },

  _highlightInPanel(panel, q){
    if(!q||!panel) return;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const rx = new RegExp('('+esc+')','gi');
    // Remove old highlights
    panel.querySelectorAll('mark.search-hl').forEach(m=>{ m.outerHTML=m.textContent; });
    // Walk text nodes (skip script/style/input/textarea)
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT,{
      acceptNode(node){
        const p = node.parentElement;
        if(!p) return NodeFilter.FILTER_REJECT;
        if(['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT','BUTTON'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        if(p.closest('script,style')) return NodeFilter.FILTER_REJECT;
        return node.textContent.toLowerCase().includes(q.toLowerCase()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const span = document.createElement('span');
      span.innerHTML = node.textContent.replace(rx,'<mark class="search-hl" style="background:#ffe066;border-radius:3px;padding:1px 3px;font-weight:700;color:#1a1d23;">$1</mark>');
      node.parentNode.replaceChild(span, node);
    });
    // Scroll to first match with a glow effect
    setTimeout(()=>{
      const first = panel.querySelector('mark.search-hl');
      if(first){
        first.scrollIntoView({behavior:'smooth',block:'center'});
        first.style.boxShadow='0 0 0 4px rgba(255,224,102,.6)';
        first.style.borderRadius='4px';
        setTimeout(()=>{ try{first.style.boxShadow='';}catch(e){} },3000);
      }
    },150);
  },


  // ══════════════════════════════════════════════════════
  // DIRECT WHATSAPP — One-click to specific contact
  // Usage: APP.sendWhatsApp(name, amount, phone, type)
  // ══════════════════════════════════════════════════════
  _cleanPhone(ph){
    if(!ph) return '';
    // Remove spaces, dashes, +, brackets
    let p = String(ph).replace(/[\s\-\+\(\)]/g,'');
    // If starts with 0, replace with 91
    if(p.startsWith('0')) p = '91' + p.slice(1);
    // If 10 digits (Indian), prepend 91
    if(/^[6-9]\d{9}$/.test(p)) p = '91' + p;
    return p;
  },
  // ── UPI QR Code Generator ──────────────────────────────────────
  openUPIQR(tenantId){
    const t = this.tenants.find(x=>x.id===tenantId);
    if(!t){ this.showToastMsg('Tenant not found'); return; }
    const rent = Number(t.rent||0);
    const maint = Number(t.maint||0);
    const total = rent + maint;

    // Get UPI ID from settings or use a placeholder
    const upiId = (this.persons && this.persons[0] && this._upiId) || '';

    const old = document.getElementById('_upiQRModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_upiQRModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;';

    const buildQR = (upi) => {
      // UPI deep link
      const upiLink = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent('Rent Payment')}&am=${total}&tn=${encodeURIComponent('Rent-'+t.name)}&cu=INR`;
      // Google Charts QR API
      const qrUrl = `https://chart.googleapis.com/chart?chs=220x220&cht=qr&chl=${encodeURIComponent(upiLink)}&choe=UTF-8`;
      const el = document.getElementById('_upiQRImg');
      if(el){ el.src = qrUrl; el.dataset.upiLink = upiLink; }
    };

    modal.innerHTML = `<div style="background:var(--card);border-radius:18px;padding:24px;width:100%;max-width:360px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-weight:800;font-size:1rem;">💳 UPI QR Code</div>
        <button onclick="document.getElementById('_upiQRModal').remove()" style="background:var(--dim);border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;">✕</button>
      </div>
      <div style="background:var(--dim);border-radius:12px;padding:10px;margin-bottom:14px;">
        <div style="font-size:.75rem;color:var(--mut);margin-bottom:2px;">Tenant</div>
        <div style="font-weight:800;font-size:.95rem;">${t.name}</div>
        <div style="font-size:.72rem;color:var(--mut);margin-top:4px;">Rent ₹${fmt(rent)}${maint?' + Maint ₹'+fmt(maint):''}</div>
        <div style="font-size:1.2rem;font-weight:900;color:var(--grn);margin-top:4px;">Total: ₹${fmt(total)}</div>
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:.7rem;font-weight:700;color:var(--mut);display:block;margin-bottom:4px;">Your UPI ID</label>
        <div style="display:flex;gap:6px;">
          <input id="_upi_id_inp" value="${upiId}" placeholder="yourname@upi or 9876543210@paytm"
            style="flex:1;border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);">
          <button onclick="(function(){var id=document.getElementById('_upi_id_inp').value.trim();if(!id){APP.showToastMsg('Enter UPI ID');return;}APP._upiId=id;buildQR(id);})()" style="background:var(--acc);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:.82rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">Generate</button>
        </div>
      </div>
      <div id="_upiQRBox" style="background:#fff;border-radius:12px;padding:12px;display:inline-block;margin-bottom:12px;">
        <img id="_upiQRImg" src="" alt="QR Code" style="width:200px;height:200px;display:block;" onerror="this.src='';this.alt='Enter UPI ID above to generate QR';">
        <div style="font-size:.65rem;color:#666;margin-top:6px;">Scan with any UPI app to pay</div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
        <button onclick="(function(){var img=document.getElementById('_upiQRImg');if(img&&img.src){var a=document.createElement('a');a.href=img.src;a.download='UPI-QR-${t.name}.png';a.click();}})()" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;border-radius:8px;padding:7px 14px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">⬇️ Download QR</button>
        <button onclick="(function(){var link=document.getElementById('_upiQRImg')?.dataset?.upiLink;if(link)window.open(link,'_blank');else APP.showToastMsg('Generate QR first');})()" style="background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;border-radius:8px;padding:7px 14px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">📲 Open UPI App</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });

    // buildQR needs to be in scope for inline onclick
    window._upiQRBuild = buildQR;
    modal.querySelector('button[onclick*="buildQR"]') && (modal.querySelector('button[onclick*="buildQR"]').onclick = function(){
      const id = document.getElementById('_upi_id_inp')?.value?.trim();
      if(!id){ APP.showToastMsg('⚠️ Enter your UPI ID first'); return; }
      APP._upiId = id; buildQR(id);
    });

    // Auto-generate if UPI ID known
    if(upiId) setTimeout(()=>buildQR(upiId),100);
  },

  sendWhatsApp(name, amount, phone, type, customMsg){
    const p = this._cleanPhone(phone);
    if(!p || p.length < 10){
      alert('Phone number missing or invalid!\nPlease add the phone number first.'); return;
    }
    let message = customMsg || '';
    if(!message){
      if(type === 'rent'){
        message = `💰 *Rent Due Notice*\n\nHello ${name},\n\nYour rent of ₹${amount} is pending.\nPlease deposit as soon as possible.\n\nThank you,\nRaman Kumar`;
      } else if(type === 'loan'){
        message = `🤝 *Loan Recovery*\n\nHello ${name},\n\nPlease return the pending loan amount of ₹${amount}.\n\nThank you,\nRaman Kumar`;
      } else if(type === 'reminder'){
        message = `🔔 *Reminder*\n\nHello ${name},\n\nThis is a reminder regarding: ${amount}.\nPlease take necessary action.\n\nRaman Kumar`;
      } else {
        message = `Hello ${name},\n\nThis is a reminder from Raman Kumar.`;
      }
    }
    const url = `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  },

  // ══ CALENDAR DATE CLICK POPUP ══
  showCalendarDayPopup(yr, mo, day){
    const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const allEvs = [];
    const dateStr = yr+'-'+String(mo+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    // Collect all events for this date
    this.reminders.forEach(r=>{
      // Check trigger date (actual reminder alert date)
      const rTrigDate = r.trigDate || (()=>{
        if(r.mode==='recurring') return r.nextTrigger||r.start||null;
        if(!r.exp) return null;
        try{ const d=new Date(r.exp); d.setDate(d.getDate()-parseInt(r.before||0)); return d.toISOString().split('T')[0]; }catch(e){return r.exp;}
      })();
      if(rTrigDate === dateStr){
        const timeStr = (r.alertHour && r.alertMin) ? ` at ${r.alertHour}:${r.alertMin}` : '';
        allEvs.push({icon:'🔔',title:r.name,type:'Reminder'+timeStr,detail:r.type||'',color:'#1a73e8'});
      }
      // Also check expiry and issue dates separately
      if(r.exp === dateStr && r.exp !== rTrigDate) allEvs.push({icon:'⚠️',title:r.name,type:'Reminder Expiry',detail:r.type||'',color:'#e05050'});
      if(r.issue === dateStr) allEvs.push({icon:'📋',title:r.name,type:'Reminder Issued',detail:r.type||'',color:'#1760a0'});
    });
    this.visits.forEach(r=>{
      const p=this.patients.find(x=>x.id===r.patId);
      const pname=p?p.name:'?';
      if(r.date === dateStr) allEvs.push({icon:'💊',title:pname+' — Dr.'+( r.doctor||'?'),type:'Doctor Visit',detail:r.spec||r.type||'',color:'#1e7a45'});
      if(r.next === dateStr) allEvs.push({icon:'🏥',title:pname+' — Follow-up',type:'Follow-up',detail:r.doctor?'Dr. '+r.doctor:'',color:'#5c3496'});
    });
    this.trips.forEach(t=>{
      if(t.dep === dateStr) allEvs.push({icon:'✈️',title:'Depart: '+t.dest,type:'Travel',detail:t.trans||'',color:'#1a6e62'});
      if(t.ret === dateStr) allEvs.push({icon:'🏁',title:'Return: '+t.dest,type:'Travel',detail:t.trans||'',color:'#8a6500'});
    });
    this.tenants.forEach(t=>{
      if(t.start === dateStr) allEvs.push({icon:'📝',title:t.name+' — Agreement Start',type:'Tenant',detail:'',color:'#b5701c'});
      if(t.end === dateStr) allEvs.push({icon:'📄',title:t.name+' — Agreement End',type:'Tenant',detail:'',color:'#b92d2d'});
    });
    // Custom calendar events
    this.getCalEvents().filter(ev=>ev.date===dateStr).forEach(ev=>{
      allEvs.push({icon:ev.type?ev.type.split(' ')[0]:'📅',title:ev.title+(ev.time?' ⏰ '+ev.time:''),type:ev.type||'Personal',detail:ev.note||'',color:ev.color||'#1565c0',_calEvId:ev.id});
    });

    const dayLabel = MONTHS[mo]+' '+day+', '+yr;
    const evHtml = allEvs.length ? allEvs.map(e=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8f9fa;border-radius:9px;margin-bottom:7px;border-left:3px solid ${e.color};">
        <span style="font-size:1.3rem;">${e.icon}</span>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:.88rem;color:#1a1d23;">${e.title}</div>
          <div style="font-size:.72rem;color:#6c757d;margin-top:2px;">${e.type}${e.detail?' · '+e.detail:''}</div>
        </div>
        <span style="font-size:.66rem;font-weight:700;color:${e.color};background:${e.color}18;padding:2px 7px;border-radius:8px;">${e.type}</span>
      </div>`).join('')
      : '<div style="text-align:center;padding:24px;color:#6c757d;font-size:.88rem;">📭 No events — tap + Add to create one</div>';

    // Remove old popup if any
    let old = document.getElementById('calDayPopup');
    if(old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'calDayPopup';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);z-index:600;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `<div style="background:#fff;border-radius:14px;padding:20px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.2);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e9ecef;">
        <div style="font-size:1rem;font-weight:800;color:#1a1d23;">📅 ${dayLabel}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button onclick="document.getElementById('calDayPopup').remove();APP.openCalEventModal('${dateStr}')" style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;border-radius:7px;padding:5px 10px;cursor:pointer;font-size:.78rem;font-weight:800;font-family:Nunito,sans-serif;">+ Add</button>
          <span style="background:#2c6fad;color:#fff;padding:2px 9px;border-radius:10px;font-size:.72rem;font-weight:700;">${allEvs.length} event${allEvs.length!==1?'s':''}</span>
          <button onclick="document.getElementById('calDayPopup').remove()" style="background:#f0f2f5;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;font-size:.85rem;color:#6c757d;font-weight:700;">✕</button>
        </div>
      </div>
      ${evHtml}
    </div>`;
    overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },
  // Keep old name as alias for backward compat
  applyTabHighlight(){ this._focusSearchResult(); },

  // ══ FILE DOWNLOAD HELPER ══
  downloadFile(url, filename) {
    const self = this;
    const name = filename || 'download';
    self.showToastMsg('⬇️ Downloading: ' + name);

    // For Firebase Storage — add alt=media + content-disposition to force download
    let downloadUrl = url;
    if (url.includes('firebasestorage.googleapis.com')) {
      try {
        const u = new URL(url);
        u.searchParams.set('alt', 'media');
        u.searchParams.set('response-content-disposition', 'attachment; filename="' + encodeURIComponent(name) + '"');
        downloadUrl = u.toString();
      } catch(e) {}
    }

    // Method 1: fetch → blob → objectURL (forces download for ALL types incl JPG/PDF)
    fetch(downloadUrl, { mode: 'cors' })
      .then(function(res) {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.blob();
      })
      .then(function(blob) {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 200);
        setTimeout(function() { self.showToastMsg('✅ Downloaded! Check your Downloads folder 📂'); }, 600);
      })
      .catch(function(err) {
        console.warn('Fetch download failed, using direct link:', err);
        // Method 2 fallback: direct anchor with download attr
        try {
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = name;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function() { self.showToastMsg('✅ Download started! Check your Downloads folder 📂'); }, 500);
        } catch(e2) {
          self.showToastMsg('❌ Download failed. Try View/Open instead.');
          window.open(url, '_blank');
        }
      });
  }
};

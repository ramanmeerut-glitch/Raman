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

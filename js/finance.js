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


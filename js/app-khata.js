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


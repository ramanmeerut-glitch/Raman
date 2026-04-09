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


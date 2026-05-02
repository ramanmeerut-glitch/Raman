/* modules/property.js — Property Management — properties, maintenance, payment ledger, reporting
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
  openPropModal(id){
    this._migratePropertyAnalysisData();
    // Use DEDICATED prop state vars — never share with this.editId (used by tenant/other modals)
    this._propEditId  = id || null;
    this._propDraftId = null;

    if(!id){
      // NEW property: create draft in storage immediately so entries have a place to save
      this._propDraftId = uid();
      const draft = {
        id:this._propDraftId, _draft:true,
        name:'', city:'', type:'', purchaseFrom:'', cost:'0',
        date:'', area:'', notes:'',
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
      ['name','city','area','notes'].forEach(f=>{try{sv('prm_'+f,p[f]||'');}catch(e){}});
      const typeEl=document.getElementById('prm_type'); if(typeEl) typeEl.value=p.type||'';
      const fromEl=document.getElementById('prm_from'); if(fromEl) fromEl.value=p.purchaseFrom||'';
      if(p.date) svDate('prm_date',p.date);
      const ledger = Array.isArray(p.ledger) ? p.ledger : [];
      const ledgerTotal = ledger.reduce((s,e)=>s+Number(e.amount||0),0);
      const costEl=document.getElementById('prm_cost');
      if(costEl) costEl.value = ledgerTotal>0 ? ledgerTotal : (p.cost||'');
    } else {
      ['name','city','area','notes'].forEach(f=>{try{sv('prm_'+f,'');}catch(e){}});
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
    this._renderLedgerList();

    if(window.FUM){
      FUM.clear('fu_prop_doc_wrap');
      FUM.init('fu_prop_doc_wrap','property-docs',[]);
      if(id && p && p.propFiles && p.propFiles.length) FUM.init('fu_prop_doc_wrap','property-docs',p.propFiles);
    }
    M.open('propM');
  },
    saveProp(){
    return this._runGuardedAction('saveProp', (release)=>{
    const name = v('prm_name');
    const type = v('prm_type');

    let hasErr = false;
    const nameErr=document.getElementById('prm_name_err'), nameEl=document.getElementById('prm_name');
    const typeErr=document.getElementById('prm_type_err'), typeEl=document.getElementById('prm_type');
    if(!name.trim()){ if(nameErr)nameErr.style.display='block'; if(nameEl)nameEl.style.borderColor='#e53935'; hasErr=true; }
    else { if(nameErr)nameErr.style.display='none'; if(nameEl)nameEl.style.borderColor='var(--bdr2)'; }
    if(!type){ if(typeErr)typeErr.style.display='block'; if(typeEl)typeEl.style.borderColor='#e53935'; hasErr=true; }
    else { if(typeErr)typeErr.style.display='none'; if(typeEl)typeEl.style.borderColor='var(--bdr2)'; }
    if(hasErr){ this.showToastMsg('⚠️ Required fields fill karein!'); release(); return; }

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
    });
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
      const dateStr = e.date ? fD(e.date) : '—';
      const refStr = e.reference ? ' · '+e.reference : '';
      const notesStr = e.notes ? '<br><span style="color:var(--mut);">'+e.notes+'</span>' : '';
      return '<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 9px;background:'+bg+';border-radius:7px;margin-bottom:4px;border:1px solid var(--bdr);">'
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:.78rem;font-weight:800;color:var(--txt);">'+e.purpose+'</div>'
        +'<div style="font-size:.68rem;color:var(--mut);margin-top:1px;">'+dateStr+' · '+e.paidTo+' · '+e.mode+refStr+notesStr+'</div>'
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
    if(p.cost && Number(p.cost)>0) return [{id:'legacy',date:p.date||'',amount:Number(p.cost)||0,paidTo:'Builder',purpose:'Purchase Cost',mode:'—',reference:'',notes:'Migrated from old record'}];
    return [];
  },

  openPropLedgerModal(propId){
    try {
    const p=this.props.find(x=>x.id===propId);
    if(!p){ console.warn('[openPropLedgerModal] Property not found:', propId); return; }
    const entries=this._getPropLedger(p);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const total=entries.reduce((s,e)=>s+Number(e.amount||0),0);
    const rows=entries.map((e,i)=>`
      <tr style="background:${i%2===0?'#fff':'#f8f9fa'};">
        <td style="padding:6px 8px;font-size:.75rem;color:#555;">${e.date?fD(e.date):'—'}</td>
        <td style="padding:6px 8px;font-size:.78rem;font-weight:700;">${e.purpose}</td>
        <td style="padding:6px 8px;font-size:.75rem;">${e.paidTo}</td>
        <td style="padding:6px 8px;font-size:.75rem;font-family:monospace;font-weight:800;color:#1a7a45;">₹${fmt2(e.amount)}</td>
        <td style="padding:6px 8px;font-size:.72rem;">${e.mode}</td>
        <td style="padding:6px 8px;font-size:.68rem;color:#666;">${e.reference||'—'}</td>
        <td style="padding:6px 8px;font-size:.68rem;color:#888;">${e.notes||'—'}</td>
      </tr>`).join('');

    const html=`<div style="font-size:.75rem;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <div style="background:#f0faf5;border:1.5px solid #90c8a0;border-radius:8px;padding:8px 14px;text-align:center;"><div style="font-size:.62rem;font-weight:800;color:#1a7a45;text-transform:uppercase;">Total Invested</div><div style="font-size:1rem;font-weight:900;color:#1a7a45;font-family:JetBrains Mono,monospace;">₹${fmt2(total)}</div></div>
      <div style="background:#fff8ee;border:1.5px solid #ffcc80;border-radius:8px;padding:8px 14px;text-align:center;"><div style="font-size:.62rem;font-weight:800;color:#b56a00;text-transform:uppercase;">Entries</div><div style="font-size:1rem;font-weight:900;color:#b56a00;">${entries.length}</div></div>
    </div>
    <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.78rem;">
      <thead><tr style="background:#2c6fad;color:#fff;">
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;white-space:nowrap;">Date</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Purpose</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Paid To</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Amount</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Mode</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Reference</th>
        <th style="padding:7px 8px;text-align:left;font-size:.7rem;">Notes</th>
      </tr></thead>
      <tbody>${rows||'<tr><td colspan="7" style="text-align:center;padding:12px;color:#888;">No ledger entries</td></tr>'}</tbody>
    </table></div>
    <div class="export-toolbar">
      ${APP._pdfOriHtml()}
      <button onclick="APP._propLedgerPDF('${propId}')" class="btn b-out export-tool-btn export-tool-pdf"><span class="material-symbols-outlined">picture_as_pdf</span><span>PDF</span></button>
      <button onclick="APP._propLedgerWord('${propId}')" class="btn b-out export-tool-btn export-tool-word"><span class="material-symbols-outlined">description</span><span>Word</span></button>
      <button onclick="APP._propLedgerCSV('${propId}')" class="btn b-out export-tool-btn export-tool-csv"><span class="material-symbols-outlined">table_view</span><span>CSV</span></button>
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
    const title=p.name+' — Builder Payment Ledger';
    const cols=['Date','Purpose','Paid To','Amount (₹)','Mode','Reference','Notes'];
    const pdfRows=entries.map(e=>[
      e.date?fD(e.date):'—', e.purpose, e.paidTo,
      'Rs.'+fmt2(e.amount), e.mode, e.reference||'—', e.notes||'—'
    ]);
    if(typeof _makePDF==='function'){
      _makePDF({
        filename:'Builder_Ledger_'+p.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf',
        title, subtitle:'Property: '+p.name+(p.purchaseFrom?' | Purchased From: '+p.purchaseFrom:'')+' | Generated: '+fD(new Date().toISOString().slice(0,10)),
        summaryRows:[
          ['Total Invested','Rs.'+fmt2(total),[26,122,69]],
          ['Entries',String(entries.length),[44,111,173]],
        ],
        entriesLabel:'Entries: '+entries.length,
        columns:cols, rows:pdfRows, colStyles:{3:{halign:'right'}},
        headerColor:[44,111,173],
      });
    } else {
      // Fallback: HTML print
      const tableRows=entries.map(e=>`<tr><td>${e.date?fD(e.date):'—'}</td><td><b>${e.purpose}</b></td><td>${e.paidTo}</td><td style="font-family:monospace;color:#1a7a45;font-weight:bold;">₹${fmt2(e.amount)}</td><td>${e.mode}</td><td>${e.reference||'—'}</td><td>${e.notes||'—'}</td></tr>`).join('');
      const html2=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:16mm 14mm;}h1{color:#2c6fad;}table{width:100%;border-collapse:collapse;}th{background:#2c6fad;color:#fff;padding:5px 7px;text-align:left;}td{padding:4px 7px;border-bottom:1px solid #eee;}tr:nth-child(even){background:#fafafa;}</style></head><body><h1>${title}</h1><p>Generated: ${todayDMY()}</p><p><b>Total: ₹${fmt2(total)}</b> | Entries: ${entries.length}</p><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
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
    const title=p.name+' — Builder Payment Ledger';
    const tableRows=entries.map(e=>`<w:tr><w:tc><w:p><w:r><w:t>${e.date?fD(e.date):'—'}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${(e.purpose||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${e.paidTo}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:color w:val="1a7a45"/><w:b/></w:rPr><w:t>Rs.${fmt2(e.amount)}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${e.mode}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${(e.reference||'—').replace(/&/g,'&amp;')}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${(e.notes||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</w:t></w:r></w:p></w:tc></w:tr>`).join('');
    const hdrCells=['Date','Purpose','Paid To','Amount','Mode','Reference','Notes'].map(h=>`<w:tc><w:tcPr><w:shd w:fill="2C6FAD" w:color="2C6FAD"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="18"/></w:rPr><w:t>${h}</w:t></w:r></w:p></w:tc>`).join('');
    const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><?mso-application progid="Word.Document"?><w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2C6FAD"/></w:rPr><w:t>🏗️ ${title}</w:t></w:r></w:p><w:p><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} | Total: Rs.${fmt2(total)} | Entries: ${entries.length}</w:t></w:r></w:p><w:p></w:p><w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tr>${hdrCells}</w:tr>${tableRows}</w:tbl><w:p></w:p><w:p><w:r><w:rPr><w:b/><w:color w:val="1a7a45"/></w:rPr><w:t>Total Investment: Rs.${fmt2(total)}</w:t></w:r></w:p></w:body></w:wordDocument>`;
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
    const headers=['Date','Purpose','Paid To','Amount','Mode','Reference','Notes'];
    const rows=entries.map(e=>[
      e.date?fD(e.date):'',
      '"'+(e.purpose||'').replace(/"/g,"'")+'"',
      e.paidTo, e.amount, e.mode,
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
      box.innerHTML =
        '<h2 style="margin:0 0 4px;font-size:1.05rem;">&#128176; Builder Payments</h2>'
        +'<div style="font-size:.75rem;color:var(--mut);margin-bottom:12px;">Property: <b>'+prop.name+'</b></div>'

        // Summary
        +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px;background:#f0f7ff;border-radius:9px;border:1.5px solid #90b8e8;">'
        +'<div style="flex:1;text-align:center;"><div style="font-size:.6rem;font-weight:800;color:#2c6fad;text-transform:uppercase;">Total Paid</div>'
        +'<div style="font-size:1.1rem;font-weight:900;color:#1a7a45;font-family:monospace;">'+fmt2(total)+'</div></div>'
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
                +'<td style="padding:5px 8px;"><button data-del="'+e.id+'" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:.8rem;padding:2px 4px;">&#128465;</button></td>'
                +'</tr>';
            }).join('')
          : '<tr><td colspan="6" style="text-align:center;padding:12px;color:#888;font-size:.75rem;">No payments recorded yet</td></tr>'
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

  _migratePropertyAnalysisData(){
    if(this._propertyAnalysisMigrated) return;
    this._propertyAnalysisMigrated = true;

    let changed = false;
    const cleanedProps = (this.props||[]).map(p=>{
      if(!p) return p;
      let next = p;
      if(Object.prototype.hasOwnProperty.call(next,'mkt')){
        const { mkt, ...rest } = next;
        next = rest;
        changed = true;
      }
      if(Object.prototype.hasOwnProperty.call(next,'loan')){
        const { loan, ...rest } = next;
        next = rest;
        changed = true;
      }
      if(Array.isArray(next.ledger) && next.ledger.some(e=>e && Object.prototype.hasOwnProperty.call(e,'source'))){
        next = {
          ...next,
          ledger: next.ledger.map(e=>{
            if(!e || !Object.prototype.hasOwnProperty.call(e,'source')) return e;
            const { source, ...rest } = e;
            return rest;
          })
        };
        changed = true;
      }
      if(next!==p && next.cost!==undefined){
        next = { ...next, cost: String(next.cost || 0) };
      }
      if(next===p) return p;
      return next;
    });
    if(changed) S.set('props', cleanedProps);

    try{
      Object.keys(localStorage)
        .filter(k=>k.startsWith('rk_valuation_'))
        .forEach(k=>localStorage.removeItem(k));
    }catch(e){}
  },


  // ══════════════════════════════════════════════════
  // PROPERTY PORTFOLIO REPORT
  // ══════════════════════════════════════════════════
  _propReportData(){
    const ps = this.props.filter(p=>!p._draft);
    const rows = ps.map(p=>{
      const led = p.ledger&&Array.isArray(p.ledger)&&p.ledger.length ? p.ledger : null;
      const invested = led ? led.reduce((s,e)=>s+Number(e.amount||0),0) : Number(p.cost||0);
      return {
        name: p.name||'—',
        type: p.type||'—',
        city: p.city||'—',
        purchaseDate: p.date ? fD(p.date) : '—',
        invested
      };
    });
    const totals = {
      invested: rows.reduce((s,r)=>s+r.invested,0)
    };
    return {rows, totals};
  },

  _showPropReport(){
    const {rows, totals} = this._propReportData();
    const f = n => fmt(n);
    const dateStr = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    const tblRows = rows.map((r,i)=>`
      <tr style="background:${i%2===0?'#fff':'#f8f9ff'};">
        <td style="padding:7px 10px;font-weight:700;font-size:.78rem;">${r.name}</td>
        <td style="padding:7px 10px;font-size:.72rem;color:var(--mut);">${r.type}</td>
        <td style="padding:7px 10px;font-size:.72rem;color:var(--mut);">${r.city}</td>
        <td style="padding:7px 10px;font-size:.72rem;color:var(--mut);">${r.purchaseDate}</td>
        <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:.76rem;color:var(--acc);font-weight:700;">${f(r.invested)}</td>
      </tr>`).join('');

    const thS = 'padding:8px 10px;text-align:right;font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#fff;font-family:"JetBrains Mono",monospace;white-space:nowrap;border-bottom:2px solid #1a3a6e;';
    const thL = 'padding:8px 10px;text-align:left;font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#fff;font-family:"JetBrains Mono",monospace;white-space:nowrap;border-bottom:2px solid #1a3a6e;';
    const html = `<div class="overlay open" id="propReportModal" onclick="if(event.target===this)APP._closePropReport()" style="z-index:600;">
      <div class="modal" style="max-width:98vw;width:1040px;padding:0;display:flex;flex-direction:column;max-height:92vh;">
        <div style="background:linear-gradient(135deg,#1e3a6e,#2c6fad);padding:16px 20px;border-radius:12px 12px 0 0;flex-shrink:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-size:1.1rem;font-weight:900;color:#fff;">📊 Property Portfolio Report</div>
              <div style="font-size:.72rem;color:#a0c4f0;margin-top:2px;">Raman Kumar | Generated: ${dateStr}</div>
            </div>
            <button onclick="APP._closePropReport()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:.82rem;font-weight:700;">✕ Close</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:12px 16px;background:#f8faff;border-bottom:1px solid var(--bdr);flex-shrink:0;">
          <div style="background:#fff;border:1.5px solid #90b8e8;border-radius:9px;padding:9px 11px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#2c6fad;text-transform:uppercase;margin-bottom:3px;">Total Invested</div>
            <div style="font-size:.95rem;font-weight:900;color:#1a3a6e;font-family:'JetBrains Mono',monospace;">${f(totals.invested)}</div>
          </div>
          <div style="background:#fff8ee;border:1.5px solid #ffcc80;border-radius:9px;padding:9px 11px;text-align:center;">
            <div style="font-size:.58rem;font-weight:800;color:#b56a00;text-transform:uppercase;margin-bottom:3px;">Properties</div>
            <div style="font-size:.95rem;font-weight:900;color:#b56a00;">${rows.length}</div>
          </div>
        </div>
        <div style="overflow:auto;flex:1;">
          <table style="width:100%;border-collapse:collapse;min-width:560px;">
            <thead>
              <tr style="background:linear-gradient(135deg,#1e3a6e,#2c6fad);">
                <th style="${thL}">Property</th>
                <th style="${thL}">Type</th>
                <th style="${thL}">City</th>
                <th style="${thL}">Purchase</th>
                <th style="${thS}">Invested</th>
              </tr>
            </thead>
            <tbody>${tblRows}</tbody>
            <tfoot>
              <tr style="background:linear-gradient(135deg,#1e3a6e,#2c6fad);">
                <td colspan="4" style="padding:9px 10px;font-weight:900;color:#fff;font-size:.82rem;">TOTAL (${rows.length} Properties)</td>
                <td style="padding:9px 10px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:900;color:#fff;font-size:.82rem;">${f(totals.invested)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--bdr);background:#f8faff;flex-shrink:0;flex-wrap:wrap;border-radius:0 0 12px 12px;">
          <span style="font-size:.72rem;font-weight:700;color:var(--mut);align-self:center;">Download:</span>
          <button onclick="APP._propReportPDF()" class="btn" style="background:#e53935;color:#fff;border:none;font-weight:800;">📄 PDF</button>${APP._pdfOriHtml()}
          <button onclick="APP._propReportCSV()" class="btn" style="background:#1a7a45;color:#fff;border:none;font-weight:800;">📊 Excel / CSV</button>
          <button onclick="APP._propReportWord()" class="btn" style="background:#1565c0;color:#fff;border:none;font-weight:800;">📝 Word</button>
        </div>
      </div>
    </div>`;
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
        ['Total Invested', f(totals.invested), '#2c6fad'],
        ['Properties', String(rows.length), '#b56a00'],
      ],
      columns: ['Property','Type','City','Purchase','Invested'],
      rows: rows.map(r=>[
        r.name, r.type, r.city, r.purchaseDate, f(r.invested)
      ]),
      totalsRow: ['TOTAL ('+rows.length+' properties)','','','', f(totals.invested)],
      colStyles:{
        4:{halign:'right'}
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
      ['Property','Type','City','Purchase Date','Invested (Rs)'],
      ...rows.map(r=>[
        esc(r.name), esc(r.type), esc(r.city), esc(r.purchaseDate), f(r.invested)
      ]),
      [],
      ['TOTAL','','','',f(totals.invested)],
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
        ${tc(f(r.invested),'2C6FAD',true)}
      </w:tr>`;
    }).join('');
    const totRow = (t,col)=>`<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="1E3A6E"/><w:left w:val="single" w:sz="4" w:color="1E3A6E"/><w:bottom w:val="single" w:sz="6" w:color="1E3A6E"/><w:right w:val="single" w:sz="4" w:color="1E3A6E"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="1E3A6E"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="${(col||'FFFFFF').replace('#','')}"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${String(t||'').replace(/&/g,'&amp;')}</w:t></w:r></w:p></w:tc>`;
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
  <w:p><w:r><w:rPr><w:b/><w:color w:val="1E3A6E"/><w:sz w:val="24"/></w:rPr><w:t>Portfolio Summary</w:t></w:r></w:p>
  <w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="BFDBFE"/><w:insideV w:val="single" w:sz="4" w:color="BFDBFE"/></w:tblBorders></w:tblPr>
    <w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Total Invested</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:b/><w:color w:val="2C6FAD"/></w:rPr><w:t>${f(totals.invested)}</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>Properties</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:color w:val="B56A00"/></w:rPr><w:t>${rows.length}</w:t></w:r></w:p></w:tc></w:tr>
  </w:tbl>
  <w:p><w:r><w:t> </w:t></w:r></w:p>
  <w:p><w:r><w:rPr><w:b/><w:color w:val="1E3A6E"/><w:sz w:val="24"/></w:rPr><w:t>Property-wise Detail</w:t></w:r></w:p>
  <w:tbl><w:tblPr><w:tblW w:w="10000" w:type="pct"/><w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="BFDBFE"/><w:insideV w:val="single" w:sz="4" w:color="BFDBFE"/></w:tblBorders></w:tblPr>
    <w:tr>${th('Property')}${th('Type')}${th('City')}${th('Purchase')}${th('Invested')}</w:tr>
    ${wRows}
    <w:tr>${totRow('TOTAL ('+rows.length+' props)')}${totRow('')}${totRow('')}${totRow('')}${totRow(f(totals.invested),'90F0B0')}</w:tr>
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

  renderProperty(){
    this._migratePropertyAnalysisData();
    // ── Backward compat ──────────────────────────────────────────────────────
    let ps=this.props.filter(p=>!p._draft).map(p=>({...p,ledger:Array.isArray(p.ledger)?p.ledger:[]}));
    if(!this.curProp&&ps.length) this.curProp='__all__';

    // ── Top nav ───────────────────────────────────────────────────────────────
    const nav=`<button class="pnav-btn ${'__all__'===this.curProp?'on':''}"
        onclick="APP.setCurProp('__all__')">All (${ps.length})</button>`
      +ps.map(p=>`<button class="pnav-btn ${p.id===this.curProp?'on':''}"
        onclick="APP.setCurProp('${p.id}')"
        style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
        title="${p.name}">${p.name.slice(0,18)}</button>`).join('')
      +`<button class="pnav-btn pnav-add" onclick="APP.openPropModal()">+ Add</button>`;

    // ── Helper: property financials ───────────────────────────────────────────
    const _pStats=(p)=>{
      const led=p.ledger&&p.ledger.length?p.ledger:null;
      const invested=led?led.reduce((s,e)=>s+Number(e.amount||0),0):Number(p.cost||0);
      return {invested};
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
      const totalInvested =allStats.reduce((s,x)=>s+x.invested,0);
      const totalRent     =this.tenants.filter(t=>t.status==='active').reduce((s,t)=>s+Number(t.rent||0)+Number(t.maint||0),0);
      const totalProp     =ps.length;
      const totalTenants  =this.tenants.filter(t=>t.status==='active').length;

      // ── Portfolio KPI strip ───────────────────────────────────────────────
      const kpi=(label,val,sub,color,bg,icon)=>`
        <div style="background:${bg};border:1.5px solid ${color}22;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;">
          <div style="font-size:.6rem;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:5px;">${icon} ${label}</div>
          <div style="font-size:1.15rem;font-weight:900;color:${color};font-family:'JetBrains Mono',monospace;">${val}</div>
          ${sub?`<div style="font-size:.62rem;color:${color};opacity:.75;font-weight:700;">${sub}</div>`:''}
        </div>`;

      // ── Property cards ────────────────────────────────────────────────────
      const propCards=allStats.map(({p,invested})=>{
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
            onclick="APP.setCurProp('${p.id}')">
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
              <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Properties</div>
              <div style="font-size:.92rem;font-weight:900;color:#1565c0;font-family:'JetBrains Mono',monospace;">1</div>
            </div>
          </div>

          <!-- Financial row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--bdr);border-bottom:1px solid var(--bdr);">
            <div style="padding:8px 10px;text-align:center;border-right:1px solid var(--bdr);">
              <div style="font-size:.55rem;color:var(--mut);text-transform:uppercase;font-weight:700;margin-bottom:3px;">Invested</div>
              <div style="font-size:.8rem;font-weight:800;color:var(--acc);font-family:'JetBrains Mono',monospace;">${fmt(invested)}</div>
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
          ${kpi('Total Invested', totalInvested?fmt(totalInvested):'—', totalProp?totalProp+' properties':null, '#1565c0','#e3f2fd','🏢')}
          ${kpi('Monthly Rent', fmt(totalRent), totalTenants+' active tenant'+(totalTenants!==1?'s':''), '#b56a00','#fff8ee','💰')}
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
              <button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;font-weight:700;font-size:.72rem;" onclick="APP.openPropLedgerModal('${p.id}')">📒 Ledger</button>
              <button class="btn b-sm" style="background:#fce4ec;color:#c62828;border:1.5px solid #f48fb1;font-weight:700;font-size:.72rem;" onclick="APP.openMaintenanceModal('${p.id}')">🔧 Maint</button>
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
            </div>
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:12px 14px;">
              <div style="font-size:.58rem;font-weight:800;color:var(--org);text-transform:uppercase;margin-bottom:5px;">💵 This Month</div>
              <div style="font-size:1rem;font-weight:900;color:${monthColl>=monthExp?'var(--grn)':'var(--org)'};font-family:'JetBrains Mono',monospace;">${fmt(monthColl)}</div>
              <div style="font-size:.6rem;color:var(--mut);margin-top:2px;">of ${fmt(monthExp)} expected · ${collectPct}%</div>
            </div>
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:12px 14px;">
              <div style="font-size:.58rem;font-weight:800;color:#5c3496;text-transform:uppercase;margin-bottom:5px;">👥 Tenants</div>
              <div style="font-size:1rem;font-weight:900;color:#5c3496;font-family:'JetBrains Mono',monospace;">${pts.length}</div>
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



});

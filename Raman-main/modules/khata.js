/* modules/khata.js — Khata Book — renderKhata, party ledger, entries, cash register, download
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
  _kbDefaultCategories(){
    return ['personal','property','friend','vendor','loan','tenant','other'];
  },
  _kbCategories(){
    const saved=S.obj('kbCategories', this._kbDefaultCategories());
    const list=Array.isArray(saved)?saved:[];
    return [...new Set([...this._kbDefaultCategories(), ...list.filter(Boolean)])];
  },
  _kbSaveCategories(list){
    S.set('kbCategories', [...new Set((list||[]).filter(Boolean))]);
  },
  _kbRefresh(){
    this.renderTab(this.curTab||'khata');
  },
  _kbCashTotals(){
    const cash=Array.isArray(this.kbCash)?this.kbCash:[];
    let totalIn=0,totalOut=0;
    cash.forEach(function(e){
      const amt=Number(e&&e.amount||0);
      if(!amt) return;
      if(e.type==='out') totalOut+=amt;
      else totalIn+=amt;
    });
    return { totalIn, totalOut, balance: totalIn-totalOut };
  },
  _kbPartyBalance(partyId){
    const entries=(Array.isArray(this.kbEntries)?this.kbEntries:[]).filter(e=>e&&e.partyId===partyId);
    let lena=0, dena=0;
    entries.forEach(function(e){
      const amt=Number(e.amount||0);
      if(!amt) return;
      if(e.type==='dena') dena+=amt;
      else lena+=amt;
    });
    return { lena, dena, net:lena-dena, entries };
  },
  _kbRenderEntryFiles(files){
    const list=Array.isArray(files)?files.filter(f=>f&&f.url):[];
    if(!list.length) return '';
    return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${list.map(function(f){
      const name=(f.name||'Attachment').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<a href="${f.url}" target="_blank" rel="noopener" style="font-size:.66rem;background:#eef4ff;border:1px solid #d9e4ff;color:#2563eb;padding:3px 8px;border-radius:999px;text-decoration:none;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${name}">📎 ${name}</a>`;
    }).join('')}</div>`;
  },
  _kbPartyLabel(cat){
    const map={
      personal:'Personal / Family',
      property:'Property / Rent',
      friend:'Friend',
      vendor:'Vendor / Supplier',
      loan:'Loan',
      tenant:'Tenant',
      other:'Other'
    };
    return map[cat]||cat||'Other';
  },
  _kbSanitizePhone(phone){
    return String(phone||'').replace(/[^\d]/g,'');
  },
  _kbOpenWhatsApp(phone, message){
    const clean=this._kbSanitizePhone(phone);
    if(!clean){ this.showToastMsg('⚠️ Phone number missing'); return; }
    const url='https://wa.me/91'+clean+'?text='+encodeURIComponent(message||'');
    window.open(url,'_blank','noopener');
  },
  _kbAddCategory(){
    const name=(prompt('New Khata category name')||'').trim();
    if(!name) return;
    const key=name.toLowerCase().replace(/\s+/g,'-');
    const cats=this._kbCategories();
    if(cats.includes(key)){ this.showToastMsg('⚠️ Category already exists'); return; }
    cats.push(key);
    this._kbSaveCategories(cats);
    const sel=document.getElementById('kbp_cat');
    if(sel){
      sel.insertAdjacentHTML('beforeend', `<option value="${key}">${name}</option>`);
      sel.value=key;
    }
    this.showToastMsg('✅ Category added');
  },
  kbSetEntryType(type){
    const next=type==='dena'?'dena':'lena';
    const hid=document.getElementById('kbe_type');
    if(hid) hid.value=next;
    const btnL=document.getElementById('kbe_btn_lena');
    const btnD=document.getElementById('kbe_btn_dena');
    if(btnL){
      btnL.style.borderColor=next==='lena'?'#16a34a':'#bbf7d0';
      btnL.style.background=next==='lena'?'#dcfce7':'#f0fdf4';
      btnL.style.color='#166534';
    }
    if(btnD){
      btnD.style.borderColor=next==='dena'?'#dc2626':'#fecaca';
      btnD.style.background=next==='dena'?'#fee2e2':'#fff5f5';
      btnD.style.color='#991b1b';
    }
  },
  kbSetCashType(type){
    const next=type==='out'?'out':'in';
    const hid=document.getElementById('kbc_type');
    if(hid) hid.value=next;
    const btnIn=document.getElementById('kbc_btn_in');
    const btnOut=document.getElementById('kbc_btn_out');
    if(btnIn){
      btnIn.style.borderColor=next==='in'?'#16a34a':'#bbf7d0';
      btnIn.style.background=next==='in'?'#dcfce7':'#f0fdf4';
      btnIn.style.color='#166534';
    }
    if(btnOut){
      btnOut.style.borderColor=next==='out'?'#dc2626':'#fecaca';
      btnOut.style.background=next==='out'?'#fee2e2':'#fff5f5';
      btnOut.style.color='#991b1b';
    }
  },
  kbOpenPartyModal(id){
    const party=id?(this.kbParties||[]).find(p=>p.id===id):null;
    this._kbPartyEditId=party?party.id:null;
    const title=document.getElementById('kbPartyMT');
    if(title) title.textContent=party?'👤 Edit Party / Contact':'👤 Add Party / Contact';
    sv('kbp_name', party&&party.name||'');
    sv('kbp_phone', party&&party.phone||'');
    sv('kbp_notes', party&&party.notes||'');
    const sel=document.getElementById('kbp_cat');
    if(sel){
      const cats=this._kbCategories();
      const chosen=party&&party.cat||'personal';
      if(chosen && !cats.includes(chosen)) cats.push(chosen);
      sel.innerHTML=cats.map(cat=>`<option value="${cat}">${this._kbPartyLabel(cat)}</option>`).join('');
      sel.value=chosen;
    }
    M.open('kbPartyM');
  },
  kbSaveParty(){
    return this._runGuardedAction('kbSaveParty', (release)=>{
      const name=v('kbp_name');
      if(!name){ this.showToastMsg('⚠️ Name required'); release(); return; }
      const parties=[...(this.kbParties||[])];
      const item={
        id:this._kbPartyEditId||uid(),
        name,
        phone:v('kbp_phone'),
        cat:document.getElementById('kbp_cat')?.value||'personal',
        notes:v('kbp_notes'),
        updatedAt:new Date().toISOString()
      };
      const idx=parties.findIndex(p=>p.id===item.id);
      if(idx>=0) parties[idx]={...parties[idx], ...item};
      else parties.push({...item, createdAt:item.updatedAt});
      this.kbParties=parties;
      this._kbPartyEditId=null;
      M.close('kbPartyM');
      this.showToastMsg(idx>=0?'✅ Party updated':'✅ Party added');
      this._kbRefresh();
    });
  },
  kbOpenEntryModal(partyId, entryId){
    const party=(this.kbParties||[]).find(p=>p.id===partyId);
    if(!party){ this.showToastMsg('⚠️ Party not found'); return; }
    const entry=entryId?(this.kbEntries||[]).find(e=>e.id===entryId):null;
    this._kbEntryPartyId=partyId;
    this._kbEntryEditId=entry?entry.id:null;
    const dateWrap=document.getElementById('kbe_date_wrap');
    if(dateWrap) dateWrap.innerHTML=makeDateInput('kbe_date', entry&&entry.date||todayISO());
    const title=document.getElementById('kbEntryMT');
    if(title) title.textContent=entry?'✏️ Edit Entry':'➕ Add Entry';
    const info=document.getElementById('kbEntryPartyInfo');
    if(info) info.textContent=party.name + (party.phone ? ' • ' + party.phone : '');
    sv('kbe_amount', entry&&entry.amount||'');
    svDate('kbe_date', entry&&entry.date||todayISO());
    sv('kbe_note', entry&&entry.note||'');
    const mode=document.getElementById('kbe_mode');
    if(mode) mode.value=entry&&entry.mode||'Cash';
    if(window.FUM){
      FUM.clear('fu_kb_entry_wrap');
      FUM.init('fu_kb_entry_wrap','khata-entry', entry&&entry.files||[]);
    }
    const type=entry&&entry.type||'lena';
    this.kbSetEntryType(type);
    M.open('kbEntryM');
  },
  kbSaveEntry(){
    return this._runGuardedAction('kbSaveEntry', (release)=>{
      const partyId=this._kbEntryPartyId;
      if(!partyId){ this.showToastMsg('⚠️ Party missing'); release(); return; }
      const amount=Number(v('kbe_amount'));
      if(!(amount>0)){ this.showToastMsg('⚠️ Amount required'); release(); return; }
      const date=vDate('kbe_date');
      if(!date){ this.showToastMsg('⚠️ Date required'); release(); return; }
      const entries=[...(this.kbEntries||[])];
      const item={
        id:this._kbEntryEditId||uid(),
        partyId,
        type:document.getElementById('kbe_type')?.value==='dena'?'dena':'lena',
        amount,
        date,
        note:v('kbe_note'),
        mode:document.getElementById('kbe_mode')?.value||'Cash',
        files:(window.FUM&&FUM.getFiles)?FUM.getFiles('fu_kb_entry_wrap'):[]
      };
      const idx=entries.findIndex(e=>e.id===item.id);
      if(idx>=0) entries[idx]={...entries[idx], ...item, updatedAt:new Date().toISOString()};
      else entries.push({...item, createdAt:new Date().toISOString()});
      this.kbEntries=entries;
      this._kbEntryEditId=null;
      M.close('kbEntryM');
      if(window.FUM) FUM.clear('fu_kb_entry_wrap');
      this.showToastMsg(idx>=0?'✅ Entry updated':'✅ Entry saved');
      this._kbRefresh();
    });
  },
  kbOpenCashModal(entryId){
    const entry=entryId?(this.kbCash||[]).find(e=>e.id===entryId):null;
    this._kbCashEditId=entry?entry.id:null;
    const dateWrap=document.getElementById('kbc_date_wrap');
    if(dateWrap) dateWrap.innerHTML=makeDateInput('kbc_date', entry&&entry.date||todayISO());
    const title=document.getElementById('kbCashMT');
    if(title) title.textContent=entry?'💵 Edit Cash Entry':'💵 Cash Register Entry';
    sv('kbc_amount', entry&&entry.amount||'');
    svDate('kbc_date', entry&&entry.date||todayISO());
    const cat=document.getElementById('kbc_cat');
    if(cat) cat.value=entry&&entry.cat||'General';
    sv('kbc_note', entry&&entry.note||'');
    this.kbSetCashType(entry&&entry.type||'in');
    M.open('kbCashM');
  },
  kbSaveCash(){
    return this._runGuardedAction('kbSaveCash', (release)=>{
      const amount=Number(v('kbc_amount'));
      if(!(amount>0)){ this.showToastMsg('⚠️ Amount required'); release(); return; }
      const date=vDate('kbc_date');
      if(!date){ this.showToastMsg('⚠️ Date required'); release(); return; }
      const rows=[...(this.kbCash||[])];
      const item={
        id:this._kbCashEditId||uid(),
        type:document.getElementById('kbc_type')?.value==='out'?'out':'in',
        amount,
        date,
        cat:document.getElementById('kbc_cat')?.value||'General',
        note:v('kbc_note')
      };
      const idx=rows.findIndex(e=>e.id===item.id);
      if(idx>=0) rows[idx]={...rows[idx], ...item, updatedAt:new Date().toISOString()};
      else rows.push({...item, createdAt:new Date().toISOString()});
      this.kbCash=rows;
      this._kbCashEditId=null;
      M.close('kbCashM');
      this.showToastMsg(idx>=0?'✅ Cash entry updated':'✅ Cash entry saved');
      this._kbRefresh();
    });
  },
  kbDeleteEntry(id){
    const entry=(this.kbEntries||[]).find(e=>e.id===id);
    if(!entry) return;
    safeDelete(entry.note||'this entry', ()=>{
      this.kbEntries=(this.kbEntries||[]).filter(e=>e.id!==id);
      this.showToastMsg('🗑 Entry deleted');
      this._kbRefresh();
    });
  },
  kbDeleteCash(id){
    const row=(this.kbCash||[]).find(e=>e.id===id);
    if(!row) return;
    safeDelete(row.note||row.cat||'this cash entry', ()=>{
      this.kbCash=(this.kbCash||[]).filter(e=>e.id!==id);
      this.showToastMsg('🗑 Cash entry deleted');
      this._kbRefresh();
    });
  },
  kbDeleteParty(id){
    const party=(this.kbParties||[]).find(p=>p.id===id);
    if(!party) return;
    safeDelete(party.name, ()=>{
      this.kbParties=(this.kbParties||[]).filter(p=>p.id!==id);
      this.kbEntries=(this.kbEntries||[]).filter(e=>e.partyId!==id);
      if(this._kbActiveParty===id) this._kbActiveParty=null;
      this.showToastMsg('🗑 Party deleted');
      this._kbRefresh();
    });
  },
  kbSendWA(partyId){
    const party=(this.kbParties||[]).find(p=>p.id===partyId);
    if(!party){ this.showToastMsg('⚠️ Party not found'); return; }
    const bal=this._kbPartyBalance(partyId);
    const lines=[
      `Namaste ${party.name},`,
      '',
      `Khata update:`,
      `Liya Hai: ${fmt(bal.lena)}`,
      `Diya Hai: ${fmt(bal.dena)}`,
      `Net Balance: ${bal.net===0?'Clear':(bal.net>0?fmt(bal.net)+' aapko dena hai':fmt(Math.abs(bal.net))+' humne diya hai')}`
    ];
    this._kbOpenWhatsApp(party.phone, lines.join('\n'));
  },
  kbShareStatement(partyId){
    const party=(this.kbParties||[]).find(p=>p.id===partyId);
    if(!party){ this.showToastMsg('⚠️ Party not found'); return; }
    const bal=this._kbPartyBalance(partyId);
    const rows=[...bal.entries].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    const lines=[
      `${party.name} - Khata Statement`,
      ''
    ];
    rows.forEach(function(e, idx){
      lines.push(`${idx+1}. ${fD(e.date)} | ${e.type==='dena'?'Diya':'Liya'} | ${fmt(e.amount)} | ${(e.note||'No note')}`);
    });
    lines.push('');
    lines.push(`Total Liya: ${fmt(bal.lena)}`);
    lines.push(`Total Diya: ${fmt(bal.dena)}`);
    lines.push(`Net Balance: ${bal.net===0?'Clear':(bal.net>0?fmt(bal.net)+' pending from party':fmt(Math.abs(bal.net))+' given by us')}`);
    this._kbOpenWhatsApp(party.phone, lines.join('\n'));
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
        const netLabel = bal.net>0?`${activeParty.name} ne aapko ${fmt(bal.net)} DENA hai (Aapne Liya Hai)`:
                         bal.net<0?`Aapne ${activeParty.name} ko ${fmt(Math.abs(bal.net))} DIYA HAI`:
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
                ${isLena?'+':'-'}${fmt(e.amount)}
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
          <div class="export-toolbar export-toolbar-sm">
            ${APP._pdfOriHtml()}
            <button onclick="APP._kbDownloadPDF(APP._kbActiveParty)" class="btn b-out b-sm export-tool-btn export-tool-pdf"><span class="material-symbols-outlined">picture_as_pdf</span><span>PDF</span></button>
            <button onclick="APP._kbDownloadWord(APP._kbActiveParty)" class="btn b-out b-sm export-tool-btn export-tool-word"><span class="material-symbols-outlined">description</span><span>Word</span></button>
            <button onclick="APP._kbDownloadCSV(APP._kbActiveParty)" class="btn b-out b-sm export-tool-btn export-tool-csv"><span class="material-symbols-outlined">table_view</span><span>CSV</span></button>
          </div>

          <!-- Entries list -->
          <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;overflow:hidden;box-shadow:var(--sh);">
            <div style="background:var(--card2);padding:9px 14px;border-bottom:1px solid var(--bdr);">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:7px;">
                <div style="font-size:.8rem;font-weight:800;">📋 All Entries <span style="background:var(--acc);color:#fff;padding:1px 8px;border-radius:10px;font-size:.65rem;">${entries.length}</span>${allEntries.length!==entries.length?`<span style="font-size:.65rem;color:var(--mut);margin-left:4px;">(filtered from ${allEntries.length})</span>`:''}</div>
                <div class="date-filter-bar__tools">
                  ${renderCompactDateRangeFilter({
                    label:'Date',
                    fromId:'dfh_kbpf',
                    toId:'dfh_kbpt',
                    fromValue:kbFrom,
                    toValue:kbTo,
                    fromOnChange:"APP._kbFromDate=this.value;APP.renderKhata()",
                    toOnChange:"APP._kbToDate=this.value;APP.renderKhata()",
                    clearOnClick:"APP._kbFromDate='';APP._kbToDate='';APP.renderKhata()",
                    className:'date-filter-inline--tight'
                  })}
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
                <div style="font-size:1.6rem;font-weight:900;color:${netColor};font-family:'JetBrains Mono',monospace;">${fmt(Math.abs(bal.net))}</div>
                <div style="font-size:.78rem;font-weight:700;color:${netColor};margin-top:4px;">${netLabel}</div>
                <div style="display:flex;justify-content:center;gap:20px;margin-top:10px;font-size:.72rem;">
                  <span style="color:#166534;">🤲 Liya Hai: <b>${fmt(bal.lena)}</b></span>
                  <span style="color:#991b1b;">💸 Diya Hai: <b>${fmt(bal.dena)}</b></span>
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
          <div class="date-filter-panel">
            <div class="date-filter-bar">
              <div class="date-filter-bar__tools">
                ${renderCompactDateRangeFilter({
                  label:'Date',
                  fromId:'dfh_kbaf',
                  toId:'dfh_kbat',
                  fromValue:kbFrom,
                  toValue:kbTo,
                  fromOnChange:"APP._kbFromDate=this.value;APP.renderKhata()",
                  toOnChange:"APP._kbToDate=this.value;APP.renderKhata()",
                  clearOnClick:"APP._kbFromDate='';APP._kbToDate='';APP.renderKhata()",
                  className:'date-filter-inline--tight'
                })}
              </div>
              ${kbFrom||kbTo?`<span class="date-filter-bar__meta">Filtered entries shown below</span>`:''}
            </div>
          </div>
          <!-- All parties download buttons -->
          <div class="export-toolbar export-toolbar-sm">
            ${APP._pdfOriHtml()}
            <button onclick="APP._kbDownloadPDF('all')" class="btn b-out b-sm export-tool-btn export-tool-pdf"><span class="material-symbols-outlined">picture_as_pdf</span><span>PDF</span></button>
            <button onclick="APP._kbDownloadWord('all')" class="btn b-out b-sm export-tool-btn export-tool-word"><span class="material-symbols-outlined">description</span><span>Word</span></button>
            <button onclick="APP._kbDownloadCSV('all')" class="btn b-out b-sm export-tool-btn export-tool-csv"><span class="material-symbols-outlined">table_view</span><span>CSV</span></button>
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
            <div class="${isIn?'kb-lena':'kb-dena'}" style="font-size:.9rem;font-family:'JetBrains Mono',monospace;">${isIn?'+':'-'}${fmt(e.amount)}</div>
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
            <div style="font-size:1.2rem;font-weight:900;color:#166534;font-family:'JetBrains Mono',monospace;margin-top:4px;">${fmt(cashTotals.totalIn)}</div>
          </div>
          <div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1.5px solid #fca5a5;border-radius:11px;padding:12px 14px;text-align:center;">
            <div style="font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#991b1b;">⬆️ DIYA HAI (Cash Out)</div>
            <div style="font-size:1.2rem;font-weight:900;color:#c0392b;font-family:'JetBrains Mono',monospace;margin-top:4px;">${fmt(cashTotals.totalOut)}</div>
          </div>
        </div>
        <div style="background:${cashTotals.balance>=0?'linear-gradient(135deg,#f0f7ff,#dbeafe)':'linear-gradient(135deg,#fff5f5,#fee2e2)'};border:2px solid ${cashTotals.balance>=0?'#93c5fd':'#fca5a5'};border-radius:12px;padding:12px 16px;text-align:center;margin-bottom:14px;">
          <div style="font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:${cashTotals.balance>=0?'#1e40af':'#991b1b'};">CASH BALANCE</div>
          <div style="font-size:1.8rem;font-weight:900;color:${cashTotals.balance>=0?'#1e40af':'#991b1b'};font-family:'JetBrains Mono',monospace;margin-top:6px;">${fmt(cashTotals.balance)}</div>
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
          <td style="color:#166534;font-family:'JetBrains Mono',monospace;text-align:right;">${fmt(bal.lena)}</td>
          <td style="color:#991b1b;font-family:'JetBrains Mono',monospace;text-align:right;">${fmt(bal.dena)}</td>
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
            <div class="fr"><span class="fl">Total In</span><span class="mono kb-lena">${fmt(cashTotals.totalIn)}</span></div>
            <div class="fr"><span class="fl">Total Out</span><span class="mono kb-dena">${fmt(cashTotals.totalOut)}</span></div>
            <div class="fr"><span class="fl">Balance</span><span class="mono" style="color:${cashTotals.balance>=0?'var(--grn)':'var(--red)'};">${fmt(cashTotals.balance)}</span></div>
          </div>
          <div style="background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:12px 14px;">
            <div style="font-size:.7rem;font-weight:800;text-transform:uppercase;color:var(--mut);margin-bottom:8px;">👥 Party Summary</div>
            <div class="fr"><span class="fl">Total Parties</span><span class="fv">${parties.length}</span></div>
            <div class="fr"><span class="fl">Liya Hai (Aapne Liya)</span><span class="mono kb-lena">${fmt(totalLena)}</span></div>
            <div class="fr"><span class="fl">Diya Hai (Aapne Diya)</span><span class="mono kb-dena">${fmt(totalDena)}</span></div>
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


});

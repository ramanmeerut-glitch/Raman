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

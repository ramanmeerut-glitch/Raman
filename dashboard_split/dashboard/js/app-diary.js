
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


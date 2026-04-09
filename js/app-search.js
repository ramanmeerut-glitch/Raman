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


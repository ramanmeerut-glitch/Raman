/* modules/notepad.js — Notepad — renderNotepadTab, multi-category notes, file attachments
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
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


});

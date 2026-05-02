/* modules/notepad.js — Notepad — category -> many notes, search, attachments
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before search.js.
 */

'use strict';

Object.assign(APP, {
  autoLink(text){
    if(!text) return '';
    const str=String(text);
    if(str.includes('<a ') && str.includes('href=')) return str;
    const safe=str
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
    const urlRx=/((https?:\/\/|www\.)[^\s<>"'(){}\[\]]{2,}[^\s<>"'(){}\[\].,!?;:'"\)])/gi;
    return safe.replace(urlRx,(match)=>{
      const href=match.startsWith('www.') ? 'https://'+match : match;
      const display=match.length>50 ? match.slice(0,47)+'…' : match;
      return '<a href="'+href+'" target="_blank" rel="noopener noreferrer" '
        +'class="auto-link" '
        +'style="color:#2c6fad;font-weight:600;text-decoration:underline;cursor:pointer;word-break:break-all;'
        +'display:inline-flex;align-items:center;gap:2px;" '
        +'title="'+href+'" '
        +'onclick="event.stopPropagation()">🔗 '+display+'</a>';
    });
  },
  autoLinkBr(text){
    if(!text) return '';
    return this.autoLink(text).replace(/\n/g,'<br>');
  },
  autoLinkSafe(htmlText){
    if(!htmlText) return '';
    if(!htmlText.includes('http') && !htmlText.includes('www.')) return htmlText;
    return htmlText.replace(/(<a[^>]*>.*?<\/a>)|([^<]+)/gi,(match,linked,plain)=>{
      if(linked) return linked;
      if(plain) return this.autoLink(plain);
      return match;
    });
  },
  cleanText(text){
    if(!text && text!==0) return '';
    let s=String(text).trim();
    if(s.length>=2 && s.startsWith('"') && s.endsWith('"')) s=s.slice(1,-1);
    if(s.length>=2 && s.startsWith("'") && s.endsWith("'")) s=s.slice(1,-1);
    return s;
  },
  displayText(text, multiline){
    const cleaned=this.cleanText(text);
    return multiline ? this.autoLinkBr(cleaned) : this.autoLink(cleaned);
  },

  _npEsc(s){
    return String(s||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  },
  _npCategoryIcon(cat){
    const name=String(cat||'').toLowerCase();
    if(name.includes('personal')) return 'person';
    if(name.includes('work')) return 'work';
    if(name.includes('legal')) return 'balance';
    if(name.includes('finance')) return 'account_balance_wallet';
    if(name.includes('medical')) return 'medical_services';
    if(name.includes('travel')) return 'travel_explore';
    return 'description';
  },
  _getNoteCategories(){
    const raw=localStorage.getItem('rk_note_categories');
    if(raw) try{
      const parsed=JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length) return parsed;
    }catch(e){}
    return ['Personal','Work','Legal','Finance','Medical'];
  },
  _saveNoteCategories(cats){
    localStorage.setItem('rk_note_categories',JSON.stringify(cats));
    if(window.fbSave) window.fbSave('note_categories',cats).catch(()=>{});
  },
  _npDataKey(cat){
    return 'note_data_'+this._noteCatKey(cat);
  },
  _noteCatKey(cat){
    return String(cat||'').toLowerCase().replace(/\s+/g,'_');
  },
  _npLegacyContentKey(cat){
    return 'rk_note_'+this._noteCatKey(cat);
  },
  _npLegacyFilesKey(cat){
    return 'rk_note_files_'+this._noteCatKey(cat);
  },
  _npRefreshCategoryViews(){
    if(this.curTab==='notepad') this.renderNotepadTab();
    if(this.curTab==='home') this.renderHome();
    this._npRefreshGlobalSearchResults();
  },
  _npRefreshGlobalSearchResults(){
    const inp=document.getElementById('globalSearchInp');
    if(inp && inp.value && inp.value.trim() && typeof this.doSearch==='function'){
      this.doSearch(inp.value);
    }
  },
  _npEnsureState(){
    this._npMigrateModel();
    const cats=this._getNoteCategories();
    if(!cats.length){
      this._saveNoteCategories(['Personal']);
    }
    const nextCats=this._getNoteCategories();
    if(!this._noteActiveCat || !nextCats.includes(this._noteActiveCat)) this._noteActiveCat=nextCats[0];
    if(this._noteActiveId){
      const note=this._getNoteById(this._noteActiveCat, this._noteActiveId);
      if(!note) this._noteActiveId=null;
    }
    this._npQuery=this._npQuery||'';
    this._npDateFrom=this._npDateFrom||'';
    this._npDateTo=this._npDateTo||'';
    return nextCats;
  },
  _npMigrateModel(){
    if(this._npMigrated) return;
    this._npMigrated=true;
    const cats=this._getNoteCategories();
    cats.forEach(cat=>this._npMigrateCategory(cat));
  },
  _npMigrateCategory(cat){
    const dataKey='rk_'+this._npDataKey(cat);
    if(localStorage.getItem(dataKey)) return;

    const legacyText=localStorage.getItem(this._npLegacyContentKey(cat))||'';
    let legacyFiles=[];
    try{ legacyFiles=JSON.parse(localStorage.getItem(this._npLegacyFilesKey(cat))||'[]'); }catch(e){ legacyFiles=[]; }
    if(!legacyText.trim() && !legacyFiles.length) return;

    const extracted=this._npExtractLegacyEmbeds(legacyText);
    const attachments=[...legacyFiles, ...extracted.attachments].filter(Boolean);
    const now=new Date().toISOString();
    const note={
      id:uid(),
      title:this._npDeriveTitle(extracted.body, cat),
      body:extracted.body.trim(),
      attachments:this._npDedupAttachments(attachments),
      createdAt:now,
      updatedAt:now
    };
    localStorage.setItem(dataKey, JSON.stringify([note]));
    if(window.fbSave) window.fbSave(this._npDataKey(cat), [note]).catch(()=>{});
    localStorage.removeItem(this._npLegacyContentKey(cat));
    localStorage.removeItem(this._npLegacyFilesKey(cat));
    if(window.fbSave){
      window.fbSave('note_'+this._noteCatKey(cat), '').catch(()=>{});
      window.fbSave('note_files_'+this._noteCatKey(cat), []).catch(()=>{});
    }
    if(cat==='Personal'){
      localStorage.setItem('rk_notepad', note.body||'');
      if(window.fbSave) window.fbSave('notepad', note.body||'').catch(()=>{});
    }
  },
  _npExtractLegacyEmbeds(text){
    const src=this._npNormalizeStoredText(text);
    const attachments=[];
    let body=src;
    body=body.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi,function(_,name,url){
      attachments.push({ id:uid(), name:name||'Image', url, path:'', size:0, type:'image/*', date:todayISO() });
      return '';
    });
    body=body.replace(/([📄📝📊📋📃🎬🎵🗜️📎])\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi,function(_,icon,label,url){
      attachments.push({ id:uid(), name:label||'File', url, path:'', size:0, type:'file/*', date:todayISO(), icon });
      return '';
    });
    body=body.replace(/\n{3,}/g,'\n\n');
    return { body:body.trim(), attachments };
  },
  _npDeriveTitle(body, cat){
    const line=(this._npNormalizeStoredText(body).split('\n')
      .map(s=>s.trim().replace(/^#+\s*/,''))
      .find(s=>/[A-Za-z0-9]/.test(s))||'');
    if(line) return line.slice(0,60);
    return cat==='Personal' ? 'Main Note' : 'Untitled Note';
  },
  _npNormalizeStoredText(value){
    const original=String(value==null ? '' : value).replace(/\r\n/g,'\n');
    let s=original;
    const wasMessy=this._npNeedsNormalization(original);
    for(let i=0;i<6;i++){
      const t=s.trim();
      if(!t) break;
      const wrapped=(t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"));
      if(!wrapped) break;
      try{
        const parsed=JSON.parse(t);
        if(typeof parsed==='string' && parsed!==s){
          s=parsed;
          continue;
        }
      }catch(e){}
      break;
    }
    s=s.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n').replace(/\\t/g,'\t');
    s=s.replace(/\\"/g,'"').replace(/\\'/g,"'");
    s=s.replace(/\\(?![ntr])/g,'');
    if(wasMessy){
      s=s.replace(/"/g,'');
      s=s.replace(/"{2,}/g,'');
      s=s.replace(/\s+"\s+/g,' ');
      s=s.replace(/"\s*$/gm,'');
      s=s.replace(/^\s*"\s*/gm,'');
      s=s.split('\n').filter(line=>{
        const t=line.trim();
        if(!t) return true;
        if(/^[^A-Za-z0-9]+$/.test(t) && t.length<=6) return false;
        return true;
      }).map(line=>line.replace(/\s{2,}/g,' ').trim()).join('\n');
    }
    s=s.replace(/\uFEFF/g,'').replace(/\u200B/g,'');
    s=s.replace(/^[\s"'`]+/, '').replace(/[\s"'`]+$/, '');
    s=s.replace(/\n{3,}/g,'\n\n');
    return s.trim();
  },
  _npNeedsNormalization(text){
    const s=String(text==null ? '' : text);
    if(!s) return false;
    const slashCount=(s.match(/\\/g)||[]).length;
    return slashCount > 12
      || /^["'`]/.test(s.trim())
      || /\\n|\\r|\\t/.test(s)
      || /"{2,}/.test(s)
      || /(^|\n)\s*[🖼📄📎]\s*(\n|$)/.test(s);
  },
  _npNormalizeTitle(title, body, cat){
    const clean=this._npNormalizeStoredText(title);
    const useful=clean.replace(/^[^A-Za-z0-9]+/, '').trim();
    if(!useful || this._npNeedsNormalization(title)) return this._npDeriveTitle(body, cat);
    return clean.slice(0,80);
  },
  _npDedupAttachments(items){
    const seen=new Set();
    return (Array.isArray(items)?items:[]).filter(function(item){
      if(!item || !item.url) return false;
      const key=(item.url||'')+'|'+(item.name||'');
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(function(item){
      return {
        id:item.id||uid(),
        name:item.name||'Attachment',
        url:item.url,
        path:item.path||'',
        size:Number(item.size)||0,
        type:item.type||'',
        date:item.date||todayISO(),
        icon:item.icon||''
      };
    });
  },
  _getCategoryNotes(cat){
    this._npMigrateCategory(cat);
    const raw=localStorage.getItem('rk_'+this._npDataKey(cat));
    if(!raw) return [];
    try{
      const parsed=JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      let changed=false;
      const normalized=parsed.map(note=>{
        const body=this._npNormalizeStoredText(note.body||'');
        const title=this._npNormalizeTitle(note.title||'', body, cat);
        const attachments=this._npDedupAttachments(note.attachments||[]);
        const next={
          id:note.id||uid(),
          title:title||'Untitled Note',
          body,
          attachments,
          createdAt:note.createdAt||note.updatedAt||new Date().toISOString(),
          updatedAt:note.updatedAt||note.createdAt||new Date().toISOString()
        };
        if(
          next.id!==note.id ||
          next.title!==String(note.title||'') ||
          next.body!==String(note.body||'') ||
          JSON.stringify(attachments)!==JSON.stringify(note.attachments||[])
        ){
          changed=true;
          next.updatedAt=new Date().toISOString();
        }
        return next;
      });
      if(changed){
        localStorage.setItem('rk_'+this._npDataKey(cat), JSON.stringify(normalized));
        if(window.fbSave) window.fbSave(this._npDataKey(cat), normalized).catch(()=>{});
      }
      return normalized;
    }catch(e){
      return [];
    }
  },
  _saveCategoryNotes(cat, notes){
    const clean=(Array.isArray(notes)?notes:[]).map(note=>({
      id:note.id||uid(),
      title:String(note.title||'Untitled Note').trim()||'Untitled Note',
      body:String(note.body||''),
      attachments:this._npDedupAttachments(note.attachments||[]),
      createdAt:note.createdAt||new Date().toISOString(),
      updatedAt:note.updatedAt||new Date().toISOString()
    }));
    localStorage.setItem('rk_'+this._npDataKey(cat), JSON.stringify(clean));
    if(window.fbSave) window.fbSave(this._npDataKey(cat), clean).catch(()=>{});
    if(cat==='Personal'){
      const first=clean[0]||{body:''};
      localStorage.setItem('rk_notepad', first.body||'');
      if(window.fbSave) window.fbSave('notepad', first.body||'').catch(()=>{});
    }
  },
  _getNoteById(cat, noteId){
    return this._getCategoryNotes(cat).find(note=>note.id===noteId)||null;
  },
  _npNoteDateValue(note){
    return String((note && (note.updatedAt||note.createdAt||'')) || '').slice(0,10);
  },
  _npMatchesDateRange(note){
    const noteDate=this._npNoteDateValue(note);
    if(!noteDate) return !this._npDateFrom && !this._npDateTo;
    if(this._npDateFrom && noteDate < this._npDateFrom) return false;
    if(this._npDateTo && noteDate > this._npDateTo) return false;
    return true;
  },
  _npHasDateFilter(){
    return !!(this._npDateFrom || this._npDateTo);
  },
  _getNoteContent(cat){
    return this._getCategoryNotes(cat).map(note=>[note.title,note.body].filter(Boolean).join('\n')).join('\n\n');
  },
  _getNoteFiles(cat){
    return this._getCategoryNotes(cat).flatMap(note=>note.attachments||[]);
  },
  renderNotepad(){
    return `<div class="np-widget">
      <div style="padding:10px 14px 4px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <div style="font-weight:800;font-size:.88rem;">📝 Notepad</div>
        <div style="display:flex;gap:5px;align-items:center;">
          <button onclick="APP._npOpenSearch()" style="background:#eff6ff;color:#1760a0;border:1.5px solid #90b8e8;border-radius:8px;padding:4px 10px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;" title="Search in all notes">🔍 Search</button>
          <button class="btn b-sm b-out" onclick="APP.goTab('notepad')" style="font-size:.68rem;padding:3px 9px;">All ↗</button>
        </div>
      </div>
      <div class="np-cat-tabs">${this._npRenderCategoryCapsules('dashboard')}</div>
    </div>`;
  },
  _npCategorySummary(cat){
    const notes=this._getCategoryNotes(cat);
    const words=notes.reduce((sum,note)=>sum + (note.body.trim()?note.body.trim().split(/\s+/).filter(Boolean).length:0),0);
    return { notes:notes.length, words };
  },
  _npRenderCategoryCapsules(context){
    const cats=this._npEnsureState();
    return cats.map(cat=>{
      const catArg=JSON.stringify(cat);
      const safeCat=this._npEsc(cat);
      const summary=this._npCategorySummary(cat);
      const active=this._noteActiveCat===cat;
      return `<div class="np-cat-pill ${active?'is-active':''}" draggable="true" data-note-cat-drop="${safeCat}"
        ondragstart='APP._npStartCategoryDrag(${catArg}, event)'
        ondragover='APP._npAllowCategoryDrop(${catArg}, event)'
        ondragleave='APP._npLeaveCategoryDrop(event)'
        ondrop='APP._npDropCategory(${catArg}, event)'
        ondragend='APP._npEndCategoryDrag()'
        title="${context==='dashboard'?'Drag to reorder':'Open category'}">
        <button class="np-cat-btn" onclick='APP._npOpenCategory(${catArg})'>
          <span class="material-symbols-outlined np-cat-btn-icon" aria-hidden="true">${this._npCategoryIcon(cat)}</span>
          <span class="np-cat-btn-label">${safeCat}</span>
          ${summary.notes?`<span class="np-cat-btn-count">${summary.notes}</span>`:''}
        </button>
        <span class="material-symbols-outlined np-cat-drag" aria-hidden="true">drag_indicator</span>
      </div>`;
    }).join('');
  },
  _npStartCategoryDrag(cat, e){
    this._npDraggedCat=cat;
    if(e && e.dataTransfer){
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain', cat);
    }
  },
  _npAllowCategoryDrop(cat, e){
    if(e) e.preventDefault();
    if(this._npDraggedCat && this._npDraggedCat!==cat && e && e.currentTarget){
      e.currentTarget.classList.add('is-drop-target');
    }
  },
  _npLeaveCategoryDrop(e){
    if(e && e.currentTarget) e.currentTarget.classList.remove('is-drop-target');
  },
  _npEndCategoryDrag(){
    this._npDraggedCat=null;
    document.querySelectorAll('[data-note-cat-drop]').forEach(el=>el.classList.remove('is-drop-target'));
  },
  _npDropCategory(targetCat, e){
    if(e) e.preventDefault();
    const dragged=this._npDraggedCat || (e && e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
    this._npEndCategoryDrag();
    if(!dragged || dragged===targetCat) return;
    const cats=this._getNoteCategories().slice();
    const from=cats.indexOf(dragged);
    const to=cats.indexOf(targetCat);
    if(from<0 || to<0) return;
    cats.splice(to,0,cats.splice(from,1)[0]);
    this._saveNoteCategories(cats);
    this._npRefreshCategoryViews();
  },
  _npOpenCategory(cat){
    this._noteActiveCat=cat;
    this._noteActiveId=null;
    this._npHighlightTerm='';
    this._npQuery=this._npQuery||'';
    if(this.curTab==='notepad') this.renderNotepadTab();
    else this.goTab('notepad');
  },
  _npNewNote(cat){
    const activeCat=cat||this._noteActiveCat||this._getNoteCategories()[0];
    const notes=this._getCategoryNotes(activeCat);
    const now=new Date().toISOString();
    const note={
      id:uid(),
      title:'Untitled Note',
      body:'',
      attachments:[],
      createdAt:now,
      updatedAt:now
    };
    notes.unshift(note);
    this._saveCategoryNotes(activeCat, notes);
    this._noteActiveCat=activeCat;
    this._noteActiveId=note.id;
    this._npHighlightTerm='';
    this._npRefreshCategoryViews();
  },
  _npOpenNote(noteId, cat){
    this._noteActiveCat=cat||this._noteActiveCat;
    this._noteActiveId=noteId;
    if(this.curTab==='notepad') this.renderNotepadTab();
    else this.goTab('notepad');
  },
  _npOpenNoteWithHighlight(cat, noteId, query){
    this._noteActiveCat=cat;
    this._noteActiveId=noteId;
    this._npHighlightTerm=query||'';
    this._npQuery=query||'';
    if(this.curTab==='notepad') this.renderNotepadTab();
    else this.goTab('notepad');
  },
  _npCloseDetail(){
    this._noteActiveId=null;
    this._npHighlightTerm='';
    this.renderNotepadTab();
  },
  _npUpdateActiveNoteField(field, value){
    const cat=this._noteActiveCat;
    const noteId=this._noteActiveId;
    if(!cat || !noteId) return;
    const notes=this._getCategoryNotes(cat).map(note=>{
      if(note.id!==noteId) return note;
      const next={...note, [field]:value, updatedAt:new Date().toISOString()};
      if(field==='title' && !String(value||'').trim()) next.title='Untitled Note';
      return next;
    });
    this._saveCategoryNotes(cat, notes);
    const status=document.getElementById('npNoteSaveState');
    if(status) status.textContent='Saved';
    if(field==='body' || field==='title'){
      const summary=document.getElementById('npNoteMetaWords');
      if(summary){
        const current=notes.find(note=>note.id===noteId);
        const wc=(current && current.body.trim()) ? current.body.trim().split(/\s+/).filter(Boolean).length : 0;
        summary.textContent=wc+' words';
      }
    }
    if(this.curTab==='home') this.renderHome();
    this._npRefreshGlobalSearchResults();
  },
  async _npUploadNoteFile(inputId){
    const cat=this._noteActiveCat;
    const noteId=this._noteActiveId;
    if(!cat || !noteId) return;
    const inp=document.getElementById(inputId);
    if(!inp || !inp.files || !inp.files[0]) return;
    const file=inp.files[0];
    if(file.size > 10*1024*1024){
      this.showToastMsg('❌ File too large! Max 10MB');
      inp.value='';
      return;
    }
    const notes=this._getCategoryNotes(cat);
    const note=notes.find(item=>item.id===noteId);
    if(!note) return;
    let attachment=null;
    if(window.fbUploadFile){
      try{
        this.showToastMsg('⏳ Uploading attachment…');
        const res=await window.fbUploadFile(file,'notepad-files');
        attachment={
          id:uid(),
          name:file.name,
          url:res.url,
          path:res.path||'',
          size:file.size,
          type:file.type,
          date:todayISO()
        };
      }catch(e){
        this.showToastMsg('❌ Upload failed: '+e.message);
      }
    }
    if(!attachment){
      const blobUrl=URL.createObjectURL(file);
      attachment={
        id:uid(),
        name:file.name,
        url:blobUrl,
        path:'',
        size:file.size,
        type:file.type,
        date:todayISO()
      };
      this.showToastMsg('⚠️ Saved locally only');
    }
    note.attachments=[attachment].concat(note.attachments||[]);
    note.updatedAt=new Date().toISOString();
    this._saveCategoryNotes(cat, notes);
    inp.value='';
    this._npRefreshCategoryViews();
    this.showToastMsg('✅ Attachment added');
  },
  _npDeleteAttachment(fileId){
    const cat=this._noteActiveCat;
    const noteId=this._noteActiveId;
    if(!cat || !noteId) return;
    const notes=this._getCategoryNotes(cat).map(note=>{
      if(note.id!==noteId) return note;
      const attachment=(note.attachments||[]).find(file=>file.id===fileId);
      if(attachment && attachment.path && window.fbDeleteFile) window.fbDeleteFile(attachment.path);
      return {...note, attachments:(note.attachments||[]).filter(file=>file.id!==fileId), updatedAt:new Date().toISOString()};
    });
    this._saveCategoryNotes(cat, notes);
    this._npRefreshCategoryViews();
  },
  _npDeleteNote(cat, noteId){
    const notes=this._getCategoryNotes(cat);
    const note=notes.find(item=>item.id===noteId);
    if(!note) return;
    safeDelete(note.title||'this note', ()=>{
      (note.attachments||[]).forEach(file=>{
        if(file.path && window.fbDeleteFile) window.fbDeleteFile(file.path);
      });
      const remaining=notes.filter(item=>item.id!==noteId);
      this._saveCategoryNotes(cat, remaining);
      if(this._noteActiveId===noteId) this._noteActiveId=remaining[0] ? remaining[0].id : null;
      this._npRefreshCategoryViews();
      return true;
    });
  },
  _npRenderSidebarItems(){
    const cats=this._getNoteCategories();
    return cats.map(cat=>{
      const safeCat=this._npEsc(cat);
      const icon=this._npCategoryIcon(cat);
      const summary=this._npCategorySummary(cat);
      const catArg=JSON.stringify(cat);
      const active=this._noteActiveCat===cat;
      return `<div class="np-sidebar-item ${active?'is-active':''}" draggable="true" data-note-cat-drop="${safeCat}"
        ondragstart='APP._npStartCategoryDrag(${catArg}, event)'
        ondragover='APP._npAllowCategoryDrop(${catArg}, event)'
        ondragleave='APP._npLeaveCategoryDrop(event)'
        ondrop='APP._npDropCategory(${catArg}, event)'
        ondragend='APP._npEndCategoryDrag()'>
        <button class="np-sidebar-main" onclick='APP._npOpenCategory(${catArg})'>
          <span class="material-symbols-outlined np-sidebar-icon" aria-hidden="true">${icon}</span>
          <span class="np-sidebar-name">${safeCat}</span>
          <span class="np-sidebar-count">${summary.notes}</span>
        </button>
        <div class="np-sidebar-tools">
          <button class="np-sidebar-tool" onclick='event.stopPropagation();APP._npOpenCategoryDialog("edit", ${catArg})' title="Rename category">
            <span class="material-symbols-outlined" aria-hidden="true">edit</span>
          </button>
          ${cats.length>1?`<button class="np-sidebar-tool danger" onclick='event.stopPropagation();APP._npDeleteCat(${catArg})' title="Delete category">
            <span class="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>`:''}
        </div>
      </div>`;
    }).join('');
  },
  _npRenderNoteCards(cat){
    const notes=this._getCategoryNotes(cat)
      .filter(note=>this._npMatchesDateRange(note))
      .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    if(!notes.length){
      return `<div class="np-empty-state">
        <div class="np-empty-icon material-symbols-outlined" aria-hidden="true">note_stack</div>
        <div class="np-empty-title">No notes in ${this._npEsc(cat)}</div>
        <div class="np-empty-copy">Add your first note for this category.</div>
        <button class="btn b-gold" onclick='APP._npNewNote(${JSON.stringify(cat)})'>+ New Note</button>
      </div>`;
    }
    return `<div class="np-note-grid">${notes.map(note=>{
      const firstImage=(note.attachments||[]).find(file=>(file.type||'').startsWith('image/'));
      const wordCount=note.body.trim() ? note.body.trim().split(/\s+/).filter(Boolean).length : 0;
      const excerpt=this._npEsc(note.body.trim().slice(0,180));
      const noteArg=JSON.stringify(note.id);
      const catArg=JSON.stringify(cat);
      return `<div class="np-note-card">
        <button class="np-note-open" onclick='APP._npOpenNote(${noteArg}, ${catArg})'>
          <div class="np-note-card-top">
            <span class="np-note-badge">NOTE</span>
            <span class="np-note-meta">${wordCount} words</span>
          </div>
          <div class="np-note-title">${this._npEsc(note.title||'Untitled Note')}</div>
          <div class="np-note-excerpt">${excerpt||'No text yet'}</div>
          ${firstImage?`<div class="np-note-image"><img src="${firstImage.url}" alt="${this._npEsc(firstImage.name||'Image')}" onerror="this.parentElement.style.display='none'"></div>`:''}
        </button>
        <div class="np-note-footer">
          <div class="np-note-footer-meta">
            <span>${fD((note.updatedAt||note.createdAt||todayISO()).slice(0,10))}</span>
            <span>${(note.attachments||[]).length} files</span>
          </div>
          <button class="np-note-card-action danger" onclick='APP._npDeleteNote(${catArg}, ${noteArg})'>Delete</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  },
  _npHighlightHtml(text, query){
    const safe=this._npEsc(text);
    if(!query) return safe;
    const esc=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return safe.replace(new RegExp('('+esc+')','gi'), '<mark class="search-hl">$1</mark>');
  },
  _npBuildSearchResults(query){
    const q=String(query||'').trim();
    if(!q) return [];
    const results=[];
    this._getNoteCategories().forEach(cat=>{
      this._getCategoryNotes(cat).forEach(note=>{
        if(!this._npMatchesDateRange(note)) return;
        const hay=[cat,note.title,note.body,(note.attachments||[]).map(file=>file.name||'').join(' ')].join('\n').toLowerCase();
        if(!hay.includes(q.toLowerCase())) return;
        results.push({
          cat,
          noteId:note.id,
          title:note.title||'Untitled Note',
          body:note.body||'',
          updatedAt:note.updatedAt||note.createdAt||'',
          attachments:note.attachments||[]
        });
      });
    });
    return results.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  },
  _npBuildDateResults(){
    const results=[];
    this._getNoteCategories().forEach(cat=>{
      this._getCategoryNotes(cat).forEach(note=>{
        if(!this._npMatchesDateRange(note)) return;
        results.push({
          cat,
          noteId:note.id,
          title:note.title||'Untitled Note',
          body:note.body||'',
          updatedAt:note.updatedAt||note.createdAt||'',
          attachments:note.attachments||[]
        });
      });
    });
    return results.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  },
  _npHandlePageSearch(val){
    const current=document.getElementById('npPageSearch');
    const start=current && typeof current.selectionStart==='number' ? current.selectionStart : null;
    const end=current && typeof current.selectionEnd==='number' ? current.selectionEnd : null;
    this._npQuery=String(val||'');
    this._noteActiveId=null;
    this.renderNotepadTab();
    requestAnimationFrame(()=>{
      const next=document.getElementById('npPageSearch');
      if(!next) return;
      next.focus();
      if(start!==null && end!==null){
        try{ next.setSelectionRange(start,end); }catch(e){}
      }
    });
  },
  _npHandleDateRange(kind, value){
    if(kind==='from') this._npDateFrom=String(value||'');
    if(kind==='to') this._npDateTo=String(value||'');
    this._noteActiveId=null;
    this.renderNotepadTab();
  },
  _npOpenDatePicker(kind){
    const input=document.getElementById(kind==='from' ? 'npDateFrom' : 'npDateTo');
    if(!input) return;
    try{
      if(typeof input.showPicker==='function') input.showPicker();
      else input.click();
    }catch(e){
      input.focus();
      input.click();
    }
  },
  _npClearDateRange(){
    this._npDateFrom='';
    this._npDateTo='';
    this._noteActiveId=null;
    this.renderNotepadTab();
  },
  _npOpenSearch(defaultCat){
    if(defaultCat) this._noteActiveCat=defaultCat;
    if(this.curTab!=='notepad'){
      this.goTab('notepad');
      setTimeout(()=>{
        const el=document.getElementById('npPageSearch');
        if(el){ el.focus(); el.select(); }
      }, 250);
      return;
    }
    const el=document.getElementById('npPageSearch');
    if(el){ el.focus(); el.select(); }
  },
  _npRenderSearchPanel(query){
    const results=this._npBuildSearchResults(query);
    if(!results.length){
      return `<div class="np-empty-state">
        <div class="np-empty-icon material-symbols-outlined" aria-hidden="true">search_off</div>
        <div class="np-empty-title">No notes found</div>
        <div class="np-empty-copy">Try another keyword across categories, titles, text, or file names.</div>
      </div>`;
    }
    return `<div class="np-search-results">
      <div class="np-search-results-head">${results.length} result${results.length!==1?'s':''} for "${this._npEsc(query)}"</div>
      ${results.map(item=>{
        const catArg=JSON.stringify(item.cat);
        const noteArg=JSON.stringify(item.noteId);
        return `<button class="np-search-result" onclick='APP._npOpenNoteWithHighlight(${catArg}, ${noteArg}, ${JSON.stringify(query)})'>
          <div class="np-search-result-top">
            <span class="np-search-cat">${this._npEsc(item.cat)}</span>
            <span class="np-search-date">${fD((item.updatedAt||todayISO()).slice(0,10))}</span>
          </div>
          <div class="np-search-title">${this._npHighlightHtml(item.title||'Untitled Note', query)}</div>
          <div class="np-search-body">${this._npHighlightHtml((item.body||'').slice(0,240) || 'No text yet', query)}</div>
        </button>`;
      }).join('')}
    </div>`;
  },
  _npRenderDateFilterPanel(){
    const results=this._npBuildDateResults();
    const from=this._npDateFrom ? fD(this._npDateFrom) : 'Start';
    const to=this._npDateTo ? fD(this._npDateTo) : 'Today';
    if(!results.length){
      return `<div class="np-empty-state">
        <div class="np-empty-icon material-symbols-outlined" aria-hidden="true">event_busy</div>
        <div class="np-empty-title">No notes in this date range</div>
        <div class="np-empty-copy">Try a wider range or clear the filter.</div>
      </div>`;
    }
    return `<div class="np-search-results">
      <div class="np-search-results-head">${results.length} note${results.length!==1?'s':''} from ${from} to ${to}</div>
      ${results.map(item=>{
        const catArg=JSON.stringify(item.cat);
        const noteArg=JSON.stringify(item.noteId);
        const excerpt=this._npEsc((item.body||'').trim().slice(0,240) || 'No text yet');
        const wordCount=(item.body||'').trim() ? item.body.trim().split(/\s+/).filter(Boolean).length : 0;
        return `<button class="np-search-result" onclick='APP._npOpenNote(${noteArg}, ${catArg})'>
          <div class="np-search-result-top">
            <span class="np-search-cat">${this._npEsc(item.cat)}</span>
            <span class="np-search-date">${fD((item.updatedAt||todayISO()).slice(0,10))}</span>
          </div>
          <div class="np-search-title">${this._npEsc(item.title||'Untitled Note')}</div>
          <div class="np-search-body">${excerpt}</div>
          <div class="np-search-results-head" style="margin-top:10px;">${wordCount} words · ${(item.attachments||[]).length} files</div>
        </button>`;
      }).join('')}
    </div>`;
  },
  _npOpenCategoryDialog(mode, oldCat){
    const existing=document.getElementById('npAddCatOverlay');
    if(existing) existing.remove();
    const isEdit=mode==='edit';
    const value=isEdit ? (oldCat||'') : '';
    const el=document.createElement('div');
    el.id='npAddCatOverlay';
    el.dataset.mode=mode;
    if(oldCat) el.dataset.oldCat=oldCat;
    el.style.cssText='position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    el.innerHTML=`
      <div style="background:var(--card);border-radius:14px;width:100%;max-width:360px;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,.25);">
        <div style="font-weight:800;font-size:.95rem;margin-bottom:14px;">${isEdit?'✏️ Rename Category':'📂 Add New Category'}</div>
        <input id="npNewCatInp" type="text" placeholder="e.g. Medical, Travel, Legal, Ideas…" maxlength="30" value="${this._npEsc(value)}"
          style="width:100%;padding:10px 12px;border:1.5px solid var(--bdr2);border-radius:9px;background:var(--bg);color:var(--txt);font-family:'Nunito',sans-serif;font-size:.9rem;outline:none;box-sizing:border-box;margin-bottom:10px;"
          onkeydown="if(event.key==='Enter') APP._npSubmitCategoryDialog()">
        <div style="font-size:.72rem;color:var(--mut);margin-bottom:14px;">Max 30 characters. This will appear as a category in your Notepad.</div>
        <div style="display:flex;gap:8px;">
          <button onclick="document.getElementById('npAddCatOverlay').remove()"
            style="flex:1;padding:9px;background:var(--dim);border:1.5px solid var(--bdr2);border-radius:8px;font-size:.84rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">Cancel</button>
          <button onclick="APP._npSubmitCategoryDialog()"
            style="flex:2;padding:9px;background:var(--acc);color:#fff;border:none;border-radius:8px;font-size:.84rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;">${isEdit?'✅ Save Changes':'✅ Add Category'}</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e=>{ if(e.target===el) el.remove(); });
    setTimeout(()=>{ document.getElementById('npNewCatInp')?.focus(); }, 100);
  },
  _npSubmitCategoryDialog(){
    const overlay=document.getElementById('npAddCatOverlay');
    if(!overlay) return;
    const mode=overlay.dataset.mode || 'add';
    const oldCat=overlay.dataset.oldCat || '';
    const inp=document.getElementById('npNewCatInp');
    const name=inp ? inp.value.trim() : '';
    if(!name){ inp?.focus(); return; }
    const cats=this._getNoteCategories();
    const lower=name.toLowerCase();
    if(mode==='edit' && oldCat){
      if(name===oldCat){ overlay.remove(); return; }
      if(cats.some(cat=>cat.toLowerCase()===lower && cat!==oldCat)){ this.showToastMsg('⚠️ "'+name+'" already exists!'); return; }
      this._npRenameCategory(oldCat, name);
      overlay.remove();
      return;
    }
    if(cats.some(cat=>cat.toLowerCase()===lower)){ this.showToastMsg('⚠️ "'+name+'" already exists!'); return; }
    cats.push(name);
    this._saveNoteCategories(cats);
    this._noteActiveCat=name;
    this._noteActiveId=null;
    overlay.remove();
    this._npRefreshCategoryViews();
    this.showToastMsg('✅ Category "'+name+'" added!');
  },
  _npRenameCategory(oldCat, newCat){
    const cats=this._getNoteCategories().slice();
    const idx=cats.indexOf(oldCat);
    if(idx<0) return;
    const oldStore='rk_'+this._npDataKey(oldCat);
    const newStore='rk_'+this._npDataKey(newCat);
    const notes=this._getCategoryNotes(oldCat);
    cats[idx]=newCat;
    this._saveNoteCategories(cats);
    localStorage.setItem(newStore, JSON.stringify(notes));
    localStorage.removeItem(oldStore);
    if(window.fbSave){
      window.fbSave(this._npDataKey(newCat), notes).catch(()=>{});
      window.fbSave(this._npDataKey(oldCat), []).catch(()=>{});
    }
    if(this._noteActiveCat===oldCat) this._noteActiveCat=newCat;
    this._npRefreshCategoryViews();
    this.showToastMsg('✅ Category renamed to "'+newCat+'"');
  },
  _npDeleteCat(cat){
    const cats=this._getNoteCategories();
    if(cats.length<=1){ alert('Last category delete nahi kar sakte!'); return; }
    const notes=this._getCategoryNotes(cat);
    safeDelete(cat, ()=>{
      notes.forEach(note=>{
        (note.attachments||[]).forEach(file=>{
          if(file.path && window.fbDeleteFile) window.fbDeleteFile(file.path);
        });
      });
      const nextCats=this._getNoteCategories().filter(item=>item!==cat);
      this._saveNoteCategories(nextCats);
      localStorage.removeItem('rk_'+this._npDataKey(cat));
      if(window.fbSave) window.fbSave(this._npDataKey(cat), []).catch(()=>{});
      if(this._noteActiveCat===cat){
        this._noteActiveCat=nextCats[0]||'Personal';
        this._noteActiveId=null;
      }
      this._npRefreshCategoryViews();
      return true;
    });
  },
  _npOpenAttachment(url){
    if(!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  },
  _npRenderAttachmentList(note){
    const attachments=note.attachments||[];
    if(!attachments.length){
      return `<div class="np-attach-empty">No images or files attached yet.</div>`;
    }
    return `<div class="np-attach-list">${attachments.map(file=>{
      const isImage=(file.type||'').startsWith('image/');
      return `<div class="np-attach-card" onclick="APP._npOpenAttachment('${this._npEsc(file.url)}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();APP._npOpenAttachment('${this._npEsc(file.url)}')}">
        <button class="np-attach-delete" onclick="event.stopPropagation();APP._npDeleteAttachment('${file.id}')" aria-label="Delete attachment" title="Delete attachment">×</button>
        ${isImage?`<div class="np-attach-thumb"><img src="${file.url}" alt="${this._npEsc(file.name||'Image')}" onerror="this.parentElement.style.display='none'"></div>`:`<div class="np-attach-icon material-symbols-outlined" aria-hidden="true">${this._noteFileIcon(file.name,file.type)==='🖼️'?'image':'attach_file'}</div>`}
        <div class="np-attach-body">
          <div class="np-attach-name">${this._npEsc(file.name||'Attachment')}</div>
          <div class="np-attach-meta">${this._noteFileSize(file.size)}${file.date?' · '+fD(file.date):''}</div>
        </div>
      </div>`;
    }).join('')}</div>`;
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
  _npRenderActiveNote(cat, note){
    const wc=note.body.trim() ? note.body.trim().split(/\s+/).filter(Boolean).length : 0;
    const query=this._npHighlightTerm||'';
    const preview=query ? `<div class="np-hl-preview">
      <div class="np-hl-head">Highlighted match for "${this._npEsc(query)}"</div>
      <div class="np-hl-copy">${this._highlightInTextBlock(note.body||'', query)}</div>
    </div>` : '';
    return `<div class="np-detail">
      <div class="np-detail-head">
        <button class="np-back-link" onclick="APP._npCloseDetail()">
          <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          <span>Back to notes</span>
        </button>
        <div class="np-detail-meta">
          <span id="npNoteMetaWords">${wc} words</span>
          <span>${fD((note.updatedAt||note.createdAt||todayISO()).slice(0,10))}</span>
        </div>
      </div>
      ${preview}
      <div class="np-detail-card">
        <div class="fg">
          <label>Note Title</label>
          <input id="npNoteTitle" value="${this._npEsc(note.title||'Untitled Note')}" oninput="APP._npUpdateActiveNoteField('title', this.value)" placeholder="Enter note title">
        </div>
        <div class="fg">
          <label>Note Body</label>
          <textarea id="npNoteBody" oninput="APP._npUpdateActiveNoteField('body', this.value)" placeholder="Write anything here — notes, links, legal text, tasks, drafts...">${this._npEsc(note.body||'')}</textarea>
        </div>
        <div class="np-detail-tools">
          <div class="np-detail-tools-left">
            <label class="np-upload-btn" title="Attach file">
              <span class="material-symbols-outlined" aria-hidden="true">add</span>
              <span>Attach File</span>
              <input id="npNoteFileInp" type="file" style="display:none" onchange="APP._npUploadNoteFile('npNoteFileInp')">
            </label>
          </div>
          <div class="np-detail-tools-right">
            <span id="npNoteSaveState" class="np-save-state">Saved</span>
          </div>
        </div>
        <div class="np-attach-section">
          <div class="np-attach-title">Attachments</div>
          ${this._npRenderAttachmentList(note)}
        </div>
      </div>
    </div>`;
  },
  _highlightInTextBlock(text, query){
    const safe=this._npEsc(text||'');
    if(!query) return safe.replace(/\n/g,'<br>');
    const esc=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const marked=safe.replace(new RegExp('('+esc+')','gi'), '<mark class="search-hl">$1</mark>');
    return marked.replace(/\n/g,'<br>');
  },
  renderNotepadTab(){
    const cats=this._npEnsureState();
    const activeCat=this._noteActiveCat;
    const activeNote=this._noteActiveId ? this._getNoteById(activeCat, this._noteActiveId) : null;
    const summary=this._npCategorySummary(activeCat);
    const query=this._npQuery||'';
    const hasDateFilter=this._npHasDateFilter();
    const mainContent=activeNote
      ? this._npRenderActiveNote(activeCat, activeNote)
      : (query ? this._npRenderSearchPanel(query) : (hasDateFilter ? this._npRenderDateFilterPanel() : this._npRenderNoteCards(activeCat)));
    const mainTitle=activeNote ? activeCat : (query ? 'Search Results' : (hasDateFilter ? 'Filtered Notes' : activeCat));
    const mainCopy=activeNote
      ? `${summary.notes} note${summary.notes!==1?'s':''} · ${summary.words} words`
      : (query
          ? `${this._npBuildSearchResults(query).length} note result${this._npBuildSearchResults(query).length!==1?'s':''}`
          : (hasDateFilter
              ? `${this._npBuildDateResults().length} note${this._npBuildDateResults().length!==1?'s':''} in selected range`
              : `${summary.notes} note${summary.notes!==1?'s':''} · ${summary.words} words`));

    document.getElementById('pan-notepad').innerHTML=`
      <div class="np-layout">
        <aside class="np-sidebar">
          <div class="np-sidebar-head">
            <div class="np-sidebar-title">My Notes</div>
            <div class="np-sidebar-copy">Categories</div>
          </div>
          <div class="np-sidebar-list">${this._npRenderSidebarItems()}</div>
          <div class="np-sidebar-foot">
            <button class="btn b-out" onclick="APP._npOpenCategoryDialog('add')">+ New Category</button>
          </div>
        </aside>
        <section class="np-main">
          <div class="np-main-head">
            <div>
              <div class="np-main-title">${this._npEsc(mainTitle)}</div>
              <div class="np-main-copy">${this._npEsc(mainCopy)}</div>
            </div>
            <div class="np-main-actions">
              <div class="np-search-box">
                <span class="material-symbols-outlined" aria-hidden="true">search</span>
                <input id="npPageSearch" value="${this._npEsc(query)}" placeholder="Search notes…" oninput="APP._npHandlePageSearch(this.value)">
              </div>
              <div class="np-main-tools">
                ${renderCompactDateRangeFilter({
                  label:'Date',
                  fromId:'npDateFrom',
                  toId:'npDateTo',
                  fromValue:this._npDateFrom||'',
                  toValue:this._npDateTo||'',
                  fromOnChange:"APP._npHandleDateRange('from', this.value)",
                  toOnChange:"APP._npHandleDateRange('to', this.value)",
                  clearOnClick:"APP._npClearDateRange()",
                  className:'date-filter-inline--tight date-filter-inline--soft'
                })}
                <button class="btn b-gold" onclick='APP._npNewNote(${JSON.stringify(activeCat)})'>+ New Note</button>
              </div>
            </div>
          </div>
          <div class="np-main-body">${mainContent}</div>
        </section>
      </div>`;

    if(activeNote && this._npHighlightTerm){
      setTimeout(()=>{
        const ta=document.getElementById('npNoteBody');
        if(!ta) return;
        const q2=this._npHighlightTerm;
        const idx=ta.value.toLowerCase().indexOf(String(q2).toLowerCase());
        if(idx>=0){
          ta.focus();
          ta.setSelectionRange(idx, idx + q2.length);
          const lineH=parseInt(getComputedStyle(ta).lineHeight,10)||26;
          const lines=ta.value.substring(0, idx).split('\n').length;
          ta.scrollTop=Math.max(0, (lines-3)*lineH);
        }
      }, 120);
    }
  }
});

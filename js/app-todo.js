  // ══ QUICK LINKS ══
  renderQuickLinks(){
    let links; try{ links=JSON.parse(localStorage.getItem('rk_quicklinks')||'[]'); }catch{ links=[]; }
    const container=document.getElementById('qlLinks');
    if(!container)return;
    container.innerHTML=links.map((l,i)=>`
      <span class="ql-link" title="${l.url}">
        <img src="https://www.google.com/s2/favicons?domain=${l.url}&sz=16" onerror="this.style.display='none'" style="width:14px;height:14px;">
        <a href="${l.url.startsWith('http')?l.url:'https://'+l.url}" target="_blank" style="text-decoration:none;color:inherit;">${l.name}</a>

      </span>`).join('');
  },
  addQuickLink(){
    const name=prompt('Website ka naam? (e.g. ICICI, Court, Google)');
    if(!name)return;
    const url=prompt('Website ka link? (e.g. icicibank.com)');
    if(!url)return;
    let links; try{ links=JSON.parse(localStorage.getItem('rk_quicklinks')||'[]'); }catch{ links=[]; }
    links.push({name:name.trim(),url:url.trim(),id:uid()});
    localStorage.setItem('rk_quicklinks',JSON.stringify(links));
    if(window.fbSave)window.fbSave('quicklinks',links).catch(()=>{});
    this.renderQuickLinks();
    this.showToastMsg('✅ Link add hua — sab devices pe sync ho jaayega!');
  },
  delQuickLink(i){
    let links; try{ links=JSON.parse(localStorage.getItem('rk_quicklinks')||'[]'); }catch{ links=[]; }
    links.splice(i,1);
    localStorage.setItem('rk_quicklinks',JSON.stringify(links));
    if(window.fbSave)window.fbSave('quicklinks',links).catch(()=>{});
    this.renderQuickLinks();
  },

  // ══ TO DO LIST ══
  get todos(){try{return JSON.parse(localStorage.getItem('rk_todos')||'[]');}catch{return[];}},
  saveTodos(t){localStorage.setItem('rk_todos',JSON.stringify(t));if(window.fbSave)window.fbSave('todos',t).catch(()=>{});},
  _todoFilter:'all',
  addTodo(){
    const inp=document.getElementById('todoInp');
    const txt=inp?inp.value.trim():'';
    if(!txt)return;
    const pri=document.getElementById('todoPri')?document.getElementById('todoPri').value:'medium';
    const due=document.getElementById('todoDue')?document.getElementById('todoDue').value:'';
    const rec=document.getElementById('todoRec')?document.getElementById('todoRec').value:'none';
    const todos=this.todos;
    todos.push({id:uid(),text:txt,done:false,priority:pri,dueDate:due,recurring:rec,created:new Date().toISOString()});
    this.saveTodos(todos);inp.value='';
    if(document.getElementById('todoDue')) document.getElementById('todoDue').value='';
    this.renderTodo();this.renderPills();
  },
  toggleTodo(id){
    const todos=this.todos.map(t=>{
      if(t.id!==id) return t;
      const done=!t.done;
      // If recurring and marking done — auto-create next occurrence
      if(done && t.recurring && t.recurring!=='none' && t.dueDate){
        const d=new Date(t.dueDate);
        if(t.recurring==='daily') d.setDate(d.getDate()+1);
        else if(t.recurring==='weekly') d.setDate(d.getDate()+7);
        else if(t.recurring==='monthly') d.setMonth(d.getMonth()+1);
        const nextDate=d.toISOString().split('T')[0];
        setTimeout(()=>{
          const ts=this.todos;
          ts.push({id:uid(),text:t.text,done:false,priority:t.priority,dueDate:nextDate,recurring:t.recurring,created:new Date().toISOString()});
          this.saveTodos(ts);this.renderTodo();this.renderPills();
        },300);
      }
      return {...t,done,completedAt:done?new Date().toISOString():null};
    });
    this.saveTodos(todos);this.renderTodo();this.renderPills();
  },
  delTodo(id){
    this.saveTodos(this.todos.filter(t=>t.id!==id));
    this.renderTodo();this.renderPills();
  },
  setTodoFilter(f){this._todoFilter=f;this.renderTodo();},

  _clearDoneTodos(){
    if(!confirm('Sab completed tasks delete karen?')) return;
    this.saveTodos(this.todos.filter(t=>!t.done));
    this.renderTodo();this.renderPills();
    this.showToastMsg('✅ Completed tasks cleared!');
  },

  // ── Edit todo ──
  editTodo(id){
    const t=this.todos.find(x=>x.id===id);
    if(!t) return;
    // Build inline edit modal
    let modal=document.getElementById('_todoEditModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='_todoEditModal';
      modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
    }
    modal.innerHTML=`<div style="background:#fff;border-radius:14px;padding:20px;width:100%;max-width:480px;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="font-weight:800;font-size:1rem;margin-bottom:14px;">✏️ Edit Task</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div><label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Task</label>
          <input id="_te_text" value="${(t.text||'').replace(/"/g,'&quot;')}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:7px 10px;font-family:'Nunito',sans-serif;font-size:.9rem;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Priority</label>
            <select id="_te_pri" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.82rem;">
              <option value="high" ${t.priority==='high'?'selected':''}>🔴 High</option>
              <option value="medium" ${t.priority==='medium'?'selected':''}>🟡 Medium</option>
              <option value="low" ${t.priority==='low'?'selected':''}>🟢 Low</option>
            </select></div>
          <div><label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Due Date</label>
            <input type="date" id="_te_due" value="${t.dueDate||''}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.82rem;"></div>
        </div>
        <div><label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Repeat</label>
          <select id="_te_rec" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.82rem;">
            <option value="none" ${(!t.recurring||t.recurring==='none')?'selected':''}>No Repeat</option>
            <option value="daily" ${t.recurring==='daily'?'selected':''}>🔁 Daily</option>
            <option value="weekly" ${t.recurring==='weekly'?'selected':''}>🔁 Weekly</option>
            <option value="monthly" ${t.recurring==='monthly'?'selected':''}>🔁 Monthly</option>
          </select></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button onclick="document.getElementById('_todoEditModal').remove()" style="flex:1;padding:9px;border:1.5px solid var(--bdr2);border-radius:8px;background:var(--card);font-family:'Nunito',sans-serif;font-size:.85rem;cursor:pointer;">Cancel</button>
        <button onclick="APP._saveTodoEdit('${id}')" style="flex:2;padding:9px;background:#2c6fad;color:#fff;border:none;border-radius:8px;font-family:'Nunito',sans-serif;font-size:.85rem;font-weight:800;cursor:pointer;">💾 Save</button>
      </div>
    </div>`;
    modal.style.display='flex';
    setTimeout(()=>document.getElementById('_te_text')?.focus(),50);
  },

  _saveTodoEdit(id){
    const text=document.getElementById('_te_text')?.value.trim();
    if(!text){ this.showToastMsg('⚠️ Task text required!'); return; }
    const todos=this.todos.map(t=>t.id===id?{...t,
      text,
      priority:document.getElementById('_te_pri')?.value||t.priority,
      dueDate:document.getElementById('_te_due')?.value||'',
      recurring:document.getElementById('_te_rec')?.value||'none',
      updated:new Date().toISOString()
    }:t);
    this.saveTodos(todos);
    document.getElementById('_todoEditModal')?.remove();
    this.renderTodo();this.renderPills();
    this.showToastMsg('✅ Task updated!');
  },

  // ── Delete recurring task with options ──
  _delTodoConfirm(id){
    const t=this.todos.find(x=>x.id===id);
    if(!t) return;
    if(!t.recurring||t.recurring==='none'){ this.delTodo(id); return; }
    let modal=document.getElementById('_todoDelModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='_todoDelModal';
      modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
      document.body.appendChild(modal);
    }
    modal.innerHTML=`<div style="background:#fff;border-radius:14px;padding:20px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="font-weight:800;font-size:.95rem;margin-bottom:6px;">🗑 Delete Recurring Task</div>
      <div style="font-size:.82rem;color:var(--mut);margin-bottom:16px;">"${t.text}"</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button onclick="APP.delTodo('${id}');document.getElementById('_todoDelModal').remove()" style="padding:10px;background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:8px;font-family:'Nunito',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;text-align:left;">🗑 Delete this task only</button>
        <button onclick="APP._delAllRecurring('${id}');document.getElementById('_todoDelModal').remove()" style="padding:10px;background:#fff0f0;color:#c0392b;border:1.5px solid #f09090;border-radius:8px;font-family:'Nunito',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;text-align:left;">🗑🗑 Delete ALL recurring tasks with same name</button>
        <button onclick="document.getElementById('_todoDelModal').remove()" style="padding:8px;background:var(--card);border:1.5px solid var(--bdr2);border-radius:8px;font-family:'Nunito',sans-serif;font-size:.82rem;cursor:pointer;">Cancel</button>
      </div>
    </div>`;
    modal.style.display='flex';
  },

  _delAllRecurring(id){
    const t=this.todos.find(x=>x.id===id);
    if(!t) return;
    const remaining=this.todos.filter(x=>!(x.recurring===t.recurring&&x.text===t.text));
    this.saveTodos(remaining);
    this.renderTodo();this.renderPills();
    this.showToastMsg('✅ All recurring instances deleted!');
  },

  // ── Drag and drop reorder ──
  _todoDragStart(e){
    e.dataTransfer.setData('text/plain',e.currentTarget.dataset.id);
    e.dataTransfer.effectAllowed='move';
    e.currentTarget.style.opacity='0.4';
    e.currentTarget.style.transform='scale(0.98)';
  },
  _todoDragOver(e){
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    // Only highlight the closest todo-item ancestor
    const el=e.currentTarget;
    el.style.background='#e8f5e9';
    el.style.borderTop='2px solid #1a7a45';
  },
  _todoDragLeave(e){
    e.currentTarget.style.background='';
    e.currentTarget.style.borderTop='';
  },
  _todoDragEnd(e){
    // Reset all items in case drop target didn't clean up
    document.querySelectorAll('.todo-item').forEach(el=>{
      el.style.opacity='';
      el.style.transform='';
      el.style.background='';
      el.style.borderTop='';
    });
  },
  _todoDrop(e){
    e.preventDefault();
    e.stopPropagation();
    const fromId=e.dataTransfer.getData('text/plain');
    const dropEl=e.currentTarget;
    const toId=dropEl.dataset.id;
    dropEl.style.background='';
    dropEl.style.borderTop='';
    if(!fromId||!toId||fromId===toId) return;
    const todos=[...this.todos];
    const fromIdx=todos.findIndex(t=>t.id===fromId);
    const toIdx=todos.findIndex(t=>t.id===toId);
    if(fromIdx<0||toIdx<0) return;
    const [moved]=todos.splice(fromIdx,1);
    todos.splice(toIdx,0,moved);
    this.saveTodos(todos);
    this.renderTodo();
  },


  // ════════════════════════════════════════════════════════════════
  // SUBTASKS — stored inside each todo as todo.subtasks = [{id,text,done}]
  // ════════════════════════════════════════════════════════════════
  _getSubtasks(todoId){
    const t=this.todos.find(x=>x.id===todoId);
    return (t&&Array.isArray(t.subtasks))?t.subtasks:[];
  },
  _saveSubtasks(todoId,subtasks){
    const todos=this.todos.map(t=>t.id===todoId?{...t,subtasks}:t);
    this.saveTodos(todos);
  },
  addSubtask(todoId){
    const inp=document.getElementById('_sub_inp_'+todoId);
    const text=inp?inp.value.trim():'';
    if(!text)return;
    const subs=this._getSubtasks(todoId);
    subs.push({id:'s'+Date.now(),text,done:false});
    this._saveSubtasks(todoId,subs);
    this.renderTodo();
    // Re-expand
    setTimeout(()=>{ const el=document.getElementById('_subs_'+todoId); if(el)el.style.display=''; },10);
  },
  toggleSubtask(todoId,subId){
    const subs=this._getSubtasks(todoId).map(s=>s.id===subId?{...s,done:!s.done}:s);
    this._saveSubtasks(todoId,subs);
    this.renderTodo();
    setTimeout(()=>{ const el=document.getElementById('_subs_'+todoId); if(el)el.style.display=''; },10);
  },
  delSubtask(todoId,subId){
    const subs=this._getSubtasks(todoId).filter(s=>s.id!==subId);
    this._saveSubtasks(todoId,subs);
    this.renderTodo();
    setTimeout(()=>{ const el=document.getElementById('_subs_'+todoId); if(el)el.style.display=''; },10);
  },

  // ════════════════════════════════════════════════════════════════
  // HABIT TRACKER
  // localStorage: rk_habits  →  [{id,name,emoji,color,targetDays,createdAt}]
  // localStorage: rk_habit_logs  →  {habitId: ['2026-04-01','2026-04-02',...]}
  // ════════════════════════════════════════════════════════════════
  get habits(){ try{ return JSON.parse(localStorage.getItem('rk_habits')||'[]'); }catch{ return []; } },
  saveHabits(arr){ localStorage.setItem('rk_habits',JSON.stringify(arr)); if(window.fbSave) window.fbSave('habits',arr).catch(()=>{}); },
  getHabitLogs(habitId){ try{ return JSON.parse(localStorage.getItem('rk_hlog_'+habitId)||'[]'); }catch{ return []; } },
  saveHabitLogs(habitId,arr){ localStorage.setItem('rk_hlog_'+habitId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('hlog_'+habitId,arr).catch(()=>{}); },

  toggleHabitDay(habitId, dateStr){
    const logs=this.getHabitLogs(habitId);
    const idx=logs.indexOf(dateStr);
    if(idx>=0) logs.splice(idx,1);
    else logs.push(dateStr);
    this.saveHabitLogs(habitId,logs);
    this.renderTodo();
  },

  _habitStreak(habitId){
    const logs=new Set(this.getHabitLogs(habitId));
    const today=new Date(); today.setHours(0,0,0,0);
    let streak=0;
    let d=new Date(today);
    // Check today first; if not done, start from yesterday
    const todayStr=d.toISOString().split('T')[0];
    if(!logs.has(todayStr)) d.setDate(d.getDate()-1);
    while(true){
      const ds=d.toISOString().split('T')[0];
      if(!logs.has(ds)) break;
      streak++;
      d.setDate(d.getDate()-1);
      if(streak>365) break;
    }
    return streak;
  },

  _habitCompletionRate(habitId, days=30){
    const logs=new Set(this.getHabitLogs(habitId));
    const today=new Date(); today.setHours(0,0,0,0);
    let done=0;
    for(let i=0;i<days;i++){
      const d=new Date(today); d.setDate(d.getDate()-i);
      if(logs.has(d.toISOString().split('T')[0])) done++;
    }
    return Math.round((done/days)*100);
  },

  addHabit(){
    const name=(document.getElementById('_hab_name')||{}).value?.trim();
    if(!name){ this.showToastMsg('⚠️ Habit name required!'); return; }
    const emoji=(document.getElementById('_hab_emoji')||{}).value||'⭐';
    const color=(document.getElementById('_hab_color')||{}).value||'#1a7a45';
    const habits=this.habits;
    habits.push({id:'h'+Date.now(),name,emoji,color,createdAt:new Date().toISOString()});
    this.saveHabits(habits);
    this.showToastMsg('✅ Habit "'+name+'" added!');
    this.renderTodo();
  },

  delHabit(id){
    this.saveHabits(this.habits.filter(h=>h.id!==id));
    localStorage.removeItem('rk_hlog_'+id);
    this.renderTodo();
    this.showToastMsg('🗑 Habit deleted');
  },

  renderHabits(){
    const today=new Date(); today.setHours(0,0,0,0);
    const todayStr=today.toISOString().split('T')[0];
    const DOW=['S','M','T','W','T','F','S'];
    const habits=this.habits;

    // Build 4-week grid (28 days) ending today
    const buildGrid=(habitId,color)=>{
      const logs=new Set(this.getHabitLogs(habitId));
      const days=[];
      for(let i=27;i>=0;i--){
        const d=new Date(today); d.setDate(d.getDate()-i);
        days.push(d);
      }
      const startDow=days[0].getDay();
      // DOW header row
      let html='<div class="habit-grid">';
      DOW.forEach(d=>{ html+=`<div class="habit-dow">${d}</div>`; });
      // Blank cells for alignment
      for(let i=0;i<startDow;i++) html+='<div></div>';
      days.forEach(d=>{
        const ds=d.toISOString().split('T')[0];
        const isFuture=d>today;
        const isToday=ds===todayStr;
        const isDone=logs.has(ds);
        const dayNum=d.getDate();
        let cls='habit-cell';
        if(isFuture) cls+=' future';
        else if(isDone) cls+=' done';
        else if(ds<todayStr) cls+=' missed';
        if(isToday) cls+=' today';
        const style=isDone?`background:${color};border-color:${color};`:'';
        html+=isFuture
          ?`<div class="${cls}" style="${style}">${dayNum}</div>`
          :`<div class="${cls}" style="${style}" onclick="APP.toggleHabitDay('${habitId}','${ds}')" title="${ds}">${dayNum}</div>`;
      });
      html+='</div>';
      return html;
    };

    const habitCards=habits.map(h=>{
      const streak=this._habitStreak(h.id);
      const rate=this._habitCompletionRate(h.id,28);
      const logs=this.getHabitLogs(h.id);
      const doneToday=logs.includes(todayStr);
      return `<div class="habit-card">
        <div class="habit-head">
          <div class="habit-emoji" style="background:${h.color}22;">${h.emoji}</div>
          <div style="flex:1;min-width:0;">
            <div class="habit-name">${h.name}</div>
            <div style="font-size:.68rem;color:var(--mut);">${rate}% last 28 days · ${logs.length} total days</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            <div class="habit-streak">${streak>0?'🔥 '+streak+' day streak':'—'}</div>
            <button onclick="APP.delHabit('${h.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.72rem;padding:0;">🗑</button>
          </div>
        </div>
        <!-- Today quick-check -->
        <div style="padding:8px 14px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:.78rem;font-weight:700;">Today</span>
          <button onclick="APP.toggleHabitDay('${h.id}','${todayStr}')"
            style="padding:5px 16px;border-radius:20px;border:2px solid ${doneToday?h.color:'var(--bdr2)'};background:${doneToday?h.color+'22':'transparent'};color:${doneToday?h.color:'var(--mut)'};font-weight:800;font-size:.78rem;cursor:pointer;font-family:'Nunito',sans-serif;transition:all .2s;">
            ${doneToday?'✅ Done!':'○ Mark Done'}
          </button>
        </div>
        ${buildGrid(h.id,h.color)}
      </div>`;
    }).join('');

    return `
      <!-- Add habit form -->
      <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:14px;padding:14px;margin-bottom:14px;box-shadow:var(--sh);">
        <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">➕ Add New Habit</div>
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:end;">
          <div>
            <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Habit Name</label>
            <input id="_hab_name" placeholder="e.g. Morning Walk, Read 30min, Meditate…"
              style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:7px 10px;font-family:'Nunito',sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);"
              onkeydown="if(event.key==='Enter')APP.addHabit()">
          </div>
          <div>
            <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Icon</label>
            <input id="_hab_emoji" value="⭐" maxlength="2"
              style="width:52px;border:1.5px solid var(--bdr2);border-radius:7px;padding:7px 8px;font-size:1.1rem;text-align:center;background:var(--bg);color:var(--txt);">
          </div>
          <div>
            <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Colour</label>
            <input id="_hab_color" type="color" value="#1a7a45"
              style="width:40px;height:36px;border:1.5px solid var(--bdr2);border-radius:7px;padding:2px;cursor:pointer;background:var(--bg);">
          </div>
        </div>
        <button onclick="APP.addHabit()" style="width:100%;margin-top:10px;background:var(--acc);color:#fff;border:none;border-radius:9px;padding:9px;font-family:'Nunito',sans-serif;font-size:.88rem;font-weight:800;cursor:pointer;">✅ Add Habit</button>
      </div>

      ${habits.length
        ? habitCards
        : `<div class="empty" style="padding:40px;"><div class="ei">🌱</div>No habits yet.<br>Add your first habit above to start tracking!</div>`
      }`;
  },

  renderTodo(){
    const now=new Date(); now.setHours(0,0,0,0);
    const todayStr=now.toISOString().split('T')[0];
    const tomorrowStr=new Date(now.getTime()+86400000).toISOString().split('T')[0];
    const in7Str=new Date(now.getTime()+7*86400000).toISOString().split('T')[0];

    const priLabel={high:'🔴 High',medium:'🟡 Medium',low:'🟢 Low'};
    const priClass={high:'todo-pri-high',medium:'todo-pri-med',low:'todo-pri-low'};
    const recLabel={none:'',daily:'🔁 Daily',weekly:'🔁 Weekly',monthly:'🔁 Monthly'};

    function dueInfo(d){
      if(!d) return {label:'',cls:'todo-due-ok'};
      if(d<todayStr) return {label:'⚠️ Overdue',cls:'todo-due-over'};
      if(d===todayStr) return {label:'📅 Today',cls:'todo-due-today'};
      if(d===tomorrowStr) return {label:'📅 Tomorrow',cls:'todo-due-soon'};
      if(d<=in7Str) return {label:'📅 This week',cls:'todo-due-soon'};
      return {label:'📅 '+fD(d),cls:'todo-due-ok'};
    }

    const f=this._todoFilter||'all';
    let todos=this.todos;
    // Filter
    let filtered=todos.filter(t=>!t.done);
    if(f==='high') filtered=filtered.filter(t=>t.priority==='high');
    else if(f==='medium') filtered=filtered.filter(t=>t.priority==='medium');
    else if(f==='low') filtered=filtered.filter(t=>t.priority==='low');
    else if(f==='overdue') filtered=filtered.filter(t=>t.dueDate&&t.dueDate<todayStr);
    else if(f==='today') filtered=filtered.filter(t=>t.dueDate===todayStr);
    else if(f==='recurring') filtered=filtered.filter(t=>t.recurring&&t.recurring!=='none');
    // Sort: high first, then by due date
    filtered.sort((a,b)=>{
      const po={high:0,medium:1,low:2};
      if((po[a.priority]||1)!==(po[b.priority]||1)) return (po[a.priority]||1)-(po[b.priority]||1);
      if(a.dueDate&&b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if(a.dueDate) return -1; if(b.dueDate) return 1;
      return 0;
    });
    const done=todos.filter(t=>t.done);

    // Counts for filter bar
    const overdueCount=todos.filter(t=>!t.done&&t.dueDate&&t.dueDate<todayStr).length;
    const todayCount=todos.filter(t=>!t.done&&t.dueDate===todayStr).length;
    const highCount=todos.filter(t=>!t.done&&t.priority==='high').length;

    const makeRow=(x)=>{
      const du=dueInfo(x.dueDate);
      const pc=priClass[x.priority]||'todo-pri-med';
      const pl=priLabel[x.priority]||'🟡 Medium';
      const rl=recLabel[x.recurring]||'';
      const isRec=x.recurring&&x.recurring!=='none';
      const subs=Array.isArray(x.subtasks)?x.subtasks:[];
      const subsDone=subs.filter(s=>s.done).length;
      const hasSubs=subs.length>0;
      const subsPct=hasSubs?Math.round(subsDone/subs.length*100):0;
      const subBar=hasSubs?`<div style="display:flex;align-items:center;gap:6px;margin-top:4px;cursor:pointer;" onclick="(function(){var el=document.getElementById('_subs_${x.id}');if(el)el.style.display=el.style.display==='none'?'':'none';})()">
        <div style="flex:1;height:4px;background:var(--dim);border-radius:2px;overflow:hidden;"><div style="width:${subsPct}%;height:100%;background:var(--grn);border-radius:2px;"></div></div>
        <span style="font-size:.62rem;color:var(--mut);white-space:nowrap;">${subsDone}/${subs.length} subtasks</span>
      </div>`:'';
      const subList=`<div id="_subs_${x.id}" style="${hasSubs?'':'display:none'}">
        ${hasSubs?`<div class="subtask-list">${subs.map(s=>`
          <div class="subtask-row">
            <input type="checkbox" ${s.done?'checked':''} onchange="APP.toggleSubtask('${x.id}','${s.id}')">
            <span class="${s.done?'subtask-done':''}" style="flex:1;">${s.text}</span>
            <button onclick="APP.delSubtask('${x.id}','${s.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.7rem;padding:0 2px;">✕</button>
          </div>`).join('')}</div>`:''}
        <div class="subtask-add">
          <input id="_sub_inp_${x.id}" placeholder="+ Add subtask…" onkeydown="if(event.key==='Enter')APP.addSubtask('${x.id}')"
            style="flex:1;background:var(--bg);border:1.5px solid var(--bdr2);border-radius:6px;padding:4px 8px;font-family:'Nunito',sans-serif;font-size:.76rem;color:var(--txt);">
          <button onclick="APP.addSubtask('${x.id}')" style="background:var(--acc);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:.76rem;font-weight:700;cursor:pointer;">+</button>
        </div>
      </div>`;
      return `<div class="todo-item ${x.done?'done':''}" style="display:block;padding:0;${x.priority==='high'&&!x.done?'border-left:3px solid #e05050;':''}" draggable="true" data-id="${x.id}" ondragstart="APP._todoDragStart(event)" ondragover="APP._todoDragOver(event)" ondragleave="APP._todoDragLeave(event)" ondragend="APP._todoDragEnd(event)" ondrop="APP._todoDrop(event)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:9px 14px;">
          <div style="display:flex;align-items:flex-start;gap:8px;flex:1;min-width:0;padding-top:1px;">
            <span style="cursor:grab;color:var(--mut);font-size:.9rem;margin-top:3px;flex-shrink:0;" title="Drag to reorder">⠿</span>
            <input type="checkbox" class="todo-check" ${x.done?'checked':''} onchange="APP.toggleTodo('${x.id}')" style="margin-top:3px;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
              <span class="todo-text" style="word-break:break-word;display:block;margin-bottom:3px;">${APP.displayText(APP.cleanText(x.text))}${x.fromReminder?'<span style="font-size:.58rem;background:var(--dim);border-radius:4px;padding:1px 5px;margin-left:4px;color:var(--mut);">🔔</span>':''}</span>
              <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
                <span class="${pc}">${pl}</span>
                ${du.label?`<span class="${du.cls}">${du.label}</span>`:''}
                ${rl?`<span style="font-size:.6rem;color:var(--acc);font-weight:700;">${rl}</span>`:''}
              </div>
              ${subBar}
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;margin-top:1px;">
            <button onclick="(function(){var el=document.getElementById('_subs_${x.id}');if(el)el.style.display=el.style.display==='none'?'':'none';})()" title="Subtasks" style="background:${hasSubs?'#e3f2fd':'var(--dim)'};border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.72rem;color:${hasSubs?'#1565c0':'var(--mut)'};">☰</button>
            <button onclick="APP.editTodo('${x.id}')" title="Edit" style="background:var(--dim);border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.75rem;">✏️</button>
            <button class="todo-del" onclick="${isRec?`APP._delTodoConfirm('${x.id}')`:`APP.delTodo('${x.id}')`}" title="Delete" style="flex-shrink:0;">🗑</button>
          </div>
        </div>
        ${subList}
      </div>`;
    };

    const pendingRows=filtered.length
      ? filtered.map(makeRow).join('')
      : '<div style="padding:18px;text-align:center;color:var(--mut);font-size:.84rem;">'+(f==='all'?'🎉 Sab kaam ho gaya!':'No tasks in this filter')+'</div>';

    const doneSection=done.length?`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 14px;font-size:.72rem;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-top:1px solid var(--bdr);">
        <span>✅ Completed (${done.length})</span>
        <button onclick="APP._clearDoneTodos()" style="background:none;border:1px solid rgba(229,57,53,.3);border-radius:5px;padding:2px 8px;font-size:.68rem;color:#e53935;cursor:pointer;">🗑 Clear All</button>
      </div>
      <div class="todo-list" style="max-height:none;">${done.slice(0,5).map(makeRow).join('')}${done.length>5?`<div style="text-align:center;padding:6px;font-size:.72rem;color:var(--mut);">+${done.length-5} more completed</div>`:''}</div>`:'';

    const filterBtns=[
      {k:'all',label:'All ('+todos.filter(t=>!t.done).length+')'},
      {k:'high',label:'🔴 High'+(highCount?` (${highCount})`:'')},
      {k:'medium',label:'🟡 Medium'},
      {k:'low',label:'🟢 Low'},
      {k:'overdue',label:'⚠️ Overdue'+(overdueCount?` (${overdueCount})`:'')},
      {k:'today',label:'📅 Today'+(todayCount?` (${todayCount})`:'')},
      {k:'recurring',label:'🔁 Recurring'},
    ].map(b=>`<button class="todo-filter-btn ${f===b.k?'on':''}" onclick="APP.setTodoFilter('${b.k}')">${b.label}</button>`).join('');

    const _todoSub = this._todoSub || 'tasks';
    document.getElementById('pan-todo').innerHTML=`
      <div class="sec-hdr">
        <div class="sec-title">✅ Tasks &amp; Habits</div>
      </div>
      <!-- Sub-tabs -->
      <div class="stabs" style="margin-bottom:14px;">
        <button class="stab ${_todoSub==='tasks'?'on':''}" onclick="APP._todoSub='tasks';APP.renderTodo()">
          ✅ To-Do <span class="ct" style="margin-left:4px;">${todos.filter(t=>!t.done).length}</span>
        </button>
        <button class="stab ${_todoSub==='habits'?'on':''}" onclick="APP._todoSub='habits';APP.renderTodo()">
          🔥 Habits <span class="ct" style="margin-left:4px;">${this.habits.length}</span>
        </button>
      </div>

      ${_todoSub==='tasks'?`
      <!-- TASKS TAB -->
      <div class="todo-wrap" style="max-width:720px;">
        <div class="todo-hdr"><div style="font-weight:700;font-size:.9rem;">📝 Add New Task</div></div>
        <div style="padding:10px 14px;border-bottom:1px solid var(--bdr);display:flex;flex-direction:column;gap:8px;background:var(--card2);">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <input class="todo-input" id="todoInp" placeholder="Kya karna hai? e.g. Rent collect karo…" onkeydown="if(event.keyCode===13)APP.addTodo()" style="flex:1;min-width:160px;">
            <select id="todoPri" style="background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.8rem;cursor:pointer;">
              <option value="high">🔴 High</option>
              <option value="medium" selected>🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <input type="date" id="todoDue" title="Due date" style="background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:5px 8px;font-family:'Nunito',sans-serif;font-size:.79rem;flex:1;min-width:130px;">
            <select id="todoRec" style="background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:5px 8px;font-family:'Nunito',sans-serif;font-size:.79rem;flex:1;min-width:110px;">
              <option value="none">No Repeat</option>
              <option value="daily">🔁 Daily</option>
              <option value="weekly">🔁 Weekly</option>
              <option value="monthly">🔁 Monthly</option>
            </select>
            <button class="btn b-gold b-sm" onclick="APP.addTodo()" style="padding:7px 16px;white-space:nowrap;">＋ Add Task</button>
          </div>
        </div>
        <div class="todo-filter-bar">${filterBtns}</div>
        <div class="todo-list" style="max-height:none;">${pendingRows}</div>
        ${doneSection}
      </div>
      `:/* HABITS TAB */`
      <div style="max-width:720px;">${this.renderHabits()}</div>
      `}`;
  },

  // ══ AUTO-LINK: Universal URL → clickable link (XSS-safe) ══
  // ══ AUTO-LINK v2 — Universal URL detector, XSS-safe, double-parse proof ══
  autoLink(text){
    if(!text) return '';
    // Step 1: If input already has HTML tags (already processed), skip re-parsing
    // Only process plain text — if contains <a href it's already linked
    const str = String(text);
    if(str.includes('<a ') && str.includes('href=')) return str; // already linked

    // Step 2: Escape HTML to prevent XSS
    const safe = str
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');

    // Step 3: Detect URLs (https / http / www)
    const urlRx = /((https?:\/\/|www\.)[^\s<>"'(){}\[\]]{2,}[^\s<>"'(){}\[\].,!?;:'"\)])/gi;
    return safe.replace(urlRx,(match)=>{
      const href = match.startsWith('www.') ? 'https://'+match : match;
      const display = match.length > 50 ? match.slice(0,47)+'…' : match;
      return '<a href="'+href+'" target="_blank" rel="noopener noreferrer" '
        +'class="auto-link" '
        +'style="color:#2c6fad;font-weight:600;text-decoration:underline;cursor:pointer;word-break:break-all;'
        +'display:inline-flex;align-items:center;gap:2px;" '
        +'title="'+href+'" '
        +'onclick="event.stopPropagation()">🔗 '+display+'</a>';
    });
  },
  // autoLinkBr: autoLink + newlines → <br> (for multi-line content)
  autoLinkBr(text){
    if(!text) return '';
    return this.autoLink(text).replace(/\n/g,'<br>');
  },
  // autoLinkSafe: for when text may already contain HTML (highlight marks etc.)
  autoLinkSafe(html_text){
    if(!html_text) return '';
    if(!html_text.includes('http') && !html_text.includes('www.')) return html_text;
    return html_text.replace(/(<a[^>]*>.*?<\/a>)|([^<]+)/gi, (match, linked, plain)=>{
      if(linked) return linked;
      if(plain) return this.autoLink(plain);
      return match;
    });
  },

  // ══ CLEAN TEXT: Remove unwanted wrapping quotes from stored text ══
  cleanText(text){
    if(!text && text !== 0) return '';
    let s = String(text).trim();
    // Remove wrapping double-quotes: "hello" → hello
    if(s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1,-1);
    // Remove wrapping single-quotes: 'hello' → hello
    if(s.length >= 2 && s.startsWith("'") && s.endsWith("'")) s = s.slice(1,-1);
    return s;
  },

  // ══ DISPLAY TEXT: cleanText + autoLink combined (use in all text rendering) ══
  displayText(text, multiline){
    const cleaned = this.cleanText(text);
    if(multiline) return this.autoLinkBr(cleaned);
    return this.autoLink(cleaned);
  },

  // ══ NOTEPAD (Home Dashboard Widget) ══
  // AIC Notepad widget — compact, tabs only, no preview
  renderNotepad(){
    const cats = this._getNoteCategories();
    const tabBtns = cats.map(cat => {
      const hasContent = !!this._getNoteContent(cat).trim();
      return `<button class="np-cat-btn" onclick="APP._npOpenEditor('${cat}')"
        title="${hasContent ? 'Has notes' : 'Empty'}">
        ${hasContent ? '📝' : '📄'} ${cat}
      </button>`;
    }).join('');
    return `<div class="np-widget">
      <div style="padding:10px 14px 4px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <div style="font-weight:800;font-size:.88rem;">📝 Notepad</div>
        <div style="display:flex;gap:5px;align-items:center;">
          <button onclick="APP._npOpenSearch()" style="background:#eff6ff;color:#1760a0;border:1.5px solid #90b8e8;border-radius:8px;padding:4px 10px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;" title="Search in all notes">🔍 Search</button>
          <button onclick="APP._npOpenImport()" style="background:#f0fdf4;color:#1e7a45;border:1.5px solid #86efac;border-radius:8px;padding:4px 10px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;" title="Import text, QR, link">📥 Import</button>
          <button class="btn b-sm b-out" onclick="APP.goTab('notepad')" style="font-size:.68rem;padding:3px 9px;">All ↗</button>
        </div>
      </div>
      <div class="np-cat-tabs">${tabBtns}</div>
    </div>`;
  },

  // ══ DIARY ══
  getDiaryEntries(){try{return JSON.parse(localStorage.getItem('rk_diary')||'[]');}catch{return[];}},
  saveDiaryEntries(e){localStorage.setItem('rk_diary',JSON.stringify(e));if(window.fbSave)window.fbSave('diary',e).catch(()=>{});},

  saveDiaryEntry(){
    const date=vDate('diary_date')||(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    const title=document.getElementById('diary_title').value.trim();
    const body=document.getElementById('diary_body').value.trim();
    const tags=document.getElementById('diary_tags').value.trim();
    if(!body){alert('Kuch likhein!');return;}
    const mood = document.getElementById('diary_mood')?.value||'';
    const photo = document.getElementById('diary_photo')?.value?.trim()||'';
    const entries=this.getDiaryEntries();
    const id=this.diaryEditId||uid();
    if(this.diaryEditId){
      const idx=entries.findIndex(e=>e.id===id);
      if(idx>=0)entries[idx]={...entries[idx],date,title,body,tags,mood,photo,updated:new Date().toISOString()};
    } else {
      entries.unshift({id,date,title,body,tags,mood,photo,created:new Date().toISOString()});
    }
    this.saveDiaryEntries(entries);
    this.diaryEditId=null;
    this.renderDiary();
  },

  delDiaryEntry(id){
    if(!confirm('Delete this diary entry?'))return;
    this.saveDiaryEntries(this.getDiaryEntries().filter(e=>e.id!==id));
    this.renderDiary();
  },

  editDiaryEntry(id){
    const e=this.getDiaryEntries().find(x=>x.id===id);if(!e)return;
    this.diaryEditId=id;
    svDate('diary_date',e.date);
    document.getElementById('diary_title').value=e.title||'';
    document.getElementById('diary_body').value=e.body||'';
    document.getElementById('diary_tags').value=e.tags||'';
    if(document.getElementById('diary_mood')) document.getElementById('diary_mood').value=e.mood||'';
    if(document.getElementById('diary_photo')) document.getElementById('diary_photo').value=e.photo||'';
    document.getElementById('diary_form_area').scrollIntoView({behavior:'smooth'});
  },

  searchDiary(){
    const q=(document.getElementById('diary_search').value||'').toLowerCase().trim();
    this.diaryQuery=q;
    this.renderDiaryList();
  },

  highlightText(text,query){
    if(!query)return text;
    // Highlight every match — numbers, letters, words all
    const escaped=query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return text.replace(new RegExp('('+escaped+')','gi'),'<mark style="background:#ffe066;border-radius:2px;padding:0 1px">$1</mark>');
  },

/* modules/todo.js — Tasks — saveTodos, addTodo, addSubtask, renderTodo
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
  // ══ TASK LIST ══
  _todosCache:null,
  _loadTodosFromStorage(){
    try{
      return this._normalizeTodos(JSON.parse(localStorage.getItem('rk_todos')||'[]'));
    }catch{
      return [];
    }
  },
  get todos(){
    if(Array.isArray(this._todosCache)) return this._normalizeTodos(this._todosCache);
    this._todosCache=this._loadTodosFromStorage();
    return this._normalizeTodos(this._todosCache);
  },
  saveTodos(todos){
    const clean=this._normalizeTodos(todos);
    const stamp=Date.now();
    this._todosCache=clean;
    this._todoRenderSource=clean;
    localStorage.setItem('rk_todos',JSON.stringify(clean));
    localStorage.setItem('rk_todos_updated', JSON.stringify(stamp));
    if(window.fbSave){
      window.fbSave('todos',clean).catch(()=>{});
      window.fbSave('todos_updated',stamp).catch(()=>{});
    }
  },
  _todoFilter:'all',

  _normalizeTodos(arr){
    return (Array.isArray(arr)?arr:[]).map(function(todo){
      if(!todo||typeof todo!=='object') return todo;
      const next={...todo};
      delete next.priority;
      return next;
    });
  },

  _todoWorkingSet(){
    if(this.curTab==='todo' && Array.isArray(this._todoRenderSource)){
      return this._normalizeTodos(this._todoRenderSource);
    }
    return this.todos;
  },

  _migrateTodoData(){
    let changed=false;
    const clean=this.todos.map(function(todo){
      const next={...todo};
      if(Object.prototype.hasOwnProperty.call(next,'priority')){
        delete next.priority;
        changed=true;
      }
      return next;
    });

    const rawHabits=localStorage.getItem('rk_habits');
    if(rawHabits){
      try{
        const habits=JSON.parse(rawHabits||'[]');
        if(Array.isArray(habits)){
          habits.forEach(function(h){
            if(h&&h.id) localStorage.removeItem('rk_hlog_'+h.id);
          });
        }
      }catch(e){}
      localStorage.removeItem('rk_habits');
      changed=true;
    }

    if(changed) this.saveTodos(clean);
  },

  _refreshTodoViews(){
    const todoOverride=Array.isArray(this._todoRenderOverride)
      ? this._normalizeTodos(this._todoRenderOverride)
      : null;
    const todoPan=document.getElementById('pan-todo');
    const homePan=document.getElementById('pan-home');
    const homeVisible=!!(homePan && homePan.style.display!=='none');
    const todoVisible=this.curTab==='todo' || !!(todoPan && todoPan.style.display!=='none');

    const repaintTodo=()=>{
      const liveTodoPan=document.getElementById('pan-todo');
      if(!liveTodoPan) return;
      const prevScroll=liveTodoPan.scrollTop;
      this.renderTodo(todoOverride);
      const nextTodoPan=document.getElementById('pan-todo');
      if(nextTodoPan && todoVisible){
        const maxScroll=Math.max(0,nextTodoPan.scrollHeight-nextTodoPan.clientHeight);
        nextTodoPan.scrollTop=Math.min(prevScroll,maxScroll);
      }
    };

    if(todoPan) repaintTodo();
    if(todoVisible){
      requestAnimationFrame(()=>{
        if(this.curTab==='todo') repaintTodo();
      });
    }
    if(homeVisible){
      this.renderHome();
    }
    this.renderPills();
    this._todoRenderOverride=null;
  },

  _queueTodoRefresh(nextTodos){
    if(Array.isArray(nextTodos)) this._todoRenderOverride=this._normalizeTodos(nextTodos);
    if(this._todoRefreshRaf) cancelAnimationFrame(this._todoRefreshRaf);
    this._todoRefreshRaf=requestAnimationFrame(()=>{
      this._todoRefreshRaf=null;
      this._refreshTodoViews();
    });
  },

  addTodo(){
    const inp=document.getElementById('todoInp');
    const txt=inp?inp.value.trim():'';
    if(!txt) return;
    const due=document.getElementById('todoDue')?document.getElementById('todoDue').value:'';
    const rec=document.getElementById('todoRec')?document.getElementById('todoRec').value:'none';
    const todos=this._todoWorkingSet();
    todos.push({
      id:uid(),
      text:txt,
      done:false,
      dueDate:due,
      recurring:rec,
      created:new Date().toISOString()
    });
    this.saveTodos(todos);
    inp.value='';
    if(document.getElementById('todoDue')) document.getElementById('todoDue').value='';
    this._queueTodoRefresh(todos);
  },

  toggleTodo(id){
    const todos=this._todoWorkingSet().map(t=>{
      if(t.id!==id) return t;
      const done=!t.done;
      if(done && t.recurring && t.recurring!=='none' && t.dueDate){
        const d=new Date(t.dueDate);
        if(t.recurring==='daily') d.setDate(d.getDate()+1);
        else if(t.recurring==='weekly') d.setDate(d.getDate()+7);
        else if(t.recurring==='monthly') d.setMonth(d.getMonth()+1);
        const nextDate=d.toISOString().split('T')[0];
        setTimeout(()=>{
          const ts=this.todos;
          const base=this._todoWorkingSet().filter(function(item){ return item.id!==t.id || item.done!==done; });
          base.push({
            id:uid(),
            text:t.text,
            done:false,
            dueDate:nextDate,
            recurring:t.recurring,
            created:new Date().toISOString()
          });
          this.saveTodos(base);
          this._queueTodoRefresh(base);
        },300);
      }
      return {...t,done,completedAt:done?new Date().toISOString():null};
    });
    this.saveTodos(todos);
    this._queueTodoRefresh(todos);
  },

  delTodo(id){
    const next=this._todoWorkingSet().filter(t=>t.id!==id);
    this.saveTodos(next);
    this._queueTodoRefresh(next);
  },

  setTodoFilter(f){
    this._todoFilter=f;
    this.renderTodo();
  },

  _clearDoneTodos(){
    if(!confirm('Sab completed tasks delete karen?')) return;
    const next=this._todoWorkingSet().filter(t=>!t.done);
    this.saveTodos(next);
    this._queueTodoRefresh(next);
    this.showToastMsg('✅ Completed tasks cleared!');
  },

  editTodo(id){
    const t=this._todoWorkingSet().find(x=>x.id===id);
    if(!t) return;
    let modal=document.getElementById('_todoEditModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='_todoEditModal';
      modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
    }
    modal.innerHTML=`<div style="background:#fff;border-radius:14px;padding:20px;width:100%;max-width:480px;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="font-weight:800;font-size:1rem;margin-bottom:14px;">✏️ Edit Task</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Task</label>
          <input id="_te_text" value="${(t.text||'').replace(/"/g,'&quot;')}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:7px 10px;font-family:'Nunito',sans-serif;font-size:.9rem;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Due Date</label>
            <input type="date" id="_te_due" value="${t.dueDate||''}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.82rem;">
          </div>
          <div>
            <label style="font-size:.72rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">Repeat</label>
            <select id="_te_rec" style="width:100%;border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 8px;font-family:'Nunito',sans-serif;font-size:.82rem;">
              <option value="none" ${(!t.recurring||t.recurring==='none')?'selected':''}>No Repeat</option>
              <option value="daily" ${t.recurring==='daily'?'selected':''}>🔁 Daily</option>
              <option value="weekly" ${t.recurring==='weekly'?'selected':''}>🔁 Weekly</option>
              <option value="monthly" ${t.recurring==='monthly'?'selected':''}>🔁 Monthly</option>
            </select>
          </div>
        </div>
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
    if(!text){
      this.showToastMsg('⚠️ Task text required!');
      return;
    }
    const todos=this._todoWorkingSet().map(t=>t.id===id?{
      ...t,
      text,
      dueDate:document.getElementById('_te_due')?.value||'',
      recurring:document.getElementById('_te_rec')?.value||'none',
      updated:new Date().toISOString()
    }:t);
    this.saveTodos(todos);
    document.getElementById('_todoEditModal')?.remove();
    this._queueTodoRefresh(todos);
    this.showToastMsg('✅ Task updated!');
  },

  _delTodoConfirm(id){
    const t=this._todoWorkingSet().find(x=>x.id===id);
    if(!t) return;
    if(!t.recurring||t.recurring==='none'){
      this.delTodo(id);
      return;
    }
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
    const t=this._todoWorkingSet().find(x=>x.id===id);
    if(!t) return;
    const remaining=this._todoWorkingSet().filter(x=>!(x.recurring===t.recurring&&x.text===t.text));
    this.saveTodos(remaining);
    this._queueTodoRefresh(remaining);
    this.showToastMsg('✅ All recurring instances deleted!');
  },

  _todoStopAction(ev){
    if(!ev) return;
    ev.preventDefault();
    ev.stopPropagation();
  },
  _todoEditClick(id, ev){
    this._todoStopAction(ev);
    this.editTodo(id);
  },
  _todoDeleteClick(id, isRecurring, ev){
    this._todoStopAction(ev);
    if(isRecurring) this._delTodoConfirm(id);
    else this.delTodo(id);
  },
  _todoToggleSubs(todoId, ev){
    this._todoStopAction(ev);
    var el=document.getElementById('_subs_'+todoId);
    if(el) el.style.display=el.style.display==='none'?'':'none';
  },

  _wireTodoDelegates(){
    const host=document.getElementById('pan-todo');
    if(!host||host.dataset.todoWired==='1') return;
    host.dataset.todoWired='1';
    host.addEventListener('click',(ev)=>{
      const actionEl=ev.target.closest('[data-todo-action]');
      if(!actionEl||!host.contains(actionEl)) return;
      const action=actionEl.dataset.todoAction;
      const id=actionEl.dataset.todoId;
      const recurring=actionEl.dataset.todoRecurring==='true';
      this._todoStopAction(ev);
      if(action==='toggle-subs') this._todoToggleSubs(id);
      else if(action==='edit') this.editTodo(id);
      else if(action==='delete'){
        if(recurring) this._delTodoConfirm(id);
        else this.delTodo(id);
      }
    });
  },

  _todoDragStart(e){
    if(e.target && e.target.closest('button, input, select, textarea, a, label')) return e.preventDefault();
    e.dataTransfer.setData('text/plain',e.currentTarget.dataset.id);
    e.dataTransfer.effectAllowed='move';
    e.currentTarget.style.opacity='0.4';
    e.currentTarget.style.transform='scale(0.98)';
  },
  _todoDragOver(e){
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    const el=e.currentTarget;
    el.style.background='#e8f5e9';
    el.style.borderTop='2px solid #1a7a45';
  },
  _todoDragLeave(e){
    e.currentTarget.style.background='';
    e.currentTarget.style.borderTop='';
  },
  _todoDragEnd(){
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
    const moved=todos.splice(fromIdx,1)[0];
    todos.splice(toIdx,0,moved);
    this.saveTodos(todos);
    this._queueTodoRefresh(todos);
  },

  _getSubtasks(todoId){
    const t=this._todoWorkingSet().find(x=>x.id===todoId);
    return (t&&Array.isArray(t.subtasks))?t.subtasks:[];
  },
  _saveSubtasks(todoId,subtasks){
    const todos=this._todoWorkingSet().map(t=>t.id===todoId?{...t,subtasks}:t);
    this.saveTodos(todos);
  },
  addSubtask(todoId){
    const inp=document.getElementById('_sub_inp_'+todoId);
    const text=inp?inp.value.trim():'';
    if(!text) return;
    const subs=this._getSubtasks(todoId);
    subs.push({id:'s'+Date.now(),text,done:false});
    this._saveSubtasks(todoId,subs);
    this._queueTodoRefresh(this.todos);
    setTimeout(()=>{
      const el=document.getElementById('_subs_'+todoId);
      if(el) el.style.display='';
    },10);
  },
  toggleSubtask(todoId,subId){
    const subs=this._getSubtasks(todoId).map(s=>s.id===subId?{...s,done:!s.done}:s);
    this._saveSubtasks(todoId,subs);
    this._queueTodoRefresh(this.todos);
    setTimeout(()=>{
      const el=document.getElementById('_subs_'+todoId);
      if(el) el.style.display='';
    },10);
  },
  delSubtask(todoId,subId){
    const subs=this._getSubtasks(todoId).filter(s=>s.id!==subId);
    this._saveSubtasks(todoId,subs);
    this._queueTodoRefresh(this.todos);
    setTimeout(()=>{
      const el=document.getElementById('_subs_'+todoId);
      if(el) el.style.display='';
    },10);
  },

  renderTodo(sourceTodos){
    this._migrateTodoData();
    const now=new Date();
    now.setHours(0,0,0,0);
    const todayStr=now.toISOString().split('T')[0];
    const tomorrowStr=new Date(now.getTime()+86400000).toISOString().split('T')[0];
    const in7Str=new Date(now.getTime()+7*86400000).toISOString().split('T')[0];
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
    const todos=Array.isArray(sourceTodos)?this._normalizeTodos(sourceTodos):this.todos;
    this._todoRenderSource=this._normalizeTodos(todos);
    let filtered=todos.filter(t=>!t.done);
    if(f==='overdue') filtered=filtered.filter(t=>t.dueDate&&t.dueDate<todayStr);
    else if(f==='today') filtered=filtered.filter(t=>t.dueDate===todayStr);
    else if(f==='recurring') filtered=filtered.filter(t=>t.recurring&&t.recurring!=='none');

    filtered.sort((a,b)=>{
      if(a.dueDate&&b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if(a.dueDate) return -1;
      if(b.dueDate) return 1;
      return 0;
    });

    const done=todos.filter(t=>t.done);
    const overdueCount=todos.filter(t=>!t.done&&t.dueDate&&t.dueDate<todayStr).length;
    const todayCount=todos.filter(t=>!t.done&&t.dueDate===todayStr).length;

    const makeRow=(x)=>{
      const du=dueInfo(x.dueDate);
      const rl=recLabel[x.recurring]||'';
      const isRec=x.recurring&&x.recurring!=='none';
      const subs=Array.isArray(x.subtasks)?x.subtasks:[];
      const subsDone=subs.filter(s=>s.done).length;
      const hasSubs=subs.length>0;
      const subsPct=hasSubs?Math.round(subsDone/subs.length*100):0;
      const subBar=hasSubs?`<div style="display:flex;align-items:center;gap:6px;margin-top:4px;cursor:pointer;" data-todo-action="toggle-subs" data-todo-id="${x.id}">
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
      return `<div class="todo-item ${x.done?'done':''}" style="display:block;padding:0;" data-id="${x.id}" ondragover="APP._todoDragOver(event)" ondragleave="APP._todoDragLeave(event)" ondrop="APP._todoDrop(event)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:9px 14px;">
          <div style="display:flex;align-items:flex-start;gap:8px;flex:1;min-width:0;padding-top:1px;">
            <span draggable="true" data-id="${x.id}" ondragstart="APP._todoDragStart(event)" ondragend="APP._todoDragEnd(event)" style="cursor:grab;color:var(--mut);font-size:.9rem;margin-top:3px;flex-shrink:0;" title="Drag to reorder">⠿</span>
            <input type="checkbox" class="todo-check" ${x.done?'checked':''} onchange="APP.toggleTodo('${x.id}')" style="margin-top:3px;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
              <span class="todo-text" style="word-break:break-word;display:block;margin-bottom:3px;">${APP.displayText(APP.cleanText(x.text))}${x.fromReminder?'<span style="font-size:.58rem;background:var(--dim);border-radius:4px;padding:1px 5px;margin-left:4px;color:var(--mut);">🔔</span>':''}</span>
              <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
                ${du.label?`<span class="${du.cls}">${du.label}</span>`:''}
                ${rl?`<span style="font-size:.6rem;color:var(--acc);font-weight:700;">${rl}</span>`:''}
              </div>
              ${subBar}
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;margin-top:1px;">
            <button type="button" data-todo-action="toggle-subs" data-todo-id="${x.id}" title="Subtasks" style="background:${hasSubs?'#e3f2fd':'var(--dim)'};border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.72rem;color:${hasSubs?'#1565c0':'var(--mut)'};">☰</button>
            <button type="button" data-todo-action="edit" data-todo-id="${x.id}" title="Edit" style="background:var(--dim);border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.75rem;">✏️</button>
            <button type="button" class="todo-del" data-todo-action="delete" data-todo-id="${x.id}" data-todo-recurring="${isRec?'true':'false'}" title="Delete" style="flex-shrink:0;">🗑</button>
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
      {k:'overdue',label:'⚠️ Overdue'+(overdueCount?` (${overdueCount})`:'')},
      {k:'today',label:'📅 Today'+(todayCount?` (${todayCount})`:'')},
      {k:'recurring',label:'🔁 Recurring'},
    ].map(b=>`<button class="todo-filter-btn ${f===b.k?'on':''}" onclick="APP.setTodoFilter('${b.k}')">${b.label}</button>`).join('');

    document.getElementById('pan-todo').innerHTML=`
      <div class="sec-hdr">
        <div class="sec-title">✅ Tasks</div>
      </div>
      <div class="todo-wrap" style="max-width:720px;">
        <div class="todo-hdr"><div style="font-weight:700;font-size:.9rem;">📝 Add New Task</div></div>
        <div style="padding:10px 14px;border-bottom:1px solid var(--bdr);display:flex;flex-direction:column;gap:8px;background:var(--card2);">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <input class="todo-input" id="todoInp" placeholder="Kya karna hai? e.g. Rent collect karo…" onkeydown="if(event.keyCode===13)APP.addTodo()" style="flex:1;min-width:160px;">
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
      </div>`;
    this._wireTodoDelegates();
  },
});

/* modules/reminders.js — Reminders — openReminderModal, saveReminder, renderReminders, snooze, mark-done
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
  // ══ REMINDERS ══
  // ── Toggle reminder mode (expiry vs recurring) ──
  // Called from old references (backward compat)
  _toggleRemMode(){
    const mode=document.getElementById('rmm_mode')?document.getElementById('rmm_mode').value:'expiry';
    this._setRmmMode(mode);
  },

  _setRmmMode(mode){
    // Update hidden input
    const modeInp=document.getElementById('rmm_mode');
    if(modeInp) modeInp.value=mode;

    // Style toggle buttons
    const btnExp=document.getElementById('rmm_mode_btn_expiry');
    const btnRec=document.getElementById('rmm_mode_btn_recurring');
    if(btnExp){
      if(mode==='expiry'){
        btnExp.style.cssText='padding:9px 6px;border:2px solid #e53935;background:#fff5f5;color:#e53935;border-radius:9px;font-size:.8rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;';
        btnRec.style.cssText='padding:9px 6px;border:2px solid var(--bdr2);background:var(--card);color:var(--mut);border-radius:9px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;';
      } else {
        btnRec.style.cssText='padding:9px 6px;border:2px solid #1565c0;background:#e8eeff;color:#1565c0;border-radius:9px;font-size:.8rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;';
        btnExp.style.cssText='padding:9px 6px;border:2px solid var(--bdr2);background:var(--card);color:var(--mut);border-radius:9px;font-size:.8rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;';
      }
    }

    const ef=document.getElementById('rmm_expiry_fields');
    const rf=document.getElementById('rmm_recurring_fields');
    if(ef) ef.style.display=mode==='expiry'?'contents':'none';
    if(rf) rf.style.display=mode==='recurring'?'block':'none';
  },

  openReminderModal(id){
    if(window.REM){ window.REM.open(id||null); return; }
    // Fallback if REM not loaded
    console.warn('REM module not loaded');
  },

  _computeNextRecurTrigger(startIso,periodDays){
    const now=new Date();now.setHours(0,0,0,0);
    const start=new Date(startIso);start.setHours(0,0,0,0);
    let t=new Date(start);
    while(t<now) t.setDate(t.getDate()+periodDays);
    return t.toISOString().split('T')[0];
  },
  saveReminder(){
    const name=v('rmm_name');if(!name){alert('Title zaroori hai!');return;}
    const mode=document.getElementById('rmm_mode')?document.getElementById('rmm_mode').value:'expiry';
    let data={name,type:v('rmm_type'),person:v('rmm_person'),notes:v('rmm_notes'),mode,files:FUM.getFiles('fu_rem_doc_wrap'),doc:(FUM.getFiles('fu_rem_doc_wrap')[0]||{}).url||''};
    if(mode==='recurring'){
      const start=vDate('rmm_start');if(!start){alert('Start date zaroori hai!');return;}
      // Read period from hidden input (set by _rmmUpdatePeriod)
      const rp=document.getElementById('rmm_recur_period').value||'7';
      const nextT=this._computeNextRecurTrigger(start,parseInt(rp)||7);
      // Custom time
      const recHour=document.getElementById('rmm_rec_hour')?document.getElementById('rmm_rec_hour').value||'10':'10';
      const recMin=document.getElementById('rmm_rec_min')?document.getElementById('rmm_rec_min').value||'00':'00';
      // Day/month selections
      const selDays=this._rmmGetSelectedDays();
      const selMonths=this._rmmGetSelectedMonths();
      data={...data,start,end:vDate('rmm_end')||'',recurPeriod:rp,nextTrigger:nextT,
        alertHour:recHour,alertMin:recMin,
        daysOfWeek:selDays,monthsOfYear:selMonths};
    } else {
      // ── Reminder date = actual trigger date (NOT expiry) ──
      const trigDate = vDate('rmm_trigdate') || vDate('rmm_exp') || '';
      if(!trigDate){ alert('Reminder date zaroori hai! Kab remind karna hai?'); return; }

      const alertHour = document.getElementById('rmm_alert_hour') ? document.getElementById('rmm_alert_hour').value||'10' : '10';
      const alertMin  = document.getElementById('rmm_alert_min')  ? document.getElementById('rmm_alert_min').value||'00'  : '00';

      // ── Validate: past time check ──
      const now = new Date();
      var _sd=trigDate.split('-'); const selectedDT=_sd.length===3?new Date(parseInt(_sd[0]),parseInt(_sd[1])-1,parseInt(_sd[2]),parseInt(alertHour),parseInt(alertMin),0,0):null;
      const warn = document.getElementById('rmm_past_warn');
      if(selectedDT < now){
        if(warn) warn.style.display = 'block';
        // Only block if date is today and time is past
        const todayStr = now.toISOString().slice(0,10);
        if(trigDate === todayStr){
          alert('⚠️ Please select a future time! Abhi ka time past ho gaya hai.');
          return;
        }
        // Past date — warn but allow (for records like expired docs)
        if(warn) warn.textContent = '⚠️ Yeh date/time past mein hai. Save karein?';
      } else {
        if(warn) warn.style.display = 'none';
      }

      // expiry is optional
      const exp = vDate('rmm_exp') || '';
      data = {...data,
        trigDate,
        dueDate: trigDate,
        reminderDate: trigDate,
        alertDate: trigDate,
        exp,
        issue:   vDate('rmm_issue')||'',
        autorenew: v('rmm_autorenew')||'no',
        period:  v('rmm_period')||'365',
        alertHour,
        alertMin
      };
    }
    let rs=this.reminders;
    if(this.editId)rs=rs.map(r=>r.id===this.editId?{...r,...data}:r);
    else{data.id=uid();rs.push(data);}
    S.set('reminders',rs);
    // ── AUTO SYNC TO TO-DO LIST if category is "To Do" ──
    try {
      const remType=(data.type||'').toLowerCase();
      if(remType.includes('to do')||remType.includes('todo')){
        const todos=this.todos;
        const remId=data.id||this.editId;
        const existing=todos.find(t=>t.remId===remId);
        if(!existing){
          const newTodo={id:uid(),remId,text:data.name+(data.notes?' — '+data.notes.slice(0,40):''),done:false,created:new Date().toISOString(),fromReminder:true};
          todos.push(newTodo);
          this.saveTodos(todos);
        } else {
          // Update text if name changed
          const updated=todos.map(t=>t.remId===remId?{...t,text:data.name+(data.notes?' — '+data.notes.slice(0,40):'')}:t);
          this.saveTodos(updated);
        }
      }
    } catch(e){ console.warn('Todo sync error:',e); }
    M.close('remM');this.renderReminders();this.renderPills();
    if(this.curTab==='todo') this.renderTodo();
    // Schedule time-based alerts for new/updated reminders
    try { this._remScheduleTimeAlerts(); } catch(e){}
  },
  // ── Reminder repeat preview update ──
  _rmmUpdatePeriod(){
    try {
      const n=parseInt(document.getElementById('rmm_custom_n').value)||1;
      const unit=document.getElementById('rmm_custom_unit').value||'days';
      // Store encoded value in hidden field
      const encoded=n+'_'+unit;
      const hidden=document.getElementById('rmm_recur_period');
      if(hidden) hidden.value=encoded;
      // Update preview
      const prev=document.getElementById('rmm_repeat_preview');
      if(prev) prev.textContent='🔄 Repeats every '+n+' '+unit;
    } catch(e){}
  },

  _rmmApplyPreset(val){
    if(!val) return;
    const parts=val.split('_');
    const n=parts[0];
    const unit=parts.slice(1).join('_');
    const nEl=document.getElementById('rmm_custom_n');
    const uEl=document.getElementById('rmm_custom_unit');
    if(nEl) nEl.value=n;
    if(uEl) uEl.value=unit;
    this._rmmUpdatePeriod();
    // Reset preset selector
    const sel=document.getElementById('rmm_recur_preset');
    if(sel) sel.value='';
  },

  _rmmToggleDay(btn){
    const active=btn.style.background.includes('1565c0')||btn.getAttribute('data-active')==='1';
    if(active){
      btn.style.background='var(--card)';
      btn.style.color='var(--txt)';
      btn.style.borderColor='var(--bdr2)';
      btn.setAttribute('data-active','0');
    } else {
      btn.style.background='#1565c0';
      btn.style.color='#fff';
      btn.style.borderColor='#1565c0';
      btn.setAttribute('data-active','1');
    }
  },

  _rmmToggleMon(btn){
    const active=btn.getAttribute('data-active')==='1';
    if(active){
      btn.style.background='var(--card)';
      btn.style.color='var(--txt)';
      btn.style.borderColor='var(--bdr2)';
      btn.setAttribute('data-active','0');
    } else {
      btn.style.background='#7c3aed';
      btn.style.color='#fff';
      btn.style.borderColor='#7c3aed';
      btn.setAttribute('data-active','1');
    }
  },

  _rmmGetSelectedDays(){
    const btns=document.querySelectorAll('#rmm_dow_wrap button[data-active="1"]');
    return Array.from(btns).map(b=>parseInt(b.getAttribute('data-day')));
  },

  _rmmGetSelectedMonths(){
    const btns=document.querySelectorAll('#rmm_month_wrap button[data-active="1"]');
    return Array.from(btns).map(b=>parseInt(b.getAttribute('data-mon')));
  },

  // ── Quick reminder: after X min/hr/days ──
  _rmmApplyQuick(val){
    if(!val) return;
    const now = new Date();
    let target = new Date(now);

    if(val.endsWith('m'))      target.setMinutes(target.getMinutes()+parseInt(val));
    else if(val.endsWith('h')) target.setHours(target.getHours()+parseInt(val));
    else if(val.endsWith('d')) target.setDate(target.getDate()+parseInt(val));

    const dateStr = target.toISOString().slice(0,10);
    const hh = String(target.getHours()).padStart(2,'0');
    const mm = String(target.getMinutes()).padStart(2,'0');

    // Set date
    const tw = document.getElementById('rmm_trigdate_wrap');
    if(tw) tw.innerHTML = makeDateInput('rmm_trigdate', dateStr);

    // Set time
    const hourEl = document.getElementById('rmm_alert_hour');
    const minEl  = document.getElementById('rmm_alert_min');
    if(hourEl) hourEl.value = hh;
    if(minEl){
      // Find closest minute option
      const mNum = parseInt(mm);
      const opts = Array.from(minEl.options).map(o=>parseInt(o.value));
      const closest = opts.reduce((a,b)=>Math.abs(b-mNum)<Math.abs(a-mNum)?b:a,opts[0]);
      minEl.value = String(closest).padStart(2,'0');
    }

    // Reset quick select
    const sel = document.getElementById('rmm_quick_after');
    if(sel) sel.value = '';

    this._rmmUpdateTimePreview();
    this.showToastMsg('⏰ Reminder set: '+target.toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}));
  },

  // ── Live time preview + past validation ──
  _rmmUpdateTimePreview(){
    try {
      const dateEl = document.querySelector('#rmm_trigdate_wrap input');
      const hourEl = document.getElementById('rmm_alert_hour');
      const minEl  = document.getElementById('rmm_alert_min');
      const prev   = document.getElementById('rmm_time_preview');
      const warn   = document.getElementById('rmm_past_warn');
      if(!dateEl||!hourEl||!minEl) return;

      const dateStr = dateEl.value;
      const hh = hourEl.value||'10';
      const mm = minEl.value||'00';
      if(!dateStr){ if(prev) prev.textContent=''; return; }

      const dt = (function(){var _p=dateStr.split('-');return _p.length===3?new Date(parseInt(_p[0]),parseInt(_p[1])-1,parseInt(_p[2]),parseInt(hh),parseInt(mm),0,0):null;})();
      const now = new Date();
      const isPast = dt < now;

      if(prev){
        prev.textContent = dt.toLocaleString('en-IN',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
        prev.style.background = isPast ? '#fff0f0' : '#eff6ff';
        prev.style.color = isPast ? '#e53935' : 'var(--acc)';
      }
      if(warn){
        if(isPast && dateStr===now.toISOString().slice(0,10)){
          warn.style.display='block';
          warn.textContent='⚠️ Please select a future time!';
        } else if(isPast){
          warn.style.display='block';
          warn.textContent='⚠️ This date is in the past.';
        } else {
          warn.style.display='none';
        }
      }
    } catch(e){}
  },

  _rmmAddCat(){
    const name=prompt('Naya category naam daalo:\n(e.g. 🏥 Health, 🏠 Property, 💼 Work)','');
    if(!name||!name.trim()) return;
    const sel=document.getElementById('rmm_type');
    if(!sel) return;
    const opt=document.createElement('option');
    opt.value=name.trim(); opt.text=name.trim(); opt.selected=true;
    // Insert before last option
    sel.insertBefore(opt, sel.lastElementChild);
    sel.value=name.trim();
    this._rmmSyncTodoHint(name.trim());
    this.showToastMsg('✅ Category "'+name.trim()+'" added!');
  },

  _rmmSyncTodoHint(val){
    const hint=document.getElementById('rmm_todo_hint');
    if(!hint) return;
    const isTodo=(val||'').toLowerCase().includes('to do')||(val||'').toLowerCase().includes('todo');
    hint.style.display=isTodo?'block':'none';
  },

  delReminder(id){
    this.delCb=()=>{S.set('reminders',this.reminders.filter(r=>r.id!==id));this.renderReminders();this.renderPills();};
    document.getElementById('delMsg').textContent='Delete this reminder?';M.open('delM');
  },

  // ══ DONE-IDS STORE — works for ALL types: reminder / med_xxx / rent_xxx ══
  _getDoneIds(){ try{ return new Set(JSON.parse(localStorage.getItem('rk_done_ids'))||[]); }catch{ return new Set(); } },
  _saveDoneIds(s){
    const arr=[...s];
    localStorage.setItem('rk_done_ids', JSON.stringify(arr));
    // Sync to Firebase so done-state is preserved across devices
    if(window.fbSave) window.fbSave('done_ids', arr).catch(()=>{});
  },
  _isIdDone(id){ return this._getDoneIds().has(id); },

  // ══ MARK DONE — works for ALL reminder types ══
  markReminderDone(id){
    if(!id) return;
    const doneIds = this._getDoneIds();
    const wasDone = doneIds.has(id);
    // Toggle
    if(wasDone){ doneIds.delete(id); } else { doneIds.add(id); }
    this._saveDoneIds(doneIds);
    // Also sync completed flag on regular reminder objects
    const r = this.reminders.find(x=>x.id===id);
    if(r){ r.completed = !wasDone; r.completedAt = r.completed ? new Date().toISOString() : null; S.set('reminders', this.reminders); }
    // Re-render everything
    this.renderReminders();
    this.renderPills();
    if(this.curTab==='home') this.renderHome();
    this.showToastMsg(!wasDone ? '✅ Done! Moved to Completed.' : '↩️ Restored to active.');
  },

  // ══ SHOW COMPLETED POPUP ══
  showCompletedPopup(){
    const doneIds = this._getDoneIds();
    if(doneIds.size===0){ this.showToastMsg('No completed reminders yet.'); return; }
    // Build list of completed entries
    const fD2=iso=>{
      if(!iso) return '—';
      // Handle full ISO datetime (completedAt) — extract just the date part
      const datePart = iso.includes('T') ? iso.split('T')[0] : iso;
      const p=datePart.split('-');
      if(p.length!==3) return iso;
      return p[2]+'/'+p[1]+'/'+p[0].slice(2);
    };
    const rows=[];
    // Regular reminders
    this.reminders.filter(r=>doneIds.has(r.id)).forEach(r=>{
      const icon={'🛂 Passport':'🛂','🚗 Driving Licence':'🚗','🛡️ Insurance':'🛡️','📋 Rent Agreement':'📋','📊 Tax Filing':'📊','💳 Loan/EMI':'💳','💻 Laptop/Device':'💻','🔁 Subscription':'🔁','📔 Visa':'📔','🚘 Vehicle RC':'🚘','🪪 PAN Card':'🪪','🪪 Aadhaar':'🪪','📌 Other':'📌','🏥 Medical':'🏥','💰 Rent':'💰'}[r.type]||'📌';
      rows.push({id:r.id,icon,name:r.name,type:r.type||'Other',date:r.exp||r.trigDate||'',completedAt:r.completedAt||''});
    });
    // Medical entries
    this.visits.filter(v=>doneIds.has('med_'+v.id)).forEach(v=>{
      const pat=this.patients.find(p=>p.id===v.patId);
      rows.push({id:'med_'+v.id,icon:'🏥',name:(pat?pat.name+' — ':'')+( v.doctor?'Dr.'+v.doctor+' Follow-up':'Medical Follow-up'),type:'Medical',date:v.next||'',completedAt:''});
    });
    // Rent entries
    this.tenants.filter(t=>doneIds.has('rent_'+t.id)).forEach(t=>{
      rows.push({id:'rent_'+t.id,icon:'💰',name:'Rent — '+t.name,type:'Rent',date:'',completedAt:''});
    });
    if(!rows.length){ this.showToastMsg('No completed reminders yet.'); return; }

    const buildRows = ()=> rows.map(r=>`
      <div style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:#f4fdf8;border:1.5px solid #a8dfc0;border-radius:10px;margin-bottom:8px;">
        <div style="width:38px;height:38px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">${r.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1a1d23;">${r.name}</div>
          <div style="font-size:.67rem;color:#6c757d;margin-top:2px;display:flex;gap:8px;flex-wrap:wrap;">
            <span>${r.type}</span>
            ${r.date?`<span>📅 Due: ${fD2(r.date)}</span>`:''}
            ${r.completedAt?`<span style="color:#1a7a45;font-weight:700;">✅ Done: ${fD2(r.completedAt)}</span>`:''}
          </div>
        </div>
        <button onclick="APP.markReminderDone('${r.id}');APP._refreshDonePopup();" 
          style="background:#fff0f0;color:#c0392b;border:1.5px solid #f09090;border-radius:7px;padding:5px 11px;font-size:.72rem;cursor:pointer;font-weight:700;white-space:nowrap;font-family:'Nunito',sans-serif;flex-shrink:0;">↩️ Restore</button>
      </div>`).join('');

    // Remove old popup if exists, always rebuild fresh
    const old = document.getElementById('_donePopup');
    if(old) old.remove();

    const modal = document.createElement('div');
    modal.id = '_donePopup';
    // Desktop-friendly: centered modal (not bottom sheet)
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;width:100%;max-width:540px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,.25);overflow:hidden;">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1.5px solid #e9ecef;flex-shrink:0;">
          <div>
            <div style="font-weight:800;font-size:1.05rem;color:#1a1d23;">✅ Completed Reminders</div>
            <div style="font-size:.72rem;color:#6c757d;margin-top:2px;">${rows.length} item${rows.length>1?'s':''} marked done</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="_donePopupClearAll"
              onclick="APP._clearAllCompleted()"
              style="background:#fff0f0;color:#c0392b;border:1.5px solid #fecaca;border-radius:8px;padding:6px 13px;font-size:.76rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">
              🗑 Clear All
            </button>
            <button onclick="document.getElementById('_donePopup').remove()"
              style="background:#f0f2f5;border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6c757d;">✕</button>
          </div>
        </div>
        <!-- Scrollable body -->
        <div id="_donePopupBody" style="overflow-y:auto;padding:14px 16px;flex:1;">
          ${buildRows()}
        </div>
        <!-- Footer hint -->
        <div style="padding:10px 16px;border-top:1px solid #e9ecef;background:#f8f9fa;font-size:.72rem;color:#6c757d;text-align:center;flex-shrink:0;">
          Tap ↩️ Restore to move back to active reminders
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  },

  // Refresh completed popup in place (after restore)
  _refreshDonePopup(){
    const doneIds = this._getDoneIds();
    if(doneIds.size===0){
      const m = document.getElementById('_donePopup');
      if(m) m.remove();
      this.showToastMsg('All reminders restored!');
      return;
    }
    this.showCompletedPopup();
    this.renderReminders();
    this.renderPills();
  },

  // Clear all completed reminders
  _clearAllCompleted(){
    if(!confirm('Saari completed reminders clear karein?\n(Ye permanently done-list se hataega, reminder data delete nahi hoga)')) return;
    const doneIds = this._getDoneIds();
    // Remove completed flag from reminder objects
    const updated = this.reminders.map(r=>{
      if(doneIds.has(r.id)) return {...r, completed:false, completedAt:null};
      return r;
    });
    S.set('reminders', updated);
    this._saveDoneIds(new Set());
    const m = document.getElementById('_donePopup');
    if(m) m.remove();
    this.renderReminders();
    this.renderPills();
    this.showToastMsg('✅ Completed list cleared!');
  },

  markAsRenewed(id){
    const r=this.reminders.find(x=>x.id===id);if(!r)return;
    if(r.mode==='recurring'){
      // For recurring: advance nextTrigger by period
      const rp=r.recurPeriod||'7';
      if(rp.startsWith('minutes_')||rp.startsWith('hours_')){
        this.showToastMsg('✅ Recurring reminder — triggers automatically');
        return;
      }
      const pd=parseInt(rp)||7;
      const base=r.nextTrigger?new Date(r.nextTrigger):new Date();
      base.setHours(0,0,0,0);
      base.setDate(base.getDate()+pd);
      const nextT=base.toISOString().split('T')[0];
      let rs=this.reminders;
      rs=rs.map(x=>x.id===id?{...x,nextTrigger:nextT}:x);
      S.set('reminders',rs);
      this.showToastMsg(`✅ ${r.name} — Next reminder: ${fD(nextT)}`);
      this.renderReminders();this.renderPills();
      return;
    }
    // Expiry-based: update both due date and reminder date together
    const inp=prompt(`✅ ${r.name}\n\nNayi date daalo (DD/MM/YYYY):\n\nExample: 19/03/2027`,'');
    if(!inp) return;
    const isoExp=dmyToIso(inp.trim());
    if(!isoExp){alert('Date format galat hai! DD/MM/YYYY mein likhein.');return;}
    let rs=this.reminders;
    rs=rs.map(x=>x.id===id?{
      ...x,
      exp:isoExp,
      dueDate:isoExp,
      trigDate:isoExp,
      reminderDate:isoExp,
      alertDate:isoExp,
      start:isoExp,
      issue:(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})()
    }:x);
    S.set('reminders',rs);
    this.showToastMsg(`✅ ${r.name} — Updated! Reminder on: ${fD(isoExp)}`);
    this.renderReminders();this.renderPills();
  },

  renderReminders(){
    // ══════════════════════════════════════════════════════
    // REMINDER ENGINE — All calculations based on the saved reminder date
    // Status based ONLY on: today vs reminder date
    // ══════════════════════════════════════════════════════
    const now=new Date();now.setHours(0,0,0,0);

    const blLabel={'1':'1 Day','3':'3 Days','7':'1 Week','15':'15 Days','30':'1 Month',
      '60':'2 Months','90':'3 Months','180':'6 Months','365':'1 Year'};
    const prdLabel={'1':'Daily','7':'Weekly','15':'Every 15 Days','30':'Monthly',
      '90':'Quarterly','180':'Half-Yearly','365':'Yearly',
      'minutes_5':'Every 5 Min','minutes_15':'Every 15 Min','hours_1':'1 Hr','hours_6':'6 Hrs'};
    const typeIcon={
      '📌 To Do':'📌','🎂 Birthday':'🎂','💍 Anniversary':'💍','💳 Bills/Payment':'💳',
      '📞 Call/Follow-up':'📞','🛂 Passport':'🛂','🚗 Driving Licence':'🚗','🛡️ Insurance':'🛡️',
      '📋 Rent Agreement':'📋','📊 Tax Filing':'📊','💳 Loan/EMI':'💳','💻 Laptop/Device':'💻',
      '🔁 Subscription':'🔁','📔 Visa':'📔','🚘 Vehicle RC':'🚘','🪪 PAN Card':'🪪',
      '🪪 Aadhaar':'🪪','📌 Other':'📌',
      'Passport':'🛂','Driving Licence':'🚗','Insurance':'🛡️','Rent Agreement':'📋',
      'Tax Filing':'📊','Loan/EMI':'💳','Laptop/Device':'💻','Subscription':'🔁',
      'Visa':'📔','Vehicle RC':'🚘','PAN Card':'🪪','Aadhaar':'🪪','Other':'📌'
    };

    // ── CORE: Get reminder date for any reminder type ──
    function getTrig(r){
      if(!r) return null;
      if(r.mode==='recurring') return r.nextTrigger||r.start||r.reminderDate||r.alertDate||r.trigDate||null;
      return r.reminderDate||r.alertDate||r.trigDate||r.dueDate||r.exp||null;
    }

    // ── Days from today to a date (negative = past) ──
    function dFromNow(iso){
      if(!iso||typeof iso!=='string') return null;
      // ✅ Manual parse — no UTC midnight bug
      var dp=iso.split('-');
      if(dp.length!==3) return null;
      var y=parseInt(dp[0]),m=parseInt(dp[1])-1,d=parseInt(dp[2]);
      if(isNaN(y)||isNaN(m)||isNaN(d)) return null;
      var dt=new Date(y,m,d,0,0,0,0);
      if(isNaN(dt.getTime())) return null;
      var diff=Math.round((dt.getTime()-now.getTime())/86400000);
      if(isNaN(diff)) return null;
      return diff;
    }

    // ── Status badge — ONLY based on trigger date ──
    // statusBadge: based on dDue (days to due date)
    function statusBadge(dDue, completed){
      if(completed) return '<span class="badge bg" style="background:#dcfce7;color:#166534;border-color:#90c8a0;">✅ Completed</span>';
      if(dDue===null||dDue===undefined) return '<span class="badge bg" style="background:#e8f5e9;color:#1e7a45;">📅 Upcoming</span>';
      var n=Math.abs(dDue);
      if(dDue<0)  return '<span class="badge br" style="background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;">🔴 Overdue '+n+' day'+(n>1?'s':'')+'</span>';
      if(dDue===0)return '<span class="badge" style="background:#fef9c3;color:#854d0e;border:1.5px solid #fde68a;font-weight:800;">🔔 Due Today</span>';
      if(dDue<=7) return '<span class="badge by" style="background:#fef9c3;color:#854d0e;border:1.5px solid #fde68a;">⏰ Due in '+dDue+' day'+(dDue>1?'s':'')+'</span>';
      if(dDue<=30)return '<span class="badge" style="background:#dcfce7;color:#166534;border:1.5px solid #90c8a0;">🟢 Due in '+dDue+' days</span>';
      return '<span class="badge bg" style="background:#e8f5e9;color:#1e7a45;">🟢 Due in '+dDue+' days</span>';
    }

    // borderColor: based on dDue
    function borderColor(dDue){
      if(dDue===null||dDue===undefined) return 'var(--bdr)';
      if(dDue<0)   return '#e05050';
      if(dDue===0) return '#e09050';
      if(dDue<=7)  return '#d4b840';
      return 'var(--bdr)';
    }

    // ── Compute all categorized entries ──
    // UNIFIED: user reminders + medical follow-ups + rent due
    const allEntries=[];
    const _doneIds=this._getDoneIds(); // load done-ids once

    // User-defined reminders (exclude rent auto & loan auto — shown in their own sections)
    this.reminders.filter(r=>!r._isAutoRent && !r._isAutoLoan && r.mode!=='rent').forEach(r=>{
      const trig=getTrig(r);
      const dTrig=dFromNow(trig);
      const dExp=(r.mode!=='recurring'&&r.exp)?dFromNow(r.exp):null;
      const completed=_doneIds.has(r.id)||!!r.completed;
      var _rDue  = r.dueDate||r.trigDate||trig;
      var _rRem  = r.reminderDate||r.alertDate||trig;
      allEntries.push({...r,
        _trig:_rRem, _dTrig:dFromNow(_rRem),
        _dDue:dFromNow(_rDue), _dueDate:_rDue, _remDate:_rRem,
        _dExp:dExp,_src:'reminder',_category:'Other',completed});
    });

    // ── AUTO ADD: Medical follow-ups → allEntries ──
    this.visits.forEach(v=>{
      const ni=(v.next&&v.next.includes('-'))?v.next:(v.next?dmyToIso(v.next)||null:null);
      if(!ni) return;
      const dTrig=this._dFromNow(ni);
      const pat=this.patients.find(p=>p.id===v.patId);
      const medId='med_'+v.id;
      allEntries.push({
        id:medId,
        name:(pat?pat.name+' — ':'')+( v.doctor?'Dr.'+v.doctor+' Follow-up':'Medical Follow-up'),
        type:'🏥 Medical',
        _trig:ni,_dTrig:dTrig,_dExp:null,_src:'medical',_category:'Medical',
        mode:'expiry',
        person:pat?pat.name:'',
        notes:v.purpose||v.meds||'',
        completed:_doneIds.has(medId)
      });
    });

    // ── AUTO ADD: Rent due → allEntries (Unified!) ──
    const rentCards=[];
    this.tenants.filter(t=>t.status==='active').forEach(t=>{
      const prop=this.props.find(p=>p.id===t.propId);
      const ledger=this.getTenantLedger(t);
      if(ledger.totalBalance<=0) return;
      const hasOverdueMonth=ledger.months.some(mo=>mo.status==='overdue');
      if(!hasOverdueMonth) return;
      const overdueMonths=ledger.months.filter(mo=>mo.status==='overdue');
      const daysOv=overdueMonths.length>0?Math.max(...overdueMonths.map(mo=>mo.daysOverdue||0)):0;
      // Add to allEntries for unified counting
      const rentId='rent_'+t.id;
      const rentDone=_doneIds.has(rentId);
      allEntries.push({
        id:rentId,
        name:'RENT OVERDUE — '+t.name,
        type:'💰 Rent',
        _trig:null,_dTrig:-daysOv,_dExp:null,_src:'rent',_category:'Rent',
        mode:'rent',_isAutoRent:true,
        _tenantId:t.id,_daysOv:daysOv,
        _balanceAmt:ledger.totalBalance,
        _receivedAmt:0,_invoiceAmt:ledger.totalBalance,
        _propName:prop?prop.name:'—',
        _tenantObj:t,
        completed:rentDone
      });
      if(rentDone) return; // hide from active list if marked done
      // Render card separately too
      const waMsg=encodeURIComponent('💰 *Rent Due*\nTenant: '+t.name+'\nDue: '+fmt(ledger.totalBalance)+'\n\nPlease pay.\nRaman Kumar');
      rentCards.push(`<div style="background:var(--card);border:2px solid #e05050;border-left:4px solid #e05050;border-radius:11px;padding:13px 14px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:50%;background:rgba(224,80,80,.1);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">💰</div>
          <div style="flex:1;">
            <div style="font-weight:800;font-size:.9rem;">RENT OVERDUE — ${t.name}
              <span style="font-size:.6rem;background:#e05050;color:#fff;padding:1px 6px;border-radius:8px;margin-left:4px;">Rent</span>
              <span style="font-size:.6rem;background:#e05050;color:#fff;padding:1px 6px;border-radius:8px;">AUTO</span>
            </div>
            <div style="font-size:.73rem;color:var(--mut);margin-top:2px;">${prop?prop.name:'—'} · ${daysOv} days overdue · Due: ${fmt(ledger.totalBalance)}</div>
          </div>
          <span style="font-size:.7rem;background:#fff0f0;color:#e05050;border:1px solid #f09090;padding:2px 8px;border-radius:8px;white-space:nowrap;">${daysOv}d</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;border-top:1px solid var(--bdr);padding-top:8px;">
          <button class="btn b-grn b-sm" onclick="APP.openPayModal('${t.id}')">+ Payment</button>
          ${t.ph?`<button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1px solid #90c8a0;" onclick="APP.sendWhatsApp('${t.name}','${fmt(ledger.totalBalance)}','${t.ph}','rent')">📲 WA</button>`:`<button class="btn b-sm" style="background:#f0f2f5;color:#adb5bd;border:1px solid #e9ecef;cursor:not-allowed;" disabled title="Add phone">📵</button>`}
          ${t.email?`<a class="btn b-sm" style="background:#fff0f0;color:#c0392b;border:1px solid #fecaca;text-decoration:none;" href="mailto:${t.email}?subject=${encodeURIComponent('Rent Due — '+t.name)}&body=${encodeURIComponent('Hello '+t.name+',\n\nYour rent of '+fmt(ledger.totalBalance)+' is pending.\n\nThank you,\nRaman Kumar')}">📧 Email</a>`:`<button class="btn b-sm" style="background:#f0f2f5;color:#adb5bd;border:1px solid #e9ecef;cursor:not-allowed;" disabled>📧</button>`}
          <button class="btn b-sm" style="background:#e3f2fd;color:#1760a0;border:1px solid #90b8e8;" onclick="APP.goTab('rent')">📒 Ledger</button>
          <button class="btn b-sm mark-done-btn" style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;font-weight:800;" onclick="APP.markReminderDone('${rentId}')">✅ Mark Done</button>
        </div>
      </div>`);
    });

    // ── Use shared engine — same data as Dashboard ──
    const remState=this._calcRemindersState();
    const catOverdue=remState.overdue;
    const catToday=remState.today;
    const catThisWeek=remState.thisWeek;
    const catThisMonth=remState.thisMonth;
    const catUpcoming=remState.upcoming;
    const catSafe=remState.safe;

    // ── UNIFIED counts (all types: reminders + medical + rent) ──
    const medEntries   = allEntries.filter(e=>e._src==='medical');
    const rentEntries  = allEntries.filter(e=>e._src==='rent');
    const otherEntries = allEntries.filter(e=>e._src==='reminder');
    // Overdue/Due count = catOverdue + catToday + rent overdue
    const due1w   = allEntries.filter(e=>e._dTrig!==null && e._dTrig>=0 && e._dTrig<=7 && e._src!=='rent').length;
    const due30d  = allEntries.filter(e=>e._dTrig!==null && e._dTrig>7 && e._dTrig<=30 && e._src!=='rent').length;
    const laterCnt= allEntries.filter(e=>e._dTrig!==null && e._dTrig>30 && e._src!=='rent').length;
    const totalAll = allEntries.length;
    const urgCnt   = catOverdue.length + catToday.length + rentCards.length;

    // ── COMPACT GRID CARD ──
    function buildCard(e){
      const isRecurring=e.mode==='recurring';
      const isMedical=e._src==='medical';
      const isRentAuto=e._src==='rent';
      const isLoanAuto=e.mode==='loan'&&e._isAutoLoan;
      const icon=isRentAuto?'💰':isLoanAuto?'🤝':isMedical?'🏥':(typeIcon[e.type]||'📌');

      // Type label badge
      const typeLabel=isRentAuto?'<span style="font-size:.55rem;background:#e05050;color:#fff;padding:1px 5px;border-radius:5px;font-weight:700;margin-left:4px;">Rent</span>':
                      isMedical?'<span style="font-size:.55rem;background:#1e7a45;color:#fff;padding:1px 5px;border-radius:5px;font-weight:700;margin-left:4px;">Medical</span>':
                      '<span style="font-size:.55rem;background:#2c6fad;color:#fff;padding:1px 5px;border-radius:5px;font-weight:700;margin-left:4px;">Other</span>';

      const dTrig=e._dTrig;
      const dExp=isRentAuto?null:e._dExp;

      // Rent-specific status and badge
      let bc,badge;
      if(isRentAuto){
        const dO=e._daysOv||0;
        const bal=e._balanceAmt||0;
        if(dO>0){bc='#e05050';badge=`<span class="badge br">🔴 ${dO}d Overdue</span>`;}
        else if((e._dTrig||0)===0){bc='#e09050';badge=`<span class="badge by">📋 Due Today</span>`;}
        else if((e._dTrig||0)>0){bc='var(--bdr)';badge=`<span class="badge ba">⏳ Upcoming</span>`;}
        else{bc='#e05050';badge=`<span class="badge br">🔴 Rent Pending</span>`;}
      } else if(isLoanAuto){
        const dI=e._dTrig||0;
        const outstanding=e._outstanding||0;
        if(outstanding<=0){bc='#90c8a0';badge=`<span class="badge bg">✅ Received</span>`;}
        else if(dI>0){bc='#e8a060';badge=`<span class="badge by">🤝 Due in ${dI}d</span>`;}
        else if(dI===0){bc='#e09050';badge=`<span class="badge by">🤝 Due Today</span>`;}
        else{bc='#e05050';badge=`<span class="badge br">⚠️ Overdue ${Math.abs(dI)}d</span>`;}
      } else {
        var _eDue=(e._dDue!==undefined&&e._dDue!==null)?e._dDue:e._dTrig;
        bc=e.completed?'#90c8a0':borderColor(_eDue);
        badge=statusBadge(_eDue, e.completed);
      }

      // Recurring: next 3 occurrences
      let nextOcc='';
      if(isRecurring&&e.nextTrigger){
        const rp=e.recurPeriod||'7';
        if(!rp.startsWith('minutes_')&&!rp.startsWith('hours_')){
          const pd=parseInt(rp)||7;
          let t=new Date(e.nextTrigger);t.setHours(0,0,0,0);
          while(Math.ceil((t-now)/86400000)<0) t.setDate(t.getDate()+pd);
          const pts=[];
          for(let i=0;i<3;i++){
            const dd=Math.ceil((t-now)/86400000);
            pts.push(`<span style="background:var(--dim);border-radius:4px;padding:1px 5px;font-size:.6rem;">${fD(t.toISOString().split('T')[0])} (${dd}d)</span>`);
            t=new Date(t);t.setDate(t.getDate()+pd);
          }
          nextOcc=`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px;">Next: ${pts.join('')}</div>`;
        }
      }

      // Detail section (hidden by default, toggled on click)
      const detailId='rdet_'+e.id.replace(/[^a-z0-9]/gi,'_');
      const detailHtml=`
        <div id="${detailId}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--bdr);font-size:.73rem;color:var(--mut);">
          ${e.person?`<div>👤 <b>${e.person}</b></div>`:''}
          ${!isRecurring&&!isRentAuto&&!isLoanAuto&&e.exp?(function(){
            var _dE=e._dExp;
            var _ok=(_dE!==null&&_dE!==undefined&&!isNaN(_dE));
            var _col=_ok&&_dE<=30?'var(--red)':'var(--txt)';
            var _lbl=_ok?(_dE>=0?'('+_dE+'d left)':'('+Math.abs(_dE)+'d ago)'):'';
            return '<div>📆 Expiry: <b style="color:'+_col+'">'+fD(e.exp)+'</b> '+_lbl+'</div>';
          })():''}
          ${isRentAuto?`<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:.72rem;">
            <span style="color:var(--mut)">💰 Monthly Rent</span><span><b>${fmt(e._invoiceAmt||0)}</b></span>
            ${e._receivedAmt>0?`<span style="color:var(--mut)">✅ Received</span><span style="color:var(--grn)"><b>${fmt(e._receivedAmt)}</b></span>`:''}
            <span style="color:var(--mut)">⚡ Outstanding</span><span style="color:var(--red);font-weight:700">${fmt(e._balanceAmt||0)}</span>
            ${e._daysOv>0?`<span style="color:var(--mut)">⏰ Overdue</span><span style="color:var(--red);font-weight:700">${e._daysOv} days</span>`:''}
          </div>`:''}
          ${isLoanAuto?`<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:.72rem;">
            <span style="color:var(--mut)">🤝 Borrower</span><span><b>${e.person||'—'}</b></span>
            <span style="color:var(--mut)">⚡ Outstanding</span><span style="color:var(--red);font-weight:700">${fmt(e._outstanding||0)}</span>
            ${e._trigDate?`<span style="color:var(--mut)">📅 Due Date</span><span>${fD(e._trigDate)}</span>`:''}
          </div>`:''}
          ${isRecurring?`<div>🔁 ${prdLabel[e.recurPeriod]||e.recurPeriod}</div>`:''}
          ${!isRecurring&&!isRentAuto&&!isLoanAuto&&!isMedical?(function(){
            var _due=e._dueDate||e.dueDate||e.trigDate||'';
            var _rem=e._remDate||e.reminderDate||'';
            var _dDue=e._dDue;
            var _sc=(_dDue===null||_dDue===undefined)?'var(--mut)':(_dDue<0?'#e05050':_dDue===0?'#e09050':'#1a7a45');
            var _sl=(_dDue===null||_dDue===undefined)?'':(_dDue<0?'('+Math.abs(_dDue)+'d overdue)':_dDue===0?'(today!)':'('+_dDue+'d away)');
            var _h='';
            _h+='<div style="display:flex;align-items:center;gap:8px;margin-top:4px;padding:4px 0;border-bottom:1px solid var(--bdr);">';
            _h+='<span style="font-size:.62rem;color:var(--mut);min-width:76px;">Due Date</span>';
            _h+='<span style="font-weight:800;color:var(--txt);font-size:.78rem;">'+(_due?fD(_due):'—')+'</span>';
            _h+='<span style="font-size:.62rem;font-weight:700;color:'+_sc+';">'+_sl+'</span></div>';
            var _sameDay=!_due||!_rem||_due===_rem;
            if(_sameDay){
              _h+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0;"><span style="font-size:.62rem;color:var(--mut);min-width:76px;">🔔 Reminder</span><span style="color:#6c757d;font-size:.75rem;">Same day as due date</span></div>';
            } else if(_rem){
              _h+='<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">';
              _h+='<span style="font-size:.62rem;color:var(--mut);min-width:76px;">🔔 Reminder</span>';
              _h+='<span style="font-weight:800;color:#1565c0;font-size:.78rem;">'+fD(_rem)+'</span>';
              _h+='</div>';
            }
            return _h;
          })():''}
          ${e.notes?`<div>📝 ${APP.autoLink(e.notes)}</div>`:''}
          ${(e.alertHour||e.alertMin)?`<div style="font-size:.72rem;color:#1565c0;margin-top:2px;">🔔 Reminder at ${APP._fmt12hr(e.alertHour||'10',e.alertMin||'00')}</div>`:''}
          ${(e.daysOfWeek&&e.daysOfWeek.length)?`<div style="font-size:.7rem;color:var(--mut);margin-top:2px;">📆 On: ${e.daysOfWeek.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</div>`:''}
          ${(e.monthsOfYear&&e.monthsOfYear.length)?`<div style="font-size:.7rem;color:var(--mut);margin-top:1px;">📅 In: ${e.monthsOfYear.map(m=>['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]).join(', ')}</div>`:''}
          ${nextOcc}
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
            <button class="btn b-sm mark-done-btn" onclick="event.stopPropagation();APP.markReminderDone('${e.id}')" style="${e.completed?'background:#dcfce7;color:#166534;border:1.5px solid #90c8a0;font-weight:800;':'background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;font-weight:800;'}">
              ${e.completed?'↩️ Undo Done':'✅ Mark Done'}
            </button>
            ${!e.completed&&!isRentAuto&&!isLoanAuto?`<button class="btn b-sm" onclick="event.stopPropagation();APP.openSnooze('${e.id}')" style="background:#fff8ee;color:#b06000;border:1.5px solid #e0a040;font-weight:700;">⏰ Snooze</button>`:''}
            <button class="btn b-sm" onclick="event.stopPropagation();APP._remPlayTestSound()" title="Test sound" style="background:#f0f4ff;color:#2c6fad;border:1px solid #bfdbfe;font-weight:700;">🔔</button>
            ${isRentAuto?`
              <button class="btn b-grn b-sm" onclick="APP.openPayModal('${e._tenantId||''}')">💰 Pay Now</button>
              <button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1px solid #90c8a0;" onclick="APP.goTab('rent')">📒 Ledger</button>
            `:''}
            ${isLoanAuto?`<button class="btn b-out b-sm" onclick="APP.goTab('expense')">📒 View</button>`:''}
            ${!isRecurring&&!isMedical&&!isRentAuto&&!isLoanAuto?`<button class="btn b-grn b-sm" onclick="APP.markAsRenewed('${e.id}')">✅ Renew</button>`:isRentAuto?'':''}
            ${!isMedical&&!isRentAuto?`<button class="btn b-out b-sm" onclick="APP.openReminderModal('${e.id}')">✏️ Edit</button>`:''}
            ${!isMedical&&!isRentAuto?`<button class="btn b-red b-sm" onclick="APP.delReminder('${e.id}')">🗑</button>`:''}
            ${isMedical?`<button class="btn b-blu b-sm" onclick="APP.goTab('medical')">🏥 View</button>`:''}
          </div>
        </div>`;

      // Add completed class and badge if marked as done
      const completedClass = e.completed ? ' rem-completed' : '';
      const completedBadge = e.completed ? `<span class="rem-completed-badge" style="margin-left:4px;">✓ Done</span>` : '';

      return`<div class="${completedClass}" style="background:var(--card);border:1.5px solid ${bc};border-left:4px solid ${bc};border-radius:11px;padding:12px 13px;cursor:pointer;" onclick="(function(el){el.style.display=el.style.display==='none'?'block':'none';})(document.getElementById('${detailId}'))">
        <div style="display:flex;align-items:center;gap:9px;">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--dim);display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex-shrink:0;">${icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${toTitleCase(e.name)}${typeLabel}${completedBadge}${e.snoozedUntil?`<span style="font-size:.55rem;background:#fff8ee;color:#b06000;border:1px solid #e0a040;padding:1px 5px;border-radius:5px;margin-left:4px;font-weight:700;">⏰ Snoozed</span>`:''}</div>
            <div style="font-size:.68rem;color:var(--mut);">
              ${e.type||'—'} ${isRecurring?'· 🔁 '+(prdLabel[e.recurPeriod]||'Recurring'):''}
            </div>
            ${!isRentAuto&&!isRecurring?(function(){
              var _due = e._dueDate||e.dueDate||e.trigDate||'';
              var _rem = e._remDate||e.reminderDate||e._trig||'';
              var _same= !_due||!_rem||_due===_rem;
              var _h='<div style="font-size:.63rem;font-weight:700;color:var(--txt);margin-top:3px;">'
                +'<span style="color:var(--mut);font-size:.58rem;">Due: </span>'
                +(_due?'<b>'+fD(_due)+'</b>':'—')+'</div>';
              if(_same){
                _h+='<div style="font-size:.62rem;color:#6c757d;margin-top:1px;">🔔 <span style="color:var(--mut);">Reminder: </span>Same day</div>';
              } else {
                _h+='<div style="font-size:.62rem;color:#1565c0;font-weight:700;margin-top:1px;">🔔 <span style="color:#1565c0;">Reminder: </span>'
                  +fD(_rem)+'</div>';
              }
              return _h;
            })():''}
            ${e.snoozedUntil?`<div style="font-size:.6rem;color:#b06000;margin-top:1px;">⏰ Snoozed until ${(function(){var d=new Date(e.snoozedUntil);return d.toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});})()}</div>`:''}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            ${badge}
            <div style="font-size:.63rem;color:var(--mut);margin-top:2px;">${isRentAuto&&e._daysOv>0?'💰 '+e._daysOv+'d overdue':''}</div>
          </div>
        </div>
        ${detailHtml}
      </div>`;
    }

    // ── Section builder (with category filter chips) ──
    function section(title,color,items){
      if(!items.length) return '';
      // Sub-filter by type labels
      const rentI  = items.filter(e=>e._src==='rent');
      const medI   = items.filter(e=>e._src==='medical');
      const otherI = items.filter(e=>e._src==='reminder');
      const chips = [
        rentI.length  ? `<span style="font-size:.58rem;background:#e05050;color:#fff;padding:1px 6px;border-radius:5px;">💰 Rent: ${rentI.length}</span>` : '',
        medI.length   ? `<span style="font-size:.58rem;background:#1e7a45;color:#fff;padding:1px 6px;border-radius:5px;">🏥 Medical: ${medI.length}</span>` : '',
        otherI.length ? `<span style="font-size:.58rem;background:#2c6fad;color:#fff;padding:1px 6px;border-radius:5px;">📌 Other: ${otherI.length}</span>` : ''
      ].filter(Boolean).join(' ');
      return`<div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;padding:6px 12px;background:${color}18;border-radius:8px;border-left:3px solid ${color};flex-wrap:wrap;">
          <span style="font-size:.78rem;font-weight:800;color:${color};">${title}</span>
          <span style="font-size:.68rem;background:${color};color:#fff;padding:1px 9px;border-radius:10px;">${items.length}</span>
          <span style="flex:1;"></span>
          ${chips}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;">
          ${items.map(buildCard).join('')}
        </div>
      </div>`;
    }

    // Compute allEntries for due-in categories (non-rent only for 3d/30d stats)
    const nonRentEntries = allEntries.filter(e=>e._src!=='rent');
    
    // Separate completed and active reminders
    const completedReminders = allEntries.filter(e=>e.completed); // ALL types: medical, rent, other
    const activeAllEntries = allEntries.filter(e=>!e.completed);
    
    // Recalculate counts for active only
    const activeCatOverdue = catOverdue.filter(e=>!e.completed);
    const activeCatToday = catToday.filter(e=>!e.completed);
    const activeCatThisWeek = catThisWeek.filter(e=>!e.completed);
    const activeCatThisMonth = catThisMonth.filter(e=>!e.completed);
    const activeCatUpcoming = catUpcoming.filter(e=>!e.completed);
    const activeCatSafe = catSafe.filter(e=>!e.completed);

    document.getElementById('pan-reminder').innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:1.05rem;font-weight:800;">🔔 All Reminders
          ${urgCnt>0?`<span style="font-size:.72rem;background:#e05050;color:#fff;padding:2px 9px;border-radius:12px;margin-left:6px;">${urgCnt} urgent</span>`:''}
          <span style="font-size:.68rem;color:var(--mut);margin-left:8px;">Rent · Medical · Other</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn b-sm" onclick="APP._remBulkDoneAll()" style="background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;font-weight:700;font-size:.72rem;" title="Mark all urgent as done">⚡ Mark Urgent Done</button>
          <button class="btn b-sm" onclick="APP._remBulkDeleteCompleted()" style="background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;font-weight:700;font-size:.72rem;" title="Delete all completed">🗑 Clear Done</button>
          <button class="btn b-sm" onclick="APP._showAllRemindersPopup()" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:800;font-size:.72rem;">📋 All Reminders</button>
          <button class="btn b-sm" onclick="APP._remExportCSV()" style="background:#f0fdf4;color:#166534;border:1.5px solid #bbf7d0;font-weight:700;font-size:.72rem;">⬇️ CSV</button>
          <div style="position:relative;display:inline-block;" id="_pdfDropWrap">
            <button class="btn b-sm" onclick="(function(){var m=document.getElementById('_pdfDropMenu');m.style.display=m.style.display==='block'?'none':'block';})()" style="background:#fff0f0;color:#c0392b;border:1.5px solid #f09090;font-weight:700;font-size:.72rem;">📄 PDF ▾</button>
            <div id="_pdfDropMenu" style="display:none;position:absolute;top:110%;right:0;background:var(--card);border:1.5px solid var(--bdr2);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);z-index:200;min-width:180px;overflow:hidden;">
              <div onclick="APP._remDownloadPDF('overdue');document.getElementById('_pdfDropMenu').style.display='none';" style="padding:10px 14px;cursor:pointer;font-size:.78rem;font-weight:700;color:#991b1b;border-bottom:1px solid var(--bdr);" onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background=''">🔴 Overdue Reminders</div>
              <div onclick="APP._remDownloadPDF('upcoming');document.getElementById('_pdfDropMenu').style.display='none';" style="padding:10px 14px;cursor:pointer;font-size:.78rem;font-weight:700;color:#1a7a45;border-bottom:1px solid var(--bdr);" onmouseover="this.style.background='#f0faf5'" onmouseout="this.style.background=''">📅 Upcoming Reminders</div>
              <div onclick="APP._remDownloadPDF('all');document.getElementById('_pdfDropMenu').style.display='none';" style="padding:10px 14px;cursor:pointer;font-size:.78rem;font-weight:700;color:#1565c0;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">📋 All Reminders</div>
            </div>
          </div>
          <button class="btn b-sm" onclick="APP._remDownloadWord()" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:700;font-size:.72rem;">📝 Word</button>
          <button class="btn b-sm" onclick="APP.showCompletedPopup()" style="background:#dcfce7;color:#166534;border:1.5px solid #90c8a0;font-weight:700;font-size:.72rem;">
            ✅ Completed${completedReminders.length>0?' ('+completedReminders.length+')':''}
          </button>
          <button class="btn b-gold" onclick="APP.openReminderModal()" style="border-radius:20px;padding:7px 16px;">＋ Add Reminder</button>
        </div>
      </div>

      <!-- Quick Filter Bar -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;padding:8px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:9px;box-shadow:var(--sh);align-items:center;">
        <span style="font-size:.65rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.07em;">Filter:</span>
        <button onclick="APP._remSetFilter('all')" id="remf_all" class="btn b-sm" style="background:var(--acc);color:#fff;border-color:var(--acc);">All (${totalAll})</button>
        <button onclick="APP._remSetFilter('urgent')" id="remf_urgent" class="btn b-sm b-out">🔴 Urgent (${urgCnt})</button>
        <button onclick="APP._remSetFilter('week')" id="remf_week" class="btn b-sm b-out">⏰ This Week (${due1w})</button>
        <button onclick="APP._remSetFilter('month')" id="remf_month" class="btn b-sm b-out">📅 This Month (${due30d})</button>
        <button onclick="APP._remSetFilter('medical')" id="remf_medical" class="btn b-sm b-out">🏥 Medical (${medEntries.filter(e=>!e.completed).length})</button>
        <button onclick="APP._remSetFilter('rent')" id="remf_rent" class="btn b-sm b-out">💰 Rent (${rentCards.length})</button>
        <span style="flex:1;"></span>
        <button onclick="APP._remPlayTestSound()" title="Test notification sound" style="background:transparent;border:none;cursor:pointer;font-size:1rem;padding:2px 6px;" title="Test sound">🔔</button>
        <button onclick="APP._pushToggleFromPanel()" id="remPushBtn" style="font-size:.7rem;padding:4px 9px;border-radius:6px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;border:1.5px solid #fca5a5;background:#fee2e2;color:#991b1b;" title="Enable browser push notifications">🔕 Push OFF</button>
      </div>

      <!-- Stats Bar — Unified counts -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:14px;">
        <div style="background:linear-gradient(135deg,#fff0f0,#ffe0e0);border:1.5px solid #f09090;border-radius:10px;padding:9px 10px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:900;color:#e05050;">${urgCnt}</div>
          <div style="font-size:.58rem;color:#e05050;font-weight:700;text-transform:uppercase;">Overdue / Today</div>
          <div style="font-size:.52rem;color:#e05050;opacity:0.7;margin-top:2px;">Urgent</div>
        </div>
        <div style="background:linear-gradient(135deg,#fffbee,#fff3cc);border:1.5px solid #d4b840;border-radius:10px;padding:9px 10px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:900;color:#b89000;">${due1w}</div>
          <div style="font-size:.58rem;color:#b89000;font-weight:700;text-transform:uppercase;">In 1 Week</div>
          <div style="font-size:.52rem;color:#b89000;opacity:0.7;margin-top:2px;">This Week</div>
        </div>
        <div style="background:linear-gradient(135deg,#f0faf4,#dcf5e8);border:1.5px solid #90c8a0;border-radius:10px;padding:9px 10px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:900;color:var(--grn);">${due30d}</div>
          <div style="font-size:.58rem;color:var(--grn);font-weight:700;text-transform:uppercase;">In 30 Days</div>
          <div style="font-size:.52rem;color:var(--grn);opacity:0.7;margin-top:2px;">This Month (30 Days)</div>
        </div>
        <div style="background:var(--card);border:1.5px solid var(--bdr2);border-radius:10px;padding:9px 10px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:900;color:var(--acc);">${totalAll}</div>
          <div style="font-size:.58rem;color:var(--mut);font-weight:700;text-transform:uppercase;">Total</div>
          <div style="font-size:.52rem;color:var(--mut);opacity:0.7;margin-top:2px;">All Reminders</div>
        </div>
      </div>

      <!-- Category legend -->
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
        <span style="font-size:.68rem;color:var(--mut);font-weight:700;">Types:</span>
        <span style="font-size:.7rem;background:#e05050;color:#fff;padding:2px 8px;border-radius:6px;font-weight:700;">💰 Rent (${rentCards.filter(x=>x).length})</span>
        <span style="font-size:.7rem;background:#1e7a45;color:#fff;padding:2px 8px;border-radius:6px;font-weight:700;">🏥 Medical (${medEntries.filter(e=>!e.completed).length})</span>
        <span style="font-size:.7rem;background:#2c6fad;color:#fff;padding:2px 8px;border-radius:6px;font-weight:700;">📌 Other (${otherEntries.filter(e=>!e.completed).length})</span>
        ${completedReminders.length>0?`<span onclick="APP.showCompletedPopup()" style="font-size:.7rem;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:6px;font-weight:700;cursor:pointer;border:1px solid #90c8a0;">✓ Done (${completedReminders.length}) →</span>`:''}
      </div>

      <div style="font-size:.68rem;color:var(--mut);margin-bottom:10px;">💡 Tap any card to expand · Click <b>✅ Mark Done</b> to complete · Done reminders move to Completed popup</div>

      ${allEntries.length===0?'<div class="empty"><div class="ei">🔔</div>No reminders yet — click + Add Reminder!</div>':''}

      ${rentCards.length?`<div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;padding:6px 12px;background:#e0505018;border-radius:8px;border-left:3px solid #e05050;">
          <span style="font-size:.78rem;font-weight:800;color:#e05050;">💰 Rent Overdue</span>
          <span style="font-size:.68rem;background:#e05050;color:#fff;padding:1px 9px;border-radius:10px;">${rentCards.length}</span>
        </div>
        ${rentCards.join('')}
      </div>`:''}

      ${section('🔴 Overdue / Expired','#e05050',activeCatOverdue)}
      ${section('🔔 Due Today','#e09050',activeCatToday)}
      ${section('⏰ Due in 1 Week','#c4900a',activeCatThisWeek.filter(e=>e._dTrig<=7))}
      ${section('📅 Due in 30 Days','#1e7a45',activeCatThisWeek.filter(e=>e._dTrig>7).concat(activeCatThisMonth))}
      ${section('🔮 Due in 1 Year','#1760a0',activeCatUpcoming)}
      ${section('✅ Safe (Beyond 1yr)','#2e7d32',activeCatSafe)}
      
    `;
    // Update live badge on tab
    this._remUpdateTabBadge(urgCnt);
    // Update push button state
    this._remUpdatePushBtn();
    // Apply active filter if set
    if(this._remActiveFilter && this._remActiveFilter !== 'all') this._remApplyFilterDOM(this._remActiveFilter);
  },

  // ── LIVE BADGE ON TAB ──
  _remUpdateTabBadge(cnt){
    const badge = document.getElementById('remTabBadge');
    if(!badge) return;
    if(cnt > 0){ badge.textContent = cnt > 99 ? '99+' : cnt; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  },

  // ── SNOOZE OPEN ──
  openSnooze(id){
    this._snoozeRId = id;
    const r = this.reminders.find(x => x.id === id);
    const nameEl = document.getElementById('snoozeRemName');
    if(nameEl) nameEl.textContent = r ? (r.name || 'Reminder') : 'Reminder';
    M.open('snoozeM');
  },

  // ── SNOOZE DO ──
  _doSnooze(val, unit){
    const id = this._snoozeRId;
    if(!id) return;
    const now = new Date();
    if(unit === 'minutes') now.setMinutes(now.getMinutes() + val);
    else if(unit === 'hours') now.setHours(now.getHours() + val);
    else if(unit === 'days') now.setDate(now.getDate() + val);
    const rs = this.reminders.map(r => r.id === id ? {...r, snoozedUntil: now.toISOString()} : r);
    S.set('reminders', rs);
    M.close('snoozeM');
    this.renderReminders();
    const unitLabel = unit === 'minutes' ? val + ' min' : unit === 'hours' ? val + ' hr' : val + ' day(s)';
    this.showToastMsg('⏰ Snoozed for ' + unitLabel + '!');
    // Schedule browser notification at snooze end
    this._scheduleSnoozeNotif(id, now);
  },

  _doSnoozeCustom(){
    const val = parseInt((document.getElementById('snoozeCustomVal')||{}).value) || 1;
    const unit = (document.getElementById('snoozeCustomUnit')||{}).value || 'days';
    this._doSnooze(val, unit);
  },

  // Schedule a JS setTimeout to fire a local browser notification when snooze ends
  _scheduleSnoozeNotif(id, fireAt){
    const ms = fireAt.getTime() - Date.now();
    if(ms <= 0 || ms > 24*60*60*1000) return; // max 24h window only
    if(this._snoozeTimers) clearTimeout(this._snoozeTimers[id]);
    if(!this._snoozeTimers) this._snoozeTimers = {};
    this._snoozeTimers[id] = setTimeout(() => {
      const r = this.reminders.find(x => x.id === id);
      if(!r) return;
      this._remPlaySound();
      if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
        try { new Notification('⏰ Snooze Over — ' + (r.name||'Reminder'), {body:'Your snoozed reminder is now due!',tag:'snooze-'+id}); } catch(e){}
      }
      // Clear snooze flag
      const rs = this.reminders.map(x => x.id === id ? {...x, snoozedUntil: null} : x);
      S.set('reminders', rs);
      if(this.curTab === 'reminder') this.renderReminders();
    }, ms);
  },

  // ── SOUND ALERT ──
  _remPlaySound(){
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch(e){}
  },

  _remPlayTestSound(){
    this._remPlaySound();
    this.showToastMsg('🔔 Sound test!');
  },

  // ── QUICK FILTER (DOM-based — no re-render) ──
  _remActiveFilter: 'all',

  _remSetFilter(f){
    this._remActiveFilter = f;
    // Update button styles
    ['all','urgent','week','month','medical','rent'].forEach(k => {
      const btn = document.getElementById('remf_' + k);
      if(!btn) return;
      if(k === f){ btn.style.background = 'var(--acc)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--acc)'; }
      else { btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; btn.className = 'btn b-sm b-out'; }
    });
    this._remApplyFilterDOM(f);
  },

  _remApplyFilterDOM(f){
    // Find all reminder cards (they have a specific class set in buildCard)
    const pan = document.getElementById('pan-reminder');
    if(!f || f === 'all') return; // all already visible
    // We can't easily filter DOM cards post-render without IDs; instead we re-render filtered
    // Just show a toast explaining active filter; full re-render would be expensive
    const labels = {urgent:'Urgent/Overdue',week:'This Week',month:'This Month',medical:'Medical',rent:'Rent'};
    // Actually scroll to the right section
    const sectionMap = {
      urgent: '🔴 Overdue', week: '⏰ Due in 1 Week', month: '📅 Due in 30', medical: '🏥', rent: '💰 Rent'
    };
    // Scroll to section header that contains the filter text
    const headers = pan ? pan.querySelectorAll('span[style*="font-weight:800"]') : [];
    for(const h of headers){
      const txt = sectionMap[f] || '';
      if(txt && h.textContent.includes(txt.substring(0,8))){
        h.scrollIntoView({behavior:'smooth', block:'start'});
        break;
      }
    }
  },

  // ── PUSH BTN UPDATE (from panel) ──
  _remUpdatePushBtn(){
    const btn = document.getElementById('remPushBtn');
    if(!btn) return;
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
    const enabled = localStorage.getItem('rk_push_enabled') === '1' && perm === 'granted';
    btn.textContent = enabled ? '🔔 Push ON' : '🔕 Push OFF';
    btn.style.background = enabled ? '#dcfce7' : '#fee2e2';
    btn.style.color = enabled ? '#166534' : '#991b1b';
    btn.style.borderColor = enabled ? '#90c8a0' : '#fca5a5';
  },

  _pushToggleFromPanel(){
    if(typeof _pushToggle === 'function') _pushToggle();
    setTimeout(() => this._remUpdatePushBtn(), 500);
  },

  // ── BULK ACTIONS ──
  _remBulkDoneAll(){
    const now = new Date();
    const urgent = this.reminders.filter(r => {
      if(r.completed) return false;
      const trig = r.reminderDate || r.alertDate || r.trigDate || r.exp || r.nextTrigger;
      if(!trig) return false;
      const dp = trig.split('-');
      if(dp.length !== 3) return false;
      const d = new Date(parseInt(dp[0]), parseInt(dp[1])-1, parseInt(dp[2]));
      const diff = Math.round((d - now) / 86400000);
      return diff <= 0;
    });
    if(!urgent.length){ this.showToastMsg('✅ No urgent reminders to mark!'); return; }
    if(!confirm(`Mark ${urgent.length} overdue/due-today reminder(s) as done?`)) return;
    const ids = new Set(urgent.map(r => r.id));
    const rs = this.reminders.map(r => ids.has(r.id) ? {...r, completed: true} : r);
    S.set('reminders', rs);
    this.renderReminders(); this.renderPills();
    this.showToastMsg('✅ ' + urgent.length + ' reminder(s) marked as done!');
  },

  _remBulkDeleteCompleted(){
    const done = this.reminders.filter(r => r.completed);
    if(!done.length){ this.showToastMsg('No completed reminders to delete.'); return; }
    if(!confirm(`Delete ${done.length} completed reminder(s)? This cannot be undone.`)) return;
    S.set('reminders', this.reminders.filter(r => !r.completed));
    this.renderReminders(); this.renderPills();
    this.showToastMsg('🗑 ' + done.length + ' completed reminder(s) deleted!');
  },

  // ── EXPORT TO CSV ──
  // ── All Reminders Summary Popup ──────────────────────────────────
  _showAllRemindersPopup(){
    const now = new Date(); now.setHours(0,0,0,0);
    const allRems = this.reminders;
    const completed = allRems.filter(r=>r.completed);
    const rems = allRems.filter(r=>!r.completed); // active only

    // ── Compute invoice date for rent reminders ──
    const _getRentInvoiceDate = (r) => {
      if(!r._isAutoRent && r.mode!=='rent') return null;
      const t = this.tenants.find(t=>t.id===r._tenantId||t.id===r.id);
      if(!t) return null;
      if(t.invdate) return t.invdate; // stored invoice date
      // Compute: due day of current month
      const dueDay = Number(t.due||1);
      const n = new Date();
      const d = new Date(n.getFullYear(), n.getMonth(), dueDay);
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    };

    // ── Status function: handles rent overdue specially ──
    const getStatus = (r)=>{
      if(r.completed) return {label:'Completed',color:'#166534',bg:'#dcfce7',days:99999,isRent:false};

      const isRent = r._isAutoRent || r.mode==='rent';

      if(isRent){
        // Use _dTrig (pre-calculated overdue days) or _daysOv
        const dTrig = (typeof r._dTrig==='number') ? r._dTrig : null;
        const daysOv = r._daysOv || 0;
        if(daysOv>0 || (dTrig!==null&&dTrig<0)){
          const ovDays = daysOv>0 ? daysOv : Math.abs(dTrig);
          return {label:ovDays+'d Overdue',color:'#991b1b',bg:'#fee2e2',days:-ovDays,isRent:true};
        }
        if(dTrig===0) return {label:'Due Today',color:'#854d0e',bg:'#fef9c3',days:0,isRent:true};
        return {label:'Rent Due',color:'#854d0e',bg:'#fff8ee',days:0,isRent:true};
      }

      const trig = r.reminderDate||r.alertDate||r.trigDate||r.exp||r.nextTrigger||'';
      if(!trig) return {label:'No Date',color:'#6c757d',bg:'var(--dim)',days:null,isRent:false};
      const dp = trig.split('-');
      if(dp.length!==3) return {label:'No Date',color:'#6c757d',bg:'var(--dim)',days:null,isRent:false};
      const d = new Date(parseInt(dp[0]),parseInt(dp[1])-1,parseInt(dp[2]));
      const diff = Math.round((d-now)/86400000);
      if(diff<0)  return {label:Math.abs(diff)+'d Overdue',color:'#991b1b',bg:'#fee2e2',days:diff,isRent:false};
      if(diff===0)return {label:'Due Today',color:'#854d0e',bg:'#fef9c3',days:0,isRent:false};
      if(diff<=7) return {label:'In '+diff+'d',color:'#854d0e',bg:'#fff8ee',days:diff,isRent:false};
      if(diff<=30)return {label:'In '+diff+'d',color:'#1a7a45',bg:'#e8f5e9',days:diff,isRent:false};
      return {label:'In '+diff+'d',color:'#555',bg:'var(--dim)',days:diff,isRent:false};
    };

    // ── Categorize ──
    // Rent overdue/due → always in overdueList or todayList (NEVER in noDateList)
    const overdueList  = rems.filter(r=>{ const s=getStatus(r); return s.days!==null&&s.days<0; })
                             .sort((a,b)=>{ // Rent overdue first, then most overdue
                               const ar=a._isAutoRent||a.mode==='rent'?1:0;
                               const br=b._isAutoRent||b.mode==='rent'?1:0;
                               if(ar!==br) return br-ar; // rent first
                               return getStatus(a).days-getStatus(b).days;
                             });
    const todayList    = rems.filter(r=>{ const s=getStatus(r); return s.days===0; })
                             .sort((a,b)=>{ // Rent due today first
                               const ar=a._isAutoRent||a.mode==='rent'?0:1;
                               const br=b._isAutoRent||b.mode==='rent'?0:1;
                               return ar-br;
                             });
    const thisWeekList = rems.filter(r=>{ const s=getStatus(r); return s.days!==null&&s.days>0&&s.days<=7&&!s.isRent; })
                             .sort((a,b)=>getStatus(a).days-getStatus(b).days);
    const thisMonthList= rems.filter(r=>{ const s=getStatus(r); return s.days!==null&&s.days>7&&s.days<=30&&!s.isRent; })
                             .sort((a,b)=>getStatus(a).days-getStatus(b).days);
    const upcomingList = rems.filter(r=>{ const s=getStatus(r); return s.days!==null&&s.days>30&&!s.isRent; })
                             .sort((a,b)=>getStatus(a).days-getStatus(b).days);
    // No Date: only non-rent reminders with no trigger date
    const noDateList   = rems.filter(r=>{ const s=getStatus(r); return s.days===null&&!s.isRent; });

    // ── Make row ──
    const makeRow = (r, forceCompleted)=>{
      const isRent = r._isAutoRent||r.mode==='rent';
      const st = forceCompleted
        ? {label:'✅ Completed',color:'#166534',bg:'#dcfce7'}
        : getStatus(r);
      // Date display: for rent use invoice date
      let dateDisp = '';
      if(isRent){
        const invD = _getRentInvoiceDate(r);
        dateDisp = invD ? '· Invoice: '+fD(invD) : '· Rent';
      } else {
        const trig = r.reminderDate||r.alertDate||r.trigDate||r.exp||r.nextTrigger||'';
        dateDisp = trig ? '· '+fD(trig) : '';
      }
      const typeLabel = isRent ? 'Rent' : (r.type||'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,'').trim()||'Other';
      // Rent: show balance
      const extraInfo = isRent && r._balanceAmt>0
        ? `<span style="color:#991b1b;font-weight:800;margin-left:6px;">₹${Number(r._balanceAmt).toLocaleString('en-IN')}</span>`
        : '';
      const nameStyle = forceCompleted
        ? 'font-size:.82rem;font-weight:700;word-break:break-word;text-decoration:line-through;opacity:.7;'
        : 'font-size:.82rem;font-weight:700;word-break:break-word;';
      const rowBg = isRent&&!forceCompleted ? 'background:#fffaf0;' : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--bdr);${rowBg}">
        <div style="flex:1;min-width:0;">
          <div style="${nameStyle}">${r.name||''}${extraInfo}</div>
          <div style="font-size:.68rem;color:var(--mut);">${typeLabel} ${dateDisp}</div>
        </div>
        <span style="background:${st.bg};color:${st.color};font-size:.65rem;font-weight:800;padding:2px 8px;border-radius:6px;white-space:nowrap;flex-shrink:0;">${st.label}</span>
      </div>`;
    };

    const section = (title, list, color, forceCompleted)=> list.length ? `
      <div style="background:${color};padding:6px 14px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-left:3px solid ${color==='#fff5f5'?'#e05050':color==='#fffbee'?'#e09050':color==='#dcfce7'?'#166534':'#adb5bd'};">${title} (${list.length})</div>
      ${list.map(r=>makeRow(r,!!forceCompleted)).join('')}` : '';

    // Active filter state for popup
    let _popFilter = 'all';

    const renderPopup = () => {
      const listEl = document.getElementById('_allRemList');
      if(!listEl) return;

      // Update filter button active states
      ['all','overdue','today','upcoming'].forEach(f=>{
        const btn = document.getElementById('_arp_f_'+f);
        if(btn){
          btn.style.background = _popFilter===f ? 'var(--acc)' : 'var(--dim)';
          btn.style.color = _popFilter===f ? '#fff' : 'var(--txt)';
          btn.style.borderColor = _popFilter===f ? 'var(--acc)' : 'var(--bdr2)';
        }
      });

      if(_popFilter==='overdue'){
        listEl.innerHTML = overdueList.length
          ? section('🔴 OVERDUE', overdueList, '#fff5f5')
          : '<div style="text-align:center;padding:40px;color:var(--mut);font-size:.88rem;">No overdue reminders 🎉</div>';
      } else if(_popFilter==='today'){
        listEl.innerHTML = todayList.length
          ? section('📅 DUE TODAY', todayList, '#fffbee')
          : '<div style="text-align:center;padding:40px;color:var(--mut);font-size:.88rem;">Nothing due today!</div>';
      } else if(_popFilter==='upcoming'){
        listEl.innerHTML =
          section('⏰ THIS WEEK', thisWeekList, '#fff8ee') +
          section('📅 THIS MONTH', thisMonthList, '#f0faf5') +
          section('🔮 UPCOMING', upcomingList, '#f0f4ff') +
          section('📌 NO DATE', noDateList, 'var(--dim)') ||
          '<div style="text-align:center;padding:40px;color:var(--mut);font-size:.88rem;">No upcoming reminders</div>';
      } else {
        // ALL — correct order: Rent Overdue → General Overdue → Today → This Week → This Month → Upcoming → No Date → Completed
        listEl.innerHTML =
          (overdueList.length   ? section('🔴 OVERDUE', overdueList, '#fff5f5') : '') +
          (todayList.length     ? section('📅 DUE TODAY', todayList, '#fffbee') : '') +
          (thisWeekList.length  ? section('⏰ THIS WEEK (1-7d)', thisWeekList, '#fff8ee') : '') +
          (thisMonthList.length ? section('📅 THIS MONTH (8-30d)', thisMonthList, '#f0faf5') : '') +
          (upcomingList.length  ? section('🔮 UPCOMING (30d+)', upcomingList, '#f0f4ff') : '') +
          (noDateList.length    ? section('📌 NO DATE', noDateList, 'var(--dim)') : '') +
          (completed.length     ? section('✓ COMPLETED', completed.slice(0,30), '#dcfce7', true) : '') +
          (!rems.length && !completed.length ? '<div style="text-align:center;padding:40px;color:var(--mut);">No reminders yet</div>' : '');
      }
    };

    const old = document.getElementById('_allRemPopup'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_allRemPopup';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `<div style="width:100%;max-width:640px;background:var(--card);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <!-- Header -->
      <div style="padding:14px 18px 12px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div>
            <div style="font-weight:800;font-size:1rem;">📋 All Reminders</div>
            <div style="font-size:.68rem;color:var(--mut);">Total: ${this.reminders.length} · Active: ${rems.length} · Completed: ${completed.length}</div>
          </div>
          <button onclick="document.getElementById('_allRemPopup').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
        </div>

        <!-- 4 clickable KPI cards -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px;">
          <button id="_arp_f_all" onclick="window._arpF='all';(()=>{window._arpF='all';APP._arpSetFilter('all');})()"
            style="background:var(--acc);color:#fff;border:1.5px solid var(--acc);border-radius:10px;padding:9px 6px;text-align:center;cursor:pointer;font-family:Nunito,sans-serif;transition:all .15s;">
            <div style="font-size:1.3rem;font-weight:900;">${rems.length}</div>
            <div style="font-size:.58rem;font-weight:800;text-transform:uppercase;opacity:.9;">All Active</div>
          </button>
          <button id="_arp_f_overdue" onclick="APP._arpSetFilter('overdue')"
            style="background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:10px;padding:9px 6px;text-align:center;cursor:pointer;font-family:Nunito,sans-serif;transition:all .15s;">
            <div style="font-size:1.3rem;font-weight:900;color:#991b1b;">${overdueList.length}</div>
            <div style="font-size:.58rem;font-weight:800;text-transform:uppercase;color:#991b1b;">⚠️ Overdue</div>
          </button>
          <button id="_arp_f_today" onclick="APP._arpSetFilter('today')"
            style="background:#fef9c3;color:#854d0e;border:1.5px solid #fde68a;border-radius:10px;padding:9px 6px;text-align:center;cursor:pointer;font-family:Nunito,sans-serif;transition:all .15s;">
            <div style="font-size:1.3rem;font-weight:900;color:#854d0e;">${todayList.length}</div>
            <div style="font-size:.58rem;font-weight:800;text-transform:uppercase;color:#854d0e;">📅 Today</div>
          </button>
          <button id="_arp_f_upcoming" onclick="APP._arpSetFilter('upcoming')"
            style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;border-radius:10px;padding:9px 6px;text-align:center;cursor:pointer;font-family:Nunito,sans-serif;transition:all .15s;">
            <div style="font-size:1.3rem;font-weight:900;color:#1a7a45;">${thisWeekList.length+thisMonthList.length+upcomingList.length+noDateList.length}</div>
            <div style="font-size:.58rem;font-weight:800;text-transform:uppercase;color:#1a7a45;">✅ Upcoming</div>
          </button>
        </div>

        <!-- Download buttons -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button onclick="APP._remDownloadPDF('overdue');"
            style="flex:1;min-width:120px;background:#e53935;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">🔴 Overdue PDF</button>
          <button onclick="APP._remDownloadPDF('upcoming');"
            style="flex:1;min-width:120px;background:#1a7a45;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">📅 Upcoming PDF</button>
          <button onclick="APP._remDownloadPDF('all');"
            style="flex:1;min-width:100px;background:#1565c0;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">📋 All PDF</button>
          <button onclick="APP._remDownloadWord();"
            style="flex:1;min-width:80px;background:#455a64;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">📝 Word</button>
          <button onclick="APP._remExportCSV();"
            style="flex:1;min-width:80px;background:#2e7d32;color:#fff;border:none;border-radius:9px;padding:9px 6px;font-family:Nunito,sans-serif;font-size:.76rem;font-weight:800;cursor:pointer;">📊 CSV</button>
        </div>
      </div>
      <!-- List area -->
      <div id="_allRemList" style="overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });

    // Wire filter function
    APP._arpSetFilter = (f)=>{
      _popFilter = f;
      renderPopup();
    };
    renderPopup();
  },

  // ── Reminder PDF Download — filter: 'overdue' | 'upcoming' | 'all' ──
  _remDownloadPDF(filter){
    filter = filter || 'all';
    const now = new Date(); now.setHours(0,0,0,0);
    const allRems = this.reminders;

    // Strip emojis completely
    const stripE = s=>(s||'').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,'')
      .replace(/[\u{1F000}-\u{1FFFF}]/gu,'').replace(/[\u2600-\u27BF]/g,'')
      .replace(/[\u20D0-\u20FF\uFE00-\uFE0F]/g,'').trim();

    // Status calculator
    const getStatus = (r)=>{
      if(r.completed) return {label:'Completed',pri:99,days:null};
      const isRent = r._isAutoRent||r.mode==='rent';
      if(isRent){
        const daysOv = r._daysOv||0;
        const dTrig = typeof r._dTrig==='number'?r._dTrig:null;
        if(daysOv>0||(dTrig!==null&&dTrig<0)){
          const ov = daysOv>0?daysOv:Math.abs(dTrig||0);
          return {label:ov+'d Overdue',pri:0,days:-ov};
        }
        return {label:'Rent Due',pri:1,days:0};
      }
      const trig = r.reminderDate||r.alertDate||r.trigDate||r.exp||r.nextTrigger||'';
      if(!trig) return {label:'No Date',pri:5,days:null};
      const dp=trig.split('-');
      if(dp.length!==3) return {label:'No Date',pri:5,days:null};
      const d=new Date(parseInt(dp[0]),parseInt(dp[1])-1,parseInt(dp[2]));
      const diff=Math.round((d-now)/86400000);
      if(diff<0)  return {label:Math.abs(diff)+'d Overdue',pri:0,days:diff};
      if(diff===0)return {label:'Due Today',pri:1,days:0};
      if(diff<=7) return {label:'This Week ('+diff+'d)',pri:2,days:diff};
      if(diff<=30)return {label:'This Month ('+diff+'d)',pri:3,days:diff};
      return {label:'In '+diff+'d',pri:4,days:diff};
    };

    // Get invoice/alert date
    const getDate = (r)=>{
      const isRent = r._isAutoRent||r.mode==='rent';
      if(isRent){
        const t=this.tenants&&this.tenants.find(x=>x.id===r._tenantId||x.id===r.id);
        if(!t) return '—';
        if(t.invdate) return fD(t.invdate);
        const n=new Date();
        const dd=new Date(n.getFullYear(),n.getMonth(),Number(t.due||1));
        return fD(dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0')+'-'+String(dd.getDate()).padStart(2,'0'));
      }
      const trig=r.reminderDate||r.alertDate||r.trigDate||r.exp||r.nextTrigger||'';
      return trig?fD(trig):'—';
    };

    // Filter reminders based on chosen filter
    let filtered, titleSuffix, fileTag;
    if(filter==='overdue'){
      filtered = allRems.filter(r=>{ const s=getStatus(r); return s.pri===0 && !r.completed; });
      titleSuffix = 'Overdue Reminders';
      fileTag = 'Overdue';
    } else if(filter==='upcoming'){
      filtered = allRems.filter(r=>{ const s=getStatus(r); return s.pri>=1 && s.pri<=4 && !r.completed; });
      titleSuffix = 'Upcoming Reminders';
      fileTag = 'Upcoming';
    } else {
      filtered = allRems;
      titleSuffix = 'All Reminders';
      fileTag = 'All';
    }

    if(!filtered.length){
      this.showToastMsg('⚠️ No reminders in this category!');
      return;
    }

    // Sort: Rent overdue first → overdue → today → week → month → upcoming → no date → completed
    const sorted = [...filtered].sort((a,b)=>{
      const sa=getStatus(a), sb=getStatus(b);
      if(sa.pri!==sb.pri) return sa.pri-sb.pri;
      const ar=a._isAutoRent||a.mode==='rent'?0:1;
      const br=b._isAutoRent||b.mode==='rent'?0:1;
      if(ar!==br) return ar-br;
      const da=sa.days!=null?sa.days:9999;
      const db=sb.days!=null?sb.days:9999;
      return da-db;
    });

    const overdueCount = filtered.filter(r=>getStatus(r).pri===0).length;
    const todayCount   = filtered.filter(r=>getStatus(r).pri===1&&!r.completed).length;
    const upcomingCount= filtered.filter(r=>getStatus(r).pri>=2&&getStatus(r).pri<=4).length;

    // Build rows — Notes max 60 chars to prevent overflow
    const rows = sorted.map(r=>{
      const isRent = r._isAutoRent||r.mode==='rent';
      const name = stripE(r.name||'').slice(0,45)+(stripE(r.name||'').length>45?'…':'');
      const type = isRent?'Rent':stripE((r.type||'Other').replace(/^[^\w\s]+\s*/,''));
      const st   = getStatus(r);
      var _pDue = isRent?date:fD(r.dueDate||r.trigDate||'');
      var _pRem = isRent?date:fD(r.reminderDate||r.alertDate||r.trigDate||'');
      var _pRemFull = (_pRem||_pDue||'—');
      const rawNotes = stripE(r.notes||'');
      const notes = rawNotes.slice(0,80)+(rawNotes.length>80?'...':'');
      return [name, type, _pDue||'—', _pRemFull||'—', st.label, notes];
    });

    _makePDF({
      filename: 'Reminders_'+fileTag+'_'+todayISO()+'.pdf',
      title: titleSuffix,
      subtitle: 'Total: '+filtered.length+' | Overdue: '+overdueCount+' | Due Today: '+todayCount+' | Upcoming: '+upcomingCount+' | '+todayDMY(),
      orientation: 'landscape',
      columns: ['Name','Type','Due Date','Reminder Date','Status','Notes'],
      rows,
      headerColor: [44,111,173],
      // A4 landscape: 297mm - (14mm × 2) margins = 269mm usable
      // Column widths: 60+20+25+25+30+109 = 269mm exactly
      entriesLabel: filter==='overdue'?'Showing: Overdue & Rent Due reminders only':
                    filter==='upcoming'?'Showing: Upcoming (Today + This Week + Month + Future)':
                    'All reminders | Sorted: Overdue first -> Today -> Upcoming -> Completed',
      colStyles: {
        0:{cellWidth:60, overflow:'linebreak', valign:'top'},
        1:{cellWidth:20, halign:'center', valign:'top'},
        2:{cellWidth:25, halign:'center', valign:'top'},
        3:{cellWidth:25, halign:'center', valign:'top'},
        4:{cellWidth:30, halign:'center', fontStyle:'bold', valign:'top'},
        5:{cellWidth:109, overflow:'linebreak', valign:'top'}
      }
    });
    const msg = filter==='overdue'?'🔴 Overdue PDF ready!':filter==='upcoming'?'📅 Upcoming PDF ready!':'📋 All Reminders PDF ready!';
    this.showToastMsg(msg);
  },

  // ── Reminder Word Download ────────────────────────────────────
  _remDownloadWord(){
    const now = new Date(); now.setHours(0,0,0,0);
    const rems = this.reminders;
    // Strip emojis fully for Word compatibility
    const stripE = s=>(s||'').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]/gu,'').replace(/[^\x00-\x7F\u0900-\u097F\u20B9 ]/g,'').trim();

    const getStatus = (r)=>{
      if(r.completed) return {label:'Completed',color:'#166534',pri:99};
      const trig = r.reminderDate||r.alertDate||r.trigDate||r.exp||r.nextTrigger||'';
      if(!trig) return {label:'No Date',color:'#6c757d',pri:5};
      const dp = trig.split('-');
      if(dp.length!==3) return {label:'No Date',color:'#6c757d',pri:5};
      const d = new Date(parseInt(dp[0]),parseInt(dp[1])-1,parseInt(dp[2]));
      const diff = Math.round((d-now)/86400000);
      if(diff<0)  return {label:Math.abs(diff)+'d Overdue',color:'#991b1b',pri:0};
      if(diff===0)return {label:'Due Today',color:'#854d0e',pri:1};
      if(diff<=7) return {label:'In '+diff+'d (This Week)',color:'#854d0e',pri:2};
      if(diff<=30)return {label:'In '+diff+'d (This Month)',color:'#b45309',pri:3};
      return {label:'In '+diff+'d',color:'#166534',pri:4};
    };

    // Sort: Overdue first → Today → This Week → This Month → Upcoming → No Date → Completed
    const sorted = [...rems].sort((a,b)=>{
      const sa=getStatus(a), sb=getStatus(b);
      if(sa.pri!==sb.pri) return sa.pri-sb.pri;
      // Within same priority, sort by date
      const ta=a.reminderDate||a.trigDate||a.exp||a.nextTrigger||'9999';
      const tb=b.reminderDate||b.trigDate||b.exp||b.nextTrigger||'9999';
      return ta.localeCompare(tb);
    });

    const overdueCount = rems.filter(r=>!r.completed&&getStatus(r).pri===0).length;
    const todayCount   = rems.filter(r=>!r.completed&&getStatus(r).pri===1).length;
    const completedCount = rems.filter(r=>r.completed).length;
    const genDate = todayDMY();

    // Build clean HTML table — Word opens .doc HTML perfectly, no letter breaks
    const tableRows = sorted.map(r=>{
      const st = getStatus(r);
      const trig = r.reminderDate||r.alertDate||r.trigDate||r.exp||r.nextTrigger||'';
      const name = stripE(r.name||'');
      const type = stripE((r.type||'Other').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,''));
      const date = trig ? fD(trig) : '—';
      const notes = stripE(r.notes||'');
      const rowBg = r.completed?'#f0fdf4':st.pri===0?'#fff5f5':st.pri===1?'#fffbee':'';
      return `<tr style="background:${rowBg};">
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10pt;word-break:break-word;max-width:160px;">${name}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:9pt;white-space:nowrap;">${type}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:9pt;white-space:nowrap;font-family:monospace;">${date}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:9pt;color:${st.color};font-weight:bold;white-space:nowrap;">${st.label}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:9pt;word-break:break-word;max-width:160px;">${notes}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;font-size:10pt;margin:20mm 15mm;}
  h1{color:#1e3a6e;font-size:16pt;margin-bottom:4px;}
  .sub{font-size:9pt;color:#666;margin-bottom:12px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#1e3a6e;color:#fff;padding:6px 8px;text-align:left;font-size:9pt;border:1px solid #1e3a6e;}
  td{vertical-align:top;}
  tr:nth-child(even){background:#fafafa;}
  .legend{font-size:8pt;color:#888;margin-top:12px;}
</style></head><body>
<h1>Reminders Report</h1>
<div class="sub">Generated: ${genDate} | Total: ${rems.length} | Overdue: ${overdueCount} | Due Today: ${todayCount} | Completed: ${completedCount}</div>
<table>
  <thead><tr>
    <th style="width:28%">Name</th>
    <th style="width:14%">Type</th>
    <th style="width:14%">Date</th>
    <th style="width:18%">Status</th>
    <th style="width:26%">Notes</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="legend">Sort order: Overdue → Due Today → This Week → This Month → Upcoming → No Date → Completed</div>
</body></html>`;

    const blob = new Blob([html],{type:'application/msword;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url;
    a.download='Reminders_'+todayISO()+'.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToastMsg('📝 Word file downloaded!');
  },

  _remExportCSV(){
    // Strip emojis fully — keep letters, numbers, Indian chars, ₹, spaces, punctuation
    const _ce = s=>{
      if(!s) return '';
      return String(s)
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // surrogate pairs (emoji)
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')          // extended emoji
        .replace(/[\u2600-\u27BF]/g, '')                  // misc symbols/dingbats
        .replace(/[\uFE00-\uFE0F]/g, '')                  // variation selectors
        .replace(/\u200D/g, '')                           // zero width joiner
        .replace(/\uFEFF/g, '')                           // BOM
        .trim();
    };
    // Wrap cell safely for CSV — handle commas, quotes, newlines
    const csvCell = s => '"' + String(s||'').replace(/"/g,'""').replace(/\n/g,' ') + '"';

    const now = new Date(); now.setHours(0,0,0,0);
    const getStatusLabel = (r) => {
      if(r.completed) return 'Completed';
      const trig = r.reminderDate || r.alertDate || r.trigDate || r.exp || r.nextTrigger || '';
      if(!trig) return 'No Date';
      const dp = trig.split('-');
      if(dp.length !== 3) return 'No Date';
      const d = new Date(parseInt(dp[0]), parseInt(dp[1])-1, parseInt(dp[2]));
      const diff = Math.round((d - now) / 86400000);
      if(diff < 0) return Math.abs(diff)+'d Overdue';
      if(diff === 0) return 'Due Today';
      if(diff <= 7) return 'This Week';
      if(diff <= 30) return 'This Month';
      return 'Upcoming';
    };
    const getStatusPri = (r) => {
      if(r.completed) return 99;
      const lbl = getStatusLabel(r);
      if(lbl.includes('Overdue')) return 0;
      if(lbl==='Due Today') return 1;
      if(lbl==='This Week') return 2;
      if(lbl==='This Month') return 3;
      if(lbl==='No Date') return 5;
      return 4;
    };

    // Sort: Overdue → Today → This Week → This Month → Upcoming → No Date → Completed
    const sorted = [...this.reminders].sort((a,b)=>{
      const pa=getStatusPri(a), pb=getStatusPri(b);
      if(pa!==pb) return pa-pb;
      const ta=a.reminderDate||a.trigDate||a.exp||a.nextTrigger||'9999';
      const tb=b.reminderDate||b.trigDate||b.exp||b.nextTrigger||'9999';
      return ta.localeCompare(tb);
    });

    const header = ['Sr.','Name','Person','Type','Alert Date (DD/MM/YYYY)','Expiry Date','Status','Mode','Frequency','Notes'];
    const rows = sorted.map((r, i) => {
      const trig = r.reminderDate || r.alertDate || r.trigDate || r.exp || r.nextTrigger || '';
      const freq = r.mode==='recurring'
        ? (_ce(r.repeatLabel||'')||({'1':'Daily','7':'Weekly','30':'Monthly','365':'Yearly'}[r.recurPeriod]||'Recurring'))
        : 'Once';
      return [
        i+1,
        csvCell(_ce(r.name||'')),
        csvCell(_ce(r.person||'')),
        csvCell(_ce((r.type||'Other').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,''))),
        trig ? fD(trig) : '',
        r.exp ? fD(r.exp) : '',
        getStatusLabel(r),
        _ce(r.mode||'expiry'),
        csvCell(_ce(freq)),
        csvCell(_ce(r.notes||''))
      ].join(',');
    });

    // BOM + header + rows
    const csv = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Reminders_' + todayISO() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToastMsg('✅ CSV downloaded — Excel mein open karein!');
  },

  // ── SMART TIME-BASED ALERT ENGINE ──
  // Fires browser notification at exact alertHour:alertMin for due-today reminders
  _remScheduleTimeAlerts(){
    if(typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if(!this._timeAlertTimers) this._timeAlertTimers = {};
    // Clear old timers
    Object.values(this._timeAlertTimers).forEach(t => clearTimeout(t));
    this._timeAlertTimers = {};
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    this.reminders.filter(r => !r.completed).forEach(r => {
      const trig = r.reminderDate || r.alertDate || r.trigDate || r.exp || r.nextTrigger;
      if(!trig) return;
      const h = parseInt(r.alertHour || 10);
      const m = parseInt(r.alertMin || 0);
      // Only schedule for today or overdue
      const dp = trig.split('-');
      if(dp.length !== 3) return;
      const trigDay = new Date(parseInt(dp[0]), parseInt(dp[1])-1, parseInt(dp[2]));
      trigDay.setHours(0,0,0,0);
      const daysDiff = Math.round((trigDay - now) / 86400000);
      if(daysDiff > 1) return; // only today/overdue/tomorrow alerts
      // Fire time = today at alertHour:alertMin (or now + 1s if past)
      const fireAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      if(fireAt <= now) return; // already past
      const ms = fireAt.getTime() - now.getTime();
      if(ms > 24*60*60*1000) return;
      this._timeAlertTimers[r.id] = setTimeout(() => {
        this._remPlaySound();
        try {
          new Notification('🔔 ' + (r.name||'Reminder'), {
            body: (r.type||'') + (r.notes ? ' — ' + r.notes.slice(0,60) : ''),
            tag: 'rem-time-' + r.id,
            requireInteraction: true
          });
        } catch(e){}
      }, ms);
    });
  },


});

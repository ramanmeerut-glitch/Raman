/* modules/calendar.js — Calendar — getCalEvents, openCalEventModal, renderCalendar
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
  // ══ CALENDAR ══
  // ════════════════════════════════════════════════════════════════
  // CUSTOM CALENDAR EVENTS
  // localStorage: rk_cal_events  [{id,date,title,time,type,color,note}]
  // ════════════════════════════════════════════════════════════════
  getCalEvents(){ try{ return JSON.parse(localStorage.getItem('rk_cal_events')||'[]'); }catch{ return []; } },
  saveCalEvents(arr){ localStorage.setItem('rk_cal_events',JSON.stringify(arr)); if(window.fbSave) window.fbSave('cal_events',arr).catch(()=>{}); },

  openCalEventModal(dateStr, editId){
    const today = dateStr || new Date().toISOString().split('T')[0];
    const existing = editId ? this.getCalEvents().find(e=>e.id===editId) : null;
    const TYPES = ['📅 Personal','🎂 Birthday','💍 Anniversary','💼 Work','🏥 Medical','💰 Finance','✈️ Travel','🎉 Celebration','⚠️ Important','📋 Other'];
    const COLORS = ['#1565c0','#1a7a45','#b56a00','#7b1fa2','#c0392b','#0f6e56','#e65100','#2196f3'];

    const old = document.getElementById('_calEvModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_calEvModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `<div style="width:100%;max-width:480px;background:var(--card);border-radius:16px;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,.3);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-weight:800;font-size:1rem;">${editId?'✏️ Edit Event':'📅 Add Event'}</div>
        <button onclick="document.getElementById('_calEvModal').remove()" style="background:var(--dim);border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;color:var(--mut);">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📝 Title *</label>
          <input id="_cev_title" value="${existing?existing.title.replace(/"/g,'&quot;'):''}" placeholder="e.g. Raman's Birthday, Court date, EMI due…"
            style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:8px 11px;font-family:Nunito,sans-serif;font-size:.88rem;background:var(--bg);color:var(--txt);">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Date *</label>
            <input id="_cev_date" type="date" value="${existing?existing.date:today}"
              style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);">
          </div>
          <div>
            <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">⏰ Time (optional)</label>
            <input id="_cev_time" type="time" value="${existing?existing.time||'':''}"
              style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);">
          </div>
        </div>
        <div>
          <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🏷️ Type</label>
          <select id="_cev_type" style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);">
            ${TYPES.map(t=>`<option value="${t}" ${existing&&existing.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:5px;">🎨 Colour</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${COLORS.map(c=>`<div onclick="document.querySelectorAll('._cev_col').forEach(x=>x.style.outline='none');this.style.outline='3px solid #000';document.getElementById('_cev_col_val').value='${c}'" class="_cev_col" style="width:28px;height:28px;border-radius:7px;background:${c};cursor:pointer;outline:${existing&&existing.color===c?'3px solid #000':'none'};"></div>`).join('')}
          </div>
          <input type="hidden" id="_cev_col_val" value="${existing?existing.color:COLORS[0]}">
        </div>
        <div>
          <label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📝 Notes</label>
          <input id="_cev_note" value="${existing?existing.note||'':''}" placeholder="Optional notes…"
            style="width:100%;border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;font-family:Nunito,sans-serif;font-size:.85rem;background:var(--bg);color:var(--txt);">
        </div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button onclick="document.getElementById('_calEvModal').remove()" style="flex:1;padding:10px;border:1.5px solid var(--bdr2);border-radius:9px;background:var(--card);font-family:Nunito,sans-serif;font-size:.88rem;cursor:pointer;">Cancel</button>
          <button onclick="APP._saveCalEvent('${editId||''}')" style="flex:2;padding:10px;background:var(--acc);color:#fff;border:none;border-radius:9px;font-family:Nunito,sans-serif;font-size:.88rem;font-weight:800;cursor:pointer;">💾 Save Event</button>
        </div>
        ${editId?`<button onclick="APP._delCalEvent('${editId}')" style="width:100%;padding:8px;background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:9px;font-family:Nunito,sans-serif;font-size:.82rem;cursor:pointer;margin-top:4px;">🗑 Delete Event</button>`:''}
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    setTimeout(()=>document.getElementById('_cev_title')?.focus(),100);
  },

  _saveCalEvent(editId){
    const title = (document.getElementById('_cev_title')||{}).value?.trim();
    const date  = (document.getElementById('_cev_date')||{}).value;
    if(!title||!date){ this.showToastMsg('⚠️ Title and date required!'); return; }
    const data = {
      title,
      date,
      time:  (document.getElementById('_cev_time')||{}).value||'',
      type:  (document.getElementById('_cev_type')||{}).value||'📅 Personal',
      color: (document.getElementById('_cev_col_val')||{}).value||'#1565c0',
      note:  (document.getElementById('_cev_note')||{}).value?.trim()||'',
    };
    const arr = this.getCalEvents();
    if(editId){
      const idx = arr.findIndex(e=>e.id===editId);
      if(idx>=0) arr[idx]={...arr[idx],...data};
    } else {
      data.id = uid(); data.created = new Date().toISOString();
      arr.push(data);
    }
    this.saveCalEvents(arr);
    document.getElementById('_calEvModal')?.remove();
    this.renderCalendar();
    this.showToastMsg('✅ Event saved!');
  },

  _delCalEvent(id){
    this.saveCalEvents(this.getCalEvents().filter(e=>e.id!==id));
    document.getElementById('_calEvModal')?.remove();
    this.renderCalendar();
    this.showToastMsg('🗑 Event deleted');
  },

  renderCalendar(){
    const yr=this.calY,mo=this.calM;
    const fd=new Date(yr,mo,1).getDay();
    const dim=new Date(yr,mo+1,0).getDate();
    const today=new Date();
    const evts={};
    const ae=(ds,c,l)=>{if(!ds)return;const d=new Date(ds);if(d.getFullYear()===yr&&d.getMonth()===mo){const k=d.getDate();if(!evts[k])evts[k]=[];evts[k].push({c,l});}};
    this.reminders.forEach(r=>{
      // Use trigDate (actual reminder date) first, fallback to exp for legacy
      const rTrigDate = r.trigDate || (()=>{
        if(r.mode==='recurring') return r.nextTrigger||r.start||null;
        if(!r.exp) return null;
        try{ const d=new Date(r.exp); d.setDate(d.getDate()-parseInt(r.before||0)); return d.toISOString().split('T')[0]; }catch(e){return r.exp;}
      })();
      if(rTrigDate) ae(rTrigDate,'#1a73e8','🔔'); // blue dot on reminder date
      if(r.exp && r.exp!==rTrigDate) ae(r.exp,'#b92d2d','⚠️');  // red dot on expiry
      if(r.issue) ae(r.issue,'#1760a0','📋');
    });
    this.visits.forEach(r=>{ae(r.date,'#1e7a45','💊');ae(r.next,'#5c3496','🏥');ae(r.next2,'#5c3496','🏥');ae(r.next3,'#5c3496','🏥');});
    this.trips.forEach(t=>{ae(t.dep,'#1a6e62','✈️');ae(t.ret,'#8a6500','🏁');});
    this.tenants.forEach(t=>{ae(t.start,'#b5701c','📝');ae(t.end,'#b92d2d','📄');});
    // Custom calendar events
    this.getCalEvents().forEach(ev=>{ae(ev.date, ev.color||'#1565c0', ev.title.slice(0,1)||'📅');});
    const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let cg=DOW.map(d=>`<div class="cal-dow">${d}</div>`).join('');
    for(let i=0;i<fd;i++)cg+=`<div class="cal-day other"></div>`;
    for(let day=1;day<=dim;day++){
      const iT=today.getDate()===day&&today.getMonth()===mo&&today.getFullYear()===yr;
      const evs=evts[day]||[];const hasOvd=evs.some(e=>e.c==='#b92d2d');
      const cls=`cal-day${iT?' today':''}${evs.length&&!iT&&!hasOvd?' has-event':''}${hasOvd?' has-overdue':''}`;
      cg+=`<div class="${cls}" onclick="APP.showCalendarDayPopup(${yr},${mo},${day})" style="cursor:pointer;" title="Click to see events"><div class="cal-day-num">${day}</div><div class="cal-dots">${evs.slice(0,4).map(e=>`<div class="cal-dot" style="background:${e.c}" title="${e.l}"></div>`).join('')}</div></div>`;
    }
    // Events list
    const allEvs=[];
    this.reminders.forEach(r=>{
      // Use trigDate for reminder event, expiry separately
      const rTrigDate = r.trigDate || (()=>{
        if(r.mode==='recurring') return r.nextTrigger||r.start||null;
        if(!r.exp) return null;
        try{ const d=new Date(r.exp); d.setDate(d.getDate()-parseInt(r.before||0)); return d.toISOString().split('T')[0]; }catch(e){return r.exp;}
      })();
      if(rTrigDate){
        const d=new Date(rTrigDate);
        if(d.getFullYear()===yr&&d.getMonth()===mo){
          const hh=r.alertHour||'10'; const mm2=r.alertMin||'00';
          allEvs.push({date:rTrigDate,label:r.name+(r.type?' — '+r.type:''),
            type:'🔔 Reminder'+(hh&&mm2?' at '+hh+':'+mm2:''),icon:'🔔',
            c:daysFrom(rTrigDate)!==null&&daysFrom(rTrigDate)<0?'var(--red)':'#1a73e8',_remId:r.id});
        }
      }
      // Also show expiry if different from trigger date
      if(r.exp && r.exp!==rTrigDate){
        const d=new Date(r.exp);
        if(d.getFullYear()===yr&&d.getMonth()===mo)
          allEvs.push({date:r.exp,label:r.name+' (Expires)',type:'⚠️ Expiry',icon:'⚠️',c:'var(--red)',_remId:r.id});
      }
      if(r.issue){const d=new Date(r.issue);if(d.getFullYear()===yr&&d.getMonth()===mo)allEvs.push({date:r.issue,label:r.name+' (Issue Date)',type:'📋 Issue',icon:'📋',c:'var(--blu)',_remId:r.id});}
    });
    this.visits.forEach(r=>{['date','next','next2','next3'].forEach(f=>{if(r[f]){const d=new Date(r[f]);if(d.getFullYear()===yr&&d.getMonth()===mo){const p=this.patients.find(x=>x.id===r.patId);allEvs.push({date:r[f],label:`${p?p.name:'?'} — Dr.${r.doctor}`,type:f==='date'?'Visit':'Follow-up',icon:f==='date'?'💊':'🏥',c:'var(--grn)',_visitId:r.id});}}});});
    this.trips.forEach(t=>{if(t.dep){const d=new Date(t.dep);if(d.getFullYear()===yr&&d.getMonth()===mo)allEvs.push({date:t.dep,label:`Depart: ${t.dest}`,type:'Travel',icon:'✈️',c:'var(--tel)',_tripId:t.id});}if(t.ret){const d=new Date(t.ret);if(d.getFullYear()===yr&&d.getMonth()===mo)allEvs.push({date:t.ret,label:`Return: ${t.dest}`,type:'Travel',icon:'🏁',c:'var(--ylw)',_tripId:t.id});}});
    // Add custom calendar events
    this.getCalEvents().forEach(ev=>{
      const d=new Date(ev.date);
      if(d.getFullYear()===yr&&d.getMonth()===mo){
        allEvs.push({date:ev.date,label:ev.title+(ev.time?' at '+ev.time:'')+(ev.note?' — '+ev.note:''),type:ev.type||'📅 Personal',icon:ev.type?ev.type.split(' ')[0]:'📅',c:ev.color||'#1565c0',_calEvId:ev.id});
      }
    });
    allEvs.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    const evList=allEvs.map(e=>{
      // Build delete action based on event type
      let delAction='';
      if(e._remId) delAction=`<button class="btn b-red b-sm" style="padding:3px 8px;font-size:.7rem;" onclick="APP.delReminder('${e._remId}')" title="Delete this reminder">🗑</button>`;
      else if(e._visitId) delAction=`<button class="btn b-red b-sm" style="padding:3px 8px;font-size:.7rem;" onclick="APP.delVisit('${e._visitId}')" title="Delete this visit">🗑</button>`;
      else if(e._tripId) delAction=`<button class="btn b-red b-sm" style="padding:3px 8px;font-size:.7rem;" onclick="APP.delTrip('${e._tripId}')" title="Delete this trip">🗑</button>`;
      else if(e._calEvId) delAction=`<button class="btn b-sm" style="padding:3px 8px;font-size:.7rem;background:#e3f2fd;color:#1565c0;border:1px solid #90b8e8;" onclick="APP.openCalEventModal('${e.date}','${e._calEvId}')" title="Edit event">✏️</button><button class="btn b-red b-sm" style="padding:3px 8px;font-size:.7rem;margin-left:3px;" onclick="APP._delCalEvent('${e._calEvId}')" title="Delete event">🗑</button>`;
      return`<div style="display:flex;align-items:center;gap:9px;padding:7px 12px;border-bottom:1px solid var(--bdr)">
        <span>${e.icon}</span>
        <div style="flex:1">
          <div style="font-size:.8rem;font-weight:600">${e.label}</div>
          <div style="font-size:.68rem;color:var(--mut)">${fD(e.date)} · ${e.type}</div>
        </div>
        <span class="badge" style="background:rgba(0,0,0,.05);color:${e.c}">${fD(e.date)}</span>
        ${delAction}
      </div>`;
    }).join('');

    document.getElementById('pan-calendar').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start;">
        <div>
          <div class="cal-wrap">
            <div class="cal-hdr">
              <div class="cal-title">📅 ${MONTHS[mo]} ${yr}</div>
              <div class="cal-nav">
                <button onclick="APP.calM--;if(APP.calM<0){APP.calM=11;APP.calY--;}APP.renderCalendar()">‹ Prev</button>
                <button onclick="APP.calY=new Date().getFullYear();APP.calM=new Date().getMonth();APP.renderCalendar()" style="background:var(--acc);color:#fff;border-color:var(--acc)">Today</button>
                <button onclick="APP.calM++;if(APP.calM>11){APP.calM=0;APP.calY++;}APP.renderCalendar()">Next ›</button>
                <button onclick="APP.openCalEventModal('${new Date(yr,mo,today.getDate()).toISOString().split('T')[0]}')" style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;border-radius:7px;padding:5px 10px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">+ Add Event</button>
              </div>
            </div>
            <div class="cal-grid">${cg}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:.72rem;">
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1a73e8;display:inline-block"></span>Reminder</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#b92d2d;display:inline-block"></span>Expiry</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1760a0;display:inline-block"></span>Issue</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1e7a45;display:inline-block"></span>Dr Visit</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#5c3496;display:inline-block"></span>Follow-up</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1a6e62;display:inline-block"></span>Travel</span>
            <span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:#1565c0;display:inline-block"></span>Personal Events</span>
          </div>
        </div>
        <div class="card" style="max-height:580px;overflow-y:auto;">
          <div class="card-hdr"><div class="card-title">📋 ${MONTHS[mo]} Events</div><span class="ct">${allEvs.length}</span></div>
          ${evList||'<div class="empty" style="padding:24px">No events</div>'}
        </div>
      </div>`;
  },


});

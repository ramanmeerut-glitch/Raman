/* modules/travel.js — Travel — openTravelModal, saveTrip, bucket list, packing list, renderTravel
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
  // ══ TRAVEL ══
  openTravelModal(id,dest){
    this.editId=id||null;document.getElementById('tvMT').textContent=id?'✏️ Edit Trip':'✈️ Add Trip';
    if(id){const t=this.trips.find(x=>x.id===id);['dest','city','type','dom','trans','ticket','hotel','hcity','budget','spent','members','photo','notes'].forEach(f=>sv('tvm_'+f,t[f]));svDate('tvm_dep',t.dep);svDate('tvm_ret',t.ret);}
    else{['city','ticket','hotel','hcity','budget','spent','members','photo','notes'].forEach(f=>sv('tvm_'+f,''));sv('tvm_dest',dest||'');svDate('tvm_dep','');svDate('tvm_ret','');}
    FUM.clear('fu_travel_doc_wrap');
    FUM.init('fu_travel_doc_wrap','travel',[]);
    if(id){const t=this.trips.find(x=>x.id===id);if(t){if(t.docFiles&&t.docFiles.length)FUM.init('fu_travel_doc_wrap','travel',t.docFiles);else if(t.photo)FUM.loadLegacyLinks('fu_travel_doc_wrap',[t.photo]);}}
    M.open('tvM');
  },
  saveTrip(){
    const dest=v('tvm_dest');if(!dest){alert('Destination required!');return;}
    const tvDocFiles=FUM.getFiles('fu_travel_doc_wrap');
    const data={dest,city:v('tvm_city'),type:v('tvm_type'),dom:v('tvm_dom'),dep:vDate('tvm_dep'),ret:vDate('tvm_ret'),trans:v('tvm_trans'),ticket:v('tvm_ticket'),hotel:v('tvm_hotel'),hcity:v('tvm_hcity'),budget:Number(v('tvm_budget')),spent:Number(v('tvm_spent')),members:v('tvm_members'),photo:(tvDocFiles[0]||{}).url||'',docFiles:tvDocFiles,notes:v('tvm_notes')};
    let ts=this.trips;
    if(this.editId)ts=ts.map(t=>t.id===this.editId?{...t,...data}:t);
    else{data.id=uid();ts.push(data);}
    S.set('trips',ts);M.close('tvM');this.renderTravel();this.renderPills();
  },
  delTrip(id){this.delCb=()=>{S.set('trips',this.trips.filter(t=>t.id!==id));this.renderTravel();this.renderPills();};document.getElementById('delMsg').textContent='Delete trip?';M.open('delM');},
  saveBucket(){const dest=v('bkm_dest');if(!dest){alert('Destination required!');return;}const bs=this.buckets;bs.push({id:uid(),dest,pri:v('bkm_pri'),year:v('bkm_year'),notes:v('bkm_notes')});S.set('buckets',bs);M.close('bkM');this.renderTravel();},
  delBucket(id){this.delCb=()=>{S.set('buckets',this.buckets.filter(b=>b.id!==id));this.renderTravel();};document.getElementById('delMsg').textContent='Remove from bucket list?';M.open('delM');},
  setTravelSub(s){this.travelSub=s;this.renderTravel();},

  _packTemplates:{
    Business:['👔 Formal shirts (3)','👖 Trousers (2)','👞 Formal shoes','💼 Laptop & charger','📁 Documents & ID','🪥 Toiletries','💊 Medicines','📱 Phone charger','🔌 Power bank','💳 Cards & cash','🧣 Belt & tie','📓 Notebook & pen'],
    Vacation:['👕 T-shirts (4)','🩳 Shorts/casuals (3)','👟 Comfortable shoes','🩴 Slippers','🧴 Sunscreen','🩱 Swimwear','📷 Camera','🕶️ Sunglasses','🎒 Daypack','💊 Medicines','🪥 Toiletries','💳 Cards & cash','📱 Charger & power bank','🧢 Cap/hat','🌂 Umbrella'],
    Weekend:['👕 T-shirts (2)','👖 Jeans/casual pants','👟 Shoes','🪥 Toiletries','💊 Medicines','📱 Charger','💳 Cards & cash','🕶️ Sunglasses'],
    Family:['👕 Clothes for all','👶 Kids essentials','💊 Medicines & first aid','🧸 Kids toys/games','🪥 Toiletries','📱 Chargers','💳 Cards & cash','📋 ID & documents','🍼 Baby food/snacks','🌂 Umbrella','🎒 Bags'],
    International:['🛂 Passport & visa','✈️ Flight tickets','💳 Cards & forex','💊 Medicines','🪥 Toiletries','👔 Formal + casual clothes','🔌 Universal adapter','📱 Charger & power bank','📁 Travel insurance','💱 Currency','📓 Emergency contacts','🏥 Travel docs']
  },

  openPackingList(tripId){
    const t=this.trips.find(x=>x.id===tripId);
    if(!t) return;
    const KEY='rk_pack_'+tripId;
    let items=[];
    try{ items=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ items=[]; }

    const templates=this._packTemplates;
    const tplNames=Object.keys(templates);

    const render=()=>{
      const checked=items.filter(i=>i.done).length;
      const total=items.length;
      const pct=total?Math.round(checked/total*100):0;
      document.getElementById('_packBody').innerHTML=`
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--mut);margin-bottom:4px;">
            <span>${checked}/${total} packed</span><span>${pct}%</span>
          </div>
          <div style="background:var(--bdr);border-radius:4px;height:6px;overflow:hidden;">
            <div style="background:${pct===100?'#1a7a45':'#2c6fad'};width:${pct}%;height:100%;border-radius:4px;transition:width .3s;"></div>
          </div>
          ${pct===100?'<div style="text-align:center;margin-top:6px;font-size:.82rem;color:#1a7a45;font-weight:800;">🎉 All packed! Ready to go!</div>':''}
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
          <input id="_packNewItem" placeholder="Add item…" style="flex:1;min-width:120px;border:1.5px solid var(--bdr2);border-radius:7px;padding:5px 9px;font-family:'Nunito',sans-serif;font-size:.8rem;background:var(--bg);">
          <button onclick="(function(){var el=document.getElementById('_packNewItem');var txt=el?el.value.trim():'';if(!txt)return;var arr=JSON.parse(localStorage.getItem('${KEY}')||'[]');arr.push({id:'p'+Date.now(),label:txt,done:false});localStorage.setItem('${KEY}',JSON.stringify(arr));APP.openPackingList('${tripId}');})()" style="background:#2c6fad;color:#fff;border:none;border-radius:7px;padding:5px 12px;font-size:.8rem;font-weight:700;cursor:pointer;">＋ Add</button>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">
          ${tplNames.map(tp=>`<button onclick="APP._applyPackTemplate('${tripId}','${tp}')" style="font-size:.65rem;padding:3px 9px;border-radius:10px;border:1.5px solid var(--acc);background:var(--card);color:var(--acc);font-weight:700;cursor:pointer;">📋 ${tp}</button>`).join('')}
          <button onclick="(function(){if(!confirm('Clear all items?'))return;localStorage.setItem('${KEY}','[]');APP.openPackingList('${tripId}');})()" style="font-size:.65rem;padding:3px 9px;border-radius:10px;border:1.5px solid #e05050;background:var(--card);color:#e05050;font-weight:700;cursor:pointer;margin-left:auto;">🗑 Clear</button>
        </div>
        ${items.length?items.map(i=>`
          <div class="pack-item ${i.done?'packed':''}" style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid var(--bdr);">
            <input type="checkbox" class="pack-check" ${i.done?'checked':''} onchange="(function(){var arr=JSON.parse(localStorage.getItem('${KEY}')||'[]');var idx=arr.findIndex(x=>x.id==='${i.id}');if(idx>=0)arr[idx].done=!arr[idx].done;localStorage.setItem('${KEY}',JSON.stringify(arr));APP.openPackingList('${tripId}');})()" >
            <span class="pack-text" style="flex:1;font-size:.83rem;${i.done?'text-decoration:line-through;color:var(--mut);':''}">${i.label}</span>
            <button onclick="(function(){var arr=JSON.parse(localStorage.getItem('${KEY}')||'[]').filter(x=>x.id!=='${i.id}');localStorage.setItem('${KEY}',JSON.stringify(arr));APP.openPackingList('${tripId}');})()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;padding:2px 5px;">🗑</button>
          </div>`).join(''):'<div style="text-align:center;padding:20px;color:var(--mut);font-size:.83rem;">📦 No items yet — tap a template or add items above</div>'}
      `;
    };

    // Create or reuse modal
    let modal=document.getElementById('_packModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='_packModal';
      modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
      modal.innerHTML=`<div style="width:100%;max-width:500px;background:#fff;border-radius:20px 20px 0 0;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid #e9ecef;">
          <div style="font-weight:800;font-size:1rem;">🎒 Packing List — ${t.dest}</div>
          <button onclick="document.getElementById('_packModal').remove()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#6c757d;">✕</button>
        </div>
        <div id="_packBody" style="overflow-y:auto;padding:14px 16px;flex:1;"></div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
    } else {
      document.querySelector('#_packModal > div > div:first-child > div').textContent='🎒 Packing List — '+t.dest;
    }
    render();
    modal.style.display='flex';
  },

  _applyPackTemplate(tripId, tplName){
    const KEY='rk_pack_'+tripId;
    const tpl=this._packTemplates[tplName]||[];
    let items=[];
    try{ items=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ items=[]; }
    const existing=new Set(items.map(i=>i.label.toLowerCase()));
    tpl.forEach(label=>{
      if(!existing.has(label.toLowerCase())) items.push({id:'p'+Date.now()+Math.random().toString(36).slice(2),label,done:false});
    });
    localStorage.setItem(KEY,JSON.stringify(items));
    this.openPackingList(tripId);
  },

  renderTravel(){
    const s=this.travelSub;const now=new Date();
    const tI={Flight:'✈️',Train:'🚆',Car:'🚗',Bus:'🚌',Cruise:'🛳️'};
    const searchBar=`
      <div class="sbar" style="margin-bottom:8px;">
        <input type="text" id="tvQ" placeholder="🔍 Destination, city, hotel…" oninput="APP.filterTravel()" style="min-width:180px">
        <select id="tvTF" onchange="APP.filterTravel()"><option value="">All Transport</option><option>Flight</option><option>Train</option><option>Car</option><option>Bus</option><option>Cruise</option></select>
        <select id="tvDF" onchange="APP.filterTravel()"><option value="">All</option><option value="Domestic">Domestic</option><option value="International">International</option></select>
      </div>
      <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
        <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:.72rem;color:var(--mut);font-weight:600;">From</span>
          <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="tvD1_txt" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('tvD1');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}APP.filterTravel();})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;"><span onclick="document.getElementById('tvD1').showPicker&&document.getElementById('tvD1').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="tvD1" onchange="(function(iso){var el=document.getElementById('tvD1_txt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}APP.filterTravel();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
          <span style="font-size:.72rem;color:var(--mut);font-weight:600;">To</span>
          <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="tvD2_txt" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('tvD2');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}APP.filterTravel();})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;"><span onclick="document.getElementById('tvD2').showPicker&&document.getElementById('tvD2').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="tvD2" onchange="(function(iso){var el=document.getElementById('tvD2_txt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}APP.filterTravel();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
        </div>
      </div>`;

    const tripCard=t=>{
      const d=daysFrom(t.dep);const isPast=t.ret&&new Date(t.ret)<now;
      return`<div class="card">
        <div class="card-hdr"><div class="card-title">${tI[t.trans]||'🌍'} ${t.dest}</div>
          <span class="badge ${isPast?'bm':d!==null&&d<=7?'by':'bb'}">${isPast?'Completed':d!==null?d+'d away':'Upcoming'}</span></div>
        <div class="card-body">
          <div class="fr"><span class="fl">Type</span><span class="badge bt">${t.type}</span> <span class="badge ${t.dom==='International'?'bp':'bb'}">${t.dom||'Domestic'}</span></div>
          <div class="fr"><span class="fl">City</span><span class="fv">${t.city||t.dest}</span></div>
          <div class="fr"><span class="fl">Dates</span><span class="mono" style="font-size:.78rem">${fD(t.dep)} → ${fD(t.ret)}</span></div>
          <div class="fr"><span class="fl">Transport</span><span class="fv">${tI[t.trans]||''} ${t.trans}</span></div>
          ${t.ticket?`<div class="fr"><span class="fl">Ticket/PNR</span><span class="mono" style="font-size:.78rem">${t.ticket}</span></div>`:''}
          <div class="fr"><span class="fl">Stay</span><span class="fv">${t.hotel||'—'}${t.hcity?' ('+t.hcity+')':''}</span></div>
          <div class="fr"><span class="fl">Members</span><span class="fv" style="font-size:.78rem">${t.members||'—'}</span></div>
          <div class="fr"><span class="fl">Budget</span><span class="mono">${fmt(t.budget)}</span></div>
          ${t.spent?`<div class="fr"><span class="fl">Spent</span><span class="mono" style="color:${t.spent>t.budget?'var(--red)':'var(--grn)'}">${fmt(t.spent)}</span></div>`:''}
          ${(t.docFiles&&t.docFiles.length)?t.docFiles.map(f=>`<div class="fr"><span class="fl">📎 Doc</span><a href="${f.url}" target="_blank" style="color:var(--acc);font-size:.76rem">${f.name||'Open'}</a></div>`).join(''):(t.photo?`<div class="fr"><span class="fl">📎 Doc/Photo</span><a href="${t.photo}" target="_blank" style="color:var(--acc);font-size:.76rem">Open</a></div>`:''  )}
          ${t.notes?`<div style="font-size:.76rem;color:var(--mut);margin-top:3px;word-break:break-word;">${APP.autoLink(t.notes)}</div>`:''}
        </div>
        <div class="card-foot">
          <button class="btn b-out b-sm" onclick="APP.openTravelModal('${t.id}')">✏️ Edit</button>
          <button class="btn b-sm" style="background:#f0faf5;color:#1a7a45;border:1.5px solid #90c8a0;font-weight:700;" onclick="APP.openPackingList('${t.id}')">🎒 Packing</button>
          <button class="btn b-sm" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:700;" onclick="APP._itinDay=null;APP.openItinerary('${t.id}')">🗺️ Itinerary</button>
        </div>
      </div>`;
    };

    const upcoming=this.trips.filter(t=>!t.ret||new Date(t.ret)>=now).sort((a,b)=>new Date(a.dep)-new Date(b.dep));
    const past=this.trips.filter(t=>t.ret&&new Date(t.ret)<now).sort((a,b)=>new Date(b.dep)-new Date(a.dep));
    const priL={high:'🔴 High',medium:'🟡 Medium',low:'🟢 Low'};
    const bkCards=this.buckets.map(b=>`<div class="card"><div class="card-hdr"><div class="card-title">🌟 ${b.dest}</div><span class="badge ${b.pri==='high'?'br':b.pri==='medium'?'by':'bg'}">${priL[b.pri]}</span></div>
      <div class="card-body">${b.year?`<div class="fr"><span class="fl">Target</span><span class="mono">${b.year}</span></div>`:''}${b.notes?`<div style="font-size:.78rem;color:var(--mut);word-break:break-word;">${APP.autoLink(b.notes)}</div>`:''}</div>
      <div class="card-foot"><button class="btn b-gold b-sm" onclick="APP.openTravelModal(null,'${b.dest}')">Plan Trip</button></div>
    </div>`).join('');

    let main='';
    if(s==='upcoming')main=searchBar+`<div class="grid" id="tvGrid">${upcoming.map(tripCard).join('')||'<div class="empty"><div class="ei">✈️</div>No upcoming trips</div>'}</div>`;
    if(s==='past')main=searchBar+`<div class="grid" id="tvGrid">${past.map(tripCard).join('')||'<div class="empty"><div class="ei">🌏</div>No past trips</div>'}</div>`;
    if(s==='bucket')main=`<div class="sec-hdr" style="margin-bottom:10px"><div></div><button class="btn b-out b-sm" onclick="M.open('bkM')">+ Add Destination</button></div><div class="grid">${bkCards||'<div class="empty"><div class="ei">🗺️</div>Add dream destinations!</div>'}</div>`;

    document.getElementById('pan-travel').innerHTML=`
      <div class="sec-hdr"><div class="sec-title">Travel Planner <span class="ct">${this.trips.length}</span></div><button class="btn b-gold" onclick="APP.openTravelModal()">+ Add Trip</button></div>
      <div class="stabs">
        <button class="stab ${s==='upcoming'?'on':''}" onclick="APP.setTravelSub('upcoming')">✈️ Upcoming (${upcoming.length})</button>
        <button class="stab ${s==='past'?'on':''}" onclick="APP.setTravelSub('past')">🌏 Past (${past.length})</button>
        <button class="stab ${s==='bucket'?'on':''}" onclick="APP.setTravelSub('bucket')">🌟 Bucket List (${this.buckets.length})</button>
      </div>${main}`;
  },

  filterTravel(){
    const q=(document.getElementById('tvQ')?.value||'').toLowerCase();
    const tf=document.getElementById('tvTF')?.value||'';
    const df=document.getElementById('tvDF')?.value||'';
    const d1=document.getElementById('tvD1')?.value||'';
    const d2=document.getElementById('tvD2')?.value||'';
    const now=new Date();
    const s=this.travelSub;
    let list=s==='upcoming'?this.trips.filter(t=>!t.ret||new Date(t.ret)>=now):this.trips.filter(t=>t.ret&&new Date(t.ret)<now);
    list=list.filter(t=>{
      const mq=!q||(t.dest+t.city+t.hotel+t.hcity+t.trans+t.members+t.ticket).toLowerCase().includes(q);
      return mq&&(!tf||t.trans===tf)&&(!df||t.dom===df)&&(!d1||t.dep>=d1)&&(!d2||t.dep<=d2);
    });
    const tI={Flight:'✈️',Train:'🚆',Car:'🚗',Bus:'🚌',Cruise:'🛳️'};
    const g=document.getElementById('tvGrid');
    if(!g)return;
    g.innerHTML=list.map(t=>{const d=daysFrom(t.dep);const isPast=t.ret&&new Date(t.ret)<now;
      return`<div class="card"><div class="card-hdr"><div class="card-title">${tI[t.trans]||'🌍'} ${t.dest}</div><span class="badge ${isPast?'bm':d!==null&&d<=7?'by':'bb'}">${isPast?'Completed':d!==null?d+'d away':'Upcoming'}</span></div>
        <div class="card-body">
          <div class="fr"><span class="fl">City</span><span class="fv">${t.city||t.dest}</span></div>
          <div class="fr"><span class="fl">Dates</span><span class="mono" style="font-size:.78rem">${fD(t.dep)} → ${fD(t.ret)}</span></div>
          <div class="fr"><span class="fl">Transport</span><span class="fv">${tI[t.trans]||''} ${t.trans}</span></div>
          ${t.ticket?`<div class="fr"><span class="fl">Ticket</span><span class="mono">${t.ticket}</span></div>`:''}
          <div class="fr"><span class="fl">Hotel</span><span class="fv">${t.hotel||'—'}${t.hcity?' ('+t.hcity+')':''}</span></div>
          ${t.photo?`<div class="fr"><span class="fl">📎 File</span><a href="${t.photo}" target="_blank" style="color:var(--acc);font-size:.76rem">Open</a></div>`:''}
        </div>
        <div class="card-foot"><button class="btn b-out b-sm" onclick="APP.openTravelModal('${t.id}')">✏️ Edit</button></div>
      </div>`;
    }).join('')||'<div class="empty"><div class="ei">🔍</div>No results</div>';
  },


});

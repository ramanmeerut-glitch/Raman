  // ══ MEDICAL ══
  savePatient(){
    const name=v('ptm_name');if(!name){alert('Name required!');return;}
    const data={name,relation:v('ptm_rel'),dob:vDate('ptm_dob')||v('ptm_dob'),blood:v('ptm_blood'),cond:v('ptm_cond'),emg:v('ptm_emg'),ins:v('ptm_ins')};
    let ps=this.patients;
    if(this.editPatId){
      ps=ps.map(p=>p.id===this.editPatId?{...p,...data}:p);
      this.editPatId=null;
    } else {
      data.id=uid();ps.push(data);
    }
    S.set('patients',ps);M.close('patM');
    ['ptm_name','ptm_rel','ptm_cond','ptm_emg','ptm_ins'].forEach(f=>sv(f,''));
    sv('ptm_blood','');svDate('ptm_dob','');
    this.renderMedical();
  },
  openPatientModal(id){
    this.editPatId=id||null;
    document.getElementById('patMT').textContent=id?'✏️ Edit Patient':'👤 Add Patient / Family Member';
    if(id){
      const p=this.patients.find(x=>x.id===id);
      if(p){
        sv('ptm_name',p.name);sv('ptm_rel',p.relation||'');sv('ptm_blood',p.blood||'');
        sv('ptm_cond',p.cond||'');sv('ptm_emg',p.emg||'');sv('ptm_ins',p.ins||'');
        // handle dob — it might be text or ISO
        const dobIso=p.dob?(p.dob.includes('-')?p.dob:dmyToIso(p.dob)||''):'';
        svDate('ptm_dob',dobIso);
      }
    } else {
      ['ptm_name','ptm_rel','ptm_cond','ptm_emg','ptm_ins'].forEach(f=>sv(f,''));
      sv('ptm_blood','');svDate('ptm_dob','');
    }
    M.open('patM');
  },
  delPatient(id){
    this.delCb=()=>{S.set('patients',this.patients.filter(p=>p.id!==id));S.set('visits',this.visits.filter(r=>r.patId!==id));this.curPatient='all';this.renderMedical();};
    document.getElementById('delMsg').textContent='Delete patient and all records?';M.open('delM');
  },

  // Custom medical visit types
  _addCustomVisitType(){
    const name=prompt('Enter custom visit type name:','');
    if(!name||!name.trim()) return;
    let types; try{ types=JSON.parse(localStorage.getItem('rk_visit_types')||'[]'); }catch{ types=[]; }
    if(types.includes(name.trim())){alert('Already exists!');return;}
    types.push(name.trim());
    localStorage.setItem('rk_visit_types',JSON.stringify(types));
    this._loadVisitTypes(name.trim());
    this.showToastMsg('✅ Visit type "'+name.trim()+'" added!');
  },
  _loadVisitTypes(selectVal){
    const sel=document.getElementById('mdm_type');
    if(!sel) return;
    let custom; try{ custom=JSON.parse(localStorage.getItem('rk_visit_types')||'[]'); }catch{ custom=[]; }
    // Add custom types not already in list
    custom.forEach(t=>{
      if(!Array.from(sel.options).find(o=>o.value===t)){
        const opt=document.createElement('option');
        opt.value=t;opt.textContent=t;
        sel.appendChild(opt);
      }
    });
    if(selectVal) sel.value=selectVal;
  },

  openMedModal(id,patientId){
    this.editId=id||null;
    document.getElementById('medMT').textContent=id?'✏️ Edit Visit':'🏥 Add Doctor Visit';
    const ps=this.patients;
    document.getElementById('mdm_pat').innerHTML=ps.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    if(!ps.length){alert('Please add a patient first!');return;}
    if(id){
      const r=this.visits.find(x=>x.id===id);
      // Auto-fill patient
      document.getElementById('mdm_pat').value=r.patId||'';
      // Safe fill — try both field name variants (doctor / doc)
      ['type','spec','hosp','city','purpose','meds','vitals','labname','labdate','labres','notes'].forEach(f=>{
        try{sv('mdm_'+f,r[f]||'');}catch(e){}
      });
      // Doctor field: check both 'doc' and 'doctor'
      try{ sv('mdm_doc', r.doc||r.doctor||''); }catch(e){}
      svDate('mdm_date',r.date);
      // Fix: handle next date in both ISO and DD/MM/YYYY format
      if(r.next){
        const nd=r.next.includes('-')?r.next:dmyToIso(r.next);
        svDate('mdm_next',nd||r.next);
      } else { svDate('mdm_next',''); }
    } else {
      ['doc','spec','hosp','city','purpose','meds','vitals','labname','labdate','labres','notes'].forEach(f=>sv('mdm_'+f,''));
      svDate('mdm_date',(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})());
      svDate('mdm_next','');
      // Pre-select patient if coming from patient card
      if(patientId) document.getElementById('mdm_pat').value=patientId;
      else if(this.curPatient&&this.curPatient!=='all') document.getElementById('mdm_pat').value=this.curPatient;
    }
    // Init Firebase upload zones
    FUM.clear('fu_med_pres_wrap'); FUM.clear('fu_med_lab_wrap');
    FUM.init('fu_med_pres_wrap','medical',[]);
    FUM.init('fu_med_lab_wrap','medical',[]);
    if(id){
      const r=this.visits.find(x=>x.id===id);
      if(r.presFiles&&r.presFiles.length) FUM.init('fu_med_pres_wrap','medical',r.presFiles);
      else if(r.link) FUM.loadLegacyLinks('fu_med_pres_wrap',[r.link]);
      if(r.labFiles&&r.labFiles.length) FUM.init('fu_med_lab_wrap','medical',r.labFiles);
      else { const lls=[r.lablink,r.lablink2,r.lablink3].filter(Boolean); if(lls.length) FUM.loadLegacyLinks('fu_med_lab_wrap',lls); }
    }
    this._loadVisitTypes();
    M.open('medM');
  },
  saveMedRecord(){
    try {
      const pat=v('mdm_pat'),date=vDate('mdm_date')||v('mdm_date');
      if(!pat||!date){alert('Patient aur date zaroori hai!');return;}
      const nextRaw=vDate('mdm_next')||v('mdm_next');
      const nextIso=nextRaw?(nextRaw.includes('-')?nextRaw:(dmyToIso&&dmyToIso(nextRaw))||nextRaw):'';
      const presFiles=FUM.getFiles('fu_med_pres_wrap')||[];
      const labFiles=FUM.getFiles('fu_med_lab_wrap')||[];

      // Safe field read with fallback — fix doctor name disappearing
      const safeV=(id)=>{try{const el=document.getElementById(id);return el?el.value.trim():'';}catch(e){return '';}};

      const data={
        patId:pat,
        type:safeV('mdm_type'),
        doctor:safeV('mdm_doc'),      // ← explicit field name 'doctor'
        doc:safeV('mdm_doc'),         // ← keep both for legacy compat
        spec:safeV('mdm_spec'),
        hospital:safeV('mdm_hosp'),
        city:safeV('mdm_city'),
        date,
        next:nextIso,
        purpose:safeV('mdm_purpose'),
        meds:safeV('mdm_meds'),
        vitals:safeV('mdm_vitals'),
        labname:safeV('mdm_labname'),
        labdate:safeV('mdm_labdate'),
        labres:safeV('mdm_labres'),
        notes:safeV('mdm_notes'),
        presFiles,
        labFiles,
        link:(presFiles[0]||{}).url||'',
        lablink:(labFiles[0]||{}).url||'',
        lablink2:(labFiles[1]||{}).url||'',
        lablink3:(labFiles[2]||{}).url||''
      };

      // Safe merge: do NOT lose fields not in form
      let vs=this.visits;
      if(this.editId){
        vs=vs.map(r=>{
          if(r.id!==this.editId) return r;
          // Merge: existing fields preserved, new fields overwrite
          const merged={...r,...data};
          // Ensure doctor not lost — pick non-empty value
          if(!data.doctor&&r.doctor) merged.doctor=r.doctor;
          if(!data.doc&&r.doc) merged.doc=r.doc;
          return merged;
        });
      } else {
        data.id=uid();
        vs.push(data);
      }
      S.set('visits',vs);
      M.close('medM');
      this.renderMedical();
      this.renderPills();
      this.showToastMsg(this.editId?'✅ Medical record updated!':'✅ Medical record saved!');
    } catch(err) {
      console.error('saveMedRecord error:',err);
      alert('Save error: '+err.message);
    }
  },
  delVisit(id){
    this.delCb=()=>{S.set('visits',this.visits.filter(r=>r.id!==id));this.renderMedical();};
    document.getElementById('delMsg').textContent='Delete this medical record?';M.open('delM');
  },

  // ── Mark follow-up as complete — clears next date, keeps visit record ──
  _medCompleteFollowup(visitId){
    const v=this.visits.find(x=>x.id===visitId);
    if(!v) return;
    const patName=(this.patients.find(p=>p.id===v.patId)||{}).name||'Patient';
    const nextDate=v.next?` (${fD(v.next)})`:'';
    // Confirm
    if(!confirm(`Mark follow-up${nextDate} as DONE for ${patName}?\n\nThis will clear the follow-up date. The visit record stays.`)) return;
    const updated=this.visits.map(x=>x.id===visitId?{...x,next:'',next2:'',next3:'',followupDone:true,followupDoneAt:new Date().toISOString()}:x);
    S.set('visits',updated);
    this.renderMedical();
    this.renderPills();
    this.showToastMsg('✅ Follow-up marked done for '+patName+'!');
  },


  // ══ VITALS TRACKER ══
  getVitals(patId){ try{ return JSON.parse(localStorage.getItem('rk_vitals_'+patId)||'[]'); }catch{ return []; } },
  saveVitals(patId,arr){ localStorage.setItem('rk_vitals_'+patId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('vitals_'+patId,arr).catch(()=>{}); },

  openVitalsModal(patId){
    const pat=this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const vitals=this.getVitals(patId);
    const today=new Date().toISOString().split('T')[0];

    const renderModal=()=>{
      const vs=this.getVitals(patId);
      // Build mini SVG sparkline for each metric
      const metric=(label,key,unit,color)=>{
        const pts=vs.filter(v=>v[key]!==undefined&&v[key]!=='').map(v=>({d:v.date,v:parseFloat(v[key])})).filter(v=>!isNaN(v.v)).slice(-10);
        if(!pts.length) return '';
        const vals=pts.map(p=>p.v);
        const mn=Math.min(...vals),mx=Math.max(...vals);
        const W=160,H=40;
        const sx=i=>pts.length<2?W/2:Math.round(i*(W-10)/(pts.length-1))+5;
        const sy=v=>mx===mn?H/2:Math.round(H-((v-mn)/(mx-mn))*(H-8)-4);
        const path=pts.map((p,i)=>(i===0?'M':'L')+sx(i)+','+sy(p.v)).join(' ');
        const last=vals[vals.length-1];
        return `<div style="background:var(--card);border:1.5px solid ${color}30;border-radius:10px;padding:10px 12px;flex:1;min-width:140px;">
          <div style="font-size:.68rem;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${label}</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--txt);margin-bottom:4px;">${last} <span style="font-size:.65rem;font-weight:600;color:var(--mut);">${unit}</span></div>
          <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:36px;overflow:visible;">
            <polyline points="${pts.map((p,i)=>sx(i)+','+sy(p.v)).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${pts.map((p,i)=>`<circle cx="${sx(i)}" cy="${sy(p.v)}" r="3" fill="${color}"/>`).join('')}
          </svg>
          <div style="font-size:.58rem;color:var(--mut);margin-top:2px;">${pts.length} readings · Last: ${fD(pts[pts.length-1].d)}</div>
        </div>`;
      };

      const charts=[
        metric('BP (Systolic)','bp_sys','mmHg','#e05050'),
        metric('BP (Diastolic)','bp_dia','mmHg','#e09050'),
        metric('Sugar — Fasting','sugar_fast','mg/dL','#e09050'),
        metric('Sugar — After Meal','sugar_post','mg/dL','#c47c00'),
        metric('Weight','weight','kg','#2c6fad'),
        metric('Pulse','pulse','bpm','#1a7a45'),
        metric('SpO2','spo2','%','#5c3496'),
      ].filter(Boolean).join('');

      const rows=vs.slice().reverse().slice(0,20).map(v=>{
        const sugarDisp=v.sugar_fast||v.sugar_pre||v.sugar_post
          ?[v.sugar_fast?'F:'+v.sugar_fast:'',v.sugar_pre?'Bf:'+v.sugar_pre:'',v.sugar_post?'Af:'+v.sugar_post:''].filter(Boolean).join(' ')
          :(v.sugar||'—');
        const sugarColor=v.sugar_post&&Number(v.sugar_post)>200?'#c0392b':v.sugar_post&&Number(v.sugar_post)>140?'#c47c00':'inherit';
        return `<tr>
          <td style="font-size:.72rem;white-space:nowrap;">${fD(v.date)}${v.time?'<br><span style="font-size:.6rem;color:var(--mut);">⏰ '+v.time+'</span>':''}</td>
          <td class="mono" style="font-size:.72rem;">${v.bp_sys&&v.bp_dia?`<span style="color:${Number(v.bp_sys)>140?'#c0392b':'inherit'}">${v.bp_sys}/${v.bp_dia}</span>`:'—'}</td>
          <td class="mono" style="font-size:.7rem;color:${sugarColor};">${sugarDisp}</td>
          <td class="mono" style="font-size:.72rem;">${v.weight||'—'}</td>
          <td class="mono" style="font-size:.72rem;">${v.pulse||'—'}</td>
          <td class="mono" style="font-size:.72rem;">${v.spo2||'—'}</td>
          <td><button onclick="(function(){var arr=APP.getVitals('${patId}').filter(x=>x.id!=='${v.id}');APP.saveVitals('${patId}',arr);APP.openVitalsModal('${patId}');})()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;">🗑</button></td>
        </tr>`;}).join('');

      const body=document.getElementById('_vitBody');
      if(!body) return;
      body.innerHTML=`
        ${charts?`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">${charts}</div>`:''}
        <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
          <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">➕ Add New Reading</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:10px;">
            <div><label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Date</label>
              <input type="date" id="_vit_date" value="${today}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">⏰ Time</label>
              <input type="time" id="_vit_time" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:#e05050;display:block;margin-bottom:3px;">❤️ BP Systolic</label>
              <input type="number" id="_vit_bps" placeholder="120" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:#e09050;display:block;margin-bottom:3px;">❤️ BP Diastolic</label>
              <input type="number" id="_vit_bpd" placeholder="80" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div style="grid-column:span 2;background:#fff8ee;border:1.5px solid #e8a060;border-radius:8px;padding:8px 10px;">
              <label style="font-size:.68rem;font-weight:800;color:#b56a00;display:block;margin-bottom:6px;">🩸 Blood Sugar (mg/dL)</label>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
                <div><label style="font-size:.6rem;font-weight:700;color:#b56a00;display:block;margin-bottom:2px;">Fasting</label>
                  <input type="number" id="_vit_sug_fast" placeholder="90" style="width:100%;border:1.5px solid #e8a060;border-radius:5px;padding:4px 6px;font-family:Nunito,sans-serif;font-size:.78rem;background:#fff;"></div>
                <div><label style="font-size:.6rem;font-weight:700;color:#c47c00;display:block;margin-bottom:2px;">Before Meal</label>
                  <input type="number" id="_vit_sug_pre" placeholder="110" style="width:100%;border:1.5px solid #e8a060;border-radius:5px;padding:4px 6px;font-family:Nunito,sans-serif;font-size:.78rem;background:#fff;"></div>
                <div><label style="font-size:.6rem;font-weight:700;color:#e09050;display:block;margin-bottom:2px;">After Meal (2hr)</label>
                  <input type="number" id="_vit_sug_post" placeholder="140" style="width:100%;border:1.5px solid #e8a060;border-radius:5px;padding:4px 6px;font-family:Nunito,sans-serif;font-size:.78rem;background:#fff;"></div>
              </div>
            </div>
            <div><label style="font-size:.68rem;font-weight:700;color:#2c6fad;display:block;margin-bottom:3px;">⚖️ Weight (kg)</label>
              <input type="number" id="_vit_wt" placeholder="70" step="0.1" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:#1a7a45;display:block;margin-bottom:3px;">💓 Pulse (bpm)</label>
              <input type="number" id="_vit_pul" placeholder="72" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
            <div><label style="font-size:.68rem;font-weight:700;color:#5c3496;display:block;margin-bottom:3px;">💨 SpO2 (%)</label>
              <input type="number" id="_vit_spo" placeholder="98" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:5px 8px;font-family:Nunito,sans-serif;font-size:.79rem;background:var(--bg);"></div>
          </div>
          <button onclick="APP._saveVitalEntry('${patId}')" style="background:linear-gradient(135deg,#1a7a45,#2c6fad);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-family:Nunito,sans-serif;font-size:.85rem;font-weight:800;cursor:pointer;width:100%;letter-spacing:.01em;">💾 Save Reading</button>
        </div>
        ${vs.length?`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.78rem;">
          <thead><tr style="background:var(--card2);"><th style="padding:6px 8px;text-align:left;font-size:.62rem;color:var(--mut);text-transform:uppercase;">Date</th><th style="padding:6px 8px;font-size:.62rem;color:var(--mut);">BP</th><th style="padding:6px 8px;font-size:.62rem;color:#c47c00;">🩸 Sugar (F/Bf/Af)</th><th style="padding:6px 8px;font-size:.62rem;color:var(--mut);">Weight</th><th style="padding:6px 8px;font-size:.62rem;color:var(--mut);">Pulse</th><th style="padding:6px 8px;font-size:.62rem;color:var(--mut);">SpO2</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>`:'<div style="text-align:center;padding:20px;color:var(--mut);font-size:.83rem;">No readings yet — add your first reading above</div>'}
      `;
    };

    let modal=document.getElementById('_vitModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='_vitModal';
      modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
      modal.innerHTML=`<div style="width:100%;max-width:720px;background:#fff;border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;border-bottom:1px solid #e9ecef;flex-shrink:0;flex-wrap:wrap;gap:8px;">
          <div style="font-weight:800;font-size:1rem;">📊 Vitals — ${pat.name}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <button onclick="APP._vitDownloadPDF('${patId}')" style="background:#fff0f0;color:#c0392b;border:1.5px solid #f09090;border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;">📄 PDF</button>${APP._pdfOriHtml()}
            <button onclick="APP._vitDownloadWord('${patId}')" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;">📝 Word</button>
            <button onclick="APP._vitDownloadExcel('${patId}')" style="background:#e8f5e9;color:#2e7d32;border:1.5px solid #90c8a0;border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;">📊 Excel</button>
            <button onclick="document.getElementById('_vitModal').remove()" style="background:#f0f2f5;border:none;width:30px;height:30px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:#6c757d;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
        </div>
        <div id="_vitBody" style="overflow-y:auto;padding:14px 16px;flex:1;"></div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
    }
    renderModal();
    modal.style.display='flex';
  },

  _saveVitalEntry(patId){
    const get=id=>{ const el=document.getElementById(id); return el?el.value.trim():''; };
    const date=get('_vit_date');
    if(!date){ this.showToastMsg('⚠️ Date required!'); return; }
    const entry={
      id:'v'+Date.now(), date,
      time:get('_vit_time'),
      bp_sys:get('_vit_bps'), bp_dia:get('_vit_bpd'),
      sugar_fast:get('_vit_sug_fast'),
      sugar_pre:get('_vit_sug_pre'),
      sugar_post:get('_vit_sug_post'),
      // Legacy field — use first non-empty sugar value
      sugar:get('_vit_sug_fast')||get('_vit_sug_pre')||get('_vit_sug_post')||'',
      weight:get('_vit_wt'), pulse:get('_vit_pul'), spo2:get('_vit_spo')
    };
    if(!entry.bp_sys&&!entry.bp_dia&&!entry.sugar_fast&&!entry.sugar_pre&&!entry.sugar_post&&!entry.weight&&!entry.pulse&&!entry.spo2){
      this.showToastMsg('⚠️ Enter at least one value!'); return;
    }
    const arr=this.getVitals(patId);
    arr.push(entry);
    arr.sort((a,b)=>a.date.localeCompare(b.date));
    this.saveVitals(patId,arr);
    this.showToastMsg('✅ Vitals saved!');
    this.openVitalsModal(patId);
  },

  // ══ VITALS REPORT — PDF (Print) ══
  _vitDownloadPDF(patId){
    const pat=this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const vs=this.getVitals(patId).sort((a,b)=>a.date.localeCompare(b.date));
    if(!vs.length){ this.showToastMsg('⚠️ No vitals data to export!'); return; }

    // Build inline SVG charts for each metric
    const mkChart=(label,key1,key2,color1,color2,unit)=>{
      const pts1=vs.filter(v=>v[key1]!==undefined&&v[key1]!=='').map(v=>({d:v.date,v:parseFloat(v[key1])})).filter(v=>!isNaN(v.v));
      const pts2=key2?vs.filter(v=>v[key2]!==undefined&&v[key2]!=='').map(v=>({d:v.date,v:parseFloat(v[key2])})).filter(v=>!isNaN(v.v)):[];
      if(!pts1.length&&!pts2.length) return '';
      const allPts=[...pts1,...pts2];
      const allVals=allPts.map(p=>p.v);
      const mn=Math.min(...allVals)-5, mx=Math.max(...allVals)+5;
      const W=500,H=100,PAD=10;
      const allDates=[...new Set(vs.map(v=>v.date))].sort();
      const sx=d=>allDates.length<2?W/2:Math.round((allDates.indexOf(d))*(W-PAD*2)/(allDates.length-1))+PAD;
      const sy=v=>Math.round(H-((v-mn)/(mx-mn||1))*(H-PAD*2)-PAD);
      const line=(pts,col)=>pts.length<1?'':
        `<polyline points="${pts.map(p=>sx(p.d)+','+sy(p.v)).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
         ${pts.map(p=>`<circle cx="${sx(p.d)}" cy="${sy(p.v)}" r="4" fill="${col}" stroke="white" stroke-width="1.5"/>
           <text x="${sx(p.d)}" y="${sy(p.v)-8}" text-anchor="middle" font-size="10" fill="${col}" font-family="Arial">${p.v}</text>`).join('')}`;
      // x-axis date labels (show every nth)
      const step=Math.max(1,Math.floor(allDates.length/6));
      const xLabels=allDates.filter((_,i)=>i%step===0||i===allDates.length-1)
        .map(d=>`<text x="${sx(d)}" y="${H+18}" text-anchor="middle" font-size="9" fill="#888" font-family="Arial">${fD(d)}</text>`).join('');
      return `<div style="margin-bottom:18px;">
        <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:4px;">${label} (${unit})</div>
        <svg viewBox="0 0 ${W} ${H+25}" style="width:100%;max-width:600px;height:120px;border:1px solid #e9ecef;border-radius:6px;background:#fafafa;overflow:visible;">
          <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#e9ecef" stroke-width="1"/>
          ${line(pts1,color1)}${line(pts2,color2||'')}${xLabels}
        </svg>
        ${key2?`<div style="display:flex;gap:14px;font-size:11px;margin-top:3px;"><span style="color:${color1};">● ${key1.replace('_',' ').replace('bp sys','Systolic').replace('sugar fast','Fasting')}</span><span style="color:${color2};">● ${key2.replace('_',' ').replace('bp dia','Diastolic').replace('sugar post','After Meal')}</span></div>`:''}
      </div>`;
    };

    const tableRows=vs.slice().reverse().map(v=>{
      const sugarDisp=[v.sugar_fast?'F:'+v.sugar_fast:'',v.sugar_pre?'Bf:'+v.sugar_pre:'',v.sugar_post?'Af:'+v.sugar_post:''].filter(Boolean).join(' ')||(v.sugar||'—');
      const bpColor=v.bp_sys&&Number(v.bp_sys)>140?'color:#c0392b':'';
      const sgColor=v.sugar_post&&Number(v.sugar_post)>140?'color:#c47c00':'';
      return `<tr>
        <td style="padding:6px 8px;font-size:12px;white-space:nowrap;border-bottom:1px solid #f0f0f0;">${fD(v.date)}${v.time?'<br><span style="font-size:10px;color:#888;">'+v.time+'</span>':''}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;${bpColor};border-bottom:1px solid #f0f0f0;">${v.bp_sys&&v.bp_dia?v.bp_sys+'/'+v.bp_dia:'—'}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;${sgColor};border-bottom:1px solid #f0f0f0;">${sugarDisp}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;border-bottom:1px solid #f0f0f0;">${v.weight||'—'}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;border-bottom:1px solid #f0f0f0;">${v.pulse||'—'}</td>
        <td style="padding:6px 8px;font-size:12px;font-family:monospace;border-bottom:1px solid #f0f0f0;">${v.spo2||'—'}</td>
      </tr>`;
    }).join('');

    // Latest reading summary
    const latest=vs[vs.length-1]||{};
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Vitals Report — ${pat.name}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;background:#fff;color:#1a1d23;padding:16mm 14mm;max-width:800px;margin:0 auto;}
      .header{border-bottom:3px solid #2c6fad;padding-bottom:16px;margin-bottom:20px;}
      .title{font-size:24px;font-weight:700;color:#1a3a6e;}
      .sub{font-size:13px;color:#6c757d;margin-top:4px;}
      .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;}
      .info-box{background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:10px 12px;}
      .info-box .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6c757d;font-weight:700;}
      .info-box .val{font-size:16px;font-weight:700;color:#1a1d23;margin-top:3px;}
      .section-title{font-size:15px;font-weight:700;color:#1a3a6e;margin:20px 0 10px;padding-bottom:6px;border-bottom:1.5px solid #e9ecef;}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      thead tr{background:#f0f7ff;}
      th{padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#2c6fad;font-weight:700;}
      td{padding:6px 10px;font-size:12px;}
      .footer{margin-top:30px;padding-top:14px;border-top:1px dashed #dee2e6;font-size:11px;color:#888;text-align:center;}
      @media print{@page{margin:16mm 14mm;}body{padding:0;}}
    </style></head><body>
    <div class="header">
      <div class="title">🏥 Vitals Health Report</div>
      <div class="sub">Patient: <b>${pat.name}</b> | Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} | Total Readings: ${vs.length}</div>
      ${pat.blood||pat.cond?`<div class="sub" style="margin-top:4px;">Blood Group: <b>${pat.blood||'—'}</b>${pat.cond?' | Condition: <b>'+pat.cond+'</b>':''}</div>`:''}
    </div>

    <div class="info-grid">
      <div class="info-box"><div class="lbl">Latest BP</div><div class="val" style="color:${latest.bp_sys&&Number(latest.bp_sys)>140?'#c0392b':'#1a7a45'};">${latest.bp_sys&&latest.bp_dia?latest.bp_sys+'/'+latest.bp_dia+' mmHg':'—'}</div></div>
      <div class="info-box"><div class="lbl">Latest Sugar (Fasting)</div><div class="val" style="color:#c47c00;">${latest.sugar_fast?latest.sugar_fast+' mg/dL':(latest.sugar?latest.sugar+' mg/dL':'—')}</div></div>
      <div class="info-box"><div class="lbl">Latest Weight</div><div class="val">${latest.weight?latest.weight+' kg':'—'}</div></div>
      <div class="info-box"><div class="lbl">Latest Pulse</div><div class="val">${latest.pulse?latest.pulse+' bpm':'—'}</div></div>
      <div class="info-box"><div class="lbl">Latest SpO2</div><div class="val" style="color:#5c3496;">${latest.spo2?latest.spo2+'%':'—'}</div></div>
      <div class="info-box"><div class="lbl">Last Recorded</div><div class="val" style="font-size:13px;">${fD(latest.date)||'—'}</div></div>
    </div>

    <div class="section-title">📈 Trend Charts</div>
    ${mkChart('Blood Pressure','bp_sys','bp_dia','#e05050','#e09050','mmHg')}
    ${mkChart('Blood Sugar','sugar_fast','sugar_post','#c47c00','#e09050','mg/dL')}
    ${mkChart('Weight','weight',null,'#2c6fad',null,'kg')}
    ${mkChart('Pulse','pulse',null,'#1a7a45',null,'bpm')}

    <div class="section-title">📋 All Readings</div>
    <table>
      <thead><tr><th>Date / Time</th><th>BP (Sys/Dia)</th><th>Sugar (F/Bf/Af)</th><th>Weight</th><th>Pulse</th><th>SpO2</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <div style="background:#fff8ee;border:1px solid #e8a060;border-radius:8px;padding:12px 14px;font-size:11px;color:#7a4400;margin-bottom:20px;">
      <b>Reference Ranges:</b> BP Normal: &lt;120/80 mmHg · High: &gt;140/90 mmHg | Sugar Fasting: 70-100 mg/dL · After Meal: &lt;140 mg/dL | SpO2 Normal: 95-100%
    </div>

    <div class="footer">Raman Kumar — Personal Health Dashboard · Report generated on ${new Date().toLocaleString('en-IN')}</div>
    window.onload=()=>window.print();<\/script>
    </body></html>`;

    // Build PDF using jsPDF
    const vitCols=['Date / Time','BP (Sys/Dia)','Sugar (F/Bf/Af)','Weight','Pulse','SpO2'];
    const vitRows=vs.slice().reverse().map(v=>{
      const sugarDisp=[v.sugar_fast?'F:'+v.sugar_fast:'',v.sugar_pre?'Bf:'+v.sugar_pre:'',v.sugar_post?'Af:'+v.sugar_post:''].filter(Boolean).join(' ')||(v.sugar||'—');
      return [fD(v.date)+(v.time?' '+v.time:''), v.bp_sys&&v.bp_dia?v.bp_sys+'/'+v.bp_dia+' mmHg':'—', sugarDisp, v.weight?v.weight+' kg':'—', v.pulse?v.pulse+' bpm':'—', v.spo2?v.spo2+'%':'—'];
    });
    const vitLatest=vs[vs.length-1]||{};
    _makePDF({
      filename: 'Health_Report_'+pat.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: 'Vitals Health Report',
      subtitle: 'Patient: '+pat.name+' | Total Readings: '+vs.length,
      badge: pat.name+(pat.blood?' | Blood: '+pat.blood:'')+(pat.cond?' | '+pat.cond:''),
      summaryRows: [
        ['BP', vitLatest.bp_sys&&vitLatest.bp_dia?vitLatest.bp_sys+'/'+vitLatest.bp_dia:' — ', [44,111,173]],
        ['Sugar (F)', vitLatest.sugar_fast?vitLatest.sugar_fast+' mg/dL':'—', [181,112,28]],
        ['Weight', vitLatest.weight?vitLatest.weight+' kg':'—', [26,122,69]],
        ['Pulse', vitLatest.pulse?vitLatest.pulse+' bpm':'—', [192,57,43]],
      ],
      entriesLabel: 'Total Readings: '+vs.length+' | Generated: '+fD(new Date().toISOString().slice(0,10)),
      columns: vitCols,
      rows: vitRows,
      colStyles: {0:{cellWidth:28}},
      headerColor: [44,111,173],
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  // ══ VITALS REPORT — Word (.doc) ══
  _vitDownloadWord(patId){
    const pat=this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const vs=this.getVitals(patId).sort((a,b)=>a.date.localeCompare(b.date));
    if(!vs.length){ this.showToastMsg('⚠️ No vitals data to export!'); return; }
    const latest=vs[vs.length-1]||{};
    const rows=vs.slice().reverse().map(v=>{
      const sugarDisp=[v.sugar_fast?'F:'+v.sugar_fast:'',v.sugar_pre?'Bf:'+v.sugar_pre:'',v.sugar_post?'Af:'+v.sugar_post:''].filter(Boolean).join(' ')||(v.sugar||'—');
      return `<tr>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${fD(v.date)}${v.time?' '+v.time:''}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${v.bp_sys&&v.bp_dia?v.bp_sys+'/'+v.bp_dia:'—'}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${sugarDisp}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${v.weight||'—'}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${v.pulse||'—'}</td>
        <td style="border:1px solid #dee2e6;padding:6px 10px;">${v.spo2||'—'}</td>
      </tr>`;
    }).join('');

    const html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
    <head><meta charset="UTF-8"><title>Vitals Report</title>
    <style>
      body{font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:2cm;}
      h1{color:#1a3a6e;font-size:18pt;border-bottom:2pt solid #2c6fad;padding-bottom:6pt;}
      h2{color:#2c6fad;font-size:13pt;margin-top:14pt;}
      table{border-collapse:collapse;width:100%;margin:10pt 0;}
      th{background:#2c6fad;color:white;padding:6pt 8pt;font-size:10pt;text-align:left;}
      td{border:1pt solid #dee2e6;padding:5pt 8pt;font-size:10pt;}
      tr:nth-child(even) td{background:#f8f9fa;}
      .summary{background:#f0f7ff;border:1pt solid #90b8e8;padding:8pt;border-radius:4pt;margin:10pt 0;}
    </style></head><body>
    <h1>🏥 Vitals Health Report — ${pat.name}</h1>
    <p style="color:#6c757d;font-size:10pt;">Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} | Total Readings: ${vs.length}</p>
    ${pat.blood||pat.cond?`<p style="font-size:10pt;"><b>Blood Group:</b> ${pat.blood||'—'} ${pat.cond?'| <b>Condition:</b> '+pat.cond:''}</p>`:''}

    <h2>📊 Latest Reading Summary</h2>
    <div class="summary">
      <table><tr>
        <td><b>BP:</b> ${latest.bp_sys&&latest.bp_dia?latest.bp_sys+'/'+latest.bp_dia+' mmHg':'—'}</td>
        <td><b>Sugar (Fasting):</b> ${latest.sugar_fast?latest.sugar_fast+' mg/dL':'—'}</td>
        <td><b>After Meal:</b> ${latest.sugar_post?latest.sugar_post+' mg/dL':'—'}</td>
        <td><b>Weight:</b> ${latest.weight?latest.weight+' kg':'—'}</td>
        <td><b>Pulse:</b> ${latest.pulse?latest.pulse+' bpm':'—'}</td>
        <td><b>SpO2:</b> ${latest.spo2?latest.spo2+'%':'—'}</td>
      </tr></table>
    </div>

    <h2>📋 Complete Vitals History</h2>
    <table>
      <thead><tr><th>Date / Time</th><th>BP (Sys/Dia)</th><th>Sugar (F/Bf/Af)</th><th>Weight (kg)</th><th>Pulse (bpm)</th><th>SpO2 (%)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="font-size:9pt;color:#888;border-top:1pt solid #dee2e6;padding-top:8pt;margin-top:16pt;">
      Reference: BP Normal &lt;120/80 | Fasting Sugar 70-100 mg/dL | After Meal &lt;140 mg/dL | SpO2 95-100%<br>
      Raman Kumar — Personal Health Dashboard
    </p>
    </body></html>`;

    const _vitBlob=new Blob(['\uFEFF'+html],{type:'application/msword'});
    const _vitA=document.createElement('a');
    _vitA.href=URL.createObjectURL(_vitBlob);
    _vitA.download='Vitals_'+pat.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(_vitA);_vitA.click();document.body.removeChild(_vitA);
    URL.revokeObjectURL(_vitA.href);
    this.showToastMsg('✅ Word file downloaded!');
  },

  // ══ VITALS REPORT — Excel (.xlsx via CSV) ══
  _vitDownloadExcel(patId){
    const pat=this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const vs=this.getVitals(patId).sort((a,b)=>a.date.localeCompare(b.date));
    if(!vs.length){ this.showToastMsg('⚠️ No vitals data to export!'); return; }

    // Build multi-sheet CSV (simulate with one sheet + blank separator)
    const esc=v=>`"${String(v||'').replace(/"/g,'""')}"`;
    const hdr=['Date','Time','BP Systolic (mmHg)','BP Diastolic (mmHg)','Sugar Fasting (mg/dL)','Sugar Before Meal (mg/dL)','Sugar After Meal (mg/dL)','Weight (kg)','Pulse (bpm)','SpO2 (%)'];
    const dataRows=vs.map(v=>[
      fD(v.date), v.time||'',
      v.bp_sys||'', v.bp_dia||'',
      v.sugar_fast||'', v.sugar_pre||'', v.sugar_post||'',
      v.weight||'', v.pulse||'', v.spo2||''
    ].map(esc).join(','));

    // Summary section at top
    const latest=vs[vs.length-1]||{};
    const summary=[
      `"VITALS REPORT — ${pat.name}"`,
      `"Generated: ${todayDMY()}"`,
      `"Total Readings: ${vs.length}"`,
      `"Blood Group: ${pat.blood||'—'}"`,
      '',
      '"LATEST READING"',
      `"BP: ${latest.bp_sys&&latest.bp_dia?latest.bp_sys+'/'+latest.bp_dia+' mmHg':'—'}","Sugar Fasting: ${latest.sugar_fast||'—'} mg/dL","After Meal: ${latest.sugar_post||'—'} mg/dL","Weight: ${latest.weight||'—'} kg","Pulse: ${latest.pulse||'—'} bpm","SpO2: ${latest.spo2||'—'}%"`,
      '',
      '"ALL READINGS"',
      hdr.map(h=>`"${h}"`).join(','),
      ...dataRows,
      '',
      '"Reference Ranges:"',
      '"BP Normal","<120/80 mmHg"',
      '"Sugar Fasting","70-100 mg/dL"',
      '"Sugar After Meal","<140 mg/dL"',
      '"SpO2","95-100%"',
    ].join('\n');

    const blob=new Blob(['\ufeff'+summary],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`Vitals_${pat.name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ Excel/CSV downloaded! Open with Excel.');
  },

  // ════════════════════════════════════════════════════════════════
  // MEDICINE DAILY SCHEDULE
  // localStorage: rk_medschedule_{patId}
  // Each medicine: {id, name, dose, times:['morning','afternoon','night'],
  //                 startDate, endDate, notes, active}
  // ════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════
  // MEDICINE REMINDER — PROFESSIONAL SYSTEM
  // Storage:
  //   rk_medsched_{patId}  → medicine list with exact times
  //   rk_medlog_{patId}    → daily taken/skipped/snoozed log
  // ════════════════════════════════════════════════════════════════
  _getMedSchedule(patId){ try{ return JSON.parse(localStorage.getItem('rk_medsched_'+patId)||'[]'); }catch{ return []; } },
  _saveMedSchedule(patId,arr){ localStorage.setItem('rk_medsched_'+patId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('medsched_'+patId,arr).catch(()=>{}); },
  _getMedLog(patId){ try{ return JSON.parse(localStorage.getItem('rk_medlog_'+patId)||'{}'); }catch{ return {}; } },
  _saveMedLog(patId,obj){ localStorage.setItem('rk_medlog_'+patId,JSON.stringify(obj)); if(window.fbSave) window.fbSave('medlog_'+patId,obj).catch(()=>{}); },

  // Log key: "YYYY-MM-DD_medId_slotTime" → {status:'taken'|'skipped'|'snoozed', ts, snoozeUntil}
  _medLogKey(date, medId, slot){ return date+'_'+medId+'_'+slot; },

  _markMedStatus(patId, medId, slot, status, snoozeMin){
    const today = new Date().toISOString().split('T')[0];
    const log = this._getMedLog(patId);
    const key = this._medLogKey(today, medId, slot);
    const entry = { status, ts: new Date().toISOString() };
    if(status==='snoozed' && snoozeMin){
      entry.snoozeUntil = new Date(Date.now() + snoozeMin*60000).toISOString();
      entry.snoozeMin = snoozeMin;
      // Schedule browser notification after snooze
      this._schedMedSnoozeNotif(patId, medId, slot, snoozeMin);
    }
    log[key] = entry;
    this._saveMedLog(patId, log);
    this.openMedSchedule(patId);
    // Refresh snooze popup if open
    const sp = document.getElementById('_medSnoozePopup');
    if(sp) sp.remove();
  },

  _getMedStatusToday(patId, medId, slot){
    const today = new Date().toISOString().split('T')[0];
    const log = this._getMedLog(patId);
    return log[this._medLogKey(today, medId, slot)] || null;
  },

  _schedMedSnoozeNotif(patId, medId, slot, mins){
    if(typeof Notification === 'undefined') return;
    const med = this._getMedSchedule(patId).find(m=>m.id===medId);
    if(!med) return;
    if(!this._medSnoozeTimers) this._medSnoozeTimers = {};
    const key = patId+'_'+medId+'_'+slot;
    clearTimeout(this._medSnoozeTimers[key]);
    this._medSnoozeTimers[key] = setTimeout(()=>{
      // Check if still snoozed (not taken since)
      const entry = this._getMedStatusToday(patId, medId, slot);
      if(entry && entry.status==='snoozed'){
        // Show popup
        this._showMedReminderPopup(patId, medId, slot);
        // Browser notification if permission granted
        if(Notification.permission==='granted'){
          try{
            new Notification('💊 Medicine Reminder', {
              body: med.name + (med.dose?' — '+med.dose:'') + '\nTime to take your medicine!',
              tag:'med-'+key
            });
          }catch(e){}
        }
      }
    }, mins*60000);
  },

  _showMedReminderPopup(patId, medId, slot){
    const med = this._getMedSchedule(patId).find(m=>m.id===medId);
    if(!med) return;
    const pat = this.patients.find(p=>p.id===patId);
    const old = document.getElementById('_medSnoozePopup'); if(old) old.remove();
    const popup = document.createElement('div');
    popup.id = '_medSnoozePopup';
    popup.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:19999;width:calc(100% - 32px);max-width:380px;';
    popup.innerHTML = `<div style="background:var(--card);border:2px solid #1565c0;border-radius:16px;padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:42px;height:42px;background:#e3f2fd;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">💊</div>
        <div style="flex:1;">
          <div style="font-weight:800;font-size:.95rem;color:var(--txt);">${med.name}</div>
          <div style="font-size:.72rem;color:var(--mut);">${med.dose||''} · ${slot} · ${pat?pat.name:''}</div>
          ${med.note?`<div style="font-size:.7rem;color:#1565c0;margin-top:2px;">📝 ${med.note}</div>`:''}
        </div>
        <button onclick="document.getElementById('_medSnoozePopup').remove()" style="background:var(--dim);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:.9rem;color:var(--mut);flex-shrink:0;">✕</button>
      </div>
      <div style="font-size:.78rem;font-weight:700;color:var(--mut);margin-bottom:8px;">⏰ What would you like to do?</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px;">
        <button onclick="APP._markMedStatus('${patId}','${medId}','${slot}','taken');document.getElementById('_medSnoozePopup').remove();" 
          style="flex:1;background:#1a7a45;color:#fff;border:none;border-radius:10px;padding:10px 8px;font-size:.82rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">
          ✅ Taken
        </button>
        <button onclick="APP._markMedStatus('${patId}','${medId}','${slot}','skipped');document.getElementById('_medSnoozePopup').remove();" 
          style="flex:1;background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:10px;padding:10px 8px;font-size:.82rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">
          ✗ Skip
        </button>
      </div>
      <div style="font-size:.72rem;font-weight:700;color:var(--mut);margin-bottom:6px;">⏱ Snooze for:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${[5,10,15,30,60].map(m=>`
          <button onclick="APP._markMedStatus('${patId}','${medId}','${slot}','snoozed',${m});" 
            style="flex:1;min-width:40px;background:var(--dim);border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 4px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;color:var(--txt);">
            ${m}m
          </button>`).join('')}
        <button onclick="APP._showCustomSnooze('${patId}','${medId}','${slot}')" 
          style="flex:1;min-width:40px;background:var(--dim);border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 4px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;color:var(--acc);">
          Custom
        </button>
      </div>
    </div>`;
    document.body.appendChild(popup);
  },

  _showCustomSnooze(patId, medId, slot){
    const inp = prompt('Snooze for how many minutes?', '20');
    const mins = parseInt(inp);
    if(!mins||mins<1||mins>480){ this.showToastMsg('⚠️ 1–480 minutes only'); return; }
    this._markMedStatus(patId, medId, slot, 'snoozed', mins);
  },

  // ── Med adherence stats (last 7 days) ──
  _medAdherence(patId, medId){
    const log = this._getMedLog(patId);
    const med = this._getMedSchedule(patId).find(m=>m.id===medId);
    if(!med) return null;
    let taken=0, total=0;
    for(let i=0;i<7;i++){
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.toISOString().split('T')[0];
      (med.times||[]).forEach(slot=>{
        total++;
        const e = log[this._medLogKey(ds, medId, slot)];
        if(e && e.status==='taken') taken++;
      });
    }
    return total>0 ? Math.round((taken/total)*100) : null;
  },

  openMedSchedule(patId){
    const pat = this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const TIMES = ['Morning','Afternoon','Evening','Night'];
    const TIME_ICONS = {Morning:'🌅',Afternoon:'☀️',Evening:'🌆',Night:'🌙'};
    // Default clock times for each slot
    const SLOT_TIMES = {Morning:'08:00',Afternoon:'13:00',Evening:'17:00',Night:'21:00'};

    const render = () => {
      const meds = this._getMedSchedule(patId);
      const active = meds.filter(m=>m.active!==false);
      const inactive = meds.filter(m=>m.active===false);
      const body = document.getElementById('_medSchedBody');
      if(!body) return;

      // ── Today's schedule with taken/skip/snooze status ──
      const todaySched = TIMES.map(t=>({
        time:t, icon:TIME_ICONS[t], clockTime:SLOT_TIMES[t],
        meds: active.filter(m=>m.times&&m.times.includes(t))
      })).filter(s=>s.meds.length>0);

      // ── Adherence summary (last 7 days) ──
      const totalSlots = active.reduce((s,m)=>s+(m.times||[]).length,0);
      const allTaken = active.reduce((s,m)=>{
        (m.times||[]).forEach(slot=>{
          const e=this._getMedStatusToday(patId,m.id,slot);
          if(e&&e.status==='taken') s++;
        });
        return s;
      },0);
      const totalToday = active.reduce((s,m)=>s+(m.times||[]).length,0);
      const takenPct = totalToday>0?Math.round((allTaken/totalToday)*100):0;

      body.innerHTML = `
        <!-- Today Summary Bar -->
        ${active.length ? `
        <div style="background:${takenPct===100?'#e8f5e9':takenPct>50?'#fff8ee':'#fff0f0'};border:1.5px solid ${takenPct===100?'#90c8a0':takenPct>50?'#e8a060':'#f09090'};border-radius:12px;padding:12px 14px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div style="font-weight:800;font-size:.85rem;">📅 Today's Progress</div>
            <div style="font-size:.85rem;font-weight:900;color:${takenPct===100?'#1a7a45':takenPct>50?'#b56a00':'#991b1b'};">${allTaken}/${totalToday} taken</div>
          </div>
          <div style="height:8px;background:var(--dim);border-radius:4px;overflow:hidden;">
            <div style="width:${takenPct}%;height:100%;background:${takenPct===100?'#1a7a45':takenPct>50?'#e8a060':'#ef4444'};border-radius:4px;transition:width .4s;"></div>
          </div>
          ${takenPct===100?`<div style="font-size:.72rem;color:#1a7a45;margin-top:4px;font-weight:700;">🎉 All medicines taken today!</div>`:
            `<div style="font-size:.72rem;color:var(--mut);margin-top:4px;">${totalToday-allTaken} remaining for today</div>`}
        </div>` : ''}

        <!-- Today's schedule slot-wise with action buttons -->
        ${todaySched.length ? `
        <div style="margin-bottom:14px;">
          <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">⏰ Today's Schedule</div>
          ${todaySched.map(s=>`
            <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;margin-bottom:10px;overflow:hidden;">
              <!-- Slot header -->
              <div style="background:var(--card2);padding:8px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bdr);">
                <div style="font-size:.78rem;font-weight:800;color:var(--txt);">${s.icon} ${s.time}</div>
                <div style="font-size:.7rem;color:var(--mut);">🕐 ${s.clockTime}</div>
              </div>
              <!-- Medicines in this slot -->
              ${s.meds.map(m=>{
                const st = this._getMedStatusToday(patId, m.id, s.time);
                const status = st ? st.status : 'pending';
                const isSnoozed = status==='snoozed' && st.snoozeUntil && new Date(st.snoozeUntil)>now;
                const snoozeLeft = isSnoozed ? Math.ceil((new Date(st.snoozeUntil)-now)/60000) : 0;
                const adh = this._medAdherence(patId, m.id);

                return `<div style="padding:10px 14px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:10px;">
                  <!-- Medicine info -->
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <div style="background:${m.color||'#e3f2fd'};border:1.5px solid ${m.borderColor||'#90b8e8'};border-radius:6px;padding:3px 8px;font-size:.78rem;font-weight:700;">${m.name}</div>
                      ${m.dose?`<span style="font-size:.7rem;color:var(--mut);">${m.dose}</span>`:''}
                    </div>
                    ${m.note?`<div style="font-size:.68rem;color:var(--mut);margin-top:2px;">📝 ${m.note}</div>`:''}
                    ${adh!==null?`<div style="font-size:.65rem;color:${adh>=80?'#1a7a45':adh>=50?'#b56a00':'#991b1b'};margin-top:2px;">📊 7d adherence: ${adh}%</div>`:''}
                    ${isSnoozed?`<div style="font-size:.65rem;color:#1565c0;font-weight:700;margin-top:2px;">⏱ Snoozed — rings in ${snoozeLeft} min</div>`:''}
                  </div>
                  <!-- Action buttons -->
                  <div style="display:flex;gap:5px;flex-shrink:0;">
                    ${status==='taken' ? `
                      <div style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;border-radius:8px;padding:6px 10px;font-size:.72rem;font-weight:800;">✅ Taken</div>
                      <button onclick="APP._markMedStatus('${patId}','${m.id}','${s.time}','pending')" style="background:var(--dim);border:none;border-radius:6px;padding:5px 8px;font-size:.68rem;cursor:pointer;color:var(--mut);" title="Undo">↩</button>
                    ` : status==='skipped' ? `
                      <div style="background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:8px;padding:6px 10px;font-size:.72rem;font-weight:800;">✗ Skipped</div>
                      <button onclick="APP._markMedStatus('${patId}','${m.id}','${s.time}','pending')" style="background:var(--dim);border:none;border-radius:6px;padding:5px 8px;font-size:.68rem;cursor:pointer;color:var(--mut);" title="Undo">↩</button>
                    ` : `
                      <button onclick="APP._markMedStatus('${patId}','${m.id}','${s.time}','taken')"
                        style="background:#1a7a45;color:#fff;border:none;border-radius:8px;padding:7px 10px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">✅ Taken</button>
                      <button onclick="APP._showMedReminderPopup('${patId}','${m.id}','${s.time}')"
                        style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;border-radius:8px;padding:7px 10px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;">⏰ Snooze</button>
                      <button onclick="APP._markMedStatus('${patId}','${m.id}','${s.time}','skipped')"
                        style="background:#fee2e2;color:#991b1b;border:1.5px solid #fca5a5;border-radius:8px;padding:7px 8px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">✗ Skip</button>
                    `}
                  </div>
                </div>`;
              }).join('')}
            </div>`).join('')}
        </div>` : ''}

        <!-- Add medicine form -->
        <details ${active.length?'':'open'}>
          <summary style="font-weight:800;font-size:.88rem;cursor:pointer;padding:8px 0;display:flex;align-items:center;gap:6px;list-style:none;">
            <span style="background:var(--acc);color:#fff;border-radius:6px;padding:2px 8px;font-size:.7rem;">＋</span>
            Add New Medicine
          </summary>
          <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:12px;padding:12px 14px;margin-top:8px;margin-bottom:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💊 Medicine Name *</label>
                <input id="_ms_name" placeholder="e.g. Amlodipine 5mg" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📏 Dose</label>
                <input id="_ms_dose" placeholder="e.g. 1 tablet, 5ml" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Start Date</label>
                <input id="_ms_start" type="date" value="${today}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 End Date <span style="font-size:.6rem;">(optional)</span></label>
                <input id="_ms_end" type="date" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
            </div>
            <!-- Time slots with clock input -->
            <div style="margin-bottom:8px;">
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:6px;">⏰ When to Take — select time slot + set clock time</label>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${TIMES.map(t=>`
                  <div style="display:flex;align-items:center;gap:8px;background:var(--dim);border:1.5px solid var(--bdr2);border-radius:8px;padding:7px 10px;">
                    <input type="checkbox" id="_ms_t_${t.toLowerCase()}" value="${t}" style="width:15px;height:15px;accent-color:var(--acc);flex-shrink:0;"
                      onchange="(function(el){var tr=document.getElementById('_ms_time_${t.toLowerCase()}');if(tr)tr.style.opacity=el.checked?'1':'0.4';})(this)">
                    <span style="font-size:.82rem;font-weight:700;flex:1;">${TIME_ICONS[t]} ${t}</span>
                    <input type="time" id="_ms_time_${t.toLowerCase()}" value="${SLOT_TIMES[t]}" 
                      style="border:1.5px solid var(--bdr2);border-radius:6px;padding:4px 7px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);opacity:0.4;width:100px;">
                  </div>`).join('')}
              </div>
            </div>
            <!-- Refill alert -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💊 Total Tablets/Units</label>
                <input id="_ms_stock" type="number" placeholder="e.g. 30" min="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
              <div>
                <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🔔 Refill Alert at</label>
                <input id="_ms_refill" type="number" placeholder="e.g. 5 (when 5 left)" min="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
              </div>
            </div>
            <input id="_ms_note" placeholder="📝 Notes (e.g. After food, With water, etc.)" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);margin-bottom:8px;">
            <button onclick="APP._saveMedEntry('${patId}')" style="width:100%;background:#1565c0;color:#fff;border:none;border-radius:8px;padding:10px;font-family:Nunito,sans-serif;font-size:.88rem;font-weight:800;cursor:pointer;">💾 Add to Schedule</button>
          </div>
        </details>

        <!-- Active medicines list with adherence + refill -->
        ${active.length ? `
        <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">💊 All Medicines (${active.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
          ${active.map(m=>{
            const adh = this._medAdherence(patId, m.id);
            const stock = Number(m.stock||0);
            const refill = Number(m.refill||0);
            const needsRefill = stock>0 && refill>0 && stock<=refill;
            return `<div style="background:var(--card);border:1.5px solid ${needsRefill?'#f48fb1':'var(--bdr)'};border-radius:10px;padding:10px 12px;">
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="background:${m.color||'#e3f2fd'};border-radius:8px;padding:6px 8px;font-size:.7rem;font-weight:800;color:#1565c0;text-align:center;flex-shrink:0;">💊</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:800;font-size:.88rem;">${m.name} ${needsRefill?'<span style="background:#fce4ec;color:#c62828;font-size:.62rem;padding:1px 7px;border-radius:4px;font-weight:800;">⚠️ Refill Needed</span>':''}</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:.7rem;color:var(--mut);margin-top:3px;">
                    ${m.dose?`<span>📏 ${m.dose}</span>`:''}
                    ${m.times&&m.times.length?`<span>⏰ ${m.times.map(t=>TIME_ICONS[t]+' '+t+(m.slotTimes&&m.slotTimes[t]?' at '+m.slotTimes[t]:'')).join(' · ')}</span>`:''}
                    ${m.startDate?`<span>📅 From ${fD(m.startDate)}</span>`:''}
                    ${m.endDate?`<span>Until ${fD(m.endDate)}</span>`:''}
                    ${stock>0?`<span style="color:${needsRefill?'#c62828':'var(--mut)'};">💊 ${stock} left</span>`:''}
                  </div>
                  ${m.note?`<div style="font-size:.7rem;color:var(--mut);margin-top:2px;">📝 ${m.note}</div>`:''}
                  ${adh!==null?`
                  <div style="margin-top:5px;">
                    <div style="font-size:.62rem;color:var(--mut);margin-bottom:2px;">7-day adherence: ${adh}%</div>
                    <div style="height:4px;background:var(--dim);border-radius:2px;overflow:hidden;width:100px;">
                      <div style="width:${adh}%;height:100%;background:${adh>=80?'#1a7a45':adh>=50?'#e8a060':'#ef4444'};border-radius:2px;"></div>
                    </div>
                  </div>`:''}
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0;">
                  <button onclick="(function(){var arr=APP._getMedSchedule('${patId}');var i=arr.findIndex(x=>x.id==='${m.id}');if(i>=0)arr[i].active=false;APP._saveMedSchedule('${patId}',arr);APP.openMedSchedule('${patId}');})()" 
                    style="background:#fff8ee;border:1px solid #e8a060;color:#b56a00;border-radius:5px;padding:3px 8px;font-size:.68rem;cursor:pointer;font-family:Nunito,sans-serif;">⏸</button>
                  <button onclick="(function(){var arr=APP._getMedSchedule('${patId}').filter(x=>x.id!=='${m.id}');APP._saveMedSchedule('${patId}',arr);APP.openMedSchedule('${patId}');})()" 
                    style="background:#fee2e2;border:none;color:#991b1b;border-radius:5px;padding:3px 8px;font-size:.68rem;cursor:pointer;">🗑</button>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}

        <!-- Stopped medicines -->
        ${inactive.length ? `
        <details style="margin-bottom:8px;">
          <summary style="font-weight:700;font-size:.8rem;cursor:pointer;color:var(--mut);padding:6px 0;">⏸ Stopped Medicines (${inactive.length})</summary>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
            ${inactive.map(m=>`
              <div style="background:var(--dim);border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:10px;opacity:.7;">
                <div style="flex:1;font-size:.78rem;color:var(--mut);">${m.name}${m.dose?' — '+m.dose:''}</div>
                <button onclick="(function(){var arr=APP._getMedSchedule('${patId}');var i=arr.findIndex(x=>x.id==='${m.id}');if(i>=0)arr[i].active=true;APP._saveMedSchedule('${patId}',arr);APP.openMedSchedule('${patId}');})()" 
                  style="background:#e8f5e9;border:1px solid #90c8a0;color:#166634;border-radius:5px;padding:3px 8px;font-size:.7rem;cursor:pointer;font-family:Nunito,sans-serif;flex-shrink:0;">▶ Resume</button>
              </div>`).join('')}
          </div>
        </details>` : ''}

        ${!meds.length ? '<div style="text-align:center;padding:20px;color:var(--mut);font-size:.83rem;">No medicines added yet.<br>Expand the form above to add your first medicine.</div>' : ''}
      `;
    };

    const old = document.getElementById('_medSchedModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_medSchedModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `<div style="width:100%;max-width:640px;background:var(--card);border-radius:20px 20px 0 0;max-height:94vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div>
          <div style="font-weight:800;font-size:1rem;">💊 ${pat.name}</div>
          <div style="font-size:.68rem;color:var(--mut);">Medicine Daily Schedule & Tracker</div>
        </div>
        <div style="display:flex;gap:7px;align-items:center;">
          ${typeof Notification!=='undefined'&&Notification.permission!=='granted'?`
          <button onclick="Notification.requestPermission().then(p=>APP.showToastMsg(p==='granted'?'✅ Notifications enabled!':'❌ Permission denied'))" 
            style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;border-radius:8px;padding:5px 10px;font-size:.7rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;">🔔 Enable Alerts</button>`:''}
          <button onclick="document.getElementById('_medSchedModal').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
        </div>
      </div>
      <div id="_medSchedBody" style="overflow-y:auto;padding:14px 16px;flex:1;-webkit-overflow-scrolling:touch;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    render();
  },

  _saveMedEntry(patId){
    const name = (document.getElementById('_ms_name')||{}).value?.trim();
    if(!name){ this.showToastMsg('⚠️ Medicine name required!'); return; }
    const dose  = (document.getElementById('_ms_dose')||{}).value?.trim()||'';
    const start = (document.getElementById('_ms_start')||{}).value||'';
    const end   = (document.getElementById('_ms_end')||{}).value||'';
    const note  = (document.getElementById('_ms_note')||{}).value?.trim()||'';
    const stock = Number((document.getElementById('_ms_stock')||{}).value||0);
    const refill= Number((document.getElementById('_ms_refill')||{}).value||0);
    const TIMES = ['Morning','Afternoon','Evening','Night'];
    const times = TIMES.filter(t=>{ const el=document.getElementById('_ms_t_'+t.toLowerCase()); return el&&el.checked; });
    if(!times.length){ this.showToastMsg('⚠️ Select at least one time!'); return; }
    // Collect custom clock times
    const slotTimes = {};
    times.forEach(t=>{
      const el = document.getElementById('_ms_time_'+t.toLowerCase());
      if(el&&el.value) slotTimes[t] = el.value;
    });
    const colors = ['#e3f2fd','#e8f5e9','#fff8ee','#f3e5f5','#fce4ec','#e0f7fa'];
    const borders= ['#90b8e8','#90c8a0','#e8a060','#c4b0f0','#f48fb1','#80deea'];
    const idx = this._getMedSchedule(patId).length % colors.length;
    const arr = this._getMedSchedule(patId);
    arr.push({id:'ms'+Date.now(),name,dose,times,slotTimes,startDate:start,endDate:end,note,stock,refill,active:true,color:colors[idx],borderColor:borders[idx],created:new Date().toISOString()});
    this._saveMedSchedule(patId,arr);
    this.showToastMsg('✅ '+name+' added to schedule!');
    this.openMedSchedule(patId);
  },

  // ════════════════════════════════════════════════════════════════
  // HOSPITAL BILLS TRACKER
  // localStorage: rk_hosbills_{patId}
  // ════════════════════════════════════════════════════════════════
  _getHosBills(patId){ try{ return JSON.parse(localStorage.getItem('rk_hosbills_'+patId)||'[]'); }catch{ return []; } },
  _saveHosBills(patId,arr){ localStorage.setItem('rk_hosbills_'+patId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('hosbills_'+patId,arr).catch(()=>{}); },

  openHospitalBills(patId){
    const pat = this.patients.find(p=>p.id===patId);
    if(!pat) return;
    const today = new Date().toISOString().split('T')[0];

    const render = () => {
      const bills = this._getHosBills(patId).sort((a,b)=>b.date.localeCompare(a.date));
      const totalBilled = bills.reduce((s,b)=>s+Number(b.amount||0),0);
      const totalPaid   = bills.reduce((s,b)=>s+Number(b.paid||0),0);
      const totalIns    = bills.reduce((s,b)=>s+Number(b.insurance||0),0);
      const totalDue    = totalBilled - totalPaid - totalIns;
      const body = document.getElementById('_hosBillBody');
      if(!body) return;

      body.innerHTML = `
        <!-- Summary -->
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;">
          <div style="background:#fff8ee;border:1.5px solid #e8a060;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:#b56a00;text-transform:uppercase;margin-bottom:3px;">Total Billed</div>
            <div style="font-size:.95rem;font-weight:900;color:#b56a00;">${fmt(totalBilled)}</div>
          </div>
          <div style="background:#e8f5e9;border:1.5px solid #90c8a0;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:#1a7a45;text-transform:uppercase;margin-bottom:3px;">Paid</div>
            <div style="font-size:.95rem;font-weight:900;color:#1a7a45;">${fmt(totalPaid)}</div>
          </div>
          <div style="background:#e3f2fd;border:1.5px solid #90b8e8;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:#1565c0;text-transform:uppercase;margin-bottom:3px;">Insurance Claimed</div>
            <div style="font-size:.95rem;font-weight:900;color:#1565c0;">${fmt(totalIns)}</div>
          </div>
          <div style="background:${totalDue>0?'#fee2e2':'#e8f5e9'};border:1.5px solid ${totalDue>0?'#f09090':'#90c8a0'};border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:.55rem;font-weight:800;color:${totalDue>0?'#991b1b':'#1a7a45'};text-transform:uppercase;margin-bottom:3px;">Outstanding</div>
            <div style="font-size:.95rem;font-weight:900;color:${totalDue>0?'#991b1b':'#1a7a45'};">${totalDue>0?fmt(totalDue):'✓ Clear'}</div>
          </div>
        </div>

        <!-- Add bill form -->
        <div style="background:var(--card2);border:1.5px solid var(--bdr);border-radius:10px;padding:12px;margin-bottom:14px;">
          <div style="font-weight:800;font-size:.85rem;margin-bottom:10px;">➕ Add Bill / Receipt</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🏥 Hospital / Clinic *</label>
              <input id="_hb_hosp" placeholder="e.g. Apollo Hospital" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📋 Bill Type</label>
              <select id="_hb_type" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
                <option>Consultation</option><option>Lab Test</option><option>Medicine</option>
                <option>Surgery</option><option>Hospitalization</option><option>Physiotherapy</option>
                <option>Dental</option><option>Eye</option><option>Other</option>
              </select>
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💰 Total Amount (₹) *</label>
              <input id="_hb_amt" type="number" placeholder="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">💳 Amount Paid (₹)</label>
              <input id="_hb_paid" type="number" placeholder="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">🛡️ Insurance Claim (₹)</label>
              <input id="_hb_ins" type="number" placeholder="0" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
            <div>
              <label style="font-size:.65rem;font-weight:700;color:var(--mut);display:block;margin-bottom:3px;">📅 Date</label>
              <input id="_hb_date" type="date" value="${today}" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.82rem;background:var(--bg);color:var(--txt);">
            </div>
          </div>
          <input id="_hb_note" placeholder="📝 Notes, bill number, doctor name…" style="width:100%;border:1.5px solid var(--bdr2);border-radius:6px;padding:6px 9px;font-family:Nunito,sans-serif;font-size:.8rem;background:var(--bg);color:var(--txt);margin-bottom:8px;">
          <button onclick="APP._saveHosBill('${patId}')" style="width:100%;background:#7b1fa2;color:#fff;border:none;border-radius:8px;padding:9px;font-family:Nunito,sans-serif;font-size:.85rem;font-weight:800;cursor:pointer;">💾 Save Bill</button>
        </div>

        <!-- Bills list -->
        ${bills.length ? `
        <div style="font-weight:700;font-size:.82rem;margin-bottom:8px;">🧾 Bill History (${bills.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${bills.map(b=>{
            const due = Number(b.amount||0)-Number(b.paid||0)-Number(b.insurance||0);
            return `<div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:10px;padding:10px 12px;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
                <div>
                  <div style="font-weight:800;font-size:.85rem;">${b.hospital}</div>
                  <div style="font-size:.7rem;color:var(--mut);">📋 ${b.type||'Bill'} · 📅 ${fD(b.date)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:.9rem;font-weight:900;color:#b56a00;">${fmt(b.amount)}</div>
                  ${due>0?`<div style="font-size:.65rem;color:#991b1b;font-weight:700;">Due: ${fmt(due)}</div>`:
                          `<div style="font-size:.65rem;color:#1a7a45;font-weight:700;">✓ Cleared</div>`}
                </div>
              </div>
              <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.7rem;color:var(--mut);">
                ${b.paid?`<span style="color:#1a7a45;font-weight:700;">✓ Paid ${fmt(b.paid)}</span>`:''}
                ${b.insurance?`<span style="color:#1565c0;font-weight:700;">🛡️ Ins ${fmt(b.insurance)}</span>`:''}
                ${b.note?`<span>📝 ${b.note}</span>`:''}
              </div>
              <button onclick="(function(){var arr=APP._getHosBills('${patId}').filter(x=>x.id!=='${b.id}');APP._saveHosBills('${patId}',arr);APP.openHospitalBills('${patId}');})()" style="margin-top:6px;background:none;border:none;color:var(--red);cursor:pointer;font-size:.75rem;padding:0;">🗑 Delete</button>
            </div>`;
          }).join('')}
        </div>` : '<div style="text-align:center;padding:24px;color:var(--mut);font-size:.83rem;">No bills recorded yet.</div>'}
      `;
    };

    const old = document.getElementById('_hosBillModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_hosBillModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `<div style="width:100%;max-width:600px;background:var(--card);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div>
          <div style="font-weight:800;font-size:1rem;">🧾 ${pat.name}</div>
          <div style="font-size:.68rem;color:var(--mut);">Hospital Bills &amp; Medical Expenses</div>
        </div>
        <button onclick="document.getElementById('_hosBillModal').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
      </div>
      <div id="_hosBillBody" style="overflow-y:auto;padding:14px 16px;flex:1;-webkit-overflow-scrolling:touch;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    render();
  },

  _saveHosBill(patId){
    const hosp = (document.getElementById('_hb_hosp')||{}).value?.trim();
    const amt  = Number((document.getElementById('_hb_amt')||{}).value||0);
    if(!hosp||!amt){ this.showToastMsg('⚠️ Hospital name and amount required!'); return; }
    const arr = this._getHosBills(patId);
    arr.push({
      id:'hb'+Date.now(),
      hospital:hosp,
      type:(document.getElementById('_hb_type')||{}).value||'Bill',
      amount:amt,
      paid:Number((document.getElementById('_hb_paid')||{}).value||0),
      insurance:Number((document.getElementById('_hb_ins')||{}).value||0),
      date:(document.getElementById('_hb_date')||{}).value||new Date().toISOString().split('T')[0],
      note:(document.getElementById('_hb_note')||{}).value?.trim()||'',
      created:new Date().toISOString()
    });
    this._saveHosBills(patId,arr);
    this.showToastMsg('✅ Bill saved!');
    this.openHospitalBills(patId);
  },

  // ════════════════════════════════════════════════════════════════
  // TRAVEL DAY-WISE ITINERARY
  // localStorage: rk_itinerary_{tripId}
  // ════════════════════════════════════════════════════════════════
  _getItinerary(tripId){ try{ return JSON.parse(localStorage.getItem('rk_itin_'+tripId)||'[]'); }catch{ return []; } },
  _saveItinerary(tripId,arr){ localStorage.setItem('rk_itin_'+tripId,JSON.stringify(arr)); if(window.fbSave) window.fbSave('itin_'+tripId,arr).catch(()=>{}); },

  openItinerary(tripId){
    const t = this.trips.find(x=>x.id===tripId);
    if(!t) return;

    // Build day list from dep to ret
    const days = [];
    if(t.dep){
      const dep = new Date(t.dep);
      const ret = t.ret ? new Date(t.ret) : new Date(t.dep);
      for(let d=new Date(dep); d<=ret; d.setDate(d.getDate()+1)){
        days.push(new Date(d));
      }
    }

    const render = () => {
      const itin = this._getItinerary(tripId);
      const body = document.getElementById('_itinBody');
      if(!body) return;

      const dayLabels = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const slots = ['Morning','Afternoon','Evening','Night'];
      const slotIcons = {Morning:'🌅',Afternoon:'☀️',Evening:'🌆',Night:'🌙'};
      const slotColors = {Morning:'#e3f2fd',Afternoon:'#fff8ee',Evening:'#f3e5f5',Night:'#e8eaf6'};

      // Build day-wise structure
      const dayData = days.length ? days : [null]; // fallback if no dates

      body.innerHTML = `
        <!-- Day selector tabs if multi-day -->
        ${days.length > 1 ? `
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:12px;-webkit-overflow-scrolling:touch;">
          ${days.map((d,i)=>{
            const key = d.toISOString().split('T')[0];
            const active = (this._itinDay||days[0].toISOString().split('T')[0])===key;
            return `<button onclick="APP._itinDay='${key}';APP.openItinerary('${tripId}')"
              style="flex-shrink:0;padding:6px 12px;border-radius:8px;border:1.5px solid ${active?'var(--acc)':'var(--bdr2)'};background:${active?'var(--acc)':'var(--card)'};color:${active?'#fff':'var(--txt)'};font-size:.75rem;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;white-space:nowrap;">
              Day ${i+1}<br><span style="font-size:.6rem;opacity:.8;">${d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span>
            </button>`;
          }).join('')}
        </div>` : ''}

        ${(()=>{
          const curDayKey = this._itinDay || (days.length?days[0].toISOString().split('T')[0]:'');
          const curDay = days.find(d=>d.toISOString().split('T')[0]===curDayKey) || days[0];
          const dayLabel = curDay ? `Day ${days.indexOf(curDay)+1} — ${curDay.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}` : 'Itinerary';
          const dayItems = itin.filter(x=>x.day===curDayKey);

          return `
          <div style="font-weight:800;font-size:.88rem;margin-bottom:10px;">📅 ${dayLabel}</div>

          <!-- Slot-wise activities -->
          ${slots.map(slot=>{
            const slotItems = dayItems.filter(x=>x.slot===slot);
            return `
            <div style="margin-bottom:12px;">
              <div style="font-size:.68rem;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${slotIcons[slot]} ${slot}</div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${slotItems.map(item=>`
                  <div style="background:${slotColors[slot]};border:1.5px solid var(--bdr);border-radius:8px;padding:8px 10px;display:flex;align-items:flex-start;gap:8px;">
                    <div style="flex:1;">
                      <div style="font-weight:700;font-size:.82rem;">${item.title}</div>
                      ${item.place?`<div style="font-size:.7rem;color:var(--mut);">📍 ${item.place}</div>`:''}
                      ${item.time?`<div style="font-size:.7rem;color:var(--mut);">⏰ ${item.time}</div>`:''}
                      ${item.note?`<div style="font-size:.7rem;color:var(--mut);">📝 ${item.note}</div>`:''}
                    </div>
                    <button onclick="(function(){var arr=APP._getItinerary('${tripId}').filter(x=>x.id!=='${item.id}');APP._saveItinerary('${tripId}',arr);APP.openItinerary('${tripId}');})()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem;padding:2px;flex-shrink:0;">🗑</button>
                  </div>`).join('')}

                <!-- Add item to this slot -->
                <div style="display:flex;gap:6px;align-items:center;">
                  <input id="_itin_${slot}_title" placeholder="+ Add ${slot} activity…"
                    style="flex:1;border:1.5px solid var(--bdr2);border-radius:7px;padding:5px 9px;font-family:Nunito,sans-serif;font-size:.78rem;background:var(--bg);color:var(--txt);"
                    onkeydown="if(event.key==='Enter')APP._addItinItem('${tripId}','${curDayKey}','${slot}')">
                  <button onclick="APP._addItinItem('${tripId}','${curDayKey}','${slot}')"
                    style="background:var(--acc);color:#fff;border:none;border-radius:7px;padding:5px 12px;font-size:.78rem;font-weight:700;cursor:pointer;flex-shrink:0;">+</button>
                </div>
              </div>
            </div>`;
          }).join('')}`;
        })()}
      `;
    };

    if(!this._itinDay && days.length) this._itinDay = days[0].toISOString().split('T')[0];

    const old = document.getElementById('_itinModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = '_itinModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `<div style="width:100%;max-width:600px;background:var(--card);border-radius:20px 20px 0 0;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid var(--bdr);flex-shrink:0;">
        <div>
          <div style="font-weight:800;font-size:1rem;">🗺️ ${t.dest}</div>
          <div style="font-size:.68rem;color:var(--mut);">Day-wise Itinerary · ${days.length} day${days.length!==1?'s':''}</div>
        </div>
        <button onclick="document.getElementById('_itinModal').remove()" style="background:var(--dim);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:var(--mut);">✕</button>
      </div>
      <div id="_itinBody" style="overflow-y:auto;padding:14px 16px;flex:1;-webkit-overflow-scrolling:touch;"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
    render();
  },

  _addItinItem(tripId, dayKey, slot){
    const el = document.getElementById('_itin_'+slot+'_title');
    const title = el ? el.value.trim() : '';
    if(!title) return;
    const arr = this._getItinerary(tripId);
    arr.push({id:'it'+Date.now(),day:dayKey,slot,title,place:'',time:'',note:'',created:new Date().toISOString()});
    this._saveItinerary(tripId,arr);
    if(el) el.value='';
    this.openItinerary(tripId);
  },

  renderMedical(){
    const tI={'General Checkup':'🩺','Follow-up':'🔄','Lab Test':'🧪','Specialist Consultation':'👨‍⚕️','Emergency':'🚨','Vaccination':'💉','Surgery/Procedure':'🔬','Dental':'🦷','Eye Checkup':'👁️'};

    // filter30: show visits with follow-up overdue OR due in next 30 days
    const filter30=this.medFilter30||false;
    this.medFilter30=false; // reset after use

    const normNext=(d)=>{
      if(!d) return null;
      if(d.includes('-')) return d;
      return dmyToIso(d)||null;
    };

    const patTabs=`<button class="stab ${this.curPatient==='all'?'on':''}" onclick="APP.medFilter30=false;APP.curPatient='all';APP.renderMedical()">All</button>`
      +this.patients.map(p=>`<button class="stab ${this.curPatient===p.id?'on':''}" onclick="APP.medFilter30=false;APP.curPatient='${p.id}';APP.renderMedical()">${p.name}</button>`).join('');

    const patCards=this.patients.map(p=>{
      const age=p.dob?Math.floor((new Date()-new Date(p.dob))/31557600000):'?';
      const vCount=this.visits.filter(r=>r.patId===p.id).length;
      return`<div class="card" style="display:inline-flex;flex-direction:column;gap:6px;padding:12px 15px;min-width:180px;cursor:pointer;${this.curPatient===p.id?'border-color:var(--acc);':''}" onclick="APP.medFilter30=false;APP.curPatient='${p.id}';APP.renderMedical()">
        <div style="font-weight:700;font-size:.9rem">👤 ${p.name}</div>
        <div style="font-size:.74rem;color:var(--mut)">${p.relation||'Family'} | Age: ${age} | 🩸 ${p.blood||'?'}</div>
        ${p.cond?`<div style="font-size:.72rem;color:var(--acc)">⚠️ ${p.cond}</div>`:''}
        <div style="font-size:.72rem;color:var(--blu)">🏥 ${vCount} visit${vCount!==1?'s':''} recorded</div>
        ${p.ins?`<div style="font-size:.72rem;color:var(--mut)">📋 ${p.ins}</div>`:''}
        <div style="display:flex;gap:5px;margin-top:4px;flex-wrap:wrap;">
          <button class="btn b-grn b-sm" onclick="event.stopPropagation();APP.openMedModal(null,'${p.id}')">+ Visit</button>
          <button class="btn b-sm" style="background:#f4f0ff;color:#5c3496;border:1.5px solid #c4b0f0;font-weight:700;" onclick="event.stopPropagation();APP.openVitalsModal('${p.id}')">📊 Vitals</button>
          <button class="btn b-sm" style="background:#e3f2fd;color:#1565c0;border:1.5px solid #90b8e8;font-weight:700;" onclick="event.stopPropagation();APP.openMedSchedule('${p.id}')">💊 Medicines</button>
          <button class="btn b-sm" style="background:#f3e5f5;color:#7b1fa2;border:1.5px solid #c4b0f0;font-weight:700;" onclick="event.stopPropagation();APP.openHospitalBills('${p.id}')">🧾 Bills</button>
          <button class="btn b-blu b-sm" onclick="event.stopPropagation();APP.openPatientModal('${p.id}')">✏️ Edit</button>
          <button class="btn b-red b-sm" onclick="event.stopPropagation();APP.delPatient('${p.id}')">🗑</button>
        </div>
      </div>`;
    }).join('');

    // Filter: patient + optional follow-up view (overdue + next 30 days)
    let recs=[...this.visits].filter(r=>this.curPatient==='all'||r.patId===this.curPatient);
    if(filter30){
      // ✅ FIX: include OVERDUE (d<0) AND upcoming within 30 days (d<=30)
      // Previously was d>=0 which wrongly excluded overdue follow-ups
      recs=recs.filter(r=>{
        const ni=normNext(r.next);
        if(!ni) return false;
        const d=daysFrom(ni);
        return d!==null && d<=30; // negative=overdue, 0=today, positive=upcoming
      });
      // Sort: overdue first (most overdue at top), then upcoming by date
      recs.sort((a,b)=>{
        const da=daysFrom(normNext(a.next)||'9999');
        const db=daysFrom(normNext(b.next)||'9999');
        return (da??999)-(db??999); // most overdue (most negative) first
      });
    } else {
      recs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    }

    // Date filter for Medical visits
    const medFrom=this._medFrom||'';
    const medTo=this._medTo||'';
    if(!filter30){
      if(medFrom) recs=recs.filter(r=>r.date&&r.date>=medFrom);
      if(medTo)   recs=recs.filter(r=>r.date&&r.date<=medTo);
    }
    const medFilterBar=filter30?'':`
      <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
        <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:.72rem;color:var(--mut);font-weight:600;">From</span>
          <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_mdf" value="${medFrom?isoToDmy(medFrom):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_mdf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._medFrom=iso;APP.renderMedical();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_mdf').showPicker&&document.getElementById('dfh_mdf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_mdf" value="${medFrom||''} " onchange="(function(iso){var el=document.getElementById('df_mdf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._medFrom=iso;APP.renderMedical();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
          <span style="font-size:.72rem;color:var(--mut);font-weight:600;">To</span>
          <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_mdt" value="${medTo?isoToDmy(medTo):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_mdt');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._medTo=iso;APP.renderMedical();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_mdt').showPicker&&document.getElementById('dfh_mdt').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_mdt" value="${medTo||''} " onchange="(function(iso){var el=document.getElementById('df_mdt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._medTo=iso;APP.renderMedical();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
          ${(medFrom||medTo)?'<button onclick="APP._medFrom=\'\';APP._medTo=\'\';APP.renderMedical();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 7px;">✕ Clear</button>':''}
          <span style="font-size:.68rem;color:var(--acc);font-weight:700;margin-left:4px;">${recs.length} record${recs.length!==1?'s':''}</span>
        </div>
      </div>`;

    const cards=recs.map(r=>{
      const pat=this.patients.find(p=>p.id===r.patId);
      const nextIso=normNext(r.next);
      const nd=nextIso?daysFrom(nextIso):null;
      const typeIcon=tI[r.type]||'🏥';
      return`<div class="card">
        <div class="card-hdr">
          <div class="card-title">${typeIcon} ${r.doctor?'Dr. '+r.doctor:r.type}</div>
          <span class="badge bb">${pat?pat.name:'?'}</span>
        </div>
        <div class="card-body">
          <div class="fr"><span class="fl">📅 Visit Date</span><span class="mono" style="font-weight:700;color:var(--acc)">${fD(r.date)}</span></div>
          <div class="fr"><span class="fl">Visit Type</span><span class="badge ba">${r.type}</span></div>
          ${r.spec?`<div class="fr"><span class="fl">Specialization</span><span class="fv">${r.spec}</span></div>`:''}
          ${r.hospital?`<div class="fr"><span class="fl">Hospital</span><span class="fv">${r.hospital}${r.city?', '+r.city:''}</span></div>`:''}
          ${r.purpose?`<div style="background:#f0f7ff;border-radius:6px;padding:6px 9px;font-size:.8rem;border-left:3px solid var(--blu);margin:3px 0"><b>Purpose:</b> ${APP.autoLink(r.purpose)}</div>`:''}
          ${r.meds?`<div style="background:#fff8f0;border-radius:6px;padding:6px 9px;font-size:.78rem;border-left:3px solid var(--org);margin:3px 0;word-break:break-word;">💊 <b>Rx:</b> ${APP.autoLink(r.meds)}</div>`:''}
          ${r.vitals?`<div style="background:#f4f0ff;border-radius:6px;padding:6px 9px;font-size:.78rem;border-left:3px solid var(--pur);margin:3px 0;word-break:break-word;">🔬 <b>Vitals:</b> ${APP.autoLink(r.vitals)}</div>`:''}
          ${r.labname?`<div style="background:#f0fff4;border-radius:6px;padding:6px 9px;font-size:.78rem;border-left:3px solid var(--tel);margin:3px 0;word-break:break-word;">🧪 <b>${r.labname}</b>${r.labdate?` (${fD(r.labdate)})`:''}: ${APP.autoLink(r.labres||'—')}</div>`:''}
          ${nextIso?`<div class="fr"><span class="fl">📅 Next Follow-up</span><span>${remBadge(nd)} <span class="mono" style="font-size:.74rem">${fD(nextIso)}</span></span></div>`:''}
          ${(()=>{
            const pf=(r.presFiles&&r.presFiles.length)||r.link?1:0;
            const lf=(r.labFiles&&r.labFiles.length)||(r.lablink||r.lablink2||r.lablink3)?1:0;
            const tot=(r.presFiles&&r.presFiles.length?r.presFiles.length:r.link?1:0)+(r.labFiles&&r.labFiles.length?r.labFiles.length:[r.lablink,r.lablink2,r.lablink3].filter(Boolean).length);
            if(!tot) return '';
            return `<div class="fr"><span class="fl">📎 Files</span><span style="font-size:.72rem;color:var(--mut);">${pf?'📄 Rx'+(r.presFiles&&r.presFiles.length>1?' ×'+r.presFiles.length:''):''}${pf&&lf?' · ':''}${lf?'🧪 Lab'+(r.labFiles&&r.labFiles.length>1?' ×'+r.labFiles.length:[r.lablink,r.lablink2,r.lablink3].filter(Boolean).length>1?' ×'+[r.lablink,r.lablink2,r.lablink3].filter(Boolean).length:''):''}  <b>${tot} file${tot>1?'s':''} attached</b></span></div>`;
          })()}
          ${r.notes?`<div style="font-size:.76rem;color:var(--mut);margin-top:4px;word-break:break-word;">📝 ${APP.autoLink(r.notes)}</div>`:''}
        </div>
        <div class="card-foot" style="flex-wrap:wrap;gap:6px;">
          <button class="btn b-out b-sm" onclick="APP.openMedModal('${r.id}')">✏️ Edit</button>
          ${nextIso?`<button onclick="APP._medCompleteFollowup('${r.id}')"
            style="display:inline-flex;align-items:center;gap:5px;background:#e8f5e9;color:#166534;border:1.5px solid #90c8a0;border-radius:8px;padding:5px 12px;font-size:.76rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;min-height:32px;">
            ✅ Follow-up Done
          </button>`:''}
          ${(()=>{
            const tot=(r.presFiles&&r.presFiles.length?r.presFiles.length:r.link?1:0)+(r.labFiles&&r.labFiles.length?r.labFiles.length:[r.lablink,r.lablink2,r.lablink3].filter(Boolean).length);
            if(!tot) return '';
            return `<button onclick="APP._medShowFiles('${r.id}')"
              style="display:inline-flex;align-items:center;gap:5px;background:#fff8ee;color:#b56a00;border:1.5px solid #ffcc80;border-radius:8px;padding:5px 12px;font-size:.76rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;touch-action:manipulation;min-height:32px;">
              📎 Files (${tot})
            </button>`;
          })()}
        </div>
      </div>`;
    }).join('');

    const overdueCount=filter30?recs.filter(r=>{const d=daysFrom(normNext(r.next)||'');return d!==null&&d<0;}).length:0;
    const upcomingCount=filter30?recs.filter(r=>{const d=daysFrom(normNext(r.next)||'');return d!==null&&d>=0;}).length:0;
    const filter30Banner=filter30?`<div style="background:#e8f4ff;border:1.5px solid #90b8e8;border-radius:9px;padding:9px 14px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span style="font-size:.82rem;color:#1050a0;font-weight:700;">📅 Follow-ups — ${recs.length} found</span>
        <button class="btn b-out b-sm" onclick="APP.medFilter30=false;APP.renderMedical()">&#10006; Show All Records</button>
      </div>
      <div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap;">
        ${overdueCount>0?`<span style="font-size:.74rem;background:#fee2e2;color:#991b1b;border-radius:6px;padding:3px 9px;font-weight:700;">⚠️ ${overdueCount} Overdue</span>`:''}
        ${upcomingCount>0?`<span style="font-size:.74rem;background:#dcfce7;color:#166534;border-radius:6px;padding:3px 9px;font-weight:700;">📅 ${upcomingCount} Upcoming (next 30d)</span>`:''}
      </div>
    </div>`:'';
    document.getElementById('pan-medical').innerHTML=`
      <div class="sec-hdr"><div class="sec-title">🏥 Medical Records</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn b-out b-sm" onclick="APP.openPatientModal()">+ Add Patient</button><button class="btn b-gold" onclick="APP.openMedModal()">+ Add Visit</button></div></div>
      ${filter30Banner}
      ${filter30?'':(`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">${patCards||'<div style="color:var(--mut);font-size:.85rem;padding:10px">No patients — Add Patient first.</div>'}</div><div class="stabs">${patTabs}</div>`)}
      ${medFilterBar}
      <div class="grid">${cards||`<div class="empty"><div class="ei">🏥</div>${filter30?'No overdue or upcoming follow-ups ✅':this.patients.length?'No records yet — click + Add Visit':'Add a patient first'}</div>`}</div>`;
  },


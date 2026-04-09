  // ══ RENT ══
  _setPayType(t){
    const hid=document.getElementById('pym_type');
    if(hid) hid.value=t;

    const btnPay=document.getElementById('pym_btn_pay');
    const btnRef=document.getElementById('pym_btn_ref');
    const refNote=document.getElementById('pym_refund_note');
    const amtLbl=document.getElementById('pym_amt_label');
    const saveBtn=document.getElementById('pym_save_btn');

    if(t==='payment'){
      if(btnPay){btnPay.style.background='#f0fdf4';btnPay.style.color='#16a34a';btnPay.style.borderBottom='3px solid #16a34a';btnPay.style.fontWeight='800';}
      if(btnRef){btnRef.style.background='var(--dim)';btnRef.style.color='var(--mut)';btnRef.style.borderBottom='3px solid transparent';btnRef.style.fontWeight='700';}
      if(refNote) refNote.style.display='none';
      if(amtLbl) amtLbl.textContent='AMOUNT (₹) — Payment Received *';
      if(saveBtn){saveBtn.textContent='✓ Save Payment';saveBtn.className='btn b-grn';saveBtn.style.flex='2';}
      const amt=document.getElementById('pym_amt');
      if(amt){amt.style.color='#16a34a';amt.style.borderColor='var(--bdr2)';}
    } else {
      if(btnRef){btnRef.style.background='#fff0f0';btnRef.style.color='#c0392b';btnRef.style.borderBottom='3px solid #c0392b';btnRef.style.fontWeight='800';}
      if(btnPay){btnPay.style.background='var(--dim)';btnPay.style.color='var(--mut)';btnPay.style.borderBottom='3px solid transparent';btnPay.style.fontWeight='700';}
      if(refNote) refNote.style.display='block';
      if(amtLbl) amtLbl.textContent='AMOUNT (₹) — Refund to Tenant *';
      if(saveBtn){saveBtn.textContent='↩️ Save Refund';saveBtn.className='btn b-red';saveBtn.style.flex='2';}
      const amt=document.getElementById('pym_amt');
      if(amt){amt.style.color='#c0392b';amt.style.borderColor='#fecaca';}
    }
  },

  // ── Populate "Rent For Month" dropdown ──
  _populateRentMonthSel(defaultVal, payDateStr){
    const sel = document.getElementById('pym_rent_month');
    if(!sel) return;
    const now = new Date();
    // If no explicit defaultVal given, derive from payment date + tenant due day
    let curVal = defaultVal;
    if(!curVal && payDateStr){
      const _t2 = this.payTId ? this.tenants.find(x=>x.id===this.payTId) : null;
      const dueDay = _t2 ? Number(_t2.due)||7 : 7;
      const _rm2 = getRentMonth(payDateStr, dueDay);
      curVal = _rm2.key;
      // Clamp to tenant start month
      if(_t2 && _t2.start && curVal < _t2.start.slice(0,7)){
        curVal = _t2.start.slice(0,7);
      }
      console.log('[_populateRentMonthSel] auto-selected rent month:', curVal, 'for payDate:', payDateStr, 'dueDay:', dueDay);
    }
    if(!curVal) curVal = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    let opts = '';
    for(let i = -6; i <= 2; i++){
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const val = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      const label = MONTHS[d.getMonth()] + ' ' + d.getFullYear()
        + (i===0?' (Current)':i<0?' (Past)':' (Advance)');
      opts += `<option value="${val}"${val===curVal?' selected':''}>${label}</option>`;
    }
    sel.innerHTML = opts;
    // If curVal not in range, prepend it
    if(!sel.value || sel.value !== curVal){
      const [cy,cm] = curVal.split('-');
      const d2 = new Date(parseInt(cy), parseInt(cm)-1, 1);
      const extraLabel = MONTHS[d2.getMonth()] + ' ' + d2.getFullYear() + ' (Selected)';
      sel.innerHTML = `<option value="${curVal}" selected>${extraLabel}</option>` + sel.innerHTML;
      sel.value = curVal;
    }
  },

  openPayModal(tid){
    this.payTId=tid;
    this.payEditId=null;
    const t=this.tenants.find(x=>x.id===tid);
    if(!t){ console.warn('openPayModal: tenant not found',tid); return; }
    const prop=this.props.find(p=>p.id===t.propId);
    const _pmtEl=document.getElementById('payMT');if(_pmtEl)_pmtEl.textContent='💰 New Payment — '+t.name;
    this._setPayType('payment'); // reset to payment mode
    const _delBtn=document.getElementById('pym_del_btn');if(_delBtn)_delBtn.style.display='none';
    const now=new Date(),m=now.getMonth(),y=now.getFullYear();
    const ledger=this.getTenantLedger(t);
    const curMo=ledger.months.find(mo=>mo.year===y&&mo.month===m);
    const curMonthDue=curMo?Math.max(0,curMo.monthlyTotal-curMo.received):Number(t.rent);
    const totalOutstanding=ledger.totalBalance;
    const _maintAmt=Number(t.maint)||0;
    document.getElementById('payM_info').innerHTML=
      '<b>'+t.name+'</b> | '+(prop?prop.name:'')+'<br>'
      +'Rent: <b>'+fmt(t.rent)+'</b>'
      +(_maintAmt?' + Maint: <b>'+fmt(_maintAmt)+'</b>':'')
      +' | Due: <b>'+t.due+'th</b>';
    document.getElementById('payM_bal').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.82rem;">
        <div style="background:#fff8ee;border-radius:7px;padding:8px 10px;">
          <div style="font-size:.65rem;color:var(--mut);text-transform:uppercase;font-weight:700;">This Month Due</div>
          <div style="font-weight:700;color:${curMonthDue>0?'var(--red)':'var(--grn)'};font-size:1rem">${curMonthDue>0?fmt(curMonthDue):'✓ Paid'}</div>
        </div>
        <div style="background:#fff0f0;border-radius:7px;padding:8px 10px;">
          <div style="font-size:.65rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Total Outstanding</div>
          <div style="font-weight:700;color:${totalOutstanding>0?'var(--red)':'var(--grn)'};font-size:1rem">${totalOutstanding>0?fmt(totalOutstanding):'✓ Clear'}</div>
        </div>
      </div>`;
    sv('pym_amt',totalOutstanding>0?totalOutstanding:t.rent);
    svDate('pym_date',now.toISOString().split('T')[0]);
    sv('pym_ref','');sv('pym_note','');sv('pym_mode','NEFT');
    sc('pym_chkRent',true);sc('pym_chkMaint',false);sc('pym_chkOther',false);
    // Init date picker — rebuild every time modal opens so date is fresh
    const _pdw = document.getElementById('pym_date_wrap');
    const _todayForDate = (function(){const _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    if(_pdw && typeof makeDateInput==='function'){ _pdw.innerHTML = makeDateInput('pym_date', _todayForDate); }
    // Also set hidden date input directly as backup
    const _pdh = document.getElementById('pym_date_h');
    if(_pdh) _pdh.value = _todayForDate;
    // When user picks a different date, auto-update the Rent For Month dropdown
    const _pdh2 = document.getElementById('pym_date_h');
    if(_pdh2){
      _pdh2.addEventListener('change', ()=>{
        const iso = _pdh2.value;
        if(iso) this._populateRentMonthSel(null, iso);
      });
    }
    try{ FUM.clear('fu_pay_receipt_wrap'); FUM.init('fu_pay_receipt_wrap','payments',[]); }catch(e){ console.warn('FUM init error:',e); }
    // Auto-pick rent cycle month based on today's date + tenant's due day
    const _todayIso = (function(){const _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    this._populateRentMonthSel(null, _todayIso);
    M.open('payM');
    console.log('[openPayModal] opened for tenant:', tid, 'payTId set to:', this.payTId);
  },

  openEditPayModal(pid){
    const p=this.payments.find(x=>x.id===pid);
    if(!p)return;
    const t=this.tenants.find(x=>x.id===p.tenantId);
    const prop=t&&this.props.find(x=>x.id===t.propId);
    this.payTId=p.tenantId;
    this.payEditId=pid;
    const _pmtEl2=document.getElementById('payMT');if(_pmtEl2)_pmtEl2.textContent='✏️ Edit Payment — '+(t?t.name:'');
    document.getElementById('pym_del_btn').style.display='inline-flex';
    document.getElementById('payM_info').innerHTML=`
      <b>Editing Payment</b> — ${t?t.name:''} | ${prop?prop.name:''}
      <div style="margin-top:4px;background:#fff0f0;border-radius:6px;padding:4px 8px;font-size:.76rem;color:var(--red);">
        ⚠️ Edit karein ya 🗑 Delete karein — Delete button andar hai
      </div>`;
    document.getElementById('payM_bal').innerHTML='';
    sv('pym_amt',p.amount);
    svDate('pym_date',p.date);
    sv('pym_ref',p.ref||'');
    sv('pym_note',p.note||'');
    sc('pym_chkRent',p.incRent!==false);
    sc('pym_chkMaint',!!p.incMaint);
    sc('pym_chkOther',false);
    try{ FUM.clear('fu_pay_receipt_wrap'); FUM.init('fu_pay_receipt_wrap','payments',p.receiptFiles||[]); }catch(e){ console.warn('FUM init (edit) error:',e); }
    // Rebuild date picker with payment's date
    const _pdwE = document.getElementById('pym_date_wrap');
    if(_pdwE){ _pdwE.innerHTML = makeDateInput('pym_date', p.date||''); }
    svDate('pym_date', p.date||'');
    // For edit: use stored rentForMonth. If missing, derive from payment date + due day
    let _editRfm = p.rentForMonth || '';
    if(!_editRfm && p.date){
      const _et = this.tenants.find(x=>x.id===p.tenantId);
      const _eDue = _et ? Number(_et.due)||7 : 7;
      _editRfm = getRentMonth(p.date, _eDue).key;
    }
    this._populateRentMonthSel(_editRfm || (p.date ? p.date.slice(0,7) : null));
    M.open('payM');
    console.log('[openEditPayModal] editing payment:', p.id, 'rentForMonth:', _editRfm);
  },

  // Open pay modal in refund mode
  _openRefundModal(tid){
    this.openPayModal(tid);
    // Switch to refund mode after modal opens
    setTimeout(()=>this._setPayType('refund'),100);
  },

  // Open refund from ledger row — pre-fill date to that month
  _openRefundFromLedger(tid,year,month){
    this.openPayModal(tid);
    setTimeout(()=>{
      this._setPayType('refund');
      // Pre-fill note
      const noteEl=document.getElementById('pym_note');
      const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
      if(noteEl) noteEl.value='Refund for '+MONTHS[parseInt(month)]+' '+year;
    },100);
  },

  deleteCurrentPayment(){
    if(!this.payEditId)return;
    if(!confirm('Yeh payment delete karein? Yeh action undo nahi hoga!'))return;
    S.set('payments',this.payments.filter(p=>p.id!==this.payEditId));
    this.payEditId=null;
    try{ this.syncRentReminders(); }catch(e){}
    M.close('payM');
    this.renderTab(this.curTab);
    this.renderPills();
    this.showToastMsg('✅ Payment delete ho gaya!');
  },

  savePayment(){
    console.log('[savePayment] called. payTId:', this.payTId, 'payEditId:', this.payEditId);
    // Guard: must have a tenant ID
    if(!this.payTId && !this.payEditId){
      alert('Error: No tenant selected. Please close and re-open the payment form.');
      console.error('[savePayment] payTId is missing!');
      return;
    }

    // Disable save button to prevent double-submit
    const _saveBtn = document.getElementById('pym_save_btn');
    if(_saveBtn){ _saveBtn.disabled = true; _saveBtn.textContent = '⏳ Saving...'; }

    const _restoreBtn = () => {
      if(_saveBtn){
        _saveBtn.disabled = false;
        const ptype2 = document.getElementById('pym_type') ? document.getElementById('pym_type').value : 'payment';
        _saveBtn.textContent = ptype2 === 'refund' ? '↩️ Save Refund' : '✓ Save Payment';
      }
    };

    try {
      // ── Validation ──
      const amt = v('pym_amt').replace(/,/g,'');
      if(!amt || isNaN(Number(amt)) || Number(amt) <= 0){
        alert('Valid amount daalo! (0 se zyada hona chahiye)');
        _restoreBtn(); return;
      }
      const date = vDate('pym_date') || (function(){
        const _n=new Date();
        return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');
      })();
      if(!date){ alert('Date required! DD/MM/YYYY format mein bharo.'); _restoreBtn(); return; }

      const ptype = document.getElementById('pym_type') ? document.getElementById('pym_type').value : 'payment';

      // Determine rentForMonth: dropdown value → getRentMonth fallback
      let rentForMonth = v('pym_rent_month') || '';
      if(!rentForMonth){
        const _t = this.payTId ? this.tenants.find(x=>x.id===this.payTId) : null;
        const _dueDay = _t ? Number(_t.due)||7 : 7;
        const _rm = getRentMonth(date, _dueDay);
        rentForMonth = _rm.key;
        // Clamp: never assign to a month before tenant's agreement start
        if(_t && _t.start){
          const _startKey = _t.start.slice(0,7); // YYYY-MM
          if(rentForMonth < _startKey){
            rentForMonth = _startKey;
            console.log('[savePayment] rentForMonth clamped to tenant start:', rentForMonth);
          }
        }
        console.log('[savePayment] rentForMonth auto-derived:', rentForMonth, 'from date:', date, 'dueDay:', _dueDay);
      }

      // Safe FUM access
      let receiptFiles = [];
      try { receiptFiles = (window.FUM && FUM.getFiles) ? FUM.getFiles('fu_pay_receipt_wrap') || [] : []; }
      catch(e){ console.warn('[savePayment] FUM.getFiles error:', e); }

      let ps = [...this.payments];

      const payData = {
        amount: Number(amt),
        date,
        rentForMonth,
        mode: v('pym_mode') || 'Cash',
        ref: v('pym_ref') || '',
        note: v('pym_note') || '',
        ptype,
        incRent: true,
      };
      console.log('[savePayment] payData:', JSON.stringify(payData));

      if(this.payEditId){
        // ── EDIT: update existing entry ──
        const existing = ps.find(p=>p.id===this.payEditId);
        if(!existing){ alert('Error: Payment record not found!'); _restoreBtn(); return; }
        ps = ps.map(p => p.id===this.payEditId ? {
          ...p, ...payData,
          ptype: ptype || p.ptype || 'payment',
          receiptFiles: receiptFiles.length ? receiptFiles : (p.receiptFiles||[])
        } : p);
        this.payEditId = null;
        console.log('[savePayment] updated existing record:', this.payEditId);
        this.showToastMsg(ptype==='refund' ? '✅ Refund updated!' : '✅ Payment updated!');
      } else {
        // ── NEW ENTRY ──
        const newEntry = {
          id: uid(),
          tenantId: this.payTId,
          ...payData,
          receiptFiles,
          createdAt: new Date().toISOString()
        };
        ps.push(newEntry);
        console.log('[savePayment] new entry saved:', JSON.stringify(newEntry));
        this.showToastMsg(ptype==='refund' ? '↩️ Refund recorded!' : '💰 Payment of ₹'+Number(amt).toLocaleString('en-IN')+' saved!');
      }

      // Persist to localStorage + Firebase
      S.set('payments', ps);
      console.log('[savePayment] S.set payments done. Total records:', ps.length);

      // Clear cache so ledger recalculates
      this._ledgerCache = {};

      M.close('payM');
      try{ this.syncRentReminders(); }catch(e){ console.warn('syncRentReminders error:',e); }
      this.renderTab(this.curTab);
      this.renderPills();
    } catch(err){
      console.error('[savePayment] CRITICAL ERROR:', err);
      alert('Error saving payment: ' + err.message + '\n\nPlease check console for details.');
      _restoreBtn();
    }
  },

  delPayment(id){
    this.delCb=()=>{S.set('payments',this.payments.filter(p=>p.id!==id));try{this.syncRentReminders();}catch(e){};this.renderTab(this.curTab);this.renderPills();};
    document.getElementById('delMsg').textContent='Delete this payment record?';M.open('delM');
  },

  // ══ RENT RECEIPT GENERATOR ══
  generateReceipt(payId){
    // Find payment
    const p=this.payments.find(x=>x.id===payId);
    if(!p) return;
    const t=this.tenants.find(x=>x.id===p.tenantId);
    if(!t) return;
    const prop=this.props.find(x=>x.id===t.propId);
    const now=new Date();
    const receiptNo='RCP-'+now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+payId.slice(-4).toUpperCase();
    const rentPeriod=p.rentMonth?p.rentMonth:(new Date(p.date).toLocaleString('en-IN',{month:'long',year:'numeric'}));

    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Rent Receipt — ${receiptNo}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Georgia,serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}
      .receipt{background:#fff;width:680px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.12);border-radius:4px;position:relative;}
      .receipt::before{content:'';position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#1a3a6e,#2c6fad,#1a7a45);}
      .logo-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #e9ecef;}
      .landlord{font-size:22px;font-weight:700;color:#1a3a6e;letter-spacing:-.02em;}
      .sub{font-size:12px;color:#6c757d;margin-top:3px;}
      .receipt-title{text-align:right;}
      .receipt-title h2{font-size:28px;color:#2c6fad;font-weight:700;letter-spacing:.02em;text-transform:uppercase;}
      .receipt-no{font-size:11px;color:#6c757d;margin-top:4px;font-family:monospace;}
      .section{margin-bottom:20px;}
      .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#6c757d;font-weight:700;margin-bottom:10px;border-bottom:1px solid #e9ecef;padding-bottom:5px;}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
      .field label{font-size:11px;color:#6c757d;display:block;margin-bottom:3px;font-weight:600;}
      .field span{font-size:14px;color:#1a1d23;font-weight:600;}
      .amount-box{background:linear-gradient(135deg,#f0f7ff,#e8f5e9);border:2px solid #2c6fad;border-radius:8px;padding:20px 24px;text-align:center;margin:20px 0;}
      .amount-label{font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}
      .amount-value{font-size:36px;font-weight:700;color:#1a3a6e;margin:6px 0;font-family:'Courier New',monospace;}
      .amount-words{font-size:13px;color:#2c6fad;font-style:italic;}
      .sig-row{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:36px;padding-top:20px;border-top:1px solid #e9ecef;}
      .sig-box{text-align:center;}
      .sig-line{border-top:2px solid #1a3a6e;margin-bottom:8px;margin-top:50px;}
      .sig-label{font-size:11px;color:#6c757d;font-weight:600;}
      .footer{margin-top:24px;padding-top:16px;border-top:1px dashed #dee2e6;text-align:center;font-size:11px;color:#6c757d;}
      .badge{display:inline-block;background:#e8f5e9;color:#1a7a45;border:1px solid #90c8a0;border-radius:4px;padding:2px 10px;font-size:12px;font-weight:700;}
      @media print{body{background:#fff;padding:0;}  .receipt{box-shadow:none;} @page{margin:16mm 14mm;}}
    </style></head><body>
    <div class="receipt">
      <div class="logo-row">
        <div>
          <div class="landlord">Raman Kumar</div>
          <div class="sub">Property Owner / Landlord</div>
          <div class="sub" style="margin-top:6px;">📍 ${prop?prop.city||prop.name:''}</div>
        </div>
        <div class="receipt-title">
          <h2>Rent Receipt</h2>
          <div class="receipt-no"># ${receiptNo}</div>
          <div class="receipt-no" style="margin-top:4px;">Date: ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>
          <div style="margin-top:8px;"><span class="badge">✓ PAYMENT RECEIVED</span></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Property & Tenant Details</div>
        <div class="grid2">
          <div class="field"><label>Property Name</label><span>${prop?prop.name:'—'}</span></div>
          <div class="field"><label>Property Type</label><span>${prop?prop.type:'—'}</span></div>
          <div class="field"><label>Tenant Name</label><span>${t.name}</span></div>
          <div class="field"><label>Rent Period</label><span>${rentPeriod}</span></div>
          <div class="field"><label>Payment Date</label><span>${fD(p.date)}</span></div>
          <div class="field"><label>Payment Mode <span style="color:var(--mut);font-size:.65rem;">(optional)</span></label><span>${p.mode||'Cash'}</span></div>
          ${p.ref?`<div class="field"><label>Reference / UTR</label><span style="font-family:monospace;">${p.ref}</span></div>`:''}
          ${t.ph?`<div class="field"><label>Tenant Phone</label><span>${t.ph}</span></div>`:''}
        </div>
      </div>

      <div class="amount-box">
        <div class="amount-label">Amount Received</div>
        <div class="amount-value">₹${Number(p.amount).toLocaleString('en-IN')}</div>
        <div class="amount-words">${(function(){
          const n=Math.floor(Number(p.amount));
          const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
          const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
          const convert=n=>{if(n<20)return ones[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');if(n<1000)return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+convert(n%100):'');if(n<100000)return convert(Math.floor(n/1000))+' Thousand'+(n%1000?' '+convert(n%1000):'');if(n<10000000)return convert(Math.floor(n/100000))+' Lakh'+(n%100000?' '+convert(n%100000):'');return convert(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+convert(n%10000000):'');};
          return convert(n)+' Rupees Only';
        })()}</div>
      </div>

      ${p.note?`<div style="background:#fff8ee;border:1px solid #ffe0b2;border-radius:6px;padding:10px 14px;font-size:13px;color:#7a4400;margin-bottom:16px;"><b>Note:</b> ${p.note}</div>`:''}

      <div class="sig-row">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Tenant's Signature</div>
          <div style="font-size:12px;color:#6c757d;margin-top:4px;">${t.name}</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Landlord's Signature</div>
          <div style="font-size:12px;color:#6c757d;margin-top:4px;">Raman Kumar</div>
        </div>
      </div>

      <div class="footer">
        This is a computer-generated receipt and is valid without a physical signature. · Raman Kumar Property Management
      </div>
    </div>
    window.onload=function(){window.print();}<\/script>
    </body></html>`;

    const _rcptBlob=new Blob([html],{type:'text/html;charset=utf-8'});
    const _rcptA=document.createElement('a');
    _rcptA.href=URL.createObjectURL(_rcptBlob);
    _rcptA.download='Rent_Receipt_'+receiptNo+'_'+new Date().toISOString().slice(0,10)+'.html';
    document.body.appendChild(_rcptA);_rcptA.click();document.body.removeChild(_rcptA);
    URL.revokeObjectURL(_rcptA.href);
    this.showToastMsg('✅ Receipt downloaded! Open the file → press Ctrl+P → Save as PDF to get PDF');
  },

  setRentSub(s){this.rentSub=s;this.renderRent();},

  // ─── RENT LEDGER ENGINE (v17 — Correct invoice/due logic) ─────────────────
  //
  // KEY FORMULA:
  //   invoiceDate = tenant.invdate day of month  (OR 1st if not set)
  //   dueDate     = tenant.due day of month
  //
  // RULES:
  //   today < invoiceDate  → "Upcoming"  — NOT charged, excluded from outstanding
  //   today >= invoiceDate → "Due"       — charge it, include in outstanding
  //   today > dueDate AND unpaid → "Overdue"
  //
  // Outstanding = SUM of all months where invoiceDate has passed AND balance>0
  // ─────────────────────────────────────────────────────────────────────────────
  getTenantLedger(t){
    // Bug5 fix: memoize per render cycle — cache key = tenantId + payment count
    const cacheKey = (t.id||'') + ':' + (this.payments||[]).length;
    if(this._ledgerCache[cacheKey]) return this._ledgerCache[cacheKey];
    if(!t.start){ const empty={months:[],totalExpected:0,totalReceived:0,totalBalance:0}; this._ledgerCache[cacheKey]=empty; return empty; }
    const now=new Date(); now.setHours(0,0,0,0);
    // Use parseIso (not new Date) to avoid UTC timezone shift on YYYY-MM-DD strings
    const start = parseIso(t.start) || new Date();
    start.setHours(0,0,0,0);
    const rent=Number(t.rent);
    const maint=Number(t.maint)||0;
    const monthlyTotal=rent+maint;

    // Invoice day = invdate day field OR 1st of month
    // invdate stored as ISO date — extract just the day number
    // Use parseIso (not new Date) to avoid UTC timezone shift on date-only strings
    const invDay=(()=>{
      if(t.invdate){
        const d = parseIso(t.invdate);
        if(d && !isNaN(d)) return d.getDate();
      }
      return 1; // default: invoice on 1st of month
    })();
    const dueDay=Number(t.due)||1;

    // Build list of months from agreement start month to current month
    const months=[];
    let cur=new Date(start.getFullYear(),start.getMonth(),1);
    const endBound=new Date(now.getFullYear(),now.getMonth(),1);
    while(cur<=endBound){
      months.push({year:cur.getFullYear(),month:cur.getMonth()});
      cur=new Date(cur.getFullYear(),cur.getMonth()+1,1);
    }

    const allPayments=[...this.payments]
      .filter(p=>p.tenantId===t.id)
      .sort((a,b)=>(a.date||'').localeCompare(b.date||''));

    let runningBalance=0;
    let totalExpected=0; // only counts months whose invoiceDate has passed

    const ledger=months.map(({year,month})=>{
      // Invoice date: when this month's rent is generated/charged
      const invoiceDate=new Date(year,month,invDay);
      invoiceDate.setHours(0,0,0,0);

      // Due date: last date to pay without being overdue
      const dueDate=new Date(year,month,dueDay);
      dueDate.setHours(0,0,0,0);

      // Rent period: 1st to last day of month
      const periodStart=new Date(year,month,1);
      const periodEnd=new Date(year,month+1,0);

      const isPast=year<now.getFullYear()||(year===now.getFullYear()&&month<now.getMonth());
      const isCurrent=year===now.getFullYear()&&month===now.getMonth();

      // Payments in this month — use rentForMonth if present (set by getRentMonth at save time)
      // else fall back to payment date's calendar month
      const monthKey=year+'-'+String(month+1).padStart(2,'0');
      const monthPays=allPayments.filter(p=>{
        // Prefer rentForMonth (rent-cycle based) over raw payment date
        if(p.rentForMonth) return p.rentForMonth === monthKey;
        // Legacy fallback: no rentForMonth stored → use calendar month of payment date
        if(p.date) return p.date.slice(0,7) === monthKey;
        return false;
      });
      // Net received = payments - refunds (refunds have ptype='refund')
      const received=monthPays.reduce((s,p)=>{
        return p.ptype==='refund' ? s-Number(p.amount) : s+Number(p.amount);
      },0);

      // Has invoice been generated yet?
      const invoiceGenerated=now>=invoiceDate;

      let status='upcoming'; // before invoice date
      let charged=false;

      if(invoiceGenerated){
        charged=true;
        totalExpected+=monthlyTotal;
        runningBalance+=monthlyTotal;
        runningBalance-=received;
        if(runningBalance<=0)           status='clear';
        else if(now>dueDate)            status='overdue';
        else                            status='due';
      } else {
        // Invoice not yet generated — don't charge, don't add to outstanding
        runningBalance-=received; // still credit any advance payments
        status='upcoming';
      }

      const daysUntilInv=Math.ceil((invoiceDate-now)/86400000);
      const daysUntilDue=Math.ceil((dueDate-now)/86400000);
      const daysOverdue=status==='overdue'?Math.ceil((now-dueDate)/86400000):0;

      return{
        year,month,monthlyTotal,received,
        balance:Math.max(0,runningBalance),
        payments:monthPays,
        invoiceDate,dueDate,periodStart,periodEnd,
        status,charged,isPast,isCurrent,runningBalance,
        daysUntilInv,daysUntilDue,daysOverdue
      };
    });

    // Total received = all payments minus refunds
    const totalReceived=allPayments.reduce((s,p)=>{
      return p.ptype==='refund' ? s-Number(p.amount) : s+Number(p.amount);
    },0);
    // Outstanding = only charged months with positive balance
    const totalBalance=Math.max(0,runningBalance);
    const billedMonths=ledger.filter(m=>m.charged).length;

    const result={months:ledger,totalExpected,totalReceived,totalBalance,monthCount:billedMonths,allMonths:months.length};
    this._ledgerCache[cacheKey]=result; // Bug5 fix: store in cache
    return result;
  },
  // ── AUTO RENT REMINDER: creates/updates reminder when invoice is generated ──
  // Called from renderRent and init to keep reminders in sync
  // ═══════════════════════════════════════════════════════════════
  // RENT REMINDER ENGINE (v18)
  //
  // ONE reminder per tenant per month (not multiple)
  // No expiry — reminder stays ACTIVE until rent is paid
  // On payment → reminder auto-deleted
  // Trigger = invoice date
  // Status = Due | Overdue Xd (calculated live, not from expiry)
  // ═══════════════════════════════════════════════════════════════
  syncRentReminders(){
    // ONE reminder per tenant (not per month) — shows total outstanding
    // No expiry date — stays until rent is fully paid
    const now=new Date();now.setHours(0,0,0,0);
    let reminders=[...this.reminders];
    let changed=false;

    // Remove ALL old-style per-month rent reminders first
    const before=reminders.length;
    reminders=reminders.filter(r=>!r._isAutoRent);
    if(reminders.length!==before) changed=true;

    this.tenants.filter(t=>t.status==='active').forEach(t=>{
      const ledger=this.getTenantLedger(t);
      const prop=this.props.find(p=>p.id===t.propId);
      const totalBal=ledger.totalBalance;

      // Only create reminder if there is outstanding rent
      if(totalBal<=0) return;

      const overdueMonths=ledger.months.filter(mo=>mo.status==='overdue');
      const dueMonths=ledger.months.filter(mo=>mo.status==='due');
      const daysOv=overdueMonths.length>0?Math.max(...overdueMonths.map(mo=>mo.daysOverdue||0)):0;

      // Single reminder key per tenant
      const remKey='auto_rent_v2_'+t.id;

      // dTrig: negative = overdue, 0 = due today, positive = due in future
      const dTrig = daysOv > 0 ? -daysOv : (dueMonths.length>0 ? 0 : -1);

      const statusLabel=overdueMonths.length>0
        ? daysOv+'d Overdue'
        : dueMonths.length>0 ? 'Due Now' : 'Due';

      const reminderData={
        _autoKey:remKey,
        _isAutoRent:true,
        _tenantId:t.id,
        name:'💰 Rent Due — '+t.name+(prop?' ('+prop.name+')':''),
        type:'💰 Rent',
        person:t.name,
        mode:'rent',
        exp:'',        // NO expiry date — rent never expires
        before:'0',
        _trigDate:'',  // no trigger date needed
        _dTrig:dTrig,
        _invoiceAmt:ledger.totalExpected,
        _receivedAmt:ledger.totalReceived,
        _balanceAmt:totalBal,
        _daysOv:daysOv,
        _statusLabel:statusLabel,
        notes:'Monthly Rent: ₹'+fmt(t.rent)+
              ' | Due: '+t.due+'th of month'+
              ' | Outstanding: ₹'+fmt(totalBal)+
              (overdueMonths.length>0?' | Overdue: '+daysOv+'d':''),
        autorenew:'no'
      };

      const existIdx=reminders.findIndex(r=>r._autoKey===remKey);
      if(existIdx!==-1){
        // Only mark changed if data actually differs
        const existing = reminders[existIdx];
        const hasChange = existing._balanceAmt !== reminderData._balanceAmt ||
                          existing._daysOv !== reminderData._daysOv ||
                          existing._statusLabel !== reminderData._statusLabel;
        if(hasChange) {
          reminders[existIdx]={...reminders[existIdx],...reminderData};
          changed=true;
        }
      } else {
        // Use deterministic ID based on autoKey to prevent duplicates across devices
        reminders.push({id:remKey,...reminderData});
        changed=true;
      }
    });

    // Remove reminders for tenants who have cleared dues
    const activeIds=this.tenants.filter(t=>t.status==='active').map(t=>t.id);
    const before2=reminders.length;
    reminders=reminders.filter(r=>{
      if(!r._isAutoRent) return true;
      const t=this.tenants.find(x=>x.id===r._tenantId);
      if(!t) return false;
      return this.getTenantLedger(t).totalBalance>0;
    });
    if(reminders.length!==before2) changed=true;

    if(changed){ S.set('reminders',reminders); }
  },



  renderRent(){
    // Sync auto rent reminders whenever rent tab is opened
    try{ this.syncRentReminders(); }catch(e){}
    const s=this.rentSub;
    const now=new Date(),m=now.getMonth(),y=now.getFullYear();
    const tabs=[['overview','📊 Overview'],['tenants','👥 Tenants'],['ledger','📒 Full Ledger'],['history','📜 Payments'],['hikes','📈 Rent Hikes'],['templates','✉️ Message Templates']];
    let html='';

    // ── Template helpers ──
    const getTpl=(key,def)=>localStorage.getItem('rk_tpl_'+key)||def;
    const fillTpl=(tpl,vars)=>tpl.replace(/\{(\w+)\}/g,(_,k)=>vars[k]||'');

    if(s==='overview'){
      // Summary using full ledger engine
      let totExp=0,totRec=0,totBal=0;

      // ── Loan outstanding rows ──
      // Loans removed — use Khata Book tab
      const loanRows=''; const _skipLoans=(()=>{
        const loans=[];
        if(!loans.length) return '';
        return loans.map(loan=>{
          const isGiven=loan.type==='loan';
          const outstanding=isGiven?Math.max(0,loan.amount-(loan.loanReceived||0)):loan.amount-(loan.loanReceived||0);
          if(!isGiven) totBal+=Math.max(0,outstanding); // liability
          else totBal+=Math.max(0,outstanding);          // asset owed to us
          const statusLabel=loan.loanStatus==='received'?'✅ Received':loan.loanStatus==='partial'?'⚠️ Partial':'📌 Receivable';
          const statusBg=loan.loanStatus==='received'?'#e8f5e9':loan.loanStatus==='partial'?'#fff8ee':'#fff0e0';
          const statusColor=loan.loanStatus==='received'?'#1e7a45':loan.loanStatus==='partial'?'#854f0b':'#7a4000';
          const waMsg=encodeURIComponent('\uD83E\uDD1D *Loan Recovery*\nBorrower: '+loan.loanBorrower+'\nAmount: '+fmt(loan.amount)+(loan.loanReceived>0?'\nReceived: '+fmt(loan.loanReceived):'')+' \nOutstanding: '+fmt(outstanding)+'\n\nPlease return the loan amount.\nRaman Kumar');
          return`<div style="background:var(--card);border:1.5px solid #e8a060;border-left:4px solid #c4700a;border-radius:11px;padding:13px 14px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div style="flex:1;min-width:180px;">
                <div style="font-weight:800;font-size:.92rem;">🤝 ${loan.loanBorrower||'—'}</div>
                <div style="font-size:.72rem;color:var(--mut);margin-top:2px;">${isGiven?'Loan Given':'Loan Taken'} · ${fD(loan.date)}</div>
                ${loan.loanDueDate?`<div style="font-size:.72rem;color:var(--mut);">Due: ${fD(loan.loanDueDate)}</div>`:''}
              </div>
              <span style="background:${statusBg};color:${statusColor};padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700;flex-shrink:0;">${statusLabel}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:10px 0;">
              <div style="background:var(--dim);border-radius:7px;padding:7px 9px;text-align:center;">
                <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Given</div>
                <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;">${fmt(loan.amount)}</div>
              </div>
              <div style="background:var(--dim);border-radius:7px;padding:7px 9px;text-align:center;">
                <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Received</div>
                <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--grn);">${fmt(loan.loanReceived||0)}</div>
              </div>
              <div style="background:${outstanding>0?'#fff5f5':'#f0faf5'};border-radius:7px;padding:7px 9px;text-align:center;">
                <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Outstanding</div>
                <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${outstanding>0?'var(--red)':'var(--grn)'};">${outstanding>0?fmt(outstanding):'✓'}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--bdr);padding-top:10px;">
              <button class="btn b-grn b-sm" onclick="APP._markLoanReceived('${loan.id}')">✅ Mark Received</button>
              <button class="btn b-sm" style="background:#fff8ee;color:#854f0b;border:1px solid #e8a060;" onclick="APP._markLoanPartial('${loan.id}')">⚠️ Partial</button>
              ${(loan.loanBorrower&&loan.loanPhone)?`<button class="btn b-sm" style="background:#e8f5e9;color:#1e7a45;border:1px solid #90c8a0;" onclick="APP.sendWhatsApp('${loan.loanBorrower}','${fmt(Math.max(0,loan.amount-(loan.loanReceived||0)))}','${loan.loanPhone||''}','loan')">📲 WhatsApp</button>`:(loan.loanBorrower?`<button class="btn b-sm" style="background:#f0f2f5;color:#adb5bd;border:1px solid #e9ecef;cursor:not-allowed;" disabled title="Add phone in loan record to enable WhatsApp">📵 No Phone</button>`:'')}
              <button class="btn b-out b-sm" onclick="APP.openExpModal('${loan.id}')">✏️ Edit</button>
            </div>
          </div>`;
        }).join('');
      })();

      const rows=this.tenants.filter(t=>t.status==='active').map(t=>{
        const prop=this.props.find(p=>p.id===t.propId);
        const ledger=this.getTenantLedger(t);
        totExp+=ledger.totalExpected; totRec+=ledger.totalReceived; totBal+=ledger.totalBalance;
        const curMo=ledger.months.find(mo=>mo.year===y&&mo.month===m);
        const curRec=curMo?curMo.received:0;
        // Only show current month balance if it's been invoiced (not upcoming)
        const curBal=curMo&&curMo.charged?Math.max(0,curMo.monthlyTotal-curMo.received):0;
        const isOvd=curMo&&curMo.status==='overdue';

        // Build message from template
        const vars={
          tenant_name:t.name,
          property:prop?prop.name:'—',
          monthly_rent:fmt(t.rent),
          due_day:t.due+'th',
          this_month_due:fmt(curBal),
          total_outstanding:fmt(ledger.totalBalance),
          months_unpaid:ledger.monthCount,
          phone:t.ph||'—',
          landlord:'Raman Kumar'
        };
        const waTpl=getTpl('wa_rent',`💰 *Rent Due Notice*\nTenant: {tenant_name}\nProperty: {property}\nMonthly Rent: {monthly_rent}\nDue: {due_day} of month\nThis Month Due: {this_month_due}\nTotal Outstanding: {total_outstanding}\n\nHave you deposited the rent? If yes, please share the payment screenshot.\n\nThank you,\n{landlord}`);
        const mailTpl=getTpl('mail_rent_body',`Dear {tenant_name},\n\nYour rent is due.\nProperty: {property}\nMonthly Rent: {monthly_rent}\nDue Day: {due_day}\nThis Month Due: {this_month_due}\nTotal Outstanding: {total_outstanding}\n\nPlease pay at the earliest.\n\nRegards,\n{landlord}`);
        const mailSubjTpl=getTpl('mail_rent_subj','Rent Due — {tenant_name} — {this_month_due}');

        // ── QUICK SEND: pre-filled default message (no template) ──
        const quickWaMsg=encodeURIComponent(`💰 *Rent Due Notice*\n\nDear ${t.name},\n\nProperty: ${prop?prop.name:'—'}\nMonthly Rent: ${fmt(t.rent)}\nDue Date: ${t.due}th of every month\nThis Month Due: ${fmt(curBal)}\nTotal Outstanding: ${fmt(ledger.totalBalance)}\n\nHave you deposited the rent? If yes, please share the payment screenshot.\n\nThank you,\n{landlord}`);
        const quickMailSubj=encodeURIComponent(`Rent Due — ${t.name} — ${fmt(curBal>0?curBal:ledger.totalBalance)}`);
        const quickMailBody=encodeURIComponent(`Dear ${t.name},\n\nYour rent is due. Details below:\n\nProperty    : ${prop?prop.name:'—'}\nMonthly Rent: ${fmt(t.rent)}\nDue Day     : ${t.due}th of every month\nThis Month  : ${fmt(curBal)}\nOutstanding : ${fmt(ledger.totalBalance)}\nMonths Due  : ${ledger.monthCount}\n\nPlease pay at the earliest to avoid late charges.\n\nWith regards,\nRaman Kumar\nPhone: +91 XXXXX XXXXX`);

        // ── TEMPLATE SEND: uses saved/custom template ──
        const waRentMsg=encodeURIComponent(fillTpl(waTpl,vars));
        const mailRentSubj=encodeURIComponent(fillTpl(mailSubjTpl,vars));
        const mailRentBody=encodeURIComponent(fillTpl(mailTpl,vars));

        // ── Punctuality Score ──────────────────────────────────────
        const _allPays=this.payments.filter(p=>p.tenantId===t.id&&p.ptype!=='refund');
        let _onTime=0,_late=0,_adv=0;
        ledger.months.filter(mo=>mo.charged&&mo.payments.length>0).forEach(mo=>{
          mo.payments.forEach(p=>{
            const pd=p.date?parseIso(p.date):null;
            if(!pd) return;
            if(pd<mo.invoiceDate) _adv++;
            else if(pd<=mo.dueDate) _onTime++;
            else _late++;
          });
        });
        const _totalPay=_onTime+_late+_adv;
        const _punctScore=_totalPay>0?Math.round((_onTime+_adv)/_totalPay*100):null;
        const _punctLabel=_punctScore===null?'—':_punctScore>=90?'🟢 Excellent':_punctScore>=70?'🟡 Good':_punctScore>=50?'🟠 Fair':'🔴 Late Payer';
        const _punctBg=_punctScore===null?'var(--dim)':_punctScore>=90?'#dcfce7':_punctScore>=70?'#fef9c3':_punctScore>=50?'#ffedd5':'#fee2e2';
        const _punctClr=_punctScore===null?'var(--mut)':_punctScore>=90?'#166534':_punctScore>=70?'#854d0e':_punctScore>=50?'#9a3412':'#991b1b';
        // ─────────────────────────────────────────────────────────────
        const statusColor=ledger.totalBalance<=0?'#1e7a45':isOvd?'#a32d2d':'#854f0b';
        const statusBg=ledger.totalBalance<=0?'#e8f5e9':isOvd?'#fcebeb':'#fff8ee';
        const statusLabel=ledger.totalBalance<=0?'\u2713 Clear':isOvd?'Overdue':curMo&&curMo.status==='upcoming'?'Upcoming':'Due';
        return`<div style="background:var(--card);border:1.5px solid ${isOvd?'#f0a0a0':'var(--bdr)'};border-left:4px solid ${isOvd?'#e05050':curBal>0?'#e09050':'#90c8a0'};border-radius:11px;padding:13px 14px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="flex:1;min-width:180px;">
              <div style="font-weight:800;font-size:.92rem;">${t.name}</div>
              <div style="font-size:.72rem;color:var(--mut);margin-top:2px;">${prop?prop.name:'\u2014'} \u00b7 ${t.ph||'No phone'}</div>
              <div style="font-size:.72rem;color:var(--mut);margin-top:1px;">Invoice: ${t.invdate?new Date(t.invdate).getDate():1}st \u00b7 Due: ${t.due}th \u00b7 ${fmt(t.rent)}/mo${t.sec>0?' \uD83D\uDD12 Sec: '+fmt(t.sec):''}</div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;">
                <span style="background:${_punctBg};color:${_punctClr};font-size:.66rem;font-weight:700;padding:2px 7px;border-radius:5px;">${_punctLabel}${_punctScore!==null?' ('+_punctScore+'%)':''}</span>
                ${(t.rentHistory&&t.rentHistory.length)?'<span style="background:#eff6ff;color:#1e40af;font-size:.66rem;font-weight:700;padding:2px 7px;border-radius:5px;">📈 '+t.rentHistory.length+' hike'+(t.rentHistory.length>1?'s':'')+'</span>':''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <span style="background:${statusBg};color:${statusColor};padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700;">${statusLabel}</span>
              ${curMo&&curMo.status==='upcoming'?`<div style="font-size:.68rem;color:var(--blu);margin-top:3px;">Invoice in ${curMo.daysUntilInv}d</div>`:''}
              ${isOvd?`<div style="font-size:.68rem;color:var(--red);margin-top:3px;">${curMo?curMo.daysOverdue:0}d overdue</div>`:''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:10px 0 10px;">
            <div style="background:var(--dim);border-radius:7px;padding:7px 9px;text-align:center;">
              <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">This Month</div>
              <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${curBal>0?'var(--red)':'var(--grn)'};">${curMo&&curMo.status==='upcoming'?'\u2014':(curBal>0?fmt(curBal):'\u2713 Paid')}</div>
            </div>
            <div style="background:var(--dim);border-radius:7px;padding:7px 9px;text-align:center;">
              <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Received</div>
              <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--grn);">${fmt(ledger.totalReceived)}</div>
            </div>
            <div style="background:${ledger.totalBalance>0?'#fff5f5':'#f0faf5'};border-radius:7px;padding:7px 9px;text-align:center;">
              <div style="font-size:.58rem;color:var(--mut);text-transform:uppercase;font-weight:700;">Outstanding</div>
              <div style="font-size:.85rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${ledger.totalBalance>0?'var(--red)':'var(--grn)'};">${ledger.totalBalance>0?fmt(ledger.totalBalance):'\u2713'}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--bdr);padding-top:10px;">
            ${curBal>0?`<button class="btn b-grn b-sm" onclick="APP.openPayModal('${t.id}')" style="min-height:36px;">\uD83D\uDCB0 Pay</button>`:''}
            <button class="btn b-out b-sm" onclick="APP.openTenModal('${t.id}')">\u270F\uFE0F Edit</button>
            <button class="btn b-out b-sm" onclick="APP.goTab('rent');APP.viewLedgerTid='${t.id}';APP.setRentSub('ledger')">\uD83D\uDCD2 Ledger</button>
            <div style="border:1px solid #b7e0b7;border-radius:7px;overflow:hidden;background:#f0faf0;">
              <div style="font-size:.6rem;font-weight:700;color:#1e7a45;padding:3px 8px;background:#d8f5d8;text-transform:uppercase;letter-spacing:.04em;">📱 WhatsApp</div>
              <div style="display:flex;">
                ${t.ph
                  ? `<a href="https://wa.me/${t.ph.replace(/\D/g,'')}?text=${quickWaMsg}" target="_blank" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#1e7a45;text-decoration:none;border-right:1px solid #b7e0b7;background:#fff;" title="Quick WA">⚡ Quick</a><a href="https://wa.me/${t.ph.replace(/\D/g,'')}?text=${waRentMsg}" target="_blank" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#1e7a45;text-decoration:none;background:#fff;" title="Template WA">✏️ Template</a>`
                  : `<button onclick="APP._tenWA('${t.id}')" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#999;background:#fff;border:none;cursor:pointer;font-family:'Nunito',sans-serif;">📵 No Phone — Add</button>`}
              </div>
            </div>
            <div style="border:1px solid #f4c2b8;border-radius:7px;overflow:hidden;background:#fff3f0;">
              <div style="font-size:.6rem;font-weight:700;color:#c5221f;padding:3px 8px;background:#fde0db;text-transform:uppercase;letter-spacing:.04em;">📧 Email</div>
              <div style="display:flex;">
                ${t.email
                  ? `<a href="mailto:${t.email}?subject=${quickMailSubj}&body=${quickMailBody}" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#c5221f;text-decoration:none;border-right:1px solid #f4c2b8;background:#fff;">⚡ Quick</a><a href="mailto:${t.email}?subject=${mailRentSubj}&body=${mailRentBody}" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#c5221f;text-decoration:none;background:#fff;">✏️ Template</a>`
                  : `<button onclick="APP._tenEmail('${t.id}')" style="flex:1;text-align:center;padding:4px 6px;font-size:.7rem;font-weight:700;color:#999;background:#fff;border:none;cursor:pointer;font-family:'Nunito',sans-serif;">📭 No Email — Add</button>`}
              </div>
            </div>
            <button onclick="APP._showTenDocs('${t.id}')" style="background:#fff8ee;color:#b56a00;border:2px solid #ffcc80;border-radius:7px;padding:5px 10px;font-size:.76rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;display:inline-flex;align-items:center;gap:4px;min-height:36px;touch-action:manipulation;">📎 Files${t.docFiles&&t.docFiles.length?' ('+t.docFiles.length+')':''}</button>
            ${(t.rentHistory&&t.rentHistory.length)?`<span style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;padding:3px 8px;font-size:.68rem;font-weight:700;cursor:pointer;" onclick="APP.goTab('rent');APP.setRentSub('hikes');" title="Rent Hike History">📈 ${t.rentHistory.length} hike${t.rentHistory.length>1?'s':''}</span>`:''}
          </div>
        </div>`;
      }).join('');

      html=`
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
          <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:10px;padding:11px 13px;">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);font-weight:700;">Total Expected</div>
            <div style="font-size:1.1rem;font-weight:900;font-family:'JetBrains Mono',monospace;margin-top:3px;">${fmt(totExp)}</div>
          </div>
          <div style="background:linear-gradient(135deg,#f0faf4,#dcf5e8);border:1.5px solid #90c8a0;border-radius:10px;padding:11px 13px;">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--grn);font-weight:700;">Total Received</div>
            <div style="font-size:1.1rem;font-weight:900;font-family:'JetBrains Mono',monospace;color:var(--grn);margin-top:3px;">${fmt(totRec)}</div>
          </div>
          <div style="background:${totBal>0?'linear-gradient(135deg,#fff5f5,#ffe0e0)':'linear-gradient(135deg,#f0faf4,#dcf5e8)'};border:1.5px solid ${totBal>0?'#f0a0a0':'#90c8a0'};border-radius:10px;padding:11px 13px;">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:${totBal>0?'var(--red)':'var(--grn)'};font-weight:700;">Total Outstanding</div>
            <div style="font-size:1.1rem;font-weight:900;font-family:'JetBrains Mono',monospace;color:${totBal>0?'var(--red)':'var(--grn)'};margin-top:3px;">${totBal>0?fmt(totBal):'✅ Clear'}</div>
            <div style="font-size:.62rem;color:var(--mut);margin-top:2px;">Rent + Loans</div>
          </div>
        </div>
        <!-- Loans section removed — use Khata Book tab -->
        ${rows?`<div style="margin:8px 0 4px;padding:6px 12px;background:#f0f7ff18;border-radius:8px;border-left:3px solid #90b8e8;font-size:.78rem;font-weight:700;color:#1760a0;">🏠 Rent Outstanding</div>`:''}
        <div style="display:flex;flex-direction:column;gap:8px;">${rows||'<div class="empty"><div class="ei">👥</div>No active tenants</div>'}</div>`;
    }
    if(s==='tenants'){
      const cards=this.tenants.map(t=>{
        const prop=this.props.find(p=>p.id===t.propId);
        const ledger=this.getTenantLedger(t);
        const curMo=ledger.months.find(mo=>mo.year===y&&mo.month===m);
        const curBal=curMo&&curMo.charged?Math.max(0,curMo.monthlyTotal-curMo.received):0;
        const statusClr=t.status==='active'?'bg':t.status==='notice'?'by':'bm';
        return`<div class="card">
          <div class="card-hdr">
            <div class="card-title">👤 ${t.name}</div>
            <span class="badge ${statusClr}">${t.status}</span>
          </div>
          <div class="card-body">
            <div class="fr"><span class="fl">Property</span><span class="fv" style="font-size:.78rem">${prop?prop.name:'—'}</span></div>
            <div class="fr"><span class="fl">Monthly Rent</span><span class="fv mono">${fmt(t.rent)}</span></div>
            <div class="fr"><span class="fl">Security Deposit</span><span class="fv mono">${fmt(t.sec)}</span></div>
            <div class="fr"><span class="fl">Advance</span><span class="fv mono">${fmt(t.adv)}</span></div>
            <div class="fr"><span class="fl">Agreement</span><span class="fv mono" style="font-size:.74rem">${fD(t.start)} → ${fD(t.end)||'Open'}</span></div>
            <div class="fr"><span class="fl">Due Day</span><span class="fv">${t.due}th of month</span></div>
            <div class="fr"><span class="fl">Months Since Start</span><span class="fv">${ledger.monthCount} months</span></div>
            <div class="fr"><span class="fl">Total Expected</span><span class="fv mono">${fmt(ledger.totalExpected)}</span></div>
            <div class="fr"><span class="fl">Total Received</span><span class="fv mono" style="color:var(--grn)">${fmt(ledger.totalReceived)}</span></div>
            <div class="fr"><span class="fl">Total Outstanding</span><span class="fv mono" style="color:${ledger.totalBalance>0?'var(--red)':'var(--grn)'};font-weight:700">${ledger.totalBalance>0?fmt(ledger.totalBalance):'✓ Clear'}</span></div>
            <div class="fr"><span class="fl">This Month Balance</span><span class="fv mono" style="color:${curBal>0?'var(--red)':'var(--grn)'}; font-weight:700">${curMo&&curMo.status==='upcoming'?'⏳ Upcoming':(curBal>0?fmt(curBal):'✓ Paid')}</span></div>

          </div>
          <div class="card-foot" style="flex-wrap:wrap;gap:5px;">
            <button class="btn b-grn b-sm" onclick="APP.openPayModal('${t.id}')" style="min-height:36px;">💰 Payment</button>
            <button class="btn b-out b-sm" onclick="APP._openRefundModal('${t.id}')" style="color:#c0392b;border-color:#fecaca;">↩️ Refund</button>
            <button class="btn b-blu b-sm" onclick="APP.goTab('rent');APP.viewLedgerTid='${t.id}';APP.setRentSub('ledger')">📒 Ledger</button>
            <button class="btn b-out b-sm" onclick="APP.openTenModal('${t.id}')">✏️ Edit</button>
            <button onclick="APP._tenWA('${t.id}')" style="background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;border-radius:7px;padding:5px 9px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;min-height:36px;touch-action:manipulation;">📲 WA</button>
            <button onclick="APP._tenEmail('${t.id}')" style="background:#fff0f0;color:#c5221f;border:1.5px solid #f4c2b8;border-radius:7px;padding:5px 9px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;min-height:36px;touch-action:manipulation;">📧 Email</button>
            <button onclick="APP._showTenDocs('${t.id}')" style="background:#fff8ee;color:#b56a00;border:1.5px solid #ffcc80;border-radius:7px;padding:5px 9px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;min-height:36px;touch-action:manipulation;">📎 Files${t.docFiles&&t.docFiles.length?' ('+t.docFiles.length+')':''}</button>
            ${(t.rentHistory&&t.rentHistory.length)?`<button onclick="APP.goTab('rent');APP.setRentSub('hikes');" style="background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;border-radius:7px;padding:5px 9px;font-size:.74rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;min-height:36px;">📈 ${t.rentHistory.length} Hikes</button>`:''}
          </div>
        </div>`;
      }).join('');
      html=`<div class="sec-hdr"><div class="sec-title">All Tenants <span class="ct">${this.tenants.length}</span></div><button class="btn b-gold" onclick="APP.openTenModal()">+ Add Tenant</button></div><div class="grid">${cards||'<div class="empty"><div class="ei">👥</div>No tenants</div>'}</div>`;
    }


    if(s==='ledger'){
      // ── INIT state vars ──
      if(!this._ledgerFilter)    this._ledgerFilter    = 'all';
      if(!this._ledgerCustomFrom)this._ledgerCustomFrom= '';
      if(!this._ledgerCustomTo)  this._ledgerCustomTo  = '';

      const now     = new Date();
      const curY    = now.getFullYear();
      const curM    = now.getMonth();
      const lFilter = this._ledgerFilter;
      const allTens = this.tenants;
      const selTenId= this.viewLedgerTid||'all';

      // ── Filter dropdown ──
      const monthOpts = MONTHS.map((m,i)=>`<option value="month_${i}">${m}</option>`).join('');
      const yearOpts  = [curY,curY-1,curY-2,curY-3].map(y=>`<option value="year_${y}">${y}</option>`).join('');
      const fyOpts    = [curY,curY-1,curY-2].map(y=>`<option value="fy_${y}">FY ${y}-${String(y+1).slice(2)} (Apr–Mar)</option>`).join('');

      const filterBar = `
        <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
          <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:.72rem;color:var(--mut);font-weight:600;">From</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rlf" value="${this._ledgerCustomFrom||''?isoToDmy(this._ledgerCustomFrom||''):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rlf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._ledgerFilter='custom';APP._ledgerCustomFrom=iso;APP.renderRent();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rlf').showPicker&&document.getElementById('dfh_rlf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rlf" value="${this._ledgerCustomFrom||''||''} " onchange="(function(iso){var el=document.getElementById('df_rlf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._ledgerFilter='custom';APP._ledgerCustomFrom=iso;APP.renderRent();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            <span style="font-size:.72rem;color:var(--mut);font-weight:600;">To</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rlt" value="${this._ledgerCustomTo||''?isoToDmy(this._ledgerCustomTo||''):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rlt');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._ledgerFilter='custom';APP._ledgerCustomTo=iso;APP.renderRent();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rlt').showPicker&&document.getElementById('dfh_rlt').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rlt" value="${this._ledgerCustomTo||''||''} " onchange="(function(iso){var el=document.getElementById('df_rlt');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._ledgerFilter='custom';APP._ledgerCustomTo=iso;APP.renderRent();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            ${(this._ledgerCustomFrom||this._ledgerCustomTo)?'<button onclick="APP._ledgerFilter=\'all\';APP._ledgerCustomFrom=\'\';APP._ledgerCustomTo=\'\';APP.renderRent();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 7px;">✕ Clear</button>':''}
          </div>
        </div>`;

      // ── Tenant selector ──
      const tenSel = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <button class="stab ${selTenId==='all'?'on':''}" onclick="APP.viewLedgerTid='all';APP.renderRent()">👥 All Tenants</button>
          ${allTens.map(t=>`<button class="stab ${selTenId===t.id?'on':''}" onclick="APP.viewLedgerTid='${t.id}';APP.renderRent()">${t.name}</button>`).join('')}
        </div>`;

      // ── Date range helper ──
      const getDateRange = () => {
        const f = lFilter;
        let from = null, to = null;
        if(f==='thisMonth'){ from=new Date(curY,curM,1); to=new Date(curY,curM+1,0); }
        else if(f==='lastMonth'){ from=new Date(curY,curM-1,1); to=new Date(curY,curM,0); }
        else if(f.startsWith('month_')){ const mi=parseInt(f.split('_')[1]); from=new Date(curY,mi,1); to=new Date(curY,mi+1,0); }
        else if(f.startsWith('year_')){ const yi=parseInt(f.split('_')[1]); from=new Date(yi,0,1); to=new Date(yi,11,31); }
        else if(f.startsWith('fy_')){ const yi=parseInt(f.split('_')[1]); from=new Date(yi,3,1); to=new Date(yi+1,2,31); }
        else if(f==='custom'){ from=this._ledgerCustomFrom?new Date(this._ledgerCustomFrom):null; to=this._ledgerCustomTo?new Date(this._ledgerCustomTo):null; }
        return{from,to};
      };

      const {from:drFrom,to:drTo} = getDateRange();
      const inRange = (dateStr) => {
        if(!dateStr) return false;
        const d = new Date(dateStr); d.setHours(0,0,0,0);
        if(drFrom && d<drFrom) return false;
        if(drTo){ const t2=new Date(drTo); t2.setHours(23,59,59,999); if(d>t2) return false; }
        return true;
      };

      // ══ COMBINED LEDGER (All Tenants) ══
      if(selTenId==='all'){
        // Collect ALL payments across all tenants, filter by date range
        const allPays = [...this.payments]
          .filter(p => lFilter==='all' || inRange(p.date))
          .sort((a,b)=>(b.date||'').localeCompare(a.date||''));

        // Summary stats
        const totalPay = allPays.filter(p=>p.ptype!=='refund').reduce((s,p)=>s+Number(p.amount),0);
        const totalRef = allPays.filter(p=>p.ptype==='refund').reduce((s,p)=>s+Number(p.amount),0);
        const netAmt   = totalPay - totalRef;

        const summaryBar = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px;">
            <div style="background:#f0fdf4;border-radius:9px;padding:9px 12px;border:1.5px solid #bbf7d0;">
              <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#16a34a;margin-bottom:3px;">Total Received</div>
              <div style="font-size:.95rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:#16a34a;">₹${fmt(totalPay)}</div>
            </div>
            <div style="background:#fff5f5;border-radius:9px;padding:9px 12px;border:1.5px solid #fecaca;">
              <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#c0392b;margin-bottom:3px;">Total Refunds</div>
              <div style="font-size:.95rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:#c0392b;">₹${fmt(totalRef)}</div>
            </div>
            <div style="background:#eff6ff;border-radius:9px;padding:9px 12px;border:1.5px solid #bfdbfe;">
              <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#1e40af;margin-bottom:3px;">Net Amount</div>
              <div style="font-size:.95rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:#1e40af;">₹${fmt(netAmt)}</div>
            </div>
            <div style="background:var(--dim);border-radius:9px;padding:9px 12px;">
              <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:var(--mut);margin-bottom:3px;">Transactions</div>
              <div style="font-size:.95rem;font-weight:800;">${allPays.length}</div>
            </div>
          </div>`;

        const rows = allPays.map(p=>{
          const ten  = allTens.find(t=>t.id===p.tenantId);
          const prop = ten&&this.props.find(x=>x.id===ten.propId);
          const isRef= p.ptype==='refund';
          const col  = isRef?'#c0392b':'#16a34a';
          const sign = isRef?'− ':'+ ';
          return`<tr style="${isRef?'background:#fff9f9':''}">
            <td class="mono" style="font-size:.74rem;">${fD(p.date)}</td>
            <td><span onclick="APP.viewLedgerTid='${ten?ten.id:''}';APP.renderRent();"
                style="color:var(--acc);font-weight:700;cursor:pointer;text-decoration:underline dotted;"
                title="Click to open ${ten?ten.name:''} ledger">${ten?ten.name:'—'}</span></td>
            <td style="font-size:.72rem;color:var(--mut);">${prop?prop.name:'—'}</td>
            <td><span style="font-size:.7rem;background:${isRef?'#fff0f0':'#f0fdf4'};color:${col};padding:1px 7px;border-radius:8px;font-weight:700;">${isRef?'↩️ Refund':'💰 Payment'}</span></td>
            <td class="mono tr" style="color:${col};font-weight:700;">${sign}₹${fmt(p.amount)}</td>
            <td style="font-size:.72rem;color:var(--mut);">${p.mode||'—'}${p.note?' · '+p.note.slice(0,25):''}</td>
            <td><button class="btn b-out b-sm" style="font-size:.62rem;padding:2px 7px;" onclick="APP.openEditPayModal('${p.id}')">✏️</button></td>
          </tr>`;
        }).join('');

        html = `${filterBar}${tenSel}
          <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <button onclick="APP._downloadLedgerPDF('all')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#e53935;color:#e53935;">📄 PDF</button>${APP._pdfOriHtml()}
            <button onclick="APP._downloadLedgerWord('all')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#1565c0;color:#1565c0;">📝 Word</button>
            <button onclick="APP._downloadLedgerCSV('all')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#2e7d32;color:#2e7d32;">📊 CSV</button>
          </div>
          <div class="card" style="margin-bottom:12px;">
            <div class="card-hdr">
              <div class="card-title">📒 Combined Ledger — All Tenants</div>
              <span class="ct">${allPays.length} entries</span>
            </div>
            <div class="card-body">${summaryBar}</div>
          </div>
          <div class="tbl-wrap"><table>
            <thead><tr><th>Date</th><th>Tenant</th><th>Property</th><th>Type</th><th class="tr">Amount</th><th>Details</th><th>Edit</th></tr></thead>
            <tbody>${rows||'<tr><td colspan="7"><div class="empty">No transactions found</div></td></tr>'}</tbody>
          </table></div>`;

      } else {
        // ══ INDIVIDUAL TENANT LEDGER ══
        const selTen = this.tenants.find(t=>t.id===selTenId);
        if(!selTen){ html=tenSel+'<div class="empty"><div class="ei">👥</div>Select a tenant</div>'; }
        else{
          const prop   = this.props.find(p=>p.id===selTen.propId);
          const ledger = this.getTenantLedger(selTen);

          // Filter months by date range
          const filteredMonths = ledger.months.filter(mo=>{
            if(lFilter==='all') return true;
            const moDate = new Date(mo.year, mo.month, 1);
            if(drFrom && moDate < new Date(drFrom.getFullYear(), drFrom.getMonth(), 1)) return false;
            if(drTo   && moDate > new Date(drTo.getFullYear(),   drTo.getMonth(),   1)) return false;
            return true;
          });

          // Build flat payment rows — each payment = one row, grouped by rent month
          const fmt2=(d)=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear())}`;

          // Collect all payment rows across filtered months
          const allPayRows = [];
          filteredMonths.slice().reverse().forEach(mo=>{
            const mLabel = MONTHS[mo.month].slice(0,3)+' '+mo.year;
            const rentMonthKey = mo.year+'-'+String(mo.month+1).padStart(2,'0');

            let mStatusBadge='',mRowBg='';
            if(mo.status==='upcoming'){mStatusBadge='<span class="badge ba" style="font-size:.65rem">⏳ Upcoming</span>';mRowBg='background:#f5f5ff';}
            else if(mo.status==='clear'){mStatusBadge='<span class="badge bg" style="font-size:.65rem">✓ Clear</span>';mRowBg='';}
            else if(mo.status==='due'){mStatusBadge=mo.received>0?'<span class="badge bo" style="font-size:.65rem">Partial</span>':'<span class="badge by" style="font-size:.65rem">Due</span>';mRowBg='background:#fffbee';}
            else if(mo.status==='overdue'){mStatusBadge=mo.received>0?'<span class="badge bo" style="font-size:.65rem">⚠️ Part</span>':'<span class="badge br" style="font-size:.65rem">🔴 Overdue</span>';mRowBg='background:#fff5f5';}

            // Month header row — shows charge + balance
            allPayRows.push(`<tr style="border-top:2px solid var(--bdr2);${mRowBg}">
              <td style="font-weight:800;font-size:.82rem;white-space:nowrap;">
                ${mLabel}${mo.isCurrent?' <span class="badge ba" style="font-size:.58rem">Now</span>':''}
              </td>
              <td class="mono" style="font-size:.72rem;color:var(--mut);">${fmt2(mo.invoiceDate)}<br><span style="font-size:.58rem">Invoice</span></td>
              <td class="mono" style="font-size:.72rem;color:var(--mut);">${fmt2(mo.dueDate)}<br><span style="font-size:.58rem">Due</span></td>
              <td class="mono" style="font-weight:700;">${mo.charged?'₹'+fmt(mo.monthlyTotal):'<span style="color:var(--mut)">—</span>'}</td>
              <td class="mono" style="font-weight:700;color:var(--grn);">${mo.received>0?'₹'+fmt(mo.received):'<span style="color:var(--mut)">—</span>'}</td>
              <td class="mono" style="font-weight:700;color:${mo.runningBalance>0?'var(--red)':'var(--grn)'};">
                ${mo.charged?(mo.runningBalance>0?'₹'+fmt(mo.runningBalance):'<span style="color:var(--grn)">✓</span>'):'<span style="color:var(--mut)">—</span>'}
              </td>
              <td>${mStatusBadge}</td>
              <td><div style="display:flex;gap:3px;flex-wrap:wrap;">
                ${mo.charged&&mo.received<mo.monthlyTotal?`<button class="btn b-grn b-sm" onclick="APP.openPayModal('${selTen.id}')" style="font-size:.6rem;padding:2px 6px;">💰 Pay</button>`:''}
                ${mo.payments.length>0?`<button class="btn b-out b-sm" onclick="APP._openRefundFromLedger('${selTen.id}','${mo.year}','${mo.month}')" style="font-size:.6rem;padding:2px 6px;color:#c0392b;border-color:#fecaca;">↩️</button>`:''}
              </div></td>
            </tr>`);

            // Individual payment rows — one per payment entry
            if(mo.payments.length===0 && mo.charged){
              allPayRows.push(`<tr style="${mRowBg}">
                <td colspan="8" style="padding:4px 14px;font-size:.72rem;color:var(--mut);font-style:italic;">No payments recorded for this month</td>
              </tr>`);
            }
            mo.payments.forEach(p=>{
              const isRef=p.ptype==='refund';
              const payDate=p.date?fD(p.date):'—';
              const col=isRef?'#c0392b':'#16a34a';
              const bg=isRef?'rgba(192,57,43,.06)':'rgba(22,163,74,.04)';
              // Payment timing status
              const pDateObj=p.date?parseIso(p.date):null;
              let timingBadge='';
              if(pDateObj&&mo.invoiceDate){
                if(pDateObj<mo.invoiceDate) timingBadge='<span style="background:#e3f2fd;color:#1565c0;border-radius:4px;padding:1px 5px;font-size:.6rem;font-weight:700;">Advance</span>';
                else if(pDateObj<=mo.dueDate) timingBadge='<span style="background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 5px;font-size:.6rem;font-weight:700;">On-time</span>';
                else timingBadge='<span style="background:#fff3e0;color:#e65100;border-radius:4px;padding:1px 5px;font-size:.6rem;font-weight:700;">Late</span>';
              }
              allPayRows.push(`<tr style="background:${bg};">
                <td style="padding-left:20px;font-size:.72rem;color:var(--mut);">↳ ${isRef?'↩️ Refund':'💰 Payment'}</td>
                <td class="mono" style="font-size:.72rem;">${payDate}<br><span style="font-size:.58rem;color:var(--mut);">Pay Date</span></td>
                <td class="mono" style="font-size:.72rem;color:var(--mut);">${mLabel}<br><span style="font-size:.58rem;">Rent Month</span></td>
                <td></td>
                <td class="mono" style="font-weight:700;color:${col};">${isRef?'− ':'+ '}₹${fmt(p.amount)}</td>
                <td style="font-size:.72rem;color:var(--mut);">${p.mode||'Cash'}${p.ref?' · '+p.ref.slice(0,15):''}${p.note?'<br><span style="font-size:.65rem;">'+p.note.slice(0,30)+'</span>':''}</td>
                <td>${timingBadge}</td>
                <td style="white-space:nowrap;"><button onclick="APP.openEditPayModal('${p.id}')" style="background:none;border:1px solid var(--bdr2);color:var(--mut);cursor:pointer;font-size:.7rem;padding:2px 6px;border-radius:5px;">✏️</button>${!isRef?`<button onclick="APP.generateReceipt('${p.id}')" style="background:#e8f5e9;color:#1a7a45;border:1.5px solid #90c8a0;cursor:pointer;font-size:.68rem;padding:2px 6px;border-radius:5px;margin-left:3px;font-weight:700;" title="Generate Receipt">🧾</button>`:''}</td>
              </tr>`);
            });
          });

          // Download buttons — same style as Finance tab
          const tenDlBtns = `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <button onclick="APP._downloadLedgerPDF('${selTen.id}')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#e53935;color:#e53935;">📄 PDF</button>${APP._pdfOriHtml()}
            <button onclick="APP._downloadLedgerWord('${selTen.id}')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#1565c0;color:#1565c0;">📝 Word</button>
            <button onclick="APP._downloadLedgerCSV('${selTen.id}')" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#2e7d32;color:#2e7d32;">📊 CSV</button>
          </div>`;

          // Rent History card for this tenant
          const _rhItems = (selTen.rentHistory||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
          const _rhCard = (function(){
            if(!_rhItems.length) return '';
            const _hikeRows = _rhItems.map(function(h){
              const pct=h.from>0?'+'+((h.to-h.from)/h.from*100).toFixed(1)+'%':'';
              var hd='';
              if(h.date){try{var d=new Date(h.date);hd=String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}catch(e){hd=h.date;}}
              return '<div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:7px 11px;min-width:160px;">'
                +'<div style="font-weight:700;font-size:.82rem;color:#1e40af;">₹'+(h.from||0).toLocaleString('en-IN')+' → ₹'+(h.to||0).toLocaleString('en-IN')+(pct?' <span style="color:#16a34a;font-size:.72rem;">'+pct+'</span>':'')+'</div>'
                +'<div style="font-size:.7rem;color:var(--mut);">'+hd+(h.reason?' · '+h.reason:'')+'</div>'
                +'</div>';
            }).join('');
            var _escalDiv='';
            if(selTen.escalation){
              var _nextDue='';
              if(_rhItems[0]&&_rhItems[0].date){try{var ld=new Date(_rhItems[0].date);ld.setFullYear(ld.getFullYear()+1);_nextDue='<div style="font-size:.7rem;color:var(--mut);">Next due: '+String(ld.getDate()).padStart(2,'0')+'/'+String(ld.getMonth()+1).padStart(2,'0')+'/'+ld.getFullYear()+'</div>';}catch(e){}}
              _escalDiv='<div style="background:#f5f0ff;border:1px solid #c4b5fd;border-radius:8px;padding:7px 11px;min-width:160px;"><div style="font-weight:700;font-size:.78rem;color:#5b21b6;">📅 Annual Escalation: '+selTen.escalation+'%</div>'+_nextDue+'</div>';
            }
            return '<div style="background:var(--card);border:1.5px solid #bfdbfe;border-radius:10px;margin-bottom:12px;overflow:hidden;">'
              +'<div style="background:#eff6ff;padding:9px 14px;display:flex;align-items:center;justify-content:space-between;">'
              +'📈 Rent Increase History'
              +'<span style="font-size:.72rem;color:#1e40af;">'+_rhItems.length+' hike'+(_rhItems.length>1?'s':'')+'</span>'
              +'</div>'
              +'<div style="padding:10px 14px;display:flex;flex-wrap:wrap;gap:8px;">'+_hikeRows+_escalDiv+'</div>'
              +'</div>';
          })();

          html=`${filterBar}${tenSel}${tenDlBtns}${_rhCard}
            <div class="card" style="margin-bottom:14px;">
              <div class="card-hdr">
                <div class="card-title">📒 ${selTen.name} — Ledger</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                  ${selTen.sec>0?`<span class="badge bb" style="font-size:.72rem;">🔒 Sec: ₹${fmt(selTen.sec)}</span>`:''}
                  <span class="badge bg">Recd: ₹${fmt(ledger.totalReceived)}</span>
                  <span class="badge ${ledger.totalBalance>0?'br':'bg'}">Due: ${ledger.totalBalance>0?'₹'+fmt(ledger.totalBalance):'✓ Clear'}</span>
                </div>
              </div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;">
                  <div style="background:var(--dim);border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Property</div><div style="font-size:.8rem;font-weight:600">${prop?prop.name:'—'}</div></div>
                  <div style="background:var(--dim);border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Monthly Rent</div><div style="font-size:.8rem;font-weight:600;font-family:'JetBrains Mono',monospace">₹${fmt(selTen.rent)}</div></div>
                  <div style="background:#f0faf5;border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Total Expected</div><div style="font-size:.8rem;font-weight:600;font-family:'JetBrains Mono',monospace">₹${fmt(ledger.totalExpected)}</div></div>
                  <div style="background:#f0faf5;border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Total Received</div><div style="font-size:.8rem;font-weight:600;font-family:'JetBrains Mono',monospace;color:var(--grn)">₹${fmt(ledger.totalReceived)}</div></div>
                  <div style="background:${ledger.totalBalance>0?'#fff5f5':'#f0faf5'};border-radius:8px;padding:8px 11px;"><div class="pill-lbl">Outstanding</div><div style="font-size:.82rem;font-weight:700;font-family:'JetBrains Mono',monospace;color:${ledger.totalBalance>0?'var(--red)':'var(--grn)'}">₹${ledger.totalBalance>0?fmt(ledger.totalBalance):'✓ Clear'}</div></div>
                </div>
              </div>
            </div>
            <div class="tbl-wrap"><table>
              <thead><tr><th>Month / Entry</th><th>Invoice Date</th><th>Rent Month / Pay Date</th><th>Charged</th><th>Amount</th><th>Mode / Note</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>${allPayRows.join('')||'<tr><td colspan="8"><div class="empty">No data in range</div></td></tr>'}</tbody>
            </table></div>`;
        }
      }
    }

    if(s==='history'){
      const histFrom=this._histFrom||'';
      const histTo=this._histTo||'';
      let histPays=[...this.payments].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      if(histFrom) histPays=histPays.filter(p=>p.date&&p.date>=histFrom);
      if(histTo)   histPays=histPays.filter(p=>p.date&&p.date<=histTo);
      const histTotal=histPays.filter(p=>p.ptype!=='refund').reduce((s,p)=>s+Number(p.amount),0);
      const rows=histPays.map(p=>{
        const t=this.tenants.find(x=>x.id===p.tenantId);
        const prop=t&&this.props.find(x=>x.id===t.propId);
        return`<tr>
          <td class="mono">${fD(p.date)}</td>
          <td>${prop?prop.name:'—'}</td>
          <td>${t?t.name:'—'}</td>
          <td class="mono tr" style="color:var(--grn);font-weight:700">${fmt(p.amount)}</td>
          <td>${p.mode||'—'}</td>
          <td style="font-size:.76rem">${p.ref||p.note||'—'}</td>
          <td><button class="btn b-out b-sm" onclick="APP.openEditPayModal('${p.id}')">✏️ Edit / Delete</button></td>
        </tr>`;
      }).join('');
      html=`
        <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
          <div style="font-size:.72rem;font-weight:800;color:var(--mut);margin-bottom:7px;">📅 Filter by Date Range</div>
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:.72rem;color:var(--mut);font-weight:600;">From</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rhf" value="${histFrom?isoToDmy(histFrom):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rhf');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._histFrom=iso;APP.renderRent();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rhf').showPicker&&document.getElementById('dfh_rhf').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rhf" value="${histFrom||''} " onchange="(function(iso){var el=document.getElementById('df_rhf');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._histFrom=iso;APP.renderRent();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            <span style="font-size:.72rem;color:var(--mut);font-weight:600;">To</span>
            <span style="position:relative;display:inline-flex;align-items:center;"><input type="text" id="df_rht" value="${histTo?isoToDmy(histTo):''}" placeholder="DD/MM/YYYY" oninput="(function(el){var iso=dmyToIso(el.value);var h=document.getElementById('dfh_rht');if(iso){if(h)h.value=iso;el.style.borderColor='var(--acc)';APP._histTo=iso;APP.renderRent();}else{el.style.borderColor=el.value?'var(--red)':'var(--bdr2)';}})(this)" style="font-family:'JetBrains Mono',monospace;font-size:.72rem;padding:3px 26px 3px 7px;border:1.5px solid var(--bdr2);border-radius:6px;background:var(--bg);color:var(--txt);width:108px;outline:none;letter-spacing:.02em;"><span onclick="document.getElementById('dfh_rht').showPicker&&document.getElementById('dfh_rht').showPicker()" style="position:absolute;right:4px;cursor:pointer;font-size:.78rem;opacity:.65;user-select:none;">📅</span><input type="date" id="dfh_rht" value="${histTo||''} " onchange="(function(iso){var el=document.getElementById('df_rht');if(el){el.value=iso?isoToDmy(iso):'';el.style.borderColor=iso?'var(--acc)':'var(--bdr2)';}  APP._histTo=iso;APP.renderRent();})(this.value)" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;"></span>
            ${histFrom||histTo?'<button onclick="APP._histFrom=\'\';APP._histTo=\'\';APP.renderRent();" class="btn b-sm b-out" style="font-size:.65rem;padding:2px 7px;">✕ Clear</button>':''}
            <span style="font-size:.68rem;color:var(--acc);font-weight:700;margin-left:4px;">${histPays.length} entries · ₹${fmt(histTotal)}</span>
          </div>
        </div>
        <div class="sec-hdr"><div class="sec-title">Payments <span class="ct">${histPays.length}</span></div></div>
        <div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Property</th><th>Tenant</th><th class="tr">Amount</th><th>Mode</th><th>Note</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="7"><div class="empty">No payments for selected range</div></td></tr>'}</tbody></table></div>`;
    }

    if(s==='hikes'){
      // ══ RENT INCREASE HISTORY — all tenants ══
      const allHikeTens = this.tenants.filter(t=>(t.rentHistory||[]).length>0);
      const allHikeRows = [];
      let grandTotalHikes=0;
      this.tenants.forEach(t=>{
        const prop=this.props.find(p=>p.id===t.propId);
        const hist=(t.rentHistory||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
        hist.forEach(h=>{
          grandTotalHikes++;
          const pct=h.from>0?'+'+((h.to-h.from)/h.from*100).toFixed(1)+'%':'—';
          const hDate=h.date?(()=>{try{const d=new Date(h.date);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}catch(e){return h.date;}})():'—';
          allHikeRows.push({tenant:t.name,prop:prop?prop.name:'—',from:h.from,to:h.to,pct,date:hDate,reason:h.reason||'—'});
        });
        // Next hike projection: if escalation % set
        if(t.escalation && hist.length){
          const lastHike=hist[0];
          if(lastHike.date){
            try{
              const ld=new Date(lastHike.date);
              ld.setFullYear(ld.getFullYear()+1);
              const nextHikeDue=String(ld.getDate()).padStart(2,'0')+'/'+String(ld.getMonth()+1).padStart(2,'0')+'/'+ld.getFullYear();
              const projRent=Math.round(lastHike.to*(1+Number(t.escalation)/100));
              allHikeRows.push({tenant:t.name,prop:prop?prop.name:'—',from:lastHike.to,to:projRent,pct:'+'+t.escalation+'% (proj.)',date:nextHikeDue,reason:'📅 Projected (Annual @'+t.escalation+'%)',isProjected:true});
            }catch(e){}
          }
        }
      });

      // Summary KPIs
      const avgIncrease = allHikeRows.filter(r=>!r.isProjected&&r.from>0).length
        ? (allHikeRows.filter(r=>!r.isProjected&&r.from>0).reduce((s,r)=>s+(r.to-r.from)/r.from*100,0)/allHikeRows.filter(r=>!r.isProjected&&r.from>0).length).toFixed(1)
        : 0;

      const rows = allHikeRows.map(r=>`<tr style="${r.isProjected?'background:#f5f0ff;opacity:.85;':''}">
        <td style="font-weight:700;font-size:.82rem;">${r.tenant}</td>
        <td style="font-size:.78rem;color:var(--mut);">${r.prop}</td>
        <td class="mono">₹${(r.from||0).toLocaleString('en-IN')}</td>
        <td class="mono" style="font-weight:800;color:var(--grn);">₹${(r.to||0).toLocaleString('en-IN')}</td>
        <td><span style="background:${r.isProjected?'#ede9fe':'#dcfce7'};color:${r.isProjected?'#5b21b6':'#166534'};padding:2px 8px;border-radius:5px;font-size:.72rem;font-weight:700;">${r.pct}</span></td>
        <td class="mono" style="font-size:.76rem;">${r.date}</td>
        <td style="font-size:.76rem;color:var(--mut);">${r.reason}</td>
      </tr>`).join('');

      html=`
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px;">
          <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:11px 14px;">
            <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#16a34a;">Total Hikes</div>
            <div style="font-size:1.4rem;font-weight:900;color:#16a34a;">${grandTotalHikes}</div>
          </div>
          <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:11px 14px;">
            <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#1e40af;">Tenants With Hikes</div>
            <div style="font-size:1.4rem;font-weight:900;color:#1e40af;">${allHikeTens.length}</div>
          </div>
          <div style="background:#fff8ee;border:1.5px solid #fed7aa;border-radius:10px;padding:11px 14px;">
            <div style="font-size:.6rem;text-transform:uppercase;font-weight:700;color:#c05a00;">Avg Increase</div>
            <div style="font-size:1.4rem;font-weight:900;color:#c05a00;">${avgIncrease}%</div>
          </div>
        </div>
        ${allHikeRows.length ? '' : '<div class="empty"><div class="ei">📈</div><p>Koi rent hike record nahi hai abhi.</p><p style="font-size:.8rem;margin-top:8px;color:var(--mut);">Tenant Edit karein → Rent Increase History → + Add Hike</p></div>'}
        ${allHikeRows.length ? `
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Tenant</th><th>Property</th><th>From Rent</th><th>To Rent</th><th>Increase</th><th>Effective Date</th><th>Reason</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="margin-top:10px;background:#f5f0ff;border:1px solid #c4b5fd;border-radius:9px;padding:9px 13px;font-size:.76rem;color:#5b21b6;">
          💡 <b>Projected rows</b> (purple) = next hike based on Annual Escalation % set in tenant profile
        </div>` : ''}`;
    }

    if(s==='templates'){
      const getTpl=(key,def)=>localStorage.getItem('rk_tpl_'+key)||def;
      const vars_help=`<div style="background:#f0f7ff;border:1px solid #90b8e8;border-radius:9px;padding:12px 15px;font-size:.8rem;color:var(--blu);margin-bottom:16px;">
        <b>📌 Available Variables</b> — copy-paste these in your message:<br>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
          ${['{tenant_name}','{property}','{monthly_rent}','{due_day}','{this_month_due}','{total_outstanding}','{months_unpaid}','{phone}','{landlord}'].map(v=>`<span style="background:#fff;border:1px solid #90b8e8;border-radius:5px;padding:2px 8px;font-family:'JetBrains Mono',monospace;font-size:.76rem;cursor:pointer;" onclick="navigator.clipboard&&navigator.clipboard.writeText('${v}')" title="Click to copy">${v}</span>`).join('')}
        </div>
        <div style="margin-top:6px;font-size:.75rem;opacity:.8;">💡 Tip: Click any variable to copy it. Then paste in the template below.</div>
      </div>`;

      html=`
        <div class="sec-hdr"><div class="sec-title">✉️ Message Templates</div></div>
        <div style="background:#fff8ee;border:1px solid #f0c060;border-radius:9px;padding:10px 14px;font-size:.82rem;color:#5a4000;margin-bottom:16px;">
          ✏️ Yahan apna message likho — jab bhi Rent Overview mein WA ya 📧 dabao, yahi message jayega.
        </div>
        ${vars_help}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

          <!-- WhatsApp Template -->
          <div class="card">
            <div class="card-hdr" style="background:#e8f5e9;">
              <div class="card-title" style="color:#1e7a45;">
                <svg width="16" height="16" viewBox="0 0 48 48" style="vertical-align:middle"><circle cx="24" cy="24" r="22" fill="#25D366"/><path fill="#fff" d="M34.5 13.5C32 11 28.2 9.5 24 9.5c-8.6 0-15.5 6.9-15.5 15.5 0 2.7.7 5.4 2 7.7L9 39l6.5-1.7c2.2 1.2 4.7 1.8 7.2 1.8h.1c8.6 0 15.5-6.9 15.5-15.5 0-4.1-1.6-8-4.8-11.1z"/></svg>
                WhatsApp — Rent Due
              </div>
              <button class="btn b-sm b-out" onclick="localStorage.removeItem('rk_tpl_wa_rent');APP.setRentSub('templates')">↺ Reset</button>
            </div>
            <div class="card-body">
              <textarea id="tpl_wa_rent" style="width:100%;min-height:200px;background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:10px 12px;font-family:'Nunito',sans-serif;font-size:.83rem;color:var(--txt);resize:vertical;outline:none;line-height:1.7;">${getTpl('wa_rent',`💰 *Rent Due Notice*\nTenant: {tenant_name}\nProperty: {property}\nMonthly Rent: {monthly_rent}\nDue: {due_day} of month\nThis Month Due: {this_month_due}\nTotal Outstanding: {total_outstanding}\n\nHave you deposited the rent? If yes, please share the payment screenshot.\n\nThank you,\n{landlord}`)}</textarea>
              <div style="margin-top:8px;display:flex;gap:8px;">
                <button class="btn b-gold" style="flex:1" onclick="localStorage.setItem('rk_tpl_wa_rent',document.getElementById('tpl_wa_rent').value);APP.showToastMsg('✅ WhatsApp template saved!')">💾 Save Template</button>
              </div>
              <div style="margin-top:10px;font-size:.76rem;color:var(--mut);">Preview (with sample data):</div>
              <div id="wa_preview" style="background:#e8f5e9;border-radius:8px;padding:10px 12px;margin-top:5px;font-size:.8rem;white-space:pre-wrap;color:#1a3a24;font-family:'Nunito',sans-serif;line-height:1.7;max-height:160px;overflow-y:auto;"></div>
            </div>
          </div>

          <!-- Email Template -->
          <div class="card">
            <div class="card-hdr" style="background:#fff3f0;">
              <div class="card-title" style="color:#c5221f;">📧 Email — Rent Due</div>
              <button class="btn b-sm b-out" onclick="localStorage.removeItem('rk_tpl_mail_rent_body');localStorage.removeItem('rk_tpl_mail_rent_subj');APP.setRentSub('templates')">↺ Reset</button>
            </div>
            <div class="card-body">
              <div class="fg" style="margin-bottom:8px;"><label>Subject Line</label>
                <input id="tpl_mail_subj" value="${getTpl('mail_rent_subj','Rent Due — {tenant_name} — {this_month_due}')}" style="background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:8px 11px;font-family:'Nunito',sans-serif;font-size:.83rem;color:var(--txt);outline:none;width:100%;">
              </div>
              <div class="fg"><label>Email Body</label>
                <textarea id="tpl_mail_body" style="width:100%;min-height:170px;background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:10px 12px;font-family:'Nunito',sans-serif;font-size:.83rem;color:var(--txt);resize:vertical;outline:none;line-height:1.7;">${getTpl('mail_rent_body',`Dear {tenant_name},\n\nYour rent is due.\nProperty: {property}\nMonthly Rent: {monthly_rent}\nDue Day: {due_day}\nThis Month Due: {this_month_due}\nTotal Outstanding: {total_outstanding}\n\nPlease pay at the earliest.\n\nRegards,\n{landlord}`)}</textarea>
              </div>
              <div style="margin-top:8px;display:flex;gap:8px;">
                <button class="btn b-gold" style="flex:1" onclick="localStorage.setItem('rk_tpl_mail_rent_body',document.getElementById('tpl_mail_body').value);localStorage.setItem('rk_tpl_mail_rent_subj',document.getElementById('tpl_mail_subj').value);APP.showToastMsg('✅ Email template saved!')">💾 Save Template</button>
              </div>
              <div style="margin-top:10px;font-size:.76rem;color:var(--mut);">Preview (with sample data):</div>
              <div id="mail_preview" style="background:#fff3f0;border-radius:8px;padding:10px 12px;margin-top:5px;font-size:.8rem;white-space:pre-wrap;color:#3a0a0a;font-family:'Nunito',sans-serif;line-height:1.7;max-height:160px;overflow-y:auto;"></div>
            </div>
          </div>

        </div>`;

      // Render previews after HTML is set
      setTimeout(()=>{
        const sample={tenant_name:'Rahul Sharma',property:'Flat 4B Green Park',monthly_rent:'₹25,000',due_day:'5th',this_month_due:'₹25,000',total_outstanding:'₹50,000',months_unpaid:'2',phone:'+91 99999 88888',landlord:'Raman Kumar'};
        const fillP=(tpl)=>tpl.replace(/\{(\w+)\}/g,(_,k)=>sample[k]||'{'+k+'}');
        const waTxt=document.getElementById('tpl_wa_rent');
        const mailTxt=document.getElementById('tpl_mail_body');
        const waPrev=document.getElementById('wa_preview');
        const mailPrev=document.getElementById('mail_preview');
        if(waTxt&&waPrev) waPrev.textContent=fillP(waTxt.value);
        if(mailTxt&&mailPrev) mailPrev.textContent=fillP(mailTxt.value);
        if(waTxt) waTxt.addEventListener('input',()=>{if(waPrev)waPrev.textContent=fillP(waTxt.value);});
        if(mailTxt) mailTxt.addEventListener('input',()=>{if(mailPrev)mailPrev.textContent=fillP(mailTxt.value);});
      },100);
    }

    document.getElementById('pan-rent').innerHTML=`<div class="stabs">${tabs.map(([k,l])=>`<button class="stab ${s===k?'on':''}" onclick="APP.setRentSub('${k}')">${l}</button>`).join('')}</div>${html}`;
  },


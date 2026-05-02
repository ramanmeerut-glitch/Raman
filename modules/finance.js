/* modules/finance.js — Finance — openExpModal, saveExpense, renderExpense, net worth, budget, accounts, reports
 * Extends the APP object defined in modules/home.js.
 * Load order: after home.js, before rem-engine.js and notifications.js.
 */

'use strict';

Object.assign(APP, {
  openExpModal(id){
    this.editExpId=id||null;
    const el=document.getElementById('expM');
    if(!el)return;
    document.getElementById('expMT') && (document.getElementById('expMT').textContent=id?'✏️ Edit Transaction':'➕ Add Transaction');
    const delBtn=document.getElementById('exm_del_btn');
    if(delBtn) delBtn.style.display=id?'inline-flex':'none';
    // Init date picker
    const dWrap=document.getElementById('exm_date_wrap');
    if(dWrap) dWrap.innerHTML=makeDateInput('exm_date',(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})());
    if(id){
      const e=this.expenses.find(x=>x.id===id);
      if(e){
        sv('exm_type',e.type||'expense');
        sv('exm_cat',e.cat||'');
        sv('exm_amt',e.amount||'');
        sv('exm_note',e.note||'');
        sv('exm_paymode',e.paymode||'Cash');
        // For editing, set account in dropdown
        setTimeout(()=>{
          APP._populateAccountDropdown(e.account||'');
          if(e.type==='transfer'){
            APP._populateTransferDropdowns(e.fromAcc||e.account||'',e.toAcc||'');
          }
        },50);
        svDate('exm_date',e.date||'');
        this._setExpType(e.type||'expense');
        sv('exm_cat',e.cat||'');
        this._renderCatGrid(e.type||'expense');
        // Loan fields
        if(e.type==='loan'){
          const lf=document.getElementById('exm_loan_fields');
          if(lf) lf.style.display='block';
          const bEl=document.getElementById('exm_borrower');
          if(bEl) bEl.value=e.loanBorrower||'';
          const lpEl2=document.getElementById('exm_loan_phone');
          if(lpEl2) lpEl2.value=e.loanPhone||'';
          const dw=document.getElementById('exm_loan_due_wrap');
          if(dw&&!dw.querySelector('input[id]')) dw.innerHTML=makeDateInput('exm_loan_due',e.loanDueDate||'');
          else svDate('exm_loan_due',e.loanDueDate||'');
          const ls=document.getElementById('exm_loan_status');
          if(ls) ls.value=e.loanStatus||'receivable';
          const pr=document.getElementById('exm_loan_partial_row');
          if(pr) pr.style.display=e.loanStatus==='partial'?'block':'none';
          const lr=document.getElementById('exm_loan_received');
          if(lr) lr.value=e.loanReceived||0;
        }
      }
    } else {
      this._setExpType('expense');
      sv('exm_amt','');sv('exm_note','');sv('exm_account','');
      sv('exm_paymode','Cash');
      svDate('exm_date',(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})());
      // Focus amount after open
      setTimeout(()=>{const a=document.getElementById('exm_amt');if(a)a.focus();},200);
      // Reset loan fields
      const lf=document.getElementById('exm_loan_fields');
      if(lf) lf.style.display='none';
      const bEl=document.getElementById('exm_borrower');
      if(bEl) bEl.value='';
    }
    // Populate account dropdown from saved accounts
    this._populateAccountDropdown(id?null:(this.expenses.find(x=>x.id===id)||{}).account||'');
    M.open('expM');
  },

  // ── File attachment for transactions ──
  _exmFiles: [],

  _exmHandleFiles(fileList){
    if(!fileList||!fileList.length) return;
    Array.from(fileList).forEach(file=>{
      const reader=new FileReader();
      reader.onload=ev=>{
        this._exmFiles.push({name:file.name,type:file.type,dataUrl:ev.target.result,size:file.size});
        this._exmRenderPreviews();
      };
      reader.readAsDataURL(file);
    });
    // reset input so same file can be re-selected
    const inp=document.getElementById('exm_file_input');
    if(inp) inp.value='';
  },

  _exmRenderPreviews(){
    const wrap=document.getElementById('exm_file_previews');
    if(!wrap) return;
    if(!this._exmFiles.length){wrap.innerHTML='';return;}
    wrap.innerHTML=this._exmFiles.map((f,i)=>{
      const isImg=f.type&&f.type.startsWith('image/');
      const ext=(f.name||'').split('.').pop().toUpperCase();
      const extIcon={'PDF':'📄','DOC':'📝','DOCX':'📝','XLS':'📊','XLSX':'📊'}[ext]||'📎';
      return `<div style="position:relative;display:inline-flex;align-items:center;gap:3px;background:var(--card);border:1px solid var(--bdr);border-radius:6px;padding:3px 6px;cursor:pointer;"
        onclick="APP._exmViewFile(${i})" title="${f.name}">
        ${isImg
          ? `<img src="${f.dataUrl}" style="height:36px;width:36px;object-fit:cover;border-radius:4px;display:block;">`
          : `<span style="font-size:1.2rem;">${extIcon}</span>`}
        <span style="font-size:.6rem;color:var(--mut);max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name.slice(0,10)}</span>
        <button onclick="event.stopPropagation();APP._exmRemoveFile(${i})"
          style="position:absolute;top:-4px;right:-4px;background:#e53935;color:#fff;border:none;border-radius:50%;width:14px;height:14px;font-size:.55rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>
      </div>`;
    }).join('');
  },

  _exmViewFile(i){
    const f=this._exmFiles[i];
    if(!f) return;
    const isImg=f.type&&f.type.startsWith('image/');
    if(isImg){
      const win=window.open('','_blank','width=800,height=600');
      if(win) win.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${f.dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;">`);
    } else {
      // For docs, create download link
      const a=document.createElement('a');
      a.href=f.dataUrl; a.download=f.name; a.click();
    }
  },

  _exmRemoveFile(i){
    this._exmFiles.splice(i,1);
    this._exmRenderPreviews();
  },

  _exmGetFiles(){
    return this._exmFiles.map(f=>({name:f.name,type:f.type,dataUrl:f.dataUrl}));
  },

  _exmClearFiles(){
    this._exmFiles=[];
    this._exmRenderPreviews();
  },

  // Populate From/To dropdowns for Transfer
  _populateTransferDropdowns(fromVal,toVal){
    const accs=this.finAccounts;
    const opts='<option value="">— Select —</option>'
      +accs.map(a=>`<option value="${a.name}">${a.name}${a.bank?' ('+a.bank+')':''}</option>`).join('')
      +'<option value="__other__">Other…</option>';
    const fromSel=document.getElementById('exm_from_acc');
    const toSel=document.getElementById('exm_to_acc');
    if(fromSel){fromSel.innerHTML=opts;if(fromVal)fromSel.value=fromVal;}
    if(toSel){toSel.innerHTML=opts;if(toVal)toSel.value=toVal;}
    // Live preview
    const updatePreview=()=>{
      const f=fromSel?fromSel.value:'';
      const t=toSel?toSel.value:'';
      const prev=document.getElementById('exm_transfer_preview');
      if(prev) prev.textContent=(f&&t&&f!=='__other__'&&t!=='__other__')?f+' → '+t:'';
    };
    if(fromSel) fromSel.onchange=function(){if(this.value==='__other__'){const n=prompt('Account:','');if(n)this.value=n;}updatePreview();};
    if(toSel) toSel.onchange=function(){if(this.value==='__other__'){const n=prompt('Account:','');if(n)this.value=n;}updatePreview();};
    updatePreview();
  },

  // Populate account select from finAccounts
  _populateAccountDropdown(selectedName){
    const sel = document.getElementById('exm_account');
    if(!sel) return;
    const accs = this.finAccounts;
    const curVal = selectedName !== undefined ? selectedName : sel.value;
    sel.innerHTML = '<option value="">— Select Account —</option>'
      + accs.map(a=>`<option value="${a.name}" ${a.name===curVal?'selected':''}>${a.name}${a.bank?' ('+a.bank+')':''}</option>`).join('')
      + '<option value="__other__">Other / Manual…</option>';
    // If current value not in list, add it
    if(curVal && curVal!=='__other__' && !accs.find(a=>a.name===curVal)){
      sel.innerHTML += `<option value="${curVal}" selected>${curVal}</option>`;
    }
    sel.value = curVal||'';
    // Listen for "Other" selection
    sel.onchange = function(){
      if(this.value==='__other__'){
        const manual=prompt('Account name daalo (e.g. SBI Current, HDFC Savings):','');
        if(manual&&manual.trim()){this.value=manual.trim();}
        else this.value='';
      }
    };
  },

  // Add new account quick from transaction modal
  _exmAddAccount(){
    const name=prompt('Naya account naam daalo:\n(e.g. SBI Savings, HDFC Current, PhonePe, Cash)','');
    if(!name||!name.trim()) return;
    const accs=this.finAccounts;
    if(accs.find(a=>a.name===name.trim())){
      this.showToastMsg('Account already exists!');
      const sel=document.getElementById('exm_account');
      if(sel) sel.value=name.trim();
      return;
    }
    accs.push({id:uid(),name:name.trim(),atype:'payment',balance:0,bank:'',created:new Date().toISOString()});
    this.finAccounts=accs;
    this._populateAccountDropdown(name.trim());
    this.showToastMsg('✅ Account "'+name.trim()+'" added!');
  },

  _getCustomCats(type){
    let all; try{ all=JSON.parse(localStorage.getItem('rk_custom_cats')||'[]'); }catch{ all=[]; }
    return all.filter(c=>c.type===type).map(c=>c.name);
  },
  // Helper: set transaction type, highlight btn, show/hide loan fields
  _setExpType(type){
    document.getElementById('exm_type').value=type;
    // Update tab bar styling
    const typeConfig={
      expense:{color:'#e53935',tabId:'exm_tab_expense'},
      income:{color:'#22c55e',tabId:'exm_tab_income'},
      transfer:{color:'#3b82f6',tabId:'exm_tab_transfer'}
    };
    ['expense','income','transfer'].forEach(t=>{
      const btn=document.getElementById('exm_tab_'+t);
      if(!btn) return;
      if(t===type){
        btn.style.borderBottomColor=typeConfig[t].color;
        btn.style.color=typeConfig[t].color;
        btn.style.background='var(--card)';
        btn.style.fontWeight='800';
      } else {
        btn.style.borderBottomColor='transparent';
        btn.style.color='var(--mut)';
        btn.style.background='var(--dim)';
        btn.style.fontWeight='700';
      }
    });
    this._renderCatGrid(type);
    // Show/hide transfer vs regular account rows
    const accRow=document.getElementById('exm_account_row');
    const tfrRow=document.getElementById('exm_transfer_row');
    if(accRow) accRow.style.display=type==='transfer'?'none':'';
    if(tfrRow) tfrRow.style.display=type==='transfer'?'block':'none';
    if(type==='transfer'){
      this._populateTransferDropdowns();
    }
  },

  // Render category as compact dropdown (replaces old grid)
  _renderCatGrid(type){
    const builtIn={
      expense:['🍽 Food','🛒 Groceries','🚗 Transport','⛽ Fuel','💊 Medical','🏠 House Rent','🔌 Electricity','📱 Mobile','📺 Entertainment','👕 Shopping','📚 Education','✈️ Travel','🏋 Fitness','💇 Personal Care','💳 EMI','🎁 Gifts','🔧 Repair','💼 Business','📌 Other'],
      income:['💼 Salary','🏠 Rent Income','📈 Business','💰 Investment','🎁 Gift','💵 Freelance','🏦 Interest','🔄 Refund','📌 Other Income'],
      transfer:['🏦 Bank Transfer','💳 Credit Card Pay','💰 Cash Withdrawal','🔄 Self Transfer','📌 Other Transfer']
    };
    const custom=this._getCustomCats(type);
    const allCats=[...(builtIn[type]||builtIn.expense)];
    if(custom.length) allCats.splice(allCats.length-1,0,...custom);
    const curSel=document.getElementById('exm_cat').value;
    // Populate the visible dropdown
    const dropSel=document.getElementById('exm_cat_sel');
    if(dropSel){
      dropSel.innerHTML=allCats.map(c=>`<option value="${c}" ${c===curSel?'selected':''}>${c}</option>`).join('');
      // Sync to hidden input
      dropSel.onchange=()=>{document.getElementById('exm_cat').value=dropSel.value;};
      if(curSel) dropSel.value=curSel;
      if(!curSel&&allCats.length) document.getElementById('exm_cat').value=allCats[0];
    }
    // keep hidden select in sync
    const sel=document.getElementById('exm_cat');
    if(sel){sel.innerHTML=allCats.map(c=>`<option value="${c}" ${c===curSel?'selected':''}>${c}</option>`).join('');}
    // Update account label based on type
    const accLbl=document.getElementById('exm_account_label');
    if(accLbl){
      if(type==='income') accLbl.textContent='🏦 Account — Credit (Liya Hai)';
      else if(type==='expense') accLbl.textContent='🏦 Account — Debit (Diya Hai)';
      else accLbl.textContent='🏦 Account';
    }
  },

  _selectCat(cat,type){
    const sel=document.getElementById('exm_cat');
    if(sel) sel.value=cat;
    this._renderCatGrid(type||document.getElementById('exm_type').value||'expense');
    // Auto-focus amount if empty
    const amt=document.getElementById('exm_amt');
    if(amt&&!amt.value) setTimeout(()=>amt.focus(),50);
  },
  _updateExpCats(){
    const type=v('exm_type')||'expense';
    this._renderCatGrid(type);
  },
  _addCustomCat(){
    const row=document.getElementById('exm_custom_cat_row');
    if(row) row.style.display='block';
    const type=v('exm_type')||'expense';
    const typeSel=document.getElementById('exm_new_cat_type');
    if(typeSel) typeSel.value=type;
    const inp=document.getElementById('exm_new_cat_name');
    if(inp) setTimeout(()=>inp.focus(),50);
  },
  _cancelCustomCat(){
    const row=document.getElementById('exm_custom_cat_row');
    if(row) row.style.display='none';
    ['exm_new_cat_name','exm_new_cat_emoji'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  },
  _saveCustomCat(){
    const emoji=(document.getElementById('exm_new_cat_emoji')||{}).value.trim()||'📌';
    const name=(document.getElementById('exm_new_cat_name')||{}).value.trim();
    const type=(document.getElementById('exm_new_cat_type')||{}).value||'expense';
    if(!name){alert('Category name required!');return;}
    const fullName=emoji+' '+name;
    let all; try{ all=JSON.parse(localStorage.getItem('rk_custom_cats')||'[]'); }catch{ all=[]; }
    if(all.find(c=>c.name===fullName&&c.type===type)){alert('Category already exists!');return;}
    all.push({id:uid(),name:fullName,type});
    localStorage.setItem('rk_custom_cats',JSON.stringify(all));
    const typeHid=document.getElementById('exm_type');
    if(typeHid) typeHid.value=type;
    const sel=document.getElementById('exm_cat');
    if(sel) sel.value=fullName;
    this._setExpType(type);
    // Update dropdown too
    const ds=document.getElementById('exm_cat_sel');
    if(ds) ds.value=fullName;
    this._cancelCustomCat();
    this.showToastMsg('✅ Category "'+fullName+'" saved!');
  },
  _showManageCats(){
    let all; try{ all=JSON.parse(localStorage.getItem('rk_custom_cats')||'[]'); }catch{ all=[]; }
    if(!all.length){alert('No custom categories yet.');return;}
    const msg=all.map((c,i)=>`${i+1}. [${c.type}] ${c.name}`).join('\n');
    const delIdx=prompt('Custom Categories:\n\n'+msg+'\n\nType NUMBER to delete (or Cancel):');
    if(delIdx===null) return;
    const n=parseInt(delIdx)-1;
    if(isNaN(n)||n<0||n>=all.length){alert('Invalid number');return;}
    if(confirm('Delete "'+all[n].name+'"?')){
      all.splice(n,1);
      localStorage.setItem('rk_custom_cats',JSON.stringify(all));
      this._updateExpCats();
      this.showToastMsg('🗑 Category deleted');
    }
  },
  saveExpense(){
    return this._runGuardedAction('saveExpense', (release)=>{
    const amt=v('exm_amt').replace(/,/g,''),date=vDate('exm_date')||(function(){var _n=new Date();return _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');})();
    if(!amt||isNaN(Number(amt))){alert('Amount daalo!');release();return;}
    const type=v('exm_type')||'expense';

    // account: read from select; if __other__ use blank
    const rawAcct = document.getElementById('exm_account')?document.getElementById('exm_account').value:'';
    const acctVal = rawAcct==='__other__'?'':rawAcct;

    // Transfer: read From/To accounts
    const fromAcc = type==='transfer'?(document.getElementById('exm_from_acc')?document.getElementById('exm_from_acc').value:''):'';
    const toAcc   = type==='transfer'?(document.getElementById('exm_to_acc')?document.getElementById('exm_to_acc').value:''):'';

    // ── FIX 1: MANDATORY ACCOUNT VALIDATION ──
    if(type==='transfer'){
      if(!fromAcc){ this._showFieldError('exm_from_acc','Please select FROM account!'); release(); return; }
      if(!toAcc)  { this._showFieldError('exm_to_acc',  'Please select TO account!'); release(); return; }
      if(fromAcc===toAcc){ alert('From and To account same nahi ho sakta!'); release(); return; }
    } else if(type!=='loan'){
      // For expense / income — account is mandatory
      if(!acctVal || acctVal===''){
        this._showFieldError('exm_account','⚠️ Please select an account!');
        release();
        return;
      }
    }

    // For transfer, build cat as "From → To" for clear display
    const catVal = type==='transfer'&&fromAcc&&toAcc ? fromAcc+' → '+toAcc : v('exm_cat');
    const amount = Number(amt);
    const data={type,cat:catVal,amount,date,note:v('exm_note'),paymode:v('exm_paymode'),
      account:type==='transfer'?(fromAcc||acctVal):acctVal,
      fromAcc:type==='transfer'?fromAcc:'',
      toAcc:type==='transfer'?toAcc:'',
      files:this._exmGetFiles()};

    // Clear files after save
    this._exmClearFiles();

    // Loan Given: extra fields
    if(type==='loan'){
      const borrower=document.getElementById('exm_borrower')?document.getElementById('exm_borrower').value.trim():'';
      if(!borrower){alert('Borrower name required for Loan Given!');release();return;}
      data.loanBorrower=borrower;
      const lpEl=document.getElementById('exm_loan_phone');
      if(lpEl&&lpEl.value.trim()) data.loanPhone=lpEl.value.trim();
      data.loanDueDate=vDate('exm_loan_due')||'';
      data.loanStatus=document.getElementById('exm_loan_status')?document.getElementById('exm_loan_status').value:'receivable';
      data.loanReceived=data.loanStatus==='partial'?Number(document.getElementById('exm_loan_received')?document.getElementById('exm_loan_received').value:0):0;
      if(data.loanStatus==='received') data.loanReceived=data.amount;
    }

    // Save expense
    const isEdit = !!this.editExpId;
    let es=this.expenses;
    let oldData = isEdit ? es.find(e=>e.id===this.editExpId) : null;
    if(isEdit){es=es.map(e=>e.id===this.editExpId?{...e,...data}:e);this.editExpId=null;}
    else{data.id=uid();es.push(data);}
    S.set('expenses',es);

    // ── FIX 2: UPDATE ACCOUNT BALANCE ──
    this._updateAccountBalance(data, isEdit, oldData);

    // Auto-create loan reminder if new loan given and not yet received
    if(type==='loan'&&!isEdit&&data.loanStatus!=='received'){
      this._syncLoanReminders();
    }
    // If loan marked received, remove its reminder
    if(type==='loan'&&data.loanStatus==='received'){
      this._syncLoanReminders();
    }
    M.close('expM');this.renderExpense();this.renderPills();
    });
  },

  // ── Show error on account select field ──
  _showFieldError(fieldId, msg){
    const el = document.getElementById(fieldId);
    if(el){
      el.style.borderColor = '#e53935';
      el.style.boxShadow   = '0 0 0 2px rgba(229,57,53,.2)';
      el.focus();
      // Reset style after 3 seconds
      setTimeout(()=>{ el.style.borderColor=''; el.style.boxShadow=''; }, 3000);
    }
    this.showToastMsg(msg);
    alert(msg);
  },

  // ── Update account balance after expense/income/transfer saved ──
  _updateAccountBalance(data, isEdit, oldData){
    let accs = this.finAccounts;
    if(!accs || !accs.length) return; // no accounts defined — skip

    const amount = Number(data.amount) || 0;

    // Helper: apply delta to one account by name
    const adjustBalance = (accName, delta) => {
      if(!accName) return false;
      const idx = accs.findIndex(a => a.name === accName || a.id === accName);
      if(idx < 0) return false;
      accs[idx] = {...accs[idx], balance: (Number(accs[idx].balance)||0) + delta};
      return true;
    };

    // If editing: first REVERSE the old transaction effect
    if(isEdit && oldData){
      const oldAmt = Number(oldData.amount) || 0;
      if(oldData.type === 'expense')  adjustBalance(oldData.account,  +oldAmt); // undo debit
      if(oldData.type === 'income')   adjustBalance(oldData.account,  -oldAmt); // undo credit
      if(oldData.type === 'transfer'){
        adjustBalance(oldData.fromAcc, +oldAmt); // undo from-debit
        adjustBalance(oldData.toAcc,   -oldAmt); // undo to-credit
      }
    }

    // Apply NEW transaction effect
    if(data.type === 'expense'){
      // Debit from account (balance decreases)
      adjustBalance(data.account, -amount);
    } else if(data.type === 'income'){
      // Credit to account (balance increases)
      adjustBalance(data.account, +amount);
    } else if(data.type === 'transfer'){
      // Debit from source, credit to destination
      adjustBalance(data.fromAcc, -amount);
      adjustBalance(data.toAcc,   +amount);
    }
    // loan type: no immediate balance change (tracked separately)

    this.finAccounts = accs;
    this.showToastMsg('✅ Transaction saved! Account balance updated.');
  },

  // Mark loan as fully received → updates expense, removes reminder
  _markLoanReceived(loanId){
    if(!loanId){alert('Loan not found');return;}
    let exps=this.expenses;
    exps=exps.map(e=>e.id===loanId?{...e,loanStatus:'received',loanReceived:e.amount}:e);
    S.set('expenses',exps);
    this._syncLoanReminders();
    this.showToastMsg('✅ Loan marked as Received! Reminder removed.');
    this.renderPills();
    if(this.curTab==='expense') this.renderExpense();
    if(this.curTab==='reminder') this.renderReminders();
  },

  // Mark loan as partially received
  _markLoanPartial(loanId){
    if(!loanId){alert('Loan not found');return;}
    const loan=this.expenses.find(e=>e.id===loanId);
    if(!loan) return;
    const amtStr=prompt('Partial received for '+loan.loanBorrower+'\nTotal: '+fmt(loan.amount)+'\nAlready: '+fmt(loan.loanReceived||0)+'\n\nEnter total received so far:', loan.loanReceived||0);
    if(amtStr===null) return;
    const amt=Number(amtStr);
    if(isNaN(amt)||amt<0){alert('Invalid amount');return;}
    const status=amt>=loan.amount?'received':'partial';
    let exps=this.expenses;
    exps=exps.map(e=>e.id===loanId?{...e,loanStatus:status,loanReceived:amt}:e);
    S.set('expenses',exps);
    this._syncLoanReminders();
    this.showToastMsg(status==='received'?'✅ Loan fully received! Reminder removed.':('⚠️ Partial: ₹'+amt.toLocaleString('en-IN')+' received. Reminder updated.'));
    this.renderPills();
    if(this.curTab==='expense') this.renderExpense();
    if(this.curTab==='reminder') this.renderReminders();
  },

  // ═══════════════════════════════════════════════════════════════
  // LOAN REMINDER ENGINE
  // - Creates ONE reminder per outstanding loan
  // - Reminder stays ACTIVE until loan status = 'received'
  // - On received → auto-remove reminder
  // ═══════════════════════════════════════════════════════════════
  _syncLoanReminders(){
    const now=new Date();now.setHours(0,0,0,0);
    let reminders=[...this.reminders];
    let changed=false;
    const loans=this.expenses.filter(e=>e.type==='loan'||e.type==='loan_taken');

    loans.forEach(loan=>{
      const remKey='auto_loan_'+loan.id;
      const existIdx=reminders.findIndex(r=>r._autoKey===remKey);

      if(loan.loanStatus==='received'){
        // Remove reminder if loan is received
        if(existIdx!==-1){reminders.splice(existIdx,1);changed=true;}
        return;
      }

      // Outstanding loan — create/update reminder
      const trigDate=loan.loanDueDate||loan.date||now.toISOString().split('T')[0];
      const dTrig=Math.ceil((new Date(trigDate)-now)/86400000);
      const outstanding=loan.amount-(loan.loanReceived||0);

      const reminderData={
        _autoKey:remKey,
        _isAutoLoan:true,
        _loanId:loan.id,
        name:'💼 Loan Recovery — '+(loan.loanBorrower||'Unknown'),
        type:'💰 Loan Given',
        person:loan.loanBorrower||'',
        mode:'loan',
        exp:trigDate,
        _trigDate:trigDate,
        _dTrig:dTrig,
        _loanAmt:loan.amount,
        _loanReceived:loan.loanReceived||0,
        _outstanding:outstanding,
        notes:'Given: '+fmt(loan.amount)+
              (loan.loanReceived>0?' | Received: '+fmt(loan.loanReceived):'')+ 
              ' | Outstanding: '+fmt(outstanding)+
              (loan.loanDueDate?' | Due: '+fD(loan.loanDueDate):''),
        autorenew:'no'
      };

      if(existIdx!==-1){
        // Only mark changed if data actually differs
        const existing = reminders[existIdx];
        const hasChange = existing._outstanding !== reminderData._outstanding ||
                          existing._loanReceived !== reminderData._loanReceived ||
                          existing._dTrig !== reminderData._dTrig;
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

    if(changed){S.set('reminders',reminders);}
  },


  deleteCurrentExpense(){
    if(this.editExpId) this.delExpense(this.editExpId);
    M.close('expM');
  },

  delExpense(id){
    this.delCb=()=>{
      // Reverse account balance before deleting
      const exp = this.expenses.find(e=>e.id===id);
      if(exp) this._updateAccountBalance(exp, true, exp); // treat as edit-undo (reverses old)
      S.set('expenses',this.expenses.filter(e=>e.id!==id));
      this.renderExpense();this.renderPills();
    };
    document.getElementById('delMsg').textContent='Delete this transaction?';M.open('delM');
  },
  // ═══════════════════════════════════════════════════════
  // FINANCE MODULE — MyMoney Pro Style
  // Sub-tabs: Overview | Accounts | Transactions | Budget | Charts | Reports
  // ═══════════════════════════════════════════════════════

  // ── Sub-tab router ──

  _finChartsExtra(){
    const allExp=this.expenses||[];
    const now=new Date();
    const curMon=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    // Category spending — current month
    const catMap={};
    allExp.filter(e=>e.type==='expense'&&e.date&&e.date.startsWith(curMon)).forEach(e=>{
      const cat=(e.cat||'Other').replace(/^[^\s]*\s/,'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}]\s*/u,'').trim()||'Other';
      catMap[cat]=(catMap[cat]||0)+Number(e.amount||0);
    });
    const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const total=cats.reduce((s,c)=>s+c[1],0);
    const colors=['#2c6fad','#1a7a45','#c47c00','#e05050','#5c3496','#12766a'];
    // Monthly income vs expense for last 6 months
    const months=[];
    for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({y:d.getFullYear(),m:d.getMonth(),label:d.toLocaleString('en-IN',{month:'short'})});}
    const monthData=months.map(({y,m,label})=>{
      const key=y+'-'+String(m+1).padStart(2,'0');
      const inc=allExp.filter(e=>e.type==='income'&&e.date&&e.date.startsWith(key)).reduce((s,e)=>s+Number(e.amount||0),0);
      const exp=allExp.filter(e=>e.type==='expense'&&e.date&&e.date.startsWith(key)).reduce((s,e)=>s+Number(e.amount||0),0);
      return{label,inc,exp,key};
    });
    const maxVal=Math.max(...monthData.map(m=>Math.max(m.inc,m.exp)),1);
    const barW=44,barGap=12,chartH=110,startX=40;
    let bars='',xLabels='',yLines='';
    for(let yi=0;yi<=4;yi++){const yv=Math.round(maxVal*yi/4);const yy=chartH+10-Math.round(yi*chartH/4);yLines+=`<line x1="${startX}" y1="${yy}" x2="${startX+6*(barW+barGap)-barGap}" y2="${yy}" stroke="var(--bdr)" stroke-width="0.5"/><text x="${startX-4}" y="${yy+4}" text-anchor="end" fill="var(--mut)" font-size="9" font-family="Nunito,sans-serif">${yv>=100000?Math.round(yv/1000)+'k':yv}</text>`;}
    monthData.forEach(({label,inc,exp},i)=>{
      const x=startX+i*(barW+barGap);
      const incH=inc>0?Math.round((inc/maxVal)*chartH):1;
      const expH=exp>0?Math.round((exp/maxVal)*chartH):1;
      bars+=`<rect x="${x}" y="${chartH-incH+10}" width="${barW*0.46}" height="${incH}" fill="#22c55e" opacity="0.85" rx="2"/>`;
      bars+=`<rect x="${x+barW*0.5}" y="${chartH-expH+10}" width="${barW*0.46}" height="${expH}" fill="#ef4444" opacity="0.85" rx="2"/>`;
      xLabels+=`<text x="${x+barW/2}" y="${chartH+26}" text-anchor="middle" fill="var(--mut)" font-size="10" font-family="Nunito,sans-serif">${label}</text>`;
    });

    const pan=document.getElementById('pan-expense');
    if(!pan) return;
    pan.innerHTML=`
      ${this._finHeader('charts')}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">

        <!-- Category Pie / Bar -->
        <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:16px;box-shadow:var(--sh);">
          <div style="font-weight:800;font-size:.92rem;margin-bottom:12px;">🍕 This Month — By Category</div>
          ${cats.length?`
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${cats.map(([cat,amt],i)=>{
              const pct=total?Math.round(amt/total*100):0;
              return `<div>
                <div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:2px;">
                  <span style="font-weight:700;">${cat}</span>
                  <span style="font-family:'JetBrains Mono',monospace;font-weight:700;">₹${fmt(amt)} <span style="color:var(--mut);font-weight:400;">(${pct}%)</span></span>
                </div>
                <div style="background:var(--dim);border-radius:4px;height:8px;overflow:hidden;">
                  <div style="background:${colors[i]};width:${pct}%;height:100%;border-radius:4px;transition:width .4s;"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--bdr);display:flex;justify-content:space-between;font-size:.78rem;font-weight:700;">
            <span>Total Expenses</span><span style="font-family:'JetBrains Mono',monospace;color:var(--red);">₹${fmt(total)}</span>
          </div>`:'<div style="text-align:center;padding:20px;color:var(--mut);font-size:.83rem;">No expense data for this month</div>'}
        </div>

        <!-- Monthly trend -->
        <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:12px;padding:16px;box-shadow:var(--sh);">
          <div style="font-weight:800;font-size:.92rem;margin-bottom:4px;">📊 6-Month Income vs Expense</div>
          <div style="display:flex;gap:12px;font-size:.7rem;margin-bottom:10px;">
            <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#22c55e;border-radius:2px;display:inline-block;"></span>Income</span>
            <span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#ef4444;border-radius:2px;display:inline-block;"></span>Expense</span>
          </div>
          <svg width="100%" viewBox="0 0 ${startX*2+6*(barW+barGap)-barGap} ${chartH+40}" style="overflow:visible;">
            ${yLines}${bars}${xLabels}
            <line x1="${startX}" y1="10" x2="${startX}" y2="${chartH+10}" stroke="var(--bdr)" stroke-width="1"/>
          </svg>
          <div style="margin-top:6px;display:grid;grid-template-columns:repeat(${monthData.length},1fr);gap:4px;font-size:.62rem;text-align:center;color:var(--mut);">
            ${monthData.map(m=>`<div><div style="color:#22c55e;font-weight:700;">+${m.inc>=1000?Math.round(m.inc/1000)+'k':m.inc||0}</div><div style="color:#ef4444;">-${m.exp>=1000?Math.round(m.exp/1000)+'k':m.exp||0}</div></div>`).join('')}
          </div>
        </div>
      </div>`;
  },

  renderExpense(){
    const sub = this.finSub || 'overview';
    if(sub === 'overview') this._finOverview();
    else if(sub === 'accounts') this._finAccounts();
    else if(sub === 'txn') this._finTransactions();
    else if(sub === 'networth') this._finNetWorth();
    else if(sub === 'budget') this._finBudget();
    else if(sub === 'charts') this._finChartsExtra();
    else if(sub === 'reports') this._finReports();
    else this._finOverview();
  },

  renderExpenseOverview(){ this._finOverview(); },

  _finNav(sub){
    this.finSub=sub;
    if(this.curTab==='expense' && this.syncCurrentRoute) this.syncCurrentRoute();
    this.renderExpense();
  },

  // ── Finance date filter helpers ──
  _finDateFilter(){return{from:this._finFrom||'',to:this._finTo||'',period:this._finPeriod||'all'};},
  _finApplyFilter(exps){
    const {from,to,period}=this._finDateFilter();
    const now=new Date();
    let f=exps;
    if(period==='this_month'){const m=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');f=f.filter(e=>e.date&&e.date.startsWith(m));}
    else if(period==='last_month'){const d=new Date(now.getFullYear(),now.getMonth()-1,1);const m=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');f=f.filter(e=>e.date&&e.date.startsWith(m));}
    else if(period==='this_year'){const y=String(now.getFullYear());f=f.filter(e=>e.date&&e.date.startsWith(y));}
    else if(period==='custom'){
      if(from) f=f.filter(e=>e.date&&e.date>=from);
      if(to)   f=f.filter(e=>e.date&&e.date<=to);
    }
    return f;
  },
  _finFilterBar(){
    const from=this._finFrom||'';
    const to=this._finTo||'';
    const periodLabel=from||to?((from||'Start')+' → '+(to||'Today')):'All Time';
    return `<div class="date-filter-panel">
      <div class="date-filter-bar">
        <div class="date-filter-bar__tools">
          ${renderCompactDateRangeFilter({
            label:'Date',
            fromId:'dfh_ftf',
            toId:'dfh_ftt',
            fromValue:from,
            toValue:to,
            fromOnChange:"APP._finFrom=this.value;APP.renderExpense()",
            toOnChange:"APP._finTo=this.value;APP.renderExpense()",
            clearOnClick:"APP._finFrom='';APP._finTo='';APP.renderExpense()",
            className:'date-filter-inline--tight'
          })}
        </div>
        <span class="date-filter-bar__meta">${periodLabel}</span>
      </div>
    </div>`;
  },

  _finHeader(active){
    const tabs=[
      {k:'overview',icon:'🏠',lbl:'Overview'},
      {k:'networth',icon:'🏛️',lbl:'Net Worth'},
      {k:'accounts',icon:'🏦',lbl:'Accounts'},
      {k:'txn',icon:'💳',lbl:'Transactions'},
      {k:'budget',icon:'🎯',lbl:'Budget'},
      {k:'charts',icon:'📊',lbl:'Charts'},
      {k:'reports',icon:'📋',lbl:'Reports'},
    ];
    return `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px;background:var(--dim);border-radius:12px;padding:5px;">
      ${tabs.map(t=>`<button onclick="APP._finNav('${t.k}')"
        style="flex:1;min-width:60px;padding:7px 4px;border:none;border-radius:8px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;transition:all .15s;
        background:${active===t.k?'var(--card)':'transparent'};
        color:${active===t.k?'var(--acc)':'var(--mut)'};
        box-shadow:${active===t.k?'0 1px 4px rgba(0,0,0,.08)':''};
        ">${t.icon}<br>${t.lbl}</button>`).join('')}
    </div>`;
  },

  // ── Helper: format month ──
  _finFmtMon(iso){ // iso = "2026-03"
    try{ return new Date(iso+'-01').toLocaleString('en-IN',{month:'short',year:'numeric'}); }
    catch(e){ return iso; }
  },

  // ═══════════ NET WORTH DASHBOARD ═══════════
  _finNetWorth(){
    const fmt = window.fmt||(n=>n.toLocaleString('en-IN'));
    const now = new Date();
    if(this._migratePropertyAnalysisData) this._migratePropertyAnalysisData();

    // ── Property Assets ──
    const props = this.props || [];
    let totalPropertyInvested = 0;
    props.filter(p=>!p._draft).forEach(p=>{
      const led = p.ledger&&Array.isArray(p.ledger)&&p.ledger.length ? p.ledger : null;
      const invested = led ? led.reduce((s,e)=>s+Number(e.amount||0),0) : Number(p.cost||0);
      totalPropertyInvested += invested;
    });

    // ── Bank / Account Assets ──
    const accs = this.finAccounts || [];
    const cashAssets = accs.filter(a=>a.atype!=='liability'&&a.atype!=='credit').reduce((s,a)=>s+Number(a.balance||0),0);
    const investAssets = accs.filter(a=>a.atype==='investment').reduce((s,a)=>s+Number(a.balance||0),0);
    const liabilities = accs.filter(a=>a.atype==='liability'||a.atype==='credit').reduce((s,a)=>s+Number(a.balance||0),0);

    // ── Rental Income (all-time) ──
    const tenantIds = (this.tenants||[]).map(t=>t.id);
    const totalRentalIncome = (this.payments||[]).filter(pm=>tenantIds.includes(pm.tenantId)&&pm.ptype!=='refund').reduce((s,pm)=>s+Number(pm.bankAmt||pm.amount||0)+Number(pm.tdsAmt||0),0);
    const activeRent = (this.tenants||[]).filter(t=>t.status==='active').reduce((s,t)=>s+Number(t.rent||0)+Number(t.maint||0),0);

    // ── Khata Book balances ──
    let kbLena = 0, kbDena = 0;
    (this.kbEntries||[]).forEach(e=>{
      if(e.type==='lena') kbLena += Number(e.amount||0);
      else if(e.type==='dena') kbDena += Number(e.amount||0);
    });
    const kbNet = kbLena - kbDena;

    // ── Net Worth Calculation ──
    const totalAssets = totalPropertyInvested + cashAssets + (kbNet > 0 ? kbNet : 0);
    const totalLiabilities = liabilities + (kbNet < 0 ? Math.abs(kbNet) : 0);
    const netWorth = totalAssets - totalLiabilities;

    // ── Monthly cash flow ──
    const curMon = now.toISOString().slice(0,7);
    const allExps = this.expenses||[];
    const monthInc = allExps.filter(e=>e.type==='income'&&e.date&&e.date.startsWith(curMon)).reduce((s,e)=>s+Number(e.amount||0),0);
    const monthExp = allExps.filter(e=>e.type==='expense'&&e.date&&e.date.startsWith(curMon)).reduce((s,e)=>s+Number(e.amount||0),0);
    const monthlyCashFlow = monthInc + activeRent - monthExp;

    // ── Asset allocation bar widths ──
    const assetBreakdown = [
      { label:'🏢 Properties', value:totalPropertyInvested, color:'#1565c0' },
      { label:'🏦 Cash & Bank', value:cashAssets - investAssets, color:'#1a7a45' },
      { label:'📈 Investments', value:investAssets, color:'#7b1fa2' },
      { label:'🤝 Khata Lena', value:kbNet > 0 ? kbNet : 0, color:'#b56a00' },
    ].filter(a=>a.value>0);
    const totalAssetSum = assetBreakdown.reduce((s,a)=>s+a.value,0)||1;

    const kpi = (icon,label,val,sub,bg,color,border)=>`
      <div style="background:${bg};border:1.5px solid ${border};border-radius:14px;padding:14px 16px;">
        <div style="font-size:.58rem;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">${icon} ${label}</div>
        <div style="font-size:1.1rem;font-weight:900;color:${color};font-family:'JetBrains Mono',monospace;">${val}</div>
        ${sub?`<div style="font-size:.65rem;color:${color};opacity:.75;margin-top:3px;font-weight:600;">${sub}</div>`:''}
      </div>`;

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('networth')}

      <!-- NET WORTH HEADLINE -->
      <div style="background:${netWorth>=0?'linear-gradient(135deg,#e8f5e9,#f0faf5)':'linear-gradient(135deg,#fff0f0,#fff5f5)'};border:2px solid ${netWorth>=0?'#90c8a0':'#f09090'};border-radius:16px;padding:20px;text-align:center;margin-bottom:16px;">
        <div style="font-size:.7rem;font-weight:800;color:${netWorth>=0?'#1a7a45':'#c0392b'};text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">🏛️ Net Worth (Total Assets − Liabilities)</div>
        <div style="font-size:2.2rem;font-weight:900;color:${netWorth>=0?'#1a7a45':'#c0392b'};font-family:'JetBrains Mono',monospace;">${netWorth>=0?'':'−'}₹${fmt(Math.abs(netWorth))}</div>
        <div style="font-size:.78rem;color:${netWorth>=0?'#1a7a45':'#c0392b'};margin-top:6px;">
          Assets ₹${fmt(totalAssets)} − Liabilities ₹${fmt(totalLiabilities)}
        </div>
        <div style="margin-top:10px;font-size:.72rem;color:var(--mut);">
          🗓 Monthly cash flow: <b style="color:${monthlyCashFlow>=0?'#1a7a45':'#c0392b'}">${monthlyCashFlow>=0?'+':'−'}₹${fmt(Math.abs(monthlyCashFlow))}</b>
          &nbsp;·&nbsp; 🏠 Active rent: <b style="color:#1565c0">₹${fmt(activeRent)}/mo</b>
        </div>
      </div>

      <!-- KPI GRID -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px;">
        ${kpi('🏢','Property Invested','₹'+fmt(totalPropertyInvested), props.filter(p=>!p._draft).length+' properties','#e3f2fd','#1565c0','#90b8e8')}
        ${kpi('🏦','Cash & Bank','₹'+fmt(cashAssets), accs.filter(a=>a.atype!=='liability'&&a.atype!=='credit').length+' accounts','#e8f5e9','#1a7a45','#90c8a0')}
        ${kpi('📋','Total Liabilities','₹'+fmt(totalLiabilities), 'Accounts + obligations','#fff0f0','#c0392b','#f09090')}
        ${kpi('💵','Monthly Rent In','₹'+fmt(activeRent), totalRentalIncome>0?'All-time: ₹'+fmt(totalRentalIncome):'No active tenants','#fff8ee','#b56a00','#ffcc80')}
        ${kpi('🤝','Khata Net','₹'+fmt(Math.abs(kbNet)), kbNet>0?'Others owe you':kbNet<0?'You owe others':'All clear','#f5f0ff','#5c3496','#c0a0f0')}
      </div>

      <!-- ASSET BREAKDOWN -->
      ${assetBreakdown.length>0?`
      <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:var(--sh);">
        <div style="font-weight:800;font-size:.88rem;margin-bottom:12px;">📊 Asset Allocation</div>
        ${assetBreakdown.map(a=>{
          const pct = Math.round((a.value/totalAssetSum)*100);
          return `<div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px;">
              <span style="font-weight:700;">${a.label}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;">₹${fmt(a.value)} <span style="color:var(--mut);font-weight:400;">(${pct}%)</span></span>
            </div>
            <div style="height:9px;background:var(--dim);border-radius:5px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${a.color};border-radius:5px;transition:width .5s;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>`:``}

      <!-- PROPERTY LIST -->
      ${props.filter(p=>!p._draft).length>0?`
      <div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:var(--sh);">
        <div style="font-weight:800;font-size:.88rem;margin-bottom:12px;">🏢 Properties Breakdown</div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:.76rem;min-width:400px;">
            <thead><tr style="background:var(--dim);">
              <th style="padding:7px 10px;text-align:left;font-weight:700;">Property</th>
              <th style="padding:7px 10px;text-align:right;font-weight:700;">Invested</th>
            </tr></thead>
            <tbody>
              ${props.filter(p=>!p._draft).map((p,i)=>{
                const led = p.ledger&&Array.isArray(p.ledger)&&p.ledger.length ? p.ledger : null;
                const invested = led ? led.reduce((s,e)=>s+Number(e.amount||0),0) : Number(p.cost||0);
                return `<tr style="background:${i%2===0?'var(--card)':'var(--dim)'};">
                  <td style="padding:6px 10px;font-weight:600;">${p.name.slice(0,22)}</td>
                  <td style="padding:6px 10px;text-align:right;font-family:'JetBrains Mono',monospace;">${fmt(invested)||'—'}</td>
                </tr>`;
              }).join('')}
              <tr style="background:var(--dim);font-weight:800;">
                <td style="padding:7px 10px;">TOTAL</td>
                <td style="padding:7px 10px;text-align:right;font-family:'JetBrains Mono',monospace;">${fmt(totalPropertyInvested)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>`:``}

      <!-- QUICK LINKS -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn b-sm b-out" onclick="APP._finNav('accounts')" style="font-size:.75rem;">🏦 Manage Accounts</button>
        <button class="btn b-sm b-out" onclick="APP.goTab('property')" style="font-size:.75rem;">🏢 Property Module</button>
        <button class="btn b-sm b-out" onclick="APP._finNav('budget')" style="font-size:.75rem;">🎯 Budget Tracker</button>
        <button class="btn b-sm b-out" onclick="APP._finNav('charts')" style="font-size:.75rem;">📊 Expense Charts</button>
      </div>
    `;
  },

  // ═══════════ OVERVIEW ═══════════
  _finOverview(){
    const fmt = window.fmt||(n=>n.toLocaleString('en-IN'));
    const now = new Date();
    const allExps = this.expenses || [];

    // Date filter (same as Khata Book style)
    const finFrom = this._finOvFrom || '';
    const finTo   = this._finOvTo   || '';
    const filteredExps = allExps.filter(e=>{
      if(!e.date) return true;
      if(finFrom && e.date < finFrom) return false;
      if(finTo   && e.date > finTo)   return false;
      return true;
    });

    // All-time (or filtered) totals
    const totalExp = filteredExps.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount||0),0);
    const totalInc = filteredExps.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount||0),0);
    const balance = totalInc - totalExp;
    const periodLabel = finFrom||finTo ? ((finFrom||'Start')+' to '+(finTo||'Today')) : 'All Time';

    // Recent transactions (last 10 from filtered)
    const recent = [...filteredExps].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10);

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('overview')}
      
      <div style="margin-bottom:14px;">
        <h2 style="font-size:1.3rem;font-weight:800;color:var(--txt);margin-bottom:4px;">💼 Finance Overview</h2>
        <!-- Date filter bar — same style as Khata Book -->
        <div class="date-filter-panel date-filter-panel--compact" style="margin-top:8px;">
          <div class="date-filter-bar">
            <span class="date-filter-bar__meta">${periodLabel}</span>
            <div class="date-filter-bar__tools">
              ${renderCompactDateRangeFilter({
                label:'Date',
                fromId:'dfh_fof',
                toId:'dfh_fot',
                fromValue:finFrom,
                toValue:finTo,
                fromOnChange:"APP._finOvFrom=this.value;APP.renderExpenseOverview()",
                toOnChange:"APP._finOvTo=this.value;APP.renderExpenseOverview()",
                clearOnClick:"APP._finOvFrom='';APP._finOvTo='';APP.renderExpenseOverview()",
                className:'date-filter-inline--tight'
              })}
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
        <!-- Income -->
        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:14px;padding:16px 18px;box-shadow:var(--sh);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:38px;height:38px;border-radius:50%;background:#16a34a;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;flex-shrink:0;">💰</div>
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#15803d;font-weight:800;">INCOME</div>
          </div>
          <div style="font-size:1.6rem;font-weight:900;color:#15803d;font-family:'JetBrains Mono',monospace;margin-bottom:6px;">₹${fmt(totalInc)}</div>
          <div style="font-size:.78rem;color:#16a34a;font-weight:600;">${periodLabel}</div>
        </div>

        <!-- Expense -->
        <div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1.5px solid #fca5a5;border-radius:14px;padding:16px 18px;box-shadow:var(--sh);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:38px;height:38px;border-radius:50%;background:#dc2626;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;flex-shrink:0;">💸</div>
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#b91c1c;font-weight:800;">EXPENSE</div>
          </div>
          <div style="font-size:1.6rem;font-weight:900;color:#b91c1c;font-family:'JetBrains Mono',monospace;margin-bottom:6px;">₹${fmt(totalExp)}</div>
          <div style="font-size:.78rem;color:#dc2626;font-weight:600;">${periodLabel}</div>
        </div>

        <!-- Balance -->
        <div style="background:linear-gradient(135deg,${balance>=0?'#f0f9ff,#e0f2fe':'#fff7ed,#ffedd5'});border:1.5px solid ${balance>=0?'#7dd3fc':'#fdba74'};border-radius:14px;padding:16px 18px;box-shadow:var(--sh);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:38px;height:38px;border-radius:50%;background:${balance>=0?'#0284c7':'#ea580c'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;flex-shrink:0;">${balance>=0?'✅':'⚠️'}</div>
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:${balance>=0?'#0369a1':'#c2410c'};font-weight:800;">BALANCE</div>
          </div>
          <div style="font-size:1.6rem;font-weight:900;color:${balance>=0?'#0369a1':'#c2410c'};font-family:'JetBrains Mono',monospace;margin-bottom:6px;">₹${fmt(Math.abs(balance))}</div>
          <div style="font-size:.78rem;color:${balance>=0?'#0284c7':'#ea580c'};font-weight:600;">${balance>=0?'Surplus':'Deficit'}</div>
        </div>
      </div>

      <!-- 6-Month Income vs Expense Bar Chart -->
      ${(()=>{
        const now2=new Date();
        const months=[];
        for(let i=5;i>=0;i--){
          const d=new Date(now2.getFullYear(),now2.getMonth()-i,1);
          const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
          const label=d.toLocaleString('en-IN',{month:'short'});
          const inc=allExps.filter(e=>e.type==='income'&&e.date&&e.date.startsWith(key)).reduce((s,e)=>s+Number(e.amount||0),0);
          const exp=allExps.filter(e=>e.type==='expense'&&e.date&&e.date.startsWith(key)).reduce((s,e)=>s+Number(e.amount||0),0);
          months.push({key,label,inc,exp});
        }
        const maxVal=Math.max(...months.map(m=>Math.max(m.inc,m.exp)),1);
        const BH=80,BW=32,GAP=12,PAD=28;
        const chartW=months.length*(BW*2+GAP+8)+PAD;
        const bars=months.map((m,i)=>{
          const incH=Math.max(2,Math.round((m.inc/maxVal)*BH));
          const expH=Math.max(2,Math.round((m.exp/maxVal)*BH));
          const x=PAD+i*(BW*2+GAP+8);
          const incLbl=m.inc>=100000?(m.inc/100000).toFixed(1)+'L':m.inc>=1000?Math.round(m.inc/1000)+'k':'';
          const expLbl=m.exp>=100000?(m.exp/100000).toFixed(1)+'L':m.exp>=1000?Math.round(m.exp/1000)+'k':'';
          return '<rect x="'+x+'" y="'+(BH-incH)+'" width="'+BW+'" height="'+incH+'" rx="4" fill="#22c55e" opacity="0.85"/>'
            +'<rect x="'+(x+BW+2)+'" y="'+(BH-expH)+'" width="'+BW+'" height="'+expH+'" rx="4" fill="#ef4444" opacity="0.85"/>'
            +(incLbl?'<text x="'+(x+BW/2)+'" y="'+(BH-incH-4)+'" text-anchor="middle" font-size="8" font-weight="700" fill="#15803d" font-family="Nunito">'+incLbl+'</text>':'')
            +(expLbl?'<text x="'+(x+BW+2+BW/2)+'" y="'+(BH-expH-4)+'" text-anchor="middle" font-size="8" font-weight="700" fill="#dc2626" font-family="Nunito">'+expLbl+'</text>':'')
            +'<text x="'+(x+BW)+'" y="'+(BH+14)+'" text-anchor="middle" font-size="9" fill="var(--mut)" font-family="Nunito">'+m.label+'</text>';
        }).join('');
        return '<div style="background:var(--card);border:1.5px solid var(--bdr);border-radius:14px;padding:14px 16px;margin-bottom:16px;box-shadow:var(--sh);">'
          +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
          +'<div style="font-weight:800;font-size:.88rem;">📊 Last 6 Months</div>'
          +'<div style="display:flex;gap:12px;font-size:.7rem;">'
          +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:#22c55e;display:inline-block;"></span>Income</span>'
          +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:#ef4444;display:inline-block;"></span>Expense</span>'
          +'</div></div>'
          +'<div style="overflow-x:auto;">'
          +'<svg viewBox="0 0 '+chartW+' '+(BH+24)+'" style="width:100%;min-width:'+Math.min(chartW,280)+'px;height:'+(BH+24)+'px;display:block;">'
          +bars
          +'<line x1="'+(PAD-6)+'" y1="0" x2="'+(PAD-6)+'" y2="'+BH+'" stroke="var(--bdr)" stroke-width="1"/>'
          +'<line x1="'+(PAD-6)+'" y1="'+BH+'" x2="'+(chartW-4)+'" y2="'+BH+'" stroke="var(--bdr)" stroke-width="1"/>'
          +'</svg></div></div>';
      })()}

      <!-- Recent Transactions -->
      <div class="card">
        <div class="card-hdr">
          <div class="card-title">📋 Recent Transactions</div>
          <button class="btn b-sm b-gold" onclick="APP._finNav('txn')">View All</button>
        </div>
        <div class="card-body">
          ${recent.length ? recent.map(e=>{
            const isInc = e.type==='income';
            const cleanCat = (e.cat||'Other').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim();
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr);">
              <div style="width:32px;height:32px;border-radius:50%;background:${isInc?'#dcfce7':'#fee2e2'};display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0;">${isInc?'💰':'💸'}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:.82rem;font-weight:700;">${cleanCat}</div>
                <div style="font-size:.68rem;color:var(--mut);">${fD(e.date)} ${e.note?' • '+e.note:''}</div>
              </div>
              <div style="font-size:.88rem;font-weight:900;font-family:'JetBrains Mono',monospace;color:${isInc?'var(--grn)':'var(--red)'};white-space:nowrap;">${isInc?'+':'−'}₹${fmt(e.amount||0)}</div>
            </div>`;
          }).join('') : '<div class="empty">No transactions yet</div>'}
        </div>
        <div class="card-foot">
          <button class="btn b-grn b-sm" onclick="APP.openExpModal()">➕ Add Transaction</button>
        </div>
      </div>
    `;
  },


  // ═══════════ ACCOUNTS ═══════════
  _finAccounts(){
    const accs = this.finAccounts;
    const fmt = window.fmt||(n=>n.toLocaleString('en-IN'));
    const typeLabel={'payment':'Payment','savings':'Savings','credit':'Credit Card','liability':'Liability','investment':'Investment'};
    const typeIcon ={'payment':'💵','savings':'🏦','credit':'💳','liability':'📋','investment':'📈'};
    const totalAssets=accs.filter(a=>a.atype!=='liability'&&a.atype!=='credit').reduce((s,a)=>s+Number(a.balance||0),0);
    const totalLiab  =accs.filter(a=>a.atype==='liability'||a.atype==='credit').reduce((s,a)=>s+Number(a.balance||0),0);

    // Active ledger account (for drill-down)
    const activeAccId = this._accLedgerId || null;
    const accLedgFrom = this._accLedgFrom || '';
    const accLedgTo   = this._accLedgTo   || '';

    // Build per-account ledger if selected
    let ledgerHtml = '';
    if(activeAccId){
      const acc = accs.find(a=>a.id===activeAccId);
      if(acc){
        const allExp = this.expenses||[];
        let txns = allExp.filter(e=>
          e.type!=='loan'&&e.type!=='loan_taken'&&
          (e.account===acc.name||e.fromAcc===acc.name||e.toAcc===acc.name)
        );
        if(accLedgFrom) txns=txns.filter(e=>e.date&&e.date>=accLedgFrom);
        if(accLedgTo)   txns=txns.filter(e=>e.date&&e.date<=accLedgTo);
        txns=[...txns].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
        const totIn  = txns.filter(e=>e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name)).reduce((s,e)=>s+Number(e.amount),0);
        const totOut = txns.filter(e=>e.type==='expense'||(e.type==='transfer'&&e.fromAcc===acc.name)).reduce((s,e)=>s+Number(e.amount),0);
        const netBal = totIn - totOut;
        const periodLabel = accLedgFrom||accLedgTo ? ((accLedgFrom||'Start')+' → '+(accLedgTo||'Today')) : 'All Time';

        const rowsHtml = txns.length ? txns.map((e,i)=>{
          const isIn = e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
          const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
          const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:cat):cat;
          const amtColor=isIn?'#1a7a45':'#c0392b';
          const amtSign=isIn?'+':'−';
          return `<tr style="${i%2===0?'background:#fff':'background:#f8faff'}">
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;white-space:nowrap;">${fD(e.date)}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;">${desc}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;color:var(--mut);">${e.paymode||'Cash'}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;color:var(--mut);word-break:break-word;">${e.note||'—'}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:'JetBrains Mono',monospace;color:#1a7a45;font-weight:700;">${isIn?fmt(Number(e.amount)):'—'}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:'JetBrains Mono',monospace;color:#c0392b;font-weight:700;">${!isIn?fmt(Number(e.amount)):'—'}</td>
          </tr>`;
        }).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--mut);font-size:.8rem;">No transactions found for this account</td></tr>`;

        ledgerHtml = `
        <div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;overflow:hidden;margin-bottom:14px;">
          <!-- Ledger header -->
          <div style="background:linear-gradient(135deg,var(--acc),var(--acc2));padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.75);">Account Ledger</div>
              <div style="font-size:.95rem;font-weight:800;color:#fff;">${typeIcon[acc.atype]||'🏦'} ${acc.name}</div>
              ${acc.bank?`<div style="font-size:.65rem;color:rgba(255,255,255,.8);">${acc.bank}</div>`:''}
            </div>
            <button onclick="APP._accLedgerId=null;APP._finAccounts();" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:7px;padding:5px 11px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">✕ Close</button>
          </div>

          <!-- Summary strip -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--bdr);">
            <div style="padding:10px 14px;text-align:center;border-right:1px solid var(--bdr);background:#f0fdf4;">
              <div style="font-size:.58rem;text-transform:uppercase;color:#1a7a45;font-weight:800;">Total In (+)</div>
              <div style="font-size:.95rem;font-weight:900;color:#1a7a45;font-family:'JetBrains Mono',monospace;">₹${fmt(totIn)}</div>
            </div>
            <div style="padding:10px 14px;text-align:center;border-right:1px solid var(--bdr);background:#fff0f0;">
              <div style="font-size:.58rem;text-transform:uppercase;color:#c0392b;font-weight:800;">Total Out (−)</div>
              <div style="font-size:.95rem;font-weight:900;color:#c0392b;font-family:'JetBrains Mono',monospace;">₹${fmt(totOut)}</div>
            </div>
            <div style="padding:10px 14px;text-align:center;background:${netBal>=0?'#f0fdf4':'#fff0f0'};">
              <div style="font-size:.58rem;text-transform:uppercase;color:${netBal>=0?'#1a7a45':'#c0392b'};font-weight:800;">Net Balance</div>
              <div style="font-size:.95rem;font-weight:900;color:${netBal>=0?'#1a7a45':'#c0392b'};font-family:'JetBrains Mono',monospace;">${netBal>=0?'+':'−'}₹${fmt(Math.abs(netBal))}</div>
            </div>
          </div>

          <!-- Date filter + Download buttons -->
          <div style="background:var(--card2);padding:9px 14px;border-bottom:1px solid var(--bdr);display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;">
            <div class="date-filter-bar__tools">
              ${renderCompactDateRangeFilter({
                label:'Date',
                fromId:'dfh_alf',
                toId:'dfh_alt',
                fromValue:accLedgFrom,
                toValue:accLedgTo,
                fromOnChange:"APP._accLedgFrom=this.value;APP._finAccounts()",
                toOnChange:"APP._accLedgTo=this.value;APP._finAccounts()",
                clearOnClick:"APP._accLedgFrom='';APP._accLedgTo='';APP._finAccounts()",
                meta:`${periodLabel} · ${txns.length} entries`,
                className:'date-filter-inline--tight'
              })}
            </div>
            <div class="export-toolbar export-toolbar-sm">
              ${APP._pdfOriHtml()}
              <button onclick="APP._accLedgerPDF('${acc.id}')" class="btn b-sm b-out export-tool-btn export-tool-pdf"><span class="material-symbols-outlined">picture_as_pdf</span><span>PDF</span></button>
              <button onclick="APP._accLedgerWord('${acc.id}')" class="btn b-sm b-out export-tool-btn export-tool-word"><span class="material-symbols-outlined">description</span><span>Word</span></button>
              <button onclick="APP._accLedgerCSV('${acc.id}')" class="btn b-sm b-out export-tool-btn export-tool-csv"><span class="material-symbols-outlined">table_view</span><span>CSV</span></button>
            </div>
          </div>

          <!-- Transaction table -->
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:520px;">
              <thead>
                <tr style="background:#2c6fad;">
                  <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);">Date</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);">Description</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);">Mode</th>
                  <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);">Note</th>
                  <th style="padding:9px 10px;text-align:right;font-size:11px;font-weight:800;background:#1a7a45;color:#fff;border:1px solid rgba(255,255,255,.2);">In (+)</th>
                  <th style="padding:9px 10px;text-align:right;font-size:11px;font-weight:800;background:#c0392b;color:#fff;border:1px solid rgba(255,255,255,.2);">Out (−)</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr style="background:#dbeafe;font-weight:800;">
                  <td colspan="4" style="padding:9px 10px;border:1px solid #bfdbfe;font-size:12px;color:#1e3a5f;">Grand Total — ${txns.length} transactions</td>
                  <td style="padding:9px 10px;border:1px solid #bfdbfe;text-align:right;font-family:'JetBrains Mono',monospace;font-size:13px;color:#1a7a45;">₹${fmt(totIn)}</td>
                  <td style="padding:9px 10px;border:1px solid #bfdbfe;text-align:right;font-family:'JetBrains Mono',monospace;font-size:13px;color:#c0392b;">₹${fmt(totOut)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>`;
      }
    }

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('accounts')}

      <!-- ══ NET WORTH BANNER + Add Account at top ══ -->
      <div style="background:linear-gradient(135deg,var(--acc),var(--acc2));border-radius:14px;padding:14px 16px;margin-bottom:14px;color:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;opacity:.75;margin-bottom:2px;">NET WORTH</div>
            <div style="font-size:1.5rem;font-weight:900;font-family:'JetBrains Mono',monospace;">₹${fmt(totalAssets-totalLiab)}</div>
            <div style="font-size:.68rem;opacity:.82;margin-top:4px;">Assets ₹${fmt(totalAssets)} · Liabilities ₹${fmt(totalLiab)}</div>
          </div>
          <button onclick="APP._openAccModal()"
            style="background:rgba(255,255,255,.2);color:#fff;border:1.5px solid rgba(255,255,255,.4);border-radius:18px;padding:8px 13px;font-size:.76rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;white-space:nowrap;flex-shrink:0;">
            ➕ Add Account
          </button>
        </div>
      </div>

      <!-- Ledger drill-down (shows when account selected) -->
      ${ledgerHtml}

      <!-- ══ ACCOUNT TYPE SECTIONS ══ -->
      ${['payment','savings','investment','credit','liability'].map(atype=>{
        const list=accs.filter(a=>a.atype===atype);
        if(!list.length) return '';
        const isDebt=atype==='credit'||atype==='liability';
        const sTotal=list.reduce((s,a)=>s+Number(a.balance||0),0);
        return `<div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <span style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);">${typeIcon[atype]} ${typeLabel[atype]}</span>
            <span style="font-size:.7rem;font-weight:700;color:${isDebt?'var(--red)':'var(--grn)'};">${isDebt?'−':''}₹${fmt(sTotal)}</span>
          </div>
          ${list.map(a=>`<div style="background:var(--card);border:1px solid ${activeAccId===a.id?'var(--acc)':'var(--bdr)'};border-radius:11px;padding:11px 13px;margin-bottom:5px;display:flex;align-items:center;gap:10px;${activeAccId===a.id?'box-shadow:0 0 0 2px rgba(44,111,173,.2);':''}">
            <div style="width:38px;height:38px;border-radius:50%;background:${isDebt?'#fff5f5':'#f0faf5'};display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex-shrink:0;">${typeIcon[atype]}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:.84rem;font-weight:700;">${a.name}</div>
              <div style="font-size:.66rem;color:var(--mut);">${a.bank||''}${a.note?' · '+a.note:''}</div>
              ${atype==='credit'&&a.limit?`<div style="font-size:.62rem;color:var(--mut);margin-top:1px;">Limit ₹${fmt(a.limit)} · Available ₹${fmt(Math.max(0,Number(a.limit)-Number(a.balance||0)))}</div>`:''}
            </div>
            <div style="text-align:right;">
              <div style="font-size:.9rem;font-weight:900;font-family:'JetBrains Mono',monospace;color:${isDebt?'var(--red)':'var(--grn)'};">${isDebt?'−':''}₹${fmt(Math.abs(Number(a.balance||0)))}</div>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
              <button onclick="APP._accLedgerId='${a.id}';APP._accLedgFrom='';APP._accLedgTo='';APP._finAccounts();document.getElementById('pan-expense').scrollTo({top:0,behavior:'smooth'});" style="background:${activeAccId===a.id?'var(--acc)':'#eff6ff'};border:1px solid var(--acc);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:${activeAccId===a.id?'#fff':'var(--acc)'};font-weight:700;font-family:'Nunito',sans-serif;">📋 Ledger</button>
              <button onclick="APP._openAccModal('${a.id}')" style="background:none;border:1px solid var(--bdr2);border-radius:5px;padding:3px 7px;font-size:.62rem;cursor:pointer;color:var(--mut);">✏️</button>
              <button onclick="APP._delAcc('${a.id}')" style="background:none;border:1px solid rgba(229,57,53,.3);border-radius:5px;padding:3px 7px;font-size:.62rem;cursor:pointer;color:#e53935;">🗑</button>
            </div>
          </div>`).join('')}
        </div>`;
      }).join('')}

      ${!accs.length?`<div style="text-align:center;padding:40px 20px;color:var(--mut);">
        <div style="font-size:2.5rem;margin-bottom:10px;">🏦</div>
        <div style="font-size:.9rem;margin-bottom:5px;">No accounts yet</div>
        <div style="font-size:.76rem;">Add Cash, Bank, UPI, Credit Card accounts</div>
      </div>`:''}
    `;
  },

  // ── Per-Account Ledger Downloads ─────────────────────────────
  _accLedgerGetData(accId){
    const acc=(this.finAccounts||[]).find(a=>a.id===accId);
    if(!acc) return null;
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const allExp=this.expenses||[];
    const from=this._accLedgFrom||'';
    const to=this._accLedgTo||'';
    let txns=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken'&&(e.account===acc.name||e.fromAcc===acc.name||e.toAcc===acc.name));
    if(from) txns=txns.filter(e=>e.date&&e.date>=from);
    if(to)   txns=txns.filter(e=>e.date&&e.date<=to);
    txns=[...txns].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    const totIn=txns.filter(e=>e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name)).reduce((s,e)=>s+Number(e.amount),0);
    const totOut=txns.filter(e=>e.type==='expense'||(e.type==='transfer'&&e.fromAcc===acc.name)).reduce((s,e)=>s+Number(e.amount),0);
    const periodLabel=from||to?((from||'Start')+' to '+(to||'Today')):'All Time';
    return{acc,txns,totIn,totOut,netBal:totIn-totOut,fmt,fD,periodLabel,from,to};
  },

  _accLedgerPDF(accId){
    const d=this._accLedgerGetData(accId); if(!d) return;
    const {acc,txns,totIn,totOut,netBal,fmt,fD,periodLabel}=d;
    const rows=txns.map((e,i)=>{
      const isIn=e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
      const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
      const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:cat):cat;
      return `<tr style="background:${i%2===0?'#fff':'#f8faff'}">
        <td>${fD(e.date)}</td><td>${desc}</td><td>${e.paymode||'Cash'}</td><td>${e.note||'—'}</td>
        <td style="text-align:right;color:#1a7a45;font-weight:700;">${isIn?fmt(Number(e.amount)):'—'}</td>
        <td style="text-align:right;color:#c0392b;font-weight:700;">${!isIn?fmt(Number(e.amount)):'—'}</td>
      </tr>`;
    }).join('');
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Account Ledger — ${acc.name}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;color:#1a1d23;background:#f0f2f5;padding:16mm 14mm;}
    .header{background:linear-gradient(135deg,#dbeafe,#eff6ff);border:1.5px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:16px;text-align:center;}
    .header h1{font-size:22px;font-weight:900;color:#1e3a5f;margin-bottom:4px;}
    .header .sub{font-size:13px;color:#3a6fa0;}
    .header .acc{font-size:14px;color:#1e3a5f;margin-top:6px;background:rgba(44,111,173,.1);display:inline-block;padding:4px 14px;border-radius:20px;font-weight:800;border:1px solid #bfdbfe;}
    .summary{display:flex;border:1.5px solid #bfdbfe;border-radius:8px;overflow:hidden;margin-bottom:16px;}
    .sc{flex:1;padding:12px 14px;text-align:center;border-right:1px solid #bfdbfe;}
    .sc:last-child{border-right:none;}
    .sc-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:5px;}
    .sc-val{font-size:18px;font-weight:900;}
    table{width:100%;border-collapse:collapse;border:1.5px solid #bfdbfe;}
    thead tr{background:#2c6fad;}
    th{padding:10px;font-size:11px;font-weight:800;color:#fff;text-align:left;border:1px solid rgba(255,255,255,.2);text-transform:uppercase;}
    th.r{text-align:right;}
    td{font-size:12px;border:1px solid #e2e8f0;padding:8px 10px;}
    tfoot td{background:#dbeafe;font-weight:800;font-size:13px;color:#1e3a5f;}
    @media print{body{padding:0;background:#fff;}@page{margin:16mm 14mm;}}</style></head><body>
    <div class="header">
      <div style="font-size:24px;margin-bottom:6px;">🏦</div>
      <h1>Account Ledger Report</h1>
      <div class="sub">${periodLabel}</div>
      <div class="acc">${acc.name}${acc.bank?' · '+acc.bank:''}</div>
    </div>
    <div class="summary">
      <div class="sc" style="background:#f0fdf4;border-left:4px solid #1a7a45;"><div class="sc-lbl" style="color:#1a7a45;">Total In (+)</div><div class="sc-val" style="color:#1a7a45;">₹${fmt(totIn)}</div></div>
      <div class="sc" style="background:#fff0f0;border-left:4px solid #c0392b;"><div class="sc-lbl" style="color:#c0392b;">Total Out (−)</div><div class="sc-val" style="color:#c0392b;">₹${fmt(totOut)}</div></div>
      <div class="sc" style="background:#eff6ff;border-left:4px solid #2c6fad;"><div class="sc-lbl" style="color:#2c6fad;">Net Balance</div><div class="sc-val" style="color:${netBal>=0?'#1a7a45':'#c0392b'};">${netBal>=0?'+':'−'}₹${fmt(Math.abs(netBal))}</div></div>
    </div>
    <p style="font-size:11px;color:#888;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #bfdbfe;">Entries: ${txns.length} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Mode</th><th>Note</th><th class="r" style="background:#1a7a45;">In (+)</th><th class="r" style="background:#c0392b;">Out (−)</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">No transactions</td></tr>'}</tbody>
      <tfoot><tr><td colspan="4" style="padding:9px 10px;border:1px solid #bfdbfe;">Grand Total</td><td style="padding:9px 10px;border:1px solid #bfdbfe;text-align:right;color:#1a7a45;">₹${fmt(totIn)}</td><td style="padding:9px 10px;border:1px solid #bfdbfe;text-align:right;color:#c0392b;">₹${fmt(totOut)}</td></tr></tfoot>
    </table></body></html>`;
    const aclRows = txns.map(e=>{
      const isIn=e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
      const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
      const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:cat):cat;
      return [fD(e.date), desc, e.paymode||'Cash', e.note||'—',
              isIn?'Rs.'+fmt(Number(e.amount)):'—',
              !isIn?'Rs.'+fmt(Number(e.amount)):'—'];
    });
    _makePDF({
      filename: 'Account_Ledger_'+acc.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: 'Account Ledger Report',
      subtitle: periodLabel,
      badge: acc.name+(acc.bank?' · '+acc.bank:''),
      summaryRows: [
        ['Total In (+)', 'Rs.'+fmt(totIn), [26,122,69]],
        ['Total Out (−)', 'Rs.'+fmt(totOut), [192,57,43]],
        ['Net Balance', (netBal>=0?'+':'-')+'Rs.'+fmt(Math.abs(netBal)), netBal>=0?[26,122,69]:[192,57,43]],
      ],
      entriesLabel: 'Entries: '+txns.length+' | Generated: '+fD(new Date().toISOString().slice(0,10)),
      columns: ['Date','Description','Mode','Note','In (+)','Out (−)'],
      rows: aclRows,
      totalsRow: ['Grand Total','','','','Rs.'+fmt(totIn),'Rs.'+fmt(totOut)],
      colStyles: {4:{halign:'right',textColor:[26,122,69],fontStyle:'bold'}, 5:{halign:'right',textColor:[192,57,43],fontStyle:'bold'}},
      headerColor: [44,111,173],
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  _accLedgerWord(accId){
    const d=this._accLedgerGetData(accId); if(!d) return;
    const {acc,txns,totIn,totOut,netBal,fmt,fD,periodLabel}=d;
    const rows=txns.map(e=>{
      const isIn=e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
      const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
      const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:cat):cat;
      return `<tr><td>${fD(e.date)}</td><td>${desc}</td><td>${e.paymode||'Cash'}</td><td>${e.note||'—'}</td><td style="text-align:right;color:#1a7a45;font-weight:bold;">${isIn?'₹'+fmt(Number(e.amount)):'—'}</td><td style="text-align:right;color:#c0392b;font-weight:bold;">${!isIn?'₹'+fmt(Number(e.amount)):'—'}</td></tr>`;
    }).join('');
    const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><title>Account Ledger — ${acc.name}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
    <style>body{font-family:Arial;font-size:11pt;} h1{color:#1e3a5f;font-size:16pt;} h2{color:#2c6fad;font-size:12pt;} table{border-collapse:collapse;width:100%;font-size:10pt;} th{background:#2C6FAD;color:white;padding:7px;text-align:left;} th.ri{background:#1a7a45;} th.ro{background:#c0392b;} td{padding:6px 8px;border:1px solid #ddd;} tr:nth-child(even){background:#f8faff;} tfoot td{background:#dbeafe;font-weight:bold;}</style>
    </head><body>
    <h1>🏦 Account Ledger — ${acc.name}</h1>
    <h2>${acc.bank||''} &nbsp;|&nbsp; ${periodLabel}</h2>
    <table style="margin-bottom:14px;width:auto;"><tr>
      <td style="background:#f0fdf4;color:#1a7a45;font-weight:bold;">Total In (+)</td><td style="color:#1a7a45;font-weight:bold;">₹${fmt(totIn)}</td>
      <td style="background:#fff0f0;color:#c0392b;font-weight:bold;">Total Out (−)</td><td style="color:#c0392b;font-weight:bold;">₹${fmt(totOut)}</td>
      <td style="background:#eff6ff;color:#2c6fad;font-weight:bold;">Net Balance</td><td style="color:${netBal>=0?'#1a7a45':'#c0392b'};font-weight:bold;">${netBal>=0?'+':'−'}₹${fmt(Math.abs(netBal))}</td>
    </tr></table>
    <p style="font-size:9pt;color:#666;">Entries: ${txns.length} | Generated: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Mode</th><th>Note</th><th class="ri">In (+)</th><th class="ro">Out (−)</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="6">No transactions</td></tr>'}</tbody>
      <tfoot><tr><td colspan="4"><b>Grand Total</b></td><td style="text-align:right;color:#1a7a45;">₹${fmt(totIn)}</td><td style="text-align:right;color:#c0392b;">₹${fmt(totOut)}</td></tr></tfoot>
    </table></body></html>`;
    const _awBlob=new Blob([html],{type:'application/msword'});
    const _awA=document.createElement('a');_awA.href=URL.createObjectURL(_awBlob);
    _awA.download='Account_Ledger_'+acc.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(_awA);_awA.click();document.body.removeChild(_awA);
    URL.revokeObjectURL(_awA.href);
    this.showToastMsg('✅ Word downloaded!');
  },

  _accLedgerCSV(accId){
    const d=this._accLedgerGetData(accId); if(!d) return;
    const {acc,txns,totIn,totOut,netBal,fmt,fD,periodLabel}=d;
    const rows=[['Date','Description','Mode','Note','In (+)','Out (−)']];
    txns.forEach(e=>{
      const isIn=e.type==='income'||(e.type==='transfer'&&e.toAcc===acc.name);
      const cat=(e.cat||'').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'';
      const desc=e.type==='transfer'?(e.fromAcc&&e.toAcc?e.fromAcc+' -> '+e.toAcc:cat):cat;
      rows.push([fD(e.date),desc,e.paymode||'Cash',(e.note||'').replace(/,/g,' '),isIn?Number(e.amount):'',!isIn?Number(e.amount):'']);
    });
    rows.push(['','','','Grand Total',totIn,totOut]);
    const csv=rows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='Account_Ledger_'+acc.name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.csv';
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ CSV/Excel downloaded!');
  },


  _openAccModal(id){
    const accs=this.finAccounts;
    const a=id?accs.find(x=>x.id===id):null;
    this._editAccId=id||null;
    const html=`<div class="overlay" id="finAccM" data-noclose="1" style=""><div class="modal" style="max-width:420px;">
      <h2>${id?'✏️ Edit Account':'🏦 Add Account'}</h2>
      <div class="fgrid">
        <div class="fg"><label>Account Name *</label><input id="fac_name" value="${a?a.name:''}" placeholder="e.g. SBI Savings, HDFC Credit"></div>
        <div class="fg"><label>Type *</label>
          <select id="fac_type" style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:8px 11px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.85rem;outline:none;width:100%;">
            <option value="payment" ${a&&a.atype==='payment'?'selected':''}>💵 Payment (Cash/UPI/Debit)</option>
            <option value="savings" ${a&&a.atype==='savings'?'selected':''}>🏦 Savings / Bank Account</option>
            <option value="credit" ${a&&a.atype==='credit'?'selected':''}>💳 Credit Card</option>
            <option value="liability" ${a&&a.atype==='liability'?'selected':''}>📋 Liability / Loan</option>
            <option value="investment" ${a&&a.atype==='investment'?'selected':''}>📈 Investment / FD</option>
          </select>
        </div>
        <div class="fg"><label>Current Balance (₹) *</label><input id="fac_bal" type="number" value="${a?a.balance:''}" placeholder="0"></div>
        <div class="fg"><label>Bank / Institution</label><input id="fac_bank" value="${a?a.bank||'':''}" placeholder="SBI, HDFC, PhonePe..."></div>
        <div id="fac_limit_row" class="fg" style="${a&&a.atype==='credit'?'':'display:none'}"><label>Credit Limit (₹)</label><input id="fac_limit" type="number" value="${a?a.limit||'':''}" placeholder="e.g. 100000"></div>
        <div class="full fg"><label>Note</label><input id="fac_note" value="${a?a.note||'':''}" placeholder="Optional"></div>
      </div>
      <div class="modal-foot">
        <button class="btn b-out" onclick="M.close('finAccM')">Cancel</button>
        <button class="btn b-gold" onclick="APP._saveAcc()">💾 Save</button>
      </div>
    </div></div>`;
    const existing=document.getElementById('finAccM');
    if(existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend',html);
    document.getElementById('fac_type').addEventListener('change',function(){
      document.getElementById('fac_limit_row').style.display=this.value==='credit'?'':'none';
    });
    M.open('finAccM');
  },

  _saveAcc(){
    const name=document.getElementById('fac_name').value.trim();
    if(!name){alert('Account name required!');return;}
    const data={
      name,
      atype:document.getElementById('fac_type').value,
      balance:Number(document.getElementById('fac_bal').value)||0,
      bank:document.getElementById('fac_bank').value.trim(),
      limit:Number(document.getElementById('fac_limit').value)||0,
      note:document.getElementById('fac_note').value.trim()
    };
    let accs=this.finAccounts;
    if(this._editAccId){
      accs=accs.map(a=>a.id===this._editAccId?{...a,...data}:a);
    } else {
      data.id=uid(); data.created=new Date().toISOString();
      accs.push(data);
    }
    this.finAccounts=accs;
    M.close('finAccM');
    this._finAccounts();
    this.showToastMsg('✅ Account saved!');
  },

  _delAcc(id){
    this.delCb=()=>{
      this.finAccounts=this.finAccounts.filter(a=>a.id!==id);
      this._finAccounts();
    };
    document.getElementById('delMsg').textContent='Delete this account?';
    M.open('delM');
  },

  // ═══════════ TRANSACTIONS ═══════════
  _finTransactions(){
    const allExp=this.expenses||[];
    const expSearch=(this.expSearch||'').toLowerCase().trim();
    const expTypeFilter=this.expTypeFilter||'all';
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const txnFrom=this._finFrom||'';
    const txnTo=this._finTo||'';

    let filtered=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(txnFrom) filtered=filtered.filter(e=>e.date&&e.date>=txnFrom);
    if(txnTo)   filtered=filtered.filter(e=>e.date&&e.date<=txnTo);
    if(expTypeFilter!=='all') filtered=filtered.filter(e=>e.type===expTypeFilter);
    if(expSearch) filtered=filtered.filter(e=>(e.cat||'').toLowerCase().includes(expSearch)||(e.note||'').toLowerCase().includes(expSearch)||(e.paymode||'').toLowerCase().includes(expSearch)||(e.account||'').toLowerCase().includes(expSearch)||(e.fromAcc||'').toLowerCase().includes(expSearch)||(e.toAcc||'').toLowerCase().includes(expSearch)||String(e.amount).includes(expSearch));
    const sorted=[...filtered].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

    const totalInc=filtered.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
    const totalExp=filtered.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
    const totalTrf=filtered.filter(e=>e.type==='transfer').reduce((s,e)=>s+Number(e.amount),0);
    const balance=totalInc-totalExp;

    const typeColor={expense:'#e53935',income:'#2e7d32',transfer:'#1565c0'};
    const typeBg={expense:'rgba(229,57,53,.08)',income:'rgba(46,125,50,.08)',transfer:'rgba(21,101,192,.08)'};

    const grouped={};
    sorted.forEach(e=>{const dk=e.date||'Unknown';if(!grouped[dk])grouped[dk]=[];grouped[dk].push(e);});

    // ── Build transaction rows ──
    let txHtml='';
    if(!sorted.length){
      txHtml=`<div style="text-align:center;padding:50px 20px;color:var(--mut);">
        <div style="font-size:2.8rem;margin-bottom:12px;">💸</div>
        <div style="font-size:.92rem;font-weight:700;">No transactions yet</div>
        <div style="font-size:.76rem;margin-top:5px;">Tap "+ Add Transaction" to get started</div>
      </div>`;
    } else {
      Object.keys(grouped).sort().reverse().forEach(dk=>{
        const dayExp=grouped[dk];
        const dayDate=dk!=='Unknown'?new Date(dk):null;
        const dayLabel=dayDate?(()=>{const _w=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];return _w[dayDate.getDay()]+', '+String(dayDate.getDate()).padStart(2,'0')+'/'+String(dayDate.getMonth()+1).padStart(2,'0')+'/'+String(dayDate.getFullYear());})():'Unknown Date';
        const dayNet=dayExp.reduce((s,e)=>e.type==='income'?s+Number(e.amount):e.type==='expense'?s-Number(e.amount):s,0);
        txHtml+=`
        <div style="margin-bottom:1px;">
          <!-- Date header -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 14px;background:var(--dim);border-radius:8px 8px 0 0;">
            <span style="font-size:.7rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;">${dayLabel}</span>
            <span style="font-size:.72rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${dayNet>=0?'#2e7d32':'#e53935'};">${dayNet>=0?'+':'-'}₹${fmt(Math.abs(dayNet))}</span>
          </div>`;

        dayExp.forEach(e=>{
          const raw=e.cat||'—';
          const cleanCat=raw.replace(/^[^\w\u0900-\u097F\u00C0-\u024F]+/,'').trim()||raw;
          const isTransfer=e.type==='transfer';

          // Transfer label: "ICICI → HDFC" or category
          const mainLabelRaw = isTransfer
            ? (e.fromAcc&&e.toAcc ? e.fromAcc+' → '+e.toAcc : (e.account||cleanCat||'Transfer'))
            : cleanCat;
          const mainLabel = expSearch ? APP._finHighlight(mainLabelRaw,expSearch) : mainLabelRaw;

          // Sub-label: note (full, expandable) + mode
          const noteTextRaw = e.note||'';
          const noteText = expSearch ? APP._finHighlight(noteTextRaw,expSearch) : noteTextRaw;
          const modeText = e.paymode||'Cash';
          const accText = isTransfer
            ? (e.fromAcc&&e.toAcc ? `₹${fmt(Number(e.amount))} transferred` : (e.account||''))
            : (expSearch ? APP._finHighlight(e.account||'',expSearch) : (e.account||''));

          const typeIcon = isTransfer ? '🔄' : e.type==='income' ? '💰' : '💸';
          const amtColor = e.type==='expense'?'#e53935':e.type==='income'?'#2e7d32':'#1565c0';
          const amtPrefix = e.type==='expense'?'− ₹':e.type==='income'?'+ ₹':'⇄ ₹';

          txHtml+=`
          <div style="display:flex;align-items:flex-start;gap:11px;padding:11px 14px;background:var(--card);border-bottom:1px solid var(--bdr);transition:background .15s;"
            onmouseover="this.style.background='var(--dim)'" onmouseout="this.style.background='var(--card)'">

            <!-- Icon circle -->
            <div style="width:38px;height:38px;border-radius:50%;background:${typeBg[e.type]||'var(--dim)'};display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex-shrink:0;margin-top:1px;">${typeIcon}</div>

            <!-- Main content -->
            <div style="flex:1;min-width:0;">
              <!-- Title -->
              <div style="font-size:.84rem;font-weight:700;color:var(--txt);margin-bottom:2px;word-break:break-word;">${mainLabel}</div>
              <!-- Sub-line: mode · account -->
              <div style="font-size:.68rem;color:var(--mut);line-height:1.4;">
                ${modeText}${accText?' · '+accText:''}
              </div>
              <!-- Note — full text, no cut -->
              ${noteText?`<div style="font-size:.68rem;color:var(--mut);margin-top:3px;line-height:1.5;word-break:break-word;white-space:pre-wrap;">${noteText}</div>`:''}
              <!-- File thumbnails — compact 36px -->
              ${(e.files&&e.files.length)?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                ${e.files.slice(0,4).map((f,fi)=>{
                  const isImg=f.type&&f.type.startsWith('image/');
                  const ext=(f.name||'').split('.').pop().toUpperCase();
                  const extIcon={'PDF':'📄','DOC':'📝','DOCX':'📝','XLS':'📊','XLSX':'📊'}[ext]||'📎';
                  return isImg
                    ? `<img src="${f.dataUrl||f.url||''}" style="height:36px;width:36px;object-fit:cover;border-radius:5px;cursor:pointer;border:1px solid var(--bdr);" onerror="this.style.display='none'" onclick="event.stopPropagation();window.open('${f.url||f.dataUrl||''}','_blank')" title="${f.name||'image'}">`
                    : `<span style="font-size:1.1rem;cursor:pointer;" title="${f.name||'file'}">${extIcon}</span>`;
                }).join('')}
                ${e.files.length>4?`<span style="font-size:.65rem;color:var(--mut);align-self:center;">+${e.files.length-4} more</span>`:''}
              </div>`:''}
            </div>

            <!-- Amount + actions — right aligned -->
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
              <div style="font-size:.9rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${amtColor};white-space:nowrap;">${amtPrefix}${fmt(Number(e.amount))}</div>
              <div style="display:flex;gap:4px;">
                <button style="background:none;border:1.5px solid var(--bdr2);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:var(--mut);" onclick="APP.openExpModal('${e.id}')">✏️</button>
                <button style="background:none;border:1.5px solid rgba(229,57,53,.3);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:#e53935;" onclick="APP.delExpense('${e.id}')">🗑</button>
              </div>
            </div>
          </div>`;
        });
        txHtml+=`<div style="height:4px;background:var(--bg);"></div></div>`;
      });
    }

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('txn')}
      ${this._finFilterBar()}

      <!-- ── Add Transaction + Search ── -->
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;">
        <!-- 🔍 Search icon button -->
        <button id="fin_search_btn" onclick="APP._finToggleSearch()"
          style="background:var(--card);border:1.5px solid var(--bdr2);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:.85rem;color:var(--mut);flex-shrink:0;"
          title="Search transactions">🔍</button>
        <div style="flex:1;"></div>
        <!-- ➕ Add Transaction -->
        <button onclick="APP.openExpModal()"
          style="background:var(--acc);color:#fff;border:none;border-radius:22px;padding:8px 16px;font-size:.8rem;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;white-space:nowrap;flex-shrink:0;box-shadow:0 2px 8px rgba(44,111,173,.3);">
          ➕ Add Transaction
        </button>
      </div>

      <!-- ── Search bar — hidden by default, shown on icon click ── -->
      <div id="fin_search_row" style="display:${expSearch?'flex':'none'};align-items:center;gap:6px;margin-bottom:10px;background:var(--dim);border:1.5px solid var(--acc);border-radius:10px;padding:6px 10px;">
        <span style="font-size:.82rem;color:var(--acc);">🔍</span>
        <input id="exm_search_inp" type="text" value="${this.expSearch||''}"
          autocomplete="off" autocorrect="off" spellcheck="false"
          oninput="APP._finSearchInput(this.value)"
          onkeydown="if(event.key==='Escape'){APP._finClearSearch();}"
          style="flex:1;border:none;background:transparent;font-size:.84rem;font-family:'Nunito',sans-serif;color:var(--txt);outline:none;min-width:0;"
          placeholder="Type to search transactions…">
        ${expSearch?`<span style="font-size:.7rem;color:var(--acc);font-weight:700;white-space:nowrap;">${sorted.length} found</span>`:''}
        <button onclick="APP._finClearSearch()"
          style="background:none;border:none;cursor:pointer;font-size:.85rem;color:var(--mut);padding:0 2px;flex-shrink:0;">✕</button>
      </div>

      <!-- ── Summary cards: full labels ── -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;">
        <div onclick="APP.expTypeFilter=(APP.expTypeFilter==='income'?'all':'income');APP._finTransactions();"
          style="background:${expTypeFilter==='income'?'#1b5e20':'#f0faf4'};border:2px solid ${expTypeFilter==='income'?'#1b5e20':'#90c8a0'};border-radius:11px;padding:9px 6px;cursor:pointer;text-align:center;transition:all .15s;">
          <div style="font-size:.58rem;text-transform:uppercase;color:${expTypeFilter==='income'?'#c8e6c9':'#2e7d32'};font-weight:800;letter-spacing:.04em;">Income</div>
          <div style="font-size:.8rem;font-weight:900;color:${expTypeFilter==='income'?'#fff':'#2e7d32'};font-family:'JetBrains Mono',monospace;margin-top:2px;">₹${fmt(totalInc)}</div>
        </div>
        <div onclick="APP.expTypeFilter=(APP.expTypeFilter==='expense'?'all':'expense');APP._finTransactions();"
          style="background:${expTypeFilter==='expense'?'#b71c1c':'#fff5f5'};border:2px solid ${expTypeFilter==='expense'?'#b71c1c':'#f0a0a0'};border-radius:11px;padding:9px 6px;cursor:pointer;text-align:center;transition:all .15s;">
          <div style="font-size:.58rem;text-transform:uppercase;color:${expTypeFilter==='expense'?'#ffcdd2':'#e53935'};font-weight:800;letter-spacing:.04em;">Expense</div>
          <div style="font-size:.8rem;font-weight:900;color:${expTypeFilter==='expense'?'#fff':'#e53935'};font-family:'JetBrains Mono',monospace;margin-top:2px;">₹${fmt(totalExp)}</div>
        </div>
        <div onclick="APP.expTypeFilter='all';APP._finTransactions();"
          style="background:${balance>=0?'#f0faf4':'#fff8e1'};border:2px solid ${balance>=0?'#66bb6a':'#ffa726'};border-radius:11px;padding:9px 6px;cursor:pointer;text-align:center;transition:all .15s;">
          <div style="font-size:.58rem;text-transform:uppercase;color:${balance>=0?'#2e7d32':'#e65100'};font-weight:800;letter-spacing:.04em;">Balance</div>
          <div style="font-size:.8rem;font-weight:900;color:${balance>=0?'#1b5e20':'#e65100'};font-family:'JetBrains Mono',monospace;margin-top:2px;overflow:hidden;text-overflow:ellipsis;">₹${fmt(Math.abs(balance))}</div>
        </div>
        <div onclick="APP.expTypeFilter=(APP.expTypeFilter==='transfer'?'all':'transfer');APP._finTransactions();"
          style="background:${expTypeFilter==='transfer'?'#0d47a1':'#e8eeff'};border:2px solid ${expTypeFilter==='transfer'?'#0d47a1':'#90b8e8'};border-radius:11px;padding:9px 6px;cursor:pointer;text-align:center;transition:all .15s;">
          <div style="font-size:.58rem;text-transform:uppercase;color:${expTypeFilter==='transfer'?'#bbdefb':'#1565c0'};font-weight:800;letter-spacing:.04em;">Transfer</div>
          <div style="font-size:.8rem;font-weight:900;color:${expTypeFilter==='transfer'?'#fff':'#1565c0'};font-family:'JetBrains Mono',monospace;margin-top:2px;">₹${fmt(totalTrf)}</div>
        </div>
      </div>

      <!-- Transaction count + search pill -->
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:.7rem;color:var(--mut);font-weight:600;">${sorted.length} transaction${sorted.length!==1?'s':''}</span>
        ${expTypeFilter!=='all'?`<span style="font-size:.65rem;background:var(--dim);border:1px solid var(--bdr);border-radius:10px;padding:1px 7px;color:var(--mut);">${expTypeFilter}</span>`:''}
        ${expSearch?`<span style="font-size:.65rem;background:#ffe066;border-radius:10px;padding:1px 8px;color:#333;font-weight:700;cursor:pointer;" onclick="APP._finClearSearch()">🔍 "${expSearch}" ✕</span>`:''}
      </div>

      <!-- Transaction list -->
      <div style="border-radius:12px;overflow:hidden;border:1.5px solid var(--bdr);">${txHtml}</div>
    `;
  },

  // ═══════════ BUDGET ═══════════
  _finBudget(){
    const budgets=this.finBudgets;
    const allExp=this.expenses||[];
    const now=new Date();
    const curMon=now.toISOString().slice(0,7);
    const base=allExp.filter(e=>e.date&&e.date.startsWith(curMon)&&e.type==='expense');
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const totalBudget=budgets.reduce((s,b)=>s+Number(b.limit||0),0);
    const totalSpent=budgets.reduce((s,b)=>{
      const spent=base.filter(e=>(e.cat||'').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()===b.cat||(e.cat||'')===b.cat).reduce((ss,e)=>ss+Number(e.amount),0);
      return s+spent;
    },0);

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('budget')}
      <!-- Month header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:.78rem;font-weight:700;color:var(--txt);">🎯 Budget — ${this._finFmtMon(curMon)}</div>
        <button onclick="APP._openBudgetModal()" class="btn b-gold" style="font-size:.78rem;padding:6px 14px;border-radius:20px;">＋ Add Budget</button>
      </div>

      ${budgets.length?`<!-- Overall Progress -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:13px 14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:.78rem;font-weight:700;">Overall Budget</span>
          <span style="font-size:.72rem;color:var(--mut);">₹${fmt(totalSpent)} / ₹${fmt(totalBudget)}</span>
        </div>
        <div style="background:var(--dim);border-radius:6px;height:10px;overflow:hidden;margin-bottom:4px;">
          <div style="background:${totalSpent>totalBudget?'#ef4444':totalSpent/totalBudget>0.8?'#f59e0b':'#22c55e'};width:${totalBudget>0?Math.min(100,Math.round((totalSpent/totalBudget)*100)):0}%;height:100%;border-radius:6px;transition:width .3s;"></div>
        </div>
        <div style="font-size:.68rem;color:var(--mut);">Remaining: ₹${fmt(Math.max(0,totalBudget-totalSpent))}</div>
      </div>`:''}

      <!-- Per Category Budget cards -->
      ${budgets.length?budgets.map(b=>{
        const spent=base.filter(e=>(e.cat||'').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()===b.cat||(e.cat||'')===b.cat).reduce((s,e)=>s+Number(e.amount),0);
        const pct=b.limit>0?Math.min(100,Math.round((spent/b.limit)*100)):0;
        const rem=Math.max(0,b.limit-spent);
        const barCol=pct>=100?'#ef4444':pct>=80?'#f59e0b':'#22c55e';
        const bgCol=pct>=100?'#fff5f5':pct>=80?'#fffbee':'var(--card)';
        const bdCol=pct>=100?'#fca5a5':pct>=80?'#fcd34d':'var(--bdr)';
        return `<div style="background:${bgCol};border:1.5px solid ${bdCol};border-radius:12px;padding:13px 14px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <div style="font-size:.85rem;font-weight:700;">${b.cat}</div>
              <div style="font-size:.68rem;color:var(--mut);">₹${fmt(spent)} spent of ₹${fmt(b.limit)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-size:.72rem;font-weight:800;color:${pct>=100?'#ef4444':pct>=80?'#f59e0b':'#22c55e'};">${pct}%</span>
              <button onclick="APP._openBudgetModal('${b.id}')" style="background:none;border:1px solid var(--bdr2);border-radius:4px;padding:2px 5px;font-size:.6rem;cursor:pointer;color:var(--mut);">✏️</button>
              <button onclick="APP._delBudget('${b.id}')" style="background:none;border:1px solid rgba(229,57,53,.3);border-radius:4px;padding:2px 5px;font-size:.6rem;cursor:pointer;color:#e53935;">🗑</button>
            </div>
          </div>
          <div style="background:var(--dim);border-radius:5px;height:8px;overflow:hidden;margin-bottom:5px;">
            <div style="background:${barCol};width:${pct}%;height:100%;border-radius:5px;transition:width .3s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--mut);">
            <span>${pct>=100?'⚠️ Exceeded by ₹'+fmt(spent-b.limit):'Remaining: ₹'+fmt(rem)}</span>
            <span>Limit: ₹${fmt(b.limit)}</span>
          </div>
        </div>`;
      }).join(''):`<div style="text-align:center;padding:40px 20px;color:var(--mut);">
        <div style="font-size:2.5rem;margin-bottom:10px;">🎯</div>
        <div style="font-size:.9rem;margin-bottom:6px;">Koi budget set nahi hai</div>
        <div style="font-size:.78rem;">Category-wise monthly limits set karo</div>
      </div>`}
    `;
  },

  _openBudgetModal(id){
    const budgets=this.finBudgets;
    const b=id?budgets.find(x=>x.id===id):null;
    this._editBudgetId=id||null;
    const allExp=this.expenses||[];
    const cats=[...new Set(allExp.filter(e=>e.type==='expense').map(e=>(e.cat||'').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()||e.cat||'Other'))];
    const html=`<div class="overlay" id="finBudM" data-noclose="1"><div class="modal" style="max-width:400px;">
      <h2>${id?'✏️ Edit Budget':'🎯 Set Budget'}</h2>
      <div class="fgrid">
        <div class="full fg"><label>Category *</label>
          <input id="fbud_cat" value="${b?b.cat:''}" placeholder="e.g. Food, Transport, Utilities" list="fbud_cat_list" style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:8px 11px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.85rem;outline:none;width:100%;box-sizing:border-box;">
          <datalist id="fbud_cat_list">${cats.map(c=>`<option value="${c}">`).join('')}</datalist>
        </div>
        <div class="fg"><label>Monthly Limit (₹) *</label><input id="fbud_limit" type="number" value="${b?b.limit:''}" placeholder="e.g. 5000"></div>
        <div class="fg"><label>Alert at (%)</label>
          <select id="fbud_alert" style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:8px 11px;border-radius:7px;font-family:'Nunito',sans-serif;font-size:.85rem;outline:none;width:100%;">
            <option value="80" ${!b||b.alert==80?'selected':''}>80%</option>
            <option value="90" ${b&&b.alert==90?'selected':''}>90%</option>
            <option value="100" ${b&&b.alert==100?'selected':''}>100%</option>
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn b-out" onclick="M.close('finBudM')">Cancel</button>
        <button class="btn b-gold" onclick="APP._saveBudget()">💾 Save</button>
      </div>
    </div></div>`;
    const existing=document.getElementById('finBudM');
    if(existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend',html);
    M.open('finBudM');
  },

  _saveBudget(){
    const cat=document.getElementById('fbud_cat').value.trim();
    const limit=Number(document.getElementById('fbud_limit').value);
    if(!cat||!limit){alert('Category aur limit required!');return;}
    const data={cat,limit,alert:Number(document.getElementById('fbud_alert').value)||80};
    let budgets=this.finBudgets;
    if(this._editBudgetId){
      budgets=budgets.map(b=>b.id===this._editBudgetId?{...b,...data}:b);
    } else {
      data.id=uid(); budgets.push(data);
    }
    this.finBudgets=budgets;
    M.close('finBudM');
    this._finBudget();
    this.showToastMsg('✅ Budget saved!');
  },

  _delBudget(id){
    this.delCb=()=>{this.finBudgets=this.finBudgets.filter(b=>b.id!==id);this._finBudget();};
    document.getElementById('delMsg').textContent='Delete this budget?';
    M.open('delM');
  },

  // ═══════════ CHARTS ═══════════
  _finCharts(){
    const allExp=this.expenses||[];
    const now=new Date();
    const curMon=now.toISOString().slice(0,7);
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const base=allExp.filter(e=>e.date&&e.date.startsWith(curMon)&&e.type!=='loan'&&e.type!=='loan_taken');

    // Category pie data
    const catTotals={};
    base.filter(e=>e.type==='expense').forEach(e=>{
      const c=(e.cat||'Other').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()||'Other';
      catTotals[c]=(catTotals[c]||0)+Number(e.amount);
    });
    const catData=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
    const totalExp=catData.reduce((s,[,v])=>s+v,0);

    // Monthly 6-month trend
    const months6=[];
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const m=d.toISOString().slice(0,7);
      const mInc=allExp.filter(e=>e.date&&e.date.startsWith(m)&&e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
      const mExp=allExp.filter(e=>e.date&&e.date.startsWith(m)&&e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
      months6.push({m,label:d.toLocaleString('en-IN',{month:'short'}),inc:mInc,exp:mExp});
    }
    const maxVal=Math.max(...months6.map(x=>Math.max(x.inc,x.exp)),1);

    const COLORS=['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#06b6d4','#ec4899','#14b8a6'];

    // Pie chart SVG
    let pie='';
    let startAngle=-Math.PI/2;
    if(catData.length){
      catData.forEach(([cat,val],i)=>{
        const angle=(val/totalExp)*2*Math.PI;
        const endAngle=startAngle+angle;
        const x1=100+90*Math.cos(startAngle);
        const y1=100+90*Math.sin(startAngle);
        const x2=100+90*Math.cos(endAngle);
        const y2=100+90*Math.sin(endAngle);
        const largeArc=angle>Math.PI?1:0;
        pie+=`<path d="M100,100 L${x1.toFixed(1)},${y1.toFixed(1)} A90,90 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${COLORS[i%COLORS.length]}" opacity="0.9" stroke="var(--bg)" stroke-width="1.5"/>`;
        startAngle=endAngle;
      });
    } else {
      pie='<circle cx="100" cy="100" r="90" fill="var(--dim)"/><text x="100" y="105" text-anchor="middle" fill="var(--mut)" font-size="12" font-family="Nunito,sans-serif">No data</text>';
    }

    // Bar chart SVG
    const barW=52, barGap=14, chartH=120, startX=30;
    let bars='';
    months6.forEach((mo,i)=>{
      const x=startX+i*(barW+barGap);
      const incH=mo.inc>0?Math.round((mo.inc/maxVal)*chartH):0;
      const expH=mo.exp>0?Math.round((mo.exp/maxVal)*chartH):0;
      bars+=`<rect x="${x}" y="${chartH-incH+10}" width="${barW*0.45}" height="${incH}" fill="#22c55e" opacity="0.85" rx="2"/>`;
      bars+=`<rect x="${x+barW*0.5}" y="${chartH-expH+10}" width="${barW*0.45}" height="${expH}" fill="#ef4444" opacity="0.85" rx="2"/>`;
      bars+=`<text x="${x+barW/2}" y="${chartH+26}" text-anchor="middle" fill="var(--color-text-secondary,#888)" font-size="11" font-family="Nunito,sans-serif">${mo.label}</text>`;
    });

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('charts')}
      <div style="font-size:.78rem;font-weight:700;color:var(--txt);margin-bottom:10px;">📊 ${this._finFmtMon(curMon)} — Expense Breakdown</div>

      <!-- Pie chart -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;padding:14px;margin-bottom:14px;">
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
          <svg width="200" height="200" viewBox="0 0 200 200" style="flex-shrink:0;">${pie}</svg>
          <div style="flex:1;min-width:140px;">
            ${catData.slice(0,7).map(([cat,val],i)=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <div style="width:10px;height:10px;border-radius:2px;background:${COLORS[i%COLORS.length]};flex-shrink:0;"></div>
              <div style="font-size:.72rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat}</div>
              <div style="font-size:.68rem;color:var(--mut);font-family:'JetBrains Mono',monospace;">₹${fmt(val)}</div>
            </div>`).join('')}
            ${catData.length>7?`<div style="font-size:.65rem;color:var(--mut);">+${catData.length-7} more</div>`:''}
          </div>
        </div>
      </div>

      <!-- Monthly trend bar chart -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;padding:14px;">
        <div style="font-size:.78rem;font-weight:700;margin-bottom:10px;">📈 6-Month Trend</div>
        <div style="display:flex;gap:8px;font-size:.65rem;margin-bottom:6px;">
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;background:#22c55e;border-radius:2px;display:inline-block;"></span>Income</span>
          <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;background:#ef4444;border-radius:2px;display:inline-block;"></span>Expense</span>
        </div>
        <svg width="100%" viewBox="0 0 ${startX*2+6*(barW+barGap)-barGap} ${chartH+40}" style="overflow:visible;">
          <line x1="${startX}" y1="10" x2="${startX}" y2="${chartH+10}" stroke="var(--bdr)" stroke-width="0.5"/>
          <line x1="${startX}" y1="${chartH+10}" x2="${startX*2+6*(barW+barGap)-barGap}" y2="${chartH+10}" stroke="var(--bdr)" stroke-width="0.5"/>
          ${bars}
        </svg>
        <!-- Monthly summary -->
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:10px;border-top:1px solid var(--bdr);padding-top:8px;">
          ${months6.map(mo=>`<div style="display:flex;justify-content:space-between;font-size:.7rem;">
            <span style="color:var(--mut);min-width:40px;">${mo.label}</span>
            <span style="color:#22c55e;">+₹${fmt(mo.inc)}</span>
            <span style="color:#ef4444;">-₹${fmt(mo.exp)}</span>
            <span style="color:${mo.inc-mo.exp>=0?'#22c55e':'#ef4444'};font-weight:700;">₹${fmt(Math.abs(mo.inc-mo.exp))}</span>
          </div>`).join('')}
        </div>
      </div>
    `;
  },

  // ═══════════ REPORTS ═══════════
  _finReports(){
    const allExp=this.expenses||[];
    const now=new Date();
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const yr=now.getFullYear();

    // Date filter (From-To, same as Khata Book style)
    const repFrom = this._repFrom || '';
    const repTo   = this._repTo   || '';

    // Yearly summary (always full year)
    const yearData=[];
    for(let m=0;m<12;m++){
      const mStr=yr+'-'+String(m+1).padStart(2,'0');
      const base=allExp.filter(e=>e.date&&e.date.startsWith(mStr)&&e.type!=='loan'&&e.type!=='loan_taken');
      const inc=base.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
      const exp=base.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
      yearData.push({m:mStr,label:new Date(yr,m,1).toLocaleString('en-IN',{month:'short'}),inc,exp,bal:inc-exp});
    }
    const yrInc=yearData.reduce((s,x)=>s+x.inc,0);
    const yrExp=yearData.reduce((s,x)=>s+x.exp,0);
    const yrBal=yrInc-yrExp;

    // Filtered transactions for detail list
    let filtered = allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(repFrom) filtered=filtered.filter(e=>e.date&&e.date>=repFrom);
    if(repTo)   filtered=filtered.filter(e=>e.date&&e.date<=repTo);
    const sorted=[...filtered].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

    const filtInc=filtered.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
    const filtExp=filtered.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
    const filtBal=filtInc-filtExp;
    const periodLabel=repFrom||repTo?((repFrom||'Start')+' to '+(repTo||'Today')):'All Time';

    // Top categories (filtered)
    const catAll={};
    filtered.filter(e=>e.type==='expense').forEach(e=>{
      const c=(e.cat||'Other').replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()||'Other';
      catAll[c]=(catAll[c]||0)+Number(e.amount);
    });
    const topCatsAll=Object.entries(catAll).sort((a,b)=>b[1]-a[1]).slice(0,8);

    // Build detail transaction rows (grouped by date)
    const typeColor={expense:'#e53935',income:'#2e7d32',transfer:'#1565c0'};
    const typeBg={expense:'rgba(229,57,53,.08)',income:'rgba(46,125,50,.08)',transfer:'rgba(21,101,192,.08)'};
    const grouped={};
    sorted.forEach(e=>{const dk=e.date||'Unknown';if(!grouped[dk])grouped[dk]=[];grouped[dk].push(e);});

    let txHtml='';
    if(!sorted.length){
      txHtml=`<div style="text-align:center;padding:40px 20px;color:var(--mut);">
        <div style="font-size:2.5rem;margin-bottom:10px;">📋</div>
        <div style="font-size:.9rem;font-weight:700;">No transactions found</div>
      </div>`;
    } else {
      Object.keys(grouped).sort().reverse().forEach(dk=>{
        const dayExp=grouped[dk];
        const dayDate=dk!=='Unknown'?new Date(dk):null;
        const dayLabel=dayDate?(()=>{const _w=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];return _w[dayDate.getDay()]+', '+String(dayDate.getDate()).padStart(2,'0')+'/'+String(dayDate.getMonth()+1).padStart(2,'0')+'/'+String(dayDate.getFullYear());})():'Unknown Date';
        const dayNet=dayExp.reduce((s,e)=>e.type==='income'?s+Number(e.amount):e.type==='expense'?s-Number(e.amount):s,0);
        txHtml+=`<div style="margin-bottom:1px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 14px;background:var(--dim);border-radius:8px 8px 0 0;">
            <span style="font-size:.7rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;">${dayLabel}</span>
            <span style="font-size:.72rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${dayNet>=0?'#2e7d32':'#e53935'};">${dayNet>=0?'+':'−'}₹${fmt(Math.abs(dayNet))}</span>
          </div>`;
        dayExp.forEach(e=>{
          const raw=e.cat||'—';
          const cleanCat=raw.replace(/^[^\w\u0900-\u097F\u00C0-\u024F]+/,'').trim()||raw;
          const isTransfer=e.type==='transfer';
          const mainLabel=isTransfer?(e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:(e.account||cleanCat||'Transfer')):cleanCat;
          const modeText=e.paymode||'Cash';
          const accText=isTransfer?(e.fromAcc&&e.toAcc?`₹${fmt(Number(e.amount))} transferred`:(e.account||'')):(e.account||'');
          const typeIcon=isTransfer?'🔄':e.type==='income'?'💰':'💸';
          const amtColor=e.type==='expense'?'#e53935':e.type==='income'?'#2e7d32':'#1565c0';
          const amtPrefix=e.type==='expense'?'− ₹':e.type==='income'?'+ ₹':'⇄ ₹';
          txHtml+=`<div style="display:flex;align-items:flex-start;gap:11px;padding:11px 14px;background:var(--card);border-bottom:1px solid var(--bdr);"
            onmouseover="this.style.background='var(--dim)'" onmouseout="this.style.background='var(--card)'">
            <div style="width:36px;height:36px;border-radius:50%;background:${typeBg[e.type]||'var(--dim)'};display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;margin-top:1px;">${typeIcon}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:.84rem;font-weight:700;color:var(--txt);margin-bottom:2px;">${mainLabel}</div>
              <div style="font-size:.68rem;color:var(--mut);">${modeText}${accText?' · '+accText:''}</div>
              ${e.note?`<div style="font-size:.68rem;color:var(--mut);margin-top:2px;word-break:break-word;">${e.note}</div>`:''}
            </div>
            <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
              <div style="font-size:.9rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:${amtColor};white-space:nowrap;">${amtPrefix}${fmt(Number(e.amount))}</div>
              <div style="display:flex;gap:4px;">
                <button style="background:none;border:1.5px solid var(--bdr2);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:var(--mut);" onclick="APP.openExpModal('${e.id}')">✏️</button>
                <button style="background:none;border:1.5px solid rgba(229,57,53,.3);border-radius:5px;padding:3px 8px;font-size:.62rem;cursor:pointer;color:#e53935;" onclick="APP.delExpense('${e.id}')">🗑</button>
              </div>
            </div>
          </div>`;
        });
        txHtml+=`<div style="height:4px;background:var(--bg);"></div></div>`;
      });
    }

    document.getElementById('pan-expense').innerHTML = `
      ${this._finHeader('reports')}

      <!-- Download buttons -->
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <button onclick="APP._downloadFinancePDF()" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#e53935;color:#e53935;">📄 Download PDF</button>${APP._pdfOriHtml()}
        <button onclick="APP._downloadFinanceWord()" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#1565c0;color:#1565c0;">📝 Download Word</button>
        <button onclick="APP._downloadFinanceCSV()" class="btn b-out" style="flex:1;font-size:.78rem;padding:8px 10px;border-color:#2e7d32;color:#2e7d32;">📊 Download CSV</button>
      </div>



      <!-- Transaction Details — with date filter -->
      <div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;overflow:hidden;margin-bottom:14px;">
        <!-- Header + filter -->
        <div style="background:var(--card2);padding:10px 14px;border-bottom:1px solid var(--bdr);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div style="font-size:.82rem;font-weight:800;">📋 Transaction Details
              <span style="background:var(--acc);color:#fff;padding:1px 8px;border-radius:10px;font-size:.65rem;margin-left:4px;">${sorted.length}</span>
            </div>
            <div style="display:flex;gap:8px;font-size:.76rem;">
              <span style="color:#2e7d32;font-weight:700;">In: ₹${fmt(filtInc)}</span>
              <span style="color:#e53935;font-weight:700;">Out: ₹${fmt(filtExp)}</span>
              <span style="color:${filtBal>=0?'#2e7d32':'#e53935'};font-weight:800;">Bal: ${filtBal>=0?'+':'−'}₹${fmt(Math.abs(filtBal))}</span>
            </div>
          </div>
          <!-- Date filter — same Khata Book style -->
          <div class="date-filter-bar__tools">
            ${renderCompactDateRangeFilter({
              label:'Date',
              fromId:'dfh_rrf',
              toId:'dfh_rrt',
              fromValue:repFrom,
              toValue:repTo,
              fromOnChange:"APP._repFrom=this.value;APP._finReports()",
              toOnChange:"APP._repTo=this.value;APP._finReports()",
              clearOnClick:"APP._repFrom='';APP._repTo='';APP._finReports()",
              meta:periodLabel,
              className:'date-filter-inline--tight'
            })}
          </div>
        </div>
        <!-- Transaction rows -->
        ${txHtml}
        <!-- Add button footer -->
        <div style="padding:9px 14px;border-top:1px solid var(--bdr);background:var(--card2);">
          <button class="btn b-grn b-sm" onclick="APP.openExpModal()">➕ Add Transaction</button>
        </div>
      </div>

      <!-- Top Categories -->
      ${topCatsAll.length?`<div style="background:var(--card);border:1px solid var(--bdr);border-radius:13px;padding:14px;margin-bottom:14px;">
        <div style="font-size:.78rem;font-weight:800;margin-bottom:10px;">📊 Top Expense Categories — ${periodLabel}</div>
        ${topCatsAll.map(([cat,amt])=>{
          const pct=filtExp>0?Math.round((amt/filtExp)*100):0;
          return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
            <div style="font-size:.72rem;min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat}</div>
            <div style="flex:1;background:var(--dim);border-radius:3px;height:6px;overflow:hidden;">
              <div style="background:var(--acc);width:${pct}%;height:100%;border-radius:3px;"></div>
            </div>
            <div style="font-size:.68rem;color:var(--mut);min-width:90px;text-align:right;">₹${fmt(amt)} (${pct}%)</div>
          </div>`;
        }).join('')}
      </div>`:''}
    `;
  },

  // ── Finance search helpers ──
  _finToggleSearch(){
    const row=document.getElementById('fin_search_row');
    const inp=document.getElementById('exm_search_inp');
    if(!row) return;
    const isVisible=row.style.display!=='none';
    if(isVisible){
      // If search active, clear it; else hide
      if(this.expSearch){this._finClearSearch();return;}
      row.style.display='none';
    } else {
      row.style.display='flex';
      setTimeout(()=>{if(inp)inp.focus();},50);
    }
  },

  _finSearchInput(val){
    // Directly update without re-render — keep focus
    this.expSearch=val;
    clearTimeout(this._expSrchT);
    this._expSrchT=setTimeout(()=>{
      const curVal=val;
      this._finTransactions();
      // Restore focus after re-render
      requestAnimationFrame(()=>{
        const s=document.getElementById('exm_search_inp');
        if(s){s.value=curVal;s.focus();s.setSelectionRange(curVal.length,curVal.length);}
        // Show/expand search bar
        const row=document.getElementById('fin_search_row');
        if(row) row.style.display='flex';
      });
    },150);
  },

  _finClearSearch(){
    this.expSearch='';
    const row=document.getElementById('fin_search_row');
    if(row) row.style.display='none';
    this._finTransactions();
  },

  // Highlight matching text in transaction rows
  _finHighlight(text,query){
    if(!query||!text) return text||'';
    const safe=String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    try{
      const esc=query.replace(/[-[\]/{}()*+?.\\^$|]/g,'\\$&');
      return safe.replace(new RegExp('('+esc+')','gi'),
        '<mark style="background:#ffe066;color:#333;border-radius:2px;padding:0 1px;">$1</mark>');
    }catch(e){return safe;}
  },

  // ── Overview helpers ──
  _ovFilterChange(val){
    if(val==='custom'){
      const from=prompt('From date (YYYY-MM-DD):',new Date().toISOString().slice(0,8)+'01');
      if(!from){document.getElementById('ov_filter_sel').value=this.ovFilter||'thisMonth';return;}
      const to=prompt('To date (YYYY-MM-DD):',new Date().toISOString().slice(0,10));
      if(!to){document.getElementById('ov_filter_sel').value=this.ovFilter||'thisMonth';return;}
      this.ovCustomFrom=from.trim();
      this.ovCustomTo=to.trim();
    }
    this.ovFilter=val;
    this._finOverview();
  },

  _ovToggleSearch(){
    const row=document.getElementById('ov_search_row');
    const inp=document.getElementById('ov_search_inp');
    if(!row) return;
    if(row.style.display!=='none'&&!(this.ovSearch)){
      row.style.display='none';
    } else {
      row.style.display='flex';
      setTimeout(()=>{if(inp)inp.focus();},60);
    }
  },

  _ovSearchInput(val){
    this.ovSearch=val;
    clearTimeout(this._ovSrchT);
    this._ovSrchT=setTimeout(()=>{
      const cur=val;
      this._finOverview();
      requestAnimationFrame(()=>{
        const s=document.getElementById('ov_search_inp');
        if(s){s.value=cur;s.focus();s.setSelectionRange(cur.length,cur.length);}
        const r=document.getElementById('ov_search_row');
        if(r) r.style.display='flex';
      });
    },150);
  },

  _ovClearSearch(){
    this.ovSearch='';
    const row=document.getElementById('ov_search_row');
    if(row) row.style.display='none';
    this._finOverview();
  },

  // ── Transaction Preview Modal ──
  _finPreview(id){
    const e=(this.expenses||[]).find(x=>x.id===id);
    if(!e) return;
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const fDL=fD;
    const raw=e.cat||'—';
    const cleanCat=raw.replace(/^[^\wऀ-ॿÀ-ɏ]+/,'').trim()||raw;
    const isTransfer=e.type==='transfer';
    const typeCol  =e.type==='income'?'#2e7d32':e.type==='expense'?'#e53935':'#1565c0';
    const typeLbl  =e.type==='income'?'💰 Income':e.type==='expense'?'💸 Expense':'🔄 Transfer';
    const amtPfx   =e.type==='expense'?'−':e.type==='transfer'?'⇄':'+';
    const accLine  =isTransfer&&e.fromAcc&&e.toAcc?e.fromAcc+' → '+e.toAcc:(e.account||'—');

    const filesHtml=(e.files&&e.files.length)?`
      <div style="margin-top:12px;">
        <div style="font-size:.6rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:6px;">📎 Attachments</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;">
          ${e.files.map(f=>{
            const isImg=f.type&&f.type.startsWith('image/');
            const ext=(f.name||'').split('.').pop().toUpperCase();
            const extIco={'PDF':'📄','DOC':'📝','DOCX':'📝','XLS':'📊','XLSX':'📊'}[ext]||'📎';
            return isImg
              ? `<img src="${f.dataUrl||f.url||''}" style="height:60px;width:60px;object-fit:cover;border-radius:8px;cursor:pointer;border:1.5px solid var(--bdr);" onclick="window.open('${f.dataUrl||f.url||''}','_blank')" title="${f.name||''}">`
              : `<span style="font-size:2rem;cursor:pointer;" title="${f.name||''}">${extIco}</span>`;
          }).join('')}
        </div>
      </div>`:'';

    const existing=document.getElementById('finPreviewM');
    if(existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend',`
      <div id="finPreviewM"
        style="position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:700;display:flex;align-items:flex-end;justify-content:center;padding:0;animation:fpFadeIn .18s ease;"
        onclick="if(event.target===this)this.remove()">
        <div style="background:var(--card);border-radius:18px 18px 0 0;width:100%;max-width:480px;box-shadow:0 -4px 30px rgba(0,0,0,.2);animation:fpSlideUp .22s ease;overflow:hidden;">
          <!-- Colour header -->
          <div style="background:${typeCol};padding:16px 18px 14px;display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:.62rem;color:rgba(255,255,255,.78);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">${typeLbl}</div>
              <div style="font-size:1.7rem;font-weight:900;color:#fff;font-family:'JetBrains Mono',monospace;">${amtPfx}₹${fmt(Number(e.amount))}</div>
            </div>
            <button onclick="document.getElementById('finPreviewM').remove()"
              style="background:rgba(255,255,255,.2);border:none;border-radius:50%;width:30px;height:30px;color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
          </div>
          <!-- Details -->
          <div style="padding:16px 18px 20px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:3px;">Category</div>
                <div style="font-size:.9rem;font-weight:700;">${cleanCat}</div>
              </div>
              <div>
                <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:3px;">Date</div>
                <div style="font-size:.9rem;font-weight:700;">${fDL(e.date)}</div>
              </div>
              <div>
                <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:3px;">${isTransfer?'From → To':'Account'}</div>
                <div style="font-size:.86rem;font-weight:600;">${accLine}</div>
              </div>
              <div>
                <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:3px;">Payment Mode</div>
                <div style="font-size:.86rem;font-weight:600;">${e.paymode||'Cash'}</div>
              </div>
            </div>
            ${e.note?`<div style="margin-bottom:10px;">
              <div style="font-size:.58rem;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:4px;">Note</div>
              <div style="font-size:.86rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;">${e.note}</div>
            </div>`:''}
            ${filesHtml}
            <!-- Actions -->
            <div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--bdr);">
              <button onclick="APP.openExpModal('${e.id}');document.getElementById('finPreviewM').remove();"
                class="btn b-out" style="flex:1;padding:9px;">✏️ Edit</button>
              <button onclick="APP.delExpense('${e.id}');document.getElementById('finPreviewM').remove();"
                class="btn b-red" style="flex:1;padding:9px;">🗑 Delete</button>
            </div>
          </div>
        </div>
      </div>`);
  },

  // ── Finance Export functions ──
  _downloadFinancePDF(){
    const allExp=this.expenses||[];
    const now=new Date();
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const fDLocal=fD;
    const repFrom=this._repFrom||'';
    const repTo=this._repTo||'';
    let data=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(repFrom) data=data.filter(e=>e.date&&e.date>=repFrom);
    if(repTo)   data=data.filter(e=>e.date&&e.date<=repTo);
    data=data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const totalInc=data.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
    const totalExp=data.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
    const bal=totalInc-totalExp;
    const periodLabel=repFrom||repTo?((repFrom||'Start')+' to '+(repTo||'Today')):'All Time';

    const rows=data.map((e,i)=>{
      const cat=(e.cat||'—').replace(/^[^\wऀ-ॿ]+/,'').trim()||e.cat||'—';
      const isInc=e.type==='income';
      const isExp=e.type==='expense';
      const col=isExp?'#c0392b':isInc?'#1a7a45':'#1565c0';
      return `<tr style="background:${i%2===0?'#fff':'#f8faff'}">
        <td style="padding:7px 10px;border:1px solid #e2e8f0;white-space:nowrap;">${fDLocal(e.date)}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;color:${col};font-weight:700;">${e.type.toUpperCase()}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;">${cat}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:right;font-family:monospace;color:${col};font-weight:700;">${isExp?'−':'+'}₹${fmt(Number(e.amount))}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;">${e.account||'—'}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;">${e.paymode||'Cash'}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;">${e.note||''}</td>
      </tr>`;
    }).join('');

    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Finance Report — Raman Kumar</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;font-size:13px;color:#1a1d23;background:#fffdf7;padding:16mm 14mm;}
      .header{background:linear-gradient(135deg,#dbeafe,#eff6ff);border:1.5px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:16px;text-align:center;}
      .header h1{font-size:22px;font-weight:900;color:#1e3a5f;margin-bottom:4px;}
      .header .sub{font-size:12px;color:#3a6fa0;}
      .summary{display:flex;border:1.5px solid #bfdbfe;border-radius:8px;overflow:hidden;margin-bottom:16px;}
      .sc{flex:1;padding:12px 14px;text-align:center;border-right:1px solid #bfdbfe;}
      .sc:last-child{border-right:none;}
      .sc-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:5px;}
      .sc-val{font-size:18px;font-weight:900;}
      .info{font-size:11px;color:#888;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #bfdbfe;}
      table{width:100%;border-collapse:collapse;border:1.5px solid #bfdbfe;}
      thead tr{background:#2c6fad;}
      th{padding:10px;font-size:11px;font-weight:800;color:#fff;text-align:left;border:1px solid rgba(255,255,255,.2);text-transform:uppercase;}
      tfoot td{background:#dbeafe;font-weight:800;font-size:13px;color:#1e3a5f;border:1px solid #bfdbfe;}
      @media print{body{padding:0;background:#fff;}@page{margin:16mm 14mm;size:A4 landscape;}}
    </style></head><body>
    <div class="header">
      <div style="font-size:24px;margin-bottom:6px;">💰</div>
      <h1>Finance Report — Raman Kumar</h1>
      <div class="sub">${periodLabel} &nbsp;|&nbsp; Generated: ${fDLocal(now.toISOString().slice(0,10))}</div>
    </div>
    <div class="summary">
      <div class="sc" style="background:#f0fdf4;border-left:4px solid #1a7a45;"><div class="sc-lbl" style="color:#1a7a45;">Total Income</div><div class="sc-val" style="color:#1a7a45;">₹${fmt(totalInc)}</div></div>
      <div class="sc" style="background:#fff0f0;border-left:4px solid #c0392b;"><div class="sc-lbl" style="color:#c0392b;">Total Expense</div><div class="sc-val" style="color:#c0392b;">₹${fmt(totalExp)}</div></div>
      <div class="sc" style="background:#eff6ff;border-left:4px solid #2c6fad;"><div class="sc-lbl" style="color:#2c6fad;">Balance</div><div class="sc-val" style="color:${bal>=0?'#1a7a45':'#c0392b'};">${bal>=0?'+':'−'}₹${fmt(Math.abs(bal))}</div></div>
      <div class="sc" style="background:#f8f9fa;"><div class="sc-lbl" style="color:#6c757d;">Entries</div><div class="sc-val" style="color:#1a1d23;">${data.length}</div></div>
    </div>
    <p class="info">Transactions: ${data.length} &nbsp;|&nbsp; Period: ${periodLabel}</p>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Category</th><th style="text-align:right;">Amount</th><th>Account</th><th>Mode</th><th>Note</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="7" style="text-align:center;padding:20px;color:#999;">No transactions</td></tr>'}</tbody>
      <tfoot><tr>
        <td colspan="3" style="padding:9px 10px;">Grand Total</td>
        <td style="padding:9px 10px;text-align:right;font-family:monospace;color:${bal>=0?'#1a7a45':'#c0392b'};">${bal>=0?'+':'−'}₹${fmt(Math.abs(bal))}</td>
        <td colspan="3" style="padding:9px 10px;">In: ₹${fmt(totalInc)} &nbsp; Out: ₹${fmt(totalExp)}</td>
      </tr></tfoot>
    </table>
    </body></html>`;

    const finRows = data.map(e=>{
      const cat=(e.cat||'—').replace(/^[^\w\u0900-\u097F]+/,'').trim()||e.cat||'—';
      const isExp=e.type==='expense', isInc=e.type==='income';
      return [fDLocal(e.date), e.type.toUpperCase(), cat, (isExp?'-':isInc?'+':'=')+'Rs.'+fmt(Number(e.amount)), e.account||'—', e.paymode||'Cash', e.note||''];
    });
    _makePDF({
      filename: 'Finance_Report_RamanKumar_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: 'Finance Report - Raman Kumar',
      subtitle: periodLabel + ' | Generated: '+fDLocal(new Date().toISOString().slice(0,10)),
      summaryRows: [
        ['Total Income', 'Rs.'+fmt(totalInc), [26,122,69]],
        ['Total Expense', 'Rs.'+fmt(totalExp), [192,57,43]],
        ['Balance', (bal>=0?'+':'-')+'Rs.'+fmt(Math.abs(bal)), bal>=0?[26,122,69]:[192,57,43]],
        ['Entries', String(data.length), [44,111,173]],
      ],
      entriesLabel: 'Transactions: '+data.length+' | Period: '+periodLabel,
      columns: ['Date','Type','Category','Amount','Account','Mode','Note'],
      rows: finRows,
      totalsRow: ['Grand Total','','', (bal>=0?'+':'-')+'Rs.'+fmt(Math.abs(bal)),'In:Rs.'+fmt(totalInc),'Out:Rs.'+fmt(totalExp),''],
      colStyles: {3:{halign:'right',fontStyle:'bold'}, 0:{cellWidth:20}},
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  _downloadFinanceCSV(){
    const allExp=this.expenses||[];
    const fDLocal=fD;
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const repFrom=this._repFrom||'';
    const repTo=this._repTo||'';
    let data=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(repFrom) data=data.filter(e=>e.date&&e.date>=repFrom);
    if(repTo)   data=data.filter(e=>e.date&&e.date<=repTo);
    data=data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const rows=[['Date','Type','Category','Amount','Account','Mode','Note']];
    data.forEach(e=>{
      const cat=(e.cat||'').replace(/^[^\wऀ-ॿ]+/,'').trim()||e.cat||'';
      rows.push([
        fDLocal(e.date),
        e.type,
        cat,
        e.type==='expense'?'-'+e.amount:'+'+e.amount,
        e.account||'',
        e.paymode||'Cash',
        (e.note||'').replace(/,/g,' ')
      ]);
    });
    const csv=rows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='Finance_Report_RamanKumar_'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a);
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ CSV downloaded! Open in Excel.');
  },

  _downloadFinanceWord(){
    const allExp=this.expenses||[];
    const now=new Date();
    const fmt=window.fmt||(n=>n.toLocaleString('en-IN'));
    const fDLocal=fD;
    const repFrom=this._repFrom||'';
    const repTo=this._repTo||'';
    let data=allExp.filter(e=>e.type!=='loan'&&e.type!=='loan_taken');
    if(repFrom) data=data.filter(e=>e.date&&e.date>=repFrom);
    if(repTo)   data=data.filter(e=>e.date&&e.date<=repTo);
    data=data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const totalInc=data.filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount),0);
    const totalExp=data.filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount),0);
    const bal=totalInc-totalExp;
    const periodLabel=repFrom||repTo?((repFrom||'Start')+' to '+(repTo||'Today')):'All Time';

    const rows=data.map((e,i)=>{
      const cat=(e.cat||'—').replace(/^[^\wऀ-ॿ]+/,'').trim()||e.cat||'—';
      const isExp=e.type==='expense';
      const isInc=e.type==='income';
      const col=isExp?'#C62828':isInc?'#1A7A45':'#1565C0';
      const bg=i%2===0?'#FFFFFF':'#F8FAFF';
      return `<w:tr>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:rPr><w:sz><w:szCs/></w:sz></w:rPr><w:t>${fDLocal(e.date)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="${col.slice(1)}"/></w:rPr><w:t>${e.type.toUpperCase()}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:t>${cat}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/><w:jc w:val="right"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${col.slice(1)}"/></w:rPr><w:t>${isExp?'-':'+'}Rs.${fmt(Number(e.amount))}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:t>${e.account||'—'}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:t>${e.paymode||'Cash'}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="BFDBFE"/><w:left w:val="single" w:sz="4" w:color="BFDBFE"/><w:bottom w:val="single" w:sz="4" w:color="BFDBFE"/><w:right w:val="single" w:sz="4" w:color="BFDBFE"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${bg.slice(1)}"/></w:tcPr><w:p><w:r><w:t>${(e.note||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</w:t></w:r></w:p></w:tc>
      </w:tr>`;
    }).join('');

    const thStyle=`<w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="1E3A5F"/><w:left w:val="single" w:sz="4" w:color="1E3A5F"/><w:bottom w:val="single" w:sz="4" w:color="1E3A5F"/><w:right w:val="single" w:sz="4" w:color="1E3A5F"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="2C6FAD"/></w:tcPr>`;
    const th=(t)=>`<w:tc>${thStyle}<w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>${t}</w:t></w:r></w:p></w:tc>`;

    const docXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"
  xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  w:macrosPresent="no" w:embeddedObjPresent="no" w:ocxPresent="no">
<w:body>

  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:b/><w:color w:val="1E3A5F"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr><w:t>Finance Report — Raman Kumar</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:color w:val="3A6FA0"/><w:sz w:val="22"/></w:rPr><w:t>${periodLabel} | Generated: ${fDLocal(now.toISOString().slice(0,10))}</w:t></w:r>
  </w:p>
  <w:p><w:r><w:t> </w:t></w:r></w:p>

  <w:tbl>
    <w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:insideH w:val="single" w:sz="4" w:color="BFDBFE"/><w:insideV w:val="single" w:sz="4" w:color="BFDBFE"/></w:tblBorders></w:tblPr>
    <w:tr>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="1A7A45"/><w:left w:val="single" w:sz="6" w:color="1A7A45"/><w:bottom w:val="single" w:sz="6" w:color="1A7A45"/><w:right w:val="single" w:sz="6" w:color="1A7A45"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="F0FDF4"/></w:tcPr>
        <w:p><w:r><w:rPr><w:color w:val="1A7A45"/><w:sz w:val="18"/></w:rPr><w:t>Total Income</w:t></w:r></w:p>
        <w:p><w:r><w:rPr><w:b/><w:color w:val="1A7A45"/><w:sz w:val="28"/></w:rPr><w:t>Rs.${fmt(totalInc)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="C0392B"/><w:left w:val="single" w:sz="6" w:color="C0392B"/><w:bottom w:val="single" w:sz="6" w:color="C0392B"/><w:right w:val="single" w:sz="6" w:color="C0392B"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="FFF0F0"/></w:tcPr>
        <w:p><w:r><w:rPr><w:color w:val="C0392B"/><w:sz w:val="18"/></w:rPr><w:t>Total Expense</w:t></w:r></w:p>
        <w:p><w:r><w:rPr><w:b/><w:color w:val="C0392B"/><w:sz w:val="28"/></w:rPr><w:t>Rs.${fmt(totalExp)}</w:t></w:r></w:p>
      </w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/><w:left w:val="single" w:sz="6" w:color="2C6FAD"/><w:bottom w:val="single" w:sz="6" w:color="2C6FAD"/><w:right w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="EFF6FF"/></w:tcPr>
        <w:p><w:r><w:rPr><w:color w:val="2C6FAD"/><w:sz w:val="18"/></w:rPr><w:t>Balance</w:t></w:r></w:p>
        <w:p><w:r><w:rPr><w:b/><w:color w:val="${bal>=0?'1A7A45':'C0392B'}"/><w:sz w:val="28"/></w:rPr><w:t>${bal>=0?'+':'-'}Rs.${fmt(Math.abs(bal))}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  </w:tbl>
  <w:p><w:r><w:t> </w:t></w:r></w:p>

  <w:tbl>
    <w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>
    <w:tr>${th('Date')}${th('Type')}${th('Category')}${th('Amount')}${th('Account')}${th('Mode')}${th('Note')}</w:tr>
    ${rows}
    <w:tr>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="1E3A5F"/></w:rPr><w:t>Grand Total</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:t> </w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:t> </w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/><w:jc w:val="right"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${bal>=0?'1A7A45':'C0392B'}"/></w:rPr><w:t>${bal>=0?'+':'-'}Rs.${fmt(Math.abs(bal))}</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:rPr><w:color w:val="1E3A5F"/></w:rPr><w:t>In:Rs.${fmt(totalInc)}</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:rPr><w:color w:val="C0392B"/></w:rPr><w:t>Out:Rs.${fmt(totalExp)}</w:t></w:r></w:p></w:tc>
      <w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="6" w:color="2C6FAD"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="DBEAFE"/></w:tcPr><w:p><w:r><w:t>${data.length} entries</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl>

</w:body>
</w:wordDocument>`;

    const blob=new Blob([docXml],{type:'application/msword'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='Finance_Report_RamanKumar_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(a);
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ Word document downloaded!');
  },

  // ══ LEDGER DOWNLOAD FUNCTIONS (PDF / Word / CSV) ══
  _getLedgerData(tenantId){
    const MONTHS_L=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const fDL=fD;
    const now=new Date();
    const isSingle=tenantId&&tenantId!=='all';
    const tenants=isSingle?[this.tenants.find(t=>t.id===tenantId)].filter(Boolean):this.tenants;

    const rows=[];
    const _toLocalIso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

    tenants.forEach(t=>{
      if(!t) return;
      const prop=this.props.find(p=>p.id===t.propId);
      const ledger=this.getTenantLedger(t);

      // Track which payment IDs have been included via ledger months
      const includedPayIds = new Set();

      // Include ALL months that are either:
      //   (a) charged (invoice generated) — normal case
      //   (b) NOT charged but have payments — advance payments for upcoming months
      const moToShow = ledger.months.filter(mo => mo.charged || mo.payments.length > 0);

      moToShow.forEach(mo=>{
        const mLabel=MONTHS_L[mo.month]+' '+mo.year;
        const _iD=mo.invoiceDate, _dD=mo.dueDate;
        const invoiceLbl=fDL(_toLocalIso(_iD));
        const dueLbl=fDL(_toLocalIso(_dD));
        // charged amount: 0 if invoice not yet generated (upcoming advance)
        const chargedAmt = mo.charged ? mo.monthlyTotal : 0;

        if(mo.payments.length===0){
          // Only show empty rows for charged months (not upcoming)
          if(mo.charged){
            rows.push({tenant:t.name,property:prop?prop.name:'—',rentMonth:mLabel,payDate:'—',charged:chargedAmt,amount:0,mode:'—',note:'—',timing:'—',status:mo.status,balance:mo.runningBalance,invoiceDate:invoiceLbl,dueDate:dueLbl});
          }
        } else {
          mo.payments.forEach(p=>{
            includedPayIds.add(p.id);
            const pDateObj = p.date ? parseIso(p.date) : null;
            let timing = 'Advance'; // default for pre-invoice payments
            if(pDateObj && !isNaN(pDateObj) && mo.charged){
              if(pDateObj < mo.invoiceDate) timing = 'Advance';
              else if(pDateObj <= mo.dueDate) timing = 'On-time';
              else timing = 'Late';
            }
            console.log('[ledgerData] payment:', p.date, 'rentForMonth:', p.rentForMonth, 'charged:', mo.charged, 'timing:', timing);
            rows.push({tenant:t.name,property:prop?prop.name:'—',rentMonth:mLabel,payDate:fDL(p.date),charged:chargedAmt,amount:(p.ptype==='refund'?-1:1)*(Number(p.bankAmt||p.amount||0)+Number(p.tdsAmt||0)),mode:p.mode||'Cash',note:p.note||p.ref||'',timing,status:p.ptype==='refund'?'Refund':timing,balance:mo.runningBalance,invoiceDate:invoiceLbl,dueDate:dueLbl});
          });
        }
      });

      // Catch orphan payments: payments whose rentForMonth doesn't match any ledger month
      // (e.g. future months not yet in ledger window, or data saved before fix)
      const allTenantPays = (this.payments||[]).filter(p=>p.tenantId===t.id);
      allTenantPays.forEach(p=>{
        if(includedPayIds.has(p.id)) return; // already shown
        // This payment wasn't matched to any ledger month — show it anyway
        const rfm = p.rentForMonth || (p.date ? p.date.slice(0,7) : '');
        const [ry,rm] = rfm.split('-').map(Number);
        const mLabel = (MONTHS_L[rm-1]||'Month') + ' ' + (ry||'');
        const pDateObj = p.date ? parseIso(p.date) : null;
        console.log('[ledgerData] orphan payment:', p.date, 'rentForMonth:', rfm);
        rows.push({
          tenant:t.name, property:prop?prop.name:'—',
          rentMonth:mLabel, payDate:fDL(p.date),
          charged:0, amount:(p.ptype==='refund'?-1:1)*(Number(p.bankAmt||p.amount||0)+Number(p.tdsAmt||0)),
          mode:p.mode||'Cash', note:p.note||p.ref||'',
          timing:'Advance', status:'Advance',
          balance:0, invoiceDate:'—', dueDate:'—'
        });
      });
    });

    // Sort rows: by rentMonth year+month descending, then by payDate
    rows.sort((a,b)=>{
      // Extract YYYY-MM from rentMonth label for sorting
      const toKey = label => {
        const m = label.match(/(\w+)\s+(\d{4})/);
        if(!m) return '0000-00';
        const mi = MONTHS_L.indexOf(m[1]);
        return m[2]+'-'+String(mi+1).padStart(2,'0');
      };
      const ka=toKey(a.rentMonth), kb=toKey(b.rentMonth);
      return kb.localeCompare(ka); // newest first
    });

    return{rows,tenants};
  },

  _downloadLedgerPDF(tenantId){
    const {rows,tenants}=this._getLedgerData(tenantId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=tenantId&&tenantId!=='all';
    const title=isSingle&&tenants[0]?tenants[0].name+' — Rent Ledger':'Combined Rent Ledger — All Tenants';
    const now=new Date();
    const totalRecd=rows.filter(r=>r.amount>0).reduce((s,r)=>s+r.amount,0);
    const totalBal=isSingle&&tenants[0]?this.getTenantLedger(tenants[0]).totalBalance:this.tenants.reduce((s,t)=>s+this.getTenantLedger(t).totalBalance,0);

    const tableRows=rows.map(r=>{
      const col=r.amount<0?'#c62828':r.amount===0?'#888':'#2e7d32';
      const amtStr=r.amount===0?'—':(r.amount<0?'− ':'+ ')+'₹'+fmt2(Math.abs(r.amount));
      const tCol=r.timing==='Advance'?'#1565c0':r.timing==='Late'?'#e65100':'#2e7d32';
      return`<tr>
        ${!isSingle?`<td>${r.tenant}</td>`:''}
        <td>${r.rentMonth}</td>
        <td style="color:#555">${r.invoiceDate}</td>
        <td style="color:#555">${r.dueDate}</td>
        <td style="font-family:monospace">₹${fmt2(r.charged)}</td>
        <td>${r.payDate}</td>
        <td style="color:${col};font-weight:700;font-family:monospace">${amtStr}</td>
        <td>${r.mode}</td>
        <td style="color:${tCol};font-weight:700">${r.timing}</td>
        <td style="color:${r.balance>0?'#c62828':'#2e7d32'};font-weight:700;font-family:monospace">${r.balance>0?'₹'+fmt2(r.balance):'✓ Clear'}</td>
        <td style="font-size:10px;color:#666">${r.note}</td>
      </tr>`;
    }).join('');

    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;margin:16mm 14mm;}h1{font-size:16px;color:#b5701c;margin-bottom:3px;}
    .sub{color:#666;font-size:10px;margin-bottom:12px;}.summary{display:flex;gap:16px;margin-bottom:14px;background:#f5f5f5;padding:9px;border-radius:5px;}
    .s-card{text-align:center;}.s-label{font-size:9px;text-transform:uppercase;color:#666;}.s-val{font-size:14px;font-weight:bold;}
    table{width:100%;border-collapse:collapse;font-size:10px;}th{background:#b5701c;color:#fff;padding:5px 6px;text-align:left;white-space:nowrap;}
    td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top;}tr:nth-child(even){background:#fafafa;}
    @media print{body{margin:0;}@page{margin:16mm 14mm;}}</style></head><body>
    <h1>📒 ${title}</h1>
    <div class="sub">Generated: ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} | Period: All Time</div>
    <div class="summary">
      <div class="s-card"><div class="s-label">Total Received</div><div class="s-val" style="color:#2e7d32">₹${fmt2(totalRecd)}</div></div>
      <div class="s-card"><div class="s-label">Outstanding</div><div class="s-val" style="color:${totalBal>0?'#c62828':'#2e7d32'}">${totalBal>0?'₹'+fmt2(totalBal):'✓ Clear'}</div></div>
      <div class="s-card"><div class="s-label">Entries</div><div class="s-val">${rows.length}</div></div>
    </div>
    <table><thead><tr>${!isSingle?'<th>Tenant</th>':''}<th>Rent Month</th><th>Invoice Date</th><th>Due Date</th><th>Charged</th><th>Pay Date</th><th>Amount</th><th>Mode</th><th>Timing</th><th>Balance</th><th>Note</th></tr></thead>
    <tbody>${tableRows||'<tr><td colspan="11">No data</td></tr>'}</tbody></table>
    </body></html>`;

    const fname2=(isSingle&&tenants[0]?tenants[0].name.replace(/\s+/g,'_'):'All_Tenants');
    const cols = isSingle
      ? ['Rent Month','Invoice','Due Date','Charged','Pay Date','Amount','Mode','Timing','Balance','Note']
      : ['Tenant','Rent Month','Invoice','Due Date','Charged','Pay Date','Amount','Mode','Timing','Balance','Note'];
    const pdfRows = rows.map(r=>{
      const amtStr=r.amount===0?'—':(r.amount<0?'- ':'+ ')+'Rs.'+fmt2(Math.abs(r.amount));
      const balStr=r.balance>0?'Rs.'+fmt2(r.balance):'Clear';
      return isSingle
        ? [r.rentMonth,r.invoiceDate,r.dueDate,'Rs.'+fmt2(r.charged),r.payDate,amtStr,r.mode,r.timing,balStr,r.note]
        : [r.tenant,r.rentMonth,r.invoiceDate,r.dueDate,'Rs.'+fmt2(r.charged),r.payDate,amtStr,r.mode,r.timing,balStr,r.note];
    });
    // ── Rent Ledger: explicit column widths so no word ever breaks ──
    // Portrait usable = 182mm (A4 210 - 2×14), Landscape = 269mm (A4 297 - 2×14)
    // All-Tenants (11 cols) → always landscape for readability
    // Single Tenant (10 cols) → portrait with explicit widths
    const _rlOri = isSingle ? (APP._pdfOrientation||'portrait') : 'landscape';
    const _rlW   = _rlOri === 'landscape' ? 269 : 182;

    // Column widths (mm) — sized to fit longest realistic value without breaking
    // All-Tenants cols: Tenant | Rent Month | Invoice | Due Date | Charged | Pay Date | Amount | Mode | Timing | Balance | Note
    // Single-Tenant cols: Rent Month | Invoice | Due Date | Charged | Pay Date | Amount | Mode | Timing | Balance | Note
    const _rlColW_all    = [42, 20, 18, 18, 22, 18, 22, 14, 18, 20, 57]; // total=269
    const _rlColW_single = [22, 18, 18, 22, 18, 22, 16, 18, 20, 28];     // total=202 (fits 182 with some flex)

    // Build colStyles with explicit cellWidth + alignment
    const _rlColStyles = {};
    const _rlWidths = isSingle ? _rlColW_single : _rlColW_all;
    // Scale widths proportionally to actual usable width
    const _rlRawTotal = _rlWidths.reduce((a,b)=>a+b,0);
    _rlWidths.forEach((w,i)=>{
      _rlColStyles[i] = { cellWidth: parseFloat((w/_rlRawTotal*_rlW).toFixed(2)) };
    });
    // Right-align amount/charged/balance cols
    if(isSingle){
      Object.assign(_rlColStyles[3],{halign:'right'});  // Charged
      Object.assign(_rlColStyles[5],{halign:'right'});  // Amount
      Object.assign(_rlColStyles[8],{halign:'right'});  // Balance
    } else {
      Object.assign(_rlColStyles[4],{halign:'right'});  // Charged
      Object.assign(_rlColStyles[6],{halign:'right'});  // Amount
      Object.assign(_rlColStyles[9],{halign:'right'});  // Balance
    }

    _makePDF({
      filename: 'Rent_Ledger_'+fname2+'_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: title,
      subtitle: 'Generated: '+fD(now.toISOString().slice(0,10))+' | All Time',
      orientation: _rlOri,
      summaryRows: [
        ['Total Received','Rs.'+fmt2(totalRecd),[26,122,69]],
        ['Outstanding', totalBal>0?'Rs.'+fmt2(totalBal):'Clear', totalBal>0?[192,57,43]:[26,122,69]],
        ['Entries', String(rows.length), [44,111,173]],
      ],
      entriesLabel: 'Entries: '+rows.length,
      columns: cols,
      rows: pdfRows,
      colStyles: _rlColStyles,
      headerColor: [181,112,28],
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  _downloadLedgerCSV(tenantId){
    const {rows,tenants}=this._getLedgerData(tenantId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=tenantId&&tenantId!=='all';
    const headers=isSingle
      ?['Rent Month','Invoice Date','Due Date','Charged','Payment Date','Amount','Mode','Timing','Balance','Note']
      :['Tenant','Property','Rent Month','Invoice Date','Due Date','Charged','Payment Date','Amount','Mode','Timing','Balance','Note'];
    const csvRows=[headers];
    rows.forEach(r=>{
      const amtStr=r.amount===0?'0':(r.amount<0?'-':'')+Math.abs(r.amount);
      if(isSingle){
        csvRows.push([r.rentMonth,r.invoiceDate,r.dueDate,r.charged,r.payDate,amtStr,r.mode,r.timing,r.balance,'"'+(r.note||'').replace(/"/g,"'")+'"']);
      } else {
        csvRows.push(['"'+r.tenant+'"','"'+r.property+'"',r.rentMonth,r.invoiceDate,r.dueDate,r.charged,r.payDate,amtStr,r.mode,r.timing,r.balance,'"'+(r.note||'').replace(/"/g,"'")+'"']);
      }
    });
    const csv=csvRows.map(r=>r.join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const fname=isSingle&&tenants[0]?tenants[0].name.replace(/\s+/g,'_'):'All_Tenants';
    a.download='Rent_Ledger_'+fname+'_'+new Date().toISOString().slice(0,10)+'.csv';
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ CSV downloaded!');
  },

  _downloadLedgerWord(tenantId){
    const {rows,tenants}=this._getLedgerData(tenantId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=tenantId&&tenantId!=='all';
    const title=isSingle&&tenants[0]?tenants[0].name+' — Rent Ledger':'Combined Rent Ledger — All Tenants';
    const now=new Date();
    const totalRecd=rows.filter(r=>r.amount>0).reduce((s,r)=>s+r.amount,0);
    const totalBal=isSingle&&tenants[0]?this.getTenantLedger(tenants[0]).totalBalance:this.tenants.reduce((s,t)=>s+this.getTenantLedger(t).totalBalance,0);

    const tableRows=rows.map(r=>{
      const col=r.amount<0?'#C62828':r.amount===0?'#888':'#2E7D32';
      const amtStr=r.amount===0?'—':(r.amount<0?'− ':'+ ')+'₹'+fmt2(Math.abs(r.amount));
      const tCol=r.timing==='Advance'?'#1565C0':r.timing==='Late'?'#E65100':'#2E7D32';
      return`<tr>${!isSingle?`<td>${r.tenant}</td>`:''}
        <td>${r.rentMonth}</td><td>${r.invoiceDate}</td><td>${r.dueDate}</td>
        <td style="font-family:Courier">₹${fmt2(r.charged)}</td><td>${r.payDate}</td>
        <td style="color:${col};font-weight:bold">${amtStr}</td>
        <td>${r.mode}</td>
        <td style="color:${tCol};font-weight:bold">${r.timing}</td>
        <td style="color:${r.balance>0?'#C62828':'#2E7D32'};font-weight:bold">${r.balance>0?'₹'+fmt2(r.balance):'Clear'}</td>
        <td style="font-size:9pt">${r.note}</td>
      </tr>`;
    }).join('');

    const docHtml=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><title>${title}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
    <style>body{font-family:Arial;font-size:10pt;}h1{color:#B5701C;font-size:14pt;}
    table{border-collapse:collapse;width:100%;font-size:9pt;}
    th{background:#B5701C;color:white;padding:5px;border:1px solid #999;}
    td{padding:4px 6px;border:1px solid #ddd;vertical-align:top;}</style></head><body>
    <h1>📒 ${title}</h1>
    <p><b>Generated:</b> ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
    <table><tr><td><b>Total Received:</b></td><td style="color:#2E7D32">₹${fmt2(totalRecd)}</td>
    <td><b>Outstanding:</b></td><td style="color:${totalBal>0?'#C62828':'#2E7D32'}">${totalBal>0?'₹'+fmt2(totalBal):'✓ Clear'}</td>
    <td><b>Entries:</b></td><td>${rows.length}</td></tr></table><br>
    <table><thead><tr>${!isSingle?'<th>Tenant</th>':''}<th>Rent Month</th><th>Invoice</th><th>Due</th><th>Charged</th><th>Pay Date</th><th>Amount</th><th>Mode</th><th>Timing</th><th>Balance</th><th>Note</th></tr></thead>
    <tbody>${tableRows||'<tr><td colspan="11">No data</td></tr>'}</tbody></table>
    </body></html>`;

    // Word XML format — avoids parsing error
    const wDoc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<?mso-application progid="Word.Document"?>'
      +'<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">'
      +'<w:body>'+docHtml.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
      +'</w:body></w:wordDocument>';
    // Simpler: just use the HTML directly with proper mime
    const blob=new Blob([docHtml],{type:'application/vnd.ms-word'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const fname=isSingle&&tenants[0]?tenants[0].name.replace(/\s+/g,'_'):'All_Tenants';
    a.download='Rent_Ledger_'+fname+'_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(a);
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(a.href);},200);
    this.showToastMsg('✅ Word file downloaded!');
  },

  // ══ KHATA BOOK DOWNLOAD FUNCTIONS ══
  _kbGetData(partyId){
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const fDL=fD;
    const isSingle=partyId&&partyId!=='all';
    const parties=isSingle?[this.kbParties.find(p=>p.id===partyId)].filter(Boolean):this.kbParties;
    const kbFrom=this._kbFromDate||'';
    const kbTo=this._kbToDate||'';
    const rows=[];
    parties.forEach(p=>{
      if(!p) return;
      const bal=this._kbPartyBalance(p.id);
      let entries=bal.entries.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      // Apply date filter
      if(kbFrom||kbTo){
        entries=entries.filter(e=>{
          const d=e.date?new Date(e.date):null;
          if(!d) return true;
          if(kbFrom&&d<new Date(kbFrom)) return false;
          if(kbTo){const t2=new Date(kbTo);t2.setHours(23,59,59,999);if(d>t2)return false;}
          return true;
        });
      }
      entries.forEach(e=>{
        rows.push({party:p.name,phone:p.phone||'—',cat:p.cat||'other',date:fDL(e.date),type:e.type==='lena'?'Liya (Received)':'Diya (Paid)',amount:Number(e.amount||0),note:e.note||'—',balance:bal.net});
      });
    });
    return{rows,parties};
  },

  _kbDownloadPDF(partyId){
    const {rows,parties}=this._kbGetData(partyId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=partyId&&partyId!=='all';
    const partyName=isSingle&&parties[0]?parties[0].name:'All Parties';
    const now=new Date();
    const fromStr=this._kbFromDate?this._kbFromDate.split('-').reverse().join(' ').replace(/(\d+) (\d+) (\d+)/,(_,d,m,y)=>d+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]+' '+y):'';
    const toStr=this._kbToDate?this._kbToDate.split('-').reverse().join(' ').replace(/(\d+) (\d+) (\d+)/,(_,d,m,y)=>d+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]+' '+y):'';
    const periodStr=fromStr||toStr?'('+( fromStr||'Start')+' - '+(toStr||'Today')+')':'(All Time)';
    // Debit = Diya (you paid/gave), Credit = Liya (you received/got)
    const totalDebit=rows.filter(r=>r.type.startsWith('Diya')).reduce((s,r)=>s+r.amount,0);
    const totalCredit=rows.filter(r=>r.type.startsWith('Liya')).reduce((s,r)=>s+r.amount,0);
    const net=totalCredit-totalDebit;

    const tableRows=rows.map(r=>{
      const isCredit=r.type.startsWith('Liya');
      return`<tr>
        ${!isSingle?`<td style="padding:8px 10px;border:1px solid #e8dcc8;">${r.party}</td>`:''}
        <td style="padding:8px 10px;border:1px solid #e8dcc8;white-space:nowrap;">${r.date}</td>
        <td style="padding:8px 10px;border:1px solid #e8dcc8;">${r.note||'—'}</td>
        <td style="padding:8px 10px;border:1px solid #e8dcc8;text-align:right;font-family:monospace;font-size:14px;color:${isCredit?'#ccc':'#c0392b'};font-weight:${isCredit?'400':'700'};">${isCredit?'—':fmt2(r.amount)}</td>
        <td style="padding:8px 10px;border:1px solid #e8dcc8;text-align:right;font-family:monospace;font-size:14px;color:${isCredit?'#1a7a45':'#ccc'};font-weight:${isCredit?'700':'400'};">${isCredit?fmt2(r.amount):'—'}</td>
      </tr>`;
    }).join('');

    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Account Statement</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1d23;background:#f0f2f5;padding:16mm 14mm;}
      .header{text-align:center;margin-bottom:20px;padding:18px 20px 16px;background:linear-gradient(135deg,#dbeafe,#eff6ff);border-radius:10px;border:1.5px solid #bfdbfe;}
      .header h1{font-size:24px;font-weight:900;color:#1e3a5f;margin-bottom:4px;letter-spacing:.02em;}
      .header .period{font-size:13px;color:#3a6fa0;}
      .summary-box{border:1.5px solid #bfdbfe;border-radius:8px;display:flex;margin-bottom:20px;overflow:hidden;box-shadow:0 2px 8px rgba(44,111,173,.10);}
      .sum-cell{flex:1;padding:15px 16px;text-align:center;border-right:1px solid #bfdbfe;}
      .sum-cell:last-child{border-right:none;}
      .sum-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;font-weight:800;}
      .sum-val{font-size:21px;font-weight:900;}
      .entries-label{font-size:12px;color:#6c757d;margin-bottom:8px;padding:4px 0;border-bottom:1px dashed #bfdbfe;}
      table{width:100%;border-collapse:collapse;border:1.5px solid #bfdbfe;}
      thead tr{background:#2c6fad;}
      th{padding:11px 12px;text-align:left;font-size:12px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.2);text-transform:uppercase;letter-spacing:.04em;}
      th.num{text-align:right;}
      td{font-size:13px;color:#1a1d23;border:1px solid #e2e8f0;padding:9px 12px;}
      tr:nth-child(even) td{background:#f8faff;}
      tr:nth-child(odd) td{background:#fff;}
      .grand-total td{background:#dbeafe!important;font-weight:800;border-top:2px solid #2c6fad;color:#1e3a5f;}
      @media print{body{padding:0;background:#fff;}@page{margin:16mm 14mm;}}
    </style></head><body>
    <div class="header">
      <div style="font-size:26px;margin-bottom:6px;">📒</div>
      <h1>Khata Book — Hisab Kitab</h1>
      <div class="period">${periodStr}</div>
      ${isSingle?`<div style="font-size:14px;color:#1e3a5f;margin-top:6px;background:rgba(44,111,173,.12);display:inline-block;padding:4px 16px;border-radius:20px;font-weight:800;border:1px solid #bfdbfe;">👤 ${partyName}</div>`:'<div style="font-size:12px;color:#3a6fa0;margin-top:4px;">Sabhi Parties — All Parties</div>'}
    </div>
    <div class="summary-box">
      <div class="sum-cell" style="background:#fff0f0;border-left:4px solid #c0392b;"><div class="sum-label" style="color:#c0392b;">Total Ko Diya (−)</div><div class="sum-val" style="color:#c0392b;">${fmt2(totalDebit)}</div></div>
      <div class="sum-cell" style="background:#f0fdf4;border-left:4px solid #1a7a45;"><div class="sum-label" style="color:#1a7a45;">Total Se Liya (+)</div><div class="sum-val" style="color:#1a7a45;">${fmt2(totalCredit)}</div></div>
      <div class="sum-cell" style="background:#eff6ff;border-left:4px solid #2c6fad;"><div class="sum-label" style="color:#2c6fad;">Net Balance</div><div class="sum-val" style="color:${net>=0?'#166534':'#991b1b'};">${fmt2(Math.abs(net))} ${net>=0?'Cr':'Dr'}</div></div>
    </div>
    <div class="entries-label">No. of Entries: ${rows.length}</div>
    <table>
      <thead><tr>
        ${!isSingle?'<th>Party Name</th>':''}
        <th>Date</th><th>Details</th>
        <th class="num" style="background:#c0392b;color:#fff;">Ko Diya (−)</th><th class="num" style="background:#1a7a45;color:#fff;">Se Liya (+)</th>
      </tr></thead>
      <tbody>${tableRows||'<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">No entries</td></tr>'}</tbody>
      <tr class="grand-total">
        ${!isSingle?'<td></td>':''}
        <td colspan="2" style="padding:10px 12px;border:1px solid #bfdbfe;font-size:14px;">Grand Total / Kul Jama</td>
        <td style="padding:10px 12px;border:1px solid #bfdbfe;text-align:right;font-family:monospace;font-size:15px;font-weight:900;color:#c0392b;">${fmt2(totalDebit)}</td>
        <td style="padding:10px 12px;border:1px solid #bfdbfe;text-align:right;font-family:monospace;font-size:15px;font-weight:900;color:#1a7a45;">${fmt2(totalCredit)}</td>
      </tr>
    </table>
    </body></html>`;
    // TRUE download — data URI forces browser to save file, no popup
    const fname3=(isSingle&&parties[0]?parties[0].name.replace(/\s+/g,'_'):'All_Parties');
    // Build columns and rows for jsPDF
    const kbCols = isSingle
      ? ['Date','Details','Ko Diya (−)','Se Liya (+)']
      : ['Party','Date','Details','Ko Diya (−)','Se Liya (+)'];
    const kbRows = rows.map(r=>{
      const isCredit=r.type.startsWith('Liya');
      const debitStr = isCredit ? '—' : fmt2(r.amount);
      const creditStr = isCredit ? fmt2(r.amount) : '—';
      return isSingle
        ? [r.date, r.note||'—', debitStr, creditStr]
        : [r.party, r.date, r.note||'—', debitStr, creditStr];
    });
    const lastIdx = kbCols.length - 1;
    const prevIdx = lastIdx - 1;
    const kbColStyles = {
      [prevIdx]: {halign:'right', textColor:[192,57,43], fontStyle:'bold'},
      [lastIdx]: {halign:'right', textColor:[26,122,69], fontStyle:'bold'},
    };
    if(!isSingle) kbColStyles[0]={fontStyle:'bold'};
    const kbTotals = isSingle
      ? ['Grand Total / Kul Jama','', fmt2(totalDebit), fmt2(totalCredit)]
      : ['','Grand Total / Kul Jama','', fmt2(totalDebit), fmt2(totalCredit)];

    _makePDF({
      filename: 'Khata_'+fname3+'_'+new Date().toISOString().slice(0,10)+'.pdf',
      title: 'Khata Book - Hisab Kitab',
      subtitle: periodStr,
      badge: isSingle ? 'Party: '+partyName : 'Sabhi Parties (All)',
      summaryRows: [
        ['Total Ko Diya (−)', fmt2(totalDebit), [192,57,43]],
        ['Total Se Liya (+)', fmt2(totalCredit), [26,122,69]],
        ['Net Balance', fmt2(Math.abs(net))+(net>=0?' Cr':' Dr'), net>=0?[26,122,69]:[192,57,43]],
      ],
      entriesLabel: 'Entries: '+rows.length,
      columns: kbCols,
      rows: kbRows,
      totalsRow: kbTotals,
      colStyles: kbColStyles,
      headerColor: [44,111,173],
    });
    this.showToastMsg('✅ PDF downloading...');
  },

  _kbDownloadCSV(partyId){
    const {rows,parties}=this._kbGetData(partyId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=partyId&&partyId!=='all';
    const headers=isSingle?['Date','Type','Amount','Note']:['Party','Phone','Category','Date','Type','Amount','Note'];
    const csvRows=[headers];
    rows.forEach(r=>{
      const amtStr=(r.type.startsWith('Liya')?'':'-')+r.amount;
      if(isSingle) csvRows.push([r.date,r.type,amtStr,'"'+(r.note||'').replace(/"/g,"'")+'"']);
      else csvRows.push(['"'+r.party+'"',r.phone,r.cat,r.date,r.type,amtStr,'"'+(r.note||'').replace(/"/g,"'")+'"']);
    });
    const csv=csvRows.map(r=>r.join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    const fname=isSingle&&parties[0]?parties[0].name.replace(/\s+/g,'_'):'All_Parties';
    a.download='Khata_'+fname+'_'+new Date().toISOString().slice(0,10)+'.csv';
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
    this.showToastMsg('✅ CSV downloaded!');
  },

  _kbDownloadWord(partyId){
    const {rows,parties}=this._kbGetData(partyId);
    const fmt2=window.fmt||(n=>Number(n).toLocaleString('en-IN'));
    const isSingle=partyId&&partyId!=='all';
    const title=isSingle&&parties[0]?parties[0].name+' — Khata Ledger':'Khata Book — All Parties';
    const now=new Date();
    const totalLena=rows.filter(r=>r.type.startsWith('Liya')).reduce((s,r)=>s+r.amount,0);
    const totalDena=rows.filter(r=>r.type.startsWith('Diya')).reduce((s,r)=>s+r.amount,0);

    const tableRows=rows.map(r=>{
      const isLena=r.type.startsWith('Liya');
      const col=isLena?'#166534':'#991b1b';
      return`<tr>${!isSingle?`<td>${r.party}</td><td>${r.phone}</td>`:''}
        <td>${r.date}</td><td style="color:${col};font-weight:bold">${r.type}</td>
        <td style="color:${col};font-weight:bold;text-align:right">${isLena?'+':'-'}₹${fmt2(r.amount)}</td>
        <td>${r.note}</td></tr>`;
    }).join('');

    const periodStr=this._kbFromDate||this._kbToDate
      ?' | Period: '+(this._kbFromDate||'start')+' to '+(this._kbToDate||'today')
      :' | All Time';
    // Proper Word XML format — avoids "error in parsing" on all Word versions
    const docHtml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<?mso-application progid="Word.Document"?>'
      +'<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"'
      +' xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint">'
      +'<w:body>'
      +'<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="B5701C"/></w:rPr>'
      +'<w:t>Khata Book — '+title+'</w:t></w:r></w:p>'
      +'<w:p><w:r><w:t>Generated: '+now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})+periodStr+'</w:t></w:r></w:p>'
      +'<w:p><w:r><w:t>Total Liya (Received): Rs.'+fmt2(totalLena)+'   |   Total Diya (Paid): Rs.'+fmt2(totalDena)+'   |   Net: '+(totalLena-totalDena>=0?'+':'-')+'Rs.'+fmt2(Math.abs(totalLena-totalDena))+'</w:t></w:r></w:p>'
      +'<w:p><w:r><w:t> </w:t></w:r></w:p>'
      +'<w:tbl>'
      +'<w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>'
      +'<w:top w:val="single" w:sz="4" w:color="999999"/>'
      +'<w:left w:val="single" w:sz="4" w:color="999999"/>'
      +'<w:bottom w:val="single" w:sz="4" w:color="999999"/>'
      +'<w:right w:val="single" w:sz="4" w:color="999999"/>'
      +'<w:insideH w:val="single" w:sz="4" w:color="dddddd"/>'
      +'<w:insideV w:val="single" w:sz="4" w:color="dddddd"/>'
      +'</w:tblBorders></w:tblPr>'
      // header row
      +'<w:tr>'+((!isSingle)?'<w:tc><w:p><w:r><w:rPr><w:b/><w:shd w:val="clear" w:color="auto" w:fill="B5701C"/></w:rPr><w:t>Party</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Phone</w:t></w:r></w:p></w:tc>':'')
      +'<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Date</w:t></w:r></w:p></w:tc>'
      +'<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Type</w:t></w:r></w:p></w:tc>'
      +'<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Amount</w:t></w:r></w:p></w:tc>'
      +'<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Note</w:t></w:r></w:p></w:tc>'
      +'</w:tr>'
      // data rows
      +(rows.length?rows.map(r=>{
        const isLena=r.type.startsWith('Liya');
        const sign=isLena?'+':'-';
        return '<w:tr>'
          +((!isSingle)?'<w:tc><w:p><w:r><w:t>'+r.party+'</w:t></w:r></w:p></w:tc>'
            +'<w:tc><w:p><w:r><w:t>'+r.phone+'</w:t></w:r></w:p></w:tc>':'')
          +'<w:tc><w:p><w:r><w:t>'+r.date+'</w:t></w:r></w:p></w:tc>'
          +'<w:tc><w:p><w:r><w:t>'+r.type+'</w:t></w:r></w:p></w:tc>'
          +'<w:tc><w:p><w:r><w:t>'+sign+'Rs.'+fmt2(r.amount)+'</w:t></w:r></w:p></w:tc>'
          +'<w:tc><w:p><w:r><w:t>'+(r.note||'')+'</w:t></w:r></w:p></w:tc>'
          +'</w:tr>';
      }).join(''):'<w:tr><w:tc><w:p><w:r><w:t>No entries</w:t></w:r></w:p></w:tc></w:tr>')
      +'</w:tbl>'
      +'</w:body></w:wordDocument>';
    const _kbwBlob=new Blob(['\uFEFF'+docHtml],{type:'application/msword'});
    const _kbwA=document.createElement('a');
    _kbwA.href=URL.createObjectURL(_kbwBlob);
    const fname=isSingle&&parties[0]?parties[0].name.replace(/\s+/g,'_'):'All_Parties';
    _kbwA.download='Khata_'+fname+'_'+new Date().toISOString().slice(0,10)+'.doc';
    document.body.appendChild(_kbwA);
    _kbwA.click();
    document.body.removeChild(_kbwA);URL.revokeObjectURL(_kbwA.href);
    this.showToastMsg('✅ Word file downloaded!');
  },

  _expPrevMon(){
    const d=new Date((this.expMonth||new Date().toISOString().slice(0,7))+'-01');
    d.setMonth(d.getMonth()-1);
    this.expSub='month';
    this.expMonth=d.toISOString().slice(0,7);
    this.renderExpense();
  },
  _expNextMon(){
    const d=new Date((this.expMonth||new Date().toISOString().slice(0,7))+'-01');
    d.setMonth(d.getMonth()+1);
    this.expSub='month';
    this.expMonth=d.toISOString().slice(0,7);
    this.renderExpense();
  },

  // ── Medical Files popup — View + Download all Rx and Lab files ──
  _medShowFiles(visitId){
    const r = this.visits.find(x=>x.id===visitId);
    if(!r) return;
    const pat = this.patients.find(p=>p.id===r.patId);

    // Collect prescription files
    const presFiles = (r.presFiles&&r.presFiles.length) ? r.presFiles
      : (r.link ? [{url:r.link, name:'Prescription', type:''}] : []);

    // Collect lab files
    const labLinks = [r.lablink,r.lablink2,r.lablink3].filter(Boolean);
    const labFiles = (r.labFiles&&r.labFiles.length) ? r.labFiles
      : labLinks.map((u,i)=>({url:u, name:'Lab Report'+(labLinks.length>1?' '+(i+1):''), type:''}));

    const allFiles = [
      ...presFiles.map((f,i)=>({...f, label:'📄 Rx'+(presFiles.length>1?' '+(i+1):''), section:'Prescription'})),
      ...labFiles.map((f,i)=>({...f, label:'🧪 Lab'+(labFiles.length>1?' '+(i+1):''), section:'Lab Report'}))
    ];

    if(!allFiles.length){ this.showToastMsg('⚠️ No files attached'); return; }

    const existing = document.getElementById('medFilesOverlay');
    if(existing) existing.remove();

    const icon = f => {
      const ext=(f.name||'').split('.').pop().toLowerCase();
      if(['jpg','jpeg','png','webp','gif'].includes(ext)||f.type?.startsWith('image/')) return '🖼️';
      if(ext==='pdf') return '📄';
      return '📎';
    };
    const sz = b => !b?'':b>1048576?(b/1048576).toFixed(1)+' MB':Math.round(b/1024)+' KB';

    const fileRows = allFiles.map(f => `
      <div style="background:var(--dim);border-radius:10px;border:1.5px solid var(--bdr2);padding:11px 13px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:9px;">
          <span style="font-size:1.4rem;flex-shrink:0;">${icon(f)}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:.72rem;font-weight:700;color:#b56a00;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">${f.label}</div>
            <div style="font-size:.82rem;font-weight:700;color:var(--txt);word-break:break-all;line-height:1.3;">${f.name||'File'}</div>
            ${f.size?`<div style="font-size:.7rem;color:var(--mut);">${sz(f.size)}</div>`:''}
          </div>
        </div>
        <div style="display:flex;gap:7px;">
          <a href="${f.url}" target="_blank"
            style="flex:1;text-align:center;padding:9px 6px;background:var(--acc);color:#fff;border-radius:8px;font-size:.82rem;font-weight:800;text-decoration:none;touch-action:manipulation;display:block;">
            👁 View / Open
          </a>
          <button onclick="APP.downloadFile('${f.url}', '${f.name||'file'}'); event.stopPropagation();"
            style="flex:1;text-align:center;padding:9px 6px;background:#e8f5e9;color:#1e7a45;border:1.5px solid #90c8a0;border-radius:8px;font-size:.82rem;font-weight:800;cursor:pointer;touch-action:manipulation;display:block;font-family:'Nunito',sans-serif;">
            ⬇️ Download
          </button>
        </div>
      </div>`).join('');

    const el = document.createElement('div');
    el.id = 'medFilesOverlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
    el.innerHTML = `
      <div style="background:var(--card);border-radius:14px;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.25);overflow:hidden;">
        <!-- Header -->
        <div style="padding:12px 16px;border-bottom:1px solid var(--bdr);background:var(--card2);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div>
            <div style="font-weight:800;font-size:.9rem;">📎 Medical Files</div>
            <div style="font-size:.72rem;color:var(--mut);margin-top:2px;">${r.doctor?'Dr. '+r.doctor:r.type||'Visit'} · ${pat?pat.name:''} · ${allFiles.length} file${allFiles.length>1?'s':''}</div>
          </div>
          <button onclick="document.getElementById('medFilesOverlay').remove()"
            style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--mut);padding:4px;line-height:1;">✕</button>
        </div>
        <!-- Scrollable file list -->
        <div style="flex:1;overflow-y:auto;padding:12px 14px;">
          ${fileRows}
        </div>
        <!-- Footer note -->
        <div style="padding:8px 14px;border-top:1px solid var(--bdr);background:var(--card2);font-size:.7rem;color:var(--mut);flex-shrink:0;">
          💡 Tap View to open in browser · Download saves to your device
        </div>
      </div>`;

    document.body.appendChild(el);
    el.addEventListener('click', e => { if(e.target===el) el.remove(); });
  },


});

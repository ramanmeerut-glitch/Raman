/* utils.js — Shared Utilities
 * Modal helper (M), Storage helper (S), uid, fmt, v/sv/vc/sc helpers,
 * safe date utilities, _makePDF, safeDelete, showUndoSnackbar,
 * DOM helpers (makeDateInput, syncDate*), _renderTodoWidget
 */

'use strict';

// ═══════════════════════════════
const M={
  ensureChrome(target){
    const overlay = typeof target === 'string' ? document.getElementById(target) : target;
    if(!overlay || !overlay.classList || !overlay.classList.contains('overlay')) return;
    if(overlay.id === 'loginM' || overlay.dataset.hideX === '1') return;
    const modal = overlay.querySelector(':scope > .modal');
    if(!modal) return;
    modal.classList.add('modal-has-x');
    let closeBtn = modal.querySelector(':scope > .modal-x');
    if(!closeBtn){
      closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'modal-x';
      closeBtn.setAttribute('aria-label','Close popup');
      closeBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';
      closeBtn.addEventListener('click', ()=>this.close(overlay.id));
      modal.prepend(closeBtn);
    }
  },
  open(id){
    const overlay = document.getElementById(id);
    if(!overlay) return;
    this.ensureChrome(overlay);
    overlay.classList.add('open');
    try{ if(typeof stripOptionalLabelHints === 'function') stripOptionalLabelHints(overlay); }catch(e){}
    try{ if(typeof normalizeRequiredLabels === 'function') normalizeRequiredLabels(overlay); }catch(e){}
  },
  close(id){
    const overlay = document.getElementById(id);
    if(!overlay) return;
    overlay.classList.remove('open');
  }
};
document.querySelectorAll('.overlay').forEach(o=>{
  M.ensureChrome(o);
  o.addEventListener('click',e=>{if(e.target===o&&!o.dataset.noclose)o.classList.remove('open');});
});

function stripOptionalLabelHints(root){
  const scope = root && root.querySelectorAll ? root : document;
  const labels = scope.querySelectorAll('label');
  labels.forEach(function(label){
    if(!label || label.dataset.optNormalized === '1') return;
    let html = label.innerHTML || '';
    html = html
      .replace(/<span[^>]*>\s*\(optional[^<]*<\/span>/gi,'')
      .replace(/\s*\(optional[^)]*\)/gi,'')
      .replace(/\s{2,}/g,' ')
      .trim();
    label.innerHTML = html;
    label.dataset.optNormalized = '1';
  });
}
window.stripOptionalLabelHints = stripOptionalLabelHints;
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', function(){ stripOptionalLabelHints(document); });
}else{
  stripOptionalLabelHints(document);
}

function normalizeRequiredLabels(root){
  const scope = root && root.querySelectorAll ? root : document;
  const labels = scope.querySelectorAll('label, .modal label, .fg label');
  labels.forEach(function(label){
    if(!label || label.dataset.reqNormalized === '1') return;
    const text = (label.textContent || '').replace(/\s+/g,' ').trim();
    const isOptional = /\boptional\b/i.test(text);
    const hasRequired = /\bmandatory\b/i.test(text) || /[★*]/.test(text);
    if(!hasRequired || isOptional){
      label.dataset.reqNormalized = '1';
      return;
    }
    let html = label.innerHTML || '';
    html = html
      .replace(/<span[^>]*class=(["'])req-star\1[^>]*>.*?<\/span>/gi,'')
      .replace(/\s*[★*]+\s*MANDATORY\b/gi,'')
      .replace(/\bMANDATORY\b/gi,'')
      .replace(/\s*[★*]+\s*/g,' ')
      .replace(/\s{2,}/g,' ')
      .replace(/\s+([)\]])/g,'$1')
      .trim();
    label.innerHTML = html + '<span class="req-star" aria-hidden="true">*</span>';
    label.dataset.reqNormalized = '1';
  });
}
window.normalizeRequiredLabels = normalizeRequiredLabels;
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', function(){ normalizeRequiredLabels(document); });
}else{
  normalizeRequiredLabels(document);
}

const S={
  get(k){try{return JSON.parse(localStorage.getItem('rk_'+k))||[];}catch{return[];}},
  set(k,v){
    // 1. Always save locally first (instant, no network needed)
    localStorage.setItem('rk_'+k,JSON.stringify(v));
    // 2. Auto-sync to Firebase (real-time — all devices get it instantly)
    if(window.fbSave){
      window.fbSave(k,v).catch(e=>console.warn('[S.set] Firebase error:',e.message));
    }
  },
  obj(k,d){try{return JSON.parse(localStorage.getItem('rk_'+k))||d;}catch{return d;}}
};

// ═══════════════════════════════
// HELPERS
// ═══════════════════════════════
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const fmt=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const v=id=>{const e=document.getElementById(id);return e?e.value.trim():'';};
const sv=(id,val)=>{const e=document.getElementById(id);if(e)e.value=val||'';};
const vc=(id)=>{const e=document.getElementById(id);return e?e.checked:false;};
const sc=(id,val)=>{const e=document.getElementById(id);if(e)e.checked=!!val;};

// ═══════════════════════════════════════════════════════
// SAFE DATE UTILITIES — No timezone shift, No NaN bugs
// ═══════════════════════════════════════════════════════

// parseIso: safely parse YYYY-MM-DD without timezone shift
// new Date("YYYY-MM-DD") = UTC midnight = wrong local date
// Fix: use new Date(year, month-1, day) = local midnight
function parseIso(iso){
  if(!iso) return null;
  // Already a Date object
  if(iso instanceof Date) return isNaN(iso) ? null : iso;
  const s = String(iso).trim();
  // YYYY-MM-DD format (most common in this app)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]), 0, 0, 0, 0);
  // DD/MM/YY or DD/MM/YYYY format
  const m2 = s.match(/^(\d{2})\/(\d{2})\/((\d{2}|\d{4}))$/);
  if(m2){
    const y = m2[3].length===2 ? 2000+parseInt(m2[3]) : parseInt(m2[3]);
    return new Date(y, parseInt(m2[2])-1, parseInt(m2[1]), 0, 0, 0, 0);
  }
  // Fallback for ISO with time (e.g. from Firebase)
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// fD: format any date string → DD/MM/YYYY display (safe, no UTC shift)
function fD(ds){
  if(!ds) return '—';
  const d = parseIso(ds);
  if(!d || isNaN(d)) return String(ds);
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
}

// todayDMY: returns today as DD/MM/YYYY — strict format, no locale ambiguity
function todayDMY(){
  const n=new Date();
  return String(n.getDate()).padStart(2,'0')+'/'+String(n.getMonth()+1).padStart(2,'0')+'/'+n.getFullYear();
}
// todayISO: returns today as YYYY-MM-DD
function todayISO(){
  const n=new Date();
  return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
}

// daysFrom: days from TODAY to ISO date (positive=future, negative=past, 0=today)
// No UTC conversion — pure local date arithmetic
function daysFrom(ds){
  if(!ds) return null;
  const d = parseIso(ds);
  if(!d || isNaN(d)) return null;
  const now = new Date(); 
  const t1 = new Date(d.getFullYear(),   d.getMonth(),   d.getDate(),   0,0,0,0).getTime();
  const t2 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0).getTime();
  return Math.round((t1 - t2) / 86400000);
}

// daysUntilExpiry: days from today to expiry
function daysUntilExpiry(expIso){
  return daysFrom(expIso);
}

// Reminder colour class — based on days until EXPIRY
function remCls(daysExp){
  if(daysExp===null)return'';
  if(daysExp<0)return'rem-overdue';
  if(daysExp<=7)return'rem-week';
  if(daysExp<=30)return'rem-month';
  if(daysExp<=90)return'rem-3mo';
  return'rem-ok';
}
// remBadge: shows follow-up status (used in medical tab)
// d = days from today to the follow-up date (positive=future, negative=past)
function remBadge(d){
  if(d===null)return'';
  if(d<0)return`<span class="badge br">⚠️ Overdue ${Math.abs(d)}d</span>`;
  if(d===0)return`<span class="badge br">🔔 Today</span>`;
  if(d<=7)return`<span class="badge by">📅 In ${d}d</span>`;
  if(d<=30)return`<span class="badge bg">📅 In ${d}d</span>`;
  if(d<=90)return`<span class="badge by">🟡 In ${d}d</span>`;
  return`<span class="badge bg">🟢 In ${d}d</span>`;
}
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const SM=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── getRentMonth: given a payment date and due day, return the RENT CYCLE month ──
// Rule: if payment day < dueDay → it belongs to PREVIOUS month's rent cycle
// Example: due=7, payment on 05/Apr → March rent; payment on 08/Apr → April rent
// Returns { year, month (0-based), key:'YYYY-MM', label:'April 2026' }
function getRentMonth(dateStr, dueDay) {
  dueDay = Number(dueDay) || 7;
  const d = parseIso(dateStr);
  if (!d || isNaN(d)) {
    // fallback: current calendar month
    const n = new Date();
    const m = n.getMonth(), y = n.getFullYear();
    return { year:y, month:m, key:y+'-'+String(m+1).padStart(2,'0'), label:MONTHS[m]+' '+y };
  }
  let day = d.getDate(), month = d.getMonth(), year = d.getFullYear();
  if (day < dueDay) {
    // Payment is before due date → belongs to previous month's cycle
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  const key = year + '-' + String(month + 1).padStart(2, '0');
  console.log('[getRentMonth] date='+dateStr+' dueDay='+dueDay+' → '+key);
  return { year, month, key, label: MONTHS[month] + ' ' + year };
}

// ── DD/MM/YYYY DATE INPUT HELPERS ──
// Convert YYYY-MM-DD (internal) ↔ DD/MM/YYYY (display)
function isoToDmy(iso){
  // Use fD which already uses safe parseIso
  if(!iso) return '';
  const d = parseIso(iso);
  if(!d || isNaN(d)) return '';
  return String(d.getDate()).padStart(2,'0') + '/' +
         String(d.getMonth()+1).padStart(2,'0') + '/' +
         String(d.getFullYear());
}
function dmyToIso(dmy){
  if(!dmy)return'';
  // Accept DD/MM/YY or DD/MM/YYYY or DDMMYY or DDMMYYYY
  dmy=dmy.replace(/\s/g,'');
  let dd,mm,yy;
  if(dmy.includes('/')){
    [dd,mm,yy]=dmy.split('/');
  } else if(dmy.length===6){
    dd=dmy.slice(0,2);mm=dmy.slice(2,4);yy=dmy.slice(4,6);
  } else if(dmy.length===8){
    dd=dmy.slice(0,2);mm=dmy.slice(2,4);yy=dmy.slice(4,8);
  } else return'';
  if(!dd||!mm||!yy)return'';
  const fullY=yy.length===2?(parseInt(yy)<50?'20'+yy:'19'+yy):yy;
  const iso=`${fullY}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  if(isNaN(new Date(iso)))return'';
  return iso;
}

// Render a DD/MM/YYYY date input field — shows text box with calendar icon
// id = the logical id used to get/set value, hidId = hidden native date input
function makeDateInput(id, placeholderVal){
  return`<div class="date-wrap">
    <input type="text" class="dmy fg-inner" id="${id}" placeholder="DD/MM/YYYY" 
      value="${placeholderVal?isoToDmy(placeholderVal):''}"
      oninput="syncDateToHidden('${id}','${id}_h')"
      onfocus="this.select()"
      style="background:var(--bg);border:1.5px solid var(--bdr2);color:var(--txt);padding:8px 36px 8px 11px;border-radius:7px;font-family:'JetBrains Mono',monospace;font-size:.85rem;outline:none;transition:border-color .2s;width:100%;">
    <span class="cal-icon" onclick="document.getElementById('${id}_h').showPicker()">📅</span>
    <input type="date" class="hidden-date" id="${id}_h" 
      value="${placeholderVal||''}"
      onchange="syncDateFromHidden('${id}_h','${id}')">
  </div>`;
}
function syncDateToHidden(textId, hidId){
  const txt=document.getElementById(textId);const hid=document.getElementById(hidId);
  if(!txt||!hid)return;
  const iso=dmyToIso(txt.value);
  hid.value=iso||'';
  txt.style.borderColor=iso?'var(--acc)':txt.value?'var(--red)':'var(--bdr2)';
}
function syncDateFromHidden(hidId, textId){
  const hid=document.getElementById(hidId);const txt=document.getElementById(textId);
  if(!hid||!txt)return;
  txt.value=isoToDmy(hid.value);
  txt.style.borderColor=hid.value?'var(--acc)':'var(--bdr2)';
}
// Get ISO value from a DD/MM/YYYY text input
function vDate(id){
  const el=document.getElementById(id+'_h')||document.getElementById(id);
  if(!el)return'';
  // If it's the hidden date input, return directly
  if(el.type==='date')return el.value||'';
  // Otherwise parse the text
  return dmyToIso(el.value)||'';
}
// Set value of DD/MM/YYYY input
function svDate(id, iso){
  const txt=document.getElementById(id);const hid=document.getElementById(id+'_h');
  if(txt)txt.value=isoToDmy(iso);
  if(hid)hid.value=iso||'';
}

function compactDateLabel(iso, fallback){
  if(!iso) return fallback || 'Start';
  const d = parseIso(iso);
  if(!d || isNaN(d)) return fallback || 'Start';
  return String(d.getDate()).padStart(2,'0') + ' ' + SM[d.getMonth()];
}

function openHiddenDateInput(id){
  const el=document.getElementById(id);
  if(!el) return;
  if(typeof el.showPicker === 'function') el.showPicker();
  else el.click();
}
window.openHiddenDateInput = openHiddenDateInput;

function renderCompactDateRangeFilter(opts){
  opts = opts || {};
  const label = opts.label || 'Date';
  const fromId = opts.fromId || uid();
  const toId = opts.toId || uid();
  const fromValue = opts.fromValue || '';
  const toValue = opts.toValue || '';
  const fromText = compactDateLabel(fromValue, opts.fromText || 'Start');
  const toText = compactDateLabel(toValue, opts.toText || 'End');
  const fromOnChange = opts.fromOnChange || '';
  const toOnChange = opts.toOnChange || '';
  const clearOnClick = opts.clearOnClick || '';
  const className = opts.className ? ` ${opts.className}` : '';
  const meta = opts.meta ? `<span class="date-filter-inline__meta">${opts.meta}</span>` : '';
  const clearBtn = (fromValue || toValue) && clearOnClick
    ? `<button type="button" class="date-filter-inline__clear" onclick="${clearOnClick}" aria-label="Clear date filter">×</button>`
    : '';
  return `
    <div class="date-filter-inline${className}">
      <span class="material-symbols-outlined date-filter-inline__icon" aria-hidden="true">calendar_month</span>
      <span class="date-filter-inline__label">${label}</span>
      <button type="button" class="date-filter-inline__trigger" onclick="openHiddenDateInput('${fromId}')">${fromText}</button>
      <span class="date-filter-inline__sep">-</span>
      <button type="button" class="date-filter-inline__trigger" onclick="openHiddenDateInput('${toId}')">${toText}</button>
      ${clearBtn}
      ${meta}
      <input type="date" id="${fromId}" class="date-filter-inline__native" value="${fromValue}" onchange="${fromOnChange}">
      <input type="date" id="${toId}" class="date-filter-inline__native" value="${toValue}" onchange="${toOnChange}">
    </div>`;
}
window.renderCompactDateRangeFilter = renderCompactDateRangeFilter;



// ═══════════════════════════════════════════════════════════════
// SHARED PDF ENGINE — uses jsPDF + AutoTable
// _makePDF(config) — generates and downloads a real .pdf file
// config = {
//   filename: 'report.pdf',
//   title: 'Khata Book',
//   subtitle: 'Period: ...',
//   badge: 'Party Name',           // optional
//   summaryRows: [[label, val, color], ...],  // optional summary strip
//   columns: ['Date','Details','Amount'],
//   rows: [['01/04/2026','Note','₹500'], ...],
//   totalsRow: ['Grand Total','','₹500'],     // optional
//   colStyles: {2:{halign:'right',textColor:[192,57,43]}}, // optional
//   headerColor: [44,111,173],     // default blue
//   accentColor: [30,58,95],
// }
// ═══════════════════════════════════════════════════════════════
function _makePDF(config){
  // Lazy-load check
  if(typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined'){
    alert('PDF library loading... Please try again in a moment.');
    return;
  }
  const jsPDFLib = (typeof window.jspdf !== 'undefined') ? window.jspdf.jsPDF : jsPDF;
  // ORIENTATION: global toggle (APP._pdfOrientation) → config → portrait default
  const _globalOri = (typeof APP !== 'undefined' && APP._pdfOrientation) ? APP._pdfOrientation : null;
  const _orientation = _globalOri || config.orientation || 'portrait';
  // tightMode: portrait + many columns → shrink font/padding to fit all cols
  const _numCols = config.columns ? config.columns.length : 1;
  const _tightMode = (_orientation === 'portrait' && _numCols >= 8);
  const doc = new jsPDFLib({ unit:'mm', format:'a4', orientation: _orientation });
  const pw = doc.internal.pageSize.getWidth();
  const hCol = config.headerColor || [44,111,173];
  const aCol = config.accentColor || [30,58,95];
  const now = new Date();
  const genDate = now.getDate().toString().padStart(2,'0')+'/'+(now.getMonth()+1).toString().padStart(2,'0')+'/'+now.getFullYear();
  const ML = 14;  // side margin (left/right) — balanced for readability
  const TM = 15;  // top margin — balanced for readability

  // ── HEADER BOX ──
  doc.setFillColor(219,234,254);
  doc.roundedRect(ML, TM, pw-(ML*2), 28, 3, 3, 'F');
  doc.setDrawColor(191,219,254);
  doc.roundedRect(ML, TM, pw-(ML*2), 28, 3, 3, 'S');

  // Strip emojis - jsPDF cannot render them (shows garbage chars)
  function _stripEmoji(s){ return (s||'').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu,'').trim(); }

  doc.setFont('helvetica','bold');
  doc.setFontSize(16);
  doc.setTextColor(aCol[0],aCol[1],aCol[2]);
  doc.text(_stripEmoji(config.title||'Report'), pw/2, TM+10, {align:'center'});

  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(58,111,160);
  doc.text(_stripEmoji(config.subtitle||genDate), pw/2, TM+16, {align:'center'});

  if(config.badge){
    const badgeText = _stripEmoji(config.badge);
    const badgeW = Math.max(50, Math.min(150, badgeText.length * 2 + 16));
    doc.setFillColor(234,246,255);
    doc.roundedRect(pw/2-badgeW/2, TM+19, badgeW, 7, 2, 2, 'F');
    doc.setDrawColor(191,219,254);
    doc.roundedRect(pw/2-badgeW/2, TM+19, badgeW, 7, 2, 2, 'S');
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.5);
    doc.setTextColor(aCol[0],aCol[1],aCol[2]);
    doc.text(badgeText, pw/2, TM+24, {align:'center'});
  }

  let y = config.badge ? TM+34 : TM+32;

  // ── SUMMARY STRIP ──
  if(config.summaryRows && config.summaryRows.length){
    const cellW = (pw-(ML*2)) / config.summaryRows.length;
    config.summaryRows.forEach((row, i)=>{
      const x = ML + i * cellW;
      const c = row[2] || [30,58,95];
      const bg = Array.isArray(c) ? [Math.min(255,c[0]+180), Math.min(255,c[1]+180), Math.min(255,c[2]+180)] : [220,240,255];
      doc.setFillColor(bg[0],bg[1],bg[2]);
      doc.rect(x, y, cellW, 18, 'F');
      doc.setDrawColor(200,220,245);
      doc.rect(x, y, cellW, 18, 'S');
      doc.setFont('helvetica','bold');
      doc.setFontSize(7);
      doc.setTextColor(Array.isArray(c)?c[0]:80, Array.isArray(c)?c[1]:80, Array.isArray(c)?c[2]:80);
      doc.text(_stripEmoji(row[0]), x+cellW/2, y+6, {align:'center'});
      doc.setFont('helvetica','bold');
      doc.setFontSize(11);
      doc.setTextColor(Array.isArray(c)?c[0]:30, Array.isArray(c)?c[1]:30, Array.isArray(c)?c[2]:30);
      doc.text(_stripEmoji(String(row[1]||'')), x+cellW/2, y+13, {align:'center'});
    });
    y += 22;
  }

  // ── ENTRIES COUNT ──
  if(config.entriesLabel){
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(108,117,125);
    doc.text(_stripEmoji(config.entriesLabel), ML, y);
    doc.setDrawColor(191,219,254);
    doc.line(ML, y+1.5, pw-ML, y+1.5);
    y += 6;
  }

  // ── MAIN TABLE ──
  // Auto column width: scan all rows+header to find max content length per col,
  // then distribute table width proportionally — prevents property name breaks.
  const usableW = pw - (ML * 2);
  const numCols = config.columns ? config.columns.length : 1;

  // Keywords that indicate a wide text column (gets +40% bias)
  const wideKeywords   = /property|name|desc|detail|note|purpose|categ|narr|tenant/i;
  // Keywords that indicate a truly narrow column — only pure codes/IDs (gets −20% bias)
  const narrowKeywords = /^(type|src|source|ref|pct|%|spo2|bp|wt)$/i;

  // Measure max char length per column across header + all rows + totals
  const maxLen = Array(numCols).fill(0);
  (config.columns||[]).forEach((h,i)=>{ maxLen[i]=Math.max(maxLen[i],(h||'').length); });
  (config.rows||[]).forEach(row=>{ (row||[]).forEach((cell,i)=>{ if(i<numCols) maxLen[i]=Math.max(maxLen[i],String(cell||'').length); }); });
  if(config.totalsRow){ (config.totalsRow||[]).forEach((cell,i)=>{ if(i<numCols) maxLen[i]=Math.max(maxLen[i],String(cell||'').length); }); }

  // Minimum mm width per column — ensures no word ever breaks letter by letter
  // At ~2.1px/mm and font 8.5pt, each char ≈ 1.8mm wide; 6 chars = ~11mm minimum
  const minColMM = 11;

  // Apply keyword bias
  const weights = (config.columns||[]).map((h,i)=>{
    // Use actual max content length as the base (not header keyword alone)
    let w = Math.max(maxLen[i], 6);  // floor of 6 chars
    if(wideKeywords.test(h))   w = Math.max(w, Math.round(w * 1.4));
    if(narrowKeywords.test(h)) w = Math.max(6, Math.round(w * 0.8));
    return w;
  });
  const totalW = weights.reduce((a,b)=>a+b,0) || 1;

  // Build columnStyles: distribute usable width proportionally with a per-col minimum
  const callerStyles = config.colStyles || {};
  const autoColStyles = {};

  // Check if all columns have explicit cellWidth — if so, scale to fit usableW exactly
  const explicitKeys = Object.keys(callerStyles).filter(k=>callerStyles[k]&&typeof callerStyles[k].cellWidth==='number');
  const allExplicit = explicitKeys.length === numCols;

  if(allExplicit){
    // Scale all explicit widths proportionally so their sum = usableW exactly
    const totalExplicit = explicitKeys.reduce((s,k)=>s+(callerStyles[k].cellWidth||0), 0);
    const scaleF = totalExplicit > 0 ? usableW / totalExplicit : 1;
    for(let i=0; i<numCols; i++){
      const caller = callerStyles[i] || {};
      const scaledW = parseFloat(((caller.cellWidth||0) * scaleF).toFixed(2));
      autoColStyles[i] = Object.assign({}, caller, { cellWidth: scaledW });
    }
  } else {
    // Auto-size based on content length
    const rawWidths = weights.map(w => parseFloat(((w / totalW) * usableW).toFixed(2)));
    const clamped = rawWidths.map(w => Math.max(w, minColMM));
    const clampedTotal = clamped.reduce((a,b)=>a+b,0);
    const scale = clampedTotal > usableW ? usableW / clampedTotal : 1;
    weights.forEach((w,i)=>{
      const fw = parseFloat((clamped[i] * scale).toFixed(2));
      const caller = callerStyles[i] || {};
      autoColStyles[i] = Object.assign({ cellWidth: fw }, caller);
      if(typeof caller.cellWidth==='number') autoColStyles[i].cellWidth = parseFloat((caller.cellWidth*scale).toFixed(2));
    });
  }

  doc.autoTable({
    startY: y,
    head: [config.columns],
    body: config.rows,
    foot: config.totalsRow ? [config.totalsRow] : [],
    showFoot: config.totalsRow ? 'lastPage' : 'never',
    // ── tableWidth: 'wrap' tells autoTable to use ONLY the columnStyles widths ──
    // This is the correct jsPDF-autotable way — 'tableWidth' numeric is NOT supported
    tableWidth: 'wrap',
    margin: {left:ML, right:ML, top:15, bottom:14},
    styles:{
      fontSize: _tightMode ? 6.5 : 8,
      cellPadding: _tightMode ? 1.5 : 2,
      overflow: 'linebreak',
      valign: 'top',
      lineColor: [226,232,240],
      lineWidth: 0.2,
      cellWidth: 'wrap',
    },
    headStyles:{
      fillColor: hCol,
      textColor: [255,255,255],
      fontStyle: 'bold',
      fontSize: _tightMode ? 6 : 7.5,
      cellPadding: _tightMode ? 1.5 : 2,
    },
    footStyles:{
      fillColor: [219,234,254],
      textColor: aCol,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles:{ fillColor:[248,250,255] },
    columnStyles: autoColStyles,
    didDrawPage: function(data){
      doc.setFont('helvetica','normal');
      doc.setFontSize(7);
      doc.setTextColor(150,150,150);
      doc.text('Generated: '+genDate+' | Raman Kumar Dashboard', pw/2, doc.internal.pageSize.getHeight()-5, {align:'center'});
      doc.text('Page '+data.pageNumber, pw-ML, doc.internal.pageSize.getHeight()-5, {align:'right'});
    }
  });

  doc.save(config.filename || 'report.pdf');
}

// ── Title Case Helper (for proper text capitalization) ──
function toTitleCase(str){
  if(!str||typeof str!=='string')return str||'';
  return str.replace(/\w\S*/g,function(txt){
    return txt.charAt(0).toUpperCase()+txt.substr(1).toLowerCase();
  });
}

// ── Date Normalization Helper (for smart search) ──
function normalizeSearchDate(input){
  if(!input||typeof input!=='string')return null;
  var s=input.trim();
  
  // Format 1: DD/MM/YY or DD/MM/YYYY
  var m1=/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if(m1){
    var d=m1[1],mo=m1[2],y=m1[3];
    if(y.length===2)y='20'+y;
    return y+'-'+mo.padStart(2,'0')+'-'+d.padStart(2,'0');
  }
  
  // Format 2: DD-MM-YYYY or DD-MM-YY
  var m2=/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/.exec(s);
  if(m2){
    var d=m2[1],mo=m2[2],y=m2[3];
    if(y.length===2)y='20'+y;
    return y+'-'+mo.padStart(2,'0')+'-'+d.padStart(2,'0');
  }
  
  // Format 3: DD.MM.YYYY or DD.MM.YY
  var m3=/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(s);
  if(m3){
    var d=m3[1],mo=m3[2],y=m3[3];
    if(y.length===2)y='20'+y;
    return y+'-'+mo.padStart(2,'0')+'-'+d.padStart(2,'0');
  }
  
  // Format 4: DD Month YYYY (e.g., 21 March 2026)
  var months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
    january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
  var m4=/^(\d{1,2})\s+(\w+)\s+(\d{4})$/.exec(s.toLowerCase());
  if(m4){
    var d=m4[1],mo=months[m4[2].substr(0,3)],y=m4[3];
    if(mo)return y+'-'+String(mo).padStart(2,'0')+'-'+d.padStart(2,'0');
  }
  
  return null;
}

// ── Safe Delete System with Undo ──
window._undoStack=null;
window._undoTimer=null;

function showUndoSnackbar(message,undoCallback,duration){
  duration=duration||5000;
  // Remove existing snackbar
  var existing=document.getElementById('undoSnackbar');
  if(existing)existing.remove();
  if(window._undoTimer)clearTimeout(window._undoTimer);
  
  // Create snackbar
  var snackbar=document.createElement('div');
  snackbar.id='undoSnackbar';
  snackbar.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#323232;color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);z-index:9999;display:flex;align-items:center;gap:16px;font-size:.88rem;animation:slideUp 0.3s ease;pointer-events:auto;';
  
  var msg=document.createElement('span');
  msg.textContent=message;
  snackbar.appendChild(msg);
  
  var undoBtn=document.createElement('button');
  undoBtn.textContent='UNDO';
  undoBtn.style.cssText='background:#4CAF50;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:700;font-size:.82rem;';
  undoBtn.onclick=function(){
    if(undoCallback)undoCallback();
    snackbar.remove();
    if(window._undoTimer)clearTimeout(window._undoTimer);
  };
  snackbar.appendChild(undoBtn);
  
  var closeBtn=document.createElement('button');
  closeBtn.textContent='✕';
  closeBtn.style.cssText='background:transparent;color:#fff;border:none;cursor:pointer;font-size:1.2rem;padding:0 6px;opacity:0.7;';
  closeBtn.onclick=function(){snackbar.remove();if(window._undoTimer)clearTimeout(window._undoTimer);};
  snackbar.appendChild(closeBtn);
  
  document.body.appendChild(snackbar);
  
  // Auto-hide after duration
  window._undoTimer=setTimeout(function(){
    snackbar.style.pointerEvents='none'; // stop blocking clicks during fade
    snackbar.style.animation='slideDown 0.3s ease';
    setTimeout(function(){snackbar.remove();},300);
  },duration);
}

function safeDelete(itemName,deleteCallback,restoreCallback){
  // Step 1: First confirmation
  if(!confirm('Delete "'+itemName+'"?\n\nThis will be permanently removed.')){
    return false;
  }
  
  // Step 2: Second confirmation
  if(!confirm('Are you absolutely sure?\n\nClick OK to confirm deletion.')){
    return false;
  }
  
  // Step 3: Execute delete
  var success=deleteCallback();
  if(!success)return false;
  
  // Step 4: Show undo notification
  showUndoSnackbar('Item deleted',function(){
    if(restoreCallback)restoreCallback();
  },5000);
  
  return true;
}

// Animation keyframes (inject into style)
if(!document.getElementById('undoAnimations')){
  var style=document.createElement('style');
  style.id='undoAnimations';
  style.textContent='@keyframes slideUp{from{bottom:-60px;opacity:0;}to{bottom:20px;opacity:1;}}@keyframes slideDown{from{bottom:20px;opacity:1;}to{bottom:-60px;opacity:0;}}';
  document.head.appendChild(style);
}

// ═══════════════════════════════
// APP
// ═══════════════════════════════

// Global todo widget helper - avoids quote nesting inside template literals
function _renderTodoWidget(){
  var KEY='rk_todos';
  var todos;
  try{ todos=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ todos=[]; }
  todos=(Array.isArray(todos)?todos:[]).map(function(x){ if(!x||typeof x!=='object') return x; var next=Object.assign({},x); delete next.priority; return next; });
  var today=new Date().toISOString().split('T')[0];
  // Preserve user-defined order (so ▲▼ buttons work correctly)
  var allPend=todos.filter(function(x){return !x.done;});
  var pend=allPend.slice(0,5);
  var btnStyle='background:none;border:none;cursor:pointer;padding:2px 5px;border-radius:4px;font-size:.8rem;line-height:1;';
  var rows=pend.map(function(x,idx){
    var isOver=x.dueDate&&x.dueDate<today;
    var isToday=x.dueDate&&x.dueDate===today;
    var dueColor=isOver?'#e53935':isToday?'#e09050':'#b89000';
    var dueLabel=isOver?'⚠️':isToday?'📅 Today':x.dueDate?('📅 '+x.dueDate):'';
    var due=dueLabel?('<span style="font-size:.6rem;color:'+dueColor+';font-weight:700;white-space:nowrap;">'+dueLabel+'</span>'):'';
    var recIcon=x.recurring&&x.recurring!=='none'?'<span style="font-size:.6rem;color:var(--acc);">🔁</span>':'';
    var canUp=idx>0;
    var canDown=idx<pend.length-1;
    return '<div style="display:flex;align-items:center;gap:5px;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:.81rem;'+(isOver?'background:#fff8f8;':'')+'">'
      // checkbox
      +'<input type="checkbox" onchange="APP.toggleTodo(\''+x.id+'\');APP.renderHome();APP.renderPills()" style="width:16px;height:16px;cursor:pointer;accent-color:#1a7a45;flex-shrink:0;">'
      // task text
      +'<span style="flex:1;word-break:break-word;min-width:0;">'+x.text+'</span>'
      // due + recurring
      +due+recIcon
      // move up
      +'<button onclick="_homeTodoMove(\''+x.id+'\',\'up\')" title="Move up" style="'+btnStyle+(canUp?'color:#2c6fad;':'color:#ccc;pointer-events:none;')+'" '+(canUp?'':'disabled')+'>▲</button>'
      // move down
      +'<button onclick="_homeTodoMove(\''+x.id+'\',\'down\')" title="Move down" style="'+btnStyle+(canDown?'color:#2c6fad;':'color:#ccc;pointer-events:none;')+'" '+(canDown?'':'disabled')+'>▼</button>'
      // delete
      +'<button onclick="_homeTodoDel(\''+x.id+'\')" title="Delete" style="'+btnStyle+'color:#e53935;" >🗑</button>'
      +'</div>';
  });
  var moreNote=allPend.length>5?'<div style="font-size:.68rem;color:var(--mut);padding:4px 0;text-align:center;">+' +(allPend.length-5)+' more — <span style="color:var(--acc);cursor:pointer;" onclick="APP.goTab(\'todo\')">Open Full →</span></div>':'';
  var inp='<div style="margin-top:8px;display:flex;flex-direction:column;gap:5px;">'
    +'<div style="display:flex;gap:5px;">'
    +'<input id="homeTodoInput" onkeydown="if(event.keyCode===13)_homeTodoAdd()" style="flex:1;background:var(--bg);border:1.5px solid var(--bdr2);border-radius:7px;padding:6px 10px;font-family:Nunito,sans-serif;font-size:.79rem;outline:none;" placeholder="Add task...">'
    +'</div>'
    +'<button onclick="_homeTodoAdd()" style="background:#2c6fad;color:#fff;border:none;border-radius:7px;padding:6px 13px;font-family:Nunito,sans-serif;font-size:.82rem;font-weight:800;cursor:pointer;width:100%;">＋ Add Task</button>'
    +'</div>';
  return (pend.length?rows.join('')+moreNote:'<div style="color:var(--mut);font-size:.81rem;padding:4px 0;">All tasks done! 🎉</div>')+inp;
}

// Delete from dashboard
function _homeTodoDel(id){
  if(!id) return;
  if(typeof APP!=='undefined'&&APP.saveTodos){
    APP.saveTodos(APP.todos.filter(function(t){return t.id!==id;}));
    APP.renderHome(); APP.renderPills();
  } else {
    var KEY='rk_todos';
    var arr; try{arr=JSON.parse(localStorage.getItem(KEY)||'[]');}catch{arr=[];}
    localStorage.setItem(KEY,JSON.stringify(arr.filter(function(t){return t.id!==id;})));
    if(typeof APP!=='undefined'){APP.renderHome();APP.renderPills();}
  }
}

// Move task up/down among PENDING tasks only
function _homeTodoMove(id, dir){
  if(!id) return;
  var todos;
  if(typeof APP!=='undefined'&&APP.todos!==undefined){ todos=APP.todos.slice(); }
  else{ try{todos=JSON.parse(localStorage.getItem('rk_todos')||'[]');}catch{return;} }
  // Work only on pending tasks
  var pending=todos.filter(function(t){return !t.done;});
  var done=todos.filter(function(t){return t.done;});
  var idx=pending.findIndex(function(t){return t.id===id;});
  if(idx<0) return;
  var swapIdx=dir==='up'?idx-1:idx+1;
  if(swapIdx<0||swapIdx>=pending.length) return;
  var tmp=pending[idx]; pending[idx]=pending[swapIdx]; pending[swapIdx]=tmp;
  var reordered=pending.concat(done);
  if(typeof APP!=='undefined'&&APP.saveTodos){ APP.saveTodos(reordered); APP.renderHome(); APP.renderPills(); }
  else{ localStorage.setItem('rk_todos',JSON.stringify(reordered)); if(typeof APP!=='undefined'){APP.renderHome();APP.renderPills();} }
}
function _homeTodoAdd(){
  var el=document.getElementById('homeTodoInput');
  if(!el||!el.value.trim()) return;
  var txt=el.value.trim();
  // Save via APP.saveTodos so Firebase sync happens too
  if(typeof APP!=='undefined'&&APP.saveTodos&&APP.todos!==undefined){
    var arr=APP.todos;
    arr.push({id:'t'+Date.now(),text:txt,done:false,dueDate:'',recurring:'none',created:new Date().toISOString()});
    APP.saveTodos(arr);
    el.value='';
    APP.renderHome();APP.renderPills();
  } else {
    // Fallback if APP not ready
    var KEY='rk_todos';
    var arr2; try{ arr2=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ arr2=[]; }
    arr2.push({id:'t'+Date.now(),text:txt,done:false,dueDate:'',recurring:'none',created:new Date().toISOString()});
    localStorage.setItem(KEY,JSON.stringify(arr2));
    el.value='';
    if(typeof APP!=='undefined'){APP.renderHome();APP.renderPills();}
  }
}

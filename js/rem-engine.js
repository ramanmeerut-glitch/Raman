/* rem-engine.js — Android-style Reminder Engine (REM)
 * Full date-picker, time-picker, repeat configurator, before-reminder logic
 */

<script>
// ═══════════════════════════════════════════════════════════════
// REM — Android-style Reminder Engine
// ═══════════════════════════════════════════════════════════════
window.REM = (function(){
  'use strict';

  // State
  var state = {
    editId: null,
    selDate: null,      // Date object
    selHour: 9,         // 1-12
    selMin: 0,
    selAmPm: 'AM',
    beforeMin: 0,
    beforeLabel: 'No advance notice',
    repeatType: 'none',
    repeatEvery: 1,
    repeatDays: [],
    repeatMonthMode: 'date',
    repeatMonthDay: 1,
    repeatMonthWeek: 1,
    repeatMonthWeekday: 1,
    repeatEnds: 'never',
    repeatCount: 10,
    repeatEndDate: '',
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    tempDate: null,
    tempHour: 9,
    tempMin: 0,
    tempAmPm: 'AM',
  };

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var DAYS_SHORT = ['S','M','T','W','T','F','S'];

  // ── Open / Close ──────────────────────────────────────────
  function open(editId) {
    state.editId = editId || null;
    var overlay = document.getElementById('remM_overlay');
    if(!overlay) return;

    // Init defaults
    var now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    state.selDate  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    state.selHour  = now.getHours() % 12 || 12;
    state.selMin   = Math.ceil(now.getMinutes() / 5) * 5 % 60;
    state.selAmPm  = now.getHours() >= 12 ? 'PM' : 'AM';
    state.beforeMin   = 0;
    state.beforeLabel = '';
    state.beforeDays  = 0;
    state.repeatType     = 'none';
    state.repeatEvery    = 1;
    state.repeatDays     = [];
    state.repeatMonthMode= 'date';
    state.repeatMonthDay = 1;
    state.repeatMonthWeek= 1;
    state.repeatMonthWeekday = 1;
    state.repeatEnds     = 'never';
    state.repeatCount    = 10;
    state.repeatEndDate  = '';
    // Reset before dropdowns only if creating NEW reminder (not editing)
    if(!editId) {
      _resetBeforeDropdowns();
    }

    // Populate persons
    var personSel = document.getElementById('rem_person_sel');
    if(personSel && window.APP && window.APP.persons) {
      personSel.innerHTML = window.APP.persons.map(function(p){
        return '<option>'+p+'</option>';
      }).join('');
    }

    // If editing, populate fields
    if(editId && window.APP && window.APP.reminders) {
      var r = window.APP.reminders.find(function(x){ return x.id === editId; });
      if(r) {
        var ti = document.getElementById('rem_title_inp');
        var ni = document.getElementById('rem_note_inp');
        var ci = document.getElementById('rem_cat_sel');
        var pi = document.getElementById('rem_person_sel');
        var ei = document.getElementById('rem_exp_date');
        if(ti) ti.value = r.name || '';
        if(ni) ni.value = r.notes || '';
        if(ci) ci.value = r.type || '';
        if(pi) pi.value = r.person || '';
        if(ei) ei.value = r.exp || '';

        // Set date/time from trigDate — manual parse to avoid UTC 1-day bug
        if(r.trigDate || r.exp) {
          var _ds = (r.trigDate || r.exp).split('-');
          if(_ds.length === 3) {
            state.selDate = new Date(parseInt(_ds[0]), parseInt(_ds[1])-1, parseInt(_ds[2]), 0, 0, 0, 0);
          }
        }
        if(r.alertHour) {
          var h24 = parseInt(r.alertHour);
          state.selAmPm = h24 >= 12 ? 'PM' : 'AM';
          state.selHour = h24 % 12 || 12;
        }
        if(r.alertMin !== undefined) state.selMin = parseInt(r.alertMin) || 0;
        if(r.mode === 'recurring') {
          state.repeatType       = r.repeatType       || 'daily';
          state.repeatEvery      = r.repeatEvery      || 1;
          state.repeatDays       = r.repeatDays       || [];
          state.repeatMonthMode  = r.repeatMonthMode  || 'date';
          state.repeatMonthDay   = r.repeatMonthDay   || 1;
          state.repeatMonthWeek  = r.repeatMonthWeek  || 1;
          state.repeatMonthWeekday= r.repeatMonthWeekday!==undefined?r.repeatMonthWeekday:1;
          state.repeatEnds       = r.repeatEnds       || 'never';
          state.repeatCount      = r.repeatCount      || 10;
          state.repeatEndDate    = r.repeatEndDate     || '';
        }
        // ✅ Restore "Remind Before" dropdowns from saved data
        _restoreBeforeDropdowns(r);
      }
    } else {
      var ti = document.getElementById('rem_title_inp');
      var ni = document.getElementById('rem_note_inp');
      var ei = document.getElementById('rem_exp_date');
      if(ti) ti.value = '';
      if(ni) ni.value = '';
      if(ei) ei.value = '';
    }

    // Update header
    var ht = document.getElementById('remMT_new');
    if(ht) ht.textContent = editId ? 'Edit Reminder' : 'Add Reminder';

    // Update displays
    updateDateDisplay();
    updateTimeDisplay();
    updateBeforeDisplay();
    updateRepeatDisplay();

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';


  }

  function close() {
    var overlay = document.getElementById('remM_overlay');
    if(overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    closeAllPopups();
  }

  function closeAllPopups() {
    ['rem_date_picker','rem_time_picker','rem_before_popup','rem_repeat_popup'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });
  }

  // ── Display Updates ───────────────────────────────────────
  function updateDateDisplay() {
    var el = document.getElementById('rem_date_disp');
    if(!el) return;
    if(!state.selDate) { el.textContent = 'Select date'; el.style.color = '#666'; return; }
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    el.textContent = days[state.selDate.getDay()] + ', ' +
      MONTHS[state.selDate.getMonth()].slice(0,3) + ' ' + state.selDate.getDate() + ', ' + state.selDate.getFullYear();
    el.style.color = '#2196f3';
  }

  function updateTimeDisplay() {
    var el = document.getElementById('rem_time_disp');
    if(!el) return;
    var m = String(state.selMin).padStart(2,'0');
    el.textContent = state.selHour + ':' + m + ' ' + state.selAmPm;
    el.style.color = '#2196f3';
  }

  // updateBeforeDisplay — now a shim, real logic is in _showBeforePreview (defined later)
  function updateBeforeDisplay() {
    if(typeof _showBeforePreview === 'function') _showBeforePreview();
  }

  function _updateReminderDateFromBefore() {
    if(!state.selDate || !state.beforeMin) return;
    var rd = new Date(state.selDate.getTime());
    rd.setDate(rd.getDate() - state.beforeDays);
    state.reminderDate = rd;
  }

  function updateRepeatDisplay() {
    var el = document.getElementById('rem_repeat_disp');
    if(!el) return;
    if(!state.repeatType || state.repeatType==='none') {
      el.textContent = 'No repeat';
      el.style.color = '#888';
      return;
    }
    var lbl = _buildRepeatLabel({
      type: state.repeatType, every: state.repeatEvery,
      days: state.repeatDays||[], monthMode: state.repeatMonthMode,
      monthDay: state.repeatMonthDay, monthWeek: state.repeatMonthWeek,
      monthWeekday: state.repeatMonthWeekday,
      ends: state.repeatEnds, count: state.repeatCount, endDate: state.repeatEndDate
    });
    el.textContent = lbl || 'No repeat';
    el.style.color = lbl ? '#4fc3f7' : '#888';
  }

  // ── Save ─────────────────────────────────────────────────
  function save() {
    var rawTitle = (document.getElementById('rem_title_inp') || {}).value || '';
    var title = rawTitle.replace(/^["']|["']$/g,'').trim(); // strip accidental quotes
    if(!title.trim()) {
      alert('Please enter reminder title!');
      return;
    }
    if(!state.selDate) {
      alert('Please select a date!');
      return;
    }

    // Build trigger datetime — manual format (no toISOString UTC bug)
    var h24 = state.selAmPm === 'PM'
      ? (state.selHour === 12 ? 12 : state.selHour + 12)
      : (state.selHour === 12 ? 0 : state.selHour);
    var _sd = state.selDate;
    var trigDate = _sd.getFullYear() + '-' + String(_sd.getMonth()+1).padStart(2,'0') + '-' + String(_sd.getDate()).padStart(2,'0');
    var alertHour = String(h24).padStart(2,'00');
    var alertMin  = String(state.selMin).padStart(2,'00');

    // Validate not in past (today)
    var now = new Date();
    var trigDT = (function(){
      var _p = trigDate.split('-');
      return _p.length===3 ? new Date(parseInt(_p[0]),parseInt(_p[1])-1,parseInt(_p[2]),parseInt(alertHour),parseInt(alertMin),0,0) : null;
    })();
    var todayStr = now.toISOString().slice(0,10);
    if(trigDate === todayStr && trigDT < now) {
      if(!confirm('This time is in the past. Save anyway?')) return;
    }

    var note   = (document.getElementById('rem_note_inp') || {}).value || '';
    var cat    = (document.getElementById('rem_cat_sel') || {}).value || '';
    var person = (document.getElementById('rem_person_sel') || {}).value || '';
    var expDate= (document.getElementById('rem_exp_date') || {}).value || '';
    // ✅ Only store exp if user set it — do NOT auto-fallback to trigDate
    // This prevents "Expired Xd ago" on reminders that have no expiry

    var mode = state.repeatType !== 'none' ? 'recurring' : 'expiry';

    // ✅ Compute correct reminderDate from dueDate - beforeDays
    var reminderDate = trigDate;
    var beforeDays = state.beforeDays || 0;
    if(beforeDays > 0) {
      try {
        var _dp = trigDate.split('-');
        var _dObj = new Date(parseInt(_dp[0]), parseInt(_dp[1])-1, parseInt(_dp[2]), 0,0,0,0);
        _dObj.setDate(_dObj.getDate() - beforeDays);
        reminderDate = _dObj.getFullYear()+'-'+String(_dObj.getMonth()+1).padStart(2,'0')+'-'+String(_dObj.getDate()).padStart(2,'0');
      } catch(e){}
    }

    var data = {
      name:       title.trim(),
      type:       cat,
      category:   cat,
      person:     person,
      notes:      note,
      mode:       mode,
      trigDate:   trigDate,     // dueDate
      reminderDate: reminderDate, // actual alert date = dueDate - before
      exp:        expDate || '',
      alertHour:  alertHour,
      alertMin:   alertMin,
      before:     String(state.beforeMin),
      beforeLabel: state.beforeLabel,
      beforeDays: String(beforeDays),
      repeatType:        state.repeatType,
      repeatEvery:       state.repeatEvery,
      repeatDays:        state.repeatDays||[],
      repeatMonthMode:   state.repeatMonthMode||'date',
      repeatMonthDay:    state.repeatMonthDay||1,
      repeatMonthWeek:   state.repeatMonthWeek||1,
      repeatMonthWeekday:state.repeatMonthWeekday||1,
      repeatEnds:        state.repeatEnds||'never',
      repeatCount:       state.repeatCount||10,
      repeatEndDate:     state.repeatEndDate||'',
      repeatLabel:       _buildRepeatLabel({
        type:state.repeatType, every:state.repeatEvery,
        days:state.repeatDays||[], monthMode:state.repeatMonthMode,
        monthDay:state.repeatMonthDay, monthWeek:state.repeatMonthWeek,
        monthWeekday:state.repeatMonthWeekday,
        ends:state.repeatEnds, count:state.repeatCount, endDate:state.repeatEndDate
      }),
      // Legacy fields
      start:      reminderDate,
      issue:      '',
      autorenew:  'no',
      period:     '365',
    };

    if(!window.APP) { alert('App not ready'); return; }

    var rs = window.APP.reminders || [];
    if(state.editId) {
      rs = rs.map(function(r){ return r.id === state.editId ? Object.assign({},r,data) : r; });
    } else {
      data.id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
      rs.push(data);
    }

    // 1. Save to localStorage immediately (instant, offline-safe)
    localStorage.setItem('rk_reminders', JSON.stringify(rs));

    // 2. Save to Firebase with explicit confirmation
    if(window.fbSave) {
      window.fbSave('reminders', rs)
        .then(function() {
          if(window.APP && window.APP.showToastMsg) {
            window.APP.showToastMsg('✅ Reminder saved & synced to cloud!');
          }
        })
        .catch(function(e) {
          // Already queued for retry by fbSave — show pending message
          if(window.APP && window.APP.showToastMsg) {
            window.APP.showToastMsg('💾 Saved locally. Will sync when online.');
          }
        });
    } else if(window.S) {
      S.set('reminders', rs);
    }

    close();
    if(window.APP.renderReminders) window.APP.renderReminders();
    if(window.APP.renderPills) window.APP.renderPills();


  }

  // ── Date Picker ───────────────────────────────────────────
  function openDatePicker() {
    if(state.selDate) {
      state.calYear  = state.selDate.getFullYear();
      state.calMonth = state.selDate.getMonth();
    } else {
      var n = new Date();
      state.calYear  = n.getFullYear();
      state.calMonth = n.getMonth();
    }
    state.tempDate = state.selDate ? new Date(state.selDate) : new Date();
    renderCalendar();
    var p = document.getElementById('rem_date_picker');
    if(p) p.style.display = 'flex';
  }

  function renderCalendar() {
    var t = document.getElementById('rem_cal_title');
    if(t) t.textContent = MONTHS[state.calMonth];
    // Populate year dropdown (current year-5 to current year+30)
    var ySel = document.getElementById('rem_year_sel');
    if(ySel) {
      var curY = new Date().getFullYear();
      var minY = curY - 10; var maxY = curY + 30;
      if(!ySel.options.length || parseInt(ySel.value) !== state.calYear) {
        ySel.innerHTML = '';
        for(var y2=minY; y2<=maxY; y2++) {
          var opt = document.createElement('option');
          opt.value = y2; opt.textContent = y2;
          if(y2===state.calYear) opt.selected = true;
          ySel.appendChild(opt);
        }
      } else {
        ySel.value = state.calYear;
      }
    }
    var grid = document.getElementById('rem_cal_grid');
    if(!grid) return;

    var fd  = new Date(state.calYear, state.calMonth, 1).getDay();
    var dim = new Date(state.calYear, state.calMonth+1, 0).getDate();
    var today = new Date(); today.setHours(0,0,0,0);
    var selD = state.tempDate;

    var html = '';
    for(var i=0; i<fd; i++) html += '<div></div>';
    for(var d=1; d<=dim; d++) {
      var dt = new Date(state.calYear, state.calMonth, d);
      var isToday = dt.getTime() === today.getTime();
      var isSel   = selD && dt.toDateString() === selD.toDateString();
      var bg = isSel ? '#2196f3' : isToday ? '#2196f320' : 'transparent';
      var col= isSel ? '#fff' : isToday ? '#2196f3' : '#ccc';
      var fw = (isSel || isToday) ? '800' : '400';
      html += '<div onclick="window.REM.selectDay('+d+')" style="text-align:center;padding:7px 2px;border-radius:50%;background:'+bg+';color:'+col+';font-weight:'+fw+';font-size:.82rem;cursor:pointer;">'+d+'</div>';
    }
    grid.innerHTML = html;
  }

  function selectDay(d) {
    state.tempDate = new Date(state.calYear, state.calMonth, d);
    renderCalendar();
  }

  function calPrev() {
    state.calMonth--;
    if(state.calMonth < 0) { state.calMonth=11; state.calYear--; }
    renderCalendar();
  }

  function calNext() {
    state.calMonth++;
    if(state.calMonth > 11) { state.calMonth=0; state.calYear++; }
    renderCalendar();
  }

  function confirmDate() {
    state.selDate = state.tempDate;
    updateDateDisplay();
    closeDatePicker();
  }

  function closeDatePicker() {
    var p = document.getElementById('rem_date_picker');
    if(p) p.style.display = 'none';
  }

  function clearDate() {
    state.selDate = null;
    updateDateDisplay();
  }

  // ── Time Picker (wheel) ───────────────────────────────────
  function openTimePicker() {
    state.tempHour  = state.selHour;
    state.tempMin   = state.selMin;
    state.tempAmPm  = state.selAmPm;
    buildScrollWheels();
    setAmPmUI(state.tempAmPm);
    updateTimePreviewLabel();
    var p = document.getElementById('rem_time_picker');
    if(p) p.style.display = 'flex';
  }

  // ── Build scroll-snap wheels ──────────────────────────────
  function buildScrollWheels() {
    buildHrWheel();
    buildMinWheel();
  }

  var _hrScrolling = false, _minScrolling = false;

  function buildHrWheel() {
    var items = document.getElementById('rem_hr_items');
    if(!items) return;
    var html = '';
    for(var h = 1; h <= 12; h++) {
      html += '<div style="height:44px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;color:rgba(255,255,255,.9);scroll-snap-align:center;cursor:pointer;" '
            + 'onclick="window.REM._selectHr('+h+')">'
            + h + '</div>';
    }
    items.innerHTML = html;
    // Scroll to selected hour
    setTimeout(function(){
      scrollToItem('rem_hr_scroll', state.tempHour - 1, 44);
    }, 50);
  }

  function buildMinWheel() {
    var items = document.getElementById('rem_min_items');
    if(!items) return;
    var html = '';
    for(var m = 0; m <= 59; m++) {
      html += '<div style="height:44px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;color:rgba(255,255,255,.9);scroll-snap-align:center;cursor:pointer;" '
            + 'onclick="window.REM._selectMin('+m+')">'
            + String(m).padStart(2,'0') + '</div>';
    }
    items.innerHTML = html;
    // Scroll to selected minute
    setTimeout(function(){
      scrollToItem('rem_min_scroll', state.tempMin, 44);
    }, 50);
  }

  function scrollToItem(scrollId, idx, itemH) {
    var el = document.getElementById(scrollId);
    if(!el) return;
    el.scrollTop = idx * itemH;
    if(el.scrollHeight > 0) {
      el.scrollTo({ top: idx * itemH, behavior: 'smooth' });
    }
  }

  function _onHrScroll(el) {
    clearTimeout(el._scrollTimer);
    el._scrollTimer = setTimeout(function(){
      var idx = Math.round(el.scrollTop / 44);
      idx = Math.max(0, Math.min(11, idx));
      state.tempHour = idx + 1;
      el.scrollTop = idx * 44;
      updateTimePreviewLabel();
    }, 80);
  }

  function _onMinScroll(el) {
    clearTimeout(el._scrollTimer);
    el._scrollTimer = setTimeout(function(){
      var idx = Math.round(el.scrollTop / 44);
      idx = Math.max(0, Math.min(59, idx));
      state.tempMin = idx;
      el.scrollTop = idx * 44;
      updateTimePreviewLabel();
    }, 80);
  }

  function _selectHr(h) {
    state.tempHour = h;
    scrollToItem('rem_hr_scroll', h - 1, 44);
    updateTimePreviewLabel();
  }

  function _selectMin(m) {
    state.tempMin = m;
    scrollToItem('rem_min_scroll', m, 44);
    updateTimePreviewLabel();
  }

  // Legacy wheelItem / scrollWheelTo / attachWheelDrag — kept as stubs
  function wheelItem(val){ return ''; }
  function scrollWheelTo(w,v,mn,mx){}
  function attachWheelDrag(w,mn,mx,cb){}


  function setAmPm(ap) {
    state.tempAmPm = ap;
    setAmPmUI(ap);
    updateTimePreviewLabel();
  }

  function setQuickTime(h, m, ap) {
    state.tempHour  = h;
    state.tempMin   = m;
    state.tempAmPm  = ap;
    setAmPmUI(ap);
    updateTimePreviewLabel();
    // Scroll to correct position
    setTimeout(function(){
      scrollToItem('rem_hr_scroll', h - 1, 44);
      scrollToItem('rem_min_scroll', m, 44);
    }, 30);
  }

  function updateTimePreviewLabel() {
    var lbl = document.getElementById('rem_time_preview_lbl');
    if(!lbl) return;
    var mm  = String(state.tempMin).padStart(2,'0');
    lbl.textContent = state.tempHour + ':' + mm + ' ' + state.tempAmPm;
  }

  function setAmPmUI(ap) {
    var am = document.getElementById('rem_ampm_am');
    var pm = document.getElementById('rem_ampm_pm');
    if(am) { am.style.background = ap==='AM' ? '#2196f3' : '#2a2f3a'; am.style.color = ap==='AM' ? '#fff' : '#888'; }
    if(pm) { pm.style.background = ap==='PM' ? '#2196f3' : '#2a2f3a'; pm.style.color = ap==='PM' ? '#fff' : '#888'; }
  }

  function confirmTime() {
    state.selHour  = state.tempHour;
    state.selMin   = state.tempMin;
    state.selAmPm  = state.tempAmPm;
    updateTimeDisplay();
    closeTimePicker();
  }

  function closeTimePicker() {
    var p = document.getElementById('rem_time_picker');
    if(p) p.style.display = 'none';
  }

  function clearTime() {
    // Reset to default
    state.selHour = 9; state.selMin = 0; state.selAmPm = 'AM';
    updateTimeDisplay();
  }

  // ═══════════════════════════════════════════════════════
  // REMIND BEFORE — Clean dropdown system
  // Flow: user picks Unit → number dropdown appears → user picks number
  //       → state updated → preview shown → saved correctly
  // ═══════════════════════════════════════════════════════

  var BEFORE_UNIT_MAX  = { Minutes:60, Hours:24, Days:30, Weeks:52, Months:12, Years:20 };
  var BEFORE_UNIT_MINS = { Minutes:1,  Hours:60, Days:1440, Weeks:10080, Months:43200, Years:525600 };

  // Called when user changes the UNIT dropdown
  function onBeforeUnitChange() {
    // Skip if we're restoring from saved data
    if(window._restoringBefore) {
      return;
    }

    var unitSel = document.getElementById('rem_before_unit');
    var numSel  = document.getElementById('rem_before_num');
    if(!unitSel || !numSel) return;
    var unit = unitSel.value;

    if(unit === 'none') {
      // Hide number dropdown, clear state
      numSel.style.display = 'none';
      state.beforeMin   = 0;
      state.beforeDays  = 0;
      state.beforeLabel = '';
      _showBeforePreview();
      return;
    }

    // Populate number dropdown for chosen unit
    var max = BEFORE_UNIT_MAX[unit] || 30;
    var html = '';
    for(var i = 1; i <= max; i++) html += '<option value="'+i+'">'+i+'</option>';
    numSel.innerHTML = html;
    numSel.value = '1';
    numSel.style.display = 'block';   // show it

    // Apply state for default = 1
    _applyBefore(1, unit);
  }

  // Called when user changes the NUMBER dropdown
  function onBeforeNumChange() {
    var unitSel = document.getElementById('rem_before_unit');
    var numSel  = document.getElementById('rem_before_num');
    if(!unitSel || !numSel) return;
    var unit = unitSel.value;
    var num  = parseInt(numSel.value) || 1;
    _applyBefore(num, unit);
  }

  // Kept for backward compat (old name used in HTML onchange attr)
  function onBeforeDropdownChange() { onBeforeNumChange(); }

  // Core: apply a number+unit to state and refresh preview
  function _applyBefore(num, unit) {
    if(!unit || unit === 'none' || !num) {
      state.beforeMin = 0; state.beforeDays = 0; state.beforeLabel = '';
      _showBeforePreview(); return;
    }
    var minsPerUnit  = BEFORE_UNIT_MINS[unit] || 1440;
    state.beforeMin  = num * minsPerUnit;
    state.beforeDays = Math.round(state.beforeMin / 1440);   // for date math
    // Exact label: "1 day before", "18 days before", "1 month before" etc.
    var u = unit.toLowerCase();
    if(num === 1 && u.endsWith('s')) u = u.slice(0, -1);    // "days" → "day"
    state.beforeLabel = num + ' ' + u + ' before';
    _showBeforePreview();
  }

  // Update the preview text under the dropdowns
  function _showBeforePreview() {
    var disp = document.getElementById('rem_before_disp');
    var hint = document.getElementById('rem_before_days_hint');
    if(disp) {
      if(state.beforeMin > 0 && state.beforeLabel) {
        disp.textContent = '🔔 Remind: ' + state.beforeLabel;
        disp.style.display = 'block';
      } else {
        disp.style.display = 'none';
      }
    }
    if(hint) {
      if(state.beforeDays > 0) {
        // Also show what the actual reminder date will be
        var remDateStr = '';
        if(state.selDate) {
          var rd = new Date(state.selDate.getTime());
          rd.setDate(rd.getDate() - state.beforeDays);
          var dd=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          remDateStr = ' → Alert: ' + dd[rd.getDay()] + ' ' + rd.getDate() + ' ' +
                       MONTHS[rd.getMonth()].slice(0,3) + ' ' + rd.getFullYear();
        }
        hint.textContent = '= ' + state.beforeDays + ' day' + (state.beforeDays>1?'s':'') + ' before due date' + remDateStr;
        hint.style.display = 'block';
      } else {
        hint.style.display = 'none';
      }
    }
  }

  // Alias used in updateBeforeDisplay calls throughout the file
  function updateBeforeDisplay() { _showBeforePreview(); }

  // Reset both dropdowns to "no advance" state (called on modal open)
  function _resetBeforeDropdowns() {
    var unitSel = document.getElementById('rem_before_unit');
    var numSel  = document.getElementById('rem_before_num');
    if(unitSel) unitSel.value = 'none';
    if(numSel)  { numSel.innerHTML = ''; numSel.style.display = 'none'; }
    state.beforeMin = 0; state.beforeDays = 0; state.beforeLabel = '';
    _showBeforePreview();
  }

  // Restore before value when EDITING an existing reminder
  function _restoreBeforeDropdowns(r) {
    if(!r) return;
    // Try to restore from beforeLabel first (most accurate)
    var label = r.beforeLabel || '';
    var beforeMins = parseInt(r.before) || 0;   // r.before stores minutes
    if(!beforeMins && r.beforeDays) beforeMins = parseInt(r.beforeDays) * 1440;
    if(!beforeMins) return;   // no before set

    // Figure out unit + num from stored minutes
    var bestUnit = 'Days', bestNum = 1;
    if(beforeMins % 525600 === 0 && beforeMins >= 525600) { bestUnit='Years';   bestNum=beforeMins/525600; }
    else if(beforeMins % 43200 === 0 && beforeMins >= 43200) { bestUnit='Months'; bestNum=beforeMins/43200; }
    else if(beforeMins % 10080 === 0 && beforeMins >= 10080) { bestUnit='Weeks';  bestNum=beforeMins/10080; }
    else if(beforeMins % 1440 === 0  && beforeMins >= 1440)  { bestUnit='Days';   bestNum=beforeMins/1440;  }
    else if(beforeMins % 60 === 0    && beforeMins >= 60)    { bestUnit='Hours';  bestNum=beforeMins/60;    }
    else                                                       { bestUnit='Minutes'; bestNum=beforeMins;     }

    // Set unit dropdown WITHOUT triggering onchange
    var unitSel = document.getElementById('rem_before_unit');
    var numSel  = document.getElementById('rem_before_num');
    if(!unitSel || !numSel) return;
    
    // Check current value - only set if different to avoid triggering change
    var needsUnitChange = unitSel.value !== bestUnit;
    if(needsUnitChange) {
      // Temporarily disable by setting a flag instead of removing handler
      window._restoringBefore = true;
      unitSel.value = bestUnit;
    }

    // Populate number dropdown
    var max = BEFORE_UNIT_MAX[bestUnit] || 30;
    // If saved number exceeds max, extend the max to accommodate it
    if(bestNum > max) max = bestNum;
    var html = '';
    for(var i = 1; i <= max; i++) html += '<option value="'+i+'">'+i+'</option>';
    numSel.innerHTML = html;
    
    // Set value - dropdown is repopulated so onchange won't fire yet
    numSel.value = String(bestNum);
    numSel.style.display = 'block';
    
    // Clear the flag
    window._restoringBefore = false;

    _applyBefore(bestNum, bestUnit);
  }

  // Stubs for backward compat
  function openRemindBefore() {}
  function showMoreBefore()   {}
  function confirmBefore()    { _showBeforePreview(); closeBeforePopup(); }
  function closeBeforePopup() { var p=document.getElementById('rem_before_popup'); if(p) p.style.display='none'; }
  function setBeforeQuick(mins, label) {
    state.beforeMin = mins; state.beforeLabel = label;
    state.beforeDays = Math.round(mins/1440); _showBeforePreview();
  }

  function parseTimeString(val) {
    if(!val) return 0;
    val = val.toString().trim().toLowerCase();
    if(/^\d+$/.test(val)) return parseInt(val,10);
    var num=parseFloat(val); if(isNaN(num)) return 0;
    if(/d(ay)?s?/.test(val))   return Math.round(num*1440);
    if(/h(our)?s?/.test(val))  return Math.round(num*60);
    if(/m(in(ute)?s?)?/.test(val)) return Math.round(num);
    if(/w(eek)?s?/.test(val))  return Math.round(num*10080);
    return Math.round(num);
  }

  // ── Repeat ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════
  // FULL REPEAT MODULE — Android/iOS parity
  // Supports: hourly/daily/weekdays/weekends/weekly/biweekly/monthly/
  //           quarterly/halfyearly/yearly/custom
  // Monthly sub-modes: by-date (15th) or by-weekday (1st Monday, Last Saturday)
  // Ends: never / after N times / on date
  // ══════════════════════════════════════════════════════════════════

  var _DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var _WEEK_LABELS = ['','First','Second','Third','Fourth','Last'];
  var _MONTH_NAMES_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Internal repeat state (separate from main state to allow Cancel)
  var _rpt = {
    type: 'none', every: 1, days: [], monthMode: 'date',
    monthDay: 1, monthWeek: 1, monthWeekday: 1,
    ends: 'never', count: 10, endDate: ''
  };

  function _populateMonthDaySelect() {
    var sel = document.getElementById('rem_repeat_month_day');
    if(!sel) return;
    var opts = '';
    for(var d = 1; d <= 31; d++) {
      var suf = d===1?'st':d===2?'nd':d===3?'rd':'th';
      opts += '<option value="'+d+'">'+d+suf+'</option>';
    }
    sel.innerHTML = opts;
    sel.value = _rpt.monthDay || 1;
  }

  function openRepeat() {
    // Copy current state into working copy
    _rpt.type       = state.repeatType  || 'none';
    _rpt.every      = state.repeatEvery || 1;
    _rpt.days       = (state.repeatDays || []).slice();
    _rpt.monthMode  = state.repeatMonthMode  || 'date';
    _rpt.monthDay   = state.repeatMonthDay   || 1;
    _rpt.monthWeek  = state.repeatMonthWeek  || 1;
    _rpt.monthWeekday = state.repeatMonthWeekday !== undefined ? state.repeatMonthWeekday : 1;
    _rpt.ends       = state.repeatEnds  || 'never';
    _rpt.count      = state.repeatCount || 10;
    _rpt.endDate    = state.repeatEndDate || '';

    // Populate month-day dropdown
    _populateMonthDaySelect();

    // Restore UI values
    var sel = document.getElementById('rem_repeat_type_sel');
    if(sel) sel.value = _rpt.type;

    var ev = document.getElementById('rem_repeat_every');
    if(ev) ev.value = _rpt.every;

    var ends = document.getElementById('rem_repeat_ends');
    if(ends) ends.value = _rpt.ends;

    var cnt = document.getElementById('rem_repeat_count');
    if(cnt) cnt.value = _rpt.count;

    var ed = document.getElementById('rem_repeat_end_date');
    if(ed) ed.value = _rpt.endDate || '';

    var mw = document.getElementById('rem_repeat_month_week');
    if(mw) mw.value = _rpt.monthWeek;

    var mwd = document.getElementById('rem_repeat_month_weekday');
    if(mwd) mwd.value = _rpt.monthWeekday;

    // If weekly and no days set yet, auto-check the selected reminder date's day
    if((_rpt.type==='weekly'||_rpt.type==='biweekly') && _rpt.days.length===0 && state.selDate) {
      _rpt.days = [state.selDate.getDay()];
    }

    updateRepeatUI();
    _renderDayButtons();
    _setMonthMode(_rpt.monthMode);
    _onEndsChange();
    _updatePreview();

    var p = document.getElementById('rem_repeat_popup');
    if(p) p.style.display = 'flex';
  }

  function updateRepeatUI() {
    var sel = document.getElementById('rem_repeat_type_sel');
    if(!sel) return;
    var type = sel.value;
    _rpt.type = type;

    // Show/hide interval row
    var showInterval = ['hourly','daily','weekly','biweekly','custom'].indexOf(type) >= 0;
    var ir = document.getElementById('rrp_interval_row');
    if(ir) ir.style.display = showInterval ? 'flex' : 'none';

    // Set unit label
    var unitMap = {hourly:'hour(s)',daily:'day(s)',weekly:'week(s)',biweekly:'weeks',
                   monthly:'month(s)',quarterly:'months',halfyearly:'months',yearly:'year(s)',custom:'day(s)'};
    var unit = document.getElementById('rem_repeat_unit');
    if(unit) unit.textContent = unitMap[type] || 'time(s)';

    // For biweekly: lock interval to 2
    var ev = document.getElementById('rem_repeat_every');
    if(ev) {
      if(type==='biweekly'){ ev.value=2; ev.readOnly=true; ev.style.opacity='.5'; }
      else { ev.readOnly=false; ev.style.opacity='1'; }
    }

    // Show/hide day buttons (weekly, biweekly)
    var dr = document.getElementById('rrp_days_row');
    var showDays = type==='weekly' || type==='biweekly';
    if(dr) dr.style.display = showDays ? 'block' : 'none';

    // Show/hide monthly sub-options
    var mr = document.getElementById('rrp_monthly_row');
    var showMonthly = ['monthly','quarterly','halfyearly'].indexOf(type) >= 0;
    if(mr) mr.style.display = showMonthly ? 'block' : 'none';

    // Show/hide ends section (hide for none)
    var es = document.getElementById('rrp_ends_section');
    if(es) es.style.display = type==='none' ? 'none' : 'block';

    _updatePreview();
  }

  function _renderDayButtons() {
    for(var d=0;d<7;d++){
      var btn = document.getElementById('rrpd_'+d);
      if(!btn) continue;
      var active = _rpt.days.indexOf(d) >= 0;
      btn.style.background = active ? '#2196f3' : '#2a2f3a';
      btn.style.color      = active ? '#fff'    : '#aaa';
      btn.style.borderColor= active ? '#2196f3' : '#3d4455';
    }
  }

  function _toggleDay(d) {
    var idx = _rpt.days.indexOf(d);
    if(idx >= 0) _rpt.days.splice(idx,1);
    else _rpt.days.push(d);
    _renderDayButtons();
    _updatePreview();
  }

  function _setMonthMode(mode) {
    _rpt.monthMode = mode;
    var bdRow = document.getElementById('rrp_bydate_row');
    var bwRow = document.getElementById('rrp_byweekday_row');
    var dBtn  = document.getElementById('rrp_mode_date_btn');
    var wBtn  = document.getElementById('rrp_mode_wday_btn');
    if(bdRow) bdRow.style.display = mode==='date'    ? 'flex'   : 'none';
    if(bwRow) bwRow.style.display = mode==='weekday' ? 'flex'   : 'none';
    if(dBtn)  { dBtn.style.background=mode==='date'    ?'#2196f3':'#2a2f3a'; dBtn.style.color=mode==='date'?'#fff':'#888'; }
    if(wBtn)  { wBtn.style.background=mode==='weekday' ?'#2196f3':'#2a2f3a'; wBtn.style.color=mode==='weekday'?'#fff':'#888'; }
    _updatePreview();
  }

  function _onEndsChange() {
    var ends = document.getElementById('rem_repeat_ends');
    var val = ends ? ends.value : 'never';
    _rpt.ends = val;
    var cr = document.getElementById('rrp_ends_count_row');
    var dr = document.getElementById('rrp_ends_date_row');
    if(cr) cr.style.display = val==='count' ? 'flex' : 'none';
    if(dr) dr.style.display = val==='date'  ? 'flex' : 'none';
    _updatePreview();
  }

  function _updatePreview() {
    var el = document.getElementById('rrp_preview');
    if(!el) return;
    var lbl = _buildRepeatLabel(_rpt);
    if(!lbl || _rpt.type==='none') { el.style.display='none'; return; }
    el.style.display='block';
    el.textContent = '🔁 ' + lbl;
  }

  // Build human-readable label from repeat config object
  function _buildRepeatLabel(r) {
    if(!r || r.type==='none') return '';
    var t = r.type, ev = r.every||1;
    var endStr = '';
    if(r.ends==='count') endStr = ' · After '+(r.count||10)+' times';
    else if(r.ends==='date' && r.endDate) endStr = ' · Until '+r.endDate;

    if(t==='hourly')    return 'Every '+ev+' hour'+(ev>1?'s':'')+endStr;
    if(t==='daily')     return 'Every '+ev+' day'+(ev>1?'s':'')+endStr;
    if(t==='weekdays')  return 'Every weekday (Mon–Fri)'+endStr;
    if(t==='weekends')  return 'Weekends (Sat & Sun)'+endStr;
    if(t==='yearly')    return 'Every year'+endStr;
    if(t==='custom')    return 'Every '+ev+' day'+(ev>1?'s':'')+' (custom)'+endStr;

    if(t==='weekly'||t==='biweekly') {
      var days = (r.days||[]).slice().sort();
      var dayNames = days.map(function(d){ return _DAY_NAMES[d].slice(0,3); });
      var prefix = t==='biweekly' ? 'Every 2 weeks' : (ev>1?'Every '+ev+' weeks':'Weekly');
      return prefix+(dayNames.length?' on '+dayNames.join(', '):'')+endStr;
    }

    if(t==='monthly'||t==='quarterly'||t==='halfyearly') {
      var prefix2 = t==='quarterly'?'Every 3 months':t==='halfyearly'?'Every 6 months':'Monthly';
      if(r.monthMode==='weekday') {
        var wk  = _WEEK_LABELS[r.monthWeek||1];
        var wdn = _DAY_NAMES[r.monthWeekday||1];
        return prefix2+' on '+wk+' '+wdn+endStr;
      } else {
        var d2 = r.monthDay||1;
        var suf2 = d2===1?'st':d2===2?'nd':d2===3?'rd':'th';
        return prefix2+' on '+d2+suf2+endStr;
      }
    }
    return '';
  }

  function confirmRepeat() {
    var sel = document.getElementById('rem_repeat_type_sel');
    var ev  = document.getElementById('rem_repeat_every');
    var ends = document.getElementById('rem_repeat_ends');
    var cnt  = document.getElementById('rem_repeat_count');
    var ed   = document.getElementById('rem_repeat_end_date');
    var mday = document.getElementById('rem_repeat_month_day');
    var mwk  = document.getElementById('rem_repeat_month_week');
    var mwkd = document.getElementById('rem_repeat_month_weekday');

    // Validate: weekly requires at least 1 day
    var type = sel ? sel.value : 'none';
    if((type==='weekly'||type==='biweekly') && _rpt.days.length===0) {
      alert('Please select at least one day of the week.');
      return;
    }

    // Commit to main state
    state.repeatType       = type;
    state.repeatEvery      = ev ? parseInt(ev.value)||1 : 1;
    state.repeatDays       = _rpt.days.slice();
    state.repeatMonthMode  = _rpt.monthMode;
    state.repeatMonthDay   = mday ? parseInt(mday.value)||1 : 1;
    state.repeatMonthWeek  = mwk  ? parseInt(mwk.value)||1  : 1;
    state.repeatMonthWeekday = mwkd ? parseInt(mwkd.value)   : 1;
    state.repeatEnds       = ends ? ends.value : 'never';
    state.repeatCount      = cnt  ? parseInt(cnt.value)||10  : 10;
    state.repeatEndDate    = ed   ? ed.value : '';

    updateRepeatDisplay();
    closeRepeatPopup();
  }

  function closeRepeatPopup() {
    var p = document.getElementById('rem_repeat_popup');
    if(p) p.style.display = 'none';
  }

  // Live-sync helpers — keep _rpt in sync as user types/changes
  function _onEveryChange() {
    var ev = document.getElementById('rem_repeat_every');
    _rpt.every = ev ? parseInt(ev.value)||1 : 1;
    _updatePreview();
  }
  function _onMonthDayChange() {
    var sel = document.getElementById('rem_repeat_month_day');
    _rpt.monthDay = sel ? parseInt(sel.value)||1 : 1;
    _updatePreview();
  }
  function _onMonthWkChange() {
    var wk  = document.getElementById('rem_repeat_month_week');
    var wkd = document.getElementById('rem_repeat_month_weekday');
    _rpt.monthWeek    = wk  ? parseInt(wk.value)||1  : 1;
    _rpt.monthWeekday = wkd ? parseInt(wkd.value)     : 1;
    _updatePreview();
  }

  var _snoozeTimeout = null;

  // Public API
  return {
    open: open, close: close, save: save,
    openDatePicker: openDatePicker, closeDatePicker: closeDatePicker,
    selectDay: selectDay, calPrev: calPrev, calNext: calNext, confirmDate: confirmDate, clearDate: clearDate,
    calYearPrev: function(){ state.calYear--; renderCalendar(); },
    calYearNext: function(){ state.calYear++; renderCalendar(); },
    calSetYear: function(y){ state.calYear=y; renderCalendar(); },
    openTimePicker: openTimePicker, closeTimePicker: closeTimePicker,
    confirmTime: confirmTime, setAmPm: setAmPm, clearTime: clearTime,
    _onHrScroll: _onHrScroll, _onMinScroll: _onMinScroll,
    _selectHr: _selectHr, _selectMin: _selectMin,
    openRemindBefore: openRemindBefore, closeBeforePopup: closeBeforePopup,
    setBeforeQuick: setBeforeQuick, showMoreBefore: showMoreBefore, confirmBefore: confirmBefore,
    onBeforeUnitChange: onBeforeUnitChange, onBeforeNumChange: onBeforeNumChange, onBeforeDropdownChange: onBeforeDropdownChange,
    openRepeat: openRepeat, closeRepeatPopup: closeRepeatPopup,
    updateRepeatUI: updateRepeatUI, confirmRepeat: confirmRepeat,
    _toggleDay: _toggleDay, _setMonthMode: _setMonthMode,
    _onEndsChange: _onEndsChange,
    _onEveryChange: _onEveryChange,
    _onMonthDayChange: _onMonthDayChange, _onMonthWkChange: _onMonthWkChange,
  };
})();

// ── Wire REM to existing APP ──────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  if(window.APP && window.REM) {
    window.APP.openReminderModal = function(id){ window.REM.open(id||null); };
  }

  // ── Schedule time-based alerts on load ──
  setTimeout(function(){
    if(window.APP && typeof window.APP._remScheduleTimeAlerts === 'function'){
      window.APP._remScheduleTimeAlerts();
    }
    // Update reminder tab badge
    if(window.APP && typeof window.APP._calcRemindersState === 'function'){
      try {
        const s = window.APP._calcRemindersState();
        const cnt = (s.overdue||[]).length + (s.today||[]).length;
        if(window.APP._remUpdateTabBadge) window.APP._remUpdateTabBadge(cnt);
      } catch(e){}
    }
  }, 2500);

  // ── Auto-check snoozed reminders on tab focus ──
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden && window.APP && typeof window.APP._remScheduleTimeAlerts === 'function'){
      window.APP._remScheduleTimeAlerts();
    }
  });

  // ── Rewire pym_save_btn with addEventListener (belt + suspenders) ──
  var _pymSave = document.getElementById('pym_save_btn');
  if(_pymSave){
    _pymSave.addEventListener('click', function(e){
      if(this._saving) return;
      this._saving = true;
      setTimeout(()=>{ this._saving = false; }, 1000);
      if(window.APP && typeof window.APP.savePayment === 'function'){
        // Let onclick handle it
      } else {
        console.error('[DOMReady] APP.savePayment not available at click time!');
        alert('App not ready yet. Please wait a moment and try again.');
      }
    });
    console.log('[DOMReady] pym_save_btn wired OK');
  }

  // ── Rewire pym_date_wrap if it's empty (date picker not injected yet) ──
  var _pymDateWrap = document.getElementById('pym_date_wrap');
  if(_pymDateWrap && !_pymDateWrap.innerHTML.trim()){
    var _today = new Date();
    var _todayIso = _today.getFullYear()+'-'+String(_today.getMonth()+1).padStart(2,'0')+'-'+String(_today.getDate()).padStart(2,'0');
    if(typeof makeDateInput === 'function'){
      _pymDateWrap.innerHTML = makeDateInput('pym_date', _todayIso);
    }
  }
});
</script>

</body>
</html>

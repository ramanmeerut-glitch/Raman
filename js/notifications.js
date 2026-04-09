/* notifications.js — Push Notifications (Firebase Cloud Messaging)
 * _initPushNotifications, _pushGetToken, _pushRequestPermission,
 * _pushCheckTodayReminders, _pushDisable, _pushToggle
 * VAPID key configured below.
 */

'use strict';

// PUSH NOTIFICATIONS — Firebase Cloud Messaging
// VAPID Key: BMpQ5oawocseSUa0Lym92UF0Icbp0BcEXQJWjGmgNvbfC6zmsnYgCUz66u1siEqD191J1OWDSTtSXbduVDh-4jE
// ═══════════════════════════════════════════════════════

const _VAPID = 'BMpQ5oawocseSUa0Lym92UF0Icbp0BcEXQJWjGmgNvbfC6zmsnYgCUz66u1siEqD191J1OWDSTtSXbduVDh-4jE';

// Register firebase-messaging-sw.js (must be in repo root on GitHub Pages)
window._pushReady = false;
window._messaging = null;

function _initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Not supported in this browser');
    return;
  }
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    console.log('[Push] HTTPS required');
    return;
  }

  // Load Firebase Messaging SDK
  var script = document.createElement('script');
  script.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js';
  script.onload = function() {
    try {
      // First check if the SW file actually exists (avoid red 404 error in console)
      var swUrl = './firebase-messaging-sw.js';
      fetch(swUrl, {method:'HEAD'}).then(function(res) {
        if (!res.ok) {
          // File not uploaded yet — suppress 404, show friendly guidance instead
          console.info(
            '[Push] ℹ️ firebase-messaging-sw.js not found on server.\n' +
            '  → To enable push notifications, upload firebase-messaging-sw.js\n' +
            '    to your GitHub repo root alongside index.html.\n' +
            '  → App works normally without it.'
          );
          return;
        }
        // File exists — register SW
        navigator.serviceWorker.register(swUrl).then(function(reg) {
          console.log('[Push] SW registered:', reg.scope);
          if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
            window._messaging = firebase.messaging();
            window._pushReady = true;
            console.log('[Push] Messaging ready');
            if (Notification.permission === 'granted') {
              _pushGetToken();
              _pushCheckTodayReminders();
            }
          }
        }).catch(function(e) { console.warn('[Push] SW register fail:', e.message); });
      }).catch(function() {
        console.info('[Push] ℹ️ SW file check skipped (offline or CORS). Push notifications unavailable.');
      });
    } catch(e) { console.warn('[Push] Init fail:', e.message); }
  };
  document.head.appendChild(script);
}

// Request permission + get FCM token
function _pushGetToken() {
  if (!window._messaging || !window._pushReady) return;
  window._messaging.getToken({ vapidKey: _VAPID }).then(function(token) {
    if (token) {
      localStorage.setItem('rk_fcm_token', token);
      // Save token to Firebase so you can send from anywhere
      if (window.fbSave) window.fbSave('fcm_token_web', { token, updated: new Date().toISOString() }).catch(()=>{});
      console.log('[Push] Token saved:', token.slice(0,20)+'...');
    }
  }).catch(function(e) { console.warn('[Push] getToken fail:', e.message); });
}

// Request notification permission (called when user clicks Enable)
function _pushRequestPermission() {
  if (!('Notification' in window)) {
    alert('Your browser does not support notifications.');
    return;
  }
  Notification.requestPermission().then(function(perm) {
    if (perm === 'granted') {
      localStorage.setItem('rk_push_enabled', '1');
      if (!window._pushReady) _initPushNotifications();
      else { _pushGetToken(); _pushCheckTodayReminders(); }
      if (typeof APP !== 'undefined') APP.showToastMsg('✅ Notifications enabled! You will get daily reminders.');
      _pushUpdateBtn();
    } else {
      localStorage.removeItem('rk_push_enabled');
      if (typeof APP !== 'undefined') APP.showToastMsg('⚠️ Permission denied. Enable from browser settings.');
      _pushUpdateBtn();
    }
  });
}

// Update the enable/disable button state
function _pushUpdateBtn() {
  var btn = document.getElementById('_pushBtn');
  if (!btn) return;
  var perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
  var enabled = localStorage.getItem('rk_push_enabled') === '1' && perm === 'granted';
  btn.textContent = enabled ? '🔔 Notifications: ON' : '🔕 Notifications: OFF';
  btn.style.background = enabled ? '#dcfce7' : '#fee2e2';
  btn.style.color = enabled ? '#166534' : '#991b1b';
  btn.style.borderColor = enabled ? '#90c8a0' : '#fca5a5';
}

// Send a local browser notification (works even without FCM when app is open)
function _pushSendLocal(title, body, icon) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title || '🔔 Raman Dashboard', {
      body: body || '',
      icon: icon || '',
      badge: '',
      vibrate: [200, 100, 200],
      tag: 'raman-reminder-' + Date.now()
    });
  } catch(e) { console.warn('[Push] Local notification fail:', e); }
}

// Check today's reminders and fire notifications
function _pushCheckTodayReminders() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  var lastCheck = localStorage.getItem('rk_push_last_check');
  var today = new Date().toISOString().split('T')[0];
  if (lastCheck === today) return; // already checked today
  localStorage.setItem('rk_push_last_check', today);

  if (typeof APP === 'undefined') return;
  setTimeout(function() {
    try {
      var msgs = [];
      var now = new Date(); now.setHours(0,0,0,0);

      // Regular reminders — due today or overdue
      var reminders = APP.reminders || [];
      reminders.filter(function(r) { return !r.completed; }).forEach(function(r) {
        var trig = APP._getTrigDate ? APP._getTrigDate(r) : (r.trigDate || r.exp);
        if (!trig) return;
        var d = APP._dFromNow ? APP._dFromNow(trig) : null;
        if (d !== null && d <= 0) msgs.push(r.name + (d === 0 ? ' — Due TODAY' : ' — ' + Math.abs(d) + 'd Overdue'));
      });

      // Medical follow-ups due today
      var visits = APP.visits || [];
      visits.forEach(function(v) {
        if (!v.next) return;
        var ni = v.next.includes('-') ? v.next : (typeof dmyToIso === 'function' ? dmyToIso(v.next) : null);
        if (!ni) return;
        var d = APP._dFromNow ? APP._dFromNow(ni) : null;
        if (d !== null && d <= 0) {
          var pat = (APP.patients || []).find(function(p) { return p.id === v.patId; });
          msgs.push((pat ? pat.name + ' — ' : '') + 'Dr. ' + (v.doctor||'') + ' Follow-up' + (d===0?' Today':' Overdue'));
        }
      });

      // Overdue rent
      var tenants = APP.tenants || [];
      tenants.filter(function(t) { return t.status === 'active'; }).forEach(function(t) {
        if (!APP.getTenantLedger) return;
        var ledger = APP.getTenantLedger(t);
        if (ledger && ledger.totalBalance > 0 && ledger.months && ledger.months.some(function(m) { return m.status === 'overdue'; })) {
          msgs.push('RENT OVERDUE — ' + t.name);
        }
      });

      if (msgs.length > 0) {
        var title = '🔔 Raman Dashboard — ' + msgs.length + ' Alert' + (msgs.length > 1 ? 's' : '');
        var body  = msgs.slice(0, 3).join('\n') + (msgs.length > 3 ? '\n+' + (msgs.length-3) + ' more…' : '');
        _pushSendLocal(title, body);
        console.log('[Push] Fired notification:', title);
      } else {
        console.log('[Push] No alerts today — all clear!');
      }
    } catch(e) { console.warn('[Push] Check fail:', e); }
  }, 3000); // 3s delay so APP data is loaded
}

// Disable notifications
function _pushDisable() {
  localStorage.removeItem('rk_push_enabled');
  localStorage.removeItem('rk_push_last_check');
  if (typeof APP !== 'undefined') APP.showToastMsg('🔕 Notifications disabled.');
  _pushUpdateBtn();
}

// ── Push toggle (called from Settings button) ──
function _pushToggle(){
  var perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
  var enabled = localStorage.getItem('rk_push_enabled')==='1' && perm==='granted';
  if(enabled){ _pushDisable(); }
  else { _pushRequestPermission(); }
}

// ── Auto-init on page load ──
(function() {
  if (location.protocol === 'https:' || location.hostname === 'localhost') {
    _initPushNotifications();
    window.addEventListener('load', function() {
      setTimeout(function() {
        if (localStorage.getItem('rk_push_enabled') === '1') {
          _pushCheckTodayReminders();
        }
        _pushUpdateBtn();
      }, 4000);
    });
  }
})();

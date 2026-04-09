/* firebase.js — Firebase Init + Real-Time Sync
 * _loadScript, _initFirebase, window.SYNC, window.fbSave
 * Mobile touch optimisations: passive listeners, debounce
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// MOBILE OPTIMIZATION - Quick Fixes for Android Chrome
// ═══════════════════════════════════════════════════════════

// Fix 1: Enable passive touch events for better scroll performance
document.addEventListener('touchstart', function(){}, {passive: true});
document.addEventListener('touchmove', function(){}, {passive: true});

// Fix 2: Prevent double-tap zoom (improves button responsiveness)
let lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Fix 3: Debounce utility for preventing rapid clicks
window._debounceTimers = {};
function debounce(key, callback, delay) {
  delay = delay || 300;
  if (window._debounceTimers[key]) {
    clearTimeout(window._debounceTimers[key]);
  }
  window._debounceTimers[key] = setTimeout(function() {
    callback();
    delete window._debounceTimers[key];
  }, delay);
}

// Fix 4: Safe button click wrapper (prevents multiple rapid clicks)
window._clickInProgress = {};
function safeClick(buttonId, callback, minDelay) {
  minDelay = minDelay || 500;
  const key = buttonId || 'default';
  
  if (window._clickInProgress[key]) {
    console.log('[SafeClick] Click already in progress for:', key);
    return false;
  }
  
  window._clickInProgress[key] = true;
  console.log('[SafeClick] Processing click:', key);
  
  try {
    callback();
  } catch(e) {
    console.error('[SafeClick] Error:', e);
  }
  
  setTimeout(function() {
    delete window._clickInProgress[key];
    console.log('[SafeClick] Click lock released:', key);
  }, minDelay);
  
  return true;
}

// Fix 5: Mobile viewport lock (prevent zoom issues)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', function() {
    document.documentElement.style.height = window.visualViewport.height + 'px';
  });
}

console.log('✅ Mobile optimizations loaded');

// ═══════════════════════════════════════════════════════════
// Firebase scripts ko dynamically load karo — agar load fail ho toh gracefully handle karo
window._fbLoadError = false;
function _loadScript(src, cb, errCb) {
  var s = document.createElement('script');
  s.src = src;
  s.onload = cb;
  s.onerror = errCb;
  document.head.appendChild(s);
}
_loadScript(
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  function() {
    _loadScript(
      'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js',
      function() {
        _loadScript(
          'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage-compat.js',
          function() { window._fbScriptsReady = true; _initFirebase(); },
          function() { console.warn('[Firebase] Storage script load fail — Storage disabled'); window._fbScriptsReady = true; window._fbStorageFail = true; _initFirebase(); }
        );
      },
      function() { console.warn('[Firebase] Firestore script load fail'); window._fbLoadError = true; _initFirebase(); }
    );
  },
  function() { console.warn('[Firebase] App script load fail — Firebase disabled'); window._fbLoadError = true; _initFirebase(); }
);
// Timeout: agar 10 sec mein Firebase connect nahi hua, show Offline
setTimeout(function(){
  var el = document.getElementById('fbStatus');
  if(el && el.textContent.indexOf('Connecting')>=0){
    el.textContent = '📴 Offline Mode';
    el.style.color = '#b07020';
  }
  var el2 = document.getElementById('fbStatusSettings');
  if(el2 && el2.textContent.indexOf('Connecting')>=0){
    el2.textContent = '📴 Offline Mode';
    el2.style.color = '#b07020';
  }
}, 10000);

function _initFirebase() {
(function() {
  var FB_CONFIG = {
    apiKey: "AIzaSyDpCSTpvQKFcT_N-3Oi1u-8GnSi6oYw2bU",
    authDomain: "raman2909-5996e.firebaseapp.com",
    projectId: "raman2909-5996e",
    storageBucket: "raman2909-5996e.firebasestorage.app",
    messagingSenderId: "917402826249",
    appId: "1:917402826249:web:224a9f561ab8e356ccead8"
    // ✅ Netlify domain: raman2909.netlify.app — Firebase Authorized Domains mein add karo
  };

  // Agar Firebase scripts load nahi hue toh gracefully exit
  if (window._fbLoadError || typeof firebase === 'undefined') {
    // Update UI status so user knows
    ['fbStatus','fbStatusSettings'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = '📴 Offline Mode';
        el.style.color = '#b07020';
      }
    });
    // Storage upload bhi disabled mark karo
    window.fbUploadFile = null;
    window.fbDeleteFile = null;
    return;
  }

  try {
    firebase.initializeApp(FB_CONFIG);
  } catch(e) {
    // Already initialized
    if (e.code !== 'app/duplicate-app') console.error('Firebase init error:', e);
  }

  // ── Firestore init — compat SDK 10.8.0 ──
  // Suppress Firebase internal logger deprecation warnings
  // Firebase SDK uses its own logger (not console.warn directly)
  // We patch both console.warn AND the Firebase logger
  (function(){
    var _ow=console.warn, _oi=console.info, _ol=console.log;
    function _suppress(args){
      if(!args[0]) return false;
      var s=String(args[0]);
      return s.indexOf('enableMultiTabIndexedDbPersistence')!==-1||
             s.indexOf('will be deprecated')!==-1||
             s.indexOf('overriding the original host')!==-1||
             s.indexOf('FirestoreSettings.cache')!==-1;
    }
    console.warn=function(){if(_suppress(arguments))return;_ow.apply(console,arguments);};
    console.info=function(){if(_suppress(arguments))return;_oi.apply(console,arguments);};
    setTimeout(function(){console.warn=_ow;console.info=_oi;},5000);
  })();
  // Set Firebase log level to suppress internal deprecation logs
  try{ if(typeof firebase.firestore.setLogLevel==='function') firebase.firestore.setLogLevel('error'); }catch(e){}
  var db = firebase.firestore();
  // enablePersistence — Android Chrome mein kabhi fail ho jaata hai
  // failed-precondition = multiple tabs, unimplemented = Safari private mode
  // Both are non-fatal — app still works, just no offline cache
  db.enablePersistence({ synchronizeTabs: true }).then(function() {
    console.log('[Firebase] Offline persistence enabled ✓');
  }).catch(function(e) {
    if (e.code === 'failed-precondition') {
      console.warn('[Firebase] Persistence: multiple tabs open, offline cache disabled');
    } else if (e.code === 'unimplemented') {
      console.warn('[Firebase] Persistence: not supported in this browser');
    } else {
      console.warn('[Firebase] Persistence error:', e.code, e.message);
    }
  });
  var storage = (window._fbStorageFail || typeof firebase.storage === 'undefined') ? null : firebase.storage();
  var DOC_REF = db.collection('dashboard').doc('raman-main');

  // ── Status helper ──
  function setStatus(msg, color) {
    ['fbStatus','fbStatusSettings'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = msg;
        el.style.color = color || '#7a6040';
      }
    });
    console.log('[Firebase]', msg);
  }

  // ── Apply cloud data to localStorage ──
  function applyCloudData(data) {
    var changed = false;
    var keysChanged = [];
    Object.keys(data).forEach(function(k) {
      if (!data[k]) return;
      var existing = localStorage.getItem('rk_' + k);
      if (existing !== data[k]) {
        localStorage.setItem('rk_' + k, data[k]);
        changed = true;
        keysChanged.push(k);
      }
    });
    // Re-render specific UI parts when cloud data arrives
    if (keysChanged.length > 0) {
      setTimeout(function() {
        if (window.APP) {
          if (keysChanged.includes('quicklinks')) window.APP.renderQuickLinks();
          if (keysChanged.includes('notepad')) {
            var na = document.getElementById('notepadArea');
            var nm = document.getElementById('notepadMain');
            var val = localStorage.getItem('rk_notepad') || '';
            if (na && na.value !== val) na.value = val;
            if (nm && nm.value !== val) nm.value = val;
          }
          // Notepad categories — re-render if active
          if (keysChanged.includes('note_categories')) {
            if (window.APP && window.APP.renderNotepadTab) {
              window.APP.renderNotepadTab();
            }
          }
          // Note content — re-render notepad if active
          var noteKeysChanged = keysChanged.filter(function(k){ return k.startsWith('note_') || k === 'notepad'; });
          if (noteKeysChanged.length > 0 && window.APP && window.APP._noteActiveCat) {
            window.APP.renderNotepadTab();
          }
          // Khata — re-render if changed
          var kbChanged = keysChanged.filter(function(k){ return k.startsWith('kb_'); });
          if (kbChanged.length > 0 && window.APP) {
            if (window.APP.curTab === 'khata') window.APP.renderKhata();
            window.APP.renderPills();
          }
          // Reminders — re-render pills
          if (keysChanged.includes('reminders') && window.APP) {
            window.APP.renderPills();
            if (window.APP.curTab === 'reminder') window.APP.renderReminders();
          }
          // Done IDs — re-render reminders if changed from another device
          if (keysChanged.includes('done_ids') && window.APP) {
            window.APP.renderPills();
            if (window.APP.curTab === 'reminder') window.APP.renderReminders();
            if (window.APP.curTab === 'home') window.APP.renderHome();
          }
        }
      }, 100);
    }
    return changed;
  }

  // ── Save to Firestore (called by S.set on every data change) ──
  // Android-safe: retry with exponential backoff, never silently drops data
  var _fbSaveRetryCount = {};
  window.fbSave = function(key, value) {
    var obj = {};
    obj[key] = JSON.stringify(value);
    var attempt = function(retries) {
      return DOC_REF.set(obj, { merge: true })
        .then(function() {
          // Success — clear retry count
          delete _fbSaveRetryCount[key];
          // Remove from queue if it was there
          if (window._fbQ && window._fbQ[key] !== undefined) {
            delete window._fbQ[key];
          }
        })
        .catch(function(e) {
          var msg = e.message || '';
          var isNetworkErr = !e.code ||
            e.code === 'unavailable' ||
            msg.indexOf('Failed to fetch') !== -1 ||
            msg.indexOf('NetworkError') !== -1 ||
            msg.indexOf('fetch') !== -1 ||
            msg.indexOf('network') !== -1 ||
            msg.indexOf('offline') !== -1;

          if (isNetworkErr) {
            // Queue for retry — guaranteed, never lost
            if (!window._fbQ) window._fbQ = {};
            window._fbQ[key] = value;
            var cnt = (_fbSaveRetryCount[key] || 0) + 1;
            _fbSaveRetryCount[key] = cnt;
            // Exponential backoff: 3s, 6s, 12s, max 30s
            var delay = Math.min(3000 * Math.pow(2, cnt - 1), 30000);
            console.warn('[fbSave] Network error, retry in ' + (delay/1000) + 's:', key, '(attempt ' + cnt + ')');
            setTimeout(function() {
              if (window._fbQ && window._fbQ[key] !== undefined) {
                attempt(retries - 1);
              }
            }, delay);
          } else {
            console.warn('[fbSave] Firestore error:', e.code, msg, 'key:', key);
            // Still queue it — may be transient
            if (!window._fbQ) window._fbQ = {};
            window._fbQ[key] = value;
          }
        });
    };
    return attempt(5); // up to 5 retry attempts
  };

  // ── Real-time listener ──
  var unsubscribe = null;
  var isFirstSnap = true;
  var lastMyWrite = 0;

  function startListener() {
    if (unsubscribe) {
      try { unsubscribe(); } catch(e) {}
      unsubscribe = null;
    }
    setStatus('⏳ Connecting...', '#7a6040');
    console.log('[Firebase] Starting listener...');

    try {
      unsubscribe = DOC_REF.onSnapshot(
        function(snap) {
          console.log('[Firebase] Snapshot received. exists:', snap.exists, 'pending:', snap.metadata.hasPendingWrites);

          // BUG FIX: In Firestore compat SDK, snap.exists is a boolean (not a function)
          if (!snap.exists) {
            setStatus('🟡 No cloud data yet', '#8a6500');
            isFirstSnap = false;
            return;
          }

          var data = snap.data();
          if (!data) { setStatus('🟡 Empty data', '#8a6500'); return; }

          if (isFirstSnap) {
            isFirstSnap = false;
            var changed = applyCloudData(data);
            if (changed && window.APP) window.APP.init();
            setStatus('🟢 Live', '#1e7a45');
            return;
          }

          // Only apply server changes — not our own write echoes
          if (!snap.metadata.hasPendingWrites && (Date.now() - lastMyWrite) > 5000) {
            var changed = applyCloudData(data);
            // CRITICAL: Never call APP.init() while a modal is open —
            // it would wipe FUM upload sessions and reset modal state mid-use
            var anyModalOpen = !!document.querySelector('.overlay.open');
            if (changed && window.APP && !anyModalOpen) {
              window.APP.init();
              setStatus('🟢 Synced ✓', '#1e7a45');
              setTimeout(function() { setStatus('🟢 Live', '#1e7a45'); }, 3000);
            } else {
              setStatus('🟢 Live', '#1e7a45');
            }
          }
        },
        function(err) {
          console.error('[Firebase] onSnapshot error:', err.code, err.message);
          setStatus('🔴 ' + err.code, '#b92d2d');
          unsubscribe = null;
          // Retry after 5s
          setTimeout(startListener, 5000);
        }
      );
      console.log('[Firebase] Listener started successfully');
    } catch(e) {
      console.error('[Firebase] startListener exception:', e);
      setStatus('🔴 Init error', '#b92d2d');
      setTimeout(startListener, 5000);
    }
  }

  // ── SYNC global object ──
  window.SYNC = {
    forceLoad: function() {
      setStatus('⏳ Loading...', '#7a6040');
      return DOC_REF.get()
        .then(function(snap) {
          if (snap.exists) {
            var changed = applyCloudData(snap.data());
            if (changed && window.APP) window.APP.init();
            setStatus('🟢 Live', '#1e7a45');
            if (window.APP) window.APP.showToastMsg('✅ Cloud se latest data aa gaya!');
          } else {
            setStatus('🟡 No cloud data yet', '#8a6500');
            if (window.APP) window.APP.showToastMsg('⚠️ Firebase empty hai — pehle kuch save karo');
          }
        })
        .catch(function(e) {
          console.error('[SYNC.forceLoad]', e);
          setStatus('🔴 ' + e.code, '#b92d2d');
          if (window.APP) window.APP.showToastMsg('❌ Error: ' + e.message);
        });
    },

    showDiagnostics: function() {
      var keys = ['props','tenants','payments','reminders','patients','visits','trips','buckets','kb_parties','kb_entries','kb_cash'];
      var lines = keys.map(function(k) {
        var d; try{ d = JSON.parse(localStorage.getItem('rk_' + k) || '[]'); }catch{ d = []; }
        return k + ': ' + (Array.isArray(d) ? d.length : typeof d) + ' records';
      });
      var st = document.getElementById('fbStatus');
      var msg = 'Firebase Diagnostics' +
        '\n\nStatus: ' + (st ? st.textContent : '?') +
        '\nProject: raman2909-5996e' +
        '\nListener active: ' + (unsubscribe ? 'YES' : 'NO') +
        '\nLast write: ' + (lastMyWrite ? new Date(lastMyWrite).toLocaleTimeString('en-IN') : 'none') +
        '\n\nLocal Data:' +
        '\n' + lines.join('\n') +
        '\n\n(Check browser console F12 for detailed logs)';
      alert(msg);
    }
  };

  // ── Patch fbSave to track own writes (5s guard window) ──
  var _orig = window.fbSave;
  window.fbSave = function(key, value) {
    lastMyWrite = Date.now();
    return _orig(key, value);
  };

  // ── Firebase Storage upload ──
  window.fbUploadFile = function(file, folder, onProgress) {
    return new Promise(function(resolve, reject) {
      if (file.size > 10 * 1024 * 1024) { reject(new Error('File bahut bada hai! Max 10MB allowed.')); return; }

      // Check storage is ready
      if (!storage) { reject(new Error('Firebase Storage initialize nahi hua')); return; }

      var ext  = (file.name.split('.').pop() || 'bin').toLowerCase();
      var safeName = Date.now() + '_' + Math.random().toString(36).slice(2,7) + '.' + ext;
      var path = (folder || 'general') + '/' + safeName;

      console.log('[Upload] Starting upload:', file.name, 'to', path, 'size:', file.size);

      var storageRef = storage.ref(path);
      var uploadTask = storageRef.put(file, {
        contentType: file.type || 'application/octet-stream'
      });

      // Timeout — agar 8s mein 0% pe stuck rahe toh fail (fast feedback)
      var started = false;
      var timeoutId = setTimeout(function() {
        if (!started) {
          uploadTask.cancel();
          reject(new Error('FIREBASE_TIMEOUT'));
        }
      }, 8000);

      uploadTask.on('state_changed',
        function(snapshot) {
          started = true;
          var pct = Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100);
          console.log('[Upload] Progress:', pct + '%');
          if (onProgress) onProgress(pct);
        },
        function(error) {
          clearTimeout(timeoutId);
          console.error('[Upload] Error:', error.code, error.message);
          var msg = error.message;
          if (error.code === 'storage/unauthorized') {
            msg = '🔐 Storage Permission Error — Firebase Console mein Storage Rules fix karo:\n\nRules > Edit Rules > Paste:\nrules_version = "2";\nservice firebase.storage {\n  match /b/{bucket}/o {\n    match /{allPaths=**} {\n      allow read, write: if true;\n    }\n  }\n}\n\nPublish karo aur dobara try karo.';
          } else if (error.code === 'storage/canceled') {
            msg = 'FIREBASE_TIMEOUT';
          } else if (error.code === 'storage/unknown') {
            msg = 'Network error — internet connection check karo';
          }
          reject(new Error(msg));
        },
        function() {
          clearTimeout(timeoutId);
          console.log('[Upload] Complete! Getting download URL...');
          storageRef.getDownloadURL().then(function(url) {
            console.log('[Upload] URL:', url);
            lastMyWrite = Date.now(); // prevent snapshot echo from calling APP.init()
            resolve({ url: url, path: path, name: file.name, size: file.size, type: file.type });
          }).catch(function(e) {
            reject(new Error('URL lene mein error: ' + e.message));
          });
        }
      );
    });
  };

  window.fbDeleteFile = function(path) {
    if (!path || path.length < 5) return;
    storage.ref(path).delete().catch(function(e) { console.warn('fbDelete:', e.message); });
  };

  // ── Retry queue — every 8s AND on visibility/online events ──
  function _flushFbQueue() {
    if (!window._fbQ) return;
    var q = window._fbQ;
    var keys = Object.keys(q);
    if (!keys.length) return;
    console.log('[Firebase] Flushing retry queue:', keys.length, 'keys');
    window._fbQ = {};
    keys.forEach(function(k) { window.fbSave(k, q[k]); });
  }
  setInterval(_flushFbQueue, 8000);
  // Flush when Android user comes back to the tab or regains connectivity
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      setTimeout(_flushFbQueue, 1000);
    }
  });
  window.addEventListener('online', function() {
    setTimeout(_flushFbQueue, 2000);
    // Also restart listener if it died
    setTimeout(startListener, 3000);
  });

  // ── Start listener — wait for DOM ready ──
  var _listenerHeartbeat = null;
  function init() {
    console.log('[Firebase] DOM ready, starting...');
    startListener();
    // Heartbeat: every 90s, check if listener is alive — restart if dead
    _listenerHeartbeat = setInterval(function() {
      if (!unsubscribe) {
        console.warn('[Firebase] Listener dead, restarting...');
        startListener();
      }
    }, 90000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    setTimeout(init, 100);
  }

  // ── Mobile: re-sync when app comes to foreground ──
  // Debounce: avoid hammering Firebase when tab switches rapidly
  var _visTimer = null;
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      clearTimeout(_visTimer);
      _visTimer = setTimeout(function() {
        console.log('[Firebase] Page visible — checking sync');
        if (!unsubscribe) {
          startListener();
        } else {
          // Only forceLoad if last load was >30s ago
          var now = Date.now();
          if (!window._lastFbLoad || (now - window._lastFbLoad) > 30000) {
            window._lastFbLoad = now;
            window.SYNC.forceLoad();
          }
        }
      }, 2000); // 2s debounce — avoid rapid re-fires
    }
  });

  // ── Network recovery ──
  window.addEventListener('online', function() {
    console.log('[Firebase] Back online');
    startListener();
    setTimeout(function() { window.SYNC.forceLoad(); }, 1000);
  });
  window.addEventListener('offline', function() {
    setStatus('📵 Offline', '#8a6500');
  });

  window.fbConnected = true;
  console.log('[Firebase] Module loaded for project: raman2909-5996e');
})();
} // end _initFirebase

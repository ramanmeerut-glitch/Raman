/* app-guard.js — APP Proxy Guard
 * Transparent forwarder proxy, loaded FIRST before all modules.
 * Queues any APP.xxx() calls that fire before APP is fully constructed,
 * then replays them once the real APP object is ready via window._APP_FLUSH().
 */

'use strict';

// Avoids silent failures and race conditions with Firebase / payTId modal state
(function(){
  var _realAPP = null;
  var _q = [];

  var _dummy = new Proxy({}, {
    get: function(t, k) {
      // If real APP is already available, forward directly (no queue, no delay)
      if (_realAPP && typeof _realAPP[k] !== 'undefined') {
        return typeof _realAPP[k] === 'function'
          ? _realAPP[k].bind(_realAPP)
          : _realAPP[k];
      }
      // Not ready yet — queue the call
      return function() {
        var args = Array.prototype.slice.call(arguments);
        if (_realAPP && typeof _realAPP[k] === 'function') {
          // Real APP became available between get and call — execute now
          try { _realAPP[k].apply(_realAPP, args); }
          catch(e) { console.error('[APP] Forward error:', k, e); }
        } else {
          _q.push({ k: k, args: args });
          console.warn('[APP] Queued (not ready yet):', k);
        }
      };
    },
    set: function(t, k, v) {
      // Allow setting properties on the dummy (e.g. APP.curTab = ...)
      if (_realAPP) { _realAPP[k] = v; return true; }
      t[k] = v; return true;
    }
  });

  window.APP = _dummy;

  // Called once real APP object is constructed and assigned
  window._APP_FLUSH = function(realAPP) {
    _realAPP = realAPP;
    // window.APP is STILL the proxy — it now forwards live to _realAPP
    // Flush any calls that were queued before APP was ready
    if (_q.length) {
      console.log('[APP] Flushing', _q.length, 'queued call(s)');
      var items = _q.splice(0);
      items.forEach(function(item) {
        if (typeof _realAPP[item.k] === 'function') {
          try { _realAPP[item.k].apply(_realAPP, item.args); }
          catch(e) { console.error('[APP] Flush replay error:', item.k, e); }
        }
      });
    }
  };
})();

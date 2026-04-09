/* init.js — App Initialiser
 * Called LAST, after all modules have extended APP via Object.assign.
 * Flushes the guard proxy so queued calls replay, then starts the app.
 */

'use strict';

// Flush the guard proxy — real APP is now fully assembled
if (typeof window._APP_FLUSH === 'function') {
  window._APP_FLUSH(APP);
  console.log('[init] APP ready — proxy flushed');
} else {
  window.APP = APP;
}

// Keyboard shortcut: Ctrl+F / Ctrl+K → open search
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
    e.preventDefault();
    APP.openSearchBar();
  }
});

// Show date in header
(function() {
  const el = document.getElementById('hdrDate');
  if (el) {
    el.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }
})();

// PWA Install Prompt (Android Chrome)
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  window._pwaPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = '';
});
document.addEventListener('click', function(e) {
  if (e.target && e.target.id === 'installBtn') {
    if (window._pwaPrompt) {
      window._pwaPrompt.prompt();
      window._pwaPrompt.userChoice.then(function() { window._pwaPrompt = null; });
    }
  }
});

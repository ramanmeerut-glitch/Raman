/* init.js — App Initialiser
 * Called LAST, after all modules have extended APP via Object.assign.
 * Flushes the guard proxy so queued calls replay, then starts the app.
 */

'use strict';

// Flush the guard proxy — real APP is now fully assembled
if (typeof window._APP_FLUSH === 'function') {
  var _r = window._REAL_APP || APP;
  window._APP_FLUSH(_r);
  console.log('[init] APP ready — proxy flushed');
} else {
  window.APP = window._REAL_APP || APP;
}

// Start explicitly after all modules have extended APP. Older startup code in
// fum.js may queue init before the proxy is flushed; this makes the first paint
// deterministic for both file:// and local-server usage.
(function bootApp() {
  var app = window.APP;
  if (!app || typeof app.init !== 'function') return;
  app.init();
  window.addEventListener('load', function() {
    if (app.curTab === 'home' && typeof app.ensureHomeRendered === 'function') app.ensureHomeRendered(8);
  });
})();

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

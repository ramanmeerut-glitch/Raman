/* config.js — shared runtime configuration for app and service worker */
'use strict';

(function(root) {
  root.RAMAN_APP_CONFIG = Object.freeze({
    firebase: Object.freeze({
      apiKey: 'AIzaSyDpCSTpvQKFcT_N-3Oi1u-8GnSi6oYw2bU',
      authDomain: 'raman2909-5996e.firebaseapp.com',
      projectId: 'raman2909-5996e',
      storageBucket: 'raman2909-5996e.firebasestorage.app',
      messagingSenderId: '917402826249',
      appId: '1:917402826249:web:224a9f561ab8e356ccead8'
    }),
    vapidKey: 'BMpQ5oawocseSUa0Lym92UF0Icbp0BcEXQJWjGmgNvbfC6zmsnYgCUz66u1siEqD191J1OWDSTtSXbduVDh-4jE'
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);

# Raman Dashboard

Static personal dashboard built with plain HTML, CSS, and JavaScript.

## Project Structure

```text
.
├── index.html                 # App shell and modal markup
├── css/
│   └── styles.css             # Global styles
├── js/
│   ├── config.js              # Shared Firebase and push config
│   ├── app-guard.js           # APP proxy while modules load
│   ├── utils.js               # Shared helpers and storage wrapper
│   ├── firebase.js            # Firebase sync and storage
│   ├── fum.js                 # File upload manager
│   ├── notifications.js       # Push notification setup
│   ├── rem-engine.js          # Reminder engine
│   └── init.js                # Final app initialization
├── modules/                   # Feature modules that extend APP
└── firebase-messaging-sw.js   # Firebase Cloud Messaging service worker
```

## Run Locally

```bash
npm start
```

Then open:

```text
http://127.0.0.1:8000/
```

The app can also be served by any static hosting provider. Keep `firebase-messaging-sw.js` in the project root so browser push notifications can register with the correct service worker scope.

## Notes

- No build step is required.
- Data is stored locally with `localStorage` and synced through Firebase when available.
- `js/config.js` is the single place for Firebase and FCM public client configuration.

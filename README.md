# Art of War

This build now runs as a real multiplayer lobby game instead of a single-browser local simulator.

## What is included

- One private nation per player
- 2-player, 3-player, and 4-player lobbies
- Invite-link lobby joining
- Server-managed hidden setup and simultaneous turn submission
- Automatic day resolution when every player has submitted
- Private per-player combat logs by day
- In-memory live game state

## Run locally

From this folder, start the server with:

```powershell
node server.js
```

Then open:

```text
http://localhost:3000
```

Create a lobby, copy the invite link, and send it to your friends. Each friend joins from their own browser tab or device.

## Automated testing

This project is now scaffolded for:

- `Vitest` unit tests in `tests/unit`
- `Playwright` browser tests in `tests/e2e`
- `GitHub Actions` CI in `.github/workflows/test.yml`

Install test dependencies:

```powershell
npm install
npx playwright install chromium
```

Run tests:

```powershell
npm run test:unit
npm run test:e2e
```

Helpful extras:

```powershell
npm run test
npm run test:e2e:headed
npm run test:e2e:ui
```

## Important current limitation

This version stores everything in memory.

That means:

- if the server restarts, the lobby is lost
- there is no database yet
- there is no account system yet
- it is good for testing and early live play, but not production hosting

## To put it online for friends

You need:

1. A machine or hosting provider that can run a long-lived Node server.
2. A public domain or public URL.
3. A reverse proxy or platform routing port `3000`.
4. For production, a real database so lobby and match state survive restarts.

## Best next production upgrades

1. Add persistent storage with Postgres or Supabase.
2. Add reconnect-safe player auth instead of token-only browser storage.
3. Add WebSockets for instant updates instead of polling.
4. Add server-side validation for every move edge case before public release.

## Firebase (Auth + Firestore + Hosting + Functions)

This repo now includes Firebase scaffolding so you can ship:

- Google sign-in (Firebase Auth)
- Persistent lobbies + game state (Firestore)
- Server-authoritative resolution (Cloud Functions)
- Hosting + `/api/*` rewrites (Firebase Hosting)

### One-time setup

Install Firebase CLI (if you don't have it):

```powershell
npm i -g firebase-tools
firebase login
```

This repo is wired to project **`art-of-war-ad70e`** (see `.firebaserc`). If you use a different project ID, update `.firebaserc` and `FIREBASE_CONFIG` in `app.js`.

```powershell
firebase use art-of-war-ad70e
```

In Firebase Console:

- Enable **Authentication → Sign-in method → Google**
- Under **Authentication → Settings → Authorized domains**, ensure **`localhost`** and your **Hosting domain** are listed (needed for Google sign-in)

Install function dependencies:

```powershell
cd functions
npm install
cd ..
```

Deploy:

```powershell
firebase deploy
```

### Local emulation (optional)

```powershell
firebase emulators:start
```

# 🐠 Fisher Family Hub

Your family's shared home base: the daily plan (4pm Shutdown, including the family dinner),
the To Do List, Financials, Accounts, news and calendar, a photo of the day, and a
"how are you feeling" check-in. The same app also serves the Mike Fisher Group client
portal at `?portal=mfg` (see CLAUDE.md and docs/). Password protected, live-synced
between everyone, and auto-deployed from GitHub.

## How it works

- **The site** is a React app that builds and deploys automatically via GitHub Actions
  to GitHub Pages every time you push to `main`.
- **The data** (lists, dinners, photos, check-ins) lives in **Firebase** (free tier):
  real password sign-in, and changes sync live — when one of you checks off an item,
  it updates on the other's screen within a second.

## One-time setup (already done for this repo; kept as a reference for rebuilding from scratch)

### 1. Create the Firebase project
1. Go to https://console.firebase.google.com and click **Add project** (call it `fisher-family-hub`).
   You can decline Google Analytics.
2. When it's created, click the **`</>` (Web)** icon to add a web app. Nickname: `hub`. Skip hosting.
3. Firebase shows you a `firebaseConfig` code block. Copy those values into
   **`src/firebase-config.js`** in this repo (already filled in for project
   `fisher-family-hub`; `PASTE_ME` is only the unset sentinel that `src/lib/firebase.js`
   checks).
   (This config is safe to commit: access is controlled by the logins and by
   `firestore.rules` at the repo root.)

### 2. Set the family password
1. In the Firebase console: **Build → Authentication → Get started**.
2. Enable the **Email/Password** provider.
3. Go to the **Users** tab → **Add user**. The family door is ONE shared user. The portal
   (`?portal=mfg`) and the morning brief use additional users (see CLAUDE.md, Auth model:
   team and client roles live in `mfgRoles/{email}`).
   - Email: `family@fisherhub.local` (must match `familyEmail` in `src/firebase-config.js`
     and `isFamily()` in `firestore.rules`; it's just a username, not a real inbox)
   - Password: whatever you want your **family password** to be
4. That's it for the family door: you and Tina type the family password and tap your name.
   The Mike Fisher Group portal (`?portal=mfg`) is separate: each team member or client
   signs in with an email or a plain username (`name` maps to `name@fisherhub.local`) and
   gets a role from `mfgRoles/{email}`.

### 3. Create the database
1. **Build → Firestore Database → Create database** → choose **Production mode** → pick the
   default US region.
2. Open the **Rules** tab, paste the contents of `firestore.rules` from the repo root, and
   click **Publish**. That file is the published ruleset (family door, read-only brief
   account, portal team and client roles via `mfgRoles/{email}`). Do not weaken it.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

This means: the family password unlocks the family data; the morning-brief account can only
read `plan-*`; portal team members can read and write `mfg-*` docs and read the To Do List
(only mike@fishergroup.co writes it from the portal); a client can only touch
`mfg-client-{clientId}` and its companion docs.

### 4. Put it on GitHub and go live
1. The repository is `github.com/wufisher12/fisherfamilyhub` (private or public is fine;
   the data is protected by the rules either way).
2. Upload this folder's contents (or `git init`, `git add -A`, `git commit -m "hub"`, add the
   remote, `git push -u origin main`).
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main` (or re-run the "Deploy to GitHub Pages" workflow under the **Actions**
   tab). In a couple of minutes the hub is live at
   `https://wufisher12.github.io/fisherfamilyhub/`.
5. Open it on both phones, sign in, add it to your home screens
   (Share → **Add to Home Screen**) and it behaves like an app.

## Everyday flow

- **Change the code** (or ask Claude to): push to `main` → live in ~2 minutes automatically.
- **Change the data**: use the site for family data (it syncs live through Firebase).
  `hub/news` and `hub/calendar` are written by the GitHub Actions automations. The client
  dashboard docs (`hub/mfg-client-{clientId}`) are published by the company-hub pipelines
  (Ohana, Giants Ridge, Bear Camp); the portal only writes their companion docs (listing
  notes, checklist state) and the team finance docs (`hub/mfg-finance-{year}`).

## Local development

```bash
npm install
npm run dev
```

## Costs

GitHub Pages and Actions are free for this use. The Firebase project is no longer a
two-person household: it also serves the Mike Fisher Group portal (team and client logins),
the morning-brief account, the news and calendar automations, and the client dashboard
writers. Check the Firebase console usage page before assuming the free-tier limits
(50k reads / 20k writes per day, 1 GiB storage) still cover it.

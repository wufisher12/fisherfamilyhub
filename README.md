# 🐠 Fisher Family Hub

Your family's shared home base — groceries, dinner plans, to-dos, travel bucket list,
daily photo, and a "how are you feeling" check-in. Password protected, live-synced
between everyone, and auto-deployed from GitHub.

## How it works

- **The site** is a React app that builds and deploys automatically via GitHub Actions
  to GitHub Pages every time you push to `main`.
- **The data** (lists, dinners, photos, check-ins) lives in **Firebase** (free tier):
  real password sign-in, and changes sync live — when one of you checks off an item,
  it updates on the other's screen within a second.

## One-time setup (about 15 minutes, all free)

### 1. Create the Firebase project
1. Go to https://console.firebase.google.com and click **Add project** (call it `fisher-family-hub`).
   You can decline Google Analytics.
2. When it's created, click the **`</>` (Web)** icon to add a web app. Nickname: `hub`. Skip hosting.
3. Firebase shows you a `firebaseConfig` code block. Copy those values into
   **`src/firebase-config.js`** in this repo, replacing the `PASTE_ME` placeholders.
   (This config is safe to commit — access is controlled by the login + rules below.)

### 2. Set the family password
1. In the Firebase console: **Build → Authentication → Get started**.
2. Enable the **Email/Password** provider.
3. Go to the **Users** tab → **Add user** — create exactly ONE user:
   - Email: `hub@fisherfamily.com` (must match `HUB_EMAIL` in `src/firebase-config.js` —
     it's just a username, not a real inbox)
   - Password: whatever you want your **family password** to be
4. That's it. On the site, you and Tina just type the family password and tap your name —
   no emails, no separate accounts.

### 3. Create the database
1. **Build → Firestore Database → Create database** → choose **Production mode** → pick the
   default US region.
2. Open the **Rules** tab, replace everything with the rules below, and click **Publish**:

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

This means: nobody can read or write anything unless they've entered the family password.

### 4. Put it on GitHub and go live
1. Create a new GitHub repository (private or public — the data is protected either way).
2. Upload this folder's contents (or `git init`, `git add -A`, `git commit -m "hub"`, add the
   remote, `git push -u origin main`).
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main` (or re-run the workflow under the **Actions** tab). In a couple of minutes
   your hub is live at `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`.
5. Open it on both phones, sign in, add it to your home screens
   (Share → **Add to Home Screen**) and it behaves like an app.

## Everyday flow

- **Change the code** (or ask Claude to): push to `main` → live in ~2 minutes automatically.
- **Change the data**: just use the site — everything syncs live through Firebase.

## Local development

```bash
npm install
npm run dev
```

## Costs

Free at family scale. GitHub Pages and Actions are free for this use. Firebase's free
(Spark) tier includes 50k reads / 20k writes per day and 1 GiB storage — a two-person
household won't get near it.

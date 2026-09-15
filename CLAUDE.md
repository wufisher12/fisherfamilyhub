# Fisher Family Hub

One product, two faces: a private family app (planning, to-dos, news, calendar) and the
Mike Fisher Group business portal (client dashboards). Owner: Mike Fisher; co-user Tina.

Full context: [docs/fisher-hub-context-sept-2026.md](docs/fisher-hub-context-sept-2026.md).
Client dashboard schema: [docs/client-dashboard-contract-v2.md](docs/client-dashboard-contract-v2.md).

## Stack & layout

- React 18 + Vite. Live at https://wufisher12.github.io/fisherfamilyhub/ (GitHub Pages,
  deployed by `.github/workflows/deploy.yml` on push to main, ~2 min).
- `src/App.jsx` — the entire app (~2,700 lines, inline styles, lucide-react icons).
  Deliberately one file so far. Splitting into modules is welcome, but do it as its own
  change, never mixed with a feature.
- `src/firebase-config.js` — public Firebase config. `src/lib/firebase.js` — exports
  `auth`/`db` (family) and `mfgAuth`/`mfgDb` (second app instance so portal login never
  collides with the family session).
- `firestore.rules` (repo root) — the published security rules. Do not weaken them.
- `.github/scripts/` — automation scripts (`news-fetch.mjs`, `calendar-sync.mjs`,
  `brief_render.py`). `brief_render.py` is the ONLY layout code for the morning-brief PDF.

## Auth model (three doors)

1. **Family**: one shared password, username `family@fisherhub.local` baked into config.
2. **Portal** (`?portal=mfg`, own tab, own session via `mfgAuth`): individual Firebase
   users. Roles in collection `mfgRoles/{email}` → `{role: "team"}` (Mike, Aida, Jaimee —
   full portal) or `{role: "client", clientId}` (own dashboard only).
3. **Brief**: `brief@fisherhub.local`, read-only, may read `hub/plan-*` only.

## Firestore data (collection `hub` unless noted)

- `plan-YYYY-MM-DD` — per person (`mike`/`tina`): `priorities` [{id,text,cat,done}]
  ordered, index 0 = the star; `w1`/`w2` workouts; `fun`; `prep`; `shutdownComplete`.
  Shared: `dinner`. Legacy `top3/star/done3` read via `getPriorities()`.
- `todolist` — `mike.items` [{id,text,cat,createdAt,due}] + `mike.notes`. `due` links a
  task to a plan day; task stays until checked off (`completeTodo`).
- `template` — per-person daily anchors/wrap-up.
- `accounts` — [{name,url,username}]. **NEVER passwords.**
- `news`, `calendar` — written by automations. `daywins` — legacy streak data.
- `mfg-client-{clientId}` — client dashboard docs (see contract v2).
- `mfgRoles/{email}` (own collection) — portal roles.

## Client roster

Single source of truth: `CLIENTS` in `App.jsx` (portal uses the same list):
panhandle PHG · bearcamp BCCR · killington TKG · haller HCH · nashville NVH · heights THH ·
newwave NW · franmaxon FMRE · hodnett HC · kauai KREG · ohana OV · giantsridge VGR.
To Do List adds realty RA and personal PERS. Adding a client = one line in `CLIENTS`.

## Design

Navy `#003157`, red `#FF0013` (family), dark red `#B22234`/`#D31017` (portal), gold
`#C8952C`, green `#2F6D54`, coral `#9E3B2F`, bg `#F4F5F7`. Fonts: Bricolage Grotesque +
Inter. Goldfish motif is family-only.

## Automations

- Deploy: GitHub Actions on push to main.
- Shutdown reminder (3:25 PM weekdays) and news fetch (5:00 AM): dispatch-only workflows
  rung externally by cron-job.org — GitHub cron is best-effort, so anything time-critical
  is triggered externally. Keep that pattern.
- Calendar sync (`calendar-sync.yml`, every 30 min daytime ET): GitHub cron; misses
  self-heal. Writes `hub/calendar`.
- Morning brief (4:30 AM): a Claude scheduled task outside this repo; reads `plan-*` as
  the brief account, renders via `.github/scripts/brief_render.py` (fetched raw from this
  repo). Never re-author the renderer in the task.
- Repo secrets (names only): MAIL_USERNAME, MAIL_PASSWORD, MAIL_TO,
  FIREBASE_SERVICE_ACCOUNT, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.

## Current roadmap (Sept 2026)

1. **NOW**: generic client-dashboard renderer in the portal, driven by
   `hub/mfg-client-{clientId}` documents per contract v2 (writers own *what*, hub owns
   *how it looks*; section types: `tiles`, `chart`, `table`, `note`). Bear Camp first.
2. Company Overview engine (received-basis revenue → Gross Profit/Margin MoM).
3. Financials Phase 1 (family, Monarch CSV).
4. Deferred: SMS, Plaid, in-app AI brief, in-portal access manager, streak display.

## Working conventions

- Build-verify (`npm run build`) before committing. Small, single-purpose commits.
  Plain-English summary + one concrete test per change.
- Never store passwords in the app; secrets only in GitHub Actions secrets / env vars.
  Never commit or print a service account.
- Do not weaken `firestore.rules`.
- Push back on bad ideas; honest tradeoffs over hype.

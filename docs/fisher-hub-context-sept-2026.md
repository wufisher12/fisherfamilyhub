# Fisher Family Hub — Project Context (current as of Sept 15, 2026)

Read this before touching anything. It is the source of truth for how the hub is built
and how work on it happens now.

## Who / what
Mike Fisher — Marshfield/Duxbury, MA. Wife Tina (co-user). Kids Annie and Sebastian.
Runs Mike Fisher Group (revenue-management consulting for vacation-rental managers).
The hub is ONE product: a private family app + the Mike Fisher Group business portal.

## Live / repo / stack
- Live: https://wufisher12.github.io/fisherfamilyhub/ · Repo: github.com/wufisher12/fisherfamilyhub
- React 18 + Vite, single file `src/App.jsx` (~2,700 lines, inline styles, lucide-react icons).
  Deliberately one file so far; splitting into modules is welcome now that development is in
  Claude Code, but do it as its own change, not mixed with features.
- Firebase: Firestore (live sync) + Auth. `src/firebase-config.js` holds the public config;
  `src/lib/firebase.js` exports `auth`/`db` (family) and `mfgAuth`/`mfgDb` (a second app
  instance so the portal's login never collides with the family session).
- Deploy: GitHub Pages via `.github/workflows/deploy.yml` on push to main (~2 min).
- Design: navy #003157, red #FF0013 (family), dark red #B22234/#D31017 (portal), gold #C8952C,
  green #2F6D54, coral #9E3B2F, bg #F4F5F7. Fonts Bricolage Grotesque + Inter. Goldfish motif
  is family-only.

## Auth model (three doors)
- Family: one shared password; username `family@fisherhub.local` baked into config.
- Portal (`?portal=mfg`, opens in its own tab, own session via `mfgAuth`): individual
  Firebase users. Roles live in collection `mfgRoles/{email}` → `{role: "team"}` or
  `{role: "client", clientId}`. Team = Mike, Aida, Jaimee (full portal). Client = their own
  dashboard only.
- Brief: `brief@fisherhub.local`, read-only, may read `hub/plan-*` only (used by the
  morning-brief scheduled task).
Security rules (`firestore.rules` in repo root — the published version) enforce all of this
at the database. Do not weaken them.

## Firestore data (collection `hub` unless noted)
- `plan-YYYY-MM-DD`: per person (`mike`/`tina`): `priorities` [{id,text,cat,done}] ordered,
  index 0 = the star; `w1`/`w2` workout lines; `fun` (weekend plans); `prep` {inbox, workout};
  `shutdownComplete`. Shared: `dinner`. Legacy `top3/star/done3` read via `getPriorities()`.
- `todolist`: `mike.items` [{id,text,cat,createdAt,due}] + `mike.notes` {catId}. `due` links a
  task to a plan day; the task stays until its checkbox is checked (`completeTodo`).
- `template`: per-person daily anchors/wrap-up (no in-app editor currently).
- `accounts`: [{name,url,username}] — NEVER passwords.
- `daywins`: historical 100%-day streak data (no longer displayed).
- `news`: {sections:[{id,label,items:[{title,url,source,date}]}], updated}.
- `calendar`: {days:{YYYY-MM-DD:[{t,title}]}, updated} — Mike's Google Calendar, synced.
- `mfg-client-{clientId}`: client dashboard documents (see client-dashboard-contract-v2.md).
- `mfgRoles/{email}` (own collection): portal roles.

## Client roster (single source of truth: `CLIENTS` in App.jsx; portal uses the same list)
panhandle PHG · bearcamp BCCR · killington TKG · haller HCH · nashville NVH · heights THH ·
newwave NW · franmaxon FMRE · hodnett HC · kauai KREG · ohana OV · giantsridge VGR.
To Do List adds realty RA (blue) and personal PERS (red). Adding a client = one line in CLIENTS.

## App surfaces
- Nav: Home · 4pm Shutdown · To Do List · Financials ▾ (shells) · Accounts · [red] Mike Fisher Group.
- Home: Upcoming (calendar, next 4 days) · Financial pulse / Business pulse (placeholders) ·
  Weather · The Feed (news) · Photo of the day · family check-in. No task list on Home by design.
- 4pm Shutdown: "Close out the day!" (emails, workout) → "Tomorrow, {full date}" → Workout #1 |
  Calendar → Priority List (drag to reorder, star = #1) → Workout #2 | Dinner → Shutdown
  complete. Five day pills (tomorrow +4). Weekend days show "Plans & family fun" instead.
- To Do List: blocks per client sorted by count, running-notes popup, checkbox = done,
  "→ PL" schedules onto a day (date chip; red = slipped; tap to move).
- Portal: login → team sees Company Overview / Portfolio Overview / Customer Dashboards
  (12 client cards → each opens `?portal=mfg&client={id}` with tabs). Client login lands on
  its own dashboard only. Dashboard tabs are currently placeholders — the next build.

## Automations (and what clock runs them)
- Deploy: GitHub Actions on push.
- Shutdown reminder email, 3:25 PM weekdays: `shutdown-reminder.yml` is dispatch-only;
  cron-job.org rings it (fine-grained PAT, Actions RW). Has failure notifications.
- News fetch, 5:00 AM daily: `news-fetch.yml` + `scripts/news-fetch.mjs`, triggered the same
  way from cron-job.org. Writes `hub/news`.
- Calendar sync, every 30 min 5 AM–7:30 PM ET: `calendar-sync.yml` + `scripts/calendar-sync.mjs`,
  GitHub cron (misses self-heal). Uses a Google refresh token. Writes `hub/calendar`.
- Morning brief, 4:30 AM daily: a Claude scheduled task (not in this repo). It signs in as the
  brief account, reads today's `plan-*` doc via the Firestore REST API, pulls Google Calendar,
  writes prose, then runs `.github/scripts/brief_render.py` (fetched raw from this repo) to
  produce a one-page PDF, and emails it with the PDF attached. The renderer is the ONLY layout
  code — never re-author it in the task.
Lesson learned: GitHub's cron is best-effort; anything time-critical is triggered externally.

## Repo secrets (names only)
MAIL_USERNAME, MAIL_PASSWORD, MAIL_TO (Gmail SMTP) · FIREBASE_SERVICE_ACCOUNT (admin writes) ·
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN (calendar). Never commit any.

## Routine the hub serves
4:45 wake · 5:00 Workout #1 · 6:00 kids up · 7:45 dropoff · 8:15 desk · 9–11 deep work on the
star · 11–3:30 meetings + priorities · 3:30 HARD STOP → Workout #2 · 4:00 shutdown · 4:30 dinner
start · 5:15 family home · 6:30 Annie down · 8:30 Sebastian down · 9:30 lights out.
Weekends: no work blocks; the fun list is the plan.

## Roadmap
1. NOW: generic client-dashboard renderer in the portal (contract v2), driven by documents
   written by per-client projects (Bear Camp is first, built separately in Claude Code).
2. Company Overview engine: contracts → price per listing → MRR → received-basis revenue
   (billed in arrears: August services land in September) → salaries → Gross Profit $ and
   Gross Margin % MoM — the north star.
3. Financials Phase 1 (family): Monarch CSV via Google Sheets, fixed-expense engine per entity,
   categorization pop-ups, Overview KPIs (net income, forecast, DTI, available to deploy).
4. Deferred: SMS, Plaid, true AI brief in-app, in-portal access manager, streak display.

## Working conventions
- Development now happens in Claude Code (this repo). Claude in the chat project is the
  design/spec partner: it writes specs and contracts; Code writes code.
- Build-verify before committing; small, single-purpose commits; plain-English summary +
  one concrete test per change.
- Never store passwords in the app. Secrets only in GitHub Actions secrets / env vars.
- Push back on bad ideas. Honest tradeoffs over hype.

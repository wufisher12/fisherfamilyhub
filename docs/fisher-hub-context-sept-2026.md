# Fisher Family Hub: Project Context (current as of Sept 15, 2026)

> **Status update (2026-10-07).** This is a dated snapshot and is superseded in part. The
> current truth is `CLAUDE.md` in this repo (where this file and `CLAUDE.md` differ,
> `CLAUDE.md` wins); the dashboard schema is `docs/client-dashboard-contract-v2.md` (v2.3);
> every scheduled job is registered in `../ops/README.md`. The body below is left as written
> on Sept 15. These points in it are now out of date:
>
> - App size: `src/App.jsx` is about 4,540 lines as of Oct 2026, not ~2,700.
> - Portal login: the login box takes an email or a plain username; a username maps to
>   `{name}@fisherhub.local`, and a shared `ohana` client login (role client, clientId
>   ohana) exists for the whole Ohana team. See `CLAUDE.md`, Auth model.
> - Firestore docs: besides `mfg-client-{clientId}` (contract v2.3), the `hub` collection
>   holds the companion docs `mfg-client-{id}-notes` (listing notes), `-res-{period}`
>   (reservation shards) and `-recs` (checklist done-state via a section's `stateDoc`,
>   Giants Ridge first), plus the team-only `mfg-finance-{year}` docs that feed Revenue
>   Tracking and the Company Overview P&L rows under `pnl`. See `CLAUDE.md`, Firestore data.
> - Roster: `CLIENTS` also carries `demo` DEMO (anonymized Bear Camp mirror for prospects;
>   portal only, never a To Do List category), and the To Do List also has `164apr` 164APR
>   (blue). Nashville is a client through Oct 2026: its Customer List card is hidden
>   (`PORTAL_TD_HIDDEN`) and it is excluded from the start-of-year Revenue Tracking
>   roll-forward from 2027 (`FIN_DEPARTED`); it stays in `CLIENTS` so history is untouched.
> - Portal tabs: the team sees Company Overview (Profit and Loss by month with yearly
>   totals; revenue, cost of services and gross profit flow from Revenue Tracking; 2025 per
>   the filed Schedule C, 2026 a 12-row Schedule-C template with auto-computed Car & Truck,
>   Business Use of Home and Phone & Internet; Mileage and SEP blocks; all team-editable),
>   Revenue Tracking (`hub/mfg-finance-{year}`; 2025 seeded from Mike's sheet, 2024 removed;
>   five tiles incl. Gross Margin % and Gross Profit; start-of-year roll-forward excludes
>   departed clients) and Customer List (dashboard cards merged with the shared
>   `hub/todolist`; the client name opens `?portal=mfg&client={id}`; team reads, only
>   mike@fishergroup.co writes). There are no Portfolio Overview or Customer Dashboards
>   tabs. Export PDF buttons sit top right on Company Overview and Revenue Tracking; portal
>   width is 1520. See `CLAUDE.md`, Portal state.
> - Dashboards are built, not placeholders: one generic renderer for contract v2.3
>   documents (`tiles` `chart` `table` `note` `heading` `listingTable` `kpiExplorer`
>   `monthlyCompare` `checklist` `benchmark` `compset` `compsetList` `reservations`);
>   `exportPdf: true` on a tab or subtab adds an Export PDF button (browser print, one
>   landscape Letter page). Headless print mode
>   `?print=<tabId>:<subtabIds>&portrait=<subtabIds>` renders a doc supplied as
>   `window.__PRINT_DOC__` with no auth, one Letter page per subtab, sharing the print CSS
>   via `ensurePrintCss()`; `company-hub/ohana/make_pdfs.py` drives it for the Monday
>   emailed PDFs. Writers live outside this repo: bearcamp-revenue (nightly),
>   company-hub/ohana (Monday, Hostaway API), company-hub/giantsridge (weekly, manual,
>   WebRezPro exports).
> - Automation script paths: the scripts are `.github/scripts/news-fetch.mjs` and
>   `.github/scripts/calendar-sync.mjs` (there is no top-level `scripts/` folder).
>   `news-fetch.yml` is not dispatch-only: it carries its own GitHub cron (`0 9 * * *` UTC
>   = 5 AM EDT; the comment says switch to `0 10` for winter) plus workflow_dispatch, and
>   `../ops/README.md` records that cron-job.org also rings it.
> - Roadmap item 1 is done: the renderer ships contract v2.3 (v2.1 interactive sections
>   2026-09-23; v2.2 doc-level `wide`, table flags and Export PDF 2026-10-05; v2.3
>   monthlyCompare, grouped headers, checklist, heading, chart series `hidden` and
>   `pointLabels` 2026-10-06/07). Roadmap item 2 is done as data entry rather than a
>   contracts/MRR engine: Revenue
>   Tracking holds received-basis revenue by client/month (billed in arrears: August
>   services land in September), AR, cost of services (Aida, Rachel, Jaimee wages) and
>   Gross Profit $ / Gross Margin % MoM, the north star; Company Overview is the P&L by
>   month on top of it. A contracts to price-per-listing to MRR projection layer remains
>   open if still wanted. Current roadmap: `CLAUDE.md`, Roadmap.
> - Working conventions: the Claude Code project root is
>   `C:/Users/mfish/Desktop/claude/projects` (root CLAUDE.md = standing rules + map;
>   `ops/README.md` = registry of every scheduled job); this repo is the `fisherfamilyhub`
>   sub-project beside `company-hub` (client dashboard writers), `fishergroup-site` and
>   `personal`. Standing rules: never read a sheet's Logins tab; never invent data or fill
>   gaps silently; no em dashes in anything written; api/, data/ and out/ are never
>   committed; secrets live only in `C:\Users\mfish\.hub-secrets\` (the hub app's own
>   secrets stay GitHub Actions secrets). Commits end with
>   `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Claude in the chat project
>   is still the design/spec partner; Code writes code.

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

# Fisher Family Hub

One product, two faces: a private family app (planning, to-dos, news, calendar) and the
Mike Fisher Group business portal (client dashboards, company finance). Owner: Mike Fisher;
co-user Tina. The root `../CLAUDE.md` rules apply here (no em dashes, no invented data,
secrets only in `~/.hub-secrets/`, commit trailer).

Context snapshot: [docs/fisher-hub-context-sept-2026.md](docs/fisher-hub-context-sept-2026.md)
(dated; this file wins where they differ).
Client dashboard schema: [docs/client-dashboard-contract-v2.md](docs/client-dashboard-contract-v2.md) (v2.3).

## Stack & layout

- React 18 + Vite. Live at https://wufisher12.github.io/fisherfamilyhub/ (GitHub Pages,
  deployed by `.github/workflows/deploy.yml` on push to main, ~2 min).
- `src/App.jsx` is a 20-line router: `?print=` goes to headless print mode, `?portal=mfg`
  to the portal, anything else to the family app. The code lives in four folders (split
  2026-10-08 as a pure move, inline styles and lucide-react icons throughout):
  - `src/family/` the family face: `FamilyApp.jsx` (shell, nav, auth gate), `HomeTab`,
    `PlanTab`, `TodoListPage`, `FinancialsPage`, `AccountsTab`, `LoginScreen`,
    `ProfileSetup`, `planData.js` (plan defaults, `getPriorities`), `weather.js`, `photo.js`.
  - `src/portal/` the Mike Fisher Group portal: `MFGPortal.jsx` (login state, roles, team
    tabs), `Login`, `ClientScreen` (dashboard chrome around the renderer), `CustomerList`,
    `RevenueTracking`, `CompanyPnL`, `finance.js` (month labels, `finYears`, `finMoney`).
  - `src/shared/dashboard/` the contract renderer: `Section.jsx` dispatches on section
    type to `ui.jsx` (tiles, note, heading, chips, card styles), `Chart`, `Table`,
    `ListingTable`, `KpiExplorer`, `Benchmark`, `Reservations`, `Compset`,
    `MonthlyCompare`, `Checklist`; `print.js` (`ensurePrintCss`) and `PrintScreen.jsx`.
  - `src/lib/` cross-cutting: `firebase.js`, `theme.js` (`T`, `MFG_RED`), `clients.js`
    (the `CLIENTS` roster and To Do List categories), `dates.js`, `format.js`, `hooks.js`
    (`useIsWide`, `useHubDoc`, `useMfgHubDoc`), `params.js` (URL params read once).
  A family change cannot reach portal code and vice versa; both import only from
  `shared/` and `lib/`.
- `src/firebase-config.js` public Firebase config. `src/lib/firebase.js` exports
  `auth`/`db` (family) and `mfgAuth`/`mfgDb` (second app instance so portal login never
  collides with the family session).
- `firestore.rules` (repo root) are the published security rules. Do not weaken them.
- `.github/scripts/` automation scripts (`news-fetch.mjs`, `calendar-sync.mjs`,
  `brief_render.py`). `brief_render.py` is the ONLY layout code for the morning-brief PDF.

## Auth model (three doors)

1. **Family**: one shared password, username `family@fisherhub.local` baked into config.
2. **Portal** (`?portal=mfg`, own tab, own session via `mfgAuth`): individual Firebase
   users. The login form accepts an email or a plain username (`name` maps to
   `name@fisherhub.local`). Roles in `mfgRoles/{email}`: `{role: "team"}` (Mike, Aida,
   Jaimee: full portal) or `{role: "client", clientId}` (own dashboard only). Client logins:
   Jessie Kasztelan (bearcamp); shared `ohana` username for the whole Ohana team.
3. **Brief**: `brief@fisherhub.local`, read-only, may read `hub/plan-*` only.

Headless print mode: `?print=<tabId>:<subtabIds>&portrait=<subtabIds>` renders a client
doc supplied as `window.__PRINT_DOC__` with no auth, one Letter page per subtab, through
the same print stylesheet as the Export PDF buttons (`ensurePrintCss`). Driven by
`company-hub/ohana/make_pdfs.py` for the Monday emailed reports.

## Firestore data (collection `hub` unless noted)

- `plan-YYYY-MM-DD` per person (`mike`/`tina`): `priorities` [{id,text,cat,done}]
  ordered, index 0 = the star; `w1`/`w2` workouts; `fun`; `prep`; `shutdownComplete`.
  Shared: `dinner`. Legacy `top3/star/done3` read via `getPriorities()`.
- `todolist`: `mike.items` [{id,text,cat,createdAt,due}] + `mike.notes`. `due` links a
  task to a plan day; the task stays until checked off (`completeTodo`).
- `template` per-person daily anchors/wrap-up.
- `accounts` [{name,url,username}]. **NEVER passwords.**
- `news`, `calendar` written by automations. `daywins` legacy streak data.
- `mfg-client-{clientId}` client dashboard docs (contract v2.3). Side docs:
  `mfg-client-{id}-notes` (listing notes), `-res-{period}` (reservation shards),
  `-recs` (checklist state for Pricing Recommendations).
- `mfg-finance-{year}` team-edited finance: `clients`, `wages`, `wageLabels`, `pnl`
  (`expenses`, `labels`, `mileage`, `mileageRates`, `sep`, `home`, `homePct`, `homeDepr`,
  `phoneFull`, `phonePct`). Feeds Revenue Tracking and the Company Overview P&L.
- `mfgRoles/{email}` (own collection) portal roles.

## Client roster

Single source of truth: `CLIENTS` in `src/lib/clients.js` (portal uses the same list):
panhandle PHG · bearcamp BCCR · killington TKG · haller HCH · nashville NVH · heights THH ·
newwave NW · franmaxon FMRE · hodnett HC · kauai KREG · ohana OV · giantsridge VGR.
To Do List adds realty RA and personal PERS. Adding a client = one line in `CLIENTS`.
Nashville Vacation Homes leaves at the end of October 2026 (hidden from the Customer List
and excluded from finance roll-forward from 2027; see `FIN_DEPARTED`, `PORTAL_TD_HIDDEN`).

## Design

Navy `#003157`, red `#FF0013` (family), dark red `#B22234`/`#D31017` (portal), gold
`#C8952C`, green `#2F6D54`, coral `#9E3B2F`, bg `#F4F5F7`. Fonts: Bricolage Grotesque +
Inter. Goldfish motif is family-only. Portal width 1520; client dashboards 1100, or 1760
when the doc sets `wide`.

## Automations

- Deploy: GitHub Actions on push to main.
- Shutdown reminder (3:25 PM weekdays) and news fetch (5:00 AM): dispatch-only workflows
  rung externally by cron-job.org. GitHub cron is best-effort, so anything time-critical
  is triggered externally. Keep that pattern.
- Calendar sync (`calendar-sync.yml`, every 30 min daytime ET): GitHub cron; misses
  self-heal. Writes `hub/calendar`.
- Morning brief (4:30 AM): a Claude scheduled task outside this repo; reads `plan-*` as
  the brief account, renders via `.github/scripts/brief_render.py` (fetched raw from this
  repo). Never re-author the renderer in the task.
- Repo secrets (names only): MAIL_USERNAME, MAIL_PASSWORD, MAIL_TO,
  FIREBASE_SERVICE_ACCOUNT, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.
- Every job across the hub is listed in `../ops/README.md`.

## Portal state (October 2026)

- Team tabs: **Company Overview** is a Profit and Loss statement by month with yearly
  totals: Revenue, Cost of Services and Gross Profit from Revenue Tracking, per-year
  expense rows (2025 as filed on Schedule C; 2026 a 12-row Schedule-C-aligned template),
  auto-computed Car & Truck (mileage x IRS rate), Business Use of Home (Form 8829 inputs)
  and Phone & Internet (business %), Mileage and SEP blocks, everything team-editable.
  **Revenue Tracking** (`hub/mfg-finance-{year}`, 2025 onward): received-basis revenue by
  client and month, AR invoiced vs paid, projections, Gross Profit with per-employee wages
  as Cost of Services, five tiles including Gross Margin %, start-of-year roll-forward.
  **Customer List**: dashboard cards merged with the shared `hub/todolist` (team reads,
  ONLY mike@fishergroup.co writes); the client name opens the dashboard. Export PDF
  buttons on Company Overview and Revenue Tracking.
- Client dashboards render contract v2.3: `tiles` `chart` `table` `note` `listingTable`
  `kpiExplorer` `benchmark` `compsetList` `reservations` `monthlyCompare` `checklist`
  `heading`, with tabs and subtabs, `exportPdf`, `wide`, and the table/row flags listed in
  the contract. Built and live: Bear Camp (writer: company-hub/bear-camp/bearcamp-revenue, nightly), Ohana
  (company-hub/ohana, Monday), Villas at Giants Ridge (company-hub/giantsridge, weekly).
  `demo` is a static anonymized Bear Camp mirror for prospects. Browser tab title in the
  portal is "Mike Fisher Group".

## Roadmap

1. The family-app overhaul, rebuilt in `src/family/` (the `App.jsx` split landed 2026-10-08).
2. Personal finance phase 1 in the family face (see `../personal/CLAUDE.md`), on its own
   collections and rules.
3. Custom domain for Pages (for example hub.fishergroup.co) so the product name is free
   of the repo name.
4. More client dashboard writers (Bear Camp is the reference implementation).
5. Deferred: SMS, Plaid, in-app AI brief, in-portal access manager, streak display.

## Working conventions

- Build-verify (`npm run build`) before committing. Small, single-purpose commits.
  Plain-English summary + one concrete test per change.
- Never store passwords in the app; secrets only in GitHub Actions secrets / env vars.
  Never commit or print a service account.
- Do not weaken `firestore.rules`.
- Verify UI changes in the browser (the temporary bypass pattern: copy a doc to
  `docs/sample-client-dashboard.json`, preview, revert before committing).
- Push back on bad ideas; honest tradeoffs over hype.

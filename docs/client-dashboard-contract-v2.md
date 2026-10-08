# Client dashboard contract: layout-as-data (v2, amended through v2.3 on 2026-10-07)

Supersedes the fixed-shape brief. Each client's dashboard project computes its numbers
and writes ONE self-describing document to Firestore; the Fisher Family Hub renders it
with a single generic renderer. Tabs, sections, and KPIs are defined by the writer, so
every client can differ. Look, colors, and typography are owned by the hub.

## Target
- Firebase project `fisher-family-hub`, document `hub/mfg-client-{clientId}`
- clientId is one of: panhandle, bearcamp, killington, haller, nashville, heights,
  newwave, franmaxon, hodnett, kauai, ohana, giantsridge. (`CLIENTS` in App.jsx also
  carries `demo`, a static anonymized Bear Camp mirror for prospects: portal-only, never a
  To Do List category, refreshed only when the Bear Camp writer is run with `--with-demo`.)
  nashville leaves at the end of October 2026.
- Write through the Firestore REST API (a PATCH of the whole document) authenticated with a
  service-account JSON whose path comes from the `FIREBASE_SERVICE_ACCOUNT` env var (default
  `~/.hub-secrets/firebase-sa.json`; the Bear Camp writer still defaults to `data/firebase-sa.json`).
  Never commit or print it. Write only this document and its own `mfg-client-{clientId}-...`
  companions (reservation shards; the checklist state doc is read, not written; the notes doc is
  written by the hub, not the writer). Never touch another client's docs or any non-`mfg-` doc.
  The one sanctioned exception is the Bear Camp writer's on-demand `--with-demo` flag, which
  refreshes the `demo` mirror (`mfg-client-demo` and its shards).

## Document
```json
{
  "clientId": "bearcamp",
  "label": "Bear Camp Cabin Rentals",
  "updated": 1758000000000,
  "asOf": "2026-09-15",
  "tabs": [
    {
      "id": "overview",
      "label": "Overview",
      "sections": [
        {
          "type": "tiles",
          "title": "Headline",
          "items": [
            { "label": "2026 Revenue YoY", "value": "$1.84M", "delta": "+12.4%", "dir": "up", "hint": "received basis" },
            { "label": "Next 60 Days Pacing", "value": "62% APO", "delta": "+4 pts vs LY", "dir": "up" }
          ]
        },
        {
          "type": "chart",
          "title": "Monthly rent revenue vs last year",
          "kind": "bar",
          "xLabels": ["Jan", "Feb", "Mar"],
          "series": [
            { "name": "2026", "values": [142000, 151000, 168000] },
            { "name": "2025", "values": [128000, 139000, 150000] }
          ],
          "format": "currency"
        },
        {
          "type": "table",
          "title": "Top units by revenue",
          "columns": ["Unit", "Revenue", "Occ %"],
          "rows": [
            { "cells": ["Ridge Cabin", "$84K", "78%"] },
            { "cells": ["Creekside", "$71K", "74%"] }
          ]
        },
        { "type": "note", "text": "One line of context worth showing the client." }
      ]
    },
    { "id": "pacing", "label": "Pacing", "sections": [] }
  ]
}
```

## Rules
- Section `type` is one of: `tiles`, `chart`, `table`, `note`, `heading` (v2.3), plus the v2.1
  interactive types below and the v2.3 `monthlyCompare` and `checklist`. Anything else is ignored.
- **v2.1 interactive sections** (2026-09-23, Bear Camp first):
  - `listingTable` — `{summary:{total,byBedrooms}, rows:[{id,name,url,city,
    mapsUrl,bedrooms,absMin,whUrl,tags[]}], notesDoc, note}`. The hub renders
    summary blocks, search + bedroom/tag/city filters, link cells, and an
    editable Notes column stored in the separate Firestore doc `hub/{notesDoc}`
    (`{[listingId]: {text,by,at,history[]}}`) so nightly writer runs never
    touch notes. `notesDoc` must start with `mfg-client-{clientId}-`.
  - `kpiExplorer` — additive components per `{bedrooms,tags}` group per period
    (`cur`/`ly` with `rent`,`booked`,`avail` arrays and `listings`); `kpis`
    declare `expr` of only `sum:<c>`, `ratio:<a>/<b>`, or `count`; `format`
    `currency|percent|number`; `granularity` `month|week`. The hub aggregates
    the current filter selection and evaluates the exprs — no other math.
  - `benchmark` — `{variants:[{id,label,xLabels,series:[{name,entity:
    portfolio|market, vintage: today|prior|ly, values[]}]}], format, note}`.
    Hub styles color-by-entity / dash-by-vintage, variant dropdown, and a
    clickable legend to hide/show series (all charts have this).
  - `compset` — `{name, whUrl, criteria, links:[{label,url|null}],
    stats:{columns,rows}, note}` — draft comp-set layout.
  - `compsetList` — `{sets:[{id,name,kind,paid,updated,criteria,counts,
    kpis:[{label,value}], associated:[{name,whUrl}], chart, chartMonthly,
    columns, rows}], note}`. Hub renders a block per set (name + KPI pairs)
    that expands into rate charts and the sortable member table. Table cells
    anywhere may be `{"text","url"}` to render as a link.
  - `reservations` — `{count, asOf, listings:{idx:{n,br,jk}}, shards:[docIds],
    preview:[{c:[...]}], note}`. Full rows live in companion shard docs
    (`{clientDoc}-res-{period}`, columnar parallel arrays `li,cr,ci,ni,rr,
    la,lc,ln,lb` — a single doc cannot hold tens of thousands of rows under
    Firestore's 1MB cap, and arrays cannot nest). The hub paints the inline
    preview immediately, fetches shards on tab open, and provides search,
    date-range/bedroom/JK filters, sorting, paging, and the LY-ADR hover.
- Interactive-section documents may reach ~500KB (Firestore caps at 1MB).
- Table rows are maps, `{"cells": [...]}` — **Firestore rejects arrays nested
  directly inside arrays**, so `[[...], [...]]` can never be stored (amended
  2026-09-15; the hub renderer accepts both shapes for JSON-side previews).
- `chart.kind` is `line` or `bar`. `format` is `currency`, `percent`, or `number`. A series may
  carry `hidden: true` (starts hidden; one legend click reveals it). A `line` chart may set
  `pointLabels: true` (v2.3): each marker gets its value as a label, above the line for the
  first visible series and below for the next, so close lines do not collide.
- `value` and `delta` are pre-formatted display strings; the hub does no math on them. The
  interactive types that ship raw components (`kpiExplorer`, `reservations`, `monthlyCompare`)
  compute their own derived values client-side by design.
- `dir` is `up` / `down` / `flat` and means "is this good news," not the sign.
- Tabs render in array order; the first tab is the default. A tab may carry
  `subtabs: [{id, label, sections, exportPdf}]` instead of `sections` (v2.2, Ohana first): the hub
  shows a chip row under the tab bar, the first subtab is the default and the choice is remembered
  per tab. Empty `sections` renders a "coming soon" state. Max ~8 tabs, ~6 sections per tab or
  subtab, document under ~200KB.
- Write the whole document each run (last write wins). Idempotent for the same day.
- No writer runs in CI today. Scheduled writers run under Windows Task Scheduler on Mike's PC
  ("BearCamp Nightly Collect" daily 3:00 AM, "Ohana Monday Run" Mondays 7:00 AM Eastern);
  Giants Ridge is published by hand after the weekly WebRezPro exports land. Register every
  scheduled job in the projects-root `ops/README.md` the moment it is created. Keep a manual
  run path; log one line describing what was written.

## Why this split
Writer owns *what* (metrics, tabs, wording). Hub owns *how it looks*. Adding a KPI or a
tab to a client is a writer-side change; adding a new section type is a hub-side change.
Client logins (via the hub's roles) can read only their own document and its
`mfg-client-{clientId}-...` companions (the rules also let them write those docs, which the
listing-notes feature relies on), already enforced.

## v2.2 additions (2026-10-05, first user: Ohana)

- Doc-level `wide: true` stretches the client screen from 1100px to 1760px for
  dense multi-column tables. Omit for everything else.
- `table` sections accept opt-in styling flags (defaults keep v2.1 rendering):
  - `dense: true` — tighter row padding, 12.5px type.
  - `headerFill: true` — Revenue-Tracking-style header: light blue band
    (#D9E9F6), black uppercase type, 2px rule underneath.
  - `stickyFirst: true` — first column stays pinned while the table scrolls
    horizontally.
  - `sortable: false` — disables click-to-sort (required for tables whose rows
    are grouped blocks that must not be reordered).
- Row maps may carry `band: true` (light blue row highlight, bold text) and
  `rule: true` (2px top border separating blocks).
- New cell tone `strong` — ink color, bold (for primary rows among muted ones).
- Amendment (same day): `headerFill` also accepts `"gold"` (light gold band
  instead of blue); rows may carry `sub: true` (smaller, italic — for
  comparison lines under a primary row); sections may set `nowrapFirst: true`
  to keep first-column labels on one line.
- Amendment 2: a tab or subtab may set `exportPdf: true` to show an
  "Export PDF" button, which prints just that tab's sections as one
  landscape Letter page (browser print-to-PDF; nav and controls hidden, a
  print-only title line with client, tab and as-of date added).
- Amendment 3 (2026-10-07, commit cef5954): headless print mode.
  `?print=<tabId>:<subtabId,subtabId>&portrait=<subtabIds>` renders a doc supplied by the host
  page as `window.__PRINT_DOC__` with no auth and no Firestore, one Letter page per requested
  subtab (the whole tab as one page when it has no subtabs; landscape unless the subtab id is
  listed in `portrait`), each block zoomed down to fit its page, with the print-only title line;
  `window.__PRINT_READY__` is set once laid out. The print stylesheet is shared with the Export
  PDF buttons via `ensurePrintCss()`. Used by `company-hub/ohana/make_pdfs.py` (local server
  over `dist/`, Edge `--print-to-pdf`) for the Monday emailed reports.

## v2.3 addition (2026-10-06, first user: Giants Ridge)

- `monthlyCompare` — interactive year-over-year explorer. The doc ships
  per-year monthly data: `years: {"2026": {final: {rent[12], paid[12], owner[12], avail[12]},
  cutK: {rent[12], paid[12]}, cut14d: {rent[12], paid[12]}}}`. `cut14d` (optional) is the
  year's position 14 days before asOf and feeds the 14-day Pickup series. There is one `cutK`
  for every year gap the `cyOptions` x `compOptions` pairs can produce (the hub reads
  `"cut" + (cy - comp)`; Giants Ridge ships cut1..cut4), where
  `cutK` is the year's position with bookings made on or before (asOf
  minus K years). Plus `asOf`, `defaultCy`, `defaultComp`, `cyOptions`,
  `compOptions`. The hub renders filter chips (view year, compare-vs year,
  basis Same-time-LY vs Final, month range with a Full Year reset) and
  recomputes the KPI tiles (Rent, Paid Unit-Nights, ADR, Paid Occupancy, Owner Nights), a line
  chart and the grouped monthly grid client-side. The chart has a Rent / ADR / Occupancy selector,
  point labels on, and up to four series: CY, "14-day Pickup" (from `cut14d`, hidden by default),
  comp STLY, and comp final (hidden by default; a legend click reveals it).
- Amendment (2026-10-06): `table` sections accept `groups` ([{label, span}],
  a centered grouped-header row with separators at group boundaries) and
  `firstColWidth`. New section type `checklist`: {title, stateDoc, rows:
  [{id, focus, text}]}; checking a row strikes it through and writes
  done.{id} into hub/{stateDoc} (team-writable), which the writer reads on
  the next build to drop reviewed items.
- Amendment (2026-10-07, Ohana VR): `table` sections accept `center: true`
  (every column but the first centered, headers too) and `textSize` (cell
  font size in px). `note` sections accept `style: "footnote"` (small
  italic charcoal text, no box). New section type `heading`: {text, sub}
  renders a large section title with an optional smaller italic definition
  line, to introduce a block of sections. Separately, `tiles` sections accept
  `titleStyle: "heading"`, which renders the section's own title as a large blue title
  (20px, #1F6FB2) instead of the small uppercase caption.

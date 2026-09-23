# Client dashboard contract — layout-as-data (v2)

Supersedes the fixed-shape brief. Each client's dashboard project computes its numbers
and writes ONE self-describing document to Firestore; the Fisher Family Hub renders it
with a single generic renderer. Tabs, sections, and KPIs are defined by the writer, so
every client can differ. Look, colors, and typography are owned by the hub.

## Target
- Firebase project `fisher-family-hub`, document `hub/mfg-client-{clientId}`
- clientId is one of: panhandle, bearcamp, killington, haller, nashville, heights,
  newwave, franmaxon, hodnett, kauai, ohana, giantsridge
- Write with the Firebase Admin SDK using a service account from an env var / CI secret.
  Never commit or print it. Write only this document; never touch other `hub` docs.

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
- Section `type` is one of: `tiles`, `chart`, `table`, `note`, plus the v2.1
  interactive types below. Anything else is ignored.
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
    kpis:{comps,medOcc,medAdr}, associated:[{name,whUrl}], columns, rows}],
    note}`. Hub renders a block per set (name + high-level KPIs) that expands
    into the sortable member table. Table cells anywhere may be
    `{"text","url"}` to render as a link.
- Interactive-section documents may reach ~500KB (Firestore caps at 1MB).
- Table rows are maps, `{"cells": [...]}` — **Firestore rejects arrays nested
  directly inside arrays**, so `[[...], [...]]` can never be stored (amended
  2026-09-15; the hub renderer accepts both shapes for JSON-side previews).
- `chart.kind` is `line` or `bar`. `format` is `currency`, `percent`, or `number`.
- `value` and `delta` are pre-formatted display strings; the hub never does math.
- `dir` is `up` / `down` / `flat` and means "is this good news," not the sign.
- Tabs render in array order; the first tab is the default. Empty `sections` renders
  a "coming soon" state. Max ~8 tabs, ~6 sections per tab, document under ~200KB.
- Write the whole document each run (last write wins). Idempotent for the same day.
- Schedule nightly in CI with a manual trigger; log one line describing what was written.

## Why this split
Writer owns *what* (metrics, tabs, wording). Hub owns *how it looks*. Adding a KPI or a
tab to a client is a writer-side change; adding a new section type is a hub-side change.
Client logins (via the hub's roles) can read only their own document — already enforced.

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
          "rows": [["Ridge Cabin", "$84K", "78%"], ["Creekside", "$71K", "74%"]]
        },
        { "type": "note", "text": "One line of context worth showing the client." }
      ]
    },
    { "id": "pacing", "label": "Pacing", "sections": [] }
  ]
}
```

## Rules
- Section `type` is one of: `tiles`, `chart`, `table`, `note`. Anything else is ignored.
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

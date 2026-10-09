import { useState } from "react";
import { T } from "../../lib/theme.js";
import { fmtKpi } from "../../lib/format.js";
import { useIsWide } from "../../lib/hooks.js";
import { MFG_CARD, MfgChipRow, MfgNoteSection } from "./ui.jsx";
import { MfgChartSection } from "./Chart.jsx";

/* ---------------------------------------------------- KPI explorer */
function evalKpi(expr, c, idx) {
  const tot = (arr) => (arr || []).reduce((a, b) => a + (b || 0), 0);
  const val = (name, i) => (i == null ? tot(c[name]) : (c[name]?.[i] ?? 0));
  if (expr === "count") return c.listings;
  const [op, rest] = String(expr).split(":");
  if (op === "sum") return val(rest, idx);
  if (op === "ratio") {
    const [num, den] = rest.split("/");
    const d = val(den, idx);
    return d ? val(num, idx) / d : null;
  }
  return null;
}

export function MfgKpiExplorerSection({ section }) {
  const isWide = useIsWide();
  const [brSel, setBrSel] = useState({});
  const [tagSel, setTagSel] = useState({});
  const groups = Array.isArray(section.groups) ? section.groups : [];
  const anyBr = Object.values(brSel).some(Boolean);
  const anyTag = Object.values(tagSel).some(Boolean);
  const active = groups.filter((g) =>
    (!anyBr || brSel[g.bedrooms]) && (!anyTag || (g.tags || []).some((t) => tagSel[t])));

  const periods = section.periods || [];
  // Components (v2.4 amendment, 2026-10-08): every numeric array in any group's
  // cur or ly is an additive component, so a writer can add one (Bear Camp's
  // occ) without a hub change. The key set is the union across ALL groups and
  // both sides, so it does not shift with the filter selection; a group that
  // lacks a component adds 0 to it. `listings` stays the per-group count.
  const isNumArr = (v) => Array.isArray(v) && v.every((x) => x == null || typeof x === "number");
  const compKeys = [...new Set(groups.flatMap((g) => ["cur", "ly"].flatMap((side) =>
    Object.keys(g[side] || {}).filter((k) => k !== "listings" && isNumArr(g[side][k])))))];
  const combine = (side) => {
    const c = { listings: 0 };
    for (const k of compKeys) c[k] = periods.map(() => 0);
    for (const g of active) {
      c.listings += g.listings || 0;
      for (const k of compKeys) {
        const arr = g[side]?.[k];
        if (isNumArr(arr)) arr.forEach((v, i) => { c[k][i] += v || 0; });
      }
    }
    return c;
  };
  const cur = combine("cur"), ly = combine("ly");

  const chartOf = (kpi) => ({
    type: "chart", kind: "line", title: kpi.label, format: kpi.format,
    pointLabels: !!section.pointLabels,
    xLabels: periods,
    series: [
      { name: "This year", values: periods.map((_, i) => scale(evalKpi(kpi.expr, cur, i), kpi.format)) },
      { name: `LY as of ${section.lyAsOf}`, values: periods.map((_, i) => scale(evalKpi(kpi.expr, ly, i), kpi.format)) },
    ],
  });
  const scale = (v, format) => (v == null ? null : format === "percent" ? Math.round(v * 1000) / 10 : Math.round(v * 100) / 100);

  // Filters (v2.4): black chips sitting on the page background, no card.
  const filters = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <MfgChipRow tone="black" label="Bedrooms" options={section.filters?.bedrooms || []} sel={brSel} setSel={setBrSel} />
      <MfgChipRow tone="black" label="Tags" options={section.filters?.tags || []} sel={tagSel} setSel={setTagSel} />
    </div>
  );

  return (
    <div>
      {/* With a title (v2.4) the section opens with a header row: title and
          sub on the left, filters on the right; on narrow screens the
          filters wrap under the title. Without one, just the filters. */}
      {section.title ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{section.title}</div>
            {section.sub && <div style={{ fontSize: 12.5, color: "#4A5560", fontStyle: "italic", marginTop: 3 }}>{section.sub}</div>}
          </div>
          {filters}
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>{filters}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        {(section.kpis || []).map((k) => {
          const c = evalKpi(k.expr, cur, null), l = evalKpi(k.expr, ly, null);
          const d = c != null && l ? ((c - l) / l) * 100 : null;
          return (
            <div key={k.label} style={{ ...MFG_CARD, marginBottom: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif", margin: "5px 0 2px" }}>{fmtKpi(c, k.format)}</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                LY {fmtKpi(l, k.format)}
                {d != null && Math.abs(d) >= 0.05 && (
                  <span style={{ fontWeight: 800, marginLeft: 6, color: d > 0 ? T.leaf : T.coral }}>{`${d > 0 ? "+" : ""}${d.toFixed(1)}%`}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Exactly two charts per row on desktop at any content width, one on
          narrow screens. chartSize "large" (v2.4) makes each plot taller. */}
      <div style={{ display: "grid", gridTemplateColumns: isWide ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 14, marginBottom: 16 }}>
        {(section.kpis || []).filter((k) => k.expr !== "count").map((k) => (
          <MfgChartSection key={k.label} compact size={section.chartSize === "large" ? "large" : undefined} section={chartOf(k)} />
        ))}
      </div>
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

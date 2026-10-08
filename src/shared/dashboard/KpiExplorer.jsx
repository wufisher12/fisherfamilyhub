import { useState } from "react";
import { T } from "../../lib/theme.js";
import { fmtKpi } from "../../lib/format.js";
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
  const [brSel, setBrSel] = useState({});
  const [tagSel, setTagSel] = useState({});
  const groups = Array.isArray(section.groups) ? section.groups : [];
  const anyBr = Object.values(brSel).some(Boolean);
  const anyTag = Object.values(tagSel).some(Boolean);
  const active = groups.filter((g) =>
    (!anyBr || brSel[g.bedrooms]) && (!anyTag || (g.tags || []).some((t) => tagSel[t])));

  const periods = section.periods || [];
  const combine = (side) => {
    const c = { rent: periods.map(() => 0), booked: periods.map(() => 0), avail: periods.map(() => 0), listings: 0 };
    for (const g of active) {
      c.listings += g.listings || 0;
      for (const k of ["rent", "booked", "avail"]) {
        (g[side]?.[k] || []).forEach((v, i) => { c[k][i] += v || 0; });
      }
    }
    return c;
  };
  const cur = combine("cur"), ly = combine("ly");

  const chartOf = (kpi) => ({
    type: "chart", kind: "line", title: kpi.label, format: kpi.format,
    xLabels: periods,
    series: [
      { name: "This year", values: periods.map((_, i) => scale(evalKpi(kpi.expr, cur, i), kpi.format)) },
      { name: `LY as of ${section.lyAsOf}`, values: periods.map((_, i) => scale(evalKpi(kpi.expr, ly, i), kpi.format)) },
    ],
  });
  const scale = (v, format) => (v == null ? null : format === "percent" ? Math.round(v * 1000) / 10 : Math.round(v * 100) / 100);

  return (
    <div>
      <div style={{ ...MFG_CARD, display: "flex", flexDirection: "column", gap: 10 }}>
        <MfgChipRow label="Bedrooms" options={section.filters?.bedrooms || []} sel={brSel} setSel={setBrSel} />
        <MfgChipRow label="Tags" options={section.filters?.tags || []} sel={tagSel} setSel={setTagSel} />
      </div>
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
      {/* Two charts per row on desktop, one on narrow screens. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 14, marginBottom: 16 }}>
        {(section.kpis || []).filter((k) => k.expr !== "count").map((k) => (
          <MfgChartSection key={k.label} compact section={chartOf(k)} />
        ))}
      </div>
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

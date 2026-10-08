import { useState } from "react";
import { T } from "../../lib/theme.js";
import { MFG_CHIP, MfgTilesSection } from "./ui.jsx";
import { MfgChartSection } from "./Chart.jsx";
import { MfgTableSection } from "./Table.jsx";

/* monthlyCompare (contract v2.3): interactive year-over-year explorer.
   The doc ships per-year monthly data (final + booked-by-aligned-cutoff
   variants); the viewer picks the year, the comparison year, the basis
   (STLY-aligned or final/current) and a month range, and the tiles, line
   chart and table recompute together. */
const MC_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MfgMonthlyCompareSection({ section }) {
  const years = section.years || {};
  const cyOpts = Array.isArray(section.cyOptions) ? section.cyOptions : [];
  const compOpts = Array.isArray(section.compOptions) ? section.compOptions : [];
  const [cy, setCy] = useState(section.defaultCy || cyOpts[0]);
  const [comp, setComp] = useState(section.defaultComp || (section.defaultCy || cyOpts[0]) - 1);
  const [basis, setBasis] = useState("stly");
  const [m0, setM0] = useState(1);
  const [m1, setM1] = useState(12);
  const [chartKpi, setChartKpi] = useState("rent"); // rent | adr | occ

  const pickCy = (y) => { setCy(y); setComp(y - 1); };
  const yd = (y) => years[String(y)] || {};
  const curF = yd(cy).final || {};
  const compCut = yd(comp)["cut" + (cy - comp)] || null;
  const compF = yd(comp).final || {};
  const useStly = basis === "stly" && !!compCut;
  const compSel = useStly ? compCut : compF;
  const compLab = useStly ? `${comp} STLY` : `${comp} final`;

  const asOf = section.asOf ? new Date(section.asOf + "T00:00:00") : new Date();
  const otb = (m) => cy > asOf.getFullYear() || (cy === asOf.getFullYear() && m >= asOf.getMonth() + 1);

  const val = (d, key, m) => (Array.isArray(d[key]) ? d[key][m - 1] : null) ?? 0;
  const range = [];
  for (let m = m0; m <= m1; m++) range.push(m);
  const agg = (d, availFrom) => {
    const a = { rent: 0, paid: 0, owner: 0, avail: 0 };
    range.forEach((m) => {
      a.rent += val(d, "rent", m); a.paid += val(d, "paid", m);
      a.owner += val(d, "owner", m); a.avail += val(availFrom, "avail", m);
    });
    a.adr = a.paid ? a.rent / a.paid : null;
    a.occ = a.avail ? a.paid / a.avail : null;
    return a;
  };
  const A = agg(curF, curF), B = agg(compSel, compF);

  const mk = (v) => (!v ? "—" : Math.abs(v) >= 1000 ? `$${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : `$${Math.round(v)}`);
  const pctTxt = (c, p) => (p ? `${(((c - p) / p) * 100) >= 0 ? "+" : ""}${(((c - p) / p) * 100).toFixed(1)}%` : "");
  const pctCellMc = (c, p) => {
    if (!p) return { text: "—", tone: "muted" };
    const v = ((c - p) / p) * 100;
    if (Math.abs(v) < 0.5) return { text: "0%", tone: "muted" };
    return { text: `${v > 0 ? "+" : ""}${Math.round(v)}%`, tone: v > 0 ? "pos" : "neg" };
  };
  const ptsCellMc = (c, p) => {
    if (c == null || p == null) return { text: "—", tone: "muted" };
    const d = (c - p) * 100;
    if (Math.abs(d) < 0.05) return { text: "0.0 pts", tone: "muted" };
    return { text: `${d > 0 ? "+" : ""}${d.toFixed(1)} pts`, tone: d > 0 ? "pos" : "neg" };
  };

  const tiles = [
    { label: "Rent", value: `$${Math.round(A.rent).toLocaleString()}`, delta: pctTxt(A.rent, B.rent) && `${pctTxt(A.rent, B.rent)} vs ${compLab}`, dir: A.rent >= B.rent ? "up" : "down", hint: `${compLab}: $${Math.round(B.rent).toLocaleString()}` },
    { label: "Paid Unit-Nights", value: A.paid.toLocaleString(), delta: pctTxt(A.paid, B.paid) && `${pctTxt(A.paid, B.paid)} vs ${compLab}`, dir: A.paid >= B.paid ? "up" : "down", hint: `${compLab}: ${B.paid.toLocaleString()}` },
    { label: "ADR", value: A.adr ? `$${Math.round(A.adr)}` : "—", delta: A.adr && B.adr ? `${pctTxt(A.adr, B.adr)} vs ${compLab}` : "", dir: (A.adr || 0) >= (B.adr || 0) ? "up" : "down", hint: B.adr ? `${compLab}: $${Math.round(B.adr)}` : "" },
    { label: "Paid Occupancy", value: A.occ != null ? `${(A.occ * 100).toFixed(1)}%` : "—", delta: A.occ != null && B.occ != null ? `${((A.occ - B.occ) * 100) >= 0 ? "+" : ""}${((A.occ - B.occ) * 100).toFixed(1)} pts` : "", dir: (A.occ || 0) >= (B.occ || 0) ? "up" : "down", hint: B.occ != null ? `${compLab}: ${(B.occ * 100).toFixed(1)}%` : "" },
    { label: "Owner Nights", value: A.owner.toLocaleString(), delta: "", dir: "flat", hint: `${comp} final: ${agg(compF, compF).owner.toLocaleString()}` },
  ];

  // Chart KPI: rent, ADR or paid occupancy, same three series each way.
  const kpiVal = (d, availFrom, m) => {
    if (chartKpi === "rent") return Math.round(val(d, "rent", m));
    const p = val(d, "paid", m);
    if (chartKpi === "adr") return p ? Math.round(val(d, "rent", m) / p) : null;
    const av = val(availFrom, "avail", m);
    return av ? Math.round((p / av) * 1000) / 10 : null;
  };
  const chartFormat = chartKpi === "occ" ? "percent" : "currency";
  const chartKpiLabel = { rent: "rent", adr: "ADR", occ: "paid occupancy" }[chartKpi];
  const chartSeries = [{ name: String(cy), values: range.map((m) => kpiVal(curF, curF, m)) }];
  // 14-day Pickup: the view year's position 14 days ago (hidden by default);
  // the gap to the current line is the last two weeks of pickup.
  const cur14 = yd(cy).cut14d;
  if (cur14) chartSeries.push({ name: "14-day Pickup", values: range.map((m) => kpiVal(cur14, curF, m)), hidden: true });
  if (compCut) chartSeries.push({ name: `${comp} STLY`, values: range.map((m) => kpiVal(compCut, compF, m)) });
  // Final starts hidden (legend click reveals it); apples-to-apples first.
  chartSeries.push({ name: `${comp} final`, values: range.map((m) => kpiVal(compF, compF, m)), hidden: true });

  // One group of columns per KPI: this year, LY final/current, STLY, and the
  // difference vs the selected basis.
  const stlyAt = (key, m) => (compCut ? val(compCut, key, m) : null);
  const diffBase = (fin, stly) => (useStly && stly != null ? stly : fin);
  const ownCell = (c, p) => {
    const d = c - p;
    return { text: d === 0 ? "0" : `${d > 0 ? "+" : ""}${d}`, tone: "muted" };
  };
  const rows = range.map((m) => {
    const r = val(curF, "rent", m), p = val(curF, "paid", m), av = val(curF, "avail", m);
    const fr = val(compF, "rent", m), fp = val(compF, "paid", m), fav = val(compF, "avail", m);
    const sr = stlyAt("rent", m), sp = stlyAt("paid", m);
    const adr = p ? r / p : null, fadr = fp ? fr / fp : null, sadr = sp ? (sr || 0) / sp : null;
    const occ = av ? p / av : null, focc = fav ? fp / fav : null, socc = fav && sp != null ? sp / fav : null;
    const own = val(curF, "owner", m), fown = val(compF, "owner", m);
    return { cells: [
      MC_MONTHS[m - 1] + (otb(m) ? " *" : ""),
      { text: mk(r), tone: "strong" }, { text: mk(fr), tone: "muted" },
      { text: sr != null ? mk(sr) : "—", tone: "muted" }, pctCellMc(r, diffBase(fr, sr)),
      { text: adr ? `$${Math.round(adr)}` : "—", tone: "strong" },
      { text: fadr ? `$${Math.round(fadr)}` : "—", tone: "muted" },
      { text: sadr ? `$${Math.round(sadr)}` : "—", tone: "muted" },
      pctCellMc(adr || 0, diffBase(fadr, sadr) || 0),
      { text: occ != null ? `${Math.round(occ * 100)}%` : "—", tone: "strong" },
      { text: focc != null ? `${Math.round(focc * 100)}%` : "—", tone: "muted" },
      { text: socc != null ? `${Math.round(socc * 100)}%` : "—", tone: "muted" },
      ptsCellMc(occ, diffBase(focc, socc)),
      { text: own ? String(own) : "—", tone: "strong" },
      { text: fown ? String(fown) : "—", tone: "muted" },
      ownCell(own, fown),
    ] };
  });
  const BF = agg(compF, compF);
  rows.push({ cells: [
    "Total",
    { text: mk(A.rent), tone: "strong" }, { text: mk(BF.rent), tone: "muted" },
    { text: compCut ? mk(agg(compCut, compF).rent) : "—", tone: "muted" }, pctCellMc(A.rent, B.rent),
    { text: A.adr ? `$${Math.round(A.adr)}` : "—", tone: "strong" },
    { text: BF.adr ? `$${Math.round(BF.adr)}` : "—", tone: "muted" },
    { text: compCut && agg(compCut, compF).adr ? `$${Math.round(agg(compCut, compF).adr)}` : "—", tone: "muted" },
    pctCellMc(A.adr || 0, B.adr || 0),
    { text: A.occ != null ? `${(A.occ * 100).toFixed(1)}%` : "—", tone: "strong" },
    { text: BF.occ != null ? `${(BF.occ * 100).toFixed(1)}%` : "—", tone: "muted" },
    { text: compCut && agg(compCut, compF).occ != null ? `${(agg(compCut, compF).occ * 100).toFixed(1)}%` : "—", tone: "muted" },
    ptsCellMc(A.occ, B.occ),
    { text: String(A.owner), tone: "strong" }, { text: String(BF.owner), tone: "muted" },
    ownCell(A.owner, BF.owner),
  ], band: true, rule: true });
  const dLab = useStly ? "Δ STLY" : "Δ LY";
  const subCols = [String(cy), String(comp), "STLY", dLab];
  const tblColumns = ["Month", ...subCols, ...subCols, ...subCols, String(cy), String(comp), "Δ"];
  const tblGroups = [{ label: "", span: 1 }, { label: "Rent", span: 4 },
                     { label: "ADR", span: 4 }, { label: "Paid Occupancy", span: 4 },
                     { label: "Owner Nights", span: 3 }];

  const sel = { fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 700, padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.line}`, color: T.ink, background: "#fff" };
  const lbl = { fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginRight: 4 };
  const fullYear = m0 === 1 && m1 === 12;

  return (
    <div>
      <div className="mfg-noprint" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={lbl}>View</span>
        {cyOpts.map((y) => <button key={y} onClick={() => pickCy(y)} style={MFG_CHIP(y === cy)}>{y}</button>)}
        <span style={lbl}>Compare vs</span>
        {compOpts.filter((y) => y < cy).map((y) => <button key={y} onClick={() => setComp(y)} style={MFG_CHIP(y === comp)}>{y}</button>)}
        <span style={lbl}>Basis</span>
        <button onClick={() => setBasis("stly")} style={MFG_CHIP(basis === "stly")} title="Comparison year's bookings on hand at the same relative date">Same time LY</button>
        <button onClick={() => setBasis("final")} style={MFG_CHIP(basis === "final")} title="Comparison year's final (or current) numbers">Final</button>
        <span style={lbl}>Months</span>
        <select value={m0} onChange={(e) => { const v = +e.target.value; setM0(v); if (v > m1) setM1(v); }} style={sel}>
          {MC_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
        <span style={{ color: T.inkSoft, fontWeight: 700 }}>to</span>
        <select value={m1} onChange={(e) => { const v = +e.target.value; setM1(v); if (v < m0) setM0(v); }} style={sel}>
          {MC_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
        <button onClick={() => { setM0(1); setM1(12); }} style={MFG_CHIP(fullYear)}>Full Year</button>
      </div>
      <MfgTilesSection section={{ title: `${cy} vs ${compLab}${fullYear ? "" : ` · ${MC_MONTHS[m0 - 1]}-${MC_MONTHS[m1 - 1]}`}`, titleStyle: "heading", items: tiles }} />
      <div className="mfg-noprint" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span style={lbl}>Chart</span>
        <button onClick={() => setChartKpi("rent")} style={MFG_CHIP(chartKpi === "rent")}>Rent</button>
        <button onClick={() => setChartKpi("adr")} style={MFG_CHIP(chartKpi === "adr")}>ADR</button>
        <button onClick={() => setChartKpi("occ")} style={MFG_CHIP(chartKpi === "occ")}>Occupancy</button>
      </div>
      <MfgChartSection key={`${cy}|${comp}|${chartKpi}`} section={{ kind: "line", title: `Monthly ${chartKpiLabel} (* = on the books at ${section.asOf}; click the legend to show ${comp} final)`, xLabels: range.map((m) => MC_MONTHS[m - 1]), series: chartSeries, format: chartFormat, pointLabels: true }} />
      <MfgTableSection section={{ columns: tblColumns, groups: tblGroups, rows, dense: true, headerFill: "gold", stickyFirst: true, sortable: false, nowrapFirst: true, firstColWidth: 70 }} />
    </div>
  );
}

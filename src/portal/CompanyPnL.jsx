import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { mfgDb } from "../lib/firebase.js";
import { T, MFG_RED } from "../lib/theme.js";
import { useMfgHubDoc } from "../lib/hooks.js";
import { MFG_CARD, MFG_CHIP, MFG_INPUT } from "../shared/dashboard/ui.jsx";
import { FIN_MONTHS, FIN_EMPLOYEES, finYears, finMoney } from "./finance.js";

/* ------------------------------------------------------------------ */
/*  Company Overview — Profit and Loss Statement by month.             */
/*  Revenue, cost of services and GP derive from the same              */
/*  hub/mfg-finance-{year} doc as Revenue Tracking; expense rows,      */
/*  mileage and SEP live in that doc under `pnl` and are team-edited.  */
/* ------------------------------------------------------------------ */
// Home office inputs (Form 8829): FULL home amounts per month; the
// statement takes the business percentage plus monthly depreciation.
const PNL_HOME = [
  ["mortgage-interest", "Mortgage Interest"],
  ["taxes", "Real Estate Taxes"],
  ["insurance", "Homeowners Insurance"],
  ["repairs", "Repairs & Maintenance"],
  ["utilities", "Utilities"],
  ["other", "Other Home Expenses"],
];

// Default template (2026 onward), aligned to the filed Schedule C rows;
// Mike 2026-10-05. Office Expense & Technology consolidates supplies,
// computer equipment, printer ink, laptops, screens. A year doc can still
// override with its own pnl.labels (2025 mirrors that year's filing).
// Team wages (Rachel, Aida, Jaimee; historically filed as Vendors and
// Contract Labor) live in Cost of Services, not here (Mike, 2026-10-05),
// so the statement carries no Vendors or Contract Labor expense rows.
const PNL_EXPENSES = [
  ["advertising", "Advertising"],
  ["car-truck", "Car and Truck (mileage)"],
  ["legal", "Legal and Professional Services"],
  ["office", "Office Expense & Technology"],
  ["travel", "Travel (24a)"],
  ["meals", "Deductible Meals (24b)"],
  ["memberships", "Memberships and License Dues"],
  ["phone", "Phone & Internet (less personal %)"],
  ["software", "Software Subscriptions"],
  ["client-gifts", "Client Gifts"],
  ["research", "Research, Training and Development"],
  ["home-office", "Business Use of Home (8829)"],
];

export function MFGCompanyPnL({ userEmail }) {
  const years = finYears();
  const [year, setYear] = useState(String(Math.min(new Date().getFullYear(), years[years.length - 1])));
  const finDoc = useMfgHubDoc(`mfg-finance-${year}`);
  const [editor, setEditor] = useState(null);   // {key, m} — expense key, "mileage" or "sep"
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const num = (v) => {
    const n = parseFloat(String(v ?? "").replace(/[,$\s]/g, ""));
    return isFinite(n) ? n : null;
  };
  const mval = (map, m) => (map && map[String(m)] != null ? map[String(m)] : null);

  const clients = Object.values(finDoc?.clients || {});
  const wages = finDoc?.wages || {};
  const wageRows = Array.isArray(finDoc?.wageLabels) && finDoc.wageLabels.length
    ? finDoc.wageLabels.map((w) => [w.k, w.label]) : FIN_EMPLOYEES;
  const pnl = finDoc?.pnl || {};
  const exp = pnl.expenses || {};
  // Expense rows: the year's doc may carry its own row set (pnl.labels,
  // e.g. 2025 mirrors the filed Schedule C); otherwise the default list.
  const expRows = Array.isArray(pnl.labels) && pnl.labels.length
    ? pnl.labels.map((w) => [w.k, w.label]) : PNL_EXPENSES;

  const revByMonth = FIN_MONTHS.map((_, i) =>
    clients.reduce((a, c) => a + (mval(c.paid, i + 1) || 0), 0));
  const cosByMonth = FIN_MONTHS.map((_, i) =>
    wageRows.reduce((a, [k]) => a + (mval(wages[k], i + 1) || 0), 0));
  const gpByMonth = FIN_MONTHS.map((_, i) => revByMonth[i] - cosByMonth[i]);
  // Car and Truck auto-compute: when the year doc carries IRS per-month
  // rates (pnl.mileageRates), the row derives from the bottom Mileage row
  // (miles x rate) instead of manual entry.
  const mRates = pnl.mileageRates;
  const autoCar = !!mRates && expRows.some(([k]) => k === "car-truck");
  const carByMonth = FIN_MONTHS.map((_, i) => {
    const mi = mval(pnl.mileage, i + 1), rt = mval(mRates, i + 1);
    return mi != null && rt ? Math.round(mi * rt * 100) / 100 : null;
  });
  // Business use of home auto-compute (Form 8829): full home inputs x the
  // business percentage, plus 1/12 of annual depreciation each month.
  const homePct = pnl.homePct;
  const homeDepr = pnl.homeDepr || 0;
  const autoHome = homePct != null && expRows.some(([k]) => k === "home-office");
  const homeInputsByMonth = FIN_MONTHS.map((_, i) =>
    PNL_HOME.reduce((a, [k]) => a + (mval(pnl.home?.[k], i + 1) || 0), 0));
  const homeByMonth = FIN_MONTHS.map((_, i) => (autoHome
    ? Math.round((homeInputsByMonth[i] * homePct + homeDepr / 12) * 100) / 100
    : null));
  // Phone & Internet auto-compute: full bill x its own business percentage
  // (not the home office share; the filed business use runs much higher).
  const phonePct = pnl.phonePct;
  const autoPhone = phonePct != null && expRows.some(([k]) => k === "phone");
  const phoneByMonth = FIN_MONTHS.map((_, i) => {
    const full = mval(pnl.phoneFull, i + 1);
    return autoPhone && full != null ? Math.round(full * phonePct * 100) / 100 : null;
  });
  const expVal = (k, i) =>
    (autoCar && k === "car-truck") ? carByMonth[i]
    : (autoHome && k === "home-office") ? homeByMonth[i]
    : (autoPhone && k === "phone") ? phoneByMonth[i]
    : mval(exp[k], i + 1);
  const expByMonth = FIN_MONTHS.map((_, i) =>
    expRows.reduce((a, [k]) => a + (expVal(k, i) || 0), 0));
  const netByMonth = FIN_MONTHS.map((_, i) => gpByMonth[i] - expByMonth[i]);
  const tot = (arr) => arr.reduce((a, b) => a + b, 0);

  const save = async (patch) => {
    setSaving(true);
    try {
      await setDoc(doc(mfgDb, "hub", `mfg-finance-${year}`),
        { ...patch, updatedBy: userEmail || "", updatedAt: Date.now() }, { merge: true });
      setEditor(null);
    } catch (e) {
      alert(`Could not save (${e.code || e.message}).`);
    }
    setSaving(false);
  };

  // ---- shared styles (same family as Revenue Tracking)
  const HEADER_BG = "#D9E9F6", ZEBRA = "#F5F7F9", BAND_TOTAL = "#E7EFF6";
  const GREEN_BG = "#E3F0E9", RED_BG = "#FBE9E7", GOLD_BG = "#FBF3E2", GOLD_INK = "#9C721E";
  const th = {
    fontSize: 13, fontWeight: 800, color: "#10181F", background: HEADER_BG,
    textTransform: "uppercase", letterSpacing: "0.04em", padding: "9px 10px",
    textAlign: "right", whiteSpace: "nowrap", borderBottom: `2px solid ${T.ink}`,
  };
  const thName = { ...th, textAlign: "left", position: "sticky", left: 0, zIndex: 2, boxShadow: `2px 0 0 ${T.line}` };
  const tdR = { fontSize: 13.5, color: T.ink, padding: "7px 10px", borderTop: `1px solid ${T.line}`, textAlign: "right", whiteSpace: "nowrap" };
  const tdName = (bg, raised) => ({
    ...tdR, textAlign: "left", fontWeight: 800, fontSize: 14, position: "sticky", left: 0,
    background: bg || "#fff", zIndex: raised ? 60 : 2, boxShadow: `2px 0 0 ${T.line}`,
    minWidth: 230, maxWidth: 300, whiteSpace: "normal",
  });
  const popover = (body) => (
    <div style={{
      position: "absolute", zIndex: 30, top: "100%", right: 0, background: "#fff",
      border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, boxShadow: "0 8px 24px rgba(0,49,87,.18)",
      display: "flex", flexDirection: "column", gap: 8, minWidth: 210, textAlign: "left",
    }}>{body}</div>
  );

  // One full-width styled band row (Revenue / CoS / GP / totals).
  const bandRow = (label, vals, { bg, ink, paren, rule, money = true }) => (
    <tr style={{ background: bg }}>
      <td style={{ ...tdName(bg), color: typeof ink === "function" ? ink(tot(vals)) : ink, borderTop: rule ? `2px solid ${T.ink}` : tdR.borderTop }}>{label}</td>
      {vals.map((v, i) => (
        <td key={i} style={{ ...tdR, fontWeight: 800, color: typeof ink === "function" ? ink(v) : ink, borderTop: rule ? `2px solid ${T.ink}` : tdR.borderTop }}>
          {paren && v ? <>({finMoney(Math.abs(v), "$0")})</> : finMoney(v, money ? "$0" : "–")}
        </td>
      ))}
      <td style={{ ...tdR, fontWeight: 800, background: BAND_TOTAL, color: typeof ink === "function" ? ink(tot(vals)) : ink, borderTop: rule ? `2px solid ${T.ink}` : tdR.borderTop }}>
        {paren && tot(vals) ? <>({finMoney(Math.abs(tot(vals)), "$0")})</> : finMoney(tot(vals), "$0")}
      </td>
    </tr>
  );

  // An editable monthly row stored under pnl.* (expenses, mileage, sep).
  const editRow = (key, label, map, patchFor, { indent = 20, color = T.coral, paren = true, money = true, zebra } = {}) => (
    <tr key={key} style={{ background: zebra ? ZEBRA : "#fff" }}>
      <td style={{ ...tdName(zebra ? ZEBRA : "#fff", editor?.key === key), fontWeight: 600, paddingLeft: indent }}>{label}</td>
      {FIN_MONTHS.map((_, i) => {
        const m = i + 1, v = mval(map, m);
        const isEd = editor?.key === key && editor.m === m;
        return (
          <td key={m} style={{ ...tdR, position: "relative", cursor: "pointer", zIndex: isEd ? 60 : undefined, background: isEd ? T.skySoft : undefined }}
            onClick={() => !isEd && (setEditor({ key, m }), setDraft({ v: v ?? "" }))}>
            {v != null
              ? (paren ? <span style={{ color }}>({money ? finMoney(v) : Math.round(v).toLocaleString()})</span>
                       : <span style={{ color }}>{money ? finMoney(v) : Math.round(v).toLocaleString()}</span>)
              : "–"}
            {isEd && popover(<>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink }}>{label} · {FIN_MONTHS[i]} {year}</div>
              <label style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, display: "flex", flexDirection: "column", gap: 3 }}>
                {money ? "Amount ($)" : "Amount"}
                <input autoFocus value={draft.v ?? ""} onChange={(e) => setDraft({ v: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditor(null); if (e.key === "Enter") save(patchFor(m, num(draft.v))); }}
                  style={{ ...MFG_INPUT, fontWeight: 600 }} />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={saving} onClick={() => save(patchFor(m, num(draft.v)))} style={MFG_CHIP(true)}>{saving ? "Saving…" : "Save"}</button>
                <button onClick={() => setEditor(null)} style={MFG_CHIP(false)}>Cancel</button>
              </div>
            </>)}
          </td>
        );
      })}
      <td style={{ ...tdR, fontWeight: 700, background: BAND_TOTAL, color: mapTotal(map) ? color : T.ink }}>
        {mapTotal(map)
          ? (paren ? <>({money ? finMoney(mapTotal(map)) : Math.round(mapTotal(map)).toLocaleString()})</>
                   : (money ? finMoney(mapTotal(map)) : Math.round(mapTotal(map)).toLocaleString()))
          : "–"}
      </td>
    </tr>
  );
  const mapTotal = (map) => FIN_MONTHS.reduce((a, _, i) => a + (mval(map, i + 1) || 0), 0);

  return (
    <div>
      <div className="mfg-noprint" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {years.map((y) => (
          <button key={y} onClick={() => setYear(String(y))} style={MFG_CHIP(String(y) === year)}>{y}</button>
        ))}
      </div>
      <div className="mfg-print-title" style={{ display: "none", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, borderBottom: `3px solid ${T.ink}`, paddingBottom: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Mike Fisher Group · Profit and Loss Statement {year}</span>
        <span style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600 }}>Prepared {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>

      <div className="mfg-table-card" style={{ ...MFG_CARD, overflowX: "auto" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: MFG_RED, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Profit and Loss Statement</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic", margin: "2px 0 12px" }}>
          Revenue, cost of services and gross profit flow from Revenue Tracking · click any expense, mileage or SEP cell to edit
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1400 }}>
          <thead>
            <tr>
              <th style={thName}>{year}</th>
              {FIN_MONTHS.map((m) => <th key={m} style={th}>{m}</th>)}
              <th style={{ ...th, background: BAND_TOTAL }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {bandRow("Total Revenue", revByMonth, { bg: GREEN_BG, ink: T.leaf })}
            {bandRow("Cost of Services", cosByMonth, { bg: RED_BG, ink: T.coral, paren: true })}
            {bandRow("Gross Profit", gpByMonth, { bg: GOLD_BG, ink: GOLD_INK })}
            <tr>
              <td colSpan={14} style={{ ...tdR, textAlign: "left", fontWeight: 800, fontSize: 14, color: MFG_RED, background: "#FDF3F2", borderTop: `2px solid ${T.ink}` }}>Expenses</td>
            </tr>
            {expRows.map(([k, label], ri) => {
              const zebra = ri % 2 === 1;
              const autoRow = (vals, hint, titleAt) => (
                <tr key={k} style={{ background: zebra ? ZEBRA : "#fff" }}>
                  <td style={{ ...tdName(zebra ? ZEBRA : "#fff"), fontWeight: 600, paddingLeft: 20 }} title={hint}>
                    {label} <span style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft }}>AUTO</span>
                  </td>
                  {FIN_MONTHS.map((_, i) => (
                    <td key={i} style={tdR} title={titleAt(i)}>
                      {vals[i] != null && vals[i] !== 0 ? <span style={{ color: T.coral }}>({finMoney(vals[i])})</span> : "–"}
                    </td>
                  ))}
                  <td style={{ ...tdR, fontWeight: 700, background: BAND_TOTAL, color: T.coral }}>
                    {tot(vals.map((v) => v || 0)) ? <>({finMoney(tot(vals.map((v) => v || 0)))})</> : "–"}
                  </td>
                </tr>
              );
              if (autoCar && k === "car-truck") {
                return autoRow(carByMonth, "Computed from the Mileage row at the IRS rate",
                  (i) => (mval(mRates, i + 1) ? `${mval(pnl.mileage, i + 1) ?? 0} mi × $${mval(mRates, i + 1)}` : undefined));
              }
              if (autoHome && k === "home-office") {
                return autoRow(homeByMonth, "Computed from the Home Office Inputs block below",
                  (i) => `$${Math.round(homeInputsByMonth[i]).toLocaleString()} home costs × ${(homePct * 100).toFixed(2)}% + $${Math.round(homeDepr / 12)} depreciation`);
              }
              if (autoPhone && k === "phone") {
                return autoRow(phoneByMonth, "Computed from the full bill in the inputs block below",
                  (i) => (mval(pnl.phoneFull, i + 1) != null ? `$${mval(pnl.phoneFull, i + 1)} full bill × ${(phonePct * 100).toFixed(2)}%` : undefined));
              }
              return editRow(k, label, exp[k], (m, v) => ({ pnl: { expenses: { [k]: { [String(m)]: v } } } }), { zebra });
            })}
            {bandRow("Total Expenses", expByMonth, { bg: RED_BG, ink: T.coral, paren: true })}
            {bandRow("Net Income", netByMonth, { bg: BAND_TOTAL, ink: (v) => (v < 0 ? T.coral : T.leaf), rule: true })}
            <tr><td colSpan={14} style={{ padding: 6, border: "none" }} /></tr>
            {editRow("mileage", "Mileage (miles)", pnl.mileage, (m, v) => ({ pnl: { mileage: { [String(m)]: v } } }),
              { indent: 10, color: T.ink, paren: false, money: false })}
            {editRow("sep", "SEP Contribution", pnl.sep, (m, v) => ({ pnl: { sep: { [String(m)]: v } } }),
              { indent: 10, color: T.ink, paren: false })}
            {(autoHome || autoPhone) && (
              <>
                <tr><td colSpan={14} style={{ padding: 6, border: "none" }} /></tr>
                <tr>
                  <td colSpan={14} style={{ ...tdR, textAlign: "left", fontWeight: 800, fontSize: 14, color: T.ink, background: HEADER_BG, borderTop: `2px solid ${T.ink}`, position: "relative" }}>
                    Home Office & Phone Inputs
                    <button onClick={() => { setEditor({ key: "home-cfg" }); setDraft({ pct: homePct != null ? (homePct * 100).toFixed(2) : "", depr: homeDepr || "", ppct: phonePct != null ? (phonePct * 100).toFixed(2) : "" }); }}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: "#1F6FB2", fontSize: 11.5, fontWeight: 800, marginLeft: 12, fontFamily: "Inter, sans-serif" }}>
                      {autoHome ? `home ${(homePct * 100).toFixed(2)}% · depreciation ${finMoney(homeDepr, "$0")}/yr · ` : ""}{autoPhone ? `phone ${(phonePct * 100).toFixed(2)}% · ` : ""}edit
                    </button>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, fontStyle: "italic", marginLeft: 10 }}>
                      enter FULL amounts; the statement takes each business share (home office adds monthly depreciation)
                    </span>
                    {editor?.key === "home-cfg" && popover(<>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink }}>Auto-compute settings · {year}</div>
                      <label style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, display: "flex", flexDirection: "column", gap: 3 }}>
                        Business use of home (%)
                        <input autoFocus value={draft.pct ?? ""} onChange={(e) => setDraft((d) => ({ ...d, pct: e.target.value }))}
                          onKeyDown={(e) => e.key === "Escape" && setEditor(null)} style={{ ...MFG_INPUT, fontWeight: 600 }} />
                      </label>
                      <label style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, display: "flex", flexDirection: "column", gap: 3 }}>
                        Annual depreciation ($, Form 8829 line 42)
                        <input value={draft.depr ?? ""} onChange={(e) => setDraft((d) => ({ ...d, depr: e.target.value }))}
                          onKeyDown={(e) => e.key === "Escape" && setEditor(null)} style={{ ...MFG_INPUT, fontWeight: 600 }} />
                      </label>
                      <label style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, display: "flex", flexDirection: "column", gap: 3 }}>
                        Phone & Internet business use (%)
                        <input value={draft.ppct ?? ""} onChange={(e) => setDraft((d) => ({ ...d, ppct: e.target.value }))}
                          onKeyDown={(e) => e.key === "Escape" && setEditor(null)} style={{ ...MFG_INPUT, fontWeight: 600 }} />
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button disabled={saving} onClick={() => save({ pnl: { homePct: (num(draft.pct) || 0) / 100, homeDepr: num(draft.depr) || 0, phonePct: (num(draft.ppct) || 0) / 100 } })}
                          style={MFG_CHIP(true)}>{saving ? "Saving…" : "Save"}</button>
                        <button onClick={() => setEditor(null)} style={MFG_CHIP(false)}>Cancel</button>
                      </div>
                    </>)}
                  </td>
                </tr>
                {autoHome && PNL_HOME.map(([k, label], ri) =>
                  editRow("home-" + k, label, pnl.home?.[k], (m, v) => ({ pnl: { home: { [k]: { [String(m)]: v } } } }),
                    { indent: 20, color: T.ink, paren: false, zebra: ri % 2 === 1 }))}
                {autoPhone && editRow("phone-full", "Phone & Internet (full bill)", pnl.phoneFull,
                  (m, v) => ({ pnl: { phoneFull: { [String(m)]: v } } }),
                  { indent: 20, color: T.ink, paren: false, zebra: PNL_HOME.length % 2 === 1 })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

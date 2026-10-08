import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { mfgDb } from "../lib/firebase.js";
import { T, MFG_RED } from "../lib/theme.js";
import { useMfgHubDoc } from "../lib/hooks.js";
import { MFG_CARD, MFG_CHIP, MFG_INPUT, MfgNoteSection } from "../shared/dashboard/ui.jsx";
import { FIN_MONTHS, FIN_EMPLOYEES, finYears, finMoney, FIN_DEPARTED } from "./finance.js";

/* ------------------------------------------------------------------ */
/*  Revenue Tracking — received-basis revenue log + AR + Gross Profit  */
/*  Team-only. Data lives in hub/mfg-finance-{year}, edited in place.  */
/* ------------------------------------------------------------------ */

export function MFGRevenueTracking({ userEmail }) {
  const years = finYears();
  const [year, setYear] = useState(String(Math.min(new Date().getFullYear(), years[years.length - 1])));
  const finDoc = useMfgHubDoc(`mfg-finance-${year}`);
  // Prior year's doc feeds the start-of-year roll-forward.
  const prevDoc = useMfgHubDoc(`mfg-finance-${Number(year) - 1}`);
  const [editor, setEditor] = useState(null);   // {cid, m} | {cid, field:"meta"} | {emp, m} | {add:true}
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const clients = Object.entries(finDoc?.clients || {})
    .map(([cid, c]) => ({ cid, ...c }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.label || "").localeCompare(b.label || ""));
  const wages = finDoc?.wages || {};

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

  const num = (v) => {
    const n = parseFloat(String(v ?? "").replace(/[,$\s]/g, ""));
    return isFinite(n) ? n : null;
  };
  const mval = (map, m) => (map && map[String(m)] != null ? map[String(m)] : null);

  // ---- aggregates
  const recvByMonth = FIN_MONTHS.map((_, i) =>
    clients.reduce((a, c) => a + (mval(c.paid, i + 1) || 0), 0));
  const invByMonth = FIN_MONTHS.map((_, i) =>
    clients.reduce((a, c) => a + (mval(c.inv, i + 1) || 0), 0));
  const totalRecv = recvByMonth.reduce((a, b) => a + b, 0);
  const totalProj = clients.reduce((a, c) => a + (c.proj || 0), 0);
  const outstanding = invByMonth.reduce((a, b) => a + b, 0) - totalRecv;
  // Cost-of-services rows: the per-employee defaults, unless the year's doc
  // names its own rows (e.g. 2025 only has aggregate Vendors + Contract
  // Labor from the P&L, not a per-employee split).
  const wageRows = Array.isArray(finDoc?.wageLabels) && finDoc.wageLabels.length
    ? finDoc.wageLabels.map((w) => [w.k, w.label])
    : FIN_EMPLOYEES;
  const wagesByMonth = FIN_MONTHS.map((_, i) =>
    wageRows.reduce((a, [k]) => a + (mval(wages[k], i + 1) || 0), 0));
  const gpByMonth = FIN_MONTHS.map((_, i) => recvByMonth[i] - wagesByMonth[i]);
  const totalWages = wagesByMonth.reduce((a, b) => a + b, 0);

  // Distinct colors per column family so nothing blends: months in navy,
  // Total banded sky, Projected banded gold, % in blue (green at goal).
  const BAND_TOTAL = "#E7EFF6", BAND_PROJ = "#FBF3E2", ZEBRA = "#F5F7F9";
  const PROJ_INK = "#9C721E", PCT_INK = "#1F6FB2";
  // Header row: light blue, black type, larger than data rows, ruled off
  // underneath (Mike, 2026-10-05).
  const HEADER_BG = "#D9E9F6";
  const th = {
    fontSize: 13, fontWeight: 800, color: "#10181F", background: HEADER_BG,
    textTransform: "uppercase", letterSpacing: "0.04em", padding: "9px 10px",
    textAlign: "right", whiteSpace: "nowrap", borderBottom: `2px solid ${T.ink}`,
  };
  const thName = { ...th, textAlign: "left", position: "sticky", left: 0, zIndex: 2, boxShadow: `2px 0 0 ${T.line}` };
  const thTotal = th, thProj = th, thPct = th;
  const tdR = { fontSize: 13.5, color: T.ink, padding: "9px 10px", borderTop: `1px solid ${T.line}`, textAlign: "right", whiteSpace: "nowrap" };
  const tdTotal = { ...tdR, fontWeight: 800, background: BAND_TOTAL };
  const tdProj = { ...tdR, color: PROJ_INK, fontWeight: 700, background: BAND_PROJ };
  // `raised` lifts the cell above later rows' sticky cells while its editor
  // popover is open - without it the popover paints behind the next rows.
  const tdName = (bg, raised) => ({
    ...tdR, textAlign: "left", fontWeight: 800, fontSize: 14, position: "sticky", left: 0,
    background: bg || "#fff", zIndex: raised ? 60 : 2, boxShadow: `2px 0 0 ${T.line}`,
    minWidth: 180, maxWidth: 240, whiteSpace: "normal",
  });
  const tile = (label, value, sub, color) => (
    <div key={label} style={{ ...MFG_CARD, marginBottom: 0, padding: "12px 16px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkSoft }}>{sub}</div>}
    </div>
  );

  const popover = (body) => (
    <div style={{
      position: "absolute", zIndex: 30, top: "100%", right: 0, background: "#fff",
      border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, boxShadow: "0 8px 24px rgba(0,49,87,.18)",
      display: "flex", flexDirection: "column", gap: 8, minWidth: 210, textAlign: "left",
    }}>{body}</div>
  );
  const field = (label, key, auto) => (
    <label style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, display: "flex", flexDirection: "column", gap: 3 }}>
      {label}
      <input autoFocus={auto} value={draft[key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        onKeyDown={(e) => e.key === "Escape" && setEditor(null)}
        style={{ ...MFG_INPUT, fontWeight: 600 }} />
    </label>
  );
  const popButtons = (onSave, onRemove) => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button disabled={saving} onClick={onSave} style={MFG_CHIP(true)}>{saving ? "Saving…" : "Save"}</button>
      <button onClick={() => setEditor(null)} style={MFG_CHIP(false)}>Cancel</button>
      {onRemove && <button onClick={onRemove} title="Remove this row"
        style={{ border: "none", background: "transparent", color: T.coral, cursor: "pointer", fontSize: 11.5, fontWeight: 800, marginLeft: "auto", fontFamily: "Inter, sans-serif" }}>Remove</button>}
    </div>
  );

  const openCell = (cid, m, c) => {
    setEditor({ cid, m });
    setDraft({ inv: mval(c.inv, m) ?? "", paid: mval(c.paid, m) ?? "" });
  };

  return (
    <div>
      <div className="mfg-noprint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {years.map((y) => (
            <button key={y} onClick={() => setYear(String(y))} style={MFG_CHIP(String(y) === year)}>{y}</button>
          ))}
        </div>
        <button onClick={() => { setEditor({ add: true }); setDraft({ label: "", proj: "" }); }} style={MFG_CHIP(true)}>+ Add client</button>
      </div>
      <div className="mfg-print-title" style={{ display: "none", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, borderBottom: `3px solid ${T.ink}`, paddingBottom: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Mike Fisher Group · Revenue Tracking {year}</span>
        <span style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600 }}>Received basis · Prepared {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>

      <div className="mfg-noprint">
        <MfgNoteSection section={{ text: "Billed in arrears, logged on the RECEIVED date: January services are invoiced Jan 31 and count as February revenue. Enter each month's invoice when it goes out, then the amount paid — matching amounts mean $0 accounts receivable." }} />
      </div>

      {finDoc !== undefined && clients.length === 0 && Object.keys(prevDoc?.clients || {}).length > 0 && (
        <div className="mfg-noprint" style={{ ...MFG_CARD, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 600 }}>
            No clients yet for {year}. Start from the {Number(year) - 1} client list? Departed clients are left out; projections start blank.
          </div>
          <button disabled={saving} style={MFG_CHIP(true)} onClick={() => {
            const next = {};
            Object.entries(prevDoc.clients).forEach(([cid, c]) => {
              if (!FIN_DEPARTED.includes(cid)) next[cid] = { label: c.label || cid, order: c.order ?? 999 };
            });
            save({ clients: next, seededFrom: `mfg-finance-${Number(year) - 1} client list, departed clients excluded` });
          }}>{saving ? "Starting…" : `Start ${year} from ${Number(year) - 1}`}</button>
        </div>
      )}

      {/* Five tiles on one line (Mike, 2026-10-05): GP green, margin gold. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
        {tile("Received " + year, finMoney(totalRecv, "$0"), null, T.leaf)}
        {tile("Outstanding AR", finMoney(outstanding, "$0"), outstanding > 0 ? "invoiced, not yet paid" : "all invoices collected", outstanding > 0 ? T.coral : T.leaf)}
        {tile("% to Projection", totalProj ? `${((totalRecv / totalProj) * 100).toFixed(1)}%` : "–", totalProj ? `of ${finMoney(totalProj)} projected` : "set client projections")}
        {tile("Gross Profit " + year, finMoney(totalRecv - totalWages, "$0"), null, T.leaf)}
        {tile("Gross Margin %", totalRecv ? `${(((totalRecv - totalWages) / totalRecv) * 100).toFixed(1)}%` : "–", "of received revenue", T.marigoldDeep)}
      </div>

      {editor?.add && (
        <div style={{ ...MFG_CARD, position: "relative" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            {field("Client name", "label", true)}
            {field("Projected ARR ($)", "proj")}
            {popButtons(() => {
              const label = (draft.label || "").trim();
              if (!label) return;
              const cid = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client";
              save({ clients: { [cid]: { label, proj: num(draft.proj), order: clients.length + 1 } } });
            })}
          </div>
        </div>
      )}

      <div className="mfg-table-card" style={{ ...MFG_CARD, overflowX: "auto" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: MFG_RED, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Revenue</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic", margin: "2px 0 12px" }}>Received basis, logged by payment date · click a cell to log invoice & payment</div>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1340 }}>
          <thead>
            {/* The year's money line rides on top, like the template sheet. */}
            <tr style={{ background: BAND_TOTAL }}>
              <td style={{ ...tdName(BAND_TOTAL), color: T.leaf, borderTop: "none" }}>Total received</td>
              {recvByMonth.map((v, i) => <td key={i} style={{ ...tdR, fontWeight: 800, color: T.leaf, borderTop: "none" }}>{finMoney(v, "$0")}</td>)}
              <td style={{ ...tdTotal, color: T.leaf, borderTop: "none" }}>{finMoney(totalRecv, "$0")}</td>
              <td style={{ ...tdProj, borderTop: "none" }}>{finMoney(totalProj)}</td>
              <td style={{ ...tdR, fontWeight: 800, color: PCT_INK, borderTop: "none" }}>{totalProj ? `${((totalRecv / totalProj) * 100).toFixed(0)}%` : "–"}</td>
            </tr>
            <tr>
              <th style={thName}>Client</th>
              {FIN_MONTHS.map((m) => <th key={m} style={th}>{m}</th>)}
              <th style={thTotal}>Total</th><th style={thProj}>Projected</th><th style={thPct}>% to Proj</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c, ri) => {
              const total = FIN_MONTHS.reduce((a, _, i) => a + (mval(c.paid, i + 1) || 0), 0);
              const rowBg = ri % 2 ? ZEBRA : "#fff";
              const metaOpen = editor?.cid === c.cid && editor.field === "meta";
              return (
                <tr key={c.cid} style={{ background: rowBg }}>
                  <td style={tdName(rowBg, metaOpen)}>
                    <button onClick={() => { setEditor({ cid: c.cid, field: "meta" }); setDraft({ label: c.label, proj: c.proj ?? "" }); }}
                      title="Edit name / projection"
                      style={{ border: "none", background: "transparent", color: T.ink, fontWeight: 800, cursor: "pointer", padding: 0, textAlign: "left", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
                      {c.label}
                    </button>
                    {editor?.cid === c.cid && editor.field === "meta" && popover(<>
                      {field("Client name", "label", true)}
                      {field("Projected ARR ($)", "proj")}
                      {popButtons(
                        () => save({ clients: { [c.cid]: { label: (draft.label || c.label).trim(), proj: num(draft.proj) } } }),
                        () => { if (window.confirm(`Remove ${c.label} and its ${year} entries?`)) save({ clients: { [c.cid]: null } }); })}
                    </>)}
                  </td>
                  {FIN_MONTHS.map((_, i) => {
                    const m = i + 1, inv = mval(c.inv, m), paid = mval(c.paid, m);
                    const open = (inv || 0) - (paid || 0);
                    const isEd = editor?.cid === c.cid && editor.m === m;
                    return (
                      <td key={m} style={{ ...tdR, position: "relative", cursor: "pointer", zIndex: isEd ? 60 : undefined, background: isEd ? T.skySoft : open > 0 ? "#FDF3E7" : undefined }}
                        onClick={() => !isEd && openCell(c.cid, m, c)}>
                        <span style={{ color: open > 0 ? T.marigoldDeep : T.ink, fontWeight: open > 0 ? 800 : 500 }}>
                          {inv == null && paid == null ? "–" : finMoney(paid, "$0")}
                        </span>
                        {open > 0 && <div style={{ fontSize: 9.5, color: T.coral, fontWeight: 800 }}>{finMoney(open)} due</div>}
                        {isEd && popover(<>
                          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink }}>{c.label} · {FIN_MONTHS[i]} {year}</div>
                          {field("Invoiced ($)", "inv", true)}
                          {field("Paid ($)", "paid")}
                          <button onClick={() => setDraft((d) => ({ ...d, paid: d.inv }))}
                            style={{ ...MFG_CHIP(false), alignSelf: "flex-start" }}>Mark paid in full</button>
                          {popButtons(() => save({ clients: { [c.cid]: { inv: { [String(m)]: num(draft.inv) }, paid: { [String(m)]: num(draft.paid) } } } }))}
                        </>)}
                      </td>
                    );
                  })}
                  <td style={tdTotal}>{finMoney(total, "$0")}</td>
                  <td style={tdProj}>{finMoney(c.proj)}</td>
                  <td style={{ ...tdR, fontWeight: 800, color: c.proj && total / c.proj >= 1 ? T.leaf : PCT_INK }}>
                    {c.proj ? `${((total / c.proj) * 100).toFixed(0)}%` : "–"}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td style={{ ...tdName(), fontWeight: 700, borderTop: `2px solid ${T.ink}` }}>Outstanding AR</td>
              {FIN_MONTHS.map((_, i) => {
                const o = invByMonth[i] - recvByMonth[i];
                return <td key={i} style={{ ...tdR, borderTop: `2px solid ${T.ink}`, color: o > 0 ? T.coral : "#9AA6B2", fontWeight: o > 0 ? 800 : 500 }}>{o ? finMoney(o) : "–"}</td>;
              })}
              <td style={{ ...tdTotal, borderTop: `2px solid ${T.ink}`, color: outstanding > 0 ? T.coral : T.leaf }}>{finMoney(outstanding, "$0")}</td>
              <td style={{ ...tdProj, borderTop: `2px solid ${T.ink}` }} />
              <td style={{ ...tdR, borderTop: `2px solid ${T.ink}` }} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mfg-table-card" style={{ ...MFG_CARD, overflowX: "auto" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: MFG_RED, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Gross Profit</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic", margin: "2px 0 12px" }}>Revenue minus cost of services · click a wage cell to edit</div>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1180 }}>
          <thead>
            <tr style={{ background: BAND_TOTAL }}>
              <td style={{ ...tdName(BAND_TOTAL), color: T.leaf, borderTop: "none" }}>Gross Profit</td>
              {gpByMonth.map((v, i) => <td key={i} style={{ ...tdR, fontWeight: 800, borderTop: "none", color: v < 0 ? T.coral : T.leaf }}>{finMoney(v, "$0")}</td>)}
              <td style={{ ...tdTotal, borderTop: "none", color: totalRecv - totalWages < 0 ? T.coral : T.leaf }}>{finMoney(totalRecv - totalWages, "$0")}</td>
            </tr>
            <tr>
              <th style={thName} />
              {FIN_MONTHS.map((m) => <th key={m} style={th}>{m}</th>)}
              <th style={thTotal}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdName()}>Total Revenue</td>
              {recvByMonth.map((v, i) => <td key={i} style={{ ...tdR, fontWeight: 700 }}>{finMoney(v, "$0")}</td>)}
              <td style={tdTotal}>{finMoney(totalRecv, "$0")}</td>
            </tr>
            {wageRows.map(([k, name], ri) => (
              <tr key={k} style={{ background: ri % 2 ? ZEBRA : "#fff" }}>
                <td style={{ ...tdName(ri % 2 ? ZEBRA : "#fff"), fontWeight: 600, paddingLeft: 20 }}>{name}</td>
                {FIN_MONTHS.map((_, i) => {
                  const m = i + 1, v = mval(wages[k], m);
                  const isEd = editor?.emp === k && editor.m === m;
                  return (
                    <td key={m} style={{ ...tdR, position: "relative", cursor: "pointer", zIndex: isEd ? 60 : undefined, background: isEd ? T.skySoft : undefined }}
                      onClick={() => !isEd && (setEditor({ emp: k, m }), setDraft({ w: v ?? "" }))}>
                      {v != null ? <span style={{ color: T.coral }}>({finMoney(v)})</span> : "–"}
                      {isEd && popover(<>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink }}>{name} · {FIN_MONTHS[i]} {year}</div>
                        {field("Wages ($)", "w", true)}
                        {popButtons(() => save({ wages: { [k]: { [String(m)]: num(draft.w) } } }))}
                      </>)}
                    </td>
                  );
                })}
                <td style={{ ...tdTotal, color: T.coral }}>({finMoney(FIN_MONTHS.reduce((a, _, i) => a + (mval(wages[k], i + 1) || 0), 0), "$0")})</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...tdName(), fontWeight: 700 }}>Total Cost of Services</td>
              {wagesByMonth.map((v, i) => <td key={i} style={{ ...tdR, color: T.coral, fontWeight: 700 }}>({finMoney(v, "$0")})</td>)}
              <td style={{ ...tdTotal, color: T.coral }}>({finMoney(totalWages, "$0")})</td>
            </tr>
            <tr>
              <td style={{ ...tdName(), fontWeight: 700, color: PROJ_INK, borderTop: `2px solid ${T.ink}` }}>Gross Margin %</td>
              {gpByMonth.map((v, i) => (
                <td key={i} style={{ ...tdR, fontWeight: 700, color: PROJ_INK, borderTop: `2px solid ${T.ink}` }}>
                  {recvByMonth[i] ? `${((v / recvByMonth[i]) * 100).toFixed(0)}%` : "–"}
                </td>
              ))}
              <td style={{ ...tdTotal, color: PROJ_INK, borderTop: `2px solid ${T.ink}` }}>{totalRecv ? `${(((totalRecv - totalWages) / totalRecv) * 100).toFixed(1)}%` : "–"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

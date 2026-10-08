import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { mfgDb } from "../../lib/firebase.js";
import { T } from "../../lib/theme.js";
import { MFG_CARD, MFG_CHIP, MFG_INPUT, MfgChipRow, MfgNoteSection } from "./ui.jsx";

/* ---------------------------------------------------- reservations */
const RES_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function resAddDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt2 = new Date(Date.UTC(y, m - 1, d + days));
  return dt2.toISOString().slice(0, 10);
}
function resDaysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function MfgReservationsSection({ section, isTeam }) {
  // Full history loads from the shard docs; the inline preview (newest 200)
  // paints immediately and stays if the shards can't be read.
  const [shardRows, setShardRows] = useState(null); // null = loading, "error", or array
  const [sort, setSort] = useState({ col: "cr", dir: -1 });
  const [q, setQ] = useState("");
  const [brSel, setBrSel] = useState({});
  const [jkOnly, setJkOnly] = useState(false);
  const [crFrom, setCrFrom] = useState(""); const [crTo, setCrTo] = useState("");
  const [ciFrom, setCiFrom] = useState(""); const [ciTo, setCiTo] = useState("");
  const [tipFor, setTipFor] = useState(null);
  // The tab shows a rolling created-date window: the last 5 days at first,
  // extended 5 days per "Show more" click — the full 23K rows are never all
  // on screen. The shard download happens once, in the background, the first
  // time the window grows past the inline preview or a filter/search needs
  // the whole history.
  const previewDays = section.previewDays || 5;
  const [windowDays, setWindowDays] = useState(previewDays);
  // Filtered/search results reveal 200 at a time.
  const [filterCap, setFilterCap] = useState(200);
  const anyBr = Object.values(brSel).some(Boolean);
  const filtersActive = !!(q || anyBr || jkOnly || crFrom || crTo || ciFrom || ciTo);
  const wantFull = filtersActive || windowDays > previewDays;

  useEffect(() => {
    if (!wantFull) return;
    let dead = false;
    (async () => {
      try {
        const snaps = await Promise.all(
          (section.shards || []).map((id) => getDoc(doc(mfgDb, "hub", id))));
        const rows = [];
        for (const s of snaps) {
          if (!s.exists()) continue;
          const v = s.data();
          for (let i = 0; i < (v.li || []).length; i++) {
            rows.push([v.li[i], v.cr[i], v.ci[i], v.ni[i], v.rr[i], v.la[i], v.lc[i], v.ln[i], v.lb[i]]);
          }
        }
        if (!dead) setShardRows(rows.length ? rows : "error");
      } catch {
        if (!dead) setShardRows("error");
      }
    })();
    return () => { dead = true; };
  }, [wantFull, section.shards]);

  const raw = Array.isArray(shardRows) ? shardRows : (section.preview || []).map((p) => p.c);
  const rows = React.useMemo(() => raw.map((c) => {
    const lu = (section.listings || {})[String(c[0])] || {};
    const ci = c[2], ni = c[3] || 0;
    return {
      name: lu.n || "?", br: lu.br ?? "?", jk: !!lu.jk,
      cr: c[1], ci, co: resAddDays(ci, ni), ni,
      bw: resDaysBetween(c[1], ci),
      mo: Number(ci.slice(5, 7)), yr: Number(ci.slice(0, 4)),
      adr: ni ? Math.round((c[4] || 0) / ni) : null, rr: c[4] || 0,
      la: c[5], lc: c[6], ln: c[7], lb: c[8],
      // Displayed value: % change from LY ADR to this year's.
      lp: c[5] && ni ? Math.round((((c[4] || 0) / ni) - c[5]) / c[5] * 100) : null,
    };
  }), [raw, section.listings]);

  const brs = [...new Set(rows.map((r) => String(r.br)))].sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99));
  // The rolling window applies only while no explicit filters are set;
  // any filter or search queries the complete history instead.
  const windowFloor = resAddDays(section.asOf, -(windowDays - 1));
  const filtered = React.useMemo(() => {
    let out = rows.filter((r) =>
      (filtersActive || r.cr >= windowFloor)
      && (!q || r.name.toLowerCase().includes(q.toLowerCase()))
      && (!anyBr || brSel[String(r.br)])
      && (!jkOnly || r.jk)
      && (!crFrom || r.cr >= crFrom) && (!crTo || r.cr <= crTo)
      && (!ciFrom || r.ci >= ciFrom) && (!ciTo || r.ci <= ciTo));
    const dir = sort.dir;
    out.sort((a, b) => {
      const va = a[sort.col], vb = b[sort.col];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
    return out;
  }, [rows, q, brSel, anyBr, jkOnly, crFrom, crTo, ciFrom, ciTo, sort, filtersActive, windowFloor]);

  useEffect(() => { setFilterCap(200); }, [q, brSel, jkOnly, crFrom, crTo, ciFrom, ciTo]);
  // Both modes render at most filterCap rows; "show more" reveals 200 at a
  // time, and the day window only extends once its rows are fully revealed.
  const visible = filtered.slice(0, filterCap);

  // LY ADR is team-only (Mike, 2026-09-24) - client logins don't see it.
  const COLS = [
    ["name", "Listing"], ["br", "BR"], ["cr", "Created"], ["ci", "Check In"],
    ["co", "Check Out"], ["ni", "Nights"], ["bw", "BW"], ["mo", "CI Month"],
    ["yr", "CI Year"], ["adr", "ADR"], ["rr", "Total Rent"],
    ...(isTeam ? [["lp", "LY ADR"]] : []),
  ];
  const clickCol = (c) => setSort((s) => s.col === c ? { col: c, dir: -s.dir } : { col: c, dir: -1 });
  const th = (c, label, first) => (
    <th key={c} onClick={() => clickCol(c)} title="Sort" style={{
      textAlign: first ? "left" : "right", fontSize: 10.5, fontWeight: 800,
      color: sort.col === c ? T.ink : T.inkSoft, cursor: "pointer", userSelect: "none",
      textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 8px 8px", whiteSpace: "nowrap",
    }}>{label}{sort.col === c ? (sort.dir === -1 ? " ▼" : " ▲") : ""}</th>
  );
  const td = (first) => ({
    textAlign: first ? "left" : "right", fontSize: 12.5, color: T.ink,
    fontWeight: first ? 700 : 500, padding: "7px 8px", borderTop: `1px solid ${T.line}`, whiteSpace: "nowrap",
  });
  const money = (v) => v == null ? "–" : `$${Math.round(v).toLocaleString()}`;
  const dateLbl = { fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div>
      <div style={{ ...MFG_CARD, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings…" style={{ ...MFG_INPUT, minWidth: 190 }} />
          <span style={dateLbl}>Created</span>
          <input type="date" value={crFrom} onChange={(e) => setCrFrom(e.target.value)} style={MFG_INPUT} />
          <span style={{ color: T.inkSoft }}>–</span>
          <input type="date" value={crTo} onChange={(e) => setCrTo(e.target.value)} style={MFG_INPUT} />
          <span style={dateLbl}>Check in</span>
          <input type="date" value={ciFrom} onChange={(e) => setCiFrom(e.target.value)} style={MFG_INPUT} />
          <span style={{ color: T.inkSoft }}>–</span>
          <input type="date" value={ciTo} onChange={(e) => setCiTo(e.target.value)} style={MFG_INPUT} />
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <MfgChipRow label="Bedrooms" options={brs} sel={brSel} setSel={setBrSel} />
          <button onClick={() => setJkOnly(!jkOnly)} style={MFG_CHIP(jkOnly)}>JK only</button>
        </div>
      </div>

      <div style={{ ...MFG_CARD, overflowX: "auto" }}>
        <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 700, marginBottom: 6 }}>
          {`showing ${visible.length.toLocaleString()} of ${filtered.length.toLocaleString()} `}
          {!filtersActive
            ? `bookings created in the last ${windowDays} days`
            : "matching reservations"}
          {wantFull && shardRows === null && " · loading history…"}
          {wantFull && shardRows === "error" && " · full history unavailable, recent bookings only"}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{COLS.map(([c, l], i) => th(c, l, i === 0))}</tr></thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td(true), whiteSpace: "normal", minWidth: 160 }}>{r.name}{r.jk && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: T.marigoldDeep, borderRadius: 999, padding: "1px 6px", marginLeft: 6 }}>JK</span>}</td>
                <td style={td()}>{r.br}</td>
                <td style={td()}>{r.cr}</td>
                <td style={td()}>{r.ci}</td>
                <td style={td()}>{r.co}</td>
                <td style={td()}>{r.ni}</td>
                <td style={td()}>{r.bw}d</td>
                <td style={td()}>{RES_MONTHS[r.mo - 1]}</td>
                <td style={td()}>{r.yr}</td>
                <td style={td()}>{money(r.adr)}</td>
                <td style={td()}>{money(r.rr)}</td>
                {isTeam && <td style={{ ...td(), position: "relative" }}
                  onMouseEnter={() => r.la != null && setTipFor(i)}
                  onMouseLeave={() => setTipFor(null)}>
                  {r.lp != null ? (
                    <span style={{ color: r.lp > 0 ? T.leaf : r.lp < 0 ? T.coral : T.inkSoft, fontWeight: 700, cursor: "default", borderBottom: `1px dotted ${T.inkSoft}` }}>
                      {r.lp}%
                    </span>
                  ) : "–"}
                  {tipFor === i && (
                    <div style={{
                      position: "absolute", right: 0, bottom: "100%", zIndex: 10,
                      background: T.ink, color: "#fff", borderRadius: 10, padding: "8px 11px",
                      fontSize: 11.5, whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,49,87,.25)", textAlign: "left",
                    }}>
                      <div style={{ fontWeight: 800, marginBottom: 2 }}>LY booking</div>
                      <div>ADR {money(r.la)} · {r.ln} nights</div>
                      <div>Check in {r.lc}{r.lb != null ? ` · BW ${r.lb}d` : ""}</div>
                    </div>
                  )}
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          {filtered.length > visible.length ? (
            <button onClick={() => setFilterCap(filterCap + 200)} style={MFG_CHIP(true)}>
              Show 200 more ({(filtered.length - visible.length).toLocaleString()} remaining)
            </button>
          ) : !filtersActive && !(Array.isArray(shardRows) && filtered.length === rows.length) && (
            <button onClick={() => setWindowDays(windowDays + 5)} style={MFG_CHIP(true)}>
              Show 5 more days
            </button>
          )}
        </div>
      </div>
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

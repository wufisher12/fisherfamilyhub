import { useState } from "react";
import { T } from "../../lib/theme.js";
import { MFG_CARD, MfgSectionTitle, MfgNoteSection } from "./ui.jsx";
import { MfgChartSection } from "./Chart.jsx";
import { MfgTableSection } from "./Table.jsx";

/* ---------------------------------------------------- comp set list */
export function MfgCompsetListSection({ section }) {
  const [openId, setOpenId] = useState(null);
  const sets = Array.isArray(section.sets) ? section.sets : [];
  const open = sets.find((s) => s.id === openId);

  if (open) {
    return (
      <div>
        <button onClick={() => setOpenId(null)} style={{
          border: "none", background: "transparent", color: "#1F6FB2", cursor: "pointer",
          fontSize: 13, fontWeight: 800, padding: 0, marginBottom: 10, fontFamily: "Inter, sans-serif",
        }}>← All comp sets</button>
        <div style={MFG_CARD}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <MfgSectionTitle heading>
              {open.setUrl
                ? <a href={open.setUrl} target="_blank" rel="noreferrer" title="Open this comp set in Wheelhouse" style={{ color: "#1F6FB2", textDecoration: "none" }}>{open.name} ↗</a>
                : open.name}
            </MfgSectionTitle>
            <span style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 700 }}>
              {open.kind} · updated {open.updated}
            </span>
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 10 }}>{open.criteria}</div>
          {(open.associated || []).length > 0 && (
            <div style={{ fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", fontSize: 10.5, letterSpacing: "0.05em", marginRight: 8 }}>Compared against</span>
              {open.associated.map((a, i) => a.whUrl
                ? <a key={i} href={a.whUrl} target="_blank" rel="noreferrer" style={{ color: "#1F6FB2", fontWeight: 700, textDecoration: "none", marginRight: 10 }}>{a.name}</a>
                : <span key={i} style={{ fontWeight: 700, marginRight: 10 }}>{a.name}</span>)}
            </div>
          )}
        </div>
        {[open.chart, open.chartMonthly].filter(Boolean).map((ch, i) => (
          <MfgChartSection key={i} section={{ type: "chart", kind: "line", title: ch.title, xLabels: ch.xLabels, series: ch.series, format: ch.format || "currency" }} />
        ))}
        <MfgTableSection section={{ title: "Comps (click a name to open the OTA listing)", columns: open.columns, rows: open.rows }} />
        {section.note && <MfgNoteSection section={{ text: section.note }} />}
      </div>
    );
  }

  return (
    <div>
      {sets.map((s) => (
        <button key={s.id} onClick={() => setOpenId(s.id)} style={{
          ...MFG_CARD, width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          fontFamily: "Inter, sans-serif", padding: "14px 18px",
        }}>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>{s.name}</div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{s.criteria}{s.updated ? ` · updated ${s.updated}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            {(Array.isArray(s.kpis) ? s.kpis : []).map((k) => (
              <div key={k.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{k.value}</div>
              </div>
            ))}
            <span style={{ color: "#1F6FB2", fontWeight: 800, fontSize: 16 }}>→</span>
          </div>
        </button>
      ))}
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

/* ---------------------------------------------------- comp sets */
export function MfgCompsetSection({ section }) {
  return (
    <div style={MFG_CARD}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{section.name}</div>
        {section.whUrl && (
          <a href={section.whUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 800, color: "#1F6FB2", textDecoration: "none" }}>Open in Wheelhouse →</a>
        )}
      </div>
      {section.criteria && <div style={{ fontSize: 13, color: T.inkSoft, margin: "6px 0 14px", lineHeight: 1.5 }}>{section.criteria}</div>}
      <MfgSectionTitle>Comps on the OTA</MfgSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, marginBottom: 16 }}>
        {(section.links || []).map((l, i) => l.url ? (
          <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, color: "#1F6FB2", textDecoration: "none" }}>{l.label}</a>
        ) : (
          <div key={i} style={{ border: `1px dashed ${T.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#A9B2BB" }}>{l.label}</div>
        ))}
      </div>
      {section.stats && <MfgTableSection section={{ title: "Wheelhouse data", columns: section.stats.columns, rows: section.stats.rows }} />}
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

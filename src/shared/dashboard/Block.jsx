import { useState } from "react";
import { T } from "../../lib/theme.js";
import { MFG_CHIP } from "./ui.jsx";
import { MfgTableSection } from "./Table.jsx";

/* ------------------------------------------------------------------ */
/*  block (contract v2.4, Bear Camp Weekly Update first): a literal    */
/*  black-bordered box for narrative or tabular content. Optional      */
/*  `views` add a tab strip at the top; the selected view's content    */
/*  replaces the block-level paragraphs, bullets, table and note.      */
/* ------------------------------------------------------------------ */

const BODY = { fontSize: 14, color: "#10181F", lineHeight: 1.6 };

// Inline **bold** is the only markup interpreted. Everything else stays
// plain text that React escapes; no raw HTML is ever injected.
function rich(s) {
  return String(s).split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

const textList = (x) => (Array.isArray(x)
  ? x.filter((s) => (typeof s === "string" && s) || typeof s === "number")
  : []);

export function MfgBlockSection({ section }) {
  const views = Array.isArray(section.views) ? section.views.filter((v) => v && v.id && v.label) : [];
  const [viewId, setViewId] = useState(null);
  const view = views.length ? (views.find((v) => v.id === viewId) || views[0]) : null;
  const src = view || section;
  const sub = (view && view.sub) || section.sub;
  const paragraphs = textList(src.paragraphs);
  const bullets = textList(src.bullets);
  const table = src.table && typeof src.table === "object" ? src.table : null;
  const tableRows = table && Array.isArray(table.rows) ? table.rows : [];
  // A view's `empty` text shows when it has a table with no rows, or no
  // table and no paragraphs (for example a week with no data refresh).
  const isEmpty = (table && tableRows.length === 0) || (!table && paragraphs.length === 0);
  const emptyText = view && view.empty && isEmpty ? view.empty : null;

  return (
    <div style={{ background: "#fff", border: "2px solid #000", borderRadius: 4, padding: "20px 24px", marginBottom: 18 }}>
      {views.length > 0 && (
        <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {views.map((v) => {
            const on = v.id === view.id;
            return (
              <button key={v.id} role="tab" aria-selected={on} onClick={() => setViewId(v.id)}
                style={{ ...MFG_CHIP(on, "black"), borderRadius: 4, padding: "5px 12px", fontSize: 12.5 }}>
                {v.label}
              </button>
            );
          })}
        </div>
      )}
      {section.title && (
        <div style={{ fontSize: 20, fontWeight: 800, color: "#000", fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1.25 }}>{section.title}</div>
      )}
      {sub && <div style={{ fontSize: 13, color: "#4A5560", fontStyle: "italic", marginTop: 2 }}>{sub}</div>}
      {paragraphs.map((p, i) => (
        <p key={i} style={{ ...BODY, margin: i === 0 ? "12px 0 0" : "10px 0 0" }}>{rich(p)}</p>
      ))}
      {bullets.length > 0 && (
        <ul style={{ ...BODY, margin: paragraphs.length ? "10px 0 0" : "12px 0 0", paddingLeft: 22 }}>
          {bullets.map((b, i) => <li key={i} style={{ marginTop: i ? 4 : 0 }}>{rich(b)}</li>)}
        </ul>
      )}
      {table && !emptyText && (
        <div style={{ marginTop: 12 }}>
          {/* Keyed by view so each week opens in its published order. */}
          <MfgTableSection key={view ? view.id : "block"} bare section={table} />
        </div>
      )}
      {emptyText && <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 12 }}>{emptyText}</div>}
      {src.note && (
        <div style={{ fontSize: 11.5, color: "#4A5560", fontStyle: "italic", lineHeight: 1.5, marginTop: 12 }}>{src.note}</div>
      )}
    </div>
  );
}

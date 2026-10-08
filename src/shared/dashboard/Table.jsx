import { useState } from "react";
import { T } from "../../lib/theme.js";
import { tableCellNumber } from "../../lib/format.js";
import { MfgSectionTitle } from "./ui.jsx";

// bare (v2.4): no card chrome (background, border, radius, padding, outer
// margin) for a table that sits inside another container such as a block;
// horizontal scroll is kept.
export function MfgTableSection({ section, bare }) {
  const columns = Array.isArray(section.columns) ? section.columns : [];
  // Opt-in styling flags from the doc (contract v2.2). Defaults keep every
  // existing dashboard's tables exactly as they were.
  const dense = !!section.dense;          // tighter rows, slightly smaller type
  const headerFill = section.headerFill;  // true = light blue band, "gold" = light gold
  const stickyFirst = !!section.stickyFirst; // first column pinned while scrolling
  const sortable = section.sortable !== false; // grouped tables turn sorting off
  const nowrapFirst = !!section.nowrapFirst; // keep first-column labels on one line
  // Grouped header row (v2.3): [{label, span}] spans centered over their
  // sub-columns, with a separator rule at each group boundary.
  const groups = Array.isArray(section.groups) ? section.groups : null;
  const groupStarts = new Set();
  if (groups) {
    let acc = 0;
    groups.forEach((g) => { if (acc > 0) groupStarts.add(acc); acc += g.span || 1; });
  }
  const groupBorder = (i) => (groupStarts.has(i) ? { borderLeft: `2px solid ${T.line}` } : {});
  const pad = dense ? "3px 8px" : "9px 10px";
  // textSize overrides the cell font size; center aligns every column but
  // the first (v2.3, Ohana).
  const fs = section.textSize || (dense ? 12.5 : 13.5);
  const center = !!section.center;
  const alignOf = (i) => (i === 0 ? "left" : center ? "center" : "right");
  const BAND = "#E7EFF6";
  const headerBg = headerFill === "gold" ? "#F3E5C0" : "#D9E9F6";
  const firstW = section.firstColWidth || 150;
  // First click sorts high-to-low, second flips, third clears.
  const [sort, setSort] = useState(null);
  let rows = Array.isArray(section.rows) ? section.rows : [];
  if (sortable && sort) {
    const cellAt = (r, i) => (Array.isArray(r) ? r : r?.cells || [])[i];
    rows = [...rows].sort((ra, rb) => {
      const na = tableCellNumber(cellAt(ra, sort.col));
      const nb = tableCellNumber(cellAt(rb, sort.col));
      if (na === null && nb === null) return String(cellAt(ra, sort.col) ?? "").localeCompare(String(cellAt(rb, sort.col) ?? "")) * sort.dir;
      if (na === null) return 1;
      if (nb === null) return -1;
      return (nb - na) * sort.dir;
    });
  }
  const clickCol = (i) => sortable && setSort((s) =>
    !s || s.col !== i ? { col: i, dir: 1 } : s.dir === 1 ? { col: i, dir: -1 } : null);
  const stickyTd = (bg) => ({
    position: "sticky", left: 0, zIndex: 2, background: bg || "#fff",
    boxShadow: `2px 0 0 ${T.line}`, minWidth: firstW,
  });
  return (
    <div className="mfg-table-card" style={bare
      ? { overflowX: "auto" }
      : { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16, overflowX: "auto" }}>
      {section.title && <MfgSectionTitle>{section.title}</MfgSectionTitle>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          {groups && (
            <tr>
              {groups.map((g, gi) => {
                const start = groups.slice(0, gi).reduce((a, x) => a + (x.span || 1), 0);
                return (
                  <th key={gi} colSpan={g.span || 1} style={{
                    textAlign: "center", fontSize: 12.5, fontWeight: 800, color: "#10181F",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    background: headerFill ? headerBg : "#fff", padding: "7px 6px",
                    ...(groupStarts.has(start) ? { borderLeft: `2px solid ${T.line}` } : {}),
                    ...(stickyFirst && gi === 0 ? stickyTd(headerFill ? headerBg : "#fff") : {}),
                  }}>{g.label}</th>
                );
              })}
            </tr>
          )}
          <tr>
            {columns.map((c, i) => (
              <th key={i} onClick={() => clickCol(i)} title={sortable ? "Sort" : undefined}
                style={{
                  textAlign: alignOf(i),
                  ...(headerFill
                    ? { fontSize: 13, fontWeight: 800, color: "#10181F",
                        background: headerBg, borderBottom: `2px solid ${T.ink}`,
                        padding: dense ? "7px 8px" : "9px 10px" }
                    : { fontSize: 10.5, fontWeight: 800,
                        color: sort?.col === i ? T.ink : T.inkSoft,
                        padding: "4px 10px 8px" }),
                  cursor: sortable ? "pointer" : "default", userSelect: "none",
                  textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
                  ...groupBorder(i),
                  ...(stickyFirst && i === 0 ? stickyTd(headerFill ? headerBg : "#fff") : {}),
                }}>{c}{sortable && sort?.col === i ? (sort.dir === 1 ? " ▼" : " ▲") : ""}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            // Row-level styling (contract v2.2): band highlights the row,
            // rule draws a heavier top border to separate blocks, sub renders
            // the row smaller and italic (comparison lines under a main row).
            const band = !Array.isArray(r) && r?.band === true;
            const rule = !Array.isArray(r) && r?.rule === true;
            const sub = !Array.isArray(r) && r?.sub === true;
            const borderTop = rule ? `2px solid #B9C6D2` : `1px solid ${T.line}`;
            return (
            <tr key={ri} style={band ? { background: BAND } : undefined}>
              {/* Canonical row shape is {cells:[...]} (Firestore can't nest
                  arrays in arrays); plain arrays are accepted too. */}
              {(Array.isArray(r) ? r : Array.isArray(r?.cells) ? r.cells : []).map((cell, ci) => (
                <td key={ci} style={{
                  textAlign: alignOf(ci), fontSize: sub ? fs - 1.5 : fs, color: T.ink,
                  fontWeight: ci === 0 || band ? 700 : 500, padding: pad, borderTop,
                  fontStyle: sub ? "italic" : undefined,
                  whiteSpace: ci === 0 ? (nowrapFirst ? "nowrap" : "normal") : "nowrap",
                  ...groupBorder(ci),
                  ...(stickyFirst && ci === 0 ? stickyTd(band ? BAND : "#fff") : {}),
                }}>{cell && typeof cell === "object"
                  ? (cell.url
                    ? <a href={cell.url} target="_blank" rel="noreferrer" style={{ color: "#1F6FB2", fontWeight: 700, textDecoration: "none" }}>{cell.text}</a>
                    : <span style={{
                        color: { pos: T.leaf, neg: T.coral, muted: T.inkSoft, gold: T.marigoldDeep, strong: T.ink }[cell.tone] || T.ink,
                        fontWeight: cell.tone ? 700 : undefined,
                      }}>{cell.text}</span>)
                  : cell}</td>
              ))}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

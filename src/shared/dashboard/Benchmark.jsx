import { useState } from "react";
import { T } from "../../lib/theme.js";
import { MFG_INPUT } from "./ui.jsx";
import { MfgChartSection } from "./Chart.jsx";

/* ---------------------------------------------------- benchmark */
export function MfgBenchmarkSection({ section }) {
  const variants = Array.isArray(section.variants) ? section.variants : [];
  const [vid, setVid] = useState(variants[0]?.id);
  const v = variants.find((x) => x.id === vid) || variants[0];
  if (!v) return null;
  // Color carries the entity; dash carries the vintage. Six lines stay legible.
  const styles = v.series.map((s) => ({
    color: s.entity === "market" ? "#A87415" : "#1F6FB2",
    dash: s.vintage === "ly" ? "2,4" : s.vintage === "prior" ? "8,4" : null,
  }));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <select value={vid} onChange={(e) => setVid(e.target.value)} style={MFG_INPUT}>
          {variants.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <MfgChartSection seriesStyles={styles} section={{
        type: "chart", kind: "line", title: section.title, format: section.format,
        xLabels: v.xLabels, series: v.series,
      }} />
      {section.note && <div style={{ fontSize: 11.5, color: T.inkSoft, margin: "-8px 0 16px 4px" }}>{section.note}</div>}
    </div>
  );
}

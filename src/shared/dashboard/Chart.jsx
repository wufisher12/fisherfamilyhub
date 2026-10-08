import { useState } from "react";
import { T } from "../../lib/theme.js";
import { fmtAxisValue, fmtFullValue, niceCeil } from "../../lib/format.js";
import { MfgSectionTitle } from "./ui.jsx";

// Chart series colors, assigned in fixed order (never cycled). Chosen from
// the brand family and validated colorblind-safe + >=3:1 on white.
export const MFG_SERIES = ["#1F6FB2", "#A87415", "#7A4FA3", "#B0402F"];

// size "large" (v2.4, KPI explorer `chartSize`): a taller plot (viewBox
// height 330) with larger, value-placed point labels and more headroom so the
// label above the highest marker is not clipped. Omitted = unchanged.
export function MfgChartSection({ section, seriesStyles, compact, size }) {
  const [hover, setHover] = useState(null);
  // Click a legend entry to hide/show that series. A series may start
  // hidden via its own `hidden: true` flag (one click reveals it).
  const [hidden, setHidden] = useState(() => {
    const h = {};
    const max = seriesStyles ? seriesStyles.length : MFG_SERIES.length;
    (Array.isArray(section.series) ? section.series : [])
      .filter((s) => s && Array.isArray(s.values)).slice(0, max)
      .forEach((s, i) => { if (s.hidden) h[i] = true; });
    return h;
  });
  const xLabels = Array.isArray(section.xLabels) ? section.xLabels : [];
  const maxSeries = seriesStyles ? seriesStyles.length : MFG_SERIES.length;
  const series = (Array.isArray(section.series) ? section.series : [])
    .filter((s) => s && Array.isArray(s.values)).slice(0, maxSeries);
  const colorOf = (i) => (seriesStyles && seriesStyles[i]?.color) || MFG_SERIES[i % MFG_SERIES.length];
  const dashOf = (i) => (seriesStyles && seriesStyles[i]?.dash) || null;
  const visible = series.map((s, i) => ({ s, i })).filter(({ i }) => !hidden[i]);
  const card = { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px", marginBottom: compact ? 0 : 16 };
  if (!xLabels.length || !series.length) {
    return (
      <div style={card}>
        {section.title && <MfgSectionTitle>{section.title}</MfgSectionTitle>}
        <div style={{ fontSize: 13, color: T.inkSoft }}>No chart data.</div>
      </div>
    );
  }

  const isLine = section.kind === "line";
  const large = size === "large";
  const W = 640, H = large ? 330 : compact ? 250 : 240, padL = 48, padR = 10, padT = large ? 22 : 10, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const scaleSet = visible.length ? visible : series.map((s, i) => ({ s, i }));
  const all = scaleSet.flatMap(({ s }) => s.values).filter((v) => typeof v === "number" && isFinite(v));
  const rawMin = Math.min(0, ...all); // zero baseline unless data goes negative
  const max = niceCeil(Math.max(1e-9, ...all)) || 1;
  const min = rawMin < 0 ? -niceCeil(-rawMin) : 0;
  const y = (v) => padT + innerH * (1 - (v - min) / (max - min));
  // Point label position. Default (v2.3): first visible series above its
  // marker, the next below. Large charts place by value instead: at each
  // point the highest visible value is labeled above and the others below,
  // so two close lines push their labels apart rather than onto each other;
  // a label that would drop into the x-axis text is held just above it.
  const labelY = (v, i, vi) => {
    if (!large) return y(v) + (vi % 2 === 0 ? -7 : 14);
    const here = visible.map(({ s }) => s.values[i]).filter((x) => typeof x === "number" && isFinite(x));
    const top = here.length < 2 || v >= Math.max(...here);
    const tied = here.filter((x) => x === v).length > 1;
    const above = tied ? vi % 2 === 0 : top;
    return above ? y(v) - 8 : Math.min(y(v) + 17, H - padB - 2);
  };
  const gw = innerW / xLabels.length;
  const ticks = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4);

  // Bars: rounded 4px data-end, flat at the baseline, 2px gap between bars.
  const barPath = (x, v, bw) => {
    const y0 = y(0), y1 = y(v);
    const top = Math.min(y0, y1), h = Math.abs(y0 - y1);
    const r = Math.min(4, bw / 2, h);
    if (h < 0.5) return "";
    return v >= 0
      ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${top + h} Z`
      : `M${x},${top} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + bw - r} Q${x + bw},${top + h} ${x + bw},${top + h - r} V${top} Z`;
  };

  return (
    <div style={card}>
      {section.title && <MfgSectionTitle>{section.title}</MfgSectionTitle>}
      {series.length >= 2 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          {series.map((s, si) => (
            <button key={si} onClick={() => setHidden((h) => ({ ...h, [si]: !h[si] }))}
              title={hidden[si] ? "Show series" : "Hide series"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700,
                color: T.inkSoft, border: "none", background: "transparent", cursor: "pointer",
                padding: "2px 4px", opacity: hidden[si] ? 0.4 : 1,
                textDecoration: hidden[si] ? "line-through" : "none", fontFamily: "Inter, sans-serif",
              }}>
              <svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke={colorOf(si)}
                strokeWidth="3" strokeDasharray={dashOf(si) || "none"} /></svg>
              {s.name || `Series ${si + 1}`}
            </button>
          ))}
        </div>
      )}
      <div style={{ position: "relative" }} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#C9CFD6" : T.line} strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={T.inkSoft} fontFamily="Inter, sans-serif">
                {fmtAxisValue(t, section.format)}
              </text>
            </g>
          ))}
          {xLabels.map((xl, i) => (
            <text key={i} x={padL + gw * (i + 0.5)} y={H - 8} textAnchor="middle" fontSize={10} fill={T.inkSoft} fontFamily="Inter, sans-serif">
              {xl}
            </text>
          ))}
          {!isLine && xLabels.map((_, i) => {
            const k = visible.length || 1;
            const areaW = gw * 0.68;
            const bw = Math.max(2, (areaW - 2 * (k - 1)) / k);
            const x0 = padL + gw * i + (gw - areaW) / 2;
            return visible.map(({ s, i: si }, vi) => {
              const v = s.values[i];
              if (typeof v !== "number" || !isFinite(v)) return null;
              return (
                <path key={`${i}-${si}`} d={barPath(x0 + vi * (bw + 2), v, bw)}
                  fill={colorOf(si)} opacity={hover === null || hover === i ? 1 : 0.45} />
              );
            });
          })}
          {isLine && visible.map(({ s, i: si }, vi) => {
            const pts = s.values
              .map((v, i) => (typeof v === "number" && isFinite(v) ? `${padL + gw * (i + 0.5)},${y(v)}` : null))
              .filter(Boolean).join(" ");
            return (
              <g key={si}>
                <polyline points={pts} fill="none" stroke={colorOf(si)} strokeWidth={2}
                  strokeDasharray={dashOf(si) || "none"} strokeLinejoin="round" strokeLinecap="round" />
                {s.values.map((v, i) =>
                  typeof v === "number" && isFinite(v) ? (
                    <circle key={i} cx={padL + gw * (i + 0.5)} cy={y(v)} r={hover === i ? 4 : 2.8}
                      fill="#fff" stroke={colorOf(si)} strokeWidth={2} />
                  ) : null,
                )}
                {/* pointLabels (v2.3): value above each marker; series after
                    the first label below, so close lines do not collide. */}
                {section.pointLabels && s.values.map((v, i) =>
                  typeof v === "number" && isFinite(v) ? (
                    <text key={`l${i}`} x={padL + gw * (i + 0.5)} y={labelY(v, i, vi)}
                      textAnchor="middle" fontSize={large ? 10.5 : 8.5} fontWeight={700}
                      fill={colorOf(si)} fontFamily="Inter, sans-serif">
                      {fmtAxisValue(v, section.format)}
                    </text>
                  ) : null,
                )}
              </g>
            );
          })}
          {xLabels.map((_, i) => (
            <rect key={i} x={padL + gw * i} y={padT} width={gw} height={innerH}
              fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {hover !== null && (
          <div style={{
            position: "absolute", top: 0, left: `${((padL + gw * (hover + 0.5)) / W) * 100}%`,
            transform: `translateX(${hover >= xLabels.length / 2 ? "-105%" : "5%"})`,
            background: T.ink, color: "#fff", borderRadius: 10, padding: "8px 11px",
            fontSize: 12, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 5,
            boxShadow: "0 4px 14px rgba(0,49,87,.25)",
          }}>
            <div style={{ fontWeight: 800, marginBottom: 3 }}>{xLabels[hover]}</div>
            {visible.map(({ s, i: si }) => (
              <div key={si} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(si) }} />
                <span style={{ color: "#C7D2DC" }}>{s.name || `Series ${si + 1}`}</span>
                <span style={{ fontWeight: 800, marginLeft: "auto", paddingLeft: 8 }}>{fmtFullValue(s.values[hover], section.format)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

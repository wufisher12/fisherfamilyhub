export function fmtAxisValue(v, format) {
  if (typeof v !== "number" || !isFinite(v)) return "";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  const compact = a >= 1e6 ? `${+(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${+(a / 1e3).toFixed(a < 1e4 ? 1 : 0)}K` : `${+a.toFixed(0)}`;
  if (format === "percent") return `${sign}${+a.toFixed(1)}%`;
  if (format === "currency") return `${sign}$${compact}`;
  return `${sign}${compact}`;
}

export function fmtFullValue(v, format) {
  if (typeof v !== "number" || !isFinite(v)) return "";
  if (format === "percent") return `${+v.toFixed(1)}%`;
  if (format === "currency") return `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString()}`;
  return v.toLocaleString();
}

export function niceCeil(v) {
  if (v <= 0) return 0;
  const m = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / m;
  return (n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * m;
}

// "$1.2M" -> 1200000, "38.5%" -> 38.5, "+4.7" -> 4.7, "3 BR" -> 3, "-" -> null
export function tableCellNumber(cell) {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "object") cell = cell.text;
  const s = String(cell ?? "").trim();
  const m = s.replace(/[,$%+]/g, "").match(/^(-?\d+(?:\.\d+)?)\s*([KM])?/i);
  if (!m) return null;
  const mult = m[2] ? (m[2].toUpperCase() === "M" ? 1e6 : 1e3) : 1;
  return parseFloat(m[1]) * mult;
}

export function fmtKpi(v, format) {
  if (v === null || v === undefined || !isFinite(v)) return "–";
  if (format === "percent") return `${(v * 100).toFixed(1)}%`;
  if (format === "currency") {
    const a = Math.abs(v);
    return a >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : a >= 1e4 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v).toLocaleString()}`;
  }
  return Math.round(v).toLocaleString();
}

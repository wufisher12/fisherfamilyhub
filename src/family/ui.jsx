import { Fish, Loader2 } from "lucide-react";
import { T } from "../lib/theme.js";

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */
export function Avatar({ name, color, size = 26 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: color || T.sky, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.44, fontWeight: 700, fontFamily: "Inter, sans-serif",
        flexShrink: 0,
      }}
      title={name}
    >
      {name ? name[0].toUpperCase() : "?"}
    </div>
  );
}

export function SectionTitle({ children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
      fontFamily: "'Bricolage Grotesque', sans-serif",
      fontSize: 16, fontWeight: 800, color: T.ink,
    }}>
      <Fish size={16} color={T.marigold} />
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60, color: T.inkSoft }}>
      <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared check row — the green checkbox, the staple of the hub       */
/* ------------------------------------------------------------------ */
export function CheckRow({ done, label, sub, onToggle, big }) {
  const box = big ? 26 : 21;
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "flex-start", gap: 9, width: "100%",
        border: "none", background: "transparent", padding: "5px 0",
        cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "left",
      }}
    >
      <span
        key={done ? "y" : "n"}
        style={{
          width: box, height: box, borderRadius: 7, flexShrink: 0, marginTop: 1,
          border: `2px solid ${done ? T.leaf : T.line}`,
          background: done ? T.leaf : "transparent",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: big ? 15 : 12, fontWeight: 800,
          animation: done ? "pop .25s ease" : "none",
        }}
      >
        {done ? "✓" : ""}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "block",
          fontSize: big ? 16 : 14, fontWeight: big ? 800 : 600, lineHeight: 1.35,
          color: done ? T.leaf : T.ink,
          textDecoration: done ? "line-through" : "none",
        }}>
          {label}
        </span>
        {sub && <span style={{ display: "block", fontSize: 12, color: T.inkSoft, marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

import { T } from "../../lib/theme.js";

// dir means "is this good news", not the sign of the number.
export const MFG_DIR_COLOR = { up: T.leaf, down: T.coral, flat: T.inkSoft };

export function MfgSectionTitle({ children, heading }) {
  if (heading) {
    return (
      <div style={{ fontSize: 20, fontWeight: 800, color: "#1F6FB2", fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 12 }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 11.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

export function MfgTilesSection({ section }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {section.title && <MfgSectionTitle heading={section.titleStyle === "heading"}>{section.title}</MfgSectionTitle>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {(section.items || []).map((it, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>{it.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", margin: "6px 0 2px" }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{it.value}</span>
              {it.delta && (
                <span style={{ fontSize: 13, fontWeight: 800, color: MFG_DIR_COLOR[it.dir] || T.inkSoft }}>{it.delta}</span>
              )}
            </div>
            {it.hint && <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.45 }}>{it.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MfgNoteSection({ section }) {
  // style "footnote" (v2.3): small italic charcoal text, no box; for the
  // methodology lines under a table.
  if (section.style === "footnote") {
    return (
      <div style={{ padding: "2px 6px", marginBottom: 14, fontSize: 11.5, color: "#4A5560", fontStyle: "italic", lineHeight: 1.5 }}>
        {section.text}
      </div>
    );
  }
  return (
    <div style={{ background: T.skySoft, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
      {section.text}
    </div>
  );
}

/* heading (v2.3): a large section title with an optional smaller italic
   definition line underneath, to introduce a block of sections. */
export function MfgHeadingSection({ section }) {
  return (
    <div style={{ margin: "6px 0 10px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "-0.01em" }}>{section.text}</div>
      {section.sub && <div style={{ fontSize: 12, color: "#4A5560", fontStyle: "italic", marginTop: 2 }}>{section.sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Interactive client-dashboard sections (contract v2.1)              */
/* ------------------------------------------------------------------ */
export const MFG_CARD = { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 };
export const MFG_CHIP = (on) => ({
  border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? T.ink : "#fff",
  color: on ? "#fff" : T.inkSoft, borderRadius: 999, padding: "4px 12px",
  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif",
});
export const MFG_INPUT = {
  border: `1.5px solid ${T.line}`, borderRadius: 10, padding: "7px 11px",
  fontSize: 13, outline: "none", background: "#fff", color: T.ink, fontFamily: "Inter, sans-serif",
};

export function MfgChipRow({ label, options, sel, setSel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 }}>{label}</span>
      {options.map((o) => (
        <button key={o} onClick={() => setSel((s) => ({ ...s, [o]: !s[o] }))} style={MFG_CHIP(!!sel[o])}>{o}</button>
      ))}
    </div>
  );
}

export function MfgComingSoon({ text }) {
  return (
    <div style={{
      textAlign: "center", padding: "48px 20px", color: T.inkSoft, fontSize: 13.5,
      background: "#fff", borderRadius: 14, border: `1px dashed ${T.line}`, lineHeight: 1.5,
    }}>{text || "Coming soon — this view is being built."}</div>
  );
}

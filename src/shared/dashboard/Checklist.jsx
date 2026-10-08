import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { mfgDb } from "../../lib/firebase.js";
import { T } from "../../lib/theme.js";
import { useMfgHubDoc } from "../../lib/hooks.js";
import { MfgSectionTitle } from "./ui.jsx";

/* checklist (contract v2.3): actionable rows with a persistent done-state.
   Checking a row strikes it through and writes done.{id} to the stateDoc
   (hub collection, team-writable); the weekly publisher reads that doc and
   drops reviewed items from the next build. */
export function MfgChecklistSection({ section, isTeam }) {
  const state = useMfgHubDoc(section.stateDoc);
  const done = (state && state.done) || {};
  const [busy, setBusy] = useState(null);
  const toggle = async (id) => {
    if (!isTeam || !section.stateDoc) return;
    setBusy(id);
    try {
      await setDoc(doc(mfgDb, "hub", section.stateDoc),
        { done: { [id]: done[id] ? null : Date.now() }, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      alert(`Could not save (${e.code || e.message}).`);
    }
    setBusy(null);
  };
  const rows = Array.isArray(section.rows) ? section.rows : [];
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
      {section.title && <MfgSectionTitle>{section.title}</MfgSectionTitle>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r, i) => {
          const isDone = !!done[r.id];
          return (
            <div key={r.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", borderRadius: 10, background: i % 2 ? "#F5F7F9" : "#fff", border: `1px solid ${T.line}` }}>
              <button onClick={() => toggle(r.id)} disabled={!isTeam || busy === r.id}
                title={isDone ? "Mark as not done (it will return next week)" : "Mark reviewed/done (drops from next week's brief)"}
                style={{
                  width: 20, height: 20, marginTop: 1, borderRadius: 6, flexShrink: 0,
                  cursor: isTeam ? "pointer" : "default", border: `2px solid ${isDone ? T.leaf : T.inkSoft}`,
                  background: isDone ? T.leaf : "transparent", color: "#fff", fontSize: 13, fontWeight: 900,
                  lineHeight: "16px", padding: 0, opacity: busy === r.id ? 0.4 : 1,
                }}>{isDone ? "✓" : ""}</button>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: isDone ? T.inkSoft : T.marigoldDeep, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", marginTop: 2 }}>{r.focus}</span>
              <div style={{
                fontSize: 13.5, color: isDone ? T.inkSoft : T.ink, fontWeight: 600, lineHeight: 1.45,
                textDecoration: isDone ? "line-through" : "none",
              }}>{r.text}</div>
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ fontSize: 13, color: T.inkSoft }}>Nothing this week.</div>}
      </div>
    </div>
  );
}

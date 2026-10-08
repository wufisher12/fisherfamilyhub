import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { mfgDb } from "../lib/firebase.js";
import { T, MFG_RED } from "../lib/theme.js";
import { fmtDateKey } from "../lib/dates.js";
import { useMfgHubDoc } from "../lib/hooks.js";
import { CLIENTS } from "../lib/clients.js";
import { MFG_CHIP, MFG_INPUT, MfgNoteSection } from "../shared/dashboard/ui.jsx";

/* ------------------------------------------------------------------ */
/*  Customer List — dashboard cards + the shared To Do List, merged.   */
/*  Same hub/todolist document as the family app; team-only access     */
/*  comes from the rules' todolist carve-out. Blocks never re-order.   */
/* ------------------------------------------------------------------ */
const PORTAL_TD_BLUE = "#1F6FB2";
// Departing clients drop off the Customer List but stay in the roster so
// history (Revenue Tracking, dashboards) is untouched.
// nashville: client through Oct 2026, card removed 2026-10-05 (Mike).
export const PORTAL_TD_HIDDEN = ["nashville"];
const PORTAL_TD = [
  ...CLIENTS.filter((c) => !c.demo && !PORTAL_TD_HIDDEN.includes(c.id)).map((c) => ({ ...c, dash: true, blue: false })),
  ...CLIENTS.filter((c) => c.demo).map((c) => ({ ...c, dash: true, blue: true })),
  { id: "164apr", label: "164 Annable Point Road", abbr: "164APR", blue: true },
  { id: "realty", label: "Realty Advisors", abbr: "RA", blue: true },
  { id: "personal", label: "Personal", abbr: "PERS", blue: true },
];

const TD_EDITOR = "mike@fishergroup.co"; // matches the firestore.rules carve-out

export function MFGCustomerList({ userEmail }) {
  const tdDoc = useMfgHubDoc("todolist");
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const person = tdDoc?.mike || {};
  const items = person.items || [];
  const denied = tdDoc === null;
  const canEdit = userEmail === TD_EDITOR;

  const persist = async (nextItems) => {
    await setDoc(doc(mfgDb, "hub", "todolist"),
      { ...(tdDoc || {}), mike: { ...person, items: nextItems } });
  };
  const addItem = async (catId) => {
    const t = (drafts[catId] || "").trim();
    if (!t || tdDoc === undefined) return;
    setDrafts((d) => ({ ...d, [catId]: "" }));
    try {
      await persist([...items, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: t, cat: catId, createdAt: Date.now() }]);
    } catch (e) { alert(`Could not save (${e.code || e.message}).`); }
  };
  const complete = async (item) => {
    setBusyId(item.id);
    try {
      // Plan-day syncing stays family-side; here checking off just clears it.
      await persist(items.filter((x) => x.id !== item.id));
    } catch (e) { alert(`Could not save (${e.code || e.message}).`); }
    setBusyId(null);
  };

  return (
    <div>
      {denied && (
        <MfgNoteSection section={{ text: "The to-do list is not readable from this login yet — publish the updated firestore.rules (team access to the todolist document) and reload." }} />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
        {PORTAL_TD.map((c) => {
          const accent = c.blue ? PORTAL_TD_BLUE : MFG_RED;
          const open = items.filter((x) => x.cat === c.id);
          return (
            <div key={c.id} style={{
              background: "#fff", border: `1px solid ${T.line}`, borderTop: `4px solid ${accent}`,
              borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
            }}>
              {/* Clients with a dashboard: the name itself opens it. */}
              {c.dash ? (
                <button onClick={() => window.open(`${window.location.pathname}?portal=mfg&client=${c.id}`, "_blank")}
                  title="Open dashboard"
                  style={{ border: "none", background: "transparent", color: T.ink, cursor: "pointer", fontSize: 15, fontWeight: 800, padding: 0, textAlign: "left", fontFamily: "Inter, sans-serif" }}>
                  {c.label}
                </button>
              ) : (
                <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{c.label}</div>
              )}
              <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 5, minHeight: 20 }}>
                {open.length === 0 && <div style={{ fontSize: 12, color: "#A9B2BB" }}>No open tasks</div>}
                {open.map((it) => (
                  <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                    {canEdit ? (
                      <button onClick={() => complete(it)} disabled={busyId === it.id} title="Mark done"
                        style={{
                          width: 16, height: 16, marginTop: 1, borderRadius: 5, flexShrink: 0, cursor: "pointer",
                          border: `2px solid ${accent}`, background: "transparent", opacity: busyId === it.id ? 0.4 : 1,
                        }} />
                    ) : (
                      <span style={{ width: 6, height: 6, marginTop: 6, borderRadius: 999, flexShrink: 0, background: accent }} />
                    )}
                    <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.35 }}>
                      {it.text}
                      {it.due && <span style={{ fontSize: 10.5, fontWeight: 800, color: T.inkSoft, marginLeft: 6 }}>→ {fmtDateKey(it.due)}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                  <input value={drafts[c.id] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addItem(c.id)} placeholder="Add a task…"
                    style={{ ...MFG_INPUT, flex: 1, fontSize: 12.5, padding: "6px 10px" }} />
                  <button onClick={() => addItem(c.id)} style={{ ...MFG_CHIP(true), padding: "4px 11px" }}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

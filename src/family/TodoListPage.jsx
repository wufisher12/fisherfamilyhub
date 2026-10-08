import { useState } from "react";
import { Plus } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { T } from "../lib/theme.js";
import { localDateKey, fmtDateKey, dateKeyOffset } from "../lib/dates.js";
import { useHubDoc } from "../lib/hooks.js";
import { TD_CATS } from "../lib/clients.js";
import { EMPTY_PLAN, getPriorities } from "./planData.js";
import { Spinner } from "./ui.jsx";

export function TodoListPage({ wide }) {
  const [tdDoc, saveTd] = useHubDoc("todolist");
  const [drafts, setDrafts] = useState({});
  const [movingId, setMovingId] = useState(null);
  const [moveDate, setMoveDate] = useState("");
  const [notesFor, setNotesFor] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [toast, setToast] = useState(null);

  if (tdDoc === undefined) return <Spinner />;

  const me = "mike";
  const person = (tdDoc || {})[me] || {};
  const items = person.items || [];
  const notes = person.notes || {};

  const persist = (next) => saveTd({ ...(tdDoc || {}), [me]: { ...person, ...next } });

  const addItem = (catId) => {
    const t = (drafts[catId] || "").trim();
    if (!t) return;
    setDrafts({ ...drafts, [catId]: "" });
    persist({ items: [...items, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: t, cat: catId, createdAt: Date.now() }] });
  };

  const stripFromPlan = async (planKey, itemId) => {
    const ref = doc(db, "hub", `plan-${planKey}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const p = { ...EMPTY_PLAN, ...(data[me] || {}) };
    const filtered = getPriorities(p).filter((x) => x.id !== itemId);
    await setDoc(ref, { ...data, [me]: { ...p, priorities: filtered } });
  };

  const removeItem = async (item) => {
    try { if (item.due) await stripFromPlan(item.due, item.id); } catch { /* best effort */ }
    persist({ items: items.filter((x) => x.id !== item.id) });
  };

  /* Link the task to a day. It STAYS on the To Do List until checked off. */
  const assignToDay = async (item, dateKey) => {
    try {
      if (item.due && item.due !== dateKey) await stripFromPlan(item.due, item.id);
      if (item.due !== dateKey) {
        const ref = doc(db, "hub", `plan-${dateKey}`);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        const p = { ...EMPTY_PLAN, ...(data[me] || {}) };
        const cur = getPriorities(p);
        if (!cur.some((x) => x.id === item.id)) {
          await setDoc(ref, { ...data, [me]: { ...p, priorities: [...cur, { id: item.id, text: item.text, cat: item.cat, done: false }] } });
        }
      }
      persist({ items: items.map((x) => x.id === item.id ? { ...x, due: dateKey } : x) });
      setMovingId(null);
      setToast(`Scheduled for ${fmtDateKey(dateKey)} ✓`);
      setTimeout(() => setToast(null), 2600);
    } catch (e) {
      setToast(`Couldn't schedule it (${e.message})`);
      setTimeout(() => setToast(null), 3500);
    }
  };

  /* Checking the box is the ONLY thing that clears a task — and it marks
     the linked day's priority done so the record stays true. */
  const completeTodo = async (item) => {
    try {
      if (item.due) {
        const ref = doc(db, "hub", `plan-${item.due}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const p = { ...EMPTY_PLAN, ...(data[me] || {}) };
          const pris = getPriorities(p).map((x) => x.id === item.id ? { ...x, done: true } : x);
          await setDoc(ref, { ...data, [me]: { ...p, priorities: pris } });
        }
      }
      persist({ items: items.filter((x) => x.id !== item.id) });
      setToast("Done ✓");
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      setToast(`Couldn't complete it (${e.message})`);
      setTimeout(() => setToast(null), 3500);
    }
  };

  const fmtShortKey = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
  };
  const todayKey = localDateKey();

  const openNotes = (cat) => { setNotesFor(cat); setNotesDraft(notes[cat.id] || ""); };
  const closeNotes = () => {
    if (notesFor) persist({ notes: { ...notes, [notesFor.id]: notesDraft } });
    setNotesFor(null);
  };

  // Blocks with the most items first; original order breaks ties
  const sorted = TD_CATS
    .map((c, i) => ({ ...c, i, count: items.filter((x) => x.cat === c.id).length }))
    .sort((a, b) => b.count - a.count || a.i - b.i);

  const inputS = {
    width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.line}`,
    borderRadius: 10, padding: "9px 11px", fontSize: 14, outline: "none",
    background: "#FAFBFC", color: T.ink, fontFamily: "Inter, sans-serif",
  };

  return (
    <div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
        To Do List — Mike Fisher
      </div>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 18, lineHeight: 1.5 }}>
        Capture everything here, free of dates. Hit <strong style={{ color: T.ink }}>→ PL</strong> to
        schedule a task onto a day's Priority List — it stays here, wearing its date, until you
        <strong style={{ color: T.ink }}> check its box</strong>. That's the only thing that clears it.
        A red date means it slipped — tap to reschedule. Tap a block's name for running notes.
      </div>

      <div style={wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" } : undefined}>
        {sorted.map((cat) => {
          const catItems = items.filter((x) => x.cat === cat.id);
          return (
            <div key={cat.id} style={{
              background: T.card, borderRadius: 16, padding: "16px 18px",
              border: `1px solid ${T.line}`, borderLeft: `5px solid ${cat.color}`,
              marginBottom: wide ? 0 : 14, opacity: catItems.length ? 1 : 0.75,
            }}>
              <button
                onClick={() => openNotes(cat)}
                title="Open running notes"
                style={{
                  border: "none", background: "transparent", cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", gap: 8, marginBottom: catItems.length ? 10 : 8,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 800, color: cat.color }}>{cat.label}</span>
                <span style={{
                  fontSize: 11.5, fontWeight: 800, color: "#fff", background: cat.color,
                  borderRadius: 999, padding: "1px 9px",
                }}>{catItems.length}</span>
                {notes[cat.id] && notes[cat.id].trim() && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft }}>📝</span>
                )}
              </button>

              {catItems.map((it) => {
                const overdue = it.due && it.due < todayKey;
                return (
                <div key={it.id} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                    <button
                      onClick={() => completeTodo(it)}
                      title="Done — clears it from the list"
                      style={{
                        width: 19, height: 19, borderRadius: 5, flexShrink: 0, cursor: "pointer",
                        border: `2px solid ${cat.color}`, background: "transparent", padding: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 14.5, color: T.ink, lineHeight: 1.4, overflowWrap: "anywhere" }}>{it.text}</span>
                    {it.due ? (
                      <button
                        onClick={() => { setMovingId(movingId === it.id ? null : it.id); setMoveDate(it.due); }}
                        title={overdue ? "Slipped — tap to reschedule" : "Scheduled — tap to change the day"}
                        style={{
                          border: `1.5px solid ${overdue ? T.coral : cat.color}`,
                          background: overdue ? T.coral : "transparent",
                          color: overdue ? "#fff" : cat.color,
                          borderRadius: 8, padding: "3px 9px", fontSize: 11.5, fontWeight: 800,
                          cursor: "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
                        }}
                      >
                        {fmtShortKey(it.due)}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setMovingId(movingId === it.id ? null : it.id); setMoveDate(dateKeyOffset(1)); }}
                        title="Schedule onto a day's Priority List"
                        style={{
                          border: `1.5px solid ${cat.color}`, background: movingId === it.id ? cat.color : "transparent",
                          color: movingId === it.id ? "#fff" : cat.color,
                          borderRadius: 8, padding: "3px 9px", fontSize: 12, fontWeight: 800,
                          cursor: "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
                        }}
                      >
                        → PL
                      </button>
                    )}
                    <button
                      onClick={() => removeItem(it)}
                      style={{ border: "none", background: "transparent", color: T.coral, cursor: "pointer", fontSize: 16, fontWeight: 700, padding: "0 2px" }}
                    >×</button>
                  </div>
                  {movingId === it.id && (
                    <div style={{ display: "flex", gap: 6, margin: "4px 0 6px 14px", alignItems: "center" }}>
                      <input
                        type="date" value={moveDate}
                        onChange={(e) => setMoveDate(e.target.value)}
                        style={{ ...inputS, width: "auto", padding: "6px 9px" }}
                      />
                      <button
                        onClick={() => moveDate && assignToDay(it, moveDate)}
                        style={{
                          border: "none", background: T.marigold, color: T.ink, borderRadius: 8,
                          padding: "7px 13px", cursor: "pointer", fontWeight: 800, fontSize: 12.5, fontFamily: "Inter, sans-serif",
                        }}
                      >Save</button>
                      <button
                        onClick={() => setMovingId(null)}
                        style={{ border: "none", background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif" }}
                      >cancel</button>
                    </div>
                  )}
                </div>
                );
              })}

              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  value={drafts[cat.id] || ""}
                  onChange={(e) => setDrafts({ ...drafts, [cat.id]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addItem(cat.id)}
                  placeholder="Add a task…"
                  style={inputS}
                />
                <button
                  onClick={() => addItem(cat.id)}
                  style={{
                    border: "none", background: "#EDEFF3", color: T.ink, borderRadius: 10,
                    padding: "0 13px", cursor: "pointer", fontWeight: 800, fontFamily: "Inter, sans-serif",
                  }}
                ><Plus size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Running-notes modal */}
      {notesFor && (
        <div
          onClick={closeNotes}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,20,40,0.45)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: T.card, borderRadius: 16, padding: "20px", width: "100%", maxWidth: 520,
            borderTop: `5px solid ${notesFor.color}`,
          }}>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: notesFor.color, marginBottom: 4 }}>
              {notesFor.label}
            </div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Running notes — saved when you close.</div>
            <textarea
              autoFocus
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={9}
              style={{
                width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.line}`,
                borderRadius: 12, padding: "12px", fontSize: 14.5, outline: "none",
                color: T.ink, fontFamily: "Inter, sans-serif", lineHeight: 1.5, resize: "vertical",
              }}
            />
            <button
              onClick={closeNotes}
              style={{
                marginTop: 10, border: "none", background: notesFor.color, color: "#fff",
                borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 800,
                fontSize: 13.5, fontFamily: "Inter, sans-serif",
              }}
            >Done</button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: T.ink, color: "#fff", borderRadius: 999, padding: "10px 20px",
          fontSize: 13.5, fontWeight: 700, zIndex: 120, fontFamily: "Inter, sans-serif",
          boxShadow: "0 8px 24px rgba(0,49,87,0.3)",
        }}>{toast}</div>
      )}
    </div>
  );
}

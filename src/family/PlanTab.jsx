import { useState, useEffect, useRef } from "react";
import { Fish, Loader2, GripVertical } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { T } from "../lib/theme.js";
import {
  localDateKey, fmtDateKey, dateKeyOffset, weekdayOf, fullDateOf, weekdayShort, isWeekendKey,
} from "../lib/dates.js";
import { useHubDoc } from "../lib/hooks.js";
import { catOf } from "../lib/clients.js";
import { EMPTY_PLAN, getPriorities, anchorsFor, wrapupFor } from "./planData.js";
import { CheckRow } from "./ui.jsx";
import { CalendarCard } from "./CalendarCard.jsx";

function AnchorEditor({ items, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items);
  useEffect(() => { if (!editing) setDraft(items); }, [items, editing]);

  const inputStyle = {
    border: `1.5px solid ${T.line}`, borderRadius: 8, padding: "7px 9px",
    fontSize: 13.5, outline: "none", background: T.card, color: T.ink,
    fontFamily: "Inter, sans-serif", boxSizing: "border-box", width: "100%",
  };

  if (!editing) {
    if (items.length === 0) {
      return (
        <div>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, marginBottom: 8 }}>
            Nothing here yet — build your own.
          </div>
          <button
            onClick={() => { setDraft([{ t: "", label: "" }]); setEditing(true); }}
            style={{
              border: "none", background: T.marigold, color: T.ink, borderRadius: 8,
              padding: "7px 12px", cursor: "pointer", fontWeight: 800, fontSize: 12.5,
              fontFamily: "Inter, sans-serif",
            }}
          >
            + Add your first line
          </button>
        </div>
      );
    }
    return (
      <div>
        {items.map((a, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 8, padding: "4px 0", fontSize: 13.5, color: T.ink }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: T.marigoldDeep, paddingTop: 2 }}>{a.t}</span>
            <span style={{ lineHeight: 1.4 }}>{a.label}</span>
          </div>
        ))}
        <button
          onClick={() => setEditing(true)}
          style={{
            marginTop: 6, border: "none", background: "transparent", color: T.inkSoft,
            cursor: "pointer", fontSize: 12.5, fontWeight: 700, padding: 0, fontFamily: "Inter, sans-serif",
          }}
        >
          ✎ Edit these
        </button>
      </div>
    );
  }

  return (
    <div>
      {draft.map((a, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "84px 1fr 26px", gap: 6, marginBottom: 6 }}>
          <input value={a.t} onChange={(e) => { const n = [...draft]; n[i] = { ...a, t: e.target.value }; setDraft(n); }} style={inputStyle} />
          <input value={a.label} onChange={(e) => { const n = [...draft]; n[i] = { ...a, label: e.target.value }; setDraft(n); }} style={inputStyle} />
          <button onClick={() => setDraft(draft.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", color: T.coral, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={() => setDraft([...draft, { t: "", label: "" }])}
          style={{ border: `1.5px dashed ${T.line}`, background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: "5px 10px", fontFamily: "Inter, sans-serif" }}
        >
          + Add line
        </button>
        <button
          onClick={() => { const clean = draft.filter((a) => a.label.trim()); onSave(clean); setEditing(false); }}
          style={{ border: "none", background: T.leaf, color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 800, borderRadius: 8, padding: "5px 12px", fontFamily: "Inter, sans-serif" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

/* Multi-line workout editor: one input per exercise / interval */
function WorkoutLines({ lines, setLines, onBlur, placeholder }) {
  const refs = useRef([]);
  const inputStyle = {
    width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.line}`,
    borderRadius: 10, padding: "9px 11px", fontSize: 14.5, outline: "none",
    background: T.card, color: T.ink, fontFamily: "Inter, sans-serif",
  };
  return (
    <div>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 26px", gap: 6, marginBottom: 6 }}>
          <input
            ref={(el) => { refs.current[i] = el; }}
            value={l}
            onChange={(e) => { const n = [...lines]; n[i] = e.target.value; setLines(n); }}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const n = [...lines];
                n.splice(i + 1, 0, "");
                setLines(n);
                setTimeout(() => { if (refs.current[i + 1]) refs.current[i + 1].focus(); }, 50);
              }
            }}
            placeholder={i === 0 ? placeholder : `Exercise ${i + 1}`}
            style={inputStyle}
          />
          {lines.length > 1 && (
            <button
              onClick={() => { setLines(lines.filter((_, j) => j !== i)); setTimeout(onBlur, 0); }}
              style={{ border: "none", background: "transparent", color: T.coral, cursor: "pointer", fontSize: 16, fontWeight: 700 }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => setLines([...lines, ""])}
        style={{
          border: `1.5px dashed ${T.line}`, background: "transparent", color: T.inkSoft,
          cursor: "pointer", fontSize: 12.5, fontWeight: 700, borderRadius: 8,
          padding: "6px 12px", fontFamily: "Inter, sans-serif",
        }}
      >
        + Add exercise
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Plan tab — the 3:30 shutdown, in the order of the day it builds    */
/* ------------------------------------------------------------------ */
export function PlanTab({ meMatch, meName, wide, onGoTab }) {
  const [offset, setOffset] = useState(1); // 1 = tomorrow … 5 = four days after
  const dateKey = dateKeyOffset(offset);
  const [planDoc, savePlan] = useHubDoc(`plan-${dateKey}`);
  const [templateDoc, saveTemplate] = useHubDoc("template");
  const [routineDoc, saveRoutine] = useHubDoc("routine");

  const [priorities, setPriorities] = useState([]);
  const [newPri, setNewPri] = useState("");
  const [blocks, setBlocks] = useState(["", ""]);
  const [w1, setW1] = useState([""]);
  const [w2, setW2] = useState([""]);
  const [fun, setFun] = useState([""]);
  const [dinner, setDinner] = useState("");
  const [prep, setPrep] = useState({ inbox: false, calendar: false });
  const [completed, setCompleted] = useState(false);
  const [hydratedKey, setHydratedKey] = useState(null);
  const dragIdx = useRef(null);

  useEffect(() => {
    if (planDoc === undefined) return;   // still loading this day
    if (hydratedKey === dateKey) return; // already hydrated for this day
    const p = { ...EMPTY_PLAN, ...((planDoc || {})[meMatch] || {}) };
    setPriorities(getPriorities(p));
    setBlocks([...p.blocks]);
    setW1(p.w1 && p.w1.length ? [...p.w1] : [""]);
    setW2(p.w2 && p.w2.length ? [...p.w2] : [""]);
    setFun(p.fun && p.fun.length ? [...p.fun] : [""]);
    setPrep({ ...p.prep });
    setCompleted(!!p.shutdownComplete);
    setDinner((planDoc || {}).dinner || "");
    setHydratedKey(dateKey);
  }, [planDoc, dateKey, meMatch, hydratedKey]);

  // If a task is moved here from the To Do List while this day is open, absorb it
  useEffect(() => {
    if (planDoc === undefined || hydratedKey !== dateKey) return;
    const remote = getPriorities({ ...EMPTY_PLAN, ...((planDoc || {})[meMatch] || {}) });
    if (remote.length > priorities.length) setPriorities(remote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planDoc]);

  const persist = (overrides = {}) => {
    if (hydratedKey !== dateKey) return; // never save stale contents onto a different day
    const existing = { ...EMPTY_PLAN, ...((planDoc || {})[meMatch] || {}) };
    const person = {
      ...existing,
      priorities, blocks, w1, w2, fun, prep, shutdownComplete: completed,
      ...overrides.person,
    };
    savePlan({
      ...(planDoc || {}),
      dinner: overrides.dinner !== undefined ? overrides.dinner : dinner,
      [meMatch]: person,
    });
  };

  const completeShutdown = () => {
    if (hydratedKey !== dateKey) return;
    setCompleted(true);
    persist({ person: { shutdownComplete: true } });
    const todayKey = localDateKey();
    const person = (routineDoc && routineDoc[meMatch]) || {};
    const days = person.days || {};
    const today = { ...(days[todayKey] || {}), shutdown: 1 };
    saveRoutine({ ...(routineDoc || {}), [meMatch]: { ...person, days: { ...days, [todayKey]: today } } });
  };

  const targetWeekend = isWeekendKey(dateKey);
  const todayWeekend = isWeekendKey(localDateKey());
  const anchors = anchorsFor(templateDoc, meMatch);
  const wrapup = wrapupFor(templateDoc, meMatch);
  const saveAnchors = (next) => saveTemplate({
    ...(templateDoc || {}),
    [meMatch]: { ...((templateDoc || {})[meMatch] || {}), anchors: next },
  });
  const saveWrapup = (next) => saveTemplate({
    ...(templateDoc || {}),
    [meMatch]: { ...((templateDoc || {})[meMatch] || {}), wrapup: next },
  });

  const inputStyle = {
    width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.line}`,
    borderRadius: 11, padding: "12px 14px", fontSize: 16, outline: "none",
    background: "#FFFFFF", color: T.ink, fontFamily: "Inter, sans-serif",
  };

  /* Section card: white, accent left bar, generous padding */
  const psec = (accent) => ({
    background: T.card, borderRadius: 16, padding: "18px 20px",
    border: "1.5px solid #111", borderLeft: `5px solid ${accent}`,
    marginBottom: wide ? 0 : 14,
  });
  const PlanHead = ({ accent, time, children }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
      <span style={{
        fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17.5, fontWeight: 800, color: T.ink,
      }}>{children}</span>
      {time && <span style={{ fontSize: 11.5, fontWeight: 800, color: accent, marginLeft: "auto" }}>{time}</span>}
    </div>
  );
  const noteS = { fontSize: 13, color: T.inkSoft, marginTop: -4, marginBottom: 12, lineHeight: 1.45 };
  const labelS = {
    fontSize: 12.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase",
    letterSpacing: "0.05em", margin: "14px 0 6px", fontFamily: "Inter, sans-serif",
  };

  const ready = planDoc !== undefined && hydratedKey === dateKey;
  const span2 = wide ? { gridColumn: "1 / -1" } : {};

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, color: T.ink }}>
          The 4pm Shutdown
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {[1, 2, 3, 4, 5].map((o) => (
            <button
              key={o}
              onClick={() => setOffset(o)}
              style={{
                border: `1.5px solid ${offset === o ? T.ink : T.line}`,
                background: offset === o ? T.ink : "transparent",
                color: offset === o ? "#fff" : T.inkSoft,
                borderRadius: 999, padding: "5px 13px", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}
            >
              {weekdayShort(o)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 16, lineHeight: 1.5 }}>
        Planning <strong style={{ color: T.ink }}>{weekdayOf(offset)}</strong> ({fmtDateKey(dateKey)}), {meName}.
        Ten minutes now buys a decided morning. Fields save when you tap away.
      </div>

      {!ready ? (
        <div style={{
          background: T.card, borderRadius: 16, padding: "48px 16px", border: `1px solid ${T.line}`,
          display: "flex", justifyContent: "center", color: T.inkSoft,
        }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
      <>
      <div style={wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" } : undefined}>

        {/* Close out the day — about TODAY */}
        {!todayWeekend && (
          <div style={{ ...psec(T.ink), ...span2 }}>
            <PlanHead accent={T.ink} time="4:00 PM">Close out the day!</PlanHead>
            <CheckRow
              done={prep.inbox} label="Answered all emails!"
              onToggle={() => { const next = { ...prep, inbox: !prep.inbox }; setPrep(next); persist({ person: { prep: next } }); }}
            />
            <CheckRow
              done={prep.workout} label="Crushed the workout!"
              onToggle={() => { const next = { ...prep, workout: !prep.workout }; setPrep(next); persist({ person: { prep: next } }); }}
            />
          </div>
        )}

        <div style={{ ...span2, marginTop: wide ? 6 : 4, marginBottom: wide ? -4 : 0 }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800,
            color: T.ink, display: "flex", alignItems: "center", gap: 8,
          }}>
            <Fish size={18} color={T.marigold} />
            {offset === 1 ? `Tomorrow, ${fullDateOf(1)}` : fullDateOf(offset)}
          </div>
        </div>

        {/* 2 · Workout #1 */}
        <div style={psec(T.leaf)}>
          <PlanHead accent={T.leaf} time="5:00 AM">Workout #1</PlanHead>
          <div style={noteS}>Written down tonight = no 5am decisions. Enter jumps to the next line.</div>
          <WorkoutLines lines={w1} setLines={setW1} onBlur={() => persist()} placeholder="e.g. 5x5 back squat" />
        </div>

        {/* 3 · Calendar for the target day */}
        {meMatch === "mike" && (
          <div style={psec("#33608A")}>
            <PlanHead accent="#33608A">On the calendar — {weekdayOf(offset)}</PlanHead>
            <CalendarCard dateKey={dateKey} title="" bare />
          </div>
        )}

        {/* 4 · Priority list (weekdays) or Fun (weekends) — full width, vertical */}
        {targetWeekend ? (
          <div style={{ ...psec(T.marigold), ...span2, background: "#FFFDF8" }}>
            <PlanHead accent={T.marigold} time="DAYTIME">Plans &amp; family fun</PlanHead>
            <div style={noteS}>What's happening {weekdayOf(offset)}? One line each — outings, projects, or just "backyard morning".</div>
            <WorkoutLines lines={fun} setLines={setFun} onBlur={() => persist()} placeholder="e.g. Farmers market + playground" />
          </div>
        ) : (
          <div style={{ ...psec(T.marigold), ...span2, background: "#FFFDF8" }}>
            <PlanHead accent={T.marigold} time="9:00–3:30">Priority list</PlanHead>
            <div style={noteS}>
              In execution order — #1 defines the day. Drag to reorder. Pull tasks in from the To Do List with → PL, or add here directly.
            </div>
            {priorities.length === 0 && (
              <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 10 }}>
                Nothing scheduled yet for this day.
              </div>
            )}
            {priorities.map((it, i) => {
              const cat = it.cat ? catOf(it.cat) : null;
              const reorderTo = (to) => {
                const from = dragIdx.current;
                if (from === null || from === to) return;
                const next = [...priorities];
                const [m] = next.splice(from, 1);
                next.splice(to, 0, m);
                dragIdx.current = to;
                setPriorities(next);
              };
              return (
                <div
                  key={it.id}
                  data-pri={i}
                  draggable
                  onDragStart={() => { dragIdx.current = i; }}
                  onDragEnter={() => reorderTo(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={() => { dragIdx.current = null; persist(); }}
                  onDrop={(e) => e.preventDefault()}
                  style={{
                    display: "flex", alignItems: "center", gap: 9, marginBottom: 8,
                    background: i === 0 ? "#FDF6E7" : "#FFFFFF",
                    border: i === 0 ? `1px solid ${T.marigold}` : `1px solid ${T.line}`,
                    borderRadius: 11, padding: "9px 12px",
                  }}
                >
                  <span
                    onTouchStart={(e) => { dragIdx.current = i; }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      const t = e.touches[0];
                      const el = document.elementFromPoint(t.clientX, t.clientY);
                      const row = el && el.closest && el.closest("[data-pri]");
                      if (row) reorderTo(Number(row.getAttribute("data-pri")));
                    }}
                    onTouchEnd={() => { dragIdx.current = null; persist(); }}
                    style={{ cursor: "grab", color: T.inkSoft, display: "flex", touchAction: "none", flexShrink: 0 }}
                    title="Drag to reorder"
                  >
                    <GripVertical size={17} />
                  </span>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: i === 0 ? T.marigold : "#EDEFF3",
                    color: i === 0 ? "#fff" : T.inkSoft,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800,
                  }}>{i === 0 ? "★" : i + 1}</span>
                  <input
                    value={it.text}
                    onChange={(e) => {
                      const next = priorities.map((x) => x.id === it.id ? { ...x, text: e.target.value } : x);
                      setPriorities(next);
                    }}
                    onBlur={() => persist()}
                    style={{
                      flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
                      fontSize: 15.5, fontWeight: i === 0 ? 800 : 600, color: T.ink,
                      fontFamily: "Inter, sans-serif", padding: "3px 0",
                    }}
                  />
                  {cat && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, color: "#fff", background: cat.color,
                      borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", flexShrink: 0,
                    }}>{cat.abbr}</span>
                  )}
                  <button onClick={() => {
                    const next = priorities.filter((x) => x.id !== it.id);
                    setPriorities(next);
                    setTimeout(() => persist({ person: { priorities: next } }), 0);
                    // If this came from the To Do List, un-schedule it there (back to → PL)
                    (async () => {
                      try {
                        const ref = doc(db, "hub", "todolist");
                        const snap = await getDoc(ref);
                        if (!snap.exists()) return;
                        const d = snap.data();
                        const mk = d.mike || {};
                        if ((mk.items || []).some((x) => x.id === it.id)) {
                          await setDoc(ref, { ...d, mike: { ...mk, items: mk.items.map((x) => x.id === it.id ? { ...x, due: null } : x) } });
                        }
                      } catch { /* best effort */ }
                    })();
                  }} style={{ border: "none", background: "transparent", color: T.coral, cursor: "pointer", fontSize: 17, fontWeight: 700, padding: 2, flexShrink: 0 }}>×</button>
                </div>
              );
            })}
            <input
              value={newPri}
              onChange={(e) => setNewPri(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newPri.trim()) {
                  const next = [...priorities, { id: `${Date.now()}`, text: newPri.trim(), done: false }];
                  setPriorities(next);
                  setNewPri("");
                  setTimeout(() => persist({ person: { priorities: next } }), 0);
                }
              }}
              placeholder="Add a priority directly… (Enter to add)"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </div>
        )}

        {/* 5 · Workout #2 */}
        <div style={psec(T.leaf)}>
          <PlanHead accent={T.leaf} time="3:30 PM">Workout #2</PlanHead>
          <WorkoutLines lines={w2} setLines={setW2} onBlur={() => persist()} placeholder="e.g. 20 min bike + core" />
        </div>

        {/* 6 · Dinner */}
        <div style={psec(T.coral)}>
          <PlanHead accent={T.coral} time="4:30 PM">Family dinner</PlanHead>
          <div style={noteS}>Shared — Tina sees this too.</div>
          <input
            value={dinner}
            onChange={(e) => setDinner(e.target.value)}
            onBlur={() => persist({ dinner })}
            placeholder="e.g. Sheet-pan chicken — defrost tonight"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
      {completed ? (
        <div style={{
          background: T.leafSoft, border: `1px solid ${T.leaf}`, borderRadius: 16,
          padding: "16px", textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <Fish key={i} size={20} color={T.marigold}
                style={{ animation: `bob 1s ease-in-out ${i * 0.15}s infinite alternate` }} />
            ))}
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: T.leaf, marginTop: 6 }}>
            Shutdown complete — the evening is yours.
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>
            You can still edit anything above; it saves as you go. Hit Print for the paper copy.
          </div>
        </div>
      ) : (
        <button
          onClick={completeShutdown}
          style={{
            width: "100%", border: "none", background: T.marigold, color: T.ink,
            borderRadius: 16, padding: "17px 0", fontSize: 17, fontWeight: 800,
            cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}
        >
          Shutdown complete 🐠
        </button>
      )}
      </div>
      </>
      )}

    </div>
  );
}

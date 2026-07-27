import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart, UtensilsCrossed, CheckSquare, Plane, Plus,
  ThumbsUp, MessageCircle, Trash2, Send, Loader2, ChevronDown,
  Fish, RefreshCw, Camera, CornerDownRight, Sun, ArrowRight, LogOut,
  Dumbbell, Droplet, Apple, Target, Moon, Heart, Flame,
  Power, ClipboardList, Star,
} from "lucide-react";
import { auth, db, configured } from "./lib/firebase.js";
import { familyEmail } from "./firebase-config.js";
import { HUB_EMAIL } from "./firebase-config.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/* ------------------------------------------------------------------ */
const T = {
  canvas: "#F4F5F7",
  card: "#FFFFFF",
  ink: "#003157",
  inkSoft: "#5F6B78",
  line: "#E2E5EA",
  red: "#FF0013",
  marigold: "#C8952C",
  marigoldDeep: "#9C721E",
  leaf: "#2F6D54",
  leafSoft: "#E4EFE9",
  coral: "#9E3B2F",
  coralSoft: "#F3E7E4",
  sky: "#003157",
  skySoft: "#E5EBF1",
};

const MEMBER_COLORS = ["#C8952C", "#FF0013", "#7A4FA3", "#2F6D54", "#9E3B2F", "#5F6B78"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateKey(key) {
  // key is "YYYY-MM-DD"; build the date from parts to avoid timezone shifts
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Responsive: true on desktop-width screens                          */
/* ------------------------------------------------------------------ */
function useIsWide() {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 980px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 980px)");
    const fn = (e) => setWide(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return wide;
}

/* ------------------------------------------------------------------ */
/*  Firestore live-document hook                                       */
/*  Subscribes to a document; writes echo instantly on all devices.    */
/* ------------------------------------------------------------------ */
function useHubDoc(path) {
  const [data, setData] = useState(undefined); // undefined = loading, null = missing
  useEffect(() => {
    const ref = doc(db, "hub", path);
    const unsub = onSnapshot(
      ref,
      (snap) => setData(snap.exists() ? snap.data() : null),
      () => setData(null),
    );
    return unsub;
  }, [path]);
  const save = useCallback((value) => setDoc(doc(db, "hub", path), value), [path]);
  const remove = useCallback(() => deleteDoc(doc(db, "hub", path)), [path]);
  return [data, save, remove];
}

/* ------------------------------------------------------------------ */
/*  Weather (direct forecast API — no key needed)                      */
/* ------------------------------------------------------------------ */
const WMO = {
  0: "Clear and sunny", 1: "Mostly sunny", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Foggy", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow", 80: "Rain showers",
  81: "Rain showers", 82: "Heavy showers", 85: "Snow showers", 86: "Snow showers",
  95: "Thunderstorms", 96: "Thunderstorms", 99: "Thunderstorms",
};

function familySummary(condition, hiF) {
  const wet = /rain|drizzle|shower|storm|snow/i.test(condition);
  if (wet) return "Looks like an indoor-fort kind of day — have the crayons ready.";
  if (hiF >= 85) return "A hot one — sunscreen, hats, and the sprinkler after nap.";
  if (hiF >= 70) return "Great day to get the kids outside — playground weather.";
  if (hiF >= 55) return "Mild out — a stroller walk with light layers works nicely.";
  if (hiF >= 40) return "Chilly — bundle the kids up if you head out.";
  return "Cold one — hot cocoa and cozy indoor plans.";
}

async function fetchWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=42.0417&longitude=-70.6723"
    + "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min"
    + "&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=1";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`forecast service ${resp.status}`);
  const d = await resp.json();
  const condition = WMO[d.current.weather_code] || "Mixed skies";
  const hiF = d.daily.temperature_2m_max[0];
  return {
    tempF: d.current.temperature_2m,
    hiF,
    loF: d.daily.temperature_2m_min[0],
    condition,
    summary: familySummary(condition, hiF),
  };
}

/* ------------------------------------------------------------------ */
/*  Photo compression (fits comfortably in a Firestore document)       */
/* ------------------------------------------------------------------ */
async function compressPhoto(file, charLimit = 600000) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("That format isn't supported — try a JPG or PNG"));
    i.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let smallest = null;
  for (const max of [1100, 900, 700, 500]) {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.75, 0.55, 0.4]) {
      const out = canvas.toDataURL("image/jpeg", q);
      if (!smallest || out.length < smallest.length) smallest = out;
      if (out.length < charLimit) return out;
    }
  }
  if (smallest && smallest.length < 950000) return smallest;
  throw new Error("Photo too large even after compression");
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */
function Avatar({ name, color, size = 26 }) {
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

function SectionTitle({ children }) {
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

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60, color: T.inkSoft }}>
      <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Daily routine tracker                                              */
/* ------------------------------------------------------------------ */
const HABITS = [
  { id: "exercise", label: "Exercise", icon: Dumbbell },
  { id: "hydration", label: "Hydration", icon: Droplet },
  { id: "eat", label: "Eat well", icon: Apple },
  { id: "deepwork", label: "Deep work", icon: Target },
  { id: "shutdown", label: "Shutdown", icon: Power },
  { id: "family", label: "Family time", icon: Heart },
  { id: "bed", label: "In bed 9:15", icon: Moon },
];

function dateKeyOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* "Never miss twice": one missed day pauses the streak (grace);
   two consecutive missed days reset it. Today being unchecked (yet)
   never penalizes the streak. */
function habitStreak(days, habitId, doneToday) {
  let streak = doneToday ? 1 : 0;
  let misses = 0;
  for (let i = 1; i < 400; i++) {
    const done = ((days[dateKeyOffset(-i)] || {})[habitId] || 0) > 0;
    if (done) { streak++; misses = 0; }
    else {
      misses++;
      if (misses >= 2) break;
    }
  }
  const missedYesterday = !(((days[dateKeyOffset(-1)] || {})[habitId] || 0) > 0);
  return { streak, grace: !doneToday && missedYesterday && streak > 0 };
}

function RoutineCard({ onGoTab }) {
  const todayKey = localDateKey();
  const [routineDoc, saveRoutine] = useHubDoc("routine");
  const [legacyWorkout] = useHubDoc(`workout-${todayKey}`);

  const card = {
    background: T.card, borderRadius: 14, padding: "14px 16px",
    border: `1px solid ${T.line}`, marginBottom: 14,
  };

  if (routineDoc === undefined) {
    return (
      <div style={card}>
        <SectionTitle>Daily routine</SectionTitle>
        <div style={{ color: T.inkSoft, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={card}>
      <SectionTitle>Daily routine</SectionTitle>
      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: -4, marginBottom: 10, lineHeight: 1.4 }}>
        Your day in order — every check is a vote for the person you're becoming.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Mike", match: "mike" },
          { label: "Tina", match: "tina" },
        ].map(({ label, match }) => {
          const person = (routineDoc && routineDoc[match]) || {};
          const days = person.days || {};
          const today = days[todayKey] || {};
          const isDone = (h) =>
            h.id in today
              ? (today[h.id] || 0) > 0
              : h.id === "exercise" && !!(legacyWorkout && legacyWorkout[match]);
          const doneCount = HABITS.filter(isDone).length;
          const allDone = doneCount === HABITS.length;

          const setHabit = (habitId, val) => {
            const nextToday = { ...today, [habitId]: val ? 1 : 0 };
            saveRoutine({
              ...(routineDoc || {}),
              [match]: { ...person, days: { ...days, [todayKey]: nextToday } },
            });
          };

          // Last 7 days chain + weekly identity votes
          const dots = [];
          let votes = 0;
          for (let i = 6; i >= 0; i--) {
            const k = dateKeyOffset(-i);
            const rec = days[k] || {};
            let c = HABITS.filter((h) => (rec[h.id] || 0) > 0).length;
            if (i === 0) c = doneCount;
            votes += c;
            const [y, m, dd] = k.split("-").map(Number);
            dots.push({
              k, c,
              w: new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: "narrow" }),
            });
          }

          return (
            <div key={match} style={{
              background: "#FAFBFC", border: `1px solid ${allDone ? T.leaf : T.line}`,
              borderRadius: 12, padding: "10px 12px",
              boxShadow: allDone ? `0 0 0 2px ${T.leaf}22` : "none",
            }}>
              <div style={{
                fontSize: 12.5, fontWeight: 800, color: T.marigoldDeep,
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
                fontFamily: "Inter, sans-serif",
              }}>
                {label} · {doneCount}/{HABITS.length}
              </div>

              {HABITS.map((h) => {
                const done = isDone(h);
                const { streak, grace } = habitStreak(days, h.id, done);
                const Icon = h.icon;
                return (
                  <button
                    key={h.id}
                    onClick={() => setHabit(h.id, !done)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7, width: "100%",
                      border: "none", background: "transparent", padding: "4px 0",
                      cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "left",
                    }}
                  >
                    <span
                      key={done ? "y" : "n"}
                      style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${done ? T.leaf : T.line}`,
                        background: done ? T.leaf : "transparent",
                        color: "#fff", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 12, fontWeight: 800,
                        animation: done ? "pop .25s ease" : "none",
                      }}
                    >
                      {done ? "✓" : ""}
                    </span>
                    <Icon size={13} color={done ? T.leaf : T.inkSoft} style={{ flexShrink: 0 }} />
                    <span style={{
                      fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0,
                      color: done ? T.leaf : T.ink,
                    }}>
                      {h.label}
                    </span>
                    {streak > 0 && (
                      <span
                        title={grace ? "Missed yesterday — do it today to keep the streak" : `${streak}-day streak`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 2,
                          fontSize: 11, fontWeight: 800,
                          color: grace ? "#B07E10" : T.leaf,
                        }}
                      >
                        <Flame size={11} />{streak}
                      </span>
                    )}
                  </button>
                );
              })}

              <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                {dots.map((d) => (
                  <div key={d.k} style={{ textAlign: "center" }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%", margin: "0 auto",
                      background: d.c === HABITS.length ? T.leaf : d.c > 0 ? T.marigold : "transparent",
                      border: d.c === 0 ? `1.5px solid ${T.line}` : "none",
                      opacity: d.c > 0 && d.c < HABITS.length ? 0.75 : 1,
                    }} />
                    <div style={{ fontSize: 8.5, color: T.inkSoft, marginTop: 2 }}>{d.w}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>
                {votes} {votes === 1 ? "vote" : "votes"} cast this week
              </div>

              {allDone && (
                <div style={{
                  marginTop: 10, background: T.leafSoft, border: `1px solid ${T.leaf}`,
                  borderRadius: 10, padding: "8px 10px", textAlign: "center",
                }}>
                  <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                    {[0, 1, 2].map((i) => (
                      <Fish key={i} size={18} color={T.marigold}
                        style={{ animation: `bob 1s ease-in-out ${i * 0.15}s infinite alternate` }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: T.leaf, marginTop: 4 }}>
                    Perfect day!
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={() => onGoTab("plan")}
        style={{
          marginTop: 10, border: "none", background: "transparent", color: T.marigoldDeep,
          cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0,
          display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "Inter, sans-serif",
        }}
      >
        Run your 3:30 shutdown <ArrowRight size={13} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared check row — the green checkbox, the staple of the hub       */
/* ------------------------------------------------------------------ */
function CheckRow({ done, label, sub, onToggle, big }) {
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

const EMPTY_PLAN = {
  top3: ["", "", ""], done3: [false, false, false], star: 0,
  blocks: ["", ""], blocksDone: [false, false],
  w1: [""], w1done: [], w2: [""], w2done: [],
  fun: [""], fundone: [],
  anchorsDone: {}, wrapupDone: {},
  prep: { inbox: false, calendar: false }, shutdownComplete: false,
};

const DEFAULT_ANCHORS = [
  { t: "5:30 AM", label: "Give gratitude" },
  { t: "6:30 AM", label: "Get ready for the day" },
  { t: "7:45 AM", label: "Kids dropoff" },
  { t: "8:30 AM", label: "Review calendar & emails, dinner prep — set up your day" },
];
const DEFAULT_WRAPUP = [
  { t: "3:30 PM", label: "Wrap up and set up tomorrow" },
];

function weekdayOf(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

function isWeekendKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

function TimeRow({ time, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 8, alignItems: "start" }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: T.marigoldDeep, paddingTop: 8, whiteSpace: "nowrap" }}>
        {time}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* Editable list of {t, label} rows for the daily anchors */
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
/*  Today's schedule — everything today, in order, checkable          */
/* ------------------------------------------------------------------ */
function TodaySchedule({ meMatch, onGoTab }) {
  const todayKey = localDateKey();
  const [planDoc, savePlan] = useHubDoc(`plan-${todayKey}`);
  const [templateDoc] = useHubDoc("template");
  const [routineDoc, saveRoutine] = useHubDoc("routine");
  const [winsDoc, saveWins] = useHubDoc("daywins");
  const [view, setView] = useState(meMatch);
  const weekend = isWeekendKey(todayKey);

  const card = {
    background: T.card, borderRadius: 14, padding: "14px 16px",
    border: `1px solid ${T.line}`, marginBottom: 14,
  };

  const p = { ...EMPTY_PLAN, ...((planDoc || {})[view] || {}) };
  const anchors = (templateDoc || {})[view]?.anchors || DEFAULT_ANCHORS;
  const wrapup = (templateDoc || {})[view]?.wrapup || DEFAULT_WRAPUP;
  const w1 = (p.w1 || []).filter((l) => l && l.trim());
  const w2 = (p.w2 || []).filter((l) => l && l.trim());
  const fun = (p.fun || []).filter((l) => l && l.trim());
  const hasPlan = w1.length > 0 || (weekend ? fun.length > 0 : p.top3.some((t) => t && t.trim()));

  const setPerson = (next) => savePlan({ ...(planDoc || {}), [view]: next });

  // Routine habit wiring (family time, in bed, exercise auto-check)
  const rPerson = (routineDoc && routineDoc[view]) || {};
  const rDays = rPerson.days || {};
  const rToday = rDays[todayKey] || {};
  const setHabit = (habitId, val) => {
    const nextToday = { ...rToday, [habitId]: val ? 1 : 0 };
    saveRoutine({ ...(routineDoc || {}), [view]: { ...rPerson, days: { ...rDays, [todayKey]: nextToday } } });
  };

  const toggleW = (which, idx) => {
    const lines = which === "w1" ? w1 : w2;
    const doneArr = [...(p[which + "done"] || [])];
    doneArr[idx] = !doneArr[idx];
    setPerson({ ...p, [which + "done"]: doneArr });
    if (which === "w1" && lines.every((_, k) => (k === idx ? doneArr[idx] : doneArr[k]))) {
      setHabit("exercise", true);
    }
  };

  // Progress across everything checkable (work items only on weekdays)
  const items = [];
  w1.forEach((_, i) => items.push(!!(p.w1done || [])[i]));
  anchors.forEach((_, i) => items.push(!!(p.anchorsDone || {})[i]));
  if (!weekend) {
    p.top3.forEach((t, i) => { if (t && t.trim()) items.push(!!p.done3[i]); });
    p.blocks.forEach((b, i) => { if (b && b.trim()) items.push(!!p.blocksDone[i]); });
    wrapup.forEach((_, i) => items.push(!!(p.wrapupDone || {})[i]));
  } else {
    fun.forEach((_, i) => items.push(!!(p.fundone || [])[i]));
  }
  w2.forEach((_, i) => items.push(!!(p.w2done || [])[i]));
  if ((planDoc || {}).dinner) items.push(!!(planDoc || {}).dinnerDone);
  items.push((rToday.family || 0) > 0);
  items.push((rToday.bed || 0) > 0);
  const doneN = items.filter(Boolean).length;
  const allDone = items.length > 0 && doneN === items.length;
  const pct = items.length ? Math.round((doneN / items.length) * 100) : 0;

  // Record / clear today's 100% in the shared wins ledger
  const wins = (winsDoc || {})[view] || {};
  useEffect(() => {
    if (winsDoc === undefined) return;
    const has = !!wins[todayKey];
    if (allDone && !has) {
      saveWins({ ...(winsDoc || {}), [view]: { ...wins, [todayKey]: true } });
    } else if (!allDone && has) {
      const next = { ...wins };
      delete next[todayKey];
      saveWins({ ...(winsDoc || {}), [view]: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, view, todayKey, winsDoc]);

  // Consecutive 100% days (today counts once won)
  let winStreak = allDone ? 1 : 0;
  for (let i = 1; i < 400; i++) {
    if (wins[dateKeyOffset(-i)]) winStreak++;
    else break;
  }

  if (planDoc === undefined || templateDoc === undefined || routineDoc === undefined || winsDoc === undefined) {
    return <div style={card}><SectionTitle>Today</SectionTitle><div style={{ color: T.inkSoft, fontSize: 14 }}>Loading…</div></div>;
  }

  const divider = { borderTop: `1px dashed ${T.line}`, margin: "10px 0 8px" };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <SectionTitle>Today, in order</SectionTitle>
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {["mike", "tina"].map((m) => (
            <button
              key={m}
              onClick={() => setView(m)}
              style={{
                border: `1.5px solid ${view === m ? T.ink : T.line}`,
                background: view === m ? T.ink : "transparent",
                color: view === m ? "#fff" : T.inkSoft,
                borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "Inter, sans-serif", textTransform: "capitalize",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: allDone ? T.leaf : T.ink }}>
          {pct}% done{allDone ? " — day won 🐠" : ""}
        </span>
        {winStreak > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 12, fontWeight: 800, color: T.leaf,
            background: T.leafSoft, borderRadius: 999, padding: "2px 10px",
          }}>
            <Flame size={12} /> {winStreak} {winStreak === 1 ? "day" : "days"} in a row at 100%
          </span>
        )}
      </div>

      {!hasPlan && (
        <div style={{
          background: "#FDF6E7", border: `1px solid ${T.marigold}`, borderRadius: 10,
          padding: "8px 12px", marginBottom: 10, fontSize: 12.5, color: T.marigoldDeep, lineHeight: 1.45,
        }}>
          No plan was set last night — the anchors below still stand. Tonight at 3:30,{" "}
          <button onClick={() => onGoTab("plan")} style={{ border: "none", background: "transparent", color: T.marigoldDeep, cursor: "pointer", fontWeight: 800, padding: 0, textDecoration: "underline", fontFamily: "Inter, sans-serif", fontSize: 12.5 }}>
            run the shutdown
          </button>.
        </div>
      )}

      {/* 5:00 AM — Workout #1 */}
      {w1.length > 0 && (
        <TimeRow time="5:00 AM">
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, paddingTop: 8 }}>Workout #1</div>
          {w1.map((l, i) => (
            <CheckRow key={i} done={!!(p.w1done || [])[i]} label={l} onToggle={() => toggleW("w1", i)} />
          ))}
        </TimeRow>
      )}

      {/* Morning anchors */}
      {anchors.map((a, i) => (
        <TimeRow key={i} time={a.t}>
          <CheckRow
            done={!!(p.anchorsDone || {})[i]}
            label={a.label}
            onToggle={() => setPerson({ ...p, anchorsDone: { ...(p.anchorsDone || {}), [i]: !(p.anchorsDone || {})[i] } })}
          />
        </TimeRow>
      ))}

      {/* Weekend: plans & family fun */}
      {weekend && fun.length > 0 && (
        <>
          <div style={divider} />
          <TimeRow time="Daytime">
            <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, paddingTop: 8 }}>Plans &amp; family fun</div>
            {fun.map((l, i) => (
              <CheckRow
                key={i}
                done={!!(p.fundone || [])[i]}
                label={l}
                onToggle={() => { const arr = [...(p.fundone || [])]; arr[i] = !arr[i]; setPerson({ ...p, fundone: arr }); }}
              />
            ))}
          </TimeRow>
        </>
      )}

      {/* 9:00–3:30 — priorities & deep blocks (weekdays only) */}
      {!weekend && (p.top3.some((t) => t && t.trim()) || p.blocks.some((b) => b && b.trim())) && (
        <>
          <div style={divider} />
          <TimeRow time="9:00 AM">
            <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, paddingTop: 8 }}>Priorities (9:00–3:30)</div>
            {[p.star, ...[0, 1, 2].filter((i) => i !== p.star)].map((i) => {
              const text = p.top3[i];
              if (!text || !text.trim()) return null;
              const isStar = i === p.star;
              return (
                <div key={i} style={isStar ? {
                  background: "#FDF6E7", border: `1px solid ${T.marigold}`,
                  borderRadius: 10, padding: "4px 10px 2px", margin: "4px 0 6px",
                } : {}}>
                  {isStar && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 800, color: T.marigoldDeep, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      <Star size={11} fill={T.marigold} color={T.marigold} /> Defines today
                    </div>
                  )}
                  <CheckRow
                    big={isStar}
                    done={p.done3[i]}
                    label={text}
                    onToggle={() => { const done3 = [...p.done3]; done3[i] = !done3[i]; setPerson({ ...p, done3 }); }}
                  />
                </div>
              );
            })}
            {p.blocks.map((b, i) => b && b.trim() && (
              <CheckRow
                key={"b" + i}
                done={p.blocksDone[i]}
                label={b}
                sub={`Deep block ${i + 1}`}
                onToggle={() => { const blocksDone = [...p.blocksDone]; blocksDone[i] = !blocksDone[i]; setPerson({ ...p, blocksDone }); }}
              />
            ))}
          </TimeRow>
        </>
      )}

      <div style={divider} />

      {/* Wrap up (weekdays only) */}
      {!weekend && wrapup.map((a, i) => (
        <TimeRow key={"wu" + i} time={a.t}>
          <CheckRow
            done={!!(p.wrapupDone || {})[i]}
            label={a.label}
            sub="Opens tomorrow's plan"
            onToggle={() => {
              const val = !(p.wrapupDone || {})[i];
              setPerson({ ...p, wrapupDone: { ...(p.wrapupDone || {}), [i]: val } });
              if (val) onGoTab("plan");
            }}
          />
        </TimeRow>
      ))}

      {/* 4:00 PM — Workout #2 */}
      {w2.length > 0 && (
        <TimeRow time="4:00 PM">
          <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, paddingTop: 8 }}>Workout #2</div>
          {w2.map((l, i) => (
            <CheckRow key={i} done={!!(p.w2done || [])[i]} label={l} onToggle={() => toggleW("w2", i)} />
          ))}
        </TimeRow>
      )}

      {/* Dinner */}
      {(planDoc || {}).dinner && (
        <TimeRow time="4:45 PM">
          <CheckRow
            done={!!(planDoc || {}).dinnerDone}
            label={`Dinner: ${(planDoc || {}).dinner}`}
            sub="Prep at 4:45, eat by 5:30"
            onToggle={() => savePlan({ ...(planDoc || {}), dinnerDone: !(planDoc || {}).dinnerDone })}
          />
        </TimeRow>
      )}

      {/* Evening habits, wired to the routine tracker */}
      <TimeRow time="6:00 PM">
        <CheckRow
          done={(rToday.family || 0) > 0}
          label="Family time — phone away"
          onToggle={() => setHabit("family", !((rToday.family || 0) > 0))}
        />
      </TimeRow>
      <TimeRow time="9:15 PM">
        <CheckRow
          done={(rToday.bed || 0) > 0}
          label="In bed — tomorrow starts tonight"
          onToggle={() => setHabit("bed", !((rToday.bed || 0) > 0))}
        />
      </TimeRow>

      {allDone && (
        <div style={{
          marginTop: 12, background: T.leafSoft, border: `1px solid ${T.leaf}`,
          borderRadius: 10, padding: "10px", textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <Fish key={i} size={18} color={T.marigold}
                style={{ animation: `bob 1s ease-in-out ${i * 0.15}s infinite alternate` }} />
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.leaf, marginTop: 4 }}>Perfect day. Every box.</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tomorrow's snapshot — what's already been decided                  */
/* ------------------------------------------------------------------ */
function TomorrowSnapshot({ meMatch, onGoTab }) {
  const tKey = dateKeyOffset(1);
  const [planDoc] = useHubDoc(`plan-${tKey}`);

  const card = {
    background: T.card, borderRadius: 14, padding: "14px 16px",
    border: `1px solid ${T.line}`, marginBottom: 14,
  };

  if (planDoc === undefined) return null;

  const p = { ...EMPTY_PLAN, ...((planDoc || {})[meMatch] || {}) };
  const w1 = (p.w1 || []).filter((l) => l && l.trim());
  const w2 = (p.w2 || []).filter((l) => l && l.trim());
  const fun = (p.fun || []).filter((l) => l && l.trim());
  const tops = p.top3.map((t, i) => ({ t, i })).filter((x) => x.t && x.t.trim());
  const blocks = p.blocks.filter((b) => b && b.trim());
  const dinner = (planDoc || {}).dinner;
  const any = w1.length || w2.length || fun.length || tops.length || blocks.length || dinner;

  const Row = ({ label, children }) => (
    <div style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 8, padding: "4px 0", alignItems: "start" }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: T.marigoldDeep, textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.45 }}>{children}</span>
    </div>
  );

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionTitle>Tomorrow's snapshot — {weekdayOf(1)}</SectionTitle>
        {p.shutdownComplete && (
          <span style={{ fontSize: 11.5, fontWeight: 800, color: T.leaf, marginBottom: 10 }}>Shutdown done ✓</span>
        )}
      </div>
      {!any ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5 }}>
          Nothing planned yet.{" "}
          <button
            onClick={() => onGoTab("plan")}
            style={{ border: "none", background: "transparent", color: T.marigoldDeep, cursor: "pointer", fontWeight: 800, padding: 0, textDecoration: "underline", fontFamily: "Inter, sans-serif", fontSize: 13.5 }}
          >
            Run tonight's shutdown
          </button>{" "}
          and tomorrow shows up here.
        </div>
      ) : (
        <div>
          {tops.length > 0 && (
            <Row label="Top 3">
              {[p.star, ...tops.map((x) => x.i).filter((i) => i !== p.star)]
                .filter((i) => p.top3[i] && p.top3[i].trim())
                .map((i, k) => (
                  <span key={i} style={{ display: "block", fontWeight: i === p.star ? 800 : 500 }}>
                    {i === p.star && <Star size={11} fill={T.marigold} color={T.marigold} style={{ marginRight: 4, verticalAlign: "-1px" }} />}
                    {p.top3[i]}
                  </span>
                ))}
            </Row>
          )}
          {blocks.length > 0 && (
            <Row label="Deep blocks">
              {blocks.map((b, i) => <span key={i} style={{ display: "block" }}>{b}</span>)}
            </Row>
          )}
          {fun.length > 0 && (
            <Row label="Plans">
              {fun.map((f, i) => <span key={i} style={{ display: "block" }}>{f}</span>)}
            </Row>
          )}
          {w1.length > 0 && (
            <Row label="Workout #1">{w1.join(" · ")}</Row>
          )}
          {w2.length > 0 && (
            <Row label="Workout #2">{w2.join(" · ")}</Row>
          )}
          {dinner && <Row label="Dinner">{dinner}</Row>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Plan tab — the 3:30 shutdown, in the order of the day it builds    */
/* ------------------------------------------------------------------ */
function PlanTab({ meMatch, meName }) {
  const [offset, setOffset] = useState(1); // 1 = tomorrow, 2 = day after
  const dateKey = dateKeyOffset(offset);
  const [planDoc, savePlan] = useHubDoc(`plan-${dateKey}`);
  const [templateDoc, saveTemplate] = useHubDoc("template");
  const [routineDoc, saveRoutine] = useHubDoc("routine");

  const [top3, setTop3] = useState(["", "", ""]);
  const [star, setStar] = useState(0);
  const [blocks, setBlocks] = useState(["", ""]);
  const [w1, setW1] = useState([""]);
  const [w2, setW2] = useState([""]);
  const [fun, setFun] = useState([""]);
  const [dinner, setDinner] = useState("");
  const [prep, setPrep] = useState({ inbox: false, calendar: false });
  const [completed, setCompleted] = useState(false);
  const loadedFor = useRef(null);

  useEffect(() => {
    if (planDoc === undefined) return;
    if (loadedFor.current === dateKey) return;
    loadedFor.current = dateKey;
    const p = { ...EMPTY_PLAN, ...((planDoc || {})[meMatch] || {}) };
    setTop3([...p.top3]);
    setStar(p.star ?? 0);
    setBlocks([...p.blocks]);
    setW1(p.w1 && p.w1.length ? [...p.w1] : [""]);
    setW2(p.w2 && p.w2.length ? [...p.w2] : [""]);
    setFun(p.fun && p.fun.length ? [...p.fun] : [""]);
    setPrep({ ...p.prep });
    setCompleted(!!p.shutdownComplete);
    setDinner((planDoc || {}).dinner || "");
  }, [planDoc, dateKey, meMatch]);

  const persist = (overrides = {}) => {
    const existing = { ...EMPTY_PLAN, ...((planDoc || {})[meMatch] || {}) };
    const person = {
      ...existing,
      top3, star, blocks, w1, w2, fun, prep, shutdownComplete: completed,
      ...overrides.person,
    };
    savePlan({
      ...(planDoc || {}),
      dinner: overrides.dinner !== undefined ? overrides.dinner : dinner,
      [meMatch]: person,
    });
  };

  const completeShutdown = () => {
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
  const anchors = (templateDoc || {})[meMatch]?.anchors || DEFAULT_ANCHORS;
  const wrapup = (templateDoc || {})[meMatch]?.wrapup || DEFAULT_WRAPUP;
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
    borderRadius: 10, padding: "10px 12px", fontSize: 15, outline: "none",
    background: T.card, color: T.ink, fontFamily: "Inter, sans-serif",
  };
  const card = {
    background: T.card, borderRadius: 14, padding: "16px",
    border: `1px solid ${T.line}`, marginBottom: 14,
  };
  const timeTag = (t) => (
    <span style={{ fontSize: 11, fontWeight: 800, color: T.marigoldDeep, marginRight: 6 }}>{t}</span>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, color: T.ink }}>
          The 3:30 shutdown
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2].map((o) => (
            <button
              key={o}
              onClick={() => setOffset(o)}
              style={{
                border: `1.5px solid ${offset === o ? T.ink : T.line}`,
                background: offset === o ? T.ink : "transparent",
                color: offset === o ? "#fff" : T.inkSoft,
                borderRadius: 999, padding: "4px 12px", fontSize: 12.5, fontWeight: 700,
                cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}
            >
              {weekdayOf(o)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Planning <strong style={{ color: T.ink }}>{weekdayOf(offset)}</strong> ({fmtDateKey(dateKey)}), {meName}.
        Ten minutes now buys a decided morning. Fields save when you tap away.
      </div>

      {/* Step 0 — about TODAY (skip on weekends: no work to close) */}
      {!todayWeekend && (
      <div style={card}>
        <SectionTitle>Close out today</SectionTitle>
        <CheckRow
          done={prep.inbox} label="Inbox cleared" sub="Two-minute replies sent, the rest captured below"
          onToggle={() => { const next = { ...prep, inbox: !prep.inbox }; setPrep(next); persist({ person: { prep: next } }); }}
        />
        <CheckRow
          done={prep.calendar} label="Calendar reviewed" sub="You know what tomorrow holds"
          onToggle={() => { const next = { ...prep, calendar: !prep.calendar }; setPrep(next); persist({ person: { prep: next } }); }}
        />
      </div>
      )}

      {/* 5:00 AM — workout #1 */}
      <div style={card}>
        <SectionTitle>{timeTag("5:00 AM")} Workout #1</SectionTitle>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: -4, marginBottom: 10 }}>
          Written down tonight = no 5am decisions. One line per exercise or interval.
        </div>
        <WorkoutLines lines={w1} setLines={setW1} onBlur={() => persist()} placeholder="e.g. 5x5 back squat" />
      </div>

      {/* The standing anchors */}
      <div style={card}>
        <SectionTitle>Daily anchors</SectionTitle>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: -4, marginBottom: 10 }}>
          These repeat every day and appear on the Today list automatically.
        </div>
        <AnchorEditor items={anchors} onSave={saveAnchors} />
      </div>

      {/* Weekend — plans & family fun */}
      {targetWeekend && (
        <div style={card}>
          <SectionTitle>{timeTag("Daytime")} Plans &amp; family fun</SectionTitle>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: -4, marginBottom: 10 }}>
            What's happening {weekdayOf(offset)}? One line each — outings, projects, or just "backyard morning".
          </div>
          <WorkoutLines lines={fun} setLines={setFun} onBlur={() => persist()} placeholder="e.g. Farmers market + playground" />
        </div>
      )}

      {/* 9:00–3:30 — priorities (weekdays) */}
      {!targetWeekend && (
      <div style={card}>
        <SectionTitle>{timeTag("9:00–3:30")} Top 3 priorities</SectionTitle>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: -4, marginBottom: 10 }}>
          Tap the star for the ONE that defines the day.
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => { setStar(i); persist({ person: { star: i } }); }}
              aria-label={`Make priority ${i + 1} the star`}
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2 }}
            >
              <Star size={20} fill={star === i ? T.marigold : "none"} color={star === i ? T.marigold : T.line} />
            </button>
            <input
              value={top3[i]}
              onChange={(e) => { const next = [...top3]; next[i] = e.target.value; setTop3(next); }}
              onBlur={() => persist()}
              placeholder={i === 0 ? "The most important thing" : `Priority ${i + 1}`}
              style={inputStyle}
            />
          </div>
        ))}
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>
          Deep block 1 will produce…
        </div>
        <input
          value={blocks[0]}
          onChange={(e) => setBlocks([e.target.value, blocks[1]])}
          onBlur={() => persist()}
          placeholder="e.g. Q3 proposal draft sent to client"
          style={inputStyle}
        />
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>
          Deep block 2 will produce…
        </div>
        <input
          value={blocks[1]}
          onChange={(e) => setBlocks([blocks[0], e.target.value])}
          onBlur={() => persist()}
          placeholder="e.g. Retainer report for client B done"
          style={inputStyle}
        />
      </div>
      )}

      {/* 3:30 PM — wrap up (standing, weekdays) */}
      {!targetWeekend && (
      <div style={card}>
        <SectionTitle>{timeTag("3:30 PM")} Wrap up &amp; set up</SectionTitle>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: -4, marginBottom: 10 }}>
          Standing every day — edit if the ritual changes.
        </div>
        <AnchorEditor items={wrapup} onSave={saveWrapup} />
      </div>
      )}

      {/* 4:00 PM — workout #2 */}
      <div style={card}>
        <SectionTitle>{timeTag("4:00 PM")} Workout #2</SectionTitle>
        <WorkoutLines lines={w2} setLines={setW2} onBlur={() => persist()} placeholder="e.g. 20 min bike + core" />
      </div>

      {/* Dinner */}
      <div style={card}>
        <SectionTitle>{timeTag("4:45 PM")} Family dinner</SectionTitle>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: -4, marginBottom: 10 }}>
          Shared — Tina sees this too. Note any prep to do tonight.
        </div>
        <input
          value={dinner}
          onChange={(e) => setDinner(e.target.value)}
          onBlur={() => persist({ dinner })}
          placeholder="e.g. Sheet-pan chicken — defrost tonight"
          style={inputStyle}
        />
      </div>

      {completed ? (
        <div style={{
          background: T.leafSoft, border: `1px solid ${T.leaf}`, borderRadius: 14,
          padding: "14px 16px", textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <Fish key={i} size={20} color={T.marigold}
                style={{ animation: `bob 1s ease-in-out ${i * 0.15}s infinite alternate` }} />
            ))}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.leaf, marginTop: 6 }}>
            Shutdown complete — the evening is yours.
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>
            You can still edit anything above; it saves as you go.
          </div>
        </div>
      ) : (
        <button
          onClick={completeShutdown}
          style={{
            width: "100%", border: "none", background: T.marigold, color: T.ink,
            borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 800,
            cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}
        >
          Shutdown complete 🐠
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Home page                                                          */
/* ------------------------------------------------------------------ */
function HomeTab({ me, meMatch, members, onGoTab, wide }) {
  const dateKey = localDateKey();
  const todayName = DAYS[(new Date().getDay() + 6) % 7];

  const [weather, setWeather] = useState(null);
  const [weatherBusy, setWeatherBusy] = useState(true);
  const [weatherErr, setWeatherErr] = useState("");
  const [photoDoc, savePhoto, removePhotoDoc] = useHubDoc(`photo-${dateKey}`);
  const [checkinDoc, saveCheckin] = useHubDoc(`checkin-${dateKey}`);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const fileInputRef = useRef(null);

  const checkin = checkinDoc === undefined ? null : (checkinDoc?.messages || []);
  const photo = photoDoc === undefined ? null : photoDoc;

  const loadWeather = useCallback(async () => {
    setWeatherBusy(true);
    setWeatherErr("");
    try {
      setWeather(await fetchWeather());
    } catch (e) {
      setWeatherErr(e.message || "Something went wrong");
    }
    setWeatherBusy(false);
  }, []);

  useEffect(() => { loadWeather(); }, [loadWeather]);

  const postMessage = () => {
    const t = chatDraft.trim();
    if (!t || checkin === null) return;
    setChatDraft("");
    saveCheckin({
      messages: [...checkin, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        author: me, text: t, ts: Date.now(), replies: [],
      }],
    });
  };

  const postReply = (msgId) => {
    const t = replyDraft.trim();
    if (!t) return;
    setReplyDraft("");
    setReplyTo(null);
    saveCheckin({
      messages: checkin.map((m) => m.id === msgId
        ? { ...m, replies: [...(m.replies || []), { author: me, text: t, ts: Date.now() }] }
        : m),
    });
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoErr("");
    try {
      const img = await compressPhoto(file);
      await savePhoto({ img, by: me, ts: Date.now() });
    } catch (e) {
      setPhotoErr(`Couldn't save the photo (${e.message || "unknown error"})`);
    }
    setPhotoBusy(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const card = {
    background: T.card, borderRadius: 14, padding: "14px 16px",
    border: `1px solid ${T.line}`, marginBottom: 14,
  };

  return (
    <div>
      <div style={{
        fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22,
        fontWeight: 800, color: T.ink, marginBottom: 16,
      }}>
        {greeting}, {me}
      </div>

      <div style={wide ? { display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16, alignItems: "start" } : undefined}>
      <div>
      <TodaySchedule meMatch={meMatch} onGoTab={onGoTab} />

      <TomorrowSnapshot meMatch={meMatch} onGoTab={onGoTab} />

      <RoutineCard onGoTab={onGoTab} />
      </div>
      <div>
      {/* Weather */}
      <div style={{ ...card, background: T.ink, border: "none", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A8BACB" }}>
            Duxbury, MA
          </div>
          <button
            onClick={loadWeather}
            aria-label="Refresh weather"
            style={{ border: "none", background: "transparent", color: "#A8BACB", cursor: "pointer", padding: 4 }}
          >
            <RefreshCw size={14} style={weatherBusy ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
        </div>
        {weatherBusy && !weather && (
          <div style={{ padding: "14px 0", color: "#A8BACB", fontSize: 14 }}>Checking the sky…</div>
        )}
        {weatherErr && !weather && (
          <div style={{ padding: "14px 0", color: "#A8BACB", fontSize: 14, lineHeight: 1.4 }}>
            Couldn't get the weather ({weatherErr}). Tap refresh to try again.
          </div>
        )}
        {weather && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
            <Sun size={34} color={T.marigold} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                {Math.round(weather.tempF)}°
                <span style={{ fontSize: 14, fontWeight: 600, color: "#A8BACB", marginLeft: 8 }}>
                  H {Math.round(weather.hiF)}° · L {Math.round(weather.loF)}° · {weather.condition}
                </span>
              </div>
              <div style={{ fontSize: 13.5, color: "#D6DEE6", marginTop: 3, lineHeight: 1.4 }}>
                {weather.summary}
              </div>
            </div>
          </div>
        )}
      </div>



      {/* Photo of the day */}
      <div style={card}>
        <SectionTitle>Photo of the day</SectionTitle>
        {photo ? (
          <div>
            <img
              src={photo.img} alt="Today's family photo"
              style={{ width: "100%", borderRadius: 10, display: "block" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontSize: 12.5, color: T.inkSoft }}>
                Shared by {photo.by} · disappears at midnight
              </span>
              <button
                onClick={() => removePhotoDoc()}
                style={{ border: "none", background: "transparent", color: T.coral, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif" }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ""; }}
            />
            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={photoBusy}
              style={{
                width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "26px 16px", border: `2px dashed ${T.line}`, borderRadius: 12,
                cursor: photoBusy ? "default" : "pointer", color: T.inkSoft, fontSize: 14,
                textAlign: "center", background: "transparent", fontFamily: "Inter, sans-serif",
              }}
            >
              {photoBusy ? <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={22} color={T.marigold} />}
              {photoBusy ? "Uploading…" : "Add today's photo of the kids — it only lives here for today"}
            </button>
          </div>
        )}
        {photoErr && <div style={{ fontSize: 13, color: T.coral, marginTop: 8 }}>{photoErr}</div>}
      </div>

      {/* Daily check-in */}
      <div style={{ ...card, marginBottom: 0 }}>
        <SectionTitle>How are you feeling today?</SectionTitle>
        {checkin === null ? (
          <div style={{ color: T.inkSoft, fontSize: 14, padding: "8px 0" }}>Loading…</div>
        ) : (
          <>
            {checkin.length === 0 && (
              <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 10 }}>
                No check-ins yet today. Go first — even "surviving" counts.
              </div>
            )}
            {checkin.map((m) => (
              <div key={m.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <Avatar name={m.author} color={members[m.author]} size={24} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>
                      {m.author}
                      <span style={{ fontWeight: 400, marginLeft: 6 }}>
                        {new Date(m.ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ fontSize: 14.5, color: T.ink, lineHeight: 1.4 }}>{m.text}</div>
                    <button
                      onClick={() => { setReplyTo(replyTo === m.id ? null : m.id); setReplyDraft(""); }}
                      style={{
                        border: "none", background: "transparent", color: T.inkSoft,
                        cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "3px 0",
                        display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "Inter, sans-serif",
                      }}
                    >
                      <CornerDownRight size={12} /> Reply
                    </button>
                  </div>
                </div>
                {(m.replies || []).map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginLeft: 32, marginTop: 6 }}>
                    <Avatar name={r.author} color={members[r.author]} size={20} />
                    <div>
                      <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600 }}>{r.author}</div>
                      <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.4 }}>{r.text}</div>
                    </div>
                  </div>
                ))}
                {replyTo === m.id && (
                  <div style={{ display: "flex", gap: 6, marginLeft: 32, marginTop: 8 }}>
                    <input
                      autoFocus
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && postReply(m.id)}
                      placeholder={`Reply to ${m.author}…`}
                      style={{
                        flex: 1, border: `1.5px solid ${T.line}`, borderRadius: 10,
                        padding: "7px 10px", fontSize: 14, outline: "none",
                        background: "#FAFBFC", color: T.ink, fontFamily: "Inter, sans-serif",
                      }}
                    />
                    <button
                      onClick={() => postReply(m.id)}
                      style={{
                        border: "none", background: T.ink, color: "#fff", borderRadius: 10,
                        width: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      }}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <input
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && postMessage()}
                placeholder="Check in — how's it going?"
                style={{
                  flex: 1, border: `1.5px solid ${T.line}`, borderRadius: 10,
                  padding: "9px 12px", fontSize: 14, outline: "none",
                  background: "#FAFBFC", color: T.ink, fontFamily: "Inter, sans-serif",
                }}
              />
              <button
                onClick={postMessage}
                style={{
                  border: "none", background: T.marigold, color: T.ink, borderRadius: 10,
                  padding: "0 14px", cursor: "pointer", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Send size={15} />
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 8 }}>
              A fresh thread starts each morning.
            </div>
          </>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login + first-time profile setup                                   */
/* ------------------------------------------------------------------ */
function LoginScreen() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, familyEmail, pw);
    } catch (e) {
      setErr(
        /invalid|wrong|credential|not-found/i.test(e.code || "")
          ? "That's not the family password. Try again?"
          : `Sign-in failed: ${e.message}`,
      );
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.canvas, display: "flex",
      alignItems: "flex-start", justifyContent: "center", padding: "56px 20px 40px",
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{
        background: T.card, borderRadius: 20, padding: "32px 30px 36px",
        maxWidth: 400, width: "100%", border: `1px solid ${T.line}`,
        boxShadow: "0 8px 30px rgba(0,49,87,0.10)",
      }}>
        <Fish size={34} color={T.marigold} style={{ marginBottom: 10 }} />
        <div style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 30,
          fontWeight: 800, color: T.ink, lineHeight: 1.1, marginBottom: 8,
        }}>
          Fisher Family Hub
        </div>
        <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 24, lineHeight: 1.5 }}>
          Family members only. Enter the family password — you'll stay signed in on this device.
        </div>
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Family password"
          type="password"
          autoComplete="current-password"
          style={{
            width: "100%", boxSizing: "border-box",
            border: `1.5px solid ${T.line}`, borderRadius: 12,
            padding: "12px 14px", fontSize: 16, outline: "none",
            marginBottom: 16, color: T.ink,
          }}
        />
        {err && <div style={{ fontSize: 13, color: T.coral, marginBottom: 12, lineHeight: 1.4 }}>{err}</div>}
        <button
          onClick={go}
          disabled={busy || !pw}
          style={{
            width: "100%", border: "none",
            background: pw ? T.marigold : T.line,
            color: T.ink, borderRadius: 12, padding: "13px 0", fontSize: 15,
            fontWeight: 800, cursor: pw ? "pointer" : "default",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {busy ? "Opening…" : "Enter the hub"}
        </button>
      </div>
    </div>
  );
}

function WelcomePhotoSlot({ src, side, onPick }) {
  const inputRef = useRef(null);
  return (
    <div style={{ width: "50%" }}>
      <input
        ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }}
      />
      <button
        onClick={() => inputRef.current && inputRef.current.click()}
        style={{
          width: "100%", aspectRatio: "3/4", border: src ? "none" : `2px dashed ${T.line}`,
          borderRadius: 12, cursor: "pointer", padding: 0, overflow: "hidden",
          background: src ? "transparent" : "#FAFBFC", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
      >
        {src ? (
          <img src={src} alt={`Family photo ${side}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ color: T.inkSoft, fontSize: 11.5, textAlign: "center", padding: 8, fontFamily: "Inter, sans-serif" }}>
            <Camera size={18} color={T.marigold} style={{ marginBottom: 4 }} />
            <div>Add family photo</div>
          </div>
        )}
      </button>
    </div>
  );
}

function ProfileSetup({ members, onDone }) {
  const [name, setName] = useState("");
  const [colorIdx, setColorIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [welcomeDoc, saveWelcome] = useHubDoc("welcome");

  const pickPhoto = async (side, file) => {
    if (!file) return;
    try {
      const img = await compressPhoto(file, 300000);
      saveWelcome({ ...(welcomeDoc || {}), [side]: img });
    } catch { /* leave slot empty */ }
  };

  const go = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      const color = members[n] || MEMBER_COLORS[colorIdx];
      await setDoc(doc(db, "hub", "members"), { [n]: color }, { merge: true });
      onDone({ name: n, color });
    } catch (e) {
      setBusy(false);
    }
  };

  const existing = Object.entries(members || {});

  return (
    <div style={{
      minHeight: "100vh", background: T.canvas, display: "flex",
      alignItems: "flex-start", justifyContent: "center", padding: "56px 20px 40px",
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{
        background: T.card, borderRadius: 20, padding: "28px 30px 36px",
        maxWidth: 400, width: "100%", border: `1px solid ${T.line}`,
        boxShadow: "0 8px 30px rgba(0,49,87,0.10)",
      }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <WelcomePhotoSlot src={welcomeDoc?.left} side="left" onPick={(f) => pickPhoto("left", f)} />
          <WelcomePhotoSlot src={welcomeDoc?.right} side="right" onPick={(f) => pickPhoto("right", f)} />
        </div>
        <Fish size={34} color={T.marigold} style={{ marginBottom: 10 }} />
        <div style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 30,
          fontWeight: 800, color: T.ink, lineHeight: 1.1, marginBottom: 8,
        }}>
          Welcome to the<br />Fisher Family Hub
        </div>
        <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 24, lineHeight: 1.5 }}>
          One place for the lists, the plans, and the "what's for dinner" debate. Tell us who's here so your notes get your name on them.
        </div>
        {existing.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft, marginBottom: 8 }}>
              Who's this?
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {existing.map(([n, c]) => (
                <button
                  key={n}
                  onClick={() => onDone({ name: n, color: c })}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    border: `1.5px solid ${T.line}`, background: "#FAFBFC",
                    borderRadius: 999, padding: "7px 14px 7px 8px", cursor: "pointer",
                    fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: "Inter, sans-serif",
                  }}
                >
                  <Avatar name={n} color={c} size={22} />
                  I'm {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 12 }}>
              Someone new? Add yourself below.
            </div>
          </div>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Your first name"
          style={{
            width: "100%", boxSizing: "border-box",
            border: `1.5px solid ${T.line}`, borderRadius: 12,
            padding: "12px 14px", fontSize: 16, outline: "none",
            marginBottom: 16, color: T.ink,
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft, marginBottom: 8 }}>
          Pick your color
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {MEMBER_COLORS.map((c, i) => (
            <button
              key={c}
              onClick={() => setColorIdx(i)}
              aria-label={`Color option ${i + 1}`}
              style={{
                width: 34, height: 34, borderRadius: "50%", background: c,
                border: colorIdx === i ? `3px solid ${T.ink}` : "3px solid transparent",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
        <button
          onClick={go}
          disabled={busy || !name.trim()}
          style={{
            width: "100%", border: "none", background: name.trim() ? T.marigold : T.line,
            color: T.ink, borderRadius: 12, padding: "13px 0", fontSize: 15,
            fontWeight: 800, cursor: name.trim() ? "pointer" : "default",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {busy ? "Setting up…" : "Enter the hub"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs + App                                                         */
/* ------------------------------------------------------------------ */
const TABS = [
  { id: "home", label: "Today", icon: Fish },
  { id: "plan", label: "Plan", icon: ClipboardList },
];

function NotConfigured() {
  return (
    <div style={{
      minHeight: "100vh", background: T.canvas, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{
        background: T.card, borderRadius: 20, padding: "32px 30px",
        maxWidth: 440, border: `1px solid ${T.line}`, lineHeight: 1.6,
        color: T.ink, fontSize: 14.5,
      }}>
        <Fish size={30} color={T.marigold} style={{ marginBottom: 10 }} />
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          One step left
        </div>
        Firebase isn't configured yet. Open <code style={{ background: "#F0F2F5", padding: "1px 6px", borderRadius: 5 }}>src/firebase-config.js</code> and
        paste your Firebase project's config — the README walks through it step by step (about 10 minutes, free).
      </div>
    </div>
  );
}

const IDENTITY_KEY = "famhub:me";
function loadIdentity() {
  try { return JSON.parse(localStorage.getItem(IDENTITY_KEY)); } catch { return null; }
}

export default function App() {
  const wide = useIsWide();
  const [user, setUser] = useState(undefined);   // undefined = checking auth
  const [profile, setProfileState] = useState(loadIdentity);
  const [members, setMembers] = useState({});
  const [tab, setTab] = useState("home");

  const setProfile = (p) => {
    try {
      if (p) localStorage.setItem(IDENTITY_KEY, JSON.stringify(p));
      else localStorage.removeItem(IDENTITY_KEY);
    } catch { /* private browsing */ }
    setProfileState(p);
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pop { 0% { transform: scale(.5); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
      @keyframes bob { from { transform: translateY(0); } to { transform: translateY(-4px); } }
      * { -webkit-tap-highlight-color: transparent; }
      button:focus-visible, input:focus-visible { outline: 2px solid ${T.sky}; outline-offset: 2px; }`;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  // Live member roster for avatar colors
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, "hub", "members"),
      (snap) => setMembers(snap.exists() ? snap.data() : {}),
      () => setMembers({}),
    );
  }, [user]);

  if (!configured) return <NotConfigured />;
  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>
        <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  if (!profile) return <ProfileSetup members={members} onDone={setProfile} />;

  const me = profile.name;
  const meMatch = me.toLowerCase().startsWith("tina") ? "tina" : "mike";
  const contentWidth = wide ? (tab === "home" ? 1100 : 760) : 640;

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: T.ink, padding: "22px 18px 0" }}>
        <div style={{ maxWidth: contentWidth, margin: "0 auto", transition: "max-width .2s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{
                fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 23,
                fontWeight: 800, color: "#fff", lineHeight: 1,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Fish size={22} color={T.marigold} />
                Fisher Family Hub
              </div>
              <div style={{ fontSize: 12.5, color: "#A8BACB", marginTop: 5 }}>
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {Object.entries(members).map(([n, c]) => (
                <Avatar key={n} name={n} color={c} size={30} />
              ))}
              <button
                onClick={() => { setProfile(null); signOut(auth); }}
                aria-label="Sign out"
                title="Sign out"
                style={{ border: "none", background: "transparent", color: "#A8BACB", cursor: "pointer", padding: 4 }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* Tab rail */}
          <div style={{ display: "flex", gap: 6, marginTop: 20, overflowX: "auto" }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{
                    border: "none", cursor: "pointer",
                    background: active ? T.canvas : "rgba(255,255,255,0.08)",
                    color: active ? T.ink : "#B8C4D0",
                    borderRadius: "12px 12px 0 0", padding: "11px 15px 12px",
                    fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif",
                    display: "flex", alignItems: "center", gap: 7,
                    whiteSpace: "nowrap", flexShrink: 0,
                    transform: active ? "translateY(0)" : "translateY(3px)",
                    transition: "all .15s ease",
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: contentWidth, margin: "0 auto", padding: "20px 16px 60px", transition: "max-width .2s ease" }}>
        {tab === "home" && <HomeTab me={me} meMatch={meMatch} members={members} onGoTab={setTab} wide={wide} />}
        {tab === "plan" && <PlanTab meMatch={meMatch} meName={me} />}
      </div>
    </div>
  );
}

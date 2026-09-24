import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart, UtensilsCrossed, CheckSquare, Plane, Plus,
  ThumbsUp, MessageCircle, Trash2, Send, Loader2, ChevronDown,
  Fish, RefreshCw, Camera, CornerDownRight, Sun, ArrowRight, LogOut,
  Dumbbell, Droplet, Apple, Target, Moon, Heart, Flame,
  Power, ClipboardList, Star, Wallet, KeyRound, ExternalLink, GripVertical,
  Briefcase, Users, BarChart3, LayoutGrid,
} from "lucide-react";
import { auth, db, mfgAuth, mfgDb, configured } from "./lib/firebase.js";
import * as appConfig from "./firebase-config.js";
const familyEmail = appConfig.familyEmail;
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, deleteDoc, getDoc } from "firebase/firestore";
// Contract-v2 sample dashboard for ?portal=mfg&client=…&sample=1 previews.
import SAMPLE_DASHBOARD from "../docs/sample-client-dashboard.json";

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
    setData(undefined); // reset when switching documents so stale data never leaks across days
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
/*  Daily routine tracker — per-person habit lists                     */
/* ------------------------------------------------------------------ */
const DEFAULT_HABITS_MIKE = [
  { id: "exercise", label: "Exercise" },
  { id: "hydration", label: "Hydration" },
  { id: "eat", label: "Eat well" },
  { id: "deepwork", label: "Deep work" },
  { id: "shutdown", label: "Shutdown" },
  { id: "family", label: "Family time" },
  { id: "bed", label: "In bed 9:15" },
];

/* Tina starts with a blank slate and builds her own; Mike keeps his defaults.
   Once either person saves an edited list, that list wins. */
function habitsFor(templateDoc, match) {
  const custom = templateDoc && templateDoc[match] && templateDoc[match].habits;
  if (custom !== undefined && custom !== null) return custom;
  return match === "mike" ? DEFAULT_HABITS_MIKE : [];
}
function anchorsFor(templateDoc, match) {
  const a = templateDoc && templateDoc[match] && templateDoc[match].anchors;
  if (a !== undefined && a !== null) return a;
  return match === "mike" ? DEFAULT_ANCHORS : [];
}
function wrapupFor(templateDoc, match) {
  const w = templateDoc && templateDoc[match] && templateDoc[match].wrapup;
  if (w !== undefined && w !== null) return w;
  return match === "mike" ? DEFAULT_WRAPUP : [];
}

function dateKeyOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  priorities: [],
  top3: ["", "", ""], done3: [false, false, false], star: 0,
  blocks: ["", ""], blocksDone: [false, false],
  w1: [""], w1done: [], w2: [""], w2done: [],
  fun: [""], fundone: [],
  anchorsDone: {}, wrapupDone: {},
  prep: { inbox: false, calendar: false }, shutdownComplete: false,
};

/* ------------------------------------------------------------------ */
/*  To Do List categories (clients green, Realty blue, Personal red)   */
/* ------------------------------------------------------------------ */
/* Master client roster — single source of truth for the To Do List AND the MFG dashboards */
const CLIENTS = [
  { id: "panhandle", label: "Panhandle Getaways", abbr: "PHG" },
  { id: "bearcamp", label: "Bear Camp Cabin Rentals", abbr: "BCCR" },
  { id: "killington", label: "The Killington Group", abbr: "TKG" },
  { id: "haller", label: "Haller Coastal Homes", abbr: "HCH" },
  { id: "nashville", label: "Nashville Vacation Homes", abbr: "NVH" },
  { id: "heights", label: "The Heights Hotel", abbr: "THH" },
  { id: "newwave", label: "New Wave Vacation Rentals", abbr: "NW" },
  { id: "franmaxon", label: "Fran Maxon Real Estate", abbr: "FMRE" },
  { id: "hodnett", label: "Hodnett Cooper", abbr: "HC" },
  { id: "kauai", label: "Kauai Real Estate Group", abbr: "KREG" },
  { id: "ohana", label: "Ohana Vacations", abbr: "OV" },
  { id: "giantsridge", label: "The Villas at Giants Ridge", abbr: "VGR" },
];
const clientOf = (id) => CLIENTS.find((c) => c.id === id);

const TD_CATS = [
  ...CLIENTS.map((c) => ({ ...c, color: "#2F6D54" })),
  { id: "realty", label: "Realty Advisors", abbr: "RA", color: "#33608A" },
  { id: "personal", label: "Personal", abbr: "PERS", color: "#9E3B2F" },
];
const catOf = (id) => TD_CATS.find((c) => c.id === id);

/* Ordered priority list for a day. Reads the new format, falls back to
   the old Top-3 fields so this week's existing plans still display. */
function getPriorities(p) {
  if (p.priorities && p.priorities.length) return p.priorities;
  const legacy = (p.top3 || [])
    .map((t, i) => ({ id: "legacy" + i, text: t, done: !!(p.done3 || [])[i], idx: i }))
    .filter((x) => x.text && x.text.trim());
  if (!legacy.length) return [];
  const star = p.star ?? 0;
  return [...legacy.filter((x) => x.idx === star), ...legacy.filter((x) => x.idx !== star)]
    .map(({ id, text, done }) => ({ id, text, done }));
}

const DEFAULT_ANCHORS_NEW = [
  { t: "5:30 AM", label: "Get ready — Tina's workout window" },
  { t: "6:00 AM", label: "Kids up — breakfast & morning routine" },
  { t: "7:45 AM", label: "Daycare dropoff" },
  { t: "8:15 AM", label: "Emails + set up the day" },
];
const DEFAULT_ANCHORS = DEFAULT_ANCHORS_NEW; const OLD_ANCHORS = [
  { t: "5:30 AM", label: "Give gratitude" },
  { t: "6:30 AM", label: "Get ready for the day" },
  { t: "7:45 AM", label: "Kids dropoff" },
  { t: "8:30 AM", label: "Review calendar & emails, dinner prep — set up your day" },
];
const DEFAULT_WRAPUP = [
  { t: "4:00 PM", label: "Shutdown — lingering emails & last tasks" },
];

function weekdayOf(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

function fullDateOf(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function weekdayShort(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function isWeekendKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

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
/*  Calendar — read from Firestore (synced every 30 min by Actions)    */
/* ------------------------------------------------------------------ */
function CalendarCard({ dateKey, title, bare }) {
  const [cal] = useHubDoc("calendar");

  const card = bare ? {} : {
    background: T.card, borderRadius: 14, padding: "14px 16px",
    border: `1px solid ${T.line}`, marginBottom: 14,
  };

  if (cal === undefined) {
    return (
      <div style={card}>
        {!bare && <SectionTitle>{title}</SectionTitle>}
        <div style={{ color: T.inkSoft, fontSize: 13.5 }}>Checking the calendar…</div>
      </div>
    );
  }

  const events = ((cal || {}).days || {})[dateKey] || [];

  return (
    <div style={card}>
      {!bare && <SectionTitle>{title}</SectionTitle>}
      {!cal ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5 }}>
          Calendar sync hasn't run yet — kick off the "Calendar sync" workflow once and events appear here.
        </div>
      ) : events.length === 0 ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft }}>Nothing on the calendar — a clear runway.</div>
      ) : (
        events.map((ev, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 8, padding: "4px 0", alignItems: "start" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: T.marigoldDeep, paddingTop: 2, whiteSpace: "nowrap" }}>{ev.t}</span>
            <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.45 }}>{ev.title}</span>
          </div>
        ))
      )}
      {cal && cal.updated && (
        <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>
          Synced {new Date(cal.updated).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Plan tab — the 3:30 shutdown, in the order of the day it builds    */
/* ------------------------------------------------------------------ */
function PlanTab({ meMatch, meName, wide, onGoTab }) {
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

/* ------------------------------------------------------------------ */
/*  Home page                                                          */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  Home page cards — upcoming events, news, pulse placeholders        */
/* ------------------------------------------------------------------ */
function UpcomingCard() {
  const [cal] = useHubDoc("calendar");

  const card = {
    background: T.card, borderRadius: 14, padding: "16px 18px",
    border: `1px solid ${T.line}`, marginBottom: 14,
  };

  if (cal === undefined) {
    return (
      <div style={card}>
        <SectionTitle>Upcoming — next few days</SectionTitle>
        <div style={{ color: T.inkSoft, fontSize: 13.5 }}>Checking the calendar…</div>
      </div>
    );
  }

  const dayList = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dayList.push({
      key,
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "long" }),
      events: ((cal || {}).days || {})[key] || [],
    });
  }

  return (
    <div style={card}>
      <SectionTitle>Upcoming — next few days</SectionTitle>
      {!cal ? (
        <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5 }}>
          Calendar sync hasn't run yet — run the "Calendar sync" workflow once and the next few days appear here.
        </div>
      ) : (
        dayList.map((day) => (
          <div key={day.key} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.marigoldDeep, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
              {day.label}
            </div>
            {day.events.length === 0 ? (
              <div style={{ fontSize: 13, color: T.inkSoft, padding: "1px 0" }}>Clear.</div>
            ) : day.events.map((ev, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 8, padding: "2.5px 0" }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: T.inkSoft, whiteSpace: "nowrap", paddingTop: 2 }}>{ev.t}</span>
                <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.4 }}>{ev.title}</span>
              </div>
            ))}
          </div>
        ))
      )}
      {cal && cal.updated && (
        <div style={{ fontSize: 10.5, color: T.inkSoft }}>
          Synced {new Date(cal.updated).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
function NewsCard() {
  const [newsDoc] = useHubDoc("news");
  const card = { background: T.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${T.line}`, marginBottom: 14 };
  if (newsDoc === undefined) return null;
  const sections = (newsDoc && newsDoc.sections) || [];
  return (
    <div style={card}>
      <SectionTitle>The feed</SectionTitle>
      {sections.length === 0 ? (
        <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>
          News lands here each morning once the nightly news job is installed.
        </div>
      ) : (
        sections.map((s) => (
          <div key={s.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.marigoldDeep, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {s.label}
            </div>
            {(s.items || []).map((it, i) => (
              <a key={i} href={it.url} target="_blank" rel="noreferrer" style={{
                display: "block", fontSize: 13.5, color: T.ink, textDecoration: "none",
                padding: "3px 0", lineHeight: 1.4,
              }}>
                {it.title}
                <span style={{ color: T.inkSoft, fontSize: 11.5 }}> — {it.source}</span>
              </a>
            ))}
          </div>
        ))
      )}
      {newsDoc && newsDoc.updated && (
        <div style={{ fontSize: 10.5, color: T.inkSoft }}>Updated {new Date(newsDoc.updated).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</div>
      )}
    </div>
  );
}

function PulseCard({ title, tiles, note, cta }) {
  return (
    <div style={{ background: T.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${T.line}`, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <SectionTitle>{title}</SectionTitle>
        {cta}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {tiles.map((t) => (
          <div key={t} style={{ background: "#FAFBFC", border: `1px dashed ${T.line}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.line, fontFamily: "'Bricolage Grotesque', sans-serif" }}>—</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 8, lineHeight: 1.45 }}>{note}</div>
    </div>
  );
}

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

      <div style={wide ? { display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16, alignItems: "start" } : undefined}>
      <div>
      {meMatch === "mike" && <UpcomingCard />}

      <PulseCard
        title="Financial pulse"
        tiles={["Net income", "Available to deploy", "DTI"]}
        note="Lights up with the Financials Phase 1 engine — Monarch data, fixed expenses, the real numbers."
      />

      <PulseCard
        title="Business pulse"
        tiles={["Gross Profit $", "Gross Margin %", "MRR"]}
        note="Lights up with the Mike Fisher Group data engine."
        cta={<a href="?portal=mfg" target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 800, color: "#D31017", textDecoration: "none", marginBottom: 10 }}>Open portal →</a>}
      />
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



      <NewsCard />

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

function TodoListPage({ wide }) {
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

/* ------------------------------------------------------------------ */
/*  Financials — shell (Phase 1 engine to come)                        */
/* ------------------------------------------------------------------ */
const FIN_ENTITIES = [
  { id: "fin-157", label: "157 King Phillips Path" },
  { id: "fin-66", label: "66 Telegraph St" },
  { id: "fin-mfg", label: "Mike Fisher Group" },
];

function KpiTile({ label, hint }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px",
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.line, fontFamily: "'Bricolage Grotesque', sans-serif", margin: "6px 0 2px" }}>—</div>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{hint}</div>
    </div>
  );
}

function FinancialsPage({ sub }) {
  const entity = FIN_ENTITIES.find((e) => e.id === sub);
  const card = {
    background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px", marginBottom: 14,
  };

  if (sub === "fin-expenses") {
    return (
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 12 }}>
          Expense Management
        </div>
        <div style={card}>
          <SectionTitle>Coming in Phase 1</SectionTitle>
          <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.65 }}>
            This is where expense data gets clean. The plan, as designed:
            monthly import from the <strong style={{ color: T.ink }}>Monarch CSV in Google Sheets</strong>;
            known recurring expenses (mortgage, insurance, subscriptions — defined once by you, per entity)
            auto-categorize and <strong style={{ color: T.ink }}>auto-populate the current month before they hit the account</strong>;
            anything the system doesn't recognize triggers a <strong style={{ color: T.ink }}>one-tap categorization pop-up</strong> —
            you pick the category once and it remembers the pattern for next time.
          </div>
        </div>
      </div>
    );
  }

  if (entity) {
    return (
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 12 }}>
          {entity.label}
        </div>
        <div style={card}>
          <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>
            This entity's dashboard arrives with the Phase 1 engine: revenue, expenses, and net income for{" "}
            <strong style={{ color: T.ink }}>{entity.label}</strong> by month, its recurring expense schedule,
            and its contribution to the consolidated Overview.
          </div>
        </div>
      </div>
    );
  }

  // Overview
  return (
    <div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
        Financial Overview
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>
        Consolidated across the household, both properties, and Mike Fisher Group. Layout is live — the Phase 1 data engine fills it in.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
        <KpiTile label="Revenue · this month" hint="incl. known income not yet landed" />
        <KpiTile label="Expenses · this month" hint="incl. scheduled fixed expenses" />
        <KpiTile label="Net income" hint="vs last month" />
        <KpiTile label="Available to deploy" hint="after committed savings" />
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px", marginBottom: 14 }}>
        <SectionTitle>12-month revenue vs expenses</SectionTitle>
        <div style={{ height: 160, borderRadius: 10, background: "#FAFBFC", border: `1px dashed ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontSize: 13 }}>
          Chart renders here once monthly data exists
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px" }}>
          <SectionTitle>3-month forecast</SectionTitle>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6 }}>
            Projected from your fixed-expense schedule plus trailing averages of variable spend.
          </div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px" }}>
          <SectionTitle>Debt-to-income</SectionTitle>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6 }}>
            Monthly debt payments ÷ gross income — the ratio your next lender will read first.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Accounts directory — names, URLs, usernames. Never passwords.      */
/* ------------------------------------------------------------------ */
function AccountsTab() {
  const [data, save] = useHubDoc("accounts");
  const [draft, setDraft] = useState({ name: "", url: "", username: "" });
  const items = data === undefined ? null : (data?.items || []);

  const inputS = {
    width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.line}`,
    borderRadius: 10, padding: "9px 11px", fontSize: 14, outline: "none",
    background: T.card, color: T.ink, fontFamily: "Inter, sans-serif",
  };

  if (items === null) return <Spinner />;

  const persist = (next) => save({ items: next });
  const addItem = () => {
    if (!draft.name.trim()) return;
    persist([...items, { id: `${Date.now()}`, ...draft }]);
    setDraft({ name: "", url: "", username: "" });
  };
  const update = (id, field, value) => persist(items.map((a) => a.id === id ? { ...a, [field]: value } : a));

  return (
    <div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 8 }}>
        Accounts
      </div>
      <div style={{
        background: "#FDF6E7", border: `1px solid ${T.marigold}`, borderRadius: 12,
        padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: T.marigoldDeep, lineHeight: 1.5,
      }}>
        By design, no passwords live here — those belong in a real password manager. This is the family map of
        what exists and where.
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Account name" style={inputS} />
          <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="URL" style={inputS} />
          <input value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder="Username" style={inputS} />
          <button onClick={addItem} style={{
            border: "none", background: T.marigold, color: T.ink, borderRadius: 10,
            padding: "0 16px", cursor: "pointer", fontWeight: 800, fontSize: 13.5, fontFamily: "Inter, sans-serif",
          }}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: T.inkSoft, fontSize: 14, background: T.card, borderRadius: 14, border: `1px dashed ${T.line}` }}>
          Nothing here yet — add the first account above.
        </div>
      ) : (
        items.map((a) => (
          <div key={a.id} style={{
            background: T.card, border: `1px solid ${T.line}`, borderRadius: 12,
            padding: "10px 12px", marginBottom: 8,
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 8, alignItems: "center",
          }}>
            <input value={a.name} onChange={(e) => update(a.id, "name", e.target.value)} style={{ ...inputS, fontWeight: 700 }} />
            <input value={a.url} onChange={(e) => update(a.id, "url", e.target.value)} style={inputS} />
            <input value={a.username} onChange={(e) => update(a.id, "username", e.target.value)} style={inputS} />
            {/^https?:\/\//.test(a.url || "") ? (
              <a href={a.url} target="_blank" rel="noreferrer" style={{ color: T.marigoldDeep, display: "flex" }} title="Open site">
                <ExternalLink size={16} />
              </a>
            ) : <span style={{ width: 16 }} />}
            <button onClick={() => persist(items.filter((x) => x.id !== a.id))} style={{ border: "none", background: "transparent", color: T.coral, cursor: "pointer", fontSize: 17, fontWeight: 700 }}>×</button>
          </div>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mike Fisher Group portal — separate logins, role-based access      */
/*  Runs at ?portal=mfg in its own browser tab with its own session.   */
/* ------------------------------------------------------------------ */
// The portal shares the master roster (CLIENTS, defined with the To Do List
// categories above) — adding a client there adds it here.
const MFG_CLIENTS = CLIENTS;
const mfgClientOf = (id) => MFG_CLIENTS.find((c) => c.id === id);

const MFG_RED = "#D31017";

function MfgKpiTile({ label, hint }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.line, fontFamily: "'Bricolage Grotesque', sans-serif", margin: "6px 0 2px" }}>—</div>
      {hint && <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

function MfgShellNote({ children }) {
  return (
    <div style={{
      background: "#FFF5F5", border: `1px solid ${MFG_RED}33`, borderRadius: 12,
      padding: "10px 14px", margin: "14px 0 0", fontSize: 12.5, color: "#8A2A2E", lineHeight: 1.5,
    }}>{children}</div>
  );
}

function MFGLogin({ onError, error }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const inputS = {
    width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.line}`,
    borderRadius: 12, padding: "13px 15px", fontSize: 16, outline: "none",
    background: "#fff", color: T.ink, fontFamily: "Inter, sans-serif", marginBottom: 10,
  };
  const go = async () => {
    if (!email.trim() || !pw) return;
    setBusy(true);
    try {
      await signInWithEmailAndPassword(mfgAuth, email.trim(), pw);
    } catch (e) {
      onError(
        e.code === "auth/invalid-credential" || e.code === "auth/wrong-password" || e.code === "auth/user-not-found"
          ? "That email or password isn't right."
          : `Sign-in problem (${e.code || e.message})`
      );
    }
    setBusy(false);
  };
  return (
    <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Inter, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ background: T.ink, borderRadius: "16px 16px 0 0", padding: "22px 24px", borderBottom: `4px solid ${MFG_RED}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Briefcase size={22} color="#fff" />
            <div>
              <div style={{ color: "#fff", fontSize: 19, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Mike Fisher Group</div>
              <div style={{ color: "#A8BACB", fontSize: 11.5 }}>Revenue management portal</div>
            </div>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: "0 0 16px 16px", padding: 24, border: `1px solid ${T.line}`, borderTop: "none" }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="username" style={inputS} />
          <input value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="Password" type="password" autoComplete="current-password" style={inputS} />
          {error && <div style={{ color: MFG_RED, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{error}</div>}
          <button onClick={go} disabled={busy} style={{
            width: "100%", border: "none", background: MFG_RED, color: "#fff", borderRadius: 12,
            padding: "13px 0", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: "Inter, sans-serif",
            opacity: busy ? 0.7 : 1,
          }}>{busy ? "Signing in…" : "Sign in"}</button>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 12, lineHeight: 1.5 }}>
            Access is by invitation. Clients see their own dashboard only.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Client dashboard renderer — docs/client-dashboard-contract-v2.md   */
/*  Writers own WHAT (tabs/sections/values, pre-formatted strings);    */
/*  this code owns HOW IT LOOKS. Section types: tiles/chart/table/note.*/
/* ------------------------------------------------------------------ */

// Read-only live subscription on the portal's own app instance, so a
// client login's session (mfgAuth) is the one the rules evaluate.
function useMfgHubDoc(path) {
  const [data, setData] = useState(undefined); // undefined = loading, null = missing
  useEffect(() => {
    if (!path) return;
    setData(undefined);
    const unsub = onSnapshot(
      doc(mfgDb, "hub", path),
      (snap) => setData(snap.exists() ? snap.data() : null),
      () => setData(null),
    );
    return unsub;
  }, [path]);
  return data;
}

// Chart series colors, assigned in fixed order (never cycled). Chosen from
// the brand family and validated colorblind-safe + >=3:1 on white.
const MFG_SERIES = ["#1F6FB2", "#A87415", "#7A4FA3", "#B0402F"];

// dir means "is this good news", not the sign of the number.
const MFG_DIR_COLOR = { up: T.leaf, down: T.coral, flat: T.inkSoft };

function fmtAxisValue(v, format) {
  if (typeof v !== "number" || !isFinite(v)) return "";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  const compact = a >= 1e6 ? `${+(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${+(a / 1e3).toFixed(a < 1e4 ? 1 : 0)}K` : `${+a.toFixed(0)}`;
  if (format === "percent") return `${sign}${+a.toFixed(1)}%`;
  if (format === "currency") return `${sign}$${compact}`;
  return `${sign}${compact}`;
}

function fmtFullValue(v, format) {
  if (typeof v !== "number" || !isFinite(v)) return "";
  if (format === "percent") return `${+v.toFixed(1)}%`;
  if (format === "currency") return `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString()}`;
  return v.toLocaleString();
}

function niceCeil(v) {
  if (v <= 0) return 0;
  const m = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / m;
  return (n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * m;
}

function MfgSectionTitle({ children, heading }) {
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

function MfgTilesSection({ section }) {
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

function MfgChartSection({ section, seriesStyles, compact }) {
  const [hover, setHover] = useState(null);
  // Click a legend entry to hide/show that series.
  const [hidden, setHidden] = useState({});
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
  const W = 640, H = compact ? 250 : 240, padL = 48, padR = 10, padT = 10, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const scaleSet = visible.length ? visible : series.map((s, i) => ({ s, i }));
  const all = scaleSet.flatMap(({ s }) => s.values).filter((v) => typeof v === "number" && isFinite(v));
  const rawMin = Math.min(0, ...all); // zero baseline unless data goes negative
  const max = niceCeil(Math.max(1e-9, ...all)) || 1;
  const min = rawMin < 0 ? -niceCeil(-rawMin) : 0;
  const y = (v) => padT + innerH * (1 - (v - min) / (max - min));
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
          {isLine && visible.map(({ s, i: si }) => {
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

// "$1.2M" -> 1200000, "38.5%" -> 38.5, "+4.7" -> 4.7, "3 BR" -> 3, "-" -> null
function tableCellNumber(cell) {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "object") cell = cell.text;
  const s = String(cell ?? "").trim();
  const m = s.replace(/[,$%+]/g, "").match(/^(-?\d+(?:\.\d+)?)\s*([KM])?/i);
  if (!m) return null;
  const mult = m[2] ? (m[2].toUpperCase() === "M" ? 1e6 : 1e3) : 1;
  return parseFloat(m[1]) * mult;
}

function MfgTableSection({ section }) {
  const columns = Array.isArray(section.columns) ? section.columns : [];
  // First click sorts high-to-low, second flips, third clears.
  const [sort, setSort] = useState(null);
  let rows = Array.isArray(section.rows) ? section.rows : [];
  if (sort) {
    const cellAt = (r, i) => (Array.isArray(r) ? r : r?.cells || [])[i];
    rows = [...rows].sort((ra, rb) => {
      const na = tableCellNumber(cellAt(ra, sort.col));
      const nb = tableCellNumber(cellAt(rb, sort.col));
      if (na === null && nb === null) return String(cellAt(ra, sort.col) ?? "").localeCompare(String(cellAt(rb, sort.col) ?? "")) * sort.dir;
      if (na === null) return 1;
      if (nb === null) return -1;
      return (nb - na) * sort.dir;
    });
  }
  const clickCol = (i) => setSort((s) =>
    !s || s.col !== i ? { col: i, dir: 1 } : s.dir === 1 ? { col: i, dir: -1 } : null);
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16, overflowX: "auto" }}>
      {section.title && <MfgSectionTitle>{section.title}</MfgSectionTitle>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} onClick={() => clickCol(i)} title="Sort"
                style={{
                  textAlign: i === 0 ? "left" : "right", fontSize: 10.5, fontWeight: 800,
                  color: sort?.col === i ? T.ink : T.inkSoft, cursor: "pointer", userSelect: "none",
                  textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 10px 8px", whiteSpace: "nowrap",
                }}>{c}{sort?.col === i ? (sort.dir === 1 ? " ▼" : " ▲") : ""}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {/* Canonical row shape is {cells:[...]} (Firestore can't nest
                  arrays in arrays); plain arrays are accepted too. */}
              {(Array.isArray(r) ? r : Array.isArray(r?.cells) ? r.cells : []).map((cell, ci) => (
                <td key={ci} style={{
                  textAlign: ci === 0 ? "left" : "right", fontSize: 13.5, color: T.ink,
                  fontWeight: ci === 0 ? 700 : 500, padding: "9px 10px", borderTop: `1px solid ${T.line}`,
                  whiteSpace: ci === 0 ? "normal" : "nowrap",
                }}>{cell && typeof cell === "object"
                  ? (cell.url
                    ? <a href={cell.url} target="_blank" rel="noreferrer" style={{ color: "#1F6FB2", fontWeight: 700, textDecoration: "none" }}>{cell.text}</a>
                    : cell.text)
                  : cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MfgNoteSection({ section }) {
  return (
    <div style={{ background: T.skySoft, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
      {section.text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Interactive client-dashboard sections (contract v2.1)              */
/* ------------------------------------------------------------------ */
const MFG_CARD = { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 };
const MFG_CHIP = (on) => ({
  border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? T.ink : "#fff",
  color: on ? "#fff" : T.inkSoft, borderRadius: 999, padding: "4px 12px",
  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif",
});
const MFG_INPUT = {
  border: `1.5px solid ${T.line}`, borderRadius: 10, padding: "7px 11px",
  fontSize: 13, outline: "none", background: "#fff", color: T.ink, fontFamily: "Inter, sans-serif",
};

function fmtKpi(v, format) {
  if (v === null || v === undefined || !isFinite(v)) return "–";
  if (format === "percent") return `${(v * 100).toFixed(1)}%`;
  if (format === "currency") {
    const a = Math.abs(v);
    return a >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : a >= 1e4 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v).toLocaleString()}`;
  }
  return Math.round(v).toLocaleString();
}

function MfgChipRow({ label, options, sel, setSel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 }}>{label}</span>
      {options.map((o) => (
        <button key={o} onClick={() => setSel((s) => ({ ...s, [o]: !s[o] }))} style={MFG_CHIP(!!sel[o])}>{o}</button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------- listing table */
function MfgListingTableSection({ section, userEmail }) {
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const notes = useMfgHubDoc(section.notesDoc);
  const [q, setQ] = useState("");
  const [brSel, setBrSel] = useState({});
  const [tagSel, setTagSel] = useState({});
  const [city, setCity] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [histFor, setHistFor] = useState(null);
  const [saving, setSaving] = useState(false);

  const cities = [...new Set(rows.map((r) => r.city).filter(Boolean))].sort();
  const allTags = [...new Set(rows.flatMap((r) => r.tags || []))].sort();
  const brs = Object.keys(section.summary?.byBedrooms || {});
  const anyBr = Object.values(brSel).some(Boolean);
  const anyTag = Object.values(tagSel).some(Boolean);

  const shown = rows.filter((r) =>
    (!q || (r.name || "").toLowerCase().includes(q.toLowerCase()))
    && (!anyBr || brSel[String(r.bedrooms)])
    && (!anyTag || (r.tags || []).some((t) => tagSel[t]))
    && (!city || r.city === city));

  const saveNote = async (id) => {
    if (!userEmail) return;
    setSaving(true);
    try {
      const prev = notes?.[id];
      const entry = {
        text: draft.trim(), by: userEmail, at: Date.now(),
        history: prev && prev.text
          ? [{ text: prev.text, by: prev.by || "", at: prev.at || 0 }, ...(prev.history || [])].slice(0, 20)
          : (prev?.history || []),
      };
      await setDoc(doc(mfgDb, "hub", section.notesDoc), { [id]: entry }, { merge: true });
      setEditing(null);
    } catch (e) {
      alert(`Could not save the note (${e.code || e.message}).`);
    }
    setSaving(false);
  };

  const th = { textAlign: "left", fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 10px 8px", whiteSpace: "nowrap" };
  const td = { fontSize: 13, color: T.ink, padding: "8px 10px", borderTop: `1px solid ${T.line}`, verticalAlign: "top" };
  const a = { color: "#1F6FB2", fontWeight: 700, textDecoration: "none" };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ ...MFG_CARD, marginBottom: 0, padding: "12px 16px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" }}>Active listings</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{section.summary?.total ?? rows.length}</div>
        </div>
        {Object.entries(section.summary?.byBedrooms || {}).map(([br, n]) => (
          <div key={br} style={{ ...MFG_CARD, marginBottom: 0, padding: "12px 16px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase" }}>{br} BR</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{n}</div>
          </div>
        ))}
      </div>

      <div style={{ ...MFG_CARD, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings…" style={{ ...MFG_INPUT, minWidth: 200 }} />
          <select value={city} onChange={(e) => setCity(e.target.value)} style={MFG_INPUT}>
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <MfgChipRow label="Bedrooms" options={brs} sel={brSel} setSel={setBrSel} />
        <MfgChipRow label="Tags" options={allTags} sel={tagSel} setSel={setTagSel} />
      </div>

      <div style={{ ...MFG_CARD, overflowX: "auto" }}>
        <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 700, marginBottom: 6 }}>{shown.length} of {rows.length} listings</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Listing</th><th style={th}>City</th><th style={th}>BR</th>
            <th style={th}>Abs. Min</th><th style={th}>Tags</th><th style={{ ...th, minWidth: 220 }}>Notes</th>
          </tr></thead>
          <tbody>
            {shown.map((r) => {
              const note = notes && notes[r.id];
              return (
                <React.Fragment key={r.id}>
                  <tr>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {r.url ? <a href={r.url} target="_blank" rel="noreferrer" style={a}>{r.name}</a> : r.name}
                    </td>
                    <td style={td}>{r.mapsUrl ? <a href={r.mapsUrl} target="_blank" rel="noreferrer" style={a}>{r.city}</a> : r.city}</td>
                    <td style={td}>{r.bedrooms}</td>
                    <td style={td}>{r.absMin != null
                      ? <a href={r.whUrl} target="_blank" rel="noreferrer" style={a} title="Open in Wheelhouse">${r.absMin}</a>
                      : "–"}</td>
                    <td style={td}>{(r.tags || []).map((t) => (
                      <span key={t} style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: T.ink, background: T.skySoft, borderRadius: 999, padding: "2px 8px", margin: "0 4px 3px 0" }}>{t}</span>
                    ))}</td>
                    <td style={td}>
                      {editing === r.id ? (
                        <div>
                          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                            style={{ ...MFG_INPUT, width: "100%", boxSizing: "border-box", resize: "vertical" }} autoFocus />
                          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            <button disabled={saving} onClick={() => saveNote(r.id)} style={{ ...MFG_CHIP(true), opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save"}</button>
                            <button onClick={() => setEditing(null)} style={MFG_CHIP(false)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                          <div style={{ flex: 1, fontSize: 12.5, color: note?.text ? T.ink : "#A9B2BB", lineHeight: 1.45 }}>
                            {note?.text || "No note yet"}
                            {note?.text && (
                              <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>
                                {note.by} · {note.at ? new Date(note.at).toLocaleDateString() : ""}
                                {(note.history || []).length > 0 && (
                                  <button onClick={() => setHistFor(histFor === r.id ? null : r.id)}
                                    style={{ border: "none", background: "transparent", color: "#1F6FB2", cursor: "pointer", fontSize: 10.5, fontWeight: 700, padding: 0, marginLeft: 6 }}>
                                    history ({note.history.length})
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          {userEmail && (
                            <button onClick={() => { setEditing(r.id); setDraft(note?.text || ""); setHistFor(null); }}
                              title="Edit note" style={{ border: "none", background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: 13 }}>✎</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {histFor === r.id && (note?.history || []).length > 0 && (
                    <tr><td colSpan={6} style={{ ...td, background: "#FAFBFC" }}>
                      {(note.history || []).map((h, i) => (
                        <div key={i} style={{ fontSize: 12, color: T.inkSoft, padding: "3px 0", borderBottom: i < note.history.length - 1 ? `1px dashed ${T.line}` : "none" }}>
                          <span style={{ color: T.ink }}>{h.text}</span>
                          <span style={{ marginLeft: 8, fontSize: 10.5 }}>— {h.by} · {h.at ? new Date(h.at).toLocaleDateString() : ""}</span>
                        </div>
                      ))}
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

/* ---------------------------------------------------- KPI explorer */
function evalKpi(expr, c, idx) {
  const tot = (arr) => (arr || []).reduce((a, b) => a + (b || 0), 0);
  const val = (name, i) => (i == null ? tot(c[name]) : (c[name]?.[i] ?? 0));
  if (expr === "count") return c.listings;
  const [op, rest] = String(expr).split(":");
  if (op === "sum") return val(rest, idx);
  if (op === "ratio") {
    const [num, den] = rest.split("/");
    const d = val(den, idx);
    return d ? val(num, idx) / d : null;
  }
  return null;
}

function MfgKpiExplorerSection({ section }) {
  const [brSel, setBrSel] = useState({});
  const [tagSel, setTagSel] = useState({});
  const groups = Array.isArray(section.groups) ? section.groups : [];
  const anyBr = Object.values(brSel).some(Boolean);
  const anyTag = Object.values(tagSel).some(Boolean);
  const active = groups.filter((g) =>
    (!anyBr || brSel[g.bedrooms]) && (!anyTag || (g.tags || []).some((t) => tagSel[t])));

  const periods = section.periods || [];
  const combine = (side) => {
    const c = { rent: periods.map(() => 0), booked: periods.map(() => 0), avail: periods.map(() => 0), listings: 0 };
    for (const g of active) {
      c.listings += g.listings || 0;
      for (const k of ["rent", "booked", "avail"]) {
        (g[side]?.[k] || []).forEach((v, i) => { c[k][i] += v || 0; });
      }
    }
    return c;
  };
  const cur = combine("cur"), ly = combine("ly");

  const chartOf = (kpi) => ({
    type: "chart", kind: "line", title: kpi.label, format: kpi.format,
    xLabels: periods,
    series: [
      { name: "This year", values: periods.map((_, i) => scale(evalKpi(kpi.expr, cur, i), kpi.format)) },
      { name: `LY as of ${section.lyAsOf}`, values: periods.map((_, i) => scale(evalKpi(kpi.expr, ly, i), kpi.format)) },
    ],
  });
  const scale = (v, format) => (v == null ? null : format === "percent" ? Math.round(v * 1000) / 10 : Math.round(v * 100) / 100);

  return (
    <div>
      <div style={{ ...MFG_CARD, display: "flex", flexDirection: "column", gap: 10 }}>
        <MfgChipRow label="Bedrooms" options={section.filters?.bedrooms || []} sel={brSel} setSel={setBrSel} />
        <MfgChipRow label="Tags" options={section.filters?.tags || []} sel={tagSel} setSel={setTagSel} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        {(section.kpis || []).map((k) => {
          const c = evalKpi(k.expr, cur, null), l = evalKpi(k.expr, ly, null);
          const d = c != null && l ? ((c - l) / l) * 100 : null;
          return (
            <div key={k.label} style={{ ...MFG_CARD, marginBottom: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif", margin: "5px 0 2px" }}>{fmtKpi(c, k.format)}</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft }}>
                LY {fmtKpi(l, k.format)}
                {d != null && Math.abs(d) >= 0.05 && (
                  <span style={{ fontWeight: 800, marginLeft: 6, color: d > 0 ? T.leaf : T.coral }}>{`${d > 0 ? "+" : ""}${d.toFixed(1)}%`}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Two charts per row on desktop, one on narrow screens. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 14, marginBottom: 16 }}>
        {(section.kpis || []).filter((k) => k.expr !== "count").map((k) => (
          <MfgChartSection key={k.label} compact section={chartOf(k)} />
        ))}
      </div>
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

/* ---------------------------------------------------- benchmark */
function MfgBenchmarkSection({ section }) {
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

/* ---------------------------------------------------- reservations */
const RES_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function resAddDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt2 = new Date(Date.UTC(y, m - 1, d + days));
  return dt2.toISOString().slice(0, 10);
}
function resDaysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

function MfgReservationsSection({ section }) {
  // Full history loads from the shard docs; the inline preview (newest 200)
  // paints immediately and stays if the shards can't be read.
  const [shardRows, setShardRows] = useState(null); // null = loading, "error", or array
  const [sort, setSort] = useState({ col: "cr", dir: -1 });
  const [q, setQ] = useState("");
  const [brSel, setBrSel] = useState({});
  const [jkOnly, setJkOnly] = useState(false);
  const [crFrom, setCrFrom] = useState(""); const [crTo, setCrTo] = useState("");
  const [ciFrom, setCiFrom] = useState(""); const [ciTo, setCiTo] = useState("");
  const [page, setPage] = useState(0);
  const [tipFor, setTipFor] = useState(null);
  const PAGE = 100;

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const snaps = await Promise.all(
          (section.shards || []).map((id) => getDoc(doc(mfgDb, "hub", id))));
        const rows = [];
        for (const s of snaps) {
          if (!s.exists()) continue;
          const v = s.data();
          for (let i = 0; i < (v.li || []).length; i++) {
            rows.push([v.li[i], v.cr[i], v.ci[i], v.ni[i], v.rr[i], v.la[i], v.lc[i], v.ln[i], v.lb[i]]);
          }
        }
        if (!dead) setShardRows(rows.length ? rows : "error");
      } catch {
        if (!dead) setShardRows("error");
      }
    })();
    return () => { dead = true; };
  }, [section.shards]);

  const raw = Array.isArray(shardRows) ? shardRows : (section.preview || []).map((p) => p.c);
  const rows = React.useMemo(() => raw.map((c) => {
    const lu = (section.listings || {})[String(c[0])] || {};
    const ci = c[2], ni = c[3] || 0;
    return {
      name: lu.n || "?", br: lu.br ?? "?", jk: !!lu.jk,
      cr: c[1], ci, co: resAddDays(ci, ni), ni,
      bw: resDaysBetween(c[1], ci),
      mo: Number(ci.slice(5, 7)), yr: Number(ci.slice(0, 4)),
      adr: ni ? Math.round((c[4] || 0) / ni) : null, rr: c[4] || 0,
      la: c[5], lc: c[6], ln: c[7], lb: c[8],
    };
  }), [raw, section.listings]);

  const brs = [...new Set(rows.map((r) => String(r.br)))].sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99));
  const anyBr = Object.values(brSel).some(Boolean);
  const filtered = React.useMemo(() => {
    let out = rows.filter((r) =>
      (!q || r.name.toLowerCase().includes(q.toLowerCase()))
      && (!anyBr || brSel[String(r.br)])
      && (!jkOnly || r.jk)
      && (!crFrom || r.cr >= crFrom) && (!crTo || r.cr <= crTo)
      && (!ciFrom || r.ci >= ciFrom) && (!ciTo || r.ci <= ciTo));
    const dir = sort.dir;
    out.sort((a, b) => {
      const va = a[sort.col], vb = b[sort.col];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
    return out;
  }, [rows, q, brSel, anyBr, jkOnly, crFrom, crTo, ciFrom, ciTo, sort]);

  useEffect(() => { setPage(0); }, [q, brSel, jkOnly, crFrom, crTo, ciFrom, ciTo]);
  const pageRows = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  const COLS = [
    ["name", "Listing"], ["br", "BR"], ["cr", "Created"], ["ci", "Check In"],
    ["co", "Check Out"], ["ni", "Nights"], ["bw", "BW"], ["mo", "CI Month"],
    ["yr", "CI Year"], ["adr", "ADR"], ["rr", "Total Rent"], ["la", "LY ADR"],
  ];
  const clickCol = (c) => setSort((s) => s.col === c ? { col: c, dir: -s.dir } : { col: c, dir: -1 });
  const th = (c, label, first) => (
    <th key={c} onClick={() => clickCol(c)} title="Sort" style={{
      textAlign: first ? "left" : "right", fontSize: 10.5, fontWeight: 800,
      color: sort.col === c ? T.ink : T.inkSoft, cursor: "pointer", userSelect: "none",
      textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 8px 8px", whiteSpace: "nowrap",
    }}>{label}{sort.col === c ? (sort.dir === -1 ? " ▼" : " ▲") : ""}</th>
  );
  const td = (first) => ({
    textAlign: first ? "left" : "right", fontSize: 12.5, color: T.ink,
    fontWeight: first ? 700 : 500, padding: "7px 8px", borderTop: `1px solid ${T.line}`, whiteSpace: "nowrap",
  });
  const money = (v) => v == null ? "–" : `$${Math.round(v).toLocaleString()}`;
  const dateLbl = { fontSize: 10.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div>
      <div style={{ ...MFG_CARD, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings…" style={{ ...MFG_INPUT, minWidth: 190 }} />
          <span style={dateLbl}>Created</span>
          <input type="date" value={crFrom} onChange={(e) => setCrFrom(e.target.value)} style={MFG_INPUT} />
          <span style={{ color: T.inkSoft }}>–</span>
          <input type="date" value={crTo} onChange={(e) => setCrTo(e.target.value)} style={MFG_INPUT} />
          <span style={dateLbl}>Check in</span>
          <input type="date" value={ciFrom} onChange={(e) => setCiFrom(e.target.value)} style={MFG_INPUT} />
          <span style={{ color: T.inkSoft }}>–</span>
          <input type="date" value={ciTo} onChange={(e) => setCiTo(e.target.value)} style={MFG_INPUT} />
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <MfgChipRow label="Bedrooms" options={brs} sel={brSel} setSel={setBrSel} />
          <button onClick={() => setJkOnly(!jkOnly)} style={MFG_CHIP(jkOnly)}>JK only</button>
        </div>
      </div>

      <div style={{ ...MFG_CARD, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 700 }}>
            {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} reservations
            {shardRows === null && " · loading full history…"}
            {shardRows === "error" && " · showing the newest 200 only (full history unavailable)"}
          </span>
          <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 700, color: T.inkSoft }}>
            <button disabled={page === 0} onClick={() => setPage(page - 1)} style={{ ...MFG_CHIP(false), opacity: page === 0 ? 0.4 : 1 }}>← Prev</button>
            page {page + 1} / {pages}
            <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} style={{ ...MFG_CHIP(false), opacity: page >= pages - 1 ? 0.4 : 1 }}>Next →</button>
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{COLS.map(([c, l], i) => th(c, l, i === 0))}</tr></thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={`${page}-${i}`}>
                <td style={{ ...td(true), whiteSpace: "normal", minWidth: 160 }}>{r.name}{r.jk && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: T.marigoldDeep, borderRadius: 999, padding: "1px 6px", marginLeft: 6 }}>JK</span>}</td>
                <td style={td()}>{r.br}</td>
                <td style={td()}>{r.cr}</td>
                <td style={td()}>{r.ci}</td>
                <td style={td()}>{r.co}</td>
                <td style={td()}>{r.ni}</td>
                <td style={td()}>{r.bw}d</td>
                <td style={td()}>{RES_MONTHS[r.mo - 1]}</td>
                <td style={td()}>{r.yr}</td>
                <td style={td()}>{money(r.adr)}</td>
                <td style={td()}>{money(r.rr)}</td>
                <td style={{ ...td(), position: "relative" }}
                  onMouseEnter={() => r.la != null && setTipFor(`${page}-${i}`)}
                  onMouseLeave={() => setTipFor(null)}>
                  {r.la != null ? (
                    <span style={{ color: r.adr != null && r.adr >= r.la ? T.leaf : T.coral, fontWeight: 700, cursor: "default", borderBottom: `1px dotted ${T.inkSoft}` }}>
                      {money(r.la)}
                    </span>
                  ) : "–"}
                  {tipFor === `${page}-${i}` && (
                    <div style={{
                      position: "absolute", right: 0, bottom: "100%", zIndex: 10,
                      background: T.ink, color: "#fff", borderRadius: 10, padding: "8px 11px",
                      fontSize: 11.5, whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,49,87,.25)", textAlign: "left",
                    }}>
                      <div style={{ fontWeight: 800, marginBottom: 2 }}>LY booking</div>
                      <div>ADR {money(r.la)} · {r.ln} nights</div>
                      <div>Check in {r.lc}{r.lb != null ? ` · BW ${r.lb}d` : ""}</div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

/* ---------------------------------------------------- comp set list */
function MfgCompsetListSection({ section }) {
  const [openId, setOpenId] = useState(null);
  const sets = Array.isArray(section.sets) ? section.sets : [];
  const open = sets.find((s) => s.id === openId);

  if (open) {
    return (
      <div>
        <button onClick={() => setOpenId(null)} style={{
          border: "none", background: "transparent", color: "#1F6FB2", cursor: "pointer",
          fontSize: 13, fontWeight: 800, padding: 0, marginBottom: 10, fontFamily: "Inter, sans-serif",
        }}>← All comp sets</button>
        <div style={MFG_CARD}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <MfgSectionTitle heading>
              {open.setUrl
                ? <a href={open.setUrl} target="_blank" rel="noreferrer" title="Open this comp set in Wheelhouse" style={{ color: "#1F6FB2", textDecoration: "none" }}>{open.name} ↗</a>
                : open.name}
            </MfgSectionTitle>
            <span style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 700 }}>
              {open.kind} · updated {open.updated}
            </span>
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 10 }}>{open.criteria}</div>
          {(open.associated || []).length > 0 && (
            <div style={{ fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", fontSize: 10.5, letterSpacing: "0.05em", marginRight: 8 }}>Compared against</span>
              {open.associated.map((a, i) => a.whUrl
                ? <a key={i} href={a.whUrl} target="_blank" rel="noreferrer" style={{ color: "#1F6FB2", fontWeight: 700, textDecoration: "none", marginRight: 10 }}>{a.name}</a>
                : <span key={i} style={{ fontWeight: 700, marginRight: 10 }}>{a.name}</span>)}
            </div>
          )}
        </div>
        {[open.chart, open.chartMonthly].filter(Boolean).map((ch, i) => (
          <MfgChartSection key={i} section={{ type: "chart", kind: "line", title: ch.title, xLabels: ch.xLabels, series: ch.series, format: ch.format || "currency" }} />
        ))}
        <MfgTableSection section={{ title: "Comps (click a name to open the OTA listing)", columns: open.columns, rows: open.rows }} />
        {section.note && <MfgNoteSection section={{ text: section.note }} />}
      </div>
    );
  }

  return (
    <div>
      {sets.map((s) => (
        <button key={s.id} onClick={() => setOpenId(s.id)} style={{
          ...MFG_CARD, width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          fontFamily: "Inter, sans-serif", padding: "14px 18px",
        }}>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>{s.name}</div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{s.criteria}{s.updated ? ` · updated ${s.updated}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            {(Array.isArray(s.kpis) ? s.kpis : []).map((k) => (
              <div key={k.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{k.value}</div>
              </div>
            ))}
            <span style={{ color: "#1F6FB2", fontWeight: 800, fontSize: 16 }}>→</span>
          </div>
        </button>
      ))}
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

/* ---------------------------------------------------- comp sets */
function MfgCompsetSection({ section }) {
  return (
    <div style={MFG_CARD}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{section.name}</div>
        {section.whUrl && (
          <a href={section.whUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 800, color: "#1F6FB2", textDecoration: "none" }}>Open in Wheelhouse →</a>
        )}
      </div>
      {section.criteria && <div style={{ fontSize: 13, color: T.inkSoft, margin: "6px 0 14px", lineHeight: 1.5 }}>{section.criteria}</div>}
      <MfgSectionTitle>Comps on the OTA</MfgSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, marginBottom: 16 }}>
        {(section.links || []).map((l, i) => l.url ? (
          <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, color: "#1F6FB2", textDecoration: "none" }}>{l.label}</a>
        ) : (
          <div key={i} style={{ border: `1px dashed ${T.line}`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#A9B2BB" }}>{l.label}</div>
        ))}
      </div>
      {section.stats && <MfgTableSection section={{ title: "Wheelhouse data", columns: section.stats.columns, rows: section.stats.rows }} />}
      {section.note && <MfgNoteSection section={{ text: section.note }} />}
    </div>
  );
}

function MfgComingSoon({ text }) {
  return (
    <div style={{
      textAlign: "center", padding: "48px 20px", color: T.inkSoft, fontSize: 13.5,
      background: "#fff", borderRadius: 14, border: `1px dashed ${T.line}`, lineHeight: 1.5,
    }}>{text || "Coming soon — this view is being built."}</div>
  );
}

// Unknown section types are ignored per the contract.
function MfgSection({ section, userEmail }) {
  if (!section || typeof section !== "object") return null;
  if (section.type === "tiles") return <MfgTilesSection section={section} />;
  if (section.type === "chart") return <MfgChartSection section={section} />;
  if (section.type === "table") return <MfgTableSection section={section} />;
  if (section.type === "note") return <MfgNoteSection section={section} />;
  if (section.type === "listingTable") return <MfgListingTableSection section={section} userEmail={userEmail} />;
  if (section.type === "kpiExplorer") return <MfgKpiExplorerSection section={section} />;
  if (section.type === "benchmark") return <MfgBenchmarkSection section={section} />;
  if (section.type === "compset") return <MfgCompsetSection section={section} />;
  if (section.type === "compsetList") return <MfgCompsetListSection section={section} />;
  if (section.type === "reservations") return <MfgReservationsSection section={section} />;
  return null;
}

function MfgClientScreen({ client, isTeam, onSignOut, userEmail }) {
  // ?sample=1 previews the bundled sample document without live data.
  const sample = new URLSearchParams(window.location.search).has("sample");
  const liveDoc = useMfgHubDoc(sample ? null : `mfg-client-${client.id}`);
  const dash = sample ? SAMPLE_DASHBOARD : liveDoc;

  const tabs = Array.isArray(dash?.tabs) ? dash.tabs.filter((t) => t && t.id && t.label) : [];
  const [tabId, setTabId] = useState(null);
  const activeTab = tabs.find((t) => t.id === tabId) || tabs[0] || null;

  const updatedText = typeof dash?.updated === "number"
    ? new Date(dash.updated).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: T.ink, borderBottom: `4px solid ${MFG_RED}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Briefcase size={18} color="#fff" />
              <div>
                <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{client.label}</div>
                <div style={{ color: "#A8BACB", fontSize: 11 }}>Mike Fisher Group · performance dashboard</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {isTeam && (
                <a href="?portal=mfg" style={{ color: "#A8BACB", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>← All clients</a>
              )}
              <button onClick={onSignOut} style={{ border: "none", background: "transparent", color: "#A8BACB", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>Sign out</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 12, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTabId(t.id)} style={{
                border: "none", background: "transparent", cursor: "pointer",
                color: activeTab && t.id === activeTab.id ? "#fff" : "#8FA3B5", padding: "10px 14px 12px",
                fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif",
                borderBottom: `3px solid ${activeTab && t.id === activeTab.id ? MFG_RED : "transparent"}`,
              }}>{t.label}</button>
            ))}
            {tabs.length === 0 && <div style={{ height: 12 }} />}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 20px 60px" }}>
        {dash === undefined && (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0", color: T.inkSoft }}>
            <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}
        {dash === null && (
          <MfgComingSoon text="Dashboard coming soon — your numbers land here once the data feed is live." />
        )}
        {dash && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {sample && (
                <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: T.marigoldDeep, borderRadius: 999, padding: "2px 9px" }}>SAMPLE DATA</span>
              )}
              {updatedText && (
                <span style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600 }}>As of {updatedText}</span>
              )}
            </div>
            {activeTab && activeTab.sections?.length > 0
              ? activeTab.sections.map((s, i) => <MfgSection key={`${activeTab.id}-${i}`} section={s} userEmail={userEmail} />)
              : <MfgComingSoon />}
          </>
        )}
      </div>
    </div>
  );
}

function MFGPortal({ clientParam }) {
  const [user, setUser] = useState(undefined);
  const [roleInfo, setRoleInfo] = useState(undefined);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("company");

  useEffect(() => {
    const unsub = onAuthStateChanged(mfgAuth, (u) => { setUser(u || null); setRoleInfo(undefined); setErr(null); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(mfgDb, "mfgRoles", user.email));
        setRoleInfo(snap.exists() ? snap.data() : null);
      } catch {
        setRoleInfo(null);
      }
    })();
  }, [user]);

  const signOutMfg = () => signOut(mfgAuth);

  if (user === undefined) return <div style={{ minHeight: "100vh", background: T.canvas }} />;
  if (user === null) return <MFGLogin error={err} onError={setErr} />;
  if (roleInfo === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>
        <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }
  if (roleInfo === null) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 6 }}>No access assigned</div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
            You're signed in as {user.email}, but this account hasn't been given a portal role yet.
          </div>
          <button onClick={signOutMfg} style={{ border: "none", background: T.ink, color: "#fff", borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontWeight: 800, fontSize: 13.5, fontFamily: "Inter, sans-serif" }}>Sign out</button>
        </div>
      </div>
    );
  }

  // Client role: their dashboard only, regardless of URL
  if (roleInfo.role === "client") {
    const c = mfgClientOf(roleInfo.clientId);
    if (!c) return <div style={{ padding: 40, fontFamily: "Inter, sans-serif" }}>Client record missing — contact Mike.</div>;
    return <MfgClientScreen client={c} isTeam={false} onSignOut={signOutMfg} userEmail={user.email} />;
  }

  // Team: full portal
  if (clientParam) {
    const c = mfgClientOf(clientParam);
    if (c) return <MfgClientScreen client={c} isTeam onSignOut={signOutMfg} userEmail={user.email} />;
  }

  const tabs = [
    { id: "company", label: "Company Overview" },
    { id: "portfolio", label: "Portfolio Overview" },
    { id: "customers", label: "Customer Dashboards" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: T.ink, borderBottom: `4px solid ${MFG_RED}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Briefcase size={20} color="#fff" />
              <div>
                <div style={{ color: "#fff", fontSize: 19, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Mike Fisher Group</div>
                <div style={{ color: "#A8BACB", fontSize: 11 }}>Signed in as {user.email}</div>
              </div>
            </div>
            <button onClick={signOutMfg} style={{ border: "none", background: "transparent", color: "#A8BACB", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>Sign out</button>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 12, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                border: "none", background: "transparent", cursor: "pointer",
                color: tab === t.id ? "#fff" : "#8FA3B5", padding: "10px 14px 12px",
                fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif",
                borderBottom: `3px solid ${tab === t.id ? MFG_RED : "transparent"}`,
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 20px 60px" }}>
        {tab === "company" && (
          <>
            <div style={{
              background: "#fff", border: `1px solid ${T.line}`, borderLeft: `5px solid ${MFG_RED}`,
              borderRadius: 14, padding: "16px 18px", marginBottom: 14,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: MFG_RED, textTransform: "uppercase", letterSpacing: "0.06em" }}>North star</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginTop: 4, lineHeight: 1.5 }}>
                Gross Profit $ and Gross Margin %, month over month — revenue on a received basis (billed in arrears), minus team salaries.
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
              <MfgKpiTile label="Revenue · this month" hint="received basis — Aug services land in Sep" />
              <MfgKpiTile label="MRR · current month" hint="seasonality-aware" />
              <MfgKpiTile label="Salaries" hint="Aida · Jaimee" />
              <MfgKpiTile label="Gross Profit $" />
              <MfgKpiTile label="Gross Margin %" hint="MoM trend" />
              <MfgKpiTile label="Projected ARR" hint="Jan–Dec received income" />
            </div>
            <MfgShellNote>
              Company engine (contracts → price per listing by volume → MRR → received-basis revenue → GP/GM) is the next build phase.
            </MfgShellNote>
          </>
        )}
        {tab === "portfolio" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <MfgKpiTile label="Portfolio Revenue · 2026 YoY" hint="all clients, aggregated" />
              <MfgKpiTile label="Adjusted RevPAR · YoY" />
              <MfgKpiTile label="WoW Rent Revenue Pickup" />
              <MfgKpiTile label="Next 60 Days Pacing" hint="APO vs LY · vs market" />
              <MfgKpiTile label="Active Listings" hint="across portfolio" />
              <MfgKpiTile label="Clients" hint={`${MFG_CLIENTS.length} active`} />
            </div>
            <MfgShellNote>
              The aggregated story — the numbers for LinkedIn and sales calls — computes from every client's data once the engine is live.
            </MfgShellNote>
          </>
        )}
        {tab === "customers" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
            {MFG_CLIENTS.map((c) => (
              <button
                key={c.id}
                onClick={() => window.open(`${window.location.pathname}?portal=mfg&client=${c.id}`, "_blank")}
                style={{
                  background: "#fff", border: `1px solid ${T.line}`, borderTop: `4px solid ${MFG_RED}`,
                  borderRadius: 14, padding: "18px 16px", cursor: "pointer", textAlign: "left",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{c.label}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: MFG_RED, borderRadius: 999, padding: "2px 9px" }}>{c.abbr}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 700 }}>Open dashboard →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs + App                                                         */
/* ------------------------------------------------------------------ */
const NAV = [
  { id: "home", label: "Home", icon: Fish },
  { id: "plan", label: "4pm Shutdown", icon: ClipboardList },
  { id: "todolist", label: "To Do List", icon: CheckSquare },
  {
    id: "financials", label: "Financials", icon: Wallet, children: [
      { id: "fin-overview", label: "Overview" },
      { id: "fin-157", label: "157 King Phillips Path" },
      { id: "fin-66", label: "66 Telegraph St" },
      { id: "fin-mfg", label: "Mike Fisher Group" },
      { id: "fin-expenses", label: "Expense Management" },
    ],
  },
  { id: "accounts", label: "Accounts", icon: KeyRound },
];

function NavBar({ tab, setTab, wide }) {
  const [openMenu, setOpenMenu] = useState(null);
  const childOf = (item) => item.children && item.children.some((c) => c.id === tab);

  return (
    <div style={{ display: "flex", gap: wide ? 4 : 2, marginTop: 18, position: "relative", flexWrap: "wrap" }}>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = item.children ? childOf(item) : tab === item.id;
        const base = {
          border: "none", cursor: "pointer", background: "transparent",
          color: active ? "#fff" : "#8FA3B5",
          padding: wide ? "12px 16px 14px" : "11px 10px 13px",
          fontSize: wide ? 14.5 : 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
          display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
          borderBottom: `3px solid ${active ? T.marigold : "transparent"}`,
          transition: "color .15s ease",
        };

        if (!item.children) {
          return (
            <button key={item.id} onClick={() => { setOpenMenu(null); setTab(item.id); }} style={base}>
              <Icon size={16} />
              {item.label}
            </button>
          );
        }

        const isOpen = openMenu === item.id;
        return (
          <div
            key={item.id}
            style={{ position: "relative" }}
            onMouseEnter={() => wide && setOpenMenu(item.id)}
            onMouseLeave={() => wide && setOpenMenu(null)}
          >
            <button
              onClick={() => {
                if (wide) { setTab(item.children[0].id); setOpenMenu(null); }
                else setOpenMenu(isOpen ? null : item.id);
              }}
              style={base}
            >
              <Icon size={16} />
              {item.label}
              <ChevronDown size={13} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
            {isOpen && wide && (
              <div style={{
                position: "absolute", top: "100%", left: 0, zIndex: 50,
                background: T.card, border: `1px solid ${T.line}`, borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,49,87,0.15)", padding: 6, minWidth: 220,
              }}>
                {item.children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setTab(c.id); setOpenMenu(null); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      border: "none", background: tab === c.id ? T.skySoft : "transparent",
                      color: tab === c.id ? T.ink : T.inkSoft,
                      borderRadius: 8, padding: "9px 12px", fontSize: 13.5, fontWeight: 600,
                      cursor: "pointer", fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {isOpen && !wide && (
              <div style={{
                position: "absolute", top: "100%", left: 0, zIndex: 50,
                background: T.card, border: `1px solid ${T.line}`, borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,49,87,0.2)", padding: 6, minWidth: 210,
              }}>
                {item.children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setTab(c.id); setOpenMenu(null); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      border: "none", background: tab === c.id ? T.skySoft : "transparent",
                      color: tab === c.id ? T.ink : T.inkSoft,
                      borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontWeight: 600,
                      cursor: "pointer", fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <a
        href="?portal=mfg"
        target="_blank"
        rel="noreferrer"
        title="Mike Fisher Group — opens in a new tab with its own login"
        style={{
          marginLeft: wide ? "auto" : 0,
          color: "#FF6B72", textDecoration: "none",
          padding: wide ? "12px 16px 14px" : "11px 10px 13px",
          fontSize: wide ? 14.5 : 13, fontWeight: 800, fontFamily: "Inter, sans-serif",
          display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
          borderBottom: "3px solid transparent",
        }}
      >
        <Briefcase size={16} />
        Mike Fisher Group
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

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

const PORTAL_PARAMS = new URLSearchParams(window.location.search);
const IS_MFG_PORTAL = PORTAL_PARAMS.get("portal") === "mfg";

export default function App() {
  if (IS_MFG_PORTAL) {
    return <MFGPortal clientParam={PORTAL_PARAMS.get("client")} />;
  }
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
  const contentWidth = wide
    ? (tab === "home" || tab.startsWith("fin-") || tab === "todolist" ? 1100 : tab === "plan" ? 1040 : 860)
    : 640;

  return (
    <div id="screen-root" style={{ minHeight: "100vh", background: T.canvas, fontFamily: "Inter, sans-serif" }}>
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

          <NavBar tab={tab} setTab={setTab} wide={wide} />
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: contentWidth, margin: "0 auto", padding: "20px 16px 60px", transition: "max-width .2s ease" }}>
        {tab === "home" && <HomeTab me={me} meMatch={meMatch} members={members} onGoTab={setTab} wide={wide} />}
        {tab === "plan" && <PlanTab meMatch={meMatch} meName={me} wide={wide} onGoTab={setTab} />}
        {tab === "todolist" && <TodoListPage wide={wide} />}
        {tab.startsWith("fin-") && <FinancialsPage sub={tab} />}
        {tab === "accounts" && <AccountsTab />}
      </div>
    </div>
  );
}

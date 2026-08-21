import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart, UtensilsCrossed, CheckSquare, Plane, Plus,
  ThumbsUp, MessageCircle, Trash2, Send, Loader2, ChevronDown,
  Fish, RefreshCw, Camera, CornerDownRight, Sun, ArrowRight, LogOut,
  Dumbbell, Droplet, Apple, Target, Moon, Heart, Flame,
  Power, ClipboardList, Star, Printer, Wallet, KeyRound, ExternalLink, GripVertical,
} from "lucide-react";
import { auth, db, configured } from "./lib/firebase.js";
import * as appConfig from "./firebase-config.js";
const familyEmail = appConfig.familyEmail;
const googleClientId = appConfig.googleClientId || null;
import { HUB_EMAIL } from "./firebase-config.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, deleteDoc, getDoc } from "firebase/firestore";

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
const TD_CATS = [
  { id: "bearcamp", label: "Bear Camp Cabin Rentals", abbr: "BCCR", color: "#2F6D54" },
  { id: "panhandle", label: "Panhandle Getaways", abbr: "PHG", color: "#2F6D54" },
  { id: "killington", label: "The Killington Group", abbr: "TKG", color: "#2F6D54" },
  { id: "kauai", label: "Kauai Real Estate Group", abbr: "KREG", color: "#2F6D54" },
  { id: "nashville", label: "Nashville Vacation Homes", abbr: "NVH", color: "#2F6D54" },
  { id: "haller", label: "Haller Vacation Rentals", abbr: "HVR", color: "#2F6D54" },
  { id: "newwave", label: "New Wave Vacation Rentals", abbr: "NW", color: "#2F6D54" },
  { id: "heights", label: "The Heights Hotel", abbr: "THH", color: "#2F6D54" },
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
/*  Google Calendar (read-only, Mike's device)                         */
/* ------------------------------------------------------------------ */
let gisPromise = null;
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Google sign-in"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

function getStoredGToken() {
  try {
    const t = JSON.parse(localStorage.getItem("gcal_token"));
    if (t && t.expiry > Date.now() + 60000) return t;
  } catch { /* none */ }
  return null;
}

async function requestGToken(silent) {
  await loadGis();
  return new Promise((resolve, reject) => {
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        const tok = {
          access_token: resp.access_token,
          expiry: Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000,
        };
        localStorage.setItem("gcal_token", JSON.stringify(tok));
        localStorage.setItem("gcal_connected", "1");
        resolve(tok);
      },
      error_callback: (e) => reject(new Error((e && e.message) || "Google sign-in was closed")),
    });
    tc.requestAccessToken({ prompt: silent ? "" : "consent" });
  });
}

async function ensureGToken(interactive) {
  const t = getStoredGToken();
  if (t) return t;
  if (interactive) return requestGToken(false);
  if (localStorage.getItem("gcal_connected")) {
    try { return await requestGToken(true); } catch { return null; }
  }
  return null;
}

function CalendarCard({ dateKey, title, bare }) {
  const [state, setState] = useState({ status: "loading", events: [] });

  const load = useCallback(async (interactive) => {
    if (!googleClientId) { setState({ status: "unconfigured", events: [] }); return; }
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const tok = await ensureGToken(interactive);
      if (!tok) { setState({ status: "disconnected", events: [] }); return; }
      const [y, m, d] = dateKey.split("-").map(Number);
      const start = new Date(y, m - 1, d);
      const end = new Date(y, m - 1, d + 1);
      const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
        + "?singleEvents=true&orderBy=startTime&maxResults=15"
        + `&timeMin=${encodeURIComponent(start.toISOString())}`
        + `&timeMax=${encodeURIComponent(end.toISOString())}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${tok.access_token}` } });
      if (resp.status === 401 || resp.status === 403) {
        localStorage.removeItem("gcal_token");
        setState({ status: "disconnected", events: [] });
        return;
      }
      if (!resp.ok) throw new Error(`calendar service ${resp.status}`);
      const data = await resp.json();
      setState({ status: "ok", events: data.items || [] });
    } catch (e) {
      setState({ status: "error", events: [], err: e.message });
    }
  }, [dateKey]);

  useEffect(() => { load(false); }, [load]);

  if (state.status === "unconfigured") return null;

  const card = bare ? {} : {
    background: T.card, borderRadius: 14, padding: "14px 16px",
    border: `1px solid ${T.line}`, marginBottom: 14,
  };

  return (
    <div style={card}>
      {!bare && <SectionTitle>{title}</SectionTitle>}
      {state.status === "loading" && (
        <div style={{ color: T.inkSoft, fontSize: 13.5 }}>Checking the calendar…</div>
      )}
      {state.status === "disconnected" && (
        <div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 10 }}>
            Connect your Google Calendar to see the day's events here. Read-only — the hub can look, never touch.
          </div>
          <button
            onClick={() => load(true)}
            style={{
              border: "none", background: T.marigold, color: T.ink, borderRadius: 10,
              padding: "9px 16px", cursor: "pointer", fontWeight: 800, fontSize: 13.5,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Connect Google Calendar
          </button>
        </div>
      )}
      {state.status === "error" && (
        <div style={{ fontSize: 13, color: T.coral, lineHeight: 1.5 }}>
          Calendar hiccup ({state.err}).{" "}
          <button onClick={() => load(true)} style={{ border: "none", background: "transparent", color: T.coral, cursor: "pointer", fontWeight: 800, padding: 0, textDecoration: "underline", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
            Try again
          </button>
        </div>
      )}
      {state.status === "ok" && (
        state.events.length === 0 ? (
          <div style={{ fontSize: 13.5, color: T.inkSoft }}>Nothing on the calendar — a clear runway.</div>
        ) : (
          state.events.map((ev) => {
            const timed = ev.start && ev.start.dateTime;
            const label = timed
              ? new Date(ev.start.dateTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
              : "All day";
            return (
              <div key={ev.id} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 8, padding: "4px 0", alignItems: "start" }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: T.marigoldDeep, paddingTop: 2, whiteSpace: "nowrap" }}>{label}</span>
                <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.45 }}>{ev.summary || "(no title)"}</span>
              </div>
            );
          })
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Today's schedule — everything today, in order, checkable          */
/* ------------------------------------------------------------------ */
function TodaySchedule({ view, setView, onGoTab }) {
  const todayKey = localDateKey();
  const [planDoc, savePlan] = useHubDoc(`plan-${todayKey}`);
  const [templateDoc] = useHubDoc("template");
  const [routineDoc, saveRoutine] = useHubDoc("routine");
  const [winsDoc, saveWins] = useHubDoc("daywins");
  const weekend = isWeekendKey(todayKey);

  const card = {
    background: T.card, borderRadius: 14, padding: "14px 16px",
    border: `1px solid ${T.line}`, marginBottom: 14,
  };

  const p = { ...EMPTY_PLAN, ...((planDoc || {})[view] || {}) };
  const anchors = anchorsFor(templateDoc, view);
  const wrapup = wrapupFor(templateDoc, view);
  const personHabits = habitsFor(templateDoc, view);
  const hasHabit = (id) => personHabits.some((h) => h.id === id);
  const w1 = (p.w1 || []).filter((l) => l && l.trim());
  const w2 = (p.w2 || []).filter((l) => l && l.trim());
  const fun = (p.fun || []).filter((l) => l && l.trim());
  const pris = getPriorities(p);
  const hasPlan = w1.length > 0 || (weekend ? fun.length > 0 : pris.length > 0);

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
    if (which === "w1" && hasHabit("exercise") && lines.every((_, k) => (k === idx ? doneArr[idx] : doneArr[k]))) {
      setHabit("exercise", true);
    }
  };

  // Progress across everything checkable (work items only on weekdays)
  const items = [];
  w1.forEach((_, i) => items.push(!!(p.w1done || [])[i]));
  anchors.forEach((_, i) => items.push(!!(p.anchorsDone || {})[i]));
  if (!weekend) {
    pris.forEach((x) => items.push(!!x.done));
    p.blocks.forEach((b, i) => { if (b && b.trim()) items.push(!!p.blocksDone[i]); });
    wrapup.forEach((_, i) => items.push(!!(p.wrapupDone || {})[i]));
  } else {
    fun.forEach((_, i) => items.push(!!(p.fundone || [])[i]));
  }
  w2.forEach((_, i) => items.push(!!(p.w2done || [])[i]));
  if ((planDoc || {}).dinner) items.push(!!(planDoc || {}).dinnerDone);
  if (hasHabit("family")) items.push((rToday.family || 0) > 0);
  if (hasHabit("bed")) items.push((rToday.bed || 0) > 0);
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
      {!weekend && (pris.length > 0 || p.blocks.some((b) => b && b.trim())) && (
        <>
          <div style={divider} />
          <TimeRow time="9:00 AM">
            <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, paddingTop: 8 }}>Priority list (9:00–3:30)</div>
            {pris.map((it, i) => {
              const toggle = () => {
                const next = pris.map((x) => x.id === it.id ? { ...x, done: !x.done } : x);
                setPerson({ ...p, priorities: next });
              };
              if (i === 0) {
                return (
                  <div key={it.id} style={{
                    background: "#FDF6E7", border: `1px solid ${T.marigold}`,
                    borderRadius: 10, padding: "4px 10px 2px", margin: "4px 0 6px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 800, color: T.marigoldDeep, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      <Star size={11} fill={T.marigold} color={T.marigold} /> Defines today
                    </div>
                    <CheckRow big done={!!it.done} label={it.text} onToggle={toggle} />
                  </div>
                );
              }
              return <CheckRow key={it.id} done={!!it.done} label={`${i + 1}. ${it.text}`} onToggle={toggle} />;
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

      {/* Evening habits, wired to the routine tracker (shown only if in that person's routine) */}
      {hasHabit("family") && (
        <TimeRow time="6:00 PM">
          <CheckRow
            done={(rToday.family || 0) > 0}
            label="Family time — phone away"
            onToggle={() => setHabit("family", !((rToday.family || 0) > 0))}
          />
        </TimeRow>
      )}
      {hasHabit("bed") && (
        <TimeRow time="9:15 PM">
          <CheckRow
            done={(rToday.bed || 0) > 0}
            label="In bed — tomorrow starts tonight"
            onToggle={() => setHabit("bed", !((rToday.bed || 0) > 0))}
          />
        </TimeRow>
      )}

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
  const pris = getPriorities(p);
  const blocks = p.blocks.filter((b) => b && b.trim());
  const dinner = (planDoc || {}).dinner;
  const any = w1.length || w2.length || fun.length || pris.length || blocks.length || dinner;

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
        <SectionTitle>Tomorrow's snapshot — {weekdayOf(1)} · {meMatch === "tina" ? "Tina" : "Mike"}</SectionTitle>
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
          {pris.length > 0 && (
            <Row label="Priorities">
              {pris.map((it, i) => (
                <span key={it.id} style={{ display: "block", fontWeight: i === 0 ? 800 : 500 }}>
                  {i === 0
                    ? <Star size={11} fill={T.marigold} color={T.marigold} style={{ marginRight: 4, verticalAlign: "-1px" }} />
                    : <span style={{ color: T.inkSoft, marginRight: 4 }}>{i + 1}.</span>}
                  {it.text}
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
    border: `1px solid ${T.line}`, borderLeft: `5px solid ${accent}`,
    marginBottom: wide ? 0 : 14,
  });
  const PlanHead = ({ n, accent, time, children }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
      <span style={{
        width: 24, height: 24, borderRadius: "50%", background: accent, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 12.5, fontWeight: 800, fontFamily: "Inter, sans-serif", flexShrink: 0,
      }}>{n}</span>
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
          The 3:30 shutdown
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
          <button
            onClick={() => window.print()}
            title="Print this day's plan"
            style={{
              border: `1.5px solid ${T.line}`, background: T.card, color: T.ink,
              borderRadius: 999, padding: "5px 13px", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "Inter, sans-serif",
              display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 6,
            }}
          >
            <Printer size={14} /> Print
          </button>
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

        {/* 1 · Close out today — full width */}
        {!todayWeekend && (
          <div style={{ ...psec(T.ink), ...span2 }}>
            <PlanHead n="1" accent={T.ink} time="NOW">Close out today</PlanHead>
            <div style={wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px", alignItems: "start" } : undefined}>
              <CheckRow
                done={prep.inbox} label="Inbox, Slack & texts cleared" sub="Two-minute replies sent, the rest captured on the To Do List"
                onToggle={() => { const next = { ...prep, inbox: !prep.inbox }; setPrep(next); persist({ person: { prep: next } }); }}
              />
              <CheckRow
                done={prep.todos} label="To Do List updated" sub="Carryovers + new tasks from today's meetings"
                onToggle={() => { const next = { ...prep, todos: !prep.todos }; setPrep(next); persist({ person: { prep: next } }); }}
              />
            </div>
            <button
              onClick={() => onGoTab("todolist")}
              style={{
                marginTop: 6, border: "none", background: "transparent", color: T.marigoldDeep,
                cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0,
                display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "Inter, sans-serif",
              }}
            >
              Open the To Do List <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* 2 · Workout #1 */}
        <div style={psec(T.leaf)}>
          <PlanHead n="2" accent={T.leaf} time="5:00 AM">Workout #1</PlanHead>
          <div style={noteS}>Written down tonight = no 5am decisions. Enter jumps to the next line.</div>
          <WorkoutLines lines={w1} setLines={setW1} onBlur={() => persist()} placeholder="e.g. 5x5 back squat" />
        </div>

        {/* 3 · Calendar for the target day */}
        {meMatch === "mike" && (
          <div style={psec("#33608A")}>
            <PlanHead n="3" accent="#33608A">On the calendar — {weekdayOf(offset)}</PlanHead>
            <CalendarCard dateKey={dateKey} title="" bare />
          </div>
        )}

        {/* 4 · Priority list (weekdays) or Fun (weekends) — full width, vertical */}
        {targetWeekend ? (
          <div style={{ ...psec(T.marigold), ...span2, background: "#FFFDF8" }}>
            <PlanHead n="4" accent={T.marigold} time="DAYTIME">Plans &amp; family fun</PlanHead>
            <div style={noteS}>What's happening {weekdayOf(offset)}? One line each — outings, projects, or just "backyard morning".</div>
            <WorkoutLines lines={fun} setLines={setFun} onBlur={() => persist()} placeholder="e.g. Farmers market + playground" />
          </div>
        ) : (
          <div style={{ ...psec(T.marigold), ...span2, background: "#FFFDF8" }}>
            <PlanHead n="4" accent={T.marigold} time="9:00–3:30">Priority list</PlanHead>
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
            <div style={{ borderTop: `1px dashed ${T.line}`, margin: "16px 0 12px" }} />
            <div style={wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" } : undefined}>
              <div>
                <div style={{ ...labelS, marginTop: 0 }}>Deep block 1 will produce…</div>
                <input
                  value={blocks[0]}
                  onChange={(e) => setBlocks([e.target.value, blocks[1]])}
                  onBlur={() => persist()}
                  placeholder="e.g. Q3 proposal draft sent to client"
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={{ ...labelS, marginTop: wide ? 0 : 14 }}>Deep block 2 will produce…</div>
                <input
                  value={blocks[1]}
                  onChange={(e) => setBlocks([blocks[0], e.target.value])}
                  onBlur={() => persist()}
                  placeholder="e.g. Retainer report for client B done"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        )}

        {/* 5 · Workout #2 */}
        <div style={psec(T.leaf)}>
          <PlanHead n="5" accent={T.leaf} time="4:00 PM">Workout #2</PlanHead>
          <WorkoutLines lines={w2} setLines={setW2} onBlur={() => persist()} placeholder="e.g. 20 min bike + core" />
        </div>

        {/* 6 · Dinner */}
        <div style={psec(T.coral)}>
          <PlanHead n="6" accent={T.coral} time="4:45 PM">Family dinner</PlanHead>
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

      <PrintSheet
        dateKey={dateKey} weekend={targetWeekend}
        anchors={anchors} wrapup={wrapup}
        priorities={priorities} blocks={blocks}
        w1={w1} w2={w2} fun={fun} dinner={dinner}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Home page                                                          */
/* ------------------------------------------------------------------ */
function HomeTab({ me, meMatch, members, onGoTab, wide }) {
  const dateKey = localDateKey();
  const todayName = DAYS[(new Date().getDay() + 6) % 7];
  const [schedView, setSchedView] = useState(meMatch);

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
      <TodaySchedule view={schedView} setView={setSchedView} onGoTab={onGoTab} />

      {meMatch === "mike" && schedView === "mike" && (
        <CalendarCard dateKey={dateKey} title="Today's calendar" />
      )}

      <TomorrowSnapshot meMatch={schedView} onGoTab={onGoTab} />
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
/*  Printable daily plan sheet (hidden on screen, shown when printing) */
/* ------------------------------------------------------------------ */
function PrintSheet({ dateKey, weekend, anchors, wrapup, priorities, blocks, w1, w2, fun, dinner }) {
  const box = {
    display: "inline-block", width: 12, height: 12, border: "1.4px solid #003157",
    borderRadius: 3, marginRight: 9, verticalAlign: "-2px", flexShrink: 0,
  };
  const timeS = { display: "inline-block", width: 62, fontSize: 10, fontWeight: 800, color: "#9C721E" };
  const rowS = { padding: "3.5px 0", fontSize: 12, color: "#003157", fontFamily: "Arial, sans-serif" };
  const line = (extra) => <span style={{ display: "inline-block", borderBottom: "1px solid #C9CFD6", minWidth: extra || 300 }}>&nbsp;</span>;
  const Row = ({ t, children }) => (
    <div style={rowS}><span style={timeS}>{t}</span><span style={box} />{children}</div>
  );
  const Sub = ({ children }) => (
    <div style={{ ...rowS, paddingLeft: 62 }}><span style={box} />{children}</div>
  );
  const Head = ({ children }) => (
    <div style={{ fontSize: 9.5, fontWeight: 800, color: "#5F6B78", letterSpacing: "0.06em", margin: "8px 0 2px 62px", fontFamily: "Arial, sans-serif" }}>{children}</div>
  );

  const cleanW1 = (w1 || []).filter((l) => l && l.trim());
  const cleanW2 = (w2 || []).filter((l) => l && l.trim());
  const cleanFun = (fun || []).filter((l) => l && l.trim());
  const pris = (priorities || []).filter((x) => x.text && x.text.trim());

  return (
    <div id="print-sheet" style={{ maxWidth: 660, margin: "0 auto", padding: "8px 6px" }}>
      <div style={{ background: "#003157", borderRadius: 10, padding: "14px 18px", marginBottom: 12 }}>
        <div style={{ color: "#fff", fontSize: 19, fontWeight: 800, fontFamily: "Arial, sans-serif" }}>
          🐠 Fisher Family Hub — Daily Plan
        </div>
        <div style={{ color: "#A8BACB", fontSize: 10.5, marginTop: 3, fontFamily: "Arial, sans-serif" }}>
          {weekdayOf(0) === fmtDateKey(dateKey).split(",")[0] ? "" : ""}{fmtDateKey(dateKey)} · every check is a vote for the person you're becoming
        </div>
      </div>

      <Row t="4:45 AM">Wake up — no snooze, feet on the floor, lights on</Row>
      {cleanW1.length > 0 && <Head>WORKOUT #1 (5:00 AM)</Head>}
      {cleanW1.map((l, i) => <Sub key={i}>{l}</Sub>)}
      {anchors.map((a, i) => <Row key={i} t={a.t}>{a.label}</Row>)}

      {!weekend && (
        <>
          <Head>PRIORITY LIST (9:00–3:30) — ★ defines the day</Head>
          {pris.length === 0 && <Sub>{line(420)}</Sub>}
          {pris.map((it, i) => (
            <Sub key={it.id}>{i === 0 ? <strong>★ {it.text}</strong> : <>{i + 1}. {it.text}</>}</Sub>
          ))}
          {(blocks[0] || blocks[1]) && <Head>DEEP BLOCKS</Head>}
          {blocks.map((b, i) => b && b.trim() && <Sub key={i}><em>Block {i + 1}:</em>&nbsp;{b}</Sub>)}
          {wrapup.map((a, i) => <Row key={"wu" + i} t={a.t}>{a.label}</Row>)}
        </>
      )}
      {weekend && cleanFun.length > 0 && (
        <>
          <Head>PLANS &amp; FAMILY FUN</Head>
          {cleanFun.map((l, i) => <Sub key={i}>{l}</Sub>)}
        </>
      )}

      {cleanW2.length > 0 && <Head>WORKOUT #2 (4:00 PM)</Head>}
      {cleanW2.map((l, i) => <Sub key={i}>{l}</Sub>)}

      <Row t="4:45 PM">Start dinner{dinner ? <>: <strong>{dinner}</strong></> : <>: {line(260)}</>}</Row>
      <Row t="5:30 PM">Dinner together — kids home by 5:15</Row>
      <Row t="6:00 PM"><strong>Family time — phone away</strong></Row>
      <Row t="7:30 PM">Start bedtime routine</Row>
      <Row t="8:45 PM">Kids asleep — reset house, lay out workout clothes</Row>
      <Row t="9:15 PM"><strong>In bed</strong> — tomorrow starts tonight</Row>
      <Row t="9:30 PM">Asleep</Row>

      <div style={{ marginTop: 12, background: "#F4F5F7", borderRadius: 8, padding: "9px 14px", fontSize: 11, fontWeight: 700, color: "#003157", fontFamily: "Arial, sans-serif" }}>
        Score: {line(36)} % done &nbsp;&nbsp; Streak at 100%: {line(36)} days
        <span style={{ float: "right", fontWeight: 400, fontStyle: "italic", color: "#5F6B78" }}>Hard stop at 4:00. The evening is yours. 🐠</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  To Do List — the capture pool that feeds the Priority List         */
/* ------------------------------------------------------------------ */
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

  const removeItem = (id) => persist({ items: items.filter((x) => x.id !== id) });

  const moveToPL = async (item, dateKey) => {
    try {
      const ref = doc(db, "hub", `plan-${dateKey}`);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      const p = { ...EMPTY_PLAN, ...(data[me] || {}) };
      const priorities = [...getPriorities(p), { id: item.id, text: item.text, cat: item.cat, done: false }];
      await setDoc(ref, { ...data, [me]: { ...p, priorities } });
      persist({ items: items.filter((x) => x.id !== item.id) });
      setMovingId(null);
      setToast(`Moved to ${fmtDateKey(dateKey)} ✓`);
      setTimeout(() => setToast(null), 2600);
    } catch (e) {
      setToast(`Couldn't move it (${e.message})`);
      setTimeout(() => setToast(null), 3500);
    }
  };

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
        Capture everything here, free of dates. When something's ready to actually happen,
        hit <strong style={{ color: T.ink }}>→ PL</strong> and pick its day — it moves onto that day's Priority List.
        Tap a block's name for running notes.
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

              {catItems.map((it) => (
                <div key={it.id} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14.5, color: T.ink, lineHeight: 1.4, overflowWrap: "anywhere" }}>{it.text}</span>
                    <button
                      onClick={() => { setMovingId(movingId === it.id ? null : it.id); setMoveDate(dateKeyOffset(1)); }}
                      title="Move to a day's Priority List"
                      style={{
                        border: `1.5px solid ${cat.color}`, background: movingId === it.id ? cat.color : "transparent",
                        color: movingId === it.id ? "#fff" : cat.color,
                        borderRadius: 8, padding: "3px 9px", fontSize: 12, fontWeight: 800,
                        cursor: "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
                      }}
                    >
                      → PL
                    </button>
                    <button
                      onClick={() => removeItem(it.id)}
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
                        onClick={() => moveDate && moveToPL(it, moveDate)}
                        style={{
                          border: "none", background: T.marigold, color: T.ink, borderRadius: 8,
                          padding: "7px 13px", cursor: "pointer", fontWeight: 800, fontSize: 12.5, fontFamily: "Inter, sans-serif",
                        }}
                      >Move</button>
                      <button
                        onClick={() => setMovingId(null)}
                        style={{ border: "none", background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif" }}
                      >cancel</button>
                    </div>
                  )}
                </div>
              ))}

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
/*  Tabs + App                                                         */
/* ------------------------------------------------------------------ */
const NAV = [
  { id: "home", label: "Home", icon: Fish },
  {
    id: "planning", label: "Planning", icon: ClipboardList, children: [
      { id: "plan", label: "The 3:30 Shutdown" },
      { id: "todolist", label: "To Do List" },
    ],
  },
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
      #print-sheet { display: none; }
      @media print {
        body { background: #fff !important; }
        #screen-root { display: none !important; }
        #print-sheet { display: block !important; }
      }
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

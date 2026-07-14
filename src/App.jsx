import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingCart, UtensilsCrossed, CheckSquare, Plane, Plus,
  ThumbsUp, MessageCircle, Trash2, Send, Loader2, ChevronDown,
  Fish, RefreshCw, Camera, CornerDownRight, Sun, ArrowRight, LogOut,
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

function ReactionButton({ count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        border: `1.5px solid ${active ? T.leaf : T.line}`,
        background: active ? T.leafSoft : "transparent",
        color: active ? T.leaf : T.inkSoft,
        borderRadius: 999, padding: "4px 10px", cursor: "pointer",
        fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
        transition: "all .15s ease",
      }}
    >
      <ThumbsUp size={14} />
      {count > 0 && <span>{count}</span>}
    </button>
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
/*  Comment thread                                                     */
/* ------------------------------------------------------------------ */
function CommentThread({ comments = [], me, members, onAdd }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  };
  return (
    <div style={{ marginTop: 10, borderTop: `1px dashed ${T.line}`, paddingTop: 10 }}>
      {comments.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <Avatar name={c.author} color={members[c.author]} size={22} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>
              {c.author}
              <span style={{ fontWeight: 400, marginLeft: 6 }}>
                {new Date(c.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.4 }}>{c.text}</div>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={`Reply as ${me}…`}
          style={{
            flex: 1, border: `1.5px solid ${T.line}`, borderRadius: 10,
            padding: "7px 10px", fontSize: 14, fontFamily: "Inter, sans-serif",
            outline: "none", background: "#FAFBFC", color: T.ink,
          }}
        />
        <button
          onClick={submit}
          style={{
            border: "none", background: T.ink, color: "#fff", borderRadius: 10,
            width: 36, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Generic item card                                                  */
/* ------------------------------------------------------------------ */
function ItemCard({ item, me, members, onToggleDone, onReact, onComment, onDelete, showCheckbox }) {
  const [open, setOpen] = useState(false);
  const ups = Object.values(item.reactions || {}).filter((r) => r === "up").length;
  const mine = (item.reactions || {})[me];

  return (
    <div
      style={{
        background: T.card, borderRadius: 14, padding: "12px 14px",
        border: `1px solid ${T.line}`, marginBottom: 10,
        opacity: item.done ? 0.55 : 1, transition: "opacity .2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {showCheckbox && (
          <button
            onClick={onToggleDone}
            aria-label={item.done ? "Mark not done" : "Mark done"}
            style={{
              width: 22, height: 22, borderRadius: 7, marginTop: 2,
              border: `2px solid ${item.done ? T.leaf : T.line}`,
              background: item.done ? T.leaf : "transparent",
              color: "#fff", cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800,
            }}
          >
            {item.done ? "✓" : ""}
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15, fontWeight: 600, color: T.ink, lineHeight: 1.35,
              textDecoration: item.done ? "line-through" : "none",
              overflowWrap: "break-word",
            }}
          >
            {item.text}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Avatar name={item.author} color={members[item.author]} size={16} />
            <span style={{ fontSize: 12, color: T.inkSoft }}>
              {item.author} · {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        </div>
        <button
          onClick={onDelete}
          aria-label="Delete item"
          style={{
            border: "none", background: "transparent", color: T.coral,
            cursor: "pointer", padding: 4, borderRadius: 8, flexShrink: 0,
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        <ReactionButton count={ups} active={mine === "up"} onClick={() => onReact("up")} />
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            border: `1.5px solid ${T.line}`, background: open ? T.skySoft : "transparent",
            color: open ? T.sky : T.inkSoft, borderRadius: 999, padding: "4px 10px",
            cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
          }}
        >
          <MessageCircle size={14} />
          {(item.comments || []).length > 0 ? (item.comments || []).length : "Discuss"}
        </button>
      </div>

      {open && (
        <CommentThread comments={item.comments} me={me} members={members} onAdd={onComment} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Generic list tab (groceries / todos / travel) — live synced        */
/* ------------------------------------------------------------------ */
function ListTab({ docId, me, members, placeholder, showCheckbox, emptyCopy }) {
  const [data, save] = useHubDoc(docId);
  const [draft, setDraft] = useState("");
  const items = data === undefined ? null : (data?.items || []);

  const persist = (next) => save({ items: next });

  const addItem = () => {
    const t = draft.trim();
    if (!t || items === null) return;
    setDraft("");
    persist([{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: t, author: me, createdAt: Date.now(),
      done: false, reactions: {}, comments: [],
    }, ...items]);
  };

  const update = (id, fn) => persist(items.map((it) => (it.id === id ? fn(it) : it)));

  if (items === null) return <Spinner />;

  const active = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const renderItem = (it) => (
    <ItemCard
      key={it.id} item={it} me={me} members={members} showCheckbox={showCheckbox}
      onToggleDone={() => update(it.id, (x) => ({ ...x, done: !x.done }))}
      onReact={() => update(it.id, (x) => {
        const r = { ...(x.reactions || {}) };
        if (r[me] === "up") delete r[me]; else r[me] = "up";
        return { ...x, reactions: r };
      })}
      onComment={(text) => update(it.id, (x) => ({
        ...x, comments: [...(x.comments || []), { author: me, text, ts: Date.now() }],
      }))}
      onDelete={() => persist(items.filter((x) => x.id !== it.id))}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder={placeholder}
          style={{
            flex: 1, border: `1.5px solid ${T.line}`, borderRadius: 12,
            padding: "11px 14px", fontSize: 15, fontFamily: "Inter, sans-serif",
            outline: "none", background: T.card, color: T.ink,
          }}
        />
        <button
          onClick={addItem}
          style={{
            border: "none", background: T.marigold, color: T.ink,
            borderRadius: 12, padding: "0 16px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            fontWeight: 700, fontSize: 14, fontFamily: "Inter, sans-serif",
          }}
        >
          <Plus size={17} /> Add
        </button>
      </div>

      {items.length === 0 && (
        <div style={{
          textAlign: "center", padding: "44px 20px", color: T.inkSoft,
          fontSize: 14, background: T.card, borderRadius: 14, border: `1px dashed ${T.line}`,
        }}>
          {emptyCopy}
        </div>
      )}

      {active.map(renderItem)}

      {done.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: T.inkSoft,
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
          }}>
            Done ({done.length})
          </div>
          {done.map(renderItem)}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dinner week tab — live synced                                      */
/* ------------------------------------------------------------------ */
function DinnerTab({ me, members }) {
  const [data, save] = useHubDoc("dinners");
  const [openDay, setOpenDay] = useState(null);
  const [drafts, setDrafts] = useState({});
  const week = data === undefined ? null : (data?.days || {});

  if (week === null) return <Spinner />;

  const persist = (next) => save({ days: next });
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Plan the week's dinners together. Tap a day to set the meal, react, or discuss.
      </div>
      {DAYS.map((day, i) => {
        const d = week[day] || { meal: "", setBy: null, reactions: {}, comments: [] };
        const isOpen = openDay === day;
        const ups = Object.values(d.reactions || {}).filter((r) => r === "up").length;
        const mine = (d.reactions || {})[me];
        const isToday = i === todayIdx;
        const saveDay = (fn) => persist({ ...week, [day]: fn(d) });

        return (
          <div
            key={day}
            style={{
              background: T.card, borderRadius: 14, marginBottom: 10,
              border: `1px solid ${isToday ? T.marigold : T.line}`,
              boxShadow: isToday ? `0 0 0 2px ${T.marigold}33` : "none",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setOpenDay(isOpen ? null : day)}
              style={{
                width: "100%", border: "none", background: "transparent",
                padding: "13px 14px", cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 10,
                fontFamily: "Inter, sans-serif",
              }}
            >
              <div style={{ width: 84, flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: isToday ? T.marigoldDeep : T.ink }}>
                  {day.slice(0, 3)}
                  {isToday && <span style={{ fontSize: 10, marginLeft: 5, fontWeight: 800, color: T.red }}>TODAY</span>}
                </div>
              </div>
              <div style={{ flex: 1, fontSize: 15, color: d.meal ? T.ink : T.inkSoft, fontWeight: d.meal ? 600 : 400 }}>
                {d.meal || "Nothing planned yet"}
              </div>
              {(d.comments || []).length > 0 && (
                <span style={{ fontSize: 12, color: T.sky, display: "flex", alignItems: "center", gap: 3 }}>
                  <MessageCircle size={13} /> {(d.comments || []).length}
                </span>
              )}
              {ups > 0 && <span style={{ fontSize: 12, color: T.leaf }}>👍{ups}</span>}
              <ChevronDown size={16} color={T.inkSoft} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>

            {isOpen && (
              <div style={{ padding: "0 14px 14px" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <input
                    value={drafts[day] ?? d.meal}
                    onChange={(e) => setDrafts({ ...drafts, [day]: e.target.value })}
                    placeholder="What's for dinner?"
                    style={{
                      flex: 1, border: `1.5px solid ${T.line}`, borderRadius: 10,
                      padding: "8px 11px", fontSize: 14, fontFamily: "Inter, sans-serif",
                      outline: "none", background: "#FAFBFC", color: T.ink,
                    }}
                  />
                  <button
                    onClick={() => {
                      const meal = (drafts[day] ?? d.meal).trim();
                      saveDay((x) => ({ ...x, meal, setBy: me }));
                    }}
                    style={{
                      border: "none", background: T.ink, color: "#fff", borderRadius: 10,
                      padding: "0 14px", cursor: "pointer", fontWeight: 700, fontSize: 13,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Set
                  </button>
                </div>
                {d.setBy && d.meal && (
                  <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>
                    Set by {d.setBy}
                  </div>
                )}
                <ReactionButton
                  count={ups} active={mine === "up"}
                  onClick={() => saveDay((x) => {
                    const r = { ...(x.reactions || {}) };
                    if (r[me] === "up") delete r[me]; else r[me] = "up";
                    return { ...x, reactions: r };
                  })}
                />
                <CommentThread
                  comments={d.comments} me={me} members={members}
                  onAdd={(text) => saveDay((x) => ({
                    ...x, comments: [...(x.comments || []), { author: me, text, ts: Date.now() }],
                  }))}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Home page                                                          */
/* ------------------------------------------------------------------ */
function HomeTab({ me, members, onGoTab }) {
  const dateKey = localDateKey();
  const todayName = DAYS[(new Date().getDay() + 6) % 7];

  const [weather, setWeather] = useState(null);
  const [weatherBusy, setWeatherBusy] = useState(true);
  const [weatherErr, setWeatherErr] = useState("");
  const [todosDoc] = useHubDoc("todos");
  const [dinnersDoc] = useHubDoc("dinners");
  const [photoDoc, savePhoto, removePhotoDoc] = useHubDoc(`photo-${dateKey}`);
  const [checkinDoc, saveCheckin] = useHubDoc(`checkin-${dateKey}`);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const fileInputRef = useRef(null);

  const todos = (todosDoc?.items || []).filter((t) => !t.done);
  const dinner = dinnersDoc?.days?.[todayName]?.meal || null;
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

      {/* Tonight's dinner */}
      <div style={card}>
        <SectionTitle>Dinner tonight</SectionTitle>
        {dinner ? (
          <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{dinner}</div>
        ) : (
          <div style={{ fontSize: 14, color: T.inkSoft }}>Nothing planned yet for {todayName}.</div>
        )}
        <button
          onClick={() => onGoTab("dinners")}
          style={{
            marginTop: 8, border: "none", background: "transparent", color: T.marigoldDeep,
            cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0,
            display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "Inter, sans-serif",
          }}
        >
          Open the week's plan <ArrowRight size={13} />
        </button>
      </div>

      {/* Today's goals — his & hers */}
      <div style={card}>
        <SectionTitle>Today's goals</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "Mike's Today Goals", match: "mike" },
            { label: "Tina's Today Goals", match: "tina" },
          ].map(({ label, match }) => {
            const mine = todos.filter((t) => (t.author || "").toLowerCase().startsWith(match));
            return (
              <div key={match} style={{
                background: "#FAFBFC", border: `1px solid ${T.line}`,
                borderRadius: 12, padding: "10px 12px",
              }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 800, color: T.marigoldDeep,
                  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8,
                  fontFamily: "Inter, sans-serif",
                }}>
                  {label}
                </div>
                {mine.length === 0 ? (
                  <div style={{ fontSize: 13, color: T.inkSoft }}>Nothing yet today.</div>
                ) : (
                  mine.slice(0, 6).map((t) => (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "flex-start", gap: 6,
                      padding: "4px 0", fontSize: 13.5, color: T.ink, lineHeight: 1.35,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.marigold, flexShrink: 0, marginTop: 6 }} />
                      <span style={{ overflowWrap: "anywhere" }}>{t.text}</span>
                    </div>
                  ))
                )}
                {mine.length > 6 && (
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>+ {mine.length - 6} more</div>
                )}
              </div>
            );
          })}
        </div>
        <button
          onClick={() => onGoTab("todos")}
          style={{
            marginTop: 10, border: "none", background: "transparent", color: T.marigoldDeep,
            cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0,
            display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "Inter, sans-serif",
          }}
        >
          See all to-dos <ArrowRight size={13} />
        </button>
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
  { id: "home", label: "Home", icon: Fish },
  { id: "grocery", label: "Groceries", icon: ShoppingCart },
  { id: "dinners", label: "Dinners", icon: UtensilsCrossed },
  { id: "todos", label: "To-dos", icon: CheckSquare },
  { id: "travel", label: "Bucket list", icon: Plane },
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

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: T.ink, padding: "22px 18px 0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
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
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 60px" }}>
        {tab === "home" && <HomeTab me={me} members={members} onGoTab={setTab} />}
        {tab === "grocery" && (
          <ListTab
            docId="grocery" me={me} members={members} showCheckbox
            placeholder="Add a grocery item… (e.g. diapers, size 3)"
            emptyCopy="The list is empty. Add the first item — someone always needs more milk."
          />
        )}
        {tab === "dinners" && <DinnerTab me={me} members={members} />}
        {tab === "todos" && (
          <ListTab
            docId="todos" me={me} members={members} showCheckbox
            placeholder="Add a to-do… (e.g. book 6-month checkup)"
            emptyCopy="No to-dos yet. Enjoy it while it lasts."
          />
        )}
        {tab === "travel" && (
          <ListTab
            docId="travel" me={me} members={members} showCheckbox={false}
            placeholder="Add a dream destination…"
            emptyCopy="Where to first? Add a place and let the votes decide."
          />
        )}
      </div>
    </div>
  );
}

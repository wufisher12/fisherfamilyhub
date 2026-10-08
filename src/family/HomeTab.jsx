import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Sun, Camera, Loader2, CornerDownRight, Send } from "lucide-react";
import { T } from "../lib/theme.js";
import { DAYS, localDateKey } from "../lib/dates.js";
import { useHubDoc } from "../lib/hooks.js";
import { fetchWeather } from "./weather.js";
import { compressPhoto } from "./photo.js";
import { Avatar, SectionTitle } from "./ui.jsx";

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

export function HomeTab({ me, meMatch, members, onGoTab, wide }) {
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

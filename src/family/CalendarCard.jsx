import { T } from "../lib/theme.js";
import { useHubDoc } from "../lib/hooks.js";
import { SectionTitle } from "./ui.jsx";

/* ------------------------------------------------------------------ */
/*  Calendar — read from Firestore (synced every 30 min by Actions)    */
/* ------------------------------------------------------------------ */
export function CalendarCard({ dateKey, title, bare }) {
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

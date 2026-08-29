import admin from "firebase-admin";

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const TZ = "America/New_York";

// 1. Trade the long-lived refresh token for a fresh access token
const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});
if (!tokenResp.ok) {
  console.error("token exchange failed:", tokenResp.status, await tokenResp.text());
  process.exit(1);
}
const { access_token } = await tokenResp.json();

// 2. Fetch events: today through +7 days (covers Home's 4-day view and all 5 planning pills)
const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
  + "?singleEvents=true&orderBy=startTime&maxResults=100"
  + `&timeMin=${encodeURIComponent(start.toISOString())}`
  + `&timeMax=${encodeURIComponent(end.toISOString())}`;
const evResp = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
if (!evResp.ok) {
  console.error("calendar fetch failed:", evResp.status, await evResp.text());
  process.exit(1);
}
const data = await evResp.json();

// 3. Group by Eastern-time date key
const keyOf = (d) => new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
}).format(d);
const timeOf = (d) => new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hour: "numeric", minute: "2-digit",
}).format(d);

const days = {};
for (const ev of data.items || []) {
  if (ev.status === "cancelled") continue;
  const isAllDay = !!(ev.start && ev.start.date && !ev.start.dateTime);
  const startD = isAllDay
    ? new Date(ev.start.date + "T12:00:00")
    : new Date(ev.start.dateTime);
  const key = keyOf(startD);
  if (!days[key]) days[key] = [];
  days[key].push({
    t: isAllDay ? "All day" : timeOf(startD),
    title: (ev.summary || "(no title)").slice(0, 140),
    sort: isAllDay ? 0 : startD.getTime(),
  });
}
for (const k of Object.keys(days)) days[k].sort((a, b) => a.sort - b.sort);

await db.doc("hub/calendar").set({ days, updated: Date.now() });
console.log(`calendar synced: ${Object.keys(days).length} day(s), ${(data.items || []).length} event(s)`);

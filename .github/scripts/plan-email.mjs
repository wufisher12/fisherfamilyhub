import { writeFileSync, appendFileSync } from "node:fs";
import admin from "firebase-admin";

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Tomorrow's date key in Eastern time (matches the hub's plan-YYYY-MM-DD docs)
const TZ = "America/New_York";
const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
const key = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
}).format(tomorrow); // en-CA => YYYY-MM-DD
const pretty = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, weekday: "long", month: "long", day: "numeric",
}).format(tomorrow);
const dow = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(tomorrow);
const weekend = dow === "Sat" || dow === "Sun";

const snap = await db.doc(`hub/plan-${key}`).get();
const data = snap.exists ? snap.data() : {};
const p = data.mike || {};

// Ordered priorities, with fallback to the old Top-3 format
let pris = Array.isArray(p.priorities) ? p.priorities.filter(x => x && x.text && x.text.trim()) : [];
if (!pris.length && Array.isArray(p.top3)) {
  const star = p.star ?? 0;
  const legacy = p.top3.map((t, i) => ({ text: t, i })).filter(x => x.text && x.text.trim());
  pris = [...legacy.filter(x => x.i === star), ...legacy.filter(x => x.i !== star)];
}
const clean = (a) => (Array.isArray(a) ? a.filter(l => l && l.trim()) : []);
const w1 = clean(p.w1), w2 = clean(p.w2), fun = clean(p.fun);
const dinner = (data.dinner || "").trim();
const done = !!p.shutdownComplete;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const row = (label, html) => `
  <tr><td style="padding:6px 0;vertical-align:top;width:110px;font:800 11px Arial;color:#9C721E;letter-spacing:.05em">${label}</td>
  <td style="padding:6px 0;font:14px/1.5 Arial;color:#003157">${html}</td></tr>`;

let body = "";
if (pris.length) body += row("PRIORITIES", pris.map((x, i) =>
  i === 0 ? `<strong>★ ${esc(x.text)}</strong>` : `${i + 1}. ${esc(x.text)}`).join("<br>"));
if (weekend && fun.length) body += row("PLANS", fun.map(esc).join("<br>"));
if (w1.length) body += row("WORKOUT #1", esc(w1.join(" · ")));
if (w2.length) body += row("WORKOUT #2", esc(w2.join(" · ")));
if (dinner) body += row("DINNER", esc(dinner));

const empty = !body;
const html = `
<div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif">
  <div style="background:#003157;border-radius:12px;padding:16px 20px">
    <div style="color:#fff;font-size:18px;font-weight:800">🐠 Tomorrow's Plan — ${pretty}</div>
    <div style="color:#A8BACB;font-size:11px;margin-top:3px">${done ? "Shutdown complete ✓" : "Shutdown not marked complete"}</div>
  </div>
  <div style="padding:14px 6px">
    ${empty
      ? `<div style="font:14px/1.6 Arial;color:#5F6B78">No plan was entered for tomorrow. If tonight's shutdown got skipped, tomorrow starts undecided — the hub is one tap away.</div>`
      : `<table style="width:100%;border-collapse:collapse">${body}</table>`}
  </div>
  <div style="font:italic 11px Arial;color:#5F6B78;padding:0 6px">Sent nightly by the hub so the morning brief knows the plan.</div>
</div>`;

writeFileSync("plan-email.html", html);
appendFileSync(process.env.GITHUB_OUTPUT, `subject=🐠 Tomorrow's Plan — ${pretty}\n`);
console.log(`Plan email built for ${key} (${empty ? "empty" : "filled"})`);

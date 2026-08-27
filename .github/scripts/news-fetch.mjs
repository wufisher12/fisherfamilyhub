import admin from "firebase-admin";
import { XMLParser } from "fast-xml-parser";

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Mike's feed lineup. Google News RSS keeps local/industry queries reliable;
// MLB's official feed covers the Sox. Edit freely — id/label render in the app.
const SECTIONS = [
  {
    id: "local",
    label: "South Shore & Boston",
    feeds: [
      "https://news.google.com/rss/search?q=%22South%20Shore%22%20Massachusetts&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=Marshfield%20OR%20Duxbury%20Massachusetts&hl=en-US&gl=US&ceid=US:en",
    ],
    max: 4,
  },
  {
    id: "str",
    label: "Vacation Rentals",
    feeds: [
      "https://skift.com/feed/",
      "https://news.google.com/rss/search?q=%22short-term%20rental%22%20OR%20%22vacation%20rental%22&hl=en-US&gl=US&ceid=US:en",
    ],
    max: 4,
  },
  {
    id: "sox",
    label: "Red Sox",
    feeds: [
      "https://www.mlb.com/redsox/feeds/news/rss.xml",
      "https://news.google.com/rss/search?q=Boston%20Red%20Sox&hl=en-US&gl=US&ceid=US:en",
    ],
    max: 4,
  },
];

const parser = new XMLParser({ ignoreAttributes: false });

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

async function pullFeed(url) {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (FisherHubNews/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const tree = parser.parse(xml);
    const items = tree?.rss?.channel?.item || tree?.feed?.entry || [];
    const list = Array.isArray(items) ? items : [items];
    return list.map((it) => {
      let link = it.link;
      if (typeof link === "object") link = link["@_href"] || link["#text"] || "";
      let title = it.title;
      if (typeof title === "object") title = title["#text"] || "";
      // Google News titles end with " - Source"; use it as the source label
      let source = it.source && (it.source["#text"] || it.source) || hostOf(String(link));
      const m = String(title).match(/^(.*)\s+-\s+([^-]+)$/);
      if (m && String(source).includes("news.google")) { title = m[1]; source = m[2]; }
      return {
        title: String(title).trim().slice(0, 160),
        url: String(link).trim(),
        source: String(source).trim().slice(0, 60),
        date: it.pubDate || it.published || "",
      };
    }).filter((x) => x.title && x.url);
  } catch (e) {
    console.log(`feed failed: ${url} (${e.message})`);
    return [];
  }
}

const out = [];
for (const s of SECTIONS) {
  const all = (await Promise.all(s.feeds.map(pullFeed))).flat();
  // De-dupe by title, keep newest-ish order as delivered, cap per section
  const seen = new Set();
  const items = [];
  for (const it of all) {
    const k = it.title.toLowerCase().slice(0, 70);
    if (seen.has(k)) continue;
    seen.add(k);
    items.push(it);
    if (items.length >= s.max) break;
  }
  out.push({ id: s.id, label: s.label, items });
  console.log(`${s.label}: ${items.length} items`);
}

await db.doc("hub/news").set({
  sections: out,
  updated: Date.now(),
});
console.log("news written");

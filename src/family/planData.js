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
export function habitsFor(templateDoc, match) {
  const custom = templateDoc && templateDoc[match] && templateDoc[match].habits;
  if (custom !== undefined && custom !== null) return custom;
  return match === "mike" ? DEFAULT_HABITS_MIKE : [];
}
export function anchorsFor(templateDoc, match) {
  const a = templateDoc && templateDoc[match] && templateDoc[match].anchors;
  if (a !== undefined && a !== null) return a;
  return match === "mike" ? DEFAULT_ANCHORS : [];
}
export function wrapupFor(templateDoc, match) {
  const w = templateDoc && templateDoc[match] && templateDoc[match].wrapup;
  if (w !== undefined && w !== null) return w;
  return match === "mike" ? DEFAULT_WRAPUP : [];
}

export const EMPTY_PLAN = {
  priorities: [],
  top3: ["", "", ""], done3: [false, false, false], star: 0,
  blocks: ["", ""], blocksDone: [false, false],
  w1: [""], w1done: [], w2: [""], w2done: [],
  fun: [""], fundone: [],
  anchorsDone: {}, wrapupDone: {},
  prep: { inbox: false, calendar: false }, shutdownComplete: false,
};

/* Ordered priority list for a day. Reads the new format, falls back to
   the old Top-3 fields so this week's existing plans still display. */
export function getPriorities(p) {
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
export const DEFAULT_ANCHORS = DEFAULT_ANCHORS_NEW; const OLD_ANCHORS = [
  { t: "5:30 AM", label: "Give gratitude" },
  { t: "6:30 AM", label: "Get ready for the day" },
  { t: "7:45 AM", label: "Kids dropoff" },
  { t: "8:30 AM", label: "Review calendar & emails, dinner prep — set up your day" },
];
export const DEFAULT_WRAPUP = [
  { t: "4:00 PM", label: "Shutdown — lingering emails & last tasks" },
];

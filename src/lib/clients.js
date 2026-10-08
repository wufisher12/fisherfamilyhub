/* ------------------------------------------------------------------ */
/*  To Do List categories (clients green, Realty blue, Personal red)   */
/* ------------------------------------------------------------------ */
/* Master client roster — single source of truth for the To Do List AND the MFG dashboards */
export const CLIENTS = [
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
  // Anonymized Bear Camp mirror for prospect demos - portal only, never a
  // To Do List category.
  { id: "demo", label: "Demo Account", abbr: "DEMO", demo: true },
];
export const clientOf = (id) => CLIENTS.find((c) => c.id === id);

export const TD_CATS = [
  ...CLIENTS.filter((c) => !c.demo).map((c) => ({ ...c, color: "#2F6D54" })),
  { id: "164apr", label: "164 Annable Point Road", abbr: "164APR", color: "#33608A" },
  { id: "realty", label: "Realty Advisors", abbr: "RA", color: "#33608A" },
  { id: "personal", label: "Personal", abbr: "PERS", color: "#9E3B2F" },
];
export const catOf = (id) => TD_CATS.find((c) => c.id === id);

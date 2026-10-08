import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { mfgDb } from "../../lib/firebase.js";
import { T } from "../../lib/theme.js";
import { useMfgHubDoc } from "../../lib/hooks.js";
import { MFG_CARD, MFG_CHIP, MFG_INPUT, MfgChipRow, MfgNoteSection } from "./ui.jsx";

/* ---------------------------------------------------- listing table */
export function MfgListingTableSection({ section, userEmail }) {
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

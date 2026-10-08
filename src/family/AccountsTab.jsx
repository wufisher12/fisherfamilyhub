import { useState } from "react";
import { Plus, ExternalLink } from "lucide-react";
import { T } from "../lib/theme.js";
import { useHubDoc } from "../lib/hooks.js";
import { Spinner } from "./ui.jsx";

/* ------------------------------------------------------------------ */
/*  Accounts directory — names, URLs, usernames. Never passwords.      */
/* ------------------------------------------------------------------ */
export function AccountsTab() {
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

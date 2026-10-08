import { useState, useRef } from "react";
import { Fish, Camera } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { T, MEMBER_COLORS } from "../lib/theme.js";
import { useHubDoc } from "../lib/hooks.js";
import { compressPhoto } from "./photo.js";
import { Avatar } from "./ui.jsx";

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

export function ProfileSetup({ members, onDone }) {
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

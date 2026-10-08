import { useState } from "react";
import { Fish } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase.js";
import { familyEmail } from "../firebase-config.js";
import { T } from "../lib/theme.js";

/* ------------------------------------------------------------------ */
/*  Login + first-time profile setup                                   */
/* ------------------------------------------------------------------ */
export function LoginScreen() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, familyEmail, pw);
    } catch (e) {
      setErr(
        /invalid|wrong|credential|not-found/i.test(e.code || "")
          ? "That's not the family password. Try again?"
          : `Sign-in failed: ${e.message}`,
      );
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.canvas, display: "flex",
      alignItems: "flex-start", justifyContent: "center", padding: "56px 20px 40px",
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{
        background: T.card, borderRadius: 20, padding: "32px 30px 36px",
        maxWidth: 400, width: "100%", border: `1px solid ${T.line}`,
        boxShadow: "0 8px 30px rgba(0,49,87,0.10)",
      }}>
        <Fish size={34} color={T.marigold} style={{ marginBottom: 10 }} />
        <div style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 30,
          fontWeight: 800, color: T.ink, lineHeight: 1.1, marginBottom: 8,
        }}>
          Fisher Family Hub
        </div>
        <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 24, lineHeight: 1.5 }}>
          Family members only. Enter the family password — you'll stay signed in on this device.
        </div>
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Family password"
          type="password"
          autoComplete="current-password"
          style={{
            width: "100%", boxSizing: "border-box",
            border: `1.5px solid ${T.line}`, borderRadius: 12,
            padding: "12px 14px", fontSize: 16, outline: "none",
            marginBottom: 16, color: T.ink,
          }}
        />
        {err && <div style={{ fontSize: 13, color: T.coral, marginBottom: 12, lineHeight: 1.4 }}>{err}</div>}
        <button
          onClick={go}
          disabled={busy || !pw}
          style={{
            width: "100%", border: "none",
            background: pw ? T.marigold : T.line,
            color: T.ink, borderRadius: 12, padding: "13px 0", fontSize: 15,
            fontWeight: 800, cursor: pw ? "pointer" : "default",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {busy ? "Opening…" : "Enter the hub"}
        </button>
      </div>
    </div>
  );
}

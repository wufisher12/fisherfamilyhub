import { useState } from "react";
import { Briefcase } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { mfgAuth } from "../lib/firebase.js";
import { T, MFG_RED } from "../lib/theme.js";

export function MFGLogin({ onError, error }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const inputS = {
    width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.line}`,
    borderRadius: 12, padding: "13px 15px", fontSize: 16, outline: "none",
    background: "#fff", color: T.ink, fontFamily: "Inter, sans-serif", marginBottom: 10,
  };
  // Plain usernames (no "@") map to a synthetic address on the hub's own
  // domain, the same trick the family login uses: Firebase needs an
  // email-shaped id, the team only needs to remember "ohana".
  const toLogin = (v) => (v.includes("@") ? v : `${v.toLowerCase()}@fisherhub.local`);
  const go = async () => {
    if (!email.trim() || !pw) return;
    setBusy(true);
    try {
      await signInWithEmailAndPassword(mfgAuth, toLogin(email.trim()), pw);
    } catch (e) {
      onError(
        e.code === "auth/invalid-credential" || e.code === "auth/wrong-password" || e.code === "auth/user-not-found"
          ? "That username or password isn't right."
          : `Sign-in problem (${e.code || e.message})`
      );
    }
    setBusy(false);
  };
  return (
    <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Inter, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ background: T.ink, borderRadius: "16px 16px 0 0", padding: "22px 24px", borderBottom: `4px solid ${MFG_RED}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Briefcase size={22} color="#fff" />
            <div>
              <div style={{ color: "#fff", fontSize: 19, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Mike Fisher Group</div>
              <div style={{ color: "#A8BACB", fontSize: 11.5 }}>Revenue management portal</div>
            </div>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: "0 0 16px 16px", padding: 24, border: `1px solid ${T.line}`, borderTop: "none" }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email or username" type="text" autoComplete="username" style={inputS} />
          <input value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="Password" type="password" autoComplete="current-password" style={inputS} />
          {error && <div style={{ color: MFG_RED, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{error}</div>}
          <button onClick={go} disabled={busy} style={{
            width: "100%", border: "none", background: MFG_RED, color: "#fff", borderRadius: 12,
            padding: "13px 0", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: "Inter, sans-serif",
            opacity: busy ? 0.7 : 1,
          }}>{busy ? "Signing in…" : "Sign in"}</button>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 12, lineHeight: 1.5 }}>
            Access is by invitation. Clients see their own dashboard only.
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Fish, Loader2, LogOut } from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, configured } from "../lib/firebase.js";
import { T } from "../lib/theme.js";
import { useIsWide } from "../lib/hooks.js";
import { Avatar } from "./ui.jsx";
import { NavBar } from "./NavBar.jsx";
import { LoginScreen } from "./LoginScreen.jsx";
import { ProfileSetup } from "./ProfileSetup.jsx";
import { HomeTab } from "./HomeTab.jsx";
import { PlanTab } from "./PlanTab.jsx";
import { TodoListPage } from "./TodoListPage.jsx";
import { FinancialsPage } from "./FinancialsPage.jsx";
import { AccountsTab } from "./AccountsTab.jsx";

function NotConfigured() {
  return (
    <div style={{
      minHeight: "100vh", background: T.canvas, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{
        background: T.card, borderRadius: 20, padding: "32px 30px",
        maxWidth: 440, border: `1px solid ${T.line}`, lineHeight: 1.6,
        color: T.ink, fontSize: 14.5,
      }}>
        <Fish size={30} color={T.marigold} style={{ marginBottom: 10 }} />
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          One step left
        </div>
        Firebase isn't configured yet. Open <code style={{ background: "#F0F2F5", padding: "1px 6px", borderRadius: 5 }}>src/firebase-config.js</code> and
        paste your Firebase project's config — the README walks through it step by step (about 10 minutes, free).
      </div>
    </div>
  );
}

const IDENTITY_KEY = "famhub:me";
function loadIdentity() {
  try { return JSON.parse(localStorage.getItem(IDENTITY_KEY)); } catch { return null; }
}

export default function FamilyApp() {
  const wide = useIsWide();
  const [user, setUser] = useState(undefined);   // undefined = checking auth
  const [profile, setProfileState] = useState(loadIdentity);
  const [members, setMembers] = useState({});
  const [tab, setTab] = useState("home");

  const setProfile = (p) => {
    try {
      if (p) localStorage.setItem(IDENTITY_KEY, JSON.stringify(p));
      else localStorage.removeItem(IDENTITY_KEY);
    } catch { /* private browsing */ }
    setProfileState(p);
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pop { 0% { transform: scale(.5); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
      @keyframes bob { from { transform: translateY(0); } to { transform: translateY(-4px); } }
      * { -webkit-tap-highlight-color: transparent; }
      button:focus-visible, input:focus-visible { outline: 2px solid ${T.sky}; outline-offset: 2px; }`;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  // Live member roster for avatar colors
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, "hub", "members"),
      (snap) => setMembers(snap.exists() ? snap.data() : {}),
      () => setMembers({}),
    );
  }, [user]);

  if (!configured) return <NotConfigured />;
  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>
        <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  if (!profile) return <ProfileSetup members={members} onDone={setProfile} />;

  const me = profile.name;
  const meMatch = me.toLowerCase().startsWith("tina") ? "tina" : "mike";
  const contentWidth = wide
    ? (tab === "home" || tab.startsWith("fin-") || tab === "todolist" ? 1100 : tab === "plan" ? 1040 : 860)
    : 640;

  return (
    <div id="screen-root" style={{ minHeight: "100vh", background: T.canvas, fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: T.ink, padding: "22px 18px 0" }}>
        <div style={{ maxWidth: contentWidth, margin: "0 auto", transition: "max-width .2s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{
                fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 23,
                fontWeight: 800, color: "#fff", lineHeight: 1,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Fish size={22} color={T.marigold} />
                Fisher Family Hub
              </div>
              <div style={{ fontSize: 12.5, color: "#A8BACB", marginTop: 5 }}>
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {Object.entries(members).map(([n, c]) => (
                <Avatar key={n} name={n} color={c} size={30} />
              ))}
              <button
                onClick={() => { setProfile(null); signOut(auth); }}
                aria-label="Sign out"
                title="Sign out"
                style={{ border: "none", background: "transparent", color: "#A8BACB", cursor: "pointer", padding: 4 }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <NavBar tab={tab} setTab={setTab} wide={wide} />
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: contentWidth, margin: "0 auto", padding: "20px 16px 60px", transition: "max-width .2s ease" }}>
        {tab === "home" && <HomeTab me={me} meMatch={meMatch} members={members} onGoTab={setTab} wide={wide} />}
        {tab === "plan" && <PlanTab meMatch={meMatch} meName={me} wide={wide} onGoTab={setTab} />}
        {tab === "todolist" && <TodoListPage wide={wide} />}
        {tab.startsWith("fin-") && <FinancialsPage sub={tab} />}
        {tab === "accounts" && <AccountsTab />}
      </div>
    </div>
  );
}

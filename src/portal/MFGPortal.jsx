import { useState, useEffect } from "react";
import { Briefcase, Loader2 } from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { mfgAuth, mfgDb } from "../lib/firebase.js";
import { T, MFG_RED } from "../lib/theme.js";
import { CLIENTS } from "../lib/clients.js";
import { MFG_CHIP } from "../shared/dashboard/ui.jsx";
import { ensurePrintCss } from "../shared/dashboard/print.js";
import { MFGLogin } from "./Login.jsx";
import { MfgClientScreen } from "./ClientScreen.jsx";
import { MFGCustomerList } from "./CustomerList.jsx";
import { MFGRevenueTracking } from "./RevenueTracking.jsx";
import { MFGCompanyPnL } from "./CompanyPnL.jsx";

/* ------------------------------------------------------------------ */
/*  Mike Fisher Group portal — separate logins, role-based access      */
/*  Runs at ?portal=mfg in its own browser tab with its own session.   */
/* ------------------------------------------------------------------ */
// The portal shares the master roster (CLIENTS in lib/clients.js, also the
// To Do List categories): adding a client there adds it here.
const MFG_CLIENTS = CLIENTS;
const mfgClientOf = (id) => MFG_CLIENTS.find((c) => c.id === id);

function MfgKpiTile({ label, hint }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.line, fontFamily: "'Bricolage Grotesque', sans-serif", margin: "6px 0 2px" }}>—</div>
      {hint && <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

function MfgShellNote({ children }) {
  return (
    <div style={{
      background: "#FFF5F5", border: `1px solid ${MFG_RED}33`, borderRadius: 12,
      padding: "10px 14px", margin: "14px 0 0", fontSize: 12.5, color: "#8A2A2E", lineHeight: 1.5,
    }}>{children}</div>
  );
}

export function MFGPortal({ clientParam }) {
  const [user, setUser] = useState(undefined);
  const [roleInfo, setRoleInfo] = useState(undefined);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("company");

  // The portal is the business product - it gets its own browser-tab name.
  useEffect(() => { document.title = "Mike Fisher Group"; }, []);

  // Print styles for the Export PDF buttons (Company Overview and Revenue
  // Tracking): landscape Letter, nav and controls hidden, content scaled.
  useEffect(() => { ensurePrintCss(); }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(mfgAuth, (u) => { setUser(u || null); setRoleInfo(undefined); setErr(null); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(mfgDb, "mfgRoles", user.email));
        setRoleInfo(snap.exists() ? snap.data() : null);
      } catch {
        setRoleInfo(null);
      }
    })();
  }, [user]);

  const signOutMfg = () => signOut(mfgAuth);

  if (user === undefined) return <div style={{ minHeight: "100vh", background: T.canvas }} />;
  if (user === null) return <MFGLogin error={err} onError={setErr} />;
  if (roleInfo === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>
        <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }
  if (roleInfo === null) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 6 }}>No access assigned</div>
          <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
            You're signed in as {user.email}, but this account hasn't been given a portal role yet.
          </div>
          <button onClick={signOutMfg} style={{ border: "none", background: T.ink, color: "#fff", borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontWeight: 800, fontSize: 13.5, fontFamily: "Inter, sans-serif" }}>Sign out</button>
        </div>
      </div>
    );
  }

  // Client role: their dashboard only, regardless of URL
  if (roleInfo.role === "client") {
    const c = mfgClientOf(roleInfo.clientId);
    if (!c) return <div style={{ padding: 40, fontFamily: "Inter, sans-serif" }}>Client record missing — contact Mike.</div>;
    return <MfgClientScreen client={c} isTeam={false} onSignOut={signOutMfg} userEmail={user.email} />;
  }

  // Team: full portal
  if (clientParam) {
    const c = mfgClientOf(clientParam);
    if (c) return <MfgClientScreen client={c} isTeam onSignOut={signOutMfg} userEmail={user.email} />;
  }

  const tabs = [
    { id: "company", label: "Company Overview" },
    { id: "revenue", label: "Revenue Tracking" },
    { id: "customers", label: "Customer List" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, fontFamily: "Inter, sans-serif" }}>
      <div className="mfg-noprint" style={{ background: T.ink, borderBottom: `4px solid ${MFG_RED}` }}>
        <div style={{ maxWidth: 1520, margin: "0 auto", padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Briefcase size={20} color="#fff" />
              <div>
                <div style={{ color: "#fff", fontSize: 19, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Mike Fisher Group</div>
                <div style={{ color: "#A8BACB", fontSize: 11 }}>Signed in as {user.email}</div>
              </div>
            </div>
            <button onClick={signOutMfg} style={{ border: "none", background: "transparent", color: "#A8BACB", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>Sign out</button>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 12, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                border: "none", background: "transparent", cursor: "pointer",
                color: tab === t.id ? "#fff" : "#8FA3B5", padding: "10px 14px 12px",
                fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif",
                borderBottom: `3px solid ${tab === t.id ? MFG_RED : "transparent"}`,
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mfg-print-area" style={{ maxWidth: 1520, margin: "0 auto", padding: "22px 20px 60px" }}>
        {tab !== "customers" && (
          <div className="mfg-noprint" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button onClick={() => window.print()} style={MFG_CHIP(true)}>Export PDF</button>
          </div>
        )}
        {tab === "company" && <MFGCompanyPnL userEmail={user.email} />}
        {tab === "revenue" && <MFGRevenueTracking userEmail={user.email} />}
        {tab === "customers" && <MFGCustomerList userEmail={user.email} />}
      </div>
    </div>
  );
}

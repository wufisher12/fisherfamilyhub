import { useState, useEffect } from "react";
import { Briefcase, Loader2 } from "lucide-react";
import { T, MFG_RED } from "../lib/theme.js";
import { useMfgHubDoc } from "../lib/hooks.js";
import { MFG_CHIP, MfgComingSoon } from "../shared/dashboard/ui.jsx";
import { MfgSection } from "../shared/dashboard/Section.jsx";
import { ensurePrintCss } from "../shared/dashboard/print.js";
// Contract-v2 sample dashboard for ?portal=mfg&client=…&sample=1 previews.
import SAMPLE_DASHBOARD from "../../docs/sample-client-dashboard.json";

export function MfgClientScreen({ client, isTeam, onSignOut, userEmail }) {
  // ?sample=1 previews the bundled sample document without live data.
  const sample = new URLSearchParams(window.location.search).has("sample");
  const liveDoc = useMfgHubDoc(sample ? null : `mfg-client-${client.id}`);
  const dash = sample ? SAMPLE_DASHBOARD : liveDoc;

  const tabs = Array.isArray(dash?.tabs) ? dash.tabs.filter((t) => t && t.id && t.label) : [];
  const [tabId, setTabId] = useState(null);
  const activeTab = tabs.find((t) => t.id === tabId) || tabs[0] || null;
  // A tab may nest subtabs instead of sections; selection is remembered per tab.
  const [subFor, setSubFor] = useState({});
  const subtabs = Array.isArray(activeTab?.subtabs) ? activeTab.subtabs.filter((s) => s && s.id && s.label) : null;
  const activeSub = subtabs ? (subtabs.find((s) => s.id === subFor[activeTab.id]) || subtabs[0]) : null;
  const sections = activeSub ? activeSub.sections : activeTab?.sections;

  const updatedText = typeof dash?.updated === "number"
    ? new Date(dash.updated).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  // Docs with `wide: true` stretch toward full screen (dense multi-column
  // tables); everything else keeps the original 1100px column.
  const maxW = dash?.wide ? 1760 : 1100;

  // Print styles for the Export PDF button (subtabs with `exportPdf: true`):
  // one landscape Letter page of just the active tab's sections. Injected
  // here because the portal never runs the family app's style effect.
  useEffect(() => { ensurePrintCss(); }, []);

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, fontFamily: "Inter, sans-serif" }}>
      <div className="mfg-noprint" style={{ background: T.ink, borderBottom: `4px solid ${MFG_RED}` }}>
        <div style={{ maxWidth: maxW, margin: "0 auto", padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Briefcase size={18} color="#fff" />
              <div>
                <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{client.label}</div>
                <div style={{ color: "#A8BACB", fontSize: 11 }}>Mike Fisher Group · performance dashboard</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {isTeam && (
                <a href="?portal=mfg" style={{ color: "#A8BACB", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>← All clients</a>
              )}
              <button onClick={onSignOut} style={{ border: "none", background: "transparent", color: "#A8BACB", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>Sign out</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 12, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTabId(t.id)} style={{
                border: "none", background: "transparent", cursor: "pointer",
                color: activeTab && t.id === activeTab.id ? "#fff" : "#8FA3B5", padding: "10px 14px 12px",
                fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif",
                borderBottom: `3px solid ${activeTab && t.id === activeTab.id ? MFG_RED : "transparent"}`,
              }}>{t.label}</button>
            ))}
            {tabs.length === 0 && <div style={{ height: 12 }} />}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: maxW, margin: "0 auto", padding: "18px 20px 60px" }}>
        {dash === undefined && (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0", color: T.inkSoft }}>
            <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}
        {dash === null && (
          <MfgComingSoon text="Dashboard coming soon — your numbers land here once the data feed is live." />
        )}
        {dash && (
          <>
            <div className="mfg-noprint" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {sample && (
                <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: T.marigoldDeep, borderRadius: 999, padding: "2px 9px" }}>SAMPLE DATA</span>
              )}
              {updatedText && (
                <span style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600 }}>As of {updatedText}</span>
              )}
              {(activeSub || activeTab)?.exportPdf && (
                <button onClick={() => window.print()} style={MFG_CHIP(true)}>Export PDF</button>
              )}
            </div>
            {subtabs && (
              <div className="mfg-noprint" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {subtabs.map((s) => (
                  <button key={s.id}
                    onClick={() => setSubFor((m) => ({ ...m, [activeTab.id]: s.id }))}
                    style={MFG_CHIP(activeSub && s.id === activeSub.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            <div className="mfg-print-area">
              <div className="mfg-print-title" style={{ display: "none", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, borderBottom: `3px solid ${T.ink}`, paddingBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 22, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{client.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.inkSoft, marginLeft: 12 }}>{[activeTab?.label, activeSub?.label].filter(Boolean).join(" · ")}</span>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600 }}>
                  {updatedText ? `As of ${updatedText} · ` : ""}Prepared by Mike Fisher Group
                </div>
              </div>
              {sections?.length > 0
                ? sections.map((s, i) => <MfgSection key={`${activeTab.id}-${activeSub ? activeSub.id : "x"}-${i}`} section={s} userEmail={userEmail} isTeam={isTeam} />)
                : <MfgComingSoon />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

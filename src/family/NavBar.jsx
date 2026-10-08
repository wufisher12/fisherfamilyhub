import { useState } from "react";
import {
  Fish, ClipboardList, CheckSquare, Wallet, KeyRound, ChevronDown, Briefcase, ExternalLink,
} from "lucide-react";
import { T } from "../lib/theme.js";

/* ------------------------------------------------------------------ */
/*  Tabs + App                                                         */
/* ------------------------------------------------------------------ */
const NAV = [
  { id: "home", label: "Home", icon: Fish },
  { id: "plan", label: "4pm Shutdown", icon: ClipboardList },
  { id: "todolist", label: "To Do List", icon: CheckSquare },
  {
    id: "financials", label: "Financials", icon: Wallet, children: [
      { id: "fin-overview", label: "Overview" },
      { id: "fin-157", label: "157 King Phillips Path" },
      { id: "fin-66", label: "66 Telegraph St" },
      { id: "fin-mfg", label: "Mike Fisher Group" },
      { id: "fin-expenses", label: "Expense Management" },
    ],
  },
  { id: "accounts", label: "Accounts", icon: KeyRound },
];

export function NavBar({ tab, setTab, wide }) {
  const [openMenu, setOpenMenu] = useState(null);
  const childOf = (item) => item.children && item.children.some((c) => c.id === tab);

  return (
    <div style={{ display: "flex", gap: wide ? 4 : 2, marginTop: 18, position: "relative", flexWrap: "wrap" }}>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = item.children ? childOf(item) : tab === item.id;
        const base = {
          border: "none", cursor: "pointer", background: "transparent",
          color: active ? "#fff" : "#8FA3B5",
          padding: wide ? "12px 16px 14px" : "11px 10px 13px",
          fontSize: wide ? 14.5 : 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
          display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
          borderBottom: `3px solid ${active ? T.marigold : "transparent"}`,
          transition: "color .15s ease",
        };

        if (!item.children) {
          return (
            <button key={item.id} onClick={() => { setOpenMenu(null); setTab(item.id); }} style={base}>
              <Icon size={16} />
              {item.label}
            </button>
          );
        }

        const isOpen = openMenu === item.id;
        return (
          <div
            key={item.id}
            style={{ position: "relative" }}
            onMouseEnter={() => wide && setOpenMenu(item.id)}
            onMouseLeave={() => wide && setOpenMenu(null)}
          >
            <button
              onClick={() => {
                if (wide) { setTab(item.children[0].id); setOpenMenu(null); }
                else setOpenMenu(isOpen ? null : item.id);
              }}
              style={base}
            >
              <Icon size={16} />
              {item.label}
              <ChevronDown size={13} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
            {isOpen && wide && (
              <div style={{
                position: "absolute", top: "100%", left: 0, zIndex: 50,
                background: T.card, border: `1px solid ${T.line}`, borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,49,87,0.15)", padding: 6, minWidth: 220,
              }}>
                {item.children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setTab(c.id); setOpenMenu(null); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      border: "none", background: tab === c.id ? T.skySoft : "transparent",
                      color: tab === c.id ? T.ink : T.inkSoft,
                      borderRadius: 8, padding: "9px 12px", fontSize: 13.5, fontWeight: 600,
                      cursor: "pointer", fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {isOpen && !wide && (
              <div style={{
                position: "absolute", top: "100%", left: 0, zIndex: 50,
                background: T.card, border: `1px solid ${T.line}`, borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,49,87,0.2)", padding: 6, minWidth: 210,
              }}>
                {item.children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setTab(c.id); setOpenMenu(null); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      border: "none", background: tab === c.id ? T.skySoft : "transparent",
                      color: tab === c.id ? T.ink : T.inkSoft,
                      borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontWeight: 600,
                      cursor: "pointer", fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <a
        href="?portal=mfg"
        target="_blank"
        rel="noreferrer"
        title="Mike Fisher Group — opens in a new tab with its own login"
        style={{
          marginLeft: wide ? "auto" : 0,
          color: "#FF6B72", textDecoration: "none",
          padding: wide ? "12px 16px 14px" : "11px 10px 13px",
          fontSize: wide ? 14.5 : 13, fontWeight: 800, fontFamily: "Inter, sans-serif",
          display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
          borderBottom: "3px solid transparent",
        }}
      >
        <Briefcase size={16} />
        Mike Fisher Group
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

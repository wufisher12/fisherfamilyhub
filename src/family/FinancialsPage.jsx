import { T } from "../lib/theme.js";
import { SectionTitle } from "./ui.jsx";

/* ------------------------------------------------------------------ */
/*  Financials — shell (Phase 1 engine to come)                        */
/* ------------------------------------------------------------------ */
const FIN_ENTITIES = [
  { id: "fin-157", label: "157 King Phillips Path" },
  { id: "fin-66", label: "66 Telegraph St" },
  { id: "fin-mfg", label: "Mike Fisher Group" },
];

function KpiTile({ label, hint }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px",
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.line, fontFamily: "'Bricolage Grotesque', sans-serif", margin: "6px 0 2px" }}>—</div>
      <div style={{ fontSize: 11.5, color: T.inkSoft }}>{hint}</div>
    </div>
  );
}

export function FinancialsPage({ sub }) {
  const entity = FIN_ENTITIES.find((e) => e.id === sub);
  const card = {
    background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px", marginBottom: 14,
  };

  if (sub === "fin-expenses") {
    return (
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 12 }}>
          Expense Management
        </div>
        <div style={card}>
          <SectionTitle>Coming in Phase 1</SectionTitle>
          <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.65 }}>
            This is where expense data gets clean. The plan, as designed:
            monthly import from the <strong style={{ color: T.ink }}>Monarch CSV in Google Sheets</strong>;
            known recurring expenses (mortgage, insurance, subscriptions — defined once by you, per entity)
            auto-categorize and <strong style={{ color: T.ink }}>auto-populate the current month before they hit the account</strong>;
            anything the system doesn't recognize triggers a <strong style={{ color: T.ink }}>one-tap categorization pop-up</strong> —
            you pick the category once and it remembers the pattern for next time.
          </div>
        </div>
      </div>
    );
  }

  if (entity) {
    return (
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 12 }}>
          {entity.label}
        </div>
        <div style={card}>
          <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>
            This entity's dashboard arrives with the Phase 1 engine: revenue, expenses, and net income for{" "}
            <strong style={{ color: T.ink }}>{entity.label}</strong> by month, its recurring expense schedule,
            and its contribution to the consolidated Overview.
          </div>
        </div>
      </div>
    );
  }

  // Overview
  return (
    <div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
        Financial Overview
      </div>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>
        Consolidated across the household, both properties, and Mike Fisher Group. Layout is live — the Phase 1 data engine fills it in.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
        <KpiTile label="Revenue · this month" hint="incl. known income not yet landed" />
        <KpiTile label="Expenses · this month" hint="incl. scheduled fixed expenses" />
        <KpiTile label="Net income" hint="vs last month" />
        <KpiTile label="Available to deploy" hint="after committed savings" />
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px", marginBottom: 14 }}>
        <SectionTitle>12-month revenue vs expenses</SectionTitle>
        <div style={{ height: 160, borderRadius: 10, background: "#FAFBFC", border: `1px dashed ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontSize: 13 }}>
          Chart renders here once monthly data exists
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px" }}>
          <SectionTitle>3-month forecast</SectionTitle>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6 }}>
            Projected from your fixed-expense schedule plus trailing averages of variable spend.
          </div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px" }}>
          <SectionTitle>Debt-to-income</SectionTitle>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6 }}>
            Monthly debt payments ÷ gross income — the ratio your next lender will read first.
          </div>
        </div>
      </div>
    </div>
  );
}

import { MfgTilesSection, MfgNoteSection, MfgHeadingSection } from "./ui.jsx";
import { MfgChartSection } from "./Chart.jsx";
import { MfgTableSection } from "./Table.jsx";
import { MfgListingTableSection } from "./ListingTable.jsx";
import { MfgKpiExplorerSection } from "./KpiExplorer.jsx";
import { MfgBenchmarkSection } from "./Benchmark.jsx";
import { MfgReservationsSection } from "./Reservations.jsx";
import { MfgCompsetListSection, MfgCompsetSection } from "./Compset.jsx";
import { MfgMonthlyCompareSection } from "./MonthlyCompare.jsx";
import { MfgChecklistSection } from "./Checklist.jsx";

/* ------------------------------------------------------------------ */
/*  Client dashboard renderer — docs/client-dashboard-contract-v2.md   */
/*  Writers own WHAT (tabs/sections/values, pre-formatted strings);    */
/*  this code owns HOW IT LOOKS. Section types: tiles/chart/table/note.*/
/* ------------------------------------------------------------------ */

// Unknown section types are ignored per the contract.

export function MfgSection({ section, userEmail, isTeam }) {
  if (!section || typeof section !== "object") return null;
  if (section.type === "tiles") return <MfgTilesSection section={section} />;
  if (section.type === "chart") return <MfgChartSection section={section} />;
  if (section.type === "table") return <MfgTableSection section={section} />;
  if (section.type === "note") return <MfgNoteSection section={section} />;
  if (section.type === "heading") return <MfgHeadingSection section={section} />;
  if (section.type === "listingTable") return <MfgListingTableSection section={section} userEmail={userEmail} />;
  if (section.type === "kpiExplorer") return <MfgKpiExplorerSection section={section} />;
  if (section.type === "monthlyCompare") return <MfgMonthlyCompareSection section={section} />;
  if (section.type === "checklist") return <MfgChecklistSection section={section} isTeam={isTeam} />;
  if (section.type === "benchmark") return <MfgBenchmarkSection section={section} />;
  if (section.type === "compset") return <MfgCompsetSection section={section} />;
  if (section.type === "compsetList") return <MfgCompsetListSection section={section} />;
  if (section.type === "reservations") return <MfgReservationsSection section={section} isTeam={isTeam} />;
  return null;
}

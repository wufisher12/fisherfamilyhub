/* Shared by Revenue Tracking and the Company Overview P&L: the month
   labels, the default cost-of-services rows, the year chips and the
   money formatter. Data lives in hub/mfg-finance-{year}. */

export const FIN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const FIN_EMPLOYEES = [["rachel", "Rachel"], ["aida", "Aida"], ["jaimee", "Jaimee"]];

export function finYears() {
  // 2025 onward (2024 dropped, Mike 2026-10-05); the next year appears once
  // it is 3 months away.
  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
  const out = [];
  for (let y = 2025; y <= horizon.getFullYear(); y++) out.push(y);
  return out;
}
export const finMoney = (v, dash = "–") =>
  v == null || v === 0 ? dash : `$${Math.round(v).toLocaleString()}`;

// Clients who left the business: excluded when a new year's client list is
// started from the prior year. nashville: departed end of Oct 2026.
export const FIN_DEPARTED = ["nashville-vacation-homes"];

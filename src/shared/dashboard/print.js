// Shared print stylesheet: client screens, the team portal and the
// headless print mode all inject it once (id guard).
export function ensurePrintCss() {
  if (document.getElementById("mfg-print-css")) return;
  const style = document.createElement("style");
  style.id = "mfg-print-css";
  style.textContent = `@media print {
    @page { size: letter landscape; margin: 9mm; }
    body { background: #fff !important; }
    .mfg-noprint { display: none !important; }
    .mfg-print-area { zoom: 0.6; }
    .mfg-print-area * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .mfg-print-area .mfg-table-card { overflow: visible !important; border: none !important; }
    .mfg-print-title { display: flex !important; }
  }`;
  document.head.appendChild(style);
}

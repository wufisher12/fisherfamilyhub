import { useState, useEffect, useRef } from "react";
import { T } from "../../lib/theme.js";
import { PORTAL_PARAMS } from "../../lib/params.js";
import { MfgSection } from "./Section.jsx";
import { ensurePrintCss } from "./print.js";

/* Headless print mode (?print=<tabId>[:<subtabId,subtabId>]): renders a
   client document supplied by the host page as window.__PRINT_DOC__, one
   print block per requested subtab, each starting a new page. No auth and
   no Firestore: the weekly report script serves the built app locally with
   the published doc injected and lets Edge print it to PDF. */
// Letter page with 9mm margins, in CSS px (96/in): the printable box each
// block has to fit. Blocks lay out at the width that fills the page at the
// standard 0.6 print zoom; a block taller than its page gets a smaller zoom
// instead of spilling onto a second page.
const PRINT_ZOOM = 0.6;
const PRINT_PAGE = {
  landscape: { w: 988, h: 748, layoutW: 1640 },
  portrait: { w: 748, h: 988, layoutW: 1240 },
};

export function MfgPrintScreen() {
  const doc = window.__PRINT_DOC__;
  const spec = PORTAL_PARAMS.get("print") || "";
  const portraitIds = (PORTAL_PARAMS.get("portrait") || "").split(",").filter(Boolean);
  const [tabId, subSpec] = spec.split(":");
  const tab = (doc?.tabs || []).find((t) => t.id === tabId);
  const refs = useRef([]);
  const [zooms, setZooms] = useState(null);
  useEffect(() => {
    ensurePrintCss();
    if (!document.getElementById("mfg-print-pages")) {
      const style = document.createElement("style");
      style.id = "mfg-print-pages";
      style.textContent = "@page mfg-landscape { size: letter landscape; } @page mfg-portrait { size: letter portrait; }";
      document.head.appendChild(style);
    }
    const fit = () => {
      const next = refs.current.map((el) => {
        if (!el) return PRINT_ZOOM;
        const page = PRINT_PAGE[el.dataset.orient] || PRINT_PAGE.landscape;
        return Math.min(PRINT_ZOOM, Math.floor((page.h * 0.98 / el.offsetHeight) * 1000) / 1000);
      });
      setZooms(next);
      window.__PRINT_READY__ = true;
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fit);
  }, []);
  if (!doc || !tab) return <div style={{ padding: 20, fontFamily: "Inter, sans-serif" }}>Print document or tab not found.</div>;
  const wanted = subSpec ? subSpec.split(",") : null;
  const blocks = Array.isArray(tab.subtabs)
    ? tab.subtabs.filter((s) => !wanted || wanted.includes(s.id)).map((s) => ({ id: s.id, label: s.label, sections: s.sections }))
    : [{ id: tab.id, label: null, sections: tab.sections }];
  const asOf = typeof doc.updated === "number"
    ? new Date(doc.updated).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
  return (
    <div style={{ background: "#fff", fontFamily: "Inter, sans-serif" }}>
      {blocks.map((b, i) => {
        const orient = portraitIds.includes(b.id) ? "portrait" : "landscape";
        const page = PRINT_PAGE[orient];
        return (
          <div key={i} ref={(el) => { refs.current[i] = el; }} className="mfg-print-area" data-orient={orient}
            style={{ width: page.layoutW, margin: "0 auto", zoom: zooms ? zooms[i] : 1, page: `mfg-${orient}`,
              breakBefore: i > 0 ? "page" : "auto", pageBreakBefore: i > 0 ? "always" : "auto" }}>
            <div className="mfg-print-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, borderBottom: `3px solid ${T.ink}`, paddingBottom: 8 }}>
              <div>
                <span style={{ fontSize: 22, fontWeight: 800, color: T.ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{doc.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.inkSoft, marginLeft: 12 }}>{[tab.label, b.label].filter(Boolean).join(" · ")}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600 }}>{asOf ? `As of ${asOf} · ` : ""}Prepared by Mike Fisher Group</div>
            </div>
            {(b.sections || []).map((s, j) => <MfgSection key={j} section={s} userEmail="" isTeam={false} />)}
          </div>
        );
      })}
    </div>
  );
}

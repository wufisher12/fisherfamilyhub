import { PORTAL_PARAMS, IS_MFG_PORTAL } from "./lib/params.js";
import FamilyApp from "./family/FamilyApp.jsx";
import { MFGPortal } from "./portal/MFGPortal.jsx";
import { MfgPrintScreen } from "./shared/dashboard/PrintScreen.jsx";

/* Three doors, picked once from the URL at load:
   ?print=...   headless print mode (no auth, doc from window.__PRINT_DOC__)
   ?portal=mfg  the Mike Fisher Group portal (own login, own Firebase session)
   otherwise    the family app */
export default function App() {
  if (PORTAL_PARAMS.get("print")) {
    return <MfgPrintScreen />;
  }
  if (IS_MFG_PORTAL) {
    return <MFGPortal clientParam={PORTAL_PARAMS.get("client")} />;
  }
  return <FamilyApp />;
}

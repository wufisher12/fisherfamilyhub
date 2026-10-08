export const PORTAL_PARAMS = new URLSearchParams(window.location.search);
export const IS_MFG_PORTAL = PORTAL_PARAMS.get("portal") === "mfg";

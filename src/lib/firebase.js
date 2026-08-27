import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "../firebase-config.js";

// Family app instance
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Second, independent instance for the Mike Fisher Group portal —
// its login session never collides with the family session in another tab.
const mfgApp = getApps().find((a) => a.name === "mfg") || initializeApp(firebaseConfig, "mfg");
export const mfgAuth = getAuth(mfgApp);
export const mfgDb = getFirestore(mfgApp);

export const configured = firebaseConfig.projectId !== "PASTE_ME";

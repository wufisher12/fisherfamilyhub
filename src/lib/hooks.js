import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db, mfgDb } from "./firebase.js";

/* ------------------------------------------------------------------ */
/*  Responsive: true on desktop-width screens                          */
/* ------------------------------------------------------------------ */
export function useIsWide() {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 980px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 980px)");
    const fn = (e) => setWide(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return wide;
}

/* ------------------------------------------------------------------ */
/*  Firestore live-document hook                                       */
/*  Subscribes to a document; writes echo instantly on all devices.    */
/* ------------------------------------------------------------------ */
export function useHubDoc(path) {
  const [data, setData] = useState(undefined); // undefined = loading, null = missing
  useEffect(() => {
    setData(undefined); // reset when switching documents so stale data never leaks across days
    const ref = doc(db, "hub", path);
    const unsub = onSnapshot(
      ref,
      (snap) => setData(snap.exists() ? snap.data() : null),
      () => setData(null),
    );
    return unsub;
  }, [path]);
  const save = useCallback((value) => setDoc(doc(db, "hub", path), value), [path]);
  const remove = useCallback(() => deleteDoc(doc(db, "hub", path)), [path]);
  return [data, save, remove];
}

// Read-only live subscription on the portal's own app instance, so a
// client login's session (mfgAuth) is the one the rules evaluate.
export function useMfgHubDoc(path) {
  const [data, setData] = useState(undefined); // undefined = loading, null = missing
  useEffect(() => {
    if (!path) return;
    setData(undefined);
    const unsub = onSnapshot(
      doc(mfgDb, "hub", path),
      (snap) => setData(snap.exists() ? snap.data() : null),
      () => setData(null),
    );
    return unsub;
  }, [path]);
  return data;
}

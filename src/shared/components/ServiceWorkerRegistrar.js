"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return null;
}

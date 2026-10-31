"use client";

import { useEffect } from "react";

// A service worker lets the browser offer basic offline page loading after a visit.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration should not stop the planner from working.
      });
    }
  }, []);

  return null;
}

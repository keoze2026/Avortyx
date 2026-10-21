"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api/env";
import { isDemoMode } from "@/lib/demo/flag";

// Whether the platform is up, for the live strip: a real check, not a fixed label. The API has no
// health endpoint, so it asks the cheapest public one there is (the white-label config, a single
// lookup by host): any answer under 500, its 404 included, means the API and its database answered.
// A failure is checked again 5s later before the strip says "degraded", so one dropped request
// doesn't flip it. Checked once a minute while the tab is visible. "checking" until the first answer.

export type SystemStatus = "checking" | "operational" | "degraded";

const EVERY_MS = 60_000, RETRY_MS = 5_000, TIMEOUT_MS = 6_000;

async function reachable() {
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/api/white-label/config`, { cache: "no-store", credentials: "omit", signal: abort.signal });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>("checking");

  useEffect(() => {
    // a demo build answers no real calls
    if (isDemoMode()) return setStatus("operational");
    let live = true, timer = 0;
    const check = async (retry = false) => {
      if (document.hidden) return void (timer = window.setTimeout(check, EVERY_MS));
      const ok = await reachable();
      if (!live) return;
      if (ok || retry) setStatus(ok ? "operational" : "degraded");
      timer = window.setTimeout(() => check(!ok && !retry), ok || retry ? EVERY_MS : RETRY_MS);
    };
    check();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, []);

  return status;
}

"use client";

/**
 * Keeps the `site-blue` class on <html> in step with the site-accent store.
 * Renders nothing. The pre-paint script in app/layout.tsx sets the initial
 * class so there's no flash; this only handles changes after hydration.
 */

import * as React from "react";

import { SITE_BLUE_CLASS, useSiteAccentStore } from "@/lib/store/site-accent-store";

export function SiteAccentProvider() {
  const accent = useSiteAccentStore((s) => s.accent);

  React.useEffect(() => {
    document.documentElement.classList.toggle(SITE_BLUE_CLASS, accent === "blue");
  }, [accent]);

  return null;
}

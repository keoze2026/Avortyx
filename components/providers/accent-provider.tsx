"use client";

/**
 * Listens to the color-theme store and toggles the matching `.theme-*` class
 * on `<html>`. Renders nothing.
 *
 * Also wipes the inline CSS-variable overrides we previously set (back when
 * the picker only changed `--accent`) so legacy state from prior sessions
 * doesn't bleed into the new class-based scheme.
 */

import * as React from "react";

import { watchAccentFavicon } from "@/lib/accent-favicon";
import { ALL_THEME_CLASSES, DEFAULT_ACCENT_ID, findAccent } from "@/lib/accent-themes";
import { useAccentStore } from "@/lib/store/accent-store";

const LEGACY_INLINE_VARS = [
  "--accent",
  "--accent-foreground",
  "--primary",
  "--primary-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
  "--ring",
  "--chart-1",
];

export function AccentProvider() {
  const accent = useAccentStore((s) => s.accent);

  React.useEffect(() => {
    const cfg = findAccent(accent);
    const root = document.documentElement;

    // Wipe any inline overrides from earlier picker versions.
    for (const name of LEGACY_INLINE_VARS) root.style.removeProperty(name);

    // Drop every other theme class, then add the selected one (if any).
    for (const cls of ALL_THEME_CLASSES) root.classList.remove(cls);
    if (cfg.className) root.classList.add(cfg.className);

    // CH-457: the browser-tab icon in the same colour; CH-459: kept that way
    // when Next.js rewrites the head on a page change.
    return watchAccentFavicon(cfg, cfg.id === DEFAULT_ACCENT_ID);
  }, [accent]);

  return null;
}

"use client";

/**
 * Site accent toggle — Green (the landing page's palette, default) or Blue
 * (Avortyx's original brand colour).
 *
 * Writes the site-accent store, which owns the `site-blue` class on <html>
 * and therefore every marketing + auth surface. On each explicit choice it
 * also writes the product's own theme store, so the app follows the visitor
 * into the same colour — the same one-choice-moves-everything behaviour the
 * previous header toggle had.
 *
 * Styled in the landing page's own idiom: a rounded pill of baltic-sea
 * neutrals, the active swatch lit with the current accent.
 */

import { useAccentStore } from "@/lib/store/accent-store";
import { useSiteAccentStore, type SiteAccent } from "@/lib/store/site-accent-store";

const OPTIONS: Array<{ id: SiteAccent; label: string; swatch: string }> = [
  { id: "green", label: "Green accent", swatch: "oklch(70.64% 0.1 179.4)" },
  { id: "blue", label: "Blue accent", swatch: "oklch(72% 0.14 262)" },
];

export function ThemeColorSwitcher({ className = "" }: { className?: string } = {}) {
  const accent = useSiteAccentStore((s) => s.accent);
  const setSiteAccent = useSiteAccentStore((s) => s.setAccent);
  const setAppAccent = useAccentStore((s) => s.setAccent);

  const choose = (id: SiteAccent) => {
    setSiteAccent(id);
    // Product theme registry: "green" is its green theme, "default" is blue.
    setAppAccent(id === "green" ? "green" : "default");
  };

  return (
    <div
      role="group"
      aria-label="Accent colour"
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-900)]/80 p-1 backdrop-blur-md ${className}`}
    >
      {OPTIONS.map((o) => {
        const active = o.id === accent;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => choose(o.id)}
            aria-label={o.label}
            aria-pressed={active}
            title={o.label}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200 ${
              active ? "bg-[var(--color-baltic-sea-800)]" : "hover:bg-[var(--color-baltic-sea-800)]/60"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full transition-all duration-200"
              style={{
                background: o.swatch,
                opacity: active ? 1 : 0.45,
                boxShadow: active ? `0 0 10px ${o.swatch}` : "none",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

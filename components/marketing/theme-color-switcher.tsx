"use client";

/**
 * Site accent toggle — Blue (default) or Green.
 *
 * Writes to the same `useAccentStore` the in-app picker uses, so one choice
 * moves marketing, auth and the product together. `AccentProvider` owns the
 * class on <html>; this component only reads and sets the store.
 *
 * The registry carries more themes than these two. Marketing only defines a
 * green override, so any other selection renders on the blue base — the
 * "Blue" pill reflects that rather than showing nothing as active.
 */

import { useAccentStore } from "@/lib/store/accent-store";

const OPTIONS = [
  { id: "default", label: "Blue accent", swatch: "#1D4ED8" },
  { id: "green", label: "Green accent", swatch: "#12805C" },
] as const;

export function ThemeColorSwitcher({ onDark = false }: { onDark?: boolean } = {}) {
  const accent = useAccentStore((s) => s.accent);
  const setAccent = useAccentStore((s) => s.setAccent);

  return (
    <div
      role="group"
      aria-label="Accent colour"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 3,
        border: `1px solid ${onDark ? "rgba(255,255,255,0.20)" : "var(--m-line)"}`,
        borderRadius: 999,
        transition: "border-color 0.2s ease",
      }}
    >
      {OPTIONS.map((o) => {
        const active = o.id === "green" ? accent === "green" : accent !== "green";
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setAccent(o.id)}
            aria-label={o.label}
            aria-pressed={active}
            style={{
              width: 20,
              height: 20,
              padding: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: 999,
              border: `1px solid ${
                active ? (onDark ? "rgba(255,255,255,0.28)" : "var(--m-line-2)") : "transparent"
              }`,
              background: active
                ? onDark
                  ? "rgba(255,255,255,0.12)"
                  : "var(--m-bg-alt)"
                : "transparent",
              cursor: "pointer",
              transition: "background 0.15s ease, border-color 0.15s ease",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: o.swatch,
                opacity: active ? 1 : 0.4,
                transition: "opacity 0.15s ease",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

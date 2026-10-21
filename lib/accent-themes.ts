/**
 * Color-theme registry.
 *
 * Each entry maps to one of the `.theme-*` classes defined in globals.css.
 * Selecting an entry swaps the full palette — background, foreground, cards,
 * sidebar, borders, ring, accent, chart-1 — across both light and dark mode.
 * "Default" is the original Avortyx Indigo+slate look (no class applied).
 *
 * Gradient themes (aurora / sunset / ocean / plasma / ember) additionally
 * carry a `gradient` CSS string used by the swatch and exposed at runtime as
 * `--accent-gradient` for components that want to opt into the full sweep.
 */

export interface ColorTheme {
  /** Stable id stored in localStorage. */
  id: string;
  /** Human-readable label shown in the picker (English fallback). */
  name: string;
  /** Translation key for `name`. */
  nameKey: string;
  /** Background applied to the swatch dot. Either a solid color or a
   *  gradient string — both are valid CSS `background` values. */
  swatch: string;
  /** Class added to <html>. Empty string = use base :root/.dark tokens. */
  className: string;
  /** True for the new multi-stop palettes — used to render a contrasting
   *  ring/border on the picker. */
  gradient?: boolean;
}

export const ACCENTS: ColorTheme[] = [
  // ── Solid hues ──────────────────────────────────────────────
  // The two primary site themes lead the list. "default" keeps its id so
  // previously-persisted state still resolves; it is now Blue rather than
  // Indigo, and is the shipped default across marketing, auth and the app.
  { id: "default", name: "Blue", nameKey: "x2.accent.default", swatch: "#1D4ED8", className: "" },
  { id: "green", name: "Green", nameKey: "x2.accent.green", swatch: "#12805C", className: "theme-green-accent" },

  { id: "red", name: "Red", nameKey: "x2.accent.red", swatch: "#DC2626", className: "theme-red" },
  { id: "amber", name: "Amber", nameKey: "x2.accent.amber", swatch: "#F59E0B", className: "theme-amber" },
  { id: "emerald", name: "Emerald", nameKey: "x2.accent.emerald", swatch: "#10B981", className: "theme-emerald" },
  { id: "violet", name: "Violet", nameKey: "x2.accent.violet", swatch: "#8B5CF6", className: "theme-violet" },
  { id: "cyan", name: "Cyan", nameKey: "x2.accent.cyan", swatch: "#06B6D4", className: "theme-cyan" },
  { id: "rose", name: "Rose", nameKey: "x2.accent.rose", swatch: "#F43F5E", className: "theme-rose" },
  { id: "lime", name: "Lime", nameKey: "x2.accent.lime", swatch: "#84CC16", className: "theme-lime" },
  { id: "orange", name: "Orange", nameKey: "x2.accent.orange", swatch: "#F97316", className: "theme-orange" },
  { id: "sky", name: "Sky", nameKey: "x2.accent.sky", swatch: "#0EA5E9", className: "theme-sky" },
  { id: "teal", name: "Teal", nameKey: "x2.accent.teal", swatch: "#14B8A6", className: "theme-teal" },
  { id: "fuchsia", name: "Fuchsia", nameKey: "x2.accent.fuchsia", swatch: "#D946EF", className: "theme-fuchsia" },
  { id: "yellow", name: "Yellow", nameKey: "x2.accent.yellow", swatch: "#EAB308", className: "theme-yellow" },
  { id: "slate", name: "Slate", nameKey: "x2.accent.slate", swatch: "#64748B", className: "theme-slate" },
  { id: "mono", name: "Pure Black", nameKey: "x2.accent.mono", swatch: "#000000", className: "theme-mono" },

  // ── Gradient hues ───────────────────────────────────────────
  {
    id: "aurora",
    name: "Aurora",
    nameKey: "x2.accent.aurora",
    className: "theme-aurora",
    gradient: true,
    swatch: "linear-gradient(135deg, #14B8A6 0%, #6366F1 55%, #8B5CF6 100%)",
  },
  {
    id: "sunset",
    name: "Sunset",
    nameKey: "x2.accent.sunset",
    className: "theme-sunset",
    gradient: true,
    swatch: "linear-gradient(135deg, #F97316 0%, #F43F5E 55%, #EC4899 100%)",
  },
  {
    id: "ocean",
    name: "Ocean",
    nameKey: "x2.accent.ocean",
    className: "theme-ocean",
    gradient: true,
    swatch: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 55%, #4F46E5 100%)",
  },
  {
    id: "plasma",
    name: "Plasma",
    nameKey: "x2.accent.plasma",
    className: "theme-plasma",
    gradient: true,
    swatch: "linear-gradient(135deg, #D946EF 0%, #A855F7 55%, #6366F1 100%)",
  },
  {
    id: "ember",
    name: "Ember",
    nameKey: "x2.accent.ember",
    className: "theme-ember",
    gradient: true,
    swatch: "linear-gradient(135deg, #DC2626 0%, #F97316 55%, #F59E0B 100%)",
  },
];

export const DEFAULT_ACCENT_ID = "default";

export function findAccent(id: string | undefined): ColorTheme {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/** Every class we ever add — used by the provider to wipe stale state. */
export const ALL_THEME_CLASSES = ACCENTS.map((a) => a.className).filter(
  (c) => c.length > 0,
);

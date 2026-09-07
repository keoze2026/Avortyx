/**
 * Avortyx logo — vector mark (inline SVG).
 *
 * Three concentric arcs sweeping toward a bright core. The mark adapts to the
 * surface it sits on via `tone`:
 *   • "brand"   — theme accent ramp (follows the green/blue accent switcher)
 *   • "light"   — near-white, for dark backgrounds
 *   • "dark"    — near-black, for light backgrounds
 *   • "current" — inherits `currentColor` from the parent
 *
 * Brand tones read from the `--vortyx-*` theme variables so the mark tracks
 * the active accent rather than pinning a hard-coded hue.
 */

import { cn } from "@/lib/utils";

export type LogoTone = "brand" | "light" | "dark" | "current";

interface LogoProps {
  className?: string;
  /** Render the spin animation (e.g. hero, loading states) */
  animated?: boolean;
  /** Optional uid suffix when multiple instances exist on a page */
  uid?: string;
  /** Surface adaptation. Defaults to the brand accent ramp. */
  tone?: LogoTone;
}

const SOLID: Record<Exclude<LogoTone, "brand">, string> = {
  light: "#F2F5F3",
  dark: "#0C0F0D",
  current: "currentColor",
};

export function Logo({
  className,
  animated = false,
  uid = "root",
  tone = "brand",
}: LogoProps) {
  const gradId = `vortyx-grad-${uid}`;
  const coreId = `vortyx-core-${uid}`;

  const isBrand = tone === "brand";
  const stroke = isBrand ? `url(#${gradId})` : SOLID[tone];

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", animated && "animate-vortyx-spin", className)}
    >
      {isBrand && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--vortyx-bright, #3DD68C)" />
            <stop offset="55%" stopColor="var(--vortyx-teal, #12805C)" />
            <stop offset="100%" stopColor="var(--vortyx-deep, #0C6647)" />
          </linearGradient>
          <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--vortyx-ultra, #A7EFCB)" stopOpacity="0.9" />
            <stop offset="65%" stopColor="var(--vortyx-teal, #12805C)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--vortyx-teal, #12805C)" stopOpacity="0" />
          </radialGradient>
        </defs>
      )}

      {isBrand && <circle cx="32" cy="32" r="20" fill={`url(#${coreId})`} opacity="0.4" />}

      <path
        d="M52 32a20 20 0 1 1-13.2-18.8"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M44.5 32a12.5 12.5 0 1 1-8.9-11.9"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M38 32a6 6 0 1 1-4.2-5.7"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />

      <circle
        cx="32"
        cy="32"
        r="1.7"
        fill={isBrand ? "var(--vortyx-ultra, #A7EFCB)" : stroke}
      />
    </svg>
  );
}

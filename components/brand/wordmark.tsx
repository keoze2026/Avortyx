/**
 * Avortyx wordmark — logo + product name lock-up.
 *
 * `tone` adapts the whole lock-up to its surface:
 *   • "brand"   — accent mark, inherited text colour (default; light surfaces)
 *   • "light"   — near-white mark and text, for dark surfaces
 *   • "dark"    — near-black mark and text
 *   • "current" — both follow `currentColor`
 *
 * `gradient` renders the product name in the theme accent ramp. It follows the
 * active accent via the `--vortyx-*` variables rather than a fixed hue.
 */

import Link from "next/link";

import { Logo, type LogoTone } from "./logo";
import { BRAND, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  /** Pass `null` to render without a link wrapper (e.g. inside the auth card). */
  href?: string | null;
  size?: "sm" | "md" | "lg";
  /** Hide the product name (logo-only) */
  iconOnly?: boolean;
  /** Apply the brand gradient on the wordmark text (default true). */
  gradient?: boolean;
  uid?: string;
  /** Surface adaptation for the lock-up. */
  tone?: LogoTone;
}

const SIZE = {
  sm: { logo: "h-6 w-6", text: "text-sm tracking-tight" },
  md: { logo: "h-8 w-8", text: "text-xl tracking-tight" },
  lg: { logo: "h-10 w-10", text: "text-2xl tracking-tight" },
} as const;

/** Text colour per tone. `brand` inherits so the parent surface decides. */
const TEXT_COLOR: Record<LogoTone, string | undefined> = {
  brand: undefined,
  light: "#F2F5F3",
  dark: "#0C0F0D",
  current: "currentColor",
};

const GRADIENT_TEXT = {
  background:
    "linear-gradient(120deg, var(--vortyx-bright, #3DD68C) 0%, var(--vortyx-teal, #12805C) 55%, var(--vortyx-deep, #0C6647) 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
} as const;

export function Wordmark({
  className,
  href = ROUTES.home,
  size = "md",
  iconOnly = false,
  gradient = true,
  uid,
  tone = "brand",
}: WordmarkProps) {
  const s = SIZE[size];

  // A toned lock-up is explicitly monochrome — the gradient would fight it.
  const useGradient = gradient && tone === "brand";

  const content = (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo className={s.logo} uid={uid} tone={tone} />
      {!iconOnly && (
        <span
          className={cn("font-semibold", s.text)}
          style={
            useGradient
              ? GRADIENT_TEXT
              : { color: TEXT_COLOR[tone], transition: "color 0.2s ease" }
          }
        >
          {BRAND.name}
        </span>
      )}
    </span>
  );

  return href ? (
    <Link href={href} aria-label={BRAND.name} style={{ textDecoration: "none" }}>
      {content}
    </Link>
  ) : (
    content
  );
}

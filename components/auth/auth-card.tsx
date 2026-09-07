/**
 * Centered card frame used by login / signup / forgot-password.
 *
 * Designed to live on top of the auth layout's vortex canvas: stronger
 * glass (`bg-card/85 backdrop-blur-2xl`), accent-tinted hairline border, a
 * subtle top-down gradient sheen, and a soft shadow that picks up the brand
 * color so the card harmonizes with the orbital glow behind it. Works the
 * same in light and dark mode because every value is theme-aware.
 */

import * as React from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthCard({ title, description, children, footer, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-accent/20 bg-card/85 p-9 backdrop-blur-2xl",
        // Layered shadow: a deep neutral drop for elevation, plus a soft accent
        // glow so the card reads as part of the same atmosphere as the vortex
        // behind it. The drop is green-black, not the old indigo-era navy.
        "shadow-[0_30px_80px_-40px_rgba(6,14,11,0.55),0_0_44px_-18px_color-mix(in_oklch,var(--accent)_50%,transparent)]",
        className,
      )}
    >
      {/* Lit top edge — a single accent hairline reads as precision rather
          than ornament, and ties the card to the orbital glow behind it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)",
        }}
      />

      {/* Subtle top-down sheen — gives the card a hint of dimensional
          gloss without distracting from the form below it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-accent/[0.10] to-transparent"
      />

      <div className="relative">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <Wordmark href={null} iconOnly size="md" uid="auth" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        {children}

        {footer && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

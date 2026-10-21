import Link from "next/link";
import { cn } from "@/lib/utils";

// the Avortyx mark: three open rings around a dot, in the brand gradient. `id` keeps each
// copy's gradient ids unique when several marks share a page. Other SVG attributes pass through
// (x, y, width, height place it inside another SVG). The rings carry classes (.mark-rings,
// .mark-ring) so a page can set them turning (.mark-orbit, globals.css).
export function AvortyxMark({ id, className, ...rest }: { id: string; className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true" className={className} {...rest}>
      <defs>
        <linearGradient id={`vortyx-grad-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--vortyx-bright, #93c5fd)" />
          <stop offset="55%" stopColor="var(--vortyx-teal, #3b82f6)" />
          <stop offset="100%" stopColor="var(--vortyx-deep, #1739a8)" />
        </linearGradient>
        <radialGradient id={`vortyx-core-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--vortyx-ultra, #dbeafe)" stopOpacity="0.9" />
          <stop offset="65%" stopColor="var(--vortyx-teal, #3b82f6)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--vortyx-teal, #3b82f6)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="20" fill={`url(#vortyx-core-${id})`} opacity="0.4" />
      <g className="mark-rings">
        <path className="mark-ring" d="M52 32a20 20 0 1 1-13.2-18.8" stroke={`url(#vortyx-grad-${id})`} strokeWidth="3" strokeLinecap="round" />
        <path className="mark-ring" d="M44.5 32a12.5 12.5 0 1 1-8.9-11.9" stroke={`url(#vortyx-grad-${id})`} strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
        <path className="mark-ring" d="M38 32a6 6 0 1 1-4.2-5.7" stroke={`url(#vortyx-grad-${id})`} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      </g>
      <circle cx="32" cy="32" r="1.7" fill="var(--vortyx-ultra, #dbeafe)" />
    </svg>
  );
}

// the mark with the wordmark beside it, linking home
export function AvortyxLogo({ id, size = "lg" }: { id: string; size?: "lg" | "md" }) {
  return (
    // no prefetch: "/" only redirects to the sign-in screen, so prefetching it is a wasted request
    <Link href="/" prefetch={false} aria-label="Avortyx" style={{ textDecoration: "none" }}>
      <span className="flex items-center gap-2">
        <AvortyxMark id={id} className={size === "lg" ? "h-10 w-10" : "h-8 w-8"} />
        <span
          className={cn("font-semibold tracking-tight", size === "lg" ? "text-[22px]" : "text-[18px]")}
          style={{
            background: "linear-gradient(120deg, var(--vortyx-bright, #93c5fd) 0%, var(--vortyx-teal, #3b82f6) 55%, var(--vortyx-deep, #1739a8) 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          Avortyx
        </span>
      </span>
    </Link>
  );
}

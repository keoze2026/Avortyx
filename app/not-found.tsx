import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, Radio, RotateCcw, Search } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { REQUEST_ACCESS_HREF } from "@/lib/portal-access";
import { cn } from "@/lib/utils";

/**
 * Is this request on the public site (avortyx.com) rather than the portal?
 * With PORTAL_HOSTS set (see proxy.ts), every host not in that list is the
 * public site - where the portal must not be advertised, so its buttons
 * (Dashboard, Live Monitor) are not shown there.
 */
async function onPublicSite(): Promise<boolean> {
  const portalHosts = (process.env.PORTAL_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (portalHosts.length === 0) return false; // no split: one site, keep the portal buttons
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  return !portalHosts.includes(host);
}

export default async function NotFound() {
  const publicSite = await onPublicSite();
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(circle at center, var(--vortyx-glow), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-hex-dot opacity-30"
        style={{
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 25%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, black 25%, transparent 80%)",
        }}
      />

      <div className="relative z-10 w-full max-w-2xl">
        {/* HUD bracket card */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-md sm:p-12">
          {/* Top accent rule + crosshairs */}
          <div aria-hidden className="absolute inset-x-8 top-0 h-px edge-rule-top" />
          <Crosshair className="left-3 top-3" />
          <Crosshair className="right-3 top-3" />
          <Crosshair className="left-3 bottom-3" />
          <Crosshair className="right-3 bottom-3" />

          <div className="relative text-center">
            {/* Brand */}
            <div className="flex justify-center">
              <Wordmark size="md" uid="404" />
            </div>

            {/* Status chip */}
            <div className="mt-7 inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-destructive">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              signal lost
            </div>

            {/* Big numerals */}
            <div className="mt-4 flex items-baseline justify-center gap-2 font-mono">
              <span className="text-7xl font-bold leading-none tracking-tight tabular-nums sm:text-[120px]">
                404
              </span>
            </div>

            <h1 className="mt-4 text-lg font-semibold tracking-tight sm:text-xl">
              Route not on the network
            </h1>
            <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist, was moved, or never made
              it to production. Pick a route below to get back to mission control.
            </p>

            {/* Actions */}
            <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
              {publicSite ? (
                <>
                  {/* Public site: only ways back to the website - never the portal. */}
                  <Link href={ROUTES.home}>
                    <Button size="sm" className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> Home
                    </Button>
                  </Link>
                  <Link href={REQUEST_ACCESS_HREF}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5" /> Request access
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href={ROUTES.dashboard}>
                    <Button size="sm" className="gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5" />
                      Dashboard
                    </Button>
                  </Link>
                  <Link href={ROUTES.live}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Radio className="h-3.5 w-3.5" /> Live Monitor
                    </Button>
                  </Link>
                  <Link href={ROUTES.home}>
                    <Button size="sm" variant="ghost" className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> Home
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Coordinate footer */}
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-border/50 pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <div className="text-left">
                <div className="text-muted-foreground/60">err</div>
                <div className="text-foreground/85">HTTP/1.1 404</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground/60">node</div>
                <div className="text-foreground/85">us-east · edge</div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground/60">trace</div>
                <div className="inline-flex items-center gap-1 text-foreground/85">
                  <Search className="h-2.5 w-2.5" />
                  vrtyx_404
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Crosshair({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute h-2.5 w-2.5",
        "before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:-translate-x-1/2 before:bg-accent/55",
        "after:absolute after:left-0 after:top-1/2 after:h-px after:w-full after:-translate-y-1/2 after:bg-accent/55",
        className,
      )}
    />
  );
}
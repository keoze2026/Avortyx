"use client";

import { cn } from "@/lib/utils";

/**
 * The LIVE cell on the campaign page (CH-212): calls up right now, and for a
 * destination its concurrency cap ("2 / 5"). Same look as the Destinations
 * page's LIVE column: amber near the cap, red at it. A cap of 0 means no cap
 * and only the count is shown. "—" until the first count arrives.
 */
export function LiveBadge({
  live,
  cap,
  loaded,
}: {
  live: number;
  cap?: number;
  loaded: boolean;
}) {
  const hasCap = typeof cap === "number" && cap > 0;
  const pct = hasCap ? live / cap : 0;
  return (
    <span
      className={cn(
        "inline-flex min-w-[3rem] items-center justify-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[10.5px] font-medium tabular-nums",
        live > 0 && !hasCap && "text-[color:var(--success)]",
        hasCap && live > 0 && pct < 0.85 && "text-[color:var(--success)]",
        hasCap && pct >= 0.85 && pct < 1 && "text-[color:var(--warning)]",
        hasCap && pct >= 1 && "text-destructive",
      )}
    >
      {!loaded ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <>
          <span>{live}</span>
          {hasCap && (
            <>
              <span className="opacity-50">/</span>
              <span>{cap}</span>
            </>
          )}
        </>
      )}
    </span>
  );
}

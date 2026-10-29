"use client";

import { cn } from "@/lib/utils";

/**
 * The LIVE cell on the campaign page (CH-212): calls up right now, and for a
 * destination its concurrency cap ("2 / 5"). Same look as the Destinations
 * page's LIVE column: one colour, even when the CC is full (CH-391). A cap of 0 means no cap
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
  return (
    <span
      className={cn(
        "inline-flex min-w-[3rem] items-center justify-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[10.5px] font-medium tabular-nums",
        // CH-391 (Sir, 29 Oct: "Once CC is full like 1/1 keep the same white
        // colour"): one colour always - a full CC is normal while calls are live.
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

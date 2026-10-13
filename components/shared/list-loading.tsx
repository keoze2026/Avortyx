/**
 * Placeholder shown while a list page's data is still loading (e.g. right
 * after a refresh). Without it, Campaigns and Buyers flashed their empty
 * state ("No campaigns yet") for a moment before the real rows arrived.
 * When loading failed, it shows the error and a Try again button instead.
 */

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ListLoading({
  rows = 5,
  error,
  onRetry,
}: {
  rows?: number;
  /** Set when loading failed: show it with a retry button instead of the skeleton. */
  error?: string | null;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load this list.</p>
        <p className="max-w-md text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        {[10, 22, 14, 10, 10, 10].map((w, i) => (
          <Skeleton key={i} className="h-3 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-b-0">
          {[10, 22, 14, 10, 10, 10].map((w, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ width: `${w}%`, opacity: 1 - r * 0.12 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

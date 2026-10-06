/**
 * A tiny bridge between the HTTP layer and the security store.
 *
 * When the backend answers "423 reports_pin_required" to ANY request, http.ts
 * calls `emitReportsLocked()`. The security store listens and flips the whole
 * app to "locked". This keeps http.ts free of store imports (no import cycle)
 * and means every screen reacts, not only the Reports page.
 */
type Listener = () => void;

let listener: Listener | null = null;

export function onReportsLocked(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function emitReportsLocked(): void {
  listener?.();
}

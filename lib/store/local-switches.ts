/**
 * Play / pause clicked on this screen that the server may not have caught up
 * with yet (CH-268, Sir 23 Oct: "select all campaigns and pause all at once -
 * 2-3 campaigns show live for 5-10 sec, then settle down to paused").
 *
 * The app re-loads the campaign list every 15 seconds. A load that left before
 * the click, or that the server answered before every pause had landed, came
 * back with the OLD status and flipped those rows back to live until the next
 * load. A load now keeps what was clicked here while it is on its way.
 *
 * Destinations have had the same guard since 10 Oct (destinations-store).
 */
export function createLocalSwitches() {
  const lastChange = new Map<string, number>(); // id -> when it was last switched here
  const inFlight = new Map<string, number>(); // id -> requests still running for it

  return {
    /** These rows are being switched here now; keep them until `end`. */
    start(ids: Iterable<string>) {
      const now = Date.now();
      for (const id of ids) {
        lastChange.set(id, now);
        inFlight.set(id, (inFlight.get(id) ?? 0) + 1);
      }
    },
    end(ids: Iterable<string>) {
      const now = Date.now();
      for (const id of ids) {
        lastChange.set(id, now);
        const left = (inFlight.get(id) ?? 1) - 1;
        if (left > 0) inFlight.set(id, left);
        else inFlight.delete(id);
      }
    },
    /** Was this row switched here after `since`, or is a switch for it still on its way? */
    changedSince(id: string, since: number): boolean {
      return inFlight.has(id) || (lastChange.get(id) ?? 0) >= since;
    },
  };
}

/** Run `work` over `items`, at most `limit` at a time (the server allows 20 requests in flight per IP). */
export async function inBatches<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++];
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

export interface ManyResult {
  ok: string[];
  failed: { id: string; message: string }[];
}

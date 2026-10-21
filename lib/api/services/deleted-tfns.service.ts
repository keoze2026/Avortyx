/**
 * The "TFNs deleted" notice - /api/notifications/deleted-tfns (backend CH-179).
 *
 * TFNs the platform retired (used, time limit, nightly answered-call rule)
 * since this user last clicked Seen. Seen is stored on the server per user,
 * so the notice stays on every device until it is acknowledged.
 */
import { http } from "@/lib/api/http";

export interface DeletedTfn {
  id: string;
  number: string;
  name: string;
  carrierCode: string;
  reason: string;
  retiredAt: string;
  /** Retired before this user last clicked Seen (backend CH-182). */
  seen?: boolean;
}

export interface DeletedTfnsNotice {
  /** Backend CH-182: everything listed until 12 PM Eastern, seen or not. */
  count: number;
  /** Backend CH-182: retired since this user last clicked Seen. Drives the
   *  bell badge, the banner and the Seen button. */
  unseenCount: number;
  numbers: DeletedTfn[];
  seenAt: string | null;
  /** The newest retirement in `numbers`; sent back with Seen. */
  newestAt: string | null;
}

const EMPTY: DeletedTfnsNotice = { count: 0, unseenCount: 0, numbers: [], seenAt: null, newestAt: null };

function normalise(w: Partial<DeletedTfnsNotice> | null | undefined): DeletedTfnsNotice {
  if (!w) return EMPTY;
  return {
    count: typeof w.count === "number" ? w.count : 0,
    // An older backend sends no unseen_count: there, count meant "unseen".
    unseenCount:
      typeof w.unseenCount === "number" ? w.unseenCount : typeof w.count === "number" ? w.count : 0,
    numbers: Array.isArray(w.numbers) ? w.numbers : [],
    seenAt: w.seenAt ?? null,
    newestAt: w.newestAt ?? null,
  };
}

export const deletedTfnsService = {
  async get(): Promise<DeletedTfnsNotice> {
    return normalise(await http.get<DeletedTfnsNotice>("/api/notifications/deleted-tfns"));
  },
  /** Acknowledge everything up to `upTo` (the newest retirement the user saw). */
  async markSeen(upTo: string | null): Promise<DeletedTfnsNotice> {
    return normalise(
      await http.post<DeletedTfnsNotice>("/api/notifications/deleted-tfns/seen", {
        body: upTo ? { upTo } : {},
      }),
    );
  },
};

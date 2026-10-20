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
}

export interface DeletedTfnsNotice {
  count: number;
  numbers: DeletedTfn[];
  seenAt: string | null;
  /** The newest retirement in `numbers`; sent back with Seen. */
  newestAt: string | null;
}

const EMPTY: DeletedTfnsNotice = { count: 0, numbers: [], seenAt: null, newestAt: null };

function normalise(w: Partial<DeletedTfnsNotice> | null | undefined): DeletedTfnsNotice {
  if (!w) return EMPTY;
  return {
    count: typeof w.count === "number" ? w.count : 0,
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

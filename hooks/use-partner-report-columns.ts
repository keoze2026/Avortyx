"use client";

/**
 * Which Reports columns a BUYER or PUBLISHER login must not see.
 *
 * The admin unticks columns under the partner's Reporting visibility. This
 * hook finds the partner's allowed list and turns it into the Reports columns
 * to hide. Admin / staff logins: nothing is hidden, ever.
 *
 * Where the list comes from (first one that answers wins):
 *   1. /api/accounts/me `visible_report_columns`. The backend builds it, but
 *      the /me response schema doesn't declare it, so today it never arrives.
 *      Kept first so it takes over the day the backend adds it.
 *   2. The partner's own settings: the scoped /api/publishers (or /api/buyers)
 *      list gives the partner login its own record, and
 *      /api/accounts/{kind}/{id}/settings gives its `visible_report_columns`,
 *      the same list the admin edits.
 *
 * An empty list means "nothing visible" (all 12 unticked), not "no limit".
 * The list is re-read each time Reports / Dashboard opens (at most every
 * 30 seconds), so a change the admin makes shows without logging out.
 *
 * Each Reports column follows one backend key. Where the backend has a more
 * specific key (e.g. `tcl`) that one decides; otherwise the general one does.
 */

import * as React from "react";

import { http } from "@/lib/api/http";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePartnerSettingsStore } from "@/lib/store/partner-settings-store";

/** Call Summary column -> backend keys, most specific first. */
const SUMMARY_KEYS: Record<string, string[]> = {
  incoming: ["incoming"],
  connected: ["connected"],
  qualified: ["qualified"],
  paid: ["paid", "converted"],
  converted: ["converted"],
  conversionRate: ["conversion_rate", "converted"],
  noConnect: ["not_connected"],
  dupe: ["duplicate"],
  tcl: ["tcl", "duration"],
  acl: ["acl", "duration"],
  payout: ["payout"],
  revenue: ["revenue"],
  profit: ["profit", "revenue"],
  cost: ["cost", "payout"],
};

/** Call Log column -> backend keys, most specific first. */
const LOG_KEYS: Record<string, string[]> = {
  repeated: ["duplicate"],
  revenue: ["revenue"],
  payout: ["payout"],
  duration: ["duration", "tcl"],
  ttc: ["ttc", "duration"],
  failReason: ["fail_reason"],
  recording: ["recording"],
};

/** The 12 Reporting visibility keys the backend has. Known even if the catalogue can't be read. */
const BACKEND_KEYS = [
  "incoming",
  "connected",
  "qualified",
  "converted",
  "duplicate",
  "duration",
  "not_connected",
  "tcl",
  "acl",
  "cost",
  "payout",
  "revenue",
];

const REFRESH_MS = 30_000;

type Cached = { userId: string; at: number; list: string[] | null };
let cached: Cached | null = null;

/*
 * The last allowed list is also kept on the device (Sir, 23 Oct: the publisher
 * and buyer Reports "refresh issue"). In memory alone it was lost on every page
 * refresh, and until three requests in a row had answered, the Call Summary
 * showed nothing but the Live column. Now a refresh starts from the list this
 * login last had - the admin's latest choice still replaces it within seconds.
 */
const STORE_KEY = "avortyx.partnerReportColumns";

function readStored(userId: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { userId?: string; list?: unknown };
    return v.userId === userId ? asList(v.list) : null;
  } catch {
    return null;
  }
}

function writeStored(userId: string, list: string[]): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ userId, list }));
  } catch {
    /* private mode or full storage: memory is enough */
  }
}
let inflight: { userId: string; promise: Promise<string[] | null> } | null = null;

const asList = (v: unknown): string[] | null => (Array.isArray(v) ? v.map(String) : null);

/** The partner login's own buyer / publisher id, from the list the backend scopes to it. */
async function ownPartnerId(kind: "buyer" | "publisher"): Promise<string | null> {
  const res = await http.get<unknown>(`/api/${kind}s?page=1&page_size=5`);
  const rows = Array.isArray(res)
    ? res
    : ((res as { items?: unknown[]; results?: unknown[] } | null)?.items ??
       (res as { results?: unknown[] } | null)?.results ??
       []);
  const first = rows[0] as { id?: unknown } | undefined;
  return first?.id ? String(first.id) : null;
}

/** The allowed backend keys for the signed-in partner, or null = couldn't find out. */
async function readAllowed(kind: "buyer" | "publisher"): Promise<string[] | null> {
  try {
    const me = await http.get<{ visibleReportColumns?: unknown }>("/api/accounts/me");
    const fromMe = asList(me?.visibleReportColumns);
    if (fromMe) return fromMe;
  } catch {
    /* fall through to the settings read */
  }
  try {
    const id = await ownPartnerId(kind);
    if (!id) return null;
    const s = await http.get<{ visibleReportColumns?: unknown }>(`/api/accounts/${kind}/${id}/settings`);
    return asList(s?.visibleReportColumns);
  } catch {
    return null;
  }
}

function loadAllowed(userId: string, kind: "buyer" | "publisher"): Promise<string[] | null> {
  if (inflight && inflight.userId === userId) return inflight.promise;
  const promise = readAllowed(kind)
    .then((list) => {
      if (list) {
        cached = { userId, at: Date.now(), list };
        writeStored(userId, list);
      }
      return list;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { userId, promise };
  return promise;
}

function hiddenFrom(map: Record<string, string[]>, known: Set<string>, allowed: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const [column, keys] of Object.entries(map)) {
    const decider = keys.find((k) => known.has(k));
    if (decider && !allowed.has(decider)) out.add(column);
  }
  return out;
}

const NONE = { summary: new Set<string>(), log: new Set<string>() };

export function usePartnerHiddenColumns(): { summary: ReadonlySet<string>; log: ReadonlySet<string> } {
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id) ?? "";
  const kind = role === "buyer" || role === "publisher" ? role : null;
  const catalogue = usePartnerSettingsStore((s) => s.catalogue);
  const fetchCatalogue = usePartnerSettingsStore((s) => s.fetchCatalogue);

  // The device copy is read in the effect below, not here: reading storage
  // during the first render would differ from the server's render.
  const fresh = cached && cached.userId === userId ? cached.list : null;
  // undefined = still looking; null = couldn't find out; array = the allowed keys.
  const [allowed, setAllowed] = React.useState<string[] | null | undefined>(fresh ?? undefined);

  React.useEffect(() => {
    if (!kind || !userId) return;
    let alive = true;
    void fetchCatalogue();
    const stored = cached && cached.userId === userId ? null : readStored(userId);
    if (stored) cached = { userId, at: 0, list: stored }; // shown now, re-read below
    const have = cached && cached.userId === userId ? cached : null;
    if (have) setAllowed(have.list);
    if (!have || Date.now() - have.at > REFRESH_MS) {
      void loadAllowed(userId, kind).then((list) => {
        if (!alive) return;
        // A failed refresh keeps the last good list rather than showing everything.
        setAllowed(list ?? (have ? have.list : null));
      });
    }
    return () => {
      alive = false;
    };
  }, [kind, userId, fetchCatalogue]);
  

  return React.useMemo(() => {
    if (!kind) return NONE;
    const known = new Set<string>([...BACKEND_KEYS, ...(catalogue?.reportColumns ?? []).map((c) => c.key)]);
    // Still looking: keep everything hidden so nothing unticked flashes up first.
    // Couldn't find out at all: fall back to showing them (the old behaviour).
    if (allowed === null) return NONE;
    const ok = new Set(allowed ?? []);
    return { summary: hiddenFrom(SUMMARY_KEYS, known, ok), log: hiddenFrom(LOG_KEYS, known, ok) };
  }, [kind, allowed, catalogue]);
}
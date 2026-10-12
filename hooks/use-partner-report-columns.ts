"use client";

/**
 * Which Reports columns a BUYER or PUBLISHER login must not see.
 *
 * The admin unticks columns under the partner's Reporting visibility; the
 * backend sends the allowed list on /api/accounts/me as
 * `visible_report_columns`. This hook reads that list (once per session) and
 * turns it into the Reports columns to hide. Admin / staff logins: nothing is
 * hidden, ever.
 *
 * Each Reports column follows one backend key. Where the backend has a more
 * specific key (e.g. `tcl`) that one decides; otherwise the general one does
 * (TCL and ACL follow `duration` until the backend has `tcl` / `acl`).
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
  revenue: ["revenue"],
  payout: ["payout"],
  duration: ["duration", "tcl"],
  ttc: ["ttc", "duration"],
  failReason: ["fail_reason"],
  recording: ["recording"],
};

let allowedPromise: Promise<string[] | null> | null = null;
let allowedFor: string | null = null;

/** The allowed backend keys for the signed-in partner, or null = no limit known. */
function loadAllowed(userId: string): Promise<string[] | null> {
  if (allowedPromise && allowedFor === userId) return allowedPromise;
  allowedFor = userId;
  allowedPromise = http
    .get<{ visibleReportColumns?: unknown }>("/api/accounts/me")
    .then((me) => (Array.isArray(me?.visibleReportColumns) ? me.visibleReportColumns.map(String) : null))
    .catch(() => {
      allowedPromise = null;
      return null;
    });
  return allowedPromise;
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
  const isPartner = role === "buyer" || role === "publisher";
  const catalogue = usePartnerSettingsStore((s) => s.catalogue);
  const fetchCatalogue = usePartnerSettingsStore((s) => s.fetchCatalogue);
  const [allowed, setAllowed] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    if (!isPartner || !userId) return;
    let alive = true;
    void fetchCatalogue();
    void loadAllowed(userId).then((list) => {
      if (alive) setAllowed(list);
    });
    return () => {
      alive = false;
    };
  }, [isPartner, userId, fetchCatalogue]);

  return React.useMemo(() => {
    if (!isPartner || !allowed || !catalogue) return NONE;
    const known = new Set(catalogue.reportColumns.map((c) => c.key));
    const ok = new Set(allowed);
    return { summary: hiddenFrom(SUMMARY_KEYS, known, ok), log: hiddenFrom(LOG_KEYS, known, ok) };
  }, [isPartner, allowed, catalogue]);
}

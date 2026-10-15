/**
 * Is this caller on the Blocked Numbers list?
 *
 * Shared by the Call Log on Reports and the Call Logs page, so a blocked
 * caller shows in red in both.
 *
 * Numbers are compared on their national form. A caller is often stored
 * without the country code ("7194683580") while the Blocked Numbers list
 * holds it with one ("17194683580"); comparing the raw digits never matched,
 * so a number blocked a minute ago never turned red in the call log.
 */
"use client";

import * as React from "react";

import { useBlockedNumbersStore } from "@/lib/store/blocked-numbers-store";

type Entry = { number: string; scope: "number" | "prefix"; campaignId?: string };

/** Digits only, with the leading US/Canada "1" dropped from 11-digit numbers. */
function national(value: string | null | undefined): string {
  const d = (value ?? "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

/** Matcher for the Blocked Numbers list. Exact entries match the number;
 *  prefix entries match any caller whose number starts with them (with or
 *  without the leading "1"). Campaign-scoped entries only apply to calls on
 *  that campaign. */
export function makeBlockedMatcher(entries: Entry[]): (callerNumber: string, campaignId?: string) => boolean {
  if (entries.length === 0) return () => false;
  const exact = new Map<string, Set<string | undefined>>();
  const prefixes: Array<{ digits: string; campaignId?: string }> = [];
  for (const e of entries) {
    const raw = e.number.replace(/\D/g, "");
    if (!raw) continue;
    if (e.scope === "prefix") {
      prefixes.push({ digits: raw, campaignId: e.campaignId });
    } else {
      const key = national(raw);
      const set = exact.get(key) ?? new Set<string | undefined>();
      set.add(e.campaignId);
      exact.set(key, set);
    }
  }
  const applies = (scopeCampaign: string | undefined, campaignId: string | undefined) =>
    scopeCampaign === undefined || scopeCampaign === campaignId;
  return (callerNumber, campaignId) => {
    const nat = national(callerNumber);
    if (!nat) return false;
    const set = exact.get(nat);
    if (set && [...set].some((c) => applies(c, campaignId))) return true;
    const withOne = nat.length === 10 ? `1${nat}` : nat;
    return prefixes.some(
      (p) => (withOne.startsWith(p.digits) || nat.startsWith(p.digits)) && applies(p.campaignId, campaignId),
    );
  };
}

/** The matcher for the current Blocked Numbers list; updates as numbers are blocked or unblocked. */
export function useBlockedCallerMatcher(): (callerNumber: string, campaignId?: string) => boolean {
  const numbers = useBlockedNumbersStore((s) => s.numbers);
  return React.useMemo(() => makeBlockedMatcher(numbers), [numbers]);
}

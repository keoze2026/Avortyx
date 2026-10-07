"use client";

/**
 * Searching calls by phone number - the same everywhere (Reports > Call log,
 * the Call Logs page).
 *
 * Why a visible number used to find "No matching calls": the table SHOWS
 * caller IDs with the leading 1 ("19196360344") while the data STORES many of
 * them without it ("9196360344"), and the search compared the typed text with
 * the stored value. Numbers are now compared on their digits, with or without
 * the leading 1, in any format.
 *
 * And a number is also sent to the server (GET /api/analytics/calls?search=),
 * which searches the whole log rather than only the rows the page holds. Names
 * (campaign, buyer, publisher) stay an instant on-screen filter: the server
 * search only matches numbers.
 */

import { useEffect, useRef, useState } from "react";

import { analyticsService, type CallLogQuery } from "@/lib/api/services/analytics.service";
import type { Call } from "@/lib/types";

export const SERVER_SEARCH_DEBOUNCE_MS = 350;

const digitsOf = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Looks like a phone number (only digits and + ( ) - . spaces) with at least 4 digits. */
export function isNumberQuery(query: string): boolean {
  const q = query.trim();
  return /^[\d\s()+.\-]+$/.test(q) && digitsOf(q).length >= 4;
}

/** Does this stored number match the typed one, ignoring format and a leading US "1"? */
export function numberMatches(stored: string | null | undefined, query: string): boolean {
  const d = digitsOf(stored);
  const q = digitsOf(query);
  if (!d || q.length < 4) return false;
  const wanted = [q];
  if (q.length === 11 && q.startsWith("1")) wanted.push(q.slice(1));
  const have = [d];
  if (d.length === 10) have.push(`1${d}`);
  return have.some((h) => wanted.some((w) => h.includes(w)));
}

/** Any of the call's numbers (caller, dialled, destination) matches. */
export function callNumberMatches(c: Call, query: string): boolean {
  return [c.callerNumber, c.calledNumber, c.destinationNumber].some((n) => numberMatches(n, query));
}

/**
 * The on-screen filter: names / text as typed, plus numbers in any format.
 * `text` is the searchable text of the row (campaign, buyer, ...).
 */
export function callMatches(c: Call, query: string, text: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q) || callNumberMatches(c, q);
}

/**
 * When a phone number is typed, ask the server to search the whole log within
 * `base` (the page's dates and filters). Debounced; a newer search discards an
 * older answer. `results` is null until the server has answered for exactly
 * this query - callers show their instant on-screen matches until then.
 * Pass `base = null` to turn it off (for example while the range is locked).
 */
export function useServerCallSearch(
  base: Omit<CallLogQuery, "page" | "pageSize" | "search"> | null,
  query: string,
  timeZone: string,
): { results: Call[] | null; searching: boolean } {
  const q = query.trim();
  const key = base && isNumberQuery(q) ? JSON.stringify([base, q, timeZone]) : "";
  const [answer, setAnswer] = useState<{ key: string; results: Call[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!key) {
      seq.current += 1;
      setSearching(false);
      return;
    }
    const mine = ++seq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      analyticsService
        .allCalls({ ...(base ?? {}), search: q }, { timeZone })
        .then((items) => {
          if (mine !== seq.current) return; // a newer search replaced this one
          // Kept to real number matches, so a server that ignored `search`
          // could never show the whole log as "results".
          setAnswer({ key, results: items.filter((c) => callNumberMatches(c, q)) });
        })
        .catch(() => {
          /* keep showing the on-screen matches */
        })
        .finally(() => {
          if (mine === seq.current) setSearching(false);
        });
    }, SERVER_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `key` captures base, q and timeZone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { results: answer && answer.key === key ? answer.results : null, searching: key !== "" && searching };
}

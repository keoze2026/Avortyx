/**
 * The header's last Balance / Total / Live, kept in this browser (CH-497).
 *
 * Right after a refresh the header has nothing until the dashboard request
 * answers, and showed "—" (CH-482) for that moment. The last figures this
 * login saw are shown at once instead, then replaced by the fresh answer -
 * the request is always made. Total is today's count, so a saved Total from
 * another day is not shown.
 *
 * Per login: a shared computer never shows one login's balance to another.
 * Browser storage can be missing or refuse (private window): then nothing is
 * shown early and the header waits for the request, as before.
 */

import { useAuthStore } from "@/lib/store/auth-store";

export interface HeaderFigures {
  balance?: number;
  callsToday?: number;
  liveCalls?: number;
  /** The day (YYYY-MM-DD, portal time) callsToday belongs to. */
  day: string;
}

function key(): string | null {
  const id = useAuthStore.getState().user?.id;
  return id ? `avx.header.${id}` : null;
}

export function saveHeaderFigures(f: HeaderFigures): void {
  const k = key();
  if (!k) return;
  try {
    localStorage.setItem(k, JSON.stringify(f));
  } catch {
    /* storage refused: nothing to keep */
  }
}

export function loadHeaderFigures(today: string): HeaderFigures | null {
  const k = key();
  if (!k) return null;
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const f = JSON.parse(raw) as HeaderFigures;
    if (f.day !== today) return { day: f.day, balance: f.balance };
    return f;
  } catch {
    return null;
  }
}

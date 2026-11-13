/**
 * CH-675: the platform owner's read-only view of a client portal, as this
 * tab knows it. Started by the script at the top of app/layout.tsx
 * (ownerViewInitScript) from /owner-view#t=...; the server refuses every
 * change made with the pass (backend accounts/owner_view.py).
 */

export const OWNER_VIEW_KEY = "avortyx.ownerView";

export interface OwnerViewSession {
  account: string;
  /** When the pass ends (ms since epoch). */
  until: number;
}

/** The view this tab is in, or null for an ordinary sign-in. */
export function readOwnerView(): OwnerViewSession | null {
  if (typeof window === "undefined") return null;
  try {
    if (document.documentElement.getAttribute("data-owner-view") !== "1") return null;
    const raw = window.sessionStorage.getItem(OWNER_VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<OwnerViewSession>;
    return { account: String(v.account ?? ""), until: Number(v.until) || 0 };
  } catch {
    return null;
  }
}

/** Leave the view: forget the pass (this tab only) and go back to the
 *  owner's own Organizations page, with the owner's own sign-in. */
export function endOwnerView() {
  try {
    window.sessionStorage.clear();
  } catch {
    /* nothing kept */
  }
  window.location.replace("/owner");
}

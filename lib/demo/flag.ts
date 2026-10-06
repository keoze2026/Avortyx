/**
 * Demo-mode runtime flag + hostname guard.
 *
 * `isDemoMode()` is true when the build was started with
 * `NEXT_PUBLIC_DEMO_MODE=true`. Read it at the http/socket/auth-bootstrap
 * seams to short-circuit real network calls.
 *
 * `isProductionHostname()` returns true when the page is being served from
 * the real avortyx.io / www.avortyx.io. Combined with the demo flag this
 * lets us refuse to start a demo build on the real domain — see
 * `<DemoModeGuard>` in the app shell.
 *
 * Removal note: when marketing is over, delete the `lib/demo/` folder and
 * grep for `isDemoMode` to find the 3 conditionals that need stripping
 * (lib/api/http.ts, lib/api/socket.ts, lib/store/auth-store.ts).
 */

const RAW = process.env.NEXT_PUBLIC_DEMO_MODE;

/** True if this build was started with NEXT_PUBLIC_DEMO_MODE=true. */
export function isDemoMode(): boolean {
  return RAW === "true" || RAW === "1";
}

/** Hostnames the real production app is served from.
 *
 * `avortyx.com` is the one clients actually log in to; `avortyx.io` serves the
 * API. The list held only the .io pair, so the guard that is meant to refuse a
 * demo build on production did not cover the production portal at all — a
 * build made with NEXT_PUBLIC_DEMO_MODE=true would have served invented data
 * to clients with nothing to stop it. */
const PRODUCTION_HOSTNAMES = new Set([
  "avortyx.com",
  "www.avortyx.com",
  "avortyx.io",
  "www.avortyx.io",
  // The customer portal's own address - a demo build must never run here.
  "app.avortyx.io",
]);

export function isProductionHostname(): boolean {
  if (typeof window === "undefined") return false;
  return PRODUCTION_HOSTNAMES.has(window.location.hostname.toLowerCase());
}

/** Demo credentials. The login form is fully unaltered; the router
 *  intercepts `/api/accounts/login` and accepts only this pair. */
export const DEMO_LOGIN_EMAIL = "selfmail@avortyx.com";
export const DEMO_LOGIN_PASSWORD = "Avortyx@2026!";

/** A static, demo-only access token. The shape mirrors a JWT just enough
 *  that the rest of the http layer is happy; it never reaches a real server. */
export const DEMO_ACCESS_TOKEN = "demo.access.token";
export const DEMO_REFRESH_TOKEN = "demo.refresh.token";

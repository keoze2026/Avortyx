/**
 * CH-319: Google search. The landing page (/, /careers, /request-access) is
 * for everyone; everything else is the logged-in product, the sign-in pages
 * or private links, and is kept out of search results. On app.* (the client
 * portal) nothing is listed at all.
 */
import { BRAND } from "@/lib/constants";

/** The public site address, for links Google and link previews need in full. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.avortyx.com").replace(/\/+$/, "");

export const PUBLIC_PATHS = ["/", "/careers", "/request-access"] as const;

/** Paths search engines must not list: the product, sign-in, private links, API. */
export const PRIVATE_PATHS = [
  "/api/", "/check", "/demo",
  "/login", "/signup", "/forgot-password", "/reset-password", "/set-password", "/invite",
  "/automated-reports", "/billing", "/blocked-numbers", "/buyers", "/calls", "/campaigns",
  "/dashboard", "/destinations", "/getting-started", "/insights", "/integrations", "/ivr",
  "/kyc", "/live", "/marketplace", "/news", "/notifications", "/numbers", "/owner",
  "/publishers", "/queue", "/referrals", "/reports", "/routing", "/settings", "/tcpa-shield",
  "/tfn-check", "/voip-shield", "/white-label", "/workspace",
];

/** The client portal (app.avortyx.io) is never listed. */
export function isPortalHost(host: string | null | undefined): boolean {
  return /^app\./i.test((host ?? "").trim());
}

/** https://<host the request came to>, or the default site address. */
export function originFor(host: string | null | undefined): string {
  const h = (host ?? "").trim().toLowerCase();
  if (!h || h.startsWith("localhost") || h.startsWith("127.")) return SITE_URL;
  return `https://${h}`;
}

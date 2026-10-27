/**
 * CH-319: Google search. On the portal (app.avortyx.io) Google may list the
 * sign-in page only - ZDFRS, 27 Oct: "I need this to show on Google, this is
 * what I am using". On a public site host, the landing page (/, /careers,
 * /request-access) is listed. Everything else - the logged-in product, sign-up
 * and password pages, private links, the API - is kept out of search.
 */
import { BRAND } from "@/lib/constants";

/** The public site address, for links Google and link previews need in full. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://app.avortyx.io").replace(/\/+$/, "");

export const PUBLIC_PATHS = ["/", "/careers", "/request-access"] as const;

/** Paths search engines must not list: the product, sign-in, private links, API. */
export const PRIVATE_PATHS = [
  "/api/", "/check", "/demo",
  "/signup", "/forgot-password", "/reset-password", "/set-password", "/invite",
  "/automated-reports", "/billing", "/blocked-numbers", "/buyers", "/calls", "/campaigns",
  "/dashboard", "/destinations", "/getting-started", "/insights", "/integrations", "/ivr",
  "/kyc", "/live", "/marketplace", "/news", "/notifications", "/numbers", "/owner",
  "/publishers", "/queue", "/referrals", "/reports", "/routing", "/settings", "/tcpa-shield",
  "/tfn-check", "/voip-shield", "/white-label", "/workspace",
];

/** The client portal (app.avortyx.io): only its sign-in page is listed. */
export function isPortalHost(host: string | null | undefined): boolean {
  return /^app\./i.test((host ?? "").trim());
}

/** https://<host the request came to>, or the default site address. */
export function originFor(host: string | null | undefined): string {
  const h = (host ?? "").trim().toLowerCase();
  if (!h || h.startsWith("localhost") || h.startsWith("127.")) return SITE_URL;
  return `https://${h}`;
}

/** The pages Google may list on a host. */
export function publicPathsFor(host: string | null | undefined): readonly string[] {
  return isPortalHost(host) ? ["/login"] : PUBLIC_PATHS;
}

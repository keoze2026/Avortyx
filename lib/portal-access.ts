/**
 * Whether the public marketing site may link into the customer portal.
 *
 * Off by default: the portal lives on an unadvertised hostname handed only
 * to vetted customers (see proxy.ts), so the public site offers "Request
 * access" (email) instead of Sign in / Get started. Set
 * NEXT_PUBLIC_PUBLIC_PORTAL_LINKS=true to restore the direct links, e.g.
 * on the portal host itself or for local development.
 */

import { BRAND } from "@/lib/constants";

export const PUBLIC_PORTAL_LINKS = process.env.NEXT_PUBLIC_PUBLIC_PORTAL_LINKS === "true";

export const REQUEST_ACCESS_HREF = `mailto:${BRAND.email}?subject=${encodeURIComponent("Avortyx access request")}`;

/** The primary call-to-action: into the portal, or an access request. */
export const PORTAL_CTA = PUBLIC_PORTAL_LINKS
  ? { label: "Get started", href: "/signup" }
  : { label: "Request access", href: REQUEST_ACCESS_HREF };

/** Route into the portal when links are public, otherwise the access request. */
export function portalHref(route: string): string {
  return PUBLIC_PORTAL_LINKS ? route : REQUEST_ACCESS_HREF;
}

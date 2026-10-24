import { headers } from "next/headers";

import { NotFoundContent } from "./not-found-lazy";

/**
 * Is this request on the public site (avortyx.com) rather than the portal?
 * With PORTAL_HOSTS set (see proxy.ts), every host not in that list is the
 * public site - where the portal must not be advertised, so its buttons
 * (Dashboard, Live Monitor) are not shown there.
 */
async function onPublicSite(): Promise<boolean> {
  const portalHosts = (process.env.PORTAL_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (portalHosts.length === 0) return false; // no split: one site, keep the portal buttons
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  return !portalHosts.includes(host);
}

export default async function NotFound() {
  const publicSite = await onPublicSite();
  return <NotFoundContent publicSite={publicSite} />;
}

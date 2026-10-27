import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { PRIVATE_PATHS, isPortalHost, originFor } from "@/lib/seo";

/** /robots.txt - CH-319: the landing page is listed; the product is not. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");
  if (isPortalHost(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  const origin = originFor(host);
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

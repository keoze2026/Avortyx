import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { PRIVATE_PATHS, isPortalHost, originFor } from "@/lib/seo";

/** /robots.txt - CH-319: the sign-in page (portal) or the landing page (public
 *  site) is listed; the product is not. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");
  const origin = originFor(host);
  const rules = isPortalHost(host)
    ? {
        userAgent: "*",
        // The sign-in page, plus the files Google needs to draw it.
        allow: ["/login", "/$", "/_next/", "/*.png$", "/*.svg$", "/*.ico$", "/*.jpg$", "/*.webp$", "/*.woff2$"],
        disallow: "/",
      }
    : { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS };
  return {
    rules,
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

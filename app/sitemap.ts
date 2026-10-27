import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { PUBLIC_PATHS, isPortalHost, originFor } from "@/lib/seo";

/** /sitemap.xml - CH-319: the public pages, for Google Search Console. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host");
  if (isPortalHost(host)) return [];
  const origin = originFor(host);
  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}

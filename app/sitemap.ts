import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { originFor, publicPathsFor } from "@/lib/seo";

/** /sitemap.xml - CH-319: the pages Google may list, for Search Console. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host");
  const origin = originFor(host);
  return publicPathsFor(host).map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" || path === "/login" ? "weekly" : "monthly",
    priority: path === "/" || path === "/login" ? 1 : 0.6,
  }));
}

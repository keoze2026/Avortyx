/**
 * Host split between the public marketing site and the customer portal.
 *
 * The portal is deliberately NOT reachable on the public domain: it lives
 * on a separate, unadvertised hostname that only vetted customers are
 * given (client decision after competitors signed up on the public site
 * to record the product and file complaints).
 *
 *   PORTAL_HOSTS   comma-separated hostnames that serve the portal, e.g.
 *                  "portal.example.com,portal-staging.example.com".
 *                  Unset → no split (local dev, demo, single-host deploys).
 *
 * With PORTAL_HOSTS set:
 *   • on any other host, portal and auth routes are answered with the
 *     site's 404 page — not a redirect, so the portal hostname never leaks;
 *   • on a portal host, the marketing pages redirect to /login, and every
 *     response carries `X-Robots-Tag: noindex, nofollow` so the portal
 *     hostname never appears in a search index.
 *
 * Next.js API routes (/api/*) and static assets are served on both.
 */

import { NextResponse, type NextRequest } from "next/server";

const PORTAL_HOSTS = (process.env.PORTAL_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** Paths that belong to the public site. Everything else is the portal. */
const MARKETING_PATHS = new Set(["/", "/careers"]);

function hostOf(req: NextRequest): string {
  // Behind a proxy / CDN the original host arrives in x-forwarded-host.
  const raw = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export function proxy(req: NextRequest) {
  if (PORTAL_HOSTS.length === 0) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const onPortalHost = PORTAL_HOSTS.includes(hostOf(req));
  const isMarketing = MARKETING_PATHS.has(pathname);

  if (onPortalHost) {
    if (isMarketing) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  }

  // Public host: the portal doesn't exist here.
  if (!isMarketing) {
    const url = req.nextUrl.clone();
    url.pathname = "/__not_found";
    url.search = "";
    return NextResponse.rewrite(url, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, API routes and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};

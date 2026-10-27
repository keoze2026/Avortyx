"use client";

/**
 * The browser tab's title in the chosen language (CH-318).
 *
 * The page layouts export their tab titles as English `metadata` (server
 * side, so they cannot read the language picked in the browser). In English
 * nothing changes; in Russian, Japanese or Chinese this writes the same title
 * in that language, and writes it again if Next.js puts its English one back
 * after a navigation. Switching back to English restores Next's title.
 */

import * as React from "react";
import { usePathname } from "next/navigation";

import { useTranslation } from "@/hooks/use-translation";
import { BRAND } from "@/lib/constants";

/** Pages whose layout exports a `metadata.title`, and that title's key. */
const TITLE_KEYS: Array<[RegExp, string]> = [
  [/^\/insights(\/|$)/, "nav.aiInsights"],
  [/^\/integrations(\/|$)/, "nav.integrations"],
  [/^\/live(\/|$)/, "nav.liveMonitor"],
  [/^\/marketplace(\/|$)/, "nav.marketplace"],
  [/^\/settings(\/|$)/, "nav.settings"],
  [/^\/buyers\/[^/]+/, "x318.app.tab.buyer"],
  [/^\/campaigns\/[^/]+/, "x318.app.tab.campaign"],
  [/^\/publishers\/[^/]+/, "x318.app.tab.publisher"],
  [/^\/routing\/[^/]+/, "x318.app.tab.routingEditor"],
];

export function DocumentTitle() {
  const pathname = usePathname() ?? "";
  const { t, locale } = useTranslation();
  // The last title written here, and the title Next.js had before it.
  const written = React.useRef<string | null>(null);
  const original = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (locale === "en") {
      if (written.current && document.title === written.current && original.current) {
        document.title = original.current;
      }
      written.current = null;
      return;
    }
    const key = TITLE_KEYS.find(([re]) => re.test(pathname))?.[1];
    const want = key ? `${t(key)} — ${BRAND.name}` : `${BRAND.name} — ${t("x318.app.tab.tagline")}`;
    const apply = () => {
      if (document.title === want) return;
      if (document.title !== written.current) original.current = document.title;
      written.current = want;
      document.title = want;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname, locale, t]);

  return null;
}

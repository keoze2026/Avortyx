"use client";

import { useEffect } from "react";

import { useTranslation } from "@/hooks/use-translation";
import { BRAND } from "@/lib/constants";

/**
 * The browser tab title in the chosen language (CH-318). The detail pages'
 * `metadata.title` ("Buyer", "Campaign"...) is rendered on the server, which
 * does not know the language picked in the app, so it always read English.
 * English keeps the server title exactly as before.
 */
export function usePageTitle(key: string) {
  const { t, locale } = useTranslation();
  const title = t(key);
  useEffect(() => {
    if (locale === "en") return;
    const before = document.title;
    document.title = `${title} — ${BRAND.name}`;
    return () => {
      document.title = before;
    };
  }, [locale, title]);
}

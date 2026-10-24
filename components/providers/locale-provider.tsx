"use client";

/**
 * Syncs the active locale from the store to `<html lang="…">` so screen
 * readers, spell-checkers, and form auto-fill all use the right language.
 * Renders nothing.
 */

import * as React from "react";

import { findLocale } from "@/lib/i18n/locales";
import { useLocaleStore } from "@/lib/store/locale-store";

export function LocaleProvider() {
  const locale = useLocaleStore((s) => s.locale);

  React.useEffect(() => {
    const def = findLocale(locale);
    document.documentElement.setAttribute("lang", def.htmlLang);
  }, [locale]);

  return null;
}

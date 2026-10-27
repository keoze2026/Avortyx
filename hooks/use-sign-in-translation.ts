"use client";

/**
 * `useTranslation()` for the sign-in screen: the same `{ t, locale, setLocale }`, but `t` reads only
 * the screen's own texts (lib/i18n/sign-in.ts), so /login doesn't load the whole app's dictionary.
 * CH-318: the few sign-in texts that still read English in Russian, Japanese or Chinese ("Pay-per-call",
 * "email") are corrected by the small `everythingAppSignIn` table, which wins for those languages.
 */

import * as React from "react";

import { everythingAppSignIn } from "@/lib/i18n/extra/everything-app";
import { tSignIn } from "@/lib/i18n/sign-in";
import { useLocaleStore } from "@/lib/store/locale-store";

export function useSignInTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const t = React.useCallback(
    (key: string) => (locale !== "en" ? everythingAppSignIn[locale]?.[key] : undefined) ?? tSignIn(locale, key),
    [locale],
  );

  return { t, locale, setLocale };
}

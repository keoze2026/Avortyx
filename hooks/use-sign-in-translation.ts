"use client";

/**
 * `useTranslation()` for the sign-in screen: the same `{ t, locale, setLocale }`, but `t` reads only
 * the screen's own texts (lib/i18n/sign-in.ts), so /login doesn't load the whole app's dictionary.
 */

import * as React from "react";

import { tSignIn } from "@/lib/i18n/sign-in";
import { useLocaleStore } from "@/lib/store/locale-store";

export function useSignInTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const t = React.useCallback((key: string) => tSignIn(locale, key), [locale]);

  return { t, locale, setLocale };
}

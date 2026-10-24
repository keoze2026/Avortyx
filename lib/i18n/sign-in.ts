/**
 * The sign-in screen's own `t()`: looks only in the screen's texts (extra/sign-in, extra/login,
 * extra/login-form), not the main dictionaries, so /login loads a few KB of text instead of the
 * whole app's. Every key the screen uses must live in one of those three files; the main `tFor`
 * finds them there too (lib/i18n/extra), so other screens can use them.
 */
import { loginForm } from "./extra/login-form";
import { loginScreen } from "./extra/login";
import { signIn } from "./extra/sign-in";
import type { LocaleId } from "./locales";

const AREAS = [signIn, loginScreen, loginForm];

const TEXTS: Record<LocaleId, Record<string, string>> = { en: {}, ru: {}, ja: {}, zh: {} };
for (const area of AREAS) {
  for (const locale of Object.keys(TEXTS) as LocaleId[]) Object.assign(TEXTS[locale], area[locale]);
}

/** The text in the given language, else English, else the key itself. */
export function tSignIn(locale: LocaleId, key: string): string {
  return TEXTS[locale]?.[key] ?? TEXTS.en[key] ?? key;
}

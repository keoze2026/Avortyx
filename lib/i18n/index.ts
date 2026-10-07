/**
 * i18n entry point — exposes the active translation map and a `t()` helper
 * that resolves dotted keys like `"page.dashboard.title"` against the active
 * locale, falling back to English when a key is missing in the chosen locale
 * so partially-translated UI doesn't break.
 */

import { en, type TranslationShape } from "./translations/en";
import { ja } from "./translations/ja";
import { ru } from "./translations/ru";
import { zh } from "./translations/zh";
import type { LocaleId } from "./locales";
import { EXTRA } from "./extra";

export { en, ja, ru, zh };
export type { TranslationShape };
export type { LocaleId, LocaleDef } from "./locales";
export { LOCALES, DEFAULT_LOCALE, findLocale } from "./locales";

const TRANSLATIONS: Record<LocaleId, TranslationShape> = { en, ru, ja, zh };

export function getTranslation(locale: LocaleId): TranslationShape {
  return TRANSLATIONS[locale] ?? en;
}

/** Walk a dotted key against an arbitrary object — used by `t()`. */
function walk(obj: unknown, parts: string[]): unknown {
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Resolve a dotted translation key in the given locale. Falls back to English
 * if the key is missing in the target locale, and to the raw key as a last
 * resort so missing translations are surfaced rather than blanked out.
 */
export function tFor(locale: LocaleId, key: string): string {
  const parts = key.split(".");
  const value = walk(TRANSLATIONS[locale], parts);
  if (typeof value === "string") return value;
  // Texts missing from the language's dictionary, or added since (lib/i18n/extra).
  const extra = EXTRA[locale]?.[key];
  if (extra !== undefined) return extra;
  const fallback = walk(en, parts);
  if (typeof fallback === "string") return fallback;
  const extraEn = EXTRA.en[key];
  if (extraEn !== undefined) return extraEn;
  return key;
}

import type { LocaleId } from "../locales";

/** Flat dotted keys -> text, per language. `en` holds the English source text. */
export type ExtraTranslations = Record<LocaleId, Record<string, string>>;

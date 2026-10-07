/**
 * Extra translations, layered on top of the main dictionaries.
 *
 * The main dictionaries (lib/i18n/translations/*.ts) are large nested files.
 * Texts that were missing from them, and texts that used to be written
 * straight into screens in English, live here instead - one file per area,
 * flat dotted keys, all four languages side by side - so each batch is easy
 * to review and nothing in the big files has to be edited by hand.
 *
 * Lookup order (lib/i18n tFor): language dictionary -> language extras ->
 * English dictionary -> English extras -> the key itself.
 */
import type { LocaleId } from "../locales";

import { base } from "./base";
import { daily } from "./daily";
import { activity } from "./activity";
import type { ExtraTranslations } from "./types";

const AREAS: ExtraTranslations[] = [base, daily, activity];

export const EXTRA: Record<LocaleId, Record<string, string>> = { en: {}, ru: {}, ja: {}, zh: {} };
for (const area of AREAS) {
  for (const locale of Object.keys(EXTRA) as LocaleId[]) Object.assign(EXTRA[locale], area[locale]);
}

export type { ExtraTranslations };

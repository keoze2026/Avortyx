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
import { bulk } from "./bulk";
import { buyerAccess } from "./buyer-access";
import { routing } from "./routing";
import { ivr } from "./ivr";
import { reports } from "./reports";
import { marketplace } from "./marketplace";
import { risk } from "./risk";
import { publisherBlocks } from "./publisher-blocks";
import { ownerCosts } from "./owner-costs";
import { campaignNumbers } from "./campaign-numbers";
import { deletedTfns } from "./deleted-tfns";
import { blockedBy } from "./blocked-by";
import { routingCost } from "./routing-cost";
import { fillMissing } from "./fill-missing";
import { trafficUi } from "./traffic-ui";
import type { ExtraTranslations } from "./types";

const AREAS: ExtraTranslations[] = [base, daily, activity, bulk, buyerAccess, routing, ivr, reports, marketplace, ownerCosts, risk, publisherBlocks, campaignNumbers, deletedTfns, blockedBy, routingCost, trafficUi, fillMissing];

export const EXTRA: Record<LocaleId, Record<string, string>> = { en: {}, ru: {}, ja: {}, zh: {} };
for (const area of AREAS) {
  for (const locale of Object.keys(EXTRA) as LocaleId[]) Object.assign(EXTRA[locale], area[locale]);
}

export type { ExtraTranslations };
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
import { buyerReport } from "./buyer-report";
import { automatedReports } from "./automated-reports";
import { campaignNumbers } from "./campaign-numbers";
import { deletedTfns } from "./deleted-tfns";
import { blockedBy } from "./blocked-by";
import { routingCost } from "./routing-cost";
import { fillMissing } from "./fill-missing";
import { trafficUi } from "./traffic-ui";
import { sweep1 } from "./sweep-1";
import { sweep2 } from "./sweep-2";
import { sweep5 } from "./sweep-5";
import { sweep6 } from "./sweep-6";
import { acronyms } from "./acronyms";
import { missingKeys } from "./missing-keys";
import { sweepY } from "./sweep-y";
import { signIn } from "./sign-in";
import { loginScreen } from "./login";
import { loginForm } from "./login-form";
import { lineSwitch } from "./line-switch";
import { tfnCheck } from "./tfn-check";
import { repeatedAndMonth } from "./repeated-month";
import { reportWatch } from "./report-watch";
import { routedBulk } from "./routed-bulk";
import { hangUp } from "./hang-up";
import { translateAll } from "./translate-all";
import { gettingStarted } from "./getting-started";
import { tfnWords } from "./tfn-words";
import { telegramConnect } from "./telegram-connect";
import { tfnTestReport } from "./tfn-test-report";
import { everythingReports } from "./everything-reports";
import { everythingNetwork } from "./everything-network";
import { everythingApp } from "./everything-app";
import { everythingUi } from "./everything-ui";
import { campaignGroups } from "./campaign-groups";
import { campaignDelete } from "./campaign-delete";
import { attachUnassigned } from "./attach-unassigned";
import { profitPeriod } from "./profit-period";
import { tfnToday } from "./tfn-today";
import { tfnCheckToday } from "./tfn-check-today";
import { tfnTestRunner } from "./tfn-test-runner";
import { teamReport } from "./team-report";
import { serverUpdate } from "./server-update";
import { tfnNotReady } from "./tfn-not-ready";
import { carrierWatch } from "./carrier-watch";
import { numberLifetime } from "./number-lifetime";
import { tfnTestPassed } from "./tfn-test-passed";
import { destinationColumns } from "./destination-columns";
import { tfnEndToEnd } from "./tfn-end-to-end";
import { expenses } from "./expenses";
import type { ExtraTranslations } from "./types";

const AREAS: ExtraTranslations[] = [base, daily, activity, bulk, buyerAccess, routing, ivr, reports, marketplace, ownerCosts, buyerReport, automatedReports, risk, publisherBlocks, campaignNumbers, deletedTfns, blockedBy, routingCost, trafficUi, fillMissing, sweep1, sweep2, sweep5, sweep6, sweepY, missingKeys, acronyms, signIn, loginScreen, loginForm, lineSwitch, tfnCheck, repeatedAndMonth, reportWatch, routedBulk, hangUp, translateAll, gettingStarted, tfnWords, telegramConnect, tfnTestReport, everythingReports, everythingNetwork, everythingApp, everythingUi, campaignGroups, campaignDelete, attachUnassigned, profitPeriod, expenses, tfnToday, tfnCheckToday, tfnTestRunner, teamReport, tfnEndToEnd, serverUpdate, tfnNotReady, carrierWatch, numberLifetime, tfnTestPassed, destinationColumns];

export const EXTRA: Record<LocaleId, Record<string, string>> = { en: {}, ru: {}, ja: {}, zh: {} };
for (const area of AREAS) {
  for (const locale of Object.keys(EXTRA) as LocaleId[]) Object.assign(EXTRA[locale], area[locale]);
}

/**
 * Texts that must win over the main dictionaries too (CH-307): the full-word
 * versions of English acronyms (TFN, CC, AHT...). The main Russian, Japanese
 * and Chinese dictionaries still carry "TFN" in many texts, and the lookup
 * reads them first, so these replacements never showed (Sir, 27 Oct: "TFN
 * isn't changing their language"). English is never overridden.
 */
export const OVERRIDE: Record<LocaleId, Record<string, string>> = { en: {}, ru: {}, ja: {}, zh: {} };
// CH-318: the "everything translated" files also correct texts the main
// dictionaries hold in English (Email, White Label...), so they win too.
for (const area of [acronyms, tfnWords, everythingReports, everythingNetwork, everythingApp, everythingUi]) {
  for (const locale of ["ru", "ja", "zh"] as LocaleId[]) Object.assign(OVERRIDE[locale], area[locale]);
}

export type { ExtraTranslations };
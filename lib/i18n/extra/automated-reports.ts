/**
 * Automated Reports page (CH-261). English only for now; the other languages
 * fall back to it.
 */
import type { ExtraTranslations } from "./types";

export const automatedReports: ExtraTranslations = {
  en: {
    "nav.automatedReports": "Automated Report",
    "autoReports.headline": "Automated Report",
    "autoReports.subline": "Each buyer receives their call report on Telegram at their chosen time.",
    "autoReports.feature.excel": "One Excel per destination",
    "autoReports.feature.options": "Buyer's own time and options",
    "autoReports.feature.approval": "Sent only with buyer approval",
    "autoReports.feature.eod": "Daily EOD summary",
    "autoReports.feature.email": "Email digests",
    "autoReports.buyers.title": "Buyer reports",
    "autoReports.buyers.counts": "{active} active · {waiting} waiting for approval",
    "autoReports.buyers.adminOnly": "Buyer reports are managed by the workspace admin.",
    "autoReports.buyers.none": "No buyers yet.",
    "autoReports.col.buyer": "Buyer",
    "autoReports.col.status": "Status",
    "autoReports.col.time": "Send time",
    "autoReports.col.lastSent": "Last sent",
    "autoReports.col.action": "",
    "autoReports.state.active": "Active",
    "autoReports.state.waiting_approval": "Waiting for approval",
    "autoReports.state.off": "Off",
    "autoReports.state.not_set_up": "Not set up",
    "autoReports.setUp": "Set up",
    "autoReports.manage": "Manage",
  },
  ru: {},
  ja: {},
  zh: {},
};

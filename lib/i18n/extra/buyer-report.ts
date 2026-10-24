/**
 * Buyer > Settings > Telegram Report (CH-258). English only for now; the other
 * languages fall back to it.
 */
import type { ExtraTranslations } from "./types";

export const buyerReport: ExtraTranslations = {
  en: {
    "buyerReport.title": "Telegram Report",
    "buyerReport.enabled": "Send this buyer a daily report",
    "buyerReport.description": "Every day at the time below, one Excel file per destination - its calls - is sent to the buyer's Telegram, after a short summary.",
    "buyerReport.loading": "Loading...",
    "buyerReport.chatId": "Telegram chat ID",
    "buyerReport.chatIdHint": "The buyer must press Start on our Telegram bot first (or add the bot to their group); a group ID starts with -100.",
    "buyerReport.sendTime": "Send time (EST)",
    "buyerReport.sendTimeHint": "Reports the day so far. A time before 6:00 AM reports the whole previous day.",
    "buyerReport.options": "Report options",
    "buyerReport.noRecordingLink": "No Recording Link - leave recordings out of the report",
    "buyerReport.connectedOnly": "Connected calls only",
    "buyerReport.hideFailReason": "Leave out the Fail Reason column",
    "buyerReport.headings": "Column headings (blank = default)",
    "buyerReport.wording": "Comment wording",
    "buyerReport.wordingHint": "Change how a Fail Reason comment is worded in this buyer's report. The wording can change, not what happened: a missed call cannot be worded as connected.",
    "buyerReport.pickComment": "Choose a comment",
    "buyerReport.newWording": "New wording",
    "buyerReport.addWording": "Add wording",
    "buyerReport.remove": "Remove",
    "buyerReport.last": "Last report",
    "buyerReport.neverSent": "No report sent yet.",
    "buyerReport.sendNow": "Send now",
    "buyerReport.save": "Save",
    "buyerReport.saved": "Report settings saved",
    "buyerReport.saveFailed": "Could not save the report settings.",
    "buyerReport.sent": "Report sent to the buyer's Telegram",
    "buyerReport.sendFailed": "The report could not be sent.",
  },
  ru: {},
  ja: {},
  zh: {},
};

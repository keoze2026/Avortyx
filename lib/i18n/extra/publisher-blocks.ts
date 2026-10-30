/** Blocked Numbers on a publisher's Edit page. English only; other languages fall back to it. */
import type { ExtraTranslations } from "./types";

export const publisherBlocks: ExtraTranslations = {
  en: {
    "publisherBlocks.title": "Blocked Numbers",
    "publisherBlocks.description": "Callers blocked here are rejected on this publisher's numbers only. Other publishers still take them.",
    "publisherBlocks.placeholder": "Caller number, e.g. +15551234567",
    "publisherBlocks.block": "Block",
    "publisherBlocks.empty": "No blocked numbers for this publisher.",
    "publisherBlocks.loading": "Loading blocked numbers...",
    "publisherBlocks.invalid": "Enter a full phone number.",
    "publisherBlocks.already": "{number} is already blocked for this publisher.",
    "publisherBlocks.blocked": "{number} blocked for this publisher.",
    "publisherBlocks.unblocked": "{number} unblocked.",
    "publisherBlocks.removeAria": "Unblock {number}",
    "publisherBlocks.loadFailed": "Couldn't load the blocked numbers.",
    "publisherBlocks.saveFailed": "Couldn't save. Please try again.",
    "publisherBlocks.count": "{count} blocked",
    "publisherBlocks.recentTitle": "Recent callers on this publisher (last 30 days). Pick one or type a number.",
    "publisherBlocks.recentLoading": "Loading recent callers...",
    "publisherBlocks.recentEmpty": "No recent callers match. You can still type the number.",
    "publisherBlocks.recentCalls": "{count} calls",
    "publisherBlocks.recentCall": "1 Call",
    "publisherBlocks.pageDescription": "Block callers on your traffic. A blocked caller is rejected on your numbers only.",
    "publisherBlocks.notEnabled": "Blocking numbers is not turned on for your account. Ask your admin to enable Block Numbers.",
    "publisherBlocks.noPublisher": "Your publisher record could not be loaded. Please refresh the page.",
  },
  ru: {},
  ja: {},
  zh: {},
};

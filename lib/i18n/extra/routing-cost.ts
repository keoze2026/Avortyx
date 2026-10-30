/** Owner > Carrier Costs: routing (termination) cost, CH-186. English; other languages fall back to it. */
import type { ExtraTranslations } from "./types";

export const routingCost: ExtraTranslations = {
  en: {
    "routingCost.title": "Routing Cost",
    "routingCost.rate": "{rate} per minute · {fee} a month",
    "routingCost.preset.yesterday": "Yesterday",
    "routingCost.preset.today": "Today",
    "routingCost.preset.week": "This week",
    "routingCost.preset.month": "This month",
    "routingCost.from": "From",
    "routingCost.to": "To",
    "routingCost.editRate": "Edit Rate",
    "routingCost.editTitle": "Routing (termination) rate",
    "routingCost.perMinute": "Cost per Minute",
    "routingCost.monthlyFee": "Monthly Fee",
    "routingCost.forwarded": "Calls Forwarded",
    "routingCost.connected": "Connected",
    "routingCost.minutes": "Minutes",
    "routingCost.cost": "Routing Cost",
    "routingCost.col.date": "Day (EST)",
    "routingCost.note": "Every call we forwarded to a buyer, connected seconds x the per-minute rate, exact seconds. An estimate to check the carrier's invoice against; the monthly fee is billed separately.",
    "routingCost.empty": "No calls in this period.",
    "routingCost.saved": "Routing rate saved.",
    "routingCost.saveFailed": "Couldn't save the rate. Try again.",
    "routingCost.loadFailed": "Couldn't load the routing cost. Try again.",
    "routingCost.cancel": "Cancel",
    "routingCost.save": "Save",
  },
  ru: {},
  ja: {},
  zh: {},
};

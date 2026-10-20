/**
 * High or low risk for a campaign, read from the tracking numbers attached to
 * it. A number's risk comes from its carrier (High = numbers that may be
 * advertised publicly, Low = forwarding numbers); a campaign is High or Low
 * when all of its numbers agree, and Mixed when it holds both.
 */
import type { TrackingNumber } from "@/lib/types";

export type CampaignRiskKind = "high" | "low" | "mixed" | "none";

export interface CampaignRisk {
  kind: CampaignRiskKind;
  high: number;
  low: number;
  total: number;
}

export function campaignRisk(numbers: readonly TrackingNumber[]): CampaignRisk {
  let high = 0;
  let low = 0;
  for (const n of numbers) {
    if (n.risk === "high") high += 1;
    else if (n.risk === "low") low += 1;
  }
  const kind: CampaignRiskKind = high && low ? "mixed" : high ? "high" : low ? "low" : "none";
  return { kind, high, low, total: numbers.length };
}

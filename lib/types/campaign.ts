export type CampaignStatus = "active" | "paused" | "draft" | "archived";

/** Days of the week — 0=Sun .. 6=Sat */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface CampaignSchedule {
  /** Days this campaign is active */
  days: Weekday[];
  /** Hour range in 24h clock — both inclusive on start, exclusive on end. */
  startHour: number;
  endHour: number;
  /** IANA timezone, "auto" = caller's. */
  timezone: "auto" | "America/New_York" | "America/Chicago" | "America/Denver" | "America/Los_Angeles";
}

export type PayoutModel = "per-call" | "per-qualified" | "per-minute";

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  vertical: string;
  status: CampaignStatus;

  payout: number;
  payoutModel: PayoutModel;
  /** Minimum call duration in seconds for a call to qualify (per-qualified payouts only). */
  qualifyDurationSec: number;

  /** Per-day call cap. 0 = unlimited. */
  dailyCap: number;
  /** Per-month call cap. 0 = unlimited. */
  monthlyCap: number;

  schedule: CampaignSchedule;

  numbersCount: number;
  buyersCount: number;
  publishersCount: number;
  callsToday: number;
  revenueToday: number;
  conversionRate: number;

  /** Currently ringing / in-progress calls on this campaign. */
  liveCalls: number;
  /** Calls started in the current hour (org timezone). */
  callsHour: number;
  /** Calls started in the current calendar month. */
  callsMonth: number;
  /** Lifetime call count. */
  callsGlobal: number;

  /* ─── Call audio + duplicate handling — round-tripped on the wire ─── */
  /** Whether the campaign auto-records every call. */
  recordingEnabled?: boolean;
  /** Whether a pre-call greeting plays before the caller is routed. */
  greetingEnabled?: boolean;
  /** Greeting body — TTS or recorded audio URL the backend stores. */
  greetingMessage?: string;
  /** Whether the buyer hears a whisper before they pick up the call. */
  whisperEnabled?: boolean;
  /** Whisper script — short TTS message, e.g. "Health Insurance Tier 1". */
  whisperMessage?: string;
  /** Whether duplicate-call de-duplication is on. */
  duplicateCallBlock?: boolean;
  /** Duplicate-window in hours — only meaningful when duplicateCallBlock=true. */
  duplicateCallBlockHours?: number;

  /**
   * Per-campaign advanced settings — a free-form JSON blob the backend
   * round-trips verbatim. The frontend owns the schema (see
   * `CampaignAdvancedSettings`), giving us 12 cards' worth of persistent
   * configuration without a backend migration per field.
   */
  advancedSettings?: Record<string, unknown>;

  createdAt: number;
}

/** Cosmetic mapping vertical → KPI accent color. */
export type VerticalAccent = "cyan" | "emerald" | "violet" | "amber" | "rose";

export const VERTICAL_ACCENT: Record<string, VerticalAccent> = {
  "Health Insurance": "emerald",
  "Home Services": "amber",
  Automotive: "cyan",
  Legal: "violet",
  Finance: "rose",
};

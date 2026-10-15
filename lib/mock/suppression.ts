/**
 * Mock seed data for the Suppression-list pages
 * (VoIP Shield · TCPA Shield · Blocked Numbers).
 */

export interface VoipShieldEntry {
  id: string;
  name: string;
  /** Campaign ids this shield protects. Empty = applies to "All Campaigns". */
  campaignIds: string[];
  /** Carrier identifiers (display names) currently blocked by this shield. */
  blockedCarriers: string[];
}

/** Common VoIP / risky carriers presented in the "Block carrier" picker. */
export const COMMON_CARRIERS: string[] = [
  "Bandwidth.com",
  "Voxbone",
  "Skype",
  "Google Voice",
  "Twilio",
  "Inteliquent",
  "Magic Jack",
  "TextNow",
  "TextFree",
  "Vonage",
  "8x8",
  "Telnyx",
  "Onvoy",
  "Peerless",
];

export type TcpaProviderType = "TCPA Litigator" | "Blacklist Alliance";

export const TCPA_PROVIDER_TYPES: TcpaProviderType[] = [
  "TCPA Litigator",
  "Blacklist Alliance",
];

export interface TcpaProviderConfig {
  apiLogin: string;
  apiPassword: string;
  /** Max wait time for the provider's API to respond, in milliseconds. */
  timeoutMs: number;
}

export interface TcpaShieldEntry {
  id: string;
  /** Display name (e.g. "Provider123"). */
  name: string;
  /** Campaign ids this provider protects. Empty = applies to "All Campaigns". */
  campaignIds: string[];
  type: TcpaProviderType;
  /** Switch state shown in the table. */
  active: boolean;
  config: TcpaProviderConfig;
}

export function emptyTcpaConfig(): TcpaProviderConfig {
  return { apiLogin: "", apiPassword: "", timeoutMs: 1500 };
}

export type BlockedNumberScope = "number" | "prefix";

export interface BlockedNumberEntry {
  id: string;
  /** Digits only (we render with a leading "+" in the UI). */
  number: string;
  /** "number" = exact match · "prefix" = any caller whose number starts with this. */
  scope: BlockedNumberScope;
  /** Undefined = applies to All Campaigns. Otherwise scoped to one campaign. */
  campaignId?: string;
  /** When the number was blocked (ms) - the backend's `created_at`. */
  blockedAt?: number;
}

export const MOCK_VOIP_SHIELD: VoipShieldEntry[] = [
  {
    id: "v_001",
    name: "Bot net signatures",
    campaignIds: [],
    blockedCarriers: ["Bandwidth.com", "Voxbone", "TextNow", "TextFree"],
  },
  {
    id: "v_002",
    name: "Carrier risk pool",
    campaignIds: ["c_health_001"],
    blockedCarriers: ["Magic Jack", "Skype", "Google Voice"],
  },
  {
    id: "v_003",
    name: "Spam call signatures",
    campaignIds: [],
    blockedCarriers: ["TextNow", "Skype", "Google Voice", "TextFree", "Magic Jack"],
  },
  {
    id: "v_004",
    name: "Repeat caller fraud",
    campaignIds: ["c_auto_003"],
    blockedCarriers: ["Onvoy", "Peerless"],
  },
];

export const MOCK_TCPA_SHIELD: TcpaShieldEntry[] = [
  {
    id: "t_001",
    name: "Provider123",
    campaignIds: [],
    type: "TCPA Litigator",
    active: true,
    config: { apiLogin: "litigator-prod", apiPassword: "••••••••", timeoutMs: 1500 },
  },
  {
    id: "t_002",
    name: "Blacklist primary",
    campaignIds: ["c_health_001"],
    type: "Blacklist Alliance",
    active: true,
    config: { apiLogin: "ba-primary", apiPassword: "••••••••", timeoutMs: 2000 },
  },
  {
    id: "t_003",
    name: "State DNC — CA",
    campaignIds: ["c_solar_002"],
    type: "TCPA Litigator",
    active: true,
    config: { apiLogin: "ca-dnc", apiPassword: "••••••••", timeoutMs: 1500 },
  },
  {
    id: "t_004",
    name: "Consent expired",
    campaignIds: ["c_legal_004"],
    type: "Blacklist Alliance",
    active: false,
    config: { apiLogin: "", apiPassword: "", timeoutMs: 1500 },
  },
];

export const MOCK_BLOCKED_NUMBERS: BlockedNumberEntry[] = [
  { id: "b_001", number: "18302094480", scope: "number" },
  { id: "b_002", number: "12064745724", scope: "number" },
  { id: "b_003", number: "16044242726", scope: "number" },
  { id: "b_004", number: "14159272500", scope: "number", campaignId: "c_auto_003" },
];

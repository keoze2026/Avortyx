/**
 * Per-campaign advanced + sub-tab settings. Stored separately from the
 * core Campaign so the core record stays lean; these settings are managed
 * via a dedicated Zustand store keyed by campaign id.
 *
 * Every feature carries an `enabled` flag — the parent UI cards render in
 * a "Disabled" collapsed state until the user flips it on.
 */

export interface CallQueueSettings {
  enabled: boolean;
  /** Max simultaneous waiting calls. 0 = no cap. */
  maxQueueSize: number;
  /** Max time a caller waits in queue (seconds). 0 = no limit. */
  maxWaitSec: number;
  /** URL of hold-music file (mp3). */
  musicUrl: string;
}

export interface AutoRecordSettings {
  enabled: boolean;
}

export interface SpamFilterSettings {
  enabled: boolean;
  /** Block specific caller numbers (one per line, free-form). */
  blockedNumbers: string;
  /** Block all calls from these US states. */
  blockedStates: string[];
  /** Block calls flagged as spam by the carrier. */
  blockCarrierSpam: boolean;
}

/**
 * One leaf of the filter rule tree.
 *
 *   ┌────────────────────────────────────────┐
 *   │ parameter   operator   value           │
 *   │ caller.state  equals    "TX"           │
 *   └────────────────────────────────────────┘
 *
 * The condition reads "the caller's state equals TX".
 */
export interface FilterCondition {
  id: string;
  /** Dotted parameter path, e.g. "call.duration" or "caller.profile.state". */
  parameter: string;
  /** Comparison operator id (see FILTER_OPERATORS in advanced-settings-cards). */
  operator: string;
  /** Right-hand-side value. Free text — the comparator coerces if needed. */
  value: string;
}

/**
 * Group of conditions OR-ed together. Multiple groups are AND-ed.
 *
 *   group A = (cond1 OR cond2 OR cond3)
 *   group B = (cond4 OR cond5)
 *   result  = group A AND group B
 */
export interface FilterGroup {
  id: string;
  conditions: FilterCondition[];
}

export interface FilterSettings {
  enabled: boolean;
  /** Group-of-conditions tree. */
  groups: FilterGroup[];
  /** When the rule fails, where do we send the call? */
  onFail: "reject" | "voicemail" | "deadEnd";
}

export interface VoipShieldSettings {
  enabled: boolean;
  /** Block all VoIP callers outright. */
  blockAllVoip: boolean;
  /** Allow these VoIP providers through (comma-separated list). */
  allowList: string;
  /** Drop the call vs. send to voicemail when blocked. */
  action: "drop" | "voicemail";
}

export interface BusinessHoursSettings {
  enabled: boolean;
  /** 0=Sun, 1=Mon, …, 6=Sat */
  days: number[];
  startHour: number;
  endHour: number;
  timezone: string;
  /** Where to send calls outside hours. */
  outsideHoursAction: "voicemail" | "reject" | "rollover";
}

export interface GreetingsMessageSettings {
  enabled: boolean;
  /** Plain text — system reads it via TTS. */
  message: string;
  voice: "male" | "female";
  /** Play before connecting to the buyer. */
  playBeforeConnect: boolean;
}

export interface VoicemailSettings {
  enabled: boolean;
  /** Greeting to read before recording. */
  greeting: string;
  /** Max recording length (seconds). */
  maxLengthSec: number;
  /** Email the recording link to this address. */
  notificationEmail: string;
}

export interface WhisperMessageSettings {
  enabled: boolean;
  /** Message read to the BUYER agent before connecting. */
  message: string;
}

export interface CapSettings {
  enabled: boolean;
  hourlyCap: number;
  dailyCap: number;
  monthlyCap: number;
  /** Scope: apply to the whole campaign or each destination separately. */
  scope: "campaign" | "destination";
}

export interface RevenueSaverSettings {
  enabled: boolean;
  /** Reroute calls whose expected revenue is below this. */
  minRevenue: number;
  /** Fallback action when below threshold. */
  fallback: "deadEnd" | "voicemail" | "reroute";
  /** Destination campaign id when fallback === "reroute". */
  rerouteCampaignId: string;
}

export interface ConcurrencySettings {
  enabled: boolean;
  /** Max simultaneous live calls for this campaign. */
  maxConcurrent: number;
  /** When the cap is reached, what to do with new calls. */
}

/* ─── Sub-tabs other than General ─────────────────────────────── */

export interface RtbSettings {
  enabled: boolean;
  /** Endpoint URL the RTB pings for each call. */
  endpoint: string;
  /** Auth bearer token. */
  authToken: string;
  /** Request timeout (ms). */
  timeoutMs: number;
  /** Minimum bid accepted ($). */
  minBid: number;
}

export interface EnrichmentUrl {
  id: string;
  label: string;
  url: string;
  /** Called before/after routing. */
  hook: "pre-route" | "post-connect";
  timeoutMs: number;
  enabled: boolean;
}

export interface AccessGrant {
  id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  grantedAt: number;
}

/* ─── Parent shape stored per campaign ─────────────────────────── */

export interface CampaignAdvancedSettings {
  callQueue: CallQueueSettings;
  autoRecord: AutoRecordSettings;
  spamFilter: SpamFilterSettings;
  filter: FilterSettings;
  voipShield: VoipShieldSettings;
  businessHours: BusinessHoursSettings;
  greetingsMessage: GreetingsMessageSettings;
  voicemail: VoicemailSettings;
  whisperMessage: WhisperMessageSettings;
  capSettings: CapSettings;
  revenueSaver: RevenueSaverSettings;
  concurrency: ConcurrencySettings;

  rtb: RtbSettings;
  enrichmentUrls: EnrichmentUrl[];
  access: AccessGrant[];
}

/** Empty/disabled defaults used when a campaign hasn't been touched yet. */
export const DEFAULT_CAMPAIGN_SETTINGS: CampaignAdvancedSettings = {
  callQueue: { enabled: false, maxQueueSize: 25, maxWaitSec: 90, musicUrl: "" },
  autoRecord: { enabled: false },
  spamFilter: { enabled: false, blockedNumbers: "", blockedStates: [], blockCarrierSpam: true },
  filter: {
    enabled: false,
    onFail: "reject",
    groups: [
      {
        id: "g_default",
        conditions: [
          { id: "c_default_1", parameter: "", operator: "", value: "" },
        ],
      },
    ],
  },
  voipShield: { enabled: false, blockAllVoip: false, allowList: "", action: "drop" },
  businessHours: {
    enabled: false,
    days: [1, 2, 3, 4, 5],
    startHour: 8,
    endHour: 20,
    timezone: "auto",
    outsideHoursAction: "voicemail",
  },
  greetingsMessage: {
    enabled: false,
    message: "Thanks for calling. This call may be recorded for quality.",
    voice: "female",
    playBeforeConnect: true,
  },
  voicemail: {
    enabled: false,
    greeting: "Please leave a message after the tone.",
    maxLengthSec: 120,
    notificationEmail: "",
  },
  whisperMessage: { enabled: false, message: "Incoming call from Avortyx campaign." },
  capSettings: { enabled: false, hourlyCap: 0, dailyCap: 0, monthlyCap: 0, scope: "campaign" },
  revenueSaver: { enabled: false, minRevenue: 0, fallback: "deadEnd", rerouteCampaignId: "" },
  concurrency: { enabled: false, maxConcurrent: 10 },

  rtb: { enabled: false, endpoint: "", authToken: "", timeoutMs: 1000, minBid: 0 },
  enrichmentUrls: [],
  access: [],
};

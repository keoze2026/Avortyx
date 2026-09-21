/**
 * The demo account's identity — mirrors the client's live Avortyx account
 * (client spec: "everything should be the same in demo"), which runs one
 * campaign, one buyer, one publisher and one destination number. Every
 * demo call, entity list, routing plan and insight reads from here so the
 * portal shows exactly one of each, the way the live account does.
 */

export const DEMO_CAMPAIGN = {
  id: "c_23june",
  name: "23 JUNE",
  vertical: "health-insurance" as const,
};

export const DEMO_BUYER = {
  id: "b_adc11",
  name: "ADC11",
  organization: "ADC11",
  contactName: "ADC11 Ops",
  contactEmail: "ops@adc11.example",
};

export const DEMO_PUBLISHER = {
  id: "p_ddddd",
  name: "ddddd",
  organization: "ddddd",
  contactEmail: "ops@ddddd.example",
};

/** The one destination every call routes to. */
export const DEMO_DESTINATION_TFN = "+18886052854";

/**
 * Caps sized to the demo's volume (5 000–6 500 calls a day, up to ~260 in
 * flight) so the live account's single destination doesn't sit at 3 000 %
 * of a 200-call cap all day. Cap alerts still fire near the ceiling.
 */
export const DEMO_CAPS = {
  daily: 7_000,
  monthly: 200_000,
  concurrency: 300,
};

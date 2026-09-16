/**
 * Brand and product-wide constants.
 * Single source of truth — change here, propagate everywhere.
 */

export const BRAND = {
  name: "Avortyx",
  tagline: "The next generation of call intelligence.",
  description:
    "A real-time call tracking, routing, and analytics platform built for modern pay-per-call marketers.",
  domain: "avortyx.io",
  email: "hello@avortyx.io",
} as const;

/** Routes — keep paths centralized so renames are safe. */
export const ROUTES = {
  home: "/",
  pricing: "/pricing",
  careers: "/careers",

  // Auth
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  setPassword: "/set-password",

  // App
  dashboard: "/dashboard",
  live: "/live",
  campaigns: "/campaigns",
  numbers: "/numbers",
  routing: "/routing",
  buyers: "/buyers",
  destinations: "/destinations",
  publishers: "/publishers",
  calls: "/calls",
  reports: "/reports",
  marketplace: "/marketplace",
  insights: "/insights",
  integrations: "/integrations",
  billing: "/billing",
  settings: "/settings",
  notifications: "/notifications",
  workspace: "/workspace",

  // Suppression list — VoIP/TCPA shields + manual block list
  voipShield: "/voip-shield",
  tcpaShield: "/tcpa-shield",
  blockedNumbers: "/blocked-numbers",

  // News feeds
  cryptoNews: "/news/crypto",
  dailyNews: "/news/daily",

  // Referral program — earn 10% on every client you bring in
  referrals: "/referrals",

  // KYC / Trust Engine — multi-vector continuous identity + compliance
  kyc: "/kyc",

  // Phase 6 admin surfaces — backend-only features now with UI.
  queue: "/queue",
  ivr: "/ivr",
  whiteLabel: "/white-label",
} as const;

/** Brand color stops — single-hue indigo ramp.
 *  Mirrors CSS vars; use for inline JS gradients. */
export const VORTYX_COLORS = {
  deep: "#3A4BC4",
  mid: "#5266E0",
  bright: "#818CF8",
  ultra: "#C7D2FE",
} as const;

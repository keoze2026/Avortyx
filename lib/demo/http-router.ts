/**
 * Demo HTTP router.
 *
 * Called from `lib/api/http.ts` when `isDemoMode()` is true — intercepts
 * every request before it touches the network and returns a wire-shape
 * (snake_case) JSON response. The http layer's normal `snakeToCamel`
 * adapter then runs on the result, so consumers see the exact same
 * camelCase shape they get from the real backend.
 *
 * For out-of-scope endpoints (Billing, Settings, Integrations, etc.) we
 * return either an empty list envelope or a generic success — those
 * pages render with their built-in empty states without crashing.
 *
 * URL matching is intentionally string-based (no regex deps): every
 * handler key is either a literal path or a path with `{id}` segments.
 */

import { ApiError } from "../api/errors";
import {
  DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_PASSWORD,
  DEMO_ACCESS_TOKEN,
  DEMO_REFRESH_TOKEN,
} from "./flag";
import { readTable, readObject, writeTable, writeObject, demoId } from "./persist";
import { DEMO_USER_WIRE } from "./fixtures/user";
import {
  seedCampaigns,
  seedBuyers,
  seedPublishers,
  seedNumbers,
  seedDestinations,
  seedRoutingPlans,
  seedIvrFlows,
  seedQueue,
  seedVoipShield,
  seedTcpaShield,
  seedBlockedNumbers,
} from "./fixtures/entities";
import {
  getDemoCalls,
  generateLiveCalls,
  dashboardSnapshot,
  destinationCounters,
  campaignCounters,
  demoLedger,
  LEDGER_COST_PER_CALL,
  LEDGER_RECHARGE_BELOW,
  type DemoCallWire,
} from "./fixtures/calls";
import { demoTimeZone } from "./clock";
import { liveEntry, markHungUp, wasHungUp } from "./live-registry";
import { zonedDayKey } from "@/lib/format";
import {
  seedAuctions,
  bidsForAuction,
  type DemoAuctionWire,
  type DemoBidWire,
} from "./fixtures/auctions";
import {
  seedAiBriefing,
  seedRecommendations,
  seedAnomalies,
  seedAutopilotConfig,
} from "./fixtures/ai";

/* ─── Internal request shape (already-camelCased body, original path) ── */

export interface DemoRequest {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Path WITHOUT query string. */
  path: string;
  query: Record<string, string>;
  /** Body — camelCase as the caller passed it (NOT yet converted to snake_case). */
  body: unknown;
  /** True for endpoints called without an Authorization header. */
  anonymous: boolean;
}

/* ─── Public entry: handle one request ───────────────────────────────── */

export async function handleDemoRequest<T>(req: DemoRequest): Promise<T> {
  // Brief latency so loading spinners flash naturally rather than instantly
  // popping in/out.
  await jitter(60, 220);
  const handler = matchHandler(req.method, req.path);
  if (!handler) {
    // No mock for this endpoint — fall back to an empty-list envelope or
    // a generic success so the calling page renders empty rather than
    // crashing on a 404.
    return emptyFor(req) as T;
  }
  try {
    return (await handler(req)) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError({
      status: 500,
      message: e instanceof Error ? e.message : "Demo error",
      body: { detail: "Demo error" },
    });
  }
}

/* ─── Handler registry ───────────────────────────────────────────────── */

type Handler = (req: DemoRequest) => unknown | Promise<unknown>;
type Route = { method: string; pattern: string; handler: Handler };

const routes: Route[] = [];
function route(method: string, pattern: string, handler: Handler) {
  routes.push({ method, pattern, handler });
}

function matchHandler(method: string, path: string): Handler | null {
  for (const r of routes) {
    if (r.method !== method) continue;
    if (matchesPattern(r.pattern, path)) return r.handler;
  }
  return null;
}

function matchesPattern(pattern: string, path: string): boolean {
  const a = trimSlash(pattern).split("/");
  const b = trimSlash(path).split("/");
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("{") && a[i].endsWith("}")) continue;
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function trimSlash(s: string): string {
  return s.replace(/^\/+|\/+$/g, "");
}

function paramAt(pattern: string, path: string, idx: number): string {
  const b = trimSlash(path).split("/");
  return b[idx] ?? "";
}

function lastSegment(path: string): string {
  const parts = trimSlash(path).split("/");
  return parts[parts.length - 1];
}

function jitter(min: number, max: number): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((r) => setTimeout(r, ms));
}

function paged<T>(items: T[], query: Record<string, string>) {
  const page = Number(query.page ?? "1") || 1;
  const pageSize = Number(query.page_size ?? query.pageSize ?? "25") || 25;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    page_size: pageSize,
  };
}

function emptyFor(req: DemoRequest): unknown {
  if (req.method === "GET") {
    return { items: [], total: 0, page: 1, page_size: 25 };
  }
  return { ok: true };
}

/* ─── Auth ──────────────────────────────────────────────────────────── */

route("POST", "/api/accounts/login", (req) => {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  if (body.email !== DEMO_LOGIN_EMAIL || body.password !== DEMO_LOGIN_PASSWORD) {
    throw new ApiError({
      status: 401,
      message: "Invalid email or password.",
      body: { detail: "Invalid email or password." },
    });
  }
  return {
    access: DEMO_ACCESS_TOKEN,
    refresh: DEMO_REFRESH_TOKEN,
    user_id: DEMO_USER_WIRE.id,
    email: DEMO_USER_WIRE.email,
    role: DEMO_USER_WIRE.role,
    organization_id: DEMO_USER_WIRE.organization_id,
  };
});

route("POST", "/api/accounts/logout", () => ({ ok: true }));
route("POST", "/api/accounts/refresh", () => ({
  access: DEMO_ACCESS_TOKEN,
  refresh: DEMO_REFRESH_TOKEN,
}));

/* Telegram link. The real backend hands out a one-time deep link and the
 * bot writes `telegram_chat_id` when the user presses Start. The demo can't
 * receive that callback, so it "presses Start" for the user ~6 s after the
 * link is issued — enough to see the waiting state and the flip. */
let demoTelegramLinkedAt: number | null = null;

route("GET", "/api/accounts/me", () => {
  const user = readObject("user", () => DEMO_USER_WIRE);
  if (demoTelegramLinkedAt !== null && Date.now() >= demoTelegramLinkedAt && !user.telegram_chat_id) {
    const next = { ...user, telegram_chat_id: "8123456789", telegram_username: user.telegram_username ?? "avortyx_demo" };
    writeObject("user", next);
    demoTelegramLinkedAt = null;
    return next;
  }
  return user;
});

route("POST", "/api/accounts/me/telegram/link", () => {
  const code = `AVX-${demoId("tg").slice(-6).toUpperCase()}`;
  demoTelegramLinkedAt = Date.now() + 6_000;
  return {
    url: `https://t.me/AvortyxBot?start=${code}`,
    code,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
});

route("DELETE", "/api/accounts/me/telegram", () => {
  const user = readObject("user", () => DEMO_USER_WIRE);
  const next = { ...user, telegram_chat_id: null };
  writeObject("user", next);
  demoTelegramLinkedAt = null;
  return { ok: true };
});

route("PATCH", "/api/accounts/me", (req) => {
  const current = readObject("user", () => DEMO_USER_WIRE);
  // Body is camelCase here; convert relevant keys.
  const patch = (req.body ?? {}) as Record<string, unknown>;
  const next = { ...current };
  if (typeof patch.firstName === "string") next.first_name = patch.firstName as string;
  if (typeof patch.lastName === "string") next.last_name = patch.lastName as string;
  if (typeof patch.phoneNumber === "string") next.phone_number = patch.phoneNumber as string;
  if (typeof patch.avatarUrl === "string") next.avatar_url = patch.avatarUrl as string;
  if (typeof patch.telegramUsername === "string") next.telegram_username = patch.telegramUsername || null;
  writeObject("user", next);
  return next;
});

route("POST", "/api/accounts/me/avatar", () => {
  // Real avatar uploads go to Cloudinary in prod; in demo we just echo a
  // 1×1 transparent PNG data URL so the topbar avatar updates instantly.
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=";
  const current = readObject("user", () => DEMO_USER_WIRE);
  const next = { ...current, avatar_url: dataUrl };
  writeObject("user", next);
  return next;
});

route("POST", "/api/accounts/change-password", () => ({ ok: true }));
route("POST", "/api/accounts/password-reset/request", () => ({ ok: true }));
route("POST", "/api/accounts/password-reset/confirm", () => ({ ok: true }));
route("POST", "/api/accounts/register", () => DEMO_USER_WIRE);
route("POST", "/api/accounts/mfa/setup", () => ({ ...DEMO_USER_WIRE, mfa_enabled: true }));
route("POST", "/api/accounts/mfa/disable", () => ({ ...DEMO_USER_WIRE, mfa_enabled: false }));
route("POST", "/api/accounts/verify-mfa", () => ({
  access: DEMO_ACCESS_TOKEN,
  refresh: DEMO_REFRESH_TOKEN,
  user_id: DEMO_USER_WIRE.id,
  email: DEMO_USER_WIRE.email,
  role: DEMO_USER_WIRE.role,
  organization_id: DEMO_USER_WIRE.organization_id,
}));

/* ─── Workspace (minimal — out of demo scope) ────────────────────────── */

route("GET", "/api/accounts/workspace", () => ({
  id: "ws_demo",
  name: DEMO_USER_WIRE.organization_name,
  slug: "avortyx-demo",
  is_active: true,
  created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  member_count: 5,
  plan_tier: "Pro",
}));
route("PATCH", "/api/accounts/workspace", (req) => {
  const body = (req.body ?? {}) as { name?: string; slug?: string };
  return {
    id: "ws_demo",
    name: body.name ?? DEMO_USER_WIRE.organization_name,
    slug: body.slug ?? "avortyx-demo",
    is_active: true,
    created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
});

/* ─── Campaigns ─────────────────────────────────────────────────────── */

/** Every campaign row carries the backend's read-only call / revenue
 *  aggregates, derived from the demo call corpus (see `campaignCounters`). */
function withCampaignCounters<T extends { id?: unknown }>(rows: T[]): T[] {
  const counters = campaignCounters();
  return rows.map((c) => {
    const k = counters.get(String(c.id ?? ""));
    return {
      ...c,
      live_calls: k?.live_calls ?? 0,
      hourly_calls: k?.hourly_calls ?? 0,
      daily_calls: k?.daily_calls ?? 0,
      monthly_calls: k?.monthly_calls ?? 0,
      global_calls: k?.global_calls ?? 0,
      daily_revenue: (k?.daily_revenue ?? 0).toFixed(2),
    };
  });
}

route("GET", "/api/campaigns/", (req) => {
  const rows = withCampaignCounters(readTable("campaigns", seedCampaigns));
  return paged(rows, req.query);
});

route("GET", "/api/campaigns/{id}", (req) => {
  const id = paramAt("/api/campaigns/{id}", req.path, 2);
  const rows = withCampaignCounters(readTable("campaigns", seedCampaigns));
  const hit = rows.find((r) => r.id === id);
  if (!hit) throw notFound("Campaign not found");
  return hit;
});

route("POST", "/api/campaigns/", (req) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rows = readTable("campaigns", seedCampaigns);
  const created = {
    id: demoId("c"),
    name: String(body.name ?? "New Campaign"),
    vertical: String(body.vertical ?? "health-insurance"),
    description: String(body.description ?? ""),
    status: "draft",
    payout_per_call: Number(body.payoutPerCall ?? 50),
    payout_model: "flat",
    total_calls: 0,
    conversion_rate: 0,
    revenue_today: 0,
    daily_cap: Number(body.dailyCap ?? 500),
    monthly_cap: Number(body.monthlyCap ?? 12_000),
    concurrency_cap: Number(body.concurrencyCap ?? 25),
    geo_targets: ["US"],
    created_at: new Date().toISOString(),
    advanced_settings: {},
    buyer_ids: [],
    publisher_ids: [],
  };
  writeTable("campaigns", [created, ...rows]);
  return created;
});

route("PATCH", "/api/campaigns/{id}", (req) => {
  const id = paramAt("/api/campaigns/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("campaigns", seedCampaigns);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw notFound("Campaign not found");
  const body = camelKeyPatch(req.body);
  const next = { ...rows[idx], ...body };
  const updated = [...rows];
  updated[idx] = next;
  writeTable("campaigns", updated);
  return next;
});

route("DELETE", "/api/campaigns/{id}", (req) => {
  const id = paramAt("/api/campaigns/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("campaigns", seedCampaigns);
  writeTable("campaigns", rows.filter((r) => r.id !== id));
  return { ok: true };
});

/* ─── Buyers ────────────────────────────────────────────────────────── */

route("GET", "/api/buyers/", (req) => paged(readTable("buyers", seedBuyers), req.query));
route("GET", "/api/buyers/{id}", (req) => {
  const id = paramAt("/api/buyers/{id}", req.path, 2);
  const rows = readTable("buyers", seedBuyers);
  const hit = rows.find((r) => r.id === id);
  if (!hit) throw notFound("Buyer not found");
  return hit;
});
route("POST", "/api/buyers/", (req) => {
  const body = camelKeyPatch(req.body);
  const created = {
    id: demoId("b"),
    name: String(body.name ?? "New Buyer"),
    organization: String(body.organization ?? ""),
    contact_email: String(body.contactEmail ?? body.email ?? ""),
    contact_name: String(body.contactName ?? ""),
    bid_amount: Number(body.bidAmount ?? 50),
    payout_model: String(body.payoutModel ?? "flat"),
    daily_cap: Number(body.dailyCap ?? 200),
    monthly_cap: Number(body.monthlyCap ?? 6_000),
    concurrency_cap: Number(body.concurrencyCap ?? 12),
    status: "active",
    description: String(body.description ?? ""),
    calls_today: 0,
    calls_month: 0,
    spend_today: 0,
    spend_month: 0,
    lifetime_spend: 0,
    accept_rate: 0,
    conversion_rate: 0,
    campaign_ids: [],
    created_at: new Date().toISOString(),
    not_connected: false,
  };
  const rows = readTable("buyers", seedBuyers);
  writeTable("buyers", [created, ...rows]);
  return created;
});
route("PATCH", "/api/buyers/{id}", (req) => {
  const id = paramAt("/api/buyers/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("buyers", seedBuyers);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw notFound("Buyer not found");
  const next = { ...rows[idx], ...camelKeyPatch(req.body) };
  const updated = [...rows];
  updated[idx] = next;
  writeTable("buyers", updated);
  return next;
});
route("PATCH", "/api/buyers/{id}/cap", (req) => {
  const id = paramAt("/api/buyers/{id}/cap", req.path, 2);
  const rows = readTable<Record<string, unknown>>("buyers", seedBuyers);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw notFound("Buyer not found");
  const next = { ...rows[idx], ...camelKeyPatch(req.body) };
  const updated = [...rows];
  updated[idx] = next;
  writeTable("buyers", updated);
  return next;
});
route("DELETE", "/api/buyers/{id}", (req) => {
  const id = paramAt("/api/buyers/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("buyers", seedBuyers);
  writeTable("buyers", rows.filter((r) => r.id !== id));
  return { ok: true };
});

/* ─── Publishers ────────────────────────────────────────────────────── */

route("GET", "/api/publishers/", (req) => paged(readTable("publishers", seedPublishers), req.query));
route("GET", "/api/publishers/{id}", (req) => {
  const id = paramAt("/api/publishers/{id}", req.path, 2);
  const rows = readTable("publishers", seedPublishers);
  const hit = rows.find((r) => r.id === id);
  if (!hit) throw notFound("Publisher not found");
  return hit;
});
route("POST", "/api/publishers/", (req) => {
  const body = camelKeyPatch(req.body);
  const created = {
    id: demoId("p"),
    name: String(body.name ?? "New Publisher"),
    organization: String(body.organization ?? ""),
    contact_email: String(body.contactEmail ?? body.email ?? ""),
    description: String(body.description ?? ""),
    payout_rate: Number(body.payoutRate ?? 0.55),
    status: "active",
    calls_today: 0,
    calls_month: 0,
    revenue_today: 0,
    revenue_month: 0,
    pending_payout: 0,
    conversion_rate: 0,
    numbers_assigned: 0,
    is_partner: false,
    created_at: new Date().toISOString(),
  };
  const rows = readTable("publishers", seedPublishers);
  writeTable("publishers", [created, ...rows]);
  return created;
});
route("PATCH", "/api/publishers/{id}", (req) => {
  const id = paramAt("/api/publishers/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("publishers", seedPublishers);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw notFound("Publisher not found");
  const next = { ...rows[idx], ...camelKeyPatch(req.body) };
  const updated = [...rows];
  updated[idx] = next;
  writeTable("publishers", updated);
  return next;
});
route("DELETE", "/api/publishers/{id}", (req) => {
  const id = paramAt("/api/publishers/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("publishers", seedPublishers);
  writeTable("publishers", rows.filter((r) => r.id !== id));
  return { ok: true };
});

/* ─── Numbers ───────────────────────────────────────────────────────── */

route("GET", "/api/numbers/", (req) => paged(readTable("numbers", seedNumbers), req.query));
route("GET", "/api/numbers/search", () => ({
  items: [
    { phone_number: "+12125551500", friendly_number: "+1 (212) 555-1500", area_code: "212", type: "local", monthly_cost: 1.0 },
    { phone_number: "+14155551501", friendly_number: "+1 (415) 555-1501", area_code: "415", type: "local", monthly_cost: 1.0 },
    { phone_number: "+18885551502", friendly_number: "+1 (888) 555-1502", area_code: "888", type: "toll-free", monthly_cost: 2.0 },
  ],
  total: 3,
}));
route("POST", "/api/numbers/purchase", (req) => {
  const body = camelKeyPatch(req.body);
  const created = {
    id: demoId("n"),
    number: String(body.phoneNumber ?? "+12125559999"),
    formatted_number: String(body.phoneNumber ?? "+12125559999"),
    friendly_name: "Demo purchased number",
    country: "US",
    status: "active",
    type: "local",
    provider: "Twilio",
    monthly_cost: 1.0,
    calls_today: 0,
    created_at: new Date().toISOString(),
  };
  const rows = readTable("numbers", seedNumbers);
  writeTable("numbers", [created, ...rows]);
  return created;
});
route("POST", "/api/numbers/import", () => ({ ok: true, imported: 0 }));
route("PATCH", "/api/numbers/{id}", (req) => {
  const id = paramAt("/api/numbers/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("numbers", seedNumbers);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw notFound("Number not found");
  const next = { ...rows[idx], ...camelKeyPatch(req.body) };
  const updated = [...rows];
  updated[idx] = next;
  writeTable("numbers", updated);
  return next;
});
route("DELETE", "/api/numbers/{id}", (req) => {
  const id = paramAt("/api/numbers/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("numbers", seedNumbers);
  writeTable("numbers", rows.filter((r) => r.id !== id));
  return { ok: true };
});

/* ─── Phone number provisioning (Twilio-backed) ─────────────────────── */
// These are the real contract endpoints the backend exposes for number
// provisioning. The legacy /api/numbers/search and /api/numbers/purchase
// routes above stay in place for other flows; the provision dialog uses
// these exclusively.

route("POST", "/api/numbers/search", (req) => {
  const body = camelKeyPatch(req.body);
  const numberType = String(body.numberType ?? "toll_free");
  const areaCode = String(body.areaCode ?? "212");
  const limit = Math.min(Number(body.limit ?? 5), 5);
  const isTollFree = numberType === "toll_free" || numberType === "tollfree";

  function fmt(e164: string) {
    const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
    return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164;
  }

  const TF_PREFIXES = ["800", "833", "844", "855", "866"];
  const results = Array.from({ length: limit }, (_, i) => {
    const lineNum = String(1001 + i).padStart(4, "0");
    const phoneNumber = isTollFree
      ? `+1${TF_PREFIXES[i % TF_PREFIXES.length]}555${lineNum}`
      : `+1${areaCode}555${lineNum}`;
    return {
      phone_number: phoneNumber,
      friendly_name: fmt(phoneNumber),
      number_type: numberType,
      monthly_cost: isTollFree ? 5.0 : 2.0,
    };
  });
  return results;
});

route("POST", "/api/numbers/purchase", (req) => {
  const body = camelKeyPatch(req.body);
  const phoneNumber = String(body.phoneNumber ?? "+12125559999");
  const created = {
    id: demoId("n"),
    number: phoneNumber,
    formatted_number: phoneNumber,
    friendly_name: phoneNumber,
    country: "US",
    status: "active",
    number_type: String(body.numberType ?? "local"),
    provider: "Twilio",
    monthly_cost: 2.0,
    campaign_id: body.campaignId ?? null,
    calls_today: 0,
    created_at: new Date().toISOString(),
  };
  const rows = readTable("numbers", seedNumbers);
  writeTable("numbers", [created, ...rows]);
  return created;
});

/* ─── Destinations ──────────────────────────────────────────────────── */

/** Every destination row carries the backend's read-only aggregates
 *  (`live_calls`, `daily_calls`, `daily_revenue`, `daily_spend`), derived
 *  here from the demo call corpus. */
function withDestinationCounters<T extends { tfn?: unknown }>(rows: T[]): T[] {
  const counters = destinationCounters();
  return rows.map((d) => {
    const c = counters.get(String(d.tfn ?? ""));
    return {
      ...d,
      live_calls: c?.live_calls ?? 0,
      hourly_calls: c?.hourly_calls ?? 0,
      daily_calls: c?.daily_calls ?? 0,
      monthly_calls: c?.monthly_calls ?? 0,
      global_calls: c?.global_calls ?? 0,
      daily_revenue: (c?.daily_revenue ?? 0).toFixed(2),
      daily_spend: (c?.daily_spend ?? 0).toFixed(2),
    };
  });
}

route("GET", "/api/destinations/", (req) =>
  paged(withDestinationCounters(readTable("destinations", seedDestinations)), req.query),
);
route("GET", "/api/destinations/{id}", (req) => {
  const id = paramAt("/api/destinations/{id}", req.path, 2);
  const rows = withDestinationCounters(readTable("destinations", seedDestinations));
  const hit = rows.find((r) => r.id === id);
  if (!hit) throw notFound("Destination not found");
  return hit;
});
route("POST", "/api/destinations/", (req) => {
  const body = camelKeyPatch(req.body);
  // Same rule as the backend: a destination with no buyer can never
  // receive calls, so the create is refused.
  if (!body.buyer_id) {
    throw new ApiError({
      status: 400,
      message: "buyer_id is required, a destination with no buyer can never receive calls",
      code: "buyer_required",
      fieldErrors: [{ field: "buyerId", message: "Pick a buyer." }],
    });
  }
  const created = {
    id: demoId("d"),
    name: String(body.name ?? "New Destination"),
    tfn: String(body.tfn ?? "+18005550000"),
    type: "phone",
    target_value: String(body.targetValue ?? "+18005551234"),
    buyer_id: String(body.buyerId ?? ""),
    status: "active",
    daily_cap: Number(body.dailyCap ?? 200),
    monthly_cap: Number(body.monthlyCap ?? 6_000),
    concurrency_cap: Number(body.concurrencyCap ?? 12),
    enabled: true,
    weight: 1,
    priority: 100,
    created_at: new Date().toISOString(),
  };
  const rows = readTable("destinations", seedDestinations);
  writeTable("destinations", [created, ...rows]);
  return created;
});
route("PATCH", "/api/destinations/{id}", (req) => {
  const id = paramAt("/api/destinations/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("destinations", seedDestinations);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw notFound("Destination not found");
  const next = { ...rows[idx], ...camelKeyPatch(req.body) };
  const updated = [...rows];
  updated[idx] = next;
  writeTable("destinations", updated);
  return next;
});
route("DELETE", "/api/destinations/{id}", (req) => {
  const id = paramAt("/api/destinations/{id}", req.path, 2);
  const rows = readTable<Record<string, unknown>>("destinations", seedDestinations);
  writeTable("destinations", rows.filter((r) => r.id !== id));
  return { ok: true };
});
route("GET", "/api/destinations/stats/", () => ({
  items: readTable("destinations", seedDestinations).map((d: Record<string, unknown>) => ({
    destination_id: d.id,
    calls_today: 64,
    concurrent: 4,
    revenue_today: 2_412,
  })),
}));

/* ─── Routing plans ─────────────────────────────────────────────────── */

route("GET", "/api/routing/rules", (req) => paged(readTable("routing", seedRoutingPlans), req.query));
route("GET", "/api/routing/rules/{id}", (req) => {
  const id = paramAt("/api/routing/rules/{id}", req.path, 3);
  const rows = readTable("routing", seedRoutingPlans);
  const hit = rows.find((r) => r.id === id);
  if (!hit) throw notFound("Routing plan not found");
  return hit;
});
route("POST", "/api/routing/rules", (req) => {
  const body = camelKeyPatch(req.body);
  const created = {
    id: demoId("rp"),
    name: String(body.name ?? "New Routing Plan"),
    description: String(body.description ?? ""),
    status: "draft",
    rule_type: body.ruleType ?? "visual-graph",
    priority: body.priority ?? 1,
    campaign_id: body.campaignId ?? null,
    campaign_name: body.campaignName ?? null,
    // The wire shape the editor actually reads (see routing.service.ts /
    // routing-bridge.ts) — the visual graph is packed into `conditions`,
    // buyer assignments live in `destinations`. Both start empty; the
    // client's create flow immediately follows up with addCondition() /
    // addDestination() calls below to fill them in.
    conditions: [],
    destinations: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const rows = readTable("routing", seedRoutingPlans);
  writeTable("routing", [created, ...rows]);
  return created;
});
route("PATCH", "/api/routing/rules/{id}", (req) => {
  const id = paramAt("/api/routing/rules/{id}", req.path, 3);
  const rows = readTable<Record<string, unknown>>("routing", seedRoutingPlans);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw notFound("Routing plan not found");
  const next = { ...rows[idx], ...camelKeyPatch(req.body), updated_at: new Date().toISOString() };
  const updated = [...rows];
  updated[idx] = next;
  writeTable("routing", updated);
  return next;
});
route("DELETE", "/api/routing/rules/{id}", (req) => {
  const id = paramAt("/api/routing/rules/{id}", req.path, 3);
  const rows = readTable<Record<string, unknown>>("routing", seedRoutingPlans);
  writeTable("routing", rows.filter((r) => r.id !== id));
  return { ok: true };
});

// These three were entirely unmocked — every call silently fell through to
// `emptyFor()`'s `{ ok: true }` stub with no write to the `routing` table.
// The routing editor's Save button therefore always reported success
// (no thrown error) while persisting nothing: a fresh plan reloaded blank
// right after creation, and edits to an existing plan reverted on refresh.
// This reproduces "routing rules can't be created or edited" independent of
// any backend state — worth fixing here regardless of the backend's own bug.
route("POST", "/api/routing/rules/{ruleId}/conditions", (req) => {
  const id = paramAt("/api/routing/rules/{ruleId}/conditions", req.path, 3);
  const rows = readTable<Record<string, unknown>>("routing", seedRoutingPlans);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw notFound("Routing plan not found");
  const body = camelKeyPatch(req.body) as { conditions?: Record<string, unknown> };
  const created = { id: demoId("cond"), conditions: body.conditions ?? {} };
  const prevConditions = Array.isArray(rows[idx].conditions) ? (rows[idx].conditions as unknown[]) : [];
  const updated = [...rows];
  updated[idx] = {
    ...rows[idx],
    // The bridge picks the latest graph blob on reconstruct — append, don't
    // replace, mirroring the real backend's documented behavior.
    conditions: [...prevConditions, created],
    updated_at: new Date().toISOString(),
  };
  writeTable("routing", updated);
  return created;
});
route("POST", "/api/routing/rules/{ruleId}/destinations", (req) => {
  const id = paramAt("/api/routing/rules/{ruleId}/destinations", req.path, 3);
  const rows = readTable<Record<string, unknown>>("routing", seedRoutingPlans);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw notFound("Routing plan not found");
  const body = camelKeyPatch(req.body) as { buyerId?: string; weight?: number; priority?: number };
  const buyerRows = readTable<Record<string, unknown>>("buyers", seedBuyers);
  const buyer = buyerRows.find((b) => b.id === body.buyerId);
  const created = {
    id: demoId("dest"),
    buyer_id: body.buyerId ?? "",
    buyer_name: (buyer?.name as string | undefined) ?? "",
    weight: body.weight ?? 100,
    priority: body.priority ?? 1,
  };
  const prevDestinations = Array.isArray(rows[idx].destinations) ? (rows[idx].destinations as unknown[]) : [];
  const updated = [...rows];
  updated[idx] = {
    ...rows[idx],
    destinations: [...prevDestinations, created],
    updated_at: new Date().toISOString(),
  };
  writeTable("routing", updated);
  return created;
});
route("POST", "/api/routing/rules/{ruleId}/simulate", (req) => {
  const id = paramAt("/api/routing/rules/{ruleId}/simulate", req.path, 3);
  const rows = readTable<Record<string, unknown>>("routing", seedRoutingPlans);
  const rule = rows.find((r) => r.id === id);
  if (!rule) throw notFound("Routing plan not found");
  const conditions = Array.isArray(rule.conditions) ? (rule.conditions as Array<{ id: string }>) : [];
  const destinations = Array.isArray(rule.destinations)
    ? (rule.destinations as Array<{ id: string; buyer_id?: string; buyer_name?: string; weight?: number; priority?: number }>)
    : [];
  const picked = destinations[0];
  return {
    matched_conditions: conditions.map((c) => ({ condition_id: c.id, matched: true })),
    selected_destination: picked
      ? {
          id: picked.id,
          name: picked.buyer_name ?? "Buyer",
          buyer_name: picked.buyer_name ?? "Buyer",
          weight: picked.weight ?? 100,
          priority: picked.priority ?? 1,
        }
      : undefined,
    trace: [
      { step: "Inbound", outcome: "Call received" },
      { step: "Conditions", outcome: `${conditions.length} evaluated` },
      {
        step: "Destination",
        outcome: picked ? `Routed to ${picked.buyer_name ?? "buyer"}` : "No destination configured",
      },
    ],
  };
});

/* ─── IVR ───────────────────────────────────────────────────────────── */

route("GET", "/api/ivr/flows", (req) => paged(readTable("ivr", seedIvrFlows), req.query));
route("GET", "/api/ivr/flows/{id}", (req) => {
  const id = paramAt("/api/ivr/flows/{id}", req.path, 3);
  const rows = readTable("ivr", seedIvrFlows);
  const hit = rows.find((r) => r.id === id);
  if (!hit) throw notFound("Flow not found");
  return hit;
});
route("POST", "/api/ivr/flows", (req) => {
  const body = camelKeyPatch(req.body);
  const created = {
    id: demoId("ivr"),
    name: String(body.name ?? "New flow"),
    description: String(body.description ?? ""),
    status: "draft",
    campaign_id: body.campaignId ?? null,
    campaign_name: null,
    language: String(body.language ?? "en"),
    voice: String(body.voice ?? "alloy"),
    welcome_message: String(body.welcomeMessage ?? ""),
    created_at: new Date().toISOString(),
  };
  const rows = readTable("ivr", seedIvrFlows);
  writeTable("ivr", [created, ...rows]);
  return created;
});
route("DELETE", "/api/ivr/flows/{id}", (req) => {
  const id = paramAt("/api/ivr/flows/{id}", req.path, 3);
  const rows = readTable<Record<string, unknown>>("ivr", seedIvrFlows);
  writeTable("ivr", rows.filter((r) => r.id !== id));
  return { ok: true };
});

/* ─── Queue ─────────────────────────────────────────────────────────── */

route("GET", "/api/queue/", () => ({ items: seedQueue(), total: seedQueue().length }));

/* ─── Spam / VoIP / TCPA / Blocked ─────────────────────────────────── */

route("GET", "/api/spam/shields/voip", () => readObject("voip-shield", seedVoipShield));
route("GET", "/api/spam/shields/tcpa", () => readObject("tcpa-shield", seedTcpaShield));
route("PATCH", "/api/spam/shields/voip", (req) => {
  const current = readObject("voip-shield", seedVoipShield);
  const next = { ...current, ...(camelKeyPatch(req.body) as object) };
  writeObject("voip-shield", next);
  return next;
});
route("PATCH", "/api/spam/shields/tcpa", (req) => {
  const current = readObject("tcpa-shield", seedTcpaShield);
  const next = { ...current, ...(camelKeyPatch(req.body) as object) };
  writeObject("tcpa-shield", next);
  return next;
});
route("GET", "/api/spam/blacklist", (req) => paged(readTable("blocked", seedBlockedNumbers), req.query));
route("POST", "/api/spam/blacklist", (req) => {
  const body = camelKeyPatch(req.body);
  // The service sends `phone_number` (the real backend's field); accept the
  // older `number` too. Stored as E.164 like the backend echoes it.
  const raw = String(body.phone_number ?? body.number ?? "").replace(/\D/g, "");
  const number = raw ? `+${raw}` : "+10000000000";
  const created = {
    id: demoId("bn"),
    number,
    formatted: number,
    reason: String(body.reason ?? "Manual block"),
    scope: String(body.scope ?? "global"),
    added_by: "Alex Morgan",
    created_at: new Date().toISOString(),
  };
  const rows = readTable("blocked", seedBlockedNumbers);
  writeTable("blocked", [created, ...rows]);
  return created;
});
route("DELETE", "/api/spam/blacklist/{id}", (req) => {
  const id = paramAt("/api/spam/blacklist/{id}", req.path, 3);
  const rows = readTable<Record<string, unknown>>("blocked", seedBlockedNumbers);
  writeTable("blocked", rows.filter((r) => r.id !== id));
  return { ok: true };
});
route("GET", "/api/spam/whitelist", () => ({ items: [], total: 0 }));
route("POST", "/api/spam/anonymous-block", () => ({ ok: true }));
route("GET", "/api/spam/reports", () => ({ items: [], total: 0 }));

/* ─── Calls + Analytics ────────────────────────────────────────────── */

route("GET", "/api/analytics/calls", (req) => {
  // Dashboards and report aggregates ask for big windows (limit ≥ 100) so
  // they can client-side bucket the data into charts. For those, return the
  // entire (already date/status-filtered) matching set so the donut totals +
  // hourly distribution look full. For the Call Log table's normal paging
  // (limit ≤ 50), respect paging so the pagination UI stays coherent.
  //
  // Important: `analyticsService.calls()` translates `pageSize` → `limit`
  // and `page` → `offset` on the wire, so we read those, not page_size.
  let all = getDemoCalls();

  // Reports page date range — previously unfiltered here (the frontend used
  // to apply its own, browser-timezone client-side date check instead), so
  // picking a historical range in demo mode silently showed every call ever
  // generated. `date_from`/`date_to` are "YYYY-MM-DD" report-timezone day
  // keys in the report timezone, so each row is bucketed in that zone —
  // the same zone the demo's business day is generated in.
  if (req.query.date_from) {
    const from = req.query.date_from;
    const to = req.query.date_to || from;
    const tz = demoTimeZone();
    all = all.filter((c) => {
      const day = zonedDayKey(Date.parse(c.created_at), tz);
      return day >= from && day <= to;
    });
  }

  // Reports page click-to-filter (Connected / Qualified totals). The real
  // backend's CDR `status` column only ever holds `no_answer` | `completed`
  // | `failed`, and the frontend now queries with that same vocabulary
  // (status=completed for "Connected"), so a plain lowercase match here
  // exercises the same filter the real backend applies.
  if (req.query.status) {
    all = all.filter((c) => c.status === req.query.status!.toLowerCase());
  }
  // Verdict filters — same flags the real backend accepts.
  if (req.query.is_qualified === "true") all = all.filter((c) => c.is_qualified);
  if (req.query.is_converted === "true") all = all.filter((c) => c.is_converted);
  if (req.query.is_duplicate === "true") all = all.filter((c) => c.is_duplicate);
  if (req.query.is_spam === "true") all = all.filter((c) => c.is_spam);
  if (req.query.carrier) all = all.filter((c) => c.carrier === req.query.carrier);

  const limit = Number(req.query.limit ?? req.query.page_size ?? req.query.pageSize ?? "25") || 25;
  if (limit >= 100) {
    return { items: all, total: all.length, offset: 0, limit: all.length };
  }
  const offset = Number(req.query.offset ?? "0") || 0;
  return {
    items: all.slice(offset, offset + limit),
    total: all.length,
    offset,
    limit,
  };
});

route("GET", "/api/routing/calls", (req) => {
  const all = getDemoCalls();
  const limit = Number(req.query.limit ?? req.query.page_size ?? req.query.pageSize ?? "25") || 25;
  if (limit >= 100) {
    return { items: all, total: all.length, offset: 0, limit: all.length };
  }
  const offset = Number(req.query.offset ?? "0") || 0;
  return {
    items: all.slice(offset, offset + limit),
    total: all.length,
    offset,
    limit,
  };
});

// The real backend puts the account balance on the dashboard payload too
// (same request that fills the header's Live / Total), so mirror that here
// from the same figure /api/billing/account serves.
route("GET", "/api/analytics/dashboard", () => ({
  ...dashboardSnapshot(),
  balance: demoBalance(),
  currency: "USD",
}));

route("GET", "/api/analytics/live", () => generateLiveCalls().filter((c) => !wasHungUp(c.id)));
route("GET", "/api/routing/calls/live", () => generateLiveCalls().filter((c) => !wasHungUp(c.id)));

/**
 * Manual hang-up. Mirrors the backend: a live call closes as `no_answer`
 * with zero duration and no charge if it never connected (ringing), or
 * `completed` with its real duration and the per-call charge if it had.
 * Anything that already ended is a 400 with its current status.
 */
route("POST", "/api/routing/calls/{id}/hangup", (req) => {
  const id = trimSlash(req.path).split("/").at(-2) ?? "";
  // The Live Monitor's cards come from the demo socket (tracked in the
  // live registry); the call log's Live rows from the REST snapshot.
  const live =
    liveEntry(id) ??
    (() => {
      const c = generateLiveCalls().find((x) => x.id === id);
      return c ? { startedAt: Date.parse(c.created_at), status: c.status as "ringing" | "in-progress" } : undefined;
    })();
  if (!live || wasHungUp(id)) {
    const settled = getDemoCalls().find((c) => c.id === id);
    throw new ApiError({
      status: 400,
      message: settled ? `Call already ended (${settled.status}).` : wasHungUp(id) ? "Call already ended (completed)." : "Call not found.",
      code: "call_not_live",
    });
  }
  markHungUp(id);
  const connected = live.status === "in-progress";
  const duration = connected ? Math.max(1, Math.floor((Date.now() - live.startedAt) / 1000)) : 0;
  return {
    id,
    status: connected ? "completed" : "no_answer",
    duration,
    converted: connected,
    charged: connected ? LEDGER_COST_PER_CALL.toFixed(2) : null,
    ended_at: new Date().toISOString(),
    message: "Call record closed. Live audio, if any, is not affected.",
  };
});

/**
 * Per-entity aggregates for a date range — the same shape the real backend
 * returns from /api/analytics/campaigns | /buyers | /publishers
 * (`total_calls`, `connected_calls`, `not_connected_calls`,
 * `qualified_calls`, `converted_calls`, `paid_calls`, `duplicate_calls`,
 * `live_calls`, `total_duration_sec`, `total_revenue`, …). Derived from
 * the same call corpus the call log serves, so the Reports Call Summary
 * reads identical figures whichever source it uses.
 *
 * Backend definitions mirrored here: connected = completed | in-progress;
 * not_connected = everything else; paid = converted with a payout;
 * live = ringing | in-progress; duplicate = the record's `is_duplicate`.
 */
function entitySummary(
  req: { query: Record<string, string> },
  key: (c: DemoCallWire) => { id: string; name: string },
  idField: string,
  nameField: string,
) {
  let all = getDemoCalls();
  if (req.query.date_from) {
    const from = req.query.date_from;
    const to = req.query.date_to || from;
    const tz = demoTimeZone();
    all = all.filter((c) => {
      const day = zonedDayKey(Date.parse(c.created_at), tz);
      return day >= from && day <= to;
    });
  }
  interface Agg {
    id: string;
    name: string;
    total_calls: number;
    connected_calls: number;
    not_connected_calls: number;
    qualified_calls: number;
    converted_calls: number;
    paid_calls: number;
    duplicate_calls: number;
    live_calls: number;
    total_duration_sec: number;
    total_revenue: number;
    total_payout: number;
  }
  const rows = new Map<string, Agg>();
  const rowFor = (id: string, name: string) => {
    let a = rows.get(id);
    if (!a) {
      a = {
        id,
        name,
        total_calls: 0,
        connected_calls: 0,
        not_connected_calls: 0,
        qualified_calls: 0,
        converted_calls: 0,
        paid_calls: 0,
        duplicate_calls: 0,
        live_calls: 0,
        total_duration_sec: 0,
        total_revenue: 0,
        total_payout: 0,
      };
      rows.set(id, a);
    }
    return a;
  };
  for (const c of all) {
    const k = key(c);
    if (!k.id) continue;
    const a = rowFor(k.id, k.name);
    const connected = c.status === "completed" || c.status === "in-progress";
    const payout = Number(c.publisher_payout || 0);
    a.total_calls += 1;
    if (connected) a.connected_calls += 1;
    else a.not_connected_calls += 1;
    if (c.is_qualified) a.qualified_calls += 1;
    if (c.is_converted) {
      a.converted_calls += 1;
      if (payout > 0) a.paid_calls += 1;
    }
    if (c.is_duplicate) a.duplicate_calls += 1;
    a.total_duration_sec += c.duration;
    a.total_revenue += Number(c.revenue || 0);
    a.total_payout += payout;
  }
  // In-flight calls count toward total / connected / live, like the backend.
  for (const c of generateLiveCalls()) {
    const k = key(c);
    if (!k.id) continue;
    const a = rowFor(k.id, k.name);
    a.total_calls += 1;
    a.live_calls += 1;
    if (c.status === "in-progress") a.connected_calls += 1;
    else a.not_connected_calls += 1;
  }
  return {
    items: [...rows.values()].map(({ id, name, ...a }) => ({
      [idField]: id,
      [nameField]: name,
      ...a,
      conversion_rate: a.total_calls > 0 ? Math.round((a.converted_calls / a.total_calls) * 10_000) / 100 : 0,
      total_revenue: a.total_revenue.toFixed(2),
      total_payout: a.total_payout.toFixed(2),
      total_profit: (a.total_revenue - a.total_payout).toFixed(2),
    })),
  };
}

route("GET", "/api/analytics/campaigns", (req) =>
  entitySummary(req, (c) => ({ id: c.campaign_id, name: c.campaign_name }), "campaign_id", "campaign_name"),
);
route("GET", "/api/analytics/buyers", (req) =>
  entitySummary(req, (c) => ({ id: c.buyer_id, name: c.buyer_name }), "buyer_id", "buyer_name"),
);
route("GET", "/api/analytics/publishers", (req) =>
  entitySummary(req, (c) => ({ id: c.publisher_id, name: c.publisher_name }), "publisher_id", "publisher_name"),
);
// Carrier rows have no id — the carrier name is the key, as in production.
route("GET", "/api/analytics/carriers", (req) =>
  entitySummary(req, (c) => ({ id: c.carrier, name: c.carrier }), "carrier", "carrier"),
);
route("GET", "/api/analytics/time-series", () => ({ items: [] }));
route("GET", "/api/analytics/reports/", () => ({ items: [], total: 0 }));
route("GET", "/api/analytics/calls/export", () => ({ ok: true }));

/* ─── Marketplace (RTB) ─────────────────────────────────────────────── */

route("GET", "/api/rtb/auctions", (req) => {
  const rows = readTable<DemoAuctionWire>("auctions", seedAuctions);
  return paged(rows, req.query);
});
route("GET", "/api/rtb/auctions/{id}", (req) => {
  const id = paramAt("/api/rtb/auctions/{id}", req.path, 3);
  const rows = readTable<DemoAuctionWire>("auctions", seedAuctions);
  const hit = rows.find((r) => r.id === id);
  if (!hit) throw notFound("Auction not found");
  return hit;
});
route("GET", "/api/rtb/auctions/{id}/bids", (req) => {
  const id = paramAt("/api/rtb/auctions/{id}/bids", req.path, 3);
  const rows = readTable<DemoAuctionWire>("auctions", seedAuctions);
  const hit = rows.find((r) => r.id === id);
  if (!hit) return { items: [] };
  return { items: bidsForAuction(hit) };
});
route("POST", "/api/rtb/bid", (req) => {
  const body = camelKeyPatch(req.body);
  return {
    id: demoId("bid"),
    auction_id: String(body.auctionId ?? ""),
    buyer_id: String(body.buyerId ?? ""),
    buyer_name: "Demo Buyer",
    amount: Number(body.amount ?? 0),
    is_winning: true,
    created_at: Date.now(),
  };
});

/* ─── AI Insights ───────────────────────────────────────────────────── */

route("GET", "/api/ai/briefing/", () => seedAiBriefing());
route("GET", "/api/ai/recommendations/", () => ({
  items: readTable("ai-recs", seedRecommendations),
}));
route("POST", "/api/ai/recommendations/{id}/apply", (req) => {
  const id = paramAt("/api/ai/recommendations/{id}/apply", req.path, 3);
  const rows = readTable<Record<string, unknown>>("ai-recs", seedRecommendations);
  const next = rows.map((r) => (r.id === id ? { ...r, status: "applied" } : r));
  writeTable("ai-recs", next);
  return { ok: true };
});
route("POST", "/api/ai/recommendations/{id}/dismiss", (req) => {
  const id = paramAt("/api/ai/recommendations/{id}/dismiss", req.path, 3);
  const rows = readTable<Record<string, unknown>>("ai-recs", seedRecommendations);
  const next = rows.map((r) => (r.id === id ? { ...r, status: "dismissed" } : r));
  writeTable("ai-recs", next);
  return { ok: true };
});
route("GET", "/api/ai/anomalies/", () => ({ items: seedAnomalies() }));
route("GET", "/api/ai/autopilot/", () => readObject("autopilot", seedAutopilotConfig));
route("GET", "/api/ai/autopilot/config/", () => readObject("autopilot", seedAutopilotConfig));
route("PATCH", "/api/ai/autopilot/config/", (req) => {
  const current = readObject("autopilot", seedAutopilotConfig);
  const next = { ...current, ...(camelKeyPatch(req.body) as object) };
  writeObject("autopilot", next);
  return next;
});

/* ─── DNI pools ─────────────────────────────────────────────────────── */

route("GET", "/api/dni/pools", () => ({ items: [], total: 0 }));

/* ─── Billing (out of demo scope, but shape-sensitive) ──────────────── */

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

/** Balance drifts $20K–$80K across buckets so the wallet pill in the topbar
 *  reads like an active operator account, not a fixed default. One source
 *  for both /api/billing/account and /api/analytics/dashboard. */
/** Account balance from the demo ledger — $50k opening recharge, $0.40 per
 *  call, auto-recharge $30k–$60k under $1k (see fixtures/calls.ts). */
function demoBalance(): string {
  return demoLedger().balance.toFixed(2);
}

route("GET", "/api/billing/account", () => ({
  id: "acct_demo",
  balance: demoBalance(),
  credit_limit: "75000.00",
  low_balance_threshold: LEDGER_RECHARGE_BELOW.toFixed(2),
  auto_recharge: true,
  auto_recharge_amount: demoLedger().lastRecharge.amount.toFixed(2),
  auto_recharge_threshold: LEDGER_RECHARGE_BELOW.toFixed(2),
  currency: "USD",
  status: "active",
  plan_tier: "Pro",
  plan_monthly_cost: "299.00",
  plan_calls_included: 25_000,
  plan_overage_rate_per_call: "0.012",
  plan_renews_at: new Date(NOW + 18 * DAY).toISOString(),
}));

route("PATCH", "/api/billing/account", (req) => {
  const patch = camelKeyPatch(req.body);
  return {
    id: "acct_demo",
    balance: "1284.50",
    credit_limit: "5000.00",
    low_balance_threshold: String(patch.low_balance_threshold ?? "100.00"),
    auto_recharge: patch.auto_recharge ?? true,
    auto_recharge_amount: String(patch.auto_recharge_amount ?? "250.00"),
    auto_recharge_threshold: String(patch.auto_recharge_threshold ?? "100.00"),
    currency: "USD",
    status: "active",
    plan_tier: "Pro",
  };
});

route("GET", "/api/billing/payment-methods", () => [
  {
    id: "pm_demo_1",
    type: "card",
    brand: "Visa",
    last4: "4242",
    expiry_month: 12,
    expiry_year: 2028,
    is_default: true,
  },
]);

route("POST", "/api/billing/payment-methods", () => ({
  id: demoId("pm"),
  type: "card",
  brand: "Visa",
  last4: "4242",
  expiry_month: 12,
  expiry_year: 2028,
  is_default: false,
}));

route("DELETE", "/api/billing/payment-methods/{id}", () => ({ ok: true }));

route("GET", "/api/billing/expenses", () => ({
  total: 14_840.5,
  categories: [
    { key: "voice", label: "Voice minutes", amount: 8_220.4 },
    { key: "recording", label: "Recording storage", amount: 1_148.6 },
    { key: "tracking", label: "Tracking numbers", amount: 2_204.0 },
    { key: "rtb", label: "RTB transactions", amount: 1_842.5 },
    { key: "addons", label: "Add-ons", amount: 1_225.0 },
  ],
  range_start: new Date(NOW - 30 * DAY).toISOString(),
  range_end: new Date(NOW).toISOString(),
}));

route("GET", "/api/billing/invoices", (req) => {
  const inv = [
    { id: "inv_001", invoice_number: "AVX-2026-0006", period_start: new Date(NOW - 30 * DAY).toISOString(), period_end: new Date(NOW).toISOString(), total_calls: 24_120, total_revenue: "84210.40", total_payout: "52340.80", total_amount: "14840.50", status: "open" },
    { id: "inv_002", invoice_number: "AVX-2026-0005", period_start: new Date(NOW - 60 * DAY).toISOString(), period_end: new Date(NOW - 30 * DAY).toISOString(), total_calls: 22_810, total_revenue: "79420.10", total_payout: "49860.40", total_amount: "13720.20", status: "paid" },
    { id: "inv_003", invoice_number: "AVX-2026-0004", period_start: new Date(NOW - 90 * DAY).toISOString(), period_end: new Date(NOW - 60 * DAY).toISOString(), total_calls: 19_440, total_revenue: "68240.00", total_payout: "42190.30", total_amount: "11820.00", status: "paid" },
    { id: "inv_004", invoice_number: "AVX-2026-0003", period_start: new Date(NOW - 120 * DAY).toISOString(), period_end: new Date(NOW - 90 * DAY).toISOString(), total_calls: 18_220, total_revenue: "62110.80", total_payout: "38950.20", total_amount: "10440.50", status: "paid" },
  ];
  return paged(inv, req.query);
});

route("GET", "/api/billing/transactions", (req) => {
  // Recharges from the ledger (newest first) plus the most recent call
  // charges, so the statement reconciles with the balance in the topbar.
  const ledger = demoLedger();
  const tx: Array<Record<string, unknown>> = [];
  let running = ledger.balance;
  for (const c of getDemoCalls().slice(0, 25)) {
    tx.push({
      id: `tx_call_${c.id}`,
      transaction_type: "call_charge",
      amount: (-LEDGER_COST_PER_CALL).toFixed(2),
      balance_before: (running + LEDGER_COST_PER_CALL).toFixed(2),
      balance_after: running.toFixed(2),
      description: `Call charge — ${c.campaign_name}`,
      reference_id: "",
      call_sid: c.id,
      created_at: c.created_at,
    });
    running += LEDGER_COST_PER_CALL;
  }
  for (const r of [...ledger.recharges].reverse()) {
    tx.push({
      id: `tx_recharge_${r.index}`,
      transaction_type: "deposit",
      amount: r.amount.toFixed(2),
      balance_before: r.balanceBefore.toFixed(2),
      balance_after: r.balanceAfter.toFixed(2),
      description: r.index === 0 ? "Card deposit — Visa ••4242" : "Auto-recharge",
      reference_id: `pi_demo_${r.index}`,
      call_sid: "",
      created_at: new Date(r.at).toISOString(),
    });
  }
  tx.sort((a, b) => Date.parse(b.created_at as string) - Date.parse(a.created_at as string));
  return paged(tx, req.query);
});

route("POST", "/api/billing/deposit", () => ({
  client_secret: "demo_secret_xxx",
  payment_intent_id: "pi_demo_new",
  status: "succeeded",
}));
route("POST", "/api/billing/deposit/confirm", () => ({ ok: true, status: "succeeded" }));
route("POST", "/api/billing/deposit/capitalist", () => ({ ok: true, redirect_url: "https://demo.local/cap" }));
route("POST", "/api/billing/deposit/coingate", () => ({ ok: true, redirect_url: "https://demo.local/coin" }));

/* ─── Other out-of-scope endpoints that need a specific shape ────────── */

// White Label — `/api/white-label/` is a single config object, not a list.
route("GET", "/api/white-label/", () => ({
  id: "wl_demo",
  company_name: "Avortyx",
  logo_url: "",
  favicon_url: "",
  support_email: "support@avortyx.com",
  support_phone: "+1 (555) 014-9088",
  website_url: "https://avortyx.com",
  primary_color: "#5266E0",
  secondary_color: "#818CF8",
  domains: [],
}));
route("GET", "/api/white-label/config", () => ({
  company_name: "Avortyx",
  primary_color: "#5266E0",
  secondary_color: "#818CF8",
}));
route("GET", "/api/white-label/domains", () => []);

// Referrals — stats is an object; root is paginated (default fallback works).
route("GET", "/api/referrals/stats", () => ({
  total_invited: 14,
  total_signed_up: 6,
  total_earned: 480,
  pending_payout: 120,
  conversion_rate: 0.43,
}));

// KYC — single config object.
route("GET", "/api/kyc/", () => ({
  status: "verified",
  documents: [],
  company_status: "verified",
}));
route("GET", "/api/kyc/company/", () => ({
  legal_name: "Avortyx Demo LLC",
  status: "verified",
  documents: [],
}));

// Workspace activity / sessions / roles — paginated/array shapes.
route("GET", "/api/accounts/workspace/activity", () => ({ items: [], total: 0, page: 1, page_size: 25 }));
route("GET", "/api/accounts/workspace/sessions", () => []);
route("GET", "/api/accounts/workspace/roles", () => []);
route("GET", "/api/accounts/workspace/members", () => []);
route("GET", "/api/accounts/roles", () => []);
route("GET", "/api/accounts/access-requests/", () => ({ items: [], total: 0 }));
route("GET", "/api/accounts/api-keys/", () => []);

// Notifications — both list endpoints.
route("GET", "/api/notifications/logs", (req) => paged([], req.query));
/* ─── Pop-up alert preferences (per user) ─────────────────────────────── */

/** The catalogue the "Pop-up alerts" panel renders — same shape as the
 *  backend's GET /api/notifications/events. */
const ALERT_EVENTS = [
  { event: "campaign.cap_reached", label: "Campaign Cap Reached", default_popup: true },
  { event: "buyer.cap_reached", label: "Buyer Cap Reached", default_popup: true },
  { event: "destination.cap_reached", label: "Destination Cap Reached", default_popup: true },
  { event: "buyer.missed", label: "Buyer Missed Call", default_popup: false },
  { event: "aht.low", label: "Average Handle Time Dropped", default_popup: false },
  { event: "low.balance", label: "Low Balance", default_popup: true },
  { event: "destination.concurrency_full", label: "Destination Lines Full", default_popup: true },
  { event: "campaign.no_buyers", label: "Campaign Has No Active Buyers", default_popup: true },
  { event: "buyer.no_answer_rate", label: "Buyer No-Answer Rate High", default_popup: false },
  { event: "call.spam_blocked", label: "Spam Call Blocked", default_popup: false },
  { event: "volume.drop", label: "Call Volume Dropped", default_popup: false },
  { event: "latency.spike", label: "Routing Latency Spike", default_popup: false },
];

function alertPreferences() {
  return readObject("alert_preferences", () => ({
    popups_enabled: true,
    popup_events: ALERT_EVENTS.filter((e) => e.default_popup).map((e) => e.event),
    sound_enabled: false,
  }));
}

route("GET", "/api/notifications/events", () => ALERT_EVENTS);
route("GET", "/api/notifications/preferences", () => alertPreferences());
route("PATCH", "/api/notifications/preferences", (req) => {
  const patch = camelKeyPatch(req.body) as Record<string, unknown>;
  const current = alertPreferences();
  if (Array.isArray(patch.popup_events)) {
    const valid = new Set(ALERT_EVENTS.map((e) => e.event));
    const unknown = (patch.popup_events as string[]).filter((e) => !valid.has(e));
    if (unknown.length > 0) {
      throw new ApiError({
        status: 400,
        message: `Unknown event(s): ${unknown.join(", ")}. Valid: ${[...valid].join(", ")}`,
        code: "invalid_event",
      });
    }
  }
  const next = {
    popups_enabled: typeof patch.popups_enabled === "boolean" ? patch.popups_enabled : current.popups_enabled,
    popup_events: Array.isArray(patch.popup_events) ? (patch.popup_events as string[]) : current.popup_events,
    sound_enabled: typeof patch.sound_enabled === "boolean" ? patch.sound_enabled : current.sound_enabled,
  };
  writeObject("alert_preferences", next);
  return next;
});

route("GET", "/api/notifications/rules", () => []);

// Integrations — list endpoint.
route("GET", "/api/integrations/", () => []);

// Support chat — returns a session-id object.
route("POST", "/api/support/chat", () => ({ session_id: demoId("chat"), status: "open" }));

// Webhooks — list endpoints.
route("GET", "/api/webhooks/", () => []);
route("GET", "/api/webhooks/pixels/", () => []);

/* ─── Helpers ───────────────────────────────────────────────────────── */

function notFound(detail: string): ApiError {
  return new ApiError({
    status: 404,
    message: detail,
    body: { detail },
  });
}

/** Mirror a camelCase patch object 1:1 onto a snake_case fixture by
 *  converting just the keys. We don't recurse — the fixture fields are
 *  all flat strings/numbers/arrays. */
function camelKeyPatch(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const snake = k.replace(/([A-Z])/g, (_, c) => "_" + c.toLowerCase());
    out[snake] = v;
  }
  return out;
}
